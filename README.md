# trust-circles

## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Deploy Trust Circles (Foundry)

Deploy core contracts (`ReputationManager` + `TrustCircleFactory`):

```shell
export PRIVATE_KEY=0x...
forge script script/DeployCore.s.sol:DeployCore \
  --rpc-url $RPC_URL \
  --broadcast
```

Create a new circle from an existing Factory:

```shell
export PRIVATE_KEY=0x...
export FACTORY_ADDRESS=0x...
export CIRCLE_NAME="My Trust Circle"
export CIRCLE_IS_NATIVE=true
export CIRCLE_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
export CIRCLE_TRUST_LEVEL=0
export CIRCLE_MIN_CONTRIBUTION=10000000000000000

forge script script/DeployCircle.s.sol:DeployCircle \
  --rpc-url $RPC_URL \
  --broadcast
```

`CIRCLE_TRUST_LEVEL` values:
- `0` = High
- `1` = Medium
- `2` = Low

Deploy everything in one run (core + one initial circle):

```shell
export PRIVATE_KEY=0x...
export CIRCLE_NAME="Genesis Circle"
export CIRCLE_IS_NATIVE=true
export CIRCLE_TOKEN_ADDRESS=0x0000000000000000000000000000000000000000
export CIRCLE_TRUST_LEVEL=0
export CIRCLE_MIN_CONTRIBUTION=10000000000000000

forge script script/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --broadcast
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
