import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const engine = path.resolve(
  process.argv[2] ??
    process.env.CHART_ENGINE_DIR ??
    path.join(root, '../../VSCodeProjects/chart-engine'),
);
const target = path.join(root, 'local_modules');
const packages = ['core', 'gpu', 'data', 'tools'];

if (!existsSync(path.join(engine, 'pnpm-workspace.yaml'))) {
  console.error(`[chart-engine-pack] chart-engine not found at ${engine}`);
  process.exit(1);
}

const run = (args, cwd) => execFileSync('pnpm', args, { cwd, stdio: 'inherit' });

run(['exec', 'turbo', 'run', 'build', '--filter=./packages/*'], engine);
for (const name of packages) {
  run(['pack', '--pack-destination', target], path.join(engine, 'packages', name));
}
console.log('[chart-engine-pack] tarballs updated in local_modules, now run: npm install');
