import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Serve the official ESM + matching worker locally; no CDN or eval-based loader.
const require = createRequire(import.meta.url);
const packagePath = require.resolve('maplibre-gl/package.json');
const { version } = JSON.parse(readFileSync(packagePath, 'utf8'));
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, 'public', 'maplibre', version);
mkdirSync(target, { recursive: true });
for (const name of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(dirname(packagePath), 'dist', name), join(target, name));
}
copyFileSync(join(dirname(packagePath), 'LICENSE.txt'), join(target, 'LICENSE.txt'));
console.log(`Prepared local MapLibre ${version} browser modules and worker.`);
