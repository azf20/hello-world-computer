import {
  encodeFunctionData,
  Hex,
  namehash,
  parseEther,
  keccak256,
  toBytes,
} from "viem";
import { z } from "zod";
import {
  ActionProvider,
  CreateAction,
  EvmWalletProvider,
} from "@coinbase/agentkit";

import { Network } from "./types";
import {
  L2_RESOLVER_ADDRESS_MAINNET,
  L2_RESOLVER_ADDRESS_TESTNET,
  L2_RESOLVER_ABI,
  REGISTRATION_DURATION,
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET,
  BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET,
  BASENAMES_BASE_REGISTRAR_ADDRESS_MAINNET,
  BASENAMES_BASE_REGISTRAR_ADDRESS_TESTNET,
  REGISTRAR_ABI,
  BASE_REGISTRAR_TRANSFER_ABI,
} from "./constants";
import { RegisterBasenameSchema, TransferBasenameSchema } from "./schemas";

/**
 * Action provider for registering Basenames.
 */
export class BasenameActionProvider extends ActionProvider<EvmWalletProvider> {
  /**
   * Constructs a new BasenameActionProvider.
   */
  constructor() {
    super("basename", []);
  }

  /**
   * Registers a Basename.
   *
   * @param wallet - The wallet to use for the registration.
   * @param args - The arguments for the registration.
   * @returns A string indicating the success or failure of the registration.
   */
  @CreateAction({
    name: "register_basename",
    description: `
This tool will register a Basename for the agent. The agent should have a wallet associated to register a Basename.
When your network ID is 'base-mainnet' (also sometimes known simply as 'base'), the name must end with .base.eth, and when your network ID is 'base-sepolia', it must ends with .basetest.eth.
Do not suggest any alternatives and never try to register a Basename with another postfix. The prefix of the name must be unique so if the registration of the
Basename fails, you should prompt to try again with a more unique name.
`,
    schema: RegisterBasenameSchema,
  })
  async register(
    wallet: EvmWalletProvider,
    args: z.infer<typeof RegisterBasenameSchema>
  ): Promise<string> {
    const address = wallet.getAddress();
    console.log("address", address);
    const isMainnet = wallet.getNetwork().networkId === "base-mainnet";

    const suffix = isMainnet ? ".base.eth" : ".basetest.eth";
    if (!args.basename.endsWith(suffix)) {
      args.basename += suffix;
    }

    console.log("in here");

    const l2ResolverAddress = isMainnet
      ? L2_RESOLVER_ADDRESS_MAINNET
      : L2_RESOLVER_ADDRESS_TESTNET;

    const addressData = encodeFunctionData({
      abi: L2_RESOLVER_ABI,
      functionName: "setAddr",
      args: [namehash(args.basename), address],
    });
    const nameData = encodeFunctionData({
      abi: L2_RESOLVER_ABI,
      functionName: "setName",
      args: [namehash(args.basename), args.basename],
    });

    try {
      const contractAddress = isMainnet
        ? BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_MAINNET
        : BASENAMES_REGISTRAR_CONTROLLER_ADDRESS_TESTNET;

      const hash = await wallet.sendTransaction({
        to: contractAddress,
        data: encodeFunctionData({
          abi: REGISTRAR_ABI,
          functionName: "register",
          args: [
            {
              name: args.basename.replace(suffix, ""),
              owner: address as Hex,
              duration: REGISTRATION_DURATION,
              resolver: l2ResolverAddress,
              data: [addressData, nameData],
              reverseRecord: true,
            },
          ],
        }),
        value: parseEther(args.amount),
      });

      await wallet.waitForTransactionReceipt(hash);

      return `Successfully registered basename ${args.basename} for address ${address}`;
    } catch (error) {
      return `Error registering basename: Error: ${error}`;
    }
  }

