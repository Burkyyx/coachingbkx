import { createHash } from 'node:crypto';

import { sha256Hex } from '../sha256';
import { hexToUuid, randomUuidFallback } from '../uuid';

describe('identifiants stables', () => {
  it('met en forme un hash en UUID valide pour Postgres', () => {
    const id = hexToUuid('0123456789abcdef0123456789abcdef9999');
    expect(id).toBe('01234567-89ab-5def-0123-456789abcdef');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe('replis hors contexte sécurisé (http sur le réseau local)', () => {
  it('SHA-256 en JS pur identique à celui du système', () => {
    const inputs = ['', 'abc', 'checkin:adherent-1:2026-11-16', 'é'.repeat(100), 'x'.repeat(1000)];
    for (const input of inputs) {
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    }
  });

  it('UUID v4 aléatoire bien formé', () => {
    const a = randomUuidFallback();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomUuidFallback()).not.toBe(a);
  });
});
