import { CharCategory } from '../types';
import { JIS_LEVEL_1_KANJI } from './jisLevel1';
import { JIS_LEVEL_2_KANJI } from './jisLevel2';

// 小学校各学年の配当漢字 (計1026字)
export const ELEMENTARY_GRADE_KANJI = {
  grade1: [
    '一', '右', '雨', '円', '王', '音', '下', '火', '花', '貝',
    '学', '気', '九', '休', '玉', '金', '空', '月', '犬', '見',
    '五', '口', '校', '左', '三', '山', '子', '四', '糸', '字',
    '耳', '七', '車', '手', '十', '出', '女', '小', '上', '森',
    '人', '水', '正', '生', '青', '夕', '石', '赤', '千', '川',
    '先', '早', '草', '足', '村', '大', '男', '竹', '中', '虫',
    '町', '天', '田', '土', '二', '日', '入', '年', '白', '八',
    '百', '文', '木', '本', '名', '目', '立', '力', '林', '六'
  ],
  grade2: [
    '引', '羽', '雲', '園', '遠', '何', '科', '夏', '家', '歌',
    '画', '回', '会', '海', '絵', '外', '角', '楽', '活', '間',
    '丸', '岩', '顔', '汽', '記', '帰', '弓', '牛', '魚', '京',
    '強', '教', '近', '兄', '形', '計', '元', '原', '戸', '古',
    '午', '後', '語', '工', '公', '広', '交', '光', '行', '考',
    '行', '高', '黄', '合', '谷', '国', '黒', '今', '才', '細',
    '作', '算', '止', '市', '矢', '姉', '思', '紙', '寺', '自',
    '時', '室', '社', '弱', '首', '秋', '週', '春', '書', '少',
    '場', '色', '食', '心', '新', '親', '図', '数', '西', '声',
    '星', '晴', '切', '雪', '船', '線', '前', '組', '走', '多',
    '太', '体', '台', '地', '池', '知', '茶', '昼', '長', '鳥',
    '朝', '直', '通', '弟', '店', '点', '電', '刀', '冬', '当',
    '東', '答', '頭', '同', '道', '読', '内', '南', '肉', '馬',
    '売', '買', '麦', '半', '番', '父', '風', '分', '聞', '米',
    '歩', '母', '方', '北', '毎', '妹', '万', '明', '鳴', '毛',
    '門', '夜', '野', '友', '用', '曜', '来', '里', '理', '話'
  ],
  grade3: [
    '悪', '安', '暗', '医', '委', '意', '育', '員', '院', '飲',
    '運', '泳', '駅', '央', '横', '屋', '温', '化', '界', '開',
    '階', '寒', '感', '漢', '館', '岸', '起', '期', '客', '究',
    '急', '級', '宮', '球', '去', '橋', '業', '曲', '局', '銀',
    '区', '苦', '具', '君', '係', '軽', '血', '決', '研', '県',
    '庫', '湖', '向', '幸', '港', '号', '根', '祭', '皿', '仕',
    '死', '使', '始', '指', '歯', '詩', '次', '事', '持', '式',
    '実', '写', '者', '主', '守', '取', '酒', '受', '州', '拾',
    '終', '習', '集', '住', '重', '宿', '所', '暑', '助', '昭',
    '消', '商', '章', '勝', '乗', '植', '申', '身', '神', '真',
    '深', '進', '世', '整', '昔', '全', '相', '送', '想', '息',
    '速', '族', '他', '打', '対', '待', '代', '第', '題', '炭',
    '短', '談', '着', '注', '柱', '丁', '帳', '調', '追', '定',
    '庭', '笛', '鉄', '転', '都', '度', '投', '豆', '島', '湯',
    '登', '等', '動', '童', '農', '波', '配', '倍', '箱', '畑',
    '発', '反', '坂', '板', '皮', '悲', '美', '鼻', '筆', '氷',
    '表', '秒', '病', '品', '負', '部', '服', '福', '物', '平',
    '返', '勉', '弁', '保', '歩', '面', '問', '役', '薬', '由',
    '油', '有', '遊', '予', '羊', '洋', '葉', '陽', '様', '落',
    '流', '旅', '両', '緑', '礼', '列', '練', '路', '和'
  ],
  grade4: [
    '愛', '案', '以', '衣', '位', '囲', '胃', '印', '英', '栄',
    '塩', '億', '加', '果', '貨', '課', '芽', '改', '械', '害',
    '街', '各', '覚', '完', '官', '管', '関', '観', '願', '希',
    '季', '旗', '器', '機', '議', '求', '泣', '救', '給', '挙',
    '漁', '共', '協', '鏡', '競', '極', '訓', '軍', '郡', '径',
    '型', '景', '芸', '欠', '結', '建', '健', '験', '固', '功',
    '好', '候', '航', '康', '告', '差', '菜', '最', '材', '昨',
    '札', '刷', '殺', '察', '参', '産', '散', '残', '士', '氏',
    '史', '司', '試', '児', '治', '辞', '失', '借', '種', '周',
    '祝', '順', '初', '松', '笑', '唱', '焼', '照', '城', '縄',
    '臣', '信', '清', '静', '席', '積', '折', '節', '説', '浅',
    '戦', '選', '然', '争', '倉', '巣', '束', '側', '続', '卒',
    '孫', '帯', '隊', '達', '単', '置', '仲', '貯', '兆', '腸',
    '低', '底', '停', '的', '典', '伝', '徒', '努', '灯', '堂',
    '働', '特', '得', '毒', '熱', '念', '敗', '梅', '博', '飯',
    '飛', '費', '必', '票', '標', '不', '夫', '付', '府', '副',
    '粉', '兵', '別', '辺', '変', '便', '包', '法', '望', '牧',
    '末', '満', '未', '脈', '民', '無', '約', '勇', '要', '養',
    '浴', '利', '陸', '良', '料', '量', '輪', '類', '令', '冷',
    '例', '歴', '連', '老', '労', '録'
  ],
  grade5: [
    '圧', '移', '因', '永', '営', '衛', '易', '益', '液', '演',
    '応', '往', '桜', '恩', '可', '仮', '価', '河', '過', '賀',
    '快', '解', '格', '確', '額', '刊', '幹', '慣', '眼', '基',
    '寄', '規', '技', '義', '逆', '久', '旧', '居', '許', '境',
    '均', '禁', '句', '群', '経', '潔', '件', '券', '険', '検',
    '限', '現', '減', '故', '個', '護', '効', '厚', '耕', '鉱',
    '構', '興', '講', '混', '査', '再', '災', '妻', '採', '際',
    '在', '財', '罪', '雑', '酸', '賛', '志', '支', '枝', '資',
    '飼', '示', '似', '識', '質', '舎', '謝', '授', '修', '述',
    '術', '準', '序', '招', '承', '証', '条', '状', '常', '情',
    '織', '職', '制', '性', '政', '勢', '精', '製', '税', '責',
    '績', '接', '設', '舌', '絶', '銭', '祖', '素', '総', '造',
    '像', '増', '則', '測', '属', '率', '損', '退', '貸', '態',
    '団', '断', '築', '張', '提', '程', '適', '敵', '統', '導',
    '銅', '徳', '独', '任', '燃', '能', '破', '犯', '判', '版',
    '比', '肥', '非', '備', '俵', '評', '貧', '布', '婦', '富',
    '武', '復', '複', '仏', '編', '弁', '保', '墓', '報', '豊',
    '防', '貿', '暴', '務', '夢', '迷', '綿', '輸', '余', '預',
    '容', '略', '留', '領'
  ],
  grade6: [
    '異', '遺', '域', '宇', '映', '延', '沿', '我', '灰', '拡',
    '革', '閣', '割', '株', '干', '巻', '看', '簡', '危', '揮',
    '机', '貴', '疑', '吸', '供', '胸', '郷', '勤', '筋', '系',
    '敬', '警', '劇', '激', '穴', '絹', '権', '憲', '源', '厳',
    '己', '呼', '誤', '后', '孝', '皇', '紅', '降', '鋼', '刻',
    '穀', '骨', '困', '砂', '座', '済', '裁', '策', '冊', '蚕',
    '至', '私', '姿', '視', '詞', '誌', '磁', '射', '捨', '尺',
    '若', '樹', '収', '宗', '就', '衆', '従', '縦', '縮', '熟',
    '純', '処', '署', '諸', '除', '将', '傷', '障', '城', '蒸',
    '針', '仁', '垂', '推', '寸', '盛', '聖', '誠', '宣', '専',
    '泉', '洗', '染', '銭', '善', '奏', '創', '宙', '忠', '著',
    '庁', '頂', '潮', '賃', '痛', '展', '討', '党', '糖', '届',
    '難', '乳', '認', '納', '脳', '派', '拝', '背', '肺', '俳',
    '班', '晩', '否', '批', '秘', '腹', '奮', '並', '陛', '閉',
    '片', '補', '暮', '宝', '訪', '亡', '忘', '棒', '枚', '幕',
    '密', '盟', '模', '訳', '郵', '優', '幼', '欲', '翌', '乱',
    '卵', '覧', '裏', '律', '臨', '朗', '論'
  ],
};

