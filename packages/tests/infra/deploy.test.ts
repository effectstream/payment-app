import { assert } from "../helpers.ts";
import { contractAddressesEvmMain } from "@payment-app/contracts-evm";

export async function deployTest() {
  await assert("PaymentEffectstreamL2 deployed with valid address", async () => {
    const addrs = contractAddressesEvmMain();
    const addr = addrs.chain31337?.["EffectstreamL2Module#PaymentEffectstreamL2"];
    return (
      typeof addr === "string" && addr.startsWith("0x") && addr.length === 42
    );
  });
}
