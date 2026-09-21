/* KanaApp - 가나 데이터
 * 계약: docs/prd.md 4장. 표기 규칙: docs/prd.md 5장.
 * 클래식 스크립트(ES module 아님). window.KanaApp에 붙는다.
 *
 * KanaApp.kana     : 208개(스크립트당 104 = 기본 46 + 탁음 20 + 반탁음 5 + 요음 33)
 * KanaApp.kanaRows : 격자 표시용 행·단 순서
 */
(function (root) {
  'use strict';

  var App = (root.KanaApp = root.KanaApp || {});

  /* 단(col) 순서 */
  var COLS5 = ['a', 'i', 'u', 'e', 'o'];
  var COLS3 = ['a', 'u', 'o'];

  /* 셀 = [char, romaji, ko], 빈 칸 = null (や행의 い·え단, わ행의 い·う·え단)
   * 가타카나는 히라가나 코드포인트 + 0x60으로 만든다(ぁ-ゖ → ァ-ヶ). */
  var TABLE = [
    {
      group: 'basic',
      label: '기본 46자(청음)',
      cols: COLS5,
      colLabels: ['あ', 'い', 'う', 'え', 'お'],
      rows: [
        { id: 'a', cells: [['あ', 'a', '아'], ['い', 'i', '이'], ['う', 'u', '우'], ['え', 'e', '에'], ['お', 'o', '오']] },
        { id: 'k', cells: [['か', 'ka', '카'], ['き', 'ki', '키'], ['く', 'ku', '쿠'], ['け', 'ke', '케'], ['こ', 'ko', '코']] },
        { id: 's', cells: [['さ', 'sa', '사'], ['し', 'shi', '시'], ['す', 'su', '스'], ['せ', 'se', '세'], ['そ', 'so', '소']] },
        { id: 't', cells: [['た', 'ta', '타'], ['ち', 'chi', '치'], ['つ', 'tsu', '츠'], ['て', 'te', '테'], ['と', 'to', '토']] },
        { id: 'n', cells: [['な', 'na', '나'], ['に', 'ni', '니'], ['ぬ', 'nu', '누'], ['ね', 'ne', '네'], ['の', 'no', '노']] },
        { id: 'h', cells: [['は', 'ha', '하'], ['ひ', 'hi', '히'], ['ふ', 'fu', '후'], ['へ', 'he', '헤'], ['ほ', 'ho', '호']] },
        { id: 'm', cells: [['ま', 'ma', '마'], ['み', 'mi', '미'], ['む', 'mu', '무'], ['め', 'me', '메'], ['も', 'mo', '모']] },
        { id: 'y', cells: [['や', 'ya', '야'], null, ['ゆ', 'yu', '유'], null, ['よ', 'yo', '요']] },
        { id: 'r', cells: [['ら', 'ra', '라'], ['り', 'ri', '리'], ['る', 'ru', '루'], ['れ', 're', '레'], ['ろ', 'ro', '로']] },
        { id: 'w', cells: [['わ', 'wa', '와'], null, null, null, ['を', 'wo', '오']] },
        /* ん은 단(col)이 'n'인 별도 행. な행과 row id가 같으므로 반드시 row+col로 찾는다. */
        { id: 'n', key: 'basic-nn', label: 'ん', labelKata: 'ン', cols: ['n'], cells: [['ん', 'n', '응']] }
      ]
    },
    {
      group: 'dakuon',
      label: '탁음',
      cols: COLS5,
      colLabels: ['あ', 'い', 'う', 'え', 'お'],
      rows: [
        { id: 'g', cells: [['が', 'ga', '가'], ['ぎ', 'gi', '기'], ['ぐ', 'gu', '구'], ['げ', 'ge', '게'], ['ご', 'go', '고']] },
        { id: 'z', cells: [['ざ', 'za', '자'], ['じ', 'ji', '지'], ['ず', 'zu', '즈'], ['ぜ', 'ze', '제'], ['ぞ', 'zo', '조']] },
        /* ぢ/づ는 입력법 기준 romaji di/du로 구분한다(소리는 じ/ず와 같다). */
        { id: 'd', cells: [['だ', 'da', '다'], ['ぢ', 'di', '지'], ['づ', 'du', '즈'], ['で', 'de', '데'], ['ど', 'do', '도']] },
        { id: 'b', cells: [['ば', 'ba', '바'], ['び', 'bi', '비'], ['ぶ', 'bu', '부'], ['べ', 'be', '베'], ['ぼ', 'bo', '보']] }
      ]
    },
    {
      group: 'handakuon',
      label: '반탁음',
      cols: COLS5,
      colLabels: ['あ', 'い', 'う', 'え', 'お'],
      rows: [
        { id: 'p', cells: [['ぱ', 'pa', '파'], ['ぴ', 'pi', '피'], ['ぷ', 'pu', '푸'], ['ぺ', 'pe', '페'], ['ぽ', 'po', '포']] }
      ]
    },
    {
      group: 'yoon',
      label: '요음',
      cols: COLS3,
      colLabels: ['ゃ', 'ゅ', 'ょ'],
      rows: [
        { id: 'ky', cells: [['きゃ', 'kya', '캬'], ['きゅ', 'kyu', '큐'], ['きょ', 'kyo', '쿄']] },
        { id: 'sh', cells: [['しゃ', 'sha', '샤'], ['しゅ', 'shu', '슈'], ['しょ', 'sho', '쇼']] },
        { id: 'ch', cells: [['ちゃ', 'cha', '차'], ['ちゅ', 'chu', '추'], ['ちょ', 'cho', '초']] },
        { id: 'ny', cells: [['にゃ', 'nya', '냐'], ['にゅ', 'nyu', '뉴'], ['にょ', 'nyo', '뇨']] },
        { id: 'hy', cells: [['ひゃ', 'hya', '햐'], ['ひゅ', 'hyu', '휴'], ['ひょ', 'hyo', '효']] },
        { id: 'my', cells: [['みゃ', 'mya', '먀'], ['みゅ', 'myu', '뮤'], ['みょ', 'myo', '묘']] },
        { id: 'ry', cells: [['りゃ', 'rya', '랴'], ['りゅ', 'ryu', '류'], ['りょ', 'ryo', '료']] },
        { id: 'gy', cells: [['ぎゃ', 'gya', '갸'], ['ぎゅ', 'gyu', '규'], ['ぎょ', 'gyo', '교']] },
        { id: 'j', cells: [['じゃ', 'ja', '자'], ['じゅ', 'ju', '주'], ['じょ', 'jo', '조']] },
        { id: 'by', cells: [['びゃ', 'bya', '뱌'], ['びゅ', 'byu', '뷰'], ['びょ', 'byo', '뵤']] },
        { id: 'py', cells: [['ぴゃ', 'pya', '퍄'], ['ぴゅ', 'pyu', '퓨'], ['ぴょ', 'pyo', '표']] }
      ]
    }
  ];

  /* 히라가나 → 가타카나 (ぁ U+3041 ~ ゖ U+3096 → ァ U+30A1 ~ ヶ U+30F6) */
  function toKatakana(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      out += String.fromCharCode(c >= 0x3041 && c <= 0x3096 ? c + 0x60 : c);
    }
    return out;
  }

  var kana = [];
  var kanaRows = [];

  TABLE.forEach(function (g) {
    var rowsOut = [];

    g.rows.forEach(function (row) {
      var cols = row.cols || g.cols;
      var first = null;

      cols.forEach(function (col, i) {
        var cell = row.cells[i];
        if (!cell) { return; }
        if (!first) { first = cell[0]; }
        ['hira', 'kata'].forEach(function (script) {
          var ch = script === 'hira' ? cell[0] : toKatakana(cell[0]);
          kana.push({
            id: (script === 'hira' ? 'h-' : 'k-') + cell[1],
            script: script,
            group: g.group,
            row: row.id,
            col: col,
            char: ch,
            ko: cell[2],
            romaji: cell[1]
          });
        });
      });

      rowsOut.push({
        key: row.key || g.group + '-' + row.id,
        id: row.id,
        label: row.label || first + '행',
        labelKata: row.labelKata || toKatakana(first) + '행',
        cols: cols
      });
    });

    kanaRows.push({
      group: g.group,
      label: g.label,
      cols: g.cols,
      colLabels: g.colLabels,
      colLabelsKata: g.colLabels.map(toKatakana),
      rows: rowsOut
    });
  });

  /* 히라가나 104개를 먼저, 가타카나 104개를 뒤에 둔다(표시 순서는 kanaRows로 정한다). */
  App.kana = kana.filter(function (k) { return k.script === 'hira'; })
    .concat(kana.filter(function (k) { return k.script === 'kata'; }));
  App.kanaRows = kanaRows;

  /* 편의 조회: char → 글자 객체, romaji+script → 글자 객체 */
  App.kanaByChar = {};
  App.kana.forEach(function (k) { App.kanaByChar[k.char] = k; });

  if (typeof module === 'object' && module.exports) { module.exports = App; }
})(typeof window !== 'undefined' ? window : globalThis);