// かなペア対応テーブル（通常文字 ⇔ 拗音・促音小文字）
export const KANA_PAIRS: { [char: string]: { smallChar: string; smallUnicode: number; isSmall?: boolean; baseChar?: string; baseUnicode?: number } } = {
  // 平仮名 小文字対応
  'あ': { smallChar: 'ぁ', smallUnicode: 0x3041 },
  'い': { smallChar: 'ぃ', smallUnicode: 0x3043 },
  'う': { smallChar: 'ぅ', smallUnicode: 0x3045 },
  'え': { smallChar: 'ぇ', smallUnicode: 0x3047 },
  'お': { smallChar: 'ぉ', smallUnicode: 0x3049 },
  'つ': { smallChar: 'っ', smallUnicode: 0x3063 },
  'や': { smallChar: 'ゃ', smallUnicode: 0x3083 },
  'ゆ': { smallChar: 'ゅ', smallUnicode: 0x3085 },
  'よ': { smallChar: 'ょ', smallUnicode: 0x3087 },
  'わ': { smallChar: 'ゎ', smallUnicode: 0x308e },

  // 片仮名 小文字対応
  'ア': { smallChar: 'ァ', smallUnicode: 0x30a1 },
  'イ': { smallChar: 'ィ', smallUnicode: 0x30a3 },
  'ウ': { smallChar: 'ゥ', smallUnicode: 0x30a5 },
  'エ': { smallChar: 'ェ', smallUnicode: 0x30a7 },
  'オ': { smallChar: 'ォ', smallUnicode: 0x30a9 },
  'カ': { smallChar: 'ヵ', smallUnicode: 0x30f5 },
  'ケ': { smallChar: 'ヶ', smallUnicode: 0x30f6 },
  'ツ': { smallChar: 'ッ', smallUnicode: 0x30c3 },
  'ヤ': { smallChar: 'ャ', smallUnicode: 0x30e3 },
  'ユ': { smallChar: 'ュ', smallUnicode: 0x30e5 },
  'ヨ': { smallChar: 'ョ', smallUnicode: 0x30e7 },
  'ワ': { smallChar: 'ヮ', smallUnicode: 0x30ee },
};

