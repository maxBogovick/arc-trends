import { useState } from 'react';
import { motion } from 'framer-motion';
import { usePetStore } from '../../../store/petStore';
import { GLASS } from '../constants';
import { SectionLabel } from '../Shared';

export function PresetsPanel() {
  const { petPresets, savePreset, loadPreset, deletePreset } = usePetStore();
  const [newPresetName, setNewPresetName] = useState('');

  const handleSave = () => {
    if (newPresetName.trim()) {
      savePreset(newPresetName.trim());
      setNewPresetName('');
    }
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
      <SectionLabel>👗 Гардероб (Пресеты)</SectionLabel>
      
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
