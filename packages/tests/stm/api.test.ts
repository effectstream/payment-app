import { assert } from "../helpers.ts";
import { privateKeyToAccount } from "viem/accounts";

const API_PORT = 9999;

const wallet0Addr = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
).address.toLowerCase();

export async function apiTest() {
  await assert("GET /api/health returns ok", async () => {
    const res = await fetch(`http://localhost:${API_PORT}/api/health`);
    if (!res.ok) return false;
    const json = await res.json();
    return json.ok === true;
  });

  await assert("GET /api/items?wallet=<wallet0> returns purchases", async () => {
    const res = await fetch(
      `http://localhost:${API_PORT}/api/items?wallet=${wallet0Addr}`,
    );
    if (!res.ok) return false;
    const json = await res.json();
    if (!Array.isArray(json.items)) return false;
    if (json.wallet !== wallet0Addr) return false;
    // Should have at least the rows the STM tests inserted.
    const item3 = json.items.find((r: any) => r.item_id === 3);
    const item7 = json.items.find((r: any) => r.item_id === 7);
    return item3?.amount === 3 && item7?.amount === 1;
  });

  await assert("GET /api/items without wallet returns 400", async () => {
    const res = await fetch(`http://localhost:${API_PORT}/api/items`);
    return res.status === 400;
  });
}
