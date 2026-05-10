import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../store/petStore';

// Data & Types
import { SKINS } from '../data/skins';
import { PALETTES } from '../data/palettes';
import { getAccessoriesBySlot } from '../data/accessories';
import { HEADS, EARS_OPTIONS, BODY_PARTS, LIMBS_OPTIONS, TAILS_OPTIONS } from '../data/petParts';
import type { HeadId, EarsId, BodyPartId, LimbsId, TailId } from '../data/petParts';
import type { PetMood } from '../api';

// Editor Components
import { getBackground } from '../data/backgrounds';
import { CATEGORIES } from '../components/PetEditor/constants';
import type { CategoryId } from '../components/PetEditor/constants';
import { EditorPreview } from '../components/PetEditor/EditorPreview';

// Panels
import { PartsPanel } from '../components/PetEditor/panels/PartsPanel';
import { MorphPanel } from '../components/PetEditor/panels/MorphPanel';
import { ColorPanel } from '../components/PetEditor/panels/ColorPanel';
import { SkinPanel } from '../components/PetEditor/panels/SkinPanel';
import { AuraPanel } from '../components/PetEditor/panels/AuraPanel';
import { AccessoriesPanel } from '../components/PetEditor/panels/AccessoriesPanel';
import { BgPanel } from '../components/PetEditor/panels/BgPanel';
import { PresetsPanel } from '../components/PetEditor/panels/PresetsPanel';
import { EyesPanel } from '../components/PetEditor/panels/EyesPanel';

