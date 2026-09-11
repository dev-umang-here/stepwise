/* ==========================================================================
   Stepwise — sandbox
   --------------------------------------------------------------------------
   Runs generated trace code and returns its frames.

   Generated code is never trusted. It runs inside a Web Worker so that an
   infinite loop can actually be killed (terminate()), which a plain
   new Function() on the main thread cannot survive. The worker has no DOM,
   no page variables, and nothing but the `snap` function we hand it.

   Falls back to a guarded main-thread run only where Workers are unavailable
   (e.g. opening index.html over file://); there the step budget is the only
   protection, so prefer serving over http.
   ========================================================================== */
(function (global) {
  'use strict';

  var WORKER_SRC = [
    'self.onmessage = function (e) {',
    '  var code = e.data.code, maxFrames = e.data.maxFrames;',
    '  var frames = [];',
    '  function snap(f) {',
    '    if (frames.length >= maxFrames) throw new Error("too many steps — the loop may never end");',
    '    if (!f || typeof f !== "object") throw new Error("snap() needs a frame object");',
    '    frames.push(f);',
    '  }',
    '  try {',
    '    var fn = new Function("snap", "\\"use strict\\";" + code);',
    '    var answer = fn(snap);',
    '    if (!frames.length) throw new Error("no steps were recorded");',
    '    self.postMessage({ ok: true, frames: frames, answer: answer === undefined ? null : answer });',
    '  } catch (err) {',
    '    self.postMessage({ ok: false, error: String((err && err.message) || err) });',
    '  }',
    '};'
  ].join('\n');

  var workerUrl = null;
  function getWorkerUrl() {
    if (workerUrl) return workerUrl;
    var blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
    workerUrl = URL.createObjectURL(blob);
    return workerUrl;
  }

  function runInWorker(code, timeoutMs, maxFrames) {
    return new Promise(function (resolve, reject) {
      var worker;
      try { worker = new Worker(getWorkerUrl()); }
      catch (e) { return reject({ code: 'no_worker' }); }

      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        worker.terminate();
        reject({ code: 'timeout', message: 'the code ran for more than ' + (timeoutMs / 1000) + 's without finishing' });
      }, timeoutMs);

      worker.onmessage = function (ev) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        var d = ev.data;
        if (d && d.ok) resolve({ frames: d.frames, answer: d.answer });
        else reject({ code: 'threw', message: (d && d.error) || 'the code threw an error' });
      };

      worker.onerror = function (err) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        worker.terminate();
        reject({ code: 'threw', message: (err && err.message) || 'the code could not be compiled' });
      };

      worker.postMessage({ code: code, maxFrames: maxFrames });
    });
  }

  function runOnMainThread(code, maxFrames) {
    var frames = [];
    var started = Date.now();
    function snap(f) {
      if (frames.length >= maxFrames) throw new Error('too many steps — the loop may never end');
      if (Date.now() - started > 3000) throw new Error('took too long — the loop may never end');
      if (!f || typeof f !== 'object') throw new Error('snap() needs a frame object');
      frames.push(f);
    }
    var fn = new Function('snap', '"use strict";' + code);
    var answer = fn(snap);
    if (!frames.length) throw new Error('no steps were recorded');
    return { frames: frames, answer: answer === undefined ? null : answer };
  }

  /**
   * run(code, opts) → Promise<{frames, answer}>
   * Rejects with {code: "timeout"|"threw"|"no_worker", message}.
   */
  function run(code, opts) {
    opts = opts || {};
    var timeoutMs = opts.timeoutMs || 5000;
    var maxFrames = opts.maxFrames || 300;

    if (typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      return runInWorker(code, timeoutMs, maxFrames).catch(function (e) {
        if (e && e.code === 'no_worker') {
          try { return runOnMainThread(code, maxFrames); }
          catch (err) { return Promise.reject({ code: 'threw', message: err.message }); }
        }
        return Promise.reject(e);
      });
    }
    try { return Promise.resolve(runOnMainThread(code, maxFrames)); }
    catch (err) { return Promise.reject({ code: 'threw', message: err.message }); }
  }

  /** Structural check — catches a trace that runs but would render as nonsense. */
  function validate(frames, shape) {
    if (!frames.length) return 'no steps were recorded';
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (!f.ask || !f.check || !f.then) return 'step ' + (i + 1) + ' is missing its explanation';
    }
    if (shape === 'array') {
      var n = (frames[0].items || []).length;
      if (!n) return 'no array data in the first step';
      for (var j = 0; j < frames.length; j++) {
        if (!frames[j].items || frames[j].items.length !== n) return 'the array changes length at step ' + (j + 1);
      }
    } else if (shape === 'grid') {
      if (!frames[0].rows || !frames[0].rows.length) return 'no grid data in the first step';
      var r = frames[0].rows.length, c = frames[0].rows[0].length;
      for (var k = 0; k < frames.length; k++) {
        var rows = frames[k].rows;
        if (!rows || rows.length !== r || !rows[0] || rows[0].length !== c) {
          return 'the grid changes size at step ' + (k + 1);
        }
      }
    } else if (shape === 'tree') {
      var any = frames.some(function (f2) { return f2.nodes && f2.nodes.length; });
      if (!any) return 'no tree nodes were produced';
    }
    return null;
  }

  global.Sandbox = { run: run, validate: validate };
})(window);
