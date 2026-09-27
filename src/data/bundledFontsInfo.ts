/**
 * Bundled Reference & Radical Extraction Fonts Information & Licenses
 *
 * All fonts provided in Font Creator Studio for tracing (下絵) and radical synthesis (部首抽出)
 * are licensed under the SIL Open Font License, Version 1.1 (OFL-1.1).
 *
 * This license explicitly grants:
 * - Free commercial and personal use
 * - Free modification, tracing, outline extraction, and derivation
 * - Redistribution bundled with other software or as part of newly compiled fonts
 */

export interface BundledFontInfo {
  id: string;
  name: string;
  nameJa: string;
  category: '下絵 (お手本)' | '部首 (Radicals)' | 'UI / メトリクス';
  role: string;
  fontFamily: string;
  author: string;
  license: string;
  licenseUrl: string;
  commercialUse: '可能 (商用利用可)' | '要確認';
  derivativeWorks: '可能 (トレース・改変・派生フォント作成可)' | '要確認';
  description: string;
  licenseNotes: string;
}

export const BUNDLED_FONTS_INFO: BundledFontInfo[] = [
  {
    id: 'noto-serif-jp',
    name: 'Noto Serif JP',
    nameJa: '源ノ明朝 (Noto Serif JP)',
    category: '部首 (Radicals)',
    role: '部首自動抽出（明朝体スタイル）・下絵トレースお手本',
    fontFamily: "'Noto Serif JP', serif",
    author: 'Google Fonts & Adobe Systems',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    licenseUrl: 'https://openfontlicense.org/',
    commercialUse: '可能 (商用利用可)',
    derivativeWorks: '可能 (トレース・改変・派生フォント作成可)',
    description: '筆遣いとウロコを持つ明朝体。漢字の基本骨格・筆画の参考として利用できます。',
    licenseNotes:
      'SIL OFL 1.1 のもとで配布されており、本アプリ内での輪郭抽出、下絵トレース、ベクター変換、およびそれらを元に作成した派生フォントの商用販売・無料配布が許可されています。',
  },
  {
    id: 'noto-sans-jp',
    name: 'Noto Sans JP',
    nameJa: '源ノ角ゴシック (Noto Sans JP)',
    category: '部首 (Radicals)',
    role: '部首自動抽出（ゴシック体スタイル）・下絵トレースお手本',
    fontFamily: "'Noto Sans JP', sans-serif",
    author: 'Google Fonts & Adobe Systems',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    licenseUrl: 'https://openfontlicense.org/',
    commercialUse: '可能 (商用利用可)',
    derivativeWorks: '可能 (トレース・改変・派生フォント作成可)',
    description: '均一な線幅と高い視認性を備えた標準ゴシック体。幾何学的な部首構成の土台として活用できます。',
    licenseNotes:
      '世界標準のオープンソース・フォントです。骨格参照・パーツ流用・改変後のフォント出力に関して追加のロイヤリティ等は一切発生しません。',
  },
  {
    id: 'zen-maru-gothic',
    name: 'Zen Maru Gothic',
    nameJa: 'Zen 丸ゴシック (Zen Maru Gothic)',
    category: '部首 (Radicals)',
    role: '部首自動抽出（丸ゴシック体スタイル）・下絵トレースお手本',
    fontFamily: "'Zen Maru Gothic', sans-serif",
    author: '大平善道 (Yoshimichi Ohira / Zen Fonts) & Google Fonts',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    licenseUrl: 'https://openfontlicense.org/',
    commercialUse: '可能 (商用利用可)',
    derivativeWorks: '可能 (トレース・改変・派生フォント作成可)',
    description: '角丸の筆画を持つ日本語丸ゴシック。丸ゴシック系フォントの部首制作に適しています。',
    licenseNotes:
      '大平善道氏により制作され、Google Fontsを通じてSIL OFL 1.1で提供されています。商用・非商用問わず自由にパーツの抽出・利用が認められています。',
  },
  {
    id: 'kaisei-tokumin',
    name: 'Kaisei Tokumin',
    nameJa: '解星 特民 (Kaisei Tokumin)',
    category: '下絵 (お手本)',
    role: '特民明朝スタイルの下絵トレース参照',
    fontFamily: "'Kaisei Tokumin', serif",
    author: '大日本印刷株式会社 (Dai Nippon Printing Co., Ltd.) & Fontworks / Google Fonts',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    licenseUrl: 'https://openfontlicense.org/',
    commercialUse: '可能 (商用利用可)',
    derivativeWorks: '可能 (トレース・改変・派生フォント作成可)',
    description: '活字の骨格と鋭いウロコ・明朝筆触を持つ明朝体。',
    licenseNotes:
      'Google FontsにてSIL OFL 1.1として公開されており、下絵としての表示・トレース作図・派生フォント作成が法的に問題ありません。',
  },
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    nameJa: 'JetBrains Mono',
    category: 'UI / メトリクス',
    role: 'Unicodeコードポイント、メトリクス数値、ルーラー座標表示',
    fontFamily: "'JetBrains Mono', monospace",
    author: 'JetBrains s.r.o.',
    license: 'SIL Open Font License 1.1 (OFL-1.1)',
    licenseUrl: 'https://openfontlicense.org/',
    commercialUse: '可能 (商用利用可)',
    derivativeWorks: '可能 (トレース・改変・派生フォント作成可)',
    description: '等幅で読みやすい開発者向けプログラミングフォント。',
    licenseNotes:
      'SIL OFL 1.1ライセンスのオープンソースフォントです。エディタ内の数値・コード表示UIに組み込まれています。',
  },
];
