import * as opentype from 'opentype.js';
import { FontMetadata, FontProject, GlyphData, PathContour } from '../types';
import {
  generateId,
  rotateContours,
  transformContours,
  getContoursBoundingBox,
  optimizeContourNodes,
  normalizeGlyphContoursWinding,
  unionContours,
} from './pathUtils';

export const SCREEN_BASELINE_Y = 800;
export const DEFAULT_UPM = 1000;
export const DEFAULT_ASCENDER = 880;
export const DEFAULT_DESCENDER = -120;

export interface CompileFontOptions {
  /**
   * Scale factor for exported glyphs.
   * - 1.35: 'standard_jp' (Optimized for Japanese typesetting, AviUtl2, Premiere, Word, where CJK occupies ~88% of em square)
   * - 1.0: 'raw' (Exact 1:1 canvas coordinates)
   * - Custom number: e.g. 1.2, 1.35, 1.5, etc.
   * Default: 1.35
   */
  scaleFactor?: number;
  /**
   * Automatically merge overlapping / intersecting contours into solid outer boundaries.
   * NOTE: TrueType rasterizers (DirectWrite, Windows GDI, FreeType, CoreText) natively render overlapping paths
   * with uniform clockwise winding (Non-Zero Winding) with 100% precision without needing raster boolean union.
   * Default: false (preserves 100% vector curve fidelity)
   */
  mergeOverlaps?: boolean;
  /**
   * Standardize all outer contour windings to TrueType Clockwise orientation.
   * Ensures non-zero winding rasterizers never cancel out intersecting strokes.
   * Default: true
   */
  normalizeWinding?: boolean;
  /**
   * Automatically balance left and right side bearings (LSB == RSB) inside advanceWidth
   * so hand-drawn glyphs are optically centered in their em-box rather than leaning left.
   * Default: true
   */
  balanceSideBearings?: boolean;
}

/**
 * Convert screen coordinate contours into opentype.Path
 */
export function contoursToOpenTypePath(
  contours: PathContour[],
  baselineY: number = SCREEN_BASELINE_Y
): opentype.Path {
  const path = new opentype.Path();

  // Run node optimization & integer rounding to eliminate decimal table bloat
  const cleanContours = optimizeContourNodes(contours);

  for (const contour of cleanContours) {
    const nodes = contour.nodes;
    if (!nodes || nodes.length === 0) continue;

    const first = nodes[0];
    // Convert Y: Font Y = baselineY - Screen Y with strict NaN sanitization
    const startX = Math.round(Number.isFinite(first.x) ? first.x : 0);
    const startY = Math.round(Number.isFinite(first.y) ? baselineY - first.y : 0);

    path.moveTo(startX, startY);

    for (let i = 0; i < nodes.length; i++) {
      const current = nodes[i];
      const isLast = i === nodes.length - 1;
      const next = isLast ? (contour.closed ? nodes[0] : null) : nodes[i + 1];

      if (!next) break;

      const cp1 = current.handleOut || { x: current.x, y: current.y };
      const cp2 = next.handleIn || { x: next.x, y: next.y };

      const isCp1Default = cp1.x === current.x && cp1.y === current.y;
      const isCp2Default = cp2.x === next.x && cp2.y === next.y;

      const nextX = Math.round(Number.isFinite(next.x) ? next.x : 0);
      const nextY = Math.round(Number.isFinite(next.y) ? baselineY - next.y : 0);

      if (isCp1Default && isCp2Default) {
        path.lineTo(nextX, nextY);
      } else {
        const cp1x = Math.round(Number.isFinite(cp1.x) ? cp1.x : current.x);
        const cp1y = Math.round(Number.isFinite(cp1.y) ? baselineY - cp1.y : baselineY - current.y);
        const cp2x = Math.round(Number.isFinite(cp2.x) ? cp2.x : next.x);
        const cp2y = Math.round(Number.isFinite(cp2.y) ? baselineY - cp2.y : baselineY - next.y);
        path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, nextX, nextY);
      }
    }

    if (contour.closed || nodes.length >= 3) {
      path.close();
    }
  }

  return path;
}

/**
 * Convert opentype.Path commands back to PathContour[] for editor
 */
export function openTypePathToContours(
  otPath: opentype.Path,
  baselineY: number = SCREEN_BASELINE_Y
): PathContour[] {
  const contours: PathContour[] = [];
  let currentContour: PathContour | null = null;
  let lastPoint = { x: 0, y: 0 };

  const commands = otPath.commands || [];

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];

    if (cmd.type === 'M') {
      if (currentContour && currentContour.nodes.length > 0) {
        contours.push(currentContour);
      }
      const nodeX = cmd.x;
      const nodeY = baselineY - cmd.y;
      currentContour = {
        id: generateId(),
        closed: false,
        nodes: [
          {
            id: generateId(),
            x: nodeX,
            y: nodeY,
            type: 'corner',
          },
        ],
      };
      lastPoint = { x: nodeX, y: nodeY };
    } else if (cmd.type === 'L') {
      if (!currentContour) {
        currentContour = { id: generateId(), closed: false, nodes: [] };
      }
      const nodeX = cmd.x;
      const nodeY = baselineY - cmd.y;
      currentContour.nodes.push({
        id: generateId(),
        x: nodeX,
        y: nodeY,
        type: 'corner',
      });
      lastPoint = { x: nodeX, y: nodeY };
    } else if (cmd.type === 'C') {
      if (!currentContour) {
        currentContour = { id: generateId(), closed: false, nodes: [] };
      }
      const cp1 = { x: cmd.x1, y: baselineY - cmd.y1 };
      const cp2 = { x: cmd.x2, y: baselineY - cmd.y2 };
      const nodeX = cmd.x;
      const nodeY = baselineY - cmd.y;

      // Assign handleOut to previous node
      if (currentContour.nodes.length > 0) {
        currentContour.nodes[currentContour.nodes.length - 1].handleOut = cp1;
      }

      currentContour.nodes.push({
        id: generateId(),
        x: nodeX,
        y: nodeY,
        handleIn: cp2,
        type: 'smooth',
      });
      lastPoint = { x: nodeX, y: nodeY };
    } else if (cmd.type === 'Q') {
      // Quadratic bezier -> elevate to cubic
      if (!currentContour) {
        currentContour = { id: generateId(), closed: false, nodes: [] };
      }
      const qx = cmd.x1;
      const qy = baselineY - cmd.y1;
      const nodeX = cmd.x;
      const nodeY = baselineY - cmd.y;

      const cp1x = lastPoint.x + (2 / 3) * (qx - lastPoint.x);
      const cp1y = lastPoint.y + (2 / 3) * (qy - lastPoint.y);
      const cp2x = nodeX + (2 / 3) * (qx - nodeX);
      const cp2y = nodeY + (2 / 3) * (qy - nodeY);

      if (currentContour.nodes.length > 0) {
        currentContour.nodes[currentContour.nodes.length - 1].handleOut = { x: cp1x, y: cp1y };
      }

      currentContour.nodes.push({
        id: generateId(),
        x: nodeX,
        y: nodeY,
        handleIn: { x: cp2x, y: cp2y },
        type: 'smooth',
      });
      lastPoint = { x: nodeX, y: nodeY };
    } else if (cmd.type === 'Z') {
      if (currentContour) {
        currentContour.closed = true;
        contours.push(currentContour);
        currentContour = null;
      }
    }
  }

  if (currentContour && currentContour.nodes.length > 0) {
    contours.push(currentContour);
  }

  return contours;
}

