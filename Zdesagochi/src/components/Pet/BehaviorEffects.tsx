import { motion, AnimatePresence } from 'framer-motion';
import type { BehaviorMode, SceneInteraction } from './usePetBehaviorState';
import type { Pet } from '../../api';

interface Props {
  pet: Pet;
  mode: BehaviorMode;
  sceneInteraction: SceneInteraction | null;
  facingRight?: boolean;
}

// Tear drops for sad mood
function Tears() {
  return (
    <>
      {[-14, 14].map((offsetX, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: '28%', left: `calc(50% + ${offsetX}px)`, zIndex: 5, fontSize: 11 }}
          animate={{ y: [0, 32, 40], opacity: [0, 0.9, 0] }}
          transition={{ duration: 1.6, delay: i * 0.7, repeat: Infinity, repeatDelay: 1.2 }}
        >
          💧
        </motion.div>
      ))}
    </>
  );
}

// Sick bubble
function SickBubble() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: '-18px', right: '-10px', zIndex: 5, fontSize: 20 }}
      animate={{ y: [0, -4, 0], scale: [1, 1.05, 1] }}
      transition={{ duration: 2.5, repeat: Infinity }}
    >
      🤢
    </motion.div>
  );
}

// Thought bubble (TV watching, computer)
function ThoughtBubble() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: '-22px', right: '-16px', zIndex: 5 }}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7 }}
      transition={{ duration: 0.3 }}
    >
      <div style={{
        background: 'rgba(255,255,255,0.92)',
        border: '1.5px solid rgba(0,0,0,0.12)',
        borderRadius: 12,
        padding: '3px 8px',
        fontSize: 11,
        fontWeight: 700,
        color: '#444',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        💭 ...
      </div>
    </motion.div>
  );
}

// Dance music notes
function MusicNotes() {
  return (
    <>
      {['🎵', '🎶', '🎵'].map((note, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: `${-10 - i * 12}px`, left: `${40 + i * 20}px`, zIndex: 5, fontSize: 14 }}
          animate={{ y: [0, -18, -32], opacity: [0, 1, 0], x: [0, i % 2 === 0 ? 6 : -6, 0] }}
          transition={{ duration: 1.4, delay: i * 0.4, repeat: Infinity, repeatDelay: 0.2 }}
        >
          {note}
        </motion.div>
      ))}
    </>
  );
}

// Interaction-specific cactus reaction (ouch!)
function OuchBubble() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: '-22px', right: '-20px', zIndex: 5 }}
      initial={{ opacity: 0, scale: 0, rotate: -15 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.2, 1, 0.8], rotate: [-15, 5, 0, 0] }}
      transition={{ duration: 2, times: [0, 0.2, 0.6, 1], delay: 2 }}
    >
      <div style={{
        background: '#FF4444',
        color: 'white',
        borderRadius: 10,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 800,
      }}>
        Ой! 🌵
      </div>
    </motion.div>
  );
}

// Heart particles for trophy hug
function HeartParticles() {
  return (
    <>
      {['❤️', '💕', '❤️'].map((h, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: `${-5 - i * 10}px`, left: `${30 + i * 18}px`, zIndex: 5, fontSize: 13 }}
          animate={{ y: [0, -22], opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
          transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity, repeatDelay: 0.6 }}
        >
          {h}
        </motion.div>
      ))}
    </>
  );
}

// Stars when bouncing on bed
function BounceStars() {
  return (
    <>
      {['⭐', '✨', '⭐', '💫'].map((s, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: `${-8 - i * 8}px`, left: `${20 + i * 22}px`, zIndex: 5, fontSize: 12 + i * 2 }}
          animate={{ y: [0, -28, -40], opacity: [0, 1, 0], scale: [0.4, 1.3, 0.6], rotate: [0, 20, 40] }}
          transition={{ duration: 0.7, delay: i * 0.18, repeat: Infinity, repeatDelay: 0.3 }}
        >
          {s}
        </motion.div>
      ))}
    </>
  );
}

// Flower scent when smelling plants
function PlantScent() {
  return (
    <>
      {['🌸', '🍃', '🌸'].map((p, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: `${-6 - i * 9}px`, left: `${24 + i * 16}px`, zIndex: 5, fontSize: 11 + i * 2 }}
          animate={{ y: [0, -20, -35], opacity: [0, 0.9, 0], x: [0, i % 2 === 0 ? 8 : -8, 0], rotate: [0, 15, 30] }}
          transition={{ duration: 1.8, delay: i * 0.4, repeat: Infinity, repeatDelay: 0.5 }}
        >
          {p}
        </motion.div>
      ))}
    </>
  );
}

// Sparkle aura for staring at magical objects
function MagicGaze() {
  return (
    <>
      {['✨', '💫', '✨'].map((s, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{ top: `${-4 - i * 11}px`, right: `${-4 + i * 6}px`, zIndex: 5, fontSize: 10 + i * 3 }}
          animate={{ opacity: [0, 0.85, 0], scale: [0.5, 1.2, 0.5], y: [0, -8, -16] }}
          transition={{ duration: 2, delay: i * 0.5, repeat: Infinity, repeatDelay: 0.8 }}
        >
          {s}
        </motion.div>
      ))}
    </>
  );
}