export function PetEditorPage() {
  const {
    setActiveTab, equipBody, equipSkin, equipAura, equipBg, setPetColorOverride,
    setPetMorph, setAccessory, setAccessoryConfig,
    equipHead, equipEars, equipBodyPart, equipLimbs, equipTail,
    equipNose, equipMouthStyle,
    ownedSkins, ownedAuras, ownedBgs, coins, pet, savePetAppearance,
    setEyeStyleOverride, setEyeColorOverride,
  } = usePetStore();

  const [category, setCategory] = useState<CategoryId>('body');
  const [previewMood, setPreviewMood] = useState<PetMood>('happy');
  const [isFlashing, setIsFlashing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const initialSnapshot = useRef<any>(null);

  useEffect(() => {
    // Capture initial state for comparison
    const state = usePetStore.getState();
    initialSnapshot.current = {
      equippedSkinId: state.equippedSkinId,
      equippedBodyId: state.equippedBodyId,
      equippedHeadId: state.equippedHeadId,
      equippedEarsId: state.equippedEarsId,
      equippedBodyPartId: state.equippedBodyPartId,
      equippedLimbsId: state.equippedLimbsId,
      equippedTailId: state.equippedTailId,
      equippedBgId: state.equippedBgId,
      petColorOverride: state.petColorOverride,
      petMorph: state.petMorph,
      equippedAuraId: state.equippedAuraId,
      equippedAccessories: state.equippedAccessories,
      accessoryConfigs: state.accessoryConfigs,
      eyeStyleOverride: state.eyeStyleOverride,
      eyeColorOverride: state.eyeColorOverride,
      overlayOverride: state.overlayOverride,
    };
  }, []);

  const takePhoto = useCallback(() => {
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 150);

    const svgEl = document.querySelector('[data-pet-export]') as SVGSVGElement | null;
    if (!svgEl) {
      usePetStore.getState().notify('Не удалось сделать фото', 'error');
      return;
    }

    const state = usePetStore.getState();
    const bg = getBackground(state.equippedBgId);
    const accent = bg.accentColor;

    const SIZE = 600;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, SIZE);
    bgGrad.addColorStop(0, accent + '55');
    bgGrad.addColorStop(1, accent + 'BB');
    ctx.fillStyle = bgGrad;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(0, 0, SIZE, SIZE, 48);
    } else {
      ctx.rect(0, 0, SIZE, SIZE);
    }
    ctx.fill();

    // Floor strip
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.rect(0, SIZE * 0.82, SIZE, SIZE * 0.18);
    ctx.fill();

    // Serialize SVG
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(SIZE));
    clone.setAttribute('height', String(SIZE));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.style.overflow = 'hidden';

    const svgStr = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      const a = document.createElement('a');
      a.download = `${state.pet?.name?.toLowerCase().replace(/\s+/g, '-') ?? 'my-pet'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();

      usePetStore.getState().notify('📸 Фото сохранено!', 'success');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      usePetStore.getState().notify('Не удалось сделать фото', 'error');
    };
    img.src = url;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z';
      const isY = e.key.toLowerCase() === 'y';
      if ((e.ctrlKey || e.metaKey) && isZ && !e.shiftKey) {
        e.preventDefault();
        usePetStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (isY || (e.shiftKey && isZ))) {
        e.preventDefault();
        usePetStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const randomize = useCallback(() => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    // Randomize modular parts
    equipHead(pick(HEADS).id as HeadId);
    equipEars(pick(EARS_OPTIONS).id as EarsId);
    equipBodyPart(pick(BODY_PARTS).id as BodyPartId);
    equipLimbs(pick(LIMBS_OPTIONS).id as LimbsId);
    equipTail(pick(TAILS_OPTIONS).id as TailId);

    const availSkins = SKINS.filter(s => ownedSkins.includes(s.id));
    if (availSkins.length) equipSkin(pick(availSkins).id);

    const availAuras = ownedAuras;
    if (availAuras.length) equipAura(pick(availAuras));

    const availBgs = ownedBgs;
    if (availBgs.length) equipBg(pick(availBgs));

    const pal = pick(PALETTES);
    setPetColorOverride(pal);
    setPetMorph({ scale: 0.8 + Math.random() * 0.6, width: 0.8 + Math.random() * 0.6, height: 0.8 + Math.random() * 0.6, headScale: 0.8 + Math.random() * 0.6, earsScale: 0.7 + Math.random() * 0.8, limbsScale: 0.7 + Math.random() * 0.8, squish: 0.7 + Math.random() * 0.7 });

    const accHeads = getAccessoriesBySlot('head');
    const accFaces = getAccessoriesBySlot('face');
    const accBacks = getAccessoriesBySlot('back');
    setAccessory('head', pick(accHeads).id);
    setAccessory('face', pick(accFaces).id);
    setAccessory('back', pick(accBacks).id);
    setAccessoryConfig('head', { scale: 1, x: 0, y: 0, rotation: 0, behind: false });
    setAccessoryConfig('face', { scale: 1, x: 0, y: 0, rotation: 0, behind: false });
    setAccessoryConfig('back', { scale: 1, x: 0, y: 0, rotation: 0, behind: true });
  }, [ownedSkins, ownedAuras, ownedBgs, equipHead, equipEars, equipBodyPart, equipLimbs, equipTail, equipSkin, equipAura, equipBg, setPetColorOverride, setPetMorph, setAccessory, setAccessoryConfig]);

  const resetAll = useCallback(() => {
    usePetStore.getState().recordHistory();
    equipBody('blob');
    equipHead('round');
    equipEars('none');
    equipBodyPart('chubby');
    equipLimbs('none');
    equipTail('none');
    setPetColorOverride(null);
    setPetMorph({ scale: 1, width: 1, height: 1, headScale: 1, earsScale: 1, limbsScale: 1, squish: 1 });
    equipSkin('default');
    equipAura('none');
    equipBg('void_dark');
    setAccessory('head', 'none_head');
    setAccessory('face', 'none_face');
    setAccessory('back', 'none_back');
    setAccessory('neck', 'none_neck');
    setAccessory('clothing', 'none_clothing');
    setAccessoryConfig('head', { scale: 1, x: 0, y: 0, rotation: 0, behind: false });
    setAccessoryConfig('face', { scale: 1, x: 0, y: 0, rotation: 0, behind: false });
    setAccessoryConfig('back', { scale: 1, x: 0, y: 0, rotation: 0, behind: true });
    setAccessoryConfig('neck', { scale: 1, x: 0, y: 0, rotation: 0, behind: false });
    setAccessoryConfig('clothing', { scale: 1, x: 0, y: 0, rotation: 0, behind: true });
    setEyeStyleOverride(null);
    setEyeColorOverride(null);
    equipNose('none');
    equipMouthStyle('auto');
  }, [equipBody, equipHead, equipEars, equipBodyPart, equipLimbs, equipTail, setPetColorOverride, setPetMorph, equipSkin, equipAura, equipBg, setAccessory, setAccessoryConfig, setEyeStyleOverride, setEyeColorOverride, equipNose, equipMouthStyle]);

  const PANEL_MAP: Record<CategoryId, React.ReactNode> = {
    body:        <PartsPanel />,
    morph:       <MorphPanel />,
    color:       <ColorPanel />,
    eyes:        <EyesPanel />,
    skin:        <SkinPanel />,
    aura:        <AuraPanel />,
    accessories: <AccessoriesPanel />,
    bg:          <BgPanel />,
    presets:     <PresetsPanel />,
  };

  if (!pet) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl">🫧</motion.div>
        <p className="mt-4 font-bold text-lumio-text">Загрузка питомца...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#F9FAFB' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      transition={{ duration: 0.25 }}
    >
      <AnimatePresence>
        {isFlashing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-[1000] pointer-events-none"
          />
        )}
      </AnimatePresence>

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
          <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 mr-2">
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => usePetStore.getState().undo()}
              disabled={usePetStore(s => s.history.length === 0)}
              className="p-1.5 rounded-lg text-lumio-text disabled:opacity-30 hover:bg-white transition-all"
              title="Отменить (Ctrl+Z)">
              ↩️
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              onClick={() => usePetStore.getState().redo()}
              disabled={usePetStore(s => s.future.length === 0)}
              className="p-1.5 rounded-lg text-lumio-text disabled:opacity-30 hover:bg-white transition-all"
              title="Вернуть (Ctrl+Y)">
              ↪️
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (initialSnapshot.current) {
                usePetStore.getState().recordHistory();
                usePetStore.setState({ ...initialSnapshot.current });
                usePetStore.getState().notify('Оригинальный облик восстановлен', 'info');
              }
            }}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm font-bold text-amber-600 transition-colors"
            style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}
            title="Вернуть как было при входе">
            ⏪ Оригинал
          </motion.button>

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
            onClick={() => { savePetAppearance(); setActiveTab('home'); }}
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
          
          <div className="relative">
            <EditorPreview 
              previewMood={previewMood} 
              setPreviewMood={setPreviewMood} 
              comparisonState={isComparing ? initialSnapshot.current : null} 
            />
            
            {/* Comparison toggle button */}
            <motion.button
              onMouseDown={() => setIsComparing(true)}
              onMouseUp={() => setIsComparing(false)}
              onMouseLeave={() => setIsComparing(false)}
              onTouchStart={() => setIsComparing(true)}
              onTouchEnd={() => setIsComparing(false)}
              whileTap={{ scale: 0.9 }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-lg z-20 transition-colors shadow-lg"
              style={{ 
                background: isComparing ? '#4F46E5' : 'rgba(255,255,255,0.9)', 
                color: isComparing ? 'white' : '#4F46E5',
                border: '1px solid rgba(0,0,0,0.05)'
              }}
              title="Зажми, чтобы сравнить с оригиналом"
            >
              🌓
            </motion.button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={takePhoto}
            className="mt-2 flex items-center gap-2 px-6 py-2.5 rounded-2xl text-sm font-bold text-indigo-600 transition-all border border-indigo-100 hover:bg-indigo-50"
            style={{ background: 'white', boxShadow: '0 4px 12px rgba(129,140,248,0.15)' }}
          >
            📸 Сделать фото
          </motion.button>
        </div>

        {/* ── Right panel ── */}
        <div className="flex-1 flex overflow-hidden">
          {/* Category sidebar */}
          <div className="w-16 flex flex-col items-center py-3 gap-0.5 shrink-0"
            style={{ borderRight: '1px solid #E5E7EB' }}>
            {CATEGORIES.map((cat, i) => {
              const active = category === cat.id;
              return (
                <React.Fragment key={cat.id}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setCategory(cat.id)}
                    className="w-11 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
                    style={{
                      background: active ? '#F5F3FF' : 'transparent',
                      border: active ? '1px solid #C4B5FD' : '1px solid transparent', boxShadow: active ? '0 2px 8px rgba(124,58,237,0.15)' : 'none',
                    }}
                    title={cat.label}>
                    <span className="text-base">{cat.emoji}</span>
                    <span className="text-[7px] font-bold leading-none" style={{ color: active ? '#7C3AED' : '#9CA3AF' }}>
                      {cat.label.slice(0, 5)}
                    </span>
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
