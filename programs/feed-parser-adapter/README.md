<div align="center">

![Switchboard Logo](https://github.com/switchboard-xyz/sbv2-core/raw/main/website/static/img/icons/switchboard/avatar.png)

# Aptos feed-parser

> An example contract reading the price of a Switchboard data feed on-chain.

</div>

## Build

```bash
aptos move compile --named-addresses switchboard_feed_parser=default
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
