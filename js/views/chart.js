/* 전체 보기: 오십음도 + 탁음/반탁음 + 요음 표 */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  var GROUPS = [
    { key: 'basic', label: '기본', cols: ['a', 'i', 'u', 'e', 'o'], rows: [
      { row: 'a' }, { row: 'k' }, { row: 's' }, { row: 't' },
      { row: 'n' }, { row: 'h' }, { row: 'm' }, { row: 'y' }, { row: 'r' }, { row: 'w' },
      { row: 'n', solo: 'n' }
    ] },
    { key: 'dakuon', label: '탁음', cols: ['a', 'i', 'u', 'e', 'o'], rows: ['g', 'z', 'd', 'b'].map(function (r) { return { row: r }; }) },
    { key: 'handakuon', label: '반탁음', cols: ['a', 'i', 'u', 'e', 'o'], rows: [{ row: 'p' }] },
    { key: 'yoon', label: '요음', cols: ['a', 'u', 'o'], rows: ['ky', 'sh', 'ch', 'ny', 'hy', 'my', 'ry', 'gy', 'j', 'by', 'py'].map(function (r) { return { row: r }; }) }
  ];

  var TAB_DEFS = [
    { key: 'hira', label: '히라가나' },
    { key: 'kata', label: '가타카나' },
    { key: 'both', label: '나란히' }
  ];

  function key(script, group, row, col) { return script + '|' + group + '|' + row + '|' + col; }

  function buildIndex(list) {
    var idx = {};
    (list || []).forEach(function (item) {
      if (!item) return;
      idx[key(item.script, item.group, item.row, item.col)] = item;
    });
    return idx;
  }

  function buildRowCols(group, rowSpec) {
    if (rowSpec.solo) {
      var arr = new Array(group.cols.length).fill(null);
      arr[0] = rowSpec.solo;
      return arr;
    }
    return group.cols.slice();
  }

  function cellContent(hiraItem, kataItem, tab, showKo, showRomaji) {
    var frag = document.createDocumentFragment();
    var main = document.createElement('span');
    main.className = 'kana-cell-char';
    main.lang = 'ja';

    if (tab === 'both') {
      var line1 = document.createElement('span');
      line1.className = 'kana-cell-char-line';
      line1.textContent = hiraItem ? hiraItem.char : '';
      var line2 = document.createElement('span');
      line2.className = 'kana-cell-char-line';
      line2.textContent = kataItem ? kataItem.char : '';
      main.appendChild(line1);
      main.appendChild(line2);
    } else {
      var item = tab === 'kata' ? kataItem : hiraItem;
      main.textContent = item ? item.char : '';
    }
    frag.appendChild(main);

    var refItem = hiraItem || kataItem;
    if (refItem && (showKo || showRomaji)) {
      var sub = document.createElement('span');
      sub.className = 'kana-cell-sub';
      var parts = [];
      if (showKo) parts.push(refItem.ko);
      if (showRomaji) parts.push(refItem.romaji);
      sub.textContent = parts.join(' · ');
      frag.appendChild(sub);
    }
    return frag;
  }

  function renderGroup(group, idx, state) {
    var section = document.createElement('section');
    section.className = 'kana-group';
    var h2 = document.createElement('h2');
    h2.className = 'kana-group-title';
    h2.textContent = group.label;
    section.appendChild(h2);

    var grid = document.createElement('div');
    grid.className = 'kana-grid';
    grid.style.setProperty('--kana-cols', String(group.cols.length));

    group.rows.forEach(function (rowSpec) {
      var cols = buildRowCols(group, rowSpec);
      var labelItem = null;
      for (var i = 0; i < cols.length; i++) {
        if (!cols[i]) continue;
        labelItem = idx[key('hira', group.key, rowSpec.row, cols[i])] || idx[key('kata', group.key, rowSpec.row, cols[i])];
        if (labelItem) break;
      }
      var rowLabel = document.createElement('div');
      rowLabel.className = 'kana-row-label';
      rowLabel.lang = 'ja';
      rowLabel.textContent = labelItem ? (labelItem.char + '행') : (rowSpec.row + '행');
      grid.appendChild(rowLabel);

      cols.forEach(function (col) {
        if (!col) {
          var empty = document.createElement('div');
          empty.className = 'kana-cell empty';
          grid.appendChild(empty);
          return;
        }
        var hiraItem = idx[key('hira', group.key, rowSpec.row, col)];
        var kataItem = idx[key('kata', group.key, rowSpec.row, col)];
        var hasData = state.tab === 'kata' ? !!kataItem : (state.tab === 'both' ? (hiraItem || kataItem) : !!hiraItem);
        var cell = document.createElement('div');
        cell.className = 'kana-cell' + (hasData ? '' : ' empty');
        if (hasData) {
          cell.setAttribute('role', 'button');
          cell.setAttribute('tabindex', '0');
          var labelChar = (state.tab === 'kata' ? kataItem : hiraItem) || hiraItem || kataItem;
          cell.setAttribute('aria-label', (labelChar ? labelChar.char : '') + ' 자세히 보기');
          cell.setAttribute('data-group', group.key);
          cell.setAttribute('data-row', rowSpec.row);
          cell.setAttribute('data-col', col);
          cell.appendChild(cellContent(hiraItem, kataItem, state.tab, state.showKo, state.showRomaji));
        }
        grid.appendChild(cell);
      });
    });

    section.appendChild(grid);
    return section;
  }

  function openModal(idx, group, row, col, tab) {
    var modalRoot = document.getElementById('modal-root');
    if (!modalRoot) return;
    var hiraItem = idx[key('hira', group, row, col)];
    var kataItem = idx[key('kata', group, row, col)];
    var primary = (tab === 'kata' ? kataItem : hiraItem) || hiraItem || kataItem;
    if (!primary) return;
    var pair = primary === hiraItem ? kataItem : hiraItem;

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');

    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'modal-close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.appendChild(KanaApp.makeIcon('close'));

    var big = document.createElement('div');
    big.className = 'modal-char';
    big.lang = 'ja';
    big.textContent = primary.char;
    /* 스피커 버튼을 글자 오른쪽 옆에(PRD 3.6). 획순 버튼도 같은 자리에 더한다(PRD 3.7). */
    var bigSpeaker = KanaApp.ui.attachSpeaker(big, function () {
      KanaApp.tts.speakKana(primary);
    }, { ariaLabel: '소리 듣기' });
    var strokesBtn = KanaApp.makeIconButton('strokes', '획순 보기', 'btn-strokes');
    bigSpeaker.actions.appendChild(strokesBtn);

    var ko = document.createElement('div');
    ko.className = 'modal-ko';
    ko.textContent = primary.ko;

    var romaji = document.createElement('div');
    romaji.className = 'modal-romaji';
    romaji.textContent = primary.romaji;

    var pairRow = document.createElement('div');
    pairRow.className = 'modal-pair';
    if (pair) {
      var pairLabel = document.createElement('span');
      pairLabel.className = 'modal-pair-label';
      pairLabel.textContent = '짝 글자';
      var pairChar = document.createElement('span');
      pairChar.className = 'modal-pair-char';
      pairChar.lang = 'ja';
      pairChar.textContent = pair.char;
      pairRow.appendChild(pairLabel);
      pairRow.appendChild(pairChar);
    } else {
      pairRow.textContent = '짝 글자 없음';
    }

    var body = document.createElement('div');
    body.className = 'modal-body';
    dialog.appendChild(closeBtn);
    dialog.appendChild(body);

    overlay.appendChild(dialog);
    modalRoot.appendChild(overlay);

    /* ---------- 글자 보기 / 획순 보기 전환 ---------- */
    var strokeUI = null; /* { player, showingPair } */

    function destroyStrokeUI() {
      if (strokeUI) {
        strokeUI.player.destroy();
        strokeUI = null;
      }
      dialog.classList.remove('modal-dialog--wide');
    }

    function showCharView() {
      destroyStrokeUI();
      body.innerHTML = '';
      body.appendChild(bigSpeaker.anchor);
      body.appendChild(ko);
      body.appendChild(romaji);
      body.appendChild(pairRow);
    }

    function buildStrokeView() {
      dialog.classList.add('modal-dialog--wide');
      var wrap = document.createElement('div');
      wrap.className = 'stroke-view';

      var which = { showingPair: false };
      var seg = null;
      if (pair) {
        seg = KanaApp.ui.segmented('modal-stroke-which', [
          { value: 'primary', label: (primary.script === 'hira' ? '히라가나' : '가타카나') + ' ' + primary.char },
          { value: 'pair', label: (pair.script === 'hira' ? '히라가나' : '가타카나') + ' ' + pair.char }
        ], 'primary', function (v) {
          which.showingPair = (v === 'pair');
          rebuildPlayer();
        });
        seg.className += ' stroke-view-which';
        wrap.appendChild(seg);
      }

      var host = document.createElement('div');
      host.className = 'stroke-view-host';
      wrap.appendChild(host);

      var controls = document.createElement('div');
      controls.className = 'stroke-view-controls';
      var replayBtn = document.createElement('button');
      replayBtn.type = 'button';
      replayBtn.className = 'btn-secondary';
      replayBtn.textContent = '다시 보기';
      var numbersOn = true;
      var numChip = KanaApp.ui.chip('번호 표시', numbersOn, function (v) {
        numbersOn = v;
        if (strokeUI) strokeUI.player.setShowNumbers(v);
      });
      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'btn-secondary';
      backBtn.textContent = '글자로 돌아가기';
      controls.appendChild(replayBtn);
      controls.appendChild(numChip);
      controls.appendChild(backBtn);
      wrap.appendChild(controls);

      function rebuildPlayer() {
        if (strokeUI) { strokeUI.player.destroy(); strokeUI = null; }
        host.innerHTML = '';
        var target = which.showingPair ? pair : primary;
        var player = KanaApp.createStrokePlayer(target.char, { extraClass: 'stroke-player-modal', showNumbers: numbersOn });
        host.appendChild(player.container);
        strokeUI = { player: player, showingPair: which.showingPair };
        player.play();
      }
      rebuildPlayer();

      replayBtn.addEventListener('click', function () {
        if (strokeUI) strokeUI.player.replay();
      });
      backBtn.addEventListener('click', showCharView);

      return wrap;
    }

    function showStrokeView() {
      body.innerHTML = '';
      body.appendChild(buildStrokeView());
    }

    strokesBtn.addEventListener('click', showStrokeView);

    showCharView();

    function close() {
      KanaApp.tts.stop();
      destroyStrokeUI();
      document.removeEventListener('keydown', onKeydown);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKeydown(e) {
      if (e.key === 'Escape') close();
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', onKeydown);
  }

  function render(container) {
    var kanaList = (KanaApp.kana && KanaApp.kana.length) ? KanaApp.kana : [];
    var idx = buildIndex(kanaList);
    var state = {
      tab: KanaApp.store.get('chart.tab', 'hira'),
      showKo: KanaApp.store.get('chart.showKo', true),
      showRomaji: KanaApp.store.get('chart.showRomaji', false)
    };

    var root = document.createElement('div');
    root.className = 'chart-view view-fade';

    if (kanaList.length === 0) {
      var notice = document.createElement('p');
      notice.className = 'empty-notice';
      notice.textContent = '표시할 가나 데이터가 아직 없습니다. 데이터 준비 후 다시 열어주세요.';
      root.appendChild(notice);
      container.appendChild(root);
      return;
    }

    var body = document.createElement('div');
    body.className = 'chart-body';

    function renderBody() {
      body.innerHTML = '';
      GROUPS.forEach(function (group) {
        body.appendChild(renderGroup(group, idx, state));
      });
    }

    var tabs = document.createElement('div');
    tabs.className = 'chart-tabs';
    tabs.appendChild(KanaApp.ui.segmented('chart-tab', TAB_DEFS.map(function (t) {
      return { value: t.key, label: t.label };
    }), state.tab, function (v) {
      state.tab = v;
      KanaApp.store.set('chart.tab', v);
      renderBody();
    }));

    var toggles = document.createElement('div');
    toggles.className = 'chart-toggles';
    toggles.appendChild(KanaApp.ui.chip('한글 발음', state.showKo, function (v) {
      state.showKo = v; KanaApp.store.set('chart.showKo', v); renderBody();
    }));
    toggles.appendChild(KanaApp.ui.chip('로마자', state.showRomaji, function (v) {
      state.showRomaji = v; KanaApp.store.set('chart.showRomaji', v); renderBody();
    }));

    root.appendChild(tabs);
    root.appendChild(toggles);
    root.appendChild(body);
    container.appendChild(root);

    renderBody();

    function onBodyActivate(e) {
      var target = e.target;
      var cell = null;
      while (target && target !== body) {
        if (target.classList && target.classList.contains('kana-cell')) { cell = target; break; }
        target = target.parentNode;
      }
      if (!cell || cell.classList.contains('empty')) return;
      openModal(idx, cell.getAttribute('data-group'), cell.getAttribute('data-row'), cell.getAttribute('data-col'), state.tab);
    }
    function onBodyKeydown(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target && e.target.classList && e.target.classList.contains('kana-cell')) {
        e.preventDefault();
        onBodyActivate(e);
      }
    }
    body.addEventListener('click', onBodyActivate);
    body.addEventListener('keydown', onBodyKeydown);

    root._cleanup = function () {
      body.removeEventListener('click', onBodyActivate);
      body.removeEventListener('keydown', onBodyKeydown);
    };
    render._currentRoot = root;
  }

  KanaApp.views.chart = {
    title: '전체 보기',
    mount: function (container) { render(container); },
    unmount: function () {
      if (render._currentRoot && render._currentRoot._cleanup) render._currentRoot._cleanup();
      render._currentRoot = null;
      var modalRoot = document.getElementById('modal-root');
      if (modalRoot) modalRoot.innerHTML = '';
      KanaApp.tts.stop();
    }
  };
})();
