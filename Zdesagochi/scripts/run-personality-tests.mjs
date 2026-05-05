import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const tempDir = await mkdtemp(join(tmpdir(), 'zdesagochi-tests-'));
const outfile = join(tempDir, 'personalityEvolution.test.mjs');

try {
  await build({
    entryPoints: ['tests/personalityEvolution.test.ts'],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: 'inline',
    logLevel: 'silent',
  });

  await import(pathToFileURL(outfile).href);
} finally {
  await rm(tempDir, { recursive: true, force: true });
}
