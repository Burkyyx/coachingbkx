import {
  parseYouTubeId,
  parseYouTubeStart,
  youTubeEmbedUrl,
  youTubeThumbnailUrl,
} from '../youtube';

describe('liens YouTube', () => {
  const id = 'dQw4w9WgXcQ';
  it('reconnaît les différentes formes de liens', () => {
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtube.com/watch?v=${id}&t=42s`,
      `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://youtu.be/${id}?si=abc`,
      `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`,
      `https://www.youtube-nocookie.com/embed/${id}`,
      `  https://youtu.be/${id}  `,
    ]) {
      expect(parseYouTubeId(url)).toBe(id);
    }
  });
  it('refuse les liens qui ne sont pas des vidéos YouTube', () => {
    expect(parseYouTubeId('https://vimeo.com/12345')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/channel/abc')).toBeNull();
    expect(parseYouTubeId('https://youtu.be/trop-court')).toBeNull();
    expect(parseYouTubeId('pas un lien')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
  });
  it('lit le début de la vidéo', () => {
    expect(parseYouTubeStart(`https://youtu.be/${id}?t=90`)).toBe(90);
    expect(parseYouTubeStart(`https://youtube.com/watch?v=${id}&t=1m30s`)).toBe(90);
    expect(parseYouTubeStart(`https://youtu.be/${id}`)).toBeNull();
    expect(parseYouTubeStart(`https://youtu.be/${id}?t=abc`)).toBeNull();
    expect(parseYouTubeStart('pas un lien')).toBeNull();
  });
  it('construit le lecteur intégré et la miniature', () => {
    expect(youTubeEmbedUrl(id)).toBe(
      `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`,
    );
    expect(youTubeEmbedUrl(id, 90)).toContain('start=90');
    expect(youTubeThumbnailUrl(id)).toBe(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  });
});