/**
 * Check if a character is intentionally asymmetric (e.g. small kana, punctuation, quotes, brackets, marks).
 * These glyphs MUST NOT be forced to geometric center (LSB == RSB) as doing so ruins sentence layout.
 */
export function isAsymmetricOrPunctuationGlyph(unicode: number, char?: string): boolean {
  if (!unicode) return false;

  // Space characters
  if (unicode === 32 || unicode === 0x3000) return true;

  // Small Hiragana & Katakana
  const smallKanaUnicodes = new Set([
    0x3041, 0x3043, 0x3045, 0x3047, 0x3049, 0x3063, 0x3083, 0x3085, 0x3087, 0x308E, 0x3095, 0x3096, // ぁぃぅぇぉっゃゅょゎゕゖ
    0x30A1, 0x30A3, 0x30A5, 0x30A7, 0x30A9, 0x30C3, 0x30E3, 0x30E5, 0x30E7, 0x30EE, 0x30F5, 0x30F6, // ァィゥェォッャュョヮヵヶ
  ]);
  if (smallKanaUnicodes.has(unicode)) return true;

  // Japanese & CJK Punctuation, Brackets, Quotes, Marks (U+3000..U+303F, U+FF00..U+FFEF)
  if (unicode >= 0x3000 && unicode <= 0x303F) return true;
  if (unicode >= 0xFF00 && unicode <= 0xFFEF) return true;

  // Western ASCII Punctuation & Symbols (0x21..0x2F, 0x3A..0x40, 0x5B..0x60, 0x7B..0x7E)
  if (
    (unicode >= 0x21 && unicode <= 0x2F) ||
    (unicode >= 0x3A && unicode <= 0x40) ||
    (unicode >= 0x5B && unicode <= 0x60) ||
    (unicode >= 0x7B && unicode <= 0x7E)
  ) {
    return true;
  }

  // General Punctuation & Currency (U+2000..U+206F, U+2070..U+209F, U+20A0..U+20CF)
  if (unicode >= 0x2000 && unicode <= 0x20CF) return true;

  return false;
}

/**
 * Compile the FontProject into an OpenType font object and binary buffer
 */
