// Read pinned Git objects into temporary PGlite fixtures. No Git merge, remote
// database connection, environment file loading, or migration deployment.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const app = fileURLToPath(new URL('..', import.meta.url));
const refs = JSON.parse(readFileSync(new URL('../tests/final-integration-snapshots.json', import.meta.url), 'utf8'));
for (const key of ['main', 'student', 'admin', 'matching'])
  if (!/^[a-f0-9]{40}$/.test(refs[key])) throw new Error('Invalid pinned Git snapshot');
const directory = mkdtempSync(join(tmpdir(), 'magpie-sql-audit-'));
try {
  const sequence = [
    ['001_student_backend.sql', 'main'], ['002_report_deletion.sql', 'main'],
    ['003_admin_portal.sql', 'main'], ['004_admin_recovery.sql', 'admin'],
    ['005_matching_engine.sql', 'matching'], ['006_pickup_reissue.sql', 'admin'],
  ];
  for (const [name, key] of sequence) {
    const sql = execFileSync('git', ['show', `${refs[key]}:reclaim/db/migrations/${name}`], { cwd: app });
    writeFileSync(join(directory, name), sql);
  }
  console.log('ISOLATED planned-snapshot SQL audit; no feature merge or live services.');
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--test', 'services/finalMigrationSequence.test.ts'], {
    cwd: app, stdio: 'inherit', env: { ...process.env, MAGPIE_SQL_AUDIT_DIRECTORY: directory },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { rmSync(directory, { recursive: true, force: true }); }
