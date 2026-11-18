// Przekazanie potwierdzonego zapisu do narzędzia newslettera.
// NEWSLETTER_WEBHOOK_URL: POST JSON { email, confirmedAt, consentText, source } – np. do Zapier/Make,
// MailerLite, Brevo albo własnego skryptu, który doda adres do listy w Shoperze.
// Bez webhooka adresy zbiera tylko baza; panel pozwala pobrać je jako CSV.
export function createNewsletter(cfg, db, log = console) {
  return {
    async onConfirmed(email) {
      if (!cfg.newsletterWebhook) return;
      const s = db.get('SELECT * FROM subscribers WHERE email = ?', email);
      try {
        const r = await fetch(cfg.newsletterWebhook, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, confirmedAt: s?.confirmed_at, consentText: s?.consent_text, source: 'konfigurator-krowek' }),
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        db.run("UPDATE subscribers SET synced_at = datetime('now'), sync_error = NULL WHERE email = ?", email);
      } catch (e) {
        db.run('UPDATE subscribers SET sync_error = ? WHERE email = ?', String(e.message ?? e), email);
        log.warn?.(`[newsletter] nie udało się przekazać ${email}: ${e.message ?? e}`);
      }
    },
  };
}
