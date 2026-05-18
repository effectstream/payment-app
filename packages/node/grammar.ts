import { Type } from "@sinclair/typebox";
import type { GrammarDefinition } from "@effectstream/concise";

/**
 * Grammar for the L2 contract (game inputs submitted via effectstreamSubmitGameInput).
 *
 * Wire format: ["purchaseItem", itemId, amount]
 * - itemId: which weapon (1..18) — matches the frontend item catalogue
 * - amount: how many copies to credit (typically 1)
 */
export const effectstreamL2Grammar = {
  purchaseItem: [
    ["itemId", Type.Integer({ minimum: 1, maximum: 18 })],
    ["amount", Type.Integer({ minimum: 1, maximum: 1000 })],
  ],
} as const satisfies GrammarDefinition;

export const grammar = {
  ...effectstreamL2Grammar,
} as const satisfies GrammarDefinition;
