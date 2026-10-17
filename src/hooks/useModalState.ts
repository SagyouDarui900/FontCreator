import { useState, useCallback } from 'react';

export function useModalState() {
  const [isMobileThemeModalOpen, setIsMobileThemeModalOpen] = useState<boolean>(false);
  const [showRadicals, setShowRadicals] = useState<boolean>(false);
  const [showGridDrawer, setShowGridDrawer] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1280 : true;
  });
  const [showMetricsDrawer, setShowMetricsDrawer] = useState<boolean>(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState<boolean>(false);
  const [isFontInfoModalOpen, setIsFontInfoModalOpen] = useState<boolean>(false);
  const [isTraceModalOpen, setIsTraceModalOpen] = useState<boolean>(false);
  const [isSvgModalOpen, setIsSvgModalOpen] = useState<boolean>(false);
  const [isBatchNormalizeModalOpen, setIsBatchNormalizeModalOpen] = useState<boolean>(false);
  const [isQualityModalOpen, setIsQualityModalOpen] = useState<boolean>(false);
  const [isSynthesisModalOpen, setIsSynthesisModalOpen] = useState<boolean>(false);
  const [isKerningModalOpen, setIsKerningModalOpen] = useState<boolean>(false);
  const [isWeightInterpModalOpen, setIsWeightInterpModalOpen] = useState<boolean>(false);
  const [isGlyphCompareModalOpen, setIsGlyphCompareModalOpen] = useState<boolean>(false);
  const [isRadicalStudioOpen, setIsRadicalStudioOpen] = useState<boolean>(false);
  const [isStorageManagerOpen, setIsStorageManagerOpen] = useState<boolean>(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isOpenTypeFeaturesModalOpen, setIsOpenTypeFeaturesModalOpen] = useState<boolean>(false);
  const [isGridFittingModalOpen, setIsGridFittingModalOpen] = useState<boolean>(false);
  const [isPixelStudioOpen, setIsPixelStudioOpen] = useState<boolean>(false);
  const [isMojikumiStudioOpen, setIsMojikumiStudioOpen] = useState<boolean>(false);

  const closeAllModals = useCallback(() => {
    setIsMobileThemeModalOpen(false);
    setShowRadicals(false);
    setIsTestModalOpen(false);
    setIsFontInfoModalOpen(false);
    setIsTraceModalOpen(false);
    setIsSvgModalOpen(false);
    setIsBatchNormalizeModalOpen(false);
    setIsQualityModalOpen(false);
    setIsSynthesisModalOpen(false);
    setIsKerningModalOpen(false);
    setIsWeightInterpModalOpen(false);
    setIsGlyphCompareModalOpen(false);
    setIsRadicalStudioOpen(false);
    setIsStorageManagerOpen(false);
    setIsShortcutsModalOpen(false);
    setIsExportModalOpen(false);
    setIsOpenTypeFeaturesModalOpen(false);
    setIsGridFittingModalOpen(false);
    setIsPixelStudioOpen(false);
    setIsMojikumiStudioOpen(false);
  }, []);

  return {
    isMobileThemeModalOpen,
    setIsMobileThemeModalOpen,
    showRadicals,
    setShowRadicals,
    showGridDrawer,
    setShowGridDrawer,
    showMetricsDrawer,
    setShowMetricsDrawer,
    isTestModalOpen,
    setIsTestModalOpen,
    isFontInfoModalOpen,
    setIsFontInfoModalOpen,
    isTraceModalOpen,
    setIsTraceModalOpen,
    isSvgModalOpen,
    setIsSvgModalOpen,
    isBatchNormalizeModalOpen,
    setIsBatchNormalizeModalOpen,
    isQualityModalOpen,
    setIsQualityModalOpen,
    isSynthesisModalOpen,
    setIsSynthesisModalOpen,
    isKerningModalOpen,
    setIsKerningModalOpen,
    isWeightInterpModalOpen,
    setIsWeightInterpModalOpen,
    isGlyphCompareModalOpen,
    setIsGlyphCompareModalOpen,
    isRadicalStudioOpen,
    setIsRadicalStudioOpen,
    isStorageManagerOpen,
    setIsStorageManagerOpen,
    isShortcutsModalOpen,
    setIsShortcutsModalOpen,
    isExportModalOpen,
    setIsExportModalOpen,
    isOpenTypeFeaturesModalOpen,
    setIsOpenTypeFeaturesModalOpen,
    isGridFittingModalOpen,
    setIsGridFittingModalOpen,
    isPixelStudioOpen,
    setIsPixelStudioOpen,
    isMojikumiStudioOpen,
    setIsMojikumiStudioOpen,
    closeAllModals,
  };
}