// Surprise reaction when grabbed
function GrabReaction() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: '-26px', left: '50%', transform: 'translateX(-50%)', zIndex: 8, fontSize: 20 }}
      initial={{ opacity: 0, scale: 0.3, y: 6 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [0.3, 1.3, 1, 0.8], y: [6, -4, -4, -8] }}
      transition={{ duration: 0.6, times: [0, 0.25, 0.7, 1] }}
    >
      😮
    </motion.div>
  );
}

// Dust cloud on landing
function LandingDust() {
  return (
    <>
      {[-22, 0, 22].map((offsetX, i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            bottom: 8,
            left: `calc(50% + ${offsetX}px)`,
            width: 10 + i * 3,
            height: 10 + i * 3,
            borderRadius: '50%',
            background: 'rgba(160,140,110,0.55)',
            zIndex: 2,
          }}
          initial={{ opacity: 0, scale: 0.2 }}
          animate={{ opacity: [0, 0.7, 0], scale: [0.2, 1.4, 0.5], y: [0, -(14 + i * 6), -(22 + i * 8)], x: [0, offsetX * 0.5, offsetX * 0.9] }}
          transition={{ duration: 0.65, delay: i * 0.06, ease: 'easeOut' }}
        />
      ))}
    </>
  );
}

// Footstep dust puffs when patrolling
function PatrolDust({ facingRight }: { facingRight: boolean }) {
  const dir = facingRight ? 1 : -1;
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="absolute pointer-events-none"
          style={{
            bottom: 10,
            left: `calc(50% + ${dir * -(14 + i * 12)}px)`,
            width: 7 + i * 2,
            height: 7 + i * 2,
            borderRadius: '50%',
            background: 'rgba(180,160,130,0.55)',
            zIndex: 2,
          }}
          animate={{ y: [0, -10, -18], opacity: [0, 0.65, 0], scale: [0.3, 1, 0.5] }}
          transition={{ duration: 0.9, delay: i * 0.18, repeat: Infinity, repeatDelay: 0.5 }}
        />
      ))}
    </>
  );
}

// Ecstatic rainbow trail
function EcstaticTrail() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', zIndex: 5, fontSize: 16 }}
      animate={{ opacity: [0.7, 0.2, 0.7] }}
      transition={{ duration: 1.2, repeat: Infinity }}
    >
      🌈
    </motion.div>
  );
}

// Tired head-drooping indicator (zzz already in PetDisplay, just add emphasis)
function TiredIndicator() {
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{ top: '-16px', right: '-4px', zIndex: 5, fontSize: 12 }}
      animate={{ opacity: [0, 1, 1, 0], y: [0, -5, -10, -16] }}
      transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.5 }}
    >
      😴
    </motion.div>
  );
}

export function BehaviorEffects({ pet, mode, sceneInteraction, facingRight = true }: Props) {
  const isSad        = pet.mood === 'sad';
  const isSick       = pet.mood === 'sick';
  const isTired      = pet.mood === 'tired' && !pet.isAsleep;
  const isEcstatic   = pet.mood === 'ecstatic';
  const isPatrolling = mode === 'patrol';
  const isGrabbed    = mode === 'being_grabbed';
  const isLanding    = mode === 'landing';

  const isWatching  = sceneInteraction?.type === 'watch_screen' || sceneInteraction?.type === 'play_console';
  const isDancing   = sceneInteraction?.type === 'dance_music';
  const isPushing   = sceneInteraction?.type === 'push_cactus';
  const isHugging   = sceneInteraction?.type === 'hug_trophy';
  const isBouncing  = sceneInteraction?.type === 'bounce_bed';
  const isSmelling  = sceneInteraction?.type === 'smell_plant';
  const isStaring   = sceneInteraction?.type === 'stare_special' || sceneInteraction?.type === 'stare_flame';

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <AnimatePresence>
        {isSad        && <Tears key="tears" />}
        {isSick       && <SickBubble key="sick" />}
        {isTired      && <TiredIndicator key="tired" />}
        {isEcstatic   && <EcstaticTrail key="ecstatic" />}
        {isGrabbed   && <GrabReaction key="grab" />}
        {isLanding   && <LandingDust key="land" />}
        {isPatrolling && <PatrolDust key="dust" facingRight={facingRight} />}
        {isWatching   && <ThoughtBubble key="thought" />}
        {isDancing    && <MusicNotes key="notes" />}
        {isPushing    && <OuchBubble key="ouch" />}
        {isHugging    && <HeartParticles key="hearts" />}
        {isBouncing   && <BounceStars key="stars" />}
        {isSmelling   && <PlantScent key="scent" />}
        {isStaring    && <MagicGaze key="magic" />}
      </AnimatePresence>
    </div>
  );
}
