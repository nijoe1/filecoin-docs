---
description: >-
  This page lists various Filecoin Ethereum Virtual Machine (FEVM) explorers
  with verification tools, and provides a tutorial on how to verify a contract
  using hardhat.
---

Before deeping into the details on how to verify your contracts using Hardhat.

Make sure if you don't have your Hardhat project in place to check out the [FEVM-Hardhat-kit](/smart-contracts/developing-contracts/hardhat.md)

# Verify a contract from a hardhat project

### On Blockscout

Make sure that you include this into your hardhat config

```typescript
const config: HardhatUserConfig = {
  solidity: {
    ...
  },
  networks: {
    filecoin: {
      ...
    },
    calibration: {
      ...
    },
  },
  // configuration for harhdat-verify plugin with Blockscout API
  etherscan: {
    apiKey: {
      filecoin: "empty",
      calibration: "empty",
    },
    customChains: [
      {
        network: "filecoin",
        chainId: 314,
        urls: {
          apiURL: "https://filecoin.blockscout.com/api",
          browserURL: "https://filecoin.blockscout.com",
        },
      },
      {
        network: "calibration",
        chainId: 314159,
        urls: {
          apiURL: "https://filecoin-testnet.blockscout.com/api",
          browserURL: "https://filecoin-testnet.blockscout.com",
        },
      },
    ],
  }
};

export default config;
```

Then running for filecoin mainnet contracts verification

```
npx hardhat verify $CONTRACT_ADDRESS_TO_VERIFY $CONTRACT_CONSTRUCTOR_ARGS --network filecoin
```

Then running for filecoin testnet calibration contracts verification

```
npx hardhat verify $CONTRACT_ADDRESS_TO_VERIFY $CONTRACT_CONSTRUCTOR_ARGS --network calibration
```

This will request the verification on blockscout

In case you see that your contract is already verified but there is not a full match or the contract is not the same in the explorer try to use the `--force` flag in the above commands

### On Sourcify

Make sure that you include blockscout hardhat configuration and additionally

```typescript
const config: HardhatUserConfig = {
  ...
  // configuration for harhdat-verify plugin Configured to also verify on Sourcify
  sourcify: {
    enabled: true, // verifies both on Sourcify and on Blockscout
    // Optional: specify a different Sourcify server
    apiUrl: "https://sourcify.dev/server",
    // Optional: specify a different Sourcify repository
    browserUrl: "https://repo.sourcify.dev",
  },
};

export default config;
```

This will enable by default to also verify on sourcify while running the `npx hardhat verify` task

For more info check out the Sourcify [docs](https://docs.sourcify.dev/docs/how-to-verify/)

### On Filfox

`npm i -g @fil-b/filfox-verifier`

include into your hardhat config

First, import the plugin in your hardhat.config.js or hardhat.config.ts:

```
// hardhat.config.js
require("@fil-b/filfox-verifier/hardhat");

// or in hardhat.config.ts
import "@fil-b/filfox-verifier/hardhat";
```

Then run the verification task:

```
# Verify a deployed contract
npx hardhat verifyfilfox --address 0xYourContractAddress --network filecoin

# For Calibration testnet
npx hardhat verifyfilfox --address 0xYourContractAddress --network calibration
```

For more info check this package [docs](https://www.npmjs.com/package/@fil-b/filfox-verifier)

[Was this page helpful?](https://airtable.com/apppq4inOe4gmSSlk/pagoZHC2i1iqgphgl/form?prefill_Page+URL=https://docs.filecoin.io/smart-contracts/developing-contracts/verify-a-contract/programmatically/hardhat)
