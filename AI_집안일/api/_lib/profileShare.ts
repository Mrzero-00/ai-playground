import {
  profileShareDataFromSearchParams,
  profileShareMeta,
  profileShareSearchParams,
  type ProfileShareData,
} from '../../src/domain/profileShare.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function profileShareOrigin(headers: Record<string, string | string[] | undefined>): string {
  const rawHost = headers['x-forwarded-host'] ?? headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  const rawProtocol = headers['x-forwarded-proto'];
  const protocolValue = Array.isArray(rawProtocol) ? rawProtocol[0] : rawProtocol;
  const protocol = protocolValue === 'http' && /^localhost(?::\d+)?$/.test(host ?? '') ? 'http' : 'https';
  return host ? `${protocol}://${host}` : 'https://jiptori.vercel.app';
}

export function profileShareDataFromUrl(url: URL): ProfileShareData {
  return profileShareDataFromSearchParams(url.searchParams);
}

export function renderProfileShareHtml(data: ProfileShareData, origin: string): string {
  const meta = profileShareMeta(data);
  const query = profileShareSearchParams(data).toString();
  const canonicalUrl = `${origin}/share/profile?${query}`;
  const ogImageUrl = `${origin}/api/profile-og?${query}`;
  const logoUrl = `${origin}/jiptori-logo-600.png`;
  const safe = {
    title: escapeHtml(meta.title),
    description: escapeHtml(meta.description),
    canonicalUrl: escapeHtml(canonicalUrl),
    ogImageUrl: escapeHtml(ogImageUrl),
    logoUrl: escapeHtml(logoUrl),
    displayName: escapeHtml(data.displayName),
    ownerLabel: escapeHtml(meta.ownerLabel),
    tendencyName: escapeHtml(data.tendency.name),
    tendencyDescription: escapeHtml(data.tendency.description),
    tendencyBasis: escapeHtml(data.tendency.basis ?? '나만의 집안일 루틴'),
    levelName: escapeHtml(meta.levelName),
  };

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safe.title} | 집토리</title>
  <meta name="description" content="${safe.description}" />
  <meta name="robots" content="noindex,nofollow,noarchive" />
  <link rel="canonical" href="${safe.canonicalUrl}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="집토리" />
  <meta property="og:locale" content="ko_KR" />
  <meta property="og:title" content="${safe.title}" />
  <meta property="og:description" content="${safe.description}" />
  <meta property="og:url" content="${safe.canonicalUrl}" />
  <meta property="og:image" content="${safe.ogImageUrl}" />
  <meta property="og:image:secure_url" content="${safe.ogImageUrl}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${safe.title} 집토리 프로필 카드" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safe.title}" />
  <meta name="twitter:description" content="${safe.description}" />
  <meta name="twitter:image" content="${safe.ogImageUrl}" />
  <style>
    *{box-sizing:border-box}body{margin:0;padding:32px 20px 48px;color:#191f28;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",sans-serif}
    main{width:min(100%,520px);margin:0 auto}.brand{display:flex;align-items:center;gap:10px;margin:4px 4px 22px}.brand img{width:42px;height:42px;border-radius:12px}.brand strong{font-size:18px}.brand span{display:block;margin-top:2px;color:#8b95a1;font-size:11px}
    .card{position:relative;overflow:hidden;padding:26px;border-radius:28px;color:#fff;background:linear-gradient(145deg,#1767d5,#3182f6 58%,#64a7ff);box-shadow:0 18px 45px rgba(23,103,213,.24)}
    .eyebrow{font-size:10px;font-weight:800;letter-spacing:1.3px;opacity:.72}.hero{display:flex;align-items:center;gap:18px;margin-top:26px}.level{display:grid;width:82px;height:82px;flex:0 0 auto;place-items:center;align-content:center;border:1px solid rgba(255,255,255,.25);border-radius:24px;background:rgba(255,255,255,.12)}.level small{font-size:9px;opacity:.72}.level strong{font-size:34px;line-height:1}
    .copy small{font-size:11px;opacity:.72}.copy h1{margin:6px 0 7px;font-size:25px;letter-spacing:-.7px}.copy p{margin:0;font-size:12px;line-height:1.5;opacity:.84}.basis{display:inline-flex;margin-top:11px;padding:6px 9px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.1);font-size:10px;font-weight:750}
    .stats{display:grid;grid-template-columns:1fr 1.4fr;margin-top:24px;overflow:hidden;border:1px solid rgba(255,255,255,.2);border-radius:17px;background:rgba(255,255,255,.09)}.stats div{padding:15px}.stats div+div{border-left:1px solid rgba(255,255,255,.2)}.stats strong,.stats span{display:block}.stats strong{font-size:17px}.stats span{margin-top:4px;font-size:9px;opacity:.7}
    .notice{margin:18px 6px;color:#6b7684;font-size:12px;line-height:1.55;text-align:center}.cta{display:flex;min-height:56px;align-items:center;justify-content:center;border-radius:17px;color:#fff;background:#1570ef;font-size:15px;font-weight:800;text-decoration:none}.privacy{margin-top:13px;color:#8b95a1;font-size:10px;text-align:center}
  </style>
</head>
<body>
  <main>
    <div class="brand"><img src="${safe.logoUrl}" alt="" /><div><strong>집토리</strong><span>우리 집 루틴을 가볍게</span></div></div>
    <section class="card" aria-label="${safe.title}">
      <div class="eyebrow">JIPTORI HOUSEKEEPING PROFILE</div>
      <div class="hero"><div class="level"><small>LEVEL</small><strong>${meta.level}</strong></div><div class="copy"><small>${safe.ownerLabel} 살림 유형</small><h1>${data.tendency.icon} ${safe.tendencyName}</h1><p>${safe.tendencyDescription}</p><span class="basis">주특기 · ${safe.tendencyBasis}</span></div></div>
      <div class="stats"><div><strong>${data.completedCount}</strong><span>완료한 집안일</span></div><div><strong>${safe.levelName}</strong><span>현재 칭호</span></div></div>
    </section>
    <p class="notice">${safe.displayName}님도 집토리에서 집안일을 기록하며 나만의 살림 유형을 확인해 보세요.</p>
    <a class="cta" href="${escapeHtml(`${origin}/`)}">집토리 시작하기</a>
    <p class="privacy">공유 카드에는 집 이름, 구성원, 주소가 포함되지 않아요.</p>
  </main>
</body>
</html>`;
}
