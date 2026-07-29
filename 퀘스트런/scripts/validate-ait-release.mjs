import { existsSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import process from 'node:process';

const mode = process.argv[2] ?? 'config';
const projectRoot = process.cwd();
const expectedAppName = 'quest-run';
const appName = process.env.AIT_APP_NAME;
const brandIconUrl = process.env.AIT_BRAND_ICON_URL;

if (appName !== expectedAppName) {
  fail(`AIT_APP_NAME은 앱인토스 콘솔의 앱 ID와 같은 "${expectedAppName}"이어야 합니다.`);
}

if (brandIconUrl == null || brandIconUrl.trim() === '') {
  fail('AIT_BRAND_ICON_URL이 비어 있습니다. 콘솔에 브랜드 아이콘을 업로드한 뒤 HTTPS 링크를 설정하세요.');
}

if (!brandIconUrl.startsWith('https://')) {
  fail('AIT_BRAND_ICON_URL은 라이브 토스앱에서 접근 가능한 HTTPS 주소여야 합니다.');
}

if (brandIconUrl.includes('example.com')) {
  fail('AIT_BRAND_ICON_URL의 예시 주소를 실제 앱인토스 콘솔 이미지 링크로 교체하세요.');
}

const configSource = readFileSync(resolve(projectRoot, 'granite.config.ts'), 'utf8');

if (!configSource.includes("appType: 'general'")) {
  fail("러닝 서비스는 앱인토스 비게임 타입(appType: 'general')으로 빌드해야 합니다.");
}

if (mode === 'artifact') {
  validateArtifact(resolve(projectRoot, `${expectedAppName}.ait`));
}

process.stdout.write(
  mode === 'artifact'
    ? '앱인토스 출시 설정과 .ait 아티팩트 검증을 통과했습니다.\n'
    : '앱인토스 출시 설정 검증을 통과했습니다.\n'
);

function validateArtifact(artifactPath) {
  if (!existsSync(artifactPath)) {
    fail(`${artifactPath} 파일이 없습니다. 먼저 pnpm release:build를 실행하세요.`);
  }

  const compressedBytes = statSync(artifactPath).size;
  const zipResult = spawnSync('unzip', ['-Z', '-t', artifactPath], { encoding: 'utf8' });
  const zipOutput = `${zipResult.stdout ?? ''}\n${zipResult.stderr ?? ''}`;
  const uncompressedMatch = zipOutput.match(/(\d+) bytes uncompressed/);

  if (uncompressedMatch == null) {
    fail('아티팩트의 압축 해제 용량을 확인하지 못했습니다. unzip 명령과 .ait 파일을 확인하세요.');
  }

  const uncompressedBytes = Number(uncompressedMatch[1]);
  const maximumBytes = 100 * 1024 * 1024;

  if (uncompressedBytes > maximumBytes) {
    fail(`.ait 압축 해제 용량이 100MB를 초과합니다: ${formatMb(uncompressedBytes)}MB`);
  }

  process.stdout.write(
    `아티팩트 용량: 압축 ${formatMb(compressedBytes)}MB / 압축 해제 ${formatMb(uncompressedBytes)}MB\n`
  );
}

function formatMb(bytes) {
  return (bytes / 1024 / 1024).toFixed(2);
}

function fail(message) {
  process.stderr.write(`출시 점검 실패: ${message}\n`);
  process.exit(1);
}
