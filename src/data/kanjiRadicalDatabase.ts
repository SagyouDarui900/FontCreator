/**
 * Kanji Radical Database (部首別漢字データベース v2.0)
 * Comprehensive mapping of Japanese Radicals (Kangxi 214 & 偏旁冠脚) to Joyo & JIS Level 1 / Level 2 Kanji.
 */

import { KANGXI_214_RADICALS } from './kangxi214Radicals';

export interface RadicalEntry {
  id: string;
  char: string;
  name: string;
  reading: string;
  category: 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'tare' | 'nyo' | 'kamae' | 'basic';
  categoryName: string;
  strokes: number;
  description: string;
  kanjiList: string[]; // Representative Joyo / JIS Kanji containing this radical
}

export const KANJI_RADICAL_CATEGORIES: { id: string; label: string; description: string }[] = [
  { id: 'all', label: 'すべて', description: '全部首・常用漢字・JIS第一水準 (康煕214部首完全対応)' },
  { id: 'kangxi', label: '康煕214部首', description: '康煕字典 全214部首 (1画〜17画)' },
  { id: 'hen', label: '偏 (へん)', description: '左側に位置する部首 (にんべん・さんずい・きへん 等)' },
  { id: 'tsukuri', label: '旁 (つくり)', description: '右側に位置する部首 (りっとう・のぶん・おおがい 等)' },
  { id: 'kanmuri', label: '冠 (かんむり)', description: '上部に位置する部首 (くさかんむり・うかんむり・たけかんむり 等)' },
  { id: 'ashi', label: '脚 (あし)', description: '下部に位置する部首 (れっか・ひとあし・したごころ 等)' },
  { id: 'tare', label: '垂 (たれ)', description: '上から左下を囲む部首 (まだれ・やまいだれ・がんだれ 等)' },
  { id: 'nyo', label: '繞 (にょう)', description: '左から下を囲む部首 (しんにょう・えんにょう・そうにょう 等)' },
  { id: 'kamae', label: '構 (かまえ)', description: '四方または三方を囲む部首 (くにがまえ・もんがまえ・行がまえ 等)' },
  { id: 'basic', label: '筆画・基本', description: '基本ストローク・点・払い・幾何学要素' },
];

function uniqueList(list: string[]): string[] {
  return Array.from(new Set(list));
}

