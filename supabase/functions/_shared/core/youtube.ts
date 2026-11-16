// COPIE GÉNÉRÉE par scripts/sync-core.mjs — NE PAS MODIFIER ICI : modifier src/core.
/**
 * Liens YouTube : reconnaissance de l'identifiant de la vidéo, pour l'intégrer
 * directement dans l'app (lecteur « confidentialité renforcée » youtube-nocookie.com).
 */

const ID = /^[A-Za-z0-9_-]{11}$/;

/** Identifiant de la vidéo, ou null si ce n'est pas un lien YouTube valide. */
export function parseYouTubeId(input: string | null | undefined): string | null {
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else {
      const [, kind, value] = url.pathname.split('/');
      if (kind === 'shorts' || kind === 'embed' || kind === 'live' || kind === 'v')
        id = value ?? null;
    }
  }
  return id && ID.test(id) ? id : null;
}

/** Début de la vidéo en secondes (paramètre t=90 ou t=1m30s), si présent. */
export function parseYouTubeStart(input: string): number | null {
  try {
    const t =
      new URL(input.trim()).searchParams.get('t') ??
      new URL(input.trim()).searchParams.get('start');
    if (!t) return null;
    if (/^\d+$/.test(t)) return Number(t);
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
    if (!m) return null;
    return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  } catch {
    return null;
  }
}

/** Adresse du lecteur intégré (sans cookies de suivi avant la lecture). */
export function youTubeEmbedUrl(id: string, start: number | null = null): string {
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
  if (start) params.set('start', String(start));
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

/** Miniature de la vidéo. */
export function youTubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}