// 逆引き用
export const SMALL_KANA_REVERSE: { [smallChar: string]: { baseChar: string; baseUnicode: number } } = {
  'ぁ': { baseChar: 'あ', baseUnicode: 0x3042 },
  'ぃ': { baseChar: 'い', baseUnicode: 0x3044 },
  'ぅ': { baseChar: 'う', baseUnicode: 0x3046 },
  'ぇ': { baseChar: 'え', baseUnicode: 0x3048 },
  'ぉ': { baseChar: 'お', baseUnicode: 0x304a },
  'っ': { baseChar: 'つ', baseUnicode: 0x3064 },
  'ゃ': { baseChar: 'や', baseUnicode: 0x3084 },
  'ゅ': { baseChar: 'ゆ', baseUnicode: 0x3086 },
  'ょ': { baseChar: 'よ', baseUnicode: 0x3088 },
  'ゎ': { baseChar: 'わ', baseUnicode: 0x308f },

  'ァ': { baseChar: 'ア', baseUnicode: 0x30a2 },
  'ィ': { baseChar: 'イ', baseUnicode: 0x30a4 },
  'ゥ': { baseChar: 'ウ', baseUnicode: 0x30a6 },
  'ェ': { baseChar: 'エ', baseUnicode: 0x30a8 },
  'ォ': { baseChar: 'オ', baseUnicode: 0x30aa },
  'ヵ': { baseChar: 'カ', baseUnicode: 0x30ab },
  'ヶ': { baseChar: 'ケ', baseUnicode: 0x30b1 },
  'ッ': { baseChar: 'ツ', baseUnicode: 0x30c4 },
  'ャ': { baseChar: 'ヤ', baseUnicode: 0x30e4 },
  'ュ': { baseChar: 'ユ', baseUnicode: 0x30e6 },
  'ョ': { baseChar: 'ヨ', baseUnicode: 0x30e8 },
  'ヮ': { baseChar: 'ワ', baseUnicode: 0x30ef },
};