export function compileFont(
  project: FontProject,
  options?: CompileFontOptions
): {
  font: opentype.Font;
  buffer: ArrayBuffer;
  blobUrl: string;
} {
  const glyphsList: opentype.Glyph[] = [];

  // .notdef glyph is required as the first glyph (index 0)
  const notdefPath = new opentype.Path();
  // Draw standard rectangular box with cross for .notdef
  const boxWidth = 500;
  const boxHeight = 700;
  const margin = 50;
  notdefPath.moveTo(margin, 0);
  notdefPath.lineTo(boxWidth - margin, 0);
  notdefPath.lineTo(boxWidth - margin, boxHeight);
  notdefPath.lineTo(margin, boxHeight);
  notdefPath.close();
  // inner cut
  notdefPath.moveTo(margin + 40, 40);
  notdefPath.lineTo(margin + 40, boxHeight - 40);
  notdefPath.lineTo(boxWidth - margin - 40, boxHeight - 40);
  notdefPath.lineTo(boxWidth - margin - 40, 40);
  notdefPath.close();

  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    unicode: 0,
    advanceWidth: 600,
    path: notdefPath,
  });
  glyphsList.push(notdefGlyph);

  // Map to track added unicodes to avoid duplicates
  const addedUnicodes = new Set<number>();
  addedUnicodes.add(0);

  // Track unicode bounds and advance widths
  let minUnicode = 0xffff;
  let maxUnicode = 0;
  let totalAdvanceWidth = 0;
  let maxAdvanceWidth = 0;
  let minLsb = 0;
  let minRsb = 0;
  let maxXExtent = 0;

  // Add all user defined glyphs
  const glyphEntries = Object.values(project.glyphs);

  for (const g of glyphEntries) {
    if (!g || typeof g.unicode !== 'number' || isNaN(g.unicode) || g.unicode <= 0 || g.unicode > 0x10ffff) continue;
    if (addedUnicodes.has(g.unicode)) continue; // Prevent duplicate unicodes

    let glyphContours = g.contours || [];
    const advWidth = Math.round(
      Number.isFinite(g.advanceWidth) && (g.advanceWidth ?? 0) > 0
        ? (g.advanceWidth ?? 1000)
        : (g.unicode > 255 ? (project.metadata.unitsPerEm || DEFAULT_UPM) : Math.round((project.metadata.unitsPerEm || DEFAULT_UPM) / 2))
    );

    const scaleFactor = options?.scaleFactor !== undefined ? options.scaleFactor : 1.35;
    const shouldBalance = options?.balanceSideBearings !== false;
    const shouldMerge = options?.mergeOverlaps === true;

    if (glyphContours.length > 0) {
      const origBbox = getContoursBoundingBox(glyphContours);
      if (origBbox.width > 0 && origBbox.height > 0) {
        // 1. Scale around optical center (anchorX, anchorY) so Japanese glyphs expand to standard em-box size
        if (Math.abs(scaleFactor - 1.0) > 0.001) {
          const isAsymmetric = isAsymmetricOrPunctuationGlyph(g.unicode, g.char);
          const anchorX = (shouldBalance && !isAsymmetric) ? origBbox.centerX : advWidth / 2;
          // In screen coords (0..1000), optical center of guide box is 500 (em-box center)
          const anchorY = 500;
          glyphContours = transformContours(glyphContours, (p) => ({
            x: Math.round(anchorX + (p.x - anchorX) * scaleFactor),
            y: Math.round(anchorY + (p.y - anchorY) * scaleFactor),
          }));
        }

        // 2. Optical centering (balance LSB and RSB) for symmetric glyphs only
        if (shouldBalance && !isAsymmetricOrPunctuationGlyph(g.unicode, g.char)) {
          const scaledBbox = getContoursBoundingBox(glyphContours);
          if (scaledBbox.width > 0) {
            const targetCenter = advWidth / 2;
            const dx = Math.round(targetCenter - scaledBbox.centerX);
            if (Math.abs(dx) > 0) {
              glyphContours = transformContours(glyphContours, (p) => ({
                x: p.x + dx,
                y: p.y,
              }));
            }
          }
        }
      }

      // 3. Resolve overlaps & self-intersections (prevents white holes in single-stroke cursive loops & crossing strokes)
      if (shouldMerge && glyphContours.length > 0) {
        try {
          glyphContours = unionContours(glyphContours, 1.2, true);
        } catch (e) {
          console.warn('Auto unionContours fallback for unicode', g.unicode, e);
        }
      }

      // 4. Standard TrueType Clockwise Winding normalization (pure vector math, 0 precision loss)
      if (options?.normalizeWinding !== false) {
        glyphContours = normalizeGlyphContoursWinding(glyphContours);
      }
    }

    const path = contoursToOpenTypePath(glyphContours, SCREEN_BASELINE_Y);

    const glyphName = g.name || (g.char ? `uni${g.unicode.toString(16).toUpperCase().padStart(4, '0')}` : `glyph${g.unicode}`);

    const glyph = new opentype.Glyph({
      name: glyphName,
      unicode: g.unicode,
      advanceWidth: advWidth,
      path: path,
    });

    glyphsList.push(glyph);
    addedUnicodes.add(g.unicode);

    if (g.unicode < minUnicode) minUnicode = g.unicode;
    if (g.unicode > maxUnicode) maxUnicode = g.unicode;
    totalAdvanceWidth += advWidth;
    if (advWidth > maxAdvanceWidth) maxAdvanceWidth = advWidth;
  }

  // Ensure ASCII Space (U+0020 / 32) exists with valid width
  if (!addedUnicodes.has(32)) {
    const spaceWidth = Math.round((project.metadata.unitsPerEm || DEFAULT_UPM) / 2);
    const spaceGlyph = new opentype.Glyph({
      name: 'space',
      unicode: 32,
      advanceWidth: spaceWidth,
      path: new opentype.Path(),
    });
    glyphsList.push(spaceGlyph);
    addedUnicodes.add(32);
    minUnicode = Math.min(minUnicode, 32);
    maxUnicode = Math.max(maxUnicode, 32);
    totalAdvanceWidth += spaceWidth;
  }

  // Ensure Fullwidth Space (U+3000 / 12288 / 全角空白) exists with full em width
  if (!addedUnicodes.has(12288)) {
    const fullSpaceWidth = project.metadata.unitsPerEm || DEFAULT_UPM;
    const fullSpaceGlyph = new opentype.Glyph({
      name: 'space.fullwidth',
      unicode: 12288,
      advanceWidth: fullSpaceWidth,
      path: new opentype.Path(),
    });
    glyphsList.push(fullSpaceGlyph);
    addedUnicodes.add(12288);
    minUnicode = Math.min(minUnicode, 12288);
    maxUnicode = Math.max(maxUnicode, 12288);
    totalAdvanceWidth += fullSpaceWidth;
  }

  // Automatic Vertical Writing Alternates (OpenType vert / Unicode Vertical Forms)
  // If user has not explicitly drawn vertical forms, derive them automatically from horizontal counterparts
  // so vertical writing (縦書き) works without missing glyphs or horizontal bar bugs.
  const verticalDerivations: { targetUnicode: number; sourceUnicode: number; action: 'rotate90' | 'shiftTopRight' | 'rotate90_center' }[] = [
    { targetUnicode: 0xfe31, sourceUnicode: 0x30fc, action: 'rotate90' }, // 長音符 ー -> ︱
    { targetUnicode: 0xfe33, sourceUnicode: 0x2015, action: 'rotate90' }, // ダッシュ ― -> ︳
    { targetUnicode: 0xfe41, sourceUnicode: 0x300c, action: 'rotate90' }, // 鉤括弧 「 -> ﹁
    { targetUnicode: 0xfe42, sourceUnicode: 0x300d, action: 'rotate90' }, // 鉤括弧 」 -> ﹂
    { targetUnicode: 0xfe43, sourceUnicode: 0x300e, action: 'rotate90' }, // 二重鉤括弧 『 -> ﹃
    { targetUnicode: 0xfe44, sourceUnicode: 0x300f, action: 'rotate90' }, // 二重鉤括弧 』 -> ﹄
    { targetUnicode: 0xfe35, sourceUnicode: 0xff08, action: 'rotate90' }, // 丸括弧 （ -> ︵
    { targetUnicode: 0xfe36, sourceUnicode: 0xff09, action: 'rotate90' }, // 丸括弧 ） -> ︶
    { targetUnicode: 0xfe3b, sourceUnicode: 0x3010, action: 'rotate90' }, // 隅付き括弧 【 -> ︻
    { targetUnicode: 0xfe3c, sourceUnicode: 0x3011, action: 'rotate90' }, // 隅付き括弧 】 -> ︼
    { targetUnicode: 0xfe11, sourceUnicode: 0x3001, action: 'shiftTopRight' }, // 読点 、 -> ︑
    { targetUnicode: 0xfe12, sourceUnicode: 0x3002, action: 'shiftTopRight' }, // 句点 。 -> ︒
    { targetUnicode: 0xfe19, sourceUnicode: 0x2026, action: 'rotate90' }, // 三点リーダー … -> ︙
    { targetUnicode: 0xfe4f, sourceUnicode: 0x301c, action: 'rotate90' }, // 波ダッシュ 〜 -> ︴
  ];

  for (const deriv of verticalDerivations) {
    if (!addedUnicodes.has(deriv.targetUnicode) && project.glyphs[deriv.sourceUnicode]) {
      const srcGlyph = project.glyphs[deriv.sourceUnicode];
      if (srcGlyph.contours && srcGlyph.contours.length > 0) {
        let derivedContours: PathContour[] = [];
        if (deriv.action === 'rotate90') {
          derivedContours = rotateContours(srcGlyph.contours, 90, 500, 500);
        } else if (deriv.action === 'shiftTopRight') {
          const bbox = getContoursBoundingBox(srcGlyph.contours);
          const targetX = 750;
          const targetY = 250;
          const dx = targetX - bbox.centerX;
          const dy = targetY - bbox.centerY;
          derivedContours = transformContours(srcGlyph.contours, (p) => ({
            x: Math.round(p.x + dx),
            y: Math.round(p.y + dy),
          }));
        }

        if (options?.mergeOverlaps !== false && derivedContours.length > 1) {
          try {
            derivedContours = unionContours(derivedContours);
          } catch (_) {}
        }
        if (options?.normalizeWinding !== false) {
          derivedContours = normalizeGlyphContoursWinding(derivedContours);
        }

        const path = contoursToOpenTypePath(derivedContours, SCREEN_BASELINE_Y);
        const vertGlyph = new opentype.Glyph({
          name: `vert_${deriv.targetUnicode.toString(16).toUpperCase()}`,
          unicode: deriv.targetUnicode,
          advanceWidth: project.metadata.unitsPerEm || DEFAULT_UPM,
          path: path,
        });
        glyphsList.push(vertGlyph);
        addedUnicodes.add(deriv.targetUnicode);
        maxUnicode = Math.max(maxUnicode, deriv.targetUnicode);
      }
    }
  }

  // Generate safe ASCII PostScript name (no spaces, pure ASCII)
  const rawFamily = project.metadata.familyName || 'CustomFont';
  const rawStyle = project.metadata.styleName || 'Regular';
  const safeAsciiFamily = rawFamily.replace(/[^a-zA-Z0-9]/g, '') || 'CustomJapaneseFont';
  const safeAsciiStyle = rawStyle.replace(/[^a-zA-Z0-9]/g, '') || 'Regular';
  const postScriptName = `${safeAsciiFamily}-${safeAsciiStyle}`;

  const isBold = rawStyle.toLowerCase().includes('bold');
  const isItalic = rawStyle.toLowerCase().includes('italic');
  const avgWidth = glyphsList.length > 0 ? Math.round(totalAdvanceWidth / glyphsList.length) : 500;

  const font = new opentype.Font({
    familyName: rawFamily,
    styleName: rawStyle,
    unitsPerEm: project.metadata.unitsPerEm || DEFAULT_UPM,
    ascender: project.metadata.ascender || DEFAULT_ASCENDER,
    descender: project.metadata.descender || DEFAULT_DESCENDER,
    designer: project.metadata.designer || '',
    designerURL: project.metadata.designerUrl || '',
    manufacturer: project.metadata.manufacturer || '',
    copyright: project.metadata.copyright || '',
    version: project.metadata.version || 'Version 1.000',
    description: project.metadata.description || '',
    glyphs: glyphsList,
  });

  // Windows 11, macOS & Japanese OS/2 Compatibility Configuration
  if (!font.tables) {
    (font as any).tables = {};
  }
  if (!font.tables.os2) {
    font.tables.os2 = {} as any;
  }

  font.tables.os2.version = 4;
  font.tables.os2.xAvgCharWidth = avgWidth;
  font.tables.os2.usWeightClass = isBold ? 700 : 400;
  font.tables.os2.usWidthClass = 5; // Medium (normal)
  font.tables.os2.fsType = 0x0000; // Installable embedding (no DRM restrictions)
  font.tables.os2.sFamilyClass = 0;
  font.tables.os2.panose = [2, 0, 5, 3, 0, 0, 0, 0, 0, 0];

  // OS/2 Table: Code Page Ranges (Crucial for Windows Japanese IME & Font Selection)
  // Bit 17 (0x00020000) = JIS/Japanese (CP 932 - Shift-JIS)
  // Bit 0  (0x00000001) = Latin 1 (CP 1252)
  font.tables.os2.ulCodePageRange1 = 0x00020001;
  font.tables.os2.ulCodePageRange2 = 0x00000000;

  // OS/2 Table: Unicode Ranges (Basic Latin, CJK Symbols, Hiragana, Katakana, CJK Ideographs)
  font.tables.os2.ulUnicodeRange1 = 0x8000002f; // Basic Latin, Latin-1 Supplement, Latin Extended
  font.tables.os2.ulUnicodeRange2 = 0x70000000; // CJK Symbols and Punctuation, Hiragana, Katakana
  font.tables.os2.ulUnicodeRange3 = 0x00000008; // CJK Unified Ideographs
  font.tables.os2.ulUnicodeRange4 = 0x00000000;
  font.tables.os2.achVendID = 'OTED';

  // OS/2 Table: Windows & Typographic Line Metrics
  const asc = project.metadata.ascender || DEFAULT_ASCENDER;
  const desc = project.metadata.descender || DEFAULT_DESCENDER;
  const lineGap = project.metadata.lineGap ?? 0;

  font.tables.os2.usWinAscent = Math.max(asc, 880);
  font.tables.os2.usWinDescent = Math.abs(Math.min(desc, -120));
  font.tables.os2.sTypoAscender = asc;
  font.tables.os2.sTypoDescender = desc;
  font.tables.os2.sTypoLineGap = lineGap;
  font.tables.os2.sCapHeight = project.metadata.capHeight || 700;
  font.tables.os2.sxHeight = project.metadata.xHeight || 500;
  // bit 7 (0x0080) = USE_TYPO_METRICS (essential for Windows DirectWrite/AviUtl2/GDI consistent line metrics)
  font.tables.os2.fsSelection =
    (isBold ? (isItalic ? 0x0021 : 0x0020) : isItalic ? 0x0001 : 0x0040) | 0x0080;
  font.tables.os2.usFirstCharIndex = minUnicode < 0xffff ? minUnicode : 32;
  font.tables.os2.usLastCharIndex = Math.min(0xffff, maxUnicode > 0 ? maxUnicode : 65535);

  // Ensure hhea table metrics match
  if (!font.tables.hhea) {
    font.tables.hhea = {} as any;
  }
  font.tables.hhea.ascender = asc;
  font.tables.hhea.descender = desc;
  font.tables.hhea.lineGap = lineGap;
  font.tables.hhea.advanceWidthMax = Math.max(maxAdvanceWidth, 1000);
  font.tables.hhea.minLeftSideBearing = 0;
  font.tables.hhea.minRightSideBearing = 0;
  font.tables.hhea.xMaxExtent = Math.max(maxAdvanceWidth, 1000);
  font.tables.hhea.caretSlopeRise = 1;
  font.tables.hhea.caretSlopeRun = 0;
  font.tables.hhea.caretOffset = 0;

  // Name table: bilingual support for Windows, Mac, and Unicode
  // opentype.js strictly structures font.names by platform (unicode, macintosh, windows).
  // Setting properties directly on font.names creates invalid platform entries that cause:
  // 'Name table entry "en" does not exist, see nameTableNames for complete list.'
  if (!font.names) {
    (font as any).names = {};
  }
  const allowedPlatforms = ['windows', 'macintosh', 'unicode'] as const;
  for (const key of Object.keys(font.names)) {
    if (!allowedPlatforms.includes(key as any)) {
      delete (font.names as any)[key];
    }
  }

  for (const plat of allowedPlatforms) {
    if (!(font.names as any)[plat]) {
      (font.names as any)[plat] = {};
    }
    const platNames = (font.names as any)[plat];
    platNames.fontFamily = { en: safeAsciiFamily, ...(rawFamily ? { ja: rawFamily } : {}) };
    platNames.fontSubfamily = { en: safeAsciiStyle, ...(rawStyle ? { ja: rawStyle } : {}) };
    platNames.fullName = {
      en: `${safeAsciiFamily} ${safeAsciiStyle}`,
      ...(rawFamily ? { ja: `${rawFamily} ${rawStyle}` } : {}),
    };
    platNames.postScriptName = { en: postScriptName };
    platNames.preferredFamily = { en: safeAsciiFamily, ...(rawFamily ? { ja: rawFamily } : {}) };
    platNames.preferredSubfamily = { en: safeAsciiStyle, ...(rawStyle ? { ja: rawStyle } : {}) };
    platNames.version = { en: project.metadata.version || 'Version 1.000' };
    platNames.uniqueID = { en: `1.000;${postScriptName};${Date.now()}` };

    if (project.metadata.copyright) {
      platNames.copyright = { en: project.metadata.copyright, ja: project.metadata.copyright };
    }
    if (project.metadata.license) {
      platNames.license = { en: project.metadata.license, ja: project.metadata.license };
    }
    if (project.metadata.licenseUrl) {
      platNames.licenseURL = { en: project.metadata.licenseUrl };
    }
    if (project.metadata.designer) {
      platNames.designer = { en: project.metadata.designer, ja: project.metadata.designer };
    }
    if (project.metadata.description) {
      platNames.description = { en: project.metadata.description, ja: project.metadata.description };
    }
  }

  // -------------------------------------------------------------
  // Kerning Pairs Processing (TrueType / OpenType kern table)
  // -------------------------------------------------------------
  if (project.kerning && Object.keys(project.kerning).length > 0) {
    if (!font.kerningPairs) {
      font.kerningPairs = {};
    }

    const validKerningPairs: { leftIndex: number; rightIndex: number; value: number }[] = [];

    for (const [pairKey, val] of Object.entries(project.kerning)) {
      if (typeof val !== 'number' || Math.abs(val) < 0.1) continue;

      let leftChar = '';
      let rightChar = '';

      if (pairKey.includes(',')) {
        const parts = pairKey.split(',');
        leftChar = parts[0];
        rightChar = parts[1];
      } else if ([...pairKey].length === 2) {
        const chars = [...pairKey];
        leftChar = chars[0];
        rightChar = chars[1];
      }

      if (!leftChar || !rightChar) continue;

      // Resolve glyph indices
      let leftIdx = -1;
      let rightIdx = -1;

      // If hex codes like "U+0041" or "0x0041"
      if (leftChar.startsWith('U+') || leftChar.startsWith('0x')) {
        const code = parseInt(leftChar.replace(/^U\+|^0x/, ''), 16);
        leftIdx = (font as any).hasChar?.(String.fromCodePoint(code))
          ? (font as any).charToGlyphIndex(String.fromCodePoint(code))
          : -1;
      } else {
        leftIdx = (font as any).hasChar?.(leftChar)
          ? (font as any).charToGlyphIndex(leftChar)
          : -1;
      }

      if (rightChar.startsWith('U+') || rightChar.startsWith('0x')) {
        const code = parseInt(rightChar.replace(/^U\+|^0x/, ''), 16);
        rightIdx = (font as any).hasChar?.(String.fromCodePoint(code))
          ? (font as any).charToGlyphIndex(String.fromCodePoint(code))
          : -1;
      } else {
        rightIdx = (font as any).hasChar?.(rightChar)
          ? (font as any).charToGlyphIndex(rightChar)
          : -1;
      }

      if (leftIdx > 0 && rightIdx > 0) {
        // Register in opentype.js font.kerningPairs map for in-browser rendering / metrics
        font.kerningPairs[`${leftIdx},${rightIdx}`] = Math.round(val);
        validKerningPairs.push({
          leftIndex: leftIdx,
          rightIndex: rightIdx,
          value: Math.round(val),
        });
      }
    }

    // Build standard OpenType kern table if pairs exist
    if (validKerningPairs.length > 0) {
      try {
        // Sort pairs by leftIndex, then rightIndex
        validKerningPairs.sort((a, b) =>
          a.leftIndex === b.leftIndex ? a.rightIndex - b.rightIndex : a.leftIndex - b.leftIndex
        );

        const nPairs = validKerningPairs.length;
        let entrySelector = 0;
        let searchRange = 1;
        while (searchRange * 2 <= nPairs) {
          searchRange *= 2;
          entrySelector++;
        }
        searchRange *= 6;
        const rangeShift = nPairs * 6 - searchRange;
        const subtableLength = 14 + nPairs * 6;

        const subtableFields: any[] = [
          { name: 'version', type: 'USHORT', value: 0 },
          { name: 'length', type: 'USHORT', value: subtableLength },
          { name: 'coverage', type: 'USHORT', value: 1 }, // Format 0 horizontal kerning
          { name: 'nPairs', type: 'USHORT', value: nPairs },
          { name: 'searchRange', type: 'USHORT', value: searchRange },
          { name: 'entrySelector', type: 'USHORT', value: entrySelector },
          { name: 'rangeShift', type: 'USHORT', value: rangeShift },
        ];

        for (let i = 0; i < nPairs; i++) {
          const pair = validKerningPairs[i];
          subtableFields.push({ name: `left_${i}`, type: 'USHORT', value: pair.leftIndex });
          subtableFields.push({ name: `right_${i}`, type: 'USHORT', value: pair.rightIndex });
          subtableFields.push({ name: `value_${i}`, type: 'SHORT', value: pair.value });
        }

        const OpentypeTable = (opentype as any).Table;
        const subtable = new OpentypeTable('kernSubtable', subtableFields);
        (font as any).tables.kern = new OpentypeTable('kern', [
          { name: 'version', type: 'USHORT', value: 0 },
          { name: 'nTables', type: 'USHORT', value: 1 },
          { name: 'subtable_0', type: 'TABLE', value: subtable },
        ]);
      } catch (kernErr) {
        console.warn('Failed to build binary kern table, kerning kept in font.kerningPairs:', kernErr);
      }
    }
  }

  const buffer = font.toArrayBuffer();

  // Self-Validation: Verify binary TrueType can be parsed cleanly by OpenType parser
  try {
    opentype.parse(buffer);
  } catch (parseErr) {
    console.warn('OpenType sanity parse warning:', parseErr);
  }

  const blob = new Blob([buffer], { type: 'font/ttf' });
  const blobUrl = URL.createObjectURL(blob);

  return { font, buffer, blobUrl };
}

