import { UNICODE_CATEGORIES, getCategoryCharList as getCategoryCharListRaw } from '../data/unicodeTables';
import { CharCategory, GlyphData } from '../types';

export interface NavGlyphItem {
  unicode: number;
  char: string;
}

/**
 * Cache for category character lists to ensure blazing fast navigation
 */
const categoryCache = new Map<string, NavGlyphItem[]>();

export function getNavCharListForCategory(category: CharCategory): NavGlyphItem[] {
  if (categoryCache.has(category.id)) {
    return categoryCache.get(category.id)!;
  }
  const rawList = getCategoryCharListRaw(category);
  const mapped: NavGlyphItem[] = rawList.map((item) => ({
    unicode: item.code,
    char: item.char,
  }));
  categoryCache.set(category.id, mapped);
  return mapped;
}

/**
 * Identify which category a Unicode code point belongs to
 */
export function getCategoryForUnicode(unicode: number): CharCategory | null {
  for (const cat of UNICODE_CATEGORIES) {
    const list = getNavCharListForCategory(cat);
    if (list.some((item) => item.unicode === unicode)) {
      return cat;
    }
  }
  return null;
}

/**
 * Find the next glyph in sequential order within the current category or global list
 */
export function getNextGlyphNav(
  currentUnicode: number,
  activeCategory?: CharCategory | null
): NavGlyphItem {
  const cat = activeCategory || getCategoryForUnicode(currentUnicode) || UNICODE_CATEGORIES[0];
  const list = getNavCharListForCategory(cat);
  if (list.length === 0) {
    return { unicode: currentUnicode + 1, char: String.fromCodePoint(currentUnicode + 1) };
  }

  const idx = list.findIndex((c) => c.unicode === currentUnicode);
  if (idx === -1) {
    return list[0];
  }

  if (idx < list.length - 1) {
    return list[idx + 1];
  }

  // Next category wrap-around
  const catIdx = UNICODE_CATEGORIES.findIndex((c) => c.id === cat.id);
  const nextCat = UNICODE_CATEGORIES[(catIdx + 1) % UNICODE_CATEGORIES.length];
  const nextList = getNavCharListForCategory(nextCat);
  return nextList[0] || list[0];
}

/**
 * Find the previous glyph in sequential order within the current category or global list
 */
export function getPrevGlyphNav(
  currentUnicode: number,
  activeCategory?: CharCategory | null
): NavGlyphItem {
  const cat = activeCategory || getCategoryForUnicode(currentUnicode) || UNICODE_CATEGORIES[0];
  const list = getNavCharListForCategory(cat);
  if (list.length === 0) {
    const prevCode = Math.max(0x20, currentUnicode - 1);
    return { unicode: prevCode, char: String.fromCodePoint(prevCode) };
  }

  const idx = list.findIndex((c) => c.unicode === currentUnicode);
  if (idx === -1) {
    return list[list.length - 1];
  }

  if (idx > 0) {
    return list[idx - 1];
  }

  // Prev category wrap-around
  const catIdx = UNICODE_CATEGORIES.findIndex((c) => c.id === cat.id);
  const prevCat = UNICODE_CATEGORIES[(catIdx - 1 + UNICODE_CATEGORIES.length) % UNICODE_CATEGORIES.length];
  const prevList = getNavCharListForCategory(prevCat);
  return prevList[prevList.length - 1] || list[0];
}

/**
 * Find the next uncompleted glyph (a glyph that has 0 contours or no strokes)
 */
export function getNextUncompletedGlyphNav(
  currentUnicode: number,
  glyphs: Record<number, GlyphData>,
  activeCategory?: CharCategory | null
): NavGlyphItem | null {
  const cat = activeCategory || getCategoryForUnicode(currentUnicode) || UNICODE_CATEGORIES[0];
  const list = getNavCharListForCategory(cat);
  const currentIdx = list.findIndex((c) => c.unicode === currentUnicode);

  // 1. Search remaining items in current category
  for (let i = currentIdx + 1; i < list.length; i++) {
    const item = list[i];
    const g = glyphs[item.unicode];
    if (!g || !g.contours || g.contours.length === 0) {
      return item;
    }
  }

  // 2. Wrap around inside current category
  for (let i = 0; i <= currentIdx; i++) {
    const item = list[i];
    if (item.unicode === currentUnicode) continue;
    const g = glyphs[item.unicode];
    if (!g || !g.contours || g.contours.length === 0) {
      return item;
    }
  }

  // 3. Search across subsequent categories
  const catIdx = UNICODE_CATEGORIES.findIndex((c) => c.id === cat.id);
  for (let step = 1; step < UNICODE_CATEGORIES.length; step++) {
    const nextCat = UNICODE_CATEGORIES[(catIdx + step) % UNICODE_CATEGORIES.length];
    const nextList = getNavCharListForCategory(nextCat);
    for (const item of nextList) {
      const g = glyphs[item.unicode];
      if (!g || !g.contours || g.contours.length === 0) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Find the previous uncompleted glyph
 */
export function getPrevUncompletedGlyphNav(
  currentUnicode: number,
  glyphs: Record<number, GlyphData>,
  activeCategory?: CharCategory | null
): NavGlyphItem | null {
  const cat = activeCategory || getCategoryForUnicode(currentUnicode) || UNICODE_CATEGORIES[0];
  const list = getNavCharListForCategory(cat);
  const currentIdx = list.findIndex((c) => c.unicode === currentUnicode);

  // 1. Search backwards in current category
  for (let i = currentIdx - 1; i >= 0; i--) {
    const item = list[i];
    const g = glyphs[item.unicode];
    if (!g || !g.contours || g.contours.length === 0) {
      return item;
    }
  }

  // 2. Wrap backwards from end of current category
  for (let i = list.length - 1; i >= currentIdx; i--) {
    const item = list[i];
    if (item.unicode === currentUnicode) continue;
    const g = glyphs[item.unicode];
    if (!g || !g.contours || g.contours.length === 0) {
      return item;
    }
  }

  // 3. Search backwards across prior categories
  const catIdx = UNICODE_CATEGORIES.findIndex((c) => c.id === cat.id);
  for (let step = 1; step < UNICODE_CATEGORIES.length; step++) {
    const prevCat = UNICODE_CATEGORIES[(catIdx - step + UNICODE_CATEGORIES.length) % UNICODE_CATEGORIES.length];
    const prevList = getNavCharListForCategory(prevCat);
    for (let i = prevList.length - 1; i >= 0; i--) {
      const item = prevList[i];
      const g = glyphs[item.unicode];
      if (!g || !g.contours || g.contours.length === 0) {
        return item;
      }
    }
  }

  return null;
}
