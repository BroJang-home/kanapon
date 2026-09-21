/* 인트로 오버레이 (PRD 3.11). 세션당 한 번, 첫 로드 시 어떤 해시로 들어와도 보여준다.
 * 라우터(KanaApp.router.init)는 이 오버레이가 닫힌 뒤에만 호출되므로, 뒤에 있는 뷰는
 * 인트로가 떠 있는 동안 아예 마운트되지 않는다(타이머·키보드 단축키가 겹칠 일이 없다). */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  var INTRO_KEY = 'kanaapp.introShown';

  KanaApp.introNeeded = function () {
    try {
      return window.sessionStorage.getItem(INTRO_KEY) !== '1';
    } catch (e) {
      return true;
    }
  };

  KanaApp.showIntro = function (onDone) {
    try { window.sessionStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* 저장 실패는 무시 */ }

    var reducedMotion = false;
    try {
      reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (e) { reducedMotion = false; }

    var overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.setAttribute('role', 'button');
    overlay.setAttribute('aria-label', '카나퐁 소개, 탭하여 시작');
    overlay.tabIndex = 0;

    var badge = document.createElement('div');
    badge.className = 'intro-badge';
    badge.lang = 'ja';
    badge.setAttribute('aria-hidden', 'true');
    badge.textContent = 'カ';
    overlay.appendChild(badge);

    var logo = document.createElement('h1');
    logo.className = 'intro-logo';
    logo.lang = 'ja';
    logo.textContent = 'カナポン';
    overlay.appendChild(logo);

    var gloss = document.createElement('p');
    gloss.className = 'intro-gloss';
    gloss.textContent = '카나퐁';
    overlay.appendChild(gloss);

    var lead = document.createElement('p');
    lead.className = 'intro-lead';
    lead.textContent = '히라가나·가타카나와 쉬운 단어·문장을 익혀요.';
    overlay.appendChild(lead);

    var tap = document.createElement('p');
    tap.className = 'intro-tap';
    tap.textContent = '탭하여 시작';
    overlay.appendChild(tap);

    document.body.appendChild(overlay);
    try { overlay.focus(); } catch (e) { /* 무시 */ }

    var done = false;
    function finish() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      document.removeEventListener('keydown', onKeydown);
      if (typeof onDone === 'function') onDone();
    }
    function dismiss() {
      if (done) return;
      done = true;
      if (reducedMotion) { finish(); return; }
      overlay.classList.add('is-leaving');
      window.setTimeout(finish, 220);
    }
    function onKeydown(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        dismiss();
      }
    }
    overlay.addEventListener('click', dismiss);
    document.addEventListener('keydown', onKeydown);
  };
})();
