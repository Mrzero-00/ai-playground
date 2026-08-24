"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { HydrationScreen } from "@/components/HydrationScreen";
import { HUMAN_MBTI_CODES } from "@/data/human-mbti";
import { useStoreHydration } from "@/hooks/useStoreHydration";
import { useNyangBtiStore } from "@/store/useNyangBtiStore";
import type { CatProfile } from "@/types/nyangbti";

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useStoreHydration();
  const form = useNyangBtiStore((state) => state.profile);
  const setProfile = useNyangBtiStore((state) => state.setProfile);
  const [submitted, setSubmitted] = useState(false);

  if (!hydrated) return <HydrationScreen />;

  const isValid =
    form.name.trim().length > 0 &&
    Boolean(form.sex) &&
    Boolean(form.neutered) &&
    Boolean(form.guardianMbti);

  const update = <K extends keyof CatProfile>(key: K, value: CatProfile[K]) => {
    setProfile({ ...form, [key]: value });
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
      <h1 className="form-title">먼저 고양이를<br />소개해 주세요</h1>
      <p className="lead form-lead">결과 문구를 더 다정하게 만드는 정보예요. 성향 점수에는 사용하지 않아요.</p>

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

        <div className="field-grid">
          <label className="field">
            <span className="field__label">생년월일 <small>선택</small></span>
            <input
              type="date"
              value={form.birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => update("birthDate", event.target.value)}
            />
          </label>
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
        </div>

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
          <span className="field__help">모름을 선택해도 냥BTI 결과는 동일하게 볼 수 있어요.</span>
        </label>

        {submitted && !isValid ? (
          <p className="form-error" role="alert">필수 항목을 모두 선택해 주세요.</p>
        ) : null}

        <button className="button button--primary button--wide form-submit" type="submit">
          행동 문항 시작하기 <span aria-hidden="true">→</span>
        </button>
      </form>
    </main>
  );
}
