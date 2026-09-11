/* ==========================================================================
   Stepwise — response cache
   --------------------------------------------------------------------------
   Identical requests must never be paid for twice. During development you
   re-analyse the same problems constantly, and without this every repeat is a
   fresh bill.

   Keyed on the exact inputs that change the answer (action, problem, approach,
   model, effort), so changing the model or the prompt naturally misses.

   Disk-backed and permanent: a problem analysed once is free forever. Delete
   the .cache directory to force regeneration.

   On a read-only host (Vercel), writes fail silently and it degrades to an
   in-memory cache for the lifetime of the process.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = process.env.STEPWISE_CACHE_DIR || path.join(__dirname, '..', '.cache');
const ENABLED = process.env.STEPWISE_CACHE !== '0';

const mem = new Map();
let diskOk = true;

function keyFor(parts) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(parts))
    .digest('hex')
    .slice(0, 32);
}

function fileFor(key) {
  return path.join(DIR, key + '.json');
}

function get(parts) {
  if (!ENABLED) return null;
  const key = keyFor(parts);

  if (mem.has(key)) return mem.get(key);

  if (diskOk) {
    try {
      const raw = fs.readFileSync(fileFor(key), 'utf8');
      const val = JSON.parse(raw);
      mem.set(key, val);
      return val;
    } catch (e) {
      if (e.code !== 'ENOENT') diskOk = false;
    }
  }
  return null;
}

function set(parts, value) {
  if (!ENABLED) return;
  const key = keyFor(parts);
  mem.set(key, value);

  if (!diskOk) return;
  try {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(fileFor(key), JSON.stringify(value));
  } catch (e) {
    diskOk = false;   // read-only filesystem: memory cache still works
  }
}

function stats() {
  let files = 0;
  try { files = fs.readdirSync(DIR).filter(f => f.endsWith('.json')).length; }
  catch (e) { files = 0; }
  return { enabled: ENABLED, onDisk: files, inMemory: mem.size, dir: DIR };
}

module.exports = { get, set, stats };
