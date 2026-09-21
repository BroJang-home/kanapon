/* 문장 익히기: 공용 카드 트레이너(js/trainer.js) 설정. 단어 외우기와 같은 방식이며
 * 세트(히라/가타) 선택은 없다(문장은 히라가나·가타카나가 자연스럽게 섞인다). */
(function () {
  'use strict';
  window.KanaApp = window.KanaApp || {};
  var KanaApp = window.KanaApp;

  KanaApp.views.sentences = KanaApp.createCardTrainer({
    key: 'sentences',
    title: '문장 익히기',
    hasScriptSet: false,
    isSentence: true,
    getItems: function () { return KanaApp.sentences; },
    getCategories: function () { return KanaApp.sentenceCategories; },
    getSpeakText: function (item) { return item.jp; },
    emptyMessage: '문장 데이터가 아직 없습니다. 데이터 준비 후 다시 열어주세요.'
  });
})();
