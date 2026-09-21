/* KanaApp core: 저장소, 셔플 덱, TTS, 라우터 */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;
  KanaApp.views = KanaApp.views || {};

  /* ---------- 앱 버전 (PRD 3.10 설정 화면에 표시. sw.js CACHE_VERSION과 함께 올린다) ---------- */
  KanaApp.version = '2.0.2';

  /* ---------- 테마 (PRD 2, 3.10): 라이트/다크, localStorage 저장, OS 설정을 따르지 않는다 ----------
   * index.html의 head 인라인 스크립트가 첫 페인트 전에 같은 localStorage 키를 읽어
   * html[data-theme]를 미리 세팅해 두므로(플리커 방지), 여기서는 그 상태를 이어받아
   * API로 감싸기만 한다. */
  var THEME_KEY = 'kanaapp.theme';
  var THEME_COLORS = { light: '#FBFBFA', dark: '#0E0F11' };

  function applyThemeColorMeta(value) {
    var meta = document.getElementById('meta-theme-color') || document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[value] || THEME_COLORS.light);
  }

  KanaApp.theme = {
    get: function () {
      return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    },
    set: function (value) {
      var v = value === 'dark' ? 'dark' : 'light';
      try { window.localStorage.setItem(THEME_KEY, v); } catch (e) { /* 저장 실패는 무시 */ }
      document.documentElement.setAttribute('data-theme', v);
      applyThemeColorMeta(v);
    },
    toggle: function () {
      KanaApp.theme.set(KanaApp.theme.get() === 'dark' ? 'light' : 'dark');
    }
  };

  /* ---------- localStorage 설정 저장/복원 ---------- */
  var STORE_PREFIX = 'kanaapp.';
  KanaApp.store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(STORE_PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(STORE_PREFIX + key, JSON.stringify(value));
      } catch (e) {
        /* 저장 실패는 조용히 무시 (프라이빗 모드 등) */
      }
    }
  };

  /* ---------- 셔플 덱: 한 바퀴 돌 때까지 재등장 없음, 재섞을 때 직전 항목 연속 금지 ---------- */
  function shuffleArray(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  KanaApp.createShuffleDeck = function (items) {
    var source = items ? items.slice() : [];
    var deck = [];
    var lastItem = null;

    function reshuffle() {
      if (source.length === 0) { deck = []; return; }
      var arr = shuffleArray(source);
      if (lastItem !== null && arr.length > 1 && arr[0] === lastItem) {
        var idx = 1 + Math.floor(Math.random() * (arr.length - 1));
        var tmp = arr[0]; arr[0] = arr[idx]; arr[idx] = tmp;
      }
      deck = arr;
    }

    reshuffle();

    return {
      next: function () {
        if (deck.length === 0) reshuffle();
        if (deck.length === 0) return null;
        var item = deck.shift();
        lastItem = item;
        return item;
      },
      remaining: function () { return deck.length; },
      size: function () { return source.length; },
      setItems: function (newItems) {
        source = newItems ? newItems.slice() : [];
        lastItem = null;
        reshuffle();
      }
    };
  };

  /* ---------- TTS 헬퍼 ---------- */
  var tts = {
    supported: 'speechSynthesis' in window,
    jaVoice: null,
    listeners: []
  };

  function pickJaVoice() {
    if (!tts.supported) return null;
    var voices = [];
    try { voices = window.speechSynthesis.getVoices() || []; } catch (e) { voices = []; }
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang && voices[i].lang.toLowerCase().indexOf('ja') === 0) return voices[i];
    }
    return null;
  }

  function refreshVoice() {
    var found = pickJaVoice();
    var changed = found !== tts.jaVoice;
    tts.jaVoice = found;
    if (changed) {
      tts.listeners.forEach(function (fn) {
        try { fn(!!tts.jaVoice); } catch (e) {}
      });
    }
  }

  if (tts.supported) {
    refreshVoice();
    try {
      window.speechSynthesis.onvoiceschanged = refreshVoice;
    } catch (e) {}
  }

  KanaApp.tts = {
    hasVoice: function () { return !!tts.jaVoice; },
    onReady: function (fn) {
      if (typeof fn === 'function') tts.listeners.push(fn);
    },
    offReady: function (fn) {
      var idx = tts.listeners.indexOf(fn);
      if (idx >= 0) tts.listeners.splice(idx, 1);
    },
    speak: function (text) {
      if (!tts.supported || !tts.jaVoice || !text) return;
      try {
        /* 연타 시 이전 발화를 취소하고 새로 읽는다 */
        window.speechSynthesis.cancel();
        var utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'ja-JP';
        utter.voice = tts.jaVoice;
        utter.rate = 0.85; /* 초급자가 따라 듣기 좋도록 약간 느리게 */
        window.speechSynthesis.speak(utter);
      } catch (e) {}
    },
    stop: function () {
      if (!tts.supported) return;
      try { window.speechSynthesis.cancel(); } catch (e) {}
    },
    /* 음성이 있으면 읽고, 없으면 설치 안내를 띄운다. 대부분의 재생 버튼은 이 함수를 쓴다. */
    speakOrNotify: function (text) {
      if (!text) return;
      if (tts.jaVoice) { KanaApp.tts.speak(text); return; }
      KanaApp.showVoiceHelp();
    }
  };

  /* 낱글자 TTS 보정: は・へ는 한 글자만 읽힐 때도 기기 TTS가 조사로 오인해
   * '와'・'에'로 읽는 경우가 많다. 가타카나로 바꿔 넘기면 조사 변환 규칙이
   * 적용되지 않아 원래 소리(하/헤)로 읽힌다. 단어·문장 속의 조사 は는
   * TTS가 문맥으로 알아서 읽으므로 건드리지 않는다(원문 그대로 읽는다). */
  var KANA_TTS_FIX = { 'は': 'ハ', 'へ': 'ヘ' };
  KanaApp.tts.speakKana = function (item) {
    if (!item || !item.char) return;
    var text = KANA_TTS_FIX[item.char] || item.char;
    KanaApp.tts.speakOrNotify(text);
  };

  /* ---------- 음성 없음 안내 모달 ---------- */
  KanaApp.showVoiceHelp = function () {
    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog modal-info';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.appendChild(KanaApp.makeIcon('close'));

    var title = document.createElement('h2');
    title.className = 'modal-info-title';
    title.textContent = '일본어 음성을 찾을 수 없어요';

    var body = document.createElement('div');
    body.className = 'modal-info-body';

    var p1 = document.createElement('p');
    p1.textContent = '이 기기·브라우저에는 일본어(ja-JP) 음성이 설치되어 있지 않은 것 같습니다.';

    var p2 = document.createElement('p');
    var b2 = document.createElement('strong');
    b2.textContent = 'Windows: ';
    p2.appendChild(b2);
    p2.appendChild(document.createTextNode('설정 → 시간 및 언어 → 음성 → 음성 추가 → 일본어'));

    var p3 = document.createElement('p');
    var b3 = document.createElement('strong');
    b3.textContent = 'iPhone·Android·Mac: ';
    p3.appendChild(b3);
    p3.appendChild(document.createTextNode('대부분 기본으로 들어 있어요. 설정의 음성/텍스트 음성 변환(TTS) 언어에 일본어가 있는지 확인해 보세요.'));

    body.appendChild(p1);
    body.appendChild(p2);
    body.appendChild(p3);

    dialog.appendChild(closeBtn);
    dialog.appendChild(title);
    dialog.appendChild(body);
    overlay.appendChild(dialog);
    modalRoot.appendChild(overlay);

    function close() {
      document.removeEventListener('keydown', onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKeydown(e) { if (e.key === 'Escape') close(); }
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);
  };

  /* ---------- 해시 라우터 ---------- */
  /* 뷰 이름 뒤에 하위 경로를 둘 수 있다: #/flash/run 처럼.
   * 설정 화면 = 하위 경로 없음, 진행 화면 = '/run'. 새로고침으로 '/run'에 바로 들어오면
   * 각 뷰가 스스로 설정 화면으로 돌려보낸다(모듈 스코프 플래그가 새로고침 시 초기화되므로). */
  var routerContainer = null;
  var routerTitleEl = null;
  var currentView = null;
  var currentName = null;
  var currentSub = '';

  function parseHash(hash) {
    var clean = (hash || '').replace(/^#\/?/, '');
    var slashIdx = clean.indexOf('/');
    var name = slashIdx >= 0 ? clean.slice(0, slashIdx) : clean;
    var sub = slashIdx >= 0 ? clean.slice(slashIdx + 1) : '';
    if (!name || !KanaApp.views[name]) return { name: 'home', sub: '' };
    return { name: name, sub: sub };
  }

  function updateHeader(parsed) {
    var backBtn = document.getElementById('btn-back');
    if (!backBtn) return;
    if (parsed.name === 'home') {
      backBtn.style.visibility = 'hidden';
      backBtn.onclick = null;
    } else {
      backBtn.style.visibility = 'visible';
      var target;
      if (parsed.sub) {
        target = '#/' + parsed.name;
      } else if (parsed.name === 'about') {
        /* PRD 3.10: 정보·출처의 뒤로는 메인이 아니라 설정으로 돌아간다(설정에서 들어오므로) */
        target = '#/settings';
      } else {
        target = '#/';
      }
      backBtn.onclick = function () { window.location.hash = target; };
    }
  }

  function render() {
    var parsed = parseHash(window.location.hash);
    if (currentView && typeof currentView.unmount === 'function') {
      try { currentView.unmount(); } catch (e) { /* 뷰 정리 오류는 무시 */ }
    }
    if (!routerContainer) return;
    routerContainer.innerHTML = '';
    var view = KanaApp.views[parsed.name];
    currentView = view || null;
    currentName = parsed.name;
    currentSub = parsed.sub;
    if (routerTitleEl) {
      routerTitleEl.textContent = (view && view.title) || '카나퐁';
    }
    try {
      document.title = ((view && view.title) || '카나퐁') + ' · 카나퐁';
    } catch (e) {}
    updateHeader(parsed);
    if (view && typeof view.mount === 'function') {
      try {
        view.mount(routerContainer, parsed.sub);
      } catch (e) {
        routerContainer.innerHTML = '<p class="error-message">화면을 불러오는 중 문제가 생겼습니다.</p>';
      }
    } else {
      routerContainer.innerHTML = '<p class="error-message">화면을 찾을 수 없습니다.</p>';
    }
  }

  KanaApp.router = {
    init: function (container, titleEl) {
      routerContainer = container;
      routerTitleEl = titleEl;
      window.addEventListener('hashchange', render);
      render();
    },
    navigate: function (hash) {
      window.location.hash = hash;
    },
    currentName: function () { return currentName; },
    currentSub: function () { return currentSub; }
  };

  /* ---------- 인라인 SVG 선 아이콘 (이모지 대체) ---------- */
  var ICON_PATHS = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    prev: '<path d="M18 5l-8 7 8 7"/><path d="M8 5v14"/>',
    next: '<path d="M6 5l8 7-8 7"/><path d="M16 5v14"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 4l12 8-12 8V4z" stroke-linejoin="round"/>',
    speak: '<path d="M4 9v6h4l5 4V5L8 9H4z" stroke-linejoin="round"/><path d="M16.2 9a4 4 0 010 6"/><path d="M18.6 6.5a8 8 0 010 11"/>',
    chevronDown: '<path d="M6 9l6 6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    ai: '<path d="M4 5.5A1.5 1.5 0 015.5 4h13A1.5 1.5 0 0120 5.5v9a1.5 1.5 0 01-1.5 1.5H9l-4 4v-4H5.5A1.5 1.5 0 014 14.5v-9z" stroke-linejoin="round"/><path d="M10 9.3c0-1.1.9-2 2-2s2 .7 2 1.6c0 1.3-2 1.5-2 3"/><path d="M12 16v.01"/>',
    strokes: '<path d="M4 20h4L18.5 9.5a2.12 2.12 0 000-3l-1-1a2.12 2.12 0 00-3 0L4 15v5z" stroke-linejoin="round"/><path d="M13.5 6.5l3 3"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 000-3l2-1.4-2-3.4-2.3.9a7.5 7.5 0 00-2.6-1.5L14 2.5h-4l-.5 2.6a7.5 7.5 0 00-2.6 1.5l-2.3-.9-2 3.4 2 1.4a7.6 7.6 0 000 3l-2 1.4 2 3.4 2.3-.9c.76.66 1.64 1.17 2.6 1.5l.5 2.6h4l.5-2.6a7.5 7.5 0 002.6-1.5l2.3.9 2-3.4-2-1.4z" stroke-linejoin="round"/>'
  };

  KanaApp.makeIcon = function (name, extraClass) {
    var span = document.createElement('span');
    span.className = 'icon' + (extraClass ? ' ' + extraClass : '');
    span.setAttribute('aria-hidden', 'true');
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = ICON_PATHS[name] || '';
    span.appendChild(svg);
    return span;
  };

  KanaApp.makeIconButton = function (iconName, ariaLabel, extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-icon' + (extraClass ? ' ' + extraClass : '');
    b.setAttribute('aria-label', ariaLabel);
    b.appendChild(KanaApp.makeIcon(iconName));
    return b;
  };

  /* 상단 바 뒤로 버튼에도 아이콘을 채운다 (이 스크립트는 헤더 마크업 뒤에서 실행된다) */
  (function fillBackIcon() {
    var backBtn = document.getElementById('btn-back');
    if (backBtn && !backBtn.querySelector('svg')) {
      backBtn.appendChild(KanaApp.makeIcon('back'));
    }
  })();

  /* ---------- 설정 화면 공용 UI (세그먼트 컨트롤 · 칩 · 접이식 칩 · 슬라이더) ---------- */
  KanaApp.ui = {
    field: function (labelText) {
      var fieldset = document.createElement('fieldset');
      fieldset.className = 'settings-field';
      var legend = document.createElement('legend');
      legend.textContent = labelText;
      fieldset.appendChild(legend);
      return fieldset;
    },

    /* 단일 선택 세그먼트 컨트롤. options: [{value,label}] */
    segmented: function (name, options, current, onChange) {
      var row = document.createElement('div');
      row.className = 'segmented';
      row.setAttribute('role', 'radiogroup');
      options.forEach(function (opt) {
        var label = document.createElement('label');
        label.className = 'segmented-option' + (opt.value === current ? ' selected' : '');
        var input = document.createElement('input');
        input.type = 'radio';
        input.name = name;
        input.value = opt.value;
        input.checked = opt.value === current;
        input.addEventListener('change', function () {
          if (!input.checked) return;
          Array.prototype.forEach.call(row.children, function (child) {
            child.classList.toggle('selected', child === label);
          });
          onChange(opt.value);
        });
        var span = document.createElement('span');
        span.textContent = opt.label;
        label.appendChild(input);
        label.appendChild(span);
        row.appendChild(label);
      });
      return row;
    },

    /* 복수 선택 칩 한 개 */
    chip: function (labelText, checked, onChange) {
      var label = document.createElement('label');
      label.className = 'chip' + (checked ? ' selected' : '');
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.addEventListener('change', function () {
        label.classList.toggle('selected', input.checked);
        onChange(input.checked);
      });
      var span = document.createElement('span');
      span.textContent = labelText;
      label.appendChild(input);
      label.appendChild(span);
      return label;
    },

    /* 여러 개 칩을 한 그룹으로(접지 않고 전부 보여준다) */
    chipGroup: function (items, isSelectedFn, onToggleFn) {
      var group = document.createElement('div');
      group.className = 'chip-group';
      items.forEach(function (item) {
        var checked = isSelectedFn(item.key);
        var chip = KanaApp.ui.chip(item.label, checked, function (v) { onToggleFn(item.key, v); });
        group.appendChild(chip);
      });
      return group;
    },

    /* 글자·단어·문장 옆에 스피커 버튼을 붙인다. targetEl을 감싸는 인라인 앵커를 만들고
     * 그 오른쪽 바깥(left:100%)에 버튼을 절대 위치시킨다 — targetEl은 기존 흐름 그대로
     * 가운데 정렬되어 밀리지 않고, 버튼은 글자 폭에 따라 항상 그 오른쪽 옆에 붙는다.
     * (다음 단계의 "획순" 버튼도 같은 자리에 더할 수 있도록 actions를 그룹으로 둔다.) */
    attachSpeaker: function (targetEl, onSpeak, opts) {
      opts = opts || {};
      var anchor = document.createElement('span');
      anchor.className = 'speak-anchor' + (opts.extraClass ? ' ' + opts.extraClass : '');
      var parent = targetEl.parentNode;
      var nextSibling = targetEl.nextSibling;
      anchor.appendChild(targetEl);

      var actions = document.createElement('span');
      actions.className = 'speak-anchor-actions';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-speak';
      btn.setAttribute('aria-label', opts.ariaLabel || '소리 듣기');
      btn.appendChild(KanaApp.makeIcon('speak'));
      btn.addEventListener('click', function (e) {
        if (e && e.stopPropagation) e.stopPropagation();
        if (typeof onSpeak === 'function') onSpeak();
      });
      actions.appendChild(btn);
      anchor.appendChild(actions);

      if (parent) parent.insertBefore(anchor, nextSibling);
      return { anchor: anchor, actions: actions, button: btn };
    },

    /* 발음·뜻 자리에 쓰는 점선 빈칸 상자. 카드를 누르면 .blank 클래스를 지워 값이 드러난다. */
    fieldSlot: function (labelText, valueText, valueClass) {
      var slot = document.createElement('span');
      slot.className = 'field-slot blank';
      var label = document.createElement('span');
      label.className = 'field-slot-label';
      label.textContent = labelText;
      var value = document.createElement('span');
      value.className = 'field-slot-value' + (valueClass ? ' ' + valueClass : '');
      value.textContent = valueText;
      slot.appendChild(label);
      slot.appendChild(value);
      return slot;
    },

    /* 행 목록 컨테이너(메인·설정 공용). 안에 KanaApp.ui.row()로 만든 행을 순서대로 넣는다. */
    rowList: function () {
      var list = document.createElement('div');
      list.className = 'row-list';
      return list;
    },

    /* 행 목록의 행 하나. opts:
     *  href       : 있으면 <a>로 만든다(링크 이동)
     *  onClick    : 클릭 핸들러(href 없이 <div>로 만들 때도 쓸 수 있다)
     *  glyph      : 가나 글리프 텍스트(왼쪽, lang="ja")
     *  glyphSmall : 글리프를 작게(여러 글자일 때)
     *  icon       : glyph 대신 아이콘 이름(makeIcon)
     *  title, desc: 본문 제목·설명
     *  meta       : 오른쪽 보조 텍스트(개수 등)
     *  chevron    : true면 오른쪽에 이동 화살표
     *  control    : 오른쪽에 붙일 임의의 컨트롤 엘리먼트(세그먼트 등). 이 경우 행 자체는 클릭 대상이 아니다.
     *  ariaLabel  : 접근성 라벨
     */
    row: function (opts) {
      opts = opts || {};
      var tag = opts.href ? 'a' : (opts.control ? 'div' : (opts.onClick ? 'button' : 'div'));
      var el = document.createElement(tag);
      el.className = 'row' + (opts.extraClass ? ' ' + opts.extraClass : '');
      if (tag === 'button') el.type = 'button';
      if (opts.href) el.href = opts.href;
      if (opts.ariaLabel) el.setAttribute('aria-label', opts.ariaLabel);
      if (typeof opts.onClick === 'function') el.addEventListener('click', opts.onClick);

      if (opts.glyph) {
        var glyph = document.createElement('span');
        glyph.className = 'row-glyph' + (opts.glyphSmall ? ' is-sm' : '');
        glyph.lang = 'ja';
        glyph.setAttribute('aria-hidden', 'true');
        glyph.textContent = opts.glyph;
        el.appendChild(glyph);
      } else if (opts.icon) {
        var iconWrap = document.createElement('span');
        iconWrap.className = 'row-glyph';
        iconWrap.setAttribute('aria-hidden', 'true');
        iconWrap.appendChild(KanaApp.makeIcon(opts.icon));
        el.appendChild(iconWrap);
      }

      var body = document.createElement('span');
      body.className = 'row-body';
      if (opts.title) {
        var t = document.createElement('span');
        t.className = 'row-title';
        t.textContent = opts.title;
        body.appendChild(t);
      }
      if (opts.desc) {
        var d = document.createElement('span');
        d.className = 'row-desc';
        d.textContent = opts.desc;
        body.appendChild(d);
      }
      el.appendChild(body);

      if (opts.meta) {
        var m = document.createElement('span');
        m.className = 'row-meta';
        m.textContent = opts.meta;
        el.appendChild(m);
      }
      if (opts.control) {
        var controlWrap = document.createElement('span');
        controlWrap.className = 'row-control';
        controlWrap.appendChild(opts.control);
        el.appendChild(controlWrap);
      }
      if (opts.chevron) {
        el.appendChild(KanaApp.makeIcon('chevronRight', 'row-chevron'));
      }
      return el;
    },

    sliderRow: function (min, max, step, value, ariaLabel, formatFn, onInput) {
      var row = document.createElement('div');
      row.className = 'range-row';
      var input = document.createElement('input');
      input.type = 'range';
      input.min = String(min);
      input.max = String(max);
      input.step = String(step);
      input.value = String(value);
      input.setAttribute('aria-label', ariaLabel);
      var out = document.createElement('span');
      out.className = 'range-value';
      out.textContent = formatFn(value);
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10);
        out.textContent = formatFn(v);
        onInput(v);
      });
      row.appendChild(input);
      row.appendChild(out);
      return row;
    }
  };
})();
