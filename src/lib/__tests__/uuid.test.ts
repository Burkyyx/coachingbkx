import { hexToUuid } from '../uuid';

describe('identifiants stables', () => {
  it('met en forme un hash en UUID valide pour Postgres', () => {
    const id = hexToUuid('0123456789abcdef0123456789abcdef9999');
    expect(id).toBe('01234567-89ab-5def-0123-456789abcdef');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
