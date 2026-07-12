# Data Model

## 1. 핵심 엔터티

```text
AffiliateProvider
Product
ProductSnapshot
MarketContext
ProductCandidate
ProductScore
ContentPlan
Content
Publication
AffiliateLink
PerformanceEvent
Conversion
WorkflowRun
AgentRun
PromptVersion
```

---

## 2. 주요 테이블

### affiliate_providers

```sql
id uuid primary key
code text unique not null
name text not null
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null
```

### products

```sql
id uuid primary key
provider_id uuid not null
external_product_id text not null
name text not null
category_path jsonb not null
brand text
canonical_url text
image_url text
is_active boolean not null default true
created_at timestamptz not null
updated_at timestamptz not null

unique(provider_id, external_product_id)
```

### product_snapshots

```sql
id uuid primary key
product_id uuid not null
price numeric
currency text
review_count integer
rating numeric
is_available boolean
raw_payload jsonb not null
captured_at timestamptz not null
```

### market_contexts

```sql
id uuid primary key
market text not null
context_date date not null
season text
weather_summary jsonb
trend_keywords jsonb
events jsonb
ai_summary jsonb
created_at timestamptz not null

unique(market, context_date)
```

### product_candidates

```sql
id uuid primary key
workflow_run_id uuid not null
product_id uuid not null
market_context_id uuid not null
status text not null
rank integer
selected boolean not null default false
created_at timestamptz not null

unique(workflow_run_id, product_id)
```

### product_scores

```sql
id uuid primary key
candidate_id uuid not null
trend_score numeric not null
season_score numeric not null
weather_score numeric not null
conversion_score numeric not null
commission_score numeric not null
content_fit_score numeric not null
penalty_score numeric not null
final_score numeric not null
reasoning jsonb not null
score_version text not null
created_at timestamptz not null
```

### content_plans

```sql
id uuid primary key
candidate_id uuid not null
target_audience jsonb not null
problem_statement text not null
content_angle text not null
channels jsonb not null
ai_output jsonb not null
prompt_version_id uuid not null
created_at timestamptz not null
```

### contents

```sql
id uuid primary key
content_plan_id uuid not null
channel text not null
title text
body text not null
metadata jsonb not null
status text not null
compliance_score numeric
confidence_score numeric
created_at timestamptz not null
updated_at timestamptz not null
```

### publications

```sql
id uuid primary key
content_id uuid not null
channel text not null
external_publication_id text
published_url text
status text not null
scheduled_at timestamptz
published_at timestamptz
error jsonb
created_at timestamptz not null
updated_at timestamptz not null
```

### affiliate_links

```sql
id uuid primary key
product_id uuid not null
provider_id uuid not null
destination_url text not null
affiliate_url text not null
tracking_code text unique not null
created_at timestamptz not null
expires_at timestamptz
```

### performance_events

```sql
id uuid primary key
publication_id uuid
affiliate_link_id uuid
event_type text not null
event_at timestamptz not null
session_id text
anonymous_user_id text
metadata jsonb not null
```

### conversions

```sql
id uuid primary key
provider_id uuid not null
external_conversion_id text not null
affiliate_link_id uuid
product_id uuid
amount numeric
commission numeric
currency text
converted_at timestamptz not null
raw_payload jsonb not null

unique(provider_id, external_conversion_id)
```

### workflow_runs

```sql
id uuid primary key
workflow_name text not null
idempotency_key text unique not null
status text not null
input jsonb not null
output jsonb
error jsonb
started_at timestamptz not null
completed_at timestamptz
```

### agent_runs

```sql
id uuid primary key
workflow_run_id uuid not null
agent_name text not null
provider text not null
model text not null
prompt_version_id uuid
input jsonb not null
output jsonb
token_usage jsonb
cost numeric
status text not null
error jsonb
started_at timestamptz not null
completed_at timestamptz
```

### prompt_versions

```sql
id uuid primary key
prompt_key text not null
version integer not null
template text not null
schema jsonb
is_active boolean not null default false
created_at timestamptz not null

unique(prompt_key, version)
```

---

## 3. 데이터 보존

권장 보존 기간:

- Workflow Run: 1년
- Agent Run: 1년
- Product Snapshot: 최소 1년
- Performance Event: 최소 2년
- Conversion: 영구 또는 회계 정책에 따름
- Prompt Version: 영구
- Publication: 영구

---

## 4. 인덱스

필수 인덱스:

```sql
products(provider_id, external_product_id)
product_snapshots(product_id, captured_at desc)
product_candidates(workflow_run_id, selected)
product_scores(final_score desc)
contents(status, channel)
publications(status, scheduled_at)
performance_events(affiliate_link_id, event_at)
workflow_runs(workflow_name, started_at desc)
agent_runs(workflow_run_id, started_at)
```
