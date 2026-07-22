# API examples

## 장기 투자 평가

```bash
curl -X POST http://localhost:4000/v1/evaluations/long-term \
  -H 'content-type: application/json' \
  -d '{"businessQuality":90,"valuation":70,"moat":90,"freeCashFlow":85,"opportunityCost":70,"portfolioFit":80}'
```

## 모멘텀 평가

```bash
curl -X POST http://localhost:4000/v1/evaluations/momentum \
  -H 'content-type: application/json' \
  -d '{"relativeStrength":90,"volume":80,"sectorRotation":70,"catalyst":90,"riskReward":80}'
```

## 포트폴리오 배분

```bash
curl -X POST http://localhost:4000/v1/portfolio/allocate \
  -H 'content-type: application/json' \
  -d '{"capital":1000000}'
```

