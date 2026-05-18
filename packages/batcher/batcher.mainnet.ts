import { main, suspend } from "effection";
import {
  createNewBatcher,
  FileStorage,
  type BatcherConfig,
  type DefaultBatcherInput,
} from "@effectstream/batcher-sdk";
import { ENV } from "@effectstream/utils/node-env";
import { arbitrumSepolia } from "viem/chains";

import { createEffectstreamL2Adapter } from "./effectstream-l2.ts";

const BATCHER_EVM_SECRET_KEY = process.env.BATCHER_EVM_SECRET_KEY;
const EFFECTSTREAM_L2_ADDRESS = process.env.EFFECTSTREAM_L2_ADDRESS;
if (!BATCHER_EVM_SECRET_KEY)
  throw new Error("BATCHER_EVM_SECRET_KEY is required for mainnet batcher");
if (!EFFECTSTREAM_L2_ADDRESS)
  throw new Error("EFFECTSTREAM_L2_ADDRESS is required for mainnet batcher");

const batchIntervalMs = Number(process.env.BATCHER_INTERVAL_MS ?? "2000");
const fee = BigInt(process.env.BATCHER_FEE ?? "0");
const port = ENV.getNumber("BATCHER_PORT", 3334);

const adapter = createEffectstreamL2Adapter({
  contractAddress: EFFECTSTREAM_L2_ADDRESS as `0x${string}`,
  privateKey: BATCHER_EVM_SECRET_KEY as `0x${string}`,
  fee,
  syncProtocolName: "payment-l2",
  chain: arbitrumSepolia,
});

const config: BatcherConfig<DefaultBatcherInput> = {
  pollingIntervalMs: batchIntervalMs,
  enableHttpServer: true,
  namespace: "",
  confirmationLevel: "wait-effectstream-processed",
  enableEventSystem: true,
  port,
};

const storage = new FileStorage("./batcher-data");
const batcher = createNewBatcher(config, storage);

batcher
  .addBlockchainAdapter("payment-l2", adapter, {
    criteriaType: "time",
    timeWindowMs: batchIntervalMs,
  })
  .setDefaultTarget("payment-l2");

main(function* () {
  console.log("Starting Payment App batcher (mainnet)...");
  try {
    yield* batcher.runBatcher();
  } catch (err) {
    console.error("Batcher error:", err);
    yield* batcher.gracefulShutdownOp();
  }
  yield* suspend();
});
