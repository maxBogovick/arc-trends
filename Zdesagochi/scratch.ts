import { PERSONALITY_TRAIT_MAP } from './packages/personality-core/src/personalityTraitMap.ts';
import { TRAIT_KEYS } from './packages/personality-core/src/types.ts';

// ISSUE 5: Check inter-personality distances vs combined radii
// To enable evolution between two personalities, the pet needs to:
// 1. Leave current zone (currentDepthAbs >= HYSTERESIS = 8)
// 2. Enter target zone (depth > 0)
// These conditions require the zones to OVERLAP or be very close.

function euclideanDist(a: any, b: any) {
  return Math.sqrt(TRAIT_KEYS.reduce((acc: number, k: string) => acc + (a[k] - b[k]) ** 2, 0));
}

console.log("=== Full pairwise overlap analysis (NEW Euclidean) ===");
console.log("gap < 0 means zones overlap; gap > 0 means gap between zones; need gap <= -(HYSTERESIS=8) for evolution\n");

const ids = Object.keys(PERSONALITY_TRAIT_MAP);
const pairs: { a: string; b: string; dist: number; ra: number; rb: number; gap: number }[] = [];

for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
        const a = PERSONALITY_TRAIT_MAP[ids[i] as any];
        const b = PERSONALITY_TRAIT_MAP[ids[j] as any];
        const dist = euclideanDist(a.position, b.position);
        const gap = dist - a.radiusBase - b.radiusBase;
        pairs.push({ a: ids[i], b: ids[j], dist, ra: a.radiusBase, rb: b.radiusBase, gap });
    }
}
pairs.sort((a, b) => a.gap - b.gap);

console.log("Most connected pairs (gap <= -8: evolution POSSIBLE):");
pairs.filter(p => p.gap <= -8).forEach(p => {
    console.log(`  ${p.a.padEnd(15)} ↔ ${p.b.padEnd(15)}: dist=${p.dist.toFixed(1)}, gap=${p.gap.toFixed(1)} ✓`);
});

console.log("\nBarely reachable pairs (-8 < gap <= 0):"); 
pairs.filter(p => p.gap > -8 && p.gap <= 0).forEach(p => {
    console.log(`  ${p.a.padEnd(15)} ↔ ${p.b.padEnd(15)}: dist=${p.dist.toFixed(1)}, gap=${p.gap.toFixed(1)} ⚠️`);
});

console.log("\nUnreachable pairs (gap > 0, cannot evolve directly):");
pairs.filter(p => p.gap > 0).forEach(p => {
    console.log(`  ${p.a.padEnd(15)} ↔ ${p.b.padEnd(15)}: dist=${p.dist.toFixed(1)}, gap=${p.gap.toFixed(1)} ✗ (needs ${(p.gap+8).toFixed(1)} more overlap)`);
});

// Summary: how many personalities are "stranded" (can evolve to 0 others)?
const reachableFrom: Record<string, string[]> = {};
for (const id of ids) reachableFrom[id] = [];
for (const p of pairs) {
    if (p.gap <= -8) {
        reachableFrom[p.a].push(p.b);
        reachableFrom[p.b].push(p.a);
    }
}
console.log("\n=== Reachability graph (with NEW Euclidean + HYSTERESIS=8) ===");
for (const id of ids) {
    const count = reachableFrom[id].length;
    const targets = reachableFrom[id].join(', ') || 'NONE - STRANDED';
    console.log(`  ${id.padEnd(15)}: can evolve to ${count} personalities: ${targets}`);
}
