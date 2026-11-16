/**
 * Variables d'environnement publiques de l'app (préfixe EXPO_PUBLIC_).
 * Elles sont incluses dans l'app : n'y mettre AUCUN secret.
 * Valeurs : fichier .env.local (voir .env.example).
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  webUrl: process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:8081',
  enableGoogleAuth: process.env.EXPO_PUBLIC_ENABLE_GOOGLE_AUTH === 'true',
  enableAppleAuth: process.env.EXPO_PUBLIC_ENABLE_APPLE_AUTH === 'true',
} as const;

export const isConfigured = env.supabaseUrl !== '' && env.supabaseAnonKey !== '';
