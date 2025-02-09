import type { User } from "@/lib/db/queries";

interface Attachment {
  name?: string;
  contentType?: string;
  url: string;
}

const formatAttachments = (attachments: Attachment[]): string => {
  if (!attachments.length) return "";

  return `The user has shared the following files:
${attachments
  .map(
    (attachment, index) =>
      `${index + 1}. ${attachment.name} (${attachment.contentType}, ${
        attachment.url
      })`
  )
  .join("\n")}`;
};

const formatUserInterests = (information: User["information"]): string => {
  if (!information.length) return "";

  const activeInfo = information.filter((info) => !info.deletedAt);
  if (!activeInfo.length) return "";

  return `We have the following information about them:
${activeInfo
  .map((interest) => `${interest.type}: ${interest.content}`)
  .join("\n")}`;
};

const formatKitInfo = (
  claimedKits: User["claimedKits"],
  createdKits: User["createdKits"]
): string => {
  const parts = [];

  if (claimedKits.length > 0) {
    parts.push(`They have claimed ${claimedKits.length} kits`);
  }

  if (createdKits.length > 0) {
    const unclaimedKits = createdKits.filter((kit) => !kit.claimedAt);
    parts.push(
      `They have created ${createdKits.length}, of which ${unclaimedKits.length} are unclaimed`
    );
  }

  return parts.join("\n");
};

const formatCharges = (charges: User["charges"]): string => {
  if (!charges.length) return "";

  const completedCharges = charges.filter(
    (charge) => charge.status === "COMPLETED"
  );
  if (!completedCharges.length) return "";

  const totalSpent = completedCharges.reduce(
    (sum, charge) => sum + Number.parseFloat(charge.amount),
    0
  );
  return `They have spent a total of ${totalSpent} ${completedCharges[0].currency}`;
};

export const generateUserProfile = ({
  userInfo,
  attachments = [],
}: {
  userInfo?: User;
  attachments?: Attachment[];
}): string => {
  if (!userInfo) {
    return "User does not have a profile yet.";
  }

  const sections = [
    formatAttachments(attachments),
    `User's connected wallet is ${userInfo.id}`,
    formatUserInterests(userInfo.information),
    formatKitInfo(userInfo.claimedKits, userInfo.createdKits),
    formatCharges(userInfo.charges),
  ].filter(Boolean); // Remove empty sections

  return sections.join("\n\n");
};
