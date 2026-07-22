// ─── CLAUDE WORKER PROXY ─────────────────────────────────────────────
// La API key vive únicamente en Cloudflare. El Worker acepta peticiones solo
// desde los orígenes configurados y limita el uso si se enlaza un KV opcional.

const ALLOWED_MODELS = new Set([
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
]);

function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

async function isRateLimited(request, env) {
  // KV es opcional para no dificultar el uso privado inicial. Si se configura,
  // limita por IP y minuto; no sustituye autenticación para una app pública.
  if (!env.RATE_LIMIT_KV) return false;
  const limit = Math.max(1, Math.min(Number(env.MAX_REQUESTS_PER_MINUTE) || 20, 120));
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const minute = Math.floor(Date.now() / 60000);
  const key = `rate:${ip}:${minute}`;
  const used = Number(await env.RATE_LIMIT_KV.get(key) || 0);
  if (used >= limit) return true;
  await env.RATE_LIMIT_KV.put(key, String(used + 1), { expirationTtl: 120 });
  return false;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = allowedOrigins(env);
    if (!origin || !allowed.includes(origin)) {
      return json({ error: "Origen no autorizado" }, 403);
    }
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Método no permitido" }, 405, cors);
    if (!env.ANTHROPIC_API_KEY) return json({ error: "Worker sin API key configurada" }, 500, cors);

    try {
      if (await isRateLimited(request, env)) {
        return json({ error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." }, 429, cors);
      }

      let body;
      try {
        body = await request.json();
      } catch (_) {
        return json({ error: "JSON inválido" }, 400, cors);
      }
      if (!body || !Array.isArray(body.messages) || !Array.isArray(body.system)) {
        return json({ error: "Solicitud inválida" }, 400, cors);
      }
      const model = body.model || "claude-sonnet-4-6";
      if (!ALLOWED_MODELS.has(model)) return json({ error: "Modelo no permitido" }, 400, cors);

      // Límite alto para foto-diagnóstico comprimido; evita que el Worker sea
      // usado como proxy de payloads arbitrariamente grandes.
      const systemLen = body.system.reduce((total, block) => total + (block?.text?.length || 0), 0);
      const messagesLen = JSON.stringify(body.messages).length;
      if (systemLen > 50000 || messagesLen > 800000) {
        return json({ error: "Payload demasiado grande" }, 413, cors);
      }

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: Math.min(Math.max(Number(body.max_tokens) || 1024, 1), 2048),
          system: body.system,
          messages: body.messages,
        }),
      });

      return new Response(await upstream.text(), {
        status: upstream.status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } catch (error) {
      return json({ error: error?.message || "Worker error" }, 500, cors);
    }
  },
};
