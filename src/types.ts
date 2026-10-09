export interface Point {
  x: number;
  y: number;
}

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
  time?: number;
  pointerType?: string;
}

export type BrushStyle =
  | 'brush'
  | 'signpen'
  | 'sumi'
  | 'marumoji'
  | 'fountain'
  | 'mincho_nib'
  | 'reisho_chisel'
  | 'g_pen'
  | 'pixel_dot'
  | 'marker'
  | 'ballpoint'
  | 'calligraphy'
  | 'highlighter'
  | 'pencil'
  | 'chalk'
  | 'sharp'
  | 'sharp_round'
  | 'wobbly'
  | 'polygon';

export interface PenPresetInfo {
  id: BrushStyle;
  name: string;
  shortName: string;
  category: 'natural' | 'pen' | 'chisel' | 'special';
  description: string;
  defaultWidth: number;
}

export interface PressureCurvePoint {
  x: number; // 0.0 to 1.0 (input pressure fraction)
  y: number; // 0.0 to 1.0 (output thickness fraction)
}

export interface PressureCurveConfig {
  enabled: boolean;
  p1: PressureCurvePoint; // First cubic Bezier control handle (default 0.33, 0.33)
  p2: PressureCurvePoint; // Second cubic Bezier control handle (default 0.67, 0.67)
  minThreshold: number;   // Minimum deadzone below which pressure is 0 (0.0 to 0.3)
  maxThreshold: number;   // Maximum saturation above which pressure is 1 (0.7 to 1.0)
  presetId?: 'linear' | 'soft' | 'hard' | 's-curve' | 'delicate' | 'custom';
}

export interface UserPenPreset {
  id: string;
  name: string;
  isCustom?: boolean;
  brushStyle: BrushStyle;
  brushWidth: number;
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off';
  pressureCurve?: PressureCurveConfig;
  autoSmoothBrush: boolean;
  smoothStrength: 'mild' | 'standard' | 'strong';
  smoothPreserveCorners: boolean;
  autoUnionBrush: boolean;
  smoothingIntensity?: number; // 0 (OFF / Raw) to 100 (Max stabilization)
  createdAt?: number;

  // 入り抜き (Tapering)
  taperStartLength?: number;  // 0 - 100%
  taperEndLength?: number;    // 0 - 100%
  taperStartWidth?: number;   // 0 - 100%
  taperEndWidth?: number;     // 0 - 100%
  taperStartOpacity?: number; // 0 - 100%
  taperEndOpacity?: number;   // 0 - 100%
  taperStartTime?: number;    // 0 - 100%
  taperEndTime?: number;      // 0 - 100%
  forceTaper?: boolean;       // 強制入り抜き
  forceTaperEnd?: boolean;    // 強制抜き
  taperTipShape?: 'round' | 'sharp'; // 入り抜きの形状: 丸まり / 尖り

  // 形状 (Shape & Nib)
  nibAngle?: number;          // 0 - 180°
  nibAspectRatio?: number;    // 0 (丸) - 100% (極平筆・リボン)
  nibFollowDirection?: boolean; // 回転の追従 (進行方向に合わせる)
  nibSpacing?: number;        // 間隔 (1% - 100%)
  constantWidth?: boolean;    // 太さを固定
  antiAlias?: boolean;        // アンチエイリアス

  // ランダム (Random Jitter)
  jitterPosition?: number;    // 位置ランダム (0 - 100%)
  jitterConstrainPerp?: boolean; // 位置ランダムは上下に拘束
  jitterSize?: number;        // 太さランダム (0 - 100%)
  jitterOpacity?: number;     // 不透明度ランダム (0 - 100%)
  jitterAngle?: number;       // 回転ランダム (0 - 100%)
  jitterSpacing?: number;     // 間隔ランダム (0 - 100%)

  // 動的 (Dynamics)
  speedWidthFactor?: number;  // 速度による太さ変化 (-100% to +100%)
  speedOpacityFactor?: number; // 速度による不透明度変化 (-100% to +100%)
  speedFeatherFactor?: number; // 速度によるかすれ (0 - 100%)
  pressureWidthFactor?: number; // 筆圧による太さ変化 (0 - 100%)
  pressureOpacityFactor?: number; // 筆圧による不透明度変化 (0 - 100%)
  pressureFeatherFactor?: number; // 筆圧によるかすれ (0 - 100%)

  // 設定 (Settings & Stabilization)
  stabilizationMethod?: 'pre' | 'post'; // 事前補正 / 事後補正
  speedStabilization?: number; // 高速時補正強度 (0 - 100)
  legacyStabilization?: boolean; // 旧方式の事前補正

