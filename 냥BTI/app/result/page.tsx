"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AppHeader } from "@/components/AppHeader";
import { CharacterHero } from "@/components/CharacterHero";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { TYPE_CONTENT } from "@/data/type-content";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { calculateCompatibility } from "@/lib/compatibility";
import { calculateCatHarmony } from "@/lib/cat-harmony";
import { buildBehaviorResultCopy, getAxisPresentation, getTypePresentation } from "@/lib/result-copy";
import { getCompletedAnswerCount, scoreSurvey } from "@/lib/scoring";
import { shareMiniAppResult } from "@/adapters/share";
import { encodeSharedCatResult, readRememberedSharedCatResult } from "@/lib/shared-harmony";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

const CARE_META = {
  play: { icon: "🪶", label: "놀이" },
  environment: { icon: "⌂", label: "환경" },
  routine: { icon: "◷", label: "생활" },
  relationship: { icon: "♡", label: "관계" },
} as const;

export default function ResultPage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const profile = useNyangBtiStore((state) => state.profile);
  const answers = useNyangBtiStore((state) => state.answers);
  const cats = useNyangBtiStore((state) => state.cats);
  const clearAnswers = useNyangBtiStore((state) => state.clearAnswers);
  const addCat = useNyangBtiStore((state) => state.addCat);
  const [shareStatus, setShareStatus] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [hasRememberedShare, setHasRememberedShare] = useState(false);

  const completed = getCompletedAnswerCount(answers);
  const result = useMemo(() => scoreSurvey(answers), [answers]);
  const content = TYPE_CONTENT[result.code];
  const behaviorCopy = useMemo(
    () => buildBehaviorResultCopy(result.traits, profile.name || "고양이"),
    [profile.name, result.traits],
  );
  const typePresentation = getTypePresentation(result, content);
  const compatibility = useMemo(
    () =>
      profile.guardianMbti && profile.guardianMbti !== "unknown"
        ? calculateCompatibility(profile.guardianMbti, result.traits, profile.name || "고양이")
        : null,
    [profile.guardianMbti, profile.name, result.traits],
  );
  const catHarmonyReports = useMemo(() => {
    const completedCats = cats.filter(
      (cat) => cat.profile.name && getCompletedAnswerCount(cat.answers) === QUESTIONS.length,
    );

    return completedCats.flatMap((first, firstIndex) =>
      completedCats.slice(firstIndex + 1).map((second) => ({
        first,
        second,
        report: calculateCatHarmony(
          scoreSurvey(first.answers).traits,
          scoreSurvey(second.answers).traits,
          { firstName: first.profile.name, secondName: second.profile.name },
        ),
      })),
    );
  }, [cats]);

  useEffect(() => {
    if (!hydrated) return;
    if (!profile.name) router.replace("/profile");
    else if (completed < QUESTIONS.length) router.replace("/questions");
  }, [completed, hydrated, profile.name, router]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setHasRememberedShare(Boolean(readRememberedSharedCatResult()));
    });
    return () => { cancelled = true; };
  }, []);

  if (!hydrated || !profile.name || completed < QUESTIONS.length) return <HydrationScreen />;

  const handleShare = async () => {
    const payload = encodeSharedCatResult({ v: 1, name: profile.name, code: result.code, traits: result.traits });
    const message = `${profile.name}의 고양이 MBTI는 ${result.code}, ${typePresentation.name}!\n우리 고양이와의 생활 궁합도 확인해 보세요.`;
    setIsSharing(true);
    setShareStatus("공유 링크를 준비하고 있어요.");
    try {
      const shareResult = await shareMiniAppResult(
        `intoss://cat-mbti-00/share?shared=${encodeURIComponent(payload)}`,
        message,
      );
      setShareStatus(shareResult === "clipboard" ? "공유 문구를 복사했어요." : shareResult === "unavailable" ? "공유를 완료하지 않았어요." : "고양이 MBTI 결과를 공유했어요.");
    } catch {
      setShareStatus("공유하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSharing(false);
    }
  };

  const handleRestart = () => {
    addCat();
    router.push("/profile");
  };

  return (
    <main className="screen screen--result result-screen">
      <AppHeader backHref="/" trailing={<span className="chip">RESULT</span>} />

      <section className="result-hero">
        <p className="eyebrow">{profile.name}의 행동 성향 결과</p>
        <CharacterHero type={content} catName={profile.name} resultName={typePresentation.name} />
        <div className="result-code" aria-label={`냥비티아이 ${result.code}`}>
          {result.code.split("").map((letter, index) => (
            <span key={`${letter}-${index}`}>{letter}</span>
          ))}
        </div>
        <h1>{typePresentation.name}</h1>
        <div className="result-summary">
          <p className="result-tagline">“{typePresentation.tagline}”</p>
          <p className="result-description">{behaviorCopy.description}</p>
          <p className="result-basis">30개 행동 답변에서 드러난 생활 모습을 고양이 MBTI와 네 가지 축 설명에 함께 반영했어요.</p>
        </div>
      </section>

      <AdSlot placement="result-between-sections" />

      <section className="card section-card result-section" aria-labelledby="axis-title">
        <p className="section-number">01</p>
        <h2 className="section-heading" id="axis-title">고양이 MBTI 네 가지 축</h2>
        <p className="section-copy">각 글자의 의미와 행동 답변에서 그렇게 나타난 이유를 함께 보여줘요.</p>
        <div className="axis-list">
          {Object.values(result.axes).map((axis) => {
            const markerPosition = 100 - axis.firstScore;
            const axisPresentation = getAxisPresentation(axis, result.traits);
            return (
              <article className="axis-item" key={axis.key}>
                <div className="axis-item__header">
                  <div>
                    <strong>{axisPresentation.heading}</strong>
                    <span>{axisPresentation.description}</span>
                  </div>
                  <span className={`level-badge level-badge--${axis.level}`}>{axis.level}</span>
                </div>
                <div className="axis-bar-wrap">
                  <span className={axis.selected === axis.first ? "is-active" : ""}>{axis.first}</span>
                  <div className="axis-bar" aria-hidden="true">
                    <i style={{ left: `calc(${markerPosition}% - 7px)` }} />
                  </div>
                  <span className={axis.selected === axis.second ? "is-active" : ""}>{axis.second}</span>
                </div>
                <p>{axis.label} · {Math.round(axis.strength)}%</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card section-card result-section" aria-labelledby="tendency-title">
        <p className="section-number">02</p>
        <h2 className="section-heading" id="tendency-title">{profile.name}다운 순간</h2>
        <p className="section-copy">답변에서 가장 특징적으로 나타난 두 가지 모습이에요. 평소 어떤 장면에서 보이는지 함께 적었어요.</p>
        <ul className="feature-list feature-list--good">
          {behaviorCopy.strengths.map((strength) => (
            <li key={strength}><span aria-hidden="true">✓</span>{strength}</li>
          ))}
        </ul>
      </section>

      {compatibility ? (
        <section className="compatibility-card" aria-labelledby="compatibility-title">
          <div className="compatibility-card__top">
            <div>
              <p className="eyebrow">CAT × GUARDIAN</p>
              <h2 id="compatibility-title">집사와 {profile.name}의 생활 궁합</h2>
            </div>
            <div className="compatibility-score" aria-label={`생활 궁합 ${compatibility.score}점`}>
              <strong>{compatibility.score}</strong><span>%</span>
            </div>
          </div>
          <h3>{compatibility.title}</h3>
          <p className="compatibility-context">누가 더 좋은 성격인지 판단하는 점수가 아니에요. 가장 비슷한 생활 방식과 차이가 큰 부분을 나누어 보고, 실제 행동으로 확인할 방법까지 안내해요.</p>
          <div className="compatibility-notes">
            <article><span>가장 가까운 점</span><p>{compatibility.goodFit}</p></article>
            <article><span>맞춰 주면 좋은 점</span><p>{compatibility.adjustment}</p></article>
            <article><span>함께 지내는 팁</span><p>{compatibility.tip}</p></article>
          </div>
          <p className="compatibility-disclaimer">
            이 궁합은 30개 행동 문항에서 관찰한 성향과 사람 MBTI의 생활 스타일을 연결한 재미용 콘텐츠예요.
            과학적으로 검증된 궁합이나 심리·수의학적 진단이 아니에요.
          </p>
        </section>
      ) : (
        <section className="card section-card compatibility-empty">
          <span aria-hidden="true">♡</span>
          <div><h2>집사 궁합은 다음에</h2><p>집사 MBTI에서 ‘모름’을 선택했어요. 냥BTI 결과에는 영향이 없어요.</p></div>
        </section>
      )}

      {catHarmonyReports.length > 0 ? (
        <section className="cat-harmony-preview" aria-labelledby="cat-harmony-title">
          <div className="cat-harmony-preview__heading">
            <div>
              <p className="eyebrow">CAT × CAT</p>
              <h2 id="cat-harmony-title">우리 고양이들 생활 궁합</h2>
              <p>함께 지낼 때의 리듬과 배려 포인트를 살펴봐요.</p>
            </div>
            <Link href="/harmony">자세히 보기 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="cat-harmony-preview__list">
            {catHarmonyReports.map(({ first, second, report }) => {
              const largestGap = [...report.dimensions].sort((a, b) => b.difference - a.difference)[0];
              const largestGapLabel = largestGap.key === "social" ? "사람과의 교류 성향" : largestGap.label;
              return (
                <article className="cat-harmony-pair" key={`${first.id}-${second.id}`}>
                  <div className="cat-harmony-pair__top">
                    <div>
                      <span>{first.profile.name}</span>
                      <i aria-hidden="true">×</i>
                      <span>{second.profile.name}</span>
                    </div>
                    <strong>{report.score}<small>%</small></strong>
                  </div>
                  <h3>{report.title}</h3>
                  <p>비교 항목 중 <b>{largestGapLabel}</b> 점수 차이가 가장 커요. 실제 둘 사이에서도 같은 차이가 보이는지 살펴봐 주세요.</p>
                </article>
              );
            })}
          </div>
          <p className="cat-harmony-preview__note">점수는 성향이 얼마나 비슷한지를 재미로 표현한 값이며, 합사 성공 여부를 판단하지 않아요.</p>
        </section>
      ) : null}

      <section className="card section-card result-section" aria-labelledby="careful-title">
        <p className="section-number">03</p>
        <h2 className="section-heading" id="careful-title">조심해서 살펴볼 부분</h2>
        <p className="section-copy">부담이 될 수 있는 상황과 그 뒤에 확인할 행동을 나란히 살펴보세요. 한 번의 반응보다 평소와 다른 모습이 반복되는지가 중요해요.</p>
        <div className="split-content">
          <div>
            <h3><span aria-hidden="true">!</span> 부담이 될 수 있어요</h3>
            <ul>{behaviorCopy.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3><span aria-hidden="true">⌁</span> 관찰해 주세요</h3>
            <ul>{behaviorCopy.observationSigns.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="card section-card result-section" aria-labelledby="care-title">
        <p className="section-number">04</p>
        <h2 className="section-heading" id="care-title">오늘부터 이렇게 지내 봐요</h2>
        <p className="section-copy">모두 한꺼번에 바꾸지 않아도 괜찮아요. 가장 적용하기 쉬운 한 가지부터 시작하고 식사·배변·휴식이 편안하게 유지되는지 확인해 주세요.</p>
        <div className="care-grid">
          {(Object.keys(CARE_META) as (keyof typeof CARE_META)[]).map((key) => (
            <article key={key}>
              <span className="care-icon" aria-hidden="true">{CARE_META[key].icon}</span>
              <h3>{CARE_META[key].label}</h3>
              <p>{behaviorCopy.care[key]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="share-card" aria-labelledby="share-title">
        <div className="share-card__stamp" aria-hidden="true">🐾</div>
        <p>나만 보기 아까운 결과</p>
        <h2 id="share-title">{profile.name}의 냥BTI를<br />집사 친구에게 알려 주세요</h2>
        <button className="button button--primary button--wide" type="button" onClick={handleShare} disabled={isSharing}>
          {isSharing ? "공유 링크 준비 중…" : "고양이 MBTI 결과 공유하기"} <span aria-hidden="true">↗</span>
        </button>
        {cats.filter((cat) => getCompletedAnswerCount(cat.answers) === QUESTIONS.length).length > 1 ? (
          <Link className="button button--secondary button--wide" href="/harmony">다른 고양이와 생활 궁합 보기</Link>
        ) : null}
        {hasRememberedShare ? (
          <Link className="button button--secondary button--wide" href="/harmony">공유받은 고양이와 궁합 보기</Link>
        ) : null}
        {shareStatus ? <p className="share-status" role="status">{shareStatus}</p> : null}
      </section>

      <div className="result-footer-actions">
        <button className="text-button" type="button" onClick={handleRestart}>다른 고양이 추가하기</button>
        <button className="text-button" type="button" onClick={() => { clearAnswers(); router.push("/questions"); }}>이 고양이 다시 검사하기</button>
      </div>

      <p className="disclaimer result-disclaimer">
        냥BTI는 보호자의 관찰을 돕는 엔터테인먼트 콘텐츠입니다. 결과는 고양이의 성격을 확정하거나
        건강 상태를 진단하지 않으며, 지속되는 행동 변화는 수의사 또는 수의행동 전문가와 상의해 주세요.
      </p>
    </main>
  );
}
