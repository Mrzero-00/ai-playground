import { resolve } from 'node:path';
import { createCapsuleServer } from './app';

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('PORT must be between 1 and 65535.');

const app = createCapsuleServer({
  databasePath: process.env.CAPSULE_DATABASE_PATH ?? resolve('.data/capsules.sqlite'),
});

app.server.listen(port, host, () => {
  console.info(`묻어두지 테스트 API: http://${host}:${port}`);
  console.info('같은 Wi-Fi의 iPhone에서는 이 Mac의 LAN IP를 사용하세요.');
  console.info('개발 검증 전용: 편지·사진·음성·영상이 이 Mac의 SQLite 파일에 암호화 없이 저장됩니다.');
});

app.server.on('error', (error) => {
  console.error('API 서버를 시작할 수 없습니다:', error.message);
  void app.close().finally(() => { process.exitCode = 1; });
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => { void app.close(); });
}
