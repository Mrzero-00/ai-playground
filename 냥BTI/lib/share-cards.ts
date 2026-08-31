import { CHARACTER_ASSETS } from "@/data/character-assets";
import { TRAIT_META } from "@/data/traits";
import type { CompatibilityResult, NyangBtiResult, TypeContent } from "@/types/nyangbti";
import { TRAIT_KEYS } from "@/types/nyangbti";

const WIDTH = 1080;
const HEIGHT = 1350;
const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';

type ShareCardInput = {
  catName: string;
  guardianMbti?: string;
  result: NyangBtiResult;
  content: TypeContent;
  compatibility: CompatibilityResult | null;
};

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  return { canvas, ctx: canvas.getContext("2d")! };
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius = 32) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, size: number, color = "#25221f", weight = 700) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillText(value, x, y);
}

function fittedText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color = "#25221f",
  weight = 700,
  minSize = 22,
) {
  let fittedSize = size;
  ctx.font = `${weight} ${fittedSize}px ${FONT}`;
  while (fittedSize > minSize && ctx.measureText(value).width > maxWidth) {
    fittedSize -= 2;
    ctx.font = `${weight} ${fittedSize}px ${FONT}`;
  }
  ctx.fillStyle = color;
  ctx.fillText(value, x, y, maxWidth);
}

