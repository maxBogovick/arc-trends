import { motion, AnimatePresence } from 'framer-motion';
import { usePetStore } from '../../store/petStore';
import type { PetArchetype } from './petArchetype';
import type { BehaviorMode } from './usePetBehaviorState';

interface Props {
  activeAction: string | null;
  mode: BehaviorMode;
  archetype: PetArchetype;
  petX: number; // 0-100 left%
  facingRight: boolean;
  containerWidth?: number;
}

// z-index above pet (pet is 25)
const Z = 30;
// z-index below furniture (furniture starts at placed.zIndex ≥ 10) and below pet
const Z_UNDER = 5;

// ─── Animal: bowl on the floor ────────────────────────────────────────────────

function FoodBowl({ petX, facingRight, emoji }: { petX: number; facingRight: boolean; emoji: string }) {
  const offsetPct = facingRight ? 11 : -11;
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${petX + offsetPct}%`,
        bottom: '13%',
        transform: 'translateX(-50%)',
        zIndex: Z,
        fontSize: 34,
        lineHeight: 1,
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      }}
      initial={{ opacity: 0, scale: 0.3, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.3, y: 16 }}
      transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {emoji}
    </motion.div>
  );
}

// ─── Humanoid: table with food ────────────────────────────────────────────────

function FoodTable({ petX, facingRight, emoji }: { petX: number; facingRight: boolean; emoji: string }) {
  const offsetPct = facingRight ? 12 : -12;

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${petX + offsetPct}%`,
        bottom: '13%',
        transform: 'translateX(-50%)',
        zIndex: Z,
      }}
      initial={{ opacity: 0, scale: 0.4, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.3, y: 20 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Food on top */}
      <div style={{ textAlign: 'center', fontSize: 24, lineHeight: 1, marginBottom: 2 }}>
        {emoji}
      </div>
      {/* Table surface */}
      <div style={{
        width: 52, height: 9, borderRadius: 4,
        background: 'linear-gradient(180deg, #C0874A 0%, #7B4B1F 100%)',
        boxShadow: '0 3px 8px rgba(0,0,0,0.55)',
      }} />
      {/* Legs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', paddingInline: 6 }}>
        <div style={{ width: 5, height: 18, background: '#7B4B1F', borderRadius: '0 0 3px 3px' }} />
        <div style={{ width: 5, height: 18, background: '#7B4B1F', borderRadius: '0 0 3px 3px' }} />
      </div>
    </motion.div>
  );
}

// ─── Creature: glowing food orb floats beside pet ─────────────────────────────

function CreatureFood({ petX, facingRight, emoji }: { petX: number; facingRight: boolean; emoji: string }) {
  const offsetPct = facingRight ? 11 : -11;
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${petX + offsetPct}%`,
        bottom: '22%',
        transform: 'translateX(-50%)',
        zIndex: Z,
        fontSize: 32,
        lineHeight: 1,
        filter: 'drop-shadow(0 0 12px rgba(255,100,50,0.9))',
      }}
      initial={{ opacity: 0, scale: 0.3, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.2, x: facingRight ? -30 : 30, y: 10 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {emoji}
    </motion.div>
  );
}

// ─── Playing: bouncing ball ───────────────────────────────────────────────────

function PlayBall({ petX }: { petX: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${petX + 14}%`,
        bottom: '13%',
        transform: 'translateX(-50%)',
        zIndex: Z,
        fontSize: 28,
        lineHeight: 1,
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))',
      }}
      animate={{
        y:     [0, -80, 0, -50, 0, -25, 0],
        x:     [0, 12, 24, 8, 20, 4, 16],
        scaleY:[1, 0.9, 1.15, 0.92, 1.1, 0.95, 1],
      }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      🏀
    </motion.div>
  );
}

// ─── Cleaning: soap bubbles ───────────────────────────────────────────────────

function SoapBubbles({ petX }: { petX: number }) {
  return (
    <>
      {[0, 1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left:   `${petX + (i - 1.5) * 5}%`,
            bottom: '20%',
            transform: 'translateX(-50%)',
            zIndex: Z,
            fontSize: 14 + i * 3,
            lineHeight: 1,
          }}
          animate={{ y: [0, -60, -110], opacity: [0, 0.95, 0], x: [0, (i % 2 === 0 ? 8 : -8), 0] }}
          transition={{ duration: 1.8, delay: i * 0.3, repeat: Infinity, repeatDelay: 0.15 }}
        >
          🫧
        </motion.div>
      ))}
    </>
  );
}

// ─── Medicine pill ────────────────────────────────────────────────────────────

function MedicinePill({ petX, facingRight }: { petX: number; facingRight: boolean }) {
  const offsetPct = facingRight ? 12 : -12;
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left:   `${petX + offsetPct}%`,
        bottom: '40%',
        transform: 'translateX(-50%)',
        zIndex: Z,
        fontSize: 28,
        lineHeight: 1,
      }}
      initial={{ opacity: 0, y: -30, rotate: -30 }}
      animate={{ opacity: [0, 1, 1, 1, 0], y: [-30, 0, 0, 0, 15], rotate: [-30, 0, 0, 0, 10] }}
      transition={{ duration: 3.5, times: [0, 0.15, 0.5, 0.8, 1] }}
    >
      💊
    </motion.div>
  );
}

// ─── Sleeping: bed under the pet ─────────────────────────────────────────────

function SleepingBed({ petX }: { petX: number }) {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${petX}%`,
        bottom: '11%',
        transform: 'translateX(-50%)',
        zIndex: Z_UNDER,
        fontSize: 86,
        lineHeight: 1,
        filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.65))',
      }}
      initial={{ opacity: 0, scale: 0.5, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.5, y: 30 }}
      transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], delay: 1.6 }}
    >
      🛏️
    </motion.div>
  );
}

// ─── ZZZ bubbles ─────────────────────────────────────────────────────────────
// After rotate(90° CW), the pet head is to the LEFT when facing right, RIGHT when facing left.
// Head is ~30px from center in the direction opposite to facing.
// ZZZ should drift upward from near the head position.

function SleepZzz({ petX, facingRight }: { petX: number; facingRight: boolean }) {
  // Head side: opposite of facing direction
  // When facing right → head is to the LEFT → negative offset (toward lower %)
  // When facing left  → head is to the RIGHT → positive offset (toward higher %)
  const headSign = facingRight ? -1 : 1;
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            left: `${petX + headSign * (4 + i * 2)}%`,
            bottom: `${34 + i * 5}%`,
            transform: 'translateX(-50%)',
            zIndex: Z,
            fontSize: 10 + i * 5,
            fontWeight: 900,
            color: 'rgba(180,160,255,0.95)',
            fontFamily: 'sans-serif',
            textShadow: '0 0 8px rgba(160,120,255,0.8)',
          }}
          animate={{
            opacity: [0, 1, 0.8, 0],
            y:       [0, -18, -30, -44],
            x:       [0, headSign * (4 + i * 2), headSign * (7 + i * 3), headSign * (10 + i * 4)],
          }}
          transition={{ duration: 2.8, delay: i * 0.9, repeat: Infinity, repeatDelay: 0.4 }}
        >
          Z
        </motion.div>
      ))}
    </>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function SceneProps({ activeAction, mode, archetype, petX, facingRight }: Props) {
  const { foods } = usePetStore();

  // Resolve the food emoji from the actionLoading key (e.g. 'feed_apple' → 🍎)
  const foodEmoji = (() => {
    if (!activeAction) return '🍽️';
    if (activeAction.startsWith('feed_')) {
      const id = activeAction.slice(5);
      return foods.find(f => f.id === id)?.emoji ?? '🍽️';
    }
    if (activeAction.startsWith('use_')) {
      const id = activeAction.slice(4);
      return foods.find(f => f.id === id)?.emoji ?? '🍽️';
    }
    return '🍽️';
  })();

  const isEating = mode === 'eating'
    || activeAction?.startsWith('feed_')
    || activeAction?.startsWith('use_');
  const isPlaying  = mode === 'playing'  || activeAction === 'playing';
  const isCleaning = mode === 'cleaning' || activeAction === 'cleaning';
  const isMedicine = mode === 'medicine' || activeAction === 'medicine';
  const isSleeping = mode === 'sleeping';

  return (
    <AnimatePresence>
      {isEating && archetype === 'animal'   && <FoodBowl    key="bowl"    petX={petX} facingRight={facingRight} emoji={foodEmoji} />}
      {isEating && archetype === 'humanoid' && <FoodTable   key="table"   petX={petX} facingRight={facingRight} emoji={foodEmoji} />}
      {isEating && archetype === 'creature' && <CreatureFood key="food"   petX={petX} facingRight={facingRight} emoji={foodEmoji} />}
      {isPlaying  && <PlayBall    key="ball"    petX={petX} />}
      {isCleaning && <SoapBubbles key="bubbles" petX={petX} />}
      {isMedicine && <MedicinePill key="pill"   petX={petX} facingRight={facingRight} />}
      {isSleeping && <SleepingBed key="bed"     petX={petX} />}
      {isSleeping && <SleepZzz    key="zzz"     petX={petX} facingRight={facingRight} />}
    </AnimatePresence>
  );
}
