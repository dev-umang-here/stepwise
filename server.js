/* ==========================================================================
   Stepwise — local dev server
     • serves the static site
     • implements /api/analyze and /api/build (needs ANTHROPIC_API_KEY)
     • implements /api/save, which appends an accepted problem to
       data/generated.json — that file IS the growing library, and committing
       it is what ships new problems to production.

   Run:  node server.js        →  http://localhost:8765
   ========================================================================== */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'generated.json');
const PORT = Number(process.env.PORT) || 8765;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

let claude = null;
function getClaude() {
  if (!claude) claude = require('./lib/claude.js');
  return claude;
}

function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(s);
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    let raw = '';
    req.on('data', function (c) {
      raw += c;
      if (raw.length > 2e6) { req.destroy(); reject(new Error('body too large')); }
    });
    req.on('end', function () {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

function readLibrary() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}

function apiError(res, e) {
  const code = e && e.code;
  const status = code === 'unrecognised' ? 422
    : code === 'refused' ? 422
    : code === 'bad_json' ? 502
    : code === 'api' ? (e.status || 500)
    : (e && e.status) || 500;
  json(res, status, { error: (e && e.message) || 'Unknown error', code: code || 'error' });
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  /* ------------------------------------------------------------- API */
  if (route.startsWith('/api/')) {
    if (req.method !== 'POST' && route !== '/api/health') {
      return json(res, 405, { error: 'Use POST' });
    }
    if (route === '/api/health') {
      return json(res, 200, { ok: true, hasKey: !!process.env.ANTHROPIC_API_KEY });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return json(res, 503, {
        code: 'no_key',
        error: 'ANTHROPIC_API_KEY is not set on the server. Export it and restart.'
      });
    }
    try {
      const body = await readBody(req);

      // The browser posts everything to /api/analyze and picks the operation
      // with `action`, so that a deployment only has to expose one function.
      // /api/build stays as an explicit alias.
      if (route === '/api/analyze' || route === '/api/build') {
        var wantsBuild = body.action === 'build' || route === '/api/build';

        if (body.action === 'code') {
          if (!body.title || !body.approach) {
            return json(res, 400, { error: 'Missing title or approach.', code: 'bad_request' });
          }
          return json(res, 200, await getClaude().buildCode(String(body.title), body.approach));
        }

        if (wantsBuild) {
          if (!body.title || !body.approach) {
            return json(res, 400, { error: 'Missing title or approach.', code: 'bad_request' });
          }
          return json(res, 200, await getClaude().build(String(body.title), body.approach));
        }

        if (!body.text || !String(body.text).trim()) {
          return json(res, 400, { error: 'Nothing to analyse.', code: 'bad_request' });
        }
        return json(res, 200, await getClaude().analyze(String(body.text)));
      }

      if (route === '/api/save') {
        if (!body.problem || !body.problem.slug) return json(res, 400, { error: 'Missing problem.' });
        const lib = readLibrary();
        const i = lib.findIndex(function (p) { return p.slug === body.problem.slug; });
        if (i >= 0) lib[i] = body.problem; else lib.push(body.problem);
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(lib, null, 2) + '\n');
        return json(res, 200, { ok: true, count: lib.length, saved: body.problem.slug });
      }

      return json(res, 404, { error: 'No such endpoint' });
    } catch (e) {
      return apiError(res, e);
    }
  }

  /* ---------------------------------------------------------- static */
  let rel = decodeURIComponent(route);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }

  fs.readFile(file, function (err, buf) {
    if (err) {
      // data/generated.json is optional — answer 404 quietly, the site copes.
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    var ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': TYPES[ext] || 'application/octet-stream',
      // Dev server: never let a browser reuse stale CSS/JS. Editing a file and
      // reloading must always show the edit, without a hard refresh.
      'Cache-Control': (ext === '.css' || ext === '.js' || ext === '.html')
        ? 'no-store, must-revalidate'
        : 'no-cache'
    });
    res.end(buf);
  });
});

server.listen(PORT, function () {
  const keyed = !!process.env.ANTHROPIC_API_KEY;
  console.log('Stepwise running at http://localhost:' + PORT);
  if (!keyed) {
    console.log('  Problem generation: OFF — export ANTHROPIC_API_KEY to enable it.');
  } else {
    const c = getClaude();
    console.log('  Problem generation: ON');
    console.log('    analyse → ' + c.MODELS.analyze);
    console.log('    trace   → ' + c.MODELS.build + '   (the hard one)');
    console.log('    C++     → ' + c.MODELS.code);
    const s = c.cacheStats();
    console.log('  Response cache: ' + (s.enabled ? s.onDisk + ' cached — repeats are free' : 'DISABLED'));
  }
  console.log('  Saved problems: ' + readLibrary().length + ' in data/generated.json');
});
