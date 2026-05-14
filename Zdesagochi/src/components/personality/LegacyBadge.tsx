import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

export function LegacyBadge() {
  const { account } = usePetStore();
  const [open, setOpen] = useState(false);

  const gen = account?.legacyGeneration ?? 0;
  if (gen <= 0) return null;

  const coeff = Math.round((account?.legacyCoefficient ?? 0.15) * 100);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all"
        style={{
          background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(249,115,22,0.15))',
          border: '1px solid rgba(251,191,36,0.4)',
          color: '#92400E',
        }}
      >
        <span>👑</span>
        <span>Поколение {gen}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="legacy-popup"
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute left-0 top-8 z-50 rounded-2xl p-3 space-y-2 min-w-[200px]"
            style={{
              background: 'rgba(255,255,255,0.97)',
              border: '1px solid rgba(251,191,36,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="text-xs font-bold text-amber-700">Наследие · {coeff}% отпечаток</div>
            {account?.memoryGuardian && (
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-base">💫</span>
                <span>{account.memoryGuardian.name}</span>
              </div>
            )}
            {account?.memoryGuardian?.archivedMemories && account.memoryGuardian.archivedMemories.length > 0 && (
              <div className="space-y-1">
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">Архив воспоминаний</div>
                {account.memoryGuardian.archivedMemories.slice(0, 3).map((m, i) => (
                  <div key={i} className="text-xs text-gray-600 flex items-center gap-1">
                    <span>{m.emoji}</span>
                    <span className="truncate">{m.text}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => setOpen(false)}
              className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Закрыть
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
