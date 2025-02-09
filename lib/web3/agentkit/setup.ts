import { PrivyWalletProvider } from "./wallet-providers/privyWalletProvider";
import {
  AgentKit,
  pythActionProvider,
  walletActionProvider,
} from "@coinbase/agentkit";
import { erc20ActionProvider } from "./action-providers/erc20";
import { safeActionProvider } from "./action-providers/safe";
import { alchemyActionProvider } from "./action-providers/alchemy";
import { zoraActionProvider } from "./action-providers/zora";
import { basenameActionProvider } from "./action-providers/basename";

export const setupAgentKit = async () => {
  const activeChain =
    process.env.NEXT_PUBLIC_ACTIVE_CHAIN === "base"
      ? "base-mainnet"
      : "base-sepolia";

  const walletProvider = await PrivyWalletProvider.configureWithWallet({
    appId: process.env.PRIVY_APP_ID as string,
    appSecret: process.env.PRIVY_APP_SECRET as string,
    networkId: activeChain,
    walletId: process.env.PRIVY_WALLET_ID as string,
    authorizationKey: process.env.PRIVY_WALLET_AUTHORIZATION_KEY as string,
  });

  return AgentKit.from({
    walletProvider,
    actionProviders: [
      pythActionProvider(),
      walletActionProvider(),
      erc20ActionProvider(),
      safeActionProvider(),
      basenameActionProvider(),
      alchemyActionProvider(process.env.ALCHEMY_API_KEY as string),
      zoraActionProvider(),
    ],
  });
};
