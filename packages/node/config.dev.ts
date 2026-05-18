import { contractAddressesEvmMain } from "@payment-app/contracts-evm";
import { getConnection } from "@effectstream/db";
import {
  ConfigBuilder,
  ConfigNetworkType,
  ConfigSyncProtocolType,
} from "@effectstream/config";
import { hardhat } from "viem/chains";
import { PrimitiveTypeEVMEffectstreamL2 } from "@effectstream/sm/builtin";

import { effectstreamL2Grammar } from "./grammar.ts";

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
      .addViemNetwork({ ...hardhat, name: "evmMain" })
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
          pollingInterval: 500,
        }),
      )
      .addParallel(
        (networks) => networks.evmMain,
        (network, _deployments) => ({
          name: "payment-l2",
          type: ConfigSyncProtocolType.EVM_RPC_PARALLEL,
          chainUri: network.rpcUrls.default.http[0],
          startBlockHeight: 1,
          pollingInterval: 500,
          confirmationDepth: 1,
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
          startBlockHeight: 0,
          contractAddress: contractAddressesEvmMain()
            .chain31337["EffectstreamL2Module#PaymentEffectstreamL2"],
          effectstreamL2Grammar: effectstreamL2Grammar,
        }),
      )
  )
  .build();
