// maplibre-gl 6 ya no trae el worker embebido: lo carga como archivo aparte
// (maplibre-gl-worker.mjs, que a su vez importa maplibre-gl-shared.mjs). El
// bundler de Next no resuelve esa URL y el navegador terminaba pidiendo la
// página HTML como worker. Se copian a public/ (carpeta con la versión, para
// que un bump no sirva un worker viejo desde caché) y map.jsx apunta ahí con
// setWorkerUrl().
import { cpSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

const dist = 'node_modules/maplibre-gl/dist';
const { version } = JSON.parse(readFileSync('node_modules/maplibre-gl/package.json', 'utf8'));
const destino = `public/maplibre/${version}`;

rmSync('public/maplibre', { recursive: true, force: true });
mkdirSync(destino, { recursive: true });
for (const archivo of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  cpSync(`${dist}/${archivo}`, `${destino}/${archivo}`);
}
console.log(`maplibre worker ${version} -> ${destino}`);
