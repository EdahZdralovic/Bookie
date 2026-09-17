const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const envPath = path.join(root, '.env');
let source = fs.readFileSync(
  fs.existsSync(envPath) ? envPath : path.join(root, '.env.example'),
  'utf8',
);
const line = source.match(/^JWT_SECRET\s*=.*$/m);
if (!line || line[0].includes('replace-') || /^JWT_SECRET\s*=\s*["']?["']?\s*$/.test(line[0])) {
  const replacement = `JWT_SECRET="${crypto.randomBytes(48).toString('hex')}"`;
  source = line
    ? source.replace(/^JWT_SECRET\s*=.*$/m, replacement)
    : `${source}\n${replacement}\n`;
  fs.writeFileSync(envPath, source, { mode: 0o600 });
}
console.log('Authentication environment is ready. Existing configured secrets are preserved.');
