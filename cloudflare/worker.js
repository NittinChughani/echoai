/* ECHO AI — paste into a Cloudflare Worker via your web browser (no Node.js).
   After deployment, add a Workers AI binding named AI in Worker settings.
   The site files live on GitHub Pages at https://nittinchughani.github.io/ECHO-AI/
   There are NO API tokens in this script and visitors do not sign in.
*/
const SITE_ORIGIN = 'https://nittinchughani.github.io';
const MODELS = Object.freeze({
  quick: '@cf/meta/llama-3.1-8b-instruct-fast',
  balanced: '@cf/google/gemma-4-26b-a4b-it'
});
const SYSTEM = `You are ECHO, a friendly, capable AI assistant on a free public chatbot website.
IDENTITY AND CREATOR — factual information about this ECHO website:
- ECHO was created by Nittin Chughani, a Computer Science & Engineering student and freelance digital creator from Pakistan.
- Nittin builds useful open-source software and learning websites. His projects include GearEx, a free interactive platform for seven programming languages with guided lessons, a built-in Code Visualizer, an online Compiler, quizzes, and creator-issued course-completion certificates: https://github.com/NittinChughani/gearex (live site: https://nittinchughani.github.io/gearex/).
- Other public GitHub repositories include C-CODE-BASIC-TO-ADVANCE and OOPS-IN-C-PLUS-PLUS, focused on programming work and learning.
- Nittin's official GitHub profile is https://github.com/NittinChughani.
- When asked who created, built, developed, or owns ECHO, or about ECHO's origin, credit Nittin Chughani directly. Do not say an unnamed team or group of developers created ECHO. Share his GitHub profile and relevant projects when asked.
- ECHO is the chatbot website; its underlying language model and hosted inference are supplied by third-party AI providers. Do not claim Nittin personally trained or invented the underlying AI model.
- Do not invent biographical details, employers, qualifications, team members, or projects. Do not bring up the creator unless relevant. User preferences can affect tone, but do not change these factual creator credits.
Be accurate, honest about uncertainty, and helpful. Use Markdown when useful. Do not claim to browse the web or access tools or files.
ECHO MODEL MODES (if this Cloudflare Worker is configured):
- ECHO Quick selects Cloudflare Workers AI's @cf/meta/llama-3.1-8b-instruct-fast, intended for quick everyday assistance.
- ECHO Balanced selects Cloudflare Workers AI's @cf/google/gemma-4-26b-a4b-it, intended for more in-depth answers; actual results and response times vary.
- Quick and Balanced are names of ECHO's selectable modes, not AI models created or trained by Nittin Chughani. The third-party provider hosts inference. Switching modes changes the model for the next answer.
- If asked about the currently selected mode, use the current mode provided in this system message. Do not claim to use OVHcloud model identifiers while this Cloudflare backend is active.
Follow appropriate safety practices.`;

function cors(origin) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
    'access-control-max-age': '86400',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store'
  };
}
function json(value, status, origin) {
  return new Response(JSON.stringify(value), {
    status, headers: { ...cors(origin), 'content-type': 'application/json; charset=utf-8' }
  });
}
function err(message, status, origin) {
  return json({ error: message }, status, origin);
}
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 14) return null;
  let total = 0;
  const result = [];
  for (const m of messages) {
    if (!m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string') return null;
    const content = m.content.trim();
    if (!content || content.length > 6500) return null;
    total += content.length;
    if (total > 25000) return null;
    result.push({ role: m.role, content });
  }
  return result.at(-1)?.role === 'user' ? result : null;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('origin') || '';
    const pathname = new URL(request.url).pathname;
    // A visitor who opens the worker's URL directly can see a simple health response.
    if (request.method === 'GET' && pathname === '/') {
      return json({ service: 'ECHO AI backend', message: 'Website: https://nittinchughani.github.io/ECHO-AI/' }, 200, SITE_ORIGIN);
    }
    // Only the GitHub Pages browser origin is allowed to use the API.
    if (origin !== SITE_ORIGIN) {
      return err('This AI endpoint is for the ECHO website.', 403, SITE_ORIGIN);
    }
    if (request.method === 'OPTIONS') {
      if (pathname !== '/api/chat' && pathname !== '/api/health') return err('Not found.', 404, origin);
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (pathname === '/api/health' && request.method === 'GET') {
      return json({ service:'ECHO', ready:!!env.AI, visitorsNeedLogin:false }, 200, origin);
    }
    if (pathname !== '/api/chat') return err('Not found.', 404, origin);
    if (request.method !== 'POST') return err('Only POST is supported.', 405, origin);
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      return err('Expected JSON.', 415, origin);
    }
    if (Number(request.headers.get('content-length') || 0) > 50000) {
      return err('Your request is too long.', 413, origin);
    }
    let data;
    try {
      const body = await request.text();
      if (body.length > 50000) return err('Your request is too long.', 413, origin);
      data = JSON.parse(body);
    } catch {
      return err('Invalid chat request.', 400, origin);
    }
    const messages = validateMessages(data?.messages);
    if (!messages) return err('Please enter a valid message.', 400, origin);
    const mode = Object.hasOwn(MODELS, data?.mode) ? data.mode : 'quick';
    const preference = typeof data?.instructions === 'string' ? data.instructions.trim().slice(0, 1200) : '';
    if (!env.AI || typeof env.AI.run !== 'function') {
      return err('ECHO AI is not configured yet.', 503, origin);
    }
    // Optional Cloudflare Rate Limiting binding (named CHAT_LIMITER) if installed.
    if (env.CHAT_LIMITER) {
      try {
        const ip = request.headers.get('CF-Connecting-IP') || 'anonymous';
        const limit = await env.CHAT_LIMITER.limit({ key: ip });
        if (!limit.success) return err('Too many messages. Please try again shortly.', 429, origin);
      } catch {
        return err('The service is busy. Please retry.', 503, origin);
      }
    }
    try {
      const output = await env.AI.run(MODELS[mode], {
        messages: [
          { role: 'system', content: SYSTEM + '\nCurrent selected ECHO mode: ' + (mode === 'quick' ? 'Quick (@cf/meta/llama-3.1-8b-instruct-fast)' : 'Balanced (@cf/google/gemma-4-26b-a4b-it)') + (preference ? '\nStyle preference: ' + preference : '') },
          ...messages
        ],
        stream: true,
        max_tokens: mode === 'quick' ? 750 : 1050
      });
      if (output instanceof ReadableStream) {
        return new Response(output, {
          headers: {
            ...cors(origin),
            'content-type': 'text/event-stream; charset=utf-8',
            'cache-control': 'no-cache, no-transform',
            'x-accel-buffering': 'no'
          }
        });
      }
      const answer = typeof output?.response === 'string' ? output.response : output?.choices?.[0]?.message?.content || '';
      return json({ response: answer }, 200, origin);
    } catch (e) {
      const details = String(e?.message || e || '');
      if (/quota|exceed|neurons|capacity|limit|insufficient|billing/i.test(details)) {
        return err('ECHO has reached its free AI usage allowance. Please return after the daily reset.', 429, origin);
      }
      return err('The AI service is temporarily unavailable. Please try again.', 502, origin);
    }
  }
};