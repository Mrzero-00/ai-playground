"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdSlot } from "@/components/AdSlot";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { CHARACTER_ASSETS } from "@/data/character-assets";
import { QUESTIONS } from "@/data/questions";
import { TYPE_CONTENT } from "@/data/type-content";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { getCompletedAnswerCount, scoreSurvey } from "@/lib/scoring";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export default function HomePage() {
  const router = useRouter();
  const [homeCharacter] = useState(() => {
    const characters = Object.values(CHARACTER_ASSETS);
    return characters[Math.floor(Math.random() * characters.length)];
  });
  const hydrated = useStoreHydration();
  const profile = useNyangBtiStore((state) => state.profile);
  const answers = useNyangBtiStore((state) => state.answers);
  const clearAnswers = useNyangBtiStore((state) => state.clearAnswers);
  const cats = useNyangBtiStore((state) => state.cats);
  const activeCatId = useNyangBtiStore((state) => state.activeCatId);
  const addCat = useNyangBtiStore((state) => state.addCat);
  const selectCat = useNyangBtiStore((state) => state.selectCat);
  const deleteCat = useNyangBtiStore((state) => state.deleteCat);

  if (!hydrated) return <HydrationScreen />;

  const answered = getCompletedAnswerCount(answers);
  const hasProgress = Boolean(profile.name) && answered > 0;
  const continueHref = answered === QUESTIONS.length ? "/result" : "/questions";
  const completedCats = cats.filter((cat) => getCompletedAnswerCount(cat.answers) === QUESTIONS.length);
  const addAnotherCat = () => {
    addCat();
    router.push("/profile");
  };

  return (
    <main className="screen screen--warm home-screen">
      <AppHeader trailing={<span className="chip">행동 성향 · 생활 궁합</span>} />

      <section className="home-hero">
        <p className="eyebrow">MY CAT, SIX TRAITS</p>
        <h1 className="display-title">
          우리 고양이를 이해하고
          <br />함께 사는 방법까지
        </h1>
        <p className="lead">
          최근 4주의 행동 30가지를 떠올려 보세요.
          <br />성향을 알아보고 생활 궁합도 살펴봐요.
        </p>

        <div className="home-cat" role="img" aria-label="탐험을 떠나는 냥BTI 고양이 캐릭터">
          <Image
            className="home-cat__image"
            src={homeCharacter}
            alt=""
            width={768}
            height={768}
            priority
            aria-hidden="true"
          />
        </div>
      </section>

      <section className="home-service-guide" aria-labelledby="service-guide-title">
        <p className="eyebrow">WHAT YOU CAN SEE</p>
        <h2 id="service-guide-title">성향부터 관계까지 한 번에 봐요</h2>
        <div className="home-service-guide__grid">
          <article><span aria-hidden="true">01</span><h3>고양이 행동 성향</h3><p>평소 행동을 여섯 가지 연속 성향과 16가지 캐릭터로 정리해요.</p></article>
          <article><span aria-hidden="true">02</span><h3>고양이 × 집사</h3><p>집사 MBTI와 고양이 성향을 비교해 편안한 생활 리듬을 찾아요.</p></article>
          <article><span aria-hidden="true">03</span><h3>고양이 × 고양이</h3><p>여러 고양이의 거리·놀이·환경 적응을 비교하고 생활 팁을 확인해요.</p></article>
        </div>
        <p className="home-service-guide__optional">한 마리만 검사해도 괜찮아요. 다른 고양이 추가와 고양이끼리 궁합 보기는 선택 기능이에요.</p>
      </section>

      {cats.length > 1 ? (
        <section className="cat-family" aria-labelledby="cat-family-title">
          <div className="cat-family__heading">
            <div><p className="eyebrow">MY CAT FAMILY</p><h2 id="cat-family-title">우리 집 고양이</h2></div>
            <button type="button" onClick={addAnotherCat}>+ 고양이 추가</button>
          </div>
          <div className="cat-family__list">
            {cats.map((cat) => {
              const count = getCompletedAnswerCount(cat.answers);
              const complete = count === QUESTIONS.length;
              const result = complete ? scoreSurvey(cat.answers) : null;
              const resultContent = result ? TYPE_CONTENT[result.code] : null;
              return (
                <article className={`cat-profile-card${cat.id === activeCatId ? " is-active" : ""}${complete ? " is-complete" : ""}`} key={cat.id}>
                  <button className="cat-profile-card__main" type="button" onClick={() => selectCat(cat.id)} aria-pressed={cat.id === activeCatId}>
                    <span className="cat-profile-card__avatar" aria-hidden="true">
                      {result ? <Image src={CHARACTER_ASSETS[result.code]} alt="" width={96} height={96} /> : "🐈"}
                    </span>
                    <span className="cat-profile-card__info">
                      <strong>{cat.profile.name || "새 고양이"}</strong>
                      {result && resultContent ? (
                        <span className="cat-profile-card__result">
                          <span><b>{result.code}</b>{resultContent.name}</span>
                          <small>{resultContent.tagline}</small>
                        </span>
                      ) : (
                        <small>{cat.profile.name ? `${count}/30 진행 중` : "프로필 작성 전"}</small>
                      )}
                    </span>
                    <i aria-hidden="true">{cat.id === activeCatId ? "선택됨" : "선택"}</i>
                  </button>
                  <div className="cat-profile-card__actions">
                    <Link href={cat.profile.name ? (complete ? "/result" : "/questions") : "/profile"} onClick={() => selectCat(cat.id)}>{complete ? "결과 보기" : cat.profile.name ? "이어하기" : "프로필 작성"}</Link>
                    <Link href="/profile" onClick={() => selectCat(cat.id)}>수정</Link>
                    <button type="button" onClick={() => { if (window.confirm(`${cat.profile.name || "이 고양이"}의 프로필과 검사 기록을 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) deleteCat(cat.id); }}>삭제</button>
                  </div>
                </article>
              );
            })}
          </div>
          {completedCats.length >= 2 ? <Link className="button button--secondary button--wide harmony-entry" href="/harmony">고양이끼리 생활 조화 보기 <span aria-hidden="true">→</span></Link> : null}
        </section>
      ) : null}

      <section className="home-actions" aria-label="테스트 시작">
        {hasProgress ? (
          <>
            <Link className="button button--primary button--wide" href={continueHref}>
              {profile.name}의 테스트 이어하기
              <span aria-hidden="true">→</span>
            </Link>
            <button className="text-button" type="button" onClick={clearAnswers}>
              이 고양이 다시 검사하기
            </button>
            <button className="text-button home-add-cat" type="button" onClick={addAnotherCat}>다른 고양이 추가하기</button>
          </>
        ) : (
          <Link className="button button--primary button--wide" href="/profile">
            우리 고양이 성향 알아보기
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

      <AdSlot placement="home-after-primary-action" />

      <p className="disclaimer home-disclaimer">
        보호자의 관찰을 바탕으로 한 엔터테인먼트 콘텐츠예요. 성격·건강·행동 문제를 진단하거나
        합사 성공 여부를 판단하지 않아요.
      </p>
    </main>
  );
}
