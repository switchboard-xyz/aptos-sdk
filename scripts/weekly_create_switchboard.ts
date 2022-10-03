import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  OracleQueueAccount,
  CrankAccount,
  generateResourceAccountAddress,
  createOracle,
} from "../src";
import YAML from "yaml";
import fs from "fs";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_ADDRESS =
  "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";

// run it all at once
(async () => {
  // INFRA ------
  const client = new AptosClient(NODE_URL);
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

  let user;

  // if file extension ends with yaml
  try {
    const parsedYaml = YAML.parse(
      fs.readFileSync("../.aptos/config.yaml", "utf8")
    );
    user = new AptosAccount(
      HexString.ensure(parsedYaml.profiles.default.private_key).toUint8Array()
    );
  } catch (e) {
    console.log(e);
  }

  //await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} funded.`);

  // // user will be authority
  // await faucetClient.fundAccount(
  //   HexString.ensure(SWITCHBOARD_ADDRESS),
  //   5000000000
  // );

  let queue: any;
  try {
    const [q, queueTxSig] = await OracleQueueAccount.init(
      client,
      user,
      {
        name: "Switch Queue",
        metadata: "Nothing to see here",
        authority: user.address(),
        oracleTimeout: 3000,
        reward: 52400, // gas cost of a saveResult
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
        maxSize: 1000,
        coinType: "0x1::aptos_coin::AptosCoin",
      },
      SWITCHBOARD_ADDRESS
    );
    console.log(`Queue: ${q.address}, tx: ${queueTxSig}`);
    queue = q;
  } catch (e) {
    console.log(e);
    queue = new OracleQueueAccount(
      client,
      user.address().hex(),
      SWITCHBOARD_ADDRESS
    );
  }

  try {
    await queue.setConfigs(user, {
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
      enableBufferRelayers: false,
      maxSize: 1000,
      coinType: "0x1::aptos_coin::AptosCoin",
    });
  } catch (e) {
    console.log(e);
  }

  let oracle;
  try {
    const [o, oracleTxHash] = await createOracle(
      client,
      user,
      {
        name: "Switchboard OracleAccount",
        authority: user.address(),
        metadata: "metadata",
        queue: queue.address,
        coinType: "0x1::aptos_coin::AptosCoin",
      },
      SWITCHBOARD_ADDRESS
    );
    oracle = o;
    console.log(`Oracle ${oracle.address} created. tx hash: ${oracleTxHash}`);
  } catch (e) {
    console.log(e);
    queue = new OracleQueueAccount(
      client,
      user.address().hex(),
      SWITCHBOARD_ADDRESS
    );
  }

  try {
    // trigger the oracle heartbeat
    const heartbeatTxSig = await oracle.heartbeat(user);
    console.log("Heartbeat Tx Hash:", heartbeatTxSig);
  } catch (e) {
    console.log("could not heartbeat");
  }

  let crank: any;

  try {
    const [c, txhash] = await CrankAccount.init(
      client,
      user,
      {
        queueAddress: queue.address,
        coinType: "0x1::aptos_coin::AptosCoin",
      },
      SWITCHBOARD_ADDRESS
    );
    console.log(`Created crank at ${crank.address}, tx hash ${txhash}`);
    console.log("Crank", await crank.loadData());
    crank = c;
  } catch (e) {
    console.log("Crank already created.");
    crank = new CrankAccount(client, SWITCHBOARD_ADDRESS, SWITCHBOARD_ADDRESS);
  }

  console.log("\n\n\n\n\n");

  console.log("Oracle", await oracle.loadData());
  console.log("Crank", await crank.loadData());
  console.log("OracleQueue", await queue.loadData());
})();
