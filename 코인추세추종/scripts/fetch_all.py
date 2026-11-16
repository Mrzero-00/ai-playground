"""업비트 원화마켓 전 종목 일봉. 이미 받은 파일은 건너뛴다.
주의: 상장폐지된 코인은 API 에 없어서 생존자 편향이 남는다.
"""
import json, urllib.request
from fetch import fetch, DATA

markets = [m["market"] for m in json.load(urllib.request.urlopen("https://api.upbit.com/v1/market/all"))
           if m["market"].startswith("KRW-")]
print(f"원화마켓 {len(markets)}개")
for m in markets:
    if not (DATA / f"{m}.csv").exists():
        try:
            fetch(m)
        except Exception as e:
            print(m, "실패", e)
