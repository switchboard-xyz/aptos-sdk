# Aptos Switchboard SDK

[![GitHub](https://img.shields.io/badge/--181717?logo=github&logoColor=ffffff)](https://github.com/switchboard-xyz/aptos-sdk)&nbsp;
[![twitter](https://badgen.net/twitter/follow/switchboardxyz)](https://twitter.com/switchboardxyz)&nbsp;&nbsp;

A library of utility functions to interact with Switchboard Modules on Aptos

## Install

```
npm i sbv2-aptos@https://github.com/switchboard-xyz/aptos-sdk --save
```

## Creating Feeds

```ts
import { Buffer } from "buffer";
import { AptosClient, AptosAccount, FaucetClient, HexString } from "aptos";
import {
  Aggregator,
  Job,
  Lease,
  AptosEvent,
  EventCallback,
  Crank,
  OracleJob,
} from "sbv2-aptos";
const NODE_URL = "https://fullnode.devnet.aptoslabs.com";
const FAUCET_URL = "https://faucet.devnet.aptoslabs.com";

const SWITCHBOARD_DEVNET_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_QUEUE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_CRANK_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const SWITCHBOARD_STATE_ADDRESS =
  "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300";

const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);

// create new user
let user = new AptosAccount();
await faucetClient.fundAccount(user.address(), 5000);
console.log(`User account ${user.address().hex()} created + funded.`);

// create and fund accounts to assign an aggregator and job to
const aggregator_acct = new AptosAccount();
const job_acct = new AptosAccount();
await faucetClient.fundAccount(aggregator_acct.address(), 50000);
await faucetClient.fundAccount(job_acct.address(), 5000);

// initialize the aggregator
const [aggregator, aggregatorTxHash] = await Aggregator.init(
  client,
  aggregator_acct,
  {
    authority: user.address(),
    queueAddress: SWITCHBOARD_QUEUE_ADDRESS,
    batchSize: 1,
    minJobResults: 1,
    minOracleResults: 1,
    minUpdateDelaySeconds: 5, // update every 5 seconds
    startAfter: 0,
    varianceThreshold: 0,
    varianceThresholdScale: 0,
    forceReportPeriod: 0,
    expiration: 0,
    coinType: "0x1::aptos_coin::AptosCoin",
  },
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS
);

console.log(`Aggregator: ${aggregator.address}, tx: ${aggregatorTxHash}`);

// Make Job data for btc price
// https://docs.switchboard.xyz/api/tasks
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

// initialize job -- our data fetching definition
const [job, jobTxHash] = await Job.init(
  client,
  job_acct,
  {
    name: "BTC/USD",
    metadata: "binance",
    authority: user.address().hex(),
    data: serializedJob.toString("hex"),
  },
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS
);

console.log(`Job created ${job.address}, hash: ${jobTxHash}`);

// add btc usd to our aggregator
const addJobTxHash = await aggregator.addJob(user, {
  job: job.address,
});

console.log(`Aggregator add job tx: ${addJobTxHash}`);

const [lease, leaseTxHash] = await Lease.init(
  client,
  aggregator_acct,
  {
    queueAddress: SWITCHBOARD_QUEUE_ADDRESS,
    withdrawAuthority: user.address().hex(),
    initialAmount: 1000, // when this drains completely, the aggregator is booted from the crank
    coinType: "0x1::aptos_coin::AptosCoin",
  },
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS
);

console.log(lease, leaseTxHash);

// Enable automatic updates
const crank = new Crank(
  client,
<<<<<<< HEAD
  SWITCHBOARD_CRANK_ADDRESS,
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_STATE_ADDRESS
=======
  SWITCHBOARD_DEVNET_ADDRESS, // we've
  SWITCHBOARD_DEVNET_ADDRESS, // assigned many resources
  SWITCHBOARD_DEVNET_ADDRESS  // to the same account for simplicity
>>>>>>> 5798127afb1d383161a623c997a6359018528dac
);

// Pushing to the crank enables automatic updates
await crank.push(user, {
  aggregatorAddress: aggregator_acct.address().hex(),
});

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
    HexString.ensure(SWITCHBOARD_STATE_ADDRESS),
    `${SWITCHBOARD_DEVNET_ADDRESS}::Switchboard::State`,
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
import { Aggregator } from "sbv2-aptos";

const aggregatorAccount: Aggregator = new Aggregator(
  client,
  aggregator_address,
  SWITCHBOARD_DEVNET_ADDRESS,
  SWITCHBOARD_DEVNET_ADDRESS
);

console.log(await aggregatorAccount.loadData());
```

# Aptos

### Move.toml

```toml
[addresses]
Switchboard = "0x348ecb66a5d9edab8d175f647d5e99d6962803da7f5d3d2eb839387aeb118300"

[dependencies]
MoveStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/move-stdlib/", rev = "main" }
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework/", rev = "main" }
AptosStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-stdlib/", rev = "main" }
Switchboard = { git = "https://github.com/switchboard-xyz/switchboard-aptos-public.git", subdir = "switchboard/", rev = "main" }
```

### Reading Feeds

```move
use Switchboard::Aggregator;
use Switchbiard::Math::{Self, SwitchboardDecimal};

// store latest value
struct AggregatorInfo has copy, drop, store, key {
    aggregator_addr: address,
    latest_result: u128,
    latest_result_decimal: u8,
    latest_result_neg: bool,
}

// get latest value
public fun save_latest_value(aggregator_addr) {
    // get latest value
    let latest_value = Aggregator::latest_value(aggregator_addr);
    let (value, dec, neg) = Math::num_unpack(latest_value);
    move_to(account, AggregatorInfo {
        aggregator_addr: aggregator_addr,
        latest_result: value,
        latest_result_decimal: dec,
        latest_result_neg: neg,
    });
}

// some testing that uses aggregator test utility functions
#[test(account = @0x1)]
public entry fun test_aggregator(account: &signer) {

    // creates test aggregator with data
    Aggregator::new_test(account, 100, 0, false);

    // print out value
    std::debug::print(&Aggregator::latest_value(signer::address_of(account)));
}


```
