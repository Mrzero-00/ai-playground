import {describe,expect,it,vi} from 'vitest';
import {assessNews,FinnhubNewsProvider,SecEdgarNewsProvider} from '../packages/news/src/index.js';

describe('free news providers',()=>{
  it('normalizes Finnhub news without treating an aggregator as an official source',async()=>{
    const fetcher=vi.fn(async()=>new Response(JSON.stringify([{id:7,category:'company',datetime:Date.parse('2026-07-16T01:00:00Z')/1000,headline:'ACME raises guidance',related:'ACME',source:'Example',summary:'Revenue was above expectations',url:'https://example.com/story'}]),{status:200}));
    const [item]=await new FinnhubNewsProvider('secret',fetcher as typeof fetch).recent('ACME',new Date('2026-07-15T00:00:00Z'));
    expect(item?.id).toBe('finnhub:7');expect(item?.quality.verified).toBe(false);expect(String(fetcher.mock.calls[0]?.[0])).toContain('token=secret');
  });
  it('normalizes an official SEC filing and declares the user agent',async()=>{
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).includes('company_tickers')
      ?new Response(JSON.stringify({'0':{cik_str:1234,ticker:'ACME',title:'Acme'}}),{status:200})
      :new Response(JSON.stringify({filings:{recent:{accessionNumber:['0000001234-26-000001'],filingDate:['2026-07-16'],acceptanceDateTime:['2026-07-16T01:00:00Z'],form:['8-K'],primaryDocument:['acme.htm'],primaryDocDescription:['Current report']}}}),{status:200}));
    const [item]=await new SecEdgarNewsProvider('Trading Bot bot@example.com',fetcher as typeof fetch).recent('ACME',new Date('2026-07-15T00:00:00Z'));
    expect(item?.quality.verified).toBe(true);expect(item?.quality.sourceUrl).toContain('/1234/000000123426000001/acme.htm');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({headers:expect.objectContaining({'user-agent':'Trading Bot bot@example.com'})});
  });
});

describe('rule based news assessment',()=>{
  it('allows a fresh positive paper-only candidate',()=>{
    const assessment=assessNews({title:'ACME raises guidance after earnings beat',publishedAt:'2026-07-16T01:00:00Z',content:'Revenue was above expectations',quality:{observedAt:'2026-07-16T01:00:00Z',receivedAt:'2026-07-16T01:00:01Z',source:'Finnhub:Example',sourceUrl:'https://example.com',verified:false,staleAfterSeconds:900}},new Date('2026-07-16T01:05:00Z'));
    expect(assessment.direction).toBe('positive');expect(assessment.paperTradeEligible).toBe(true);
  });
  it('blocks dilution even when positive words are present',()=>{
    const assessment=assessNews({title:'ACME raises guidance and files public offering',publishedAt:'2026-07-16T01:00:00Z',content:'secondary offering',quality:{observedAt:'2026-07-16T01:00:00Z',receivedAt:'2026-07-16T01:00:01Z',source:'SEC EDGAR',sourceUrl:'https://sec.gov/x',verified:true,staleAfterSeconds:900}},new Date('2026-07-16T01:05:00Z'));
    expect(assessment.direction).toBe('blocked');expect(assessment.paperTradeEligible).toBe(false);
  });
});
