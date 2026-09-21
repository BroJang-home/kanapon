/* 메인 화면: 행 목록(전체 보기/문자/단어/문장) + 오늘의 글자·단어 (PRD 3.1)
 * 시안 다(かなノート)의 리스트 중심 구조를 따른다. 이 화면에서는 공용 상단 바를
 * 숨기고(html.is-home), 제목 줄 오른쪽에 설정 버튼을 둔다. */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  var CARDS = [
    {
      hash: '#/chart', glyph: 'あア', glyphSmall: true, title: '전체 보기',
      desc: '오십음도·탁음·요음을 한눈에 봅니다.',
      badge: function () { return ((KanaApp.kana && KanaApp.kana.length) || 0) + '자'; }
    },
    {
      hash: '#/flash', glyph: 'か', title: '문자 외우기',
      desc: '무작위 낱글자를 소리 내 읽어봅니다.',
      badge: function () { return ((KanaApp.kana && KanaApp.kana.length) || 0) + '자'; }
    },
    {
      hash: '#/words', glyph: 'ことば', glyphSmall: true, title: '단어 외우기',
      desc: '가나로 된 쉬운 단어를 카드로 익힙니다.',
      badge: function () { return ((KanaApp.words && KanaApp.words.length) || 0) + '개'; }
    },
    {
      hash: '#/sentences', glyph: 'ぶん', title: '문장 익히기',
      desc: '짧은 문장을 카드로 소리 내 읽어봅니다.',
      badge: function () {
        var n = (KanaApp.sentences && KanaApp.sentences.length) || 0;
        return n > 0 ? n + '개' : '준비 중';
      }
    }
  ];

  function pickRandom(list) {
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function buildTodayChar() {
    var row = document.createElement('div');
    row.className = 'today-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    var item = pickRandom(KanaApp.kana);

    var jp = document.createElement('p');
    jp.className = 'today-jp';
    jp.lang = 'ja';
    jp.textContent = item ? item.char : '·';

    var body = document.createElement('div');
    body.className = 'today-body';
    var eyebrow = document.createElement('span');
    eyebrow.className = 'today-eyebrow';
    eyebrow.textContent = '오늘의 글자';
    body.appendChild(eyebrow);

    if (!item) {
      row.appendChild(jp);
      var empty = document.createElement('span');
      empty.className = 'row-desc';
      empty.textContent = '데이터 준비 중';
      body.appendChild(empty);
      row.appendChild(body);
      return row;
    }

    var fields = document.createElement('div');
    fields.className = 'today-fields';
    var koSlot = KanaApp.ui.fieldSlot('발음', item.ko, 'card-ko');
    fields.appendChild(koSlot);
    body.appendChild(fields);

    row.appendChild(jp);
    row.appendChild(body);

    var speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'btn-speak';
    speakBtn.setAttribute('aria-label', '소리 듣기');
    speakBtn.appendChild(KanaApp.makeIcon('speak'));
    speakBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      KanaApp.tts.speakKana(item);
    });
    row.appendChild(speakBtn);

    function reveal() { koSlot.classList.remove('blank'); }
    row.addEventListener('click', function () {
      if (koSlot.classList.contains('blank')) { reveal(); return; }
      KanaApp.tts.speakKana(item);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
    });

    return row;
  }

  function buildTodayWord() {
    var row = document.createElement('div');
    row.className = 'today-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');

    var item = pickRandom(KanaApp.words);

    var jp = document.createElement('p');
    jp.className = 'today-jp' + (item && item.jp && item.jp.length > 4 ? ' is-long' : '');
    jp.lang = 'ja';
    jp.textContent = item ? item.jp : '·';

    var body = document.createElement('div');
    body.className = 'today-body';
    var eyebrow = document.createElement('span');
    eyebrow.className = 'today-eyebrow';
    eyebrow.textContent = '오늘의 단어';
    body.appendChild(eyebrow);

    if (!item) {
      row.appendChild(jp);
      var empty = document.createElement('span');
      empty.className = 'row-desc';
      empty.textContent = '데이터 준비 중';
      body.appendChild(empty);
      row.appendChild(body);
      return row;
    }

    var fields = document.createElement('div');
    fields.className = 'today-fields';
    var koSlot = KanaApp.ui.fieldSlot('발음', item.ko, 'card-ko');
    var meaningSlot = KanaApp.ui.fieldSlot('뜻', item.meaning, 'card-meaning');
    fields.appendChild(koSlot);
    fields.appendChild(meaningSlot);
    body.appendChild(fields);

    row.appendChild(jp);
    row.appendChild(body);

    var speakBtn = document.createElement('button');
    speakBtn.type = 'button';
    speakBtn.className = 'btn-speak';
    speakBtn.setAttribute('aria-label', '소리 듣기');
    speakBtn.appendChild(KanaApp.makeIcon('speak'));
    speakBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      KanaApp.tts.speakOrNotify(item.jp);
    });
    row.appendChild(speakBtn);

    function reveal() {
      koSlot.classList.remove('blank');
      meaningSlot.classList.remove('blank');
    }
    row.addEventListener('click', function () {
      if (koSlot.classList.contains('blank')) { reveal(); return; }
      KanaApp.tts.speakOrNotify(item.jp);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
    });

    return row;
  }

  function render(container) {
    var wrap = document.createElement('div');
    wrap.className = 'home-view view-fade';

    var title = document.createElement('div');
    title.className = 'home-title';
    var h2 = document.createElement('h2');
    h2.textContent = '카나퐁';
    var p = document.createElement('p');
    p.textContent = '히라가나·가타카나와 쉬운 단어·문장을 익혀요.';
    var titleText = document.createElement('div');
    titleText.className = 'home-title-text';
    titleText.appendChild(h2);
    titleText.appendChild(p);
    title.appendChild(titleText);
    var gear = KanaApp.makeIconButton('gear', '설정');
    gear.classList.add('home-settings-btn');
    gear.addEventListener('click', function () { KanaApp.router.navigate('#/settings'); });
    title.appendChild(gear);
    wrap.appendChild(title);

    var menuTitle = document.createElement('p');
    menuTitle.className = 'home-section-title';
    menuTitle.textContent = '학습';
    wrap.appendChild(menuTitle);

    var menuList = KanaApp.ui.rowList();
    CARDS.forEach(function (card) {
      menuList.appendChild(KanaApp.ui.row({
        href: card.hash,
        glyph: card.glyph,
        glyphSmall: card.glyphSmall,
        title: card.title,
        desc: card.desc,
        meta: card.badge(),
        chevron: true,
        ariaLabel: card.title + ' 이동'
      }));
    });
    wrap.appendChild(menuList);

    var todayTitle = document.createElement('p');
    todayTitle.className = 'home-section-title';
    todayTitle.textContent = '오늘의';
    wrap.appendChild(todayTitle);

    var todayList = KanaApp.ui.rowList();
    todayList.appendChild(buildTodayChar());
    todayList.appendChild(buildTodayWord());
    wrap.appendChild(todayList);

    var footer = document.createElement('p');
    footer.className = 'home-footer-note';
    footer.textContent = '오프라인에서도 쓸 수 있어요 · 홈 화면에 추가해 두면 더 편해요.';
    wrap.appendChild(footer);

    container.appendChild(wrap);
  }

  KanaApp.views.home = {
    title: '카나퐁',
    mount: function (container) {
      /* 메인에서는 공용 상단 바를 숨기고, 제목 줄 오른쪽에 설정 버튼을 둔다 */
      document.documentElement.classList.add('is-home');
      render(container);
    },
    unmount: function () {
      KanaApp.tts.stop();
      document.documentElement.classList.remove('is-home');
    }
  };
})();
