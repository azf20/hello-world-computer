import { PrivyClient } from "@privy-io/server-auth";
import { createViemAccount } from "@privy-io/server-auth/viem";
import { ViemWalletProvider } from "@coinbase/agentkit";
import { createWalletClient, http, WalletClient } from "viem";
import canonicalize from "canonicalize"; // Support JSON canonicalization

import * as chains from "viem/chains";
import crypto from "crypto";

/**
 * Get a chain from the viem chains object
 *
 * @param id - The chain ID
 * @returns The chain
 */
function getChain(id: number) {
  const chainList = Object.values(chains);
  return chainList.find((chain) => chain.id === id);
}

/**
 * Configuration options for the Privy wallet provider.
 *
 * @interface
 */
interface PrivyWalletConfig {
  /** The Privy application ID */
  appId: string;
  /** The Privy application secret */
  appSecret: string;
  /** The ID of the wallet to use */
  walletId?: string;
  /** Optional network ID to connect to */
  chainId?: number;
  /** Optional authorization key for the wallet API */
  authorizationPrivateKey?: string;
}

/**
 * Register an authorization key with Privy
 *
 * @param privy - The Privy client
 * @param publicKey - The public key to register
 * @param displayName - The display name for the authorization key
 * @returns The ID of the authorization key
 */
async function registerAuthorizationKey(
  privy: PrivyWalletConfig,
  publicKey: string,
  displayName?: string
): Promise<string> {
  const body = {
    public_key: publicKey,
  };
  const url = "https://auth.privy.io/api/v1/authorization_keys";
  const signature = getAuthorizationSignature({
    url,
    body,
    privyWalletConfig: privy,
  });
  console.log("Body", body, signature);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(
        `${privy.appId}:${privy.appSecret}`
      ).toString("base64")}`,
      "privy-app-id": privy.appId,
      "privy-authorization-signature": signature,
    },
    body: JSON.stringify(body),
  });
  console.log("Response", response);
  if (!response.ok) {
    throw new Error(
      `Failed to register authorization key: ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.id;
}

function generatePrivateKey(privyWalletConfig: PrivyWalletConfig) {
  if (!privyWalletConfig.authorizationPrivateKey) {
    throw new Error("Authorization private key is not set");
  }
  // Replace this with your app's authorization key. We remove the 'wallet-auth:' prefix
  // from the key before using it to sign requests
  const privateKeyAsString = privyWalletConfig.authorizationPrivateKey.replace(
    "wallet-auth:",
    ""
  );

  // Convert your private key to PEM format, and instantiate a node crypto KeyObject for it
  const privateKeyAsPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyAsString}\n-----END PRIVATE KEY-----`;
  const privateKey = crypto.createPrivateKey({
    key: privateKeyAsPem,
    format: "pem",
  });
  return privateKey;
}

function getAuthorizationSignature({
  url,
  body,
  privyWalletConfig,
}: {
  url: string;
  body: object;
  privyWalletConfig: PrivyWalletConfig;
}) {
  if (!privyWalletConfig.authorizationPrivateKey) {
    throw new Error("Authorization private key is not set");
  }
  const payload = {
    version: 1,
    method: "POST",
    url,
    body,
    headers: {
      "privy-app-id": privyWalletConfig.appId,
      // If your request includes an idempotency key, include that header here as well
    },
  };

  // JSON-canonicalize the payload and convert it to a buffer
  const serializedPayload = canonicalize(payload) as string;
  const serializedPayloadBuffer = Buffer.from(serializedPayload);

  const privateKey = generatePrivateKey(privyWalletConfig);

  // Sign the payload buffer with your private key and serialize the signature to a base64 string
  const signatureBuffer = crypto.sign(
    "sha256",
    serializedPayloadBuffer,
    privateKey
  );
  const signature = signatureBuffer.toString("base64");
  return signature;
}

/**
 * A wallet provider that uses Privy's server wallet API.
 * This provider extends the ViemWalletProvider to provide Privy-specific wallet functionality
 * while maintaining compatibility with the base wallet provider interface.
 */
export class PrivyWalletProvider extends ViemWalletProvider {
  #walletId: string;
  #authorizationPrivateKey: string | undefined;

  /**
   * Private constructor to enforce use of factory method.
   *
   * @param walletClient - The Viem wallet client instance
   * @param config - The configuration options for the Privy wallet
   */
  private constructor(
    walletClient: WalletClient,
    config: PrivyWalletConfig & { walletId: string } // Require walletId in constructor
  ) {
    super(walletClient);
    this.#walletId = config.walletId; // Now guaranteed to exist
    this.#authorizationPrivateKey = config.authorizationPrivateKey;
  }

  /**
   * Creates and configures a new PrivyWalletProvider instance.
   *
   * @param config - The configuration options for the Privy wallet
   * @returns A configured PrivyWalletProvider instance
   *
   * @example
   * ```typescript
   * const provider = await PrivyWalletProvider.configureWithWallet({
   *   appId: "your-app-id",
   *   appSecret: "your-app-secret",
   *   walletId: "wallet-id",
   *   networkId: "base-sepolia"
   * });
   * ```
   */
  public static async configureWithWallet(
    config: PrivyWalletConfig
  ): Promise<PrivyWalletProvider> {
    const privy = new PrivyClient(config.appId, config.appSecret, {
      walletApi: config.authorizationPrivateKey
        ? {
            authorizationPrivateKey: config.authorizationPrivateKey,
          }
        : undefined,
    });

    let walletId: string;
    let address: `0x${string}`;

    if (!config.walletId) {
      // Only register key if creating new wallet and key is provided
      if (config.authorizationPrivateKey) {
        const privateKey = generatePrivateKey(config);
        const publicKey = crypto
          .createPublicKey(privateKey)
          .export({ type: "spki", format: "pem" })
          .toString();

        const keyId = await registerAuthorizationKey(config, publicKey);
        console.log("Registered authorization key");
        const wallet = await privy.walletApi.create({
          chainType: "ethereum",
          authorizationKeyIds: keyId ? [keyId] : undefined,
        });
        walletId = wallet.id;
        address = wallet.address as `0x${string}`;
      }
    } else {
      walletId = config.walletId;
      const wallet = await privy.walletApi.getWallet({ id: walletId });
      if (!wallet) {
        throw new Error(`Wallet with ID ${walletId} not found`);
      }
      address = wallet.address as `0x${string}`;
    }

    const account = await createViemAccount({
      walletId,
      address,
      privy,
    });

    const network = {
      protocolFamily: "evm" as const,
      chainId: config.chainId || 84532,
    };

    const chain = getChain(network.chainId);
    if (!chain) {
      throw new Error(`Chain with ID ${network.chainId} not found`);
    }

    const walletClient = createWalletClient({
      account,
      chain,
      transport: http(),
    });
    return new PrivyWalletProvider(walletClient, { ...config, walletId });
  }

  /**
   * Gets the name of the wallet provider.
   *
   * @returns The string identifier for this wallet provider
   */
  getName(): string {
    return "privy_wallet_provider";
  }

  /**
   * Exports the wallet data.
   *
   * @returns The wallet data
   */
  exportWallet(): {
    walletId: string;
    authorizationPrivateKey: string | undefined;
    networkId?: string;
  } {
    return {
      walletId: this.#walletId,
      authorizationPrivateKey: this.#authorizationPrivateKey,
      networkId: this.getNetwork().networkId,
    };
  }
}
