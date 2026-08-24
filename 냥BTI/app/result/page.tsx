"use client";

import { useEffect, useMemo, useState } from "react";
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
import { getCompletedAnswerCount, getTraitLevel, scoreSurvey } from "@/lib/scoring";
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

const BEHAVIOR_CHECK_ITEMS = [
  "식욕이 눈에 띄게 달라졌어요",
  "활동량이 갑자기 크게 줄었어요",
  "숨는 시간이 부쩍 늘었어요",
  "공격 행동이 갑자기 늘었어요",
  "화장실·배변 습관이 달라졌어요",
  "그루밍이 크게 늘거나 줄었어요",
  "울음소리가 갑자기 많아졌어요",
];

const BEHAVIOR_CHECK_CLEAR = "해당하는 변화가 없어요";

export default function ResultPage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const profile = useNyangBtiStore((state) => state.profile);
  const answers = useNyangBtiStore((state) => state.answers);
  const reset = useNyangBtiStore((state) => state.reset);
  const [shareStatus, setShareStatus] = useState("");
  const [checkedSignals, setCheckedSignals] = useState<string[]>([]);

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

  useEffect(() => {
    if (!hydrated) return;
    if (!profile.name) router.replace("/profile");
    else if (completed < QUESTIONS.length) router.replace("/questions");
  }, [completed, hydrated, profile.name, router]);

  if (!hydrated || !profile.name || completed < QUESTIONS.length) return <HydrationScreen />;

  const handleShare = async () => {
    const compatibilityText = compatibility
      ? ` 집사 ${profile.guardianMbti}와의 생활 궁합은 ${compatibility.score}%!`
      : "";
    const text = `${profile.name}의 냥BTI는 ${result.code}, ${content.name}!${compatibilityText}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `${profile.name}의 냥BTI`, text, url: window.location.href });
        setShareStatus("공유 창을 열었어요.");
      } else {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`);
        setShareStatus("결과 문구를 복사했어요.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("공유하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  const handleRestart = () => {
    reset();
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
        <p className="result-tagline">“{content.tagline}”</p>
        <p className="result-description">{content.description}</p>
      </section>

      <section className="card section-card result-section" aria-labelledby="axis-title">
        <p className="section-number">01</p>
        <h2 className="section-heading" id="axis-title">네 가지 냥BTI 축</h2>
        <p className="section-copy">선택된 글자의 경향이 얼마나 또렷한지 보여줘요.</p>
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
              <h2 id="compatibility-title">{profile.name} × {profile.guardianMbti}</h2>
            </div>
            <div className="compatibility-score" aria-label={`생활 궁합 ${compatibility.score}점`}>
              <strong>{compatibility.score}</strong><span>%</span>
            </div>
          </div>
          <h3>{compatibility.title}</h3>
          <div className="compatibility-notes">
            <article><span>잘 맞는 점</span><p>{compatibility.goodFit}</p></article>
            <article><span>맞춰주면 좋은 점</span><p>{compatibility.adjustment}</p></article>
            <article><span>함께 지내는 팁</span><p>{compatibility.tip}</p></article>
          </div>
          <p className="compatibility-disclaimer">
            이 궁합은 고양이의 6가지 관찰 성향과 사람 MBTI의 생활 스타일을 연결한 재미용 콘텐츠예요.
            과학적 궁합이나 심리·수의학적 진단이 아닙니다.
          </p>
        </section>
      ) : (
        <section className="card section-card compatibility-empty">
          <span aria-hidden="true">♡</span>
          <div><h2>집사 궁합은 다음에</h2><p>MBTI를 모름으로 선택했어요. 냥BTI 결과에는 영향이 없어요.</p></div>
        </section>
      )}

      <AdSlot placement="result-between-sections" />

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

      <section className="behavior-check" aria-labelledby="behavior-title">
        <div className="behavior-check__heading">
          <span aria-hidden="true">＋</span>
          <div>
            <p className="eyebrow">BEHAVIOR CHECK</p>
            <h2 id="behavior-title">최근 달라진 행동이 있나요?</h2>
          </div>
        </div>
        <p>냥BTI 점수와는 별개예요. 평소와 다른 변화만 가볍게 확인해 보세요.</p>
        <div className="behavior-options">
          {BEHAVIOR_CHECK_ITEMS.map((item) => {
            const checked = checkedSignals.includes(item);
            return (
              <label key={item} className={checked ? "is-checked" : ""}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setCheckedSignals((current) =>
                      checked
                        ? current.filter((value) => value !== item)
                        : [...current.filter((value) => value !== BEHAVIOR_CHECK_CLEAR), item],
                    )
                  }
                />
                <span>{item}</span>
              </label>
            );
          })}
          <label className={checkedSignals.includes(BEHAVIOR_CHECK_CLEAR) ? "is-checked" : ""}>
            <input
              type="checkbox"
              checked={checkedSignals.includes(BEHAVIOR_CHECK_CLEAR)}
              onChange={() =>
                setCheckedSignals((current) =>
                  current.includes(BEHAVIOR_CHECK_CLEAR) ? [] : [BEHAVIOR_CHECK_CLEAR],
                )
              }
            />
            <span>{BEHAVIOR_CHECK_CLEAR}</span>
          </label>
        </div>
        {checkedSignals.some((item) => item !== BEHAVIOR_CHECK_CLEAR) ? (
          <p className="behavior-alert" role="status">
            이런 변화가 계속되거나 통증·식욕 저하가 함께 보인다면 기록해 두고 수의사와 상담해 주세요.
            이 안내는 질병을 판단하거나 진단하지 않습니다.
          </p>
        ) : checkedSignals.includes(BEHAVIOR_CHECK_CLEAR) ? (
          <p className="behavior-clear">평소 모습을 꾸준히 관찰해 주세요.</p>
        ) : (
          <p className="behavior-clear">해당하는 항목을 선택해 주세요. 이 선택은 냥BTI 점수에 반영되지 않아요.</p>
        )}
      </section>

      <section className="share-card" aria-labelledby="share-title">
        <div className="share-card__stamp" aria-hidden="true">🐾</div>
        <p>나만 보기 아까운 결과</p>
        <h2 id="share-title">{profile.name}의 냥BTI를<br />집사 친구에게 알려주세요</h2>
        <button className="button button--primary button--wide" type="button" onClick={handleShare}>
          결과 공유하기 <span aria-hidden="true">↗</span>
        </button>
        {shareStatus ? <p className="share-status" role="status">{shareStatus}</p> : null}
      </section>

      <div className="result-footer-actions">
        <button className="text-button" type="button" onClick={handleRestart}>다른 고양이 테스트하기</button>
      </div>

      <p className="disclaimer result-disclaimer">
        냥BTI는 보호자의 관찰을 돕는 엔터테인먼트 콘텐츠입니다. 결과는 고양이의 성격을 확정하거나
        건강 상태를 진단하지 않으며, 지속되는 행동 변화는 수의사 또는 수의행동 전문가와 상의해 주세요.
      </p>
    </main>
  );
}
