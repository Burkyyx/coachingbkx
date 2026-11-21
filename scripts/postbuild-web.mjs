// -----------------------------------------------------------------------------
// Après `expo export --platform web` : prépare le dossier dist/ pour l'hébergement.
//  1. service worker (sw.js) : l'app s'ouvre même SANS réseau (salle de sport) ;
//  2. _redirects : toutes les adresses renvoient vers l'app (Cloudflare Pages) ;
//  3. _headers : sw.js et index.html jamais mis en cache trop longtemps ;
//  0. (avant tout) renomme dist/assets/node_modules : Cloudflare Pages n'envoie PAS les
//     dossiers nommés « node_modules » → police des icônes absente, carrés vides à la place.
// -----------------------------------------------------------------------------
import { createHash } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

const dist = join(process.cwd(), 'dist');

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// 0. assets/node_modules → assets/vendor, et mise à jour des références dans le code.
const nodeModulesAssets = join(dist, 'assets', 'node_modules');
if (existsSync(nodeModulesAssets)) {
  renameSync(nodeModulesAssets, join(dist, 'assets', 'vendor'));
  let rewritten = 0;
  for (const file of walk(dist)) {
    if (!/\.(js|html|css|json)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    if (!text.includes('assets/node_modules/')) continue;
    writeFileSync(file, text.split('assets/node_modules/').join('assets/vendor/'));
    rewritten++;
  }
  console.log(`✔ Ressources déplacées vers assets/vendor (${rewritten} fichier(s) mis à jour).`);
}

const files = walk(dist)
  .map((f) => `/${relative(dist, f).split('\\').join('/')}`)
  .filter((f) => !['/sw.js', '/_redirects', '/_headers'].includes(f) && !f.endsWith('.map'));

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const sw = `/* Service worker généré automatiquement (scripts/postbuild-web.mjs). */
const CACHE = 'divus-${version}';
const ASSETS = ${JSON.stringify(['/', ...files])};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  // Les appels à Supabase (autre domaine) ne passent jamais par le cache.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pages : réseau d'abord, sinon l'app en cache (fonctionne hors-ligne).
    event.respondWith(fetch(req).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }
  // Fichiers de l'app (JS, polices, images) : cache d'abord.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }),
    ),
  );
});
`;
writeFileSync(join(dist, 'sw.js'), sw);

const indexPath = join(dist, 'index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('serviceWorker.register')) {
  html = html.replace(
    '</body>',
    `<script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js');});}</script></body>`,
  );
  writeFileSync(indexPath, html);
}

writeFileSync(join(dist, '_redirects'), '/* /index.html 200\n');
writeFileSync(
  join(dist, '_headers'),
  [
    '/sw.js',
    '  Cache-Control: no-cache',
    '/index.html',
    '  Cache-Control: no-cache',
    '/_expo/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
);

console.log(`✔ Web prêt pour l'hébergement (${files.length} fichiers, cache ${version}).`);
