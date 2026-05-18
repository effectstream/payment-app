export const EFFECTSTREAM_NODE_URL =
  import.meta.env.VITE_EFFECTSTREAM_NODE_URL ?? "http://localhost:9999";
export const BATCHER_URL =
  import.meta.env.VITE_BATCHER_URL ?? "http://localhost:3334";
export const CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID ?? "31337");
/**
 * Boolean flag: should the Buy button open the Transak widget instead of
 * signing directly via the connected wallet? All Transak config (apiKey,
 * apiSecret, contractId, network, environment) now lives on the backend —
 * see packages/node/api.ts. The browser only needs to know whether to call
 * the server endpoint.
 */
export const TRANSAK_ENABLED =
  String(import.meta.env.VITE_TRANSAK_ENABLED ?? "").toLowerCase() === "true";
/**
 * Staging-only demo flag. Transak's STAGING environment does not actually
 * settle on Sepolia, so the sync node never sees the resulting transaction.
 * When this flag is set, the frontend listens for Transak's success event
 * and fires a real Sepolia transaction from the connected wallet so the
 * demo can show the full Transak → on-chain → sync pipe end-to-end. Must
 * stay unset in production — there the real Transak settlement is on-chain
 * and any extra wallet tx would double-charge the user.
 */
export const TRANSAK_DEMO_FALLBACK =
  String(import.meta.env.VITE_TRANSAK_DEMO_FALLBACK ?? "").toLowerCase() ===
    "true";
export const EFFECTSTREAM_L2_ADDRESS =
  (import.meta.env.VITE_EFFECTSTREAM_L2_ADDRESS as `0x${string}` | undefined) ??
  // Hardhat's first deterministic deploy slot — overridden by env in mainnet.
  ("0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`);

/**
 * HTTP RPC URL used by the FRONTEND for read-only chain queries (e.g. the
 * payment picker's wallet-balance check). Intentionally separate from the
 * backend's EVM_RPC_URL — that one is a server secret; this one is bundled
 * into the browser. Point this at an Alchemy / Infura / QuickNode URL with
 * origin restrictions configured in the provider dashboard, or leave unset
 * to fall back to the chain-appropriate public node.
 *
 * Why this exists: MetaMask's default Sepolia RPC (bundled Infura, shared
 * across all MM users) gets rate-limited globally and returns -32002
 * "RPC endpoint returned too many errors" — including for cheap reads like
 * eth_getBalance. Routing balance reads through our own RPC sidesteps that
 * entirely. See useWalletBalance.ts.
 */
function defaultRpcUrlForChain(chainId: number): string {
  switch (chainId) {
    case 31337:
      return "http://127.0.0.1:8545"; // Hardhat
    case 11155111:
      return "https://ethereum-sepolia-rpc.publicnode.com"; // Sepolia
    case 421614:
      return "https://sepolia-rollup.arbitrum.io/rpc"; // Arbitrum Sepolia
    case 1:
      return "https://ethereum-rpc.publicnode.com"; // Mainnet
    default:
      return "https://ethereum-sepolia-rpc.publicnode.com";
  }
}
export const EVM_RPC_URL =
  (import.meta.env.VITE_EVM_RPC_URL as string | undefined) ??
  defaultRpcUrlForChain(CHAIN_ID);

export const POLL_INVENTORY_MS = 20_000;
export const POLL_INVENTORY_TOTAL_MS = 10 * 60 * 1000;
