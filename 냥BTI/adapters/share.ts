import * as tossSdk from "@apps-in-toss/web-framework";

type ShareCapableSdk = typeof tossSdk & {
  share?: (options: { message: string }) => Promise<void>;
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
