#!/usr/bin/env node
/**
 * `npm run web` / `npm run phone` — lance l'app web et affiche un code QR pour l'ouvrir
 * sur un téléphone connecté au même Wi-Fi que le Mac.
 *
 * 1. Trouve l'adresse du Mac sur le réseau local (ex. 192.168.1.20).
 * 2. Lance la version web (cache vidé) — ou réutilise le serveur s'il tourne déjà.
 * 3. Vérifie que l'app et la base répondent sur cette adresse, puis affiche le code QR.
 *
 * L'adresse du Supabase local (127.0.0.1 dans .env.local) est adaptée par l'app elle-même
 * quand elle est ouverte depuis le téléphone (voir resolveLocalUrl dans src/lib/env.ts).
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import qrcode from 'qrcode-terminal';

const PORT = Number(process.env.PORT ?? 8081);

/** Adresses IPv4 du Mac sur le réseau local, la plus probable en premier. */
function lanAddresses() {
  const candidates = [];
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family !== 'IPv4' || net.internal) continue;
      if (net.address.startsWith('169.254.')) continue; // adresse « auto-attribuée » : pas de réseau
      // Réseaux virtuels (Docker, VPN, partage de connexion…) en dernier.
      const virtual = /^(docker|br-|veth|utun|vboxnet|vmnet|bridge|tun|tap|llw|awdl|anpi)/.test(
        name,
      );
      const privateRange = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(net.address);
      candidates.push({
        name,
        address: net.address,
        score: (virtual ? 0 : 4) + (privateRange ? 2 : 0) + (/^en[01]$/.test(name) ? 1 : 0),
      });
    }
  }
  return candidates.sort((a, b) => b.score - a.score).map((c) => c.address);
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

async function responds(url, timeoutMs = 4000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.status < 500;
  } catch {
    return false;
  }
}

const addresses = lanAddresses();
const ip = addresses[0];
const supabaseUrl = readEnvFile().EXPO_PUBLIC_SUPABASE_URL ?? '';
if (!supabaseUrl) {
  console.error('✗ EXPO_PUBLIC_SUPABASE_URL est vide dans .env.local (voir README, section 3).');
  process.exit(1);
}
const isLocal = /\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(supabaseUrl);

async function showPhoneAccess({ expoStarted }) {
  if (!ip) {
    console.log('\n  ℹ  Pas de Wi-Fi détecté : l’app n’est accessible que sur ce Mac.\n');
    return;
  }
  const appUrl = `http://${ip}:${PORT}`;
  // Vérifications depuis le Mac, avec l'adresse que le téléphone utilisera.
  const appOk = await responds(appUrl, 15000);
  const dbUrl = isLocal ? supabaseUrl.replace(/\/\/(127\.0\.0\.1|localhost)/, `//${ip}`) : null;
  const dbOk = dbUrl ? await responds(`${dbUrl}/auth/v1/health`) : true;

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(' 📱  SUR TON TÉLÉPHONE (même Wi-Fi que le Mac)');
  console.log('     Scanne CE code avec l’appareil photo, ou tape cette adresse');
  console.log(`     dans Safari / Chrome :  ${appUrl}\n`);
  qrcode.generate(appUrl, { small: true });
  console.log(`  ${appOk ? '✓' : '✗'} App joignable à cette adresse`);
  if (dbUrl) {
    console.log(`  ${dbOk ? '✓' : '✗'} Base de données joignable (${dbUrl})`);
    if (!dbOk) console.log('     → Supabase est-il lancé ?  npm run db:start');
  }
  if (addresses.length > 1) {
    console.log('  ℹ  Si la page ne s’ouvre pas, essaie plutôt :');
    for (const other of addresses.slice(1)) console.log(`       http://${other}:${PORT}`);
  }
  if (expoStarted) {
    console.log('  ⚠  Ignore l’autre code QR affiché par Expo plus haut (il sert à une');
    console.log('     version de développement de l’app, pas au navigateur).');
  }
  console.log('  ⚠  Si le Mac demande d’autoriser les connexions entrantes : « Autoriser ».');
  console.log('────────────────────────────────────────────────────────────\n');
}

if (await responds(`http://localhost:${PORT}`, 2000)) {
  // Un serveur tourne déjà (autre fenêtre du Terminal) : on l'utilise.
  console.log(`\nL’app tourne déjà sur le port ${PORT} : j’affiche seulement le code QR.`);
  await showPhoneAccess({ expoStarted: false });
  process.exit(0);
}

console.log('\nDémarrage de l’app (≈ 1 min la première fois)…\n');
const child = spawn('npx', ['expo', 'start', '--web', '--clear', '--port', String(PORT)], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

// Affiche le code QR une fois le serveur prêt (après les messages d'Expo).
const started = Date.now();
const timer = setInterval(async () => {
  if (!(await responds(`http://localhost:${PORT}`, 2000))) {
    if (Date.now() - started > 240_000) clearInterval(timer);
    return;
  }
  clearInterval(timer);
  await showPhoneAccess({ expoStarted: true });
}, 3000);
