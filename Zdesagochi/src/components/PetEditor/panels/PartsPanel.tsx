import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { getSkin } from '../../../data/skins';
import {
  HEADS, EARS_OPTIONS, BODY_PARTS, LIMBS_OPTIONS, TAILS_OPTIONS,
  type HeadId, type EarsId, type BodyPartId, type LimbsId, type TailId,
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
    equippedLimbsId,
    equippedTailId,
    equipHead,
    equipEars,
    equipBodyPart,
    equipLimbs,
    equipTail,
  } = usePetStore();

  const glow = getSkin(equippedSkinId).colors.glow;

  return (
    <div className="space-y-5">
      <p className="text-xs text-lumio-muted">Собери питомца из частей — всё бесплатно</p>

      <PartSection<HeadId>
        label="🐺 Голова"
        options={HEADS}
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

      <PartSection<LimbsId>
        label="🦾 Лапы"
        options={LIMBS_OPTIONS}
        active={equippedLimbsId}
        glow={glow}
        onSelect={equipLimbs}
      />

      <PartSection<TailId>
        label="🦊 Хвост"
        options={TAILS_OPTIONS}
        active={equippedTailId}
        glow={glow}
        onSelect={equipTail}
      />
    </div>
  );
}
