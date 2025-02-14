import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { WalletProvider, Network } from "@coinbase/agentkit";
import {
  WalletClient as ViemWalletClient,
  createPublicClient,
  http,
  TransactionRequest,
  PublicClient as ViemPublicClient,
  ReadContractParameters,
  ReadContractReturnType,
  parseEther,
  createWalletClient,
} from "viem";
import { CHAIN_ID_TO_NETWORK_ID, NETWORK_ID_TO_VIEM_CHAIN } from "./network";

interface PrivyWalletConfig {
  appId: string;
  appSecret: string;
  walletId: string;
  networkId?: string;
  authorizationKey?: string;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 */
export class PrivyWalletProvider extends WalletProvider {
  #walletClient: ViemWalletClient;
  #publicClient: ViemPublicClient;

  /**
   * Constructs a new ViemWalletProvider.
   *
   * @param walletClient - The wallet client.
   */
  constructor(walletClient: ViemWalletClient) {
    super();
    this.#walletClient = walletClient;
    this.#publicClient = createPublicClient({
      chain: walletClient.chain,
      transport: http(),
    });
  }


  public static async configureWithWallet(
    config: PrivyWalletConfig
  ): Promise<PrivyWalletProvider> {
    const privy = new PrivyClient(config.appId, config.appSecret, {
      walletApi: config.authorizationKey
        ? {
            authorizationPrivateKey: config.authorizationKey,
          }
        : undefined,
    });

    // Get wallet details to get the address
    const wallet = await privy.walletApi.getWallet({ id: config.walletId });

    const account = await createViemAccount({
      walletId: config.walletId,
      address: wallet.address as `0x${string}`,
      privy,
    });

    const network = {
      protocolFamily: "evm" as const,
      networkId: config.networkId || "84532",
      chainId: "84532",
    };

    const chain = NETWORK_ID_TO_VIEM_CHAIN[network.networkId];
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
    return new PrivyWalletProvider(walletClient);
  }

  getName(): string {
    return "privy_wallet_provider";
  }

  /**
   * Signs a message.
   *
   * @param message - The message to sign.
   * @returns The signed message.
   */
  async signMessage(message: string | { raw: `0x${string}` }): Promise<`0x${string}`> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    return this.#walletClient.signMessage({ account, message });
  }

  /**
   * Signs a typed data object.
   *
   * @param typedData - The typed data object to sign.
   * @returns The signed typed data object.
   */
  async signTypedData(typedData: any): Promise<`0x${string}`> {
    return this.#walletClient.signTypedData({
      account: this.#walletClient.account!,
      domain: typedData.domain!,
      types: typedData.types!,
      primaryType: typedData.primaryType!,
      message: typedData.message!,
    });
  }

  /**
   * Signs a transaction.
   *
   * @param transaction - The transaction to sign.
   * @returns The signed transaction.
   */
  async signTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const txParams = {
      account: this.#walletClient.account!,
      to: transaction.to,
      value: transaction.value,
      data: transaction.data,
      chain: this.#walletClient.chain,
    };

    return this.#walletClient.signTransaction(txParams);
  }

  /**
   * Sends a transaction.
   *
   * @param transaction - The transaction to send.
   * @returns The hash of the transaction.
   */
  async sendTransaction(transaction: TransactionRequest): Promise<`0x${string}`> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    const chain = this.#walletClient.chain;
    if (!chain) {
      throw new Error("Chain not found");
    }

    const txParams = {
      account: account,
      chain: chain,
      data: transaction.data,
      to: transaction.to,
      value: transaction.value,
    };

    return this.#walletClient.sendTransaction(txParams);
  }

  /**
   * Gets the address of the wallet.
   *
   * @returns The address of the wallet.
   */
  getAddress(): string {
    return this.#walletClient.account?.address ?? "";
  }

  /**
   * Gets the network of the wallet.
   *
   * @returns The network of the wallet.
   */
  getNetwork(): Network {
    return {
      protocolFamily: "evm" as const,
      chainId: String(this.#walletClient.chain!.id!),
      networkId: CHAIN_ID_TO_NETWORK_ID[this.#walletClient.chain!.id!],
    };
  }

  /**
   * Gets the balance of the wallet.
   *
   * @returns The balance of the wallet.
   */
  async getBalance(): Promise<bigint> {
    const account = this.#walletClient.account;
    if (!account) {
      throw new Error("Account not found");
    }

    return this.#publicClient.getBalance({ address: account.address });
  }

  /**
   * Waits for a transaction receipt.
   *
   * @param txHash - The hash of the transaction to wait for.
   * @returns The transaction receipt.
   */
  async waitForTransactionReceipt(txHash: `0x${string}`): Promise<any> {
    return await this.#publicClient.waitForTransactionReceipt({ hash: txHash });
  }

  /**
   * Reads a contract.
   *
   * @param params - The parameters to read the contract.
   * @returns The response from the contract.
   */
  async readContract(params: ReadContractParameters): Promise<ReadContractReturnType> {
    return this.#publicClient.readContract(params);
  }

  /**
   * Transfer the native asset of the network.
   *
   * @param to - The destination address.
   * @param value - The amount to transfer in whole units (e.g. ETH)
   * @returns The transaction hash.
   */
  async nativeTransfer(to: `0x${string}`, value: string): Promise<`0x${string}`> {
    const atomicAmount = parseEther(value);

    const tx = await this.sendTransaction({
      to: to,
      value: atomicAmount,
    });

    const receipt = await this.waitForTransactionReceipt(tx);

    if (!receipt) {
      throw new Error("Transaction failed");
    }

    return receipt.transactionHash;
  }
}
