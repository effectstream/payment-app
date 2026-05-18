import { useEffect, useState } from "react";
import {
  createPublicClient,
  custom,
  formatEther,
  http,
  parseEther,
} from "viem";
import type { Wallet } from "@effectstream/wallets";
import { CHAIN_ID, EVM_RPC_URL } from "../config.ts";

/**
 * Small gas-cost buffer added on top of the item price when checking whether
 * the connected wallet has enough Sepolia ETH to cover a direct-wallet
 * purchase. We deliberately underestimate — MetaMask is the final authority
 * on whether the tx fits; this buffer only exists so we don't enable the
 * "Pay with Wallet" button on a wallet with priceEth exactly and zero room.
 */
export const GAS_BUFFER_ETH = "0.0005";

/** Minimal EIP-1193 surface we care about. */
interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
}

/** Friendly names for the chains we care about. */
const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  31337: "Hardhat (localhost)",
  11155111: "Sepolia",
  421614: "Arbitrum Sepolia",
  10: "Optimism",
  8453: "Base",
};

export function chainName(chainId: number | null): string {
  if (chainId === null) return "unknown";
  return CHAIN_NAMES[chainId] ?? `chain ${chainId}`;
}

export interface WalletBalanceState {
  /** Balance in wei. `null` while loading or if read failed. */
  balanceWei: bigint | null;
  /** Pretty-formatted ETH balance, e.g. "0.0421". `null` if not loaded. */
  balanceEth: string | null;
  /** Chain id the wallet is currently on, decoded from eth_chainId. */
  chainId: number | null;
  /** Friendly name for `chainId`, e.g. "Sepolia". */
  chainNameCurrent: string;
  /** Friendly name for our configured `CHAIN_ID`. */
  chainNameExpected: string;
  /** True only when chain matches our configured CHAIN_ID. */
  chainMatches: boolean;
  /** True once we have a balance reading (success or failure). */
  ready: boolean;
  /** Most recent error during balance read, surfaced for debugging. */
  error: string | null;
  /** Forces a re-fetch (e.g. when the picker opens). */
  refetch: () => void;
  /**
   * Triggers MetaMask's `wallet_switchEthereumChain` prompt for the
   * expected chain. Resolves once the user confirms or rejects; the
   * chain-id refresh happens via the provider's `chainChanged` event so
   * the caller doesn't need to refetch manually. Returns the outcome:
   *   - `switched`: user accepted, wallet is now on the expected chain
   *   - `rejected`: user clicked Cancel in MetaMask
   *   - `unsupported`: provider doesn't implement wallet_switchEthereumChain
   *   - `not-configured`: chain isn't added to the wallet (would need
   *      wallet_addEthereumChain to register it first)
   *   - `error`: anything else; the message lives in the `error` field
   */
  switchChain: () => Promise<
    "switched" | "rejected" | "unsupported" | "not-configured" | "error"
  >;
}

/**
 * Pull the EIP-1193 provider for the wallet the user actually connected to.
 *
 * `@effectstream/wallets` uses EIP-6963 multi-wallet discovery, so the active
 * provider for the user's chosen wallet lives on `wallet.provider`. Reading
 * `window.ethereum` instead would silently target whichever extension won
 * the legacy injection race when several wallets are installed — that can be
 * a different wallet than the one the user selected through our login UI.
 */
function extractEip1193Provider(wallet: Wallet | null): EIP1193Provider | null {
  if (!wallet) return null;
  const api = wallet.provider.getConnection().api as unknown;
  if (api && typeof api === "object" && "request" in api) {
    return api as EIP1193Provider;
  }
  return null;
}

/**
 * Single-source log helper so all balance-related console output is easy to
 * grep / filter in DevTools. Prefix is intentionally noisy.
 */
function blog(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log("[wallet-balance]", ...args);
}

