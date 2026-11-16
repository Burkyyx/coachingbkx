#!/usr/bin/env node
/**
 * `npm run phone` — ouvrir l'app sur un téléphone connecté au même Wi-Fi que le Mac.
 *
 * 1. Trouve l'adresse du Mac sur le réseau local (ex. 192.168.1.20).
 * 2. Lance la version web et affiche un code QR à scanner avec l'appareil photo.
 *
 * L'adresse du Supabase local (127.0.0.1 dans .env.local) est adaptée par l'app elle-même
 * quand elle est ouverte depuis le téléphone (voir resolveLocalUrl dans src/lib/env.ts).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';

const PORT = Number(process.env.PORT ?? 8081);

function lanAddress() {
  const candidates = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      // Ignore les réseaux virtuels (Docker, VPN…) quand c'est possible.
      const virtual = /^(docker|br-|veth|utun|vboxnet|vmnet|bridge|tun|tap)/.test(name);
      const privateRange = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address);
      candidates.push({
        name,
        address: net.address,
        score: (virtual ? 0 : 2) + (privateRange ? 1 : 0) + (name === 'en0' ? 1 : 0),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.address;
}

function readEnvFile() {
  const values = {};
  for (const file of ['.env', '.env.local']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
  return values;
}

const ip = lanAddress();
if (!ip) {
  console.error(
    '✗ Impossible de trouver l’adresse du Mac sur le réseau. Es-tu connecté au Wi-Fi ?',
  );
  process.exit(1);
}

const fileEnv = readEnvFile();
const supabaseUrl = fileEnv.EXPO_PUBLIC_SUPABASE_URL ?? '';
if (!supabaseUrl) {
  console.error('✗ EXPO_PUBLIC_SUPABASE_URL est vide dans .env.local (voir README, section 3).');
  process.exit(1);
}
const isLocal = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);
const appUrl = `http://${ip}:${PORT}`;

const shownDb = isLocal
  ? supabaseUrl.replace(/\/\/(127\.0\.0\.1|localhost)/, `//${ip}`)
  : supabaseUrl;
console.log(`\nDémarrage… (base de données vue du téléphone : ${shownDb})\n`);

const child = spawn('npx', ['expo', 'start', '--web', '--clear', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

// Affiche le code QR une fois le serveur prêt (après les messages d'Expo).
const started = Date.now();
const timer = setInterval(async () => {
  try {
    const res = await fetch(`http://localhost:${PORT}`);
    if (!res.ok) return;
  } catch {
    if (Date.now() - started > 180_000) clearInterval(timer);
    return;
  }
  clearInterval(timer);
  // Premier chargement : on demande la page au serveur pour préparer l'app.
  await fetch(`http://localhost:${PORT}`).catch(() => undefined);
  console.log('\n────────────────────────────────────────────────────────────');
  console.log(' 📱  SUR TON TÉLÉPHONE (même Wi-Fi que le Mac)');
  console.log('     Scanne ce code avec l’appareil photo, ou tape cette adresse');
  console.log(`     dans Safari / Chrome :  ${appUrl}\n`);
  qrcode.generate(appUrl, { small: true });
  console.log('  ⚠  Ignore l’autre code QR affiché par Expo plus haut (il sert à une');
  console.log('     version de développement de l’app, pas au navigateur).');
  console.log('  ⚠  Si le Mac demande d’autoriser les connexions entrantes : « Autoriser ».');
  if (!isLocal) console.log('  ℹ  Base de données en ligne utilisée (adresse de .env.local).');
  console.log('────────────────────────────────────────────────────────────\n');
}, 2000);
