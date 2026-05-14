import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd();
const tempDir = await mkdtemp(join(tmpdir(), 'personality-package-import-demo-'));
const entry = join(tempDir, 'demo.ts');
const outfile = join(tempDir, 'demo.mjs');
const packageAliases = new Map([
  ['@zdesagochi/personality-core', join(root, 'packages/personality-core/src/index.ts')],
  ['@zdesagochi/personality-pet-preset', join(root, 'packages/personality-pet-preset/src/index.ts')],
]);

const packageNameResolver = {
  name: 'personality-package-name-resolver',
  setup(builder) {
    builder.onResolve({ filter: /^@zdesagochi\/personality-(core|pet-preset)$/ }, args => {
      const path = packageAliases.get(args.path);
      return path ? { path } : null;
    });
  },
};

const demoSource = `
  import assert from 'node:assert/strict';
  import {
    PERSONALITY_ENGINE_VERSION,
    createPersonalityEngine,
  } from '@zdesagochi/personality-core';
  import {
    PERSONALITIES,
    zdesagochiPetPreset,
  } from '@zdesagochi/personality-pet-preset';

  assert.equal(typeof PERSONALITY_ENGINE_VERSION, 'string');
  assert.equal(PERSONALITIES.length > 0, true);

  const engine = createPersonalityEngine(zdesagochiPetPreset);
  const validation = engine.validateConfig();
  assert.equal(validation.some(issue => issue.severity === 'error'), false);
`;

try {
  await writeFile(entry, demoSource);
  await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    plugins: [packageNameResolver],
  });
  await import(pathToFileURL(outfile).href);
  console.log('PASS - personality package-name import demo');
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
