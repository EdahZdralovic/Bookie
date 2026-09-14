const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const local = path.join(root, '.local');
const data = path.join(local, 'postgres');
const socket = path.join(local, 'socket');
const port = '55432';
const user = 'bookie';
const password = 'bookie_local_only';
const action = process.argv[2] || 'start';
if (!['start', 'stop', 'status'].includes(action)) throw new Error('Use start, stop or status.');

const candidates = [process.env.PG_BIN, '/opt/homebrew/opt/postgresql@16/bin',
  '/usr/local/opt/postgresql@16/bin'].filter(Boolean);
const pgBin = candidates.find((dir) => fs.existsSync(path.join(dir, 'pg_ctl')));
const executable = (name) => pgBin ? path.join(pgBin, name) : name;
function run(name, args, options = {}) {
  const result = spawnSync(executable(name), args, { encoding: 'utf8', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${name} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

function main() {
  if (action === 'status') {
    console.log(run('pg_ctl', ['status', '-D', data]));
    return;
  }
  if (action === 'stop') {
    console.log(run('pg_ctl', ['stop', '-D', data, '-m', 'fast', '-w']));
    return;
  }
  fs.mkdirSync(local, { recursive: true, mode: 0o700 });
  fs.mkdirSync(socket, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(path.join(data, 'PG_VERSION'))) {
    const passwordFile = path.join(local, 'init-password');
    fs.writeFileSync(passwordFile, password, { mode: 0o600 });
    try {
      console.log(run('initdb', ['-D', data, '--username', user, '--encoding=UTF8',
        '--locale=C', '--auth-local=trust', '--auth-host=scram-sha-256',
        '--pwfile', passwordFile]));
    } finally {
      fs.unlinkSync(passwordFile);
    }
  }
  const status = spawnSync(executable('pg_ctl'), ['status', '-D', data]);
  if (status.status !== 0) {
    if (socket.includes('"')) throw new Error('The workspace path must not contain double quotes.');
    console.log(run('pg_ctl', ['start', '-D', data, '-l', path.join(local, 'postgres.log'),
      '-o', `-h 127.0.0.1 -p ${port} -k "${socket}"`, '-w']));
  }
  const connection = ['-h', '127.0.0.1', '-p', port, '-U', user];
  const env = { ...process.env, PGPASSWORD: password };
  const exists = run('psql', [...connection, '-d', 'postgres', '-tAc',
    "SELECT 1 FROM pg_database WHERE datname = 'bookie'"], { env });
  if (exists !== '1') run('createdb', [...connection, 'bookie'], { env });
  console.log(`Bookie PostgreSQL is ready at 127.0.0.1:${port}, database bookie.`);
}

try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
