import { useState, useEffect, useCallback } from 'react';
import { ThemeMode, isLightTheme, getThemeClasses, getThemePreset } from '../utils/theme';

export const THEME_STORAGE_KEY = 'font_editor_theme_mode';

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (error) {
      console.warn('テーマ設定を読み込めませんでした:', error);
    }
    const validThemes: ThemeMode[] = ['light', 'dark', 'sepia', 'warm', 'nord', 'monochrome'];
    return saved && validThemes.includes(saved as ThemeMode) ? (saved as ThemeMode) : 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isLight = isLightTheme(theme);
  const themeClasses = getThemeClasses(theme);
  const currentPreset = getThemePreset(theme);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (isLightTheme(prev) ? 'dark' : 'light'));
  }, []);

  return {
    theme,
    setTheme,
    changeTheme: setTheme,
    toggleTheme,
    isLight,
    themeClasses,
    currentPreset,
  };
}
