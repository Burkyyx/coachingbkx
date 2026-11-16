import i18n from '@/i18n';

import { ageOn, CONSENT_VERSION, hasActiveConsent, missingRequiredConsents } from '../consents';
import { makeInvitationSchema, makeSignUpSchema, normalizeInvitationCode } from '../schemas';

const t = i18n.t.bind(i18n);

describe('consentements', () => {
  const ok = { version: CONSENT_VERSION, revoked_at: null };
  it('détecte les consentements obligatoires manquants', () => {
    expect(missingRequiredConsents([])).toEqual(['terms', 'training_data']);
    expect(missingRequiredConsents([{ type: 'terms', ...ok }])).toEqual(['training_data']);
    expect(
      missingRequiredConsents([
        { type: 'terms', ...ok },
        { type: 'training_data', ...ok },
      ]),
    ).toEqual([]);
  });
  it('ignore les consentements révoqués ou d’une ancienne version', () => {
    expect(
      hasActiveConsent(
        [{ type: 'terms', version: CONSENT_VERSION, revoked_at: '2026-01-01' }],
        'terms',
      ),
    ).toBe(false);
    expect(hasActiveConsent([{ type: 'terms', version: '0.9', revoked_at: null }], 'terms')).toBe(
      false,
    );
  });
  it('calcule l’âge en années révolues', () => {
    expect(ageOn('2011-11-17', '2026-11-16')).toBe(14);
    expect(ageOn('2011-11-16', '2026-11-16')).toBe(15);
    expect(ageOn('1994-03-14', '2026-11-16')).toBe(32);
  });
});

describe('formulaires', () => {
  it('normalise le code d’invitation', () => {
    expect(normalizeInvitationCode(' abcd-2345 ')).toBe('ABCD2345');
    expect(makeInvitationSchema(t).safeParse({ code: 'abcd 2345' }).success).toBe(true);
    expect(makeInvitationSchema(t).safeParse({ code: 'abc' }).success).toBe(false);
  });
  it('vérifie le mot de passe à l’inscription', () => {
    const schema = makeSignUpSchema(t);
    expect(
      schema.safeParse({ email: 'a@b.fr', password: 'motdepasse', confirm: 'motdepasse' }).success,
    ).toBe(true);
    const short = schema.safeParse({ email: 'a@b.fr', password: 'court', confirm: 'court' });
    expect(short.success).toBe(false);
    const mismatch = schema.safeParse({
      email: 'a@b.fr',
      password: 'motdepasse',
      confirm: 'autre',
    });
    expect(mismatch.error?.issues[0]?.message).toBe('Les mots de passe ne correspondent pas');
    expect(
      schema.safeParse({ email: 'pas-un-email', password: 'motdepasse', confirm: 'motdepasse' })
        .success,
    ).toBe(false);
  });
});
