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
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  State,
  Aggregator,
  Job,
  Oracle,
  OracleQueue,
  Lease,
  AptosEvent,
  EventCallback,
  Permission,
  Crank,
  SwitchboardPermission,
} from "./src";
import fetch from "node-fetch";
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";
const SWITCHBOARD_STATE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const onAggregatorOpenRound = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_STATE_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_open_round_events",
    pollIntervalMs
  );
  event.onTrigger(cb);
  return event;
};

const onAggregatorSaveResult = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_STATE_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_save_result_events",
    pollIntervalMs
  );
  event.onTrigger(cb);
  return event;
};

const onAggregatorUpdate = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_STATE_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
    "aggregator_update_events",
    pollIntervalMs
  );
  event.onTrigger(cb);
  return event;
};

// run it all at once
(async () => {
  // INFRA ------
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

  // create new user
  const user = new AptosAccount();
  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} created + funded.`);
  const [stateTxSig] = await State.init(
    client,
    user,
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(
    `State account: ${user
      .address()
      .hex()} \ncreated, tx: ${stateTxSig} (won't be used)`
  );

  const aggregator_resource_acct = new AptosAccount();
  const queue_resource_acct = new AptosAccount();
  const oracle_resource_acct = new AptosAccount();
  const job_resource_acct = new AptosAccount();

  await faucetClient.fundAccount(aggregator_resource_acct.address(), 50000);
  await faucetClient.fundAccount(queue_resource_acct.address(), 5000);
  await faucetClient.fundAccount(oracle_resource_acct.address(), 5000);
  await faucetClient.fundAccount(job_resource_acct.address(), 5000);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 500000);

  const [queue, queueTxSig] = await OracleQueue.init(
    client,
    queue_resource_acct,
    {
      name: "Switch Queue",
      metadata: "Nothing to see here",
      authority: user.address(),
      oracleTimeout: 3000,
      reward: 1,
      minStake: 0,
      slashingEnabled: false,
      varianceToleranceMultiplierValue: 0,
      varianceToleranceMultiplierScale: 0,
      feedProbationPeriod: 0,
      consecutiveFeedFailureLimit: 0,
      consecutiveOracleFailureLimit: 0,
      unpermissionedFeedsEnabled: true,
      unpermissionedVrfEnabled: true,
      lockLeaseFunding: false,
      mint: user.address(),
      enableBufferRelayers: false,
      maxSize: 1000,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(`Queue: ${queue.address}, tx: ${queueTxSig}`);

  const [aggregator, aggregatorTxSig] = await Aggregator.init(
    client,
    aggregator_resource_acct,
    {
      authority: user.address(),
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
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(`Aggregator: ${aggregator.address}, tx: ${aggregatorTxSig}`);

  const [oracle, oracleTxSig] = await Oracle.init(
    client,
    oracle_resource_acct,
    {
      address: oracle_resource_acct.address(),
      name: "Switchboard Oracle",
      metadata: "metadata",
      authority: user.address(),
      queue: queue.address,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(`Oracle: ${oracle.address}, tx: ${oracleTxSig}`);

  // create permission for oracle
  const [oraclePermission] = await Permission.init(
    client,
    user,
    {
      authority: user.address().hex(),
      granter: queue.address,
      grantee: oracle.address,
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  // enable heartbeat on oracle
  await oraclePermission.set(
    user,
    {
      authority: user.address().hex(),
      granter: queue.address.toString(),
      grantee: oracle.address.toString(),
      permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
      enable: true,
    },
    SWITCHBOARD_STATE_ADDRESS
  );

  // trigger the oracle heartbeat
  const heartbeatTxSig = await oracle.heartbeat(user);
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

  const [job, jobTxSig] = await Job.init(
    client,
    job_resource_acct,
    {
      name: "BTC/USD",
      metadata: "binance",
      authority: user.address(),
      data: serializedJob.toString("hex"),
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(`Job created ${job.address}, hash: ${jobTxSig}`);

  // add btc usd to our aggregator
  const addJobTxSig = await aggregator.addJob(user, {
    job: job.address,
  });

  console.log(`Aggregator add job tx: ${addJobTxSig}`);

  const [lease, leaseTxSig] = await Lease.init(
    client,
    aggregator_resource_acct,
    {
      queueAddress: queue.address,
      withdrawAuthority: user.address().hex(),
      initialAmount: 10,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(lease, leaseTxSig);

  // initialize an update
  const openRoundTxSig = await aggregator.openRound(user);
  console.log(`Aggregator open round tx ${openRoundTxSig}`);

  // save result
  const saveResultTxSig = await aggregator.saveResult(user, {
    oracle_address: oracle.address,
    oracle_idx: 0,
    error: false,
    value_num: 100,
    value_scale_factor: 0,
    value_neg: false,
    jobs_checksum: "",
  });
  console.log(`Save result tx: ${saveResultTxSig}`);

  const onOpenRoundPoller = onAggregatorOpenRound(client, async (e) => {
    console.log(e.sequence_number);

    // The event data includes Job Pubkeys, so grab the Job Data
    const jobsData = (
      await Promise.all(
        e.data?.job_keys?.map((jobAddress: any) =>
          new Job(
            client,
            jobAddress,
            SWITCHBOARD_DEVNET_ADDRESS,
            SWITCHBOARD_STATE_ADDRESS
          ).loadData()
        )
      )
    ).map((job) => {
      // slice off the first two because move prepends 0x to everything :|
      let jobData = Buffer.from(job.data.slice(2), "hex");
      return sbv2.OracleJob.decodeDelimited(jobData);
    }); // just grab the OracleJob[]

    // fake it till you make it, call the task runner
    const response = await fetch(`https://api.switchboard.xyz/api/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobs: jobsData }),
    });

    if (!response.ok) console.error(`[Task runner] Error testing jobs json.`);
    try {
      const json = await response.json();
      console.log(json);
    } catch (e) {
      console.log(e);
    }
  });

  /**
   * Listen to Aggregator Update Calls
   *
   */

  const updatePoller = onAggregatorUpdate(client, async (e) => {
    console.log(`NEW RESULT:`, e.data);
  });

  /**
   * Run Updates
   *
   */

  console.log("Starting open rounds");
  let i = 5;
  while (i--) {
    // every 5 seconds
    await new Promise((r) => setTimeout(r, 10000));
    await aggregator.openRound(user);
  }

  // close out listeners so process can end
  onOpenRoundPoller.stop();
  updatePoller.stop();

  const [crank, txhash] = await Crank.init(
    client,
    user,
    {
      address: SWITCHBOARD_STATE_ADDRESS,
      queueAddress: queue.address,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );
  console.log(`Created crank at ${crank.address}, tx hash ${txhash}`);

  /**
   * Log Data Objects
   *
   */
  console.log("logging all data objects");
  console.log("Aggregator:", await aggregator.loadData());
  console.log("Job:", await job.loadData());
  console.log("Oracle", await oracle.loadData());
  console.log("OracleQueue", await queue.loadData());
  console.log("Load aggregator jobs data", await aggregator.loadJobs());
})();
