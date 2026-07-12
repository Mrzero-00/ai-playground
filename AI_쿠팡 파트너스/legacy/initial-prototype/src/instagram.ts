import { config } from "./config.js";

const BASE = () => `https://graph.facebook.com/${config.instagram.apiVersion}`;

async function graphPost(path: string, params: Record<string, string>): Promise<any> {
  const body = new URLSearchParams({
    ...params,
    access_token: config.instagram.accessToken(),
  });
  const res = await fetch(`${BASE()}/${path}`, { method: "POST", body });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Graph API 오류 (${path}): ${JSON.stringify(json)}`);
  }
  return json;
}

// 이미지 1장 단일 피드 게시.
// image_url 은 인스타그램 서버가 직접 가져가므로 반드시 공개 접근 가능한 URL이어야 한다.
export async function publishImagePost(imageUrl: string, caption: string): Promise<string> {
  const userId = config.instagram.userId();

  const { id: creationId } = await graphPost(`${userId}/media`, {
    image_url: imageUrl,
    caption,
  });

  const { id: mediaId } = await graphPost(`${userId}/media_publish`, {
    creation_id: creationId,
  });

  return mediaId;
}