// 縦書き用約物・記号の定義（OpenType vert / Unicode Vertical Presentation Forms）
export const VERTICAL_FORMS_LIST: { char: string; code: number; name: string; baseChar?: string }[] = [
  { char: '︱', code: 0xfe31, name: '縦書き長音符・ダッシュ (ー/―)', baseChar: 'ー' },
  { char: '︑', code: 0xfe11, name: '縦書き読点 (、)', baseChar: '、' },
  { char: '︒', code: 0xfe12, name: '縦書き句点 (。)', baseChar: '。' },
  { char: '﹁', code: 0xfe41, name: '縦書き鉤括弧 始 (「)', baseChar: '「' },
  { char: '﹂', code: 0xfe42, name: '縦書き鉤括弧 終 (」)', baseChar: '」' },
  { char: '﹃', code: 0xfe43, name: '縦書き二重鉤括弧 始 (『)', baseChar: '『' },
  { char: '﹄', code: 0xfe44, name: '縦書き二重鉤括弧 終 (』)', baseChar: '』' },
  { char: '︵', code: 0xfe35, name: '縦書き丸括弧 始 (（)', baseChar: '（' },
  { char: '︶', code: 0xfe36, name: '縦書き丸括弧 終 (）)', baseChar: '）' },
  { char: '︻', code: 0xfe3b, name: '縦書き隅付き括弧 始 (【)', baseChar: '【' },
  { char: '︼', code: 0xfe3c, name: '縦書き隅付き括弧 終 (】)', baseChar: '】' },
  { char: '︹', code: 0xfe39, name: '縦書き亀甲括弧 始 (〔)', baseChar: '〔' },
  { char: '︺', code: 0xfe3a, name: '縦書き亀甲括弧 終 (〕)', baseChar: '〕' },
  { char: '︿', code: 0xfe3f, name: '縦書き山括弧 始 (〈)', baseChar: '〈' },
  { char: '﹀', code: 0xfe40, name: '縦書き山括弧 終 (〉)', baseChar: '〉' },
  { char: '︽', code: 0xfe3d, name: '縦書き二重山括弧 始 (《)', baseChar: '《' },
  { char: '︾', code: 0xfe3e, name: '縦書き二重山括弧 終 (》)', baseChar: '》' },
  { char: '︙', code: 0xfe19, name: '縦書き三点リーダー (…)', baseChar: '…' },
  { char: '︓', code: 0xfe13, name: '縦書きコロン (：)', baseChar: '：' },
  { char: '︔', code: 0xfe14, name: '縦書きセミコロン (；)', baseChar: '；' },
  { char: '︕', code: 0xfe15, name: '縦書き感嘆符 (!/！)', baseChar: '！' },
  { char: '︖', code: 0xfe16, name: '縦書き疑問符 (?/？)', baseChar: '？' },
  { char: '︴', code: 0xfe4f, name: '縦書き波ダッシュ (〜)', baseChar: '〜' },
];

