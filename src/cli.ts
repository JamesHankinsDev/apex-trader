// Tiny CLI argument parser. Supports `--key value` and `--flag` (boolean).

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export function requireString(
  args: Record<string, string | boolean>,
  key: string,
): string {
  const v = args[key];
  if (typeof v !== 'string') {
    throw new Error(`Missing required --${key}`);
  }
  return v;
}

export function optionalString(
  args: Record<string, string | boolean>,
  key: string,
): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

export function optionalNumber(
  args: Record<string, string | boolean>,
  key: string,
): number | undefined {
  const v = args[key];
  if (typeof v !== 'string') return undefined;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`--${key} must be a number, got "${v}"`);
  return n;
}

export function flag(
  args: Record<string, string | boolean>,
  key: string,
): boolean {
  return args[key] === true;
}

// Parse a "YYYY-MM-DD" date string to unix ms (UTC midnight).
export function parseDateMs(input: string): number {
  // Accept ISO dates like 2025-01-01 or 2025-01-01T00:00:00Z
  const d = new Date(input.length === 10 ? `${input}T00:00:00Z` : input);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: "${input}" (expected YYYY-MM-DD)`);
  }
  return d.getTime();
}
