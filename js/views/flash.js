/* 문자 외우기: 설정 화면(#/flash) -> 진행 화면(#/flash/run) */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  /* 새로고침 등으로 스크립트가 다시 실행되면 false로 초기화된다.
   * '/run'으로 바로 들어온 경우(새로고침·직접 진입) 설정 화면으로 돌려보내는 데 쓴다. */
  var startedThisSession = false;

  function filterKana(setValue, includeDakuon, includeYoon) {
    var all = KanaApp.kana || [];
    var scripts = setValue === 'mixed' ? ['hira', 'kata'] : [setValue];
    var groups = ['basic'];
    if (includeDakuon) { groups.push('dakuon', 'handakuon'); }
    if (includeYoon) { groups.push('yoon'); }
    return all.filter(function (k) {
      return scripts.indexOf(k.script) >= 0 && groups.indexOf(k.group) >= 0;
    });
  }

  function currentSettings() {
    return {
      set: KanaApp.store.get('flash.set', 'hira'),
      dakuon: KanaApp.store.get('flash.dakuon', false),
      yoon: KanaApp.store.get('flash.yoon', false),
      seconds: KanaApp.store.get('flash.seconds', 3),
      koMode: KanaApp.store.get('flash.koMode', 'half')
    };
  }

  function renderSettings(container) {
    var kanaAvailable = !!(KanaApp.kana && KanaApp.kana.length);
    var wrap = document.createElement('div');
    wrap.className = 'settings-view view-fade';

    if (!kanaAvailable) {
      var notice = document.createElement('p');
      notice.className = 'empty-notice';
      notice.textContent = '표시할 가나 데이터가 아직 없습니다. 데이터 준비 후 다시 열어주세요.';
      wrap.appendChild(notice);
      container.appendChild(wrap);
      return;
    }

    var state = currentSettings();

    var fSet = KanaApp.ui.field('세트');
    fSet.appendChild(KanaApp.ui.segmented('flash-set', [
      { value: 'hira', label: '히라가나' },
      { value: 'kata', label: '가타카나' },
      { value: 'mixed', label: '섞기' }
    ], state.set, function (v) { state.set = v; KanaApp.store.set('flash.set', v); updateCount(); }));
    wrap.appendChild(fSet);

    var fRange = KanaApp.ui.field('범위 (기본 46자는 항상 포함)');
    var rangeRow = document.createElement('div');
    rangeRow.className = 'chip-group';
    rangeRow.appendChild(KanaApp.ui.chip('탁음·반탁음 포함', state.dakuon, function (v) {
      state.dakuon = v; KanaApp.store.set('flash.dakuon', v); updateCount();
    }));
    rangeRow.appendChild(KanaApp.ui.chip('요음 포함', state.yoon, function (v) {
      state.yoon = v; KanaApp.store.set('flash.yoon', v); updateCount();
    }));
    fRange.appendChild(rangeRow);
    wrap.appendChild(fRange);

    var fSeconds = KanaApp.ui.field('글자당 초');
    fSeconds.appendChild(KanaApp.ui.sliderRow(1, 10, 1, state.seconds, '글자당 초', function (v) {
      return v + '초';
    }, function (v) { state.seconds = v; KanaApp.store.set('flash.seconds', v); }));
    wrap.appendChild(fSeconds);

    var fKo = KanaApp.ui.field('한글 발음 표시');
    fKo.appendChild(KanaApp.ui.segmented('flash-ko', [
      { value: 'start', label: '처음부터' },
      { value: 'half', label: '절반 지나서' },
      { value: 'hidden', label: '숨김' }
    ], state.koMode, function (v) { state.koMode = v; KanaApp.store.set('flash.koMode', v); }));
    wrap.appendChild(fKo);

    var countLine = document.createElement('p');
    countLine.className = 'settings-count';
    wrap.appendChild(countLine);

    var startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'btn-primary';
    startBtn.textContent = '시작';
    startBtn.addEventListener('click', function () {
      var list = filterKana(state.set, state.dakuon, state.yoon);
      if (list.length === 0) return;
      startedThisSession = true;
      KanaApp.router.navigate('#/flash/run');
    });
    wrap.appendChild(startBtn);

    function updateCount() {
      var list = filterKana(state.set, state.dakuon, state.yoon);
      countLine.textContent = '선택한 글자 수: ' + list.length + '자';
      startBtn.disabled = list.length === 0;
    }
    updateCount();

    container.appendChild(wrap);
  }

  function renderProgress(container) {
    var settings = currentSettings();
    var items = filterKana(settings.set, settings.dakuon, settings.yoon);
    if (items.length === 0) {
      KanaApp.router.navigate('#/flash');
      return null;
    }
    var seconds = settings.seconds;
    var koMode = settings.koMode;

    function goToSettings() { KanaApp.router.navigate('#/flash'); }

    var wrap = document.createElement('div');
    wrap.className = 'flash-progress view-fade';

    var progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    var progressFill = document.createElement('div');
    progressFill.className = 'progress-fill';
    progressBar.appendChild(progressFill);

    var stage = document.createElement('div');
    stage.className = 'flash-stage';
    var charEl = document.createElement('div');
    charEl.className = 'flash-char';
    charEl.lang = 'ja';
    /* 스피커 버튼을 큰 글자 오른쪽 옆에 둔다(PRD 3.6). 글자 자신은 그대로 가운데. */
    var charSpeaker = KanaApp.ui.attachSpeaker(charEl, function () {
      if (currentItem) KanaApp.tts.speakKana(currentItem);
    }, { ariaLabel: '소리 듣기', extraClass: 'speak-anchor-flash' });
    var strokesBtn = KanaApp.makeIconButton('strokes', '획순 보기', 'btn-strokes');
    charSpeaker.actions.appendChild(strokesBtn);
    var koSlot = document.createElement('div');
    koSlot.className = 'flash-ko-slot';
    var koEl = document.createElement('div');
    koEl.className = 'flash-ko';
    koSlot.appendChild(koEl);
    stage.appendChild(charSpeaker.anchor);
    stage.appendChild(koSlot);

    /* ---------- 획순 보기(PRD 3.7): 재생 중 타이머·깜박임 일시정지 ---------- */
    var strokeHost = document.createElement('div');
    strokeHost.className = 'flash-stroke-host';
    var strokeHostInner = document.createElement('div');
    strokeHostInner.className = 'stroke-view-host';
    var strokeControls = document.createElement('div');
    strokeControls.className = 'flash-stroke-controls stroke-view-controls';
    var strokeReplayBtn = document.createElement('button');
    strokeReplayBtn.type = 'button';
    strokeReplayBtn.className = 'btn-secondary';
    strokeReplayBtn.textContent = '다시 보기';
    var strokeCloseBtn = document.createElement('button');
    strokeCloseBtn.type = 'button';
    strokeCloseBtn.className = 'btn-secondary';
    strokeCloseBtn.textContent = '닫기';
    strokeControls.appendChild(strokeReplayBtn);
    strokeControls.appendChild(strokeCloseBtn);
    strokeHost.appendChild(strokeHostInner);
    strokeHost.appendChild(strokeControls);
    stage.appendChild(strokeHost);

    var strokePlayer = null;
    var strokesOpen = false;
    var pausedBeforeStrokes = false;

    function openStrokes() {
      if (strokesOpen || !currentItem) return;
      strokesOpen = true;
      pausedBeforeStrokes = paused;
      if (!paused) setPaused(true);
      charSpeaker.anchor.style.display = 'none';
      koSlot.style.display = 'none';
      strokeHost.classList.add('is-open');
      strokePlayer = KanaApp.createStrokePlayer(currentItem.char, { extraClass: 'stroke-player-flash' });
      strokeHostInner.appendChild(strokePlayer.container);
      strokePlayer.play();
    }

    function closeStrokes() {
      if (!strokesOpen) return;
      strokesOpen = false;
      if (strokePlayer) { strokePlayer.destroy(); strokePlayer = null; }
      strokeHostInner.innerHTML = '';
      strokeHost.classList.remove('is-open');
      charSpeaker.anchor.style.display = '';
      koSlot.style.display = '';
      if (!pausedBeforeStrokes) setPaused(false);
    }

    strokesBtn.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (strokesOpen) closeStrokes(); else openStrokes();
    });
    strokeReplayBtn.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (strokePlayer) strokePlayer.replay();
    });
    strokeCloseBtn.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      closeStrokes();
    });

    var controlBar = document.createElement('div');
    controlBar.className = 'control-bar';
    var controls = document.createElement('div');
    controls.className = 'control-bar-inner';
    controlBar.appendChild(controls);

    var prevBtn = KanaApp.makeIconButton('prev', '이전 글자');
    var pauseBtn = KanaApp.makeIconButton('pause', '일시정지');
    var nextBtn = KanaApp.makeIconButton('next', '다음 글자');
    var exitBtn = document.createElement('button');
    exitBtn.type = 'button';
    exitBtn.className = 'btn-exit';
    exitBtn.textContent = '나가기';
    exitBtn.setAttribute('aria-label', '연습 종료하고 설정으로 나가기');

    controls.appendChild(prevBtn);
    controls.appendChild(pauseBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(exitBtn);

    wrap.appendChild(progressBar);
    wrap.appendChild(stage);
    container.appendChild(wrap);
    container.appendChild(controlBar);

    var deck = KanaApp.createShuffleDeck(items);
    var history = [];
    var pointer = -1;
    var durationMs = seconds * 1000;
    var paused = false;
    var revealed = false;
    var elapsedBeforePause = 0;
    var resumeTime = Date.now();
    var tickHandle = null;
    var currentItem = null;

    function reveal() {
      if (revealed) return;
      revealed = true;
      koEl.classList.add('revealed');
    }

    function restartBlink() {
      charEl.classList.remove('blink');
      /* eslint-disable-next-line no-unused-expressions */
      void charEl.offsetWidth;
      charEl.classList.add('blink');
    }

    function showItem(item) {
      currentItem = item;
      charEl.textContent = item.char;
      koEl.textContent = item.ko;
      koEl.classList.remove('revealed');
      revealed = koMode === 'start';
      if (revealed) koEl.classList.add('revealed');
      elapsedBeforePause = 0;
      resumeTime = Date.now();
      progressFill.style.width = '0%';
      restartBlink();
      if (!paused) charEl.classList.remove('is-paused');
    }

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
      if (strokesOpen) closeStrokes();
      showItem(item);
    }

    function goPrev() {
      if (pointer <= 0) return;
      if (strokesOpen) closeStrokes();
      pointer--;
      showItem(history[pointer]);
    }

    function setPauseIcon(name) {
      var old = pauseBtn.querySelector('.icon');
      var next = KanaApp.makeIcon(name);
      if (old) pauseBtn.replaceChild(next, old); else pauseBtn.appendChild(next);
    }

    function setPaused(next) {
      if (next === paused) return;
      var now = Date.now();
      if (next) {
        elapsedBeforePause += now - resumeTime;
        paused = true;
        charEl.classList.add('is-paused');
        setPauseIcon('play');
        pauseBtn.setAttribute('aria-label', '재개');
      } else {
        resumeTime = now;
        paused = false;
        charEl.classList.remove('is-paused');
        setPauseIcon('pause');
        pauseBtn.setAttribute('aria-label', '일시정지');
      }
    }

    function tick() {
      if (paused || !currentItem) return;
      var elapsed = elapsedBeforePause + (Date.now() - resumeTime);
      var ratio = Math.min(1, elapsed / durationMs);
      progressFill.style.width = (ratio * 100) + '%';
      if (koMode === 'half' && !revealed && elapsed >= durationMs / 2) reveal();
      if (elapsed >= durationMs) goNext();
    }

    tickHandle = window.setInterval(tick, 100);

    prevBtn.addEventListener('click', goPrev);
    nextBtn.addEventListener('click', goNext);
    pauseBtn.addEventListener('click', function () { setPaused(!paused); });
    exitBtn.addEventListener('click', goToSettings);
    stage.addEventListener('click', function () { reveal(); });

    function onKeydown(e) {
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setPaused(!paused);
      } else if (e.key === 'ArrowRight') {
        goNext();
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 's' || e.key === 'S') {
        if (strokesOpen) closeStrokes(); else openStrokes();
      }
    }
    document.addEventListener('keydown', onKeydown);

    goNext();

    return {
      destroy: function () {
        window.clearInterval(tickHandle);
        document.removeEventListener('keydown', onKeydown);
        if (strokePlayer) { strokePlayer.destroy(); strokePlayer = null; }
        KanaApp.tts.stop();
        if (controlBar.parentNode) controlBar.parentNode.removeChild(controlBar);
      }
    };
  }

  var activeSession = null;

  function mount(container, sub) {
    if (sub === 'run') {
      if (!startedThisSession) {
        KanaApp.router.navigate('#/flash');
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

  KanaApp.views.flash = {
    title: '문자 외우기',
    mount: mount,
    unmount: unmount
  };
})();
