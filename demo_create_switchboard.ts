/**
 * Creates a new account, inititalizes a Switchboard Resource Account on it
 *
 * Using that it should:
 *
 * INFRA --
 * Creates a new Oracle Queue
 * Creates a new Crank (associated with that Oracle Queue)
 * Creates a new Oracle (added to the queue in init action)
 * Adds a dummy crank / a try catch + setInterval will do
 *
 * DEMO --
 * Creates a new Aggregator
 * Creates a new Job (ftx btc/usd),
 * Adds Job to Aggregator
 * Push Aggregator to Crank - will get popped by the setInterval
 *
 * Set up polling for events
 *
 * - listen for Switchboard::Events::AggregatorUpdateEvent
 *   \__.. just log this one for demo
 * - listen for Switchboard::Events::AggregatorOpenRoundEvent
 *    \___.We'll react to this by fetching whatever job result and calling the Aggregator Save Result Action
 *
 *
 * loading this file should create the infra, log it (so we can reuse, then do all the other, perpetually running)
 */
