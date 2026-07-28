import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const maxBundleBytes = 100 * 1024 * 1024;
const failures = [];
const warnings = [];
const passes = [];

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function configString(source, field) {
  return source.match(new RegExp(`${field}:\\s*['"]([^'"]*)['"]`))?.[1]?.trim() ?? '';
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}

function uncompressedZipSize(buffer) {
  const localHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
  const zipStart = buffer.indexOf(localHeader);
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (zipStart < 0 || eocdOffset < 0) throw new Error('AIT 내부 ZIP 구조를 찾지 못했어요.');

  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let cursor = zipStart + centralDirectoryOffset;
  let total = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error('AIT 중앙 디렉터리를 읽지 못했어요.');
    }
    total += buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return total;
}

function formatMb(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const [granite, envTemplate, packageJson] = await Promise.all([
  readFile(join(root, 'granite.config.ts'), 'utf8'),
  readFile(join(root, '.env.example'), 'utf8'),
  readFile(join(root, 'package.json'), 'utf8').then(JSON.parse),
]);

const appName = configString(granite, 'appName');
const displayName = configString(granite, 'displayName');
const primaryColor = configString(granite, 'primaryColor');
const icon = configString(granite, 'icon');

if (appName) pass(`appName이 설정되어 있어요: ${appName}`);
else fail('granite.config.ts의 appName이 비어 있어요.');

if (displayName) pass(`브랜드 이름이 설정되어 있어요: ${displayName}`);
else fail('brand.displayName이 비어 있어요.');

if (/^#[0-9a-f]{6}$/i.test(primaryColor)) pass(`브랜드 컬러 형식이 올바릅니다: ${primaryColor}`);
else fail('brand.primaryColor를 #을 포함한 6자리 HEX로 설정해 주세요.');

if (/^https:\/\//.test(icon)) pass('브랜드 아이콘이 HTTPS URL로 설정되어 있어요.');
else fail('brand.icon에 콘솔에 업로드한 600×600 로고의 HTTPS URL을 입력해 주세요.');

if (appName === 'ai-housework') {
  warn('appName이 초기 개발값(ai-housework)이에요. 콘솔의 최종 앱 ID와 같은지 확인해 주세요.');
}

if (appName) {
  for (const origin of [
    `https://${appName}.apps.tossmini.com`,
    `https://${appName}.private-apps.tossmini.com`,
  ]) {
    if (envTemplate.includes(origin)) pass(`CORS 예시값에 ${origin}이 포함되어 있어요.`);
    else fail(`ALLOWED_ORIGINS 예시값에 ${origin}을 추가해 주세요.`);
  }
}

for (const requiredVariable of [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'SESSION_SECRET',
  'ALLOWED_ORIGINS',
  'VITE_API_BASE_URL',
  'VITE_TERMS_URL',
  'VITE_PRIVACY_URL',
  'VITE_SUPPORT_URL',
]) {
  if (envTemplate.includes(`${requiredVariable}=`)) pass(`${requiredVariable} 설정 항목이 준비되어 있어요.`);
  else fail(`.env.example에 ${requiredVariable} 항목이 없어요.`);
}

const sdkVersion = packageJson.dependencies?.['@apps-in-toss/web-framework'] ?? '';
const versionNumbers = sdkVersion.match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
if (versionNumbers && (versionNumbers[0] > 1 || (versionNumbers[0] === 1 && versionNumbers[1] >= 4))) {
  pass(`CI/CD 업로드를 지원하는 SDK 버전이에요: ${sdkVersion}`);
} else {
  fail(`CI/CD 업로드에는 SDK 1.4.0 이상이 필요해요. 현재 값: ${sdkVersion || '미설정'}`);
}

const logoPath = join(root, 'public/jiptori-logo-600.png');
try {
  const logo = await readFile(logoPath);
  const isPng = logo.subarray(1, 4).toString('ascii') === 'PNG';
  const width = isPng ? logo.readUInt32BE(16) : 0;
  const height = isPng ? logo.readUInt32BE(20) : 0;
  if (isPng && width === 600 && height === 600) pass('600×600 PNG 로고 원본이 준비되어 있어요.');
  else fail(`로고 원본 규격이 600×600 PNG가 아니에요: ${width}×${height}`);
} catch {
  fail('public/jiptori-logo-600.png 로고 원본을 찾지 못했어요.');
}

const artifacts = (await readdir(root)).filter((name) => name.endsWith('.ait')).sort();
const expectedArtifact = `${appName}.ait`;
const artifactName = artifacts.includes(expectedArtifact) ? expectedArtifact : artifacts.at(-1);

if (!artifactName) {
  fail('검사할 .ait 파일이 없어요. pnpm ait:build를 먼저 실행해 주세요.');
} else {
  if (artifactName !== expectedArtifact) {
    warn(`번들 이름(${artifactName})이 현재 appName(${appName})과 달라요. 다시 빌드해 주세요.`);
  }
  const artifactPath = join(root, artifactName);
  const artifact = await readFile(artifactPath);
  const compressedSize = (await stat(artifactPath)).size;
  const uncompressedSize = uncompressedZipSize(artifact);
  if (uncompressedSize <= maxBundleBytes) {
    pass(`AIT 압축 해제 용량이 제한 이내예요: ${formatMb(uncompressedSize)} / 100MB`);
  } else {
    fail(`AIT 압축 해제 용량이 100MB를 넘어요: ${formatMb(uncompressedSize)}`);
  }
  pass(`AIT 파일 용량: ${formatMb(compressedSize)}`);
}

console.log('\n앱인토스 자동 출시 점검\n');
for (const message of passes) console.log(`✓ ${message}`);
for (const message of warnings) console.log(`! ${message}`);
for (const message of failures) console.log(`✗ ${message}`);

console.log('\n콘솔·실기기에서 직접 확인할 항목');
console.log('- 콘솔의 appName·브랜드 이름·아이콘 URL이 granite.config.ts와 같은지 확인');
console.log('- 앱 번들 업로드 후 토스앱 QR 테스트를 최소 1회 완료');
console.log('- iOS·Android에서 뒤로가기, 홈, 앱 내 기능 딥링크 확인');
console.log('- 운영 DB 동기화, 초대 참여, 충돌, 탈퇴 삭제 확인');
console.log('- 이용약관·개인정보처리방침·고객 문의 링크 확인');

if (failures.length > 0) {
  console.error(`\n출시 차단 항목 ${failures.length}개가 남아 있어요.`);
  process.exitCode = 1;
} else {
  console.log('\n자동 점검 항목을 모두 통과했어요.');
}
