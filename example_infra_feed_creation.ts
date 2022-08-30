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
 */
import { Buffer } from "buffer";
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  LeaseAccount,
  AptosEvent,
  EventCallback,
  JobAccount,
  OracleJob,
  OracleAccount,
  OracleQueueAccount,
  CrankAccount,
  Permission,
  SwitchboardPermission,
  createFeed,
  AptosDecimal,
  AggregatorAccount,
} from "./src";
import Big from "big.js";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_QUEUE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_CRANK_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const onAggregatorUpdate = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::switchboard::State`,
    "aggregator_update_events",
    pollIntervalMs
  );
  event.onTrigger(cb);
  return event;
};

const onAggregatorOpenRound = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::switchboard::State`,
    "aggregator_open_round_events",
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
  await faucetClient.fundAccount(user.address(), 50000);
  console.log(`User account ${user.address().hex()} created + funded.`);

  const [queue, queueTxHash] = await OracleQueueAccount.init(
    client,
    user,
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
    SWITCHBOARD_DEVNET_ADDRESS
  );
  console.log(`Oracle Queue ${queue.address} created. tx hash: ${queueTxHash}`);

  const [oracle, oracleTxHash] = await OracleAccount.init(
    client,
    user,
    {
      address: user.address(),
      name: "Switchboard OracleAccount",
      metadata: "metadata",
      authority: user.address(),
      queue: queue.address,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(`OracleAccount: ${oracle.address}, tx hash: ${oracleTxHash}`);

  // create permission for oracle
  const [oraclePermission] = await Permission.init(
    client,
    user,
    {
      authority: user.address().hex(),
      granter: queue.address,
      grantee: oracle.address,
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  // enable heartbeat on oracle
  try {
    await oraclePermission.set(user, {
      authority: user.address().hex(),
      granter: queue.address,
      grantee: oracle.address,
      permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
      enable: true,
    });
  } catch (e) {
    console.log("permission created already");
  }

  // first heartbeat
  const heartbeatTxHash = await oracle.heartbeat(user);
  console.log("First Heartbeat Tx Hash:", heartbeatTxHash);

  // heartbeat every 30 seconds
  setInterval(async () => {
    try {
      const heartbeatTxHash = await oracle.heartbeat(user);
      console.log("Heartbeat Tx Hash:", heartbeatTxHash);
    } catch (e) {
      console.log("failed heartbeat");
    }
  }, 30000);

  // create crank to catch aggregator push
  const [crank, txhash] = await CrankAccount.init(
    client,
    user,
    {
      address: user.address().hex(),
      queueAddress: queue.address,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );
  console.log(`Created crank at ${crank.address}, tx hash ${txhash}`);

  // Make JobAccount data for btc price
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

  const [aggregator, createFeedTx] = await createFeed(
    client,
    user,
    {
      authority: user.address(),
      queueAddress: queue.address,
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
      crank: user.address().hex(),
      initialLoadAmount: 1000,
      jobs: [
        {
          name: "BTC/USD",
          metadata: "binance",
          authority: user.address().hex(),
          data: serializedJob.toString(),
          weight: 1,
        },
      ],
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(
    `Created AggregatorAccount and LeaseAccount resources at account address ${aggregator.address}. Tx hash ${createFeedTx}`
  );

  const updatePoller = onAggregatorUpdate(client, async (e) => {
    console.log(`NEW RESULT:`, e.data);
  });

  const onOpenRoundPoller = onAggregatorOpenRound(client, async (e) => {
    try {
      // only handle updates for this aggregator
      if (e.data.aggregator_address !== aggregator.address) {
        return;
      }

      const agg = new AggregatorAccount(
        client,
        e.data.aggregator_address,
        SWITCHBOARD_DEVNET_ADDRESS
      );

      const aggregatorData = await agg.loadData();

      // The event data includes JobAccount Pubkeys, so grab the JobAccount Data
      const jobs: OracleJob[] = await Promise.all(
        e.data.job_keys.map(async (jobKey: string) => {
          const job = new JobAccount(
            client,
            jobKey,
            SWITCHBOARD_DEVNET_ADDRESS
          );
          const jobData = await job.loadJob().catch((e) => {
            console.log(e);
          });
          return jobData;
        })
      );

      // simulate a fetch
      const response = await fetch(`https://api.switchboard.xyz/api/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs }),
      });

      if (!response.ok) console.error(`[Task runner] Error testing jobs json.`);
      try {
        const json = await response.json();
        const value = new Big(json.result); // emulate our task runner with test api
        const resultDecimal = AptosDecimal.fromBig(value);

        // try save result
        const tx = await aggregator.saveResult(user, {
          oracleAddress: oracle.address,
          oracleIdx: 0,
          error: false,
          valueNum: Number(resultDecimal.mantissa),
          valueScaleFactor: resultDecimal.scale,
          valueNeg: resultDecimal.neg,
          jobsChecksum: aggregatorData.jobs_checksum,
          minResponseNum: Number(resultDecimal.mantissa),
          minResponseScaleFactor: resultDecimal.scale,
          minResponseNeg: resultDecimal.neg,
          maxResponseNum: Number(resultDecimal.mantissa),
          maxResponseScaleFactor: resultDecimal.scale,
          maxResponseNeg: resultDecimal.neg,
        });
        console.log("save result tx:", tx);
      } catch (e) {} // errors will happen when task runner returns them
    } catch (e) {
      console.log("open round resp fail");
    }
  });

  /**
   * Log Data Objects
   */
  console.log("logging all data objects");
  console.log("AggregatorAccount:", await aggregator.loadData());
  console.log(
    "LeaseAccount:",
    await new LeaseAccount(
      client,
      aggregator.address,
      SWITCHBOARD_DEVNET_ADDRESS
    ).loadData()
  );
  console.log("Load aggregator jobs data", await aggregator.loadJobs());

  setInterval(() => {
    try {
      aggregator.openRound(user);
    } catch (e) {
      console.log("failed open round");
    }
  }, 7000);
})();
