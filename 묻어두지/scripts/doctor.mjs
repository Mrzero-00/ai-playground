import { spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const section = (title, value) => console.log(`${title}: ${value}`);
const command = (name, args) => {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout: 20_000 });
  return result.status === 0 ? result.stdout.trim() : '미설치 또는 확인 불가';
};
console.log('묻어두지 · 개발 환경 확인\n');
section('Node', process.version);
section('Expo / React Native', `${pkg.dependencies.expo} / ${pkg.dependencies['react-native']}`);
section('AR', `${pkg.dependencies['@reactvision/react-viro']} · 실기기 개발 빌드 필요`);
section('의존성', existsSync(new URL('../node_modules/expo/package.json', import.meta.url)) ? '설치됨' : 'npm install 필요');
if (process.platform === 'darwin') {
  section('Xcode', command('xcodebuild', ['-version']).replaceAll('\n', ' / '));
  section('iPhone 연결', command('xcrun', ['devicectl', 'list', 'devices']));
}
section('Android 연결', command('adb', ['devices']));
console.log('\n같은 Wi-Fi 휴대폰에서 사용할 API 주소 후보:');
for (const [name, entries] of Object.entries(networkInterfaces())) {
  if (!/^(en|eth|wlan|Wi-Fi)/.test(name)) continue;
  for (const entry of entries || []) {
    if (entry.family === 'IPv4' && !entry.internal) console.log(`  http://${entry.address}:8787 (${name})`);
  }
}
try {
  const result = await fetch('http://127.0.0.1:8787/health', { signal: AbortSignal.timeout(3_000) });
  section('\n로컬 API', result.ok ? '정상 응답' : `HTTP ${result.status}`);
} catch { section('\n로컬 API', '꺼져 있음 · npm run server로 시작'); }
console.log('\n브라우저는 화면 확인용입니다. 실제 카메라 AR은 아이폰/안드로이드에서 확인하세요.');
