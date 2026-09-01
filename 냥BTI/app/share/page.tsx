"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { CharacterHero } from "@/components/CharacterHero";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { TYPE_CONTENT } from "@/data/type-content";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { buildBehaviorResultCopy, getTypePresentation } from "@/lib/result-copy";
import { calculateAxes, getCompletedAnswerCount } from "@/lib/scoring";
import { withJosa } from "@/lib/korean";
import { decodeSharedCatResult, rememberSharedCatResult } from "@/lib/shared-harmony";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export default function SharePage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const cats = useNyangBtiStore((state) => state.cats);
  const addCat = useNyangBtiStore((state) => state.addCat);
  const [payload, setPayload] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const queryPayload = new URLSearchParams(window.location.search).get("shared");
    const shared = decodeSharedCatResult(queryPayload);
    if (shared && queryPayload) rememberSharedCatResult(queryPayload);
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setPayload(shared ? queryPayload : null);
    });
    return () => { cancelled = true; };
  }, []);

  const shared = useMemo(() => decodeSharedCatResult(payload), [payload]);
  const hasCompletedCat = cats.some(
    (cat) => cat.profile.name && getCompletedAnswerCount(cat.answers) === QUESTIONS.length,
  );

  if (!hydrated || payload === undefined) return <HydrationScreen />;

  if (!shared || !payload) {
    return (
      <main className="screen share-screen">
        <AppHeader backHref="/" />
        <section className="share-invalid">
          <span aria-hidden="true">🐾</span>
          <h1>공유 결과를 불러올 수 없어요</h1>
          <p>링크가 오래되었거나 올바르지 않은 것 같아요. 홈에서 고양이 MBTI를 직접 시작해 보세요.</p>
          <Link className="button button--primary button--wide" href="/">홈으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  const content = TYPE_CONTENT[shared.code];
  const sharedResult = { code: shared.code, traits: shared.traits, axes: calculateAxes(shared.traits) };
  const behaviorCopy = buildBehaviorResultCopy(shared.traits, shared.name);
  const typePresentation = getTypePresentation(sharedResult, content);
  const harmonyHref = `/harmony?shared=${encodeURIComponent(payload)}`;

  return (
    <main className="screen share-screen">
      <AppHeader backHref="/" trailing={<span className="chip">SHARED</span>} />
      <section className="share-preview" aria-labelledby="share-preview-title">
        <p className="eyebrow">A CAT RESULT ARRIVED</p>
        <CharacterHero type={content} catName={shared.name} resultName={typePresentation.name} />
        <div className="share-preview__type">{shared.code}</div>
        <h1 id="share-preview-title">{withJosa(shared.name, "은/는")}<br />{typePresentation.name}</h1>
        <p className="share-preview__tagline">“{typePresentation.tagline}”</p>
        <p className="share-preview__description">{behaviorCopy.description}</p>
      </section>

      <section className="share-features" aria-label="고양이 MBTI 주요 기능">
        <span>행동 성향</span><span>고양이 × 집사</span><span>고양이 × 고양이</span>
        <p>일상 행동을 바탕으로 성향을 살펴보고, 함께 생활하는 관계의 궁합과 맞춤 팁을 확인해요.</p>
      </section>

      <section className="share-invite">
        <span aria-hidden="true">🐾</span>
        <div>
          <h2>{withJosa(shared.name, "과/와")} 우리 고양이의 궁합을 확인해 보세요</h2>
          <p>두 고양이의 생활 리듬과 서로 배려하면 좋은 점, 함께 지내는 팁을 볼 수 있어요.</p>
        </div>
      </section>

      {hasCompletedCat ? (
        <Link className="button button--primary button--wide share-screen__cta" href={harmonyHref}>우리 고양이와 생활 궁합 보기 <span aria-hidden="true">→</span></Link>
      ) : (
        <button className="button button--primary button--wide share-screen__cta" type="button" onClick={() => { addCat(); router.push("/profile"); }}>우리 집 고양이도 검사하기 <span aria-hidden="true">→</span></button>
      )}
      <p className="disclaimer share-screen__disclaimer">이 공유 결과에는 고양이 이름과 행동 성향만 담겨 있어요. 생년월일, 품종, 성별, 집사 MBTI와 문항별 답변은 공유되지 않아요.</p>
    </main>
  );
}