// 半角英数字
const BASIC_LATIN_ALNUM = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T',
  'U', 'V', 'W', 'X', 'Y', 'Z',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z'
];

// 半角記号 (ASCII Symbols)
const ASCII_SYMBOLS = [
  ' ', // Space (U+0020)
  '!', '"', '#', '$', '%', '&', '\'', '(', ')', '*', '+', ',', '-', '.', '/',
  ':', ';', '<', '=', '>', '?', '@',
  '[', '\\', ']', '^', '_', '`',
  '{', '|', '}', '~'
];

// 全角英数字 (Full-width alphanumeric)
const FULLWIDTH_ALNUM = [
  '０', '１', '２', '３', '４', '５', '６', '７', '８', '９',
  'Ａ', 'Ｂ', 'Ｃ', 'Ｄ', 'Ｅ', 'Ｆ', 'Ｇ', 'Ｈ', 'Ｉ', 'Ｊ',
  'Ｋ', 'Ｌ', 'Ｍ', 'Ｎ', 'Ｏ', 'Ｐ', 'Ｑ', 'Ｒ', 'Ｓ', 'Ｔ',
  'Ｕ', 'Ｖ', 'Ｗ', 'Ｘ', 'Ｙ', 'Ｚ',
  'ａ', 'ｂ', 'ｃ', 'ｄ', 'ｅ', 'ｆ', 'ｇ', 'ｈ', 'ｉ', 'ｊ',
  'ｋ', 'ｌ', 'ｍ', 'ｎ', 'ｏ', 'ｐ', 'ｑ', 'ｒ', 'ｓ', 'ｔ',
  'ｕ', 'ｖ', 'ｗ', 'ｘ', 'ｙ', 'ｚ'
];

// 和文約物・全角記号（全角空白 U+3000 を先頭に明示）
const JAPANESE_SYMBOLS = [
  '　', // 全角空白 (U+3000 / Ideographic Space)
  '、', '。', '・', '「', '」', '『', '』', '（', '）', '【', '】', '〔', '〕', '〈', '〉', '《', '》',
  '〜', '…', '―', '–', '─', '│', '：', '；', '？', '！', '￥', '＄', '￠', '￡', '％', '＃', '＆',
  '＊', '＠', '§', '¶', '†', '‡', '℃', '℉', '〒', '々', '〇', '仝', '〆', 'ー',
  '★', '☆', '◆', '◇', '▲', '△', '▼', '▽', '●', '○', '■', '□', '♪', '♫', '♥', '♦', '♠', '♣',
  '→', '←', '↑', '↓', '⇒', '⇔', '＋', '−', '±', '×', '÷', '＝', '≠', '＜', '＞', '≦', '≧', '∞'
];

