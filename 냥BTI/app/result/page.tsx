"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdSlot } from "@/components/AdSlot";
import { AppHeader } from "@/components/AppHeader";
import { CharacterHero } from "@/components/CharacterHero";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { TRAIT_META } from "@/data/traits";
import { TYPE_CONTENT } from "@/data/type-content";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { calculateCompatibility } from "@/lib/compatibility";
import { calculateCatHarmony } from "@/lib/cat-harmony";
import { getCompletedAnswerCount, getTraitLevel, scoreSurvey } from "@/lib/scoring";
import { shareMiniAppResult } from "@/adapters/share";
import { encodeSharedCatResult, readRememberedSharedCatResult } from "@/lib/shared-harmony";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";
import { TRAIT_KEYS } from "@/types/nyangbti";

const CARE_META = {
  play: { icon: "🪶", label: "놀이" },
  environment: { icon: "⌂", label: "환경" },
  routine: { icon: "◷", label: "생활" },
  relationship: { icon: "♡", label: "관계" },
} as const;

const AXIS_DESCRIPTIONS = {
  EI: { E: "사람 곁에서 에너지를 얻어요", I: "혼자만의 거리에서 편안해요" },
  NS: { N: "새로운 자극을 먼저 탐색해요", S: "익숙한 환경에서 안정돼요" },
  TF: { F: "관계와 감정 신호에 부드럽게 반응해요", T: "독립적이고 분명한 방식으로 반응해요" },
  JP: { P: "놀이와 순간의 재미를 따라가요", J: "신중하고 예측 가능한 리듬을 좋아해요" },
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
        report: calculateCatHarmony(scoreSurvey(first.answers).traits, scoreSurvey(second.answers).traits),
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
    const message = `${profile.name}의 고양이 MBTI는 ${result.code}, ${content.name}!\n우리 고양이와의 생활 궁합도 확인해 보세요.`;
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
        <CharacterHero type={content} catName={profile.name} />
        <div className="result-code" aria-label={`냥비티아이 ${result.code}`}>
          {result.code.split("").map((letter, index) => (
            <span key={`${letter}-${index}`}>{letter}</span>
          ))}
        </div>
        <h1>{content.name}</h1>
        <div className="result-summary">
          <p className="result-tagline">“{content.tagline}”</p>
          <p className="result-description">{content.description}</p>
          <p className="result-basis">최근 4주 동안 관찰한 행동을 여섯 가지 연속 성향으로 정리한 결과예요.</p>
        </div>
      </section>

      <AdSlot placement="result-between-sections" />

      <section className="card section-card result-section" aria-labelledby="axis-title">
        <p className="section-number">01</p>
        <h2 className="section-heading" id="axis-title">네 가지 냥BTI 축</h2>
        <p className="section-copy">선택한 글자에 해당하는 성향이 얼마나 또렷한지 보여줘요.</p>
        <div className="axis-list">
          {Object.values(result.axes).map((axis) => {
            const markerPosition = 100 - axis.firstScore;
            const description = AXIS_DESCRIPTIONS[axis.key][axis.selected as keyof (typeof AXIS_DESCRIPTIONS)[typeof axis.key]];
            return (
              <article className="axis-item" key={axis.key}>
                <div className="axis-item__header">
                  <div>
                    <strong>{axis.selected} 성향</strong>
                    <span>{description}</span>
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

      <section className="card section-card result-section" aria-labelledby="traits-title">
        <p className="section-number">02</p>
        <h2 className="section-heading" id="traits-title">여섯 가지 실제 성향</h2>
        <p className="section-copy">유형 글자보다 중요한, 연속적인 행동 성향이에요.</p>
        <div className="trait-list">
          {TRAIT_KEYS.map((trait) => {
            const score = result.traits[trait];
            const meta = TRAIT_META[trait];
            return (
              <article className="trait-row" key={trait}>
                <div className="trait-row__top">
                  <span><strong>{meta.label}</strong><small>{getTraitLevel(score)}</small></span>
                  <b>{Math.round(score)}</b>
                </div>
                <div className="trait-bar" aria-label={`${meta.label} ${Math.round(score)}점`}>
                  <span style={{ width: `${score}%`, background: meta.color }} />
                </div>
                <p>{meta.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card section-card result-section" aria-labelledby="tendency-title">
        <p className="section-number">03</p>
        <h2 className="section-heading" id="tendency-title">{profile.name}다운 순간</h2>
        <ul className="feature-list feature-list--good">
          {content.strengths.map((strength) => (
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
          <p className="compatibility-context">누가 더 좋은 성격인지 판단하는 점수가 아니라, 서로 편안해지도록 생활 방식을 맞추는 힌트예요.</p>
          <div className="compatibility-notes">
            <article><span>잘 맞는 점</span><p>{compatibility.goodFit}</p></article>
            <article><span>맞춰주면 좋은 점</span><p>{compatibility.adjustment}</p></article>
            <article><span>함께 지내는 팁</span><p>{compatibility.tip}</p></article>
          </div>
          <p className="compatibility-disclaimer">
            이 궁합은 고양이의 6가지 관찰 성향과 사람 MBTI의 생활 스타일을 연결한 재미용 콘텐츠예요.
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
                  <p><b>{largestGap.label}</b>에서 차이가 가장 커요. 서로의 속도를 살펴주면 좋아요.</p>
                </article>
              );
            })}
          </div>
          <p className="cat-harmony-preview__note">점수는 성향이 얼마나 비슷한지를 재미로 표현한 값이며, 합사 성공 여부를 판단하지 않아요.</p>
        </section>
      ) : null}

      <section className="card section-card result-section" aria-labelledby="careful-title">
        <p className="section-number">04</p>
        <h2 className="section-heading" id="careful-title">조심해서 살펴볼 부분</h2>
        <div className="split-content">
          <div>
            <h3><span aria-hidden="true">!</span> 부담이 될 수 있어요</h3>
            <ul>{content.cautions.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div>
            <h3><span aria-hidden="true">⌁</span> 관찰해 주세요</h3>
            <ul>{content.observationSigns.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="card section-card result-section" aria-labelledby="care-title">
        <p className="section-number">05</p>
        <h2 className="section-heading" id="care-title">오늘부터 이렇게 지내봐요</h2>
        <div className="care-grid">
          {(Object.keys(CARE_META) as (keyof typeof CARE_META)[]).map((key) => (
            <article key={key}>
              <span className="care-icon" aria-hidden="true">{CARE_META[key].icon}</span>
              <h3>{CARE_META[key].label}</h3>
              <p>{content.care[key]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="share-card" aria-labelledby="share-title">
        <div className="share-card__stamp" aria-hidden="true">🐾</div>
        <p>나만 보기 아까운 결과</p>
        <h2 id="share-title">{profile.name}의 냥BTI를<br />집사 친구에게 알려주세요</h2>
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
