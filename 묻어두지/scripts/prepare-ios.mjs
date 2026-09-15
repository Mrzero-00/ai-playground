import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// stdout contains only the build path; setup output goes to stderr.
const source = realpathSync(join(dirname(fileURLToPath(import.meta.url)), '..'));
const prepareOnly = process.argv.slice(2).includes('--prepare-only');
if (process.argv.slice(2).some(arg => arg !== '--prepare-only')) throw new Error('지원하지 않는 준비 옵션입니다.');
const hash = value => createHash('sha256').update(value).digest('hex');
const temp = realpathSync(existsSync('/private/tmp') ? '/private/tmp' : tmpdir());
if (!/^[\x20-\x7e]+$/.test(temp)) throw new Error('iOS 빌드용 임시 폴더는 ASCII 경로여야 합니다.');
const cache = join(temp, `mudeoduji-ios-${process.getuid?.() ?? 'user'}-${hash(source).slice(0, 16)}`);
const project = join(cache, 'project');
const ownerPath = join(cache, 'owner.json');
const owner = JSON.stringify({ version: 1, source });

function assertDirectory(path) {
  const info = lstatSync(path);
  if (!info.isDirectory() || info.isSymbolicLink() || (process.getuid && info.uid !== process.getuid())) {
    throw new Error(`이 빌드 작업의 실제 폴더가 아닙니다: ${path}`);
  }
}
if (!existsSync(cache)) {
  mkdirSync(cache, { mode: 0o700 });
  writeFileSync(ownerPath, owner, { flag: 'wx', mode: 0o600 });
}
assertDirectory(cache);
if (!lstatSync(ownerPath).isFile() || lstatSync(ownerPath).isSymbolicLink() || readFileSync(ownerPath, 'utf8') !== owner) {
  throw new Error('기존 빌드 폴더의 소유 정보가 달라 준비를 중단했습니다.');
}
const lease = join(cache, 'preparing.lock');
try { mkdirSync(lease, { mode: 0o700 }); }
catch { throw new Error('같은 프로젝트의 iOS 준비가 실행 중이거나 이전 준비 잠금이 남아 있습니다.'); }

const excluded = ['node_modules', '.build', 'ios', 'android', '.data', '.expo', '.git', 'dist'];
const skip = (name, root) => (root && (excluded.includes(name) || name.startsWith('dist-'))) ||
  name === '.DS_Store' || name.endsWith('.log') || name.endsWith('.tsbuildinfo');
function rejectSourceLinks(path, root = true) {
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (skip(entry.name, root)) continue;
    if (entry.isSymbolicLink()) throw new Error(`빌드 소스의 심볼릭 링크를 지원하지 않습니다: ${entry.name}`);
    if (entry.isDirectory()) rejectSourceLinks(join(path, entry.name), false);
  }
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: project, stdio: ['inherit', 2, 2] });
  if (result.error || result.status !== 0) throw new Error(`${command} 실행 실패${result.error ? `: ${result.error.message}` : ''}`);
}
try {
  rejectSourceLinks(source);
  if (!existsSync(project)) mkdirSync(project, { mode: 0o700 });
  assertDirectory(project);
  // Deletion is restricted to this owned copy. Excluded build caches are retained.
  run('rsync', ['-a', '--delete', ...excluded.map(name => `--exclude=/${name}`),
    '--exclude=/dist-*', '--exclude=.DS_Store', '--exclude=*.log', '--exclude=*.tsbuildinfo',
    `${source}/`, `${project}/`]);
  if (!prepareOnly) {
    const fingerprint = hash(readFileSync(join(project, 'package-lock.json'), 'utf8') + readFileSync(join(project, 'package.json'), 'utf8'));
    const stamp = join(cache, 'dependencies.sha256');
    const installed = existsSync(join(project, 'node_modules', 'expo', 'package.json'));
    if (!installed || !existsSync(stamp) || readFileSync(stamp, 'utf8') !== fingerprint) {
      rmSync(stamp, { force: true });
      console.error('iOS 빌드 복사본에 의존성을 설치합니다.');
      run('npm', ['ci']);
      writeFileSync(stamp, fingerprint, { mode: 0o600 });
    }
  }
  console.error(`iOS 빌드 복사본${prepareOnly ? ' 준비만 완료 (의존성 설치 생략)' : ''}: ${project}`);
  console.log(project);
} finally {
  rmSync(lease, { recursive: true });
}