// カテゴリ定義（ローマ字・記号を明確に分離、JIS第1水準2965字・第2水準3390字を完全網羅）
export const UNICODE_CATEGORIES: CharCategory[] = [
  {
    id: 'hiragana',
    name: 'ひらがな (86字)',
    nameEn: 'Hiragana',
    range: [0x3041, 0x3096],
  },
  {
    id: 'katakana',
    name: 'カタカナ (90字)',
    nameEn: 'Katakana',
    range: [0x30a1, 0x30fa],
  },
  {
    id: 'basic_latin_alnum',
    name: '半角英数字 (62字)',
    nameEn: 'Basic Latin (A-Z, 0-9)',
    chars: BASIC_LATIN_ALNUM,
  },
  {
    id: 'ascii_symbols',
    name: '半角記号 (33字)',
    nameEn: 'ASCII Punctuation & Symbols',
    chars: ASCII_SYMBOLS,
  },
  {
    id: 'fullwidth_alnum',
    name: '全角英数字 (62字)',
    nameEn: 'Full-width Alphanumeric',
    chars: FULLWIDTH_ALNUM,
  },
  {
    id: 'symbols',
    name: '和文約物・記号 (全角空白等)',
    nameEn: 'Japanese Symbols & Fullwidth Space',
    chars: JAPANESE_SYMBOLS,
  },
  {
    id: 'vertical_forms',
    name: '縦書き用約物 (vert/vrt2)',
    nameEn: 'Vertical Presentation Forms',
    charList: VERTICAL_FORMS_LIST,
  },
  // 小学校学年別漢字 (計1,026字)
  {
    id: 'grade1',
    name: '小学1年 (80字)',
    nameEn: 'Grade 1 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade1,
  },
  {
    id: 'grade2',
    name: '小学2年 (160字)',
    nameEn: 'Grade 2 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade2,
  },
  {
    id: 'grade3',
    name: '小学3年 (200字)',
    nameEn: 'Grade 3 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade3,
  },
  {
    id: 'grade4',
    name: '小学4年 (202字)',
    nameEn: 'Grade 4 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade4,
  },
  {
    id: 'grade5',
    name: '小学5年 (193字)',
    nameEn: 'Grade 5 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade5,
  },
  {
    id: 'grade6',
    name: '小学6年 (191字)',
    nameEn: 'Grade 6 Kanji',
    chars: ELEMENTARY_GRADE_KANJI.grade6,
  },
  // JIS水準別漢字 (第1水準 全2,965字 / 第2水準 全3,390字)
  {
    id: 'jis_1',
    name: 'JIS第1水準 (2,965字 全字)',
    nameEn: 'JIS Level 1 Kanji (2,965 chars)',
    chars: JIS_LEVEL_1_KANJI,
  },
  {
    id: 'jis_2',
    name: 'JIS第2水準 (3,390字 全字)',
    nameEn: 'JIS Level 2 Kanji (3,390 chars)',
    chars: JIS_LEVEL_2_KANJI,
  },
  {
    id: 'halfwidth',
    name: '半角カタカナ',
    nameEn: 'Half-width Katakana',
    range: [0xff61, 0xff9f],
  },
  {
    id: 'gaiji',
    name: '外字 (私用領域)',
    nameEn: 'Private Use Area (Gaiji)',
    range: [0xe000, 0xe03f],
  },
];

/**
 * Get characters list for a category
 */
export function getCategoryCharList(category: CharCategory): { char: string; code: number; name?: string }[] {
  if (category.charList) {
    return category.charList;
  }

  if (category.chars) {
    return category.chars.map((char) => {
      const code = char.charCodeAt(0);
      let name = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
      if (code === 0x3000) {
        name = '全角空白 (U+3000)';
      } else if (code === 0x0020) {
        name = '半角空白 (U+0020)';
      }
      return {
        char,
        code,
        name,
      };
    });
  }

  if (category.range) {
    const [start, end] = category.range;
    const list = [];
    for (let code = start; code <= end; code++) {
      const char = String.fromCharCode(code);
      list.push({
        char,
        code,
        name: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
      });
    }
    return list;
  }

  return [];
}
