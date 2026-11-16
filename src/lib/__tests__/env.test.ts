import { resolveLocalUrl } from '../env';

describe('adresse de la base vue depuis un téléphone', () => {
  it('remplace 127.0.0.1 / localhost par l’adresse du Mac quand la page vient du réseau', () => {
    expect(resolveLocalUrl('http://127.0.0.1:54321', '192.168.1.20')).toBe(
      'http://192.168.1.20:54321',
    );
    expect(resolveLocalUrl('http://localhost:8081', '192.168.1.20')).toBe(
      'http://192.168.1.20:8081',
    );
  });

  it('ne change rien sur le Mac, en natif ou pour une base en ligne', () => {
    expect(resolveLocalUrl('http://127.0.0.1:54321', 'localhost')).toBe('http://127.0.0.1:54321');
    expect(resolveLocalUrl('http://127.0.0.1:54321', undefined)).toBe('http://127.0.0.1:54321');
    expect(resolveLocalUrl('https://abcd.supabase.co', '192.168.1.20')).toBe(
      'https://abcd.supabase.co',
    );
    expect(resolveLocalUrl('http://127.0.0.10:1', '192.168.1.20')).toBe('http://127.0.0.10:1');
  });
});
