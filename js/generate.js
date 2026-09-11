/* ==========================================================================
   Stepwise — generation client
   --------------------------------------------------------------------------
   Talks to /api/analyze. The Anthropic key lives on the server, so visitors
   need no account and no key of their own.

   Pipeline for a pasted problem:
     analyze()  → title, difficulty, pattern, goal, example, approaches
     buildOne() → generated trace code → Sandbox.run() → verify answer

   Verification is the whole trust model: the generated code must RUN and must
   return the answer it predicted. Anything else is reported, never rendered.
   ========================================================================== */
(function (global) {
  'use strict';

  var ENDPOINT = (global.STEPWISE_CONFIG && global.STEPWISE_CONFIG.apiBase) || '/api/analyze';

  var available = null;   // null = not probed yet, true/false after

  function post(payload) {
    return fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) {
          var e = new Error(body.error || ('Request failed (' + res.status + ')'));
          e.code = body.code || 'http_' + res.status;
          throw e;
        }
        return body;
      });
    });
  }

  var Generate = {
    /** Is a generation backend reachable? Cached after the first probe. */
    probe: function () {
      if (available !== null) return Promise.resolve(available);
      return fetch(ENDPOINT.replace(/\/analyze$/, '/health'), { method: 'GET' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { available = !!(j && j.ok && j.hasKey); return available; })
        .catch(function () {
          // No /api/health (e.g. plain static host, or Vercel where only
          // /api/analyze exists). Assume unavailable until a real call proves
          // otherwise — the UI re-enables itself if a call succeeds.
          available = false;
          return false;
        });
    },

    markAvailable: function () { available = true; },

    analyze: function (text) {
      return post({ action: 'analyze', text: text });
    },

    /**
     * Generate + run + verify one approach.
     * Resolves { code, expected, example, frames, answer, verified }.
     */
    buildOne: function (title, approach) {
      return post({ action: 'build', title: title, approach: approach })
        .then(function (out) {
          if (!out || typeof out.code !== 'string' || !out.code.trim()) {
            var e = new Error('No code came back for this approach.');
            e.code = 'bad_json';
            throw e;
          }
          return Sandbox.run(out.code, { timeoutMs: 5000, maxFrames: 300 })
            .then(function (res) {
              var bad = Sandbox.validate(res.frames, approach.shape || 'array');
              if (bad) {
                var e2 = new Error('The generated walkthrough was malformed: ' + bad + '.');
                e2.code = 'malformed';
                throw e2;
              }
              var got = res.answer === null ? '' : String(res.answer);
              var want = String(out.expected == null ? '' : out.expected);
              var verified = got.replace(/\s/g, '') === want.replace(/\s/g, '');
              return {
                code: out.code,
                cpp: out.cpp || '',
                expected: want,
                example: out.example || '',
                frames: res.frames,
                answer: res.answer,
                verified: verified
              };
            })
            .catch(function (err) {
              if (err && err.code === 'malformed') throw err;
              var e3 = new Error(
                err && err.code === 'timeout'
                  ? 'The generated code never finished running.'
                  : 'The generated code failed to run: ' + ((err && err.message) || 'unknown error') + '.'
              );
              e3.code = 'run_failed';
              throw e3;
            });
        });
    },

    /** Re-run already-saved code (no API call, no cost). */
    replay: function (approach) {
      return Sandbox.run(approach.code, { timeoutMs: 5000, maxFrames: 300 })
        .then(function (res) {
          var got = res.answer === null ? '' : String(res.answer);
          return {
            frames: res.frames,
            answer: res.answer,
            verified: got.replace(/\s/g, '') === String(approach.expected || '').replace(/\s/g, '')
          };
        });
    },

    /** Viewer-facing copy for an error code. */
    explain: function (e) {
      var c = e && e.code;
      if (c === 'no_key') return 'Problem generation is not configured on this deployment yet.';
      if (c === 'api') return e.message;
      if (c === 'unrecognised') return (e.message || 'That problem could not be identified.') + ' Try pasting the full problem text.';
      if (c === 'refused') return 'Claude declined that input. Try rephrasing the problem.';
      if (c === 'bad_json') return 'The reply came back malformed. Try again.';
      if (c === 'malformed' || c === 'run_failed') return e.message + ' Try this approach again.';
      if (c === 'bad_request') return e.message || 'Something was missing from the request.';
      if (c === 'http_429') return 'Too many requests just now — wait a moment and try again.';
      if (c === 'http_404' || c === 'http_405') return 'No generation backend is running. See the README for how to start one.';
      return (e && e.message) || 'Something went wrong. Try again.';
    }
  };

  global.Generate = Generate;
})(window);
