import { AppKit } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import type { SwapParams } from "@circle-fin/app-kit";
import { appendLedger } from "./store";

// Treasury FX rebalancing via Circle Swap — among all testnets this only
// exists on Arc Testnet (USDC/EURC/cirBTC).

export type FxResult = {
  outcome: "SWAPPED" | "ERROR";
  reason?: string;
  amountIn?: string;
  amountOut?: string;
  txHash?: string;
};

function params(amountUsdc: number): SwapParams {
  const adapter = createCircleWalletsAdapter({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });
  return {
    from: {
      adapter,
      chain: "Arc_Testnet",
      address: process.env.ORCH_ADDRESS!,
    },
    tokenIn: "USDC",
    tokenOut: "EURC",
    amountIn: amountUsdc.toFixed(2),
    config: {
      kitKey: process.env.KIT_KEY as string,
    },
  } as SwapParams;
}

export async function fxRebalance(amountUsdc: number): Promise<FxResult> {
  const kit = new AppKit();
  try {
    const result: any = await kit.swap(params(amountUsdc));
    const amountOut = String(
      result?.amountOut ?? result?.quote?.amountOut ?? result?.estimate?.amountOut ?? "?",
    );
    const txHash = String(result?.txHash ?? result?.transactionHash ?? result?.hash ?? "");
    appendLedger({
      ts: new Date().toISOString(),
      type: "fx swap",
      detail: `treasury rebalance · ${amountUsdc.toFixed(2)} USDC → ${amountOut} EURC · Swap (Arc Testnet exclusive)`,
      amount: `-${amountUsdc.toFixed(6)}`,
      status: "CONFIRMED",
    });
    return { outcome: "SWAPPED", amountIn: amountUsdc.toFixed(2), amountOut, txHash };
  } catch (e) {
    return { outcome: "ERROR", reason: String(e).slice(0, 300) };
  }
}
