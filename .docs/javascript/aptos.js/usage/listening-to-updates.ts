/**
 * Listen to Aggregator Updates Off-Chain
 */

// create event listener
const onAggregatorUpdate = (
  client: AptosClient,
  callback: EventCallback,
  pollIntervalMs: number = 1000
): AptosEvent => {
  return AggregatorAccount.watch(
    client,
    SWITCHBOARD_ADDRESS,
    callback,
    pollIntervalMs
  );
};

// initialize event listener
const updatePoller = onAggregatorUpdate(client, async (e) => {
  if (aggregator.address == e.data.aggregator_address) {
    console.log(`NEW RESULT:`, e.data);
  }
});
