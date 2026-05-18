import {
  ConfigBuilder,
  ConfigNetworkType,
  ConfigSyncProtocolType,
} from "@effectstream/config";
import { arbitrumSepolia } from "viem/chains";
import { PrimitiveTypeEVMEffectstreamL2 } from "@effectstream/sm/builtin";
import { getConnection } from "@effectstream/db";

import { effectstreamL2Grammar } from "./grammar.ts";

// Required env vars
const EVM_RPC_URL = process.env.EVM_RPC_URL;
const EFFECTSTREAM_L2_ADDRESS = process.env.EFFECTSTREAM_L2_ADDRESS;
if (!EVM_RPC_URL) throw new Error("EVM_RPC_URL is required for mainnet");
if (!EFFECTSTREAM_L2_ADDRESS)
  throw new Error("EFFECTSTREAM_L2_ADDRESS is required for mainnet");

const EVM_START_BLOCK = Number(process.env.EVM_START_BLOCK ?? "0");
const EVM_POLL_MS = Number(process.env.EVM_POLL_MS ?? "2000");
const EVM_CONFIRMATION_DEPTH = Number(process.env.EVM_CONFIRMATION_DEPTH ?? "5");

const mainSyncProtocolName = "mainNtp";
let launchStartTime: number | undefined;

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
    }
  } catch {
    // DB not initialized yet
  }
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
        ...arbitrumSepolia,
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
