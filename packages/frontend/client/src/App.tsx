import { useCallback, useEffect, useMemo, useState } from "react";
import { walletLogin, WalletMode, type Wallet } from "@effectstream/wallets";
import { paimaEngineConfig } from "./EffectstreamConfig.ts";
import { ITEMS, getItem, type Item } from "./items.ts";
import { buyWithWallet, buyWithTransak } from "./purchase.ts";
import {
  fetchInventory,
  startPollingInventory,
  type InventoryRow,
} from "./poll-inventory.ts";
import { TRANSAK_ENABLED, TRANSAK_DEMO_FALLBACK } from "./config.ts";
import {
  ItemModal,
  type PaymentMethod,
  type PurchaseState,
} from "./components/ItemModal.tsx";

export default function App() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [purchaseSnapshot, setPurchaseSnapshot] = useState<number>(0);
  const [purchaseState, setPurchaseState] = useState<PurchaseState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseBanner, setPurchaseBanner] = useState<string | null>(null);

  const inventoryById = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of inventory) map.set(row.item_id, row.amount);
    return map;
  }, [inventory]);

  const ownedItems = useMemo(
    () =>
      inventory
        .filter((row) => row.amount > 0)
        .map((row) => ({ item: getItem(row.item_id), amount: row.amount }))
        .filter((entry): entry is { item: Item; amount: number } => !!entry.item)
        .sort((a, b) => a.item.id - b.item.id),
    [inventory],
  );

  const totalOwned = useMemo(
    () => ownedItems.reduce((sum, e) => sum + e.amount, 0),
    [ownedItems],
  );

  const refreshInventory = useCallback(async () => {
    if (!address) return;
    try {
      setInventory(await fetchInventory(address));
    } catch {
      /* ignore */
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
    void refreshInventory();
  }, [address, refreshInventory]);

  // Detect successful purchase: while polling for `activeItem`, watch for the
  // owned amount to exceed the snapshot taken when Buy was clicked.
  useEffect(() => {
    if (purchaseState !== "polling" || !activeItem) return;
    const current = inventoryById.get(activeItem.id) ?? 0;
    if (current > purchaseSnapshot) {
      setPurchaseState("success");
      const t = setTimeout(() => setPurchaseState("idle"), 3000);
      return () => clearTimeout(t);
    }
  }, [inventoryById, purchaseState, activeItem, purchaseSnapshot]);

  const connect = useCallback(async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    try {
      const response = await walletLogin({
        mode: WalletMode.EvmInjected,
        chain: (paimaEngineConfig as any).effectstreamL2Chain,
      } as any);
      if (response.success) {
        setWallet(response.result);
        setAddress(response.result.walletAddress);
      } else {
        setErrorMsg(response.errorMessage ?? "wallet login failed");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet(null);
    setAddress(null);
    setInventory([]);
  }, []);

  // Kicks off inventory polling after a successful on-chain submission. Shared
  // between the direct-wallet path and the demo-fallback path that fires after
  // Transak's staging success event.
  const startPostSubmitPolling = useCallback(() => {
    if (!address) return;
    setPurchaseState("polling");
    const stop = startPollingInventory(address, setInventory);
    // Self-bounded inside the poll fn; this is a safety net.
    setTimeout(stop, 10 * 60 * 1000 + 1000);
  }, [address]);

  // Demo workaround for Transak staging not settling on Sepolia. When the
  // staging Transak widget fires TRANSAK_ORDER_SUCCESSFUL, this fallback
  // submits a real Sepolia tx from the connected wallet so the sync node
  // sees an EffectstreamGameInteraction event and the demo can show the
  // full pipe end-to-end. Gated by VITE_TRANSAK_DEMO_FALLBACK — never runs
  // in production.
  const runDemoFallback = useCallback(
    async (item: Item) => {
      if (!wallet) {
        setPurchaseState("error");
        setPurchaseError(
          "Demo fallback needs a connected wallet to simulate settlement. " +
            "Connect a wallet and re-run the Transak purchase.",
        );
        return;
      }
      setPurchaseBanner(
        "Demo: Transak staging doesn't settle on Sepolia. " +
          "Simulating the on-chain step via your connected wallet — confirm in MetaMask.",
      );
      try {
        await buyWithWallet(wallet, item);
        setPurchaseBanner(null);
        startPostSubmitPolling();
      } catch (err) {
        setPurchaseBanner(null);
        setPurchaseState("error");
        setPurchaseError(err instanceof Error ? err.message : String(err));
      }
    },
    [wallet, startPostSubmitPolling],
  );

  const onBuy = useCallback(
    async (item: Item, method: PaymentMethod) => {
      if (!wallet || !address) return;
      setActiveItem(item);
      setPurchaseSnapshot(inventoryById.get(item.id) ?? 0);
      setPurchaseState("submitting");
      setPurchaseError(null);
      setPurchaseBanner(null);
      try {
        if (method === "wallet") {
          await buyWithWallet(wallet, item);
          startPostSubmitPolling();
          return;
        }

        // Transak path. Polling and demo-fallback both wait for the widget's
        // success event — kicking either off eagerly here would leave the
        // app in "polling" forever if the user cancelled Transak instead.
        await buyWithTransak(item, {
          onSuccess: () => {
            if (TRANSAK_DEMO_FALLBACK && wallet) {
              // Staging demo: Transak's test env doesn't settle on Sepolia,
              // so we fire a real wallet tx ourselves. runDemoFallback also
              // starts inventory polling once the wallet tx is submitted.
              void runDemoFallback(item);
            } else {
              // Production: Transak's relayer is submitting the on-chain
              // tx now. Inventory poll will pick it up.
              startPostSubmitPolling();
            }
          },
          onCancel: () => {
            // User dismissed Transak without completing a purchase (or it
            // failed). Reset the modal back to idle.
            setPurchaseState("idle");
            setPurchaseError(null);
            setPurchaseBanner(null);
          },
        });
      } catch (err) {
        setPurchaseState("error");
        setPurchaseError(err instanceof Error ? err.message : String(err));
      }
    },
    [wallet, address, inventoryById, startPostSubmitPolling, runDemoFallback],
  );

  // The modal only mirrors purchase state when the selected item matches the
  // in-flight purchase. Otherwise it shows idle for that item.
  const modalPurchaseState: PurchaseState =
    selectedItem && activeItem?.id === selectedItem.id ? purchaseState : "idle";

  return (
    <div className="container">
      <header className="header">
        <h1>⚔️ Iron &amp; Ether</h1>
        <p className="sub">
          Forge your loadout —{" "}
          {TRANSAK_ENABLED ? "pay with wallet or fiat" : "direct wallet (dev mode)"}
        </p>
        {address ? (
          <div className="wallet">
            <code className="addr">
              {address.slice(0, 6)}…{address.slice(-4)}
            </code>
            <button onClick={disconnect}>Disconnect</button>
          </div>
        ) : (
          <button onClick={connect} disabled={isConnecting} className="primary">
            {isConnecting ? "Connecting…" : "Connect Wallet"}
          </button>
        )}
      </header>

      {errorMsg && <div className="error">⚠️ {errorMsg}</div>}

      {address && (
        <section className="inventory">
          <div className="inventory-head">
            <h2>
              Your Inventory{" "}
              <span className="badge">
                {ownedItems.length} unique · {totalOwned} total
              </span>
            </h2>
            <button onClick={() => void refreshInventory()} className="ghost">
              Refresh
            </button>
          </div>
          {ownedItems.length === 0 ? (
            <p className="empty">
              You don't own any items yet. Buy one from the catalogue below to
              get started.
            </p>
          ) : (
            <ul className="owned-list">
              {ownedItems.map(({ item, amount }) => (
                <li
                  key={item.id}
                  className="owned-row clickable"
                  onClick={() => setSelectedItem(item)}
                >
                  <img src={item.image} alt={item.name} />
                  <div className="owned-name">{item.name}</div>
                  <div className="owned-amount">×{amount}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2>Catalogue</h2>
        <div className="grid">
          {ITEMS.map((item) => (
            <article key={item.id} className="card">
              <img src={item.image} alt={item.name} />
              <h3>{item.name}</h3>
              <p className="price">{item.priceEth} ETH</p>
              <p
                className={
                  inventoryById.has(item.id) ? "owned" : "owned placeholder"
                }
              >
                Owned: {inventoryById.get(item.id) ?? 0}
              </p>
              <button onClick={() => setSelectedItem(item)}>Details</button>
            </article>
          ))}
        </div>
      </section>

      {selectedItem && (
        <ItemModal
          item={selectedItem}
          ownedAmount={inventoryById.get(selectedItem.id) ?? 0}
          wallet={wallet}
          walletAddress={address}
          purchaseState={modalPurchaseState}
          errorMsg={
            activeItem?.id === selectedItem.id ? purchaseError : null
          }
          banner={
            activeItem?.id === selectedItem.id ? purchaseBanner : null
          }
          onBuy={onBuy}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
