/* 정보·출처 화면 (#/about, PRD 3.10). 메인 하단 링크로 들어온다.
 * 여기 적힌 자료 요약은 docs/sources.md를 참고해 사람이 읽기 쉽게 옮긴 것이다. */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  var SOURCES = [
    {
      name: 'いろどり 生活の日本語(생활의 일본어)',
      publisher: '국제교류기금(The Japan Foundation)',
      url: 'https://www.irodori.jpf.go.jp/',
      note: '단어의 범위와 문장의 장면 구성(쇼핑·식당·교통 등)을 정하는 1차 기준으로 썼습니다.'
    },
    {
      name: 'まるごと 日本のことばと文化(일본의 말과 문화)',
      publisher: '국제교류기금 일본어국제센터',
      url: 'https://www.marugoto.jpf.go.jp/',
      note: 'A1~A2 구간의 화제 순서(자기소개→일상→외식→외출→사람 사귀기)를 참고했습니다.'
    },
    {
      name: '일본어능력시험(JLPT) 인정의 기준',
      publisher: '국제교류기금 · 일본국제교육지원협회',
      url: 'https://www.jlpt.jp/about/levelsummary.html',
      note: '난이도 2~4의 눈금(구 4급≈N5, 구 3급≈N4, 그 위≈N3)으로만 참고했습니다.'
    }
  ];

  function section(titleText) {
    var sec = document.createElement('section');
    sec.className = 'about-section';
    var h2 = document.createElement('h2');
    h2.className = 'about-section-title';
    h2.textContent = titleText;
    sec.appendChild(h2);
    return sec;
  }

  function paragraph(text, className) {
    var p = document.createElement('p');
    p.className = className || 'about-text';
    p.textContent = text;
    return p;
  }

  function externalLink(url, text) {
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = text || url;
    return a;
  }

  function render(container) {
    var wrap = document.createElement('div');
    wrap.className = 'about-view view-fade';

    var intro = section('이 앱은');
    intro.appendChild(paragraph(
      '히라가나·가타카나와 일상 단어·문장을 카드로 반복해서 익히는 개인용 학습 앱입니다. ' +
      '서버 없이 기기 안에서만 동작하고, 오프라인에서도 쓸 수 있어요.'
    ));
    wrap.appendChild(intro);

    var srcSection = section('어휘·문장 기준 자료');
    srcSection.appendChild(paragraph(
      '단어·문장의 범위와 장면 구성을 정할 때 참고한 자료입니다. ' +
      '교재의 문장·설명을 그대로 옮기지 않았고, 이 앱의 문장은 모두 직접 썼습니다.'
    ));
    var list = document.createElement('ul');
    list.className = 'about-source-list';
    SOURCES.forEach(function (s) {
      var li = document.createElement('li');
      li.className = 'about-source-item';

      var head = document.createElement('p');
      head.className = 'about-source-head';
      var strong = document.createElement('strong');
      strong.textContent = s.name;
      head.appendChild(strong);
      head.appendChild(document.createTextNode(' · ' + s.publisher));
      li.appendChild(head);

      li.appendChild(paragraph(s.note, 'about-source-note'));

      var linkP = document.createElement('p');
      linkP.className = 'about-source-link-line';
      linkP.appendChild(externalLink(s.url));
      li.appendChild(linkP);

      list.appendChild(li);
    });
    srcSection.appendChild(list);
    wrap.appendChild(srcSection);

    var strokeSection = section('획순 데이터');
    var strokeP = document.createElement('p');
    strokeP.className = 'about-text';
    strokeP.appendChild(document.createTextNode('가나 글자의 획순 좌표는 '));
    strokeP.appendChild(externalLink('https://kanjivg.tagaini.net', 'KanjiVG'));
    strokeP.appendChild(document.createTextNode('(© Ulrich Apel)에서 가나 부분만 뽑아 다듬었습니다. '));
    strokeP.appendChild(externalLink('https://creativecommons.org/licenses/by-sa/3.0/', 'CC BY-SA 3.0'));
    strokeP.appendChild(document.createTextNode(' 라이선스를 따르며, 저작자 표시와 동일조건을 유지합니다.'));
    strokeSection.appendChild(strokeP);
    wrap.appendChild(strokeSection);

    var soundSection = section('소리');
    soundSection.appendChild(paragraph(
      '녹음한 음성 파일 없이 기기에 설치된 음성 합성(TTS, speechSynthesis)을 사용합니다. ' +
      '일본어(ja-JP) 음성이 없는 기기에서는 스피커 버튼을 누르면 설치 방법을 안내합니다.'
    ));
    wrap.appendChild(soundSection);

    var fontSection = section('글꼴 라이선스');
    fontSection.appendChild(paragraph(
      '가나(히라가나·가타카나)에는 Zen Maru Gothic, 한글·UI에는 Pretendard를 씁니다. ' +
      '두 글꼴 모두 SIL Open Font License 1.1이며, 원문 라이선스 파일은 이 앱을 내려받은 ' +
      '자리의 fonts/LICENSES.md(그리고 같은 폴더의 LICENSE-*.txt)에 그대로 들어 있습니다.'
    ));
    wrap.appendChild(fontSection);

    container.appendChild(wrap);
  }

  KanaApp.views.about = {
    title: '정보·출처',
    mount: function (container) { render(container); },
    unmount: function () {}
  };
})();
