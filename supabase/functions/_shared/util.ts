// Utilitaires sans dépendance à Deno (utilisables aussi dans les tests Node).

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayParis(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** Log sans donnée personnelle. */
export function log(message: string, extra: Record<string, number | string> = {}) {
  console.log(JSON.stringify({ message, ...extra }));
}
