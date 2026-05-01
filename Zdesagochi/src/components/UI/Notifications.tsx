import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  success: { bg: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)', border: '#6EE7B7', icon: '✅', text: '#065F46' },
  error:   { bg: 'linear-gradient(135deg,#FEE2E2,#FECACA)', border: '#FCA5A5', icon: '❌', text: '#991B1B' },
  info:    { bg: 'linear-gradient(135deg,#DBEAFE,#BFDBFE)', border: '#93C5FD', icon: 'ℹ️', text: '#1E40AF' },
  xp:      { bg: 'linear-gradient(135deg,#EDE9FE,#DDD6FE)', border: '#A78BFA', icon: '⚡', text: '#4C1D95' },
  coins:   { bg: 'linear-gradient(135deg,#FEF3C7,#FDE68A)', border: '#FCD34D', icon: '🪙', text: '#92400E' },
};

export function Notifications() {
  const { notifications, dismissNotification } = usePetStore();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence>
        {notifications.map(n => {
          const s = TYPE_STYLES[n.type];
          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              onClick={() => dismissNotification(n.id)}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-2xl cursor-pointer max-w-xs"
              style={{
                background: s.bg,
                border: `1px solid ${s.border}`,
                boxShadow: `0 4px 16px ${s.border}44`,
              }}
            >
              <span className="text-base shrink-0">{s.icon}</span>
              <p className="text-xs font-semibold" style={{ color: s.text }}>{n.message}</p>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
