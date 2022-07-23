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
import { Buffer } from "buffer";
import * as sbv2 from "@switchboard-xyz/switchboard-v2";
import { AptosClient, AptosAccount, FaucetClient, Types } from "aptos";
import {
  // Object types
  State,
  Aggregator,
  Job,
  Oracle,
  OracleQueue,
  // Crank,

  // Event polling
  onAggregatorOpenRound,
  // onAggregatorSaveResult,
  // onAggregatorUpdate,
} from ".";

const NODE_URL =
  process.env.APTOS_NODE_URL ?? "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL =
  process.env.APTOS_FAUCET_URL ?? "https://faucet.devnet.aptoslabs.com";

// run it all at once
(async () => {
  // INFRA ------
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

  // create new user
  const user = new AptosAccount();
  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} created + funded.`);
  const [stateTxSig] = await State.init(client, user);

  console.log(
    `State account: ${user
      .address()
      .hex()} \ncreated, tx: ${stateTxSig} (won't be used)`
  );

  const aggregator_resource_acct = new AptosAccount();
  const queue_resource_acct = new AptosAccount();
  const oracle_resource_acct = new AptosAccount();
  const job_resource_acct = new AptosAccount();

  await faucetClient.fundAccount(aggregator_resource_acct.address(), 5000);
  await faucetClient.fundAccount(queue_resource_acct.address(), 5000);
  await faucetClient.fundAccount(oracle_resource_acct.address(), 5000);
  await faucetClient.fundAccount(job_resource_acct.address(), 5000);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 500000);

  const [queueTxSig, queue] = await OracleQueue.init(
    client,
    queue_resource_acct,
    {
      address: queue_resource_acct.address(),
      name: "Switch Queue",
      metadata: "Nothing to see here",
      authority: user.address(),
      oracleTimeout: 3000,
      reward: 500,
      minStake: 0,
      slashingEnabled: false,
      varianceToleranceMultiplierValue: 0,
      varianceToleranceMultiplierScale: 0,
      feedProbationPeriod: 0,
      consecutiveFeedFailureLimit: 0,
      consecutiveOracleFailureLimit: 0,
      unpermissionedFeedsEnabled: true,
      unpermissionedVrfEnabled: true,
      curatorRewardCutScale: 0,
      curatorRewardCutValue: 0,
      lockLeaseFunding: false,
      mint: user.address(),
      enableBufferRelayers: false,
      maxSize: 1000,
    }
  );

  console.log(`Queue: ${queue.address}, tx: ${queueTxSig}`);

  const [aggregatorTxSig, aggregator] = await Aggregator.init(
    client,
    aggregator_resource_acct,
    {
      authority: user.address(),
      address: aggregator_resource_acct.address(),
      queueAddress: queue_resource_acct.address(),
      batchSize: 1,
      minJobResults: 1,
      minOracleResults: 1,
      minUpdateDelaySeconds: 5,
      startAfter: 0,
      varianceThreshold: 0,
      varianceThresholdScale: 0,
      forceReportPeriod: 0,
      expiration: 0,
    }
  );

  console.log(`Aggregator: ${aggregator.address}, tx: ${aggregatorTxSig}`);

  const [oracleTxSig, oracle] = await Oracle.init(
    client,
    oracle_resource_acct,
    {
      address: oracle_resource_acct.address(),
      name: "Switchboard Oracle",
      metadata: "metadata",
      authority: user.address(),
      queue: queue.address,
    }
  );

  console.log(`Oracle: ${oracle.address}, tx: ${oracleTxSig}`);

  // trigger the oracle heartbeat
  const heartbeatTxSig = await oracle.heartbeat();
  console.log("Heartbeat Tx Hash:", heartbeatTxSig);

  // Make Job data for btc price
  const serializedJob = Buffer.from(
    sbv2.OracleJob.encodeDelimited(
      sbv2.OracleJob.create({
        tasks: [
          {
            httpTask: {
              url: "https://www.binance.us/api/v3/ticker/price?symbol=BTCUSD",
            },
          },
          {
            jsonParseTask: {
              path: "$.price",
            },
          },
        ],
      })
    ).finish()
  );

  const [jobTxSig, job] = await Job.init(client, job_resource_acct, {
    name: "BTC/USD",
    metadata: "binance",
    authority: user.address(),
    data: serializedJob.toString("hex"),
  });

  console.log(`Job created ${job.address}, hash: ${jobTxSig}`);

  // add btc usd to our aggregator
  const addJobTxSig = await aggregator.addJob({
    job: job.address,
  });

  console.log(`Aggregator add job tx: ${addJobTxSig}`);

  // initialize an update
  const openRoundTxSig = await aggregator.openRound();
  console.log(`Aggregator open round tx ${openRoundTxSig}`);

  // save result
  const saveResultTxSig = await aggregator.saveResult({
    oracle_address: oracle.address,
    oracle_idx: 0,
    error: false,
    value_num: 100,
    value_scale_factor: 0,
    value_neg: false,
    jobs_checksum: "",
  });
  console.log(`Save result tx: ${saveResultTxSig}`);

  const onUpdatePoller = onAggregatorOpenRound(client, async (e) => {
    console.log(`Aggregator Open Round Event:`, e);
    // (await onUpdatePoller).stop();
  });

  console.log("Starting 5 open rounds");
  let i = 5;
  while (i--) {
    await new Promise((r) => setTimeout(r, 1000));
    await aggregator.openRound();
  }
  (await onUpdatePoller).stop();

  console.log("logging all data objects");
  console.log("Aggregator:", await aggregator.loadData());
  console.log("Job:", await job.loadData());
  console.log("Oracle", await oracle.loadData());
  console.log("OracleQueue", await queue.loadData());
})();
