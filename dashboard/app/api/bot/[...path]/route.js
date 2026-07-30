/* Server-side proxy to the bot API.

   The bot's API_TOKEN lives here, in a server-only env var, and is attached on
   this side of the network. It is never NEXT_PUBLIC and never reaches the
   browser — which is what makes it safe to expose the bot publicly when the
   dashboard is on Vercel and the bot is on a long-running host.

   GET only, mirroring the bot API. There is no write path to proxy. */

export const dynamic = 'force-dynamic';

const BOT_URL = process.env.BOT_API_URL ?? 'http://localhost:4000';
const BOT_TOKEN = process.env.BOT_API_TOKEN; // server-only — no NEXT_PUBLIC_

/** Only these may be reached through the proxy. */
const ALLOWED = new Set(['health', 'state', 'grid', 'position', 'fills']);

export async function GET(request, { params }) {
  const { path } = await params;
  const route = (path ?? []).join('/');

  if (!ALLOWED.has(route)) {
    return Response.json({ error: `Route "${route}" is not proxied.` }, { status: 404 });
  }

  try {
    const res = await fetch(`${BOT_URL}/${route}`, {
      headers: BOT_TOKEN ? { authorization: `Bearer ${BOT_TOKEN}` } : {},
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const body = await res.json().catch(() => ({ error: 'Bot returned a non-JSON response.' }));
    return Response.json(body, { status: res.status });
  } catch (err) {
    // The bot being down is an expected state, not a crash.
    const offline = err.name === 'TimeoutError' || err.cause?.code === 'ECONNREFUSED';
    return Response.json(
      {
        error: offline ? 'Bot is not reachable.' : `Proxy error: ${err.message}`,
        offline: true,
      },
      { status: 503 },
    );
  }
}
