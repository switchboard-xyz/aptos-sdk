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

| **Lang** | **Name**                            | **Description**                   |
| -------- | ----------------------------------- | --------------------------------- |
| Move     | [feed-parser](programs/feed-parser) | Read a Switchboard feed on Aptos" |

## Troubleshooting

1. File a
   [GitHub Issue](https://github.com/switchboard-xyz/sbv2-solana/issues/new)
2. Ask a question in
   [Discord #dev-support](https://discord.com/channels/841525135311634443/984343400377647144)
