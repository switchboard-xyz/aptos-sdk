#!/usr/bin/env ts-node-esm

/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable @typescript-eslint/no-var-requires */
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
// import yargs from "yargs";
// import { hideBin } from "yargs/helpers";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { AptosAccount, AptosClient, FaucetClient, HexString } from "aptos";
import {
  Aggregator,
  Job,
  Oracle,
  OracleQueue,
  State,
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS,
} from "./src";
import { OracleJob } from "@switchboard-xyz/switchboard-v2";

export const CHECK_ICON = chalk.green("\u2714");
export const FAILED_ICON = chalk.red("\u2717");

yargs(hideBin(process.argv))
  .scriptName("sbv2-aptos")
  .command(
    "create-account",
    "create an Aptos account and save to fs",
    (y: any) => {
      return y;
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, pid, stateAddress } = argv;

      const client = new AptosClient(rpcUrl);
      const faucet = new FaucetClient(rpcUrl, faucetUrl);

      const account = new AptosAccount();

      await faucet.fundAccount(account.address(), 5000);
      await faucet.fundAccount(account.address(), 5000);
      await faucet.fundAccount(account.address(), 5000);
      await faucet.fundAccount(account.address(), 5000);
      await faucet.fundAccount(account.address(), 5000);
      await faucet.fundAccount(account.address(), 5000);

      console.log(`Account: ${account.address()}`);
      console.log(`Balance: ${await loadBalance(client, account.address())}`);

      saveAptosAccount(account, keypair);

      process.exit(0);
    }
  )
  .command(
    "address",
    "print the hex address of the keypair",
    (y: any) => {
      return y;
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, numAirdrops } = argv;
      const client = new AptosClient(rpcUrl);
      const account = loadAptosAccount(keypair);
      console.log(`Address: ${account.address()}`);
      const balance = await loadBalance(client, account.address());
      console.log(`Balance: ${balance}`);
      process.exit(0);
    }
  )
  .command(
    "airdrop",
    "request from faucet",
    (y: any) => {
      return y.option("numAirdrops", {
        type: "number",
        describe: "number of airdrops to request",
        demand: false,
        default: 2,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, numAirdrops, pid, stateAddress } =
        argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      for await (const _ of new Array(numAirdrops)) {
        await faucet.fundAccount(account.address(), 5000);
      }

      console.log(`Address: ${account.address()}`);
      console.log(`Balance: ${await loadBalance(client, account.address())}`);

      process.exit(0);
    }
  )
  .command(
    "create-state",
    "create an oracle queue",
    (y: any) => {
      return y;
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, pid, stateAddress } = argv;

      const { client, faucet, account } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      const stateAccount = new AptosAccount();
      await faucet.fundAccount(stateAccount.address(), 5000);

      const [state, sig] = await State.init(client, stateAccount, pid);

      console.log(`Signature: ${sig}`);
      console.log(`State: ${state.address}`);

      saveAptosAccount(
        stateAccount,
        `state-${new Date().toJSON().slice(0, 10)}-${stateAccount.address}.json`
      );

      console.log(`stateAccount: ${stateAccount.address()}`);

      try {
        const stateData = await state.loadData();
        console.log(JSON.stringify(stateData, undefined, 2));
      } catch (error) {
        console.error(`Error fetching state data: ${error}`);
      }

      process.exit(0);
    }
  )
  .command(
    "create-queue",
    "create an oracle queue",
    (y: any) => {
      return y;
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, pid, stateAddress } = argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      const queueAccount = new AptosAccount();
      await faucet.fundAccount(queueAccount.address(), 5000);
      await faucet.fundAccount(queueAccount.address(), 5000);

      const [queue, sig] = await OracleQueue.init(
        client,
        queueAccount,
        {
          name: "TestQueue",
          metadata: "Testing123",
          authority: account.address().hex(),
          oracleTimeout: 180,
          reward: 0,
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
          mint: account.address().hex(),
          enableBufferRelayers: false,
          maxSize: 10,
        },
        pid,
        stateAddress
      );

      console.log(`Signature: ${sig}`);
      console.log(`Queue: ${queue.address}`);

      saveAptosAccount(
        queueAccount,
        `queue-${new Date().toJSON().slice(0, 10)}-${queueAccount.address}.json`
      );

      console.log(`queueAccount: ${queueAccount.address()}`);

      try {
        const queueData = await queue.loadData();
        console.log(JSON.stringify(queueData, undefined, 2));
      } catch (error) {
        console.error(`Error fetching queue data: ${error}`);
      }

      process.exit(0);
    }
  )
  .command(
    "create-oracle [queueHex]",
    "action",
    (y: any) => {
      return y.positional("queueHex", {
        type: "string",
        describe: "hexString of the oracle queue to join",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, queueHex, pid, stateAddress } = argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      const queueHexString = new HexString(queueHex);
      const queue = new OracleQueue(client, queueHexString);
      const oracleAccount = new AptosAccount();
      await faucet.fundAccount(oracleAccount.address(), 5000);

      console.log(`authority = ${account.address()}`);

      const [oracle, sig] = await Oracle.init(
        client,
        oracleAccount,
        {
          address: SWITCHBOARD_STATE_ADDRESS,
          name: "TestOracle",
          metadata: "Testing123",
          authority: account.address(),
          queue: queueHexString,
        },
        pid,
        stateAddress
      );

      console.log(`Signature: ${sig}`);
      console.log(`Oracle: ${oracle.address}`);
      console.log(`oracleAccount: ${oracleAccount.address()}`);

      saveAptosAccount(
        oracleAccount,
        `oracle-${new Date()
          .toJSON()
          .slice(0, 10)}-${oracleAccount.address()}.json`
      );

      try {
        const oracleData = await oracle.loadData();
        console.log(JSON.stringify(oracleData, undefined, 2));
      } catch (error) {
        console.error(`Error fetching oracle data: ${error}`);
      }

      process.exit(0);
    }
  )
  .command(
    "create-aggregator [queueHex]",
    "action",
    (y: any) => {
      return y.positional("queueHex", {
        type: "string",
        describe: "hexString of the oracle queue to join",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, queueHex, pid, stateAddress } = argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      const queueHexString = new HexString(queueHex);
      const queue = new OracleQueue(client, queueHexString);

      const aggregatorAccount = new AptosAccount();
      await faucet.fundAccount(aggregatorAccount.address(), 5000);
      await faucet.fundAccount(aggregatorAccount.address(), 5000);
      await faucet.fundAccount(aggregatorAccount.address(), 5000);

      const [aggregator, aggregatorSig] = await Aggregator.init(
        client,
        aggregatorAccount,
        {
          authority: account.address(),
          name: "BTC/USD",
          metadata: "Switchboard BTC/USD Feed",
          queueAddress: queue.address,
          batchSize: 1,
          minOracleResults: 1,
          minJobResults: 3,
          minUpdateDelaySeconds: 8,
        },
        pid,
        stateAddress
      );
      console.log(`Aggregator Address: ${aggregator.address}`);
      console.log(`Aggregator Signature: ${aggregatorSig}`);

      const job1 = await createJob(
        client,
        faucet,
        account,
        FTX_COM_BTC_USD_JOB,
        "Ftx BTC/USD",
        aggregator
      );

      const job2 = await createJob(
        client,
        faucet,
        account,
        COINBASE_BTC_USD_JOB,
        "Coinbase BTC/USD",
        aggregator
      );

      const job3 = await createJob(
        client,
        faucet,
        account,
        BINANCE_BTC_USD_JOB,
        "Binance BTC/USD",
        aggregator
      );
      const job4 = await createJob(
        client,
        faucet,
        account,
        BITFINEX_BTC_USD_JOB,
        "Bitfinex BTC/USD",
        aggregator
      );
      const job5 = await createJob(
        client,
        faucet,
        account,
        BITSTAMP_BTC_USD_JOB,
        "Bitstamp BTC/USD",
        aggregator
      );
      // const job6 = await createJob(
      //   client,
      //   faucet,
      //   account,
      //   KRAKEN_BTC_USD_JOB,
      //   "Kraken BTC/USD",
      //   aggregator
      // );
      // const job7 = await createJob(
      //   client,
      //   faucet,
      //   account,
      //   HUOBI_BTC_USD_JOB,
      //   "Huobi BTC/USD",
      //   aggregator
      // );
      // const job8 = await createJob(
      //   client,
      //   faucet,
      //   account,
      //   OKEX_BTC_USD_JOB,
      //   "Okex BTC/USD",
      //   aggregator
      // );

      saveAptosAccount(
        aggregatorAccount,
        `aggregator-${new Date().toJSON().slice(0, 10)}-${
          aggregator.address
        }.json`
      );

      try {
        const aggregatorData = await aggregator.loadData();
        console.log(JSON.stringify(aggregatorData, undefined, 2));
      } catch (error) {
        console.error(`Error fetching aggregator data: ${error}`);
      }

      process.exit(0);
    }
  )
  .command(
    "open-round [aggregatorHex]",
    "action",
    (y: any) => {
      return y.positional("aggregatorHex", {
        type: "string",
        describe: "hexString of the aggregator to call open round for",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, aggregatorHex, pid, stateAddress } =
        argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress,
        keypair
      );

      const aggregatorHexString = new HexString(aggregatorHex);
      const aggregator = new Aggregator(
        client,
        aggregatorHexString,
        account,
        pid,
        stateAddress
      );

      const openRoundSig = await aggregator.openRound();
      console.log(`OpenRound Signature: ${openRoundSig}`);

      process.exit(0);
    }
  )
  .command(
    "watch-aggregator [aggregatorHex]",
    "action",
    (y: any) => {
      return y.positional("aggregatorHex", {
        type: "string",
        describe: "hexString of the aggregator to call open round for",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, aggregatorHex, pid, stateAddress } =
        argv;

      const { client, faucet, account, state } = await loadCli(
        rpcUrl,
        faucetUrl,
        pid,
        stateAddress
      );

      const aggregatorHexString = new HexString(aggregatorHex);
      const aggregator = new Aggregator(client, aggregatorHexString);

      const event = await aggregator.watch(async (event) => {
        console.log(`Aggregator Updated @ ${Date.now()}`);
        console.log(JSON.stringify(event, undefined, 2));
      });

      // process.exit(0);
    }
  )
  .options({
    keypair: {
      type: "string",
      alias: "k",
      describe: "filesystem path to an AptosAccount keypair file",
      required: true,
    },
    rpcUrl: {
      type: "string",
      alias: "u",
      describe: "Alternative RPC URL",
      default: "https://fullnode.devnet.aptoslabs.com",
    },
    faucetUrl: {
      type: "string",
      describe: "Alternative Faucet URL",
      default: "https://faucet.devnet.aptoslabs.com",
    },
    pid: {
      type: "string",
      describe: "devnet program ID",
      default: SWITCHBOARD_DEVNET_ADDRESS,
    },
    stateAddress: {
      type: "string",
      describe: "state address",
      default: SWITCHBOARD_STATE_ADDRESS,
    },
  })
  .help().argv;

function loadAptosAccount(keypairPath: string): AptosAccount {
  return new AptosAccount(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );
}

function saveAptosAccount(account: AptosAccount, keypairName: string) {
  const privateKeyObject = account.toPrivateKeyObject();

  const buffer = Buffer.from(privateKeyObject.privateKeyHex.slice(2), "hex");
  if (buffer.byteLength === 0) {
    throw new Error("buffer empty");
  }

  const outputDir = path.join(process.cwd(), ".switchboard");

  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, keypairName),
    `[${new Uint8Array(buffer).map((i) => Number(i)).toString()}]`,
    "utf-8"
  );
}

async function loadCli(
  rpcUrl: string,
  faucetUrl: string,
  pid: string,
  stateAddress: string,
  keypairPath?: string
): Promise<{
  client: AptosClient;
  account: AptosAccount;
  faucet: FaucetClient;
  state: State;
}> {
  const client = new AptosClient(rpcUrl);
  const faucet = new FaucetClient(rpcUrl, faucetUrl);

  let account: AptosAccount;

  if (keypairPath) {
    account = loadAptosAccount(keypairPath);
  } else {
    account = new AptosAccount();
    await faucet.fundAccount(account.address(), 5000);
  }

  const state = new State(client, stateAddress, account, pid);

  return {
    client,
    faucet,
    account,
    state,
  };
}

async function loadBalance(
  client: AptosClient,
  addr: HexString
): Promise<string> {
  return (
    (
      await client.getAccountResource(
        addr,
        "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      )
    ).data as any
  ).coin.value;
}

async function createJob(
  client: AptosClient,
  faucet: FaucetClient,
  authority: AptosAccount,
  oracleJob: OracleJob,
  name: string,
  aggregator: Aggregator
): Promise<Job> {
  const jobAccount = new AptosAccount();
  await faucet.fundAccount(jobAccount.address(), 5000);
  // await faucet.fundAccount(jobAccount.address(), 5000);

  const serializedJob = Buffer.from(
    OracleJob.encodeDelimited(oracleJob).finish()
  );

  const [job, jobSig] = await Job.init(
    client,
    jobAccount,
    {
      name: name,
      metadata: name,
      authority: authority.address(),
      data: serializedJob.toString("hex"),
    },
    aggregator.devnetAddress,
    aggregator.stateAddress
  );
  console.log(`Job Address (${name}): ${job.address}`);
  console.log(`Job Signature (${name}): ${jobSig}`);

  const addJobSig = await aggregator.addJob(authority, {
    job: job.address,
  });
  console.log(`Add Job Signature (${name}): ${addJobSig}`);

  saveAptosAccount(
    jobAccount,
    `job-${new Date().toJSON().slice(0, 10)}-${job.address}.json`
  );

  return job;
}

const FTX_COM_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      websocketTask: {
        url: "wss://ftx.com/ws/",
        subscription:
          '{"op":"subscribe","channel":"ticker","market":"BTC/USD"}',
        maxDataAgeSeconds: 15,
        filter:
          "$[?(@.type == 'update' && @.channel == 'ticker' && @.market == 'BTC/USD')]",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$.data.bid",
            },
          },
          {
            jsonParseTask: {
              path: "$.data.ask",
            },
          },
          {
            jsonParseTask: {
              path: "$.data.last",
            },
          },
        ],
      },
    },
  ],
});

