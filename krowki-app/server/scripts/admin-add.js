// Dodaje konto grafika albo zmienia mu hasło.
// Użycie: npm run admin:add -- grafik@firma.pl "Anna Kowalska"   (hasło poda skrypt albo zmienna ADMIN_PASSWORD)
import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { hashPassword, normEmail, validEmail } from '../src/auth.js';
import { loadConfig } from '../src/config.js';
import { openDb } from '../src/db.js';

const [emailArg, ...nameParts] = process.argv.slice(2);
const email = normEmail(emailArg);
if (!validEmail(email)) {
  console.error('Użycie: npm run admin:add -- grafik@firma.pl "Imię Nazwisko"');
  process.exit(1);
}
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  password = await rl.question('Hasło (min. 10 znaków): ');
  rl.close();
}
if (!password || password.length < 10) {
  console.error('Hasło musi mieć co najmniej 10 znaków.');
  process.exit(1);
}
const db = openDb(loadConfig().dataDir);
const name = nameParts.join(' ') || email.split('@')[0];
db.run(`INSERT INTO admins (email, name, pass_hash) VALUES (?, ?, ?)
  ON CONFLICT(email) DO UPDATE SET name = excluded.name, pass_hash = excluded.pass_hash`, email, name, await hashPassword(password));
db.run("DELETE FROM sessions WHERE kind = 'admin' AND subject = (SELECT CAST(id AS TEXT) FROM admins WHERE email = ?)", email);
console.log(`Konto grafika ${email} zapisane.`);
