// Do not send automated pan/zoom tests to public OSM tile servers.
// This deliberately labelled SVG is a UI-only test double, not geographic data.
const sharp = require('sharp');
const tile = sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#eaf0e9"/><path d="M0 90H256M80 0V256M190 0V256M0 210H256" stroke="#fffdfa" stroke-width="15"/><rect x="94" y="103" width="80" height="90" rx="14" fill="#d5e4d7"/><text x="10" y="35" font-size="10" fill="#60747c">UI 검사 · 지도 대역 (실제 지형 아님)</text></svg>')).png().toBuffer();
exports.stubMapTiles = async context => {
  const body = await tile;
  await context.route('https://tile.openstreetmap.org/**', route => route.fulfill({ contentType: 'image/png', body, headers: { 'access-control-allow-origin': '*' } }));
};
