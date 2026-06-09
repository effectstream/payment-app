# payment-app

An Effectstream template for buying in-game items with fiat. The app logic is **chain-agnostic** — Effectstream reads on-chain events from any supported chain and folds them into one deterministic state machine, so the same template can target Cardano, Midnight, Bitcoin, Avail, Celestia, NEAR, or an EVM chain. This build ships a deployment that connects Transak fiat→crypto purchase flow.

This is a migration of the [Paima payments game template](https://github.com/PaimaStudios/paima-game-templates/pull/87) onto the [Effectstream template specification](https://github.com/effectstream/effectstream/blob/v-next-bun-start/templates/effectstream-template-guidelines.md).

---

## Multi-chain by design

This template is **not chain-locked.** It's built on [Effectstream](https://effectstream.github.io/docs/), a multi-chain engine, and the app's own logic carries zero chain-specific code.

**How Effectstream makes that work.** An Effectstream app reads on-chain events ("inputs") from one or more chains and folds them into a single deterministic state machine. You write three small files — a *grammar* (the inputs your app accepts), a *state machine* (what each input does to your database), and an *API* — and none of them know or care which chain an input arrived on. The engine handles the chain-specific parts behind a uniform interface:

- **Sync (read).** A per-chain sync protocol indexes events and normalizes them into typed inputs. Effectstream ships built-in grammars for each chain — `cardanoTransfer` / `cardanoMintBurn` / `utxorpcGeneric` for Cardano, `midnightGeneric` for Midnight, `bitcoinAddress` for Bitcoin, `availGeneric` and `celestiaGeneric` for the data-availability chains, the `nearNep*` family for NEAR, and `evmErc20` / `evmErc721` for EVM.
- **Batching (write).** A per-chain adapter packs user-signed inputs into batched on-chain submissions — a browser-side submit path for Cardano, `MidnightAdapter` for Midnight, `BitcoinAdapter`, `NearAdapter`, and `EffectstreamL2DefaultAdapter` for EVM.
- **Config.** A `ConfigBuilder` declares the networks, sync protocols, and primitives an app listens to. Switching the target chain is a config + contract-package change, not an app-logic change.

**What that means for this template.** The `purchaseItem` grammar, the upsert state transition, the `user_items` table, and `/api/items` are all chain-neutral. The chain-specific surface is deliberately narrow: the contract package, the chain entry in the config, the batcher adapter, and the fiat rail. To retarget this template at **Cardano** (or Midnight, Bitcoin, NEAR…), you swap the contract package for the matching `contracts-{chain}` package, point the config at that chain's network + grammar, and choose the corresponding batcher adapter — the three node files stay untouched. See the multi-chain examples in the [Effectstream repo](https://github.com/effectstream/effectstream/tree/v-next/templates) (e.g. the `preorder` template, a Cardano + EVM dApp).

> The concrete run instructions below use an EVM chain (Hardhat / Sepolia / Arbitrum Sepolia) and Transak, because that's the path this build wires up end-to-end today. Transak settles fiat onto EVM chains; a Cardano or other-chain build pairs the same app logic with a chain-appropriate payment rail.

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| [Bun](https://bun.sh) | ≥ 1.1 | Everything (runtime + package manager) |
| [Foundry](https://book.getfoundry.sh/getting-started/installation) | latest | `forge build` (Solidity artifacts) |
| Node.js | ≥ 20 | Some Hardhat postinstall scripts |
| Docker | (optional) | Containerized runs |
| Browser wallet (MetaMask, Rabby…) | — | Dev mode purchases |

Install Bun + Foundry on macOS/Linux:

```sh
curl -fsSL https://bun.sh/install | bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

---

## Install

Clone (or `cd` to where this repo lives) and install deps from the workspace root:

```sh
git clone <repo-url> payment-app
cd payment-app
bun install
```

Then run the two one-time build steps in order:

```sh
bun run build:evm        # 1. compile PaymentEffectstreamL2.sol + generate packages/contracts-evm/mod.ts
bun run build:pgtypes    # 2. regenerate packages/database/sql/queries.queries.ts from queries.sql
```

> **Note on `build:pgtypes`** — a hand-written stub is committed so type-checks pass before the first run, but it is the authoritative version you should regenerate whenever the SQL changes. Port 5432 must be free.

---

## Run — Dev mode (local Hardhat, direct wallet)

Dev mode boots the entire stack locally: a Hardhat node on `:8545`, PGLite on `:5432`, the sync engine on `:9999`, a batcher on `:3334`, and the frontend on `:10599`. Transak is **not** used in dev — the wallet signs and submits directly.

```sh
bun run dev
```

Wait until the orchestrator log shows `frontend-server` is healthy. Then:

1. Open **http://localhost:10599**
2. Configure your browser wallet for the local Hardhat chain:
   - Network name: `Hardhat`
   - RPC URL: `http://localhost:8545`
   - Chain ID: `31337`
   - Currency: `ETH`
3. Import a Hardhat dev account (private key prefilled with funds):
   - `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` (account #0)
4. Click **Connect Wallet**, pick a weapon, click **Buy** — the wallet pops up to sign.
5. Inventory polls update within ~30 seconds (the "Owned: N" badge appears on the card).

To stop everything, hit `Ctrl+C` in the orchestrator terminal — it cascades shutdown to all child processes.

### Run only one process (advanced)

The orchestrator runs everything in one shell. If you want to develop the frontend in isolation with hot reload:

```sh
# Terminal 1: leave the orchestrator running for chain + sync + batcher
bun run dev

# Terminal 2: Vite dev server with HMR
bun run --filter @payment-app/frontend dev
# → http://localhost:10598
```

### Verify

```sh
bun run test
```

Runs three phases: chain reachability + contract deploy (A), `purchaseItem` STM transition + `/api/items` (B), and frontend build smoke (C). For the optional Playwright render test:

```sh
RUN_RENDER_TEST=true bun run test
```

---

## Run — Staging mode (Ethereum Sepolia, Transak STAGING)

Staging mode is a fully-runnable testnet deployment that uses Transak's STAGING environment — **no KYB required, no real money moves**. Useful for end-to-end testing of the fiat-onramp flow with test cards. It runs against Ethereum Sepolia (chain id `11155111`).

### One-time setup

#### 1. Generate a deployer wallet and fund it

```sh
# Generate a fresh keypair (prints both private key and address)
bun run packages/contracts-evm/deploy.sepolia.ts --new-wallet
```

Copy the private key into `.env.staging` (at the repo root — create from `.env.staging.example` if it doesn't exist):

```sh
cp .env.staging.example .env.staging
# Set BATCHER_EVM_SECRET_KEY=0x... in .env.staging
```

Print the wallet address and fund it via a Sepolia faucet (e.g. [alchemy.com/faucets/ethereum-sepolia](https://www.alchemy.com/faucets/ethereum-sepolia)):

```sh
bun run packages/contracts-evm/deploy.sepolia.ts --wallet
```

#### 2. Deploy the contract

```sh
cd packages/contracts-evm && bun run build      # compile the artifact
cd ../.. && bun run packages/contracts-evm/deploy.sepolia.ts
```

The script prints the deployed address, deploy block, and an Etherscan link. Copy:
- The contract address into `EFFECTSTREAM_L2_ADDRESS` in `.env.staging` (root) and `VITE_EFFECTSTREAM_L2_ADDRESS` in `packages/frontend/.env.staging`
- (Optional) the deploy block into `EVM_START_BLOCK` if you want to backfill — otherwise the sync node auto-starts from the current Sepolia tip on a fresh DB

#### 3. Bootstrap a local Postgres

```sh
./init_db.sh                  # installs postgresql@16 via Homebrew (idempotent)
```

This creates a `payment_app_staging` database with a `postgres` superuser matching the defaults in `.env.staging.example`. On first run it also builds and installs the [`pg_ivm`](https://github.com/sraoss/pg_ivm) extension from source (required by the `@effectstream/db` system migration); this needs Xcode Command Line Tools (`xcode-select --install`).

#### 4. Register the contract with Transak (and get an API key)

1. Sign up at [dashboard.transak.com](https://dashboard.transak.com) — staging API key is granted on signup (no KYB)
2. **Products → NFT Checkout → Add Contract**: paste the deployed Sepolia address, upload [PaymentEffectstreamL2.abi.json](PaymentEffectstreamL2.abi.json), set network to Ethereum Sepolia. Auto-approved in ~1 minute on staging.
3. Capture the staging **API key** and the **contractId**
4. Set in `packages/frontend/.env.staging`:
   ```sh
   VITE_TRANSAK_API_KEY=<staging API key>
   # VITE_TRANSAK_CONTRACT_ID=<contractId>   # only when purchase.ts is updated to NFT-checkout shape
   ```

### Run it

```sh
bun run dev:staging
# Boots sync + batcher + Vite dev server (HMR) via the orchestrator.
# → http://localhost:10598
```

This mirrors `bun run dev` but targets Ethereum Sepolia and the Transak STAGING widget. Postgres must already be running (`./init_db.sh` once is enough — `brew services` keeps it alive across reboots).

### Test purchase

1. Connect a wallet on Ethereum Sepolia (chain id `11155111`)
2. Click **Buy** on any item — the Transak widget opens
3. Use a staging test card:
   - Card number `4242 4242 4242 4242` (most fiat currencies)
   - Expiration `10/33`, CVV `123`
   - 3D Secure password `Checkout1!`
4. After the on-chain transaction confirms, the inventory poll should reflect it within ~1 minute

**Note**: per Transak's staging docs, no real ETH is sent to your contract on staging — the on-chain tx fires (so the sync node will index it) but the contract's balance won't change. Full end-to-end with real funds requires production keys + KYB.

---

## Run — Mainnet mode (Arbitrum Sepolia, Transak fiat)

Mainnet mode assumes the chain, database, and frontend are deployed and hosted externally. You only run two processes on your server: the sync node and the batcher.

### One-time setup

#### 1. Deploy the contract to Arbitrum Sepolia

Edit the deploy parameters in [`packages/contracts-evm/deploy.ts`](packages/contracts-evm/deploy.ts) to point at your owner address, then deploy:

```sh
cd packages/contracts-evm

# Add an arbitrumSepolia network in hardhat.config.ts (or use a separate config),
# then run Ignition manually. Example:
bun ./node_modules/.bin/hardhat ignition deploy \
  ./ignition/modules/effectstreamL2.ts \
  --network arbitrumSepolia \
  --parameters ./ignition/parameters.json
```

Capture the deployed address — you'll need it as `EFFECTSTREAM_L2_ADDRESS`.

#### 2. Provision a Postgres database

Anywhere — managed service (Neon, Supabase, RDS) or self-hosted. The sync node applies its own migrations on startup; no manual schema setup needed. Capture the connection string as `DATABASE_URL`.

#### 3. Obtain a Transak API key

Sign up at [transak.com](https://transak.com), create an app, and capture the **API key** (staging or production). You also need to whitelist the contract address in the Transak dashboard so they will route calldata to it.

### Environment variables

Create a `.env` file at the repo root (or export them in your shell / process manager):

```sh
# Sync node + batcher
EVM_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc      # or your private RPC
EFFECTSTREAM_L2_ADDRESS=0xYourDeployedContract...
BATCHER_EVM_SECRET_KEY=0xYourBatcherPrivateKey...      # funded with gas on Arbitrum Sepolia
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Optional tuning
EVM_START_BLOCK=12345678                                # block at/around contract deploy
EVM_POLL_MS=2000
EVM_CONFIRMATION_DEPTH=5
BATCHER_INTERVAL_MS=2000
BATCHER_FEE=0
```

For the frontend build, in `packages/frontend/.env.mainnet`:

```sh
VITE_EFFECTSTREAM_NODE_URL=https://api.your-domain.example
VITE_BATCHER_URL=https://batcher.your-domain.example
VITE_CHAIN_ID=421614
VITE_EFFECTSTREAM_L2_ADDRESS=0xYourDeployedContract...
VITE_TRANSAK_API_KEY=your_transak_api_key            # presence triggers the Transak path
```

### Build the frontend for mainnet

```sh
bun run --filter @payment-app/frontend build:mainnet
# output: packages/frontend/client/dist/
```

Deploy `packages/frontend/client/dist/` to any static host (Vercel, Netlify, Cloudfront, plain Nginx). Make sure `<script src="https://global.transak.com/sdk/v1.2/widget.js">` is loaded — add it to `client/index.html` before deploying if you haven't already.

### Start the sync node + batcher

On your server (or in CI, a VM, ECS task, etc.):

```sh
bun install                         # if not already installed on the host
bun run build:pgtypes               # one-time
bunx orchestrator start --config start.mainnet.ts
```

The orchestrator launches only [`main.mainnet.ts`](packages/node/main.mainnet.ts) and [`batcher.mainnet.ts`](packages/batcher/batcher.mainnet.ts) — both validate the env vars listed above and will fail-fast with a clear message if any are missing.

Alternative: run the node directly without the orchestrator (useful for managed runtimes that handle process supervision themselves):

```sh
bun run start:mainnet               # sync node only — start the batcher separately
bun run packages/batcher/batcher.mainnet.ts
```

### Verify mainnet flow

1. Hit `https://api.your-domain.example/api/health` → expects `{"ok":true}`.
2. From the deployed frontend, connect a wallet on Arbitrum Sepolia.
3. Click **Buy** on an item — the Transak widget should appear with the contract address and calldata pre-filled.
4. Complete a sandbox payment (Transak staging mode supports test card numbers).
5. After the on-chain transaction confirms, the inventory poll should show the item within ~1 minute.

---

## Run — Docker

For a self-contained image that boots the full dev stack:

```sh
# Apple Silicon
export DOCKER_DEFAULT_PLATFORM=linux/amd64

docker build -f ./Dockerfile . -t payment-app

# Dev stack inside the container
docker run --rm \
  -p 4747:4747 -p 9999:9999 -p 10599:10599 -p 3334:3334 -p 8545:8545 -p 5432:5432 \
  payment-app

# Run tests inside the container
docker run --rm payment-app bun run test
```

---

## Environments at a glance

| | Dev | Staging | Mainnet |
|---|-----|---------|---------|
| Chain | Hardhat (`31337`) | Ethereum Sepolia (`11155111`) | Arbitrum Sepolia (`421614`) |
| Database | PGLite (in-process) | Local Postgres via `./init_db.sh` | Managed Postgres |
| Sync entry | [main.dev.ts](packages/node/main.dev.ts) | [main.staging.ts](packages/node/main.staging.ts) | [main.mainnet.ts](packages/node/main.mainnet.ts) |
| Batcher entry | [batcher.dev.ts](packages/batcher/batcher.dev.ts) | [batcher.staging.ts](packages/batcher/batcher.staging.ts) | [batcher.mainnet.ts](packages/batcher/batcher.mainnet.ts) |
| Frontend purchase | Direct wallet | Transak STAGING widget | Transak STAGING/PRODUCTION widget |
| Frontend env file | `packages/frontend/.env.dev` | `packages/frontend/.env.staging` | `packages/frontend/.env.mainnet` |
| Start command | `bun run dev` | `bun run dev:staging` | `bunx orchestrator start --config start.mainnet.ts` |

---

## Frontend env files

The Vite client loads a different env file per mode. **All `VITE_*` vars are baked into the bundle at build time and shipped to the browser** — never put a private key in these files.

| Var | Dev (`.env.dev`) | Staging (`.env.staging`) | Mainnet (`.env.mainnet`) |
|-----|------------------|---------------------------|---------------------------|
| `VITE_EFFECTSTREAM_NODE_URL` | `http://localhost:9999` | your staging API host | your production API host |
| `VITE_BATCHER_URL` | `http://localhost:3334` | your staging batcher host | your production batcher host |
| `VITE_CHAIN_ID` | `31337` | `11155111` | `421614` |
| `VITE_EFFECTSTREAM_L2_ADDRESS` | (unset — defaults to Hardhat slot) | Sepolia deploy address | Arb-Sepolia deploy address |
| `VITE_TRANSAK_API_KEY` | (unset — uses direct wallet) | staging key from Transak dashboard | staging or production key |
| `VITE_TRANSAK_ENVIRONMENT` | n/a | `STAGING` | `STAGING` or `PRODUCTION` |
| `VITE_TRANSAK_NETWORK` | n/a | `sepolia` or `ethereum` | `arbitrumsepolia` or `arbitrum` |

How the frontend uses them:
- If `VITE_TRANSAK_API_KEY` is **unset**, [purchase.ts](packages/frontend/client/src/purchase.ts) falls back to direct wallet signing via the connected wallet. This is the dev-mode path.
- If `VITE_TRANSAK_API_KEY` is **set**, it opens the Transak widget with `environment` and `network` from the corresponding env vars (defaults: `STAGING` + `arbitrumsepolia` if you don't override them).
- `VITE_TRANSAK_NETWORK` must match the network you registered the contract under in the Transak dashboard — if the dashboard shows the contract as "Ethereum", use `ethereum`; if "Sepolia", use `sepolia`.

Build / dev commands per mode:

```sh
bun run dev              # dev mode (loads .env.dev, port 10598)
bun run dev:staging      # staging mode (loads .env.staging, port 10598)
bun run build:dev        # dev build → packages/frontend/client/dist/
bun run build:staging    # staging build
bun run build:mainnet    # mainnet build
```

(Run these from `packages/frontend/` or prefix with `bun run --filter @payment-app/frontend <script>`.)

---

## Project Structure

```
payment-app/
├── package.json                  # workspaces ["packages/*"], effectstream.default = "start.dev.ts"
├── start.dev.ts                  # Orchestrator: PGLite + Hardhat + sync + batcher + frontend
├── start.staging.ts              # Orchestrator: sync + batcher only (Ethereum Sepolia)
├── start.mainnet.ts              # Orchestrator: sync + batcher only (Arbitrum Sepolia)
├── init_db.sh                    # Homebrew Postgres bootstrap for staging
├── .env.staging.example          # Template for backend/deploy secrets (root)
├── Dockerfile                    # oven/bun:1 + Foundry + solc 0.8.30 + workspace symlinks
├── packages/
│   ├── node/                     # @payment-app/node — sync node
│   ├── database/                 # @payment-app/database — migrations + pgtyped queries
│   ├── contracts-evm/            # @payment-app/contracts-evm — PaymentEffectstreamL2.sol
│   ├── batcher/                  # @payment-app/batcher — EffectstreamL2 adapter
│   ├── frontend/                 # @payment-app/frontend — Vite + React + Fastify
│   └── tests/                    # @payment-app/tests — Phase A/B/C
```

### Package descriptions

**`packages/node`** — the sync engine.

| File | Purpose |
|------|---------|
| `grammar.ts` | Defines the `purchaseItem` grammar key (Typebox schema) |
| `state-machine.ts` | Single STM transition: upsert into `user_items` |
| `api.ts` | `GET /api/items?wallet=<addr>` (returns inventory rows) |
| `config.{dev,staging,mainnet}.ts` | ConfigBuilder per environment. Staging auto-starts from chain tip on empty DB. |
| `main.{dev,staging,mainnet}.ts` | Entry points |

**`packages/database`** — schema and typed queries. `user_items(wallet, item_id, amount)` table; queries: `upsertUserItem`, `getItemsByWallet`, `getAllItems`. Regenerate with `bun run build:pgtypes`.

**`packages/contracts-evm`** — Solidity. `PaymentEffectstreamL2.sol` extends `EffectstreamL2Contract` (no additional logic — the base contract handles `effectstreamSubmitGameInput(bytes)` payable submissions).

**`packages/batcher`** — receives signed inputs from the frontend, batches them, submits to the L2 contract.

**`packages/frontend`** — Vite + React. The 18-weapon catalogue lives in [`client/src/items.ts`](packages/frontend/client/src/items.ts); SVG placeholders are generated at build time by [`client/scripts/gen-items.ts`](packages/frontend/client/scripts/gen-items.ts). [`purchase.ts`](packages/frontend/client/src/purchase.ts) branches on `VITE_TRANSAK_API_KEY`.

---

## Services

| Service | Port | Notes |
|---------|------|-------|
| Frontend | 10599 | Fastify static server (built from `client/dist`) |
| Vite dev server | 10598 | Only when running `bun run --filter @payment-app/frontend dev` |
| Sync API | 9999 | `/api/items`, `/api/health` |
| Orchestrator | 4747 | Process management + `/shutdown` |
| Batcher | 3334 | `/send-input` (frontend posts here when `preferBatchedMode=true`) |
| Hardhat node | 8545 | Dev only (local chain) |
| PGLite | 5432 | Dev only |

---

## Game Mechanics

### Grammar inputs

| Input | Fields | Effect |
|-------|--------|--------|
| `purchaseItem` | `itemId: int (1..18)`, `amount: int (1..1000)` | Adds `amount` to `user_items(wallet=signer, item_id)` (insert or increment) |

Wire format: `["purchaseItem", 3, 1]` — JSON array submitted as bytes to `effectstreamSubmitGameInput`.

### API endpoints

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/items?wallet=<addr>` | `{ wallet, items: [{ wallet, item_id, amount }] }` |
| GET | `/api/health` | `{ ok: true }` |

---

## Env var reference (staging + mainnet)

Backend vars are read at runtime by the sync node, batcher, and deploy script. They live in `.env.staging` (or your shell / process manager) at the **repo root** — not in `packages/frontend/.env.*`, which is for `VITE_*` only.

| Name | Required | Used by | Description |
|------|----------|---------|-------------|
| `EVM_RPC_URL` | yes | sync, batcher, deploy | Sepolia / Arbitrum-Sepolia RPC URL |
| `EFFECTSTREAM_L2_ADDRESS` | yes | sync, batcher | Deployed `PaymentEffectstreamL2` address |
| `BATCHER_EVM_SECRET_KEY` | yes | batcher, deploy | Hex private key (must hold gas on the target chain) |
| `DB_HOST` | yes | sync | Postgres host (default `localhost`) |
| `DB_PORT` | yes | sync | Postgres port (default `5432`) |
| `DB_USER` | yes | sync | Postgres user (default `postgres`) |
| `DB_PW` | yes | sync | Postgres password (default `postgres`) |
| `DB_NAME` | yes | sync | Postgres database (default `postgres`) |
| `EVM_START_BLOCK` | no | sync | Block to start indexing from. **If unset on staging with an empty DB, auto-starts from the Sepolia tip.** |
| `EVM_POLL_MS` | no | sync | RPC polling interval ms (default `2000`) |
| `EVM_CONFIRMATION_DEPTH` | no | sync | Blocks until finality (default `5`) |
| `BATCHER_INTERVAL_MS` | no | batcher | Batch flush interval ms (default `2000`) |
| `BATCHER_FEE` | no | batcher | Per-input fee in wei (default `0`) |
| `CONTRACT_OWNER` | no | deploy | Owner address on `PaymentEffectstreamL2`. Defaults to deployer. |
| `CONTRACT_FEE` | no | deploy | Constructor `fee` arg (wei). Default `0`. |
| `VITE_TRANSAK_API_KEY` | frontend | client | Transak SDK API key — presence enables the fiat path |
| `VITE_TRANSAK_ENVIRONMENT` | frontend | client | `STAGING` or `PRODUCTION` (default `STAGING`) |
| `VITE_TRANSAK_NETWORK` | frontend | client | Network token Transak registered the contract under (e.g. `sepolia`, `ethereum`, `arbitrumsepolia`) |
| `VITE_EFFECTSTREAM_L2_ADDRESS` | frontend | client | Same address as `EFFECTSTREAM_L2_ADDRESS` |
| `VITE_EFFECTSTREAM_NODE_URL` | frontend | client | Sync node URL (`/api/*`) |
| `VITE_BATCHER_URL` | frontend | client | Batcher URL |
| `VITE_CHAIN_ID` | frontend | client | Chain id matching the deploy (`11155111` staging, `421614` mainnet) |

---

## Troubleshooting

- **`bun install` fails with workspace resolution errors on Linux** — Bun on Linux doesn't auto-create workspace symlinks. Run the symlink loop from the [Dockerfile](Dockerfile) (the snippet starting with `bun -e "..."` after `bun install`).
- **`build:pgtypes` errors with `port 5432 already in use`** — the script starts its own PGLite. Kill stale processes: `lsof -ti :5432 | xargs kill -9`.
- **Hardhat node never starts in `bun run dev`** — make sure Foundry is on `$PATH`. Verify with `forge --version`.
- **Transak widget says "missing apiKey"** — `VITE_TRANSAK_API_KEY` is unset at build time. The frontend silently falls back to direct-wallet submission; you need to rebuild with the env var present.
- **`401 Invalid signature` from `/send-input`** — `EffectstreamConfig.appName` (frontend, `""`) must match `BatcherConfig.namespace` (batcher, `""`). Both empty strings is intentional and required.