  // 質感・インク効果 (Texture & Ink Effects)
  inkBleed?: number;          // 墨にじみ (0 - 100%)
  axisSlant?: number;         // 軸の傾斜角 (-45° to +45°)
  edgeRoughness?: number;     // 輪郭の荒れ (0 - 100%)
  tipSharpness?: number;      // 尖端の鋭利さ (0 - 100%)
  pressureGamma?: number;     // 筆圧ガンマ補正 (0.5 - 2.5)
}

export type NodeType = 'corner' | 'smooth' | 'symmetric';

export interface BezierNode {
  id: string;
  x: number;
  y: number;
  handleIn?: Point | null;   // incoming control point (relative or absolute, we will store absolute coords)
  handleOut?: Point | null;  // outgoing control point (absolute coords)
  type?: NodeType;
}

export interface PathContour {
  id: string;
  nodes: BezierNode[];
  closed: boolean;
}

export type PixelDotShape = 'square' | 'round' | 'squircle' | 'diamond';

export interface PixelGlyphData {
  width: number;
  height: number;
  data: number[]; // 0 or 1 binary array of length width * height
  shape?: PixelDotShape;
  advanceWidthCells?: number;
}

export interface GlyphData {
  unicode: number;
  char: string;
  name: string;
  advanceWidth: number;
  lsb: number;
  contours: PathContour[];
  vectorContoursBackup?: PathContour[];
  pixelData?: PixelGlyphData;
  modified?: boolean;
  notes?: string;
  locked?: boolean;
}

export interface CustomGuideline {
  id: string;
  type: 'h' | 'v' | 'diagonal';
  position: number;
  p1?: { x: number; y: number };
  p2?: { x: number; y: number };
  angle?: number;
  label?: string;
  color?: string;
}

export interface FontMetadata {
  familyName: string;
  styleName: string;
  designer: string;
  designerUrl?: string;
  manufacturer?: string;
  copyright: string;
  license?: string;
  licenseUrl?: string;
  version: string;
  description?: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  lineGap: number;
  capHeight: number;
  xHeight: number;
  // FontForge OS/2 & hhea & post Table Metadata
  usWeightClass?: number; // 100-900 (400=Regular, 700=Bold)
  usWidthClass?: number;  // 1-9 (5=Normal)
  typoAscender?: number;  // OS/2 sTypoAscender
  typoDescender?: number; // OS/2 sTypoDescender
  typoLineGap?: number;   // OS/2 sTypoLineGap
  winAscent?: number;     // OS/2 usWinAscent
  winDescent?: number;    // OS/2 usWinDescent
  italicAngle?: number;   // post italicAngle
  isFixedPitch?: boolean; // post isFixedPitch
  vendorId?: string;      // OS/2 achVendID (e.g. "FTCG")
}

export type ToolMode =
  | 'select'
  | 'node'
  | 'pen'
  | 'brush'
  | 'eraser'
  | 'ruler'
  | 'rect'
  | 'square'
  | 'ellipse'
  | 'circle'
  | 'rounded_rect'
  | 'triangle'
  | 'triangle_down'
  | 'right_triangle'
  | 'semicircle'
  | 'ring'
  | 'pill'
  | 'parallelogram'
  | 'crescent'
  | 'star'
  | 'heart'
  | 'sparkle'
  | 'starburst'
  | 'diamond'
  | 'polygon'
  | 'line'
  | 'hand'
  | 'trace_adjust';

export type ShapeType =
  | 'circle'
  | 'ellipse'
  | 'square'
  | 'rect'
  | 'rounded_rect'
  | 'triangle'
  | 'triangle_down'
  | 'right_triangle'
  | 'star'
  | 'heart'
  | 'sparkle'
  | 'starburst'
  | 'diamond'
  | 'hexagon'
  | 'semicircle'
  | 'ring'
  | 'pill'
  | 'parallelogram'
  | 'crescent';

export interface ShapePreset {
  id: ShapeType;
  name: string;
  category: 'basic' | 'polygon' | 'symbol' | 'decorative';
  description: string;
  iconSvgPath?: string;
}

export interface GlyphOverlaySettings {
  enabled: boolean;
  referenceChar?: string;
  referenceUnicode?: number;
  opacity: number; // 0.1 to 1.0
  color: string; // Hex color code
  renderMode: 'outline' | 'fill' | 'difference';
  offsetX: number;
  offsetY: number;
  scale: number;
  showMetrics: boolean;
}

export interface TraceSettings {
  enabled: boolean;
  type: 'char' | 'image';
  text: string;
  fontFamily: string;
  fontSize: number;
  imageSrc?: string;
  charImages?: Record<number, string>; // Per-glyph individual reference photos
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation?: number; // In degrees
  contrast?: number; // 0.5 to 3.0
  brightness?: number; // 0.5 to 2.0
  grayscale?: boolean;
  invert?: boolean;
  flipH?: boolean;
  flipV?: boolean;
}

