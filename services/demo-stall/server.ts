// Ovolyn demo stall — a minimal x402-paid API on Arc Testnet.
// Any agent (including Ovolyn's own) can buy from this endpoint with USDC
// nanopayments settled through Circle Gateway.
import express from "express";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { formatUnits } from "viem";

type PaidRequest = express.Request & {
  payment?: {
    verified: boolean;
    payer: string;
    amount: string;
    network: string;
    transaction?: string;
  };
};

const SELLER_ADDRESS = process.env.SELLER_ADDRESS ?? "0xec831132b305310837f921ec7656b55356a36c98";
const PORT = Number(process.env.PORT ?? 4021);

const app = express();

const gateway = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  facilitatorUrl: "https://gateway-api-testnet.circle.com",
});

app.get("/oracle", gateway.require("$0.001"), (req: PaidRequest, res) => {
  const { payer, amount, network } = req.payment!;
  console.log(`[stall] paid ${formatUnits(BigInt(amount), 6)} USDC by ${payer} on ${network}`);
  res.json({
    service: "ovolyn-demo-stall",
    insight: "USDC-native gas means an agent treasury never holds a volatile token.",
    paid_by: payer,
    network,
  });
});

app.listen(PORT, () => {
  console.log(`[stall] listening at http://localhost:${PORT} — seller ${SELLER_ADDRESS}`);
});
