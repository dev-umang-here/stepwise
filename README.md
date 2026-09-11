# Stepwise

**See how the algorithm actually thinks.**

Most people preparing for interviews re-learn the same algorithms every couple of years,
because what they memorised last time has faded. Stepwise breaks each problem into single
decisions: at every step you see what the algorithm is *asking*, what it *checks*, and why
that answer follows.

Nothing auto-plays. You move when you have understood the step.

---

## Every step has the same three lines

> **Asking** — Which side is the shorter wall right now?
> **Checking** — `h[L]=2 < h[R]=5 → left side is shorter`
> **Therefore** — The left decides, and its ceiling is leftMax = 2. This bar is only 1, so
> 1 unit of water rests on top of it.

That structure never changes — not for binary search, not for recursion, not for DP. So you
are not memorising a dozen unrelated tricks; you are learning the *shape* of algorithmic
reasoning. That is what lets you write the code yourself afterwards.

## The invariant is the point

Under every walkthrough is a line marked **Always true** — the fact that holds at every
single step.

> If the target exists at all, it is inside the live range. Everything faded is proven
> impossible.

Invariants are what let you re-derive a solution months later instead of trying to remember
it. Almost no prep resource states them plainly, and they are the most useful thing on the
page.

## Colour means something

The same four colours on every problem, so a new visualisation is readable instantly:

| | meaning |
|---|---|
| **amber** | the one thing being decided right now |
| **violet** | what is being read in order to decide it |
| **teal** | settled — it will not change again |
| grey | eliminated, or not touched yet |

## Nothing here is faked

Each walkthrough is produced by **actually running the algorithm** and recording its state at
every meaningful step. No frame is drawn by hand, so a walkthrough can never quietly disagree
with the algorithm it claims to show.

That holds for pasted problems too: the generated solution is executed in a sandboxed Web
Worker and its answer is checked against the expected one *before* a single frame is
rendered. If they disagree, you are told — you are never shown a confident-looking
walkthrough of something wrong.

## Paste any problem

A fixed library will always be incomplete, so the site can build a walkthrough for a problem
it has never seen. Give it a LeetCode link, a problem name, or the full text, and it works
out every viable approach with its complexity, its invariant, and a guide to reading the
diagram — then builds the walkthrough for whichever you pick, and ends on a C++ solution.

Generated problems are cached, so re-opening one costs nothing and re-runs locally.

---

## The library

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

Pairing a slow approach with the optimal one is deliberate — seeing *why* the naive version
is wasteful is what makes the fast one memorable.

---

## How it is built

Plain HTML, CSS and JavaScript. No framework, no build step.

The idea that makes it scale: **you never write drawing code per problem.** Every visual
shape — array, bars, grid, recursion tree — reads the same frame format, so adding a problem
means writing a short traced solution and nothing else.

```js
{
  ask:   "Which side is the shorter wall right now?",
  check: "h[L]=2  <  h[R]=5   →  left side is shorter",
  then:  "The left decides, and its ceiling is leftMax = 2…",
  badge: ["gain", "+1 water"],
  chips: { leftMax: 2, water: 9 },

  // …plus ONE of these, depending on the shape:
  items: [{ v, state, fillTo }],                    // array (cells or bars)
  rows:  [[{ v, state }]],                          // grid
  nodes: [{ id, parent, label, value, state }]      // tree
}
```

`state` is the colour grammar above, which is why the same renderer serves every problem.

Problem generation runs server-side so no API key ever reaches the browser. Generated code is
executed in a Web Worker that can be terminated, so a runaway loop cannot hang the page, and
the trace is structurally validated before anything is drawn.

Shapes still to add: linked list, graph traversal, backtracking with undo, monotonic stack,
heap.
