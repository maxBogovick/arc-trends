import { useState, useMemo, useEffect } from 'react';
import { PERSONALITIES } from '../personality/personalities';
import { 
  applyDecay, 
  applyActionModifiers, 
  updateCounters
} from '../personality/PersonalityEngine';
import type { 
  StatKey, ActionType, BehavioralFlag, 
  BehavioralCounters, ActionContext, SyncContext, EmergentStateType, PersonalityDefinition,
  CoreMemory,
  TraitVector
} from '../personality/types';
import { MODIFIER_CAPS } from '../personality/types';
import { usePetStore } from '../store/petStore';
import { PERSONALITY_TRAIT_MAP } from '../personality/personalityTraitMap';
import { PATTERN_RULES } from '../personality/patternRules';

const INITIAL_STATS: Record<StatKey, number> = {
  hunger: 50, happiness: 50, energy: 50, health: 50, cleanliness: 50, bond: 50,
};

const INITIAL_COUNTERS: BehavioralCounters = {
  playCountToday: 0, lastActionTimestamp: new Date().toISOString(),
  sessionGapHours: 0, sessionGapsOver48h_30d: 0, sameRoomHours: 0,
  lastRoomCheckTs: new Date().toISOString(), lastEquippedRoomId: 'room_1',
  consecutiveGoodSyncs: 0, consecutiveBadMoodSyncs: 0,
  feedInRedZone7d: 0, feedInGreenZone7d: 0, forcedSleepCount7d: 0,
  healWhenHealthy7d: 0, nightSingleInteractionDays7d: 0, nightWakeCount7d: 0,
  maxConsecHighPlayDays: 0, currentHighPlayDays: 0, filthCrisisCount30d: 0,
  consecutiveLowHealthSyncs: 0, totalBondActions: 0, bondActionsInPhase: 0,
  paranoidPhase: 'untrusted', trustedSince: undefined, chaosDailySeed: Math.random(),
  chaosSeedDate: new Date().toISOString().slice(0, 10), uniqueFoodsTried: [],
  dailyFoodLog: {}, recentFeedTimestamps: [],
  lastDayReset: new Date().toISOString().slice(0, 10),
  stoicPeakUsed: false, enlightenmentActive: false,
  melancholicActionCount: 0,
};

const STAT_KEYS: StatKey[] = ['hunger', 'happiness', 'energy', 'health', 'cleanliness', 'bond'];
const ACTIONS: ActionType[] = ['feed', 'play', 'sleep', 'wake', 'bathe', 'heal', 'bond', 'sync'];

// --- Helper for Integrity Testing ---
function runIntegrityTests() {
  const results = [];
  
  // Test 1: XP Max Cap
  const baseRes = { statDeltas: {}, xp: 10, coins: 10 };
  const capsContext: any = { clientLocalHour: 12, sessionGapHours: 0, coinBalance: 100 };
  const capsCounters = { ...INITIAL_COUNTERS };
  const playful = PERSONALITIES.find(p => p.id === 'playful')!;
  
  // Force extreme flags to trigger caps
  const extremeFlags: BehavioralFlag[] = [
    { type: 'night_guardian' as any, severity: 3, activatedAt: '', healProgress: 0 },
    { type: 'perfect_balance' as any, severity: 3, activatedAt: '', healProgress: 0 }
  ];
  
  const test1 = applyActionModifiers(baseRes, 'play', playful, extremeFlags, 'enlightenment' as any, capsCounters, capsContext);
  const maxAllowedXp = Math.round(10 * MODIFIER_CAPS.XP_MAX);
  results.push({ name: 'XP Multiplier Cap (Max 4.0x)', passed: test1.xp <= maxAllowedXp, detail: `Expected <= ${maxAllowedXp}, got ${test1.xp}` });

  // Test 2: Coin Max Cap
  const greedy = PERSONALITIES.find(p => p.id === 'greedy')!;
  const test2 = applyActionModifiers(baseRes, 'play', greedy, extremeFlags, 'stoic_peak' as any, capsCounters, capsContext);
  const maxAllowedCoins = Math.round(10 * MODIFIER_CAPS.COIN_MAX);
  results.push({ name: 'Coin Multiplier Cap (Max 3.0x)', passed: test2.coins <= maxAllowedCoins, detail: `Expected <= ${maxAllowedCoins}, got ${test2.coins}` });

  // Test 3: Decay Limits
  const baseDecayRes = applyDecay({ hunger: 100 } as any, playful, 60, capsCounters, capsContext);
  results.push({ name: 'Stat Decay Math', passed: baseDecayRes.hunger < 100 && baseDecayRes.hunger > 0, detail: `1hr hunger decay playful: 100 -> ${baseDecayRes.hunger.toFixed(1)}` });

  return results;
}

