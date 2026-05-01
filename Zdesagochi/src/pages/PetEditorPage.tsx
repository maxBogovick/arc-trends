import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../store/petStore';

// Data & Types
import { BODY_SHAPES } from '../data/bodyShapes';
import { SKINS } from '../data/skins';
import { PALETTES } from '../data/palettes';
import { getAccessoriesBySlot } from '../data/accessories';
import type { BodyShapeId } from '../data/bodyShapes';
import type { PetMood } from '../api';

// Editor Components
import { CATEGORIES } from '../components/PetEditor/constants';
import type { CategoryId } from '../components/PetEditor/constants';
import { EditorPreview } from '../components/PetEditor/EditorPreview';

// Panels
import { BodyPanel } from '../components/PetEditor/panels/BodyPanel';
import { MorphPanel } from '../components/PetEditor/panels/MorphPanel';
import { ColorPanel } from '../components/PetEditor/panels/ColorPanel';
import { SkinPanel } from '../components/PetEditor/panels/SkinPanel';
import { AuraPanel } from '../components/PetEditor/panels/AuraPanel';
import { AccessoriesPanel } from '../components/PetEditor/panels/AccessoriesPanel';
import { BgPanel } from '../components/PetEditor/panels/BgPanel';
import { PresetsPanel } from '../components/PetEditor/panels/PresetsPanel';

export function PetEditorPage() {
  const {
    setActiveTab, equipBody, equipSkin, equipAura, equipBg, setPetColorOverride,
    setPetMorph, setAccessory, setAccessoryConfig,
    ownedSkins, ownedAuras, ownedBgs, coins,
  } = usePetStore();

  const [category, setCategory] = useState<CategoryId>('body');
  const [previewMood, setPreviewMood] = useState<PetMood>('happy');

  const randomize = useCallback(() => {
    const shapes = BODY_SHAPES.map(s => s.id);
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    equipBody(pick(shapes) as BodyShapeId);

    const availSkins = SKINS.filter(s => ownedSkins.includes(s.id));
    if (availSkins.length) equipSkin(pick(availSkins).id);

    const availAuras = ownedAuras;
    if (availAuras.length) equipAura(pick(availAuras));

    const availBgs = ownedBgs;
    if (availBgs.length) equipBg(pick(availBgs));

    const pal = pick(PALETTES);
    setPetColorOverride(pal);
    setPetMorph({ scale: 0.8 + Math.random() * 0.6, width: 0.8 + Math.random() * 0.6, height: 0.8 + Math.random() * 0.6 });

    const heads = getAccessoriesBySlot('head');
    const faces = getAccessoriesBySlot('face');
    const backs = getAccessoriesBySlot('back');
    setAccessory('head', pick(heads).id);
    setAccessory('face', pick(faces).id);
    setAccessory('back', pick(backs).id);
    setAccessoryConfig('head', { scale: 1, x: 0, y: 0 });
    setAccessoryConfig('face', { scale: 1, x: 0, y: 0 });
    setAccessoryConfig('back', { scale: 1, x: 0, y: 0 });
  }, [ownedSkins, ownedAuras, ownedBgs, equipBody, equipSkin, equipAura, equipBg, setPetColorOverride, setPetMorph, setAccessory, setAccessoryConfig]);

  const resetAll = useCallback(() => {
    equipBody('blob');
    setPetColorOverride(null);
    setPetMorph({ scale: 1, width: 1, height: 1 });
    equipSkin('default');
    equipAura('none');
    equipBg('void_dark');
    setAccessory('head', 'none_head');
    setAccessory('face', 'none_face');
    setAccessory('back', 'none_back');
    setAccessoryConfig('head', { scale: 1, x: 0, y: 0 });
    setAccessoryConfig('face', { scale: 1, x: 0, y: 0 });
    setAccessoryConfig('back', { scale: 1, x: 0, y: 0 });
  }, [equipBody, setPetColorOverride, setPetMorph, equipSkin, equipAura, equipBg, setAccessory, setAccessoryConfig]);

  const PANEL_MAP: Record<CategoryId, React.ReactNode> = {
    body:        <BodyPanel />,
    morph:       <MorphPanel />,
    color:       <ColorPanel />,
    skin:        <SkinPanel />,
    aura:        <AuraPanel />,
    accessories: <AccessoriesPanel />,
    bg:          <BgPanel />,
    presets:     <PresetsPanel />,
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#F9FAFB' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Header ── */}
      <header className="h-14 flex items-center gap-3 px-4 shrink-0"
        style={{ borderBottom: '1px solid #E5E7EB' }}>
        <motion.button
          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => setActiveTab('home')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-lumio-text hover:text-lumio-text transition-colors"
          style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          ← Назад
        </motion.button>

        <div className="flex-1 text-center">
          <h1 className="font-bold text-lumio-text text-base tracking-wide">✏️ Редактор питомца</h1>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={resetAll}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold text-red-500 hover:text-red-600 transition-colors"
            style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}
            title="Сбросить всё к базовому">
            🗑 Сброс
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={randomize}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold text-lumio-text hover:text-lumio-text transition-colors"
            style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}
            title="Рандомный облик">
            🎲 Рандом
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setActiveTab('home')}
            className="px-4 py-1.5 rounded-xl text-sm font-bold text-white transition-colors"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
            ✓ Готово
          </motion.button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left panel: Preview (desktop only) ── */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-6 p-8 shrink-0"
          style={{ width: 340, borderRight: '1px solid #E5E7EB' }}>
          <EditorPreview previewMood={previewMood} setPreviewMood={setPreviewMood} />
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Category sidebar */}
          <div className="w-14 flex flex-col items-center py-3 gap-0.5 shrink-0"
            style={{ borderRight: '1px solid #E5E7EB' }}>
            {CATEGORIES.map((cat, i) => {
              const active = category === cat.id;
              return (
                <React.Fragment key={cat.id}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCategory(cat.id)}
                    className="w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                    style={{
                      background: active ? '#F5F3FF' : 'transparent',
                      border: active ? '1px solid #C4B5FD' : '1px solid transparent', boxShadow: active ? '0 2px 8px rgba(124,58,237,0.15)' : 'none',
                    }}
                    title={cat.label}>
                    <span className="text-base">{cat.emoji}</span>
                  </motion.button>
                  {i === 2 && <div className="w-6 h-px bg-gray-200 my-1 rounded-full" />}
                </React.Fragment>
              );
            })}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {/* Mobile preview */}
            <div className="lg:hidden p-4 border-b border-slate-200 sticky top-0 z-10" style={{ background: '#F9FAFB' }}>
              <EditorPreview previewMood={previewMood} setPreviewMood={setPreviewMood} />
            </div>

            {/* Category header */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <span className="text-xl">{CATEGORIES.find(c => c.id === category)?.emoji}</span>
              <span className="font-bold text-lumio-text text-sm">{CATEGORIES.find(c => c.id === category)?.label}</span>
              <div className="flex-1" />
              <div className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-lumio-muted"
                style={{ background: '#F3F4F6' }}>
                🪙 {coins.toLocaleString()}
              </div>
            </div>

            {/* Animated panels */}
            <div className="p-4">
              <AnimatePresence mode="wait">
                <motion.div key={category}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.18 }}>
                  {PANEL_MAP[category]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
