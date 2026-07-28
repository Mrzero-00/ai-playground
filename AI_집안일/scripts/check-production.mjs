const baseUrl = (process.argv[2] || process.env.JIPTORI_PRODUCTION_URL || 'https://jiptori.vercel.app').replace(/\/+$/, '');
const failures = [];

async function requestJson(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: 'error',
    ...options,
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => ({}))
    : { error: `JSON이 아닌 응답이에요: ${contentType || 'content-type 없음'}` };
  return { response, body };
}

console.log(`\n집토리 운영 API 확인: ${baseUrl}\n`);

try {
  const health = await requestJson('/api/health');
  if (health.response.ok && health.body.ok === true) {
    console.log('✓ 데이터베이스 상태 확인 API가 정상이에요.');
  } else {
    failures.push(`/api/health ${health.response.status}: ${health.body.error ?? '상태 확인 실패'}`);
  }

  const session = await requestJson('/api/session');
  if (!session.response.ok) {
    failures.push(`/api/session ${session.response.status}: ${session.body.error ?? '세션 초기화 실패'}`);
  } else {
    console.log('✓ 익명 사용자 세션을 만들 수 있어요.');
    const cookie = session.response.headers.get('set-cookie')?.split(';', 1)[0];
    if (!cookie) {
      failures.push('/api/session 응답에 브라우저 폴백 쿠키가 없어요.');
    } else {
      const state = await requestJson('/api/state', { headers: { Cookie: cookie } });
      if (state.response.ok && state.body.version === 2) {
        console.log('✓ 새 사용자의 상태 데이터를 불러올 수 있어요.');
      } else {
        failures.push(`/api/state ${state.response.status}: ${state.body.error ?? '상태 불러오기 실패'}`);
      }
    }
  }
} catch (error) {
  failures.push(error instanceof Error ? error.message : '운영 API 요청에 실패했어요.');
}

if (failures.length) {
  for (const failure of failures) console.error(`✗ ${failure}`);
  console.error(`\n운영 차단 항목 ${failures.length}개가 남아 있어요.`);
  process.exitCode = 1;
} else {
  console.log('\n운영 API 기본 점검을 통과했어요.');
}
