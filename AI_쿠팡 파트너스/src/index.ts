import { config } from "./config.js";
import { loadItems } from "./source.js";
import { generateContent } from "./generate.js";
import { publishImagePost } from "./instagram.js";

async function run(): Promise<void> {
  const items = await loadItems();
  console.log(`아이템 ${items.length}개 처리 시작${config.dryRun ? " (DRY RUN)" : ""}\n`);

  for (const item of items) {
    console.log(`▶ ${item.productName}`);
    try {
      const content = await generateContent(item);
      const caption = `${content.caption}\n\n${content.hashtags.join(" ")}\n\n${item.affiliateUrl}`;

      console.log("  소개 글:\n" + content.article.replace(/^/gm, "    "));
      console.log("  캡션:\n" + caption.replace(/^/gm, "    "));

      if (config.dryRun) {
        console.log("  (DRY RUN — 게시 건너뜀)\n");
        continue;
      }

      const mediaId = await publishImagePost(item.imageUrl, caption);
      console.log(`  ✔ 인스타 게시 완료 — media id: ${mediaId}\n`);
    } catch (err) {
      console.error(`  ✖ 실패: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log("완료.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
