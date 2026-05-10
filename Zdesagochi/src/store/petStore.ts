import { create } from 'zustand';
import {
  createApiService, MockApiService, syncPersonalityFromSkin, setPersonalityDirectly,
  advanceMockTime, getMockTimeScale, setMockTimeScale,
  getMockAccount,
  type ApiMode, type Pet, type FoodItem, type ShopItem, type InventoryItem,
  type Achievement, type DailyQuest, type Room, type LeaderboardEntry, type PetEvent,
  type Account,
} from '../api';
import { getSkin, SKINS } from '../data/skins';
import { type BodyShapeId } from '../data/bodyShapes';
import { type HeadId, type EarsId, type BodyPartId, type LimbsId, type ArmsId, type LegsId, type TailId, type NoseId, type MouthStyleId, type PartColorKey, type OutfitId } from '../data/petParts';
import { getBackground, BACKGROUNDS } from '../data/backgrounds';
import { getAura } from '../data/auras';
import { getAccessoriesBySlot } from '../data/accessories';
import { FURNITURE, getFurniture } from '../data/roomFurniture';

export type TabId = 'home' | 'shop' | 'inventory' | 'quests' | 'achievements' | 'leaderboard' | 'skins' | 'editor' | 'room' | 'personality_test';

export type FloorStyle = 'flat' | 'grid' | 'wood' | 'tile' | 'marble' | 'metal';

export interface RoomLight {
  id: string;
  name: string;
  x: number;         // 0–100 horizontal %
  y: number;         // 0–100 vertical %
  color: string;     // hex
  intensity: number; // 0–1 (alpha of glow)
  size: number;      // 20–200 (% of scene width for light diameter)
  isOn: boolean;
}

export type BackdropType = 'wall' | 'window' | 'panorama';
export type BackdropScene = 'garden' | 'ocean' | 'mountains' | 'space' | 'city' | 'sakura' | 'desert' | 'winter';
export type WindowStyle = 'classic' | 'arch' | 'panoramic';

export interface RoomCustomization {
  // Back wall
  wallColor: string;
  wallColor2: string;
  wallStyle: 'solid' | 'v_gradient' | 'r_gradient';
  wallImage: string | null;
  // Backdrop (replaces or overlays back wall)
  backdropType: BackdropType;
  backdropScene: BackdropScene;
  windowStyle: WindowStyle;
  // Side walls (left + right, always in sync)
  sideWallColor: string;
  sideWallColor2: string;
  sideWallStyle: 'solid' | 'v_gradient';
  sideWallImage: string | null;
  // Ceiling
  ceilingColor: string;
  ceilingColor2: string;
  ceilingStyle: 'solid' | 'v_gradient';
  ceilingImage: string | null;
  // Floor
  floorColor: string;
  floorStyle: FloorStyle;
  floorImage: string | null;
  // Light sources
  roomLights: RoomLight[];
  // Ambient lighting
  ambientDarkness: number;  // 0 = fully lit, 1 = pitch black
  hasSun: boolean;           // sun moves with real time of day
  sunPreviewHour: number | null; // null = real time, 0-23 = simulated hour
  // Effects
  accentColor: string;
}

export const DEFAULT_ROOM_LIGHTS: RoomLight[] = [
  { id: 'ceiling_default', name: 'Потолочный свет', x: 50, y: 22, color: '#C084FC', intensity: 0.45, size: 90, isOn: true },
];

export const DEFAULT_ROOM_CUSTOMIZATION: RoomCustomization = {
  wallColor: '#0D0020',
  wallColor2: '#050010',
  wallStyle: 'v_gradient',
  wallImage: null,
  backdropType: 'wall',
  backdropScene: 'garden',
  windowStyle: 'classic',
  sideWallColor: '#070014',
  sideWallColor2: '#030008',
  sideWallStyle: 'v_gradient',
  sideWallImage: null,
  ceilingColor: '#050010',
  ceilingColor2: '#020008',
  ceilingStyle: 'solid',
  ceilingImage: null,
  floorColor: '#A855F7',
  floorStyle: 'grid',
  floorImage: null,
  roomLights: DEFAULT_ROOM_LIGHTS,
  ambientDarkness: 0,
  hasSun: false,
  sunPreviewHour: null,
  accentColor: '#A855F7',
};

export interface PlacedFurnitureItem {
  uid: string;
  itemId: string;
  x: number;      // % from left edge (0-100)
  y: number;      // % from top edge (0-100)
  scale: number;  // 0.5 - 3.0
  flipped: boolean;
  zIndex: number;
  locked: boolean;
  rotation: number;   // -180 to 180 degrees, around Z axis (2D)
  tiltX: number;      // -80 to 80 degrees, 3D rotateX (lean fwd/back)
  tiltY: number;      // -80 to 80 degrees, 3D rotateY (lean left/right)
  hue: number;        // 0-360 for CSS hue-rotate
  isOn: boolean;      // lamps: light on/off
  imageUrl?: string;  // painting: custom photo (data URL)
}

export interface RoomPreset {
  id: string;
  name: string;
  createdAt: number;
  customization: RoomCustomization;
  furniture: PlacedFurnitureItem[];
}

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'xp' | 'coins';
}

