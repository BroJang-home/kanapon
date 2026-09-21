/* 공용 카드 트레이너: 단어 외우기(#/words)와 문장 익히기(#/sentences)가 함께 쓴다.
 * 설정 화면(하위 경로 없음) <-> 진행 화면(하위 경로 '/run'). js/core.js의 라우터가
 * view.mount(container, sub)로 sub('' 또는 'run')을 넘겨준다. */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  function normalizeCategories(cats) {
    if (!Array.isArray(cats)) return [];
    var out = [];
    cats.forEach(function (c) {
      if (c === null || c === undefined) return;
      if (typeof c === 'string') { out.push({ key: c, label: c }); return; }
      var k = c.key || c.id || c.value || c.category;
      var label = c.label || c.name || c.title || k;
      if (k) out.push({ key: k, label: label });
    });
    return out;
  }

  /* ---------- AI 서포트 (PRD 3.9): 질문 프리셋 + 프롬프트 템플릿 ---------- */
  var AI_QUESTIONS = {
    word: [
      { label: '예문 3개', question: '이 단어를 사용한 예문을 3개 만들어 줘.' },
      { label: '비슷한 말과 차이', question: '이 단어와 뜻이 비슷한 다른 단어가 있으면 알려주고, 어떻게 다른지 설명해 줘.' },
      { label: '언제 쓰는 말인지', question: '이 단어를 실제로 언제, 어떤 상황에서 쓰는지 알려 줘.' }
    ],
    sentence: [
      { label: '문법 풀이', question: '이 문장의 문법을 초급자가 이해하기 쉽게 풀어서 설명해 줘.' },
      { label: '단어별 뜻', question: '이 문장을 단어(문절) 단위로 나눠서 뜻을 알려 줘.' },
      { label: '바꿔 말하기', question: '이 문장과 비슷한 뜻의 다른 말로 바꿔서 알려 줘.' }
    ]
  };

  function buildAiPrompt(item, question, isSentence) {
    var kindLabel = isSentence ? '문장' : '단어';
    return [
      '나는 일본어를 이제 막 배우기 시작한 완전 초급 한국인입니다.',
      '아래 ' + kindLabel + '에 대해 질문이 있어요.',
      '',
      kindLabel + ': ' + item.jp + ' (' + item.ko + ') — 뜻: ' + item.meaning,
      '',
      '질문: ' + question,
      '',
      '답변 규칙:',
      '- 쉬운 한국어로 짧게 답해 주세요.',
      '- 일본어를 쓸 때는 항상 한글로 읽는 법을 괄호로 붙여 주세요.',
      '- 한자를 쓰면 히라가나 읽기도 함께 적어 주세요.',
      "- 한글 발음 표기 규칙: か=카·が=가, つ=츠, 장음은 '-'(예: おおきい→오-키-), 촉음(っ)은 앞 글자에 ㅅ받침, ん은 뒤 소리에 따라 ㄴ/ㅁ/ㅇ, 조사 は=와."
    ].join('\n');
  }

  function fitCardText(el, maxSize, minSize) {
    el.style.fontSize = maxSize + 'px';
    var guard = 40;
    while (guard-- > 0 && (el.scrollWidth > el.parentElement.clientWidth || el.scrollHeight > 160)) {
      maxSize -= 2;
      if (maxSize < minSize) { maxSize = minSize; el.style.fontSize = maxSize + 'px'; break; }
      el.style.fontSize = maxSize + 'px';
    }
  }

  /* config:
   *  key           : localStorage 키 접두어('words' | 'sentences')
   *  title         : 화면 제목
   *  hasScriptSet  : true면 세트(히라/가타/섞기) 필터를 보여준다
   *  isSentence    : true면 카드 글자 크기를 문장에 맞게 줄인다
   *  getItems()    : 원본 배열
   *  getCategories() : 분류 배열(선택)
   *  getSpeakText(item) : TTS로 읽을 텍스트
   *  emptyMessage  : 데이터가 없을 때 보여줄 안내
   */
  KanaApp.createCardTrainer = function (config) {
    var key = config.key;
    var hasScriptSet = !!config.hasScriptSet;
    /* 새로고침 시 스크립트가 다시 실행되어 false가 된다. '/run'에 바로 들어오면
     * (직접 진입·새로고침) 이 값이 false이므로 설정 화면으로 돌려보낸다. */
    var startedThisSession = false;

    function storeGet(name, fallback) { return KanaApp.store.get(key + '.' + name, fallback); }
    function storeSet(name, value) { KanaApp.store.set(key + '.' + name, value); }

    function getAllItems() {
      return (typeof config.getItems === 'function' ? config.getItems() : []) || [];
    }

    function getCategories() {
      var fromData = normalizeCategories(typeof config.getCategories === 'function' ? config.getCategories() : null);
      if (fromData.length) return fromData;
      var seen = {};
      var out = [];
      getAllItems().forEach(function (it) {
        if (it.category && !seen[it.category]) { seen[it.category] = true; out.push({ key: it.category, label: it.category }); }
      });
      return out;
    }

    function categoryLabel(catKey) {
      var found = null;
      getCategories().forEach(function (c) { if (c.key === catKey) found = c.label; });
      return found || catKey;
    }

    function currentSettings() {
      return {
        set: hasScriptSet ? storeGet('set', 'hira') : null,
        levels: storeGet('levels', [1, 2, 3, 4, 5]),
        categoryKeys: storeGet('categoryKeys', []),
        advance: storeGet('advance', 'manual'),
        autoSeconds: storeGet('autoSeconds', 5),
        /* 새 키: 기본값이 '빈칸'. 예전 words.revealMode 값과 무관하게 항상 새 기본값을 쓴다. */
        reveal: storeGet('reveal', 'blank')
      };
    }

    function filterItems(state) {
      var all = getAllItems();
      var scripts = hasScriptSet ? (state.set === 'mixed' ? ['hira', 'kata', 'mixed'] : [state.set]) : null;
      return all.filter(function (it) {
        if (scripts && scripts.indexOf(it.script) < 0) return false;
        if (state.levels && state.levels.indexOf(it.level) < 0) return false;
        if (state.categoryKeys && state.categoryKeys.length && state.categoryKeys.indexOf(it.category) < 0) return false;
        return true;
      });
    }

    /* ---------- 설정 화면 ---------- */
    function renderSettings(container) {
      var itemsAvailable = !!getAllItems().length;
      var wrap = document.createElement('div');
      wrap.className = 'settings-view view-fade';

      if (!itemsAvailable) {
        var notice = document.createElement('p');
        notice.className = 'empty-notice';
        notice.textContent = config.emptyMessage || '표시할 데이터가 아직 없습니다.';
        wrap.appendChild(notice);
        container.appendChild(wrap);
        return;
      }

      var categories = getCategories();
      var state = currentSettings();

      if (hasScriptSet) {
        var fSet = KanaApp.ui.field('세트');
        fSet.appendChild(KanaApp.ui.segmented(key + '-set', [
          { value: 'hira', label: '히라가나' },
          { value: 'kata', label: '가타카나' },
          { value: 'mixed', label: '섞기' }
        ], state.set, function (v) { state.set = v; storeSet('set', v); updateCount(); }));
        wrap.appendChild(fSet);
      }

      var fLevel = KanaApp.ui.field('난이도');
      var levelGroup = document.createElement('div');
      levelGroup.className = 'chip-group';
      [1, 2, 3, 4, 5].forEach(function (lv) {
        levelGroup.appendChild(KanaApp.ui.chip('Lv.' + lv, state.levels.indexOf(lv) >= 0, function (checked) {
          var idx = state.levels.indexOf(lv);
          if (checked && idx < 0) state.levels.push(lv);
          if (!checked && idx >= 0) state.levels.splice(idx, 1);
          storeSet('levels', state.levels);
          updateCount();
        }));
      });
      fLevel.appendChild(levelGroup);
      wrap.appendChild(fLevel);

      var fCategory = KanaApp.ui.field('분류');
      if (categories.length === 0) {
        var noCat = document.createElement('p');
        noCat.className = 'settings-note';
        noCat.textContent = '분류 정보 없음 (전체 사용)';
        fCategory.appendChild(noCat);
      } else {
        var hint = document.createElement('p');
        hint.className = 'settings-note';
        hint.style.margin = '0 0 8px';
        hint.textContent = '선택하지 않으면 전체 분류를 사용합니다.';
        fCategory.appendChild(hint);
        /* 분류가 많아도 접지 않고 전부 보여준다('더 보기' 없음, PRD 3.8) */
        fCategory.appendChild(KanaApp.ui.chipGroup(
          categories,
          function (catKey) { return state.categoryKeys.indexOf(catKey) >= 0; },
          function (catKey, checked) {
            var idx = state.categoryKeys.indexOf(catKey);
            if (checked && idx < 0) state.categoryKeys.push(catKey);
            if (!checked && idx >= 0) state.categoryKeys.splice(idx, 1);
            storeSet('categoryKeys', state.categoryKeys);
            updateCount();
          }
        ));
      }
      wrap.appendChild(fCategory);

      var fAdvance = KanaApp.ui.field('넘김');
      fAdvance.appendChild(KanaApp.ui.segmented(key + '-advance', [
        { value: 'manual', label: '수동' },
        { value: 'auto', label: '자동' }
      ], state.advance, function (v) {
        state.advance = v;
        storeSet('advance', v);
        autoSecondsRow.style.display = v === 'auto' ? '' : 'none';
      }));
      var autoSecondsRow = KanaApp.ui.sliderRow(2, 20, 1, state.autoSeconds, '자동 넘김 초', function (v) {
        return v + '초';
      }, function (v) { state.autoSeconds = v; storeSet('autoSeconds', v); });
      autoSecondsRow.style.display = state.advance === 'auto' ? '' : 'none';
      autoSecondsRow.style.marginTop = '10px';
      fAdvance.appendChild(autoSecondsRow);
      wrap.appendChild(fAdvance);

      var fReveal = KanaApp.ui.field('한글 발음·뜻 표시');
      fReveal.appendChild(KanaApp.ui.segmented(key + '-reveal', [
        { value: 'blank', label: '빈칸 → 누르면 보임' },
        { value: 'start', label: '처음부터' }
      ], state.reveal, function (v) { state.reveal = v; storeSet('reveal', v); }));
      wrap.appendChild(fReveal);

      var countLine = document.createElement('p');
      countLine.className = 'settings-count';
      wrap.appendChild(countLine);

      var startBtn = document.createElement('button');
      startBtn.type = 'button';
      startBtn.className = 'btn-primary';
      startBtn.textContent = '시작';
      startBtn.addEventListener('click', function () {
        var list = filterItems(state);
        if (list.length === 0) return;
        startedThisSession = true;
        KanaApp.router.navigate('#/' + key + '/run');
      });
      wrap.appendChild(startBtn);

      function updateCount() {
        var list = filterItems(state);
        countLine.textContent = '선택한 개수: ' + list.length + '개';
        startBtn.disabled = list.length === 0;
      }
      updateCount();

      container.appendChild(wrap);
    }

    /* ---------- 진행 화면 ---------- */
    function renderProgress(container) {
      var state = currentSettings();
      var items = filterItems(state);
      if (items.length === 0) {
        KanaApp.router.navigate('#/' + key);
        return null;
      }

      function goToSettings() { KanaApp.router.navigate('#/' + key); }

      var wrap = document.createElement('div');
      wrap.className = 'trainer-progress view-fade';

      var reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

      var card = document.createElement('div');
      card.className = 'trainer-card';
      card.setAttribute('tabindex', '0');

      var jpWrap = document.createElement('div');
      jpWrap.className = 'card-jp-wrap';
      var jpEl = document.createElement('div');
      jpEl.className = 'card-jp' + (config.isSentence ? ' is-sentence' : '');
      jpEl.lang = 'ja';
      /* 스피커 버튼을 본문(jp) 오른쪽 옆에 둔다. targetEl은 그대로 가운데 정렬된다(PRD 3.6). */
      var jpSpeaker = KanaApp.ui.attachSpeaker(jpEl, function () {
        if (!currentItem) return;
        var text = typeof config.getSpeakText === 'function' ? config.getSpeakText(currentItem) : currentItem.jp;
        KanaApp.tts.speakOrNotify(text);
      }, { ariaLabel: '소리 듣기' });
      jpWrap.appendChild(jpSpeaker.anchor);

      var tagsEl = document.createElement('div');
      tagsEl.className = 'card-tags';

      var fields = document.createElement('div');
      fields.className = 'card-fields';
      var koSlot = KanaApp.ui.fieldSlot('발음', '', 'card-ko');
      var meaningSlot = KanaApp.ui.fieldSlot('뜻', '', 'card-meaning');
      fields.appendChild(koSlot);
      fields.appendChild(meaningSlot);

      var revealHint = document.createElement('div');
      revealHint.className = 'card-reveal-hint';
      revealHint.textContent = '탭하거나 Space/Enter로 보기';

      card.appendChild(jpWrap);
      card.appendChild(tagsEl);
      card.appendChild(fields);
      card.appendChild(revealHint);

      var positionEl = document.createElement('p');
      positionEl.className = 'card-position';

      wrap.appendChild(card);
      wrap.appendChild(positionEl);

      var controlBar = document.createElement('div');
      controlBar.className = 'control-bar';
      var controls = document.createElement('div');
      controls.className = 'control-bar-inner';
      controlBar.appendChild(controls);

      var prevBtn = KanaApp.makeIconButton('prev', '이전 카드');
      var nextBtn = KanaApp.makeIconButton('next', '다음 카드');
      var aiBtn = document.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'btn-ai';
      aiBtn.setAttribute('aria-label', 'AI에게 묻기');
      aiBtn.appendChild(KanaApp.makeIcon('ai'));
      var aiBtnLabel = document.createElement('span');
      aiBtnLabel.textContent = 'AI에게 묻기';
      aiBtn.appendChild(aiBtnLabel);
      var exitBtn = document.createElement('button');
      exitBtn.type = 'button';
      exitBtn.className = 'btn-exit';
      exitBtn.textContent = '나가기';
      exitBtn.setAttribute('aria-label', '연습 종료하고 설정으로 나가기');

      controls.appendChild(prevBtn);
      controls.appendChild(nextBtn);
      controls.appendChild(aiBtn);
      controls.appendChild(exitBtn);

      container.appendChild(wrap);
      container.appendChild(controlBar);

      var deck = KanaApp.createShuffleDeck(items);
      var history = [];
      var pointer = -1;
      var currentItem = null;
      var autoTimer = null;
      var aiSheetOpen = false;
      var closeAiSheet = null;

      function showItem(item) {
        currentItem = item;
        jpEl.textContent = item.jp;
        var koValue = koSlot.querySelector('.field-slot-value');
        var meaningValue = meaningSlot.querySelector('.field-slot-value');
        koValue.textContent = item.ko;
        meaningValue.textContent = item.meaning;
        tagsEl.textContent = (item.category ? categoryLabel(item.category) + ' · ' : '') + 'Lv.' + item.level;
        positionEl.textContent = (pointer + 1) + '번째';

        var revealed = state.reveal === 'start';
        koSlot.classList.toggle('blank', !revealed);
        meaningSlot.classList.toggle('blank', !revealed);
        revealHint.classList.toggle('hidden', revealed);

        window.requestAnimationFrame(function () {
          fitCardText(jpEl, config.isSentence ? 34 : 56, config.isSentence ? 16 : 20);
        });
        restartAutoTimer();
      }

      /* ---------- 기록(히스토리): 본 카드를 배열로 쌓고 현재 위치를 가리킨다.
       * 이전으로 처음 카드까지 되돌아갈 수 있고, 다시 앞으로 가면 같은 순서가 재현된다.
       * 기록 끝에서 앞으로 가면 셔플 덱에서 새 카드를 뽑는다(PRD 3.8). ---------- */
      function drawNext() {
        if (pointer < history.length - 1) {
          pointer++;
          return history[pointer];
        }
        var item = deck.next();
        if (!item) return null;
        history.push(item);
        pointer = history.length - 1;
        return item;
      }

      function goNext() {
        var item = drawNext();
        if (!item) return;
        showItem(item);
      }

      function goPrev() {
        if (pointer <= 0) return;
        pointer--;
        showItem(history[pointer]);
      }

      function reveal() {
        koSlot.classList.remove('blank');
        meaningSlot.classList.remove('blank');
        revealHint.classList.add('hidden');
      }

      function restartAutoTimer() {
        if (autoTimer) { window.clearTimeout(autoTimer); autoTimer = null; }
        if (state.advance === 'auto' && !aiSheetOpen) {
          autoTimer = window.setTimeout(function () { playTransition('next'); }, state.autoSeconds * 1000);
        }
      }

      /* ---------- 카드 애니메이션: 드래그 추종 + 날아가기/스프링백/튕김 ---------- */
      var isAnimating = false;

      function playBounce() {
        card.classList.remove('dragging');
        card.style.transition = 'none';
        card.style.transform = '';
        card.style.opacity = '';
        if (reducedMotion) return;
        card.classList.remove('bounce');
        void card.offsetWidth; /* 강제 리플로우: 애니메이션 재시작 */
        card.classList.add('bounce');
        window.setTimeout(function () { card.classList.remove('bounce'); }, 260);
      }

      function playSpringBack() {
        card.classList.remove('dragging');
        card.style.transition = reducedMotion
          ? 'opacity 120ms ease'
          : 'transform 260ms cubic-bezier(.34,1.56,.64,1), opacity 200ms ease';
        card.style.transform = '';
        card.style.opacity = '';
      }

      function playTransition(direction) {
        if (direction === 'prev' && pointer <= 0) { playBounce(); return; }
        if (isAnimating) return;
        var advance = direction === 'next' ? goNext : goPrev;
        card.classList.remove('dragging');
        if (reducedMotion) {
          card.style.transition = 'none';
          card.style.transform = '';
          card.style.opacity = '';
          advance();
          return;
        }
        isAnimating = true;
        var width = card.offsetWidth || 320;
        var exitX = (direction === 'next' ? -1 : 1) * (width + 120);
        var exitRot = (direction === 'next' ? -1 : 1) * 16;
        card.style.transition = 'transform 200ms ease-in, opacity 200ms ease-in';
        void card.offsetWidth;
        card.style.transform = 'translateX(' + exitX + 'px) rotate(' + exitRot + 'deg)';
        card.style.opacity = '0';

        var settled = false;
        function finishExit() {
          if (settled) return;
          settled = true;
          card.removeEventListener('transitionend', onTransitionEnd);
          card.style.transition = 'none';
          var enterX = (direction === 'next' ? 1 : -1) * (width + 120);
          card.style.transform = 'translateX(' + enterX + 'px) rotate(0deg)';
          card.style.opacity = '0';
          advance();
          void card.offsetWidth;
          card.style.transition = 'transform 220ms ease-out, opacity 220ms ease-out';
          card.style.transform = '';
          card.style.opacity = '';
          window.setTimeout(function () { isAnimating = false; }, 230);
        }
        function onTransitionEnd(ev) {
          if (ev.target !== card) return;
          if (ev.propertyName && ev.propertyName !== 'transform') return;
          finishExit();
        }
        card.addEventListener('transitionend', onTransitionEnd);
        window.setTimeout(finishExit, 260);
      }

      card.addEventListener('click', function () {
        if (suppressClick) { suppressClick = false; return; }
        reveal();
      });
      prevBtn.addEventListener('click', function () { playTransition('prev'); });
      nextBtn.addEventListener('click', function () { playTransition('next'); });
      aiBtn.addEventListener('click', function () {
        if (!currentItem) return;
        openAiSheet(currentItem);
      });
      exitBtn.addEventListener('click', goToSettings);

      function onKeydown(e) {
        if (aiSheetOpen) return; /* 시트가 열려 있는 동안은 카드 단축키를 막는다 */
        if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          reveal();
        } else if (e.key === 'ArrowRight') {
          playTransition('next');
        } else if (e.key === 'ArrowLeft') {
          playTransition('prev');
        }
      }
      document.addEventListener('keydown', onKeydown);

      /* ---------- 포인터 드래그 스와이프(터치·마우스, Pointer Events) ----------
       * 가로 이동이 작으면 탭(빈칸 열기)으로 처리하고, 세로 스크롤과는
       * touch-action: pan-y(CSS)로 충돌을 피한다. 왼쪽으로 밀면 다음, 오른쪽이면 이전. */
      var DRAG_THRESHOLD = 80;
      var VELOCITY_THRESHOLD = 0.5;
      var DRAG_SLOP = 6;
      var pointerId = null, startX = 0, startY = 0, lastX = 0, lastTime = 0, velocity = 0;
      var dragActive = false, dragConfirmed = false, suppressClick = false;

      function onPointerDown(e) {
        if (isAnimating) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        pointerId = e.pointerId;
        startX = e.clientX; startY = e.clientY;
        lastX = startX; lastTime = Date.now(); velocity = 0;
        dragActive = true; dragConfirmed = false;
      }

      function onPointerMove(e) {
        if (!dragActive || e.pointerId !== pointerId) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!dragConfirmed) {
          if (Math.abs(dx) > DRAG_SLOP && Math.abs(dx) > Math.abs(dy)) {
            dragConfirmed = true;
            suppressClick = true;
            card.classList.add('dragging');
            try { card.setPointerCapture(pointerId); } catch (err) { /* 무시 */ }
          } else if (Math.abs(dy) > DRAG_SLOP) {
            dragActive = false; /* 세로 스크롤 제스처로 판단, 손을 뗀다 */
            return;
          } else {
            return;
          }
        }
        e.preventDefault();
        var now = Date.now();
        var dt = now - lastTime;
        if (dt > 0) velocity = (e.clientX - lastX) / dt;
        lastX = e.clientX; lastTime = now;
        card.style.transition = 'none';
        var rot = Math.max(-14, Math.min(14, dx / 14));
        card.style.transform = 'translateX(' + dx + 'px) rotate(' + rot + 'deg)';
        if (!reducedMotion) {
          card.style.opacity = String(Math.max(0.5, 1 - Math.abs(dx) / 500));
        }
      }

      function onPointerUp(e) {
        if (!dragActive || e.pointerId !== pointerId) return;
        dragActive = false;
        if (!dragConfirmed) return; /* 탭: card의 click 리스너가 처리 */
        var dx = e.clientX - startX;
        try { card.releasePointerCapture(pointerId); } catch (err) { /* 무시 */ }
        var passed = Math.abs(dx) > DRAG_THRESHOLD || Math.abs(velocity) > VELOCITY_THRESHOLD;
        if (passed) {
          playTransition(dx < 0 ? 'next' : 'prev');
        } else {
          playSpringBack();
        }
      }

      function onPointerCancel(e) {
        if (e.pointerId !== pointerId) return;
        dragActive = false;
        playSpringBack();
      }

      card.addEventListener('pointerdown', onPointerDown);
      card.addEventListener('pointermove', onPointerMove);
      card.addEventListener('pointerup', onPointerUp);
      card.addEventListener('pointercancel', onPointerCancel);

      /* ---------- AI 서포트(PRD 3.9): 바텀시트 ---------- */
      function openAiSheet(item) {
        var modalRoot = document.getElementById('modal-root');
        if (!modalRoot) return;
        aiSheetOpen = true;
        restartAutoTimer(); /* 자동 넘김 중이면 일시정지 */

        var overlay = document.createElement('div');
        overlay.className = 'sheet-overlay';
        var panel = document.createElement('div');
        panel.className = 'sheet-panel' + (reducedMotion ? ' no-anim' : '');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', 'AI에게 묻기');

        var header = document.createElement('div');
        header.className = 'sheet-header';
        var title = document.createElement('h2');
        title.className = 'sheet-title';
        title.textContent = 'AI에게 묻기';
        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'modal-close';
        closeBtn.setAttribute('aria-label', '닫기');
        closeBtn.appendChild(KanaApp.makeIcon('close'));
        header.appendChild(title);
        header.appendChild(closeBtn);
        panel.appendChild(header);

        var preview = document.createElement('p');
        preview.className = 'sheet-item-preview';
        preview.lang = 'ja';
        preview.textContent = item.jp + '  ·  ' + item.ko + '  ·  ' + item.meaning;
        panel.appendChild(preview);

        var isSentence = !!config.isSentence;
        var presets = isSentence ? AI_QUESTIONS.sentence : AI_QUESTIONS.word;

        var list = document.createElement('div');
        list.className = 'sheet-question-list';
        presets.forEach(function (q) {
          var qBtn = document.createElement('button');
          qBtn.type = 'button';
          qBtn.className = 'sheet-question-btn';
          qBtn.textContent = q.label;
          qBtn.addEventListener('click', function () { askQuestion(q.question); });
          list.appendChild(qBtn);
        });
        panel.appendChild(list);

        var directWrap = document.createElement('div');
        directWrap.className = 'sheet-direct';
        var directLabel = document.createElement('label');
        directLabel.className = 'sheet-direct-label';
        directLabel.textContent = '직접 질문';
        var directInput = document.createElement('textarea');
        directInput.className = 'sheet-direct-input';
        directInput.rows = 2;
        directInput.placeholder = isSentence ? '예: 더 정중하게 말하려면?' : '예: 이거 반말로 어떻게 말해요?';
        directLabel.appendChild(directInput);
        var directBtn = document.createElement('button');
        directBtn.type = 'button';
        directBtn.className = 'btn-primary sheet-direct-btn';
        directBtn.textContent = '물어보기';
        directBtn.addEventListener('click', function () {
          var q = directInput.value.trim();
          if (!q) { directInput.focus(); return; }
          askQuestion(q);
        });
        directWrap.appendChild(directLabel);
        directWrap.appendChild(directBtn);
        panel.appendChild(directWrap);

        var resultWrap = document.createElement('div');
        resultWrap.className = 'sheet-result hidden';
        var resultLabel = document.createElement('p');
        resultLabel.className = 'sheet-result-label';
        resultLabel.textContent = '만들어진 프롬프트';
        var resultText = document.createElement('textarea');
        resultText.className = 'sheet-result-text';
        resultText.rows = 6;
        resultText.readOnly = true;
        var resultActions = document.createElement('div');
        resultActions.className = 'sheet-result-actions';
        var openBtn = document.createElement('button');
        openBtn.type = 'button';
        openBtn.className = 'btn-primary';
        openBtn.textContent = 'Claude에서 다시 열기';
        var copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'btn-exit';
        copyBtn.textContent = '프롬프트 복사';
        resultActions.appendChild(openBtn);
        resultActions.appendChild(copyBtn);
        resultWrap.appendChild(resultLabel);
        resultWrap.appendChild(resultText);
        resultWrap.appendChild(resultActions);
        panel.appendChild(resultWrap);

        var lastPrompt = '';
        function openClaudeTab(promptText) {
          var url = 'https://claude.ai/new?q=' + encodeURIComponent(promptText);
          window.open(url, '_blank', 'noopener');
        }
        function askQuestion(questionText) {
          lastPrompt = buildAiPrompt(item, questionText, isSentence);
          resultText.value = lastPrompt;
          resultWrap.classList.remove('hidden');
          openClaudeTab(lastPrompt);
        }
        openBtn.addEventListener('click', function () { if (lastPrompt) openClaudeTab(lastPrompt); });
        copyBtn.addEventListener('click', function () {
          if (!lastPrompt) return;
          function done() {
            var old = copyBtn.textContent;
            copyBtn.textContent = '복사됨';
            window.setTimeout(function () { copyBtn.textContent = old; }, 1500);
          }
          function fallbackCopy() {
            resultText.focus();
            resultText.select();
            try { document.execCommand('copy'); done(); } catch (e) { /* 무시 */ }
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(lastPrompt).then(done, fallbackCopy);
          } else {
            fallbackCopy();
          }
        });

        overlay.appendChild(panel);
        modalRoot.appendChild(overlay);

        function close() {
          if (!aiSheetOpen) return;
          aiSheetOpen = false;
          closeAiSheet = null;
          document.removeEventListener('keydown', onSheetKeydown);
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          restartAutoTimer(); /* 자동 넘김 재개(새 구간으로 다시 시작) */
        }
        function onSheetKeydown(e) { if (e.key === 'Escape') close(); }
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', onSheetKeydown);
        closeAiSheet = close;
      }

      function onResize() { fitCardText(jpEl, config.isSentence ? 34 : 56, config.isSentence ? 16 : 20); }
      window.addEventListener('resize', onResize);

      goNext();

      return {
        destroy: function () {
          if (autoTimer) window.clearTimeout(autoTimer);
          if (closeAiSheet) closeAiSheet();
          window.removeEventListener('resize', onResize);
          document.removeEventListener('keydown', onKeydown);
          card.removeEventListener('pointerdown', onPointerDown);
          card.removeEventListener('pointermove', onPointerMove);
          card.removeEventListener('pointerup', onPointerUp);
          card.removeEventListener('pointercancel', onPointerCancel);
          KanaApp.tts.stop();
          if (controlBar.parentNode) controlBar.parentNode.removeChild(controlBar);
        }
      };
    }

    var activeSession = null;

    function mount(container, sub) {
      if (sub === 'run') {
        if (!startedThisSession) {
          KanaApp.router.navigate('#/' + key);
          return;
        }
        activeSession = renderProgress(container);
      } else {
        renderSettings(container);
      }
    }

    function unmount() {
      if (activeSession) { activeSession.destroy(); activeSession = null; }
    }

    return {
      title: config.title,
      mount: mount,
      unmount: unmount
    };
  };
})();
