import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { unstable_createNodejsStream } from '@vercel/og';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getProfileLevel } from '../src/domain/profileInsights.js';
import { profileShareDataFromUrl, profileShareOrigin } from './_lib/profileShare.js';

const profileFonts = Promise.all([
  readFile(join(process.cwd(), 'api/assets/Pretendard-Regular.woff')),
  readFile(join(process.cwd(), 'api/assets/Pretendard-ExtraBold.woff')),
]).then(([regular, extraBold]) => ({
  regular: Uint8Array.from(regular).buffer,
  extraBold: Uint8Array.from(extraBold).buffer,
}));

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const origin = profileShareOrigin(req.headers);
  const requestUrl = new URL(req.url ?? '/api/profile-og', origin);
  const data = profileShareDataFromUrl(requestUrl);
  const { level, levelName } = getProfileLevel(data.completedCount);
  const ownerLabel = data.displayName === '나' ? '나의' : `${data.displayName}님의`;
  const fonts = await profileFonts;

  const stream = await unstable_createNodejsStream(
    <div style={{ width: '100%', height: '100%', display: 'flex', padding: 54, color: '#ffffff', background: '#f5f8fc', fontFamily: 'Pretendard' }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '44px 52px', borderRadius: 42, background: 'linear-gradient(145deg,#1767d5 0%,#3182f6 58%,#64a7ff 100%)' }}>
        <div style={{ position: 'absolute', top: -105, right: -80, width: 300, height: 300, display: 'flex', borderRadius: 999, background: 'rgba(255,255,255,.08)' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ width: 72, height: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 18, background: '#fff8ec' }}>
              <svg width="56" height="56" viewBox="0 0 60 60">
                <path d="M8 27.5 30 9l22 18.5V52H8V27.5Z" fill="#3182F6" stroke="#3182F6" strokeLinejoin="round" strokeWidth="4" />
                <path d="M22 52V34h16v18" fill="#FFF8EC" />
                <circle cx="46" cy="13" r="10" fill="#FFB84D" />
                <path d="m41.5 13 3 3 6-7" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
              </svg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', fontSize: 27, fontWeight: 800 }}>집토리 살림 프로필</div>
              <div style={{ display: 'flex', marginTop: 4, fontSize: 15, letterSpacing: 2, opacity: .7 }}>JIPTORI HOUSEKEEPING PROFILE</div>
            </div>
          </div>
          <div style={{ display: 'flex', padding: '12px 18px', border: '1px solid rgba(255,255,255,.24)', borderRadius: 999, fontSize: 18, fontWeight: 700, background: 'rgba(255,255,255,.1)' }}>{`#${data.tendency.basis ?? '살림 탐험'}`}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 34, marginTop: 38 }}>
          <div style={{ width: 126, height: 126, display: 'flex', flexDirection: 'column', flex: '0 0 auto', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,.28)', borderRadius: 34, background: 'rgba(255,255,255,.12)' }}>
            <div style={{ display: 'flex', fontSize: 14, fontWeight: 700, letterSpacing: 1.5, opacity: .72 }}>LEVEL</div>
            <div style={{ display: 'flex', marginTop: 2, fontSize: 58, fontWeight: 900, lineHeight: 1 }}>{level}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 19, opacity: .72 }}>{`${ownerLabel} 살림 유형`}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 6, fontSize: 52, fontWeight: 900, letterSpacing: -2 }}>{data.tendency.name}</div>
            <div style={{ display: 'flex', marginTop: 6, fontSize: 20, opacity: .82 }}>{data.tendency.description}</div>
          </div>
        </div>

        <div style={{ display: 'flex', marginTop: 'auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.2)', borderRadius: 22, background: 'rgba(255,255,255,.1)' }}>
          <div style={{ width: '34%', display: 'flex', flexDirection: 'column', padding: '20px 24px' }}>
            <div style={{ display: 'flex', fontSize: 32, fontWeight: 900 }}>{`${data.completedCount}개`}</div>
            <div style={{ display: 'flex', marginTop: 3, fontSize: 14, opacity: .68 }}>완료한 집안일</div>
          </div>
          <div style={{ width: '40%', display: 'flex', flexDirection: 'column', padding: '20px 24px', borderLeft: '1px solid rgba(255,255,255,.2)' }}>
            <div style={{ display: 'flex', fontSize: 27, fontWeight: 850 }}>{levelName}</div>
            <div style={{ display: 'flex', marginTop: 3, fontSize: 14, opacity: .68 }}>현재 칭호</div>
          </div>
          <div style={{ width: '26%', display: 'flex', flexDirection: 'column', padding: '20px 24px', borderLeft: '1px solid rgba(255,255,255,.2)' }}>
            <div style={{ display: 'flex', fontSize: 25, fontWeight: 850 }}>{data.tendency.basis ?? '탐험 중'}</div>
            <div style={{ display: 'flex', marginTop: 3, fontSize: 14, opacity: .68 }}>주특기</div>
          </div>
        </div>
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Pretendard', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Pretendard', data: fonts.extraBold, weight: 800, style: 'normal' },
      ],
    },
  );

  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, immutable, no-transform, max-age=31536000');
  stream.pipe(res);
}
