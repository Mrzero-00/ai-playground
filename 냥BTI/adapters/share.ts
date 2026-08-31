import * as tossSdk from "@apps-in-toss/web-framework";

type ShareCapableSdk = typeof tossSdk & {
  share?: (options: { message: string }) => Promise<void>;
  getTossShareLink?: (path: string, ogImageUrl?: string) => Promise<string>;
};

export type ShareResult = "toss" | "browser" | "clipboard" | "unavailable";

export async function shareMessage(message: string): Promise<ShareResult> {
  const text = message.trim();
  if (!text || typeof window === "undefined") return "unavailable";

  const nativeShare = (tossSdk as ShareCapableSdk).share;
  if (typeof nativeShare === "function") {
    try {
      await nativeShare({ message: text });
      return "toss";
    } catch {
      // Fall through when the installed Toss app does not support the bridge.
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return "browser";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "browser";
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    return "clipboard";
  } catch {
    return "unavailable";
  }
}

export async function shareMiniAppResult(path: string, message: string): Promise<ShareResult> {
  const sdk = tossSdk as ShareCapableSdk;
  if (typeof sdk.getTossShareLink === "function" && typeof sdk.share === "function") {
    let link: string;
    try {
      link = await sdk.getTossShareLink(path);
    } catch {
      return shareMessage(message);
    }
    try {
      await sdk.share({ message: `${message.trim()}\n${link}` });
      return "toss";
    } catch {
      // A cancelled native share sheet must not immediately open another sheet.
      return "unavailable";
    }
  }
  return shareMessage(message);
}