export interface FontValidationResult {
  valid: boolean;
  glyphCount: number;
  warnings: string[];
  errors: string[];
}

/**
 * Validate a font project before export to detect issues early
 */
export function validateFontProject(project: FontProject): FontValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const glyphs = Object.values(project.glyphs || {});
  const glyphCount = glyphs.length;

  if (glyphCount === 0) {
    warnings.push('作成されたグリフがまだありません。空白フォントとして出力されます。');
  }

  for (const g of glyphs) {
    if (!g || typeof g.unicode !== 'number' || isNaN(g.unicode)) {
      errors.push(`無効なUnicode値を持つグリフが存在します`);
      continue;
    }
    const label = g.char || `U+${g.unicode.toString(16).toUpperCase()}`;
    if (g.contours) {
      let glyphNodeCount = 0;
      for (let ci = 0; ci < g.contours.length; ci++) {
        const c = g.contours[ci];
        if (!c.nodes || c.nodes.length === 0) continue;
        glyphNodeCount += c.nodes.length;
        if (c.nodes.length === 1) {
          warnings.push(`文字「${label}」に頂点が1つだけの孤立輪郭があります（自動除外されます）。`);
        }
        for (const n of c.nodes) {
          if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) {
            errors.push(`文字「${label}」に無効な数値座標を持つ頂点があります。`);
            break;
          }
        }
      }
      if (glyphNodeCount > 350) {
        warnings.push(`文字「${label}」のノード数が過剰です（${glyphNodeCount}個）。描画負荷やファイル容量削減のため簡略化を推奨します。`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    glyphCount,
    warnings,
    errors,
  };
}

/**
 * Share or download the generated font file (.ttf / .otf)
 * Supports iPadOS/iOS native Share Sheet (ファイルに保存 / AirDrop) and direct download fallback.
 */
export async function shareOrDownloadFont(
  project: FontProject,
  format: 'ttf' | 'otf' = 'ttf',
  options?: CompileFontOptions
): Promise<{ method: 'share' | 'download'; filename: string }> {
  const { buffer } = compileFont(project, options);
  const rawName = project.metadata.familyName || 'CustomFont';
  const safeName = rawName.replace(/[^a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff-]/g, '_');
  const filename = `${safeName}-${project.metadata.styleName || 'Regular'}.${format}`;
  const mimeType = format === 'otf' ? 'font/otf' : 'font/ttf';
  const blob = new Blob([buffer], { type: mimeType });

  // Check for iPad / iPhone / Safari touch device
  const isAppleDevice =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

  if (isAppleDevice && typeof navigator.share === 'function') {
    try {
      const file = new File([blob], filename, { type: mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `${project.metadata.familyName || 'フォント'} (${format.toUpperCase()})`,
          text: `フォントファイル: ${filename}`,
        });
        return { method: 'share', filename };
      }
    } catch (shareErr: any) {
      if (shareErr.name === 'AbortError') {
        return { method: 'share', filename };
      }
      console.warn('Web Share failed, falling back to download:', shareErr);
    }
  }

  // Standard safe download link with delayed revocation for Safari
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {}
  }, 60000);

  return { method: 'download', filename };
}