interface PetStore {
  pet: Pet | null;
  account: Account;
  coins: number;
  isLoading: boolean;
  actionLoading: string | null;
  activeTab: TabId;
  foods: FoodItem[];
  shopItems: ShopItem[];
  inventory: InventoryItem[];
  achievements: Achievement[];
  quests: DailyQuest[];
  rooms: Room[];
  leaderboard: LeaderboardEntry[];
  events: PetEvent[];
  apiMode: ApiMode;
  apiBaseUrl: string;
  notifications: Notification[];
  debugTimeScale: number;
  ownedSkins: string[];
  equippedSkinId: string;
  equippedBodyId: BodyShapeId;
  equippedHeadId: HeadId;
  equippedEarsId: EarsId;
  equippedBodyPartId: BodyPartId;
  equippedLimbsId: LimbsId;
  equippedArmsId: ArmsId;
  equippedLegsId: LegsId;
  equippedTailId: TailId;
  partColors: Record<PartColorKey, string | null>;
  gradientEnabled: boolean;
  equippedOutfitId: OutfitId;
  outfitColor: string;
  outfitColor2: string;
  equippedNoseId: NoseId;
  equippedMouthStyleId: MouthStyleId;
  equippedBgId: string;
  ownedBgs: string[];
  petColorOverride: { body1: string; body2: string; glow: string; cheek: string } | null;
  gradientDirection: 'radial' | 'vertical' | 'horizontal' | 'diagonal' | 'diagonal_reverse';
  petMorph: { scale: number; width: number; height: number; headScale: number; earsScale: number; limbsScale: number; squish: number };
  equippedAuraId: string;
  ownedAuras: string[];
  ownedAccessoriesList: string[];
  buyAccessory(id: string): void;

  ownedFurnitureIds: string[];
  placedFurniture: PlacedFurnitureItem[];
  addRoomFurniture(itemId: string): void;
  duplicateRoomFurniture(uid: string): string | null;
  removeRoomFurniture(uid: string): void;
  updateRoomFurniture(uid: string, changes: Partial<PlacedFurnitureItem>): void;
  buyRoomFurniture(itemId: string): void;
  clearRoomFurniture(): void;
  equippedAccessories: { head: string; face: string; back: string; neck: string; clothing: string };
  accessoryConfigs: {
    head: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    face: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    back: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    neck: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    clothing: { scale: number; x: number; y: number; rotation: number; behind: boolean };
  };
  eyeStyleOverride: string | null;
  eyeColorOverride: string | null;
  overlayOverride: string | null;
  roomCustomization: RoomCustomization;
  roomPresets: RoomPreset[];
  saveRoomPreset(name: string): void;
  applyRoomPreset(id: string): void;
  deleteRoomPreset(id: string): void;
  exportRoomPreset(id: string): string;
  importRoomPreset(code: string): boolean;

  petPresets: Record<string, any>;
  savePreset: (name: string) => void;
  loadPreset: (name: string) => void;
  deletePreset: (name: string) => void;

  history: any[];
  future: any[];
  undo: () => void;
  redo: () => void;
  recordHistory: () => void;

  setActiveTab(tab: TabId): void;
  setApiMode(mode: ApiMode): void;
  setApiBaseUrl(url: string): void;
  buySkin(skinId: string): void;
  equipSkin(skinId: string): void;
  setPersonality(personalityId: string): void;
  equipBody(shapeId: BodyShapeId): void;
  equipHead(id: HeadId): void;
  equipEars(id: EarsId): void;
  equipBodyPart(id: BodyPartId): void;
  equipLimbs(id: LimbsId): void;
  equipArms(id: ArmsId): void;
  equipLegs(id: LegsId): void;
  equipTail(id: TailId): void;
  setPartColor(part: PartColorKey, color: string | null): void;
  setGradientEnabled(enabled: boolean): void;
  equipOutfit(id: OutfitId): void;
  setOutfitColor(c: string): void;
  setOutfitColor2(c: string): void;
  equipNose(id: NoseId): void;
  equipMouthStyle(id: MouthStyleId): void;
  buyBg(bgId: string): void;
  equipBg(bgId: string): void;
  setPetColorOverride(c: { body1: string; body2: string; glow: string; cheek: string } | null): void;
  setGradientDirection(d: 'radial' | 'vertical' | 'horizontal' | 'diagonal' | 'diagonal_reverse'): void;
  setPetMorph(m: { scale: number; width: number; height: number; headScale: number; earsScale: number; limbsScale: number; squish: number }): void;
  buyAura(auraId: string): void;
  equipAura(auraId: string): void;
  setAccessory(slot: 'head' | 'face' | 'back' | 'neck' | 'clothing', id: string): void;
  setAccessoryConfig(slot: 'head' | 'face' | 'back' | 'neck' | 'clothing', config: { scale: number; x: number; y: number; rotation: number; behind: boolean }): void;
  setEyeStyleOverride(s: string | null): void;
  setEyeColorOverride(c: string | null): void;
  setOverlayOverride(s: string | null): void;
  setRoomCustomization(partial: Partial<RoomCustomization>): void;
  resetRoomCustomization(): void;
  addRoomLight(light: Omit<RoomLight, 'id'>): void;
  updateRoomLight(id: string, changes: Partial<RoomLight>): void;
  removeRoomLight(id: string): void;

  loadPet(): Promise<void>;
  feedPet(foodId: string): Promise<void>;
  playWithPet(): Promise<{ score: number; xpGained: number; coinsGained: number; message: string } | null>;
  sleepPet(): Promise<void>;
  wakePet(): Promise<void>;
  bathePet(): Promise<void>;
  healPet(): Promise<void>;
  bondWithPet(): Promise<void>;
  syncPet(): Promise<void>;
  acceptEvolution(): Promise<void>;
  rejectEvolution(): Promise<void>;
  beginNewLife(): Promise<void>;
  updatePetName(name: string): Promise<void>;
  savePetAppearance(): Promise<void>;
  exportAppearanceCode(): string;
  importAppearanceCode(code: string): boolean;
  loadEvents(): Promise<void>;

  loadCoins(): Promise<void>;
  loadShop(): Promise<void>;
  buyItem(itemId: string): Promise<void>;
  loadInventory(): Promise<void>;
  useInventoryItem(itemId: string): Promise<void>;

  loadAchievements(): Promise<void>;
  claimAchievement(achievementId: string): Promise<void>;
  loadQuests(): Promise<void>;
  claimQuestReward(questId: string): Promise<void>;

  loadRooms(): Promise<void>;
  buyRoom(roomId: string): Promise<void>;
  equipRoom(roomId: string): Promise<void>;

  loadLeaderboard(): Promise<void>;
  loadFoods(): Promise<void>;
  registerMemoryPerfect(): void;

  notify(message: string, type: Notification['type']): void;
  dismissNotification(id: number): void;
  refreshProgress(): void;
  setDebugTimeScale(scale: number): void;
  advanceDebugTime(hours: number): Promise<void>;

