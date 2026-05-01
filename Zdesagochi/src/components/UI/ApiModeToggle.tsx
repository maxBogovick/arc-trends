import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { usePetStore } from '../../store/petStore';

export function ApiModeToggle({ compact = false }: { compact?: boolean }) {
  const { apiMode, apiBaseUrl, setApiMode, setApiBaseUrl } = usePetStore();
  const [expanded, setExpanded] = useState(false);
  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const isMock = apiMode === 'mock';

  const handleUrlSave = () => {
    setApiBaseUrl(urlInput.trim() || 'http://localhost:3000');
    setExpanded(false);
  };

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{
            background: isMock ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
            color: isMock ? '#B45309' : '#065F46',
            border: isMock ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(16,185,129,0.25)',
          }}
        >
          <motion.span className="w-2 h-2 rounded-full shrink-0" style={{ background: isMock ? '#F59E0B' : '#10B981' }}
            animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
          {isMock ? 'Mock-режим' : 'Live-сервер'}
          <span className="ml-auto opacity-50">{expanded ? '▲' : '▼'}</span>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-full mb-2 left-0 right-0 rounded-2xl p-4 z-50 shadow-glass-lg"
              style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)' }}
            >
              <ToggleContent isMock={isMock} onToggle={() => setApiMode(isMock ? 'real' : 'mock')}
                urlInput={urlInput} setUrlInput={setUrlInput} onSave={handleUrlSave} baseUrl={apiBaseUrl} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-end gap-1.5">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{
          background: isMock ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
          color: isMock ? '#B45309' : '#065F46',
          border: isMock ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(16,185,129,0.25)',
        }}
      >
        <motion.span className="w-2 h-2 rounded-full shrink-0" style={{ background: isMock ? '#F59E0B' : '#10B981' }}
          animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        {isMock ? '🟡 Mock' : '🟢 Live'}
        <span className="opacity-50">{expanded ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            className="absolute top-full mt-2 w-72 rounded-2xl p-4 z-50 shadow-glass-lg"
            style={{ background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', right: 0 }}
          >
            <ToggleContent isMock={isMock} onToggle={() => setApiMode(isMock ? 'real' : 'mock')}
              urlInput={urlInput} setUrlInput={setUrlInput} onSave={handleUrlSave} baseUrl={apiBaseUrl} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ToggleContent({ isMock, onToggle, urlInput, setUrlInput, onSave, baseUrl }: {
  isMock: boolean; onToggle: () => void;
  urlInput: string; setUrlInput: (v: string) => void;
  onSave: () => void; baseUrl: string;
}) {
  return (
    <>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">
        <strong className="text-lumio-text">Mock-режим</strong> — данные в памяти браузера.<br />
        <strong className="text-lumio-text">Live-сервер</strong> — реальные HTTP-запросы к серверу.
      </p>

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-lumio-text">{isMock ? '🟡 Mock' : '🟢 Live'}</span>
        <button onClick={onToggle}
          className="relative w-12 h-6 rounded-full transition-all duration-300"
          style={{ background: isMock ? '#E5E7EB' : '#10B981' }}>
          <motion.div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow"
            animate={{ left: isMock ? '4px' : '28px' }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
        </button>
      </div>

      {!isMock && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <label className="text-xs font-bold text-lumio-text block">URL сервера</label>
          <div className="flex gap-2">
            <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSave()}
              placeholder="http://localhost:3000"
              className="flex-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-mono outline-none focus:ring-2 focus:ring-emerald-400" />
            <button onClick={onSave}
              className="px-3 py-1.5 bg-emerald-500 text-white rounded-xl text-xs font-bold hover:bg-emerald-600 transition-colors">OK</button>
          </div>
          <p className="text-[10px] text-gray-400">Текущий: {baseUrl}</p>
        </motion.div>
      )}

      {isMock && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">💡 Реализуй 24 API-эндпоинта и переключись в Live-режим!</p>
        </div>
      )}
    </>
  );
}
