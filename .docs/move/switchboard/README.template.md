<div align="center">

<!-- commonheader -->

<!-- commonheaderstop -->

# switchboard

> A Move module to interact with Switchboard on Aptos.

</div>

## Build

```bash
aptos move compile --named-addresses switchboard=default
```

## Install

Add the following to your `Move.toml`.

```toml
[addresses]
switchboard = "0x34e2eead0aefbc3d0af13c0522be94b002658f4bef8e0740a21086d22236ad77"

[dependencies]
MoveStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/move-stdlib/", rev = "devnet" }
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-framework/", rev = "devnet" }
AptosStdlib = { git = "https://github.com/aptos-labs/aptos-core.git", subdir = "aptos-move/framework/aptos-stdlib/", rev = "devnet" }
Switchboard = { git = "https://github.com/switchboard-xyz/sbv2-aptos.git", subdir = "move/switchboard/", rev = "main" }
```

## Usage

<!-- usage -->

<!-- usagestop -->
