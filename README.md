# Stepwise

A free, no-sign-up website for understanding DSA algorithms by stepping through them
one decision at a time.

Every walkthrough is produced by **actually running the algorithm** and recording its
state at each meaningful step. No step is drawn by hand, so a walkthrough can never
quietly disagree with the algorithm it claims to show.

---

## Paste any problem

The library will never cover everything, so the site can build a walkthrough for a
problem it has never seen. Paste a LeetCode link, a problem name, or the full text:

1. **Analyse** — Claude identifies the problem and returns every viable approach with
   its complexity, plain-English idea, and invariant.
2. **Build** — pick an approach and Claude writes an *instrumented solution*.
3. **Run** — the browser executes that code in a terminable Web Worker.
4. **Verify** — the answer it actually returned is checked against the answer it
   predicted. You see `✓ ran · answer 6` in the header. **If they disagree, you are told**
   rather than shown a confident-looking walkthrough of something wrong.

That verification step is the entire trust model. An LLM *narrating* execution is not
safe to learn from; an LLM *writing code whose output gets checked* is.

Generated problems are saved in the visitor's own browser and appear in the library
marked `yours`. Only the code is stored, never the frames — it is re-executed each time
it is opened, so a saved walkthrough can never drift out of step with its algorithm.

---

## Run it locally

The site itself is plain HTML/CSS/JS with **no build step**. Generation needs Node and
an API key.

**Library only** (no key, no install — every bundled problem works):

```bash
cd ~/NewPhase/stepwise && python3 -m http.server 8765
```

**With problem generation:**

```bash
cd ~/NewPhase/stepwise && npm install && export ANTHROPIC_API_KEY=sk-ant-... && npm start
```

Either way, open <http://localhost:8765>. Without a key the Analyse box disables itself
and explains why; nothing breaks.

> Prefer a server over double-clicking `index.html` — over `file://` the browser blocks
> Web Workers, so generated code would fall back to a weaker main-thread sandbox.

### Getting a key

Create one at <https://console.anthropic.com> → API Keys. **Create it inside a Workspace**
— an organisation-level key is rejected with *"not scoped to a workspace"*. If you already
have an unscoped key, name the workspace instead:

```bash
export ANTHROPIC_WORKSPACE_ID=wrkspc_...
```

The key belongs in your shell environment and nowhere else — never in `js/config.js`, never
in a file in the repo, and never typed into the page itself (that box sends its contents to
the API as the problem text). If a key is ever shown in a screenshot or pasted anywhere
public, delete it in the Console and make a new one.

### Cost

Generation defaults to `claude-opus-5` (highest quality, ~$5/$25 per million tokens).
One analyse plus one build is a few cents. To trade quality for cost:

```bash
export STEPWISE_MODEL=claude-sonnet-5
```

---

## Put it online

### Vercel — recommended (keeps problem generation working)

```bash
cd ~/NewPhase/stepwise && npx vercel --prod
```

Then in the Vercel dashboard: **Settings → Environment Variables → add
`ANTHROPIC_API_KEY`** and redeploy. `api/analyze.js` becomes a serverless function; the
key stays on the server and never reaches the browser. Visitors need no account and no
key of their own — **you** pay for what they generate, so keep an eye on usage if the
link spreads.

### GitHub Pages / Netlify Drop — library only, zero cost

Static hosts cannot run the function, so the Analyse box disables itself and the bundled
problems work perfectly. This is the right choice if you just want to share the library.

```bash
cd ~/NewPhase/stepwise && git init && git add -A && git commit -m "Stepwise"
```

Create an empty GitHub repo, push, then **Settings → Pages → Source: `main` / root**.
Your link becomes `https://<your-username>.github.io/stepwise/`.

To keep generation on a static host, deploy the API to Vercel separately and point
`js/config.js` at it:

```js
window.STEPWISE_CONFIG = { apiBase: 'https://your-app.vercel.app/api/analyze' };
```

### Growing the permanent library

Run locally with a key, generate a problem, and check it reads well. Then it is one POST
away from being permanent:

```bash
curl -s -X POST http://localhost:8765/api/save -H 'Content-Type: application/json' -d @problem.json
```

That appends to `data/generated.json`, which the site loads at startup. **Commit that
file** and the problem ships to everyone — no database to run, and it stays reviewable in
git. Curating this way means the public library only ever contains walkthroughs you have
actually read.

---

## Sharing

Once deployed, the link is all anyone needs. No account, no login, works on phones.
Send it to a friend, put it in your résumé, post it anywhere.

---

## How it is built

