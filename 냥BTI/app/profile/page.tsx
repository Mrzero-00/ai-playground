"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { HUMAN_MBTI_CODES } from "@/data/human-mbti";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";
import type { CatProfile } from "@/types/nyangbti";

const parseBirthDate = (birthDate: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    const today = new Date();
    if (
      date.getFullYear() === Number(match[1]) &&
      date.getFullYear() >= 1900 &&
      date.getMonth() === Number(match[2]) - 1 &&
      date.getDate() === Number(match[3]) &&
      date <= today
    ) {
      return { year: match[1], month: match[2], day: match[3] };
    }
  }
  return { year: "", month: "", day: "" };
};

const getDaysInMonth = (year: string, month: string) => {
  if (!year || !month) return 31;
  return new Date(Number(year), Number(month), 0).getDate();
};

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const form = useNyangBtiStore((state) => state.profile);
  const cats = useNyangBtiStore((state) => state.cats);
  const setProfile = useNyangBtiStore((state) => state.setProfile);
  const [submitted, setSubmitted] = useState(false);
  const [birthDateParts, setBirthDateParts] = useState(() => parseBirthDate(form.birthDate));
  const initializedBirthDate = useRef(false);

  useEffect(() => {
    if (hydrated && !initializedBirthDate.current) {
      const parsedBirthDate = parseBirthDate(form.birthDate);
      setBirthDateParts(parsedBirthDate);
      if (form.birthDate && !parsedBirthDate.year) {
        setProfile({ ...form, birthDate: "" });
      }
      initializedBirthDate.current = true;
    }
  }, [form, hydrated, setProfile]);

  if (!hydrated) return <HydrationScreen />;

  const isValid =
    form.name.trim().length > 0 &&
    Boolean(form.sex) &&
    Boolean(form.neutered) &&
    Boolean(form.guardianMbti);

  const update = <K extends keyof CatProfile>(key: K, value: CatProfile[K]) => {
    setProfile({ ...form, [key]: value });
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const years = Array.from({ length: currentYear - 1900 + 1 }, (_, index) => currentYear - index);
  const selectedYear = Number(birthDateParts.year);
  const selectedMonth = Number(birthDateParts.month);
  const maxMonth = selectedYear === currentYear ? today.getMonth() + 1 : 12;
  const maxDay =
    selectedYear === currentYear && selectedMonth === today.getMonth() + 1
      ? today.getDate()
      : getDaysInMonth(birthDateParts.year, birthDateParts.month);

  const updateBirthDatePart = (part: "year" | "month" | "day", value: string) => {
    const next = { ...birthDateParts, [part]: value };
    const nextMaxMonth = Number(next.year) === currentYear ? today.getMonth() + 1 : 12;
    if (Number(next.month) > nextMaxMonth) next.month = "";

    const nextMaxDay =
      Number(next.year) === currentYear && Number(next.month) === today.getMonth() + 1
        ? today.getDate()
        : getDaysInMonth(next.year, next.month);
    if (Number(next.day) > nextMaxDay) next.day = "";

    setBirthDateParts(next);
    update(
      "birthDate",
      next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : "",
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (!isValid) return;
    setProfile({ ...form, name: form.name.trim(), breed: form.breed.trim() });
    router.push("/questions");
  };

  return (
    <main className="screen profile-screen">
      <AppHeader backHref="/" />
      <p className="eyebrow">CAT PROFILE</p>
      <h1 className="form-title">{form.name ? `${form.name}의 프로필을\n확인해 주세요` : cats.length > 1 ? "새 고양이를\n소개해 주세요" : "먼저 고양이를\n소개해 주세요"}</h1>
      <p className="lead form-lead">고양이의 기본 정보를 알려 주세요. 성향은 행동 답변으로 계산하고, 집사 MBTI는 생활 궁합에만 사용해요.</p>
      <p className="profile-optional-note">여러 마리와 산다면 한 마리씩 검사해 주세요. 다른 고양이 추가는 선택 기능이에요.</p>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span className="field__label">이름 <em>필수</em></span>
          <input
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="예: 모찌"
            maxLength={20}
            autoComplete="off"
            aria-invalid={submitted && !form.name.trim()}
          />
        </label>

        <fieldset className="field fieldset-reset">
          <legend className="field__label">생년월일 <small>선택</small></legend>
          <span className="birth-date-selects">
              <select
                aria-label="태어난 연도"
                value={birthDateParts.year}
                onChange={(event) => updateBirthDatePart("year", event.target.value)}
              >
                <option value="">연도</option>
                {years.map((year) => <option key={year} value={year}>{year}년</option>)}
              </select>
              <select
                aria-label="태어난 월"
                value={birthDateParts.month}
                onChange={(event) => updateBirthDatePart("month", event.target.value)}
              >
                <option value="">월</option>
                {Array.from({ length: maxMonth }, (_, index) => index + 1).map((month) => {
                  const value = String(month).padStart(2, "0");
                  return <option key={value} value={value}>{month}월</option>;
                })}
              </select>
              <select
                aria-label="태어난 일"
                value={birthDateParts.day}
                onChange={(event) => updateBirthDatePart("day", event.target.value)}
              >
                <option value="">일</option>
                {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => {
                  const value = String(day).padStart(2, "0");
                  return <option key={value} value={value}>{day}일</option>;
                })}
              </select>
          </span>
        </fieldset>

        <label className="field">
          <span className="field__label">품종 <small>선택</small></span>
          <input
            value={form.breed}
            onChange={(event) => update("breed", event.target.value)}
            placeholder="예: 코리안숏헤어"
            maxLength={30}
            autoComplete="off"
          />
        </label>

        <fieldset className="field fieldset-reset">
          <legend className="field__label">성별 <em>필수</em></legend>
          <div className="segmented-control segmented-control--three">
            {(["female", "male", "unknown"] as const).map((value) => (
              <label key={value} className={form.sex === value ? "is-selected" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name="sex"
                  value={value}
                  checked={form.sex === value}
                  onChange={() => update("sex", value)}
                />
                {value === "female" ? "여아" : value === "male" ? "남아" : "모름"}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field fieldset-reset">
          <legend className="field__label">중성화 여부 <em>필수</em></legend>
          <div className="segmented-control segmented-control--three">
            {(["yes", "no", "unknown"] as const).map((value) => (
              <label key={value} className={form.neutered === value ? "is-selected" : ""}>
                <input
                  className="sr-only"
                  type="radio"
                  name="neutered"
                  value={value}
                  checked={form.neutered === value}
                  onChange={() => update("neutered", value)}
                />
                {value === "yes" ? "했어요" : value === "no" ? "안 했어요" : "모름"}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span className="field__label">집사님의 MBTI <em>필수</em></span>
          <select
            value={form.guardianMbti}
            onChange={(event) =>
              update("guardianMbti", event.target.value as CatProfile["guardianMbti"])
            }
            aria-invalid={submitted && !form.guardianMbti}
          >
            <option value="" disabled>선택해 주세요</option>
            <option value="unknown">잘 모르겠어요</option>
            {HUMAN_MBTI_CODES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
          <span className="field__help">집사와 고양이의 생활 궁합에만 사용해요. ‘잘 모르겠어요’를 선택해도 성향 결과는 볼 수 있어요.</span>
        </label>

        {submitted && !isValid ? (
          <p className="form-error" role="alert">필수 항목을 모두 선택해 주세요.</p>
        ) : null}

        <button className="button button--primary button--wide form-submit" type="submit">
          {Object.keys(useNyangBtiStore.getState().answers).length ? "저장하고 테스트로 돌아가기" : "행동 문항 시작하기"} <span aria-hidden="true">→</span>
        </button>
      </form>
    </main>
  );
}
