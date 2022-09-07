import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  OracleAccount,
  OracleQueueAccount,
  Permission,
  CrankAccount,
  SwitchboardPermission,
  generateResourceAccountAddress,
} from "../src";
import YAML from "yaml";
import fs from "fs";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0xb27f7bbf7caf2368b08032d005e8beab151a885054cdca55c4cc644f0a308d2b";

const SWITCHBOARD_QUEUE_ADDRESS = generateResourceAccountAddress(
  HexString.ensure(SWITCHBOARD_DEVNET_ADDRESS),
  Buffer.from("OracleQueue")
);
console.log(SWITCHBOARD_QUEUE_ADDRESS);

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
    if (
      "profiles" in parsedYaml &&
      "newdeployer" in parsedYaml.profiles &&
      "private_key" in parsedYaml.profiles.newdeployer
    ) {
      user = new AptosAccount(
        HexString.ensure(parsedYaml.profiles.newdeployer.private_key).toBuffer()
      );
    }
  } catch {}
  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} funded.`);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 5000000000);

  let oraclePermission: any;
  try {
    // create permission for oracle
    const [o] = await Permission.init(
      client,
      user,
      {
        authority: SWITCHBOARD_DEVNET_ADDRESS,
        granter: SWITCHBOARD_QUEUE_ADDRESS,
        grantee: SWITCHBOARD_DEVNET_ADDRESS,
      },
      SWITCHBOARD_DEVNET_ADDRESS
    );
    oraclePermission = o;
    console.log("Permissions created");
  } catch (e) {}

  try {
    // enable heartbeat on oracle
    await oraclePermission.set(user, {
      authority: SWITCHBOARD_DEVNET_ADDRESS,
      granter: SWITCHBOARD_QUEUE_ADDRESS,
      grantee: SWITCHBOARD_DEVNET_ADDRESS,
      permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
      enable: true,
    });
    console.log("Permissions set");
  } catch (e) {}

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

  let oracle: any;
  try {
    const [o, oracleTxSig] = await OracleAccount.init(
      client,
      user,
      {
        address: user.address(),
        name: "Switchboard Oracle",
        metadata: "metadata",
        authority: user.address(),
        queue: queue.address,
        coinType: "0x1::aptos_coin::AptosCoin",
      },
      SWITCHBOARD_DEVNET_ADDRESS
    );

    console.log(`Oracle: ${oracle.address}, tx: ${oracleTxSig}`);
    oracle = o;
  } catch (e) {
    oracle = new OracleAccount(
      client,
      SWITCHBOARD_DEVNET_ADDRESS,
      SWITCHBOARD_DEVNET_ADDRESS
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
        address: SWITCHBOARD_DEVNET_ADDRESS,
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
