// -----------------------------------------------------------------------------
// Copie le module « core » (algorithmes) vers supabase/functions/_shared/core,
// pour que les Edge Functions (Deno) utilisent EXACTEMENT le même code que l'app.
//
//   npm run core:sync    → met à jour la copie
//   npm run core:check   → vérifie que la copie est à jour (utilisé par la CI)
// -----------------------------------------------------------------------------
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';

const root = process.cwd();
const src = join(root, 'src/core');
const dest = join(root, 'supabase/functions/_shared/core');
const HEADER =
  '// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.\n';

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      return name === '__tests__' || name === 'testing' ? [] : walk(full);
    }
    return full.endsWith('.ts') ? [full] : [];
  });
}

const expected = new Map(
  walk(src).map((f) => [relative(src, f), HEADER + readFileSync(f, 'utf8')]),
);

if (process.argv.includes('--check')) {
  const actual = existsSync(dest) ? walk(dest).map((f) => relative(dest, f)) : [];
  const problems = [];
  for (const [rel, content] of expected) {
    const file = join(dest, rel);
    if (!existsSync(file) || readFileSync(file, 'utf8') !== content) problems.push(rel);
  }
  for (const rel of actual) if (!expected.has(rel)) problems.push(`${rel} (en trop)`);
  if (problems.length) {
    console.error(
      `✗ Copie de src/core non à jour : ${problems.join(', ')}. Lancer npm run core:sync.`,
    );
    process.exit(1);
  }
  console.warn('✓ Copie de src/core à jour.');
} else {
  rmSync(dest, { recursive: true, force: true });
  for (const [rel, content] of expected) {
    const file = join(dest, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  console.warn(`✓ ${expected.size} fichiers copiés vers supabase/functions/_shared/core.`);
}
