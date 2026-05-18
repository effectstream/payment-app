import { hardhat, arbitrumSepolia } from "viem/chains";
import { EffectstreamConfig } from "@effectstream/wallets";
import {
  BATCHER_URL,
  CHAIN_ID,
  EFFECTSTREAM_L2_ADDRESS,
} from "./config.ts";

const chain = CHAIN_ID === 421614 ? arbitrumSepolia : hardhat;

/**
 * appName "" matches batcher namespace "" (see packages/batcher/batcher.*.ts).
 * Mismatch → 401 Invalid signature from /send-input.
 */
export const paimaEngineConfig = new EffectstreamConfig(
  "",
  "payment-l2",
  EFFECTSTREAM_L2_ADDRESS,
  chain,
  undefined,
  BATCHER_URL,
  true,
);
