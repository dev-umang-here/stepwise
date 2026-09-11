/* ==========================================================================
   Stepwise — Claude integration (server side only; the API key never reaches
   the browser).

   Two phases:
     analyze(text)        → problem metadata + every viable approach
     build(problem, ap)   → instrumented JS that TRACES that approach

   The generated code is never trusted: the browser runs it in a terminable
   Web Worker and checks the answer against `expected` before showing anything.
   ========================================================================== */
'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const cache = require('./cache.js');

/* Per-task models. Only one of the three jobs is genuinely hard:
 *
 *   analyze  recall + classification. Name the problem, list the standard
 *            approaches, state their invariants. Sonnet does this well.
 *   build    write an instrumented solution that RUNS CORRECTLY and narrates
 *            itself clearly. This is real reasoning, and a wrong trace is worse
 *            than none — Opus earns its rate here.
 *   code     transcribe a named approach into idiomatic C++. Short and fully
 *            specified by the time we ask. Sonnet.
 *
 * STEPWISE_MODEL overrides all three (handy for an all-cheap or all-Opus run);
 * the per-task vars override individually.
 */
const ALL = process.env.STEPWISE_MODEL;
const MODELS = {
  analyze: process.env.STEPWISE_MODEL_ANALYZE || ALL || 'claude-sonnet-5',
  build:   process.env.STEPWISE_MODEL_BUILD   || ALL || 'claude-opus-5',
  code:    process.env.STEPWISE_MODEL_CODE    || ALL || 'claude-sonnet-5'
};
const MODEL = MODELS.build;   // reported as the headline model

// USD per million tokens, for the spend line printed after each live call.
const PRICES = {
  'claude-opus-5':    { in: 5,  out: 25 },
  'claude-opus-4-8':  { in: 5,  out: 25 },
  'claude-sonnet-5':  { in: 2,  out: 10 },
  'claude-haiku-4-5': { in: 1,  out: 5  },
  'claude-fable-5':   { in: 10, out: 50 }
};

let spend = 0;

function logUsage(label, model, usage) {
  if (!usage) return;
  const p = PRICES[model] || { in: 0, out: 0 };
  const inTok = usage.input_tokens || 0;
  const outTok = usage.output_tokens || 0;
  const cost = (inTok * p.in + outTok * p.out) / 1e6;
  spend += cost;
  console.log(
    `  ${label} · ${model}: ${inTok} in / ${outTok} out · $${cost.toFixed(4)}` +
    ` · session total $${spend.toFixed(3)}`
  );
}

let client = null;
function getClient() {
  if (!client) {
    const opts = {}; // apiKey comes from ANTHROPIC_API_KEY in the environment
    // An organisation-level key must name the workspace to bill against.
    // Keys created inside a workspace already carry it and need nothing here.
    if (process.env.ANTHROPIC_WORKSPACE_ID) {
      opts.defaultHeaders = { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID };
    }
    client = new Anthropic(opts);
  }
  return client;
}

/* ----------------------------------------------------------------- schemas */

const APPROACH_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    time: { type: 'string' },
    space: { type: 'string' },
    idea: { type: 'string' },
    optimal: { type: 'boolean' },
    shape: { type: 'string', enum: ['array', 'grid', 'tree'] },
    render: { type: 'string', enum: ['cells', 'bars'] },
    invariant: { type: 'string' },
    intuition: { type: 'string' }
  },
  required: ['name', 'time', 'space', 'idea', 'optimal', 'shape', 'render', 'invariant', 'intuition'],
  additionalProperties: false
};

const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    recognised: { type: 'boolean' },
    error: { type: 'string' },
    title: { type: 'string' },
    difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
    pattern: { type: 'string' },
    goal: { type: 'string' },
    example: { type: 'string' },
    approaches: { type: 'array', items: APPROACH_SCHEMA }
  },
  required: ['recognised', 'error', 'title', 'difficulty', 'pattern', 'goal', 'example', 'approaches'],
  additionalProperties: false
};