const COINBASE_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      websocketTask: {
        url: "wss://ws-feed.pro.coinbase.com",
        subscription:
          '{"type":"subscribe","product_ids":["BTC-USD"],"channels":["ticker",{"name":"ticker","product_ids":["BTC-USD"]}]}',
        maxDataAgeSeconds: 15,
        filter: "$[?(@.type == 'ticker' && @.product_id == 'BTC-USD')]",
      },
    },
    {
      jsonParseTask: {
        path: "$.price",
      },
    },
  ],
});

const BINANCE_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      httpTask: {
        url: "https://www.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      },
    },
    {
      jsonParseTask: {
        path: "$.price",
      },
    },
    {
      multiplyTask: {
        aggregatorPubkey: "ETAaeeuQBwsh9mC2gCov9WdhJENZuffRMXY2HgjCcSL9",
      },
    },
  ],
});

const BITFINEX_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      httpTask: {
        url: "https://api-pub.bitfinex.com/v2/tickers?symbols=tBTCUSD",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$[0][1]",
            },
          },
          {
            jsonParseTask: {
              path: "$[0][3]",
            },
          },
          {
            jsonParseTask: {
              path: "$[0][7]",
            },
          },
        ],
      },
    },
  ],
});

const HUOBI_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      httpTask: {
        url: "https://api.huobi.pro/market/detail/merged?symbol=btcusdt",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$.tick.bid[0]",
            },
          },
          {
            jsonParseTask: {
              path: "$.tick.ask[0]",
            },
          },
        ],
      },
    },
    {
      multiplyTask: {
        aggregatorPubkey: "ETAaeeuQBwsh9mC2gCov9WdhJENZuffRMXY2HgjCcSL9",
      },
    },
  ],
});

