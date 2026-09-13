import React, { useState } from 'react';
import {
  X,
  Settings,
  Check,
  Download,
  FileJson,
  Layers,
  Database,
  HardDriveDownload,
  ShieldCheck,
  Scale,
  HelpCircle,
  Sparkles,
  Info,
  ExternalLink,
} from 'lucide-react';
import { FontMetadata, FontProject } from '../types';
import { ThemeMode } from '../utils/theme';

interface FontInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: FontProject;
  setProject: React.Dispatch<React.SetStateAction<FontProject>>;
  theme: ThemeMode;
  onShowToast?: (text: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

type ModalTab = 'info' | 'license' | 'guide';

const LICENSE_PRESETS = [
  {
    id: 'ofl',
    name: 'SIL Open Font License 1.1 (OFL)',
    badge: '推奨・国際標準',
    desc: 'フォント界の標準オープンソース。商用利用・改変・Webフォント・製品組み込み自由。',
    license:
      'This Font Software is licensed under the SIL Open Font License, Version 1.1. This Font Software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.',
    licenseUrl: 'https://openfontlicense.org/',
  },
  {
    id: 'commercial_free',
    name: '商用フリー・ロイヤリティフリー (Free for Commercial)',
    badge: '商用利用完全自由',
    desc: '個人・法人・同人・商業出版・ゲーム・映像問わずクレジット表記不要で自由利用可能。',
    license:
      '本フォントは商用・非商用問わず無償で自由に利用（印刷物・同人誌・ゲーム・アプリ・映像・Web等への組み込み）が可能です。ロイヤリティフリー。',
    licenseUrl: '',
  },
  {
    id: 'cc0',
    name: 'CC0 1.0 全世界 パブリック・ドメイン',
    badge: '著作権完全放棄',
    desc: '権利を放棄し完全な共有財産（パブリックドメイン）として誰でも無制限に利用可能。',
    license:
      'To the extent possible under law, the author has waived all copyright and related rights to this work under Creative Commons CC0 1.0 Universal.',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
  },
  {
    id: 'mit',
    name: 'MIT License',
    badge: '汎用オープンソース',
    desc: 'ソフトウェアやフォントに広く使われる極めて簡潔で自由度の高いライセンス。',
    license:
      'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated font files to use, copy, modify, merge, publish, distribute without restriction.',
    licenseUrl: 'https://opensource.org/licenses/MIT',
  },
  {
    id: 'custom',
    name: 'カスタム独自ライセンス / 独自利用規約',
    badge: '独自設定',
    desc: 'ご自身で作成したオリジナルの利用規約や販売条件を自由に記述・設定できます。',
    license: '',
    licenseUrl: '',
  },
];

export const FontInfoModal: React.FC<FontInfoModalProps> = ({
  isOpen,
  onClose,
  project,
  setProject,
  theme,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('info');
  const [formData, setFormData] = useState<FontMetadata>({
    license: 'SIL Open Font License 1.1',
    licenseUrl: 'https://openfontlicense.org/',
    ...project.metadata,
  });

  // Keep formData synchronized whenever project.metadata updates or modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        license: project.metadata.license || 'SIL Open Font License 1.1',
        licenseUrl: project.metadata.licenseUrl || 'https://openfontlicense.org/',
        ...project.metadata,
      });
    }
  }, [isOpen, project.metadata]);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const isLight = theme === 'light';

  if (!isOpen) return null;

  const glyphCount = Object.keys(project.glyphs || {}).length;
  const radicalCount = Object.keys(project.radicals || {}).length;

  const handleApplyPreset = (presetId: string) => {
    const p = LICENSE_PRESETS.find((x) => x.id === presetId);
    if (!p) return;

    const currentYear = new Date().getFullYear();
    const designerName = formData.designer || 'Author';

    setFormData((prev) => ({
      ...prev,
      license: p.license || prev.license,
      licenseUrl: p.licenseUrl || prev.licenseUrl,
      copyright:
        prev.copyright || `Copyright (c) ${currentYear} by ${designerName}. All rights reserved.`,
    }));

    if (onShowToast) {
      onShowToast(`ライセンス「${p.name}」の設定を適用しました`, 'success');
    }
  };

  const handleDownloadJsonBackup = () => {
    try {
      const exportProject: FontProject = {
        ...project,
        metadata: {
          ...project.metadata,
          ...formData,
        },
        updatedAt: Date.now(),
      };

      const jsonString = JSON.stringify(exportProject, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement('a');
      const safeName = (formData.familyName || project.metadata.familyName || 'FontProject')
        .trim()
        .replace(/[^a-zA-Z0-9_\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff-]/g, '_');
      const timeStamp = new Date().toISOString().slice(0, 10);
      downloadAnchor.href = url;
      downloadAnchor.download = `${safeName}_${timeStamp}.fontproj.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);

      setIsDownloaded(true);
      setTimeout(() => setIsDownloaded(false), 3000);

      if (onShowToast) {
        onShowToast(`フォント「${safeName}」のJSONバックアップを保存しました`, 'success');
      }
    } catch (err) {
      console.error('Failed to export project JSON:', err);
      if (onShowToast) {
        onShowToast('JSONバックアップの出力に失敗しました', 'error');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProject((prev) => ({
      ...prev,
      metadata: { ...formData },
      updatedAt: Date.now(),
    }));
    if (onShowToast) {
      onShowToast('フォント情報とライセンス設定を保存しました', 'success');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div
        className={`w-full max-w-xl border rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-colors ${
          isLight
            ? 'bg-[#f7faf8] border-[#c8ded3] text-stone-800'
            : 'bg-[#151e18] border-[#25362b] text-emerald-100'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3.5 border-b flex items-center justify-between ${
            isLight ? 'bg-white border-[#d8e6df]' : 'bg-[#18231c] border-[#25362b]'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Settings className={`w-4 h-4 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
            <h2
              className={`text-xs font-bold uppercase tracking-wider ${
                isLight ? 'text-emerald-950' : 'text-emerald-200'
              }`}
            >
              フォント情報・ライセンス設定 (Font Info & License)
            </h2>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded ${
              isLight ? 'text-stone-500 hover:bg-emerald-100' : 'text-emerald-400 hover:bg-[#202d24]'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex border-b text-xs font-bold ${
            isLight ? 'bg-stone-50 border-[#d8e6df]' : 'bg-[#111913] border-[#25362b]'
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'info'
                ? isLight
                  ? 'border-emerald-700 text-emerald-900 bg-white font-bold'
                  : 'border-emerald-500 text-emerald-300 bg-[#16211a] font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>基本情報 & メトリクス</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('license')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'license'
                ? isLight
                  ? 'border-emerald-700 text-emerald-900 bg-white font-bold'
                  : 'border-emerald-500 text-emerald-300 bg-[#16211a] font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <Scale className="w-3.5 h-3.5 text-amber-500" />
            <span>ライセンス・著作権</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guide')}
            className={`flex-1 py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all cursor-pointer ${
              activeTab === 'guide'
                ? isLight
                  ? 'border-emerald-700 text-emerald-900 bg-white font-bold'
                  : 'border-emerald-500 text-emerald-300 bg-[#16211a] font-bold'
                : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-300'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>商用利用・権利安心ガイド</span>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* TAB 1: BASIC INFO & METRICS */}
          {activeTab === 'info' && (
            <div className="space-y-3.5 animate-fadeIn">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    フォント名 (Family Name)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.familyName || ''}
                    onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                    placeholder="例: MyCustomFont"
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    スタイル名 (Subfamily)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.styleName || ''}
                    onChange={(e) => setFormData({ ...formData, styleName: e.target.value })}
                    placeholder="Regular, Bold, Medium など"
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    作者・制作者名 (Designer)
                  </label>
                  <input
                    type="text"
                    value={formData.designer || ''}
                    onChange={(e) => setFormData({ ...formData, designer: e.target.value })}
                    placeholder="あなたのペンネーム / 組織名"
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    バージョン (Version)
                  </label>
                  <input
                    type="text"
                    value={formData.version || ''}
                    onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                    placeholder="1.000"
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    Webサイト / ポートフォリオ URL
                  </label>
                  <input
                    type="text"
                    value={formData.designerUrl || ''}
                    onChange={(e) => setFormData({ ...formData, designerUrl: e.target.value })}
                    placeholder="https://..."
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    フォント説明 (Description)
                  </label>
                  <input
                    type="text"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="自作の日本語手書き風フォントです"
                    className={`border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>

              <div className={`border-t pt-3 ${isLight ? 'border-[#d8e6df]' : 'border-[#25362b]'}`}>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider block mb-2 ${
                    isLight ? 'text-emerald-950' : 'text-emerald-300'
                  }`}
                >
                  EMメトリクス (単位: FUnit)
                </span>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col space-y-1">
                    <label className={isLight ? 'text-stone-600' : 'text-emerald-400'}>UPM (Units Per Em)</label>
                    <input
                      type="number"
                      value={formData.unitsPerEm ?? 1000}
                      onChange={(e) => setFormData({ ...formData, unitsPerEm: Number(e.target.value) || 1000 })}
                      className={`border rounded p-2 font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                          : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className={isLight ? 'text-stone-600' : 'text-emerald-400'}>アセンダ (Ascender)</label>
                    <input
                      type="number"
                      value={formData.ascender ?? 800}
                      onChange={(e) => setFormData({ ...formData, ascender: Number(e.target.value) || 800 })}
                      className={`border rounded p-2 font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                          : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label className={isLight ? 'text-stone-600' : 'text-emerald-400'}>ディセンダ (Descender)</label>
                    <input
                      type="number"
                      value={formData.descender ?? -200}
                      onChange={(e) => setFormData({ ...formData, descender: Number(e.target.value) || -200 })}
                      className={`border rounded p-2 font-mono focus:outline-none ${
                        isLight
                          ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                          : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Windows 11 & Japanese OS/2 Compatibility Note */}
              <div
                className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                }`}
              >
                <div className="font-bold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Windows 11 / Mac 日本語フォント規格適合設定</span>
                </div>
                <p className="text-[10px] opacity-80 leading-relaxed">
                  エクスポート時に、OS/2テーブル（Shift-JIS 932コードページフラグ）、DirectWrite行間クリップ防止メトリクス、縦書き代替グリフ、および日・英バイリンガル名テーブルが自動構成されます。
                </p>
              </div>

              {/* Project JSON Backup & Export Section */}
              <div
                className={`p-3 rounded-lg border space-y-2.5 transition-colors ${
                  isLight
                    ? 'bg-amber-50/60 border-amber-200/80 text-stone-800'
                    : 'bg-[#18231c] border-[#2f4236] text-emerald-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className={`p-1.5 rounded-md ${
                        isLight ? 'bg-amber-200/70 text-amber-900' : 'bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      <FileJson className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold flex items-center gap-1.5">
                        <span>プロジェクトバックアップ (JSON形式)</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                            isLight ? 'bg-amber-200/60 text-amber-950' : 'bg-emerald-900/60 text-emerald-300'
                          }`}
                        >
                          .fontproj.json
                        </span>
                      </h4>
                      <p className="text-[10.5px] opacity-75 leading-tight mt-0.5">
                        全文字のベクター輪郭、メトリクス設定、部首パーツ定義を完全な構造化JSONでローカル保存します。
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-amber-200/60 dark:border-[#25362b] text-[10.5px]">
                  <div className="flex items-center gap-3 font-mono opacity-80">
                    <span>収録文字: <strong className="font-bold font-sans">{glyphCount}</strong> 字</span>
                    {radicalCount > 0 && (
                      <span>部首パーツ: <strong className="font-bold font-sans">{radicalCount}</strong> 個</span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadJsonBackup}
                    className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center space-x-1.5 transition-all shadow-xs active:scale-95 cursor-pointer ${
                      isDownloaded
                        ? 'bg-emerald-600 text-white'
                        : isLight
                        ? 'bg-amber-500 hover:bg-amber-600 text-stone-950 border border-amber-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isDownloaded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>保存完了</span>
                      </>
                    ) : (
                      <>
                        <HardDriveDownload className="w-3.5 h-3.5" />
                        <span>JSONバックアップ保存</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LICENSE & COPYRIGHT SETTINGS */}
          {activeTab === 'license' && (
            <div className="space-y-4 animate-fadeIn">
              <div
                className={`p-3 rounded-lg border ${
                  isLight ? 'bg-amber-50/70 border-amber-200 text-amber-950' : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <Scale className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>ライセンス プリセットから選択</span>
                </div>
                <p className="text-[11px] opacity-80 leading-relaxed mb-2.5">
                  出力フォントファイル（TTF/OTF）の OpenType name テーブル（ID 13: License, ID 14: URL, ID 0: Copyright）に正式に埋め込まれます。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {LICENSE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyPreset(p.id)}
                      className={`text-left p-2 rounded border transition-all cursor-pointer ${
                        formData.license?.includes(p.name.split(' ')[0]) || (p.id === 'ofl' && formData.license?.includes('OFL'))
                          ? isLight
                            ? 'bg-white border-amber-500 ring-1 ring-amber-500 shadow-xs'
                            : 'bg-[#1e2a22] border-amber-400 ring-1 ring-amber-400 shadow-xs'
                          : isLight
                          ? 'bg-white/80 border-stone-200 hover:border-amber-300 hover:bg-white'
                          : 'bg-[#151f18] border-[#293c2f] hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold text-[11px] truncate">{p.name.split('(')[0]}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold shrink-0">
                          {p.badge}
                        </span>
                      </div>
                      <p className="text-[10px] opacity-75 line-clamp-2 leading-tight">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable License Fields */}
              <div className="space-y-3">
                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    著作権表記 (Copyright String - Name ID 0)
                  </label>
                  <input
                    type="text"
                    value={formData.copyright || ''}
                    onChange={(e) => setFormData({ ...formData, copyright: e.target.value })}
                    placeholder={`Copyright (c) ${new Date().getFullYear()} by ${formData.designer || 'Your Name'}. All rights reserved.`}
                    className={`w-full border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    ライセンス規約文 (License Description - Name ID 13)
                  </label>
                  <textarea
                    rows={4}
                    value={formData.license || ''}
                    onChange={(e) => setFormData({ ...formData, license: e.target.value })}
                    placeholder="フォントの利用規約文・配布条件を入力..."
                    className={`w-full border rounded p-2 focus:outline-none font-mono text-[11px] ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>

                <div className="flex flex-col space-y-1">
                  <label className={`font-semibold ${isLight ? 'text-emerald-950' : 'text-emerald-300'}`}>
                    ライセンス案内 URL (License Info URL - Name ID 14)
                  </label>
                  <input
                    type="text"
                    value={formData.licenseUrl || ''}
                    onChange={(e) => setFormData({ ...formData, licenseUrl: e.target.value })}
                    placeholder="https://..."
                    className={`w-full border rounded p-2 focus:outline-none ${
                      isLight
                        ? 'bg-white border-[#c8ded3] text-stone-800 focus:border-emerald-700'
                        : 'bg-[#101813] border-[#2d4034] text-emerald-100 focus:border-emerald-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COPYRIGHT & COMMERCIAL USE FAQ GUIDE */}
          {activeTab === 'guide' && (
            <div className="space-y-3.5 animate-fadeIn text-[11px]">
              <div
                className={`p-3 rounded-lg border ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-emerald-950/50 border-emerald-800 text-emerald-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>作成フォントの著作権・商用利用についての保証</span>
                </div>
                <p className="leading-relaxed opacity-90">
                  本フォント作成ツールで作成されたすべての文字・ベクター輪郭・書き出されたフォントファイル（TTF / OTF / WOFF / SVG）の権利は、<strong>100%作成者であるあなたに帰属します</strong>。
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  className={`p-2.5 rounded-lg border ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#151f18] border-[#25362b]'
                  }`}
                >
                  <h4 className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Q. 作成したフォントは商用利用できますか？</span>
                  </h4>
                  <p className="mt-1 opacity-80 leading-relaxed">
                    <strong>A. はい、完全に商用利用可能です。</strong>
                    同人誌や商業出版、ポスター・チラシ、WebサイトでのWebフォント利用、YouTubeやTV番組のテロップ、ゲームやスマートフォンアプリ、LINEスタンプ、グッズ販売、社名・ブランドロゴなど、あらゆる用途で自由に無制限にご活用いただけます。
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#151f18] border-[#25362b]'
                  }`}
                >
                  <h4 className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Q. 作成したフォントを有料で販売・無償配布できますか？</span>
                  </h4>
                  <p className="mt-1 opacity-80 leading-relaxed">
                    <strong>A. はい、Boothや自サイト等での有料販売・フリー配布も完全に自由です。</strong>
                    当ツール運営側がロイヤリティや利用料を請求することは一切ございません。
                  </p>
                </div>

                <div
                  className={`p-2.5 rounded-lg border ${
                    isLight ? 'bg-white border-stone-200' : 'bg-[#151f18] border-[#25362b]'
                  }`}
                >
                  <h4 className="font-bold flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                    <Info className="w-3.5 h-3.5 text-amber-500" />
                    <span>Q. 下絵（トレース機能）を使う場合の注意点はありますか？</span>
                  </h4>
                  <p className="mt-1 opacity-80 leading-relaxed">
                    <strong>A. ご自身の手書き文字・スケッチ、または権利のクリアな素材をご利用ください。</strong>
                    他者が制作した著作権のある既存市販フォントをそのまま丸ごとトレースして再配布する行為は権利侵害となる恐れがあります。ご自身の手書き原稿やパブリックドメイン（著作権満了の歴史的書物等）から作成いただくことで、100%オリジナルの安心なフォントを作成できます。
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className={`pt-3.5 border-t flex items-center justify-between ${isLight ? 'border-[#d8e6df]' : 'border-[#25362b]'}`}>
            <div className="text-[10.5px] text-stone-500 dark:text-stone-400">
              {activeTab === 'info' && 'フォント名やEMメトリクスを設定'}
              {activeTab === 'license' && 'ライセンス・著作権情報を埋め込み'}
              {activeTab === 'guide' && '商用利用・著作権ガイド'}
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className={`px-3.5 py-1.5 rounded font-medium transition-colors cursor-pointer ${
                  isLight
                    ? 'bg-white border border-[#c8ded3] text-stone-700 hover:bg-emerald-50'
                    : 'bg-[#18231c] border border-[#25362b] text-emerald-300 hover:bg-[#202d24]'
                }`}
              >
                閉じる
              </button>
              <button
                type="submit"
                className={`px-4 py-1.5 rounded font-bold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs ${
                  isLight
                    ? 'bg-emerald-800 hover:bg-emerald-900 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>設定を保存</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