  unclaimedAchievements(): number;
  completedUnclaimedQuests(): number;
}

let notifId = 0;

// ── Room localStorage helpers ─────────────────────────────────────────────────

// Raw base64 data URLs must never reach localStorage — they blow the 5 MB quota.
// Images go to IndexedDB (imageStore.ts) and only the short "idb:key" ref is stored.
// Any legacy base64 that somehow survived is stripped here to unblock the user.
const isBase64 = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith('data:');

function stripBase64FromCustomization(c: RoomCustomization): RoomCustomization {
  return {
    ...c,
    wallImage:     isBase64(c.wallImage)     ? null : c.wallImage,
    sideWallImage: isBase64(c.sideWallImage) ? null : c.sideWallImage,
    ceilingImage:  isBase64(c.ceilingImage)  ? null : c.ceilingImage,
    floorImage:    isBase64(c.floorImage)    ? null : c.floorImage,
  };
}

function loadRoomCustomization(): RoomCustomization {
  try {
    const raw = localStorage.getItem('roomCustomization');
    if (!raw) return DEFAULT_ROOM_CUSTOMIZATION;
    const loaded = stripBase64FromCustomization({ ...DEFAULT_ROOM_CUSTOMIZATION, ...JSON.parse(raw) });
    return { ...loaded, sunPreviewHour: null }; // never restore preview time — always start at real time
  } catch { return DEFAULT_ROOM_CUSTOMIZATION; }
}

function loadPlacedFurniture(): PlacedFurnitureItem[] {
  try {
    const raw = localStorage.getItem('placedFurniture');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return parsed.map((p: any): PlacedFurnitureItem => ({
      rotation: 0, tiltX: 0, tiltY: 0, hue: 0, isOn: true,
      ...p,
      imageUrl: isBase64(p.imageUrl) ? undefined : p.imageUrl,
    }));
  } catch { return []; }
}

function loadOwnedFurnitureIds(): string[] {
  const freeIds = FURNITURE.filter(f => f.price === 0).map(f => f.id);
  try {
    const raw = localStorage.getItem('ownedFurnitureIds');
    if (!raw) return freeIds;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set([...freeIds, ...parsed])] : freeIds;
  } catch { return freeIds; }
}

function persistRoom(customization: RoomCustomization, placed: PlacedFurnitureItem[]) {
  const safeCustomization = stripBase64FromCustomization(customization);
  const safePlaced = placed.map(p =>
    isBase64(p.imageUrl) ? { ...p, imageUrl: undefined } : p
  );
  localStorage.setItem('roomCustomization', JSON.stringify(safeCustomization));
  localStorage.setItem('placedFurniture', JSON.stringify(safePlaced));
}

// ─────────────────────────────────────────────────────────────────────────────

