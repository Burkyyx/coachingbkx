import { technicalDetail, toUserMessage } from '../errors';

describe('messages d’erreur', () => {
  it('traduit les erreurs d’envoi d’e-mail et d’inscription fermée', () => {
    expect(toUserMessage({ code: 'email_address_not_authorized', message: 'x' })).toMatch(
      /envoi d’e-mails n’est pas encore configuré/,
    );
    expect(
      toUserMessage({ code: 'unexpected_failure', message: 'Error sending confirmation email' }),
    ).toMatch(/n’a pas pu être envoyé/);
    expect(toUserMessage({ code: 'signup_disabled', message: 'Signups not allowed' })).toMatch(
      /inscriptions sont fermées/,
    );
  });

  it('ajoute le détail technique aux erreurs inconnues, sans adresse e-mail', () => {
    const msg = toUserMessage({
      code: '42501',
      status: 403,
      message: 'permission denied for a@b.fr',
    });
    expect(msg).toContain('42501');
    expect(msg).toContain('HTTP 403');
    expect(msg).not.toContain('a@b.fr');
    expect(technicalDetail(null)).toBeNull();
  });
});
