import { z } from "zod";
import {
  getUnclaimedStarterKits,
  claimStarterKit as claimKit,
} from "@/lib/db/queries";
import type { Session } from "next-auth";
import { tool } from "ai";

type StarterKitProps = {
  session: Session | null;
};

export const claimStarterKitTool = ({ session }: StarterKitProps) =>
  tool({
    description: "Claim an available starter kit using its ID",
    parameters: z.object({
      kitId: z.string().uuid(),
    }),
    execute: async ({ kitId }) => {
      if (!session?.user?.id) {
        return { error: "Not authenticated" };
      }

      try {
        await claimKit({
          kitId,
          userId: session.user.id,
        });
        return { success: true, message: "Successfully claimed starter kit" };
      } catch (error) {
        return { error: "Failed to claim starter kit" };
      }
    },
  });

export const giveStarterKitTool = ({ session }: StarterKitProps) =>
  tool({
    description:
      "Give one of your unclaimed starter kits to another user by their address",
    parameters: z.object({
      recipientId: z.string().length(42),
    }),
    execute: async ({ recipientId }) => {
      if (!session?.user?.id) {
        return { error: "Not authenticated" };
      }

      try {
        const unclaimedKits = await getUnclaimedStarterKits(session.user.id);

        if (unclaimedKits.length === 0) {
          return { error: "No unclaimed starter kits available to give" };
        }

        const kitToGive = unclaimedKits[0];

        await claimKit({
          kitId: kitToGive.id,
          userId: recipientId,
        });

        return {
          success: true,
          message: `Successfully gave starter kit ${kitToGive.id} to ${recipientId}`,
        };
      } catch (error) {
        return { error: "Failed to give starter kit" };
      }
    },
  });

export const starterKitTools = {
  claim: {
    schema: z.object({
      kitId: z.string().uuid(),
    }),
    handler: claimStarterKitTool,
    description: "Claim an available starter kit using its ID",
  },
  give: {
    schema: z.object({
      recipientId: z.string().length(42),
    }),
    handler: giveStarterKitTool,
    description:
      "Give one of your unclaimed starter kits to another user by their address",
  },
};
