import { AptosClient, AptosAccount, HexString } from "aptos";
import { Permission, SwitchboardPermission } from "../lib/cjs";
import * as YAML from "yaml";
import * as fs from "fs";

// const NODE_URL = "https://fullnode.mainnet.aptoslabs.com/v1";
// const NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
const NODE_URL = "http://0.0.0.0:8080/v1";

// TODO: MAKE THIS THE DEPLOYER ADDRESS
const SWITCHBOARD_ADDRESS = "";

// TODO: MAKE THIS THE AUTHORITY THAT WILL OWN THE ORACLE
const QUEUE_ADDRESS = "";

// TODO: SET THIS PROPERLY
const oracles = [];

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

  for (let oracle of oracles) {
    /*
      ORACLE CREATION
    */
    try {
      const oraclePermission = new Permission(client, SWITCHBOARD_ADDRESS);

      // enable heartbeat on oracle
      await oraclePermission.set(funder, {
        authority: funder.address().hex(),
        granter: QUEUE_ADDRESS,
        grantee: oracle,
        permission: SwitchboardPermission.PERMIT_ORACLE_HEARTBEAT,
        enable: true,
      });
    } catch (e) {
      console.log(e);
    }
  }
})();
