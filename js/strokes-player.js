/* KanaApp 획순 플레이어 (PRD 3.7)
 * KanaApp.createStrokePlayer(str, opts) -> { container, play, replay, stop, destroy, setShowNumbers, hasData }
 *
 * 문자열의 각 글자를 109x109 SVG 칸에 나란히 그린다. 옅은 회색 가이드(전체 글자 윤곽) 위에
 * 획을 순서대로 stroke-dashoffset 애니메이션(WAAPI)으로 그리고, 획 번호를 붙인다.
 * 데이터가 없는 글자는 그 칸에 안내 문구만 표시한다.
 * prefers-reduced-motion이면 애니메이션 없이 완성형 + 번호만 보여준다.
 */
(function (root) {
  'use strict';

  var App = (root.KanaApp = root.KanaApp || {});
  var SVGNS = 'http://www.w3.org/2000/svg';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* path의 첫 M 명령에서 시작 좌표를 뽑는다. 데이터 규약상 모든 path는 M으로 시작한다. */
  function parseStartPoint(d) {
    var m = /^M\s*(-?[0-9.]+)[,\s]+(-?[0-9.]+)/.exec(d || '');
    if (!m) return null;
    return { x: parseFloat(m[1]), y: parseFloat(m[2]) };
  }

  function parseViewBox(vb) {
    var parts = String(vb || '0 0 109 109').trim().split(/\s+/).map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) parts = [0, 0, 109, 109];
    return { minX: parts[0], minY: parts[1], w: parts[2], h: parts[3] };
  }

  function svgEl(tag) { return document.createElementNS(SVGNS, tag); }

  App.createStrokePlayer = function (str, opts) {
    opts = opts || {};
    var showNumbers = opts.showNumbers !== false;
    var reducedMotion = false;
    try {
      reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { reducedMotion = false; }

    var entries = App.getStrokes ? App.getStrokes(str) : [];

    var container = document.createElement('div');
    container.className = 'stroke-player' + (opts.extraClass ? ' ' + opts.extraClass : '');

    var row = document.createElement('div');
    row.className = 'stroke-player-row';
    container.appendChild(row);

    var allStrokes = [];   /* 순서대로: { el, len } (getTotalLength은 지연 계산) */
    var numberGroups = [];
    var hasAnyData = false;

    entries.forEach(function (entry) {
      var box = document.createElement('div');
      box.className = 'stroke-player-glyph' + (entry.small ? ' is-small' : '');

      if (!entry.strokes || !entry.strokes.length) {
        var missing = document.createElement('div');
        missing.className = 'stroke-player-missing';
        missing.textContent = '획순 데이터가 없습니다';
        box.appendChild(missing);
        row.appendChild(box);
        return;
      }

      hasAnyData = true;
      var vb = entry.viewBox || '0 0 109 109';
      var box2 = parseViewBox(vb);

      var svg = svgEl('svg');
      svg.setAttribute('viewBox', vb);
      svg.setAttribute('class', 'stroke-player-svg');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');

      /* 십자 보조선 */
      var crossG = svgEl('g');
      crossG.setAttribute('class', 'stroke-player-cross');
      var cx = box2.minX + box2.w / 2;
      var cy = box2.minY + box2.h / 2;
      var vLine = svgEl('line');
      vLine.setAttribute('x1', cx); vLine.setAttribute('x2', cx);
      vLine.setAttribute('y1', box2.minY); vLine.setAttribute('y2', box2.minY + box2.h);
      var hLine = svgEl('line');
      hLine.setAttribute('y1', cy); hLine.setAttribute('y2', cy);
      hLine.setAttribute('x1', box2.minX); hLine.setAttribute('x2', box2.minX + box2.w);
      crossG.appendChild(vLine);
      crossG.appendChild(hLine);
      svg.appendChild(crossG);

      /* 가이드: 전체 글자 윤곽(옅은 회색, 고정 표시) */
      var guideG = svgEl('g');
      guideG.setAttribute('class', 'stroke-player-guide');
      entry.strokes.forEach(function (d) {
        var p = svgEl('path');
        p.setAttribute('d', d);
        guideG.appendChild(p);
      });
      svg.appendChild(guideG);

      /* 애니메이션 대상 획 */
      var strokesG = svgEl('g');
      strokesG.setAttribute('class', 'stroke-player-strokes');

      /* 획 번호 */
      var numbersG = svgEl('g');
      numbersG.setAttribute('class', 'stroke-player-numbers');
      numbersG.style.display = showNumbers ? '' : 'none';
      numberGroups.push(numbersG);

      entry.strokes.forEach(function (d, i) {
        var p = svgEl('path');
        p.setAttribute('d', d);
        p.setAttribute('class', 'stroke-player-stroke');
        strokesG.appendChild(p);
        allStrokes.push({ el: p, len: null });

        var pt = parseStartPoint(d) || { x: cx, y: cy };
        var nx = clamp(pt.x - 6, box2.minX + 4, box2.minX + box2.w - 4);
        var ny = clamp(pt.y - 6, box2.minY + 4, box2.minY + box2.h - 4);
        var g = svgEl('g');
        g.setAttribute('class', 'stroke-player-num');
        g.setAttribute('transform', 'translate(' + nx + ',' + ny + ')');
        var circle = svgEl('circle');
        circle.setAttribute('r', '5.4');
        var text = svgEl('text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dy', '0.32em');
        text.textContent = String(i + 1);
        g.appendChild(circle);
        g.appendChild(text);
        numbersG.appendChild(g);
      });

      svg.appendChild(strokesG);
      svg.appendChild(numbersG);
      box.appendChild(svg);
      row.appendChild(box);
    });

    /* ---------- 재생 제어 ---------- */
    var timers = [];
    var playToken = 0;

    function clearTimers() {
      timers.forEach(function (t) { window.clearTimeout(t); });
      timers = [];
    }

    function strokeLen(s) {
      if (s.len == null) {
        try { s.len = s.el.getTotalLength(); } catch (e) { s.len = 90; }
      }
      return s.len;
    }

    function cancelRunningAnim(s) {
      if (s.anim) {
        try { s.anim.cancel(); } catch (e) { /* 무시 */ }
        s.anim = null;
      }
    }

    function resetStrokes() {
      allStrokes.forEach(function (s) {
        cancelRunningAnim(s);
        var len = strokeLen(s);
        s.el.style.strokeDasharray = String(len);
        s.el.style.strokeDashoffset = String(len);
        s.el.style.transition = '';
        s.el.classList.remove('is-drawing', 'is-done');
      });
    }

    function showComplete() {
      allStrokes.forEach(function (s) {
        cancelRunningAnim(s);
        var len = strokeLen(s);
        s.el.style.strokeDasharray = String(len);
        s.el.style.strokeDashoffset = '0';
        s.el.style.transition = '';
        s.el.classList.remove('is-drawing');
        s.el.classList.add('is-done');
      });
    }

    function haltSequence() {
      playToken++;
      clearTimers();
      allStrokes.forEach(cancelRunningAnim);
    }

    function runSequence() {
      haltSequence();
      resetStrokes();
      if (!allStrokes.length) return;
      if (reducedMotion) { showComplete(); return; }

      var token = playToken;
      var i = 0;

      function step() {
        if (token !== playToken || i >= allStrokes.length) return;
        var s = allStrokes[i];
        var len = strokeLen(s);
        s.el.classList.add('is-drawing');
        var duration = clamp(len * 9, 350, 900);

        function finishStroke() {
          if (token !== playToken) return;
          s.el.classList.remove('is-drawing');
          s.el.classList.add('is-done');
          s.el.style.strokeDashoffset = '0';
          s.anim = null;
          i++;
          if (i < allStrokes.length) {
            timers.push(window.setTimeout(step, 150));
          }
        }

        if (typeof s.el.animate === 'function') {
          try {
            s.anim = s.el.animate(
              [{ strokeDashoffset: String(len) }, { strokeDashoffset: '0' }],
              { duration: duration, easing: 'linear', fill: 'forwards' }
            );
            s.anim.onfinish = finishStroke;
            return;
          } catch (e) { /* WAAPI 실패 시 transition으로 대체 */ }
        }
        s.el.style.transition = 'stroke-dashoffset ' + duration + 'ms linear';
        void s.el.getBoundingClientRect();
        s.el.style.strokeDashoffset = '0';
        timers.push(window.setTimeout(finishStroke, duration));
      }

      step();
    }

    /* 초기 상태: 재생 전에는 가이드만 보이도록 획을 숨겨 둔다(감소된 모션이면 완성형). */
    resetStrokes();
    if (reducedMotion) showComplete();

    function setShowNumbers(v) {
      showNumbers = !!v;
      numberGroups.forEach(function (g) { g.style.display = showNumbers ? '' : 'none'; });
    }

    function destroy() {
      haltSequence();
      if (container.parentNode) container.parentNode.removeChild(container);
    }

    return {
      container: container,
      play: runSequence,
      replay: runSequence,
      stop: haltSequence,
      destroy: destroy,
      setShowNumbers: setShowNumbers,
      hasData: hasAnyData
    };
  };

  if (typeof module === 'object' && module.exports) { module.exports = App; }
})(typeof window !== 'undefined' ? window : globalThis);
