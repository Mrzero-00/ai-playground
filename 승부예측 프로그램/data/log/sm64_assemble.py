"""승무패64: 근거 JSON → pure CSV (round_log pure 입력) + 요약표."""
import json,glob,csv,os,re
R='/Users/sonsang-il/orca/workspaces/ai/pacu-auto/승부예측 프로그램'
rows=[]
for p in sorted(glob.glob(f'{R}/data/근거/승무패64_*.json'), key=lambda x:int(re.search(r'승무패64_(\d+)_',x).group(1))):
    d=json.load(open(p,encoding='utf-8')); d=d[0] if isinstance(d,list) else d
    f=d.get('최종',{}); b=d.get('기준선',{}); m=d.get('득점모델',{})
    sig=sum(float(x.get('영향') or 0) for x in d.get('요인',[]))
    ps=sorted([float(f.get('승',0)),float(f.get('무',0)),float(f.get('패',0))],reverse=True); gap=ps[0]-ps[1]
    conf=d.get('확신도') or '중간'
    if d.get('기권') or gap<10: conf='기권'
    core=f"[심층 승무패64] 기준선 {b.get('승')}/{b.get('무')}/{b.get('패')}({(b.get('출처') or '')[:40]}) → 요인 Σ{sig:+.1f} → 최종 {f.get('승')}/{f.get('무')}/{f.get('패')} · λ {m.get('λ홈')}:{m.get('λ원정')} {m.get('방식','')[:30]} · {(d.get('결론') or '')[:300]}"
    rows.append({'홈':d['홈'],'원정':d['원정'],'순수_승':f.get('승'),'순수_무':f.get('무'),'순수_패':f.get('패'),'확신도':conf,'핵심근거':core,'뉴스위험':d.get('뉴스위험') or '없음(미기재)','제외':'','변수':'; '.join(f"{x.get('유형')}:{x.get('팀')}:{x.get('상태','')}:{x.get('영향')}" for x in d.get('요인',[])),'깊이':'심층','예상점수':d.get('예상점수') or f"{m.get('λ홈')}:{m.get('λ원정')}"})
    print(d['번호'],d['홈'],d['원정'],f.get('승'),f.get('무'),f.get('패'),'Σ',round(sig,1),'gap',round(gap,1),conf,'|',d.get('예상점수'))
out=f'{R}/data/pure_승무패64.csv'
w=csv.DictWriter(open(out,'w',encoding='utf-8-sig',newline=''),fieldnames=list(rows[0].keys()),lineterminator='\n'); w.writeheader(); w.writerows(rows)
print('→',out,len(rows))