export const usePetStore = create<PetStore>((set, get) => {
  const api = () => createApiService(get().apiMode, get().apiBaseUrl);

  async function action(key: string, fn: () => Promise<void>) {
    set({ actionLoading: key });
    try { await fn(); }
    catch (e) { get().notify((e as Error).message, 'error'); }
    finally { set({ actionLoading: null }); }
  }

  return {
    pet: null, account: {}, coins: 0, isLoading: false, actionLoading: null, activeTab: 'home',
    foods: [], shopItems: [], inventory: [], achievements: [], quests: [],
    rooms: [], leaderboard: [], events: [],
    apiMode: 'mock', apiBaseUrl: 'http://localhost:3000',
    notifications: [], debugTimeScale: getMockTimeScale(),
    ownedSkins: SKINS.filter(s => s.price === 0).map(s => s.id),
    equippedSkinId: 'default',
    equippedBodyId: 'blob',
    equippedHeadId: 'round' as HeadId,
    equippedEarsId: 'none' as EarsId,
    equippedBodyPartId: 'chubby' as BodyPartId,
    equippedLimbsId: 'none' as LimbsId,
    equippedArmsId: 'none' as ArmsId,
    equippedLegsId: 'none' as LegsId,
    equippedTailId: 'none' as TailId,
    partColors: { head: null, ears: null, body: null, arms: null, legs: null, tail: null } as Record<PartColorKey, string | null>,
    gradientEnabled: true,
    equippedOutfitId: 'none' as OutfitId,
    outfitColor: '#FFFFFF',
    outfitColor2: '#AAAAAA',
    equippedNoseId: 'none' as NoseId,
    equippedMouthStyleId: 'auto' as MouthStyleId,
    equippedBgId: 'void_dark',
    ownedBgs: BACKGROUNDS.filter(b => b.price === 0).map(b => b.id),
    ownedFurnitureIds: loadOwnedFurnitureIds(),
    placedFurniture: loadPlacedFurniture(),
    petColorOverride: null,
    gradientDirection: 'radial',
    petMorph: { scale: 1, width: 1, height: 1, headScale: 1, earsScale: 1, limbsScale: 1, squish: 1 },
    equippedAuraId: 'none',
    ownedAuras: ['none'],
    equippedAccessories: { head: 'none_head', face: 'none_face', back: 'none_back', neck: 'none_neck', clothing: 'none_clothing' },
    ownedAccessoriesList: [],
    accessoryConfigs: {
      head: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
      face: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
      back: { scale: 1, x: 0, y: 0, rotation: 0, behind: true },
      neck: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
      clothing: { scale: 1, x: 0, y: 0, rotation: 0, behind: true },
    },
    eyeStyleOverride: null,
    eyeColorOverride: null,
    overlayOverride: null,
    roomCustomization: loadRoomCustomization(),
    roomPresets: JSON.parse(localStorage.getItem('roomPresets') || '[]'),

    saveRoomPreset(name: string) {
      const { roomCustomization, placedFurniture } = get();
      const preset: RoomPreset = {
        id: Date.now().toString(),
        name: name.trim(),
        createdAt: Date.now(),
        customization: { ...roomCustomization },
        furniture: placedFurniture.map(f => ({ ...f })),
      };
      const next = [preset, ...get().roomPresets];
      set({ roomPresets: next });
      localStorage.setItem('roomPresets', JSON.stringify(next));
      get().notify(`Комната «${preset.name}» сохранена`, 'success');
    },

    applyRoomPreset(id: string) {
      const { roomPresets, ownedFurnitureIds } = get();
      const preset = roomPresets.find(p => p.id === id);
      if (!preset) return;
      const customization = { ...DEFAULT_ROOM_CUSTOMIZATION, ...preset.customization };
      const placed = preset.furniture
        .filter(f => ownedFurnitureIds.includes(f.itemId))
        .map(f => ({ ...f, locked: false }));
      persistRoom(customization, placed);
      set({ roomCustomization: customization, placedFurniture: placed });
      get().notify(`Комната «${preset.name}» применена`, 'info');
    },

    deleteRoomPreset(id: string) {
      const preset = get().roomPresets.find(p => p.id === id);
      const next = get().roomPresets.filter(p => p.id !== id);
      set({ roomPresets: next });
      localStorage.setItem('roomPresets', JSON.stringify(next));
      if (preset) get().notify(`«${preset.name}» удалена`, 'info');
    },

    exportRoomPreset(id: string): string {
      const preset = get().roomPresets.find(p => p.id === id);
      if (!preset) return '';
      try {
        return btoa(encodeURIComponent(JSON.stringify(preset)));
      } catch { return ''; }
    },

    importRoomPreset(code: string): boolean {
      try {
        const raw: RoomPreset = JSON.parse(decodeURIComponent(atob(code.trim())));
        if (!raw.name || !raw.customization) return false;
        const newPreset: RoomPreset = {
          id: Date.now().toString(),
          name: raw.name,
          createdAt: Date.now(),
          customization: { ...DEFAULT_ROOM_CUSTOMIZATION, ...raw.customization },
          furniture: (raw.furniture ?? []).map(f => ({ ...f, locked: false })),
        };
        const next = [newPreset, ...get().roomPresets];
        set({ roomPresets: next });
        localStorage.setItem('roomPresets', JSON.stringify(next));
        get().notify(`Комната «${newPreset.name}» импортирована`, 'success');
        return true;
      } catch { return false; }
    },

    petPresets: JSON.parse(localStorage.getItem('petPresets') || '{}'),

    savePreset(name: string) {
      const state = get();
      const preset = {
        equippedSkinId: state.equippedSkinId,
        equippedBodyId: state.equippedBodyId,
        equippedHeadId: state.equippedHeadId,
        equippedEarsId: state.equippedEarsId,
        equippedBodyPartId: state.equippedBodyPartId,
        equippedLimbsId: state.equippedLimbsId,
        equippedArmsId: state.equippedArmsId,
        equippedLegsId: state.equippedLegsId,
        equippedTailId: state.equippedTailId,
        equippedBgId: state.equippedBgId,
        partColors: state.partColors,
        gradientEnabled: state.gradientEnabled,
        equippedOutfitId: state.equippedOutfitId,
        outfitColor: state.outfitColor,
        outfitColor2: state.outfitColor2,
        petColorOverride: state.petColorOverride,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
        eyeStyleOverride: state.eyeStyleOverride,
        eyeColorOverride: state.eyeColorOverride,
        overlayOverride: state.overlayOverride,
        equippedNoseId: state.equippedNoseId,
        equippedMouthStyleId: state.equippedMouthStyleId,
        gradientDirection: state.gradientDirection,
      };
      const newPresets = { ...state.petPresets, [name]: preset };
      set({ petPresets: newPresets });
      localStorage.setItem('petPresets', JSON.stringify(newPresets));
      state.notify(`Пресет "${name}" сохранён`, 'success');
    },

    loadPreset(name: string) {
      const state = get();
      const preset = state.petPresets[name];
      if (preset) {
        set({ ...preset });
        state.notify(`Пресет "${name}" загружен`, 'info');
      }
    },

    deletePreset(name: string) {
      const state = get();
      const newPresets = { ...state.petPresets };
      delete newPresets[name];
      set({ petPresets: newPresets });
      localStorage.setItem('petPresets', JSON.stringify(newPresets));
      state.notify(`Пресет "${name}" удалён`, 'info');
    },

    history: [],
    future: [],

    recordHistory() {
      const state = get();
      const snapshot = {
        equippedSkinId: state.equippedSkinId,
        equippedBodyId: state.equippedBodyId,
        equippedBgId: state.equippedBgId,
        equippedHeadId: state.equippedHeadId,
        equippedEarsId: state.equippedEarsId,
        equippedBodyPartId: state.equippedBodyPartId,
        equippedLimbsId: state.equippedLimbsId,
        equippedArmsId: state.equippedArmsId,
        equippedLegsId: state.equippedLegsId,
        equippedTailId: state.equippedTailId,
        equippedNoseId: state.equippedNoseId,
        equippedMouthStyleId: state.equippedMouthStyleId,
        petColorOverride: state.petColorOverride,
        gradientDirection: state.gradientDirection,
        gradientEnabled: state.gradientEnabled,
        partColors: state.partColors,
        equippedOutfitId: state.equippedOutfitId,
        outfitColor: state.outfitColor,
        outfitColor2: state.outfitColor2,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
        eyeStyleOverride: state.eyeStyleOverride,
        eyeColorOverride: state.eyeColorOverride,
        overlayOverride: state.overlayOverride,
      };
      set({
        history: [snapshot, ...state.history].slice(0, 50),
        future: []
      });
    },

    undo() {
      const state = get();
      if (state.history.length === 0) return;
      const [prev, ...rest] = state.history;
      const currentSnapshot = {
        equippedSkinId: state.equippedSkinId,
        equippedBodyId: state.equippedBodyId,
        equippedBgId: state.equippedBgId,
        equippedHeadId: state.equippedHeadId,
        equippedEarsId: state.equippedEarsId,
        equippedBodyPartId: state.equippedBodyPartId,
        equippedLimbsId: state.equippedLimbsId,
        equippedArmsId: state.equippedArmsId,
        equippedLegsId: state.equippedLegsId,
        equippedTailId: state.equippedTailId,
        equippedNoseId: state.equippedNoseId,
        equippedMouthStyleId: state.equippedMouthStyleId,
        petColorOverride: state.petColorOverride,
        gradientDirection: state.gradientDirection,
        gradientEnabled: state.gradientEnabled,
        partColors: state.partColors,
        equippedOutfitId: state.equippedOutfitId,
        outfitColor: state.outfitColor,
        outfitColor2: state.outfitColor2,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
        eyeStyleOverride: state.eyeStyleOverride,
        eyeColorOverride: state.eyeColorOverride,
        overlayOverride: state.overlayOverride,
      };
      set({ ...prev, history: rest, future: [currentSnapshot, ...state.future].slice(0, 50) });
      get().notify('Действие отменено', 'info');
    },

    redo() {
      const state = get();
      if (state.future.length === 0) return;
      const [next, ...rest] = state.future;
      const currentSnapshot = {
        equippedSkinId: state.equippedSkinId,
        equippedBodyId: state.equippedBodyId,
        equippedBgId: state.equippedBgId,
        equippedHeadId: state.equippedHeadId,
        equippedEarsId: state.equippedEarsId,
        equippedBodyPartId: state.equippedBodyPartId,
        equippedLimbsId: state.equippedLimbsId,
        equippedArmsId: state.equippedArmsId,
        equippedLegsId: state.equippedLegsId,
        equippedTailId: state.equippedTailId,
        equippedNoseId: state.equippedNoseId,
        equippedMouthStyleId: state.equippedMouthStyleId,
        petColorOverride: state.petColorOverride,
        gradientDirection: state.gradientDirection,
        gradientEnabled: state.gradientEnabled,
        partColors: state.partColors,
        equippedOutfitId: state.equippedOutfitId,
        outfitColor: state.outfitColor,
        outfitColor2: state.outfitColor2,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
        eyeStyleOverride: state.eyeStyleOverride,
        eyeColorOverride: state.eyeColorOverride,
        overlayOverride: state.overlayOverride,
      };
      set({ ...next, future: rest, history: [currentSnapshot, ...state.history].slice(0, 50) });
      get().notify('Действие возвращено', 'info');
    },

    // ── Navigation ─────────────────────────────────────────────────────────

    setActiveTab(tab) {
      set({ activeTab: tab });
      const { loadShop, loadCoins, loadInventory, loadQuests, loadAchievements, loadLeaderboard } = get();
      if (tab === 'shop')         { loadShop(); loadCoins(); }
      if (tab === 'inventory')    { loadInventory(); loadCoins(); }
      if (tab === 'quests')       { loadQuests(); }
      if (tab === 'achievements') { loadAchievements(); }
      if (tab === 'leaderboard')  { loadLeaderboard(); }
    },

    // ── API config ─────────────────────────────────────────────────────────

    setApiMode(mode) {
      set({ apiMode: mode });
      get().notify(mode === 'mock' ? '🟡 Mock-режим включён' : '🟢 Подключение к серверу...', 'info');
      get().loadPet();
      get().loadCoins();
    },
    setApiBaseUrl(url) { set({ apiBaseUrl: url }); },

    setDebugTimeScale(scale) {
      const next = setMockTimeScale(scale);
      set({ debugTimeScale: next });
      get().notify(`⏱ Время ×${next}`, 'info');
    },

    async advanceDebugTime(hours) {
      if (get().apiMode !== 'mock') {
        get().notify('Ускорение времени доступно только в Mock-режиме', 'error');
        return;
      }
      advanceMockTime(hours);
      try {
        set({ pet: await api().syncPet() });
        get().notify(`⏩ +${hours}ч`, 'info');
      } catch (e) {
        get().notify((e as Error).message, 'error');
      }
    },

    // ── Pet ────────────────────────────────────────────────────────────────

    async loadPet() {
      set({ isLoading: true });
      try {
        const pet = await api().getPet();
        set({ pet, account: get().apiMode === 'mock' ? getMockAccount() : get().account });
      }
      catch (e) { get().notify((e as Error).message, 'error'); }
      finally { set({ isLoading: false }); }
    },

    async feedPet(foodId) {
      await action('feed', async () => {
        const pet = await api().feedPet(foodId);
        const food = get().foods.find(f => f.id === foodId);
        set({ pet });
        get().notify(`${food?.emoji ?? '🍽'} ${food?.name} — +${food?.hungerRestore ?? '?'} сытость`, 'success');
        get().refreshProgress();
      });
    },

    async playWithPet() {
      let result = null;
      await action('play', async () => {
        const r = await api().playWithPet();
        set({ pet: r.pet, coins: get().coins + r.coinsGained });
        get().notify(`${r.message} +${r.xpGained} XP  +${r.coinsGained} 🪙`, 'xp');
        get().refreshProgress();
        result = r;
      });
      return result;
    },

    async sleepPet() {
      await action('sleep', async () => {
        set({ pet: await api().sleepPet() });
        get().notify('😴 Питомец отдыхает...', 'info');
      });
    },
    async wakePet() {
      await action('sleep', async () => {
        set({ pet: await api().wakePet() });
        get().notify('☀️ Доброе утро!', 'success');
      });
    },
    async bathePet() {
      await action('bathe', async () => {
        set({ pet: await api().bathePet() });
        get().notify('🛁 Чистый и свежий! +40 чистота', 'success');
        get().refreshProgress();
      });
    },
    async healPet() {
      await action('heal', async () => {
        set({ pet: await api().healPet() });
        get().notify('💊 +35 здоровье', 'success');
        get().refreshProgress();
      });
    },
    async bondWithPet() {
      await action('bond', async () => {
        set({ pet: await api().bondWithPet() });
        get().notify('💜 +20 связь', 'success');
        get().refreshProgress();
      });
    },
    async syncPet() {
      try { set({ pet: await api().syncPet() }); } catch { /* silent */ }
    },
    async acceptEvolution() {
      await action('accept_evolution', async () => {
        const pet = await api().acceptEvolution();
        set({ pet });
        get().notify('🌟 Новый путь принят', 'success');
        get().refreshProgress();
      });
    },
    async rejectEvolution() {
      await action('reject_evolution', async () => {
        const pet = await api().rejectEvolution();
        set({ pet });
        get().notify('🌙 Путь отложен', 'info');
        get().refreshProgress();
      });
    },
    async beginNewLife() {
      await action('new_life', async () => {
        const result = await api().beginNewLife();
        set({ pet: result.pet, account: result.account });
        get().notify('🌱 Новое тело, старая память пути', 'success');
        get().refreshProgress();
      });
    },
    async updatePetName(name) {
      await action('name', async () => {
        const pet = await api().updatePetName(name);
        set({ pet });
        get().notify(`✏️ Имя: «${pet.name}»`, 'success');
      });
    },
    async savePetAppearance() {
      await action('save_appearance', async () => {
        const s = get();
        const equippedAccessories = { ...s.equippedAccessories };
        const owned = s.ownedAccessoriesList;
        
        // Filter out unowned preview items
        if (!owned.includes(equippedAccessories.head) && !equippedAccessories.head.startsWith('none')) equippedAccessories.head = 'none_head';
        if (!owned.includes(equippedAccessories.face) && !equippedAccessories.face.startsWith('none')) equippedAccessories.face = 'none_face';
        if (!owned.includes(equippedAccessories.back) && !equippedAccessories.back.startsWith('none')) equippedAccessories.back = 'none_back';
        if (!owned.includes(equippedAccessories.neck) && !equippedAccessories.neck.startsWith('none')) equippedAccessories.neck = 'none_neck';
        if (!owned.includes(equippedAccessories.clothing) && !equippedAccessories.clothing.startsWith('none')) equippedAccessories.clothing = 'none_clothing';

        const config = {
          equippedSkinId: s.equippedSkinId,
          equippedBodyId: s.equippedBodyId,
          equippedBgId: s.equippedBgId,
          petColorOverride: s.petColorOverride,
          petMorph: s.petMorph,
          equippedAuraId: s.equippedAuraId,
          equippedAccessories,
          accessoryConfigs: s.accessoryConfigs,
        };
        
        // Sync local state if we changed something
        set({ equippedAccessories });
        // In a real app, we'd send this to the API
        // For now, we simulate persistence
        localStorage.setItem('pet_appearance_debug', JSON.stringify(config));
        get().notify('✨ Внешний вид сохранён!', 'success');
      });
    },
    exportAppearanceCode() {
      const s = get();
      const config = {
        s: s.equippedSkinId,
        b: s.equippedBodyId,
        bg: s.equippedBgId,
        c: s.petColorOverride,
        m: s.petMorph,
        a: s.equippedAuraId,
        acc: s.equippedAccessories,
        cfg: s.accessoryConfigs,
      };
      return btoa(JSON.stringify(config));
    },
    importAppearanceCode(code) {
      try {
        const config = JSON.parse(atob(code));
        get().recordHistory();
        set({
          equippedSkinId: config.s,
          equippedBodyId: config.b,
          equippedBgId: config.bg,
          petColorOverride: config.c,
          petMorph: config.m,
          equippedAuraId: config.a,
          equippedAccessories: config.acc,
          accessoryConfigs: config.cfg,
        });
        get().notify('👗 Облик импортирован!', 'success');
        return true;
      } catch {
        get().notify('❌ Ошибка импорта кода', 'error');
        return false;
      }
    },
    async loadEvents() {
      try { set({ events: await api().getPetEvents() }); } catch { /* silent */ }
    },

    // ── Economy ────────────────────────────────────────────────────────────

    async loadCoins() {
      try { set({ coins: (await api().getCoins()).coins }); } catch { /* silent */ }
    },
    async loadShop() {
      try { set({ shopItems: await api().getShop() }); } catch { /* silent */ }
    },
    async buyItem(itemId) {
      await action(`buy_${itemId}`, async () => {
        const result = await api().buyItem(itemId);
        set({ coins: result.coins, inventory: result.inventory });
        get().notify(`🛒 «${result.item.name}» — -${result.item.price} 🪙`, 'success');
        get().refreshProgress();
      });
    },
    async loadInventory() {
      try { set({ inventory: await api().getInventory() }); } catch { /* silent */ }
    },
    async useInventoryItem(itemId) {
      await action(`use_${itemId}`, async () => {
        const itemName = get().inventory.find(i => i.itemId === itemId)?.item.name ?? itemId;
        const pet = await api().useInventoryItem(itemId);
        set({ pet });
        await get().loadInventory();
        get().notify(`✨ Использован «${itemName}»`, 'success');
        get().refreshProgress();
      });
    },

    // ── Progress ───────────────────────────────────────────────────────────

    async loadAchievements() {
      try { set({ achievements: await api().getAchievements() }); } catch { /* silent */ }
    },
    async claimAchievement(achievementId) {
      await action(`ca_${achievementId}`, async () => {
        const result = await api().claimAchievement(achievementId);
        set({ coins: result.newBalance });
        set(s => ({ achievements: s.achievements.map(a => a.id === achievementId ? result.achievement : a) }));
        get().notify(`🏆 «${result.achievement.name}» — +${result.coins} 🪙`, 'coins');
      });
    },
    async loadQuests() {
      try { set({ quests: await api().getQuests() }); } catch { /* silent */ }
    },
    async claimQuestReward(questId) {
      await action(`cq_${questId}`, async () => {
        const result = await api().claimQuestReward(questId);
        set({ coins: result.newBalance });
        set(s => ({ quests: s.quests.map(q => q.id === questId ? result.quest : q) }));
        get().notify(`🎯 «${result.quest.name}» — +${result.coins} 🪙 +${result.xp} XP`, 'coins');
        await get().loadPet();
      });
    },

    // ── Rooms ──────────────────────────────────────────────────────────────

    async loadRooms() {
      try { set({ rooms: await api().getRooms() }); } catch { /* silent */ }
    },
    async buyRoom(roomId) {
      await action(`buy_room_${roomId}`, async () => {
        const rooms = await api().buyRoom(roomId);
        set({ rooms });
        await get().loadCoins();
        const room = rooms.find(r => r.id === roomId);
        get().notify(`🏠 «${room?.name}» куплена!`, 'success');
        get().refreshProgress();
      });
    },
    async equipRoom(roomId) {
      await action(`eq_${roomId}`, async () => {
        await api().equipRoom(roomId);
        set(s => ({ pet: s.pet ? { ...s.pet, equippedRoomId: roomId } : null }));
        const room = get().rooms.find(r => r.id === roomId);
        get().notify(`✨ «${room?.name}» активирована!`, 'success');
      });
    },

    // ── Misc ───────────────────────────────────────────────────────────────

    async loadLeaderboard() {
      try { set({ leaderboard: await api().getLeaderboard() }); } catch { /* silent */ }
    },
    async loadFoods() {
      try { set({ foods: await api().getFoods() }); } catch { /* silent */ }
    },

    registerMemoryPerfect() {
      const svc = api();
      if (svc instanceof MockApiService) svc.registerMemoryPerfect();
      get().refreshProgress();
    },

    refreshProgress() {
      const { loadAchievements, loadQuests, loadEvents } = get();
      loadAchievements();
      loadQuests();
      loadEvents();
    },

    // ── Skins ──────────────────────────────────────────────────────────────

    buySkin(skinId) {
      const { coins, ownedSkins } = get();
      const skin = getSkin(skinId);
      if (ownedSkins.includes(skinId)) { get().equipSkin(skinId); return; }
      if (coins < skin.price) { get().notify('Недостаточно монет 🪙', 'error'); return; }
      if (skin.requiredLevel && (get().pet?.level ?? 0) < skin.requiredLevel) {
        get().notify(`Нужен уровень ${skin.requiredLevel} 🔒`, 'error'); return;
      }
      set(s => ({ coins: s.coins - skin.price, ownedSkins: [...s.ownedSkins, skinId] }));
      get().notify(`✨ Скин «${skin.name}» куплен!`, 'coins');
      get().equipSkin(skinId);
    },

    equipSkin(skinId) {
      get().recordHistory();
      const skin = getSkin(skinId);
      set({ equippedSkinId: skinId });
      if (get().apiMode === 'mock') {
        syncPersonalityFromSkin(skinId);
        get().loadPet();
      }
      get().notify(`🎨 Надет «${skin.name}»`, 'success');
    },

    setPersonality(personalityId) {
      if (get().apiMode === 'mock') {
        setPersonalityDirectly(personalityId);
        get().loadPet();
      }
    },

    equipBody(shapeId) {
      get().recordHistory();
      set({ equippedBodyId: shapeId });
    },

    equipHead(id) { get().recordHistory(); set({ equippedHeadId: id }); },
    equipEars(id) { get().recordHistory(); set({ equippedEarsId: id }); },
    equipBodyPart(id) { get().recordHistory(); set({ equippedBodyPartId: id }); },
    equipLimbs(id) { get().recordHistory(); set({ equippedLimbsId: id }); },
    equipArms(id) { get().recordHistory(); set({ equippedArmsId: id }); },
    equipLegs(id) { get().recordHistory(); set({ equippedLegsId: id }); },
    equipTail(id) { get().recordHistory(); set({ equippedTailId: id }); },
    setPartColor(part, color) { get().recordHistory(); set(s => ({ partColors: { ...s.partColors, [part]: color } })); },
    setGradientEnabled(enabled) { get().recordHistory(); set({ gradientEnabled: enabled }); },
    equipOutfit(id) { get().recordHistory(); set({ equippedOutfitId: id }); },
    setOutfitColor(c) { set({ outfitColor: c }); },
    setOutfitColor2(c) { set({ outfitColor2: c }); },
    equipNose(id) { get().recordHistory(); set({ equippedNoseId: id }); },
    equipMouthStyle(id) { get().recordHistory(); set({ equippedMouthStyleId: id }); },

    buyBg(bgId) {
      const bg = getBackground(bgId);
      const { coins, ownedBgs } = get();
      if (ownedBgs.includes(bgId)) { get().equipBg(bgId); return; }
      if (coins < bg.price) { get().notify('Недостаточно монет 🪙', 'error'); return; }
      if (bg.requiredLevel && (get().pet?.level ?? 0) < bg.requiredLevel) {
        get().notify(`Нужен уровень ${bg.requiredLevel} 🔒`, 'error'); return;
      }
      set(s => ({ coins: s.coins - bg.price, ownedBgs: [...s.ownedBgs, bgId] }));
      get().notify(`🌌 Фон «${bg.name}» куплен!`, 'coins');
      get().equipBg(bgId);
    },

    equipBg(bgId) {
      get().recordHistory();
      const bg = getBackground(bgId);
      set({ equippedBgId: bgId });
      get().notify(`🌌 Фон «${bg.name}» активирован`, 'success');
    },

    setPetColorOverride(c) {
      get().recordHistory();
      set({ petColorOverride: c });
    },

    setGradientDirection(d) {
      get().recordHistory();
      set({ gradientDirection: d });
    },

    setPetMorph(m) { set({ petMorph: m }); },

    buyAura(auraId) {
      const { coins, ownedAuras } = get();
      const aura = getAura(auraId);
      if (ownedAuras.includes(auraId)) { get().equipAura(auraId); return; }
      if (coins < aura.price) { get().notify('Недостаточно монет 🪙', 'error'); return; }
      set(s => ({ coins: s.coins - aura.price, ownedAuras: [...s.ownedAuras, auraId] }));
      get().notify(`💫 Аура «${aura.name}» куплена!`, 'coins');
      get().equipAura(auraId);
    },

    equipAura(auraId) {
      get().recordHistory();
      const aura = getAura(auraId);
      set({ equippedAuraId: auraId });
      if (auraId !== 'none') get().notify(`💫 Аура «${aura.name}» активирована`, 'success');
    },

    setAccessory(slot, id) {
      get().recordHistory();
      set(s => ({ equippedAccessories: { ...s.equippedAccessories, [slot]: id } }));
    },
    setAccessoryConfig(slot, config) {
      set(s => ({ accessoryConfigs: { ...s.accessoryConfigs, [slot]: config } }));
    },

    buyAccessory(id) {
      const { coins, ownedAccessoriesList } = get();
      const acc = (['head','face','back','neck','clothing'] as const)
        .flatMap(s => getAccessoriesBySlot(s))
        .find(a => a.id === id);
      
      if (!acc) return;
      if (ownedAccessoriesList.includes(id)) return;
      if (coins < acc.price) { get().notify('Недостаточно монет 🪙', 'error'); return; }

      set(s => ({ 
        coins: s.coins - acc.price, 
        ownedAccessoriesList: [...s.ownedAccessoriesList, id] 
      }));
      get().notify(`🕶️ «${acc.name}» куплен!`, 'coins');
    },

    setEyeStyleOverride(s) { get().recordHistory(); set({ eyeStyleOverride: s }); },
    setEyeColorOverride(c) { set({ eyeColorOverride: c }); },
    setOverlayOverride(s) { get().recordHistory(); set({ overlayOverride: s }); },
    setRoomCustomization(partial) {
      set(s => {
        const next = stripBase64FromCustomization({ ...s.roomCustomization, ...partial });
        localStorage.setItem('roomCustomization', JSON.stringify(next));
        return { roomCustomization: next };
      });
    },
    resetRoomCustomization() {
      localStorage.setItem('roomCustomization', JSON.stringify(DEFAULT_ROOM_CUSTOMIZATION));
      set({ roomCustomization: DEFAULT_ROOM_CUSTOMIZATION });
    },
    addRoomLight(light) {
      const newLight: RoomLight = { ...light, id: `light_${Date.now()}` };
      get().setRoomCustomization({ roomLights: [...get().roomCustomization.roomLights, newLight] });
    },
    updateRoomLight(id, changes) {
      const lights = get().roomCustomization.roomLights.map(l => l.id === id ? { ...l, ...changes } : l);
      get().setRoomCustomization({ roomLights: lights });
    },
    removeRoomLight(id) {
      const lights = get().roomCustomization.roomLights.filter(l => l.id !== id);
      get().setRoomCustomization({ roomLights: lights });
    },

    // ── Room Furniture ─────────────────────────────────────────────────────

    addRoomFurniture(itemId) {
      const { placedFurniture, roomCustomization } = get();
      const def = getFurniture(itemId);
      if (!def) return;
      // Spread new items so they don't all pile up at center
      const spread = (placedFurniture.length % 5) * 8 - 16;
      const newItem: PlacedFurnitureItem = {
        uid: Date.now().toString(),
        itemId,
        x: 50 + spread,
        y: def.onWall ? 25 + (placedFurniture.length % 3) * 8 : 65 + (placedFurniture.length % 3) * 6,
        scale: def.defaultScale,
        flipped: false,
        zIndex: placedFurniture.length + 1,
        locked: false,
        rotation: 0,
        tiltX: 0,
        tiltY: 0,
        hue: 0,
        isOn: true,
      };
      const next = [...placedFurniture, newItem];
      persistRoom(roomCustomization, next);
      set({ placedFurniture: next });
    },

    duplicateRoomFurniture(uid) {
      const source = get().placedFurniture.find(p => p.uid === uid);
      if (!source) return null;
      const newUid = `placed_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const copy: PlacedFurnitureItem = {
        ...source,
        uid: newUid,
        x: Math.min(97, source.x + 4),
        y: Math.min(97, source.y + 4),
        locked: false,
        imageUrl: undefined, // don't share IDB image ref
      };
      set(s => {
        const next = [...s.placedFurniture, copy];
        persistRoom(s.roomCustomization, next);
        return { placedFurniture: next };
      });
      return newUid;
    },

    removeRoomFurniture(uid) {
      set(s => {
        const next = s.placedFurniture.filter(p => p.uid !== uid);
        persistRoom(s.roomCustomization, next);
        return { placedFurniture: next };
      });
    },

    updateRoomFurniture(uid, changes) {
      set(s => {
        const next = s.placedFurniture.map(p => p.uid === uid ? { ...p, ...changes } : p);
        persistRoom(s.roomCustomization, next);
        return { placedFurniture: next };
      });
    },

    buyRoomFurniture(itemId) {
      const { coins, ownedFurnitureIds } = get();
      const def = getFurniture(itemId);
      if (!def) return;
      if (ownedFurnitureIds.includes(itemId)) {
        get().addRoomFurniture(itemId);
        return;
      }
      if (coins < def.price) { get().notify('Недостаточно монет 🪙', 'error'); return; }
      const nextOwned = [...ownedFurnitureIds, itemId];
      localStorage.setItem('ownedFurnitureIds', JSON.stringify(nextOwned));
      set(s => ({
        coins: s.coins - def.price,
        ownedFurnitureIds: nextOwned,
      }));
      get().notify(`🛋️ «${def.name}» куплено!`, 'coins');
      get().addRoomFurniture(itemId);
    },

    clearRoomFurniture() {
      persistRoom(get().roomCustomization, []);
      set({ placedFurniture: [] });
    },

    // ── Notifications ──────────────────────────────────────────────────────

    notify(message, type) {
      const id = ++notifId;
      set(s => ({ notifications: [...s.notifications.slice(-4), { id, message, type }] }));
      setTimeout(() => get().dismissNotification(id), 4500);
    },
    dismissNotification(id) {
      set(s => ({ notifications: s.notifications.filter(n => n.id !== id) }));
    },

    // ── Derived ────────────────────────────────────────────────────────────

    unclaimedAchievements: () => get().achievements.filter(a => a.unlocked && !a.claimed).length,
    completedUnclaimedQuests: () => get().quests.filter(q => q.completed && !q.claimed).length,
  };
});
