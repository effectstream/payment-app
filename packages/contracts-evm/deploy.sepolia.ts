/**
 * Deploy PaymentEffectstreamL2 to Ethereum Sepolia.
 *
 * Reads the deployer private key (and optional RPC URL / owner / fee) from
 * a `.env.staging` file at the repo root.
 *
 * Usage:
 *   bun run packages/contracts-evm/deploy.sepolia.ts
 *     -> Deploys the contract and prints the deployed address.
 *
 *   bun run packages/contracts-evm/deploy.sepolia.ts --wallet
 *     -> Just prints the public address of the deployer wallet,
 *        so you can fund it via a faucet before deploying.
 *
 *   bun run packages/contracts-evm/deploy.sepolia.ts --new-wallet
 *     -> Generates a brand new random wallet (private key + address)
 *        and prints both. Does not touch .env.staging.
 *        Copy the private key into BATCHER_EVM_SECRET_KEY in .env.staging.
 *
 * Required env vars in `.env.staging` (repo root):
 *   BATCHER_EVM_SECRET_KEY  0x-prefixed private key (also used by the batcher)
 * Optional:
 *   EVM_RPC_URL             Sepolia RPC; defaults to a public node
 *   CONTRACT_OWNER          Owner address on deploy; defaults to deployer
 *   CONTRACT_FEE            Batcher fee per tx (wei); defaults to 0
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createWalletClient,
  formatEther,
  http,
  publicActions,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

// --new-wallet: generate and print a fresh random keypair, then exit.
// Does not read .env.staging — useful for first-time setup.
if (process.argv.includes("--new-wallet")) {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  console.log(`Private key: ${pk}`);
  console.log(`Address:     ${account.address}`);
  console.log(
    `\nCopy the private key into BATCHER_EVM_SECRET_KEY in .env.staging,`,
  );
  console.log(`then fund the address via a Sepolia faucet.`);
  process.exit(0);
}

const __dirname = import.meta.dirname!;
const repoRoot = resolve(__dirname, "..", "..");
const envPath = resolve(repoRoot, ".env.staging");

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}.`);
  console.error("Create it from .env.staging.example at the repo root.");
  process.exit(1);
}

const env = parseEnvFile(envPath);
const pk = env.BATCHER_EVM_SECRET_KEY;
if (!pk || !pk.startsWith("0x") || pk.length !== 66) {
  console.error(
    "BATCHER_EVM_SECRET_KEY missing or malformed in .env.staging " +
      "(expected 0x-prefixed 64-char hex private key).",
  );
  process.exit(1);
}

const account = privateKeyToAccount(pk as `0x${string}`);

// --wallet: just print the deployer address and exit so you can fund it.
if (process.argv.includes("--wallet")) {
  console.log(account.address);
  process.exit(0);
}

const rpcUrl = env.EVM_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

const artifactPath = resolve(
  __dirname,
  "build",
  "artifacts",
  "hardhat",
  "src",
  "contracts",
  "PaymentEffectstreamL2.sol",
  "PaymentEffectstreamL2.json",
);
if (!existsSync(artifactPath)) {
  console.error(`Missing compiled artifact at ${artifactPath}.`);
  console.error(
    "Build the contracts first:  cd packages/contracts-evm && bun run build",
  );
  process.exit(1);
}
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const abi = artifact.abi;
const bytecode = (artifact.bytecode?.object ?? artifact.bytecode) as
  | `0x${string}`
  | undefined;
if (!bytecode || !bytecode.startsWith("0x")) {
  console.error("Could not read bytecode from artifact.");
  process.exit(1);
}

const wallet = createWalletClient({
  account,
  chain: sepolia,
  transport: http(rpcUrl),
}).extend(publicActions);

console.log(`Deployer: ${account.address}`);
console.log(`Network:  Ethereum Sepolia (chainId ${sepolia.id})`);
console.log(`RPC:      ${rpcUrl}`);

const balance = await wallet.getBalance({ address: account.address });
console.log(`Balance:  ${formatEther(balance)} ETH`);

if (balance === 0n) {
  console.error(
    "\nDeployer has 0 ETH on Sepolia. Fund it via a faucet first:",
  );
  console.error("  https://www.alchemy.com/faucets/ethereum-sepolia");
  console.error("  https://sepoliafaucet.com");
  process.exit(1);
}

const owner = (env.CONTRACT_OWNER as `0x${string}` | undefined) ??
  account.address;
const fee = BigInt(env.CONTRACT_FEE ?? "0");

console.log(`\nDeploying PaymentEffectstreamL2(owner=${owner}, fee=${fee})...`);

const hash = await wallet.deployContract({
  abi,
  bytecode,
  args: [owner, fee],
});
console.log(`Tx hash:  ${hash}`);
console.log("Waiting for receipt...");
const receipt = await wallet.waitForTransactionReceipt({ hash });

if (receipt.status !== "success" || !receipt.contractAddress) {
  console.error(`\nDeploy failed. Status: ${receipt.status}`);
  process.exit(1);
}

console.log(`\nDeployed at: ${receipt.contractAddress}`);
console.log(`Block:       ${receipt.blockNumber}`);
console.log(`Gas used:    ${receipt.gasUsed}`);
console.log(`Etherscan:   https://sepolia.etherscan.io/address/${receipt.contractAddress}`);

console.log(`\nNext steps:`);
console.log(
  `  1. Set VITE_EFFECTSTREAM_L2_ADDRESS=${receipt.contractAddress} in packages/frontend/.env.staging`,
);
console.log(
  `  2. Set EFFECTSTREAM_L2_ADDRESS=${receipt.contractAddress} in .env.staging (backend)`,
);
console.log(
  `  3. Set EVM_START_BLOCK=${receipt.blockNumber} in .env.staging so the sync node starts here`,
);
