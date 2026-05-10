import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getSkin } from '../../../data/skins';
import {
  HEAD_OPTIONS, EARS_OPTIONS, BODY_PARTS, ARMS_OPTIONS, LEGS_OPTIONS, TAILS_OPTIONS, NOSE_OPTIONS, MOUTH_STYLES, OUTFIT_OPTIONS,
  type HeadId, type EarsId, type BodyPartId, type ArmsId, type LegsId, type TailId, type NoseId, type MouthStyleId, type OutfitId,
} from '../../../data/petParts';
import { GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';

interface SectionProps<T extends string> {
  label: string;
  options: { id: string; name: string; emoji: string }[];
  active: T;
  glow: string;
  onSelect: (id: T) => void;
}

function PartSection<T extends string>({ label, options, active, glow, onSelect }: SectionProps<T>) {
  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {options.map(opt => {
          const isActive = active === opt.id;
          return (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onSelect(opt.id as T)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={isActive ? ACTIVE_GLOW(glow) : GLASS}
            >
              <span className="text-2xl">{opt.emoji}</span>
              <span className="text-[11px] font-semibold text-lumio-text leading-tight text-center">{opt.name}</span>
              {isActive && (
                <span
                  className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ background: glow + 'aa' }}
                >
                  ✓
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export function PartsPanel() {
  const {
    equippedSkinId,
    equippedHeadId,
    equippedEarsId,
    equippedBodyPartId,
    equippedArmsId,
    equippedLegsId,
    equippedTailId,
    equippedNoseId,
    equippedMouthStyleId,
    equippedOutfitId,
    outfitColor,
    outfitColor2,
    equipHead,
    equipEars,
    equipBodyPart,
    equipArms,
    equipLegs,
    equipTail,
    equipNose,
    equipMouthStyle,
    equipOutfit,
    setOutfitColor,
    setOutfitColor2,
  } = usePetStore();

  const glow = getSkin(equippedSkinId).colors.glow;

  return (
    <div className="space-y-5">
      <p className="text-xs text-lumio-muted">Собери питомца из частей — всё бесплатно</p>

      <PartSection<HeadId>
        label="🐺 Голова"
        options={HEAD_OPTIONS}
        active={equippedHeadId}
        glow={glow}
        onSelect={equipHead}
      />

      <PartSection<EarsId>
        label="👂 Уши"
        options={EARS_OPTIONS}
        active={equippedEarsId}
        glow={glow}
        onSelect={equipEars}
      />

      <PartSection<BodyPartId>
        label="🫀 Тело"
        options={BODY_PARTS}
        active={equippedBodyPartId}
        glow={glow}
        onSelect={equipBodyPart}
      />

      <PartSection<ArmsId>
        label="🦾 Руки / Верх. конечности"
        options={ARMS_OPTIONS}
        active={equippedArmsId}
        glow={glow}
        onSelect={equipArms}
      />

      <PartSection<LegsId>
        label="🦵 Ноги / Ниж. конечности"
        options={LEGS_OPTIONS}
        active={equippedLegsId}
        glow={glow}
        onSelect={equipLegs}
      />

      <PartSection<TailId>
        label="🦊 Хвост"
        options={TAILS_OPTIONS}
        active={equippedTailId}
        glow={glow}
        onSelect={equipTail}
      />

      <PartSection<NoseId>
        label="👃 Нос"
        options={NOSE_OPTIONS}
        active={equippedNoseId}
        glow={glow}
        onSelect={equipNose}
      />

      <PartSection<MouthStyleId>
        label="👄 Рот / Выражение"
        options={MOUTH_STYLES}
        active={equippedMouthStyleId}
        glow={glow}
        onSelect={equipMouthStyle}
      />

      <PartSection<OutfitId>
        label="👕 Одежда"
        options={OUTFIT_OPTIONS}
        active={equippedOutfitId}
        glow={glow}
        onSelect={equipOutfit}
      />

      {equippedOutfitId !== 'none' && (
        <div className="p-3 rounded-2xl space-y-3" style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 16 }}>
          <p className="text-xs font-semibold text-lumio-muted">🎨 Цвет одежды</p>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <label className="relative cursor-pointer group">
                <div className="w-10 h-10 rounded-xl border-2 border-slate-200 shadow-sm transition-transform group-hover:scale-110"
                  style={{ background: outfitColor, boxShadow: `0 0 10px ${outfitColor}66` }} />
                <input type="color" value={outfitColor} onChange={e => setOutfitColor(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
              <div>
                <p className="text-xs font-bold text-lumio-text">Основной</p>
                <p className="text-[9px] font-mono text-lumio-muted">{outfitColor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="relative cursor-pointer group">
                <div className="w-10 h-10 rounded-xl border-2 border-slate-200 shadow-sm transition-transform group-hover:scale-110"
                  style={{ background: outfitColor2, boxShadow: `0 0 10px ${outfitColor2}66` }} />
                <input type="color" value={outfitColor2} onChange={e => setOutfitColor2(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </label>
              <div>
                <p className="text-xs font-bold text-lumio-text">Детали</p>
                <p className="text-[9px] font-mono text-lumio-muted">{outfitColor2}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