const BITSTAMP_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      httpTask: {
        url: "https://www.bitstamp.net/api/v2/ticker/btcusd",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$.ask",
            },
          },
          {
            jsonParseTask: {
              path: "$.bid",
            },
          },
          {
            jsonParseTask: {
              path: "$.last",
            },
          },
        ],
      },
    },
  ],
});

const KRAKEN_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      httpTask: {
        url: "https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$.result.XXBTZUSD.a[0]",
            },
          },
          {
            jsonParseTask: {
              path: "$.result.XXBTZUSD.b[0]",
            },
          },
          {
            jsonParseTask: {
              path: "$.result.XXBTZUSD.c[0]",
            },
          },
        ],
      },
    },
  ],
});

const OKEX_BTC_USD_JOB = OracleJob.create({
  tasks: [
    {
      websocketTask: {
        url: "wss://ws.okex.com:8443/ws/v5/public",
        subscription:
          '{"op":"subscribe","args":[{"channel":"tickers","instId":"BTC-USDT"}]}',
        maxDataAgeSeconds: 15,
        filter:
          "$[?(@.event != 'subscribe' && @.arg.channel == 'tickers' && @.arg.instId == 'BTC-USDT' && @.data[0].instType == 'SPOT' && @.data[0].instId == 'BTC-USDT')]",
      },
    },
    {
      medianTask: {
        tasks: [
          {
            jsonParseTask: {
              path: "$.data[0].bidPx",
            },
          },
          {
            jsonParseTask: {
              path: "$.data[0].askPx",
            },
          },
          {
            jsonParseTask: {
              path: "$.data[0].last",
            },
          },
        ],
      },
    },
    {
      multiplyTask: {
        aggregatorPubkey: "ETAaeeuQBwsh9mC2gCov9WdhJENZuffRMXY2HgjCcSL9",
      },
    },
  ],
});
