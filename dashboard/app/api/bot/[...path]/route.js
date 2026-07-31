/* Server-side proxy to the bot API.

   The bot's API_TOKEN lives here, in a server-only env var, and is attached on
   this side of the network. It is never NEXT_PUBLIC and never reaches the
   browser — which is what makes it safe to expose the bot publicly when the
   dashboard is on Vercel and the bot is on a long-running host.

   GET only, mirroring the bot API. There is no write path to proxy. */

export const dynamic = 'force-dynamic';

// TRIM BOTH. Pasting into a hosting provider's UI routinely picks up a
// trailing newline or space, and the bot trims its own API_TOKEN — so an
// untrimmed value here fails the length check and returns 401 with no clue
// why. A trailing slash on the URL would likewise produce a double slash.
const BOT_URL = (process.env.BOT_API_URL ?? 'http://localhost:4000').trim().replace(/\/+$/, '');
const BOT_TOKEN = process.env.BOT_API_TOKEN?.trim(); // server-only — no NEXT_PUBLIC_

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

    // A bare "Unauthorized" is undiagnosable. Report the LENGTH we sent (never
    // the value) — compared against the bot's startup log, a mismatch is
    // obvious immediately.
    if (res.status === 401) {
      return Response.json(
        {
          error: BOT_TOKEN
            ? `Bot rejected the token. Proxy sent ${BOT_TOKEN.length} characters — compare with the bot's startup log, which prints the length it expects.`
            : 'BOT_API_TOKEN is not set on this deployment. Note that adding env vars on Vercel does not affect a running deployment until you redeploy.',
          hint: 'token-mismatch',
        },
        { status: 401 },
      );
    }

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
