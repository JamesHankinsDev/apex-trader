// Mirror of ../src/regimeConfig.ts — kept in sync manually. These windows are
// how runMatrix labels runs; the frontend uses the same labels to group them.

export interface RegimeWindow {
  name: string;
  from: string;
  to: string;
  oos: boolean;
}

export const REGIMES: RegimeWindow[] = [
  { name: '2020-2021-bull', from: '2020-01-01', to: '2022-01-01', oos: true },
  { name: '2022-bear', from: '2022-01-01', to: '2023-01-01', oos: true },
  { name: '2023-recovery', from: '2023-01-01', to: '2024-01-01', oos: true },
  { name: '2024-bull', from: '2024-01-01', to: '2025-01-01', oos: false },
  { name: '2025-sideways', from: '2025-01-01', to: '2025-07-01', oos: false },
  { name: '2026-bear', from: '2026-01-01', to: '2026-04-15', oos: false },
];

// Classify a run's date range into a regime name by checking which window
// contains it. A run is "in" a regime if its start falls within that window.
export function regimeForRun(startT: number, endT: number | null): RegimeWindow | null {
  for (const r of REGIMES) {
    const from = new Date(r.from).getTime();
    const to = new Date(r.to).getTime();
    if (startT >= from - 24 * 60 * 60 * 1000 && startT <= to) {
      return r;
    }
  }
  return null;
}
