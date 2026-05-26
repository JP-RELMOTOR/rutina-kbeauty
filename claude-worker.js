// ─── CLAUDE WORKER PROXY ─────────────────────────────────────────────
// Cloudflare Worker que actúa como proxy entre la app PWA y la API de
// Anthropic. Guarda la API key del lado del servidor para que NO quede
// expuesta en el código del cliente.
//
// DESPLIEGUE (5 minutos):
//   1. Ve a https://dash.cloudflare.com → Workers & Pages → Create
//   2. Pega este código en el editor del worker
//   3. En "Settings" → "Variables and Secrets" agrega:
//        ANTHROPIC_API_KEY = sk-ant-xxx... (tu key de console.anthropic.com)
//        ALLOWED_ORIGIN    = https://jp-relmotor.github.io
//   4. Deploy. Copia la URL (ej. https://kbeauty-chat.tu-cuenta.workers.dev)
//   5. Pega esa URL en la app: Chat → ⚙️ → URL del Worker → Guardar
// ─────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    // Preflight CORS
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    // Rate limiting muy básico — 1 request/segundo por IP usando KV opcional.
    // Para uso personal (solo Mijal y JP) no es necesario, lo dejamos comentado.

    try {
      const body = await request.json();

      // Defensa: limitar tamaño del system prompt y mensajes para evitar abuso.
      // El límite de mensajes está alto porque ahora aceptamos imágenes (base64 ~200KB c/u).
      const systemLen = (body.system || []).reduce((a, b) => a + (b.text?.length || 0), 0);
      const msgsLen = JSON.stringify(body.messages || []).length;
      if (systemLen > 50000 || msgsLen > 800000) {
        return new Response(
          JSON.stringify({ error: "Payload demasiado grande" }),
          { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: body.model || "claude-sonnet-4-6",
          max_tokens: Math.min(body.max_tokens || 1024, 2048),
          system: body.system,
          messages: body.messages,
        }),
      });

      const data = await upstream.text();
      return new Response(data, {
        status: upstream.status,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message || "Worker error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  },
};
