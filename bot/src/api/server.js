/* Apex Trader — read-only HTTP API for the dashboard.

   Serves the Runner's in-memory snapshot. It deliberately never calls Alpaca:
   the loop is the only thing that talks to the exchange, so this can be
   polled hard without burning rate limit or racing a tick.

   Every route is GET. There is no endpoint that places, cancels, or modifies
   an order — a compromised dashboard cannot move money.

   BINDING IS FAIL-SAFE: without API_TOKEN the server binds 127.0.0.1 only and
   refuses to listen on a public interface. Set a token to expose it. */

import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

/** Constant-time compare that tolerates length mismatch. */
function tokenMatches(provided, expected) {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    // Still burn a comparison so timing doesn't leak the length.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * @param {object} opts
 * @param {object} opts.runner
 * @param {number} opts.port
 * @param {string} [opts.token]   required to bind anything but localhost
 * @param {string} [opts.host]
 * @param {string} [opts.corsOrigin]
 * @param {object} [opts.logger]
 */
export function createApiServer({
  runner,
  port,
  token,
  host,
  corsOrigin = 'http://localhost:3000',
  logger = console,
}) {
  const requireAuth = Boolean(token);
  // Refuse to expose an unauthenticated API to the network.
  const bindHost = requireAuth ? (host ?? '0.0.0.0') : '127.0.0.1';

  if (!requireAuth && host && host !== '127.0.0.1' && host !== 'localhost') {
    logger.warn?.(
      `[api] no API_TOKEN set — ignoring host "${host}" and binding 127.0.0.1 instead.`,
    );
  }

  const routes = {
    // ok reflects TRADING health, not process liveness. A halted bot is a
    // process that is up and doing nothing — reporting ok:true there means a
    // platform health check treats a dead strategy as healthy and never pages.
    '/health': () => ({
      ok: !runner.halted,
      running: runner.running,
      halted: runner.halted,
      dryRun: runner.dryRun,
      ticks: runner.ticks,
      uptimeMs: Date.now() - runner.startedAt,
    }),
    '/state': () => runner.snapshot(),
    '/grid': () => {
      const s = runner.snapshot();
      return { grid: s.grid, ladder: s.ladder, book: s.book };
    },
    '/position': () => runner.snapshot().position,
    '/fills': () => ({ fills: runner.snapshot().fills }),
  };

  const server = createServer((req, res) => {
    const send = (status, body) => {
      res.writeHead(status, {
        ...JSON_HEADERS,
        'access-control-allow-origin': corsOrigin,
        'access-control-allow-headers': 'authorization,content-type',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(body));
    };

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': corsOrigin,
        'access-control-allow-headers': 'authorization,content-type',
        'access-control-allow-methods': 'GET,OPTIONS',
      });
      return res.end();
    }

    if (req.method !== 'GET') {
      return send(405, { error: 'This API is read-only.' });
    }

    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const path = url.pathname.replace(/\/+$/, '') || '/health';

    // /health stays open so a platform health check works without the token.
    if (requireAuth && path !== '/health') {
      const header = req.headers.authorization ?? '';
      const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!tokenMatches(provided, token)) {
        return send(401, { error: 'Unauthorized' });
      }
    }

    const handler = routes[path];
    if (!handler) {
      return send(404, { error: `No route ${path}`, routes: Object.keys(routes) });
    }

    try {
      const body = handler();
      // 503 on a halt so an uptime monitor actually fires.
      send(path === '/health' && body?.ok === false ? 503 : 200, body);
    } catch (err) {
      logger.error?.(`[api] ${path} failed: ${err.message}`);
      send(500, { error: 'Internal error' });
    }
  });

  return {
    server,
    start: () =>
      new Promise((resolve) => {
        server.listen(port, bindHost, () => {
          logger.info?.(
            `[api] listening on http://${bindHost}:${port}` +
              (requireAuth ? ' (token required)' : ' (localhost only — no API_TOKEN set)'),
          );
          resolve(server);
        });
      }),
    stop: () => new Promise((resolve) => server.close(resolve)),
  };
}

export default createApiServer;
