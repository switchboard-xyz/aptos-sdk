var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __markAsModule = (target) => __defProp(target, "__esModule", {value: true});
var __reExport = (target, module2, desc) => {
  if (module2 && typeof module2 === "object" || typeof module2 === "function") {
    for (let key of __getOwnPropNames(module2))
      if (!__hasOwnProp.call(target, key) && key !== "default")
        __defProp(target, key, {get: () => module2[key], enumerable: !(desc = __getOwnPropDesc(module2, key)) || desc.enumerable});
  }
  return target;
};
var __toModule = (module2) => {
  return __reExport(__markAsModule(__defProp(module2 != null ? __create(__getProtoOf(module2)) : {}, "default", module2 && module2.__esModule && "default" in module2 ? {get: () => module2.default, enumerable: true} : {value: module2, enumerable: true})), module2);
};

// src/main.ts
var import_buffer = __toModule(require("buffer"));
var import_aptos = __toModule(require("aptos"));
var import_aptos2 = __toModule(require("@switchboard-xyz/aptos.js"));
var import_big = __toModule(require("big.js"));
var NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
var FAUCET_URL = "https://faucet.devnet.aptoslabs.com";
var SWITCHBOARD_ADDRESS = "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";
var onAggregatorUpdate = (client, cb, pollIntervalMs = 1e3) => {
  const event = new import_aptos2.AptosEvent(client, import_aptos.HexString.ensure(SWITCHBOARD_ADDRESS), `${SWITCHBOARD_ADDRESS}::switchboard::State`, "aggregator_update_events", pollIntervalMs);
  event.onTrigger(cb);
  return event;
};
var onAggregatorOpenRound = (client, cb, pollIntervalMs = 1e3) => {
  const event = new import_aptos2.AptosEvent(client, import_aptos.HexString.ensure(SWITCHBOARD_ADDRESS), `${SWITCHBOARD_ADDRESS}::switchboard::State`, "aggregator_open_round_events", pollIntervalMs);
  event.onTrigger(cb);
  return event;
};
(async () => {
  const client = new import_aptos.AptosClient(NODE_URL);
  const faucetClient = new import_aptos.FaucetClient(NODE_URL, FAUCET_URL);
  let user = new import_aptos.AptosAccount();
  await faucetClient.fundAccount(user.address(), 5e7);
  console.log(`User account ${user.address().hex()} created + funded.`);
  const [queue, queueTxHash] = await import_aptos2.OracleQueueAccount.init(client, user, {
    name: "Switch Queue",
    metadata: "Nothing to see here",
    authority: user.address(),
    oracleTimeout: 3e3,
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
    enableBufferRelayers: false,
    maxSize: 1e3,
    coinType: "0x1::aptos_coin::AptosCoin"
  }, SWITCHBOARD_ADDRESS);
  console.log(`Oracle Queue ${queue.address} created. tx hash: ${queueTxHash}`);
  const [oracle, oracleTxHash] = await (0, import_aptos2.createOracle)(client, user, {
    name: "Switchboard OracleAccount",
    authority: user.address(),
    metadata: "metadata",
    queue: queue.address,
    coinType: "0x1::aptos_coin::AptosCoin"
  }, SWITCHBOARD_ADDRESS);
  console.log(`Oracle ${oracle.address} created. tx hash: ${oracleTxHash}`);
  const heartbeatTxHash = await oracle.heartbeat(user);
  console.log("First Heartbeat Tx Hash:", heartbeatTxHash);
  setInterval(async () => {
    try {
      const heartbeatTxHash2 = await oracle.heartbeat(user);
      console.log("Heartbeat Tx Hash:", heartbeatTxHash2);
    } catch (e) {
      console.log("failed heartbeat");
    }
  }, 3e4);
  const [crank, txhash] = await import_aptos2.CrankAccount.init(client, user, {
    queueAddress: queue.address,
    coinType: "0x1::aptos_coin::AptosCoin"
  }, SWITCHBOARD_ADDRESS);
  console.log(`Created crank at ${crank.address}, tx hash ${txhash}`);
  const serializedJob1 = import_buffer.Buffer.from(import_aptos2.OracleJob.encodeDelimited(import_aptos2.OracleJob.create({
    tasks: [
      {
        httpTask: {
          url: "https://www.binance.us/api/v3/ticker/price?symbol=BTCUSD"
        }
      },
      {
        jsonParseTask: {
          path: "$.price"
        }
      }
    ]
  })).finish());
  const [aggregator, createFeedTx] = await (0, import_aptos2.createFeed)(client, user, {
    authority: user.address(),
    queueAddress: queue.address,
    batchSize: 1,
    minJobResults: 1,
    minOracleResults: 1,
    minUpdateDelaySeconds: 5,
    startAfter: 0,
    varianceThreshold: new import_big.default(0),
    forceReportPeriod: 0,
    expiration: 0,
    coinType: "0x1::aptos_coin::AptosCoin",
    crankAddress: user.address().hex(),
    initialLoadAmount: 1e3,
    jobs: [
      {
        name: "BTC/USD",
        metadata: "binance",
        authority: user.address().hex(),
        data: serializedJob1.toString("base64"),
        weight: 1
      }
    ]
  }, SWITCHBOARD_ADDRESS);
  console.log(`Created AggregatorAccount and LeaseAccount resources at account address ${aggregator.address}. Tx hash ${createFeedTx}`);
  const updatePoller = onAggregatorUpdate(client, async (e) => {
    console.log(`NEW RESULT:`, e.data);
  });
  const onOpenRoundPoller = onAggregatorOpenRound(client, async (e) => {
    console.log(e);
    try {
      if (e.data.aggregator_address !== aggregator.address) {
        return;
      }
      const agg = new import_aptos2.AggregatorAccount(client, e.data.aggregator_address, SWITCHBOARD_ADDRESS);
      const aggregatorData = await agg.loadData();
      const jobs = await Promise.all(e.data.job_keys.map(async (jobKey) => {
        const job = new import_aptos2.JobAccount(client, jobKey, SWITCHBOARD_ADDRESS);
        const jobData = await job.loadJob().catch((e2) => {
          console.log(e2);
        });
        return jobData;
      }));
      const response = await fetch(`https://api.switchboard.xyz/api/test`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({jobs})
      });
      if (!response.ok)
        console.error(`[Task runner] Error testing jobs json.`);
      try {
        const json = await response.json();
        const tx = await aggregator.saveResult(user, {
          oracleAddress: oracle.address,
          oracleIdx: 0,
          error: false,
          value: new import_big.default(json.result),
          jobsChecksum: aggregatorData.jobs_checksum,
          minResponse: new import_big.default(json.result),
          maxResponse: new import_big.default(json.result)
        });
        console.log("save result tx:", tx);
      } catch (e2) {
      }
    } catch (e2) {
      console.log("open round resp fail");
    }
  });
  console.log("logging all data objects");
  console.log("AggregatorAccount:", await aggregator.loadData());
  console.log("LeaseAccount:", await new import_aptos2.LeaseAccount(client, aggregator.address, SWITCHBOARD_ADDRESS).loadData(queue.address));
  console.log("Load aggregator jobs data", await aggregator.loadJobs());
  console.log(await (0, import_aptos2.fetchAggregators)(client, user.address().hex(), SWITCHBOARD_ADDRESS));
  setInterval(() => {
    try {
      aggregator.openRound(user);
      console.log("opening round");
    } catch (e) {
      console.log("failed open round");
    }
  }, 1e4);
})();
//# sourceMappingURL=data:application/json;base64,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
