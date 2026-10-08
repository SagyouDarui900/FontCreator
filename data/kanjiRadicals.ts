import { KanjiRadical, PathContour, BezierNode } from '../types';
import { generateId } from '../utils/pathUtils';

// Helper to create a corner node
function cNode(x: number, y: number): BezierNode {
  return { id: generateId(), x: Math.round(x), y: Math.round(y), type: 'corner' };
}

// Helper to create a smooth curved node with handles
function sNode(
  x: number,
  y: number,
  hIn?: { x: number; y: number },
  hOut?: { x: number; y: number }
): BezierNode {
  return {
    id: generateId(),
    x: Math.round(x),
    y: Math.round(y),
    type: 'smooth',
    handleIn: hIn ? { x: Math.round(hIn.x), y: Math.round(hIn.y) } : null,
    handleOut: hOut ? { x: Math.round(hOut.x), y: Math.round(hOut.y) } : null,
  };
}

/**
 * Creates an authentic, typographically curved left-sweeping stroke (左払い / はらい)
 */
function createLeftHarai(
  startX: number,
  startY: number,
  tipX: number,
  tipY: number,
  strokeW: number = 46,
  curvature: number = 0.38
): PathContour {
  const dx = tipX - startX;
  const dy = tipY - startY;

  // Outer curve control points
  const cpOutX = startX + dx * curvature - 10;
  const cpOutY = startY + dy * 0.65;

  // Inner curve control points
  const cpInX = startX + strokeW + dx * curvature + 5;
  const cpInY = startY + dy * 0.60;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(startX, startY),
      cNode(startX + strokeW + 8, startY + 4),
      sNode(
        startX + strokeW + dx * 0.45,
        startY + dy * 0.52,
        { x: cpInX, y: cpInY - 30 },
        { x: cpInX, y: cpInY + 30 }
      ),
      cNode(tipX, tipY), // sharp tapered tip
      sNode(
        startX + dx * 0.40,
        startY + dy * 0.58,
        { x: cpOutX, y: cpOutY + 25 },
        { x: cpOutX, y: cpOutY - 25 }
      ),
    ],
  };
}

/**
 * Creates an authentic, typographically curved right-sweeping stroke (右払い)
 */
function createRightHarai(
  startX: number,
  startY: number,
  tipX: number,
  tipY: number,
  maxW: number = 54
): PathContour {
  const midX = startX + (tipX - startX) * 0.6;
  const midY = startY + (tipY - startY) * 0.75;

  return {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(startX, startY),
      sNode(midX + maxW * 0.5, midY, { x: midX + 10, y: midY - 35 }, { x: midX + 10, y: midY + 35 }),
      cNode(tipX, tipY),
      cNode(tipX - 10, tipY + 12),
      sNode(midX - maxW * 0.4, midY + 10, { x: midX - 25, y: midY + 35 }, { x: midX - 20, y: midY - 35 }),
    ],
  };
}

/**
 * Creates a clean vertical stroke with optical taper and optional bottom hook (跳ね・ハネ)
 */
function createVerticalStroke(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { hookLeft?: boolean; hookRight?: boolean; hookW?: number; hookH?: number }
): PathContour {
  if (opts?.hookLeft) {
    const hw = opts.hookW || 55;
    const hh = opts.hookH || 65;
    return {
      id: generateId(),
      closed: true,
      nodes: [
        cNode(x, y),
        cNode(x + w, y),
        cNode(x + w, y + h),
        cNode(x - hw, y + h - hh),
        cNode(x - hw + 8, y + h - hh - 12),
        cNode(x, y + h - 18),
      ],
    };
  }

  if (opts?.hookRight) {
    const hw = opts.hookW || 55;
    const hh = opts.hookH || 65;
    return {
      id: generateId(),
      closed: true,
      nodes: [
        cNode(x, y),
        cNode(x + w, y),
        cNode(x + w + hw, y + h - hh),
        cNode(x + w, y + h),
        cNode(x, y + h),
      ],
    };
  }

  return {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(x, y),
      cNode(x + w, y),
      cNode(x + w, y + h),
      cNode(x, y + h),
    ],
  };
}

