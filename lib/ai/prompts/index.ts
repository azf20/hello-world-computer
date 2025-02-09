import { blocksPrompt } from "./constants/blocks";
import { regularPrompt } from "./constants/regular";
import { codePrompt } from "./constants/code";
import { sheetPrompt } from "./constants/sheet";
import { userActionsPrompt } from "./constants/user-actions";
import { starterKitPrompt } from "./constants/starter-kit";
import type { BlockKind } from "@/components/block";

export const generateSystemPrompt = ({
  selectedChatModel,
}: {
  selectedChatModel: string;
}) => {
  if (selectedChatModel === "chat-model-reasoning") {
    return regularPrompt;
  }
  return `${regularPrompt}\n\n${blocksPrompt}\n\n${userActionsPrompt}\n\n${starterKitPrompt}`;
};

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: BlockKind
) =>
  type === "text"
    ? `\
Improve the following contents of the document based on the given prompt.

${currentContent}
`
    : type === "code"
    ? `\
Improve the following code snippet based on the given prompt.

${currentContent}
`
    : type === "sheet"
    ? `\
Improve the following spreadsheet based on the given prompt.

${currentContent}
`
    : "";

export { blocksPrompt, regularPrompt, codePrompt, sheetPrompt };
