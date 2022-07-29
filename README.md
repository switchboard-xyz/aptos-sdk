# aptos-sdk

API wrapper for intergating with the Switchboardv2 program on Aptos

## Install

```
npm install
npm link
```

## Create an Aptos Account

Create a new aptos account and airdrop some funds to it.

```
sbv2-aptos create-account --keypair aptos-keypair.json
sbv2-aptos airdrop --keypair aptos-keypair.json --numAirdrops 4
```

## Create an Oracle Queue

Create a new oracle queue.

```
sbv2-aptos create-queue --keypair aptos-keypair.json
```

## Create an Oracle

Create a new oracle.

```
sbv2-aptos create-oracle [QUEUE_HEX_STRING] --keypair aptos-keypair.json
```

## Create an Aggregator

Create a new BTC/USD aggregator with 8 job accounts.

```
sbv2-aptos create-aggregator [QUEUE_HEX_STRING] --keypair aptos-keypair.json
```

## Open Round

Open a new round for the aggregator.

```
sbv2-aptos open-round [AGGREGATOR_HEX_STRING] --keypair aptos-keypair.json
```
