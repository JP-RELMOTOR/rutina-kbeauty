# 💬 Cómo activar el chat de Claude en la app

La app ya tiene la UI del chat lista (botón 💬 flotante en la esquina inferior derecha). Para que responda de verdad — no en modo demo — necesitas conectar un proxy hacia la API de Anthropic. Toma unos 20 minutos en total.

---

## Paso 1 · Cuenta en Anthropic (5 min)

1. Entra a **https://console.anthropic.com** y crea una cuenta.
2. Verifica tu correo.
3. Ve a **Settings → Billing** y carga al menos **$5 USD** de crédito inicial (con prompt caching, te van a durar meses para uso personal).
4. Ve a **API Keys → Create Key**, dale un nombre (ej. `kbeauty-app`) y **copia la key** (`sk-ant-…`). Guárdala en un lugar seguro — no la vas a poder ver de nuevo.

---

## Paso 2 · Cuenta en Cloudflare (5 min, gratis)

1. Entra a **https://dash.cloudflare.com** y crea cuenta (gratis, no requiere tarjeta).
2. En el menú lateral entra a **Workers & Pages**.
3. Click en **Create application → Create Worker**.
4. Dale un nombre (ej. `kbeauty-chat`). Toma nota de la URL generada — algo como `https://kbeauty-chat.<tu-cuenta>.workers.dev`.

---

## Paso 3 · Pegar el código del Worker (5 min)

1. En el editor del worker, **borra el código de ejemplo** y pega el contenido del archivo [`claude-worker.js`](claude-worker.js) que está en este repo.
2. Click en **Save and Deploy** (arriba a la derecha).

---

## Paso 4 · Configurar variables secretas (3 min)

En el panel del worker que acabas de crear:

1. Ve a **Settings → Variables and Secrets**.
2. Click en **Add variable** y crea estas dos:

| Nombre | Valor | Tipo |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-…` (tu key del Paso 1) | **Secret** (encrypted) |
| `ALLOWED_ORIGIN` | `https://jp-relmotor.github.io` | Text |

3. Click **Save and deploy** otra vez.

---

## Paso 5 · Conectar la app (1 min)

1. Abre la app: https://jp-relmotor.github.io/rutina-kbeauty/
2. Toca el botón flotante **💬** abajo a la derecha.
3. Arriba a la derecha del chat, toca **⚙️**.
4. **Pega la URL de tu Worker** (ej. `https://kbeauty-chat.tu-cuenta.workers.dev`).
5. Elige el modelo: **Sonnet 4.6** es el recomendado (balance de precio y calidad).
6. **Guardar**.

Listo. El indicador del chat cambia de "○ Modo demo" a "● Conectado". Ahora pregúntale lo que quieras sobre tu tratamiento — el modelo ya conoce tu perfil, rutina, productos, ingredientes, tips y preguntas frecuentes.

---

## Costos esperados (uso personal)

Con prompt caching activado (ya está en el código) y ~50 mensajes/mes:

| Modelo | Costo estimado/mes |
|---|---|
| Haiku 4.5 | $0.05–0.20 |
| **Sonnet 4.6** (recomendado) | $0.50–2.00 |
| Opus 4.7 | $2.00–8.00 |

Los **$5 USD iniciales te duran meses**.

---

## Si algo falla

**El chat dice "Hubo un problema":**
- Revisa que la URL del worker esté completa (incluyendo `https://`)
- Revisa que las variables `ANTHROPIC_API_KEY` y `ALLOWED_ORIGIN` estén configuradas
- Mira los logs en Cloudflare: Workers → tu worker → Logs (Real-time)

**Dice "modo demo" aunque guardaste la URL:**
- Recarga la app (cierra y abre)
- Verifica que la URL no tenga espacios al inicio/fin

**Quieres cambiar el modelo:**
- Chat → ⚙️ → cambia el modelo → Guardar

---

## ¿Quieres compartir el chat con alguien más?

Actualmente la app está configurada solo para Mijal y JP. Si quieres dar acceso a más personas, hay que agregar:
- Rate limiting en el worker (KV de Cloudflare)
- Auth básica con un PIN compartido
- Posiblemente lista blanca de usuarios

Avísame cuando llegues a ese punto y lo agregamos.
