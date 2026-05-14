import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = process.cwd();
const packageManifests = [
  {
    path: 'packages/personality-core/package.json',
    name: '@zdesagochi/personality-core',
  },
  {
    path: 'packages/personality-pet-preset/package.json',
    name: '@zdesagochi/personality-pet-preset',
  },
];
const packageDirs = [
  'packages/personality-core/src',
  'packages/personality-pet-preset/src',
];
const personalityDir = 'src/personality';
const appDirs = ['src/api', 'src/components', 'src/pages', 'src/store'];
const appAndTestDirs = [...appDirs, 'tests'];

const packageForbidden = [
  { label: 'legacy src/personality import', pattern: /src\/personality|\.\.\/\.\.\/src\/personality|\.\.\/\.\.\/\.\.\/src\/personality/ },
  { label: 'app API type import', pattern: /src\/api\/types|from ['"](?:\.\.\/)+api\/types['"]/ },
  { label: 'app adapter import', pattern: /mockApi|PetService|LocalSave|SyncQueue|BackendReplayServerApi/ },
];

const storageForbidden = [
  'createBrowserOfflineStorage',
  'localStorage',
  'OfflineKeyValueStorage',
  'saveOfflinePetSave',
  'loadOfflinePetSave',
];

const legacyDefaultImportPattern =
  /from ['"](?:\.\.\/)+personality\/(?:personalities|influenceRegistry|memoryTextGenerator|zdesagochiPetPreset)['"]/;
const broadLegacyIndexImportPattern =
  /from ['"](?:\.\.\/)+(?:src\/)?personality['"]/;

const issues = [];

for (const manifest of packageManifests) {
  await checkPackageManifest(manifest);
}

for (const dir of packageDirs) {
  for (const file of await listTsFiles(join(root, dir))) {
    const text = await readFile(file, 'utf8');
    for (const rule of packageForbidden) {
      if (rule.pattern.test(text)) {
        issues.push(`${display(file)}: package contains ${rule.label}`);
      }
    }
  }
}

for (const dir of [...packageDirs, personalityDir]) {
  for (const file of await listTsFiles(join(root, dir))) {
    const text = await readFile(file, 'utf8');
    for (const symbol of storageForbidden) {
      if (text.includes(symbol)) {
        issues.push(`${display(file)}: personality boundary contains storage symbol ${symbol}`);
      }
    }
  }
}

for (const dir of appAndTestDirs) {
  for (const file of await listTsFiles(join(root, dir))) {
    const text = await readFile(file, 'utf8');
    if (legacyDefaultImportPattern.test(text)) {
      issues.push(`${display(file)}: imports Zdesagochi defaults through legacy src/personality shim`);
    }
    if (broadLegacyIndexImportPattern.test(text)) {
      issues.push(`${display(file)}: imports broad src/personality compatibility index`);
    }
  }
}

if (issues.length > 0) {
  console.error('Personality package boundary check failed:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log('PASS - personality package boundary check');

async function listTsFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listTsFiles(path));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}

function display(file) {
  return relative(root, file);
}

async function checkPackageManifest(expected) {
  const manifestPath = join(root, expected.path);
  let parsed;

  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    issues.push(`${expected.path}: package manifest is missing or invalid JSON`);
    return;
  }

  if (parsed.name !== expected.name) {
    issues.push(`${expected.path}: expected name ${expected.name}`);
  }
  if (parsed.private !== true) {
    issues.push(`${expected.path}: local personality package must remain private`);
  }
  if (parsed.version !== '0.0.0-private') {
    issues.push(`${expected.path}: local personality package must use 0.0.0-private version`);
  }
  if (parsed.type !== 'module') {
    issues.push(`${expected.path}: package type must be module`);
  }
  if (parsed.exports?.['.']?.types !== './src/index.ts') {
    issues.push(`${expected.path}: exports[\".\"].types must point at ./src/index.ts`);
  }
  if (parsed.exports?.['.']?.default !== './src/index.ts') {
    issues.push(`${expected.path}: exports[\".\"].default must point at ./src/index.ts`);
  }
}
