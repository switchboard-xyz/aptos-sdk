import { FaucetClient } from "aptos";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_ADDRESS =
  "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";

// run it all at once
(async () => {
  // INFRA ------
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
  setInterval(async () => {
    try {
      await faucetClient.fundAccount(SWITCHBOARD_ADDRESS, 500000000);
      console.log(`Account ${SWITCHBOARD_ADDRESS} funded.`);
    } catch (e) {
      console.log(e);
    }
  }, 5000);
})();
