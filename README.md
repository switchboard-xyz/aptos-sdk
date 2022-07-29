# aptos-sdk

API wrapper for intergating with the Switchboardv2 program on Aptos

## Install

```
npm install
npm link
```

## Create an Aptos Account

```
sbv2-aptos create-account aptos-keypair.json
sbv2-aptos airdrop aptos-keypair.json --numAirdrops 4
```

## Create an Oracle Queue

```
sbv2-aptos create-queue aptos-keypair.json
```

## Create an Oracle

```
sbv2-aptos create-oracle [QUEUE_HEX_STRING] aptos-keypair.json
```