/**
 * Download the generated font file (.ttf)
 */
export function downloadFont(
  project: FontProject,
  format: 'ttf' | 'otf' = 'ttf',
  options?: CompileFontOptions
) {
  try {
    const { buffer } = compileFont(project, options);
    const mimeType = format === 'otf' ? 'font/otf' : 'font/ttf';
    const blob = new Blob([buffer], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (project.metadata.familyName || 'CustomFont').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.href = url;
    a.download = `${safeName}-${project.metadata.styleName || 'Regular'}.${format}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 60000);
  } catch (err) {
    console.error('Failed to export font:', err);
    throw err;
  }
}

/**
 * Parse an uploaded font file (TTF/OTF) into project glyphs
 */
export async function loadFontFromFile(
  file: File
): Promise<{ metadata: Partial<FontMetadata>; glyphs: Record<number, GlyphData> }> {
  const arrayBuffer = await file.arrayBuffer();
  const font = opentype.parse(arrayBuffer);

  const metadata: Partial<FontMetadata> = {
    familyName:
      (font.names as any)?.windows?.fontFamily?.ja ||
      (font.names as any)?.windows?.fontFamily?.en ||
      (font.names as any)?.unicode?.fontFamily?.en ||
      (font.names as any)?.macintosh?.fontFamily?.en ||
      font.names.fontFamily?.en ||
      font.names.fontFamily?.ja ||
      file.name.replace(/\.[^/.]+$/, ''),
    styleName:
      (font.names as any)?.windows?.fontSubfamily?.en ||
      (font.names as any)?.unicode?.fontSubfamily?.en ||
      (font.names as any)?.macintosh?.fontSubfamily?.en ||
      font.names.fontSubfamily?.en ||
      'Regular',
    designer:
      (font.names as any)?.windows?.designer?.en ||
      (font.names as any)?.unicode?.designer?.en ||
      font.names.designer?.en ||
      font.names.designer?.ja ||
      '',
    designerUrl:
      (font.names as any)?.windows?.designerURL?.en ||
      (font.names as any)?.unicode?.designerURL?.en ||
      font.names.designerURL?.en ||
      font.names.designerURL?.ja ||
      '',
    copyright:
      (font.names as any)?.windows?.copyright?.en ||
      (font.names as any)?.unicode?.copyright?.en ||
      font.names.copyright?.en ||
      font.names.copyright?.ja ||
      '',
    license:
      (font.names as any)?.windows?.license?.en ||
      (font.names as any)?.unicode?.license?.en ||
      font.names.license?.en ||
      font.names.license?.ja ||
      '',
    licenseUrl:
      (font.names as any)?.windows?.licenseURL?.en ||
      (font.names as any)?.unicode?.licenseURL?.en ||
      font.names.licenseURL?.en ||
      font.names.licenseURL?.ja ||
      '',
    version:
      (font.names as any)?.windows?.version?.en ||
      (font.names as any)?.unicode?.version?.en ||
      font.names.version?.en ||
      '1.000',
    unitsPerEm: font.unitsPerEm || 1000,
    ascender: font.ascender || 800,
    descender: font.descender || -200,
  };

  const glyphs: Record<number, GlyphData> = {};

  for (let i = 0; i < font.glyphs.length; i++) {
    const g = font.glyphs.get(i);
    if (!g.unicode) continue;

    const path = g.getPath(0, 0, font.unitsPerEm);
    const contours = openTypePathToContours(path, SCREEN_BASELINE_Y);

    glyphs[g.unicode] = {
      unicode: g.unicode,
      char: String.fromCodePoint(g.unicode),
      name: g.name || `uni${g.unicode.toString(16).toUpperCase()}`,
      advanceWidth: g.advanceWidth || font.unitsPerEm,
      lsb: g.leftSideBearing || 50,
      contours: contours,
      modified: true,
    };
  }

  return { metadata, glyphs };
}

/**
 * Create default new FontProject with standard ASCII & basic Japanese setup
 */
export function createDefaultProject(): FontProject {
  const defaultMeta: FontMetadata = {
    familyName: '手書きフォント',
    styleName: 'Regular',
    designer: '手書きフォント作者',
    copyright: '© 2026 手書きフォント作者. All rights reserved.',
    version: 'Version 1.000',
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    lineGap: 100,
    capHeight: 700,
    xHeight: 500,
  };

  // Pre-seed a few starter glyphs so the user can immediately see and test
  const sampleGlyphs: Record<number, GlyphData> = {};

  // 半角空白 (U+0020 / 32)
  sampleGlyphs[32] = {
    unicode: 32,
    char: ' ',
    name: 'space',
    advanceWidth: 500,
    lsb: 0,
    modified: true,
    contours: [],
  };

  // 全角空白 (U+3000 / 12288)
  sampleGlyphs[12288] = {
    unicode: 12288,
    char: '　',
    name: 'uni3000',
    advanceWidth: 1000,
    lsb: 0,
    modified: true,
    contours: [],
  };

  // 'A' (65) sample vector outline
  sampleGlyphs[65] = {
    unicode: 65,
    char: 'A',
    name: 'A',
    advanceWidth: 700,
    lsb: 40,
    modified: true,
    contours: [
      // Outer triangle
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 350, y: 150, type: 'corner' },
          { id: generateId(), x: 620, y: 800, type: 'corner' },
          { id: generateId(), x: 520, y: 800, type: 'corner' },
          { id: generateId(), x: 440, y: 610, type: 'corner' },
          { id: generateId(), x: 260, y: 610, type: 'corner' },
          { id: generateId(), x: 180, y: 800, type: 'corner' },
          { id: generateId(), x: 80, y: 800, type: 'corner' },
        ],
      },
      // Inner cut
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 350, y: 280, type: 'corner' },
          { id: generateId(), x: 290, y: 520, type: 'corner' },
          { id: generateId(), x: 410, y: 520, type: 'corner' },
        ],
      },
    ],
  };

  // 'あ' (12354 / U+3042) starter
  sampleGlyphs[12354] = {
    unicode: 12354,
    char: 'あ',
    name: 'uni3042',
    advanceWidth: 1000,
    lsb: 50,
    modified: true,
    contours: [
      // Stroke 1: top horizontal bar
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 250, y: 280, handleOut: { x: 450, y: 260 }, type: 'smooth' },
          { id: generateId(), x: 750, y: 260, type: 'corner' },
          { id: generateId(), x: 740, y: 340, handleOut: { x: 450, y: 340 }, type: 'smooth' },
          { id: generateId(), x: 240, y: 340, type: 'corner' },
        ],
      },
      // Stroke 2: vertical curved line
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 480, y: 160, handleOut: { x: 500, y: 400 }, type: 'smooth' },
          { id: generateId(), x: 460, y: 780, type: 'corner' },
          { id: generateId(), x: 390, y: 770, handleOut: { x: 420, y: 400 }, type: 'smooth' },
          { id: generateId(), x: 400, y: 160, type: 'corner' },
        ],
      },
      // Stroke 3: the round loop (outer contour)
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 320, y: 420, handleOut: { x: 620, y: 360 }, type: 'smooth' },
          { id: generateId(), x: 800, y: 560, handleOut: { x: 820, y: 750 }, type: 'smooth' },
          { id: generateId(), x: 580, y: 840, handleOut: { x: 350, y: 820 }, type: 'smooth' },
          { id: generateId(), x: 240, y: 640, handleOut: { x: 220, y: 500 }, type: 'smooth' },
        ],
      },
      // Stroke 4: the round loop (inner hole, counter-clockwise)
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 320, y: 580, handleOut: { x: 390, y: 720 }, type: 'smooth' },
          { id: generateId(), x: 520, y: 730, handleOut: { x: 640, y: 680 }, type: 'smooth' },
          { id: generateId(), x: 620, y: 560, handleOut: { x: 500, y: 460 }, type: 'smooth' },
          { id: generateId(), x: 380, y: 460, handleOut: { x: 310, y: 480 }, type: 'smooth' },
        ],
      },
    ],
  };

  // '日' (26085 / U+65E5)
  sampleGlyphs[26085] = {
    unicode: 26085,
    char: '日',
    name: 'uni65E5',
    advanceWidth: 1000,
    lsb: 80,
    modified: true,
    contours: [
      // Outer frame
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 200, y: 160, type: 'corner' },
          { id: generateId(), x: 800, y: 160, type: 'corner' },
          { id: generateId(), x: 800, y: 840, type: 'corner' },
          { id: generateId(), x: 200, y: 840, type: 'corner' },
        ],
      },
      // Top inner box
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 280, y: 240, type: 'corner' },
          { id: generateId(), x: 720, y: 240, type: 'corner' },
          { id: generateId(), x: 720, y: 460, type: 'corner' },
          { id: generateId(), x: 280, y: 460, type: 'corner' },
        ],
      },
      // Bottom inner box
      {
        id: generateId(),
        closed: true,
        nodes: [
          { id: generateId(), x: 280, y: 540, type: 'corner' },
          { id: generateId(), x: 720, y: 540, type: 'corner' },
          { id: generateId(), x: 720, y: 760, type: 'corner' },
          { id: generateId(), x: 280, y: 760, type: 'corner' },
        ],
      },
    ],
  };

  return {
    id: `project-${Date.now()}`,
    name: '新規フォントプロジェクト (OTEdit Web)',
    metadata: defaultMeta,
    glyphs: sampleGlyphs,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Center all glyph contours inside their advanceWidth and balance side bearings (LSB == RSB)
 * Fixes hand-drawn glyphs that lean left or right.
 */
export function balanceProjectGlyphMargins(project: FontProject): { project: FontProject; modifiedCount: number } {
  const updatedGlyphs = { ...project.glyphs };
  let modifiedCount = 0;

  for (const [key, g] of Object.entries(updatedGlyphs)) {
    if (!g.contours || g.contours.length === 0) continue;
    if (isAsymmetricOrPunctuationGlyph(g.unicode, g.char)) continue;
    const bbox = getContoursBoundingBox(g.contours);
    if (bbox.width <= 0) continue;

    const adv = Math.round(
      Number.isFinite(g.advanceWidth) && (g.advanceWidth ?? 0) > 0
        ? (g.advanceWidth ?? 1000)
        : (g.unicode > 255 ? (project.metadata.unitsPerEm || DEFAULT_UPM) : Math.round((project.metadata.unitsPerEm || DEFAULT_UPM) / 2))
    );

    const targetCenter = adv / 2;
    const dx = Math.round(targetCenter - bbox.centerX);

    if (Math.abs(dx) > 0) {
      const centeredContours = transformContours(g.contours, (p) => ({
        x: p.x + dx,
        y: p.y,
      }));
      const newBbox = getContoursBoundingBox(centeredContours);
      updatedGlyphs[Number(key)] = {
        ...g,
        contours: centeredContours,
        lsb: Math.max(0, Math.round(newBbox.minX)),
        modified: true,
      };
      modifiedCount++;
    }
  }

  return {
    project: {
      ...project,
      glyphs: updatedGlyphs,
      updatedAt: Date.now(),
    },
    modifiedCount,
  };
}