/**
 * Creates a clean horizontal stroke with optional slight upward angle and subtle terminal serif
 */
function createHorizontalStroke(
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { slant?: number; serif?: boolean }
): PathContour {
  const slant = opts?.slant || 0;
  const y1 = y;
  const y2 = y - slant;

  if (opts?.serif) {
    return {
      id: generateId(),
      closed: true,
      nodes: [
        cNode(x, y1),
        cNode(x + w - 16, y2),
        cNode(x + w, y2 - 12),
        cNode(x + w, y2 + h + 8),
        cNode(x + w - 18, y2 + h),
        cNode(x, y1 + h),
      ],
    };
  }

  return {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(x, y1),
      cNode(x + w, y2),
      cNode(x + w, y2 + h),
      cNode(x, y1 + h),
    ],
  };
}

/**
 * Creates an authentic teardrop dot (点・雨・さんずい)
 */
function createDot(
  cx: number,
  cy: number,
  w: number = 52,
  h: number = 72,
  angleDeg: number = 30
): PathContour {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const rot = (px: number, py: number) => ({
    x: cx + px * cos - py * sin,
    y: cy + px * sin + py * cos,
  });

  const p0 = rot(0, -h / 2);
  const p1 = rot(w / 2, 0);
  const p2 = rot(w / 3, h / 2);
  const p3 = rot(-w / 3, h / 2);
  const p4 = rot(-w / 2, 0);

  return {
    id: generateId(),
    closed: true,
    nodes: [
      sNode(p0.x, p0.y, rot(-w / 4, -h / 2 + 5), rot(w / 4, -h / 2 + 5)),
      sNode(p1.x, p1.y, rot(w / 2, -h / 4), rot(w / 2, h / 4)),
      cNode(p2.x, p2.y),
      cNode(p3.x, p3.y),
      sNode(p4.x, p4.y, rot(-w / 2, h / 4), rot(-w / 2, -h / 4)),
    ],
  };
}

/**
 * Creates an authentic upward rising sweep (跳ね上げ / はねあげ)
 */
function createRisingSweep(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  startW: number = 50,
  tipW: number = 6
): PathContour {
  return {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(x1, y1),
      cNode(x1 + startW, y1 + 10),
      cNode(x2, y2),
      cNode(x2 - tipW, y2 - 6),
      cNode(x1 + 10, y1 + startW * 0.8),
    ],
  };
}

/**
 * Creates a traditional hollow box (口, 日, 目, 囗) with proper thickness & optical alignment
 */
function createBoxContour(
  x: number,
  y: number,
  w: number,
  h: number,
  strokeW: number = 42,
  innerCrossbars: number = 0
): PathContour[] {
  const outer: PathContour = {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(x, y),
      cNode(x + w, y),
      cNode(x + w, y + h),
      cNode(x, y + h),
    ],
  };

  const inner: PathContour = {
    id: generateId(),
    closed: true,
    nodes: [
      cNode(x + strokeW, y + strokeW),
      cNode(x + w - strokeW, y + strokeW),
      cNode(x + w - strokeW, y + h - strokeW),
      cNode(x + strokeW, y + h - strokeW),
    ],
  };

  const contours: PathContour[] = [outer, inner];

  if (innerCrossbars > 0) {
    const innerH = h - strokeW * 2;
    const step = innerH / (innerCrossbars + 1);
    for (let i = 1; i <= innerCrossbars; i++) {
      const barY = y + strokeW + step * i - (strokeW * 0.75) / 2;
      contours.push(
        createHorizontalStroke(x + strokeW, barY, w - strokeW * 2, strokeW * 0.75)
      );
    }
  }

  return contours;
}

