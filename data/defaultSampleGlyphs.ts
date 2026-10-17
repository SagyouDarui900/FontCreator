import { GlyphData } from "../types";

export const DEFAULT_SAMPLE_GLYPHS: Record<number, GlyphData> = {
  32: {
    unicode: 32,
    char: " ",
    name: "space",
    advanceWidth: 500,
    lsb: 0,
    modified: false,
    contours: [],
  },
  12288: {
    unicode: 12288,
    char: "　",
    name: "uni3000",
    advanceWidth: 1000,
    lsb: 0,
    modified: false,
    contours: [],
  },
};

export function isLegacyMockGlyph(glyph: GlyphData): boolean {
  return false;
}