const BASE_RADICAL_KANJI_DATABASE: RadicalEntry[] = [
  // ==================== 偏 (HEN) ====================
  {
    id: 'rad_ninben',
    char: '亻',
    name: 'にんべん (人偏)',
    reading: 'ジン',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 2,
    description: '人・人格・身分・行為・人間の状態に関係する漢字',
    kanjiList: uniqueList([
      '休', '作', '体', '信', '化', '仕', '代', '他', '件', '任', '伝', '似', '位', '住', '低', '何',
      '保', '使', '便', '借', '値', '倍', '候', '個', '停', '健', '側', '偉', '備', '働', '像', '催',
      '傷', '優', '億', '儒', '傾', '儀', '伺', '佳', '依', '侠', '侍', '侮', '促', '俊', '俗', '侶',
      '俘', '修', '俵', '倶', '倣', '倫', '倭', '偏', '傀', '僻', '僧', '僚', '傑', '僅', '僕', '儀',
      '億', '償', '優'
    ])
  },
  {
    id: 'rad_sanzui',
    char: '氵',
    name: 'さんずい (三水)',
    reading: 'スイ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '水・河川・海洋・液体・気象・流動に関係する漢字',
    kanjiList: uniqueList([
      '汁', '汗', '汚', '池', '決', '汽', '油', '治', '沼', '沿', '況', '泉', '泊', '波', '泣', '注',
      '泳', '洋', '洗', '活', '派', '流', '消', '海', '浅', '清', '渇', '済', '渡', '港', '温', '湯',
      '湾', '満', '源', '潮', '激', '濁', '濃', '滅', '演', '漢', '漁', '漂', '潤', '澄', '潜', '潟',
      '洞', '津', '沸', '泡', '泥', '浩', '浪', '涙', '浸', '涯', '液', '涼', '淳', '淫', '渦', '測',
      '渾', '滋', '湿', '滑', '滞', '滴', '漁', '漏', '漂', '漆', '漉', '漏', '漫', '潔', '潤', '潮',
      '澁', '澤', '澹', '激', '濁', '濃'
    ])
  },
  {
    id: 'rad_kihen',
    char: '木',
    name: 'きへん (木偏)',
    reading: 'モク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '樹木・木材・木工品・植物に関係する漢字',
    kanjiList: uniqueList([
      '木', '机', '村', '札', '材', '杉', '析', '杯', '杖', '松', '板', '枚', '枝', '枠', '枢', '枯',
      '架', '柄', '柱', '柳', '査', '栃', '栓', '校', '根', '株', '核', '格', '梅', '極', '概', '構',
      '様', '標', '模', '権', '横', '樹', '橋', '機', '欄', '植', '検', '業', '棺', '楓', '楠', '棟',
      '梢', '椿', '楊', '楼', '榜', '槙', '樋', '樺', '橡', '朴', '杏', '枕', '枠', '枢', '杭', '柿'
    ])
  },
  {
    id: 'rad_tehen',
    char: '扌',
    name: 'てへん (手偏)',
    reading: 'シュ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '手・手の動作・操作・技・武術に関係する漢字',
    kanjiList: uniqueList([
      '打', '払', '扱', '扶', '批', '技', '投', '抗', '折', '抜', '択', '抱', '押', '拓', '招', '抹',
      '拙', '担', '拐', '拒', '拡', '拘', '拾', '持', '指', '按', '挑', '挙', '挟', '捜', '振', '挿',
      '捕', '掛', '捨', '掃', '授', '排', '掘', '探', '接', '控', '推', '措', '掲', '描', '提', '揚',
      '換', '握', '援', '揺', '損', '搬', '携', '搾', '摘', '摩', '撤', '撲', '操', '擦', '擬', '支',
      '抄', '抗', '抑', '把', '捉', '捏', '掠', '据', '捲', '捷', '捺', '揃', '掴', '揉'
    ])
  },
  {
    id: 'rad_gonben',
    char: '言',
    name: 'ごんべん (言偏)',
    reading: 'ゲン',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '言葉・発言・言語・記述・コミュニケーションに関係する漢字',
    kanjiList: uniqueList([
      '計', '記', '訓', '託', '討', '訪', '設', '許', '訳', '訴', '診', '証', '詐', '評', '詞', '詠',
      '話', '試', '詩', '詰', '詳', '誌', '誇', '認', '誠', '誓', '誕', '誘', '語', '説', '読', '課',
      '誹', '調', '談', '請', '論', '諸', '諾', '謀', '謁', '謄', '謙', '謝', '謹', '識', '譜', '警',
      '議', '譲', '讃', '讚', '訂', '訃', '訟', '訣', '詣', '詭', '詮', '詫', '該', '諮', '謡'
    ])
  },
  {
    id: 'rad_itohen',
    char: '糸',
    name: 'いとへん (糸偏)',
    reading: 'シ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 6,
    description: '糸・繊維・織物・連続・関係・結びつきに関係する漢字',
    kanjiList: uniqueList([
      '系', '約', '級', '紀', '納', '紙', '紋', '純', '紐', '紡', '紛', '紋', '細', '紳', '組', '終',
      '経', '結', '絞', '絡', '給', '統', '絵', '絶', '絹', '継', '続', '維', '網', '綿', '緊', '総',
      '緑', '緒', '線', '編', '緩', '締', '鍛', '緯', '練', '縁', '縄', '縛', '縫', '縮', '績', '織',
      '繕', '繭', '繰', '糾', '紆', '紊', '絨', '絢', '綜', '綻', '緻', '緯', '縒', '縛'
    ])
  },
  {
    id: 'rad_tsuchihen',
    char: '土',
    name: 'つちへん (土偏)',
    reading: 'ド',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '土壌・土地・地形・建築・場所に関係する漢字',
    kanjiList: uniqueList([
      '地', '坂', '均', '坊', '坑', '坎', '坪', '坦', '垢', '垣', '埋', '城', '域', '執', '培', '基',
      '堀', '堂', '堆', '堤', '堪', '塔', '塚', '塩', '填', '境', '増', '墨', '壇', '壊', '壌', '墳',
      '墜', '塑', '塞', '填', '址', '埼', '埴', '堵', '堰', '堺', '塊', '塑', '塗'
    ])
  },
  {
    id: 'rad_onnamohen',
    char: '女',
    name: 'おんなへん (女偏)',
    reading: 'ジョ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '女性・家族・婚姻・容姿・感情に関係する漢字',
    kanjiList: uniqueList([
      '好', '如', '妃', '妊', '妄', '妹', '姉', '始', '姓', '委', '姫', '姻', '姿', '威', '娘', '娠',
      '娯', '婆', '婚', '婦', '媒', '嫁', '嫌', '嫡', '嬢', '妙', '妥', '妨', '妬', '姪', '姥', '娼',
      '姪', '姙', '姪', '姥', '娩', '嬉', '嬌', '嬢'
    ])
  },
  {
    id: 'rad_hihen',
    char: '日',
    name: 'ひへん (日偏)',
    reading: 'ニチ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '太陽・天候・時間・明るさ・暦に関係する漢字',
    kanjiList: uniqueList([
      '日', '早', '旬', '旧', '明', '映', '昨', '時', '晩', '普', '景', '晴', '晶', '暁', '暇', '暑',
      '暖', '暗', '暦', '暴', '曜', '旦', '旺', '昆', '昇', '易', '星', '春', '昧', '昭', '昼',
      '晃', '晒', '晉', '晨', '暉', '暈', '暢', '暫', '暮', '瞑', '曖', '曙', '曝', '曚', '曠'
    ])
  },
  {
    id: 'rad_tsukihen',
    char: '月',
    name: 'つきへん・肉月 (月偏)',
    reading: 'ゲツ・ニク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '人体・内臓・筋肉・皮膚・月齢に関係する漢字',
    kanjiList: uniqueList([
      '肌', '肋', '肘', '肚', '肝', '股', '肢', '肥', '肩', '肪', '肯', '肺', '胃', '胆', '胎', '胞',
      '胴', '胸', '脇', '脚', '脱', '脳', '脾', '腕', '腰', '腸', '腹', '膜', '膝', '膨', '膳', '臆',
      '臓', '臍', '腱', '朧', '服', '朕', '朝', '期'
    ])
  },
  {
    id: 'rad_kanehen',
    char: '金',
    name: 'かねへん (金偏)',
    reading: 'キン',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 8,
    description: '金属・鉱物・金属加工品・貨幣に関係する漢字',
    kanjiList: uniqueList([
      '針', '釘', '釣', '鈍', '鈴', '鉄', '鉛', '鉢', '鉱', '銀', '銃', '銅', '銑', '銘', '銭', '鋭',
      '鋳', '鋼', '錘', '錆', '錐', '錠', '錬', '錯', '録', '鏡', '鐘', '鑑', '鑛', '鑽', '錦', '鋪',
      '鍛', '鎮', '鎌', '鎖', '鏃', '釦', '釧', '鋲', '鎧', '鎬', '鍔', '鑓'
    ])
  },
  {
    id: 'rad_gyoninben',
    char: '彳',
    name: 'ぎょうにんべん (彳偏)',
    reading: 'テキ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '道路・歩行・進行・規律に関係する漢字',
    kanjiList: uniqueList([
      '役', '往', '征', '彼', '待', '律', '後', '徐', '徒', '従', '得', '御', '復', '循', '微', '徳',
      '徴', '徹', '径', '彷', '徨', '徊', '彿'
    ])
  },
  {
    id: 'rad_risshinben',
    char: '忄',
    name: 'りっしんべん (心偏)',
    reading: 'シン',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '心・心情・喜怒哀楽・思考・精神状態に関係する漢字',
    kanjiList: uniqueList([
      '快', '怪', '性', '怖', '怯', '恒', '恨', '悔', '悟', '悩', '悦', '惜', '悼', '情', '惨', '惕',
      '惰', '想', '慌', '愉', '慨', '慎', '慣', '憾', '憧', '憐', '憤', '憶', '懐', '惧', '恪', '悖'
    ])
  },
  {
    id: 'rad_hihen_fire',
    char: '火',
    name: 'ひへん (火偏)',
    reading: 'カ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '火・熱・燃焼・光・照明・加熱調理に関係する漢字',
    kanjiList: uniqueList([
      '灯', '灰', '炊', '炎', '炉', '炒', '炬', '炭', '炮', '炳', '炸', '畑', '煙', '煩', '焼', '煉',
      '照', '煌', '煽', '熔', '燃', '燥', '燭', '爆', '爛', '焙', '烽', '熾'
    ])
  },
  {
    id: 'rad_kuchihen',
    char: '口',
    name: 'くちへん (口偏)',
    reading: 'コウ・ク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '口・発声・言語・飲食・感嘆に関係する漢字',
    kanjiList: uniqueList([
      '叶', '叩', '吸', '叫', '吹', '吐', '吟', '吠', '呼', '咲', '呪', '味', '喝', '咆', '味', '命',
      '咀', '咆', '咽', '哀', '品', '員', '哨', '唱', '唯', '唾', '啄', '商', '問', '啓', '啼', '喃',
      '善', '喜', '喝', '喧', '喋', '噂', '嘆', '嘘', '器', '噴', '噺', '嘲', '嚇'
    ])
  },
  {
    id: 'rad_nogihen',
    char: '禾',
    name: 'のぎへん (禾偏)',
    reading: 'カ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 5,
    description: '穀物・稲・農業・収穫・数量計算に関係する漢字',
    kanjiList: uniqueList([
      '私', '秋', '科', '秒', '秘', '租', '秤', '秦', '秩', '移', '税', '程', '稀', '稔', '種', '稲',
      '稼', '稽', '稿', '穀', '穂', '積', '穎', '穏', '穫'
    ])
  },
  {
    id: 'rad_kurumahen',
    char: '車',
    name: 'くるまへん (車偏)',
    reading: 'シャ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '乗り物・車輪・輸送・回転に関係する漢字',
    kanjiList: uniqueList([
      '軌', '軍', '軒', '軟', '転', '軸', '軽', '較', '載', '輪', '輯', '輸', '輻', '轄', '輾', '轟',
      '輛', '轢', '輔'
    ])
  },
  {
    id: 'rad_kaihen',
    char: '貝',
    name: 'かいへん (貝偏)',
    reading: 'バイ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '財貨・金銭・宝物・売買・価値に関係する漢字',
    kanjiList: uniqueList([
      '財', '販', '貯', '購', '賄', '賂', '賊', '賜', '賞', '賠', '賦', '賤', '質', '賭', '購', '贈',
      '賛', '貴', '賃', '貸', '貼', '買'
    ])
  },
  {
    id: 'rad_mehen',
    char: '目',
    name: 'めへん (目偏)',
    reading: 'モク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 5,
    description: '目・視覚・見ること・睡眠・表情に関係する漢字',
    kanjiList: uniqueList([
      '盲', '直', '相', '盾', '省', '眼', '眩', '眺', '眠', '眸', '睦', '睨', '督', '瞬', '瞳', '瞻',
      '矇', '瞼', '瞿'
    ])
  },
  {
    id: 'rad_ashihen',
    char: '足',
    name: 'あしへん (足偏)',
    reading: 'ソク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '足・歩行・走行・跳躍・足の動作に関係する漢字',
    kanjiList: uniqueList([
      '距', '趾', '跨', '跡', '跪', '路', '跳', '践', '踊', '踏', '踝', '踞', '蹄', '躍', '躊', '躇',
      '蹴', '踵'
    ])
  },
  {
    id: 'rad_shokuhen',
    char: '飠',
    name: 'しょくへん (食偏)',
    reading: 'ショク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 8,
    description: '食物・食事・調理・飢餓・飼育に関係する漢字',
    kanjiList: uniqueList([
      '飢', '飯', '飲', '飴', '飼', '飽', '飾', '餅', '養', '餌', '餐', '館', '餞', '餡', '饉', '饋'
    ])
  },
  {
    id: 'rad_mushihen',
    char: '虫',
    name: 'むしへん (虫偏)',
    reading: 'チュウ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 6,
    description: '昆虫・小動物・爬虫類・両生類に関係する漢字',
    kanjiList: uniqueList([
      '虹', '蚊', '蚌', '蚪', '蛇', '蛙', '蛛', '蛤', '蛭', '蛸', '蜂', '蛾', '蛸', '蝉', '蝋', '蝕',
      '蝦', '蝶', '蝿', '螺', '螻', '蟻', '螢', '蟲'
    ])
  },
  {
    id: 'rad_sakanahen',
    char: '魚',
    name: 'さかなへん (魚偏)',
    reading: 'ギョ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 11,
    description: '魚類・海産物・水棲生物に関係する漢字',
    kanjiList: uniqueList([
      '魯', '鮎', '鮑', '鮒', '鮫', '鮭', '鮮', '鯉', '鯖', '鯛', '鯨', '鰍', '鰐', '鰈', '鰊', '鰯',
      '鰹', '鰻', '鱈', '鱗'
    ])
  },
  {
    id: 'rad_kozatohen',
    char: '阝',
    name: 'こざとへん (阜偏)',
    reading: 'フ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '丘陵・地形・昇降・障害・防衛に関係する漢字',
    kanjiList: uniqueList([
      '阪', '防', '阻', '附', '阿', '陀', '降', '限', '陛', '院', '陣', '除', '陥', '陪', '陰', '陳',
      '陵', '陶', '陸', '険', '陽', '隅', '隆', '隊', '階', '随', '隔', '際', '障', '隠'
    ])
  },
  {
    id: 'rad_yumihen',
    char: '弓',
    name: 'ゆみへん (弓偏)',
    reading: 'キュウ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '弓・弾力・武器・測定・緊張に関係する漢字',
    kanjiList: uniqueList([
      '引', '弘', '弛', '弟', '弦', '弧', '弱', '張', '強', '弾', '弥', '彎', '弼'
    ])
  },
  {
    id: 'rad_kemonoben',
    char: '犭',
    name: 'けものへん・いぬへん (犬偏)',
    reading: 'ケン',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 3,
    description: '野獣・動物・狩猟・狂暴に関係する漢字',
    kanjiList: uniqueList([
      '犯', '狂', '狄', '狎', '狐', '狗', '狙', '狠', '狡', '狩', '独', '狭', '狽', '狼', '猛', '猪',
      '猫', '猶', '猥', '猿', '獄', '獅', '獲', '獵'
    ])
  },
  {
    id: 'rad_ouhen',
    char: '王',
    name: 'おうへん・たまへん (玉偏)',
    reading: 'オウ・ギョク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '宝石・玉・宝飾品・王族に関係する漢字',
    kanjiList: uniqueList([
      '玖', '玩', '玲', '玻', '珀', '珍', '珪', '班', '珠', '現', '球', '理', '琉', '琢', '琥', '瑞',
      '環', '璧', '瓊', '瑪', '瑙'
    ])
  },
  {
    id: 'rad_ishihen',
    char: '石',
    name: 'いしへん (石偏)',
    reading: 'セキ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 5,
    description: '岩石・鉱石・硬質・石造物に関係する漢字',
    kanjiList: uniqueList([
      '砂', '研', '砕', '破', '硝', '砲', '硬', '碑', '確', '磁', '磐', '磨', '磯', '礁', '礎'
    ])
  },
  {
    id: 'rad_shimesuhen',
    char: '礻',
    name: 'しめすへん (示偏)',
    reading: 'シ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 4,
    description: '神仏・祭祀・儀礼・祈願・幸不幸に関係する漢字',
    kanjiList: uniqueList([
      '礼', '社', '祈', '祉', '祐', '祖', '祝', '神', '祥', '票', '祭', '禁', '禄', '禍', '禎', '福',
      '禅'
    ])
  },
  {
    id: 'rad_koromohen',
    char: '衤',
    name: 'ころもへん (衣偏)',
    reading: 'イ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 5,
    description: '衣服・裁縫・装飾・被覆に関係する漢字',
    kanjiList: uniqueList([
      '初', '被', '裕', '補', '裸', '複', '裾', '褐', '襟', '袖', '袴', '裂', '装', '袋', '裳'
    ])
  },
  {
    id: 'rad_komehen',
    char: '米',
    name: 'こめへん (米偏)',
    reading: 'ベイ・マイ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 6,
    description: '米・穀物・粉末・食糧に関係する漢字',
    kanjiList: uniqueList([
      '粒', '粗', '粘', '粉', '粋', '精', '糖', '糧', '粟', '粕', '糊', '糠'
    ])
  },
  {
    id: 'rad_funehen',
    char: '舟',
    name: 'ふねへん (舟偏)',
    reading: 'シュウ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 6,
    description: '船・舟・航海・水運に関係する漢字',
    kanjiList: uniqueList([
      '航', '般', '舵', '舶', '船', '艇', '艦', '舷', '艙'
    ])
  },
  {
    id: 'rad_torihen_sake',
    char: '酉',
    name: 'とりへん・ひよみのとり (酉偏)',
    reading: 'ユウ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '酒類・発酵・調味料・化学反応に関係する漢字',
    kanjiList: uniqueList([
      '酌', '配', '酎', '酒', '酔', '酢', '酬', '酪', '酵', '酷', '酸', '醜', '醸', '医'
    ])
  },
  {
    id: 'rad_kadohen',
    char: '角',
    name: 'かどへん・つのへん (角偏)',
    reading: 'カク',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 7,
    description: '角・硬角・計量・突起に関係する漢字',
    kanjiList: uniqueList([
      '解', '触', '觚', '觥', '觴'
    ])
  },
  {
    id: 'rad_honehen',
    char: '骨',
    name: 'ほねへん (骨偏)',
    reading: 'コツ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 10,
    description: '骨格・関節・人体構造に関係する漢字',
    kanjiList: uniqueList([
      '骰', '骸', '髄', '體', '髑', '髏', '髁'
    ])
  },
  {
    id: 'rad_umahen',
    char: '馬',
    name: 'うまへん (馬偏)',
    reading: 'バ',
    category: 'hen',
    categoryName: '偏 (へん)',
    strokes: 10,
    description: '馬・騎乗・駿足・輸送に関係する漢字',
    kanjiList: uniqueList([
      '馴', '馳', '駁', '駅', '駆', '駐', '駒', '騎', '騒', '験', '驚', '騙'
    ])
  },

  // ==================== 旁 (TSUKURI) ====================
  {
    id: 'rad_rittou',
    char: '刂',
    name: 'りっとう (立刀)',
    reading: 'トウ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 2,
    description: '刃物・切断・分割・刑罰・細工に関係する漢字',
    kanjiList: uniqueList([
      '刈', '刊', '刑', '列', '判', '利', '別', '判', '制', '刷', '刺', '刻', '則', '削', '前', '剖',
      '剛', '剣', '剤', '副', '創', '割', '劇', '劃'
    ])
  },
  {
    id: 'rad_chikara',
    char: '力',
    name: 'ちから (力旁)',
    reading: 'リョク',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 2,
    description: '体力・筋力・労働・努力・効力に関係する漢字',
    kanjiList: uniqueList([
      '功', '加', '劣', '助', '努', '励', '効', '勅', '勇', '勉', '動', '勘', '務', '勝', '勢', '勤',
      '勲', '勧'
    ])
  },
  {
    id: 'rad_nobun',
    char: '攵',
    name: 'のぶん・ぼくづくり (攴旁)',
    reading: 'ホク',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 4,
    description: '動作・活動・打撃・教育・変化に関係する漢字',
    kanjiList: uniqueList([
      '收', '改', '攻', '放', '政', '故', '效', '敏', '救', '敗', '教', '敢', '散', '敬', '敵', '敷',
      '数', '整', '斂', '斃'
    ])
  },
  {
    id: 'rad_oogai',
    char: '頁',
    name: 'おおがい (頁旁)',
    reading: 'ケツ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 9,
    description: '頭部・顔面・首・思考・順序に関係する漢字',
    kanjiList: uniqueList([
      '頂', '項', '順', '須', '頌', '預', '頑', '頒', '領', '頗', '頻', '頭', '頼', '題', '額', '顎',
      '願', '顔', '類', '顧'
    ])
  },
  {
    id: 'rad_fushizukuri',
    char: '卩',
    name: 'ふしづくり・わりふ (卩旁)',
    reading: 'セツ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 2,
    description: '割符・節度・ひざまずく人に関係する漢字',
    kanjiList: uniqueList([
      '犯', '印', '危', '卵', '卷', '卸', '即', '卿', '却', '節'
    ])
  },
  {
    id: 'rad_furutori',
    char: '隹',
    name: 'ふるとり (隹旁)',
    reading: 'スイ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 8,
    description: '小鳥・羽毛・集合に関係する漢字',
    kanjiList: uniqueList([
      '隻', '隼', '雀', '雄', '雅', '集', '雇', '雌', '雑', '難', '離'
    ])
  },
  {
    id: 'rad_oozato',
    char: '阝',
    name: 'おおざと (邑旁)',
    reading: 'ユウ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 3,
    description: '村落・都市・領地・国家に関係する漢字',
    kanjiList: uniqueList([
      '邦', '那', '邪', '邸', '郊', '郎', '郡', '部', '郭', '郵', '郷', '都', '鄙'
    ])
  },
  {
    id: 'rad_miru',
    char: '見',
    name: 'みる (見旁)',
    reading: 'ケン',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 7,
    description: '視覚・観察・鑑賞・覚醒に関係する漢字',
    kanjiList: uniqueList([
      '規', '視', '覗', '覚', '親', '観', '覧', '覬'
    ])
  },
  {
    id: 'rad_tori',
    char: '鳥',
    name: 'とり (鳥旁)',
    reading: 'チョウ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 11,
    description: '鳥類・鳴声・飛翔に関係する漢字',
    kanjiList: uniqueList([
      '鳴', '鴎', '鴉', '鴨', '鴻', '鵜', '鵠', '鵡', '鵬', '鶏', '鶴', '鷹', '鷺'
    ])
  },
  {
    id: 'rad_rumata',
    char: '殳',
    name: 'るまた・ほこづくり (殳旁)',
    reading: 'シュ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 4,
    description: '武器・投槍・打撃・動作に関係する漢字',
    kanjiList: uniqueList([
      '段', '殷', '殺', '殿', '毀', '毅', '殴', '殻'
    ])
  },
  {
    id: 'rad_sun',
    char: '寸',
    name: 'すん (寸旁)',
    reading: 'スン',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 3,
    description: '寸法・規則・手足の動きに関係する漢字',
    kanjiList: uniqueList([
      '対', '封', '射', '専', '尋', '導', '寿'
    ])
  },
  {
    id: 'rad_akubi',
    char: '欠',
    name: 'あくび・かける (欠旁)',
    reading: 'ケツ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 4,
    description: '呼吸・欠乏・ため息・歓声に関係する漢字',
    kanjiList: uniqueList([
      '次', '欧', '欣', '欲', '歌', '歓', '欺', '欽'
    ])
  },
  {
    id: 'rad_hoko',
    char: '戈',
    name: 'ほこ (戈旁)',
    reading: 'カ',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 4,
    description: '矛・武器・戦争・防衛に関係する漢字',
    kanjiList: uniqueList([
      '成', '戒', '戦', '戯', '戴', '截', '戮'
    ])
  },
  {
    id: 'rad_onodukuri',
    char: '斤',
    name: 'おのづくり (斤旁)',
    reading: 'キン',
    category: 'tsukuri',
    categoryName: '旁 (つくり)',
    strokes: 4,
    description: '斧・切断・計量に関係する漢字',
    kanjiList: uniqueList([
      '斥', '斧', '斬', '斯', '新', '断'
    ])
  },

  // ==================== 冠 (KANMURI) ====================
  {
    id: 'rad_kusakanmuri',
    char: '艹',
    name: 'くさかんむり (草冠)',
    reading: 'ソウ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 3,
    description: '草木・花卉・植物・農作物・薬草に関係する漢字',
    kanjiList: uniqueList([
      '艾', '芝', '花', '芳', '芸', '芹', '芽', '苦', '若', '英', '茂', '苗', '范', '茜', '茨', '茶',
      '草', '荒', '荘', '荷', '荻', '菅', '菊', '菌', '菜', '菓', '菖', '著', '萌', '落', '葉', '著',
      '葛', '董', '葵', '蒙', '蒲', '蒸', '蒼', '蓄', '蓋', '蓮', '蔭', '蔵', '蔽', '藤', '藩', '藻'
    ])
  },
  {
    id: 'rad_ukanmuri',
    char: '宀',
    name: 'うかんむり (宀冠)',
    reading: 'ベン',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 3,
    description: '家屋・建物・部屋・保護・静止に関係する漢字',
    kanjiList: uniqueList([
      '宇', '守', '安', '宅', '宋', '完', '宗', '官', '宙', '定', '宛', '宜', '宝', '実', '客', '宣',
      '室', '客', '宥', '宮', '宰', '害', '宴', '宵', '家', '容', '宿', '寂', '寄', '密', '富', '寒',
      '寓', '寝', '寛', '寡', '寧', '審', '寮'
    ])
  },
  {
    id: 'rad_takekanmuri',
    char: '⺮',
    name: 'たけかんむり (竹冠)',
    reading: 'チク',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 6,
    description: '竹・竹製品・筆記用具・計算・楽器に関係する漢字',
    kanjiList: uniqueList([
      '竿', '笑', '笛', '符', '第', '笹', '筆', '等', '筋', '筏', '筒', '答', '策', '節', '箇', '管',
      '箔', '箕', '箱', '箸', '範', '篇', '築', '篤', '簡', '簾', '簿', '籍', '籠'
    ])
  },
  {
    id: 'rad_amekanmuri',
    char: '⻗',
    name: 'あめかんむり (雨冠)',
    reading: 'ウ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 8,
    description: '気象・天候・降水・雲・雷・大気現象に関係する漢字',
    kanjiList: uniqueList([
      '雪', '雫', '雰', '雲', '電', '雷', '零', '需', '震', '霊', '霆', '霄', '霈', '霍', '霎', '霜',
      '霞', '霧', '露', '霸', '霹', '霽', '靂', '靄'
    ])
  },
  {
    id: 'rad_nabebuta',
    char: '亠',
    name: 'なべぶた・けいさんかんむり (亠冠)',
    reading: 'トウ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 2,
    description: '頭部・被せ物・高所・交差点に関係する漢字',
    kanjiList: uniqueList([
      '亡', '交', '亥', '亦', '享', '京', '亭', '亮', '亳', '夜', '育', '衰', '高', '膏', '豪'
    ])
  },
  {
    id: 'rad_hitoyane',
    char: '𠆢',
    name: 'ひとやね・ひとがしら (人冠)',
    reading: 'ジン',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 2,
    description: '人・覆い・集合・統率に関係する漢字',
    kanjiList: uniqueList([
      '今', '介', '会', '合', '全', '企', '余', '命', '令', '舍', '倉', '傘'
    ])
  },
  {
    id: 'rad_wakanmuri',
    char: '冖',
    name: 'わかんむり・べきかんむり (冖冠)',
    reading: 'ベキ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 2,
    description: '布の覆い・被覆・暗がりに関係する漢字',
    kanjiList: uniqueList([
      '冠', '写', '軍', '冥', '冨', '冤', '冦'
    ])
  },
  {
    id: 'rad_anakanmuri',
    char: '穴',
    name: 'あなかんむり (穴冠)',
    reading: 'ケツ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 5,
    description: '洞穴・空間・掘削・探求に関係する漢字',
    kanjiList: uniqueList([
      '空', '究', '突', '穿', '窃', '窄', '窈', '窒', '窓', '窟', '窩', '窪', '窮', '窺', '窯'
    ])
  },
  {
    id: 'rad_hatsugashira',
    char: '癶',
    name: 'はつがしら (癶冠)',
    reading: 'ハツ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 5,
    description: '足の踏み出し・対立・発散に関係する漢字',
    kanjiList: uniqueList([
      '発', '登', '癸'
    ])
  },
  {
    id: 'rad_toragashira',
    char: '虍',
    name: 'とらがしら・とらかんむり (虍冠)',
    reading: 'コ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 6,
    description: '虎・猛獣・威厳・斑紋に関係する漢字',
    kanjiList: uniqueList([
      '虎', '虐', '虔', '処', '虚', '虜', '虞', '號'
    ])
  },
  {
    id: 'rad_tsumekanmuri',
    char: '爪',
    name: 'つめかんむり (爪冠)',
    reading: 'ソウ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 4,
    description: '爪・手の動作・採取・授受に関係する漢字',
    kanjiList: uniqueList([
      '妥', '采', '受', '争', '爰', '爵', '愛'
    ])
  },
  {
    id: 'rad_amigashira',
    char: '罒',
    name: 'あみがしら・あみめ (网冠)',
    reading: 'モウ',
    category: 'kanmuri',
    categoryName: '冠 (かんむり)',
    strokes: 5,
    description: '網・罠・刑法・捕縛に関係する漢字',
    kanjiList: uniqueList([
      '罘', '罟', '罪', '置', '罰', '署', '罵', '罹', '羅', '羈'
    ])
  },

  // ==================== 脚 (ASHI) ====================
  {
    id: 'rad_kokoro',
    char: '心',
    name: 'こころ (心脚)',
    reading: 'シン',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 4,
    description: '心・思考・情操・意図・精神に関係する漢字',
    kanjiList: uniqueList([
      '志', '忘', '応', '忠', '念', '忽', '怒', '思', '怠', '急', '怨', '恐', '恩', '息', '恵', '悉',
      '悠', '患', '悲', '惑', '想', '意', '愚', '愛', '感', '慈', '態', '慕', '憲', '慶', '憂', '懇'
    ])
  },
  {
    id: 'rad_rekka',
    char: '灬',
    name: 'れっか・れんが (火脚)',
    reading: 'カ',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 4,
    description: '火・熱・加熱調理・光照・燃焼に関係する漢字',
    kanjiList: uniqueList([
      '点', '烈', '烏', '焦', '無', '然', '煮', '照', '煕', '熊', '熟', '熱', '熹', '燕', '燃'
    ])
  },
  {
    id: 'rad_hitoashi',
    char: '儿',
    name: 'ひとあし (儿脚)',
    reading: 'ジン・ニン',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 2,
    description: '人の足・歩行・成長・人物に関係する漢字',
    kanjiList: uniqueList([
      '元', '兄', '充', '兆', '先', '光', '克', '免', '兎', '児', '党', '兜', '兢'
    ])
  },
  {
    id: 'rad_sara',
    char: '皿',
    name: 'さら (皿脚)',
    reading: 'ベイ',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 5,
    description: '器・食器・容器・盛付・血盟に関係する漢字',
    kanjiList: uniqueList([
      '盂', '盃', '盆', '盈', '益', '盒', '盛', '盗', '蓋', '盤', '盟', '監'
    ])
  },
  {
    id: 'rad_shitagokoro',
    char: '忄',
    name: 'したごころ (心脚変形)',
    reading: 'シン',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 3,
    description: '心・思考・内面に関係する漢字',
    kanjiList: uniqueList([
      '恭', '慕', '忝', '泰'
    ])
  },
  {
    id: 'rad_hane_ashi',
    char: '羽',
    name: 'はね (羽脚)',
    reading: 'ウ',
    category: 'ashi',
    categoryName: '脚 (あし)',
    strokes: 6,
    description: '鳥の羽・飛翔・翼に関係する漢字',
    kanjiList: uniqueList([
      '翁', '翌', '習', '翠', '翦', '翰', '翼', '翻'
    ])
  },

  // ==================== 垂れ (TARE) ====================
  {
    id: 'rad_madare',
    char: '广',
    name: 'まだれ (广垂)',
    reading: 'ゲン',
    category: 'tare',
    categoryName: '垂 (たれ)',
    strokes: 3,
    description: '建物・屋敷・施設・広大さに関係する漢字',
    kanjiList: uniqueList([
      '庁', '広', '庄', '庇', '床', '序', '底', '店', '庚', '府', '度', '座', '庫', '庵', '庭', '康',
      '庶', '庸', '廃', '廉', '廊', '廟', '廠', '廣'
    ])
  },
  {
    id: 'rad_yamaidare',
    char: '疒',
    name: 'やまいだれ (疒垂)',
    reading: 'ダク',
    category: 'tare',
    categoryName: '垂 (たれ)',
    strokes: 5,
    description: '病気・症状・治療・身体の異常に関係する漢字',
    kanjiList: uniqueList([
      '疚', '疝', '疣', '疫', '疲', '疳', '疵', '疹', '疼', '疽', '疾', '症', '病', '痛', '痂', '痙',
      '痢', '痣', '痰', '痴', '痺', '痼', '瘁', '療', '癌', '癒', '癖', '癩'
    ])
  },
  {
    id: 'rad_gandare',
    char: '厂',
    name: 'がんだれ (厂垂)',
    reading: 'カン',
    category: 'tare',
    categoryName: '垂 (たれ)',
    strokes: 2,
    description: '崖・岩陰・険しい地形・空間に関係する漢字',
    kanjiList: uniqueList([
      '厄', '灰', '原', '厚', '厘', '厓', '厩', '厨', '厭', '厲', '厳'
    ])
  },
  {
    id: 'rad_shikabane',
    char: '尸',
    name: 'しかばね・かばね (尸垂)',
    reading: 'シ',
    category: 'tare',
    categoryName: '垂 (たれ)',
    strokes: 3,
    description: '身体・居住・屈曲・住居に関係する漢字',
    kanjiList: uniqueList([
      '尺', '尻', '尼', '尾', '尿', '局', '居', '届', '屈', '屋', '屍', '屏', '屑', '展', '属', '屠',
      '履'
    ])
  },
  {
    id: 'rad_todare',
    char: '戸',
    name: 'とだれ (戸垂)',
    reading: 'コ',
    category: 'tare',
    categoryName: '垂 (たれ)',
    strokes: 4,
    description: '戸・扉・家屋・開閉に関係する漢字',
    kanjiList: uniqueList([
      '戻', '房', '所', '扁', '扇', '扉', '雇'
    ])
  },

  // ==================== 繞 (NYO) ====================
  {
    id: 'rad_shinnyo',
    char: '⻌',
    name: 'しんにょう・しんにゅう (辵繞)',
    reading: 'チャク',
    category: 'nyo',
    categoryName: '繞 (にょう)',
    strokes: 3,
    description: '道路・移動・進行・到達・時間経過に関係する漢字',
    kanjiList: uniqueList([
      '込', '辻', '迅', '迎', '近', '返', '述', '迫', '辿', '迷', '追', '退', '送', '逃', '逆', '透',
      '逐', '逓', '途', '通', '逝', '逞', '速', '造', '逢', '連', '逮', '週', '進', '遊', '運', '遍',
      '過', '道', '達', '違', '遠', '遣', '遥', '適', '遭', '遮', '遷', '選', '遺', '遼', '避', '還'
    ])
  },
  {
    id: 'rad_ennyo',
    char: '廴',
    name: 'えんにょう・いんにょう (廴繞)',
    reading: 'イン',
    category: 'nyo',
    categoryName: '繞 (にょう)',
    strokes: 2,
    description: '歩行・延長・長距離の移動に関係する漢字',
    kanjiList: uniqueList([
      '廷', '延', '建', '廻'
    ])
  },
  {
    id: 'rad_sounyo',
    char: '走',
    name: 'そうにょう (走繞)',
    reading: 'ソウ',
    category: 'nyo',
    categoryName: '繞 (にょう)',
    strokes: 7,
    description: '走る・疾走・逃走・超越に関係する漢字',
    kanjiList: uniqueList([
      '赴', '起', '超', '越', '趣', '趙', '趨'
    ])
  },
  {
    id: 'rad_kinyo',
    char: '鬼',
    name: 'きにょう (鬼繞)',
    reading: 'キ',
    category: 'nyo',
    categoryName: '繞 (にょう)',
    strokes: 10,
    description: '鬼神・霊魂・怪物に関係する漢字',
    kanjiList: uniqueList([
      '魁', '魃', '魅', '魄', '魎', '魏', '魔'
    ])
  },

  // ==================== 構え (KAMAE) ====================
  {
    id: 'rad_kunigamae',
    char: '囗',
    name: 'くにがまえ (囗構)',
    reading: 'イ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 3,
    description: '囲い・境界・領域・国家・閉鎖空間に関係する漢字',
    kanjiList: uniqueList([
      '四', '囚', '団', '因', '囲', '困', '図', '固', '国', '圃', '圈', '園', '圓'
    ])
  },
  {
    id: 'rad_mongamae',
    char: '門',
    name: 'もんがまえ (門構)',
    reading: 'モン',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 8,
    description: '門・出入口・通過・開閉・防御に関係する漢字',
    kanjiList: uniqueList([
      '閃', '閉', '開', '閏', '閑', '間', '閔', '閥', '閣', '閲', '閻', '閾', '関', '闇', '闘', '闊',
      '闌', '闕'
    ])
  },
  {
    id: 'rad_gyougame',
    char: '行',
    name: 'ぎょうがまえ・ゆきがまえ (行構)',
    reading: 'コウ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 6,
    description: '十字路・街路・往来・伝達に関係する漢字',
    kanjiList: uniqueList([
      '術', '街', '衛', '衝', '衡', '衢', '行', '裄', '衙'
    ])
  },
  {
    id: 'rad_tsutsumigamae',
    char: '勹',
    name: 'つつみがまえ (勹構)',
    reading: 'ホウ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 2,
    description: '包む・曲げる・抱え込むことに関係する漢字',
    kanjiList: uniqueList([
      '包', '匂', '句', '旬', '匈', '匍', '匐', '匏', '吻', '勺', '勿'
    ])
  },
  {
    id: 'rad_hakogamae',
    char: '匚',
    name: 'はこがまえ (匚構)',
    reading: 'ホウ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 2,
    description: '箱・容器・収容に関係する漢字',
    kanjiList: uniqueList([
      '匠', '匡', '匣', '匪', '匱'
    ])
  },
  {
    id: 'rad_kigamae',
    char: '气',
    name: 'きがまえ (气構)',
    reading: 'キ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 4,
    description: '気体・大気・呼吸・蒸気に関係する漢字',
    kanjiList: uniqueList([
      '気', '氛', '氤', '氳'
    ])
  },
  {
    id: 'rad_kazegamae',
    char: '几',
    name: 'かぜがまえ・きにょう (几構)',
    reading: 'キ・フウ',
    category: 'kamae',
    categoryName: '構 (かまえ)',
    strokes: 2,
    description: '風・空気・鳥の飛翔に関係する漢字',
    kanjiList: uniqueList([
      '凡', '処', '凩', '凪', '凧', '夙', '鳳'
    ])
  },

  // ==================== 筆画・基本 (BASIC / STROKE) ====================
  {
    id: 'rad_stroke_ichi',
    char: '一',
    name: '横画 (一)',
    reading: 'イチ',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・横線・水平ストローク',
    kanjiList: uniqueList(['一', '二', '三', '七', '万', '丈', '上', '下', '不', '世', '丘', '丙'])
  },
  {
    id: 'rad_stroke_tate',
    char: '丨',
    name: '縦画 (丨)',
    reading: 'コン',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・縦線・垂直ストローク',
    kanjiList: uniqueList(['中', '十', '千', '旧', '甲', '申', '由', '引', '串'])
  },
  {
    id: 'rad_stroke_ten',
    char: '丶',
    name: '点 (丶)',
    reading: 'チュ',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・点・小水滴・打点',
    kanjiList: uniqueList(['丸', '丹', '主', '丼', '凡', '求'])
  },
  {
    id: 'rad_stroke_harai_left',
    char: '丿',
    name: '左払い (丿)',
    reading: 'ヘツ',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・左下への流麗な払い',
    kanjiList: uniqueList(['九', '及', '久', '乏', '反', '升', '丹', '千', '禾', '文'])
  },
  {
    id: 'rad_stroke_hane',
    char: '亅',
    name: 'はね・かぎ (亅)',
    reading: 'ケツ',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・跳ね上げ・鉤ストローク',
    kanjiList: uniqueList(['了', '予', '争', '事', '于'])
  },
  {
    id: 'rad_stroke_otsu',
    char: '乙',
    name: 'おつ・曲がり (乙)',
    reading: 'オツ',
    category: 'basic',
    categoryName: '筆画・基本',
    strokes: 1,
    description: '基本筆画・屈曲・折れ曲がりストローク',
    kanjiList: uniqueList(['乙', '九', '乞', '乾', '乱', '乳'])
  }
];

