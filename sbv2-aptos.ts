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
  Oracle,
  OracleQueue,
  State,
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS,
} from "./src";

export const CHECK_ICON = chalk.green("\u2714");
export const FAILED_ICON = chalk.red("\u2717");

yargs(hideBin(process.argv))
  .scriptName("sbv2-aptos")
  .command(
    "create-account [keypair]",
    "create an Aptos account and save to fs",
    (y: any) => {
      return y.positional("keypair", {
        type: "string",
        describe: "filesystem path to save aptos secret key",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair } = argv;

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
    "address [keypair]",
    "print the hex address of the keypair",
    (y: any) => {
      return y.positional("keypair", {
        type: "string",
        describe: "filesystem path to a Solana keypair file",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, numAirdrops } = argv;

      const { client, faucet, account, state, pid } = await loadCli(
        rpcUrl,
        faucetUrl,
        keypair
      );

      console.log(`Address: ${account.address()}`);

      process.exit(0);
    }
  )
  .command(
    "airdrop [keypair]",
    "request from faucet",
    (y: any) => {
      return y
        .positional("keypair", {
          type: "string",
          describe: "filesystem path to a Solana keypair file",
          required: true,
        })
        .option("numAirdrops", {
          type: "number",
          describe: "number of airdrops to request",
          demand: false,
          default: 2,
        });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, numAirdrops } = argv;

      const { client, faucet, account, state, pid } = await loadCli(
        rpcUrl,
        faucetUrl,
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
    "create-queue [keypair]",
    "create an oracle queue",
    (y: any) => {
      return y.positional("keypair", {
        type: "string",
        describe: "filesystem path to an AptosAccount keypair file",
        required: true,
      });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair } = argv;

      const { client, faucet, account, state, pid } = await loadCli(
        rpcUrl,
        faucetUrl,
        keypair
      );

      const queueAccount = new AptosAccount();
      await faucet.fundAccount(queueAccount.address(), 5000);
      await faucet.fundAccount(queueAccount.address(), 5000);

      const [queue, sig] = await OracleQueue.init(client, queueAccount, {
        name: "TestQueue",
        metadata: "Testing123",
        authority: account.address(),
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
        mint: account.address(),
        enableBufferRelayers: false,
        maxSize: 10,
      });

      console.log(`Signature: ${sig}`);
      console.log(`Queue: ${queue.address}`);

      saveAptosAccount(
        queueAccount,
        `queue-${new Date().toJSON().slice(0, 10)}.json`
      );

      console.log(`queueAccount: ${queueAccount.address()}`);

      process.exit(0);
    }
  )
  .command(
    "create-oracle [queueHex] [keypair]",
    "action",
    (y: any) => {
      return y
        .positional("queueHex", {
          type: "string",
          describe: "hexString of the oracle queue to join",
          required: true,
        })
        .positional("keypair", {
          type: "string",
          describe: "filesystem path to an AptosAccount keypair file",
          required: true,
        });
    },
    async function (argv: any) {
      const { rpcUrl, faucetUrl, keypair, queueHex } = argv;

      const { client, faucet, account, state, pid } = await loadCli(
        rpcUrl,
        faucetUrl,
        keypair
      );

      const queueHexString = new HexString(queueHex);
      const queue = new OracleQueue(client, queueHexString);
      const oracleAccount = new AptosAccount();
      await faucet.fundAccount(oracleAccount.address(), 5000);

      const [oracle, sig] = await Oracle.init(client, oracleAccount, {
        address: SWITCHBOARD_STATE_ADDRESS,
        name: "TestOracle",
        metadata: "Testing123",
        authority: account.pubKey(),
        queue: queueHexString,
      });

      console.log(`Signature: ${sig}`);
      console.log(`Oracle: ${oracle.address}`);

      saveAptosAccount(
        oracleAccount,
        `oracle-${new Date().toJSON().slice(0, 10)}.json`
      );

      process.exit(0);
    }
  )
  .options({
    // cluster: {
    //   type: "string",
    //   alias: "c",
    //   describe: "Solana cluster to interact with",
    //   options: ["devnet", "mainnet-beta", "localnet"],
    //   default: "devnet",
    //   demand: false,
    // },
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
  })
  .help().argv;

function loadAptosAccount(keypairPath: string): AptosAccount {
  return new AptosAccount(
    new Uint8Array(JSON.parse(fs.readFileSync(keypairPath, "utf-8")))
  );
}

function saveAptosAccount(account: AptosAccount, keypairPath: string) {
  const privateKeyObject = account.toPrivateKeyObject();

  const buffer = Buffer.from(privateKeyObject.privateKeyHex.slice(2), "hex");
  if (buffer.byteLength === 0) {
    throw new Error("buffer empty");
  }

  fs.writeFileSync(
    keypairPath,
    `[${new Uint8Array(buffer).map((i) => Number(i)).toString()}]`,
    "utf-8"
  );
}

async function loadCli(
  rpcUrl: string,
  faucetUrl: string,
  keypairPath?: string
): Promise<{
  client: AptosClient;
  account: AptosAccount;
  faucet: FaucetClient;
  state: State;
  pid: string;
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

  const state = new State(client, SWITCHBOARD_STATE_ADDRESS, account);

  return {
    client,
    faucet,
    account,
    state,
    pid: SWITCHBOARD_DEVNET_ADDRESS,
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
