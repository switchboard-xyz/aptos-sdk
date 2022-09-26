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

const NODE_URL = "https://fullnode.testnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.testnet.aptoslabs.com";

const SWITCHBOARD_TESTNET_ADDRESS =
  "0xb27f7bbf7caf2368b08032d005e8beab151a885054cdca55c4cc644f0a308d2b";

// run it all at once
(async () => {
  // INFRA ------
  const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
  setInterval(async () => {
    try {
      await faucetClient.fundAccount(SWITCHBOARD_TESTNET_ADDRESS, 500000000);
      console.log(`Account ${SWITCHBOARD_TESTNET_ADDRESS} funded.`);
    } catch (e) {
      console.log(e);
    }
  }, 5000);
})();
