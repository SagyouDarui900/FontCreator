import React, { useState, useCallback } from 'react';
import { FontProject, GlyphData, PathContour } from '../types';

export const cloneGlyph = (g: GlyphData): GlyphData => ({
  ...g,
  contours: (g.contours || []).map((c) => ({
    ...c,
    nodes: c.nodes.map((n) => ({
      ...n,
      handleIn: n.handleIn ? { x: n.handleIn.x, y: n.handleIn.y } : null,
      handleOut: n.handleOut ? { x: n.handleOut.x, y: n.handleOut.y } : null,
    })),
  })),
});

export const areContoursEqual = (a: PathContour[], b: PathContour[]): boolean => {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ca = a[i];
    const cb = b[i];
    if (ca.id !== cb.id || ca.closed !== cb.closed || ca.nodes.length !== cb.nodes.length) {
      return false;
    }
    const len = ca.nodes.length;
    if (len > 0) {
      const n0a = ca.nodes[0];
      const n0b = cb.nodes[0];
      if (n0a.x !== n0b.x || n0a.y !== n0b.y) return false;
      const nEndA = ca.nodes[len - 1];
      const nEndB = cb.nodes[len - 1];
      if (nEndA.x !== nEndB.x || nEndA.y !== nEndB.y) return false;
    }
  }
  return true;
};

interface UseUndoRedoOptions {
  projectRef: React.MutableRefObject<FontProject>;
  currentGlyphRef: React.MutableRefObject<GlyphData>;
  selectedUnicode: number;
  selectedChar: string;
  setSelectedUnicode: (unicode: number) => void;
  setSelectedChar: (char: string) => void;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
}

export function useUndoRedo({
  projectRef,
  currentGlyphRef,
  selectedUnicode,
  selectedChar,
  setSelectedUnicode,
  setSelectedChar,
  setProject,
}: UseUndoRedoOptions) {
  const [undoStack, setUndoStack] = useState<GlyphData[]>([]);
  const [redoStack, setRedoStack] = useState<GlyphData[]>([]);

  const commitHistory = useCallback(() => {
    const unicode = selectedUnicode;
    const existingGlyph = projectRef.current.glyphs[unicode] || {
      unicode,
      char: selectedChar,
      advanceWidth: projectRef.current.metadata.unitsPerEm || 1000,
      lsb: 50,
      contours: [],
    };
    setUndoStack((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (
          last.unicode === existingGlyph.unicode &&
          last.advanceWidth === existingGlyph.advanceWidth &&
          last.lsb === existingGlyph.lsb &&
          areContoursEqual(last.contours, existingGlyph.contours)
        ) {
          return prev;
        }
      }
      return [...prev.slice(-49), cloneGlyph(existingGlyph)];
    });
    setRedoStack([]);
  }, [selectedUnicode, selectedChar, projectRef]);

  const handleUndo = useCallback(() => {
    setUndoStack((prevUndo) => {
      if (prevUndo.length === 0) {
        return prevUndo;
      }
      const previous = prevUndo[prevUndo.length - 1];
      const nextUndo = prevUndo.slice(0, prevUndo.length - 1);

      const currentSnapshot = currentGlyphRef.current;
      setRedoStack((prevRedo) => [...prevRedo.slice(-49), cloneGlyph(currentSnapshot)]);

      if (previous.unicode !== selectedUnicode) {
        setSelectedUnicode(previous.unicode);
        setSelectedChar(previous.char || String.fromCodePoint(previous.unicode));
      }

      setProject((prevProj) => ({
        ...prevProj,
        glyphs: {
          ...prevProj.glyphs,
          [previous.unicode]: {
            ...previous,
            modified: true,
          },
        },
        updatedAt: Date.now(),
      }));

      return nextUndo;
    });
  }, [selectedUnicode, currentGlyphRef, setSelectedUnicode, setSelectedChar, setProject]);

  const handleRedo = useCallback(() => {
    setRedoStack((prevRedo) => {
      if (prevRedo.length === 0) {
        return prevRedo;
      }
      const next = prevRedo[prevRedo.length - 1];
      const nextRedo = prevRedo.slice(0, prevRedo.length - 1);

      const currentSnapshot = currentGlyphRef.current;
      setUndoStack((prevUndo) => [...prevUndo.slice(-49), cloneGlyph(currentSnapshot)]);

      if (next.unicode !== selectedUnicode) {
        setSelectedUnicode(next.unicode);
        setSelectedChar(next.char || String.fromCodePoint(next.unicode));
      }

      setProject((prevProj) => ({
        ...prevProj,
        glyphs: {
          ...prevProj.glyphs,
          [next.unicode]: {
            ...next,
            modified: true,
          },
        },
        updatedAt: Date.now(),
      }));

      return nextRedo;
    });
  }, [selectedUnicode, currentGlyphRef, setSelectedUnicode, setSelectedChar, setProject]);

  const pushSnapshot = useCallback((glyph: GlyphData) => {
    setUndoStack((prev) => [...prev.slice(-49), cloneGlyph(glyph)]);
    setRedoStack([]);
  }, []);

  return {
    undoStack,
    redoStack,
    setUndoStack,
    pushSnapshot,
    commitHistory,
    handleUndo,
    handleRedo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
