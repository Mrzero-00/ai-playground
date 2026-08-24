"use client";

import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { getCompletedAnswerCount } from "@/lib/scoring";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export default function HomePage() {
  const hydrated = useStoreHydration();
  const profile = useNyangBtiStore((state) => state.profile);
  const answers = useNyangBtiStore((state) => state.answers);
  const reset = useNyangBtiStore((state) => state.reset);

  if (!hydrated) return <HydrationScreen />;

  const answered = getCompletedAnswerCount(answers);
  const hasProgress = Boolean(profile.name) && answered > 0;
  const continueHref = answered === QUESTIONS.length ? "/result" : "/questions";

  return (
    <main className="screen screen--warm home-screen">
      <AppHeader trailing={<span className="chip">행동 성향 테스트</span>} />

      <section className="home-hero">
        <p className="eyebrow">MY CAT, SIX TRAITS</p>
        <h1 className="display-title">
          우리 고양이의
          <br />진짜 성향은?
        </h1>
        <p className="lead">
          최근 4주의 일상 행동 30가지를 떠올리며
          <br />여섯 가지 성향과 냥BTI를 알아봐요.
        </p>

        <div className="home-cat" role="img" aria-label="상자 속에서 고개를 내민 고양이 캐릭터">
          <span className="home-cat__tail" aria-hidden="true" />
          <span className="home-cat__box" aria-hidden="true" />
          <span className="home-cat__head" aria-hidden="true">= ᆺ =</span>
          <span className="home-cat__label" aria-hidden="true">HELLO</span>
        </div>
      </section>

      <section className="home-actions" aria-label="테스트 시작">
        {hasProgress ? (
          <>
            <Link className="button button--primary button--wide" href={continueHref}>
              {profile.name}의 테스트 이어하기
              <span aria-hidden="true">→</span>
            </Link>
            <button className="text-button" type="button" onClick={reset}>
              새 고양이로 다시 시작
            </button>
          </>
        ) : (
          <Link className="button button--primary button--wide" href="/profile">
            냥BTI 시작하기
            <span aria-hidden="true">→</span>
          </Link>
        )}
        <div className="home-meta">
          <span>30문항</span>
          <i aria-hidden="true" />
          <span>약 6분</span>
          <i aria-hidden="true" />
          <span>기기 저장</span>
        </div>
      </section>

      <p className="disclaimer home-disclaimer">
        냥BTI는 보호자가 관찰한 행동을 이해하기 위한 엔터테인먼트 콘텐츠이며,
        성격 검사나 수의학적 진단을 대신하지 않아요.
      </p>
    </main>
  );
}
