import path from "node:path";
import type { OrchestratorConfig } from "@effectstream/orchestrator/config";

/**
 * Staging orchestrator — runs sync, batcher, and the frontend dev server.
 * Chain is Ethereum Sepolia (chainId 11155111). Postgres is external — start
 * it via `./init_db.sh` before running this.
 *
 * Required env vars in .env.staging at the repo root (validated by processes):
 *   EVM_RPC_URL, EFFECTSTREAM_L2_ADDRESS, BATCHER_EVM_SECRET_KEY,
 *   DB_HOST, DB_PORT, DB_USER, DB_PW, DB_NAME
 */
const root = import.meta.dirname!;

export default {
  processes: [
    {
      name: "sync",
      description: "Payment sync node (staging — Ethereum Sepolia)",
      // --env-file is needed because bun only auto-loads .env.<NODE_ENV>
      // for NODE_ENV in {production, development, test} — `staging` is not
      // recognized, so we point bun at the file explicitly.
      args: ["--env-file=.env.staging", "run", "packages/node/main.staging.ts"],
      waitToExit: false,
      type: "system-dependency",
      link: "http://localhost:9999",
      stopProcessAtPort: [9999],
      critical: true,
    },
    {
      name: "batcher",
      description: "Payment batcher (staging — Ethereum Sepolia)",
      args: ["--env-file=.env.staging", "run", "packages/batcher/batcher.staging.ts"],
      waitToExit: false,
      type: "system-dependency",
      link: "http://localhost:3334",
      stopProcessAtPort: [3334],
      critical: true,
    },
    {
      name: "frontend",
      description: "Frontend (Vite dev — staging mode, HMR)",
      cwd: path.join(root, "packages/frontend"),
      args: ["run", "dev:staging"],
      waitToExit: false,
      type: "system-dependency",
      link: "http://localhost:10598",
      stopProcessAtPort: [10598],
    },
  ],
} satisfies OrchestratorConfig;
