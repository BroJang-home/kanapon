/* 단어 외우기: 공용 카드 트레이너(js/trainer.js) 설정 */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  KanaApp.views.words = KanaApp.createCardTrainer({
    key: 'words',
    title: '단어 외우기',
    hasScriptSet: true,
    isSentence: false,
    getItems: function () { return KanaApp.words; },
    getCategories: function () { return KanaApp.wordCategories; },
    getSpeakText: function (item) { return item.jp; },
    emptyMessage: '표시할 단어 데이터가 아직 없습니다. 데이터 준비 후 다시 열어주세요.'
  });
})();
