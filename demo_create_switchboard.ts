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
import YAML from "yaml";
import fs from "fs";

const NODE_URL = "http://aptos-devnet.switchboard.xyz/";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";
const SWITCHBOARD_STATE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

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
  let user = new AptosAccount();

  // if file extension ends with yaml
  try {
    const parsedYaml = YAML.parse(
      fs.readFileSync("./.aptos/config.yaml", "utf8")
    );
    if (
      "profiles" in parsedYaml &&
      "default" in parsedYaml.profiles &&
      "private_key" in parsedYaml.profiles.default
    ) {
      user = new AptosAccount(
        HexString.ensure(parsedYaml.profiles.default.private_key).toBuffer()
      );
    }
  } catch {}
  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} created + funded.`);

  const aggregator_resource_acct = new AptosAccount();
  const job_resource_acct = new AptosAccount();

  await faucetClient.fundAccount(aggregator_resource_acct.address(), 50000);
  await faucetClient.fundAccount(job_resource_acct.address(), 5000);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 500000);

  const [aggregator, aggregatorTxSig] = await Aggregator.init(
    client,
    aggregator_resource_acct,
    {
      authority: user.address(),
      queueAddress: user.address(),
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
      authority: user.address().hex(),
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
      queueAddress: user.address().hex(),
      withdrawAuthority: user.address().hex(),
      initialAmount: 1000,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  console.log(lease, leaseTxSig);

  /**
   * Listen to Aggregator Update Calls
   *
   */

  const updatePoller = onAggregatorUpdate(client, async (e) => {
    console.log(`NEW RESULT:`, e.data);
  });

  const crank = new Crank(
    client,
    user.address().hex(),
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  crank.push(user, {
    aggregatorAddress: aggregator_resource_acct.address().hex(),
  });

  /**
   * Log Data Objects
   *
   */
  console.log("logging all data objects");
  console.log("Aggregator:", await aggregator.loadData());
  console.log("Job:", await job.loadData());
  console.log("Load aggregator jobs data", await aggregator.loadJobs());

  /**
   * Run Updates
   *
   */

  console.log("Starting open rounds");
  let i = 5;
  while (i--) {
    // every 5 seconds
    await new Promise((r) => setTimeout(r, 5000));
  }

  // close out listeners so process can end
  updatePoller.stop();

  console.log("Aggregator:", await aggregator.loadData());
})();
