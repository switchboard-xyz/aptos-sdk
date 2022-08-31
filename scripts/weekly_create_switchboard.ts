import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  OracleAccount,
  OracleQueueAccount,
  Permission,
  CrankAccount,
  SwitchboardPermission,
} from "../src";
import YAML from "yaml";
import fs from "fs";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x14611263909398572be034debb2e61b6751cafbeaddd994b9a1250cb76b99d38";

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
      "localuser" in parsedYaml.profiles &&
      "private_key" in parsedYaml.profiles.localuser
    ) {
      user = new AptosAccount(
        HexString.ensure(parsedYaml.profiles.localuser.private_key).toBuffer()
      );
    }
  } catch {}
  await faucetClient.fundAccount(user.address(), 5000);

  console.log(`User account ${user.address().hex()} funded.`);

  // user will be authority
  await faucetClient.fundAccount(user.address(), 500000);

  try {
    // create permission for oracle
    const [oraclePermission] = await Permission.init(
      client,
      user,
      {
        authority: user.address().hex(),
        granter: SWITCHBOARD_DEVNET_ADDRESS,
        grantee: SWITCHBOARD_DEVNET_ADDRESS,
      },
      SWITCHBOARD_DEVNET_ADDRESS
    );

    // enable heartbeat on oracle
    await oraclePermission.set(user, {
      authority: user.address().hex(),
      granter: SWITCHBOARD_DEVNET_ADDRESS,
      grantee: SWITCHBOARD_DEVNET_ADDRESS,
      permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
      enable: true,
    });

    console.log("Permissions created");
  } catch (e) {}

  const [queue, queueTxSig] = await OracleQueueAccount.init(
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

  console.log(`Queue: ${queue.address}, tx: ${queueTxSig}`);

  const [oracle, oracleTxSig] = await OracleAccount.init(
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

  // trigger the oracle heartbeat
  const heartbeatTxSig = await oracle.heartbeat(user);
  console.log("Heartbeat Tx Hash:", heartbeatTxSig);

  try {
    const [crank, txhash] = await CrankAccount.init(
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
  } catch (e) {
    console.log("Crank already created.");
  }

  console.log("OracleQueue", await queue.loadData());
})();