/**
 * Reads the connected wallet's native-token balance for our configured
 * chain, plus the chain the wallet is currently set to.
 *
 * ## Why we use two different RPC sources
 *
 * **Balance** is read from `EVM_RPC_URL` (a dedicated HTTP RPC the dapp
 * controls — Alchemy / Infura / publicnode, configured via
 * `VITE_EVM_RPC_URL`). MetaMask's bundled Sepolia endpoint is on a shared
 * Infura allotment that gets globally rate-limited and returns -32002
 * errors for everyone hitting it that minute — including for cheap reads
 * like `eth_getBalance`. Routing through our own RPC sidesteps that.
 *
 * Reading balance from a fixed-chain RPC is also more correct
 * semantically: the question the picker is answering is "does this
 * address have enough Sepolia ETH to cover the purchase?". That's a
 * function of (chain, address), not "whichever chain MetaMask happens to
 * be displaying right now."
 *
 * **Chain id** is read from the wallet's own EIP-1193 provider
 * (`wallet.provider.getConnection().api` — note: NOT `window.ethereum`,
 * which targets whoever won the legacy injection race with multiple
 * wallets installed; `@effectstream/wallets` uses EIP-6963 multi-wallet
 * discovery). MetaMask answers `eth_chainId` locally from its own state
 * without hitting any RPC, so this read is always fast and free.
 *
 * Combined, the hook surfaces:
 *   - `balanceEth` / `balanceWei`: the address's balance on OUR chain.
 *   - `chainId` / `chainMatches`: what chain the WALLET is on. Drives
 *     the "switch network in MetaMask" warning in the picker.
 */