const kangxi214Entries: RadicalEntry[] = KANGXI_214_RADICALS.map((k) => ({
  id: `kangxi_${k.number}`,
  char: k.displayChar || k.char,
  name: `${k.name} [#${k.number}]`,
  reading: k.reading,
  category: k.category,
  categoryName: k.categoryName,
  strokes: k.strokes,
  description: k.description,
  kanjiList: k.kanjiList || [],
}));

export const RADICAL_KANJI_DATABASE: RadicalEntry[] = [
  ...BASE_RADICAL_KANJI_DATABASE,
  ...kangxi214Entries,
];

/**
 * Quick lookup helper to find radical entry by char or id
 */
export function getRadicalEntry(charOrId: string): RadicalEntry | undefined {
  if (!charOrId) return undefined;
  return RADICAL_KANJI_DATABASE.find(
    (r) => r.id === charOrId || r.char === charOrId || r.name.includes(charOrId)
  );
}

/**
 * Find all radical entries that contain a specific Kanji character
 */
export function getRadicalsForKanji(kanjiChar: string): RadicalEntry[] {
  if (!kanjiChar || kanjiChar.trim().length === 0) return [];
  const char = kanjiChar.trim()[0];
  return RADICAL_KANJI_DATABASE.filter((r) => r.kanjiList.includes(char) || r.char === char);
}

