import csv,json,collections
hist=collections.defaultdict(list)
for r in csv.DictReader(open("data/배당이력.csv",encoding="utf-8-sig")):
    try: hist[(r["회차"],r["번호"],r["선택"])].append((r["scan_time"],float(r["베트맨"]),float(r["공정확률"])))
    except: pass
D=[]
for r in csv.DictReader(open("data/스캔기록.csv",encoding="utf-8-sig")):
    if r["hit"] not in("0","1"): continue
    try: od=float(r["베트맨"]); p=float(r["공정확률"]); ev=float(r["기대값"])
    except: continue
    h=sorted(hist.get((r["회차"],r["번호"],r["선택"]),[]))
    o_od,o_p=(h[0][1],h[0][2]) if h else (od,p)
    D.append(dict(rd=int(r["회차"]),sport=r["종목"],lg=r["리그"],typ=r["유형"],gub=r["구분"],sel=r["선택"],od=od,p=p,ev=ev,src=r["근거"],hit=int(r["hit"]),
                  dp=p-o_p,dod=od-o_od,ev_open=o_p/100*o_od,nh=len(h)))
json.dump(D,open("data/roi_ds.json","w"),ensure_ascii=False)
print(len(D), sum(1 for d in D if d["nh"]>1))
