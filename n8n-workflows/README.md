# n8n Workflow Exports

These JSON files are **point-in-time exports** of the production n8n workflows that power Bidsquire's scraping and AI pipeline, hosted on n8n Cloud at **sorcer.app.n8n.cloud**. The live n8n instance is the **source of truth** — these exports are committed only for **version history and disaster recovery**, and may lag behind the running workflows. Secrets have been redacted before committing (see below), so after re-importing any workflow you must **re-enter the eBay API credentials** (client ID and secret in the "Build eBay auth" node of the HiBid Scraper) — they were replaced with `REDACTED`. A working re-import also requires the n8n **Variables** `INTERNAL_API_SECRET` and `SERPER_API_KEY`, plus the **Anthropic** and **S3 / Cloudflare R2** credentials, to be configured in the n8n instance.

## Files
- `hibid-scraper-v2.json` — HiBid Scraper v2 (per-lot scrape → match → appraise → critic).
- `auction-dispatcher.json` — Auction Dispatcher (fans a catalog URL out to per-lot dispatch).
- `ai-researcher.json` — earlier AI researcher export (kept for history).
