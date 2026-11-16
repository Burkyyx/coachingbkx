/**
 * Variables d'environnement publiques de l'app (préfixe EXPO_PUBLIC_).
 * Elles sont incluses dans l'app : n'y mettre AUCUN secret.
 * Valeurs : fichier .env.local (voir .env.example).
 */
const LOOPBACK = /^(https?:\/\/)(127\.0\.0\.1|localhost)(?=[:/]|$)/i;

/**
 * En développement, .env.local pointe vers le Supabase du Mac (127.0.0.1).
 * Quand l'app est ouverte depuis un téléphone (http://192.168.x.x:8081), « 127.0.0.1 »
 * désignerait le téléphone : on remplace par l'adresse du Mac, celle de la page.
 * Sans effet en production (adresses en ligne) ni sur le Mac lui-même.
 */
export function resolveLocalUrl(url: string, pageHost: string | undefined): string {
  if (!pageHost || /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(pageHost)) return url;
  return url.replace(LOOPBACK, `$1${pageHost}`);
}

const pageHost: string | undefined =
  typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
    ? window.location.hostname
    : undefined;

export const env = {
  supabaseUrl: resolveLocalUrl(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '', pageHost),
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: resolveLocalUrl(process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081', pageHost),
  enableGoogleAuth: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
  enableAppleAuth: process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === 'true',
} as const;

export const isConfigured = env.supabaseUrl !== '' && env.supabaseAnonKey !== '';
