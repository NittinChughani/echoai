# Cloudflare Workers AI — deployment guide

ECHO's Cloudflare integration is ready to deploy. The existing OVHcloud provider remains active until the new Worker has been deployed, checked and configured. GitHub Pages continues hosting the website; there is no Node.js installation or visitor signup required.

## 1. Create the Worker

1. Sign in to [Cloudflare](https://dash.cloudflare.com/) and stay on the Workers Free plan. If needed, complete the workers.dev setup.
2. Open Workers & Pages (under Compute), choose Create application / Create Worker, and select the Hello World template. Name it **echo-ai** and deploy.
3. Open the Worker's editor (Edit code), replace the sample script with the complete contents of [cloudflare/worker.js](cloudflare/worker.js), and deploy.
4. In the Worker's Bindings settings, add a **Workers AI** binding named exactly **AI**. Save/deploy the configuration.
5. Open the Worker URL. The root should identify the ECHO backend. Open /api/health through the ECHO origin when testing the application; it checks the binding but does not run inference.

## 2. Connect the website

Copy the actual public HTTPS Worker URL and provide it to the maintainer. This is a public URL, not an API token or password.

Update [docs/config.js](docs/config.js) so PROVIDER is 'cloudflare' and API_BASE is the actual Worker origin (no /api/chat path). Commit and allow GitHub Pages to deploy. For rollback, set PROVIDER to 'ovh'.

## 3. Verify before announcing

Open https://nittinchughani.github.io/echoai/ and hard refresh. Check the cloud status, send at least three ordinary prompts within a minute in each mode, verify streaming and Stop, then reload to check chat history and themes. Check the Workers AI dashboard for actual usage and errors. If a model or binding fails, resolve it before replacing the existing provider.

## Model choices and budget

- Quick: @cf/meta/llama-3.1-8b-instruct-fast (up to 512 output tokens).
- Balanced: @cf/google/gemma-4-26b-a4b-it (up to 900 output tokens).
- Older context is trimmed server-side to at most eight messages and 12,000 characters, preserving the latest user question.

Cloudflare publishes a shared 10,000 Neurons/day allowance on Workers Free. The default text generation rate ceiling is 300 requests/minute; actual capacity, per-model limits and daily usage can vary. This is not an unlimited service or a fixed number of free messages. Stay on the free plan to avoid paid overages. Check current model availability before activation.

- [Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [Limits](https://developers.cloudflare.com/workers-ai/platform/limits/)
- [AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/)
- [Rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Public endpoint protection

The Worker restricts browser CORS to the site's origin, validates requests and limits input size. CORS is not authentication and cannot stop a scripted caller from spoofing an Origin header. The optional CHAT_LIMITER rate limiting binding, if configured through Wrangler, provides approximate throttling; it is not installed automatically. Before broader promotion, configure abuse protection and monitor quotas. Do not add Cloudflare API tokens to the website or public repository. The AI binding handles authorization server-side. Visitors' chat content is sent to Cloudflare for inference.
