import { useState, useEffect, useRef } from 'react';
import type { Pet } from '../../api';
import type { PlacedFurnitureItem } from '../../store/petStore';
import { getFurniture } from '../../data/roomFurniture';

// ─── Types ────────────────────────────────────────────────────────────────────

export type BehaviorMode =
  | 'idle'
  | 'patrol'
  | 'sleeping'
  | 'eating'
  | 'playing'
  | 'cleaning'
  | 'medicine'
  | 'scene_interact'
  | 'being_grabbed'
  | 'carried'
  | 'landing';

export type FurnitureInteractionType =
  | 'push_cactus'
  | 'sit_furniture'
  | 'watch_screen'
  | 'play_console'
  | 'stare_special'
  | 'bounce_bed'
  | 'dance_music'
  | 'hug_trophy'
  | 'stare_flame'
  | 'smell_plant';

export interface SceneInteraction {
  furnitureUid: string;
  furnitureId: string;
  type: FurnitureInteractionType;
}

export interface BehaviorState {
  mode: BehaviorMode;
  /** 0–100 — % from left edge of the scene container */
  petX: number;
  facingRight: boolean;
  sceneInteraction: SceneInteraction | null;
  /** Non-null while an action animation is playing */
  activeAction: string | null;
}

// ─── Interaction tables ───────────────────────────────────────────────────────

type MoodKey = Pet['mood'] | 'any';
type ItemInteractions = Partial<Record<MoodKey, FurnitureInteractionType>>;

const ITEM_INTERACTIONS: Record<string, ItemInteractions> = {
  cactus:   { sad: 'push_cactus', sick: 'push_cactus', happy: 'smell_plant', ecstatic: 'smell_plant', content: 'smell_plant' },
  pot:      { content: 'smell_plant', happy: 'smell_plant', sad: 'smell_plant' },
  palm:     { ecstatic: 'smell_plant', happy: 'smell_plant' },
  mushroom: { content: 'smell_plant', happy: 'smell_plant', any: 'smell_plant' },
  sakura:   { happy: 'smell_plant', sad: 'smell_plant', ecstatic: 'smell_plant', content: 'smell_plant' },
  sofa:     { tired: 'sit_furniture', sad: 'sit_furniture', content: 'sit_furniture' },
  armchair: { tired: 'sit_furniture', sad: 'sit_furniture', content: 'sit_furniture' },
  bed:      { happy: 'bounce_bed', ecstatic: 'bounce_bed' },
  tv:       { sad: 'watch_screen', content: 'watch_screen', tired: 'watch_screen' },
  console:  { happy: 'play_console', ecstatic: 'play_console', content: 'play_console' },
  computer: { content: 'watch_screen', sad: 'watch_screen' },
  hifi:     { happy: 'dance_music', ecstatic: 'dance_music' },
  trophy:   { ecstatic: 'hug_trophy', sad: 'hug_trophy', happy: 'hug_trophy' },
  orb:      { content: 'stare_special', happy: 'stare_special', ecstatic: 'stare_special', sad: 'stare_special' },
  crystal:  { content: 'stare_special', happy: 'stare_special', ecstatic: 'stare_special' },
  moon:     { tired: 'stare_special', sad: 'stare_special' },
  star:     { ecstatic: 'stare_special', happy: 'stare_special' },
  candle:   { content: 'stare_flame', sad: 'stare_flame', any: 'stare_flame' },
  oillamp:  { content: 'stare_flame', sad: 'stare_flame', any: 'stare_flame' },
};

/** Duration (ms) of each interaction type */
const INTERACTION_DURATION: Record<FurnitureInteractionType, number> = {
  push_cactus:   6500,
  sit_furniture: 7500,
  watch_screen:  8000,
  play_console:  7000,
  stare_special: 5500,
  bounce_bed:    5000,
  dance_music:   6500,
  hug_trophy:    4500,
  stare_flame:   5000,
  smell_plant:   4000,
};

