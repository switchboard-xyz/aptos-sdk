/**
 * Creates a new account, inititalizes a Switchboard Resource Account on it
 *
 * Using that it should:
 *
 * DEMO --
 * Creates a new Aggregator
 * Creates a new Job (ftx btc/usd),
 * Adds Job to Aggregator
 * Push Aggregator to Crank
 *
 */
import { Buffer } from "buffer";
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  Aggregator,
  Job,
  Lease,
  AptosEvent,
  EventCallback,
  Crank,
  OracleJob,
} from "./src";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_QUEUE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_CRANK_ADDRESS =
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

  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} created + funded.`);

  const aggregator_acct = new AptosAccount();
  const job_acct = new AptosAccount();

  await faucetClient.fundAccount(aggregator_acct.address(), 50000);
  await faucetClient.fundAccount(job_acct.address(), 5000);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 500000);

  const [aggregator, aggregatorTxSig] = await Aggregator.init(
    client,
    aggregator_acct,
    {
      authority: user.address(),
      queueAddress: SWITCHBOARD_QUEUE_ADDRESS,
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
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(`Aggregator: ${aggregator.address}, tx: ${aggregatorTxSig}`);

  // Make Job data for btc price
  const serializedJob = Buffer.from(
    OracleJob.encodeDelimited(
      OracleJob.create({
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
    job_acct,
    {
      name: "BTC/USD",
      metadata: "binance",
      authority: user.address().hex(),
      data: serializedJob.toString("hex"),
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(`Job created ${job.address}, hash: ${jobTxSig}`);

  // add btc usd to our aggregator
  const addJobTxSig = await aggregator.addJob(user, {
    job: job.address,
  });

  console.log(`Aggregator add job tx: ${addJobTxSig}`);

  const [lease, leaseTxSig] = await Lease.init(
    client,
    aggregator_acct,
    {
      queueAddress: SWITCHBOARD_QUEUE_ADDRESS,
      withdrawAuthority: user.address().hex(),
      initialAmount: 1000,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(lease, leaseTxSig);

  /**
   * Listen to Aggregator Update Calls
   *
   */

  const updatePoller = onAggregatorUpdate(client, async (e) => {
    if (aggregator.address == e.data.aggregator_address) {
      console.log(`NEW RESULT:`, e.data);
    }
  });

  const crank = new Crank(
    client,
    SWITCHBOARD_CRANK_ADDRESS,
    SWITCHBOARD_DEVNET_ADDRESS,
    SWITCHBOARD_STATE_ADDRESS
  );

  crank.push(user, {
    aggregatorAddress: aggregator_acct.address().hex(),
  });

  /**
   * Log Data Objects
   *
   */
  console.log("logging all data objects");
  console.log("Aggregator:", await aggregator.loadData());
  console.log("Job:", await job.loadData());
  console.log("Load aggregator jobs data", await aggregator.loadJobs());
})();
