import {
  AptosClient,
  AptosAccount,
  FaucetClient,
  HexString,
  CoinClient,
} from "aptos";
import {
  OracleQueueAccount,
  CrankAccount,
  generateResourceAccountAddress,
  createOracle,
} from "../lib/cjs";
import * as YAML from "yaml";
import * as fs from "fs";

// const NODE_URL = "https://fullnode.mainnet.aptoslabs.com/v1";
// const NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
const NODE_URL = "http://0.0.0.0:8080/v1";

// TODO: MAKE THIS THE DEPLOYER ADDRESS
const SWITCHBOARD_ADDRESS =
  "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"; // (localnet)

// TODO: MAKE THIS THE AUTHORITY THAT WILL OWN THE QUEUES (authority of both permissioned and permissionless queues)
const QUEUE_AUTHORITY = ""; // "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"; // (localnet)

/*
  CREATE 1 ORACLE AND WRITE OUT THE KEY
 */

(async () => {
  const client = new AptosClient(NODE_URL);

  let funder;

  // if file extension ends with yaml
  try {
    const parsedYaml = YAML.parse(
      fs.readFileSync("../.aptos/config.yaml", "utf8")
    );
    funder = new AptosAccount(
      HexString.ensure(parsedYaml.profiles.default.private_key).toUint8Array()
    );
  } catch (e) {
    console.log(e);
  }

  if (!funder) {
    throw new Error("Could not get funder account.");
  }

  const ONE_APT = 10_000_000; // octas per APT

  const coinClient = new CoinClient(client);

  /*
    ORACLE CREATION
  */
  let oracle: any;
  try {
    // CREATE AUTHORITY OWNER AND FUND 1 APT
    const oracle_owner = new AptosAccount();
    fs.writeFileSync(
      `permissionless-queue-owner-keys-${oracle_owner.address().hex()}`,
      JSON.stringify(oracle_owner.toPrivateKeyObject())
    );

    // TODO: FUND MORE - since this is where gas payments will come from
    await coinClient.transfer(funder, oracle_owner, ONE_APT);
    console.log(
      `Authority account ${oracle_owner.address().hex()} funded for queue`
    );

    // NOTE: THIS WILL ONLY ADD THE HEARTBEAT PERMISSION QUEUE IF THE FUNDER IS THE QUEUE'S AUTHORITY
    const [o, oracleTxHash] = await createOracle(
      client,
      funder,
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
  }

  try {
    // trigger the oracle heartbeat
    const heartbeatTxSig = await oracle.heartbeat(funder);
    console.log("Heartbeat Tx Hash:", heartbeatTxSig);
  } catch (e) {
    console.log("could not heartbeat");
  }
})();