export interface SnapGuideLine {
  id: string;
  type: 'h' | 'v' | 'diagonal';
  position: number;
  targetName: string;
  targetType: 'baseline' | 'lsb' | 'rsb' | 'metric' | 'contour' | 'center' | 'custom' | 'grid';
  color?: string;
  snapPoint?: Point;
  matchedSource?: string;
  p1?: Point;
  p2?: Point;
  angle?: number;
}

export type JapaneseGuidePattern = 'none' | 'cross' | 'tian' | 'jiugong' | 'mi' | 'sixteen';
export type VerticalGuidePattern = 'none' | 'center' | 'thirds' | 'quarters' | 'eighths';

export interface GridSettings {
  showGrid: boolean;
  gridSize: number;
  snapToGrid: boolean;
  snapToPoints: boolean;
  snapToGuides?: boolean;
  showMetrics: boolean;
  showPoints: boolean;
  showHandles: boolean;
  showRulers?: boolean;
  japaneseGuide?: JapaneseGuidePattern; // 'cross' (十), 'tian' (田), 'jiugong' (九宮格 3x3), 'mi' (米字格), 'sixteen' (十六宮格 4x4)
  verticalGuide?: VerticalGuidePattern; // 'center' (X=500), 'thirds' (1/3, 2/3), 'quarters' (1/4, 2/4, 3/4), 'eighths' (8等分)
  showVerticalCenter?: boolean; // 左右中心線 (X=500)
  showVerticalGuides?: boolean; // 縦分割線 (1/4, 1/3, 1/8等)
  showBodyFrame?: boolean; // 漢字字面枠 85% (850x850)
  showKanaFrame?: boolean; // 仮名字面枠 78% (780x780)
  gridOpacity?: number; // グリッド・ガイド線の濃度 (10〜100%、デフォルト30%)
  highContrastCursor?: boolean; // 高コントラストカーソル (二重輪郭・見失い防止)
  showCursorCrosshair?: boolean; // カーソル追従照準線・照準リング
}

export interface KanjiRadical {
  id: string;
  name: string;
  char: string;
  category: 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'tare' | 'nyo' | 'kamae' | 'basic';
  contours: PathContour[];
}

export type RadicalPlacement = 'auto' | 'original' | 'hen' | 'tsukuri' | 'kanmuri' | 'ashi' | 'center_small';

export type PartCategory =
  | 'all'
  | 'hen'
  | 'tsukuri'
  | 'kanmuri'
  | 'ashi'
  | 'tare'
  | 'nyo'
  | 'kamae'
  | 'stroke'
  | 'geometric'
  | 'kana'
  | 'other';

export interface CustomPart {
  id: string;
  name: string;
  category?: PartCategory;
  description?: string;
  contours: PathContour[];
  createdAt: number;
  updatedAt?: number;
  tags?: string[];
}

export interface CharCategory {
  id: string;
  name: string;
  nameEn: string;
  range?: [number, number];
  chars?: string[];
  charList?: { char: string; code: number; name?: string }[];
}

export interface OpenTypeFeatureLigature {
  id: string;
  type: 'liga' | 'dlig' | 'rlig';
  name: string;
  inputChars: string[];
  substituteUnicode: number;
  enabled: boolean;
}

export interface VerticalWritingGlyphSub {
  id: string;
  sourceUnicode: number;
  vertUnicode: number;
  yOffset?: number;
  xOffset?: number;
  vertAdvanceHeight?: number;
  enabled: boolean;
}

export interface OpenTypeFeaturesConfig {
  enabled: boolean;
  verticalWriting: {
    enabled: boolean;
    defaultVertAdvance: number;
    vertOriginY: number;
    substitutions: VerticalWritingGlyphSub[];
  };
  ligatures: OpenTypeFeatureLigature[];
  customKerningPairs: {
    id: string;
    firstUnicode: number;
    secondUnicode: number;
    amount: number;
    enabled: boolean;
  }[];
}

export interface PixelFontProjectSettings {
  isPixelFontProject?: boolean;
  defaultWidth: number;
  defaultHeight: number;
  dotShape: 'square' | 'round' | 'squircle' | 'diamond';
  mergeContours: boolean;
  proportionalSpacing?: boolean;
}

export interface FontProject {
  id: string;
  name: string;
  metadata: FontMetadata;
  glyphs: Record<number, GlyphData>;
  kerning?: Record<string, number>; // Pair string "char1,char2" or "unicode1,unicode2" -> offset in font units
  openTypeFeatures?: OpenTypeFeaturesConfig;
  pixelFontSettings?: PixelFontProjectSettings;
  createdAt: number;
  updatedAt: number;
}
