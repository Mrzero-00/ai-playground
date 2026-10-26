import sys, glob, os, json, statistics as st
S=os.path.dirname(os.path.abspath(__file__))
names={'p1':'①통계','p2':'②결장','p3':'③시장','p4':'④전술','p5':'⑤이변'}
data={}
for f in sorted([f for f in glob.glob(f'{S}/panel_p*.txt') if '_r1' not in f]):
    k=os.path.basename(f)[6:8]
    for l in open(f,encoding='utf-8'):
        p=l.rstrip('\n').split('|')
        if len(p)<7 or not p[0].isdigit(): continue
        n=int(p[0]); data.setdefault(n,{})[k]={'name':p[1],'h':float(p[2]),'d':float(p[3]),'a':float(p[4]),'mark':p[5],'why':p[6]}
lab={'h':'승','d':'무','a':'패'}
rows=[]
print("가중치 ②0.3 ⑤0.3 ④0.2 ①0.2 ③0(참고)\n\n| # | 경기 | "+" | ".join(names[k] for k in sorted(names))+" | 평균 승/무/패 | 1순위 | 판정 |")
print("|---|---|"+"---|"*len(names)+"---|---|---|")
for n in sorted(data):
    ex=data[n]; name=next(iter(ex.values()))['name']
    W={'p1':0.2,'p2':0.3,'p3':0.0,'p4':0.2,'p5':0.3}  # 분석규칙 [시험] 가중치, ③시장 0
    wsum=sum(W.get(k,0) for k in ex) or 1
    avg={c: round(sum(ex[k][c]*W.get(k,0) for k in ex)/wsum,0) for c in 'hda'}
    tops=[max('hda',key=lambda c:ex[k][c]) for k in ex]
    top=max('hda',key=lambda c:avg[c]); second=sorted('hda',key=lambda c:-avg[c])[1]
    maxs=[ex[k][top] for k in ex]; spread=max(maxs)-min(maxs)
    agree=len(set(tops))==1
    if not agree: verdict='불일치(1순위 다름) → 복수'
    elif spread>=15: verdict=f'폭 {spread:.0f}p → 복수 검토'
    elif avg[top]-avg[second]<8: verdict='박빙 → 복수'
    else: verdict='일치 → 단일'
    cells=[]
    for k in sorted(names):
        e=ex.get(k); cells.append(f"{e['h']:.0f}/{e['d']:.0f}/{e['a']:.0f} {e['mark']}" if e else '-')
    print(f"| {n} | {name} | "+" | ".join(cells)+f" | {avg['h']:.0f}/{avg['d']:.0f}/{avg['a']:.0f} | {lab[top]} {avg[top]:.0f} | {verdict} |")
    rows.append({'n':n,'name':name,'avg':avg,'top':lab[top],'verdict':verdict,'experts':ex})
json.dump(rows,open(f'{S}/panel_agg.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
