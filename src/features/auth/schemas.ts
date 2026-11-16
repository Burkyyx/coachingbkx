import type { TFunction } from 'i18next';
import { z } from 'zod';

/** Schémas de validation des formulaires de connexion (messages en français). */
export function makeSignInSchema(t: TFunction) {
  return z.object({
    email: z.email(t('auth.errors.invalidEmail')),
    password: z.string().min(1, t('common.required')),
  });
}

export function makeSignUpSchema(t: TFunction) {
  return z
    .object({
      email: z.email(t('auth.errors.invalidEmail')),
      password: z.string().min(8, t('auth.errors.passwordTooShort')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: t('auth.errors.passwordMismatch'),
    });
}

export function makeNewPasswordSchema(t: TFunction) {
  return z
    .object({
      password: z.string().min(8, t('auth.errors.passwordTooShort')),
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, {
      path: ['confirm'],
      message: t('auth.errors.passwordMismatch'),
    });
}

export function makeEmailSchema(t: TFunction) {
  return z.object({ email: z.email(t('auth.errors.invalidEmail')) });
}

/** Code d'invitation : 8 caractères, lettres et chiffres (casse et espaces ignorés). */
export function normalizeInvitationCode(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function makeInvitationSchema(t: TFunction) {
  return z.object({
    code: z
      .string()
      .transform(normalizeInvitationCode)
      .pipe(z.string().regex(/^[A-Z0-9]{8}$/, t('auth.invitationInvalid'))),
  });
}
