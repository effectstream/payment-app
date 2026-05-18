import { sendTransaction, type Wallet } from "@effectstream/wallets";
import { Transak } from "@transak/ui-js-sdk";
import { paimaEngineConfig } from "./EffectstreamConfig.ts";
import { EFFECTSTREAM_NODE_URL } from "./config.ts";
import type { Item } from "./items.ts";

/**
 * On-chain wallet path. Sign and submit the purchase via the connected wallet
 * (in dev this rides through the local batcher; in staging/prod against Sepolia
 * the same SDK can also submit directly — either path lands the same
 * `EffectstreamGameInteraction` event for the sync node to credit inventory).
 *
 * Payload is always:
 *   effectstreamSubmitGameInput(["purchaseItem", item.id, 1])
 */
export async function buyWithWallet(
  wallet: Wallet,
  item: Item,
): Promise<void> {
  await sendTransaction(
    wallet,
    ["purchaseItem", item.id, 1],
    paimaEngineConfig,
    "wait-effectstream-processed",
  );
}

/**
 * Transak hosted-checkout path. Asks our backend for a server-signed widget
 * URL (Transak now refuses widgetUrls assembled on the client because they
 * include the apiSecret-derived session) and opens the widget.
 *
 * Lifecycle callbacks fire after the widget DOM is torn down:
 * - `onSuccess` — Transak's `TRANSAK_ORDER_SUCCESSFUL` event fired. In
 *   production this means the order is being processed by Transak's relayer
 *   and an on-chain tx is on its way. The caller should kick off inventory
 *   polling (and, in staging-demo mode, fire a real wallet tx itself since
 *   Transak staging never settles on-chain).
 * - `onCancel` — Transak's `TRANSAK_ORDER_CANCELLED`, `TRANSAK_ORDER_FAILED`,
 *   or `TRANSAK_WIDGET_CLOSE` fired without a prior success. The caller
 *   should reset its purchase state back to idle.
 *
 * ## Why listeners are registered per-call (and not at module load)
 *
 * The `@transak/ui-js-sdk` v1.0.0 SDK has two surprises:
 *
 * 1. It never tears down its own DOM. Even when the user clicks the close
 *    icon (which posts `TRANSAK_WIDGET_CLOSE_REQUEST` into the iframe) or
 *    the iframe broadcasts `TRANSAK_WIDGET_CLOSE` back out, the host has
 *    to call `widget.close()` explicitly. Without that, the modal stays
 *    open after a successful purchase and the user has no way to dismiss
 *    it.
 *
 * 2. `widget.close()` calls `m.removeAllListeners()` internally on its
 *    static EventEmitter. So any listener registered via `Transak.on(...)`
 *    survives only until the first close — module-level listeners would
 *    silently stop firing for every subsequent purchase.
 *
 * Both problems disappear if we register fresh listeners per `init()` call
 * and make every terminal event call `widget.close()`. The close wipes the
 * listeners we just registered (which is fine — the next purchase
 * registers its own).
 */
export async function buyWithTransak(
  item: Item,
  opts: {
    onSuccess?: () => void;
    onCancel?: () => void;
  } = {},
): Promise<void> {
  const res = await fetch(`${EFFECTSTREAM_NODE_URL}/api/transak/widget-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      itemId: item.id,
      priceEth: item.priceEth,
      name: item.name,
      imageURL: `${window.location.origin}/items/${item.id}.svg`,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      `Failed to create Transak session (${res.status}): ${JSON.stringify(err)}`,
    );
  }
  const { widgetUrl } = (await res.json()) as { widgetUrl: string };

  const widget = new Transak({ widgetUrl });

  // Terminal-event reentry guard. The SDK's static EventEmitter is wiped by
  // widget.close(), but we still want to defend against multiple events
  // firing in rapid succession before the close call lands.
  let torndown = false;
  const teardown = () => {
    if (torndown) return;
    torndown = true;
    try {
      widget.close();
    } catch {
      // close is best-effort; the SDK throws nothing today but be defensive.
    }
  };

  Transak.on(Transak.EVENTS.TRANSAK_ORDER_SUCCESSFUL, () => {
    // Close the modal *before* firing onSuccess so the user sees our app
    // (and any "simulating on-chain step" banner) before MetaMask pops up.
    teardown();
    opts.onSuccess?.();
  });
  // Cancel, failure, and user-initiated close all surface as "no purchase
  // happened" to the caller so it can reset UI back to idle.
  Transak.on(Transak.EVENTS.TRANSAK_ORDER_CANCELLED, () => {
    teardown();
    opts.onCancel?.();
  });
  Transak.on(Transak.EVENTS.TRANSAK_ORDER_FAILED, () => {
    teardown();
    opts.onCancel?.();
  });
  // The iframe broadcasts WIDGET_CLOSE when the user clicks its own close
  // icon. The SDK does not auto-teardown — we have to.
  Transak.on(Transak.EVENTS.TRANSAK_WIDGET_CLOSE, () => {
    teardown();
    opts.onCancel?.();
  });

  widget.init();
}