export function useWalletBalance(wallet: Wallet | null): WalletBalanceState {
  const [balanceWei, setBalanceWei] = useState<bigint | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const address = wallet?.walletAddress ?? null;
  const provider = extractEip1193Provider(wallet);

  // Re-fetch when the wallet's chain or account changes (e.g. user switches
  // network in MetaMask while the picker is open). We listen on the wallet's
  // own provider, not window.ethereum, so multi-wallet users get the right
  // signal.
  useEffect(() => {
    if (!provider?.on || !provider.removeListener) {
      blog(
        "skipping chain/account listener registration — provider missing or " +
          "does not expose on/removeListener",
        { hasProvider: !!provider, hasOn: !!provider?.on },
      );
      return;
    }
    const onChain = (...a: unknown[]) => {
      blog("chainChanged event — triggering refetch", { args: a });
      setNonce((n) => n + 1);
    };
    const onAccounts = (...a: unknown[]) => {
      blog("accountsChanged event — triggering refetch", { args: a });
      setNonce((n) => n + 1);
    };
    provider.on("chainChanged", onChain);
    provider.on("accountsChanged", onAccounts);
    blog("registered chainChanged + accountsChanged listeners on provider");
    return () => {
      provider.removeListener?.("chainChanged", onChain);
      provider.removeListener?.("accountsChanged", onAccounts);
      blog("removed chainChanged + accountsChanged listeners on provider");
    };
  }, [provider]);

  useEffect(() => {
    if (!address || !provider) {
      blog("fetch skipped — no address or provider", {
        address,
        hasProvider: !!provider,
      });
      setBalanceWei(null);
      setChainId(null);
      setReady(false);
      return;
    }
    let cancelled = false;
    const walletName = wallet?.metadata?.name;
    const walletDisplayName = wallet?.metadata?.displayName;
    blog("fetch starting", {
      walletName,
      walletDisplayName,
      address,
      expectedChainId: CHAIN_ID,
      balanceRpcUrl: EVM_RPC_URL,
      nonce,
    });
    (async () => {
      // Two clients, two RPC sources — see notes in this file's docblock.
      //   balance → http(EVM_RPC_URL): a dedicated RPC the dapp controls,
      //     so MetaMask's shared/rate-limited Infura allotment doesn't gate
      //     us. Authoritative balance for the address on OUR chain.
      //   chain id → custom(provider): MetaMask answers eth_chainId locally
      //     from its own state without touching any RPC, so this is always
      //     fast and never rate-limited. We use it only to detect when the
      //     wallet is pointed at a different network than we expect.
      const balanceClient = createPublicClient({
        transport: http(EVM_RPC_URL),
      });
      const chainClient = createPublicClient({
        transport: custom(provider),
      });

      const [balResult, cidResult] = await Promise.allSettled([
        balanceClient.getBalance({ address: address as `0x${string}` }),
        chainClient.getChainId(),
      ]);

      if (cancelled) {
        blog("fetch resolved but cancelled (stale) — discarding result");
        return;
      }

      // Chain id first — even if balance failed we still want to know what
      // network the wallet is on.
      if (cidResult.status === "fulfilled") {
        setChainId(cidResult.value);
      } else {
        const msg =
          cidResult.reason instanceof Error
            ? cidResult.reason.message
            : String(cidResult.reason);
        blog("chain id read failed (using wallet provider)", { error: msg });
        setChainId(null);
      }

      if (balResult.status === "fulfilled") {
        blog("fetch succeeded", {
          walletName,
          address,
          chainId:
            cidResult.status === "fulfilled" ? cidResult.value : "(unknown)",
          chainMatches:
            cidResult.status === "fulfilled" && cidResult.value === CHAIN_ID,
          balanceWei: balResult.value.toString(),
          balanceEth: formatEther(balResult.value),
          balanceRpcUrl: EVM_RPC_URL,
        });
        setBalanceWei(balResult.value);
        setError(null);
      } else {
        const err = balResult.reason;
        const message = err instanceof Error ? err.message : String(err);
        blog("balance read failed (using EVM_RPC_URL)", {
          walletName,
          address,
          balanceRpcUrl: EVM_RPC_URL,
          error: message,
          err,
        });
        setBalanceWei(null);
        setError(message);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [address, provider, nonce, wallet]);

  const switchChain = async () => {
    if (!provider) {
      blog("switchChain skipped — no provider");
      return "unsupported" as const;
    }
    const hex = `0x${CHAIN_ID.toString(16)}`;
    blog("switchChain requested", {
      from: chainId,
      to: CHAIN_ID,
      toHex: hex,
    });
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: hex }],
      });
      blog("switchChain accepted by user");
      // The chainChanged listener will refetch automatically.
      return "switched" as const;
    } catch (err) {
      // MetaMask error codes: 4001 = user rejected, 4902 = chain not added.
      // Other wallets may use different shapes; we sniff for both.
      const code = (err as { code?: number } | null)?.code;
      const message = err instanceof Error ? err.message : String(err);
      if (code === 4001) {
        blog("switchChain rejected by user");
        return "rejected" as const;
      }
      if (
        code === 4902 ||
        /unrecognized chain id|chain not configured/i.test(message)
      ) {
        blog("switchChain failed — chain not added to wallet", {
          code,
          message,
        });
        return "not-configured" as const;
      }
      if (
        /not.*supported|wallet_switchEthereumChain.*not/i.test(message)
      ) {
        blog("switchChain unsupported by this provider", { code, message });
        return "unsupported" as const;
      }
      blog("switchChain errored", { code, message, err });
      setError(message);
      return "error" as const;
    }
  };

  return {
    balanceWei,
    balanceEth: balanceWei !== null ? formatEther(balanceWei) : null,
    chainId,
    chainNameCurrent: chainName(chainId),
    chainNameExpected: chainName(CHAIN_ID),
    chainMatches: chainId !== null && chainId === CHAIN_ID,
    ready,
    error,
    refetch: () => setNonce((n) => n + 1),
    switchChain,
  };
}

/**
 * Decision helper: can the wallet path be offered for this price?
 * Returns a reason string when it can't (which the picker shows as tooltip).
 */
export function canPayWithWallet(
  state: WalletBalanceState,
  priceEth: string,
): { ok: boolean; reason?: string } {
  if (!state.ready) return { ok: false, reason: "Checking balance…" };
  if (state.balanceWei === null) {
    return { ok: false, reason: "Couldn't read wallet balance" };
  }
  if (!state.chainMatches) {
    return {
      ok: false,
      reason: state.chainId === null
        ? `Wrong network — switch your wallet to ${state.chainNameExpected}`
        : `Wallet on ${state.chainNameCurrent}; this dapp expects ${state.chainNameExpected}`,
    };
  }
  const needed = parseEther(priceEth) + parseEther(GAS_BUFFER_ETH);
  if (state.balanceWei < needed) {
    return {
      ok: false,
      reason: `Insufficient balance (need ~${priceEth} ETH + gas, have ${state.balanceEth} ETH)`,
    };
  }
  return { ok: true };
}
