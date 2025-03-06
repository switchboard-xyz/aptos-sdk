<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png)

# Switchboard x Aptos

> A collection of libraries and examples for interacting with Switchboard on
> Aptos.

[![NPM Badge](https://img.shields.io/github/package-json/v/switchboard-xyz/sbv2-aptos?color=red&filename=javascript%2Faptos.js%2Fpackage.json&label=%40switchboard-xyz%2Faptos.js&logo=npm)](https://www.npmjs.com/package/@switchboard-xyz/aptos.js)

</div>

## Getting Started

To get started, clone the
[sbv2-aptos](https://github.com/switchboard-xyz/sbv2-aptos) repository.

```bash
git clone https://github.com/switchboard-xyz/sbv2-aptos
```

Then install the dependencies

```bash
cd sbv2-aptos
pnpm install
```

## Addresses

The following addresses can be used with the Switchboard deployment on Aptos

### Mainnet

| Account              | Address                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Program ID           | `0x7d7e436f0b2aafde60774efb26ccc432cf881b677aca7faaf2a01879bd19fb8`  |
| Program Authority    | `0xca62eccbbdb22b5de18165d0bdf2d7127569b91498f0a7f6944028793cef8137` |
| StateAddress         | `0x7d7e436f0b2aafde60774efb26ccc432cf881b677aca7faaf2a01879bd19fb8`  |
| Permissioned Queue   | `0x11fbd91e4a718066891f37958f0b68d10e720f2edf8d57854fb20c299a119a8c` |
| Permissionless Queue | `0xc887072e37f17f9cc7afc0a00e2b283775d703c610acca3997cb26e74bc53f3b` |
| On-Demand Adapter    | `0x890fd4ed8a26198011e7923f53f5f1e5eeb2cc389dd50b938f16cb95164dc81c` |

### Testnet

| Account              | Address                                                              |
| -------------------- | -------------------------------------------------------------------- |
| Program ID           | `0xb91d3fef0eeb4e685dc85e739c7d3e2968784945be4424e92e2f86e2418bf271` |
| Program Authority    | `0xb91d3fef0eeb4e685dc85e739c7d3e2968784945be4424e92e2f86e2418bf271` |
| StateAddress         | `0xb91d3fef0eeb4e685dc85e739c7d3e2968784945be4424e92e2f86e2418bf271` |
| Permissionless Queue | `0x9190d0fad0520ef650caa1ef8bd89da660d6eb617feabd618039b9c6bf11e802` |

## Clients

| **Lang**   | **Name**                                         | **Description**                                             |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------- |
| Move       | [switchboard](move/switchboard/mainnet/)         | A Move module to interact with Switchboard on Aptos.        |
| Move       | [switchboard](move/switchboard/testnet/)         | A Move module to interact with Switchboard on Aptos testnet |
| Javascript | [@switchboard-xyz/aptos.js](javascript/aptos.js) | A Typescript client to interact with Switchboard on Aptos.  |

## Example Programs

| **Lang** | **Name**                                            | **Description**                              |
| -------- | --------------------------------------------------- | -------------------------------------------- |
| Move     | [feed-parser](programs/feed-parser)                 | Read a Switchboard feed on Aptos             |
| Move     | [feed-parser-adapter](programs/feed-parser-adapter) | Read an On-Demand Feed with the v2 interface |

## Migrating existing code to On-Demand from V2 without updating logic

In order to migrate feeds to On-Demand from V2 without updating the logic, you can use the On-Demand Adapter. This adapter will allow you to use the same logic as V2, but with the new On-Demand Aggregators. You can create On-Demand aggregators on the [Switchboard On-Demand App](https://ondemand.switchboard.xyz/aptos/mainnet).

### 1. Update Move.toml

You'll need to update your `Move.toml` to include the new `switchboard_adapter` module and address. Replace the `switchboard` named address with the new `switchboard_adapter` address.

```diff
[addresses]

# remove the switchboard address
- switchboard = "0xb91d3fef0eeb4e685dc85e739c7d3e2968784945be4424e92e2f86e2418bf271"

# add the switchboard_adapter address
+ switchboard_adapter = "0x890fd4ed8a26198011e7923f53f5f1e5eeb2cc389dd50b938f16cb95164dc81c"

[dependencies]

# remove the switchboard v2 dependency
- [dependencies.Switchboard]
- git = "https://github.com/switchboard-xyz/sbv2-aptos.git"
- subdir = "move/switchboard/testnet/" # change to /mainnet/ if on mainnet - or fork and change deps for a specific commit hash
- rev = "main"

# add the on-demand adapter dependency
+ [dependencies.SwitchboardAdapter]
+ git = "https://github.com/switchboard-xyz/aptos.git"
+ subdir = "adapter/mainnet"
+ rev = "main"
```

### 2. Update your Move Modules

You'll need to update named address `switchboard` to `switchboard_adapter` in dependencies.

```diff
module example::module {
-    use switchboard::aggregator;
-    use switchboard::math;
+    use switchboard_adapter::aggregator;
+    use switchboard_adapter::math;
    ...
}
```

The aggregator addresses you use will have to be updated to new On-Demand Aggregators that can be created from your V2 Aggregators on the Switchboard On-Demand App. Update references in your application to on-demand aggregators accordingly.

### 3. Cranking

On-demand works on a pull-based mechanism, so you will have to crank feeds with your client-side code in order to get the latest data. This can be done using the Typescript SDK.

```typescript
import {
  Aggregator,
  SwitchboardClient,
  waitForTx,
} from "@switchboard-xyz/aptos-sdk";
import { Account, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// get the aptos client
const config = new AptosConfig({
  network: Network.MAINNET, // network a necessary param / if not passed in, full node url is required
});
const aptos = new Aptos(config);

// create a SwitchboardClient using the aptos client
const client = new SwitchboardClient(aptos);

const aggregator = new Aggregator(sb, aggregatorId);

// update the aggregator every 10 seconds
setInterval(async () => {
  try {
    // fetch the latest update and tx to update the aggregator
    const { updateTx } = await aggregator.fetchUpdate({
      sender: signerAddress,
    });

    // send the tx to update the aggregator
    const tx = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: updateTx,
    });
    const resultTx = await waitForTx(aptos, tx.hash);
    console.log(`Aggregator ${aggregatorId} updated!`);
  } catch (e) {
    console.error(`Error updating aggregator ${aggregatorId}: ${e}`);
  }
}, 10000);
```

## Troubleshooting

1. File a
   [GitHub Issue](https://github.com/switchboard-xyz/sbv2-solana/issues/new)
2. Ask a question in
   [Discord #dev-support](https://discord.com/channels/841525135311634443/984343400377647144)
