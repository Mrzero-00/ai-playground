#!/usr/bin/env python3
"""home_edge.resolve 회귀 검사 — 팀명 오매칭을 막는다.

이 저장소는 팀명 오매칭으로 네 번 사고가 났다:
  2026-10-24 맨시티 <-> 맨유 · 10-29 애들레이드 <-> 뉴캐슬
  11-02 인터 마이애미 <-> 인테르 밀란 (teamdb 리그 게이트로 해결)
  11-05 선덜랜드 <-> FC이마바리 (home_edge, 한글이 NFKD 로 분해돼 "fc" 만 남았다)

    python3 scripts/test_home_edge.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import home_edge as he

MUST = [("브라이턴","eng.1"),("크리스털","eng.1"),("입스위치","eng.1"),("셀타비고","esp.1"),
("AT마드","esp.1"),("선덜랜드","eng.1"),("비야레알","esp.1"),("오사수나","esp.1"),("풀럼","eng.1"),
("노팅엄F","eng.1"),("맨체스U","eng.1"),("맨체스C","eng.1"),("소시에다","esp.1"),("엘체","esp.1"),
("에스파뇰","esp.1"),("레반테","esp.1"),("헤타페","esp.1"),("라요바예","esp.1"),("A빌바오","esp.1"),
("A빌라","eng.1"),("뉴캐슬U","eng.1"),("첼시","eng.1"),("리버풀","eng.1"),("본머스","eng.1"),
("브렌트퍼","eng.1"),("베티스","esp.1"),("데포아코","esp.1"),("바르셀로","esp.1")]
# 별칭이 없는 이름은 추측하지 말고 '없음' 을 돌려줘야 한다
MUST_NOT = ["콜로라도", "포틀랜드", "없는팀이름", "FC", "인터", "유나이티드", "시티"]
# 한글 정규화가 깨지면 빈 문자열이 되어 서로 같아진다
NORM = [("FC이마바리", "fc이마바리"), ("선덜랜드", "선덜랜드"), ("Atlético Madrid", "atleticomadrid")]


def main():
    bad = []
    for s, want in NORM:
        got = he._norm(s)
        if got != want:
            bad.append(f"_norm({s!r}) = {got!r}, 기대 {want!r}")
    data = he.load()
    for nm, want in MUST:
        lg, t = he.resolve(nm, data)
        if lg != want:
            bad.append(f"resolve({nm!r}) -> {lg}/{t}, 기대 리그 {want}")
    for nm in MUST_NOT:
        lg, t = he.resolve(nm, data)
        if t is not None:
            bad.append(f"resolve({nm!r}) -> {lg}/{t} — 별칭 없는 이름은 매칭 금지")
    n = len(NORM) + len(MUST) + len(MUST_NOT)
    if bad:
        print(f"실패 {len(bad)}/{n}")
        for b in bad:
            print("  -", b)
        return 1
    print(f"통과 {n}/{n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
