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

import { AptosClient, AptosAccount, FaucetClient, Types } from "aptos";
import {
  // Object types
  Aggregator,
  Job,
  Oracle,
  OracleQueue,
  Crank,

  // Aggregator Action Params
  AggregatorAddJobParams,
  AggregatorInitParams,
  AggregatorOpenRoundParams,
  AggregatorRemoveJobParams,
  AggregatorSaveResultParams,
  AggregatorSetConfigParams,

  // Job Action Params
  JobInitParams,

  // Crank Action Params
  CrankInitParams,
  CrankPopParams,
  CrankPushParams,

  // Oracle Action Params
  OracleInitParams,

  // OracleQueue Action Params
  OracleQueueInitParams,

  // Event polling
  onAggregatorOpenRound,
  onAggregatorSaveResult,
  onAggregatorUpdate,
  sendAptosTx,
} from ".";

// run it all at once
(async () => {
  const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
  const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
  const SWITCHBOARD_DEVNET_ADDRESS = "publish and place value here";

  // INFRA ------
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
  const state = new AptosAccount();
  await faucetClient.fundAccount(state.address(), 5000);

  // initialize new switchboard
  await sendAptosTx(
    client,
    state,
    `${SWITCHBOARD_DEVNET_ADDRESS}::SwitchboardInitAction::run`,
    []
  );
  console.log(`State account ${state.address().hex()} created`);

  // create new user
  const user = new AptosAccount();
  await faucetClient.fundAccount(user.address(), 5000);
  console.log(`User account ${state.address().hex()} created`);

  // create an Oracle Queue, pass in user address as queue address
  const [oracleQueueTx, oracleQueue] = await OracleQueue.init(client, user, {
    //.... lots of params here ...
  });

  // more infra
  const [crankTx, crank] = await Crank.init(client, user, {
    // ... more params ..
  });

  const [oracleTx, oracle] = await Oracle.init(client, user, {
    // few params
    // add queue we created here
  });

  // setup dummy crank
  setInterval(() => {
    try {
      // check if we can update / open round if we can
    } catch (e) {}
  });

  // DEMO
  const [aggregatorTx, aggregator] = await Aggregator.init(client, user, {
    // lots of params
  });

  await aggregator.addJob({
    // 2 params in here
  });

  await crank.push({
    //... even more params
  });

  // setup polling for open round / respawn
  const runsforever = await onAggregatorOpenRound(client, (e) => {
    // respond to aggregator open round
    // fetch (maybe use the taskrunner api for this)
    // save result
  });

  const logsforever = await onAggregatorUpdate(client, (e) => {
    console.log(e);
  });
})();
