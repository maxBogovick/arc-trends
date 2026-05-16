import { PERSONALITY_TRAIT_MAP } from './packages/personality-core/dist/personalityTraitMap.js';
import { TRAIT_KEYS } from './packages/personality-core/dist/types.js';

function euclideanDistance(a, b) {
  const sum = TRAIT_KEYS.reduce((acc, key) => acc + (a[key] - b[key]) ** 2, 0);
  return Math.sqrt(sum);
}

function interpolateVector(a, b, t) {
  return TRAIT_KEYS.reduce((acc, key) => {
    acc[key] = a[key] + (b[key] - a[key]) * t;
    return acc;
  }, {});
}

const playful = PERSONALITY_TRAIT_MAP.playful.position;
const paranoid = PERSONALITY_TRAIT_MAP.paranoid.position;

let bestBelow = 0;
let bestAbove = 0;

for (let t = 0; t <= 1; t += 0.001) {
    const v = interpolateVector(playful, paranoid, t);
    const dist = euclideanDistance(v, playful);
    // radius = 15
    const depthAbs = Math.abs((15 - dist) / 15) * 15; // which is just Math.abs(15 - dist)
    
    // We want depthAbs to cross 8. Since dist > 15, depthAbs = dist - 15.
    // So dist - 15 = 8 => dist = 23.
    if (dist < 23) {
        bestBelow = t;
    } else if (bestAbove === 0) {
        bestAbove = t;
    }
}
console.log(`below: ${bestBelow.toFixed(3)}, above: ${bestAbove.toFixed(3)}`);