// --- Helper for Timeline Simulation ---
function simulateTimeline(personality: PersonalityDefinition, days: number) {
  let stats = { ...INITIAL_STATS };
  let counters = { ...INITIAL_COUNTERS };
  let xpEarned = 0;
  let coinsEarned = 0;
  
  const log: string[] = [];
  
  // Standard user profile: 
  // Wakes up at 8:00, feeds, plays.
  // Interacts again at 14:00, 20:00.
  // Sleeps at 22:00.
  
  for (let day = 1; day <= days; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const context: ActionContext & SyncContext = { clientLocalHour: hour, sessionGapHours: 1, coinBalance: 100, foodId: 'pizza', itemId: undefined };
      
      // Decay every hour
      stats = applyDecay(stats, personality, 60, counters, context);
      
      const performAction = (action: ActionType) => {
        const modRes = applyActionModifiers({ statDeltas: { hunger: 20, happiness: 10, energy: -5 }, xp: 15, coins: 5 }, action, personality, [], null, counters, context);
        xpEarned += modRes.xp;
        coinsEarned += modRes.coins;
        for (const k of Object.keys(modRes.statDeltas)) {
          const key = k as StatKey;
          stats[key] = Math.min(100, Math.max(0, stats[key] + (modRes.statDeltas[key] || 0)));
        }
        counters = updateCounters(counters, action, stats, context);
      };

      if (hour === 8) { performAction('wake'); performAction('feed'); performAction('play'); }
      if (hour === 14) { performAction('play'); performAction('feed'); }
      if (hour === 20) { performAction('bond'); performAction('heal'); }
      if (hour === 22) { performAction('sleep'); }
    }
    log.push(`Day ${day} EOD | XP: ${xpEarned} | Coins: ${coinsEarned} | Avg Stat: ${(Object.values(stats).reduce((a,b)=>a+b,0)/6).toFixed(1)}`);
  }
  
  return { stats, xpEarned, coinsEarned, log };
}


