/* Vercel / Netlify serverless entry point.
   One function, three actions, so only a single route needs configuring.

   POST /api/analyze
     { action: "analyze", text }                → problem + approaches
     { action: "build",   title, approach }     → { code, expected, example }

   The API key lives in the platform's environment (ANTHROPIC_API_KEY) and is
   never exposed to the browser. Saving is not handled here — on a serverless
   host the filesystem is read-only, so generated problems are kept per-visitor
   in localStorage (see js/store.js). To promote one into the permanent library,
   run the site locally with `node server.js`, generate it there, and commit
   data/generated.json.
*/
'use strict';

const { analyze, build } = require('../lib/claude.js');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST', code: 'method' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      code: 'no_key',
      error: 'ANTHROPIC_API_KEY is not configured on this deployment.'
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});

    if (body.action === 'build') {
      if (!body.title || !body.approach) {
        return res.status(400).json({ error: 'Missing title or approach.', code: 'bad_request' });
      }
      return res.status(200).json(await build(String(body.title), body.approach));
    }

    if (!body.text || !String(body.text).trim()) {
      return res.status(400).json({ error: 'Nothing to analyse.', code: 'bad_request' });
    }
    return res.status(200).json(await analyze(String(body.text)));
  } catch (e) {
    const code = e && e.code;
    const status = code === 'unrecognised' || code === 'refused' ? 422
      : code === 'bad_json' ? 502
      : (e && e.status) || 500;
    return res.status(status).json({ error: (e && e.message) || 'Unknown error', code: code || 'error' });
  }
};
