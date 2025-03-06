<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png)

# Aptos feed-parser

> An example contract reading the price of a Switchboard On-Demand data feed on-chain with the V2 Interface.

</div>

## Migrating to On-Demand

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
The aggregator addresses you use will have to be updated to new On-Demand Aggregators that can be created from your V2 Aggregators on the Switchboard On-Demand App. 

## Build

```bash
aptos move compile --move-2 --named-addresses switchboard_feed_parser=default
```

## Install

Add the following to your `Move.toml`.

```toml
[addresses]
switchboard = "0xb91d3fef0eeb4e685dc85e739c7d3e2968784945be4424e92e2f86e2418bf271"

[dependencies]
MoveStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/move-stdlib/", rev = "testnet" }
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework/", rev = "testnet" }
AptosStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-stdlib/", rev = "testnet" }
Switchboard = { git = "https://github.com/switchboard-xyz/sbv2-aptos.git", subdir = "move/switchboard/testnet/", rev = "main" }  # change to /mainnet/ if on mainnet - or fork and change deps for a specific commit hash (along with aptos deps)
```

## Usage

N/A
