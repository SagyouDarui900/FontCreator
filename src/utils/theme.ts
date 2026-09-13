export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  mode: ThemeMode;
  bgMain: string;
  bgSub: string;
  bgCanvas: string;
  borderMain: string;
  borderSub: string;
  textMain: string;
  textSub: string;
  textMuted: string;
  accentGreen: string;
  accentGreenHover: string;
  accentGreenLight: string;
  accentGreenDark: string;
  headerBg: string;
  cardBg: string;
}
