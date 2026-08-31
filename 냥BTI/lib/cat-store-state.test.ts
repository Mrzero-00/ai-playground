import { describe, expect, it } from "vitest";
import { ASSESSMENT_VERSION } from "@/data/assessment-version";
import { migrateCatStore, patchActiveCat, removeCat, syncActiveCat } from "./cat-store-state";
import type { CatAssessment, CatProfile } from "@/types/nyangbti";

const profile = (name: string): CatProfile => ({ name, birthDate: "2022-03-04", breed: "코리안숏헤어", sex: "female", neutered: "yes", guardianMbti: "INFP" });
const cat = (id: string, name: string, answers: Record<string, number>, questionIndex: number): CatAssessment => ({ id, profile: profile(name), answers, questionIndex, assessmentVersion: ASSESSMENT_VERSION, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });

describe("cat store persistence", () => {
  it("falls back safely for malformed persisted snapshots", () => {
    expect(migrateCatStore(null, 2).cats).toEqual([]);
    expect(migrateCatStore({ profile: profile("모찌"), answers: 7 }, 2).profile.name).toBe("모찌");
    expect(migrateCatStore({ cats: [null], activeCatId: "missing" }, 3).cats).toEqual([]);
  });

  it("migrates v2 profile, answers and question index without loss", () => {
    const legacyProfile = profile("모찌");
    const migrated = migrateCatStore({ profile: legacyProfile, answers: { q01: 4, q02: 1 }, questionIndex: 12, assessmentVersion: ASSESSMENT_VERSION }, 2);
    expect(migrated.cats).toHaveLength(1);
    expect(migrated.profile).toEqual(legacyProfile);
    expect(migrated.answers).toEqual({ q01: 4, q02: 1 });
    expect(migrated.questionIndex).toBe(12);
  });

  it("keeps the v2 profile but resets stale assessment progress", () => {
    const legacyProfile = profile("구름");
    const migrated = migrateCatStore({ profile: legacyProfile, answers: { q01: 4 }, questionIndex: 9, assessmentVersion: "old" }, 2);
    expect(migrated.profile).toEqual(legacyProfile);
    expect(migrated.answers).toEqual({});
    expect(migrated.questionIndex).toBe(0);
    expect(migrated.assessmentVersion).toBe(ASSESSMENT_VERSION);
  });

  it("hydrates a valid v3 active id and falls back when it is invalid", () => {
    const cats = [cat("a", "모찌", { q01: 1 }, 1), cat("b", "두부", { q01: 3 }, 7)];
    expect(migrateCatStore({ cats, activeCatId: "b" }, 3).profile.name).toBe("두부");
    const fallback = migrateCatStore({ cats, activeCatId: "missing" }, 3);
    expect(fallback.activeCatId).toBe("a");
    expect(fallback.profile.name).toBe("모찌");
  });

  it("falls back to the first remaining cat when deleting the active cat", () => {
    const snapshot = syncActiveCat([cat("a", "모찌", {}, 0), cat("b", "두부", {}, 0)], "b");
    const next = removeCat(snapshot, "b");
    expect(next.activeCatId).toBe("a");
    expect(next.profile.name).toBe("모찌");
  });

  it("isolates answers and question indexes between cats", () => {
    const cats = [cat("a", "모찌", { q01: 1 }, 1), cat("b", "두부", { q01: 3 }, 7)];
    const firstActive = syncActiveCat(cats, "a");
    const updated = patchActiveCat(firstActive, { answers: { ...firstActive.answers, q02: 4 }, questionIndex: 2 });
    expect(updated.cats[0].answers).toEqual({ q01: 1, q02: 4 });
    expect(updated.cats[0].questionIndex).toBe(2);
    expect(updated.cats[1].answers).toEqual({ q01: 3 });
    expect(updated.cats[1].questionIndex).toBe(7);
  });
});
