/**
 * Creates a new account, inititalizes a Switchboard Resource Account on it
 *
 * Using that it should:
 *
 * DEMO --
 * Creates a new Aggregator
 * Creates a new Job (ftx btc/usd),
 * Adds Job to Aggregator
 * Push Aggregator to Crank
 */
import { Buffer } from "buffer";
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  LeaseAccount,
  AptosEvent,
  EventCallback,
  OracleJob,
  createFeed,
  AggregatorAccount,
} from "../src";
import Big from "big.js";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_ADDRESS =
  "0xb68fc782f172f8df315814d25a0d80712e7543c168e596edc72cc3b163677375";

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
