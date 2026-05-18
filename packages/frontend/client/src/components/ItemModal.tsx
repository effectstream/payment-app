import { useEffect, useState } from "react";
import type { Wallet } from "@effectstream/wallets";
import type { Item, Rarity } from "../items.ts";
import { TRANSAK_ENABLED } from "../config.ts";
import {
  useWalletBalance,
  canPayWithWallet,
} from "../hooks/useWalletBalance.ts";

export type PurchaseState =
  | "idle"
  | "submitting"
  | "polling"
  | "success"
  | "error";

/** Which payment rail the user picked in the picker step. */
export type PaymentMethod = "wallet" | "transak";

interface Props {
  item: Item;
  ownedAmount: number;
  wallet: Wallet | null;
  /** Connected wallet address, used for balance lookup in the picker. */
  walletAddress: string | null;
  purchaseState: PurchaseState;
  errorMsg?: string | null;
  /**
   * Called with the chosen payment method. In dev (TRANSAK_ENABLED=false)
   * the modal short-circuits the picker and calls this directly with "wallet".
   */
  onBuy: (item: Item, method: PaymentMethod) => void;
  onClose: () => void;
  /**
   * Optional banner shown above the CTA — used by App.tsx to surface the
   * "Demo: simulating Transak settlement on-chain via your connected wallet"
   * message when the staging demo fallback kicks in.
   */
  banner?: string | null;
}

const RARITY_CLASS: Record<Rarity, string> = {
  Common: "rarity-common",
  Uncommon: "rarity-uncommon",
  Rare: "rarity-rare",
  Epic: "rarity-epic",
  Legendary: "rarity-legendary",
};

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <div className="stat-track">
        <div className="stat-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatEthShort(eth: string): string {
  // Trim to 4 decimal places without trailing-zero clutter.
  const n = Number(eth);
  if (!Number.isFinite(n)) return eth;
  return n
    .toFixed(4)
    .replace(/\.?0+$/, "")
    || "0";
}