// The trace gates the whole UI, so it is its own call and carries nothing
// optional. The C++ is fetched separately, in the background, once the
// walkthrough is already on screen.
const BUILD_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'string' },
    expected: { type: 'string' },
    example: { type: 'string' }
  },
  required: ['code', 'expected', 'example'],
  additionalProperties: false
};

const CODE_SCHEMA = {
  type: 'object',
  properties: { cpp: { type: 'string' } },
  required: ['cpp'],
  additionalProperties: false
};

/* ----------------------------------------------------------------- prompts */

function analyzePrompt(text) {
  return `You are the analysis engine of a DSA visualiser aimed at BEGINNERS.

PROBLEM (may be a URL, a problem name, or the full statement):
"""
${String(text).slice(0, 8000)}
"""

If you are given only a link or a name, use your knowledge of that well-known problem.
If you genuinely cannot identify it, set recognised=false and put a one-line reason in
"error" (leave the other fields as empty strings / empty array).

Otherwise set recognised=true, error="", and fill in:
- title:      the canonical problem name
- difficulty: Easy | Medium | Hard
- pattern:    the ONE technique it teaches, e.g. "Two Pointers", "Sliding Window",
              "Hashing", "Binary Search", "Recursion / DP", "2-D Dynamic Programming",
              "Backtracking", "Greedy". Reuse these exact spellings where they fit so
              problems group together.
- goal:       ONE plain sentence a beginner understands. No jargon, no code, no Big-O.
- example:    one small concrete input and its output,
              e.g. "nums = [2,7,11,15], target = 9  ->  [0,1]"
- approaches: 2 to 4 of them, ordered WORST to BEST, exactly one with optimal=true.
              Include the obvious naive approach when it exists — seeing why the slow
              way is wasteful is what makes the fast way memorable.
              * idea:      ONE plain sentence.
              * invariant: what is ALWAYS true while it runs. This is the single most
                           valuable field — it is what lets someone re-derive the
                           solution months later. Be concrete, not generic.
              * intuition: HOW TO WATCH the animation — 2-3 sentences telling the reader
                           what to keep their eye on and what it means. Name the colours
                           ("the amber cell is…", "everything teal is…") and the variables
                           they should track. This is a viewing guide, not a restatement
                           of the idea. Example, for two-pointer rain water:
                           "Before each step, compare the two bars under L and R. The
                           shorter one is always the one that gets solved and moves,
                           because the taller side guarantees a wall at least that high.
                           Water fills in behind the pointers and is never touched again."
              * shape:     "tree" for recursion/backtracking, "grid" for 2-D DP or
                           matrices, otherwise "array".
              * render:    "bars" when the values are heights/sizes/amounts worth
                           comparing visually, otherwise "cells". (Ignored unless
                           shape is "array", but always provide it.)`;
}

