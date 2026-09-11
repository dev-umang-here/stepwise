#!/usr/bin/env node
/* Verify every hand-written trace returns its known-correct answer, and that
   each frame is structurally sound. Run after adding or editing a problem:

     npm run check
*/
'use strict';

global.window = global;
require('../js/problems.js');

// Known answers for the bundled library. Add a line when you add a problem.
const EXPECTED = {
  'two-sum': ['[2,3]', '[2,3]'],
  'binary-search': [5, 5],
  'trapping-rain-water': [6, 6],
  'container-with-most-water': [49],
  'longest-substring': [3],
  'climbing-stairs': [8, 8],
  'unique-paths': [10],
  'maximum-subarray': [6]
};

let ok = true;
let traces = 0;

for (const p of PROBLEMS) {
  p.approaches.forEach((ap, i) => {
    traces++;
    let t;
    try { t = ap.build(); }
    catch (e) {
      console.log(`FAIL  ${p.slug} / ${ap.name} threw: ${e.message}`);
      ok = false;
      return;
    }

    const want = (EXPECTED[p.slug] || [])[i];
    const label = `${p.slug} / ${ap.name}`.padEnd(46);
    if (want === undefined) {
      console.log(`WARN  ${label} answer=${t.answer}  (no expected value recorded)`);
    } else if (String(t.answer) !== String(want)) {
      console.log(`FAIL  ${label} answer=${t.answer}  expected=${want}`);
      ok = false;
    } else {
      console.log(`PASS  ${label} answer=${String(t.answer).padEnd(8)} steps=${t.frames.length}`);
    }

    t.frames.forEach((f, k) => {
      if (!f.ask || !f.check || !f.then) {
        console.log(`      ^ step ${k + 1} is missing its explanation`);
        ok = false;
      }
      if (!f.chips) {
        console.log(`      ^ step ${k + 1} has no chips`);
        ok = false;
      }
    });

    if (ap.shape === 'array') {
      const lens = new Set(t.frames.map(f => (f.items || []).length));
      if (lens.size !== 1) {
        console.log(`      ^ array length varies across frames: ${[...lens].join(', ')}`);
        ok = false;
      }
    } else if (ap.shape === 'grid') {
      const dims = new Set(t.frames.map(f => `${f.rows.length}x${f.rows[0].length}`));
      if (dims.size !== 1) {
        console.log('      ^ grid dimensions vary across frames');
        ok = false;
      }
    } else if (ap.shape === 'tree') {
      const seen = new Set();
      t.frames.forEach(f => (f.nodes || []).forEach(n => seen.add(n.id)));
      if (!seen.size) {
        console.log('      ^ tree produced no nodes');
        ok = false;
      }
    }
  });
}

console.log(`\n${traces} traces across ${PROBLEMS.length} problems`);
console.log(ok ? 'ALL CHECKS PASSED' : 'FAILURES PRESENT');
process.exit(ok ? 0 : 1);
