/* ==========================================================================
   Stepwise — renderers
   --------------------------------------------------------------------------
   One shared frame vocabulary drives every visual shape, so adding a new
   problem never means writing new drawing code — only a new trace builder.

   A frame is:
     {
       ask, check, then,            // the teaching triple, shown under the canvas
       badge: [kind, label],        // "setup" | "gain" | "done"
       chips: { name: value },      // running variables
       ...one of:
       items: [{v, state, fillTo?}] // shape "array"  (render "cells" | "bars")
       rows:  [[{v, state}]]        // shape "grid"
       nodes: [{id,parent,label,value,state}]  // shape "tree"
     }

   state is the universal colour grammar:
     hot  = the one thing being decided this step   (amber)
     src  = what is being read to decide it         (violet)
     done = settled, will not change again          (teal)
     gone = eliminated / proven impossible          (faded)
     idle = not touched yet                         (neutral)
   ========================================================================== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  function E(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in (attrs || {})) el.setAttribute(k, attrs[k]);
    return el;
  }

  var R = {};

  /* ---------------------------------------------------------------- array */
  R.array = {
    mount: function (svg, ctx) {
      var frames = ctx.frames, small = !!ctx.compact;
      var n = frames[0].items.length;
      var bars = ctx.render === 'bars';

      var maxV = 1;
      if (bars) {
        frames.forEach(function (f) {
          f.items.forEach(function (it) {
            maxV = Math.max(maxV, Number(it.v) || 0, Number(it.fillTo) || 0);
          });
        });
      }

      var cw = small ? Math.max(6, Math.min(14, 150 / n))
                     : (bars ? Math.max(22, Math.min(40, 430 / n))
                             : Math.max(26, Math.min(52, 560 / n)));
      var gap  = small ? 2 : 7;
      var pad  = small ? 4 : 26;
      var top  = small ? 4 : 44;
      var body = small ? 46 : (bars ? 180 : 52);
      var bot  = small ? 4 : (bars ? 34 : 42);

      var W = pad * 2 + n * cw + (n - 1) * gap;
      var H = top + body + bot;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.innerHTML = '';

      var X = function (i) { return pad + i * (cw + gap); };
      var baseY = top + body;
      var o = { X: X, cw: cw, top: top, body: body, baseY: baseY,
                unit: body / maxV, bars: bars, small: small, n: n,
                boxes: [], txts: [], vals: [], fills: [], rings: [], ptrs: {} };

      if (bars) svg.appendChild(E('line', { 'class': 'base-line', x1: pad - 4, x2: W - pad + 4, y1: baseY, y2: baseY }));

      for (var i = 0; i < n; i++) {
        if (bars) {
          var b = E('rect', { 'class': 'bar-base', x: X(i), y: baseY, width: cw, height: 0, rx: small ? 1.5 : 3 });
          svg.appendChild(b); o.boxes.push(b);
          var fl = E('rect', { 'class': 'bar-fill', x: X(i), y: baseY, width: cw, height: 0, rx: small ? 1 : 2, opacity: 0 });
          svg.appendChild(fl); o.fills.push(fl);
          if (!small) {
            var vt = E('text', { 'class': 'ix', x: X(i) + cw / 2, y: baseY + 16 });
            svg.appendChild(vt); o.vals.push(vt);
          } else o.vals.push(null);
        } else {
          var bx = E('rect', { 'class': 'bx', x: X(i), y: top, width: cw, height: body, rx: small ? 3 : 8 });
          svg.appendChild(bx); o.boxes.push(bx);
          var t = E('text', { 'class': 'tx', x: X(i) + cw / 2, y: top + body / 2 + (small ? 4 : 6),
                              style: 'font-size:' + (small ? Math.min(9, cw * 0.6) : Math.min(16, cw * 0.36)) + 'px' });
          svg.appendChild(t); o.txts.push(t);
          if (!small) {
            var ix = E('text', { 'class': 'ix', x: X(i) + cw / 2, y: baseY + 17 });
            ix.textContent = i; svg.appendChild(ix);
          }
        }
      }

      if (bars) {
        for (var j = 0; j < n; j++) {
          var rg = E('rect', { 'class': 'ring', x: X(j) - 3, y: top - 4, width: cw + 6, height: body + 8, rx: 8, opacity: 0 });
          svg.appendChild(rg); o.rings.push(rg);
        }
      }

      if (!small) {
        var names = {};
        frames.forEach(function (f) { for (var k in (f.marks || {})) names[k] = 1; });
        Object.keys(names).forEach(function (k) {
          var g = E('g', { 'class': 'ptr' });
          g.appendChild(E('path', { d: 'M -6,-3.5 L 6,-3.5 L 0,5 Z', fill: 'var(--focus)' }));
          var tt = E('text', { y: -9, fill: 'var(--focus)' });
          tt.textContent = k; g.appendChild(tt);
          svg.appendChild(g); o.ptrs[k] = g;
        });
      }
      return o;
    },

    update: function (o, ctx, f) {
      (f.items || []).forEach(function (it, i) {
        if (i >= o.n) return;
        var st = it.state || 'idle';
        if (o.bars) {
          var v = Number(it.v) || 0, bh = v * o.unit;
          o.boxes[i].setAttribute('y', o.baseY - bh);
          o.boxes[i].setAttribute('height', bh);
          o.boxes[i].setAttribute('opacity', st === 'gone' ? 0.06 : (st === 'src' ? 0.42 : 0.16));
          var ft = it.fillTo;
          if (ft !== undefined && ft !== null && Number(ft) > v) {
            o.fills[i].setAttribute('y', o.baseY - Number(ft) * o.unit);
            o.fills[i].setAttribute('height', (Number(ft) - v) * o.unit);
            o.fills[i].setAttribute('opacity', 0.78);
          } else o.fills[i].setAttribute('opacity', 0);
          if (o.vals[i]) o.vals[i].textContent = it.v;
          if (o.rings[i]) o.rings[i].setAttribute('opacity', st === 'hot' ? 1 : 0);
        } else {
          o.boxes[i].setAttribute('class', 'bx' + (st === 'idle' ? '' : ' ' + st));
          o.txts[i].textContent = (it.v === null || it.v === undefined) ? '' : it.v;
          o.txts[i].setAttribute('class', 'tx' + (st === 'gone' ? ' gone' : ''));
        }
      });

      Object.keys(o.ptrs).forEach(function (k) {
        var v = (f.marks || {})[k], g = o.ptrs[k];
        if (v === undefined || v === null || v < 0 || v >= o.n) { g.setAttribute('opacity', 0); return; }
        g.setAttribute('opacity', 1);
        g.setAttribute('style', 'transform:translate(' + (o.X(v) + o.cw / 2) + 'px,' + (o.top - 13) + 'px)');
      });
    }
  };

  /* ----------------------------------------------------------------- grid */
  R.grid = {
    mount: function (svg, ctx) {
      var small = !!ctx.compact;
      var rows = ctx.frames[0].rows, m = rows.length, n = rows[0].length;
      var cs = small ? Math.max(9, Math.min(16, 120 / n)) : Math.max(34, Math.min(62, 460 / n));
      var gap = small ? 2 : 7, pad = small ? 4 : 30, top = small ? 4 : 30;
      var W = pad * 2 + n * cs + (n - 1) * gap;
      var H = top + m * cs + (m - 1) * gap + (small ? 4 : 26);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.innerHTML = '';

      var CX = function (j) { return pad + j * (cs + gap); };
      var CY = function (i) { return top + i * (cs + gap); };
      var boxes = [], txts = [];
      for (var i = 0; i < m; i++) {
        boxes.push([]); txts.push([]);
        for (var j = 0; j < n; j++) {
          var b = E('rect', { 'class': 'bx', x: CX(j), y: CY(i), width: cs, height: cs, rx: small ? 2 : 8 });
          svg.appendChild(b); boxes[i].push(b);
          var t = E('text', { 'class': 'tx', x: CX(j) + cs / 2, y: CY(i) + cs / 2 + (small ? 3 : 6),
                              style: 'font-size:' + (small ? Math.min(8, cs * 0.5) : Math.min(17, cs * 0.32)) + 'px' });
          svg.appendChild(t); txts[i].push(t);
        }
      }
      return { CX: CX, CY: CY, cs: cs, boxes: boxes, txts: txts, m: m, n: n, small: small };
    },

    update: function (o, ctx, f) {
      for (var i = 0; i < o.m; i++) {
        for (var j = 0; j < o.n; j++) {
          var c = ((f.rows || [])[i] || [])[j] || {};
          var st = c.state || 'idle';
          var empty = (c.v === null || c.v === undefined || c.v === '');
          o.boxes[i][j].setAttribute('class', 'bx' + (st === 'idle' ? '' : ' ' + st));
          o.boxes[i][j].setAttribute('stroke-dasharray', empty ? '4 3' : '0');
          o.txts[i][j].textContent = empty ? '' : c.v;
        }
      }
    }
  };

  /* ----------------------------------------------------------------- tree */
  R.tree = {
    mount: function (svg, ctx) {
      var small = !!ctx.compact;

      // Union of every node that ever appears, so positions never shift.
      var all = {}, order = [];
      ctx.frames.forEach(function (f) {
        (f.nodes || []).forEach(function (nd) {
          if (!(nd.id in all)) {
            all[nd.id] = { id: nd.id, parent: (nd.parent === undefined ? null : nd.parent), label: nd.label };
            order.push(nd.id);
          }
        });
      });

      var kids = {};
      order.forEach(function (id) {
        var p = all[id].parent;
        if (p !== null && p in all) { (kids[p] = kids[p] || []).push(id); }
      });
      var roots = order.filter(function (id) { var p = all[id].parent; return p === null || !(p in all); });

      var pos = {}, lx = 0, maxD = 0;
      function lay(id, d) {
        maxD = Math.max(maxD, d);
        var ch = kids[id] || [];
        if (!ch.length) { pos[id] = { x: lx++, y: d }; return; }
        ch.forEach(function (c) { lay(c, d + 1); });
        var xs = ch.map(function (c) { return pos[c].x; });
        pos[id] = { x: (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2, y: d };
      }
      roots.forEach(function (r) { lay(r, 0); });

      var span = Math.max(1, lx);
      var colW = small ? Math.max(9, Math.min(18, 130 / span)) : Math.max(50, Math.min(78, 520 / span));
      var rowH = small ? 13 : 74;
      var rad  = small ? Math.min(5, colW * 0.42) : Math.min(22, colW * 0.34);
      var pad  = small ? 4 : 32, top = small ? 4 : 30;

      var W = pad * 2 + Math.max(0, lx - 1) * colW + rad * 2 + (small ? 2 : 8);
      var H = top + maxD * rowH + rad * 2 + (small ? 4 : 44);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      svg.setAttribute('width', W); svg.setAttribute('height', H);
      svg.innerHTML = '';

      var PX = function (id) { return pad + rad + pos[id].x * colW; };
      var PY = function (id) { return top + pos[id].y * rowH + rad; };

      var edges = {}, G = {};
      order.forEach(function (id) {
        var p = all[id].parent;
        if (p === null || !(p in all)) return;
        var c1 = PY(p) + rad + (small ? 3 : 42), c2 = PY(id) - rad - (small ? 3 : 42);
        var e = E('path', { 'class': 'edge', opacity: 0,
          d: 'M ' + PX(p) + ',' + (PY(p) + rad) + ' C ' + PX(p) + ',' + c1 + ' ' + PX(id) + ',' + c2 + ' ' + PX(id) + ',' + (PY(id) - rad) });
        svg.appendChild(e); edges[id] = e;
      });

      // A node is a circle, so its label has to be short. Generated traces
      // sometimes hand us a sentence — shrink to fit, then truncate, rather
      // than letting long text spill across the diagram.
      function fitLabel(raw) {
        var s = String(raw == null ? '' : raw).trim();
        var maxChars = small ? 3 : 5;
        var size = small ? Math.min(6, rad * 0.95) : Math.min(13, rad * 0.62);
        if (s.length > maxChars) {
          // Shrink a little before cutting, so "12+3" still fits whole.
          size = size * (s.length <= maxChars + 2 ? 0.78 : 0.68);
          if (s.length > maxChars + 2) s = s.slice(0, maxChars + 1) + '…';
        }
        return { text: s, size: Math.max(small ? 4 : 7, size), full: String(raw == null ? '' : raw) };
      }

      order.forEach(function (id) {
        var g = E('g', { 'class': 'node', opacity: 0 });
        var c = E('circle', { r: rad, cx: PX(id), cy: PY(id), fill: 'var(--surface-2)', stroke: 'var(--line)', 'stroke-width': small ? 1 : 1.6 });
        g.appendChild(c);
        var lab = fitLabel(all[id].label);
        var t = E('text', { x: PX(id), y: PY(id) + (small ? 2.5 : 4.5), fill: 'var(--ink)',
                            style: 'font-size:' + lab.size + 'px' });
        t.textContent = lab.text;
        if (lab.text !== lab.full) {
          var tip = document.createElementNS(NS, 'title');
          tip.textContent = lab.full;
          g.appendChild(tip);
        }
        g.appendChild(t);
        var v = E('text', { x: PX(id), y: PY(id) + rad + (small ? 7 : 17), fill: 'var(--solid)',
                            style: 'font-size:' + (small ? 5.5 : 11.5) + 'px', opacity: 0 });
        g.appendChild(v);
        svg.appendChild(g);
        G[id] = { g: g, c: c, v: v };
      });

      return { edges: edges, G: G, small: small };
    },

    update: function (o, ctx, f) {
      var seen = {};
      (f.nodes || []).forEach(function (nd) { seen[nd.id] = nd; });
      Object.keys(o.G).forEach(function (id) {
        var nd = seen[id], ref = o.G[id];
        if (!nd) {
          ref.g.setAttribute('opacity', 0);
          if (o.edges[id]) o.edges[id].setAttribute('opacity', 0);
          return;
        }
        ref.g.setAttribute('opacity', 1);
        if (o.edges[id]) o.edges[id].setAttribute('opacity', 1);

        var st = nd.state || 'idle';
        var fill = 'var(--surface-2)', stroke = 'var(--line)', sw = o.small ? 1 : 1.6, show = false;
        if (st === 'hot')       { fill = 'var(--focus-bg)';    stroke = 'var(--focus)';        sw = o.small ? 1.6 : 2.6; }
        else if (st === 'done') { fill = 'var(--solid-bg)';    stroke = 'var(--solid-line)';   sw = o.small ? 1.3 : 2;  show = true; }
        else if (st === 'src')  { fill = 'var(--evidence-bg)'; stroke = 'var(--evidence)';     sw = o.small ? 1.5 : 2.4; show = true; }
        ref.c.setAttribute('fill', fill);
        ref.c.setAttribute('stroke', stroke);
        ref.c.setAttribute('stroke-width', sw);

        if (show && nd.value !== undefined && nd.value !== null && !o.small) {
          ref.v.textContent = (st === 'src' ? '↺ ' : '= ') + nd.value;
          ref.v.setAttribute('fill', st === 'src' ? 'var(--evidence)' : 'var(--solid)');
          ref.v.setAttribute('opacity', 1);
        } else ref.v.setAttribute('opacity', 0);

        if (o.edges[id]) o.edges[id].setAttribute('class', 'edge' + ((st === 'done' || st === 'src') ? ' on' : ''));
      });
    }
  };

  /* Draw a single frame into an svg — used for the small cards on the home page. */
  function drawStatic(svg, shape, render, frames, frameIndex) {
    var ctx = { frames: frames, render: render, compact: true };
    var refs = R[shape].mount(svg, ctx);
    R[shape].update(refs, ctx, frames[frameIndex === undefined ? frames.length - 1 : frameIndex]);
  }

  global.Render = { shapes: R, drawStatic: drawStatic };
})(window);
