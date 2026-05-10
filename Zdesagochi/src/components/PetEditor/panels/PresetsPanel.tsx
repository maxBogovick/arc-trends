import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { GLASS } from '../constants';
import { SectionLabel } from '../Shared';

type PresetData = Record<string, any>;

const DEFAULT_ACCESSORY_CONFIGS = {
  head:     { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
  face:     { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
  back:     { scale: 1, x: 0, y: 0, rotation: 0, behind: true  },
  neck:     { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
  clothing: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
};

const BUILT_IN_PRESETS: { id: string; name: string; emoji: string; tag: string; accent: string; data: PresetData }[] = [
  {
    id: 'kawaii',
    name: 'Каваи',
    emoji: '🎀',
    tag: 'Милый',
    accent: '#FF66AA',
    data: {
      equippedSkinId: 'default',
      equippedBodyId: 'blob',
      equippedHeadId: 'heart',
      equippedEarsId: 'round_ears',
      equippedBodyPartId: 'chubby',
      equippedLimbsId: 'small_paws',
      equippedTailId: 'bow',
      equippedBgId: 'dusk',
      equippedAuraId: 'divine',
      petColorOverride: { body1: '#2A0A1A', body2: '#12030B', glow: '#FF66AA', cheek: '#200818' },
      gradientDirection: 'radial',
      petMorph: { scale: 0.95, width: 1, height: 0.88, headScale: 1.5, earsScale: 1.4, limbsScale: 0.7, squish: 1.1 },
      eyeStyleOverride: 'cute',
      eyeColorOverride: '#FF66AA',
      overlayOverride: null,
      equippedNoseId: 'heart',
      equippedMouthStyleId: 'blush',
      equippedAccessories: { head: 'none_head', face: 'none_face', back: 'none_back', neck: 'bow_tie', clothing: 'dress' },
      accessoryConfigs: DEFAULT_ACCESSORY_CONFIGS,
    },
  },
  {
    id: 'cyber',
    name: 'Кибер',
    emoji: '⚡',
    tag: 'Техно',
    accent: '#00BBFF',
    data: {
      equippedSkinId: 'cyber',
      equippedBodyId: 'blob',
      equippedHeadId: 'square',
      equippedEarsId: 'antenna',
      equippedBodyPartId: 'blocky',
      equippedLimbsId: 'claws',
      equippedTailId: 'lightning',
      equippedBgId: 'cyber_grid',
      equippedAuraId: 'electric',
      petColorOverride: { body1: '#0A1A3D', body2: '#030A1A', glow: '#00BBFF', cheek: '#081525' },
      gradientDirection: 'horizontal',
      petMorph: { scale: 1, width: 0.85, height: 1.1, headScale: 1, earsScale: 1.2, limbsScale: 1, squish: 0.9 },
      eyeStyleOverride: 'led',
      eyeColorOverride: '#00BBFF',
      overlayOverride: null,
      equippedNoseId: 'led',
      equippedMouthStyleId: 'pixel',
      equippedAccessories: { head: 'headphones', face: 'cyber_eye', back: 'none_back', neck: 'chain', clothing: 'armor' },
      accessoryConfigs: DEFAULT_ACCESSORY_CONFIGS,
    },
  },
  {
    id: 'nature',
    name: 'Дух леса',
    emoji: '🌿',
    tag: 'Природа',
    accent: '#00FF66',
    data: {
      equippedSkinId: 'root',
      equippedBodyId: 'blob',
      equippedHeadId: 'blob',
      equippedEarsId: 'elf',
      equippedBodyPartId: 'pear',
      equippedLimbsId: 'tentacles',
      equippedTailId: 'curly',
      equippedBgId: 'aurora',
      equippedAuraId: 'toxic',
      petColorOverride: { body1: '#0A2A10', body2: '#031508', glow: '#00FF66', cheek: '#083018' },
      gradientDirection: 'diagonal',
      petMorph: { scale: 1, width: 1.1, height: 1, headScale: 1.1, earsScale: 1.5, limbsScale: 1.2, squish: 1 },
      eyeStyleOverride: 'crystal',
      eyeColorOverride: '#00FF66',
      overlayOverride: null,
      equippedNoseId: 'cat',
      equippedMouthStyleId: 'smile',
      equippedAccessories: { head: 'none_head', face: 'none_face', back: 'wings', neck: 'amulet', clothing: 'robe' },
      accessoryConfigs: { ...DEFAULT_ACCESSORY_CONFIGS, back: { scale: 1, x: 0, y: 0, rotation: 0, behind: true } },
    },
  },
  {
    id: 'void_boss',
    name: 'Властелин Пустоты',
    emoji: '🌑',
    tag: 'Темный',
    accent: '#6600CC',
    data: {
      equippedSkinId: 'void',
      equippedBodyId: 'blob',
      equippedHeadId: 'diamond',
      equippedEarsId: 'bat',
      equippedBodyPartId: 'slim',
      equippedLimbsId: 'claws',
      equippedTailId: 'fan',
      equippedBgId: 'void_dark',
      equippedAuraId: 'shadow',
      petColorOverride: { body1: '#141414', body2: '#000000', glow: '#6600CC', cheek: '#101010' },
      gradientDirection: 'radial',
      petMorph: { scale: 1.05, width: 0.9, height: 1.15, headScale: 1.2, earsScale: 1.6, limbsScale: 1.1, squish: 0.8 },
      eyeStyleOverride: 'hologram',
      eyeColorOverride: '#CC44FF',
      overlayOverride: 'glitch',
      equippedNoseId: 'none',
      equippedMouthStyleId: 'fangs',
      equippedAccessories: { head: 'horns', face: 'none_face', back: 'cape', neck: 'choker', clothing: 'robe' },
      accessoryConfigs: { ...DEFAULT_ACCESSORY_CONFIGS, back: { scale: 1, x: 0, y: 0, rotation: 0, behind: true } },
    },
  },
  {
    id: 'royal',
    name: 'Королевский',
    emoji: '👑',
    tag: 'Элита',
    accent: '#FFB800',
    data: {
      equippedSkinId: 'chrome',
      equippedBodyId: 'blob',
      equippedHeadId: 'oval',
      equippedEarsId: 'pointy',
      equippedBodyPartId: 'tank',
      equippedLimbsId: 'long_arms',
      equippedTailId: 'fan',
      equippedBgId: 'chrome_world',
      equippedAuraId: 'divine',
      petColorOverride: { body1: '#2A1A00', body2: '#120B00', glow: '#FFB800', cheek: '#1A1000' },
      gradientDirection: 'vertical',
      petMorph: { scale: 1.05, width: 1, height: 1.1, headScale: 1.1, earsScale: 1, limbsScale: 1, squish: 0.95 },
      eyeStyleOverride: 'star',
      eyeColorOverride: '#FFB800',
      overlayOverride: null,
      equippedNoseId: 'star',
      equippedMouthStyleId: 'smile',
      equippedAccessories: { head: 'crown', face: 'monocle', back: 'angel_wings', neck: 'chain', clothing: 'suit' },
      accessoryConfigs: { ...DEFAULT_ACCESSORY_CONFIGS, back: { scale: 1, x: 0, y: 0, rotation: 0, behind: true } },
    },
  },
  {
    id: 'glitch_ghost',
    name: 'Призрак-Глитч',
    emoji: '👻',
    tag: 'Хаос',
    accent: '#9AAEFF',
    data: {
      equippedSkinId: 'phantom',
      equippedBodyId: 'blob',
      equippedHeadId: 'egg',
      equippedEarsId: 'horns',
      equippedBodyPartId: 'bubble',
      equippedLimbsId: 'wings',
      equippedTailId: 'spiral',
      equippedBgId: 'void_rift',
      equippedAuraId: 'cosmic',
      petColorOverride: { body1: '#C8D0E8', body2: '#6070A0', glow: '#9AAEFF', cheek: '#A8B0D0' },
      gradientDirection: 'diagonal_reverse',
      petMorph: { scale: 1, width: 1.2, height: 1.1, headScale: 1.3, earsScale: 1.4, limbsScale: 0.8, squish: 1.2 },
      eyeStyleOverride: 'cross',
      eyeColorOverride: '#9AAEFF',
      overlayOverride: 'glitch',
      equippedNoseId: 'none',
      equippedMouthStyleId: 'zigzag',
      equippedAccessories: { head: 'halo', face: 'mask', back: 'none_back', neck: 'amulet', clothing: 'coat' },
      accessoryConfigs: DEFAULT_ACCESSORY_CONFIGS,
    },
  },
];

export function PresetsPanel() {
  const { petPresets, savePreset, loadPreset, deletePreset } = usePetStore();
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName('');
    }
  };

  const applyBuiltIn = (data: PresetData) => {
    usePetStore.getState().recordHistory();
    usePetStore.setState({ ...data });
    usePetStore.getState().notify('Тема применена!', 'success');
  };

  const handleShare = () => {
    const code = usePetStore.getState().exportAppearanceCode();
    navigator.clipboard.writeText(code);
    usePetStore.getState().notify('Код облика скопирован! 📋', 'success');
  };

  const handleImport = async () => {
    const code = await navigator.clipboard.readText();
    if (code) {
      usePetStore.getState().importAppearanceCode(code);
    }
  };

  return (
    <div className="space-y-5">
      <SectionLabel>✨ Темы</SectionLabel>
      <p className="text-[10px] text-lumio-muted px-1">Готовые образы — применяются одним нажатием</p>

      <div className="grid grid-cols-2 gap-2">
        {BUILT_IN_PRESETS.map(p => (
          <motion.button
            key={p.id}
            whileHover={{ scale: 1.03, y: -2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => applyBuiltIn(p.data)}
            className="flex flex-col items-start gap-1 p-3 rounded-2xl text-left relative overflow-hidden"
            style={GLASS}
          >
            {/* accent stripe */}
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: p.accent }} />
            <span className="text-2xl mt-1">{p.emoji}</span>
            <span className="text-xs font-bold text-lumio-text">{p.name}</span>
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: p.accent + '22', color: p.accent }}>
              {p.tag}
            </span>
          </motion.button>
        ))}
      </div>

      <div className="border-t border-slate-100 pt-5 space-y-4">
        <SectionLabel>👗 Мои пресеты</SectionLabel>

        <div className="flex gap-2">
          <input
            type="text"
            value={newPresetName}
            onChange={e => setNewPresetName(e.target.value)}
            placeholder="Название наряда..."
            className="flex-1 px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-indigo-400"
            style={{ background: 'white', borderColor: '#E5E7EB', color: '#1E1147' }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            disabled={!newPresetName.trim()}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}
          >
            Сохранить
          </motion.button>
        </div>

        <div className="space-y-2">
          {Object.keys(petPresets).length === 0 ? (
            <p className="text-xs text-lumio-muted text-center py-4">Нет сохраненных нарядов</p>
          ) : (
            Object.keys(petPresets).map(name => (
              <motion.div
                key={name}
                whileHover={{ y: -2 }}
                className="flex items-center justify-between p-3 rounded-2xl"
                style={GLASS}
              >
                <span className="font-bold text-sm text-lumio-text truncate flex-1">{name}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadPreset(name)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                  >
                    Надеть
                  </button>
                  <button
                    onClick={() => deletePreset(name)}
                    className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                    title="Удалить"
                  >
                    ✕
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 space-y-3">
        <p className="text-[10px] font-bold text-lumio-muted uppercase tracking-wider">Поделиться обликом</p>
        <div className="flex gap-2">
          <button
            onClick={handleShare}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-indigo-600 bg-white border border-indigo-100 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
          >
            📋 Копировать код
          </button>
          <button
            onClick={handleImport}
            className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            📥 Импорт из буфера
          </button>
        </div>
      </div>
    </div>
  );
}