/**
 * Get all radical entries belonging to a category
 */
export function getRadicalsByCategory(category: string): RadicalEntry[] {
  if (!category || category === 'all') return RADICAL_KANJI_DATABASE;
  if (category === 'kangxi') {
    return RADICAL_KANJI_DATABASE.filter((r) => r.id.startsWith('kangxi_'));
  }
  return RADICAL_KANJI_DATABASE.filter((r) => r.category === category);
}

/**
 * Filter radical database by search query or category
 */
export function searchRadicalDatabase(query: string, category: string = 'all'): RadicalEntry[] {
  let list = RADICAL_KANJI_DATABASE;
  if (category && category !== 'all') {
    if (category === 'kangxi') {
      list = list.filter((r) => r.id.startsWith('kangxi_'));
    } else {
      list = list.filter((r) => r.category === category);
    }
  }
  if (!query || query.trim() === '') {
    return list;
  }
  const q = query.trim().toLowerCase();
  return list.filter(
    (r) =>
      r.char.includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.reading.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.kanjiList.some((k) => k.includes(q))
  );
}

/**
 * Return an array of all unique Kanji characters present in the radical database
 */
export function getAllDatabaseKanji(): string[] {
  const set = new Set<string>();
  for (const entry of RADICAL_KANJI_DATABASE) {
    for (const k of entry.kanjiList) {
      set.add(k);
    }
  }
  return Array.from(set);
}
