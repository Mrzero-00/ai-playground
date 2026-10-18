import json,itertools,random
D=json.load(open("data/roi_ds.json"))
TR=[d for d in D if d["rd"]<=121]; TE=[d for d in D if d["rd"]>=122]
def roi(S): 
    n=len(S); return (sum(d["od"]*d["hit"] for d in S)/n if n else 0), n
def boot(S,k=2000):
    if not S: return (0,0)
    v=[]
    for _ in range(k):
        s=[random.choice(S) for _ in S]; v.append(sum(d["od"]*d["hit"] for d in s)/len(s))
    v.sort(); return v[int(.05*k)],v[int(.95*k)]
typ=lambda d:"일반" if d["typ"] in("승무패","일반 승패") else ("핸디캡" if "핸디캡" in d["typ"] else ("언오" if "언더오버" in d["typ"] else "기타"))
rules=[]
for evmin in (0.90,0.93,0.95,0.97,1.00,1.02):
  for pmin in (35,45,50,55,60,65):
    for odmax in (1.6,2.0,2.5,3.0):
      for dp in (None,0,1,2):          # 핀나클 확률이 처음보다 dp%p 이상 상승(선택지 쪽으로 이동)
        for dod in (None,0):           # 베트맨 배당이 내려가지 않음(지연)
          for t in (None,"일반","핸디캡","언오"):
            for sp in (None,"축구","야구"):
              f=lambda d,evmin=evmin,pmin=pmin,odmax=odmax,dp=dp,dod=dod,t=t,sp=sp: d["ev"]>=evmin and d["p"]>=pmin and d["od"]<=odmax and (dp is None or d["dp"]>=dp) and (dod is None or d["dod"]>=dod) and (t is None or typ(d)==t) and (sp is None or d["sport"]==sp) and d["src"]=="직접"
              r,n=roi([d for d in TR if f(d)])
              if n>=25: rules.append((r,n,(evmin,pmin,odmax,dp,dod,t,sp),f))
rules.sort(key=lambda x:-x[0])
print("학습(116~121) 상위 15 규칙 → 검증(122~123)")
for r,n,k,f in rules[:15]:
    S=[d for d in TE if f(d)]; rt,nt=roi(S); lo,hi=boot(S)
    print(f"  학습 ROI {r:.2f}(n{n}) | 검증 ROI {rt:.2f}(n{nt}, 90%구간 {lo:.2f}~{hi:.2f}) | ev≥{k[0]} p≥{k[1]} 배당≤{k[2]} Δp≥{k[3]} 배당유지{k[4]} {k[5]} {k[6]}")
# simple baselines
for nm,f in (("전체(직접)",lambda d:d["src"]=="직접"),("ev≥0.95",lambda d:d["ev"]>=0.95 and d["src"]=="직접"),("ev≥1.0",lambda d:d["ev"]>=1.0 and d["src"]=="직접"),("ev≥1.0 p≥50",lambda d:d["ev"]>=1.0 and d["p"]>=50 and d["src"]=="직접")):
    a=roi([d for d in TR if f(d)]); b=roi([d for d in TE if f(d)]); print(f"기준 {nm}: 학습 {a[0]:.2f}(n{a[1]}) 검증 {b[0]:.2f}(n{b[1]}) 90%구간 {boot([d for d in TE if f(d)])}")
