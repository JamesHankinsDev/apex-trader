import EmptyState from '../../components/ui/empty-state.js';

export default function MarketTab() {
  return (
    <EmptyState
      icon="candlestick"
      title="Market"
      body="Prices, charts and the pairs you could run a grid on. Needs a market-data route; the bot deliberately keeps Alpaca calls inside the run loop so the API can be polled hard."
      reference="/prototype/index.html"
    />
  );
}
