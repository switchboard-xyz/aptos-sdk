# Aptos Switchboard SDK

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/switchboard-xyz/aptos-sdk)&nbsp;
[![twitter](https://badgen.net/twitter/follow/switchboardxyz)](https://twitter.com/switchboardxyz)&nbsp;&nbsp;

A library of utility functions to interact with Switchboard Modules on Aptos

### NOTE (Oct 11 / 2022)

Make sure that subdir is pointing to the correct subdirectory, `subdir = "move/switchboard/"`. You'll also have to run an `aptos move clean` to clear the cache from `~/.move` and pull the latest version if you're on `main`.

## Live Deployment:

We're currently on Aptos Testnet and Devnet at address `0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd`. For the simplest way to create and manage Switchboard feeds on Aptos, check out our [publisher](https://app.switchboard.xyz).

## Install

```
npm i --save @switchboard-xyz/aptos.js
```

## Creating Feeds

```ts
import { Buffer } from "buffer";
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  AptosEvent,
  EventCallback,
  OracleJob,
  createFeed,
} from "@switchboard-xyz/aptos.js";
import Big from "big.js";

const NODE_URL = "https://fullnode.devnet.aptoslabs.com/v1";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_ADDRESS =
  "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";

const SWITCHBOARD_QUEUE_ADDRESS =
  "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";

const SWITCHBOARD_CRANK_ADDRESS =
  "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd";

const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

// create new user
let user = new AptosAccount();

await faucetClient.fundAccount(user.address(), 50000);
console.log(`User account ${user.address().hex()} created + funded.`);

// Make Job data for btc price
const serializedJob = Buffer.from(
  OracleJob.encodeDelimited(
    OracleJob.create({
      tasks: [
        {
          httpTask: {
            url: "https://www.binance.us/api/v3/ticker/price?symbol=BTCUSD",
          },
        },
        {
          jsonParseTask: {
            path: "$.price",
          },
        },
      ],
    })
  ).finish()
);

const [aggregator, createFeedTx] = await createFeed(
  client,
  user,
  {
    authority: user.address(),
    queueAddress: SWITCHBOARD_QUEUE_ADDRESS, // account with OracleQueue resource
    crankAddress: SWITCHBOARD_CRANK_ADDRESS, // account with Crank resource
    batchSize: 1, // number of oracles to respond to each round
    minJobResults: 1, // minimum # of jobs that need to return a result
    minOracleResults: 1, // minumum # of oracles that need to respond for a result
    minUpdateDelaySeconds: 5, // minimum delay between rounds
    coinType: "0x1::aptos_coin::AptosCoin", // CoinType of the queue (now only AptosCoin)
    initialLoadAmount: 1000, // load of the lease
    jobs: [
      {
        name: "BTC/USD",
        metadata: "binance",
        authority: user.address().hex(),
        data: serializedJob.toString("base64"), // jobs need to be base64 encoded strings
        weight: 1,
      },
    ],
  },
  SWITCHBOARD_ADDRESS
);

console.log(
  `Created Aggregator and Lease resources at account address ${aggregator.address}. Tx hash ${createFeedTx}`
);

// Manually trigger an update
await aggregator.openRound(user);
```

### Listening to Updates

```ts
/**
 * Listen to Aggregator Updates Off-Chain
 */

// create event listener
const onAggregatorUpdate = (
  client: AptosClient,
  cb: EventCallback,
  pollIntervalMs: number = 1000
) => {
  const event = new AptosEvent(
    client,
    HexString.ensure(SWITCHBOARD_ADDRESS),
    `${SWITCHBOARD_ADDRESS}::switchboard::State`,
    "aggregator_update_events",
    pollIntervalMs
  );
  event.onTrigger(cb);
  return event;
};

// initialize event listener
const updatePoller = onAggregatorUpdate(client, async (e) => {
  if (aggregator.address == e.data.aggregator_address) {
    console.log(`NEW RESULT:`, e.data);
  }
});
```

### Reading Feeds

```ts
import { AggregatorAccount } from "@switchboard-xyz/aptos.js";

const aggregatorAccount: AggregatorAccount = new AggregatorAccount(
  client,
  aggregator_address,
  SWITCHBOARD_ADDRESS
);

console.log(await aggregatorAccount.loadData());
```

# Aptos

### Move.toml

```toml
[addresses]
switchboard = "0xc9b4bb0b1f7a343687c4f8bc6eea36dd2a3aa8d654e640050ab5b8635a6b9cbd"

[dependencies]
MoveStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/move-stdlib/", rev = "devnet" }
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework/", rev = "devnet" }
AptosStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-stdlib/", rev = "devnet" }
Switchboard = { git = "https://github.com/switchboard-xyz/sbv2-aptos.git", subdir = "move/switchboard/", rev = "main" }
```

### Reading Feeds

```move
use switchboard::aggregator;
use switchboard::math;

// store latest value
struct AggregatorInfo has copy, drop, store, key {
    aggregator_addr: address,
    latest_result: u128,
    latest_result_scaling_factor: u8,
    latest_result_neg: bool,
}

// get latest value
public fun save_latest_value(aggregator_addr: address) {
    // get latest value
    let latest_value = aggregator::latest_value(aggregator_addr);
    let (value, scaling_factor, neg) = math::unpack(latest_value);
    move_to(account, AggregatorInfo {
        aggregator_addr: aggregator_addr,
        latest_result: value,
        latest_result_scaling_factor: scaling_factor,
        latest_result_neg: neg,
    });
}

// some testing that uses aggregator test utility functions
#[test(account = @0x1)]
public entry fun test_aggregator(account: &signer) {

    // creates test aggregator with data
    aggregator::new_test(account, 100, 0, false);

    // print out value
    std::debug::print(&aggregator::latest_value(signer::address_of(account)));
}
```
