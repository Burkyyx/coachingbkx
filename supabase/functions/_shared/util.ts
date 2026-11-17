// Utilitaires sans dépendance à Deno (utilisables aussi dans les tests Node).

/** Date du jour à Paris (AAAA-MM-JJ). */
export function todayParis(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

/** Log sans donnée personnelle. */
export function log(message: string, extra: Record<string, number | string> = {}) {
  console.log(JSON.stringify({ message, ...extra }));
}

/**
 * Détail technique d'une erreur, pour le diagnostic (réponse + journal).
 * Les valeurs éventuelles (« Key (email)=(…) ») sont masquées : aucune donnée personnelle.
 */
export function errorDetail(error: unknown): { code: string; detail: string } {
  const e = (error ?? {}) as { code?: unknown; message?: unknown };
  const code = typeof e.code === 'string' || typeof e.code === 'number' ? String(e.code) : '';
  const message = typeof e.message === 'string' ? e.message : String(error);
  return {
    code,
    detail: message.replace(/=\([^)]*\)/g, '=(…)').slice(0, 300),
  };
}
