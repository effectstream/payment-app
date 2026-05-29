import type { OrchestratorConfig } from "@effectstream/orchestrator/config";

/**
 * Mainnet orchestrator — runs only the sync node and batcher.
 * Chain and database (managed Postgres) live elsewhere. NOTE: the real mainnet
 * chain has not been finalized; the node and batcher currently run against Arbitrum
 * Sepolia as a placeholder (see TODOs in config.mainnet.ts / batcher.mainnet.ts).
 *
 * Required env vars (validated inside the processes):
 *   EVM_RPC_URL, EFFECTSTREAM_L2_ADDRESS,
 *   BATCHER_EVM_SECRET_KEY, DATABASE_URL
 */
export default {
  processes: [
    {
      name: "sync",
      description: "Payment sync node (mainnet)",
      args: ["run", "packages/node/main.mainnet.ts"],
      waitToExit: false,
      type: "system-dependency",
      critical: true,
    },
    {
      name: "batcher",
      description: "Payment batcher (mainnet)",
      args: ["run", "packages/batcher/batcher.mainnet.ts"],
      waitToExit: false,
      type: "system-dependency",
      link: "http://localhost:3334",
      stopProcessAtPort: [3334],
      critical: true,
    },
  ],
} satisfies OrchestratorConfig;
