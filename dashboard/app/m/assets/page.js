import EmptyState from '../../components/ui/empty-state.js';

export default function AssetsTab() {
  return (
    <EmptyState
      icon="wallet"
      title="Assets"
      body="Every holding, its cost basis and live value. The bot API exposes the grid position today, not a full portfolio — this needs a /positions route before it can say anything true."
      reference="/prototype/index.html"
    />
  );
}
