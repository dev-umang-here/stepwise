/* ==========================================================================
   Stepwise — app shell: hash routing, analyse box, problem list, viewer
   ========================================================================== */
(function () {
  'use strict';

  var view = document.getElementById('view');
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function svgEl(cls) {
    var s = document.createElementNS(NS, 'svg');
    if (cls) s.setAttribute('class', cls);
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /** Built-in problems first, then anything generated. */
  function allProblems() {
    var seen = {}, out = [];
    PROBLEMS.forEach(function (p) { seen[p.slug] = 1; out.push(p); });
    Store.all().forEach(function (p) { if (!seen[p.slug]) { seen[p.slug] = 1; out.push(p); } });
    return out;
  }
  function bySlug(slug) {
    var hit = allProblems().filter(function (p) { return p.slug === slug; })[0];
    return hit || null;
  }

  /* ---------------------------------------------------------------- theme */
  (function theme() {
    var saved = null;
    try { saved = localStorage.getItem('stepwise-theme'); } catch (e) {}
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('themeBtn').onclick = function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : (cur === 'light' ? 'dark' :
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark'));
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('stepwise-theme', next); } catch (e) {}
      if (location.hash.indexOf('#/p/') !== 0) route();
    };
  })();

  /* --------------------------------------------------------------- router */
  function route() {
    var hash = location.hash || '#/';
    window.scrollTo(0, 0);
    stopPlay();                                  // never leave a timer running on a dead view
    state = null;
    document.body.classList.remove('app-mode');  // only the walkthrough is full-bleed
    if (hash === '#/about') return renderAbout();
    // #/p/<slug>          → the problem, with its approaches to choose from
    // #/p/<slug>/<n>      → one approach's walkthrough, on its own page
    var m = hash.match(/^#\/p\/([\w-]+)(?:\/(\d+))?$/);
    if (m) {
      var p = bySlug(m[1]);
      if (p) {
        if (m[2] === undefined) return renderProblem(p);
        var i = parseInt(m[2], 10);
        if (p.approaches[i]) return renderWalkthrough(p, i);
        return renderProblem(p);
      }
    }
    renderHome();
  }
  window.addEventListener('hashchange', route);

  /* ----------------------------------------------------------- analyse box */
  var busy = false;

  function analyseBox() {
    var box = el('section', 'askbox');
    box.innerHTML =
      '<textarea id="inp" rows="3" placeholder="Paste a LeetCode link, a problem name, or the full problem text…&#10;e.g.  https://leetcode.com/problems/jump-game/"></textarea>' +
      '<div class="askfoot">' +
        '<div class="try"><span>Try:</span>' +
          '<button data-q="https://leetcode.com/problems/valid-parentheses/">Valid Parentheses</button>' +
          '<button data-q="https://leetcode.com/problems/jump-game/">Jump Game</button>' +
          '<button data-q="https://leetcode.com/problems/merge-intervals/">Merge Intervals</button>' +
        '</div>' +
        '<button class="go" id="go">Analyse →</button>' +
      '</div>';
    var status = el('div', 'status');
    status.id = 'status';
    status.style.display = 'none';

    var wrap = el('div');
    wrap.appendChild(box);
    wrap.appendChild(status);

    setTimeout(function () {
      var inp = document.getElementById('inp');
      var go = document.getElementById('go');
      if (!go) return;
      go.onclick = function () { doAnalyse(inp.value); };
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) doAnalyse(inp.value);
      });
      box.querySelectorAll('.try button').forEach(function (b) {
        b.onclick = function () { inp.value = b.dataset.q; doAnalyse(b.dataset.q); };
      });

      Generate.probe().then(function (ok) {
        if (!ok) {
          go.disabled = true;
          note('Problem generation is off in this build — the library below still works. ' +
               'See the README to switch it on.', 'warn');
        }
      });
    }, 0);

    return wrap;
  }

  function note(msg, kind) {
    var s = document.getElementById('status');
    if (!s) return;
    s.style.display = 'flex';
    s.className = 'status' + (kind ? ' ' + kind : '');
    s.innerHTML = (kind === 'warn' || kind === 'err') ? '' : '<span class="spin"></span>';
    s.append(msg);
  }
  function clearNote() {
    var s = document.getElementById('status');
    if (s) s.style.display = 'none';
  }

  function doAnalyse(text) {
    if (busy) return;
    text = (text || '').trim();
    if (!text) { note('Paste a problem first.', 'err'); return; }

    var go = document.getElementById('go');
    busy = true;
    if (go) go.disabled = true;
    note('Working out the approaches…');

    Generate.analyze(text).then(function (d) {
      Generate.markAvailable();
      var slug = Store.slugify(d.title);
      // Don't shadow a hand-written problem — open that instead.
      var builtIn = PROBLEMS.filter(function (p) { return p.slug === slug; })[0];
      if (builtIn) {
        clearNote();
        location.hash = '#/p/' + slug;
        return;
      }
      Store.save({
        slug: slug,
        title: d.title,
        difficulty: d.difficulty || 'Medium',
        pattern: d.pattern || 'General',
        goal: d.goal || '',
        example: d.example || '',
        createdAt: Date.now(),
        approaches: (d.approaches || []).map(function (a) {
          return {
            name: a.name, time: a.time, space: a.space, optimal: !!a.optimal,
            shape: a.shape || 'array', render: a.render || 'cells',
            idea: a.idea || '', invariant: a.invariant || '',
            intuition: a.intuition || '',
            code: null, cpp: '', expected: '', example: ''
          };
        })
      });
      clearNote();
      location.hash = '#/p/' + slug;
    }).catch(function (e) {
      note(Generate.explain(e), 'err');
    }).then(function () {
      busy = false;
      var g = document.getElementById('go');
      if (g) g.disabled = false;
    });
  }

  /* ----------------------------------------------------------------- home */
  var filterPattern = 'All', filterQuery = '';

  function renderHome() {
    document.title = 'Stepwise — see how algorithms actually work';
    view.innerHTML = '';
    var wrap = el('div', 'wrap-wide');

    var hero = el('section', 'hero');
    hero.appendChild(el('p', 'eyebrow', 'Free · no sign-up · works on your phone'));
    hero.appendChild(el('h1', null, 'See how the algorithm actually thinks'));
    hero.appendChild(el('p', null,
      'Every problem is broken into single decisions. At each step you see what the algorithm is asking, ' +
      'what it checks, and why that answer follows. Not in the library? Paste it below and it gets built.'));
    wrap.appendChild(hero);

    wrap.appendChild(analyseBox());

    var pats = ['All'];
    allProblems().forEach(function (p) { if (pats.indexOf(p.pattern) < 0) pats.push(p.pattern); });

    var bar = el('div', 'filters');
    var search = el('input', 'search');
    search.type = 'search';
    search.placeholder = 'Search the library…';
    search.value = filterQuery;
    search.oninput = function () { filterQuery = search.value.toLowerCase(); paintGrid(); };
    bar.appendChild(search);
    pats.forEach(function (pt) {
      var b = el('button', 'fchip' + (pt === filterPattern ? ' on' : ''), esc(pt));
      b.onclick = function () {
        filterPattern = pt;
        bar.querySelectorAll('.fchip').forEach(function (x) { x.classList.toggle('on', x === b); });
        paintGrid();
      };
      bar.appendChild(b);
    });
    wrap.appendChild(bar);

    var grid = el('div', 'grid');
    wrap.appendChild(grid);
    view.appendChild(wrap);

    function paintGrid() {
      grid.innerHTML = '';
      var shown = allProblems().filter(function (p) {
        var okPat = filterPattern === 'All' || p.pattern === filterPattern;
        var hay = (p.title + ' ' + p.pattern + ' ' + p.goal).toLowerCase();
        return okPat && (!filterQuery || hay.indexOf(filterQuery) >= 0);
      });
      if (!shown.length) {
        grid.appendChild(el('p', 'empty', 'Nothing matches that. Paste the problem above to build it.'));
        return;
      }
      shown.forEach(function (p) {
        var best = p.approaches.filter(function (a) { return a.optimal; })[0] || p.approaches[0];
        var card = el('a', 'card');
        card.href = '#/p/' + p.slug;

        var top = el('div', 'card-top');
        top.appendChild(el('h3', null, esc(p.title)));
        top.appendChild(el('span', 'diff ' + p.difficulty, esc(p.difficulty)));
        card.appendChild(top);

        var prev = el('div', 'card-prev');
        card.appendChild(prev);

        var meta = el('div', 'card-meta');
        meta.appendChild(el('span', 'pat', esc(p.pattern)));
        meta.appendChild(el('span', 'cnt',
          p.approaches.length + (p.approaches.length === 1 ? ' approach' : ' approaches')));
        card.appendChild(meta);
        if (p.generated) card.appendChild(el('span', 'gen-tag', p.source === 'shipped' ? 'generated' : 'yours'));

        grid.appendChild(card);

        if (best && typeof best.build === 'function') {
          try {
            var s = svgEl();
            prev.appendChild(s);
            Render.drawStatic(s, best.shape, best.render || 'cells', best.build().frames);
          } catch (e) { prev.textContent = ''; }
        } else {
          prev.appendChild(el('span', 'prev-none', best && best.code ? 'built · open to view' : 'not built yet'));
        }
      });
    }
    paintGrid();
  }

  /* -------------------------------------------------------------- problem */
  function renderProblem(p) {
    view.innerHTML = '';
    document.title = p.title + ' — Stepwise';
    var wrap = el('div', 'wrap');

    var back = el('a', 'back', '← All problems');
    back.href = '#/';
    wrap.appendChild(back);

    var head = el('div', 'phead');
    var h1 = el('h1');
    h1.appendChild(document.createTextNode(p.title));
    h1.appendChild(el('span', 'diff ' + p.difficulty, esc(p.difficulty)));
    if (p.generated) h1.appendChild(el('span', 'gen-tag inline', p.source === 'shipped' ? 'generated' : 'yours'));
    head.appendChild(h1);
    head.appendChild(el('p', 'pgoal', esc(p.goal)));
    if (p.example) head.appendChild(el('div', 'pex', esc(p.example)));
    wrap.appendChild(head);

    if (p.generated && Store.isLocal(p.slug)) {
      var del = el('button', 'linkbtn', 'Remove from my saved problems');
      del.onclick = function () {
        Store.remove(p.slug);
        location.hash = '#/';
      };
      head.appendChild(del);
    }

    wrap.appendChild(el('p', 'sect',
      p.approaches.length > 1 ? 'Approaches — worst to best · pick one to step through' : 'Approach'));
    var apps = el('div', 'apps');
    p.approaches.forEach(function (ap, i) {
      var a = el('a', 'app');
      a.href = '#/p/' + p.slug + '/' + i;
      a.innerHTML =
        '<div class="app-n">' + esc(ap.name) + (ap.optimal ? '<span class="opt">optimal</span>' : '') + '</div>' +
        '<div class="app-o"><span>' + esc(ap.time) + ' time</span><span>' + esc(ap.space) + ' space</span></div>' +
        '<p class="app-i">' + esc(ap.idea) + '</p>' +
        '<span class="app-go">Step through →</span>';
      apps.appendChild(a);
    });
    wrap.appendChild(apps);
    view.appendChild(wrap);
  }

  /* ------------------------------------------------- one approach, own page
     Full-bleed two-panel layout: the diagram fills the left, the controls and
     reasoning fill the right, each scrolling on its own. No page scroll. */
  function renderWalkthrough(p, idx) {
    var ap = p.approaches[idx];
    view.innerHTML = '';
    document.title = ap.name + ' · ' + p.title + ' — Stepwise';
    document.body.classList.add('app-mode');

    var page = el('div', 'wk-page');

    // Compact top strip — everything identifying, on one line.
    var strip = el('div', 'wk-strip');
    var left = el('div', 'strip-l');
    var back = el('a', 'strip-back');
    back.href = '#/p/' + p.slug;
    back.innerHTML = '←';
    back.title = 'Back to ' + p.title;
    left.appendChild(back);
    var nm = el('div', 'strip-name');
    nm.appendChild(document.createTextNode(ap.name));
    if (ap.optimal) nm.appendChild(el('span', 'opt', 'optimal'));
    left.appendChild(nm);
    left.appendChild(el('span', 'strip-prob', esc(p.title)));
    strip.appendChild(left);

    var right = el('div', 'strip-r');
    right.innerHTML =
      '<span class="strip-o">' + esc(ap.time) + '</span>' +
      '<span class="strip-o">' + esc(ap.space) + '</span>' +
      '<span class="verify-slot" id="verifySlot"></span>';
    if (p.approaches.length > 1) {
      p.approaches.forEach(function (a2, j) {
        if (j === idx) return;
        var lnk = el('a', 'strip-alt');
        lnk.href = '#/p/' + p.slug + '/' + j;
        lnk.textContent = a2.name;
        lnk.title = 'Switch to ' + a2.name + ' (' + a2.time + ')';
        right.appendChild(lnk);
      });
    }
    strip.appendChild(right);
    page.appendChild(strip);

    page.appendChild(el('div', 'viz-slot'));
    view.appendChild(page);
    openApproach(p, ap);
  }

  /* ----------------------------------------------------- approach → frames */
  function openApproach(problem, ap) {
    var slot = document.querySelector('.viz-slot');
    slot.innerHTML = '';

    // 1. Hand-written problem: synchronous build.
    if (typeof ap.build === 'function') {
      var t;
      try { t = ap.build(); }
      catch (e) { slot.appendChild(el('p', 'empty', 'This walkthrough could not be built: ' + esc(e.message))); return; }
      return mountViz(ap, t.frames, t.answer, true);
    }

    // 2. Already generated: re-run the stored code (free, no API call).
    if (ap.code) {
      mountPending(ap, 'Re-running the saved code…');
      return Generate.replay(ap).then(function (r) {
        mountViz(ap, r.frames, r.answer, r.verified);
        ensureCode(problem, ap);        // fills in if a past session never got it
      }).catch(function (err) {
        slot.innerHTML = '';
        slot.appendChild(el('p', 'empty',
          'The saved code no longer runs: ' + esc((err && err.message) || 'unknown error') + '.'));
      });
    }

    // 3. Not generated yet: ask Claude, run it, verify it, then keep it.
    mountPending(ap, 'Writing the code, then running it to check the answer…');

    Generate.buildOne(problem.title, ap).then(function (r) {
      ap.code = r.code; ap.expected = r.expected; ap.example = r.example;
      persistApproach(problem, ap);
      mountViz(ap, r.frames, r.answer, r.verified);
      ensureCode(problem, ap);          // C++ arrives behind the walkthrough
    }).catch(function (err) {
      slot.innerHTML = '';
      var p2 = el('div', 'buildfail');
      p2.innerHTML = '<p>' + esc(Generate.explain(err)) + '</p>';
      var retry = el('button', 'bn small', 'Try again');
      retry.onclick = function () { openApproach(problem, ap); };
      p2.appendChild(retry);
      slot.appendChild(p2);
    });
  }

  /**
   * Fetch the C++ for a generated approach in the background and slot it in.
   * The walkthrough is already on screen by the time this runs, and most people
   * reach the last step after it has landed — so the code is usually just there.
   */
  function ensureCode(problem, ap) {
    if (ap.cpp || !problem.generated || ap.codePending) return;
    ap.codePending = true;
    Generate.fetchCode(problem.title, ap).then(function (cpp) {
      ap.cpp = cpp;
      ap.codePending = false;
      persistApproach(problem, ap);
      // Only touch the DOM if this approach is still the one on screen.
      if (state && state.ap === ap) {
        var el2 = document.getElementById('cppCode');
        if (el2) el2.textContent = cpp;
        var panel = document.getElementById('stageCode');
        if (panel) panel.classList.remove('is-waiting');
        paint();
      }
    }).catch(function () {
      ap.codePending = false;
      if (state && state.ap === ap) {
        var w = document.getElementById('codeWait');
        if (w) w.textContent = 'The C++ could not be generated. Reopen this approach to retry.';
      }
    });
  }

  /** Write the generated code back into this visitor's saved copy. */
  function persistApproach(problem, ap) {
    if (!problem.generated) return;
    var rec = {
      slug: problem.slug, title: problem.title, difficulty: problem.difficulty,
      pattern: problem.pattern, goal: problem.goal, example: problem.example,
      createdAt: Date.now(),
      approaches: problem.approaches.map(function (a) {
        return {
          name: a.name, time: a.time, space: a.space, optimal: a.optimal,
          shape: a.shape, render: a.render, idea: a.idea, invariant: a.invariant,
          intuition: a.intuition || '', cpp: a.cpp || '',
          code: a.code || null, expected: a.expected || '', example: a.example || ''
        };
      })
    };
    Store.save(rec);
  }

  /* --------------------------------------------------------------- pending
     Everything the analyse phase already told us is real from the first
     paint — idea, intuition, invariant, complexity. Only the parts that
     depend on the trace get a shimmer. */
  function mountPending(ap, note) {
    var slot = document.querySelector('.viz-slot');
    slot.innerHTML = '';

    // Preview the shape that is actually coming, so the wait does not look
    // like the wrong diagram is loading.
    var shape = ap.shape || 'array';
    var ghost = '', i;
    if (shape === 'grid') {
      ghost = '<div class="sk-grid">';
      for (i = 0; i < 20; i++) ghost += '<span class="sk sk-cell"></span>';
      ghost += '</div>';
    } else if (shape === 'tree') {
      ghost = '<div class="sk-tree">' +
        '<div class="sk-row"><span class="sk sk-node"></span></div>' +
        '<div class="sk-row"><span class="sk sk-node"></span><span class="sk sk-node"></span></div>' +
        '<div class="sk-row"><span class="sk sk-node"></span><span class="sk sk-node"></span>' +
          '<span class="sk sk-node"></span><span class="sk sk-node"></span></div>' +
        '</div>';
    } else if (ap.render === 'cells') {
      ghost = '<div class="sk-cells">';
      for (i = 0; i < 8; i++) ghost += '<span class="sk sk-box"></span>';
      ghost += '</div>';
    } else {
      ghost = '<div class="sk-diagram">';
      [42, 70, 55, 86, 34, 64, 78, 48].forEach(function (h) {
        ghost += '<span class="sk sk-bar" style="height:' + h + '%"></span>';
      });
      ghost += '</div>';
    }

    var box = el('div', 'viz');
    box.innerHTML =
      '<div class="wk-grid">' +
        '<div class="wk-stage">' +
          '<div class="stage-pending">' + ghost +
            '<p class="sk-note"><span class="spin"></span>' + esc(note) + '</p>' +
          '</div>' +
        '</div>' +
        '<aside class="wk-side">' +
          '<div class="side-scroll">' +
            (ap.intuition
              ? '<details class="howto" open><summary>How to read this</summary>' +
                  '<p>' + esc(ap.intuition) + '</p></details>'
              : '') +
            '<div class="side-head"><span class="stepno">Preparing the walkthrough</span></div>' +
            '<p class="step-ask sk sk-line" style="width:88%">&nbsp;</p>' +
            '<div class="sk sk-block"></div>' +
            '<p class="sk sk-line" style="width:100%">&nbsp;</p>' +
            '<p class="sk sk-line" style="width:76%">&nbsp;</p>' +
            '<div class="chips">' +
              '<span class="sk sk-chip"></span><span class="sk sk-chip"></span><span class="sk sk-chip"></span>' +
            '</div>' +
            (ap.invariant
              ? '<details class="inv" open><summary>Why this always works</summary>' +
                  '<p>' + esc(ap.invariant) + '</p></details>'
              : '') +
          '</div>' +
          '<div class="side-foot">' +
            '<div class="transport">' +
              '<button class="tb" disabled>←</button>' +
              '<button class="tb tb-play" disabled>▶<span>Play</span></button>' +
              '<button class="tb tb-next" disabled>Next<span class="tb-ar">→</span></button>' +
            '</div>' +
            '<div class="foot-meta"><span class="foot-hint">' + esc(ap.time) + ' time · ' + esc(ap.space) + ' space</span></div>' +
          '</div>' +
        '</aside>' +
      '</div>';
    slot.appendChild(box);
  }

  /* ------------------------------------------------------------ visualiser */
  var state = null;

  function mountViz(ap, frames, answer, verified) {
    var slot = document.querySelector('.viz-slot');
    slot.innerHTML = '';

    stopPlay();
    state = { ap: ap, frames: frames, step: 0, refs: null, timer: null,
              ctx: { frames: frames, render: ap.render || 'cells' } };

    var shown = (answer === null || answer === undefined) ? '—' : String(answer);
    state.answer = shown;

    // The verify chip belongs with the page header's complexity row, not in a
    // second header that repeats the title directly above it.
    var vs = document.getElementById('verifySlot');
    if (vs) {
      vs.className = 'verify ' + (verified ? 'ok' : 'no');
      vs.textContent = verified
        ? '✓ ran · answer ' + shown
        : '⚠ ran · answer ' + shown + ', expected ' + (ap.expected || '?');
    }

    var box = el('div', 'viz');
    box.innerHTML =
      '<div class="wk-grid">' +
        '<div class="wk-stage">' +
          '<div class="stage-viz" id="stageViz">' +
            '<div class="canvas-box"><svg class="cv" id="cv"></svg></div>' +
            '<div class="legend">' +
              '<span class="lg"><i class="f"></i> being decided now</span>' +
              '<span class="lg"><i class="e"></i> what we\'re reading</span>' +
              '<span class="lg"><i class="s"></i> already settled</span>' +
              '<span class="lg"><i class="m"></i> not touched yet</span>' +
            '</div>' +
          '</div>' +
          // Once the walkthrough is done the diagram has nothing left to show,
          // so the panel hands its space over to the code.
          '<div class="stage-code" id="stageCode" hidden>' +
            '<div class="code-head">' +
              '<span>C++ · ' + esc(ap.name) + '</span>' +
              '<button class="code-copy" id="copyBtn">Copy</button>' +
            '</div>' +
            '<pre class="code"><code id="cppCode"></code></pre>' +
            '<p class="code-wait" id="codeWait"><span class="spin"></span>Writing the C++…</p>' +
            '<p class="code-foot">Now that you have seen it run, this should read as something you could have written. ' +
              '<button class="linkish" id="rewatchBtn">↻ Watch it again</button></p>' +
          '</div>' +
        '</div>' +

        '<aside class="wk-side">' +
          '<div class="side-scroll">' +
            (ap.intuition
              ? '<details class="howto" id="howto" open><summary>How to read this</summary>' +
                  '<p>' + esc(ap.intuition) + '</p></details>'
              : '') +
            '<div class="side-head">' +
              '<span class="stepno" id="sno"></span>' +
              '<span class="badge none" id="bdg"></span>' +
            '</div>' +
            '<p class="step-ask" id="rA"></p>' +
            '<div class="step-check" id="rC"></div>' +
            '<p class="step-then" id="rT"></p>' +
            '<div class="chips" id="chips"></div>' +

            '<div class="result" id="result" hidden>' +
              '<div class="result-k">Final answer</div>' +
              '<div class="result-v" id="resultV"></div>' +
              '<p class="result-sub" id="resultSub"></p>' +
            '</div>' +

            '<details class="inv"><summary>Why this always works</summary>' +
              '<p>' + esc(ap.invariant) + '</p></details>' +
          '</div>' +

          '<div class="side-foot">' +
            '<div class="dots" id="dots"></div>' +
            '<div class="transport">' +
              '<button class="tb" id="bP" title="Previous step (←)" aria-label="Previous step">←</button>' +
              '<button class="tb tb-play" id="bPlay" title="Play through (space)">▶<span>Play</span></button>' +
              '<button class="tb tb-next" id="bN" title="Next step (→)">Next<span class="tb-ar">→</span></button>' +
            '</div>' +
            '<div class="foot-meta">' +
              '<button class="tb ghost" id="againBtn" title="Back to step 1">↻ Start over</button>' +
              '<span class="foot-hint"><kbd>←</kbd><kbd>→</kbd> step · <kbd>space</kbd> play</span>' +
            '</div>' +
          '</div>' +
        '</aside>' +
      '</div>';
    slot.appendChild(box);

    var shape = ap.shape || 'array';
    try {
      var cv = document.getElementById('cv');
      state.refs = Render.shapes[shape].mount(cv, state.ctx);
      // Renderers size the SVG in their own units. Drop the fixed width/height
      // so the viewBox can scale the diagram to fill the panel, but cap the
      // upscale so a four-cell array doesn't become billboard-sized.
      var vb = (cv.getAttribute('viewBox') || '').split(/[\s,]+/);
      if (vb.length === 4) {
        var nw = parseFloat(vb[2]), nh = parseFloat(vb[3]);
        if (nw > 0 && nh > 0) {
          cv.removeAttribute('width');
          cv.removeAttribute('height');
          // Modest upscale only. Filling the panel edge-to-edge makes bars
          // tower over the reader and pushes the controls off-screen.
          cv.style.maxWidth = Math.round(nw * 1.45) + 'px';
          cv.style.maxHeight = Math.round(nh * 1.45) + 'px';
        }
      }
    } catch (e) {
      slot.innerHTML = '';
      slot.appendChild(el('p', 'empty', 'This walkthrough could not be drawn: ' + esc(e.message)));
      return;
    }

    var dots = document.getElementById('dots');
    frames.forEach(function (_, i) {
      var d = el('button', 'dot');
      d.setAttribute('aria-label', 'Go to step ' + (i + 1));
      d.onclick = function () { state.step = i; paint(); };
      dots.appendChild(d);
    });
    document.getElementById('bN').onclick = function () { stopPlay(); nextStep(); };
    document.getElementById('bP').onclick = function () {
      stopPlay();
      if (state.step > 0) { state.step--; paint(); }
    };
    document.getElementById('againBtn').onclick = function () { stopPlay(); state.step = 0; paint(); };
    document.getElementById('bPlay').onclick = togglePlay;

    var code = document.getElementById('cppCode');
    if (code && ap.cpp) code.textContent = ap.cpp;   // textContent: never parse generated code as HTML
    var rewatch = document.getElementById('rewatchBtn');
    if (rewatch) rewatch.onclick = function () { stopPlay(); state.step = 0; paint(); };
    var copy = document.getElementById('copyBtn');
    if (copy) {
      copy.onclick = function () {
        var done = function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy'; }, 1400); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ap.cpp).then(done, function () { copy.textContent = 'Press ⌘C'; });
        } else {
          var r = document.createRange();
          r.selectNodeContents(code);
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(r);
          copy.textContent = 'Press ⌘C';
        }
      };
    }
    paint();
  }

  /* -------------------------------------------------------------- playback
     Manual stepping stays the default — play is opt-in, and deliberately slow
     enough to read the reasoning rather than just watch shapes move. */
  function nextStep() {
    if (!state) return false;
    if (state.step >= state.frames.length - 1) return false;
    state.step++;
    paint();
    return true;
  }

  function stopPlay() {
    if (!state || !state.timer) return;
    clearInterval(state.timer);
    state.timer = null;
    syncPlayBtn();
  }

  function togglePlay() {
    if (!state) return;
    if (state.timer) return stopPlay();
    if (state.step >= state.frames.length - 1) { state.step = 0; paint(); }
    state.timer = setInterval(function () { if (!nextStep()) stopPlay(); }, 2000);
    syncPlayBtn();
  }

  function syncPlayBtn() {
    var b = document.getElementById('bPlay');
    if (!b) return;
    var playing = !!(state && state.timer);
    b.innerHTML = (playing ? '❚❚' : '▶') + '<span>' + (playing ? 'Pause' : 'Play') + '</span>';
    b.classList.toggle('playing', playing);
  }

  function paint() {
    if (!state) return;
    var f = state.frames[state.step];
    var shape = state.ap.shape || 'array';
    try { Render.shapes[shape].update(state.refs, state.ctx, f); } catch (e) {}

    document.getElementById('sno').textContent = 'Step ' + (state.step + 1) + ' of ' + state.frames.length;
    var b = document.getElementById('bdg');
    if (f.badge && f.badge.length) { b.className = 'badge ' + f.badge[0]; b.textContent = f.badge[1]; }
    else b.className = 'badge none';

    document.getElementById('rA').textContent = f.ask || '';
    document.getElementById('rC').textContent = f.check || '';
    document.getElementById('rT').textContent = f.then || '';

    var chips = document.getElementById('chips');
    chips.innerHTML = '';
    Object.keys(f.chips || {}).forEach(function (k) {
      chips.appendChild(el('div', 'sc',
        '<span class="k">' + esc(k) + '</span><span class="v">' + esc(f.chips[k]) + '</span>'));
    });

    Array.prototype.forEach.call(document.getElementById('dots').children, function (d, i) {
      d.className = 'dot' + (i < state.step ? ' past' : '') + (i === state.step ? ' now' : '');
    });

    var last = state.step >= state.frames.length - 1;
    document.getElementById('bP').disabled = state.step === 0;
    var bn = document.getElementById('bN');
    bn.disabled = last;
    bn.innerHTML = last ? 'Finished ✓' : 'Next<span class="tb-ar">→</span>';
    if (last) stopPlay();
    syncPlayBtn();

    // On the final step, state the answer plainly instead of leaving the
    // reader to infer it from the last narration line.
    var result = document.getElementById('result');
    if (result) {
      result.hidden = !last;
      if (last) {
        document.getElementById('resultV').textContent = state.answer;
        document.getElementById('resultSub').textContent =
          'reached in ' + state.frames.length + ' steps · ' +
          state.ap.time + ' time, ' + state.ap.space + ' space';
        // Collapse the reading guide once the tour is done — the code is the
        // thing worth looking at now.
        var ht = document.getElementById('howto');
        if (ht) ht.open = false;
      }
    }

    // Swap the big panel between diagram and code.
    var viz = document.getElementById('stageViz');
    var codePanel = document.getElementById('stageCode');
    if (viz && codePanel) {
      var hasCode = !!state.ap.cpp;
      var showCode = last && (hasCode || state.ap.codePending);
      viz.hidden = showCode;
      codePanel.hidden = !showCode;
      codePanel.classList.toggle('is-waiting', showCode && !hasCode);
    }
  }

  document.addEventListener('keydown', function (e) {
    if (!state || !document.querySelector('.wk-grid')) return;
    var tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stopPlay(); nextStep(); }
    else if (e.key === 'ArrowLeft') {
      e.preventDefault(); stopPlay();
      if (state.step > 0) { state.step--; paint(); }
    } else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  });

  /* ---------------------------------------------------------------- about */
  function renderAbout() {
    document.title = 'About — Stepwise';
    view.innerHTML = '';
    var wrap = el('div', 'wrap');
    wrap.appendChild(el('article', 'prose',
      '<h1>About Stepwise</h1>' +
      '<p>Most people preparing for interviews re-learn the same algorithms every couple of years, because what they memorised last time has faded. Stepwise exists to make that re-learning fast — and to make the first learning actually stick.</p>' +

      '<h2>Every step has the same three lines</h2>' +
      '<p>Whatever the problem, each step shows <strong>what the algorithm is asking</strong>, <strong>what it checks</strong> (with real numbers), and <strong>what follows and why</strong>. Because that structure never changes, you are not memorising a dozen unrelated tricks — you are learning the shape of algorithmic reasoning itself. That is what lets you write the code yourself afterwards.</p>' +

      '<h2>The invariant is the point</h2>' +
      '<p>Under every walkthrough is a line marked <strong>Always true</strong>. That is the invariant — the fact that holds at every single step. Invariants are what let you re-derive a solution months later instead of trying to remember it. Almost no prep resource states them plainly, and they are the single most useful thing on the page.</p>' +

      '<h2>Colour means something</h2>' +
      '<p>The same four colours are used on every problem: <strong>amber</strong> is the one thing being decided right now, <strong>violet</strong> is what is being read to decide it, <strong>teal</strong> is settled and will not change, and grey is untouched. Learn it once and every new visualisation is instantly readable.</p>' +

      '<h2>Nothing here is faked</h2>' +
      '<p>Each walkthrough is produced by <strong>actually running the algorithm</strong> and recording its state at every meaningful step. That is true of the hand-written problems and of anything you paste in: the generated solution is executed in a sandbox and its answer is checked before you are shown a single frame. If the answer does not match, you are told — you are never shown a confident-looking walkthrough of something wrong.</p>' +

      '<h2>Pasting your own problems</h2>' +
      '<p>Give it a LeetCode link, a problem name, or the full text. It works out every viable approach with its complexity, then builds the walkthrough for whichever you pick. Problems you generate are saved in your own browser, so they are waiting for you next time.</p>'));
    view.appendChild(wrap);
  }

  /* ----------------------------------------------------------------- boot */
  Store.loadShipped().then(route);
})();
