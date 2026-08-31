"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { CHARACTER_ASSETS } from "@/data/character-assets";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { calculateCatHarmony } from "@/lib/cat-harmony";
import { withJosa } from "@/lib/korean";
import { decodeSharedCatResult, readRememberedSharedCatResult, rememberSharedCatResult } from "@/lib/shared-harmony";
import { getCompletedAnswerCount, scoreSurvey } from "@/lib/scoring";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";
import type { NyangBtiCode, TraitScores } from "@/types/nyangbti";

interface HarmonyCandidate {
  id: string;
  name: string;
  code: NyangBtiCode;
  traits: TraitScores;
  source: "local" | "shared";
}

export default function HarmonyPage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const cats = useNyangBtiStore((state) => state.cats);
  const addCat = useNyangBtiStore((state) => state.addCat);
  const [sharedPayload, setSharedPayload] = useState<string | null>(null);
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");

  useEffect(() => {
    const queryPayload = new URLSearchParams(window.location.search).get("shared");
    const payload = decodeSharedCatResult(queryPayload) ? queryPayload : readRememberedSharedCatResult();
    let cancelled = false;
    if (payload) {
      rememberSharedCatResult(payload);
      queueMicrotask(() => {
        if (!cancelled) setSharedPayload(payload);
      });
    }
    return () => { cancelled = true; };
  }, []);

  const shared = useMemo(() => decodeSharedCatResult(sharedPayload), [sharedPayload]);
  const completed = useMemo<HarmonyCandidate[]>(() => cats
    .filter((cat) => getCompletedAnswerCount(cat.answers) === QUESTIONS.length)
    .map((cat) => {
      const result = scoreSurvey(cat.answers);
      return { id: cat.id, name: cat.profile.name, code: result.code, traits: result.traits, source: "local" };
    }), [cats]);
  const candidates = useMemo<HarmonyCandidate[]>(() => shared
    ? [...completed, { id: "shared", name: shared.name, code: shared.code, traits: shared.traits, source: "shared" }]
    : completed, [completed, shared]);

  const defaultFirstId = shared && completed.length ? completed[0].id : candidates[0]?.id;
  const resolvedFirstId = candidates.some((cat) => cat.id === firstId) ? firstId : defaultFirstId;
  const defaultSecondId = shared && resolvedFirstId !== "shared"
    ? "shared"
    : candidates.find((cat) => cat.id !== resolvedFirstId)?.id;
  const resolvedSecondId = candidates.some((cat) => cat.id === secondId && cat.id !== resolvedFirstId) ? secondId : defaultSecondId;
  const first = candidates.find((cat) => cat.id === resolvedFirstId);
  const second = candidates.find((cat) => cat.id === resolvedSecondId);
  const report = first && second
    ? calculateCatHarmony(first.traits, second.traits, { firstName: first.name, secondName: second.name })
    : null;

  if (!hydrated) return <HydrationScreen />;

  if (candidates.length < 2) {
    return (
      <main className="screen harmony-screen">
        <AppHeader backHref="/" />
        <section className="harmony-empty">
          <span aria-hidden="true">🐾</span>
          <h1>{shared ? `${withJosa(shared.name, "과/와")} 우리 고양이의 궁합을 볼까요?` : "두 고양이의 결과가 필요해요"}</h1>
          <p>{shared ? "우리 고양이의 행동 문항을 완료하면 공유받은 결과와 생활 리듬을 비교해 드려요." : "각 고양이의 행동 문항을 완료하면 생활 리듬을 나란히 볼 수 있어요."}</p>
          {shared ? (
            <button className="button button--primary button--wide" type="button" onClick={() => { addCat(); router.push("/profile"); }}>우리 고양이 검사하고 궁합 보기</button>
          ) : (
            <Link className="button button--primary button--wide" href="/">홈으로 돌아가기</Link>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="screen harmony-screen">
      <AppHeader backHref="/" trailing={<span className="chip">CAT × CAT</span>} />
      {shared ? <p className="eyebrow">SHARED RESULT</p> : <p className="eyebrow">LIVING HARMONY</p>}
      <h1 className="form-title">고양이끼리<br />생활 궁합 리포트</h1>
      <p className="lead form-lead">활동량·놀이·사회성·환경 적응 리듬을 비교해, 각자에게 필요한 거리와 자원 배치 팁을 찾아봐요.</p>
      <section className="harmony-picker" aria-label="비교할 고양이 선택">
        <label><span>첫 번째 고양이</span><select value={first?.id ?? ""} onChange={(event) => { setFirstId(event.target.value); if (event.target.value === second?.id) setSecondId(candidates.find((cat) => cat.id !== event.target.value)?.id ?? ""); }}>{candidates.filter((cat) => cat.id !== second?.id || cat.id === first?.id).map((cat) => <option value={cat.id} key={cat.id}>{cat.name}{cat.source === "shared" ? " · 공유받음" : ""}</option>)}</select></label>
        <span aria-hidden="true">×</span>
        <label><span>두 번째 고양이</span><select value={second?.id ?? ""} onChange={(event) => setSecondId(event.target.value)}>{candidates.filter((cat) => cat.id !== first?.id).map((cat) => <option value={cat.id} key={cat.id}>{cat.name}{cat.source === "shared" ? " · 공유받음" : ""}</option>)}</select></label>
      </section>
      {report && first && second ? <>
        <section className="harmony-summary"><p>{first.name} × {second.name}</p><strong>{report.score}<small>%</small></strong><span>생활 리듬 유사도</span><h2>{report.title}</h2><p>점수는 관찰된 성향의 생활 리듬이 얼마나 비슷한지를 재미로 표현한 값이에요.</p></section>
        <section className="card section-card harmony-report"><h2 className="section-heading">생활 리듬 나란히 보기</h2><div className="harmony-legend"><span><i />{first.name}</span><span><i />{second.name}</span></div>{report.dimensions.map((item) => <article key={item.label}><h3>{item.label}<small>{item.difference < 16 ? "비슷해요" : item.difference < 31 ? "조금 달라요" : "차이가 있어요"}</small></h3><div className="harmony-bars"><span style={{ width: `${item.first}%` }} /><span style={{ width: `${item.second}%` }} /></div><p>{item.note}</p></article>)}</section>
        <section className="card section-card individual-care"><p className="eyebrow">INDIVIDUAL CARE</p><h2 className="section-heading">고양이별로 살펴볼 점</h2><div className="individual-care__grid">{report.careGuides.map((guide, index) => {
          const candidate = index === 0 ? first : second;
          return <article key={`${guide.name}-${index}`} className={index === 0 ? "is-first" : "is-second"}><h3><span className="individual-care__avatar" aria-hidden="true"><Image src={CHARACTER_ASSETS[candidate.code]} alt="" width={80} height={80} /></span>{guide.name}에게</h3><p>{guide.summary}</p><ul>{guide.cautions.map((tip) => <li key={tip}>{tip}</li>)}</ul></article>;
        })}</div></section>
        <section className="card section-card together-tips"><p className="eyebrow">TOGETHER TIPS</p><h2 className="section-heading">둘 사이를 조율하는 생활 팁</h2><ul>{report.sharedTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
        <section className="card section-card resource-tips"><p className="eyebrow">COMMON CARE</p><h2 className="section-heading">두 고양이에게 공통으로 지켜주세요</h2><ul>{report.commonCautions.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
        <p className="disclaimer harmony-disclaimer">재미를 위한 생활 성향 비교예요. 친밀도·서열·합사 성공 여부나 건강·행동 문제를 판정하지 않아요.</p>
      </> : null}
    </main>
  );
}
