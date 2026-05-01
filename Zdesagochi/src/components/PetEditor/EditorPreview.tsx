import { motion } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import { PetDisplay } from '../Pet/PetDisplay';
import { BODY_SHAPES } from '../../data/bodyShapes';
import { getSkin } from '../../data/skins';
import { getBackground } from '../../data/backgrounds';
import { getAura } from '../../data/auras';
import { MOODS } from './constants';
import type { PetMood } from '../../api';

export function EditorPreview({ previewMood, setPreviewMood, comparisonState }: { 
  previewMood: PetMood; 
  setPreviewMood: (m: PetMood) => void;
  comparisonState?: any;
}) {
  const { pet, equippedAuraId, equippedBgId } = usePetStore();
  
  const activeBgId = comparisonState?.equippedBgId ?? equippedBgId;
  const activeAuraId = comparisonState?.equippedAuraId ?? equippedAuraId;
  
  const bg = getBackground(activeBgId);
  const aura = getAura(activeAuraId);

  if (!pet) return null;

  const fakePet = { ...pet, mood: previewMood, isAsleep: false };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Scene container */}
      <div className="relative rounded-3xl overflow-hidden"
        style={{
          width: 280, height: 280,
          background: bg.gradient,
          boxShadow: `0 12px 40px ${bg.accentColor}33, inset 0 0 0 1px rgba(0,0,0,0.05)`,
        }}>
        {/* Background floor */}
        <div className="absolute bottom-0 left-0 right-0 h-14 rounded-b-3xl" style={{ background: bg.floorGradient }} />

        {/* Aura name badge */}
        {aura.id !== 'none' && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold"
            style={{ background: `${aura.color}33`, color: aura.color, border: `1px solid ${aura.color}55` }}>
            {aura.emoji} {aura.name}
          </div>
        )}

        {/* Pet */}
        <div className="absolute inset-0 flex items-center justify-center transition-all duration-300"
          style={{ filter: comparisonState ? 'grayscale(0.2) contrast(0.9)' : 'none' }}>
          <PetDisplay pet={fakePet} moodOverride={previewMood} overrideState={comparisonState} />
        </div>
      </div>

      {/* Mood strip */}
      <div className="flex gap-1.5">
        {MOODS.map(m => (
          <motion.button key={m.id}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setPreviewMood(m.id)}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-base transition-all"
            title={m.label}
            style={previewMood === m.id ? {
              background: 'rgba(129,140,248,0.3)',
              border: '1.5px solid #818CF8',
              boxShadow: '0 0 10px #818CF844',
            } : {
              background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)'
            }}>
            {m.emoji}
          </motion.button>
        ))}
      </div>

      {/* Summary chips */}
      <SummaryChips />
    </div>
  );
}

export function SummaryChips() {
  const { equippedSkinId, equippedBodyId, equippedAuraId, equippedBgId } = usePetStore();
  const skin = getSkin(equippedSkinId);
  const bg = getBackground(equippedBgId);
  const aura = getAura(equippedAuraId);
  const shape = BODY_SHAPES.find(s => s.id === equippedBodyId);

  const chips = [
    { label: `${shape?.emoji} ${shape?.name}` },
    { label: `${skin.emoji} ${skin.name}` },
    aura.id !== 'none' ? { label: `${aura.emoji} ${aura.name}` } : null,
    { label: `${bg.emoji} ${bg.name}` },
  ].filter(Boolean) as { label: string }[];

  return (
    <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
      {chips.map((c, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full text-[9px] font-semibold text-lumio-muted"
          style={{ background: 'white', border: '1px solid #E5E7EB', boxShadow: '0 2px 4px rgba(0,0,0,0.04)' }}>
          {c.label}
        </span>
      ))}
    </div>
  );
}