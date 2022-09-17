import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  OracleQueueAccount,
  CrankAccount,
  generateResourceAccountAddress,
  createOracle,
} from "../src";
import YAML from "yaml";
import fs from "fs";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0xb27f7bbf7caf2368b08032d005e8beab151a885054cdca55c4cc644f0a308d2b";

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
      fs.readFileSync("../.aptos/config.yaml", "utf8")
    );
    user = new AptosAccount(
      HexString.ensure(parsedYaml.profiles.default.private_key).toUint8Array()
    );
  } catch (e) {
    console.log(e);
  }

  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} funded.`);

  // user will be authority
  await faucetClient.fundAccount(
    HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS),
    5000000000
  );

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
      },
      SWITCHBOARD_DEVNET_ADDRESS
    );
    console.log(`Queue: ${queue.address}, tx: ${queueTxSig}`);
    queue = q;
  } catch (e) {
    let address = generateResourceAccountAddress(
      HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS),
      Buffer.from("OracleQueue")
    );
    queue = new OracleQueueAccount(client, address, SWITCHBOARD_DEVNET_ADDRESS);
  }

  const [oracle, oracleTxHash] = await createOracle(
    client,
    user,
    {
      name: "Switchboard OracleAccount",
      authority: user.address(),
      metadata: "metadata",
      queue: queue.address,
      coinType: "0x1::aptos_coin::AptosCoin",
    },
    SWITCHBOARD_DEVNET_ADDRESS
  );

  console.log(`Oracle ${oracle.address} created. tx hash: ${oracleTxHash}`);

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
      SWITCHBOARD_DEVNET_ADDRESS
    );
    console.log(`Created crank at ${crank.address}, tx hash ${txhash}`);
    console.log("Crank", await crank.loadData());
    crank = c;
  } catch (e) {
    console.log("Crank already created.");
    crank = new CrankAccount(
      client,
      SWITCHBOARD_DEVNET_ADDRESS,
      SWITCHBOARD_DEVNET_ADDRESS
    );
  }

  console.log("Oracle", await oracle.loadData());
  console.log("Crank", await crank.loadData());
  console.log("OracleQueue", await queue.loadData());
})();
