# Agent guide

Read `CLAUDE.md`, `README.md`, and `docs/PRODUCT_SPEC_V3.md` before changing gameplay behavior.

- Keep vehicle physics independent from UI, Apps in Toss, and Supabase.
- Preserve unlimited retries and whole-race Finish Time as the ranking metric.
- Add tests for pure input and timing rules when behavior changes.
- Treat WebGL as the primary runtime and do not use unsupported threads or raw sockets.
- Never commit platform publishing keys, Supabase service-role keys, generated WebGL output, or `.ait` packages.