export const KANJI_RADICALS: KanjiRadical[] = [
  // ==========================================
  // 偏 (HEN) - LEFT-SIDE RADICALS
  // ==========================================
  {
    id: 'rad_ninben',
    name: 'にんべん (亻)',
    char: '亻',
    category: 'hen',
    contours: [
      // Elegant tapered harai
      createLeftHarai(295, 175, 125, 520, 48, 0.42),
      // Clean vertical stem
      createVerticalStroke(228, 385, 46, 455),
    ],
  },
  {
    id: 'rad_sanzui',
    name: 'さんずい (氵)',
    char: '氵',
    category: 'hen',
    contours: [
      // Top teardrop dot
      createDot(235, 235, 56, 76, 28),
      // Middle teardrop dot
      createDot(195, 465, 52, 72, 32),
      // Bottom rising dynamic sweep
      createRisingSweep(140, 815, 335, 625, 54, 8),
    ],
  },
  {
    id: 'rad_kihen',
    name: 'きへん (木)',
    char: '木',
    category: 'hen',
    contours: [
      // Top horizontal
      createHorizontalStroke(105, 380, 290, 44, { slant: 14 }),
      // Central vertical
      createVerticalStroke(242, 185, 46, 645),
      // Left graceful sweeping harai
      createLeftHarai(242, 420, 105, 785, 42, 0.45),
      // Right balanced dot/stop
      createDot(325, 570, 48, 80, -32),
    ],
  },
  {
    id: 'rad_tehen',
    name: 'てへん (扌)',
    char: '扌',
    category: 'hen',
    contours: [
      // Upper horizontal
      createHorizontalStroke(115, 320, 270, 44, { slant: 15 }),
      // Vertical hooked stem
      createVerticalStroke(252, 175, 46, 655, { hookLeft: true, hookW: 55, hookH: 60 }),
      // Rising upward diagonal sweep
      createRisingSweep(110, 680, 370, 500, 48, 8),
    ],
  },
  {
    id: 'rad_gonben',
    name: 'ごんべん (言)',
    char: '言',
    category: 'hen',
    contours: [
      // Top dot
      createDot(240, 205, 56, 75, 30),
      // Long top horizontal bar
      createHorizontalStroke(120, 280, 245, 42, { slant: 8 }),
      // Middle bars
      createHorizontalStroke(152, 355, 180, 36, { slant: 6 }),
      createHorizontalStroke(152, 425, 180, 36, { slant: 6 }),
      // Mouth (口) with genuine proportions
      ...createBoxContour(148, 510, 190, 270, 40),
    ],
  },
  {
    id: 'rad_itohen',
    name: 'いとへん (糸)',
    char: '糸',
    category: 'hen',
    contours: [
      // Upper knot horizontal & diagonals
      createHorizontalStroke(155, 185, 155, 40, { slant: 8 }),
      createLeftHarai(250, 225, 145, 365, 42, 0.35),
      createHorizontalStroke(135, 355, 195, 40, { slant: 10 }),
      createLeftHarai(275, 395, 135, 535, 44, 0.35),
      // Lower vertical stem
      createVerticalStroke(215, 530, 44, 300),
      // Left dot
      createDot(145, 665, 42, 65, 25),
      // Right dot
      createDot(290, 665, 42, 65, -25),
    ],
  },
  {
    id: 'rad_nogihen',
    name: 'のぎへん (禾)',
    char: '禾',
    category: 'hen',
    contours: [
      // Top slant
      createLeftHarai(330, 205, 150, 275, 42, 0.25),
      // Horizontal bar
      createHorizontalStroke(110, 400, 275, 44, { slant: 12 }),
      // Vertical stem
      createVerticalStroke(240, 285, 46, 545),
      // Left harai
      createLeftHarai(240, 445, 105, 785, 42, 0.45),
      // Right dot
      createDot(325, 570, 46, 75, -30),
    ],
  },
  {
    id: 'rad_kanehen',
    name: 'かねへん (金)',
    char: '金',
    category: 'hen',
    contours: [
      // Top roof harai
      createLeftHarai(245, 165, 105, 340, 44, 0.35),
      createDot(250, 240, 46, 70, -25),
      // Horizontal bars
      createHorizontalStroke(145, 340, 200, 38, { slant: 6 }),
      createHorizontalStroke(130, 440, 230, 40, { slant: 6 }),
      // Central vertical
      createVerticalStroke(230, 340, 42, 380),
      // Middle dots
      createDot(165, 540, 40, 60, 35),
      createDot(305, 540, 40, 60, -35),
      // Bottom long rising bar
      createHorizontalStroke(100, 720, 290, 46, { slant: 16 }),
    ],
  },
  {
    id: 'rad_hihen',
    name: 'ひへん (日)',
    char: '日',
    category: 'hen',
    contours: createBoxContour(145, 230, 195, 560, 42, 1),
  },
  {
    id: 'rad_tsukihen',
    name: 'つきへん・肉月 (月)',
    char: '月',
    category: 'hen',
    contours: [
      // Left sweeping outer stroke
      createLeftHarai(150, 205, 125, 835, 44, 0.20),
      // Right vertical with hook
      createVerticalStroke(290, 205, 44, 630, { hookLeft: true, hookW: 55, hookH: 60 }),
      // Top horizontal
      createHorizontalStroke(150, 205, 184, 42),
      // Inner crossbars
      createHorizontalStroke(180, 395, 120, 36),
      createHorizontalStroke(180, 565, 120, 36),
    ],
  },
  {
    id: 'rad_kuchihen',
    name: 'くちへん (口)',
    char: '口',
    category: 'hen',
    contours: createBoxContour(130, 340, 230, 320, 44),
  },
  {
    id: 'rad_tsuchihen',
    name: 'つちへん (土)',
    char: '土',
    category: 'hen',
    contours: [
      createHorizontalStroke(135, 355, 210, 44, { slant: 12 }),
      createVerticalStroke(230, 205, 46, 520),
      createRisingSweep(110, 725, 360, 605, 52, 8),
    ],
  },
  {
    id: 'rad_onnahen',
    name: 'おんなへん (女)',
    char: '女',
    category: 'hen',
    contours: [
      // Left diagonal slash turning right
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(275, 180),
          cNode(320, 185),
          cNode(155, 595),
          cNode(365, 545),
          cNode(365, 595),
          cNode(115, 650),
        ],
      },
      // Crossing sweeping harai
      createLeftHarai(280, 340, 105, 835, 44, 0.42),
      // Piercing horizontal rising bar
      createHorizontalStroke(95, 470, 305, 44, { slant: 22 }),
    ],
  },
  {
    id: 'rad_risshinben',
    name: 'りっしんべん (忄)',
    char: '忄',
    category: 'hen',
    contours: [
      createDot(150, 385, 46, 75, 35),
      createDot(315, 365, 44, 70, -25),
      createVerticalStroke(230, 175, 48, 675),
    ],
  },
  {
    id: 'rad_hihen_fire',
    name: 'ひへん (火)',
    char: '火',
    category: 'hen',
    contours: [
      createDot(145, 385, 44, 70, 30),
      createLeftHarai(240, 220, 105, 805, 42, 0.42),
      createDot(280, 440, 46, 75, -25),
      createDot(330, 640, 48, 80, -35),
    ],
  },
  {
    id: 'rad_mehen',
    name: 'めへん (目)',
    char: '目',
    category: 'hen',
    contours: createBoxContour(145, 230, 195, 560, 42, 2),
  },
  {
    id: 'rad_kurumahen',
    name: 'くるまへん (車)',
    char: '車',
    category: 'hen',
    contours: [
      createHorizontalStroke(135, 240, 210, 40, { slant: 8 }),
      ...createBoxContour(130, 330, 220, 250, 40, 1),
      createHorizontalStroke(95, 645, 290, 46, { slant: 18 }),
      createVerticalStroke(228, 175, 46, 675),
    ],
  },
  {
    id: 'rad_kaihen',
    name: 'かいへん (貝)',
    char: '貝',
    category: 'hen',
    contours: [
      ...createBoxContour(135, 220, 210, 440, 40, 2),
      createLeftHarai(200, 665, 120, 815, 40, 0.35),
      createDot(285, 740, 46, 75, -35),
    ],
  },
  {
    id: 'rad_yumihen',
    name: 'ゆみへん (弓)',
    char: '弓',
    category: 'hen',
    contours: [
      createHorizontalStroke(140, 235, 185, 42, { slant: 6 }),
      createVerticalStroke(140, 235, 44, 210),
      createHorizontalStroke(140, 405, 160, 40, { slant: 6 }),
      createVerticalStroke(256, 405, 44, 180),
      createHorizontalStroke(140, 545, 160, 40, { slant: 6 }),
      createVerticalStroke(140, 545, 44, 280, { hookRight: true, hookW: 55, hookH: 60 }),
    ],
  },
  {
    id: 'rad_kozatohen',
    name: 'こざとへん (阝)',
    char: '阝',
    category: 'hen',
    contours: [
      // Vertical stem
      createVerticalStroke(160, 185, 46, 655),
      // Upper lobe
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(185, 230),
          cNode(310, 230),
          sNode(350, 310, { x: 350, y: 260 }, { x: 350, y: 360 }),
          cNode(205, 410),
          cNode(205, 370),
          sNode(305, 310, { x: 305, y: 350 }, { x: 305, y: 270 }),
          cNode(185, 270),
        ],
      },
      // Lower lobe
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(205, 410),
          cNode(325, 410),
          sNode(365, 520, { x: 365, y: 460 }, { x: 365, y: 580 }),
          cNode(195, 630),
          cNode(195, 590),
          sNode(320, 520, { x: 320, y: 570 }, { x: 320, y: 470 }),
          cNode(205, 450),
        ],
      },
    ],
  },

  // ==========================================
  // 旁 (TSUKURI) - RIGHT-SIDE RADICALS
  // ==========================================
  {
    id: 'rad_rittou',
    name: 'りっとう (刂)',
    char: '刂',
    category: 'tsukuri',
    contours: [
      // Left short vertical
      createVerticalStroke(590, 285, 46, 260),
      // Right long vertical with hook
      createVerticalStroke(765, 180, 48, 665, { hookLeft: true, hookW: 60, hookH: 70 }),
    ],
  },
  {
    id: 'rad_chikara',
    name: 'ちから (力)',
    char: '力',
    category: 'tsukuri',
    contours: [
      // Sweeping left harai
      createLeftHarai(715, 180, 490, 815, 48, 0.44),
      // Hooked shoulder
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(520, 310),
          cNode(790, 280),
          cNode(815, 290),
          cNode(780, 680),
          cNode(720, 630),
          cNode(735, 600),
          cNode(745, 340),
          cNode(520, 360),
        ],
      },
    ],
  },
  {
    id: 'rad_nobun',
    name: 'のぶん (攵)',
    char: '攵',
    category: 'tsukuri',
    contours: [
      // Top left harai
      createLeftHarai(715, 180, 560, 340, 44, 0.30),
      // Upper horizontal
      createHorizontalStroke(550, 320, 270, 42, { slant: 10 }),
      // Center sweeping harai
      createLeftHarai(720, 345, 510, 815, 46, 0.42),
      // Right long sweeping harai
      createRightHarai(620, 435, 875, 825, 52),
    ],
  },
  {
    id: 'rad_furutori',
    name: 'ふるとり (隹)',
    char: '隹',
    category: 'tsukuri',
    contours: [
      createLeftHarai(660, 175, 530, 350, 42, 0.30),
      createVerticalStroke(610, 335, 44, 505),
      createHorizontalStroke(570, 325, 280, 40, { slant: 8 }),
      createVerticalStroke(720, 185, 44, 655),
      createHorizontalStroke(645, 445, 215, 38, { slant: 6 }),
      createHorizontalStroke(645, 565, 215, 38, { slant: 6 }),
      createHorizontalStroke(610, 715, 265, 44, { slant: 8 }),
    ],
  },
  {
    id: 'rad_oogai',
    name: 'おおがい (頁)',
    char: '頁',
    category: 'tsukuri',
    contours: [
      createHorizontalStroke(530, 195, 340, 44, { slant: 8 }),
      createLeftHarai(670, 240, 565, 340, 42, 0.28),
      ...createBoxContour(580, 310, 240, 340, 40, 2),
      createLeftHarai(635, 660, 530, 820, 42, 0.38),
      createDot(760, 740, 48, 80, -35),
    ],
  },
  {
    id: 'rad_oozato',
    name: 'おおざと (阝)',
    char: '阝',
    category: 'tsukuri',
    contours: [
      // Vertical stem
      createVerticalStroke(760, 185, 48, 655),
      // Upper lobe
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(570, 230),
          cNode(720, 230),
          sNode(755, 310, { x: 755, y: 260 }, { x: 755, y: 360 }),
          cNode(600, 410),
          cNode(600, 370),
          sNode(710, 310, { x: 710, y: 350 }, { x: 710, y: 270 }),
          cNode(570, 270),
        ],
      },
      // Lower lobe
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(600, 410),
          cNode(730, 410),
          sNode(770, 520, { x: 770, y: 460 }, { x: 770, y: 580 }),
          cNode(590, 630),
          cNode(590, 590),
          sNode(725, 520, { x: 725, y: 570 }, { x: 725, y: 470 }),
          cNode(600, 450),
        ],
      },
    ],
  },
  {
    id: 'rad_miru',
    name: 'みる (見)',
    char: '見',
    category: 'tsukuri',
    contours: [
      ...createBoxContour(560, 190, 270, 420, 42, 2),
      createLeftHarai(630, 615, 520, 830, 44, 0.40),
      createVerticalStroke(735, 615, 46, 185, { hookRight: true, hookW: 60, hookH: 60 }),
    ],
  },

  // ==========================================
  // 冠 (KANMURI) - TOP-SIDE RADICALS
  // ==========================================
  {
    id: 'rad_kusakanmuri',
    name: 'くさかんむり (艹)',
    char: '艹',
    category: 'kanmuri',
    contours: [
      // Long sweeping horizontal
      createHorizontalStroke(135, 260, 730, 46, { slant: 10 }),
      // Left vertical post with slight inward angle
      createVerticalStroke(340, 160, 46, 195),
      // Right vertical post with slight inward angle
      createVerticalStroke(615, 160, 46, 195),
    ],
  },
  {
    id: 'rad_ukanmuri',
    name: 'うかんむり (宀)',
    char: '宀',
    category: 'kanmuri',
    contours: [
      // Top central dot
      createDot(500, 170, 54, 74, 15),
      // Left downward dot/post
      createDot(205, 270, 48, 70, 25),
      // Right hooked roof contour
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(205, 235),
          cNode(795, 235),
          cNode(810, 245),
          cNode(775, 365),
          cNode(720, 325),
          cNode(735, 280),
          cNode(205, 280),
        ],
      },
    ],
  },
  {
    id: 'rad_takekanmuri',
    name: 'たけかんむり (⺮)',
    char: '⺮',
    category: 'kanmuri',
    contours: [
      // Left half
      createLeftHarai(330, 160, 205, 270, 42, 0.28),
      createHorizontalStroke(215, 260, 180, 40, { slant: 8 }),
      createVerticalStroke(345, 260, 42, 100),
      // Right half
      createLeftHarai(665, 160, 540, 270, 42, 0.28),
      createHorizontalStroke(550, 260, 185, 40, { slant: 8 }),
      createDot(755, 285, 44, 75, -30),
    ],
  },
  {
    id: 'rad_amekanmuri',
    name: 'あめかんむり (⻗)',
    char: '⻗',
    category: 'kanmuri',
    contours: [
      createHorizontalStroke(220, 160, 560, 44, { slant: 6 }),
      createVerticalStroke(478, 160, 44, 250),
      // Outer roof box
      createVerticalStroke(180, 235, 44, 175),
      createVerticalStroke(775, 235, 44, 175),
      createHorizontalStroke(180, 235, 640, 42, { slant: 6 }),
      // 4 Raindrops
      createDot(310, 310, 38, 55, 30),
      createDot(410, 310, 38, 55, 30),
      createDot(590, 310, 38, 55, -30),
      createDot(690, 310, 38, 55, -30),
    ],
  },
  {
    id: 'rad_hitoyane',
    name: 'ひとやね (𠆢)',
    char: '𠆢',
    category: 'kanmuri',
    contours: [
      createLeftHarai(500, 160, 135, 445, 52, 0.44),
      createRightHarai(495, 160, 865, 445, 54),
    ],
  },
  {
    id: 'rad_wakanmuri',
    name: 'わかんむり (冖)',
    char: '冖',
    category: 'kanmuri',
    contours: [
      createVerticalStroke(195, 245, 44, 140),
      createHorizontalStroke(195, 245, 610, 44),
      createVerticalStroke(760, 245, 44, 140, { hookLeft: true, hookW: 55, hookH: 60 }),
    ],
  },
  {
    id: 'rad_nabebuta',
    name: 'なべぶた (亠)',
    char: '亠',
    category: 'kanmuri',
    contours: [
      createDot(500, 165, 52, 75, 15),
      createHorizontalStroke(155, 275, 690, 46, { slant: 8 }),
    ],
  },
  {
    id: 'rad_anakanmuri',
    name: 'あなかんむり (穴)',
    char: '穴',
    category: 'kanmuri',
    contours: [
      createDot(500, 160, 52, 70, 15),
      createHorizontalStroke(215, 245, 570, 44, { slant: 6 }),
      createDot(200, 275, 44, 65, 25),
      createDot(760, 275, 44, 65, -25),
      createLeftHarai(380, 305, 270, 420, 38, 0.30),
      createDot(620, 360, 42, 65, -30),
    ],
  },

  // ==========================================
  // 脚 (ASHI) - BOTTOM-SIDE RADICALS
  // ==========================================
  {
    id: 'rad_kokoro',
    name: 'こころ (心)',
    char: '心',
    category: 'ashi',
    contours: [
      // Left dot
      createDot(215, 675, 48, 75, 35),
      // Main sweeping bed/cradle of heart
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(310, 620),
          sNode(480, 840, { x: 360, y: 780 }, { x: 620, y: 840 }),
          sNode(765, 660, { x: 710, y: 800 }, { x: 790, y: 640 }),
          cNode(780, 600),
          cNode(740, 625),
          sNode(480, 785, { x: 600, y: 785 }, { x: 380, y: 740 }),
          cNode(310, 620),
        ],
      },
      // Center dot
      createDot(455, 650, 46, 70, -15),
      // Right upper dot
      createDot(785, 610, 48, 75, -35),
    ],
  },
  {
    id: 'rad_rekka',
    name: 'れっか・れんが (灬)',
    char: '灬',
    category: 'ashi',
    contours: [
      createDot(210, 755, 52, 85, 38),
      createDot(400, 745, 46, 75, 15),
      createDot(590, 745, 46, 75, -15),
      createDot(790, 740, 52, 85, -38),
    ],
  },
  {
    id: 'rad_hitoashi',
    name: 'ひとあし (儿)',
    char: '儿',
    category: 'ashi',
    contours: [
      createLeftHarai(375, 580, 195, 835, 48, 0.42),
      createVerticalStroke(615, 580, 48, 220, { hookRight: true, hookW: 75, hookH: 75 }),
    ],
  },
  {
    id: 'rad_sara',
    name: 'さら (皿)',
    char: '皿',
    category: 'ashi',
    contours: [
      createHorizontalStroke(215, 615, 570, 42, { slant: 6 }),
      createVerticalStroke(200, 615, 44, 215),
      createVerticalStroke(755, 615, 44, 215),
      createVerticalStroke(390, 640, 40, 160),
      createVerticalStroke(570, 640, 40, 160),
      createHorizontalStroke(140, 800, 720, 52, { slant: 6 }),
    ],
  },

  // ==========================================
  // 構え (KAMAE) - ENCLOSURE RADICALS
  // ==========================================
  {
    id: 'rad_mongamae',
    name: 'もんがまえ (門)',
    char: '門',
    category: 'kamae',
    contours: [
      // Left gate pillar
      createVerticalStroke(165, 175, 46, 680),
      createHorizontalStroke(165, 230, 240, 40),
      createVerticalStroke(360, 230, 44, 260),
      createHorizontalStroke(165, 350, 240, 38),
      createHorizontalStroke(165, 460, 240, 40),
      // Right gate pillar with hook
      createHorizontalStroke(595, 230, 240, 40),
      createVerticalStroke(595, 230, 44, 260),
      createHorizontalStroke(595, 350, 240, 38),
      createHorizontalStroke(595, 460, 240, 40),
      createVerticalStroke(790, 175, 48, 680, { hookLeft: true, hookW: 65, hookH: 70 }),
    ],
  },
  {
    id: 'rad_kunigamae',
    name: 'くにがまえ (囗)',
    char: '囗',
    category: 'kamae',
    contours: createBoxContour(140, 165, 720, 690, 52),
  },
  {
    id: 'rad_hakogamae',
    name: 'はこがまえ (匚)',
    char: '匚',
    category: 'kamae',
    contours: [
      createHorizontalStroke(160, 185, 680, 50, { slant: 6 }),
      createVerticalStroke(160, 185, 52, 650),
      createHorizontalStroke(160, 785, 680, 52, { slant: 6 }),
    ],
  },

  // ==========================================
  // 繞・垂れ (NYO & TARE) - WRAPPING / OVERHANG
  // ==========================================
  {
    id: 'rad_shinnyo',
    name: 'しんにょう (⻌)',
    char: '⻌',
    category: 'nyo',
    contours: [
      // Top dot
      createDot(235, 215, 54, 76, 25),
      // Curved zig-zag neck
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(160, 355),
          cNode(295, 335),
          cNode(325, 345),
          cNode(215, 470),
          cNode(285, 485),
          sNode(310, 540, { x: 310, y: 500 }, { x: 310, y: 580 }),
          cNode(155, 640),
          cNode(135, 595),
          cNode(245, 530),
          cNode(175, 500),
          cNode(240, 410),
          cNode(150, 410),
        ],
      },
      // Broad sweeping ocean wave tail (souwa) that cradles the tsukuri
      {
        id: generateId(),
        closed: true,
        nodes: [
          cNode(155, 640),
          sNode(380, 755, { x: 230, y: 700 }, { x: 530, y: 810 }),
          sNode(760, 835, { x: 650, y: 835 }, { x: 860, y: 835 }),
          cNode(925, 835),
          cNode(900, 875),
          sNode(720, 875, { x: 830, y: 875 }, { x: 580, y: 875 }),
          sNode(340, 810, { x: 480, y: 875 }, { x: 230, y: 745 }),
          cNode(130, 680),
        ],
      },
    ],
  },
  {
    id: 'rad_madare',
    name: 'まだれ (广)',
    char: '广',
    category: 'tare',
    contours: [
      createDot(500, 160, 52, 75, 15),
      createHorizontalStroke(160, 265, 680, 48, { slant: 8 }),
      createLeftHarai(195, 265, 115, 845, 50, 0.36),
    ],
  },
  {
    id: 'rad_yamaidare',
    name: 'やまいだれ (疒)',
    char: '疒',
    category: 'tare',
    contours: [
      createDot(500, 160, 52, 75, 15),
      createHorizontalStroke(160, 265, 680, 48, { slant: 8 }),
      createLeftHarai(195, 265, 115, 845, 50, 0.36),
      createDot(130, 420, 44, 65, 25),
      createDot(165, 610, 42, 65, -30),
    ],
  },
  {
    id: 'rad_shikabane',
    name: 'しかばね (尸)',
    char: '尸',
    category: 'tare',
    contours: [
      createHorizontalStroke(180, 235, 560, 46, { slant: 6 }),
      createVerticalStroke(700, 235, 46, 210),
      createHorizontalStroke(210, 400, 530, 44, { slant: 6 }),
      createLeftHarai(210, 235, 115, 845, 50, 0.38),
    ],
  },
];