function wrap(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) {
  const lines: string[] = [];
  let line = "";
  for (const char of [...value]) {
    if (char === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    if (ctx.measureText(line + char).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line || !lines.length) lines.push(line);

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[maxLines - 1].trimEnd();
    while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[maxLines - 1] = `${lastLine}…`;
  }
  visibleLines.forEach((visibleLine, index) => ctx.fillText(visibleLine, x, y + index * lineHeight));
}

function base(ctx: CanvasRenderingContext2D, content: TypeContent, page: number, title: string) {
  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = content.palette.secondary;
  ctx.fillRect(0, 0, WIDTH, 220);
  text(ctx, "냥BTI RESULT", 72, 94, 26, content.palette.primary, 800);
  fittedText(ctx, title, 72, 172, 790, 54);
  text(ctx, `${page} / 5`, 910, 92, 24, "#706b64", 600);
  text(ctx, "나의 고양이를 더 잘 관찰하는 시간 · nyangbti", 72, 1290, 22, "#8b837b", 500);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function blobFrom(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG 이미지를 만들지 못했어요."))), "image/png"),
  );
}

export async function createShareCardFiles(input: ShareCardInput): Promise<File[]> {
  await document.fonts?.ready;
  const character = await loadImage(CHARACTER_ASSETS[input.result.code]);
  const canvases: HTMLCanvasElement[] = [];

  {
    const { canvas, ctx } = makeCanvas();
    base(ctx, input.content, 1, `${input.catName}의 냥BTI`);
    ctx.fillStyle = input.content.palette.secondary;
    roundedRect(ctx, 72, 265, 936, 930, 52);
    ctx.fill();
    const imageSize = 560;
    ctx.drawImage(character, (WIDTH - imageSize) / 2, 300, imageSize, imageSize);
    ctx.textAlign = "center";
    text(ctx, input.result.code, WIDTH / 2, 930, 112, input.content.palette.primary, 900);
    fittedText(ctx, input.content.name, WIDTH / 2, 1015, 880, 48);
    ctx.font = `600 30px ${FONT}`;
    ctx.fillStyle = "#5e5751";
    wrap(ctx, `“${input.content.tagline}”`, WIDTH / 2, 1080, 780, 42, 2);
    ctx.textAlign = "start";
    canvases.push(canvas);
  }

  {
    const { canvas, ctx } = makeCanvas();
    base(ctx, input.content, 2, `${input.catName}다운 순간`);
    ctx.font = `600 34px ${FONT}`;
    ctx.fillStyle = "#4c4641";
    wrap(ctx, input.content.description, 72, 310, 900, 52, 5);
    input.content.strengths.forEach((item, index) => {
      const y = 590 + index * 210;
      ctx.fillStyle = "#ffffff";
      roundedRect(ctx, 72, y, 936, 160, 34);
      ctx.fill();
      text(ctx, `0${index + 1}`, 112, y + 64, 26, input.content.palette.primary, 800);
      ctx.font = `700 34px ${FONT}`;
      ctx.fillStyle = "#282522";
      wrap(ctx, item, 112, y + 112, 830, 44, 2);
    });
    canvases.push(canvas);
  }

  {
    const { canvas, ctx } = makeCanvas();
    base(ctx, input.content, 3, "성향 한눈에 보기");
    text(ctx, "네 가지 냥BTI 축", 72, 295, 32);
    Object.values(input.result.axes).forEach((axis, index) => {
      const x = 72 + (index % 2) * 474;
      const y = 340 + Math.floor(index / 2) * 150;
      ctx.fillStyle = "#ffffff";
      roundedRect(ctx, x, y, 438, 116, 24);
      ctx.fill();
      text(ctx, `${axis.selected}  ${axis.label}`, x + 28, y + 49, 27, input.content.palette.primary);
      text(ctx, `${Math.round(axis.strength)}% · ${axis.level}`, x + 28, y + 88, 22, "#777069", 600);
    });
    text(ctx, "여섯 가지 실제 성향", 72, 690, 32);
    TRAIT_KEYS.forEach((trait, index) => {
      const score = Math.round(input.result.traits[trait]);
      const y = 740 + index * 78;
      text(ctx, TRAIT_META[trait].label, 72, y + 26, 24, "#3b3733", 650);
      ctx.fillStyle = "#eee8df";
      roundedRect(ctx, 230, y, 650, 30, 15);
      ctx.fill();
      ctx.fillStyle = TRAIT_META[trait].color;
      roundedRect(ctx, 230, y, 650 * (score / 100), 30, 15);
      ctx.fill();
      text(ctx, String(score), 915, y + 27, 24, "#48423d", 700);
    });
    canvases.push(canvas);
  }

  {
    const { canvas, ctx } = makeCanvas();
    base(ctx, input.content, 4, "고양이 × 집사 생활 궁합");
    if (input.compatibility) {
      ctx.textAlign = "center";
      text(ctx, `${input.compatibility.score}%`, WIDTH / 2, 440, 150, input.content.palette.primary, 900);
      fittedText(ctx, `${input.catName} × ${input.guardianMbti}`, WIDTH / 2, 510, 880, 38);
      fittedText(ctx, input.compatibility.title, WIDTH / 2, 590, 880, 42);
      ctx.textAlign = "start";
      const notes = [
        ["잘 맞는 점", input.compatibility.goodFit],
        ["맞춰주면 좋은 점", input.compatibility.adjustment],
        ["함께 지내는 팁", input.compatibility.tip],
      ];
      notes.forEach(([label, copy], index) => {
        const y = 665 + index * 170;
        text(ctx, label, 88, y, 24, input.content.palette.primary, 800);
        ctx.font = `600 29px ${FONT}`;
        ctx.fillStyle = "#403b37";
        wrap(ctx, copy, 88, y + 48, 890, 42, 2);
      });
    } else {
      ctx.textAlign = "center";
      text(ctx, "♡", WIDTH / 2, 520, 150, input.content.palette.primary, 500);
      text(ctx, "집사 궁합은 다음에", WIDTH / 2, 650, 54);
      ctx.font = `600 30px ${FONT}`;
      ctx.fillStyle = "#665f59";
      wrap(ctx, "집사 MBTI를 ‘모름’으로 선택했어요.\n냥BTI 결과에는 영향이 없어요.", WIDTH / 2, 730, 780, 48, 3);
      ctx.textAlign = "start";
    }
    canvases.push(canvas);
  }

  {
    const { canvas, ctx } = makeCanvas();
    base(ctx, input.content, 5, "오늘부터 이렇게 지내봐요");
    const entries = [
      ["놀이", input.content.care.play],
      ["환경", input.content.care.environment],
      ["생활", input.content.care.routine],
      ["관계", input.content.care.relationship],
    ];
    entries.forEach(([label, copy], index) => {
      const y = 280 + index * 225;
      ctx.fillStyle = index % 2 === 0 ? input.content.palette.secondary : "#ffffff";
      roundedRect(ctx, 72, y, 936, 180, 34);
      ctx.fill();
      text(ctx, label, 110, y + 62, 30, input.content.palette.primary, 800);
      ctx.font = `600 29px ${FONT}`;
      ctx.fillStyle = "#3f3a36";
      wrap(ctx, copy, 110, y + 112, 830, 42, 2);
    });
    canvases.push(canvas);
  }

  const safeName = input.catName.replace(/[\\/:*?"<>|]/g, "-");
  return Promise.all(canvases.map(async (canvas, index) => new File(
    [await blobFrom(canvas)],
    `${safeName}-냥BTI-${index + 1}.png`,
    { type: "image/png" },
  )));
}
