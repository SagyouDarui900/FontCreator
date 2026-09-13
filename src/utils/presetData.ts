import { UserPenPreset, BrushStyle } from '../types';

export const DEFAULT_PEN_PRESETS: UserPenPreset[] = [
  {
    id: 'preset-brush-standard',
    name: '毛筆・かな用（高感度・標準補正）',
    brushStyle: 'brush',
    brushWidth: 42,
    pressureSensitivity: 'high',
    autoSmoothBrush: true,
    smoothStrength: 'standard',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-fountain-nib',
    name: '高級万年筆（繊細・細字）',
    brushStyle: 'fountain',
    brushWidth: 26,
    pressureSensitivity: 'high',
    autoSmoothBrush: true,
    smoothStrength: 'mild',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-calligraphy-chisel',
    name: '西洋カリグラフィー（固定45°）',
    brushStyle: 'calligraphy',
    brushWidth: 38,
    pressureSensitivity: 'normal',
    autoSmoothBrush: true,
    smoothStrength: 'mild',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-sumi-thick',
    name: '和風・墨だまり筆（力強い太字）',
    brushStyle: 'sumi',
    brushWidth: 54,
    pressureSensitivity: 'high',
    autoSmoothBrush: true,
    smoothStrength: 'standard',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-signpen-uniform',
    name: '均一サインペン（筆圧OFF・強力補正）',
    brushStyle: 'signpen',
    brushWidth: 22,
    pressureSensitivity: 'off',
    autoSmoothBrush: true,
    smoothStrength: 'strong',
    smoothPreserveCorners: false,
    autoUnionBrush: false,
  },
  {
    id: 'preset-marumoji-pop',
    name: '丸文字ポップペン（筆圧OFF・丸角）',
    brushStyle: 'marumoji',
    brushWidth: 36,
    pressureSensitivity: 'off',
    autoSmoothBrush: true,
    smoothStrength: 'strong',
    smoothPreserveCorners: false,
    autoUnionBrush: false,
  },
  {
    id: 'preset-pencil-sketch',
    name: 'スケッチ鉛筆（高感度・ナチュラル）',
    brushStyle: 'pencil',
    brushWidth: 16,
    pressureSensitivity: 'high',
    autoSmoothBrush: false,
    smoothStrength: 'mild',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-sharp-angular',
    name: 'カクカク角筆（直線・幾何学ピクセル調）',
    brushStyle: 'sharp',
    brushWidth: 36,
    pressureSensitivity: 'off',
    autoSmoothBrush: false,
    smoothStrength: 'mild',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
  {
    id: 'preset-sharp-round',
    name: 'カクカク角丸筆（幾何学骨格・モダン角丸）',
    brushStyle: 'sharp_round',
    brushWidth: 36,
    pressureSensitivity: 'off',
    autoSmoothBrush: false,
    smoothStrength: 'mild',
    smoothPreserveCorners: true,
    autoUnionBrush: false,
  },
];

const PRESETS_STORAGE_KEY = 'mojisaku_user_pen_presets';
const STICKY_BRUSH_MEMORY_KEY = 'mojisaku_sticky_brush_configs';

export interface StickyBrushConfig {
  brushWidth: number;
  pressureSensitivity: 'high' | 'normal' | 'low' | 'off';
  autoSmoothBrush?: boolean;
  smoothStrength?: 'mild' | 'standard' | 'strong';
  smoothPreserveCorners?: boolean;
  autoUnionBrush?: boolean;
}

export const DEFAULT_BRUSH_CONFIGS: Record<BrushStyle, StickyBrushConfig> = {
  brush: { brushWidth: 42, pressureSensitivity: 'high', autoSmoothBrush: true, smoothStrength: 'standard', smoothPreserveCorners: true, autoUnionBrush: false },
  fountain: { brushWidth: 26, pressureSensitivity: 'high', autoSmoothBrush: true, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  calligraphy: { brushWidth: 38, pressureSensitivity: 'normal', autoSmoothBrush: true, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  sumi: { brushWidth: 54, pressureSensitivity: 'high', autoSmoothBrush: true, smoothStrength: 'standard', smoothPreserveCorners: true, autoUnionBrush: false },
  signpen: { brushWidth: 22, pressureSensitivity: 'off', autoSmoothBrush: true, smoothStrength: 'strong', smoothPreserveCorners: false, autoUnionBrush: false },
  marumoji: { brushWidth: 36, pressureSensitivity: 'off', autoSmoothBrush: true, smoothStrength: 'strong', smoothPreserveCorners: false, autoUnionBrush: false },
  marker: { brushWidth: 32, pressureSensitivity: 'off', autoSmoothBrush: true, smoothStrength: 'standard', smoothPreserveCorners: false, autoUnionBrush: false },
  ballpoint: { brushWidth: 14, pressureSensitivity: 'normal', autoSmoothBrush: true, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  highlighter: { brushWidth: 40, pressureSensitivity: 'off', autoSmoothBrush: true, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  pencil: { brushWidth: 16, pressureSensitivity: 'high', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  chalk: { brushWidth: 28, pressureSensitivity: 'normal', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  sharp: { brushWidth: 36, pressureSensitivity: 'off', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  sharp_round: { brushWidth: 36, pressureSensitivity: 'off', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  wobbly: { brushWidth: 24, pressureSensitivity: 'normal', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
  polygon: { brushWidth: 32, pressureSensitivity: 'off', autoSmoothBrush: false, smoothStrength: 'mild', smoothPreserveCorners: true, autoUnionBrush: false },
};

export function loadStickyBrushConfigs(): Record<BrushStyle, StickyBrushConfig> {
  try {
    const stored = localStorage.getItem(STICKY_BRUSH_MEMORY_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_BRUSH_CONFIGS, ...parsed };
    }
  } catch (e) {
    console.warn('Failed to load sticky brush configs from localStorage', e);
  }
  return { ...DEFAULT_BRUSH_CONFIGS };
}

export function saveStickyBrushConfig(style: BrushStyle, config: Partial<StickyBrushConfig>): void {
  try {
    const current = loadStickyBrushConfigs();
    current[style] = {
      ...(current[style] || DEFAULT_BRUSH_CONFIGS[style] || { brushWidth: 30, pressureSensitivity: 'normal' }),
      ...config,
    };
    localStorage.setItem(STICKY_BRUSH_MEMORY_KEY, JSON.stringify(current));
  } catch (e) {
    console.warn('Failed to save sticky brush config', e);
  }
}

export function loadUserPenPresets(): UserPenPreset[] {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load pen presets from localStorage', e);
  }
  return DEFAULT_PEN_PRESETS;
}

export function saveUserPenPresets(presets: UserPenPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save pen presets to localStorage', e);
  }
}
