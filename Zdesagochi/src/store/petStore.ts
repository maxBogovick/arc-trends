import { create } from 'zustand';
import {
  createApiService, MockApiService,
  type ApiMode, type Pet, type FoodItem, type ShopItem, type InventoryItem,
  type Achievement, type DailyQuest, type Room, type LeaderboardEntry, type PetEvent,
} from '../api';
import { getSkin, SKINS } from '../data/skins';
import { type BodyShapeId } from '../data/bodyShapes';
import { BACKGROUNDS, getBackground } from '../data/backgrounds';
import { getAura } from '../data/auras';

export type TabId = 'home' | 'shop' | 'inventory' | 'quests' | 'achievements' | 'leaderboard' | 'skins' | 'editor';

interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'xp' | 'coins';
}

interface PetStore {
  pet: Pet | null;
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
  ownedSkins: string[];
  equippedSkinId: string;
  equippedBodyId: BodyShapeId;
  equippedBgId: string;
  ownedBgs: string[];
  petColorOverride: { body1: string; body2: string; glow: string; cheek: string } | null;
  petMorph: { scale: number; width: number; height: number };
  equippedAuraId: string;
  ownedAuras: string[];
  equippedAccessories: { head: string; face: string; back: string };
  accessoryConfigs: {
    head: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    face: { scale: number; x: number; y: number; rotation: number; behind: boolean };
    back: { scale: number; x: number; y: number; rotation: number; behind: boolean };
  };
  eyeStyleOverride: string | null;
  overlayOverride: string | null;

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
  equipBody(shapeId: BodyShapeId): void;
  buyBg(bgId: string): void;
  equipBg(bgId: string): void;
  setPetColorOverride(c: { body1: string; body2: string; glow: string; cheek: string } | null): void;
  setPetMorph(m: { scale: number; width: number; height: number }): void;
  buyAura(auraId: string): void;
  equipAura(auraId: string): void;
  setAccessory(slot: 'head' | 'face' | 'back', id: string): void;
  setAccessoryConfig(slot: 'head' | 'face' | 'back', config: { scale: number; x: number; y: number; rotation: number; behind: boolean }): void;
  setEyeStyleOverride(s: string | null): void;
  setOverlayOverride(s: string | null): void;

  loadPet(): Promise<void>;
  feedPet(foodId: string): Promise<void>;
  playWithPet(): Promise<{ score: number; xpGained: number; coinsGained: number; message: string } | null>;
  sleepPet(): Promise<void>;
  wakePet(): Promise<void>;
  bathePet(): Promise<void>;
  healPet(): Promise<void>;
  bondWithPet(): Promise<void>;
  syncPet(): Promise<void>;
  updatePetName(name: string): Promise<void>;
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

  unclaimedAchievements(): number;
  completedUnclaimedQuests(): number;
}

let notifId = 0;

export const usePetStore = create<PetStore>((set, get) => {
  const api = () => createApiService(get().apiMode, get().apiBaseUrl);

  async function action(key: string, fn: () => Promise<void>) {
    set({ actionLoading: key });
    try { await fn(); }
    catch (e) { get().notify((e as Error).message, 'error'); }
    finally { set({ actionLoading: null }); }
  }

  return {
    pet: null, coins: 0, isLoading: false, actionLoading: null, activeTab: 'home',
    foods: [], shopItems: [], inventory: [], achievements: [], quests: [],
    rooms: [], leaderboard: [], events: [],
    apiMode: 'mock', apiBaseUrl: 'http://localhost:3000',
    notifications: [],
    ownedSkins: SKINS.filter(s => s.price === 0).map(s => s.id),
    equippedSkinId: 'default',
    equippedBodyId: 'blob',
    equippedBgId: 'void_dark',
    ownedBgs: BACKGROUNDS.filter(b => b.price === 0).map(b => b.id),
    petColorOverride: null,
    petMorph: { scale: 1, width: 1, height: 1 },
    equippedAuraId: 'none',
    ownedAuras: ['none'],
    equippedAccessories: { head: 'none_head', face: 'none_face', back: 'none_back' },
    accessoryConfigs: {
      head: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
      face: { scale: 1, x: 0, y: 0, rotation: 0, behind: false },
      back: { scale: 1, x: 0, y: 0, rotation: 0, behind: true },
    },
    eyeStyleOverride: null,
    overlayOverride: null,

    petPresets: JSON.parse(localStorage.getItem('petPresets') || '{}'),

    savePreset(name: string) {
      const state = get();
      const preset = {
        equippedSkinId: state.equippedSkinId,
        equippedBodyId: state.equippedBodyId,
        equippedBgId: state.equippedBgId,
        petColorOverride: state.petColorOverride,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
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
        petColorOverride: state.petColorOverride,
        petMorph: state.petMorph,
        equippedAuraId: state.equippedAuraId,
        equippedAccessories: state.equippedAccessories,
        accessoryConfigs: state.accessoryConfigs,
      };
      set({ 
        history: [snapshot, ...state.history].slice(0, 50),
        future: [] 
      });
    },

    undo() {
      const { history, future, recordHistory, ...currentState } = get();
      if (history.length === 0) return;

      const [prev, ...rest] = history;
      const currentSnapshot = {
        equippedSkinId: currentState.equippedSkinId,
        equippedBodyId: currentState.equippedBodyId,
        equippedBgId: currentState.equippedBgId,
        petColorOverride: currentState.petColorOverride,
        petMorph: currentState.petMorph,
        equippedAuraId: currentState.equippedAuraId,
        equippedAccessories: currentState.equippedAccessories,
        accessoryConfigs: currentState.accessoryConfigs,
      };

      set({
        ...prev,
        history: rest,
        future: [currentSnapshot, ...future].slice(0, 50)
      });
      get().notify('Действие отменено', 'info');
    },

    redo() {
      const { history, future, recordHistory, ...currentState } = get();
      if (future.length === 0) return;

      const [next, ...rest] = future;
      const currentSnapshot = {
        equippedSkinId: currentState.equippedSkinId,
        equippedBodyId: currentState.equippedBodyId,
        equippedBgId: currentState.equippedBgId,
        petColorOverride: currentState.petColorOverride,
        petMorph: currentState.petMorph,
        equippedAuraId: currentState.equippedAuraId,
        equippedAccessories: currentState.equippedAccessories,
        accessoryConfigs: currentState.accessoryConfigs,
      };

      set({
        ...next,
        future: rest,
        history: [currentSnapshot, ...history].slice(0, 50)
      });
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

    // ── Pet ────────────────────────────────────────────────────────────────

    async loadPet() {
      set({ isLoading: true });
      try { set({ pet: await api().getPet() }); }
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
    async updatePetName(name) {
      await action('name', async () => {
        const pet = await api().updatePetName(name);
        set({ pet });
        get().notify(`✏️ Имя: «${pet.name}»`, 'success');
      });
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
      get().notify(`🎨 Надет «${skin.name}»`, 'success');
    },

    equipBody(shapeId) {
      get().recordHistory();
      set({ equippedBodyId: shapeId });
    },

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

    setEyeStyleOverride(s) { set({ eyeStyleOverride: s }); },
    setOverlayOverride(s) { set({ overlayOverride: s }); },

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
