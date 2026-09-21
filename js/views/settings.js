/* 설정 화면 (#/settings, PRD 3.10). 메인 상단 설정 버튼으로 들어온다.
 * 뒤로/홈은 메인(#/)으로 돌아간다(라우터 기본 동작, 별도 처리 불필요). */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  function render(container) {
    var wrap = document.createElement('div');
    wrap.className = 'settings-page-view view-fade';

    var list = KanaApp.ui.rowList();

    /* 테마: 라이트/다크 세그먼트 컨트롤 */
    var themeSegmented = KanaApp.ui.segmented('settings-theme', [
      { value: 'light', label: '라이트' },
      { value: 'dark', label: '다크' }
    ], KanaApp.theme.get(), function (v) { KanaApp.theme.set(v); });
    themeSegmented.style.minWidth = '160px';

    list.appendChild(KanaApp.ui.row({
      title: '테마',
      control: themeSegmented
    }));

    /* 정보·출처로 이동 */
    list.appendChild(KanaApp.ui.row({
      href: '#/about',
      title: '정보·출처',
      desc: '어휘·문장 기준 자료, 저작자 표시',
      chevron: true
    }));

    /* 앱 버전(정보 표시용, 이동 없음) */
    list.appendChild(KanaApp.ui.row({
      title: '앱 버전',
      meta: 'v' + KanaApp.version
    }));

    wrap.appendChild(list);
    container.appendChild(wrap);
  }

  KanaApp.views.settings = {
    title: '설정',
    mount: function (container) { render(container); },
    unmount: function () {}
  };
})();
