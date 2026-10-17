import {
  PenPresetInfo,
  PressureCurveConfig,
  UserPenPreset,
} from "../../types";

/**
 * Solve cubic Bezier for x coordinate to find t in [0, 1], then evaluate y(t).
 * Bx(t) = 3(1-t)^2 t * p1.x + 3(1-t) t^2 * p2.x + t^3
 * By(t) = 3(1-t)^2 t * p1.y + 3(1-t) t^2 * p2.y + t^3
 */
export function solveCubicBezierYForX(
  x: number,
  p1: { x: number; y: number } = { x: 0.33, y: 0.33 },
  p2: { x: number; y: number } = { x: 0.67, y: 0.67 }
): number {
  const targetX = Math.max(0, Math.min(1, x));
  if (targetX <= 0) return 0;
  if (targetX >= 1) return 1;

  // Binary search for t in [0, 1]
  let low = 0;
  let high = 1;
  let t = targetX;

  for (let i = 0; i < 14; i++) {
    const mt = 1 - t;
    const currentX = 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t;
    if (Math.abs(currentX - targetX) < 0.001) break;
    if (currentX < targetX) {
      low = t;
    } else {
      high = t;
    }
    t = (low + high) / 2;
  }

  const mt = 1 - t;
  const y = 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t;
  return Math.max(0, Math.min(1, y));
}

/**
 * Evaluate dynamic pressure curve from raw pointer pressure (0.0 to 1.0)
 */
export function evaluatePressureCurve(
  rawPressure: number,
  config?: PressureCurveConfig | null,
  sensitivity: 'high' | 'normal' | 'low' | 'off' = 'normal'
): number {
  if (sensitivity === 'off') {
    return 0.5;
  }

  const rawP = Math.max(0, Math.min(1, typeof rawPressure === 'number' && !isNaN(rawPressure) ? rawPressure : 0.5));

  if (config && config.enabled !== false) {
    const minT = config.minThreshold ?? 0.0;
    const maxT = config.maxThreshold ?? 1.0;

    // Apply deadzone / threshold clamping
    let normalizedInput = 0;
    if (rawP <= minT) {
      normalizedInput = 0;
    } else if (rawP >= maxT) {
      normalizedInput = 1;
    } else {
      normalizedInput = (rawP - minT) / Math.max(0.01, maxT - minT);
    }

    const p1 = config.p1 || { x: 0.33, y: 0.33 };
    const p2 = config.p2 || { x: 0.67, y: 0.67 };

    let mappedY = solveCubicBezierYForX(normalizedInput, p1, p2);

    // Apply sensitivity scaling if needed
    if (sensitivity === 'high') {
      mappedY = Math.min(1.0, Math.pow(Math.max(0.01, mappedY), 0.85));
    } else if (sensitivity === 'low') {
      mappedY = Math.min(1.0, Math.pow(Math.max(0.01, mappedY), 1.18));
    }

    return Math.max(0.02, Math.min(1.0, mappedY));
  }

  // Fallback if no curve config
  if (sensitivity === 'high') {
    return Math.min(1.0, Math.pow(Math.max(0.01, rawP), 0.72));
  } else if (sensitivity === 'low') {
    return Math.min(1.0, Math.pow(Math.max(0.01, rawP), 1.35));
  } else {
    return Math.min(1.0, Math.pow(Math.max(0.01, rawP), 0.92));
  }
}

export const PEN_PRESETS: PenPresetInfo[] = [
  {
    id: 'signpen',
    name: '水性サインペン',
    shortName: 'サインペン',
    category: 'pen',
    description: '滑らかで温かみのあるフェルトペン。均一感と適度な筆圧変化のある日常手書き風',
    defaultWidth: 38,
  },
  {
    id: 'sumi',
    name: '墨だまり筆',
    shortName: '墨だまり',
    category: 'natural',
    description: '書き始めや角・止めの墨だまりを再現。速度と筆圧に応じたインク描画',
    defaultWidth: 44,
  },
  {
    id: 'marumoji',
    name: '丸文字',
    shortName: '丸文字',
    category: 'pen',
    description: '先端が丸いストローク。丸文字やPOP体フォント向け',
    defaultWidth: 42,
  },
  {
    id: 'brush',
    name: '毛筆・筆ペン',
    shortName: '毛筆',
    category: 'natural',
    description: '筆圧感応・止め・払いに応じた和風毛筆ストローク',
    defaultWidth: 45,
  },
  {
    id: 'fountain',
    name: '万年筆・Gペン',
    shortName: '万年筆',
    category: 'pen',
    description: '縦引きが太く横払いが細いインクペン。筆圧とペン先角度による抑揚表現',
    defaultWidth: 38,
  },
  {
    id: 'mincho_nib',
    name: '明朝体風・縦太横細筆',
    shortName: '明朝筆',
    category: 'natural',
    description: '縦引きが太く横引きが細い、明朝体・教科書体風の習字ペン',
    defaultWidth: 42,
  },
  {
    id: 'reisho_chisel',
    name: '隷書風・扁平平筆',
    shortName: '隷書筆',
    category: 'chisel',
    description: '水平約15°の扁平ペン先。隷書体の波打ちや古代銘文レタリングに対応',
    defaultWidth: 48,
  },
  {
    id: 'g_pen',
    name: '漫画・鋭利Gペン',
    shortName: 'Gペン',
    category: 'pen',
    description: '払い・抜きが鋭利に尖るコミック用Gペン',
    defaultWidth: 32,
  },
  {
    id: 'marker',
    name: '丸マーカー',
    shortName: '丸マーカー',
    category: 'pen',
    description: '太さが均一な丸芯マーカーによるストローク線',
    defaultWidth: 38,
  },
  {
    id: 'ballpoint',
    name: 'ゲルボールペン',
    shortName: 'ゲルペン',
    category: 'pen',
    description: '0.5mmボールペン相当の細字手書き線',
    defaultWidth: 24,
  },
  {
    id: 'chalk',
    name: 'クレヨン風太筆',
    shortName: 'クレヨン',
    category: 'natural',
    description: '太めで端が丸いチョーク風ストローク',
    defaultWidth: 55,
  },
  {
    id: 'calligraphy',
    name: '平筆カリグラフィー',
    shortName: '平筆',
    category: 'chisel',
    description: '45°傾斜の平ペン。イタリックやゴシック体、西洋レタリング風',
    defaultWidth: 45,
  },
  {
    id: 'highlighter',
    name: '平マーカー・リボン',
    shortName: '平マーカー',
    category: 'chisel',
    description: '垂直・水平の平筆。テープ文字やレトロ見出しフォント向け',
    defaultWidth: 50,
  },
  {
    id: 'pencil',
    name: '鉛筆・細字',
    shortName: '鉛筆',
    category: 'natural',
    description: '筆圧に応じた細線。手描きの下描きや細字フォントに',
    defaultWidth: 20,
  },
  {
    id: 'sharp',
    name: '角筆',
    shortName: '角筆',
    category: 'special',
    description: '直線と角ノードで構成される幾何学的・ピクセル風の角ばり線',
    defaultWidth: 35,
  },
  {
    id: 'sharp_round',
    name: '角丸筆',
    shortName: '角丸',
    category: 'special',
    description: '直線骨格に滑らかな角丸とラウンド端を施した角丸線',
    defaultWidth: 35,
  },
  {
    id: 'wobbly',
    name: 'ゆらぎ手書き',
    shortName: 'ゆらぎ',
    category: 'special',
    description: '微細な手の震えやインクのにじみ感を再現したリアルな手描き線',
    defaultWidth: 38,
  },
];

