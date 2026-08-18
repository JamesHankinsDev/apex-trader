import EmptyState from '../../components/ui/empty-state.js';

export default function BotsTab() {
  return (
    <EmptyState
      icon="bot"
      title="Bots"
      body="One grid runs today, and the live view already shows it in full. This becomes useful when a second bot exists to switch between."
      reference="/prototype/index.html"
    />
  );
}