function buildPrompt(title, ap) {
  const shapeFields = ap.shape === 'array'
    ? `  items: [{v: number|string, state: string${ap.render === 'bars' ? ', fillTo?: number' : ''}}]
         MUST be the same length in every frame.${ap.render === 'bars' ? '\n         fillTo draws a filled region from the bar\'s own value up to fillTo (e.g. water level).' : ''}
  marks: {"L": 0, "R": 7}   named pointers to indices (optional, omit if not useful)`
    : ap.shape === 'grid'
    ? `  rows: [[{v: number|string|null, state: string}]]
         MUST be the same dimensions in every frame. v null means "not filled in yet".`
    : `  nodes: [{id: string, parent: string|null, label: string, value?: number, state: string}]
         Include a node only from the frame where it is first reached onward.
         Ids must be stable across frames. Exactly one node has parent null.
         CRITICAL — "label" is drawn INSIDE a small circle, so it must be at most
         4 characters: "5", "n=3", "d2", "B3". Never a phrase. Anything longer is
         truncated and the diagram becomes unreadable. Put the meaning in "then",
         which is prose, and the running numbers in "chips".`;

  return `Write JavaScript that TRACES this algorithm so a beginner can watch it work.

PROBLEM:  ${title}
APPROACH: ${ap.name} — ${ap.idea}
SHAPE:    ${ap.shape}${ap.shape === 'array' ? ' rendered as ' + ap.render : ''}

Your code runs as:  new Function("snap", YOUR_CODE)
Call snap(frame) once per meaningful step, then RETURN the final answer.

EVERY frame carries these teaching fields:
  ask:   the question the algorithm is asking itself right now
  check: the concrete comparison, WITH REAL NUMBERS — e.g. "h[L]=2 < h[R]=5"
  then:  what follows and WHY, in plain beginner English (1-2 sentences).
         Explain the reasoning, never restate the code.
  badge: [kind, label] where kind is "setup", "gain" or "done"
  chips: {name: value} — the running variables. Same keys in every frame.

PLUS the shape fields:
${shapeFields}

STATE is a colour grammar — use these exact words, exactly this way:
  "hot"  the ONE thing being decided this step
  "src"  what is being READ in order to decide it
  "done" settled, will not change again
  "gone" eliminated or proven impossible
  "idle" not touched yet

WRITE LIKE THIS (a real frame from the Trapping Rain Water walkthrough — match
this register exactly: calm, concrete, no jargon, no restating of code):
  ask:   "Which side is the shorter wall right now?"
  check: "h[L]=1  <  h[R]=2   →  left side is shorter"
  then:  "The left decides, and its ceiling is leftMax = 2. This bar is only 1,
          so 1 unit of water rests on top of it."
  badge: ["gain", "+1 water"]
  chips: {leftMax: 2, rightMax: 2, water: 5}

RULES
- Choose a SMALL example that still shows the interesting behaviour:
  arrays at most 12 long, grids at most 5x6, trees at most 15 nodes.
- Between 4 and 22 snap() calls in total. Prefer FEWER, clearer steps over many
  tiny ones — every step must earn its place by changing something visible.
- "ask" is one short question, under 12 words.
- "check" is one line of concrete arithmetic or comparison, under 60 characters.
- "then" is 1-2 sentences, under 45 words total. Say WHY the algorithm is allowed
  to do this — the insight a beginner would otherwise miss. Never narrate syntax.
- "badge" label is at most 14 characters.
- "chips" holds 2-4 variables, short names, numbers not sentences.
- The FIRST frame sets the scene with badge kind "setup" and explains the core insight.
  The LAST frame states the answer with badge kind "done".
- "check" must contain real values — never placeholders like "a[i]" alone.
- Plain ES5-compatible JavaScript. No comments, no markdown fences, no console.log,
  no async, no access to anything outside the function.
- Every loop must terminate.

Return:
  code:     the function body, as one JavaScript string
  expected: the value your code returns, as a string (e.g. "6" or "[0,1]")
  example:  the input you chose, as a short display string`;
}

/* ------------------------------------------------------------------- calls */

/** Turn an SDK/API failure into something a person can act on. */
function friendly(e) {
  const raw = (e && e.message) || '';
  const status = e && e.status;
  let msg = null;

  if (/not scoped to a workspace/i.test(raw)) {
    msg = 'That API key is not tied to a workspace. Either create a key inside a Workspace ' +
          'in the Anthropic Console, or set ANTHROPIC_WORKSPACE_ID and restart the server.';
  } else if (status === 401) {
    msg = 'The API key was rejected. Check ANTHROPIC_API_KEY, or create a new key in the Console.';
  } else if (status === 403) {
    msg = 'That API key is not allowed to make this request.';
  } else if (status === 429) {
    msg = 'Rate limited, or the account is out of credit. Wait a moment, or top up in the Console.';
  } else if (status === 400 && /credit balance|billing/i.test(raw)) {
    msg = 'The account has no credit. Add billing in the Anthropic Console.';
  } else if (status >= 500) {
    msg = 'The Anthropic API is having trouble right now. Try again shortly.';
  }

  if (!msg) return e;
  const out = new Error(msg);
  out.code = 'api';
  out.status = status || 500;
  return out;
}

