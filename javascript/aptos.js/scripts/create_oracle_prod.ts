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
  sendAptosTx,
} from "../lib/cjs";
import * as YAML from "yaml";
import * as fs from "fs";

// const NODE_URL = "https://fullnode.mainnet.aptoslabs.com/v1";
const NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
//const NODE_URL = "http://0.0.0.0:8080/v1";

// TODO: MAKE THIS THE DEPLOYER ADDRESS
const SWITCHBOARD_ADDRESS =
  "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"; // (localnet)

// TODO: MAKE THIS THE AUTHORITY THAT WILL OWN THE ORACLE
const ORACLE_AUTHORITY =
  "0xe8f304576e94600b5d1b0966d8921f31b46041523bbf65f56d68a4a6fed9979f"; // "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"; // (localnet)
const PERMISSIONLESS_QUEUE_ADDRESS =
  "0x6e691165ebaaee3a7d862b94c9b88319cfa803a584c9e3bd538c3ae8380b9304"; // "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"; // (localnet)
const PERMISSIONED_QUEUE_ADDRESS = "";
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

  const ONE_APT = 100_000_000; // octas per APT

  const coinClient = new CoinClient(client);

  const transfer = async (
    client: AptosClient,
    from: AptosAccount,
    to: AptosAccount,
    amount: number
  ) => {
    const payload = {
      type: "entry_function_payload",
      function: "0x1::aptos_account::transfer",
      type_arguments: [],
      arguments: [to.address().hex(), amount],
    };
    await sendAptosTx(
      client,
      from,
      payload.function,
      payload.arguments,
      payload.type_arguments
    );
  };

  /*
    ORACLE CREATION
  */
  let oracle: any;
  try {
    // CREATE AUTHORITY OWNER AND FUND 1 APT
    const oracle_owner = new AptosAccount();
    fs.writeFileSync(
      `oracle-owner-keys-${oracle_owner.address().hex()}`,
      JSON.stringify(oracle_owner.toPrivateKeyObject())
    );

    // TODO: FUND MORE - since this is where gas payments will come from
    await transfer(client, funder, oracle_owner, ONE_APT);
    console.log(
      `Authority account ${oracle_owner.address().hex()} funded for oracle`
    );

    // NOTE: THIS WILL ONLY ADD THE HEARTBEAT PERMISSION QUEUE IF THE FUNDER IS THE QUEUE'S AUTHORITY
    const [o, oracleTxHash] = await createOracle(
      client,
      funder,
      {
        name: "Switchboard OracleAccount",
        authority: ORACLE_AUTHORITY,
        metadata: "",
        queue: PERMISSIONLESS_QUEUE_ADDRESS,
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
