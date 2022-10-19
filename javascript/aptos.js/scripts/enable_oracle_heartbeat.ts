import { AptosClient, AptosAccount, HexString } from "aptos";
import { Permission, SwitchboardPermission } from "../lib/cjs";
import * as YAML from "yaml";
import * as fs from "fs";

// const NODE_URL = "https://fullnode.mainnet.aptoslabs.com/v1";
// const NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
const NODE_URL = "https://7023b384-9d18-4480-ba7a-bb629d724ae9:881b272ea3154b9dbb64b0bfe3878c9f@aptos-mainnet.nodereal.io";

// TODO: MAKE THIS THE DEPLOYER ADDRESS
const SWITCHBOARD_ADDRESS = "0x7d7e436f0b2aafde60774efb26ccc432cf881b677aca7faaf2a01879bd19fb8";

// TODO: MAKE THIS THE AUTHORITY THAT WILL OWN THE ORACLE
const QUEUE_ADDRESS = "0x11fbd91e4a718066891f37958f0b68d10e720f2edf8d57854fb20c299a119a8c";

// TODO: SET THIS PROPERLY

const oracles = [
  "0xd7d2baef5dc653c2c84715b3d4ac7463446387c7d21c41e306bf4ec201454abb",
  "0x935ae73d4176dc45ca5cf4daad8c8abe0295e5d332ba78de6312a1411374c347",
  "0xd5d5ad988fedce6b2465496e978a1e828f91b6a82a67158e595fecbfa1cd5479",
];

  /*
  CREATE 1 ORACLE AND WRITE OUT THE KEY
 */

  async () => {
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
  }
)();
