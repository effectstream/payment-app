import { EFFECTSTREAM_NODE_URL, POLL_INVENTORY_MS, POLL_INVENTORY_TOTAL_MS } from "./config.ts";

export interface InventoryRow {
  wallet: string;
  item_id: number;
  amount: number;
}

export async function fetchInventory(wallet: string): Promise<InventoryRow[]> {
  const res = await fetch(
    `${EFFECTSTREAM_NODE_URL}/api/items?wallet=${encodeURIComponent(wallet.toLowerCase())}`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json?.items) ? json.items : [];
}

/**
 * Polls the inventory endpoint every 20s for up to 10 min (matches the
 * original Paima payments app behavior after a Transak success event).
 * Returns a stop() function.
 */
export function startPollingInventory(
  wallet: string,
  onUpdate: (rows: InventoryRow[]) => void,
): () => void {
  let stopped = false;
  const start = Date.now();

  const tick = async () => {
    if (stopped) return;
    try {
      onUpdate(await fetchInventory(wallet));
    } catch (err) {
      console.error("inventory poll error", err);
    }
    if (Date.now() - start >= POLL_INVENTORY_TOTAL_MS) return;
    setTimeout(tick, POLL_INVENTORY_MS);
  };
  void tick();

  return () => {
    stopped = true;
  };
}
