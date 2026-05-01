import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { BODY_SHAPES } from '../../../data/bodyShapes';
import { getSkin } from '../../../data/skins';
import { GLASS, ACTIVE_GLOW } from '../constants';
import { SectionLabel } from '../Shared';
import type { BodyShapeId } from '../../../data/bodyShapes';

export function BodyPanel() {
  const { equippedBodyId, equipBody, equippedSkinId } = usePetStore();
  const skin = getSkin(equippedSkinId);

  return (
    <div className="space-y-3">
      <SectionLabel>🧬 Форма тела</SectionLabel>
      <p className="text-xs text-lumio-muted">Бесплатно — меняй сколько угодно</p>
      <div className="grid grid-cols-3 gap-2">
        {BODY_SHAPES.map(shape => {
          const active = equippedBodyId === shape.id;
          return (
            <motion.button key={shape.id}
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => equipBody(shape.id as BodyShapeId)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all"
              style={active ? ACTIVE_GLOW(skin.colors.glow) : GLASS}
            >
              <span className="text-2xl">{shape.emoji}</span>
              <span className="text-[11px] font-semibold text-lumio-text">{shape.name}</span>
              {active && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: skin.colors.glow + 'aa' }}>✓</span>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