  /**
   * Transfers a Basename.
   *
   * @param wallet - The wallet to use for the transfer.
   * @param args - The arguments for the transfer.
   * @returns A string indicating the success or failure of the transfer.
   */
  @CreateAction({
    name: "tranfer_basename",
    description: `
This tool will transfer a Basename from the agent's wallet to a new owner. The agent must be the current owner of the Basename to transfer it.

It takes the following inputs:
- basename: The Basename to transfer (must end in .base.eth for mainnet or .basetest.eth for testnet)
- destination: The address to transfer ownership to

The agent must have a wallet connected that owns the Basename. The transfer will fail if:
- The agent's wallet does not own the Basename
- The Basename format is incorrect for the current network
- The destination address is invalid
`,
    schema: TransferBasenameSchema,
  })
  async transfer(
    wallet: EvmWalletProvider,
    args: z.infer<typeof TransferBasenameSchema>
  ): Promise<string> {
    const agentAddress = wallet.getAddress();
    const isMainnet = wallet.getNetwork().networkId === "base-mainnet";

    const suffix = isMainnet ? ".base.eth" : ".basetest.eth";
    if (!args.basename.endsWith(suffix)) {
      args.basename += suffix;
    }

    const l2ResolverAddress = isMainnet
      ? L2_RESOLVER_ADDRESS_MAINNET
      : L2_RESOLVER_ADDRESS_TESTNET;

    console.log("Base Name", args.basename);
    console.log("Agent Address", agentAddress);
    console.log("mainnet", isMainnet);
    console.log("l2ResolverAddress", l2ResolverAddress);
    console.log("Destination Address", args.destination);

    // Set the address record for the basename
    try {
      // Step 1: Set the address record
      const nameHash = namehash(args.basename);
      const setAddrHash = await wallet.sendTransaction({
        to: l2ResolverAddress,
        data: encodeFunctionData({
          abi: L2_RESOLVER_ABI,
          functionName: "setAddr",
          args: [nameHash, args.destination as `0x${string}`],
        }),
      });
      const addrReceipt = await wallet.waitForTransactionReceipt(setAddrHash);
      console.log(
        "Set address record transaction completed in block",
        addrReceipt.blockNumber,
        "with tx:",
        setAddrHash
      );

      // Step 2: Set the name record after address record completes
      const setNameHash = await wallet.sendTransaction({
        to: l2ResolverAddress,
        data: encodeFunctionData({
          abi: L2_RESOLVER_ABI,
          functionName: "setName",
          args: [nameHash, args.basename],
        }),
      });
      const nameReceipt = await wallet.waitForTransactionReceipt(setNameHash);
      console.log(
        "Set name record transaction completed in block",
        nameReceipt.blockNumber,
        "with tx:",
        setNameHash
      );

      // Step 3: Reclaim the basename after name record completes
      const baseRegistrarAddress = isMainnet
        ? BASENAMES_BASE_REGISTRAR_ADDRESS_MAINNET
        : BASENAMES_BASE_REGISTRAR_ADDRESS_TESTNET;

      // Get just the label (remove .base.eth or .basetest.eth)
      const label = args.basename.replace(suffix, "");
      const tokenId = BigInt(keccak256(toBytes(label)));
      console.log("Label:", label);
      console.log("Token ID:", tokenId.toString());

      const reclaimHash = await wallet.sendTransaction({
        to: baseRegistrarAddress,
        data: encodeFunctionData({
          abi: BASE_REGISTRAR_TRANSFER_ABI,
          functionName: "reclaim",
          args: [tokenId, args.destination as `0x${string}`],
        }),
        gas: 100000n,
      });

      const reclaimReceipt = await wallet.waitForTransactionReceipt(
        reclaimHash
      );
      console.log(
        "Reclaim transaction completed in block",
        reclaimReceipt.blockNumber,
        "with tx:",
        reclaimHash
      );

      // Step 4: Transfer the ENS name
      const transferHash = await wallet.sendTransaction({
        to: baseRegistrarAddress,
        data: encodeFunctionData({
          abi: BASE_REGISTRAR_TRANSFER_ABI,
          functionName: "safeTransferFrom",
          args: [
            agentAddress as `0x${string}`,
            args.destination as `0x${string}`,
            tokenId,
          ],
        }),
        gas: 100000n,
      });

      const transferReceipt = await wallet.waitForTransactionReceipt(
        transferHash
      );
      console.log(
        "Transfer transaction completed in block",
        transferReceipt.blockNumber,
        "with tx:",
        transferHash
      );

      return `Successfully transferred basename ${args.basename} to ${args.destination}`;
    } catch (error) {
      console.error("Error in transfer process:", error);
      throw new Error(
        `Transfer failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Checks if the Basename action provider supports the given network.
   *
   * @param network - The network to check.
   * @returns True if the Basename action provider supports the network, false otherwise.
   */
  supportsNetwork = (network: Network) =>
    network.networkId === "base-mainnet" ||
    network.networkId === "base-sepolia";
}

export const basenameActionProvider = () => new BasenameActionProvider();
