import { ActionProvider, CreateAction, EvmWalletProvider, Network } from '@coinbase/agentkit';
import Safe, {
    EthSafeTransaction,
    OnchainAnalyticsProps,
    PredictedSafeProps,
    SafeAccountConfig,
    SigningMethod
} from '@safe-global/protocol-kit'
import { waitForTransactionReceipt } from 'viem/actions'
import { baseSepolia, base } from 'viem/chains'
import { CreateSafeSchema, CreateSafeTransactionSchema, ExecuteSafeTransactionSchema, SignSafeTransactionSchema } from './schemas';
import { z } from 'zod';
import { saveSafeTransaction, getSafeTransactionByHash } from '@/lib/db/queries';
import { SafeTransaction } from '@safe-global/types-kit';
import { adjustVInSignature, EthSafeSignature } from '@safe-global/protocol-kit/dist/src/utils';
import { PrivyWalletProvider } from '../../wallet-providers/privyWalletProvider';

const onchainAnalytics: OnchainAnalyticsProps = {
    project: 'HELLO_WORLD_COMPUTER', // Required. Always use the same value for your project.
    platform: 'WEB' // Optional
};

export class SafeActionProvider extends ActionProvider {
    constructor() {
        super("safe", []);
    }

    /**
     * Creates a safe on the network.
     *
     * @param walletProvider - The wallet provider to create the safe from.
     * @param args - The input arguments for the action.
     * @returns A message containing the safe address.
     */
    @CreateAction({
        name: "create_safe",
        description: `
      This tool will create a multisig safe wallet on the network. 
      It takes the following inputs, both are addresses:
        - owners: The addresses of the owners of the safe
        - threshold: The number of owners required to sign a transaction
      `,
        schema: CreateSafeSchema,
    })
    async createSafe(
        walletProvider: EvmWalletProvider,
        args: z.infer<typeof CreateSafeSchema>
    ): Promise<CreateSafeReturnType> {
        try {
            const chain = process.env.NEXT_PUBLIC_ACTIVE_CHAIN === "base" ? base : baseSepolia;
            const safeAccountConfig: SafeAccountConfig = {
                owners: args.owners,
                threshold: args.threshold
                // ...
            };

            const predictedSafe: PredictedSafeProps = {
                safeAccountConfig
                // ...
            };

            const protocolKit = await Safe.init({
                provider: chain.rpcUrls.default.http[0],
                signer: walletProvider.getAddress(),
                predictedSafe,
                onchainAnalytics // Optional
                // ...
            });

            const predictedSafeAddress = await protocolKit.getAddress();

            const deploymentTransaction =
                await protocolKit.createSafeDeploymentTransaction();


            const client =
                await protocolKit.getSafeProvider().getExternalSigner();

            const tx = await client!.prepareTransactionRequest({
                to: deploymentTransaction.to,
                value: BigInt(deploymentTransaction.value),
                data: deploymentTransaction.data as `0x${string}`,
                chain
            });

            if (!tx) {
              throw new Error("Failed to prepare transaction request");
            }

            const transactionHash = await walletProvider.sendTransaction(tx);

            await waitForTransactionReceipt(
              // biome-ignore lint: client is not null
              client!,
              { hash: transactionHash }
            );

            const newProtocolKit = await protocolKit.connect({
                safeAddress: predictedSafeAddress
            });

            const deployedSafeAddress = await newProtocolKit.getAddress();

            return {
                safeAddress: deployedSafeAddress,
                transactionHash,
                threshold: args.threshold,
                owners: args.owners
            };
        } catch (error: any) {
            return { error };
        }
    }

    @CreateAction({
        name: "create_safe_transaction",
        description: `
      This tool will create a transaction for a safe. The transaction is not executed.
      It takes the following inputs:
        - safeAddress: The address of the safe
        - transactions: The transactions to be executed
      `,
        schema: CreateSafeTransactionSchema
    })
    async createSafeTransaction(
        walletProvider: EvmWalletProvider,
        args: z.infer<typeof CreateSafeTransactionSchema>
    ): Promise<CreateSafeTransactionReturnType> {
        try {
            const chain = process.env.NEXT_PUBLIC_ACTIVE_CHAIN === "base" ? base : baseSepolia;
            const signerAddress = walletProvider.getAddress();
            const protocolKit = await Safe.init({
                provider: chain.rpcUrls.default.http[0],
                signer: signerAddress,
                safeAddress: args.safeAddress
            });

            const safeTx = await protocolKit.createTransaction({
                transactions: args.transactions
            });
            const transactionHash = await protocolKit.getTransactionHash(safeTx);
            // Save the transaction to the database
            await saveSafeTransaction({
                transactionHash,
                safeAddress: args.safeAddress,
                transaction: safeTx,
            });

            // Go ahead and sign with the wallet provider
            const signedTx = await signTransaction(walletProvider as PrivyWalletProvider, transactionHash);
            const signatureCount = signedTx.signatures.size;

            // Store the signed transaction
            await saveSafeTransaction({
                transactionHash,
                safeAddress: args.safeAddress,
                transaction: signedTx,
            });

            return { transactionHash, signatureCount };
        } catch (error: any) {
            return { error: error.message };
        }
    }