async function ask(prompt, schema, effort, model, cacheKey) {
  // A repeat of the exact same request costs nothing.
  if (cacheKey) {
    const hit = cache.get(cacheKey);
    if (hit) {
      console.log('  cache hit — $0.0000');
      return hit;
    }
  }
  let out;
  try {
    out = await askRaw(prompt, schema, effort, model);
  } catch (e) {
    if (e && (e.code === 'refused' || e.code === 'bad_json')) throw e;
    throw friendly(e);
  }
  if (cacheKey) cache.set(cacheKey, out);
  return out;
}

async function askRaw(prompt, schema, effort, model) {
  const req = {
    model: model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: effort,
      format: { type: 'json_schema', schema: schema }
    },
    messages: [{ role: 'user', content: prompt }]
  };

  // Opus 5 and Fable 5 can decline a request outright; server-side fallback
  // routes those to a capable alternative instead of surfacing an error.
  // Other models neither need it nor accept it, so only send it where it applies.
  if (model === 'claude-opus-5' || model === 'claude-fable-5') {
    req.betas = ['server-side-fallback-2026-07-01'];
    req.fallbacks = 'default';
  }

  const res = await getClient().beta.messages.create(req);

  logUsage(effort + ' effort', model, res.usage);

  if (res.stop_reason === 'refusal') {
    const why = (res.stop_details && res.stop_details.category) || 'unspecified';
    const err = new Error('Claude declined this request (' + why + ').');
    err.code = 'refused';
    throw err;
  }

  const text = res.content
    .filter(function (b) { return b.type === 'text'; })
    .map(function (b) { return b.text; })
    .join('');

  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error('Claude returned unparseable JSON.');
    err.code = 'bad_json';
    throw err;
  }
}

// Effort is the second-biggest cost lever after the model, because thinking
// tokens bill as output. Analysis is recall plus classification, not hard
// reasoning, so it runs low; only the trace needs room to think.
async function analyze(text) {
  const key = ['analyze', String(text).trim().toLowerCase(), MODELS.analyze, 'low'];
  const out = await ask(analyzePrompt(text), ANALYZE_SCHEMA, 'low', MODELS.analyze, key);
  if (!out.recognised) {
    const err = new Error(out.error || 'That problem could not be identified.');
    err.code = 'unrecognised';
    throw err;
  }
  if (!Array.isArray(out.approaches) || !out.approaches.length) {
    const err = new Error('No approaches came back.');
    err.code = 'bad_json';
    throw err;
  }
  // Guarantee exactly one optimal approach — the UI opens it by default.
  if (!out.approaches.some(function (a) { return a.optimal; })) {
    out.approaches[out.approaches.length - 1].optimal = true;
  }
  return out;
}

function apKey(ap) {
  return [ap.name, ap.idea, ap.shape, ap.render].join('|');
}

async function build(title, approach) {
  const key = ['build', title, apKey(approach), MODELS.build, 'medium'];
  return ask(buildPrompt(title, approach), BUILD_SCHEMA, 'medium', MODELS.build, key);
}

function codePrompt(title, ap) {
  return `Write the C++ solution for this approach, exactly as it would be submitted
on LeetCode.

PROBLEM:  ${title}
APPROACH: ${ap.name} — ${ap.idea}
COMPLEXITY: ${ap.time} time, ${ap.space} space

RULES
- The method only, plus any small helper it needs.
- No #include lines, no "using namespace", no main(), no class wrapper.
- 4-space indent.
- A couple of short trailing comments ONLY on the lines carrying the key insight.
- It must compile, and it must be the approach named above — not a different one
  that happens to solve the problem.

The reader has just watched this approach run step by step, so this is the code they
copy out once the idea has landed.`;
}

// Cheaper and quicker than the trace: the shape is fixed and short.
async function buildCode(title, approach) {
  const key = ['code', title, apKey(approach), MODELS.code, 'low'];
  return ask(codePrompt(title, approach), CODE_SCHEMA, 'low', MODELS.code, key);
}

module.exports = { analyze, build, buildCode, MODEL, MODELS, spent: () => spend, cacheStats: cache.stats };