```
index.html          page shell
css/app.css         design tokens + layout
js/config.js        where the generation endpoint lives (never the API key)
js/render.js        three renderers (array cells/bars, grid, recursion tree)
js/problems.js      the hand-written library — edit this to add permanent problems
js/sandbox.js       runs generated code in a terminable Web Worker
js/store.js         saved generated problems (localStorage + data/generated.json)
js/generate.js      analyse / build / verify pipeline
js/app.js           hash routing, problem list, step-through viewer
lib/claude.js       prompts + Anthropic calls        ← server only
api/analyze.js      serverless entry point (Vercel)  ← server only
server.js           local dev server: static + /api  ← server only
scripts/check.js    verifies every bundled trace
data/generated.json committed generated problems (optional)
```

### Why generated code is safe to run

It runs in a **Web Worker**: no DOM, no page variables, nothing but the `snap` function
it is handed. A step budget catches runaway loops that record frames, and `terminate()`
kills a true `while(true){}` that records nothing — the page stays responsive either way.
Then the trace is structurally validated (constant array length, constant grid size,
every step explained) *before* anything renders.

### The idea that makes it scale

You do **not** write drawing code per problem. Every visual shape reads the same frame
format, so adding a problem means writing a short traced solution and nothing else.

A frame is:

```js
{
  ask:   "Which side is the shorter wall right now?",
  check: "h[L]=2  <  h[R]=5   →  left side is shorter",   // real numbers, never placeholders
  then:  "Because the left is shorter, its water level is already decided…",
  badge: ["gain", "+3 water"],       // "setup" | "gain" | "done"
  chips: { leftMax: 2, water: 9 },   // running variables

  // …plus ONE of these, depending on the shape:
  items: [{ v, state, fillTo }],                    // array   (render: "cells" | "bars")
  rows:  [[{ v, state }]],                          // grid
  nodes: [{ id, parent, label, value, state }]      // tree
}
```

### The colour grammar

`state` is the same on every shape, which is why a new problem is readable instantly:

| state  | meaning                            | colour  |
|--------|------------------------------------|---------|
| `hot`  | the one thing being decided now    | amber   |
| `src`  | what is being read to decide it    | violet  |
| `done` | settled, will not change again     | teal    |
| `gone` | eliminated / proven impossible     | faded   |
| `idle` | not touched yet                    | neutral |

### Adding a problem

Append one object to `PROBLEMS` in `js/problems.js`:

```js
PROBLEMS.push({
  slug: 'my-problem',
  title: 'My Problem',
  difficulty: 'Medium',          // Easy | Medium | Hard
  pattern: 'Two Pointers',       // becomes a filter chip automatically
  goal: 'One plain sentence a beginner understands.',
  example: 'nums = [1,2,3]  →  6',
  approaches: [{
    name: 'Two Pointers',
    time: 'O(n)', space: 'O(1)',
    optimal: true,               // the optimal one opens by default
    shape: 'array', render: 'cells',
    idea: 'One sentence.',
    invariant: 'What is ALWAYS true while it runs.',
    build: function () {
      var frames = [];
      // …run the real algorithm, pushing a frame per step…
      return { frames: frames, answer: 42 };
    }
  }]
});
```

The home-page card preview renders itself from the last frame — nothing extra to do.

### Verifying the library

Every trace should return the known-correct answer. Check them all at once:

```bash
cd ~/NewPhase/stepwise && node -e "global.window=global;require('./js/problems.js');PROBLEMS.forEach(p=>p.approaches.forEach(a=>{var t=a.build();console.log(p.slug,'/',a.name,'->',t.answer,'('+t.frames.length+' steps)')}))"
```

Run it after adding a problem. If an answer is wrong, the walkthrough is wrong.

---

## Current library

| Problem | Difficulty | Pattern | Approaches |
|---|---|---|---|
| Two Sum | Easy | Hashing | Brute Force, Hash Map |
| Binary Search | Easy | Binary Search | Linear Scan, Binary Search |
| Trapping Rain Water | Hard | Two Pointers | Brute Force, Two Pointers |
| Container With Most Water | Medium | Two Pointers | Two Pointers |
| Longest Substring Without Repeats | Medium | Sliding Window | Sliding Window |
| Climbing Stairs | Easy | Recursion / DP | Plain Recursion, Recursion + Memo |
| Unique Paths | Medium | 2-D Dynamic Programming | Bottom-up DP |
| Maximum Subarray | Medium | Dynamic Programming | Kadane's Algorithm |

Pairing a slow approach with the optimal one is deliberate — seeing *why* the naive
version is wasteful is what makes the optimal one memorable.

## Shapes still to add

`linked list`, `graph (BFS/DFS)`, `backtracking with undo`, `monotonic stack`, `heap`.
Each is a new renderer in `js/render.js`; the frame format and everything else stays.
