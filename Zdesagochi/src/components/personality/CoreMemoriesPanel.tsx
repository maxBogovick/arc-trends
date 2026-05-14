import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import type { CoreMemory } from '../../personality/types';

const MAX_VISIBLE = 5;

export function CoreMemoriesPanel() {
  const { pet } = usePetStore();
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const memories: CoreMemory[] = pet?.coreMemories ?? [];
  if (memories.length === 0) return null;

  const sorted = [...memories].reverse();
  const rareCount = memories.filter(m => m.tier === 'rare').length;
  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);

  return (
    <div
      className="w-full rounded-3xl p-4 space-y-3"
      style={{
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.7)',
        boxShadow: '0 4px 16px rgba(124,58,237,0.08)',
      }}
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(e => !e)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">💭</span>
          <span className="text-sm font-bold text-lumio-text">Воспоминания</span>
          {rareCount > 0 && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white"
              style={{ background: 'linear-gradient(135deg,#8B5CF6,#EC4899)' }}
            >
              {rareCount} редких
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{collapsed ? '▼' : '▲'} {memories.length}</span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="memories-body"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            {/* Memory list */}
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {visible.map((mem, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-start gap-2 px-3 py-2 rounded-2xl"
                    style={{
                      background: mem.tier === 'rare'
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.10), rgba(236,72,153,0.08))'
                        : 'rgba(0,0,0,0.04)',
                      border: mem.tier === 'rare' ? '1px solid rgba(139,92,246,0.2)' : '1px solid transparent',
                    }}
                  >
                    <span className="text-base leading-none mt-0.5 flex-shrink-0">{mem.emoji}</span>
                    <span className="text-xs text-gray-700 leading-relaxed">{mem.text}</span>
                    {mem.tier === 'rare' && (
                      <span className="ml-auto text-[9px] font-bold text-purple-400 flex-shrink-0">★ редкое</span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {memories.length > MAX_VISIBLE && (
              <button
                onClick={() => setExpanded(e => !e)}
                className="w-full text-xs text-purple-500 font-semibold py-1 hover:text-purple-700 transition-colors"
              >
                {expanded ? 'Скрыть' : `Показать все ${memories.length}`}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
