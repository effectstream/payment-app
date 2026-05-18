import { anyError, printSummary } from "./helpers.ts";
import pg from "pg";
import path from "node:path";
import type { Client } from "pg";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ORCHESTRATOR_PORT = 4747;
const API_PORT = Number(process.env.EFFECTSTREAM_API_PORT ?? "9999");
const RUN_FRONTEND = process.env.SKIP_FRONTEND_TESTS !== "true";

const CLI_PATH = path.resolve(
  import.meta.dirname!,
  "../../node_modules/@effectstream/orchestrator/src/cli.ts",
);
const LAUNCHER_PATH = path.resolve(import.meta.dirname!, "./start.test.ts");

let proc: ReturnType<typeof Bun.spawn> | null = null;

async function startInfra() {
  proc = Bun.spawn(["bun", CLI_PATH, "start", LAUNCHER_PATH], {
    cwd: path.resolve(import.meta.dirname!, "../.."),
    stdout: "inherit",
    stderr: "inherit",
    env: { ...process.env },
  });
}

async function stopInfra() {
  try {
    await fetch(`http://localhost:${ORCHESTRATOR_PORT}/shutdown`, {
      method: "POST",
    });
  } catch {}
  await delay(2000);
  proc?.kill();
}

async function waitForProcess(
  name: string,
  opts: { waitForExit?: boolean; timeoutMs?: number } = {},
) {
  const { waitForExit = false, timeoutMs = 180_000 } = opts;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${ORCHESTRATOR_PORT}/processes`);
      const data = (await res.json()) as any;
      const p = data.processes?.find((p: any) => p.name === name);
      if (p) {
        if (waitForExit && p.status === "done") return;
        if (!waitForExit && (p.status === "running" || p.status === "done")) return;
      }
    } catch {}
    await delay(500);
  }
  throw new Error(
    `Process "${name}" did not ${waitForExit ? "complete" : "start"} within ${timeoutMs / 1000}s`,
  );
}

async function waitForApi(timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://localhost:${API_PORT}/api/health`);
      if (res.ok) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`API on port ${API_PORT} did not respond within ${timeoutMs / 1000}s`);
}

async function test() {
  let db: Client | null = null;
  try {
    await startInfra();
    await delay(2000);

    console.log("\n=== Phase A: Infrastructure ===");
    await waitForProcess("generate-evm-mod", { waitForExit: true });
    const { chainReadyTest } = await import("./infra/chain-ready.test.ts");
    const { deployTest } = await import("./infra/deploy.test.ts");
    await chainReadyTest();
    await deployTest();

    console.log("\n=== Phase B: State Machine + DB + API ===");
    await waitForProcess("sync");
    await waitForApi();
    db = new pg.Client({
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres",
    });
    await db.connect();
    const { purchaseItemTest } = await import("./stm/purchase-item.test.ts");
    const { apiTest } = await import("./stm/api.test.ts");
    await purchaseItemTest(db);
    await apiTest();

    if (RUN_FRONTEND) {
      console.log("\n=== Phase C: Frontend ===");
      const { frontendBuildTest } = await import("./frontend/build-smoke.test.ts");
      await frontendBuildTest();
      // Render test requires a running frontend-server, skipped when running
      // inside `bun run test` (which doesn't launch the frontend); use
      // `bun run dev` in another shell and then re-run to exercise it.
      if (process.env.RUN_RENDER_TEST === "true") {
        const { frontendRenderTest } = await import("./frontend/render.test.ts");
        await frontendRenderTest();
      }
    }

    printSummary();
  } catch (e) {
    printSummary();
    console.error(e);
  } finally {
    if (db) await db.end();
    await stopInfra();
    if (anyError()) process.exit(1);
    process.exit(0);
  }
}

void test();