export function ItemModal({
  item,
  ownedAmount,
  wallet,
  walletAddress,
  purchaseState,
  errorMsg,
  onBuy,
  onClose,
  banner,
}: Props) {
  // `picker` is a local-only mode toggled by the primary CTA. Once the user
  // picks a method, App.tsx takes over via purchaseState (submitting/polling).
  const [showPicker, setShowPicker] = useState(false);

  // Pass the Wallet (not just address) so the balance read goes through the
  // *selected* wallet's EIP-1193 provider — `@effectstream/wallets` uses
  // EIP-6963 discovery, so a multi-wallet user (MetaMask + Rabby + Coinbase)
  // can pick a wallet that isn't whoever won the legacy `window.ethereum`
  // injection. Routing through `wallet.provider` keeps the balance reading
  // aligned with the wallet the user actually picked.
  const balance = useWalletBalance(wallet);
  const walletEligibility = canPayWithWallet(balance, item.priceEth);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showPicker) setShowPicker(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showPicker]);

  // While a purchase is in-flight (submitting/polling) or just succeeded,
  // collapse the picker so the user sees the status, not the methods.
  useEffect(() => {
    if (purchaseState !== "idle") setShowPicker(false);
  }, [purchaseState]);

  const isBusy = purchaseState === "submitting" || purchaseState === "polling";

  let ctaLabel = `Buy for ${item.priceEth} ETH`;
  if (purchaseState === "submitting") ctaLabel = "Submitting…";
  else if (purchaseState === "polling")
    ctaLabel = "Submitted — polling inventory…";
  else if (purchaseState === "success")
    ctaLabel = `Purchase confirmed (Owned: ${ownedAmount})`;

  const onPrimaryClick = () => {
    if (!wallet) return; // Button is disabled in this state.
    if (!TRANSAK_ENABLED) {
      // Dev mode: only one path exists. Skip the picker entirely.
      onBuy(item, "wallet");
      return;
    }
    // Snapshot what the wallet hook currently thinks before the picker
    // renders, plus force a fresh re-read so the picker UI shows live data
    // (gas prices and balances can shift between modal-open and Buy-click).
    // eslint-disable-next-line no-console
    console.log("[picker] opening for item", {
      itemId: item.id,
      itemName: item.name,
      priceEth: item.priceEth,
      wallet: {
        name: wallet.metadata?.name,
        displayName: wallet.metadata?.displayName,
        address: walletAddress,
      },
      balance: {
        ready: balance.ready,
        chainId: balance.chainId,
        chainMatches: balance.chainMatches,
        balanceWei: balance.balanceWei?.toString() ?? null,
        balanceEth: balance.balanceEth,
        error: balance.error,
      },
      eligibility: walletEligibility,
    });
    balance.refetch();
    setShowPicker(true);
  };

  const onPickWallet = () => {
    // eslint-disable-next-line no-console
    console.log("[picker] user clicked Pay with Wallet", {
      eligible: walletEligibility.ok,
      reason: walletEligibility.reason,
      itemId: item.id,
    });
    if (!walletEligibility.ok) return;
    onBuy(item, "wallet");
  };

  const onPickTransak = () => {
    // eslint-disable-next-line no-console
    console.log("[picker] user clicked Pay with Card (Transak)", {
      itemId: item.id,
      priceEth: item.priceEth,
    });
    onBuy(item, "transak");
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className={`modal ${RARITY_CLASS[item.rarity]}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.name} details`}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="modal-head">
          <img className="modal-image" src={item.image} alt={item.name} />
          <div className="modal-title">
            <h2>{item.name}</h2>
            <div className="modal-meta">
              <span className={`rarity ${RARITY_CLASS[item.rarity]}`}>
                {item.rarity}
              </span>
              <span className="modal-type">{item.weaponType}</span>
              <span className="modal-price">{item.priceEth} ETH</span>
            </div>
            <div className="modal-owned">Owned: {ownedAmount}</div>
          </div>
        </div>

        <p className="flavor">"{item.flavor}"</p>

        <div className="stats">
          <StatBar label="Damage" value={item.stats.damage} />
          <StatBar label="Fire Rate" value={item.stats.fireRate} />
          <StatBar label="Range" value={item.stats.range} />
          <StatBar label="Accuracy" value={item.stats.accuracy} />
        </div>

        <div className="effect">
          <div className="effect-name">{item.effect.name}</div>
          <div className="effect-desc">{item.effect.description}</div>
        </div>

        {purchaseState === "error" && errorMsg && (
          <div className="modal-error">⚠️ {errorMsg}</div>
        )}

        {banner && <div className="modal-banner">{banner}</div>}

        {showPicker ? (
          <PaymentPicker
            priceEth={item.priceEth}
            walletAddress={walletAddress}
            walletBalanceEth={balance.balanceEth}
            walletReady={balance.ready}
            walletEligibility={walletEligibility}
            chainMatches={balance.chainMatches}
            chainNameCurrent={balance.chainNameCurrent}
            chainNameExpected={balance.chainNameExpected}
            chainId={balance.chainId}
            onSwitchChain={balance.switchChain}
            onPickWallet={onPickWallet}
            onPickTransak={onPickTransak}
            onBack={() => setShowPicker(false)}
          />
        ) : (
          <button
            className="modal-cta primary"
            onClick={onPrimaryClick}
            disabled={!wallet || isBusy || purchaseState === "success"}
          >
            {!wallet ? "Connect wallet to buy" : ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

interface PickerProps {
  priceEth: string;
  walletAddress: string | null;
  walletBalanceEth: string | null;
  walletReady: boolean;
  walletEligibility: ReturnType<typeof canPayWithWallet>;
  chainMatches: boolean;
  chainNameCurrent: string;
  chainNameExpected: string;
  chainId: number | null;
  onSwitchChain: () => Promise<
    "switched" | "rejected" | "unsupported" | "not-configured" | "error"
  >;
  onPickWallet: () => void;
  onPickTransak: () => void;
  onBack: () => void;
}

function PaymentPicker({
  priceEth,
  walletAddress,
  walletBalanceEth,
  walletReady,
  walletEligibility,
  chainMatches,
  chainNameCurrent,
  chainNameExpected,
  chainId,
  onSwitchChain,
  onPickWallet,
  onPickTransak,
  onBack,
}: PickerProps) {
  const walletDisabled = !walletEligibility.ok;
  // Only show the switch banner once we actually know what chain the wallet
  // is on (chainId is non-null). On first paint chainId is null and we'd
  // rather show nothing than flash a misleading "switch network" prompt.
  const showSwitchBanner = chainId !== null && !chainMatches;

  const [switching, setSwitching] = useState(false);
  const [switchHint, setSwitchHint] = useState<string | null>(null);
  const handleSwitch = async () => {
    setSwitching(true);
    setSwitchHint(null);
    const outcome = await onSwitchChain();
    setSwitching(false);
    // eslint-disable-next-line no-console
    console.log("[picker] switchChain outcome", { outcome });
    if (outcome === "rejected") {
      setSwitchHint("You declined the network switch.");
    } else if (outcome === "not-configured") {
      setSwitchHint(
        `${chainNameExpected} isn't added to your wallet — add it once, then retry.`,
      );
    } else if (outcome === "unsupported") {
      setSwitchHint(
        "This wallet doesn't support auto-switching networks. Switch manually.",
      );
    } else if (outcome === "error") {
      setSwitchHint("Switch failed. Try again or switch manually.");
    }
  };

  return (
    <div className="payment-picker">
      <div className="payment-picker-head">
        <span>Choose how to pay {priceEth} ETH</span>
        <button className="ghost" onClick={onBack} type="button">
          ← Back
        </button>
      </div>

      {showSwitchBanner && (
        <div className="payment-picker-chain-warn">
          <div>
            Your wallet is on <strong>{chainNameCurrent}</strong>. To pay
            with your wallet, switch to <strong>{chainNameExpected}</strong>.
          </div>
          <button
            type="button"
            className="primary switch-chain-btn"
            onClick={handleSwitch}
            disabled={switching}
          >
            {switching ? "Switching…" : `Switch to ${chainNameExpected}`}
          </button>
          {switchHint && <div className="switch-chain-hint">{switchHint}</div>}
        </div>
      )}

      <div className="payment-options">
        <button
          type="button"
          className={`payment-option ${walletDisabled ? "disabled" : ""}`}
          onClick={onPickWallet}
          disabled={walletDisabled}
          title={walletEligibility.reason}
        >
          <div className="payment-option-title">Pay with Wallet</div>
          <div className="payment-option-sub">
            {walletAddress ? truncateAddress(walletAddress) : "Not connected"}
          </div>
          <div className="payment-option-meta">
            {!walletReady
              ? "Checking balance…"
              : walletBalanceEth !== null
                ? `Balance: ${formatEthShort(walletBalanceEth)} ETH`
                : "Balance unavailable"}
          </div>
          {walletDisabled && walletEligibility.reason && (
            <div className="payment-option-warn">
              {walletEligibility.reason}
            </div>
          )}
        </button>

        <button
          type="button"
          className="payment-option"
          onClick={onPickTransak}
        >
          <div className="payment-option-title">Pay with Card</div>
          <div className="payment-option-sub">Powered by Transak</div>
          <div className="payment-option-meta">
            Fiat / debit / credit — KYC may apply
          </div>
        </button>
      </div>
    </div>
  );
}
