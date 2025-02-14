import { z } from "zod";

/**
 * Input schema for create safe action.
 */
export const CreateSafeSchema = z
  .object({
    owners: z
      .array(z.string())
      .describe("The addresses of the owners of the safe"),
    threshold: z
      .number()
      .describe("The minimum number of owners required to confirm a transaction"),
  })
  .strip()
  .describe("Instructions for creating a safe (multisig wallet)");

/**
 * Input schema for create safe transaction action.
 */
export const CreateSafeTransactionSchema = z
  .object({
    safeAddress: z.string().describe("The address of the safe"),
    transactions: z.array(z.object({
      to: z.string().describe("The address of the recipient"),
      value: z.string().describe("The value of the transaction. Must be a whole number. No decimals allowed. Example:0.1 ETH is 100000000000000000"),
      data: z.string().describe("The data of the transaction"),
    })).describe("The transactions to be executed"),
  })
  .strip()
  .describe("Instructions for creating a safe transaction");

/**
 * Input schema for sign safe transaction action.
 */
export const SignSafeTransactionSchema = z
  .object({
    safeAddress: z.string().describe("The address of the safe"),
    transactionHash: z.string().describe("The hash of the transaction to be signed"),
  })
  .strip()
  .describe("Instructions for signing a safe transaction");

/**
 * Input schema for execute safe transaction action.
 */
export const ExecuteSafeTransactionSchema = z
  .object({
    safeAddress: z.string().describe("The address of the safe"),
    transactionHash: z.string().describe("The hash of the transaction to be executed"),
  })
  .strip()
  .describe("Instructions for executing a safe transaction");
