import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--observe-current-runtime') || args.length > 1) {
  console.error('Usage: node scripts/check-scope-checkpoint-combine.mjs [--observe-current-runtime]');
  process.exit(2);
}
const major = Number(process.versions.node.split('.')[0]);
const requiredRuntimeAvailable = major >= 24;
const observationOnly = args.includes('--observe-current-runtime');
console.log(JSON.stringify({
  node: process.versions.node, requiredNode: '>=24',
  requiredRuntimeAvailable,
  scope: observationOnly ? 'bounded focused observations; not the full project gate' : 'focused combine tests on the required runtime'
}));
if (!requiredRuntimeAvailable && !observationOnly) {
  console.error('Node >=24 is required. This gate is unrun on the current runtime. --observe-current-runtime explicitly runs bounded observations without satisfying that gate.');
  process.exit(2);
}
const result = spawnSync(process.execPath, ['--test', 'tests/scope-checkpoint-combine.test.mjs'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  stdio: 'inherit'
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
