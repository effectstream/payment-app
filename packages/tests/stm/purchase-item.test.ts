import { assertSQL } from "../helpers.ts";
import { createWalletClient, createPublicClient, http, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import { contractAddressesEvmMain } from "@payment-app/contracts-evm";
import type { Client } from "pg";

// Hardhat deterministic wallet #0 — never reused by the batcher (which uses #2).
const wallet0 = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);

const effectstreamL2Abi = [
  {
    inputs: [{ name: "data", type: "bytes" }],
    name: "effectstreamSubmitGameInput",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
] as const;

async function submitPurchase(
  contractAddr: `0x${string}`,
  itemId: number,
  amount: number,
): Promise<void> {
  const walletClient = createWalletClient({
    account: wallet0,
    chain: hardhat,
    transport: http(),
  });
  const publicClient = createPublicClient({ chain: hardhat, transport: http() });
  const hash = await walletClient.writeContract({
    address: contractAddr,
    abi: effectstreamL2Abi,
    functionName: "effectstreamSubmitGameInput",
    args: [toHex(JSON.stringify(["purchaseItem", itemId, amount]))],
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

export async function purchaseItemTest(db: Client) {
  const contractAddr = contractAddressesEvmMain().chain31337[
    "EffectstreamL2Module#PaymentEffectstreamL2"
  ] as `0x${string}`;

  // First purchase: itemId 3, amount 2.
  await submitPurchase(contractAddr, 3, 2);
  await assertSQL<{ wallet: string; item_id: number; amount: number }>(
    "purchaseItem: first purchase recorded (item#3 amount=2)",
    db,
    `SELECT wallet, item_id, amount FROM user_items
     WHERE wallet = '${wallet0.address.toLowerCase()}' AND item_id = 3`,
    (res) => res.rows.length >= 1,
    (res) => res.rows[0].amount === 2,
  );

  // Second purchase: itemId 3, amount 1 → cumulative 3.
  await submitPurchase(contractAddr, 3, 1);
  await assertSQL<{ wallet: string; item_id: number; amount: number }>(
    "purchaseItem: second purchase increments amount (item#3 amount=3)",
    db,
    `SELECT amount FROM user_items
     WHERE wallet = '${wallet0.address.toLowerCase()}' AND item_id = 3`,
    (res) => res.rows.length >= 1 && res.rows[0].amount >= 3,
    (res) => res.rows[0].amount === 3,
  );

  // Different item: itemId 7, amount 1.
  await submitPurchase(contractAddr, 7, 1);
  await assertSQL<{ wallet: string; item_id: number; amount: number }>(
    "purchaseItem: different item is separate row (item#7 amount=1)",
    db,
    `SELECT amount FROM user_items
     WHERE wallet = '${wallet0.address.toLowerCase()}' AND item_id = 7`,
    (res) => res.rows.length >= 1,
    (res) => res.rows[0].amount === 1,
  );
}
