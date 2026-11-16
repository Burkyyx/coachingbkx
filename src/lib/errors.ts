import i18n from '@/i18n';

type MaybeError =
  { message?: string; code?: string; status?: number; name?: string } | null | undefined;

/** Vrai si l'erreur vient d'une absence de réseau. */
export function isNetworkError(error: unknown): boolean {
  const e = error as MaybeError;
  const msg = (e?.message ?? '').toLowerCase();
  return (
    e?.name === 'AuthRetryableFetchError' ||
    msg.includes('failed to fetch') ||
    msg.includes('network request failed') ||
    msg.includes('networkerror') ||
    msg.includes('load failed')
  );
}

/**
 * Transforme une erreur technique (Supabase, réseau…) en message clair en français.
 * Les détails techniques ne sont jamais affichés à l'utilisateur.
 */
export function toUserMessage(error: unknown): string {
  const t = i18n.t.bind(i18n);
  if (!error) return t('common.unknownError');
  const e = error as MaybeError;
  if (isNetworkError(error)) return t('common.errorBody');
  const code = e?.code ?? '';
  const msg = e?.message ?? '';
  switch (code) {
    case 'invalid_credentials':
      return t('auth.errors.invalidCredentials');
    case 'email_not_confirmed':
      return t('auth.errors.emailNotConfirmed');
    case 'user_already_exists':
    case 'email_exists':
      return t('auth.errors.userExists');
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return t('auth.errors.tooManyRequests');
    case 'weak_password':
      return t('auth.errors.passwordTooShort');
    default:
      break;
  }
  if (msg.includes('invitation_invalide')) return t('auth.invitationInvalid');
  if (msg.includes('Invalid login credentials')) return t('auth.errors.invalidCredentials');
  return t('common.unknownError');
}
