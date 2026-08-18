'use client';

/* Apex Trader — the bot snapshot, polled.

   One place that knows how to reach the bot and how to describe what came
   back, so every screen tells the same story about the same state. Both
   app/live/page.js and app/m/live/page.js consume this — if you add a rung to
   the status ladder, both get it. */

import { useCallback, useEffect, useState } from 'react';

export const POLL_MS = 2000;

/** How long a first poll may hang before silence becomes the diagnosis. */
const NO_RESPONSE_MS = 6000;

/**
 * Poll the bot's in-memory snapshot through the server-side proxy.
 *
 * @returns {{snapshot: object|null, error: string|null, waitedMs: number, refresh: function}}
 */
export function useBotState() {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [startedAt] = useState(() => Date.now());
  const [waitedMs, setWaitedMs] = useState(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/state', { cache: 'no-store' });
      const body = await res.json();
      if (!res.ok) {
        // The proxy puts a diagnosable sentence in `error` for the cases that
        // are otherwise undebuggable — a token mismatch, an unreachable bot.
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setSnapshot(body);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setWaitedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  return { snapshot, error, waitedMs, refresh: poll };
}

/**
 * Reduce snapshot + transport state to one honest line about the bot.
 *
 * The ordering is the point. Every rung that is not "fine" has to be able to
 * say so: a bot that rejects every order, or is reachable but not looping,
 * previously fell through to "connecting" and hid the failure it was supposed
 * to report.
 *
 * Returns a short `word` and an optional longer `detail`, because the two
 * consumers have very different room. The mobile status chip is ~20 characters
 * wide and renders `word` alone; the desktop pill has a whole header row and
 * renders `word — detail`. Splitting it here is what lets both share one
 * ladder instead of drifting apart.
 *
 * @returns {{word: string, detail: string|null, tone: string, ok: boolean}}
 */
export function deriveStatus({ snapshot, error, waitedMs }) {
  const down = 'var(--down-500)';
  const warn = 'var(--warning-500)';
  const out = (word, tone, ok, detail = null) => ({ word, detail, tone, ok });

  if (error) return out('bot offline', down, false);

  if (!snapshot) {
    // Never let "connecting" sit there forever saying nothing. If the first
    // poll has not returned in a few seconds, that IS the diagnosis.
    return waitedMs > NO_RESPONSE_MS
      ? out('no response', down, false, 'from /api/bot/state')
      : out('connecting', 'var(--text-400)', false);
  }

  if (!snapshot.status) return out('unexpected response shape', down, false);

  if (snapshot.status.halted) {
    return out('halted', down, false, snapshot.status.halted.replace(/_/g, ' '));
  }

  // A grid rejecting every order submits zero, which is indistinguishable from
  // a converged one unless it is said out loud.
  if (snapshot.rejections?.length) {
    const n = snapshot.rejections.length;
    return out(`${n} order${n > 1 ? 's' : ''} rejected`, warn, false);
  }

  if (snapshot.status.running) {
    return snapshot.status.dryRun
      ? out('dry run', 'var(--info-500)', true, 'planning only, nothing submitted')
      : out('live', 'var(--up-500)', true, 'submitting orders');
  }

  // Reached the bot, but its loop is not running and it is not halted.
  return out('not running', warn, false, `reached the bot at tick ${snapshot.status.ticks ?? 0}`);
}

/* ---- formatting -------------------------------------------------------- */

export const money = (n, dp = 2) =>
  Number(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

/**
 * Always emits a sign.
 *
 * Green and red separate by only ΔE 7.2 under deuteranopia, so nothing here
 * may rely on colour alone to carry direction. Colour is reinforcement.
 */
export const signed = (n, dp = 2) =>
  `${Number(n) >= 0 ? '+' : '−'}$${money(Math.abs(Number(n ?? 0)), dp)}`;

export const toneFor = (n) =>
  Number(n) > 0 ? 'var(--up-500)' : Number(n) < 0 ? 'var(--down-500)' : 'var(--text-500)';
