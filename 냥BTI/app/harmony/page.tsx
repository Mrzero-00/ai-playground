"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { QUESTIONS } from "@/data/questions";
import { CHARACTER_ASSETS } from "@/data/character-assets";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { calculateCatHarmony } from "@/lib/cat-harmony";
import { getCompletedAnswerCount, scoreSurvey } from "@/lib/scoring";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export default function HarmonyPage() {
  const hydrated = useStoreHydration();
  const cats = useNyangBtiStore((state) => state.cats);
  const completed = useMemo(() => cats.filter((cat) => getCompletedAnswerCount(cat.answers) === QUESTIONS.length), [cats]);
  const [firstId, setFirstId] = useState("");
  const [secondId, setSecondId] = useState("");
  const first = completed.find((cat) => cat.id === (firstId || completed[0]?.id));
  const second = completed.find((cat) => cat.id === (secondId || completed.find((cat) => cat.id !== first?.id)?.id));
  const firstResult = first ? scoreSurvey(first.answers) : null;
  const secondResult = second ? scoreSurvey(second.answers) : null;
  const report = first && second && firstResult && secondResult ? calculateCatHarmony(firstResult.traits, secondResult.traits, { firstName: first.profile.name, secondName: second.profile.name }) : null;

  if (!hydrated) return <HydrationScreen />;
  if (completed.length < 2) return <main className="screen harmony-screen"><AppHeader backHref="/" /><section className="harmony-empty"><span aria-hidden="true">🐾</span><h1>두 고양이의 결과가 필요해요</h1><p>각 고양이의 행동 문항을 완료하면 생활 리듬을 나란히 볼 수 있어요.</p><Link className="button button--primary button--wide" href="/">홈으로 돌아가기</Link></section></main>;

  return (
    <main className="screen harmony-screen">
      <AppHeader backHref="/" trailing={<span className="chip">CAT × CAT</span>} />
      <p className="eyebrow">LIVING HARMONY</p><h1 className="form-title">우리 고양이들의<br />생활 조화 리포트</h1>
      <p className="lead form-lead">누가 더 좋은 성격인지 판단하지 않고, 함께 지낼 때의 속도와 자원 배치 힌트를 찾아봐요.</p>
      <section className="harmony-picker" aria-label="비교할 고양이 선택">
        <label><span>첫 번째 고양이</span><select value={first?.id} onChange={(event) => { setFirstId(event.target.value); if (event.target.value === second?.id) setSecondId(completed.find((cat) => cat.id !== event.target.value)?.id ?? ""); }}>{completed.filter((cat) => cat.id !== second?.id || cat.id === first?.id).map((cat) => <option value={cat.id} key={cat.id}>{cat.profile.name}</option>)}</select></label>
        <span aria-hidden="true">×</span>
        <label><span>두 번째 고양이</span><select value={second?.id} onChange={(event) => setSecondId(event.target.value)}>{completed.filter((cat) => cat.id !== first?.id).map((cat) => <option value={cat.id} key={cat.id}>{cat.profile.name}</option>)}</select></label>
      </section>
      {report && first && second && firstResult && secondResult ? <>
        <section className="harmony-summary"><p>{first.profile.name} × {second.profile.name}</p><strong>{report.score}<small>%</small></strong><h2>{report.title}</h2><p>점수는 관찰 성향의 리듬이 얼마나 비슷한지 재미로 표현한 값이에요.</p></section>
        <section className="card section-card harmony-report"><h2 className="section-heading">생활 리듬 나란히 보기</h2><div className="harmony-legend"><span><i />{first.profile.name}</span><span><i />{second.profile.name}</span></div>{report.dimensions.map((item) => <article key={item.label}><h3>{item.label}<small>{item.difference < 16 ? "비슷해요" : item.difference < 31 ? "조금 달라요" : "차이가 있어요"}</small></h3><div className="harmony-bars"><span style={{ width: `${item.first}%` }} /><span style={{ width: `${item.second}%` }} /></div><p>{item.note}</p></article>)}</section>
        <section className="card section-card individual-care"><p className="eyebrow">INDIVIDUAL CARE</p><h2 className="section-heading">고양이별로 살펴볼 점</h2><div className="individual-care__grid">{report.careGuides.map((guide, index) => {
          const result = index === 0 ? firstResult : secondResult;
          return <article key={guide.name} className={index === 0 ? "is-first" : "is-second"}><h3><span className="individual-care__avatar" aria-hidden="true"><Image src={CHARACTER_ASSETS[result.code]} alt="" width={80} height={80} /></span>{guide.name}에게</h3><p>{guide.summary}</p><ul>{guide.cautions.map((tip) => <li key={tip}>{tip}</li>)}</ul></article>;
        })}</div></section>
        <section className="card section-card together-tips"><p className="eyebrow">TOGETHER TIPS</p><h2 className="section-heading">둘 사이를 조율하는 생활 팁</h2><ul>{report.sharedTips.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
        <section className="card section-card resource-tips"><p className="eyebrow">COMMON CARE</p><h2 className="section-heading">두 고양이에게 공통으로 지켜주세요</h2><ul>{report.commonCautions.map((tip) => <li key={tip}>{tip}</li>)}</ul></section>
        <p className="disclaimer harmony-disclaimer">이 리포트는 보호자가 답한 연속 성향을 비교한 엔터테인먼트 콘텐츠입니다. 합사 성공 여부, 서열, 건강 또는 행동 문제를 판정하지 않아요.</p>
      </> : null}
    </main>
  );
}
