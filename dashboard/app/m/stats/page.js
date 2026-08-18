import EmptyState from '../../components/ui/empty-state.js';

export default function StatsTab() {
  return (
    <EmptyState
      icon="bar-chart"
      title="Stats"
      body="Realized P&L over time, round-trip history and fee drag. The snapshot carries the last 50 fills only — longer history needs somewhere to persist them."
      reference="/prototype/index.html"
    />
  );
}
