import { EffectstreamL2DefaultAdapter } from "@effectstream/batcher-sdk";
import * as chains from "viem/chains";

export interface EffectstreamL2Env {
  contractAddress: `0x${string}`;
  privateKey: `0x${string}`;
  fee: bigint;
  syncProtocolName: string;
  chain: chains.Chain;
}

export function createEffectstreamL2Adapter(env: EffectstreamL2Env) {
  return new EffectstreamL2DefaultAdapter(
    env.contractAddress,
    env.privateKey,
    env.fee,
    env.syncProtocolName,
    env.chain,
  );
}
