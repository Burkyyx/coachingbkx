/**
 * Copie le moteur de lecture des codes-barres (zxing, WebAssembly) dans public/,
 * pour qu'il soit servi par l'app elle-même (sans CDN externe). Lancé à l'installation
 * et avant la construction web. Le fichier copié correspond toujours à la version installée.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'node_modules/zxing-wasm/dist/reader/zxing_reader.wasm');
const target = join(root, 'public/zxing/zxing_reader.wasm');

if (!existsSync(source)) {
  console.warn('zxing_reader.wasm introuvable : scan des codes-barres web indisponible.');
} else {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
}
