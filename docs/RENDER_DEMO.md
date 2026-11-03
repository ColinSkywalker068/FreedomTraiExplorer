# Boston Signals public demo

Use a Render Hobby workspace without a payment method and a Groq Free organization. Use a private Git repository that the Render Git integration can read. The public endpoints are the Render Static Site and the FastAPI Web Service.

## Initial deploy

1. Review the deployment source package before committing it. It contains the runtime GLBs, documents, geographic data and credits, both apps, tests for those apps, and the shared witness registry. Keep local trial GLBs, original asset libraries, development caches and environments out of the deployment repo.
2. Push the reviewed files to the approved private repository. In Render, create a Blueprint from that repository and review both service names and the Free web instance before applying it. The static site build reads the API service's external URL into `VITE_NPC_API_URL`.
3. Enter the Groq key directly into the backend's `GROQ_API_KEY` field. Enter `http://localhost:5173,http://127.0.0.1:5173` for `NPC_WEB_ORIGINS` initially. Once Render assigns the static URL, append its exact HTTPS origin and redeploy the backend. Confirm both public endpoints and their visibility before launch. Share the static URL with players.
4. Verify `/healthz` and `/api/npcs/health` on the API. The NPC health endpoint reports provider configuration. Verify an actual witness request returns `mode: live` and `provider: groq` to confirm Groq works.

Use the game URL in a WebGL browser. Select Old State House, Explore Site, then Enter Boston, 1770. Visit the three playable witnesses and ask each what they saw or heard. Confirm their replies show a source, record evidence, open the journal, and return to the map. Confirm the active GLBs and historical document images return 200 and render. Also test the present-day guide and tourist, including resetting a thread. To verify scripted fallback separately, locally run the API with `NPC_PROVIDER=scripted` and repeat a witness question. The present-day dialogue has a Scripted demo button.

## Redeploy and roll back

Auto-deploy is off. Manually deploy the same approved commit to the backend and static site from each service's Deploys page. For a rollback, select the matching successful deploys from both histories. If the desired builds have aged out, manually deploy the known-good Git commit. Check the API URL, CORS and key configuration again after rollback.

## Free-tier behavior

Render's Hobby allowance is 5 GB outbound and 500 build minutes per month, and Free web services share 750 hours per workspace. The API can take about a minute to wake after 15 minutes idle. The browser has a bounded wait and the witness panel always offers the preserved record.

Groq lists Qwen 3.8 27B with strict structured output and Free limits of 30 requests/minute, 1,000/day, 8,000 tokens/minute and 200,000/day. Actual limits are organization-wide. The app shares a conservative in-memory allowance across both chat routes (3 attempts per minute and 100 per rolling day, plus 12 per visitor IP per hour). Limits and transcripts reset on a service restart. A 429 triggers a provider cooldown, and an unavailable provider returns canonical scripted witness replies. The key and provider error payloads are never included in replies.

The static app can continue with preserved records while inference is unavailable. If bandwidth suspends the entire workspace, access resumes after its monthly reset. A separate no-payment static workspace is a possible free option if independent bandwidth is needed and approved.

- https://render.com/docs/free
- https://render.com/docs/build-pipeline
- https://render.com/docs/rollbacks
- https://console.groq.com/docs/structured-outputs
- https://console.groq.com/docs/rate-limits
