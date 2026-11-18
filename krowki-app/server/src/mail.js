// Wysyłka maili. Z SMTP_URL – przez SMTP (nodemailer); bez niego mail trafia do logu
// i do DATA_DIR/outbox (wygodne lokalnie i w testach).
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';

export function createMailer(cfg, log = console) {
  const outbox = [];
  const transport = cfg.smtpUrl ? nodemailer.createTransport(cfg.smtpUrl) : null;
  const dir = path.join(cfg.dataDir, 'outbox');
  return {
    outbox,
    async send({ to, subject, text, html }) {
      const msg = { from: cfg.mailFrom, to, subject, text, html };
      outbox.push(msg);
      if (outbox.length > 200) outbox.shift();
      if (transport) return transport.sendMail(msg);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${Date.now()}-${String(to).replace(/[^a-z0-9@.]/gi, '_')}.txt`), `To: ${to}\nSubject: ${subject}\n\n${text}\n`);
      log.info?.(`[mail] (bez SMTP) do ${to}: ${subject}`);
    },
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Prosty, czytelny szablon maila (tekst + HTML). */
export function mailBody(cfg, { title, lines, button }) {
  const text = [title, '', ...lines, ...(button ? ['', `${button.label}: ${button.url}`] : []), '', '—', cfg.brand].join('\n');
  const html = `<!doctype html><html lang="pl"><body style="font-family:Arial,sans-serif;color:#3b2414;background:#fdf8f1;padding:24px">
<div style="max-width:520px;margin:auto;background:#fff;border-radius:12px;padding:28px">
<h2 style="margin-top:0;color:#8e3b16">${esc(title)}</h2>
${lines.map((l) => `<p style="line-height:1.5">${esc(l)}</p>`).join('\n')}
${button ? `<p style="margin:28px 0"><a href="${esc(button.url)}" style="background:#8e3b16;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(button.label)}</a></p>` : ''}
<p style="color:#8a7565;font-size:13px;margin-bottom:0">${esc(cfg.brand)}</p></div></body></html>`;
  return { text, html };
}
