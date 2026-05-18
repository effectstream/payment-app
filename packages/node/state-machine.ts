import { Stm } from "@effectstream/sm";
import type { BaseStfInput } from "@effectstream/sm";
import type { StartConfigGameStateTransitions } from "@effectstream/runtime";
import { type SyncStateUpdateStream, World } from "@effectstream/coroutine";
import { upsertUserItem } from "@payment-app/database";

import { grammar } from "./grammar.ts";

const stm = new Stm<typeof grammar, {}>(grammar);

/**
 * The only game input: a user buys `amount` copies of weapon `itemId`.
 * Triggered by Transak (mainnet) or direct wallet (dev) submitting
 * effectstreamSubmitGameInput(["purchaseItem", itemId, amount]) to the L2 contract.
 *
 * On-chain ETH value is not validated here — the original Paima payments app
 * trusted the on-chain submission and only recorded inventory.
 */
stm.addStateTransition("purchaseItem", function* (data) {
  const wallet = data.signerAddress.toLowerCase();
  const { itemId, amount } = data.parsedInput;
  console.log(`[STM] purchaseItem: ${wallet} +${amount}x item#${itemId}`);

  yield* World.resolve(upsertUserItem, {
    wallet,
    item_id: itemId,
    amount,
  });
});

export const gameStateTransitions: StartConfigGameStateTransitions = function* (
  _blockHeight: number,
  input: BaseStfInput,
): SyncStateUpdateStream<void> {
  yield* stm.processInput(input);
};
