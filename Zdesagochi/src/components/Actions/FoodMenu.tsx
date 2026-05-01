import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

interface Props {
  onClose: () => void;
}

export function FoodMenu({ onClose }: Props) {
  const { foods, feedPet, actionLoading } = usePetStore();

  const handleFeed = async (foodId: string) => {
    await feedPet(foodId);
    onClose();
  };

  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-end justify-center p-3"
      style={{ background: 'rgba(30,17,71,0.35)', backdropFilter: 'blur(4px)', borderRadius: '1.5rem' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full rounded-2xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.95)', boxShadow: '0 -8px 32px rgba(124,58,237,0.15)' }}
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        exit={{ y: 80 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-lumio-text text-sm">Чем накормить?</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-lg leading-none">✕</button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {foods.map(food => (
              <motion.button
                key={food.id}
                whileTap={{ scale: 0.92 }}
                whileHover={{ scale: 1.05, y: -2 }}
                disabled={!!actionLoading}
                onClick={() => handleFeed(food.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-indigo-50 transition-colors disabled:opacity-50"
              >
                <span className="text-2xl">{food.emoji}</span>
                <span className="text-xs font-semibold text-lumio-text leading-tight text-center">{food.name}</span>
                <div className="flex gap-0.5">
                  {food.hungerRestore > 0 && (
                    <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1 rounded-full">+{food.hungerRestore}🍔</span>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function FoodMenuWrapper({ show, onClose }: { show: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {show && <FoodMenu onClose={onClose} />}
    </AnimatePresence>
  );
}
