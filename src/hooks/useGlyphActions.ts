import React, { useState, useCallback } from 'react';
import { FontProject, GlyphData, PathContour, ToolMode } from '../types';
import { createSmallKanaContours, generateId, simplifyGlyphContours } from '../utils/pathUtils';
import { createDakutenContours, createHandakutenContours, cloneContours } from '../utils/dakutenHelper';
import { calculateOptimalSpacing, AutoSpacingPreset } from '../utils/metricsHelper';
import { KANA_PAIRS } from '../data/unicodeTables';

interface UseGlyphActionsOptions {
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  selectedUnicode: number;
  selectedChar: string;
  setSelectedUnicode: (unicode: number) => void;
  setSelectedChar: (char: string) => void;
  currentGlyph: GlyphData;
  currentGlyphRef: React.MutableRefObject<GlyphData>;
  commitHistory: () => void;
  setUndoStack: React.Dispatch<React.SetStateAction<GlyphData[]>>;
  setToolMode: (mode: ToolMode) => void;
  onShowToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  handleUpdateContours: (newContours: PathContour[], options?: { skipHistory?: boolean }) => void;
}

export function useGlyphActions({
  project,
  setProject,
  selectedUnicode,
  selectedChar,
  setSelectedUnicode,
  setSelectedChar,
  currentGlyph,
  currentGlyphRef,
  commitHistory,
  setUndoStack,
  setToolMode,
  onShowToast,
  handleUpdateContours,
}: UseGlyphActionsOptions) {
  const [clipboardContours, setClipboardContours] = useState<PathContour[] | null>(null);

  // Simplify current glyph contours
  const handleSimplifyCurrentGlyph = useCallback(
    (level: 'mild' | 'normal' | 'strong' = 'normal') => {
      const contours = currentGlyph.contours || [];
      if (contours.length === 0) {
        onShowToast('単純化する輪郭がありません', 'warning');
        return;
      }
      commitHistory();
      const res = simplifyGlyphContours(contours, {
        level,
        preserveSharpCorners: true,
      });

      if (!res.changed) {
        onShowToast('既に最適な頂点配置です (不要な重複・共線ノードなし)', 'info');
        return;
      }

      handleUpdateContours(res.contours);
      onShowToast(
        `輪郭を単純化しました: 頂点数 ${res.originalNodeCount}点 → ${res.optimizedNodeCount}点 (${res.reductionPercentage}% 削減)`,
        'success'
      );
    },
    [currentGlyph, commitHistory, handleUpdateContours, onShowToast]
  );

  // Auto-Spacing
  const handleAutoSpaceCurrentGlyph = useCallback(
    (preset: AutoSpacingPreset = 'smart') => {
      const contours = currentGlyph.contours || [];
      if (contours.length === 0) {
        onShowToast('字形が作図されていません', 'warning');
        return;
      }
      commitHistory();
      const res = calculateOptimalSpacing(selectedUnicode, contours, preset);

      setProject((prev) => {
        const existing = prev.glyphs[selectedUnicode] || {
          unicode: selectedUnicode,
          char: selectedChar,
          name: `uni${selectedUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
        };

        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [selectedUnicode]: {
              ...existing,
              advanceWidth: res.advanceWidth,
              lsb: res.lsb,
              contours: res.contours,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });

      const presetLabel =
        preset === 'smart'
          ? 'スマート自動'
          : preset === 'japanese-fullwidth'
          ? '和文全角センタリング'
          : preset === 'proportional-tight'
          ? '欧文タイト'
          : preset === 'proportional-loose'
          ? '欧文ルーズ'
          : '欧文プロポーショナル';

      onShowToast(
        `オートスペーシング適用 [${presetLabel}]: 送り幅 ${res.advanceWidth}px, 左余白 ${res.lsb}px`,
        'success'
      );
    },
    [currentGlyph, selectedUnicode, selectedChar, commitHistory, setProject, onShowToast]
  );

  // Clear Glyph
  const handleClearGlyph = useCallback(
    (unicode: number) => {
      const targetGlyph = project.glyphs[unicode];
      if (!targetGlyph) return;

      if (unicode === selectedUnicode) {
        commitHistory();
      } else {
        setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(targetGlyph))]);
      }

      setProject((prev) => {
        const copy = { ...prev.glyphs };
        delete copy[unicode];
        return {
          ...prev,
          glyphs: copy,
          updatedAt: Date.now(),
        };
      });

      const ch = targetGlyph.char || String.fromCodePoint(unicode);
      onShowToast(`文字「${ch}」の字形を消去しました (Ctrl+Zで復元可能)`, 'info');
    },
    [project.glyphs, selectedUnicode, commitHistory, setUndoStack, setProject, onShowToast]
  );

  // Copy Glyph contours
  const handleCopyGlyph = useCallback(
    (unicode: number) => {
      const glyph = project.glyphs[unicode];
      if (glyph && glyph.contours && glyph.contours.length > 0) {
        setClipboardContours(JSON.parse(JSON.stringify(glyph.contours)));
        const ch = glyph.char || String.fromCodePoint(unicode);
        onShowToast(`文字「${ch}」の字形 (${glyph.contours.length}パス) をコピーしました`, 'success');
      } else {
        onShowToast('コピーする輪郭がありません', 'warning');
      }
    },
    [project.glyphs, onShowToast]
  );

  // Paste Glyph contours
  const handlePasteGlyph = useCallback(
    (unicode: number) => {
      if (!clipboardContours || clipboardContours.length === 0) {
        onShowToast('クリップボードに字形がありません', 'warning');
        return;
      }
      commitHistory();
      setProject((prev) => {
        const existing = prev.glyphs[unicode] || {
          unicode,
          char: String.fromCodePoint(unicode),
          name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
          advanceWidth: 1000,
          lsb: 50,
        };
        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [unicode]: {
              ...existing,
              contours: JSON.parse(JSON.stringify(clipboardContours)),
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });
      const targetChar = String.fromCodePoint(unicode);
      onShowToast(`「${targetChar}」に字形を貼り付けました`, 'success');
    },
    [clipboardContours, commitHistory, setProject, onShowToast]
  );

  // Duplicate Normal Kana to Small Kana automatically
  const handleDuplicateAsSmallKana = useCallback(
    (sourceUnicode: number) => {
      const sourceGlyph = project.glyphs[sourceUnicode];
      if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) return;

      const sourceChar = sourceGlyph.char || String.fromCodePoint(sourceUnicode);
      const pair = KANA_PAIRS[sourceChar];
      if (!pair) return;

      const targetUnicode = pair.smallUnicode;
      const smallContours = createSmallKanaContours(sourceGlyph.contours);

      commitHistory();
      setProject((prev) => {
        const existing = prev.glyphs[targetUnicode] || {
          unicode: targetUnicode,
          char: pair.smallChar,
          name: `uni${targetUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
          advanceWidth: 1000,
          lsb: 60,
        };

        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [targetUnicode]: {
              ...existing,
              contours: smallContours,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });

      setSelectedUnicode(targetUnicode);
      setSelectedChar(pair.smallChar);
      onShowToast(`「${sourceChar}」から小文字「${pair.smallChar}」を自動生成しました`, 'success');
    },
    [project.glyphs, commitHistory, setProject, setSelectedUnicode, setSelectedChar, onShowToast]
  );

  // Generate Dakuten / Handakuten from Current Glyph Automatically
  const handleGenerateDakutenTarget = useCallback(
    (targetChar: string, isHandakuten?: boolean) => {
      const targetUnicode = targetChar.codePointAt(0);
      if (!targetUnicode) return;

      const baseContours = currentGlyph.contours || [];
      const cloned = cloneContours(baseContours);
      const accentContours = isHandakuten
        ? createHandakutenContours()
        : createDakutenContours();

      const combinedContours = [...cloned, ...accentContours];

      commitHistory();
      setProject((prev) => {
        const existing = prev.glyphs[targetUnicode] || {
          unicode: targetUnicode,
          char: targetChar,
          name: `uni${targetUnicode.toString(16).toUpperCase().padStart(4, '0')}`,
          advanceWidth: currentGlyph.advanceWidth || 1000,
          lsb: currentGlyph.lsb ?? 50,
        };

        return {
          ...prev,
          glyphs: {
            ...prev.glyphs,
            [targetUnicode]: {
              ...existing,
              contours: combinedContours,
              advanceWidth: currentGlyph.advanceWidth || 1000,
              lsb: currentGlyph.lsb ?? 50,
              modified: true,
            },
          },
          updatedAt: Date.now(),
        };
      });

      setSelectedUnicode(targetUnicode);
      setSelectedChar(targetChar);
      onShowToast(
        `「${selectedChar}」から${isHandakuten ? '半濁音' : '濁音'}「${targetChar}」を自動生成しました！`,
        'success'
      );
    },
    [currentGlyph, commitHistory, setProject, selectedChar, setSelectedUnicode, setSelectedChar, onShowToast]
  );

  // Copy strokes from another char
  const handleCopyFromChar = useCallback(
    (sourceChar: string) => {
      const sourceUnicode = sourceChar.codePointAt(0);
      if (!sourceUnicode) return;
      const sourceGlyph = project.glyphs[sourceUnicode];
      if (!sourceGlyph || !sourceGlyph.contours || sourceGlyph.contours.length === 0) {
        onShowToast(`「${sourceChar}」にはまだ字形が作図されていません`, 'warning');
        return;
      }
      commitHistory();
      const cloned = cloneContours(sourceGlyph.contours);
      handleUpdateContours(cloned);
      onShowToast(`「${sourceChar}」から字形を読み込みました`, 'success');
    },
    [project.glyphs, commitHistory, handleUpdateContours, onShowToast]
  );

  // Insert Radical Contours
  const handleInsertRadical = useCallback(
    (radicalContours: PathContour[]) => {
      if (!radicalContours || radicalContours.length === 0) {
        onShowToast('挿入する輪郭データがありません', 'warning');
        return;
      }
      commitHistory();
      const base = currentGlyphRef.current?.contours || [];
      const uniqueRadicals = radicalContours.map((c) => ({
        ...c,
        id: generateId(),
        nodes: c.nodes.map((n) => ({
          ...n,
          id: generateId(),
          handleIn: n.handleIn ? { ...n.handleIn } : null,
          handleOut: n.handleOut ? { ...n.handleOut } : null,
        })),
      }));
      const insertedIds = uniqueRadicals.map((c) => c.id);
      handleUpdateContours([...base, ...uniqueRadicals]);
      setToolMode('select');
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('font_editor_select_contours', { detail: { ids: insertedIds } })
        );
      }, 60);
      onShowToast(`部首パーツ (${uniqueRadicals.length}パス) を挿入しました（選択ツールで移動・変形可能）`, 'success');
    },
    [commitHistory, currentGlyphRef, handleUpdateContours, setToolMode, onShowToast]
  );

  // Batch Insert Radical Contours to multiple kanji glyphs
  const handleBatchInsertRadical = useCallback(
    (radicalContours: PathContour[], targetChars: string[]) => {
      commitHistory();
      setProject((prev) => {
        const updatedGlyphs = { ...(prev.glyphs || {}) };
        targetChars.forEach((char) => {
          const unicode = char.codePointAt(0) || 0;
          if (!unicode) return;
          const existingGlyph = updatedGlyphs[unicode] || {
            unicode,
            char,
            name: `uni${unicode.toString(16).toUpperCase().padStart(4, '0')}`,
            contours: [],
            advanceWidth: 1000,
            lsb: 50,
          };

          const clonedRadical = radicalContours.map((c) => ({
            ...c,
            id: generateId(),
            nodes: c.nodes.map((n) => ({
              ...n,
              id: generateId(),
              handleIn: n.handleIn ? { ...n.handleIn } : null,
              handleOut: n.handleOut ? { ...n.handleOut } : null,
            })),
          }));

          updatedGlyphs[unicode] = {
            ...existingGlyph,
            contours: [...(existingGlyph.contours || []), ...clonedRadical],
            modified: true,
            updatedAt: Date.now(),
          };
        });
        return { ...prev, glyphs: updatedGlyphs, updatedAt: Date.now() };
      });
      onShowToast(`${targetChars.length}文字の字形に部首パーツを一括挿入しました`, 'success');
    },
    [commitHistory, setProject, onShowToast]
  );

  return {
    clipboardContours,
    setClipboardContours,
    handleSimplifyCurrentGlyph,
    handleAutoSpaceCurrentGlyph,
    handleClearGlyph,
    handleCopyGlyph,
    handlePasteGlyph,
    handleDuplicateAsSmallKana,
    handleGenerateDakutenTarget,
    handleCopyFromChar,
    handleInsertRadical,
    handleBatchInsertRadical,
  };
}
