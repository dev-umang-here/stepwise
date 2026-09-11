/* ==========================================================================
   Stepwise — problem library
   --------------------------------------------------------------------------
   Each approach carries a `build()` that RUNS the real algorithm and records
   a frame per meaningful step. Nothing here is hand-drawn frame by frame, so
   a trace can never disagree with the algorithm it claims to show.

   To add a problem: push one object onto PROBLEMS. No drawing code needed.
   ========================================================================== */
(function (global) {
  'use strict';

  var PROBLEMS = [];

  /* ------------------------------------------------------------- Two Sum */
  var TS_NUMS = [2, 5, 11, 7, 1, 15], TS_TARGET = 18;

  function twoSumBrute() {
    var a = TS_NUMS, t = TS_TARGET, F = [], tried = 0, ans = null;
    function items(i, j, done) {
      return a.map(function (v, k) {
        return { v: v, state: k === i ? 'hot' : (k === j ? 'src' : (done && (k === i || k === j) ? 'done' : 'idle')) };
      });
    }
    F.push({ items: a.map(function (v) { return { v: v, state: 'idle' }; }),
      ask: 'What are we starting with?',
      check: 'nums = [' + a.join(', ') + ']   target = ' + t,
      then: 'The simplest idea: try every possible pair and see which one adds up to the target.',
      badge: ['setup', 'setup'], chips: { pairsTried: 0, found: '–' } });
    outer:
    for (var i = 0; i < a.length; i++) {
      for (var j = i + 1; j < a.length; j++) {
        tried++;
        var sum = a[i] + a[j], hit = sum === t;
        if (hit) ans = [i, j];
        F.push({ items: items(i, j, hit), marks: { i: i, j: j },
          ask: 'Do these two add up to the target?',
          check: 'nums[' + i + ']=' + a[i] + '  +  nums[' + j + ']=' + a[j] + '  =  ' + sum + (hit ? '  ==  ' + t : '  ≠  ' + t),
          then: hit
            ? 'That is the pair. Answer: indices [' + i + ', ' + j + ']. It took ' + tried + ' pair checks to get here.'
            : 'Not a match, so move j along and try the next pair. Every element gets compared with every other one — that is what makes this slow.',
          badge: hit ? ['done', 'found [' + i + ',' + j + ']'] : ['setup', 'pair ' + tried],
          chips: { pairsTried: tried, found: hit ? '[' + i + ',' + j + ']' : '–' } });
        if (hit) break outer;
      }
    }
    return { frames: F, answer: JSON.stringify(ans) };
  }

  function twoSumHash() {
    var a = TS_NUMS, t = TS_TARGET, F = [], seen = {}, ans = null;
    function items(i, partner) {
      return a.map(function (v, k) {
        if (k === i) return { v: v, state: 'hot' };
        if (partner !== undefined && k === partner) return { v: v, state: 'src' };
        return { v: v, state: (k in indexSet) ? 'done' : 'idle' };
      });
    }
    var indexSet = {};
    F.push({ items: a.map(function (v) { return { v: v, state: 'idle' }; }),
      ask: 'Can we avoid checking every pair?',
      check: 'nums = [' + a.join(', ') + ']   target = ' + t,
      then: 'Instead of looking forward at every later number, we remember every number we have already passed. Then at each step we only ask one question.',
      badge: ['setup', 'setup'], chips: { stored: 0, found: '–' } });
    for (var i = 0; i < a.length; i++) {
      var need = t - a[i];
      var has = Object.prototype.hasOwnProperty.call(seen, need);
      if (has) {
        ans = [seen[need], i];
        F.push({ items: items(i, seen[need]), marks: { i: i },
          ask: 'Have I already seen the number that completes this pair?',
          check: 'need ' + t + ' − ' + a[i] + ' = ' + need + '   →  yes, at index ' + seen[need],
          then: 'The partner was stored earlier, so the pair is [' + seen[need] + ', ' + i + ']. One pass, and each lookup was instant — no rescanning.',
          badge: ['done', 'found [' + seen[need] + ',' + i + ']'],
          chips: { stored: Object.keys(seen).length, found: '[' + seen[need] + ',' + i + ']' } });
        break;
      }
      F.push({ items: items(i), marks: { i: i },
        ask: 'Have I already seen the number that completes this pair?',
        check: 'need ' + t + ' − ' + a[i] + ' = ' + need + '   →  not stored yet',
        then: 'No match, so store ' + a[i] + ' with its index and move on. Everything teal is a number we can now recognise instantly.',
        badge: ['setup', 'store ' + a[i]],
        chips: { stored: Object.keys(seen).length + 1, found: '–' } });
      seen[a[i]] = i; indexSet[i] = true;
    }
    return { frames: F, answer: JSON.stringify(ans) };
  }

  PROBLEMS.push({
    slug: 'two-sum', title: 'Two Sum', difficulty: 'Easy', pattern: 'Hashing',
    goal: 'Find the two positions in a list whose numbers add up to a given target.',
    example: 'nums = [2, 5, 11, 7, 1, 15], target = 18  →  [2, 3]',
    approaches: [
      { name: 'Brute Force', time: 'O(n²)', space: 'O(1)', optimal: false, shape: 'array', render: 'cells',
        idea: 'Try every possible pair until one adds up to the target.',
        invariant: 'Every pair before the current one has been checked and ruled out.',
        intuition: 'Watch the two pointers i and j. i parks on a number while j sweeps everything to its right, then i moves one step and j restarts. The step counter is the real story — it climbs fast, because every element is compared against every other one.',
        cpp: `vector<int> twoSum(vector<int>& nums, int target) {
    for (int i = 0; i < nums.size(); ++i)
        for (int j = i + 1; j < nums.size(); ++j)
            if (nums[i] + nums[j] == target)
                return {i, j};
    return {};
}`,
        build: twoSumBrute },
      { name: 'Hash Map', time: 'O(n)', space: 'O(n)', optimal: true, shape: 'array', render: 'cells',
        idea: 'Walk once, remembering every number seen; at each step ask whether its partner is already known.',
        invariant: 'Everything to the left of the pointer is stored and can be found instantly.',
        intuition: 'Teal cells are numbers already memorised. Instead of looking forward at everything ahead, each step asks one question about what is behind: "have I seen target − me?" When the answer is yes, the violet cell is the partner it remembers.',
        cpp: `vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> seen;           // value -> index
    for (int i = 0; i < nums.size(); ++i) {
        int need = target - nums[i];
        auto it = seen.find(need);
        if (it != seen.end())
            return {it->second, i};
        seen[nums[i]] = i;
    }
    return {};
}`,
        build: twoSumHash }
    ]
  });

  /* ------------------------------------------------------- Binary Search */
  var BS = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], BS_T = 23;

  function linearScan() {
    var a = BS, t = BS_T, F = [], looks = 0, found = -1;
    F.push({ items: a.map(function (v) { return { v: v, state: 'idle' }; }),
      ask: 'What are we starting with?',
      check: 'sorted array of ' + a.length + ' values   ·   target = ' + t,
      then: 'The obvious approach is to check each value from the left until we hit the target.',
      badge: ['setup', 'setup'], chips: { looks: 0, found: '–' } });
    for (var i = 0; i < a.length; i++) {
      looks++;
      var hit = a[i] === t;
      if (hit) found = i;
      F.push({ items: a.map(function (v, k) { return { v: v, state: k === i ? 'hot' : (k < i ? 'gone' : 'idle') }; }), marks: { i: i },
        ask: 'Is this the value we want?',
        check: 'a[' + i + '] = ' + a[i] + (hit ? '  ==  ' + t : '  ≠  ' + t),
        then: hit ? 'Found it at index ' + i + ' — but it cost ' + looks + ' looks. Notice we never once used the fact that the array is sorted.'
                  : 'Not it. Move one step right. This approach ignores the ordering completely, so it can only ever eliminate one value at a time.',
        badge: hit ? ['done', 'found at ' + i] : ['setup', 'look ' + looks],
        chips: { looks: looks, found: hit ? i : '–' } });
      if (hit) break;
    }
    return { frames: F, answer: found };
  }

  function binarySearch() {
    var a = BS, t = BS_T, F = [], lo = 0, hi = a.length - 1, probes = 0, found = -1;
    function items(mid) {
      return a.map(function (v, k) {
        if (k < lo || k > hi) return { v: v, state: 'gone' };
        if (k === mid) return { v: v, state: 'hot' };
        return { v: v, state: 'done' };
      });
    }
    F.push({ items: items(-1), marks: { lo: lo, hi: hi },
      ask: 'What are we starting with?',
      check: 'sorted array of ' + a.length + ' values   ·   target = ' + t,
      then: 'Because the array is sorted, one comparison can rule out half of everything left. We keep a live range that must contain the answer.',
      badge: ['setup', 'setup'], chips: { lo: lo, hi: hi, probes: 0 } });
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      probes++;
      if (a[mid] === t) {
        found = mid;
        F.push({ items: items(mid), marks: { lo: lo, hi: hi, mid: mid },
          ask: 'Is the middle value the one we want?',
          check: 'a[' + mid + '] = ' + a[mid] + '  ==  ' + t,
          then: 'Found at index ' + mid + ' after only ' + probes + ' probes, instead of scanning ' + a.length + ' values.',
          badge: ['done', 'found at ' + mid], chips: { lo: lo, hi: hi, probes: probes } });
        break;
      }
      var tooSmall = a[mid] < t, killed;
      F.push({ items: items(mid), marks: { lo: lo, hi: hi, mid: mid },
        ask: 'Is the middle value the one we want?',
        check: 'a[' + mid + '] = ' + a[mid] + (tooSmall ? '  <  ' : '  >  ') + t,
        then: tooSmall
          ? 'Too small. Since everything to the left is even smaller, indices ' + lo + '…' + mid + ' are all impossible — discarded in one comparison.'
          : 'Too big. Since everything to the right is even bigger, indices ' + mid + '…' + hi + ' are all impossible — discarded in one comparison.',
        badge: ['gain', '−' + (tooSmall ? (mid - lo + 1) : (hi - mid + 1)) + ' candidates'],
        chips: { lo: lo, hi: hi, probes: probes } });
      if (tooSmall) lo = mid + 1; else hi = mid - 1;
    }
    return { frames: F, answer: found };
  }

  PROBLEMS.push({
    slug: 'binary-search', title: 'Binary Search', difficulty: 'Easy', pattern: 'Binary Search',
    goal: 'Find where a value sits in a sorted list without checking every element.',
    example: 'a = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91], target = 23  →  index 5',
    approaches: [
      { name: 'Linear Scan', time: 'O(n)', space: 'O(1)', optimal: false, shape: 'array', render: 'cells',
        idea: 'Check each value from left to right until the target turns up.',
        invariant: 'Everything to the left of the pointer has been checked and is not the target.',
        intuition: 'Cells fade one at a time, left to right. Each step eliminates exactly one candidate, so the faded region grows by one — that steady, slow crawl is what O(n) looks like, and it is the thing binary search fixes.',
        cpp: `int search(vector<int>& a, int target) {
    for (int i = 0; i < a.size(); ++i)
        if (a[i] == target) return i;
    return -1;
}`,
        build: linearScan },
      { name: 'Binary Search', time: 'O(log n)', space: 'O(1)', optimal: true, shape: 'array', render: 'cells',
        idea: 'Compare against the middle and throw away the half that cannot contain the answer.',
        invariant: 'If the target exists at all, it is inside the live range. Everything faded is proven impossible.',
        intuition: 'Watch the teal band, not the amber cell. That band is everything still possible, and one comparison roughly halves it. Compare how fast it collapses here against the one-at-a-time fade in Linear Scan — same array, same target.',
        cpp: `int search(vector<int>& a, int target) {
    int lo = 0, hi = (int)a.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;      // avoids overflow
        if (a[mid] == target) return mid;
        if (a[mid] < target) lo = mid + 1;
        else                 hi = mid - 1;
    }
    return -1;
}`,
        build: binarySearch }
    ]
  });

  /* -------------------------------------------------- Trapping Rain Water */
  var RW = [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1];

  function rainBrute() {
    var h = RW, F = [], fill = new Array(h.length).fill(null), total = 0, scans = 0;
    F.push({ items: h.map(function (v) { return { v: v, state: 'idle' }; }),
      ask: 'What are we starting with?',
      check: h.length + ' bars of differing heights',
      then: 'Water above any bar is capped by the shorter of the tallest wall to its left and the tallest wall to its right. The direct approach: work that out for each bar separately.',
      badge: ['setup', 'setup'], chips: { bar: '–', water: 0, scans: 0 } });
    for (var i = 0; i < h.length; i++) {
      var lm = 0, rm = 0, k;
      for (k = 0; k <= i; k++) { lm = Math.max(lm, h[k]); scans++; }
      for (k = i; k < h.length; k++) { rm = Math.max(rm, h[k]); scans++; }
      var cap = Math.min(lm, rm), add = Math.max(0, cap - h[i]);
      total += add; fill[i] = cap;
      F.push({ items: h.map(function (v, j) {
          return { v: v, state: j === i ? 'hot' : (fill[j] !== null ? 'done' : 'src'),
                   fillTo: fill[j] === null ? undefined : fill[j] };
        }), marks: { i: i },
        ask: 'How much water sits on top of this bar?',
        check: 'tallest left = ' + lm + '   tallest right = ' + rm + '   →  cap = min = ' + cap,
        then: 'Water here is ' + cap + ' − ' + h[i] + ' = ' + add + '. Getting those two maxima meant rescanning the array in both directions — and we will do it all over again for the next bar.',
        badge: add > 0 ? ['gain', '+' + add + ' water'] : ['setup', 'no water'],
        chips: { bar: i, water: total, scans: scans } });
    }
    F[F.length - 1].badge = ['done', 'answer ' + total];
    return { frames: F, answer: total };
  }

  function rainTwoPointer() {
    var h = RW, F = [], fill = new Array(h.length).fill(null);
    var L = 0, R = h.length - 1, lm = 0, rm = 0, w = 0;
    function items(hot) {
      return h.map(function (v, i) {
        return { v: v, state: i === hot ? 'hot' : (fill[i] !== null ? 'done' : 'idle'),
                 fillTo: fill[i] === null ? undefined : fill[i] };
      });
    }
    F.push({ items: items(-1), marks: { L: L, R: R },
      ask: 'What are we starting with?',
      check: h.length + ' bars   ·   a pointer at each end',
      then: 'Here is the insight: whichever end is currently the SHORTER wall, that side\'s water level is already fully decided — the other side can only ever be taller.',
      badge: ['setup', 'setup'], chips: { leftMax: 0, rightMax: 0, water: 0 } });
    while (L < R) {
      if (h[L] < h[R]) {
        var nw = h[L] >= lm;
        if (nw) lm = h[L]; else w += lm - h[L];
        fill[L] = lm;
        F.push({ items: items(L), marks: { L: L, R: R },
          ask: 'Which side is the shorter wall right now?',
          check: 'h[L]=' + h[L] + '  <  h[R]=' + h[R] + '   →  left side is shorter',
          then: nw ? 'The left decides, and this bar (' + h[L] + ') is the tallest we have seen on the left — so leftMax becomes ' + lm + ' and it holds no water itself.'
                   : 'The left decides, and its ceiling is leftMax = ' + lm + '. This bar is only ' + h[L] + ', so ' + (lm - h[L]) + ' unit(s) of water rest on top of it.',
          badge: nw ? ['setup', 'new wall'] : ['gain', '+' + (lm - h[L]) + ' water'],
          chips: { leftMax: lm, rightMax: rm, water: w } });
        L++;
      } else {
        var nw2 = h[R] >= rm;
        if (nw2) rm = h[R]; else w += rm - h[R];
        fill[R] = rm;
        F.push({ items: items(R), marks: { L: L, R: R },
          ask: 'Which side is the shorter wall right now?',
          check: 'h[R]=' + h[R] + '  ≤  h[L]=' + h[L] + '   →  right side is shorter',
          then: nw2 ? 'The right decides, and this bar (' + h[R] + ') is the tallest we have seen on the right — so rightMax becomes ' + rm + ' and it holds no water itself.'
                    : 'The right decides, and its ceiling is rightMax = ' + rm + '. This bar is only ' + h[R] + ', so ' + (rm - h[R]) + ' unit(s) of water rest on top of it.',
          badge: nw2 ? ['setup', 'new wall'] : ['gain', '+' + (rm - h[R]) + ' water'],
          chips: { leftMax: lm, rightMax: rm, water: w } });
        R--;
      }
    }
    F.push({ items: items(-1), marks: { L: L, R: R },
      ask: 'Are we done?', check: 'L = ' + L + '   and   R = ' + R + '   →  the pointers have met',
      then: 'Every column was settled exactly once, in a single pass, with no extra memory. Total water trapped: ' + w + '.',
      badge: ['done', 'answer ' + w], chips: { leftMax: lm, rightMax: rm, water: w } });
    return { frames: F, answer: w };
  }

  PROBLEMS.push({
    slug: 'trapping-rain-water', title: 'Trapping Rain Water', difficulty: 'Hard', pattern: 'Two Pointers',
    goal: 'After it rains, how much water is trapped in the dips of a skyline of bars?',
    example: 'height = [0,1,0,2,1,0,1,3,2,1,2,1]  →  6',
    approaches: [
      { name: 'Brute Force', time: 'O(n²)', space: 'O(1)', optimal: false, shape: 'array', render: 'bars',
        idea: 'For every bar, rescan left and right to find the tallest wall on each side.',
        invariant: 'Water above a bar equals min(tallest left, tallest right) − its own height.',
        intuition: 'The amber bar is the one being solved. Everything dimmed is being re-read to find its two tallest walls — and it gets re-read again for the next bar, and the next. Watch the scans counter: that repetition is the whole cost.',
        cpp: `int trap(vector<int>& h) {
    int n = h.size(), total = 0;
    for (int i = 0; i < n; ++i) {
        int lm = 0, rm = 0;
        for (int k = 0; k <= i; ++k) lm = max(lm, h[k]);
        for (int k = i; k < n; ++k) rm = max(rm, h[k]);
        total += min(lm, rm) - h[i];        // never negative
    }
    return total;
}`,
        build: rainBrute },
      { name: 'Two Pointers', time: 'O(n)', space: 'O(1)', optimal: true, shape: 'array', render: 'bars',
        idea: 'Walk inward from both ends; whichever side is shorter already has its water level decided.',
        invariant: 'Every bar outside the L…R range already has its final water level and is never revisited.',
        intuition: 'Before each step, compare the two bars under L and R. The shorter one is always the one that gets solved and moves — because the taller side guarantees a wall at least that high, so that column\'s ceiling is already known. Water is filled in behind the pointers and never touched again.',
        cpp: `int trap(vector<int>& h) {
    int l = 0, r = h.size() - 1;
    int lm = 0, rm = 0, water = 0;
    while (l < r) {
        if (h[l] < h[r]) {                  // left is the limiting wall
            if (h[l] >= lm) lm = h[l];
            else water += lm - h[l];
            ++l;
        } else {                            // right is the limiting wall
            if (h[r] >= rm) rm = h[r];
            else water += rm - h[r];
            --r;
        }
    }
    return water;
}`,
        build: rainTwoPointer }
    ]
  });

  /* ---------------------------------------------- Container With Most Water */
  function container() {
    var h = [1, 8, 6, 2, 5, 4, 8, 3, 7], F = [], L = 0, R = h.length - 1, best = 0;
    F.push({ items: h.map(function (v) { return { v: v, state: 'idle' }; }), marks: { L: L, R: R },
      ask: 'What are we starting with?',
      check: h.length + ' vertical lines   ·   pick two to form a container',
      then: 'Start as wide as possible. From here width can only shrink, so the only way to improve is to find a taller wall.',
      badge: ['setup', 'setup'], chips: { width: R - L, area: 0, best: 0 } });
    while (L < R) {
      var cap = Math.min(h[L], h[R]), width = R - L, area = cap * width;
      var better = area > best;
      if (better) best = area;
      var moveLeft = h[L] < h[R];
      F.push({ items: h.map(function (v, i) {
          return { v: v, state: (i === L || i === R) ? 'hot' : (i > L && i < R ? 'src' : 'gone') };
        }), marks: { L: L, R: R },
        ask: 'How much does this pair hold, and which side should move?',
        check: 'min(' + h[L] + ', ' + h[R] + ') × ' + width + '  =  ' + area + (better ? '   ★ new best' : '   (best stays ' + best + ')'),
        then: 'Height is capped by the shorter wall, so moving the TALLER one keeps the same cap but loses width — it can never help. Moving the ' +
              (moveLeft ? 'left' : 'right') + ' (shorter) wall is the only move that could improve things.',
        badge: better ? ['gain', 'best ' + best] : ['setup', 'area ' + area],
        chips: { width: width, area: area, best: best } });
      if (moveLeft) L++; else R--;
    }
    F.push({ items: h.map(function (v) { return { v: v, state: 'done' }; }), marks: { L: L, R: R },
      ask: 'Are we done?', check: 'L = ' + L + '   and   R = ' + R + '   →  pointers met',
      then: 'Every pair worth considering was covered without testing all of them. Largest container: ' + best + '.',
      badge: ['done', 'answer ' + best], chips: { width: 0, area: 0, best: best } });
    return { frames: F, answer: best };
  }

  PROBLEMS.push({
    slug: 'container-with-most-water', title: 'Container With Most Water', difficulty: 'Medium', pattern: 'Two Pointers',
    goal: 'Pick two vertical lines that, with the ground, hold the most water between them.',
    example: 'height = [1,8,6,2,5,4,8,3,7]  →  49',
    approaches: [
      { name: 'Two Pointers', time: 'O(n)', space: 'O(1)', optimal: true, shape: 'array', render: 'bars',
        idea: 'Start at the widest pair and always move whichever wall is shorter.',
        invariant: 'Every pair that could beat the current best is still between the two pointers.',
        intuition: 'Two amber walls form the container; everything violet between them is the water it holds. Width shrinks on every single step, so the only way to gain is a taller wall — which is why the shorter wall is always the one that moves. Moving the taller one would keep the same ceiling and lose width.',
        cpp: `int maxArea(vector<int>& h) {
    int l = 0, r = h.size() - 1, best = 0;
    while (l < r) {
        best = max(best, min(h[l], h[r]) * (r - l));
        if (h[l] < h[r]) ++l;               // move the shorter wall
        else             --r;
    }
    return best;
}`,
        build: container }
    ]
  });

  /* ------------------------------------------- Longest Substring (window) */
  function slidingWindow() {
    var s = 'abcabcbb'.split(''), F = [], seen = {}, L = 0, best = 0;
    F.push({ items: s.map(function (c) { return { v: c, state: 'idle' }; }),
      ask: 'What are we starting with?', check: '"' + s.join('') + '"   ·   no character may repeat inside the window',
      then: 'We keep a window that is always valid. It grows on the right, and whenever a repeat appears, the left edge slides forward just enough to fix it.',
      badge: ['setup', 'setup'], chips: { window: '""', size: 0, best: 0 } });
    for (var Rr = 0; Rr < s.length; Rr++) {
      var shrank = false, dropped = '';
      while (Object.prototype.hasOwnProperty.call(seen, s[Rr])) {
        dropped += s[L]; delete seen[s[L]]; L++; shrank = true;
      }
      seen[s[Rr]] = true;
      var size = Rr - L + 1, better = size > best;
      if (better) best = size;
      (function (LL, RR) {
        F.push({ items: s.map(function (c, i) {
            return { v: c, state: i === RR ? 'hot' : (i >= LL && i < RR ? 'done' : (i < LL ? 'gone' : 'idle')) };
          }), marks: { L: LL, R: RR },
          ask: 'Can the window include this character?',
          check: "'" + s[RR] + "'" + (shrank ? '  is already inside  →  slide L past "' + dropped + '"' : '  is new  →  just extend'),
          then: (shrank
            ? 'A repeat would break the rule, so the left edge moves up until the duplicate is gone. '
            : 'No conflict, so the window simply grows. ') +
            'Window is now "' + s.slice(LL, RR + 1).join('') + '", length ' + size + '.' + (better ? ' That is a new best.' : ''),
          badge: better ? ['gain', 'best ' + best] : ['setup', 'size ' + size],
          chips: { window: '"' + s.slice(LL, RR + 1).join('') + '"', size: size, best: best } });
      })(L, Rr);
    }
    F[F.length - 1].badge = ['done', 'answer ' + best];
    return { frames: F, answer: best };
  }

  PROBLEMS.push({
    slug: 'longest-substring', title: 'Longest Substring Without Repeats', difficulty: 'Medium', pattern: 'Sliding Window',
    goal: 'Find the longest stretch of a string in which no character appears twice.',
    example: '"abcabcbb"  →  3  ("abc")',
    approaches: [
      { name: 'Sliding Window', time: 'O(n)', space: 'O(k)', optimal: true, shape: 'array', render: 'cells',
        idea: 'Grow a window on the right; when a repeat appears, slide the left edge past it.',
        invariant: 'The window never contains a duplicate, so its length is always a valid candidate answer.',
        intuition: 'The teal run between L and R is the current window, and it is always valid — no repeats inside it. R advances every step; L only jumps when the incoming character is already in the window. Neither pointer ever goes backwards, which is why one pass is enough.',
        cpp: `int lengthOfLongestSubstring(string s) {
    unordered_set<char> win;
    int l = 0, best = 0;
    for (int r = 0; r < s.size(); ++r) {
        while (win.count(s[r])) {           // shrink until valid again
            win.erase(s[l]);
            ++l;
        }
        win.insert(s[r]);
        best = max(best, r - l + 1);
    }
    return best;
}`,
        build: slidingWindow }
    ]
  });

  /* ----------------------------------------------------- Climbing Stairs */
  var CS_N = 5;

  function climbNaive() {
    var F = [], nodes = [], uid = 0, calls = 0;
    function shot(focusId, live, ask, check, then, badge, extra) {
      F.push({ nodes: live.map(function (nd) {
          return { id: nd.id, parent: nd.parent, label: nd.n,
                   value: nd.value, state: nd.id === focusId ? 'hot' : (nd.value != null ? 'done' : 'idle') };
        }), ask: ask, check: check, then: then, badge: badge,
        chips: { calls: calls, answer: extra === undefined ? '?' : extra } });
    }
    function go(n, parent) {
      var id = 'n' + (uid++);
      var nd = { id: id, parent: parent, n: n, value: null };
      nodes.push(nd); calls++;
      if (n <= 1) {
        nd.value = 1;
        shot(id, nodes.slice(), 'How do we solve climb(' + n + ')?', 'n = ' + n + '  →  base case',
          'There is exactly 1 way to be standing here, so this branch stops and returns 1.',
          ['setup', 'base = 1']);
        return 1;
      }
      shot(id, nodes.slice(), 'How do we solve climb(' + n + ')?',
        'climb(' + n + ')  =  climb(' + (n - 1) + ')  +  climb(' + (n - 2) + ')',
        'We cannot answer it directly, so it splits into two smaller calls — and each of those will split again.',
        ['setup', 'split']);
      var a = go(n - 1, id), b = go(n - 2, id);
      nd.value = a + b;
      return nd.value;
    }
    var answer = go(CS_N, null);
    var repeats = {};
    nodes.forEach(function (nd) { repeats[nd.n] = (repeats[nd.n] || 0) + 1; });
    var worst = Object.keys(repeats).sort(function (x, y) { return repeats[y] - repeats[x]; })[0];
    shot(null, nodes.slice(), 'What did that cost us?',
      calls + ' calls for n = ' + CS_N + '   ·   climb(' + worst + ') alone was computed ' + repeats[worst] + ' times',
      'The answer is ' + answer + ', but look at the tree: identical sub-problems were rebuilt from scratch again and again. That repetition is what makes this exponential — and it is exactly what memoisation removes.',
      ['done', 'answer ' + answer], answer);
    return { frames: F, answer: answer };
  }

  function climbMemo() {
    var F = [], nodes = [], uid = 0, memo = {}, calls = 0, reused = 0;
    function shot(focusId, ask, check, then, badge, done) {
      F.push({ nodes: nodes.map(function (nd) {
          return { id: nd.id, parent: nd.parent, label: nd.n, value: nd.value,
                   state: nd.id === focusId ? (nd.kind === 'memo' ? 'src' : 'hot')
                                            : (nd.kind === 'memo' ? 'src' : (nd.value != null ? 'done' : 'idle')) };
        }), ask: ask, check: check, then: then, badge: badge,
        chips: { calls: calls, reused: reused, answer: done === undefined ? '?' : done } });
    }
    function go(n, parent) {
      var id = 'm' + (uid++);
      var nd = { id: id, parent: parent, n: n, value: null, kind: null };
      nodes.push(nd); calls++;
      if (Object.prototype.hasOwnProperty.call(memo, n)) {
        nd.kind = 'memo'; nd.value = memo[n]; reused++;
        shot(id, 'We need climb(' + n + ') again — rebuild it?',
          'memo[' + n + '] = ' + memo[n] + '   (already solved earlier)',
          'No work at all: we look the answer up. Without this, the entire subtree underneath would be rebuilt from scratch — this single line is what turns exponential into linear.',
          ['gain', 'reused, 0 work']);
        return memo[n];
      }
      if (n <= 1) {
        memo[n] = 1; nd.value = 1; nd.kind = 'base';
        shot(id, 'How do we solve climb(' + n + ')?', 'n = ' + n + '  →  base case',
          'Exactly 1 way to stand here. Return 1, and store it so it is never computed again.',
          ['setup', 'base = 1']);
        return 1;
      }
      shot(id, 'How do we solve climb(' + n + ')?',
        'climb(' + n + ')  =  climb(' + (n - 1) + ')  +  climb(' + (n - 2) + ')',
        'To reach step ' + n + ' you arrived from step ' + (n - 1) + ' or step ' + (n - 2) + '. So split, solve both, and add.',
        ['setup', 'split']);
      var a = go(n - 1, id), b = go(n - 2, id);
      nd.value = a + b; nd.kind = 'computed'; memo[n] = nd.value;
      shot(id, 'Both halves are back — what does climb(' + n + ') return?',
        a + ' + ' + b + ' = ' + nd.value,
        parent === null
          ? 'The root resolves: there are ' + nd.value + ' distinct ways to climb ' + CS_N + ' steps — using only ' + calls + ' calls, ' + reused + ' of which were free lookups.'
          : 'climb(' + n + ') = ' + nd.value + ', and it goes straight into the memo so nobody ever recomputes it.',
        parent === null ? ['done', 'answer ' + nd.value] : ['gain', '= ' + nd.value],
        parent === null ? nd.value : undefined);
      return nd.value;
    }
    var answer = go(CS_N, null);
    return { frames: F, answer: answer };
  }

  PROBLEMS.push({
    slug: 'climbing-stairs', title: 'Climbing Stairs', difficulty: 'Easy', pattern: 'Recursion / DP',
    goal: 'Climbing 1 or 2 steps at a time, how many different ways can you reach step ' + CS_N + '?',
    example: 'n = 5  →  8 ways',
    approaches: [
      { name: 'Plain Recursion', time: 'O(2ⁿ)', space: 'O(n)', optimal: false, shape: 'tree',
        idea: 'Split every step into two smaller sub-problems and solve each from scratch.',
        invariant: 'Every node equals the sum of its two children — correct, but the same sub-problems get rebuilt repeatedly.',
        intuition: 'Read the tree downward: every node splits into n−1 and n−2 until it bottoms out. Now look across a row — the same numbers keep reappearing as separate nodes. Each duplicate is an entire subtree being rebuilt from nothing, and that duplication is what makes this exponential.',
        cpp: `int climbStairs(int n) {
    if (n <= 1) return 1;
    return climbStairs(n - 1) + climbStairs(n - 2);
}`,
        build: climbNaive },
      { name: 'Recursion + Memo', time: 'O(n)', space: 'O(n)', optimal: true, shape: 'tree',
        idea: 'Same split, but store each answer the first time so repeats become instant lookups.',
        invariant: 'Each distinct n is solved at most once; every later request for it is a lookup, never a recomputation.',
        intuition: 'Same tree as before, but watch for the violet ↺ nodes — each one is a value already solved, returned instantly instead of expanding. Every violet node is a whole subtree that never gets built. Compare the calls counter here against Plain Recursion on the same n.',
        cpp: `int solve(int n, vector<int>& memo) {
    if (n <= 1) return 1;
    if (memo[n] != -1) return memo[n];      // already solved — reuse it
    return memo[n] = solve(n - 1, memo) + solve(n - 2, memo);
}

int climbStairs(int n) {
    vector<int> memo(n + 1, -1);
    return solve(n, memo);
}`,
        build: climbMemo }
    ]
  });

  /* --------------------------------------------------------- Unique Paths */
  function uniquePaths() {
    var m = 3, n = 4, dp = [], F = [], filled = 0, i, j;
    for (i = 0; i < m; i++) { dp.push(new Array(n).fill(null)); }
    function rows(ci, cj, srcs) {
      return dp.map(function (row, ri) {
        return row.map(function (v, rj) {
          var st = 'idle';
          if (ci === ri && cj === rj) st = 'hot';
          else if (srcs && srcs.some(function (p) { return p[0] === ri && p[1] === rj; })) st = 'src';
          else if (v !== null) st = 'done';
          return { v: v, state: st };
        });
      });
    }
    F.push({ rows: rows(-1, -1, null),
      ask: 'What are we starting with?', check: 'a ' + m + ' × ' + n + ' grid   ·   you may only move right or down',
      then: 'Rather than trace every route, we fill in for each cell HOW MANY routes reach it. Once a cell knows its own count, it never changes again.',
      badge: ['setup', 'setup'], chips: { filled: 0, answer: '?' } });
    for (i = 0; i < m; i++) {
      for (j = 0; j < n; j++) {
        var srcs = [];
        if (i === 0 || j === 0) dp[i][j] = 1;
        else { srcs = [[i - 1, j], [i, j - 1]]; dp[i][j] = dp[i - 1][j] + dp[i][j - 1]; }
        filled++;
        var last = (i === m - 1 && j === n - 1);
        F.push({ rows: rows(i, j, srcs),
          ask: 'How many paths reach cell (' + i + ', ' + j + ')?',
          check: srcs.length
            ? 'from above ' + dp[i - 1][j] + '   +   from left ' + dp[i][j - 1] + '   =   ' + dp[i][j]
            : 'on the top or left edge  →  only one straight line gets here',
          then: srcs.length
            ? 'Every route arriving here took its last step either downward or rightward, so the count is just those two neighbours added together: ' + dp[i][j] + '. Nothing is double-counted and nothing is missed.'
            : 'You can only travel in a straight line to reach this cell, so there is exactly 1 route.',
          badge: last ? ['done', 'answer ' + dp[i][j]] : (srcs.length ? ['gain', '= ' + dp[i][j]] : ['setup', 'edge = 1']),
          chips: { filled: filled, answer: last ? dp[i][j] : '?' } });
      }
    }
    return { frames: F, answer: dp[m - 1][n - 1] };
  }

  PROBLEMS.push({
    slug: 'unique-paths', title: 'Unique Paths', difficulty: 'Medium', pattern: '2-D Dynamic Programming',
    goal: 'Moving only right or down, how many distinct routes cross a grid from top-left to bottom-right?',
    example: '3 × 4 grid  →  10 routes',
    approaches: [
      { name: 'Bottom-up DP', time: 'O(m·n)', space: 'O(m·n)', optimal: true, shape: 'grid',
        idea: 'Fill a table where each cell counts the routes reaching it, built from its top and left neighbours.',
        invariant: 'Every filled cell holds the final route count for that cell; the fill order guarantees both neighbours are ready first.',
        intuition: 'The amber cell is being computed; the two violet cells above and to its left are the only inputs it needs. Because the grid is filled left-to-right, top-to-bottom, those two are always already done. No cell is ever revisited, and the bottom-right cell is the answer.',
        cpp: `int uniquePaths(int m, int n) {
    vector<vector<int>> dp(m, vector<int>(n, 1));   // edges are all 1
    for (int i = 1; i < m; ++i)
        for (int j = 1; j < n; ++j)
            dp[i][j] = dp[i-1][j] + dp[i][j-1];
    return dp[m-1][n-1];
}`,
        build: uniquePaths }
    ]
  });

  /* ------------------------------------------------------ Maximum Subarray */
  function kadane() {
    var a = [-2, 1, -3, 4, -1, 2, 1, -5, 4], F = [], cur = 0, best = -Infinity, start = 0, bs = 0, be = 0;
    F.push({ items: a.map(function (v) { return { v: v, state: 'idle' }; }),
      ask: 'What are we starting with?', check: 'nums = [' + a.join(', ') + ']',
      then: 'We want the contiguous stretch with the biggest sum. The trick is to sweep once, asking a single question at each number.',
      badge: ['setup', 'setup'], chips: { current: 0, best: '–' } });
    for (var i = 0; i < a.length; i++) {
      var restart = cur + a[i] < a[i];
      if (restart) { cur = a[i]; start = i; } else { cur = cur + a[i]; }
      var better = cur > best;
      if (better) { best = cur; bs = start; be = i; }
      (function (ii, st) {
        F.push({ items: a.map(function (v, k) {
            return { v: v, state: k === ii ? 'hot' : (k >= bs && k <= be ? 'done' : (k < ii ? 'gone' : 'idle')) };
          }), marks: { i: ii },
          ask: 'Extend the run so far, or start fresh from here?',
          check: restart
            ? 'run so far + ' + a[ii] + '  <  ' + a[ii] + '   →  start fresh at index ' + ii
            : 'run so far + ' + a[ii] + '  =  ' + cur + '   →  keep extending',
          then: (restart
              ? 'The previous run was dragging us down — anything negative behind us can only hurt, so we drop it and begin again here. '
              : 'The run is still worth carrying, so we add this number to it. ') +
            (better ? 'Current run ' + cur + ' beats the old best — new best is ' + best + '.' : 'Best stays at ' + best + '.'),
          badge: better ? ['gain', 'best ' + best] : ['setup', 'run ' + cur],
          chips: { current: cur, best: best } });
      })(i, start);
    }
    F[F.length - 1].badge = ['done', 'answer ' + best];
    F[F.length - 1].then = 'One pass, no extra memory. The best contiguous sum is ' + best + ' — the highlighted stretch from index ' + bs + ' to ' + be + '.';
    return { frames: F, answer: best };
  }

  PROBLEMS.push({
    slug: 'maximum-subarray', title: 'Maximum Subarray', difficulty: 'Medium', pattern: 'Dynamic Programming',
    goal: 'Find the contiguous stretch of numbers with the largest possible sum.',
    example: 'nums = [-2,1,-3,4,-1,2,1,-5,4]  →  6  (from [4,-1,2,1])',
    approaches: [
      { name: "Kadane's Algorithm", time: 'O(n)', space: 'O(1)', optimal: true, shape: 'array', render: 'cells',
        idea: 'At each number, either extend the current run or abandon it and start fresh.',
        invariant: 'The running total is the best sum of any stretch that ENDS at the current position.',
        intuition: 'Watch the two numbers, current and best. current is the best run ending right here; best is the best run seen anywhere. The whole algorithm is one question per element: is the run behind me worth keeping, or is this number better on its own? A negative run is always worth abandoning.',
        cpp: `int maxSubArray(vector<int>& nums) {
    int cur = nums[0], best = nums[0];
    for (int i = 1; i < nums.size(); ++i) {
        cur  = max(nums[i], cur + nums[i]); // extend, or start fresh
        best = max(best, cur);
    }
    return best;
}`,
        build: kadane }
    ]
  });

  global.PROBLEMS = PROBLEMS;
})(window);
