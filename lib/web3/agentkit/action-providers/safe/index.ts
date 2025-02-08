import { ActionProvider, CreateAction, EvmWalletProvider, Network } from '@coinbase/agentkit';
import Safe, {
    EthSafeTransaction,
    OnchainAnalyticsProps,
    PredictedSafeProps,
    SafeAccountConfig,
    SigningMethod
} from '@safe-global/protocol-kit'
import { waitForTransactionReceipt } from 'viem/actions'
import { baseSepolia } from 'viem/chains'
import { CreateSafeSchema, CreateSafeTransactionSchema, ExecuteSafeTransactionSchema, SignSafeTransactionSchema } from './schemas';
import { z } from 'zod';
import { saveSafeTransaction, getSafeTransactionByHash } from '@/lib/db/queries';
import { SafeTransaction, SafeMultisigTransactionResponse, SafeTransactionData } from '@safe-global/types-kit';
import { adjustVInSignature, EthSafeSignature } from '@safe-global/protocol-kit/dist/src/utils';

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
                provider: baseSepolia.rpcUrls.default.http[0],
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
                chain: baseSepolia
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
            const signerAddress = walletProvider.getAddress();
            const protocolKit = await Safe.init({
                provider: baseSepolia.rpcUrls.default.http[0],
                signer: signerAddress,
                safeAddress: args.safeAddress
            });

            const safeTx = await protocolKit.createTransaction({
                transactions: args.transactions
            });
            const transactionHash = await protocolKit.getTransactionHash(safeTx);
            const signedTxHash = await walletProvider.signMessage(transactionHash);

            const signature = await adjustVInSignature(SigningMethod.ETH_SIGN, signedTxHash, transactionHash, signerAddress);
            const safeSignature = new EthSafeSignature(signerAddress, signature);
            safeTx.addSignature(safeSignature);

            // Store the signed transaction using the new query method
            await saveSafeTransaction({
                transactionHash,
                safeAddress: args.safeAddress,
                transactionData: safeTx,
            });

            return { transactionHash, signatureCount: safeTx.signatures.size };
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
            const signerAddress = walletProvider.getAddress();

            const storedTx = await getSafeTransactionByHash({
                transactionHash: args.transactionHash
            });

            if (!storedTx) {
                throw new Error("Transaction not found");
            }

            const safeTx = new EthSafeTransaction(storedTx.transactionData as SafeTransactionData);

            const signedTxHash = await walletProvider.signMessage(args.transactionHash);

            const signature = await adjustVInSignature(SigningMethod.ETH_SIGN, signedTxHash, args.transactionHash, signerAddress);
            const safeSignature = new EthSafeSignature(signerAddress, signature);
            safeTx.addSignature(safeSignature);
            const signatureCount = safeTx.signatures.size;

            await saveSafeTransaction({
                transactionHash: args.transactionHash,
                safeAddress: args.safeAddress,
                transactionData: safeTx,
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
            const protocolKit = await Safe.init({
                provider: baseSepolia.rpcUrls.default.http[0],
                signer: walletProvider.getAddress(),
                safeAddress: args.safeAddress
            });

            // Get the transaction using the new query method
            const storedTx = await getSafeTransactionByHash({
                transactionHash: args.transactionHash
            });

            if (!storedTx) {
                throw new Error("Transaction not found");
            }

            const safeTx = new EthSafeTransaction(storedTx.transactionData as SafeTransactionData);
            

            const client =
                await protocolKit.getSafeProvider().getExternalSigner();

            const tx = await client!.prepareTransactionRequest({
                to: args.safeAddress,
                value: BigInt(safeTx.data.value || 0),
                data: safeTx.data.data as `0x${string}`,
                chain: baseSepolia
            });

            const transactionHash = await walletProvider.sendTransaction(tx);

            await waitForTransactionReceipt(
                client!,
                { hash: transactionHash }
            );


            const txResponse = await protocolKit.executeTransaction(storedTx.transactionData as SafeTransaction);

            return { transactionHash: txResponse.hash };
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

export const safeActionProvider = () => new SafeActionProvider();