    @CreateAction({
        name: "sign_safe_transaction",
        description: `
      This tool will sign a transaction for a safe.
      It takes the following inputs:
        - safeAddress: The address of the safe
        - transactionHash: The hash of the transaction to be signed
      `,
        schema: SignSafeTransactionSchema
    })
    async signSafeTransaction(
        walletProvider: EvmWalletProvider,
        args: z.infer<typeof SignSafeTransactionSchema>
    ): Promise<SignSafeTransactionReturnType> {
        try {
            const safeTx = await signTransaction(walletProvider as PrivyWalletProvider, args.transactionHash);
            const signatureCount = safeTx.signatures.size;

            await saveSafeTransaction({
                transactionHash: args.transactionHash,
                safeAddress: args.safeAddress,
                transaction: safeTx,
            });

            return { transactionHash: args.transactionHash, signatureCount };
        } catch (error: any) {
            return { error: error.message };
        }
    }

    @CreateAction({
        name: "execute_safe_transaction",
        description: `
      This tool will execute a transaction for a safe assuming it has the required amount of signatures.
      It takes the following inputs:
        - safeAddress: The address of the safe
        - transactionHash: The hash of the transaction to be executed
      `,
        schema: ExecuteSafeTransactionSchema
    })
    async executeSafeTransaction(
        walletProvider: EvmWalletProvider,
        args: z.infer<typeof ExecuteSafeTransactionSchema>
    ): Promise<ExecuteSafeTransactionReturnType> {
        try {
            const chain = process.env.NEXT_PUBLIC_ACTIVE_CHAIN === "base" ? base : baseSepolia;
            const protocolKit = await Safe.init({
                provider: chain.rpcUrls.default.http[0],
                signer: walletProvider.getAddress(),
                safeAddress: args.safeAddress
            });

            const safeTx = await getTransactionByHash(args.transactionHash);

            const onchainIdentifier = protocolKit.getOnchainIdentifier();

            const encodedTransaction = await protocolKit.getEncodedTransaction(safeTx);

            const transaction = {
                to: args.safeAddress as `0x${string}`,
                value: 0n,
                data: encodedTransaction + onchainIdentifier as `0x${string}`,
                chain
            };

            const client =
                await protocolKit.getSafeProvider().getExternalSigner();

            const prepTx = await client!.prepareTransactionRequest(transaction);

            const hash = await walletProvider.sendTransaction(prepTx);

            await waitForTransactionReceipt(
                client!,
                { hash }
            );

            return { transactionHash: hash };
        } catch (error: any) {
            return { error: error.message };
        }
    }

    /**
     * Checks if the Safe action provider supports the given network.
     *
     * @param _ - The network to check.
     * @returns True if the Safe action provider supports the network, false otherwise.
     */
    supportsNetwork = (_: Network) => true;
}

const getTransactionByHash = async (transactionHash: string): Promise<SafeTransaction> => {
    const storedTx = await getSafeTransactionByHash({
        transactionHash
    });

    if (!storedTx) {
        throw new Error("Transaction not found");
    }

    const safeTransaction = storedTx.transaction as SafeTransaction;

    const safeTx = new EthSafeTransaction(safeTransaction.data);
    // Add signatures back to the transaction
    const signatures = new Map(Object.entries(safeTransaction.signatures));
    for (const [signer, signature] of signatures) {
        const safeSignature = new EthSafeSignature(signer, signature.data);
        safeTx.addSignature(safeSignature);
    }
    return safeTx;
}

const signTransaction = async (walletProvider: PrivyWalletProvider, transactionHash: string): Promise<SafeTransaction> => {
    const safeTx = await getTransactionByHash(transactionHash);
    const signedTxHash = await walletProvider.signMessage({ raw: transactionHash as `0x${string}` });
    const signature = await adjustVInSignature(SigningMethod.ETH_SIGN, signedTxHash, transactionHash, walletProvider.getAddress());
    const safeSignature = new EthSafeSignature(walletProvider.getAddress(), signature);
    safeTx.addSignature(safeSignature);
    return safeTx;
}

export const safeActionProvider = () => new SafeActionProvider();