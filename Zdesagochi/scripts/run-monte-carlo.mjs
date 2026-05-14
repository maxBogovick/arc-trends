import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = process.cwd();
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

const tempDir = await mkdtempCompat();
const outfile = join(tempDir, 'monteCarloSimulation.mjs');

try {
  await build({
    entryPoints: ['tests/monteCarloSimulation.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: 'inline',
    logLevel: 'silent',
    plugins: [packageNameResolver],
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

async function mkdtempCompat() {
  const { mkdtemp } = await import('node:fs/promises');
  return mkdtemp(join(tmpdir(), 'zdesagochi-montecarlo-'));
}