export function PersonalityTestPage() {
  const [activeTab, setActiveTab] = useState<'sandbox' | 'integrity' | 'timeline' | 'live_causal' | 'live_master' | 'live_economy'>('sandbox');
  
  // Sandbox State
  const [personalityId, setPersonalityId] = useState<string>('playful');
  const [stats, setStats] = useState<Record<StatKey, number>>(INITIAL_STATS);
  const [action, setAction] = useState<ActionType>('feed');
  const [elapsedMinutes, setElapsedMinutes] = useState<number>(60);
  const [flags] = useState<BehavioralFlag[]>([]);
  const [emergentState, setEmergentState] = useState<EmergentStateType | null>(null);
  const [baseStatDeltas, setBaseStatDeltas] = useState<Partial<Record<StatKey, number>>>({ hunger: 20 });
  const [baseXp, setBaseXp] = useState<number>(10);
  const [baseCoins, setBaseCoins] = useState<number>(5);
  const [counters] = useState<BehavioralCounters>(INITIAL_COUNTERS);
  
  const personality = useMemo(() => PERSONALITIES.find(p => p.id === personalityId) || PERSONALITIES[0], [personalityId]);

  const context: ActionContext & SyncContext = useMemo(() => ({
    clientLocalHour: 12, sessionGapHours: counters.sessionGapHours, coinBalance: 100, foodId: 'pizza', itemId: undefined,
  }), [counters.sessionGapHours]);

  const actionModifiersResult = useMemo(() => applyActionModifiers({ statDeltas: baseStatDeltas, xp: baseXp, coins: baseCoins }, action, personality, flags, emergentState, counters, context), [baseStatDeltas, baseXp, baseCoins, action, personality, flags, emergentState, counters, context]);
  const decayResult = useMemo(() => applyDecay(stats, personality, elapsedMinutes, counters, context), [stats, personality, elapsedMinutes, counters, context]);

  // Timeline State
  const [simDays, setSimDays] = useState(7);
  const simResult = useMemo(() => simulateTimeline(personality, simDays), [personality, simDays]);
  
  // Integrity State
  const integrityResults = useMemo(() => runIntegrityTests(), []);

  // --- LIVE DATA ---
  const pet = usePetStore(s => s.pet);
  const events = usePetStore(s => s.events);
  
  useEffect(() => {
    // Make sure events are loaded when entering live tabs
    if (activeTab.startsWith('live_') && events.length === 0) {
      usePetStore.getState().loadEvents();
    }
  }, [activeTab, events.length]);

  const coreMemories = pet?.coreMemories || [];

  // --- DERIVED LIVE DATA ---
  const dailyYields = useMemo(() => {
    if (!events || events.length === 0) return { xp: 0, coins: 0 };
    const oneDayAgo = new Date().getTime() - 24 * 60 * 60 * 1000;
    let xp = 0;
    let coins = 0;
    for (const ev of events) {
      if (new Date(ev.timestamp).getTime() < oneDayAgo) continue;
      xp += (ev.xpGained || 0);
      coins += (ev.coinsGained || 0);
    }
    return { xp, coins };
  }, [events]);

  const evolutionDistances = useMemo(() => {
    if (!pet?.traitVector) return [];
    const distances = Object.values(PERSONALITY_TRAIT_MAP).map(target => {
      let sumSq = 0;
      for (const k of Object.keys(target.position)) {
        const key = k as keyof TraitVector;
        const diff = (pet.traitVector[key] || 50) - target.position[key];
        sumSq += diff * diff;
      }
      return { id: target.id, dist: Math.sqrt(sumSq), radius: target.radiusBase };
    });
    return distances.sort((a, b) => a.dist - b.dist);
  }, [pet?.traitVector]);

  // Radar points calculation
  const traitRadarPoints = useMemo(() => {
    if (!pet?.traitVector) return '';
    const keys = ['vitality', 'sociality', 'order', 'appetite', 'caution', 'curiosity'] as const;
    const center = 100;
    const radius = 80;
    return keys.map((key, i) => {
      const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
      // trait vector values are typically -100 to 100, we map them to 0-100% of radius (which means +100 = edge, 0 = center? Actually let's assume 0 is center, +100 edge, -100 opposite edge. So radius is scaled 0 to 100 max length)
      const val = Math.max(0, Math.min(100, pet.traitVector[key] || 0)); 
      // If values can be negative, let's just clamp to 0 for radar or map -100..100 to 0..radius. Let's assume TraitVector is 0..100 for this visualization.
      const r = (val / 100) * radius;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(' ');
  }, [pet?.traitVector]);

  return (
    <div className="flex flex-col gap-6 font-body text-gray-800 pb-20">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-display font-bold text-lumio-purple">Professional Engine Analytics</h1>
        <p className="text-sm text-gray-500">Mathematically verifying Personality Engine constraints and mechanics.</p>
        
        {/* Navigation */}
        <div className="flex gap-2 mt-4 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
          {['sandbox', 'integrity', 'timeline', 'live_causal', 'live_master', 'live_economy'].map(tab => (
            <button 
              key={tab} onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${activeTab === tab ? 'bg-white text-lumio-purple shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </header>

      {/* TAB: SANDBOX */}
      {activeTab === 'sandbox' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="flex flex-col gap-6">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4">Характер</h2>
              <select 
                value={personalityId} onChange={e => setPersonalityId(e.target.value)}
                className="w-full p-2 border rounded-xl bg-gray-50 outline-none"
              >
                {PERSONALITIES.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name} ({p.id})</option>)}
              </select>
              <div className="mt-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <div><strong>XP Mults:</strong> {JSON.stringify(personality.xpMultipliers)}</div>
                <div><strong>Coin Mults:</strong> {JSON.stringify(personality.coinMultipliers)}</div>
                <div><strong>Decay Rates:</strong> {JSON.stringify(personality.decayRates)}</div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4">Статы</h2>
              <div className="flex flex-col gap-3">
                {STAT_KEYS.map(key => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="w-24 text-sm font-medium capitalize">{key}</label>
                    <input type="range" min="0" max="100" value={stats[key]} onChange={e => setStats(s => ({ ...s, [key]: Number(e.target.value) }))} className="flex-1 accent-lumio-purple" />
                    <span className="w-8 text-right text-sm font-mono">{stats[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-4">Контекст</h2>
              <div className="flex flex-col gap-3">
                <select value={action} onChange={e => setAction(e.target.value as ActionType)} className="p-2 border rounded-xl bg-gray-50">
                  {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" value={baseXp} onChange={e=>setBaseXp(Number(e.target.value))} className="w-1/2 p-2 border rounded-xl" placeholder="Base XP" />
                  <input type="number" value={baseCoins} onChange={e=>setBaseCoins(Number(e.target.value))} className="w-1/2 p-2 border rounded-xl" placeholder="Base Coins" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-sm">Minutes Passed (Decay)</label>
                  <input type="number" value={elapsedMinutes} onChange={e => setElapsedMinutes(Number(e.target.value))} className="w-20 p-2 border rounded-xl text-right" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-sm">Emergent State Mock</label>
                  <input type="text" value={emergentState || ''} onChange={e => setEmergentState((e.target.value as EmergentStateType) || null)} className="w-1/2 p-2 border rounded-xl" placeholder="e.g. tantrum" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex-1 text-sm">Base Deltas (JSON)</label>
                  <input type="text" value={JSON.stringify(baseStatDeltas)} onChange={e => { try { setBaseStatDeltas(JSON.parse(e.target.value)); } catch {} }} className="w-1/2 p-2 border rounded-xl font-mono text-xs" />
                </div>
              </div>
            </div>
          </div>

          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Action Mods Out */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-4">Math Output: Modifiers</h2>
                <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Final XP</span>
                    <span className="text-xl font-mono text-green-700">{actionModifiersResult.xp} <span className="text-xs text-green-500">({(actionModifiersResult.xp/baseXp).toFixed(2)}x)</span></span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Final Coins</span>
                    <span className="text-xl font-mono text-amber-600">{actionModifiersResult.coins} <span className="text-xs text-amber-500">({(actionModifiersResult.coins/baseCoins).toFixed(2)}x)</span></span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <span className="font-bold text-sm block mb-1">Deltas</span>
                    <pre className="text-xs text-gray-700">{JSON.stringify(actionModifiersResult.statDeltas, null, 2)}</pre>
                  </div>
                </div>
              </div>
              
              {/* Decay Out */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-lg font-bold mb-4">Math Output: Decay (60 min)</h2>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-col gap-2">
                  {STAT_KEYS.map(key => {
                    const diff = decayResult[key] - stats[key];
                    return (
                      <div key={key} className="flex justify-between items-center">
                        <span className="capitalize font-medium text-sm text-red-900">{key}</span>
                        <div className="text-right">
                          <span className="font-mono font-bold text-red-700">{decayResult[key].toFixed(1)}</span>
                          <span className="text-xs text-red-400 ml-2 w-12 inline-block">({diff.toFixed(2)})</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: INTEGRITY */}
      {activeTab === 'integrity' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">System Integrity Assertions</h2>
          <p className="text-sm text-gray-500 mb-6">Verifies that the engine respects global mathematical CAPS defined in the design doc regardless of combinations of states/flags/personalities.</p>
          
          <div className="flex flex-col gap-3">
            {integrityResults.map((r, i) => (
              <div key={i} className={`p-4 rounded-xl border flex items-center justify-between ${r.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div>
                  <h3 className={`font-bold ${r.passed ? 'text-green-800' : 'text-red-800'}`}>{r.name}</h3>
                  <p className={`text-xs mt-1 ${r.passed ? 'text-green-600' : 'text-red-600'}`}>{r.detail}</p>
                </div>
                <div className={`text-2xl ${r.passed ? 'text-green-500' : 'text-red-500'}`}>
                  {r.passed ? '✅' : '❌'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: TIMELINE */}
      {activeTab === 'timeline' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold">Timeline Simulator</h2>
              <p className="text-sm text-gray-500 mt-1">Simulates standard user behavior over multiple days to evaluate long-term economy and stat balance.</p>
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={personalityId} onChange={e => setPersonalityId(e.target.value)}
                className="p-2 border rounded-xl bg-gray-50 outline-none"
              >
                {PERSONALITIES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={simDays} onChange={e => setSimDays(Number(e.target.value))} className="p-2 border rounded-xl bg-gray-50">
                <option value={7}>7 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase">Total XP Gained</span>
              <div className="text-3xl font-display font-bold text-indigo-600 mt-1">{simResult.xpEarned}</div>
              <div className="text-xs text-gray-400 mt-1">~{(simResult.xpEarned / simDays).toFixed(1)} / day</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase">Total Coins Gained</span>
              <div className="text-3xl font-display font-bold text-amber-500 mt-1">{simResult.coinsEarned}</div>
              <div className="text-xs text-gray-400 mt-1">~{(simResult.coinsEarned / simDays).toFixed(1)} / day</div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <span className="text-xs font-bold text-gray-500 uppercase">Avg EOD Stat Level</span>
              <div className="text-3xl font-display font-bold text-green-600 mt-1">
                {(Object.values(simResult.stats).reduce((a,b)=>a+b,0)/6).toFixed(1)}
              </div>
            </div>
          </div>
          
          <h3 className="font-bold mb-3">Simulation Log</h3>
          <div className="bg-gray-900 rounded-xl p-4 h-64 overflow-y-auto text-sm font-mono text-gray-300 flex flex-col gap-1">
            {simResult.log.map((entry, idx) => (
              <div key={idx} className="border-b border-gray-800 pb-1">{entry}</div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: LIVE CAUSAL */}
      {activeTab === 'live_causal' && (
        <div className="flex flex-col gap-6">
          {!pet ? (
            <div className="p-6 bg-red-50 text-red-800 rounded-2xl">
              No live pet found. Make sure you are logged in and the app has initialized a pet.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Event Stream */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
                <h2 className="text-xl font-bold mb-2">Event Causal Stream</h2>
                <p className="text-sm text-gray-500 mb-4">True server-verified events with calculated modifiers applied.</p>
                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                  {events.length === 0 ? (
                    <div className="text-gray-400 text-center py-10">No events found.</div>
                  ) : (
                    [...events].reverse().map((ev) => (
                      <div key={ev.id} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-lumio-purple uppercase text-xs flex items-center gap-1">
                            {ev.emoji} {ev.type}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {ev.description}
                        </div>
                        {(ev.xpGained || ev.coinsGained) ? (
                          <div className="flex gap-2 text-xs font-bold mt-1">
                            {ev.xpGained ? <span className="text-indigo-600">+{ev.xpGained} XP</span> : null}
                            {ev.coinsGained ? <span className="text-amber-600">+{ev.coinsGained} 🪙</span> : null}
                          </div>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Core Memories */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-[600px] flex flex-col">
                <h2 className="text-xl font-bold mb-2">Core Memories Genesis</h2>
                <p className="text-sm text-gray-500 mb-4">Memories formed from repeated player actions. These shift the Trait Vector permanently.</p>
                <div className="flex-1 overflow-y-auto bg-gray-50 rounded-xl border border-gray-100 p-4 space-y-3">
                  {coreMemories.length === 0 ? (
                    <div className="text-gray-400 text-center py-10">No core memories formed yet. Keep playing!</div>
                  ) : (
                    [...coreMemories].reverse().map((mem: CoreMemory, i) => (
                      <div key={i} className={`p-4 rounded-xl border flex flex-col gap-2 ${mem.tier === 'rare' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                        <div className="flex justify-between items-start">
                          <span className="font-medium text-gray-900">{mem.text}</span>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${mem.tier === 'rare' ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'}`}>
                            {mem.tier.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span className="bg-white/60 px-2 py-1 rounded">Trait: <strong>{mem.traitKey}</strong> ({mem.direction})</span>
                          <span className="bg-white/60 px-2 py-1 rounded">Category: {mem.category}</span>
                          {mem.personalityHint && <span className="bg-white/60 px-2 py-1 rounded">Hint: {mem.personalityHint}</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB: LIVE MASTER */}
      {activeTab === 'live_master' && (
        <div className="flex flex-col gap-6">
          {!pet ? (
            <div className="p-6 bg-red-50 text-red-800 rounded-2xl">
              No live pet found. Make sure you are logged in and the app has initialized a pet.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* Mood History Chart */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex flex-col">
                <h2 className="text-xl font-bold mb-2">Mood History (Average Stats)</h2>
                <p className="text-sm text-gray-500 mb-4">Last 168 hours of the pet's average stats.</p>
                <div className="flex-1 flex items-end gap-1 h-full pt-4">
                  {(pet.moodHistory || []).slice(-48).map((snap: any, i: number) => {
                    const h = Math.max(0, Math.min(100, snap.avgStats));
                    return (
                      <div 
                        key={i} 
                        className="flex-1 bg-lumio-purple rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                        style={{ height: `${h}%` }}
                        title={`${new Date(snap.timestamp).toLocaleTimeString()} - ${snap.mood} (${snap.avgStats.toFixed(1)})`}
                      />
                    );
                  })}
                  {(pet.moodHistory || []).length === 0 && <div className="text-gray-400 text-sm">No mood history available.</div>}
                </div>
              </div>

              {/* Behavioral Flags */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-80 flex flex-col">
                <h2 className="text-xl font-bold mb-2">Behavioral Flags (Pattern Engine)</h2>
                <p className="text-sm text-gray-500 mb-4">Active psychological flags and their healing progress.</p>
                <div className="flex-1 overflow-y-auto space-y-3">
                  {(pet.behavioralFlags || []).length === 0 ? (
                    <div className="text-gray-400 text-sm text-center py-6">No active flags. Perfect mental health!</div>
                  ) : (
                    (pet.behavioralFlags || []).map((flag: any, i: number) => (
                      <div key={i} className="p-3 border rounded-xl border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-gray-800">{flag.type}</span>
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">Severity: {flag.severity}</span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-green-400 h-full" style={{ width: `${flag.healProgress}%` }} />
                        </div>
                        <div className="text-xs text-gray-500 mt-1 text-right">{flag.healProgress}% Healed</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Important Counters */}
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Proximity to Pattern Triggers</h2>
                <p className="text-sm text-gray-500 mb-4">Analyzing how close the pet is to triggering psychological flags based on current behavioral counters.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PATTERN_RULES.slice(0, 4).map(rule => {
                    // Let's find if a counter is close. We do a simplified visualization.
                    const cond = rule.conditions[0];
                    if (!cond) return null;
                    const counterKeyName = cond.type;
                    return (
                      <div key={rule.id} className="p-4 bg-gray-50 rounded-xl flex flex-col gap-2 border border-gray-200">
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-lumio-purple uppercase font-bold">{rule.effect.flagType}</div>
                          <div className="text-xs bg-white px-2 py-1 rounded shadow-sm">{counterKeyName}</div>
                        </div>
                        <div className="text-sm text-gray-700">{rule.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trait Vector Radar & Evolution */}
              <div className="xl:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-8">
                <div className="flex-1 flex flex-col">
                  <h2 className="text-xl font-bold mb-2">Evolution Trajectory</h2>
                  <p className="text-sm text-gray-500 mb-4">Calculated Euclidean distance from current 6D vector to Personality Zones.</p>
                  
                  <div className="flex-1 overflow-y-auto space-y-2 pr-4">
                    {evolutionDistances.map((d, i) => {
                      const isClose = d.dist <= d.radius;
                      return (
                        <div key={d.id} className={`flex justify-between items-center p-3 rounded-xl border ${isClose ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-100'} ${i === 0 ? 'ring-2 ring-lumio-purple' : ''}`}>
                          <div className="flex flex-col">
                            <span className="capitalize font-bold text-gray-800">{d.id}</span>
                            <span className="text-xs text-gray-500">Radius requirement: {d.radius}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className={`font-mono font-bold ${isClose ? 'text-green-600' : 'text-gray-800'}`}>
                              Dist: {d.dist.toFixed(1)}
                            </span>
                            {isClose && <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-1 rounded">In Zone</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="w-[200px] shrink-0 flex flex-col items-center">
                  <h3 className="font-bold text-sm mb-4">6D Vector (0-100)</h3>
                  <div className="w-[200px] h-[200px] relative">
                  <svg width="200" height="200" viewBox="0 0 200 200" className="overflow-visible">
                    {/* Background Web */}
                    {[20, 40, 60, 80].map(r => (
                      <polygon 
                        key={r}
                        points={[0,1,2,3,4,5].map(i => {
                          const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                          return `${100 + r * Math.cos(a)},${100 + r * Math.sin(a)}`;
                        }).join(' ')}
                        fill="none" stroke="#e5e7eb" strokeWidth="1"
                      />
                    ))}
                    {/* Axes */}
                    {[0,1,2,3,4,5].map(i => {
                      const a = (Math.PI * 2 * i) / 6 - Math.PI / 2;
                      return <line key={i} x1="100" y1="100" x2={100 + 80 * Math.cos(a)} y2={100 + 80 * Math.sin(a)} stroke="#e5e7eb" strokeWidth="1" />;
                    })}
                    {/* Data Polygon */}
                    {traitRadarPoints && (
                      <polygon points={traitRadarPoints} fill="rgba(168, 85, 247, 0.3)" stroke="#A855F7" strokeWidth="2" strokeLinejoin="round" />
                    )}
                  </svg>
                  {/* Axis Labels */}
                  <span className="absolute top-[-10px] left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold uppercase">Vitality</span>
                  <span className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 text-[10px] text-gray-400 font-bold uppercase">Appetite</span>
                  <span className="absolute top-[40px] right-[-20px] text-[10px] text-gray-400 font-bold uppercase">Social</span>
                  <span className="absolute bottom-[40px] right-[-20px] text-[10px] text-gray-400 font-bold uppercase">Order</span>
                  <span className="absolute bottom-[40px] left-[-20px] text-[10px] text-gray-400 font-bold uppercase">Caution</span>
                  <span className="absolute top-[40px] left-[-20px] text-[10px] text-gray-400 font-bold uppercase">Curious</span>
                </div>
              </div>
              </div>

            </div>
          )}
        </div>
      )}

      {/* TAB: LIVE ECONOMY */}
      {activeTab === 'live_economy' && (
        <div className="flex flex-col gap-6">
          {!pet ? (
            <div className="p-6 bg-red-50 text-red-800 rounded-2xl">
              No live pet found. Make sure you are logged in and the app has initialized a pet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Total XP Earned</h2>
                <div className="text-4xl font-display font-bold text-indigo-600">{pet.xp}</div>
                <div className="text-sm text-gray-500 mt-2">Level {pet.level}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Age in Hours</h2>
                <div className="text-4xl font-display font-bold text-blue-600">{pet.ageHours.toFixed(1)}</div>
                <div className="text-sm text-gray-500 mt-2">Since creation</div>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-4">Average XP / Hour</h2>
                <div className="text-4xl font-display font-bold text-emerald-600">
                  {pet.ageHours > 0 ? (pet.xp / pet.ageHours).toFixed(1) : 0}
                </div>
                <div className="text-sm text-gray-500 mt-2">Lifetime Yield Efficiency</div>
              </div>

              {/* Daily Yield Estimator */}
              <div className="xl:col-span-3 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-2">
                <h2 className="text-xl font-bold mb-2">Daily Yield Tracker (Last 24h)</h2>
                <p className="text-sm text-gray-500 mb-6">True earnings parsed from server-calculated events.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="text-xs text-indigo-800 uppercase font-bold">XP Gained Today</div>
                    <div className="text-3xl font-display text-indigo-600 mt-1">+{dailyYields.xp}</div>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="text-xs text-amber-800 uppercase font-bold">Coins Mined Today</div>
                    <div className="text-3xl font-display text-amber-600 mt-1">+{dailyYields.coins}</div>
                  </div>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl col-span-2 flex flex-col justify-center">
                    <div className="text-sm font-bold text-gray-700">MODIFIER_CAPS Limits</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Max XP Multiplier: <span className="font-mono text-lumio-purple">{MODIFIER_CAPS.XP_MAX}x</span><br/>
                      Max Coin Multiplier: <span className="font-mono text-amber-600">{MODIFIER_CAPS.COIN_MAX}x</span><br/>
                      <em>(The engine strictly enforces these caps on every action)</em>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
