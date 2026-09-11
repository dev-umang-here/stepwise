/* ==========================================================================
   Stepwise — generated-problem store
   --------------------------------------------------------------------------
   Three layers, checked in this order when the page boots:

     1. js/problems.js      hand-written, permanent, always available
     2. data/generated.json committed library — generated once, shipped to
                            everyone (written by `node server.js` → /api/save)
     3. localStorage        this visitor's own generations, private to them

   A stored problem keeps the generated CODE, not the frames. The code is
   re-executed in the sandbox every time it is opened, so a saved walkthrough
   can never drift out of step with the algorithm it claims to show.
   ========================================================================== */
(function (global) {
  'use strict';

  var LS_KEY = 'stepwise-generated-v1';

  function slugify(title) {
    return String(title).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'problem';
  }

  function readLocal() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  function writeLocal(list) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; }
    catch (e) { return false; }
  }

  /** Turn a stored record into the same shape js/problems.js uses. */
  function hydrate(rec) {
    return {
      slug: rec.slug,
      title: rec.title,
      difficulty: rec.difficulty,
      pattern: rec.pattern,
      goal: rec.goal,
      example: rec.example,
      generated: true,
      source: rec.source || 'local',
      approaches: rec.approaches.map(function (ap) {
        return {
          name: ap.name, time: ap.time, space: ap.space, optimal: ap.optimal,
          shape: ap.shape, render: ap.render, idea: ap.idea, invariant: ap.invariant,
          intuition: ap.intuition || '',
          code: ap.code || null,          // present once generated
          cpp: ap.cpp || '',
          expected: ap.expected,
          example: ap.example
        };
      })
    };
  }

  var Store = {
    slugify: slugify,

    /** Everything this visitor can see, newest generation first. */
    all: function () {
      var shipped = (global.GENERATED_LIBRARY || []).map(function (r) {
        r.source = 'shipped'; return hydrate(r);
      });
      var mine = readLocal().map(hydrate);
      var seen = {};
      var out = [];
      mine.concat(shipped).forEach(function (p) {
        if (seen[p.slug]) return;
        seen[p.slug] = 1;
        out.push(p);
      });
      return out;
    },

    get: function (slug) {
      var hit = Store.all().filter(function (p) { return p.slug === slug; })[0];
      return hit || null;
    },

    /** Insert or replace a generated problem in this visitor's storage. */
    save: function (rec) {
      var list = readLocal();
      var i = -1;
      for (var k = 0; k < list.length; k++) if (list[k].slug === rec.slug) { i = k; break; }
      if (i >= 0) list[i] = rec; else list.unshift(rec);
      while (list.length > 60) list.pop();       // keep localStorage bounded
      return writeLocal(list);
    },

    remove: function (slug) {
      writeLocal(readLocal().filter(function (r) { return r.slug !== slug; }));
    },

    isLocal: function (slug) {
      return readLocal().some(function (r) { return r.slug === slug; });
    },

    count: function () { return readLocal().length; },

    /** Load data/generated.json if the deployment ships one. */
    loadShipped: function () {
      return fetch('data/generated.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : []; })
        .then(function (arr) { global.GENERATED_LIBRARY = Array.isArray(arr) ? arr : []; })
        .catch(function () { global.GENERATED_LIBRARY = []; });
    }
  };

  global.Store = Store;
})(window);
