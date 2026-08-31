"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { ANSWER_OPTIONS, QUESTIONS } from "@/data/questions";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";

export default function QuestionsPage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const profile = useNyangBtiStore((state) => state.profile);
  const answers = useNyangBtiStore((state) => state.answers);
  const questionIndex = useNyangBtiStore((state) => state.questionIndex);
  const setQuestionIndex = useNyangBtiStore((state) => state.setQuestionIndex);
  const setAnswer = useNyangBtiStore((state) => state.setAnswer);
  const advancingRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTitleRef = useRef<HTMLHeadingElement>(null);

  const safeIndex = Math.min(Math.max(questionIndex, 0), QUESTIONS.length - 1);
  const question = QUESTIONS[safeIndex];
  const selectedAnswer = answers[question.id];
  const progress = ((safeIndex + 1) / QUESTIONS.length) * 100;

  useEffect(() => {
    if (hydrated && !profile.name) router.replace("/profile");
  }, [hydrated, profile.name, router]);

  useEffect(() => {
    advancingRef.current = false;
    questionTitleRef.current?.focus();
    return () => {
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    };
  }, [safeIndex]);

  if (!hydrated || !profile.name) return <HydrationScreen />;

  const goBack = () => {
    if (safeIndex === 0) router.push("/profile");
    else setQuestionIndex(safeIndex - 1);
  };

  const selectAnswer = (value: number) => {
    if (advancingRef.current) return;
    advancingRef.current = true;

    // Zustand updates (including persisted storage) synchronously, so the last
    // answer is available before the result route checks completion.
    setAnswer(question.id, value);
    advanceTimerRef.current = setTimeout(() => {
      if (safeIndex === QUESTIONS.length - 1) router.push("/result");
      else setQuestionIndex(safeIndex + 1);
    }, 120);
  };

  return (
    <main className="screen question-screen">
      <AppHeader
        backHref={safeIndex === 0 ? "/profile" : undefined}
        trailing={<span className="question-count">{safeIndex + 1} / {QUESTIONS.length}</span>}
      />

      <div className="progress-track" aria-label={`설문 진행률 ${Math.round(progress)}%`}>
        <span style={{ width: `${progress}%` }} />
      </div>

      <section className="question-content">
        <div>
          <p className="question-kicker">최근 4주의 평소 모습을 떠올려 주세요</p>
          <h1 className="question-title" ref={questionTitleRef} tabIndex={-1}>{question.prompt}</h1>
          <p className="question-example">
            <span aria-hidden="true">💡</span>
            <span>{question.example}</span>
          </p>
          {question.context ? <p className="question-context">{question.context}</p> : null}
        </div>

        <p className="sr-only" id="answer-auto-advance">답변을 선택하면 다음 화면으로 자동 이동합니다.</p>
        <div className="answer-list" role="radiogroup" aria-label="답변 선택" aria-describedby="answer-auto-advance">
          {ANSWER_OPTIONS.map((option) => {
            const selected = selectedAnswer === option.value;
            return (
              <button
                key={option.value}
                className={`option-button${selected ? " is-selected" : ""}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => selectAnswer(option.value)}
              >
                <span className="option-button__indicator" aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="question-nav">
        <button className="button button--secondary" type="button" onClick={goBack}>
          이전
        </button>
      </div>
    </main>
  );
}
