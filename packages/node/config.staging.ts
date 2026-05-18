import {
  ConfigBuilder,
  ConfigNetworkType,
  ConfigSyncProtocolType,
} from "@effectstream/config";
import { sepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { PrimitiveTypeEVMEffectstreamL2 } from "@effectstream/sm/builtin";
import { getConnection } from "@effectstream/db";

import { effectstreamL2Grammar } from "./grammar.ts";

// Required env vars
const EVM_RPC_URL = process.env.EVM_RPC_URL;
const EFFECTSTREAM_L2_ADDRESS = process.env.EFFECTSTREAM_L2_ADDRESS;
if (!EVM_RPC_URL) throw new Error("EVM_RPC_URL is required for staging");
if (!EFFECTSTREAM_L2_ADDRESS)
  throw new Error("EFFECTSTREAM_L2_ADDRESS is required for staging");

const EVM_POLL_MS = Number(process.env.EVM_POLL_MS ?? "2000");
const EVM_CONFIRMATION_DEPTH = Number(process.env.EVM_CONFIRMATION_DEPTH ?? "5");
// Blocks fetched in parallel per poll tick. The upstream default is 1000, which
// blows past Alchemy free-tier CU/s on backfill. Keep small on staging.
const EVM_STEP_SIZE = Number(process.env.EVM_STEP_SIZE ?? "25");

const mainSyncProtocolName = "mainNtp";
let launchStartTime: number | undefined;
let hasExistingSyncState = false;

if (typeof process !== "undefined") {
  const dbConn = getConnection();
  try {
    const result = await dbConn.query(`
      SELECT * FROM effectstream.sync_protocol_pagination
      WHERE protocol_name = '${mainSyncProtocolName}'
      ORDER BY page_number ASC
      LIMIT 1
    `);
    if (result?.rows.length) {
      launchStartTime = result.rows[0].page.root -
        (result.rows[0].page_number * 1000);
      hasExistingSyncState = true;
    }
  } catch {
    // DB not initialized yet — treat as fresh.
  }
}

// EVM start block resolution, in order:
//   1. Explicit EVM_START_BLOCK env var (e.g. the contract's deploy block).
//   2. If sync state already exists in DB, value is irrelevant — pass 0,
//      effectstream resumes from the persisted cursor.
//   3. Fresh DB and no env var → fetch the current Sepolia tip so we don't
//      try to scan from genesis (~8M blocks of public chain).
let EVM_START_BLOCK: number;
if (process.env.EVM_START_BLOCK) {
  EVM_START_BLOCK = Number(process.env.EVM_START_BLOCK);
  console.log(`[staging] EVM_START_BLOCK=${EVM_START_BLOCK} (from env)`);
} else if (hasExistingSyncState) {
  EVM_START_BLOCK = 0;
  console.log(`[staging] Resuming sync from persisted cursor in DB`);
} else {
  const probe = createPublicClient({
    chain: sepolia,
    transport: http(EVM_RPC_URL),
  });
  const tip = await probe.getBlockNumber();
  // Back off a few blocks to stay outside the reorg window.
  EVM_START_BLOCK = Math.max(0, Number(tip) - EVM_CONFIRMATION_DEPTH);
  console.log(
    `[staging] Fresh DB — starting sync from Sepolia tip ` +
      `(block ${EVM_START_BLOCK}, current tip ${tip})`,
  );
}

export const config = new ConfigBuilder()
  .setNamespace((builder) => builder.setSecurityNamespace("payment-app"))
  .buildNetworks((builder) =>
    builder
      .addNetwork({
        name: "ntp",
        type: ConfigNetworkType.NTP,
        startTime: launchStartTime ?? new Date().getTime(),
        blockTimeMS: 1000,
      })
      .addViemNetwork({
        ...sepolia,
        name: "evmMain",
        rpcUrls: { default: { http: [EVM_RPC_URL] } } as any,
      })
  )
  .buildDeployments((builder) => builder)
  .buildSyncProtocols((builder) =>
    builder
      .addMain(
        (networks) => networks.ntp,
        (_network, _deployments) => ({
          name: mainSyncProtocolName,
          type: ConfigSyncProtocolType.NTP_MAIN,
          chainUri: "",
          startBlockHeight: 1,
          pollingInterval: 1000,
        }),
      )
      .addParallel(
        (networks) => networks.evmMain,
        (network, _deployments) => ({
          name: "payment-l2",
          type: ConfigSyncProtocolType.EVM_RPC_PARALLEL,
          chainUri: network.rpcUrls.default.http[0],
          startBlockHeight: EVM_START_BLOCK,
          pollingInterval: EVM_POLL_MS,
          confirmationDepth: EVM_CONFIRMATION_DEPTH,
          stepSize: EVM_STEP_SIZE,
        }),
      )
  )
  .buildPrimitives((builder) =>
    builder
      .addPrimitive(
        (syncProtocols) => (syncProtocols as any)["payment-l2" as keyof typeof syncProtocols],
        (_network, _deployments, _syncProtocol) => ({
          name: "PaymentL2",
          type: PrimitiveTypeEVMEffectstreamL2,
          startBlockHeight: EVM_START_BLOCK,
          contractAddress: EFFECTSTREAM_L2_ADDRESS as `0x${string}`,
          effectstreamL2Grammar: effectstreamL2Grammar,
        }),
      )
  )
  .build();
