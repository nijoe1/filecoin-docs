---
description: >-
  This page lists various Filecoin Ethereum Virtual Machine (FEVM) explorers
  with verification tools, and provides a tutorial on how to verify a contract
  using foundry.
---

Before deeping into the details on how to verify your contracts using Foundry.

Make sure if you don't have your Foundry project in place to check out the [FEVM-Foundry-kit](/smart-contracts/developing-contracts/foundry.md)

# Verify a contract from a foundry project

### On Blockscout

```bash
forge verify-contract  --verifier blockscout --verifier-url 'https://filecoin-testnet.blockscout.com/api/' --force --skip-is-verified-check 0xYourContractAddress  src/MyContract.sol:MyContract
```

```bash
forge verify-contract  --verifier blockscout --verifier-url 'https://filecoin.blockscout.com/api/' --force --skip-is-verified-check 0xYourContractAddress  src/MyContract.sol:MyContract
```

### On Sourcify

For Filecoin Mainnet verification on sourcify

```bash
forge verify-contract 0xYourContractAddress \
  src/MyToken.sol:MyToken \
  --chain-id 314 \
  --verifier sourcify
  --verifier-url https://sourcify.dev/server/
```

For Filecoin Calibration Testnet verification on sourcify

```bash
forge verify-contract 0xYourContractAddress \
  src/MyToken.sol:MyToken \
  --chain-id 314159 \
  --verifier sourcify
  --verifier-url https://sourcify.dev/server/
```

For more info check out the Sourcify [docs](https://docs.sourcify.dev/docs/how-to-verify/)

### On Filfox

#### As a Global CLI Tool

`npm i -g @fil-b/filfox-verifier`

include into your hardhat config

#### Usage

```bash
filfox-verifier forge <address> <contract-path> --chain <chainId>
```

#### Example:

```bash
# Verify contract on Filecoin mainnet
filfox-verifier forge 0xYourContractAddress src/MyContract.sol:MyContract --chain 314
```

```bash
# Verify contract on Calibration testnet
filfox-verifier forge 0xYourContractAddress src/MyContract.sol:MyContract --chain 314159
```

For more info check this package [docs](https://www.npmjs.com/package/@fil-b/filfox-verifier)

[Was this page helpful?](https://airtable.com/apppq4inOe4gmSSlk/pagoZHC2i1iqgphgl/form?prefill_Page+URL=https://docs.filecoin.io/smart-contracts/developing-contracts/verify-a-contract/programmatically/foundry)
