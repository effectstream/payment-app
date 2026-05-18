import { runPreparedQuery } from "@effectstream/db";
import { getItemsByWallet } from "@payment-app/database";
import type { Pool } from "pg";
import type { StartConfigApiRouter } from "@effectstream/runtime";
import type { FastifyInstance } from "fastify";
import { encodeFunctionData, toHex } from "viem";

const effectstreamL2Abi = [
  {
    name: "effectstreamSubmitGameInput",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "data", type: "bytes" }],
    outputs: [],
  },
] as const;

// In-memory cache for Transak's 7-day access token. Refreshed when expired
// or within 5 minutes of expiry.
let cachedAccessToken: { token: string; expiresAt: number } | null = null;

async function getTransakAccessToken(
  apiKey: string,
  apiSecret: string,
  environment: string,
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.expiresAt > nowSec + 300) {
    return cachedAccessToken.token;
  }
  const url = environment === "PRODUCTION"
    ? "https://api.transak.com/partners/api/v2/refresh-token"
    : "https://api-stg.transak.com/partners/api/v2/refresh-token";
  const r = await fetch(url, {
    method: "POST",
    headers: { "api-secret": apiSecret, "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`refresh-token failed: ${r.status} ${body}`);
  }
  const j = (await r.json()) as {
    data: { accessToken: string; expiresAt: number };
  };
  cachedAccessToken = { token: j.data.accessToken, expiresAt: j.data.expiresAt };
  return j.data.accessToken;
}

export const apiRouter: StartConfigApiRouter = async function (
  server: FastifyInstance,
  dbConn: Pool,
): Promise<void> {
  server.get<{ Querystring: { wallet?: string } }>(
    "/api/items",
    async (request, reply) => {
      const wallet = request.query.wallet?.toLowerCase();
      if (!wallet) {
        reply.status(400).send({ error: "missing required query param: wallet" });
        return;
      }
      const items = await runPreparedQuery(
        getItemsByWallet.run({ wallet }, dbConn),
        "/api/items",
      );
      reply.send({ wallet, items });
    },
  );

  server.get("/api/health", async (_request, reply) => {
    reply.send({ ok: true });
  });

  // Transak Secure Widget URL proxy. Transak now requires the widgetUrl to be
  // created server-side via their session API using api-secret — the frontend
  // can no longer build the URL directly. See:
  //   https://docs.transak.com/api/public/create-widget-url
  server.post<{
    Body: { itemId: number; priceEth: string; name: string; imageURL?: string };
  }>("/api/transak/widget-url", async (request, reply) => {
    const { itemId, priceEth, name, imageURL } = request.body ?? {};
    if (
      typeof itemId !== "number" ||
      typeof priceEth !== "string" ||
      typeof name !== "string"
    ) {
      reply.status(400).send({
        error: "body must include { itemId: number, priceEth: string, name: string }",
      });
      return;
    }

    const apiKey = process.env.TRANSAK_API_KEY;
    const apiSecret = process.env.TRANSAK_API_SECRET;
    const contractId = process.env.TRANSAK_CONTRACT_ID;
    const contractAddress = process.env.EFFECTSTREAM_L2_ADDRESS;
    const network = process.env.TRANSAK_NETWORK ?? "sepolia";
    const environment = process.env.TRANSAK_ENVIRONMENT ?? "STAGING";

    const missing: string[] = [];
    if (!apiKey) missing.push("TRANSAK_API_KEY");
    if (!apiSecret) missing.push("TRANSAK_API_SECRET");
    if (!contractId) missing.push("TRANSAK_CONTRACT_ID");
    if (!contractAddress) missing.push("EFFECTSTREAM_L2_ADDRESS");
    if (missing.length) {
      reply.status(500).send({
        error: "server-side Transak config missing",
        missing,
      });
      return;
    }

    const referrerDomain =
      (request.headers.origin as string | undefined) ??
      (request.headers.referer as string | undefined) ??
      "";

    let accessToken: string;
    try {
      accessToken = await getTransakAccessToken(apiKey!, apiSecret!, environment);
    } catch (err) {
      reply.status(502).send({
        error: "failed to obtain Transak access token",
        detail: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const calldata = encodeFunctionData({
      abi: effectstreamL2Abi,
      functionName: "effectstreamSubmitGameInput",
      args: [toHex(JSON.stringify(["purchaseItem", itemId, 1]))],
    });

    const nftData = [
      {
        imageURL: imageURL ?? `${referrerDomain}/items/${itemId}.svg`,
        nftName: name,
        collectionAddress: contractAddress!,
        tokenID: [String(itemId)],
        price: [Number(priceEth)],
        quantity: 1,
        nftType: "ERC1155",
      },
    ];

    const sessionUrl = environment === "PRODUCTION"
      ? "https://api-gateway.transak.com/api/v2/auth/session"
      : "https://api-gateway-stg.transak.com/api/v2/auth/session";

    const transakRes = await fetch(sessionUrl, {
      method: "POST",
      headers: {
        "access-token": accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        widgetParams: {
          apiKey,
          referrerDomain,
          cryptoCurrencyCode: "ETH",
          defaultCryptoAmount: Number(priceEth),
          network,
          isNFT: true,
          contractId,
          nftData,
          smartContractAddress: contractAddress,
          estimatedGasLimit: 200_000,
          calldata,
          isFeeCalculationHidden: true,
        },
      }),
    });

    if (!transakRes.ok) {
      const body = await transakRes.text();
      reply.status(502).send({
        error: "Transak session creation failed",
        status: transakRes.status,
        body,
      });
      return;
    }

    const transakJson = (await transakRes.json()) as {
      data: { widgetUrl: string };
    };
    reply.send({ widgetUrl: transakJson.data.widgetUrl });
  });
};