/** How long action animation plays AFTER actionLoading clears (ms) */
const ACTION_GRACE: Partial<Record<BehaviorMode, number>> = {
  eating:   3500,
  playing:  5000,
  cleaning: 4000,
  medicine: 4000,
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PATROL_X = [14, 50, 86] as const;  // left / center / right (%)
const IDLE_TO_PATROL_MS = 14_000;
const INTERACTION_COOLDOWN_MS = 35_000;
const INTERACTION_CHANCE = 0.38;
const PATROL_TRAVEL_MS = 1500;
const PATROL_PAUSE_MS = [1200, 2800] as const;
const PROXIMITY_THRESHOLD = 22; // % proximity to trigger interaction

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Maps actionLoading key → BehaviorMode (returns null if not an animated action) */
function deriveActionMode(key: string): BehaviorMode | null {
  if (key === 'feed' || key.startsWith('feed_') || key.startsWith('use_')) return 'eating';
  if (key === 'play') return 'playing';
  if (key === 'bathe') return 'cleaning';
  if (key === 'heal') return 'medicine';
  return null;
}

const SLEEP_FURNITURE = new Set(['bed', 'sofa', 'armchair']);

function findSleepX(placed: PlacedFurnitureItem[]): number {
  const f = placed.find(p => SLEEP_FURNITURE.has(p.itemId));
  if (!f) return 50;
  return Math.max(14, Math.min(86, f.x));
}

function pickInteraction(
  mood: Pet['mood'],
  petX: number,
  placed: PlacedFurnitureItem[],
  cooldowns: Record<string, number>,
  now: number,
): (SceneInteraction & { petTargetX: number }) | null {
  const candidates: Array<SceneInteraction & { petTargetX: number }> = [];

  for (const p of placed) {
    const def = getFurniture(p.itemId);
    if (!def || def.onWall) continue;
    if ((cooldowns[p.uid] ?? 0) > now) continue;
    if (Math.abs(p.x - petX) > PROXIMITY_THRESHOLD) continue;

    const interactions = ITEM_INTERACTIONS[p.itemId];
    if (!interactions) continue;

    const type = interactions[mood] ?? interactions['any'];
    if (!type) continue;

    const offset = petX <= p.x ? -10 : 10;
    candidates.push({
      furnitureUid: p.uid,
      furnitureId: p.itemId,
      type,
      petTargetX: Math.max(14, Math.min(86, p.x + offset)),
    });
  }

  if (candidates.length === 0 || Math.random() > INTERACTION_CHANCE) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function pickNextWaypointIdx(current: number): number {
  const others = [0, 1, 2].filter(i => i !== current);
  return others[Math.floor(Math.random() * others.length)];
}

function randPause(): number {
  return PATROL_PAUSE_MS[0] + Math.random() * (PATROL_PAUSE_MS[1] - PATROL_PAUSE_MS[0]);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const INITIAL_STATE: BehaviorState = {
  mode: 'idle',
  petX: 50,
  facingRight: true,
  sceneInteraction: null,
  activeAction: null,
};

export interface BehaviorStateWithControls extends BehaviorState {
  warpTo: (x: number) => void;
}

export function usePetBehaviorState(
  pet: Pet | null,
  actionLoading: string | null,
  placedFurniture: PlacedFurnitureItem[],
  paused: boolean = false,
): BehaviorStateWithControls {
  const [renderState, setRenderState] = useState<BehaviorState>(INITIAL_STATE);

  // Canonical state — always fresh, readable inside interval without stale closures
  const canon = useRef<BehaviorState>(INITIAL_STATE);
  const furnitureRef = useRef(placedFurniture);
  furnitureRef.current = placedFurniture;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Internal state machine mutable data
  const sm = useRef({
    waypointIdx: 1,       // start at center
    nextMoveAt: 0,
    interactionEndAt: 0,
    actionGraceUntil: 0,
    cooldowns: {} as Record<string, number>,
    idleStart: Date.now(),
    prevAsleep: false,
  });

  function push(next: BehaviorState) {
    canon.current = next;
    setRenderState(next);
  }

  // ── Effect 1: Detect actionLoading changes synchronously ──────────────────
  // Runs on every render where actionLoading changes — catches even <500ms actions.
  useEffect(() => {
    if (!actionLoading) return; // cleared — handled by grace period in interval

    const mode = deriveActionMode(actionLoading);
    if (!mode) return; // sleep/bond/wake don't have their own animation

    const grace = ACTION_GRACE[mode] ?? 3500;
    sm.current.actionGraceUntil = Date.now() + grace;
    sm.current.idleStart = Date.now() + grace; // reset patrol timer

    // Store original actionLoading key (e.g. 'feed_apple') so SceneProps can look up the food emoji
    push({ ...canon.current, mode, activeAction: actionLoading, sceneInteraction: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionLoading]);

  // ── Effect 2: Detect sleep/wake synchronously ────────────────────────────
  useEffect(() => {
    if (!pet) return;
    const m = sm.current;

    if (pet.isAsleep && !m.prevAsleep) {
      m.prevAsleep = true;
      const bedX = findSleepX(furnitureRef.current);
      push({ mode: 'sleeping', petX: bedX, facingRight: bedX >= 50, sceneInteraction: null, activeAction: null });
      return;
    }

    if (!pet.isAsleep && m.prevAsleep) {
      m.prevAsleep = false;
      m.idleStart = Date.now();
      m.nextMoveAt = Date.now() + IDLE_TO_PATROL_MS;
      push({ mode: 'idle', petX: 50, facingRight: true, sceneInteraction: null, activeAction: null });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.isAsleep]);

  // ── Effect 3: Patrol state machine (interval) ────────────────────────────
  // Handles only patrol + scene interactions; actions & sleep are handled above.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      // Owner present — freeze state machine
      if (pausedRef.current) return;

      const now = Date.now();
      const m = sm.current;
      const cur = canon.current;
      const placed = furnitureRef.current;

      // Blocked by action animation grace period
      if (now < m.actionGraceUntil) return;

      // Clear activeAction flag once grace expires
      if (cur.activeAction) {
        push({ ...cur, activeAction: null });
        return;
      }

      // Sleeping is managed by Effect 2
      if (cur.mode === 'sleeping') return;

      // Active scene interaction still running
      if (cur.mode === 'scene_interact' && now < m.interactionEndAt) return;

      // Scene interaction just finished — return to patrol
      if (cur.mode === 'scene_interact') {
        m.interactionEndAt = 0;
        m.nextMoveAt = now + PATROL_TRAVEL_MS + randPause();
        push({ mode: 'patrol', petX: cur.petX, facingRight: cur.facingRight, sceneInteraction: null, activeAction: null });
        return;
      }

      // Sick mood: stay still
      const petMood = furnitureRef.current; // dummy ref — we read mood from pet below
      void petMood; // suppress lint

      // Not enough idle time yet
      if (now - m.idleStart < IDLE_TO_PATROL_MS) {
        if (cur.mode !== 'idle') push({ ...cur, mode: 'idle' });
        return;
      }

      // Not time to move yet
      if (now < m.nextMoveAt) return;

      // Try scene interaction at current waypoint
      // We need pet mood — read it via a separate petMoodRef
      const interaction = pickInteraction(
        petMoodRef.current,
        cur.petX,
        placed,
        m.cooldowns,
        now,
      );
      if (interaction) {
        m.cooldowns[interaction.furnitureUid] = now + INTERACTION_COOLDOWN_MS;
        m.interactionEndAt = now + (INTERACTION_DURATION[interaction.type] ?? 5000);
        push({
          mode: 'scene_interact',
          petX: interaction.petTargetX,
          facingRight: interaction.petTargetX >= cur.petX,
          sceneInteraction: interaction,
          activeAction: null,
        });
        return;
      }

      // Advance to next waypoint
      const nextIdx = pickNextWaypointIdx(m.waypointIdx);
      m.waypointIdx = nextIdx;
      const nextX = PATROL_X[nextIdx];
      m.nextMoveAt = now + PATROL_TRAVEL_MS + randPause();

      push({
        mode: 'patrol',
        petX: nextX,
        facingRight: nextX > cur.petX,
        sceneInteraction: null,
        activeAction: null,
      });
    }, 500);

    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]); // all mutable state read via refs while active

  // ── Ref for pet mood (readable inside interval) ───────────────────────────
  const petMoodRef = useRef<Pet['mood']>('content');
  if (pet) petMoodRef.current = pet.mood;

  // Sick: interrupt patrol and return to idle
  useEffect(() => {
    if (!pet) return;
    if (pet.mood === 'sick') {
      const cur = canon.current;
      if (cur.mode === 'patrol' || cur.mode === 'scene_interact') {
        push({ mode: 'idle', petX: 50, facingRight: true, sceneInteraction: null, activeAction: null });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.mood]);

  function warpTo(x: number) {
    const m = sm.current;
    m.idleStart = Date.now();
    m.nextMoveAt = Date.now() + IDLE_TO_PATROL_MS + 2000;
    push({ mode: 'idle', petX: Math.max(8, Math.min(92, x)), facingRight: x >= 50, sceneInteraction: null, activeAction: null });
  }

  return { ...renderState, warpTo };
}
