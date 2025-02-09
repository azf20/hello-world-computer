import {
  type Message,
  createDataStreamResponse,
  streamText,
  Output,
} from "ai";

import { auth } from "@/app/auth";
import { myProvider } from "@/lib/ai/models";
import { generateSystemPrompt } from "@/lib/ai/prompts";
import {
  deleteChatById,
  getChatById,
  saveChat,
  saveMessages,
  getUser,
} from "@/lib/db/queries";
import {
  generateUUID,
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from "@/lib/utils";

import { generateTitleFromUserMessage } from "../../actions";
import { createDocument } from "@/lib/ai/tools/create-document";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { agentKitToTools } from "@/lib/web3/agentkit/framework-extensions/ai-sdk";
import { z } from "zod";
import {
  saveUserInformation,
  getUserInformation,
  deleteUserInformationTool,
} from "@/lib/ai/tools/user-information";
import { setupAgentKit } from "@/lib/web3/agentkit/setup";
import { generateUserProfile } from "@/lib/ai/prompts/user";
import {
  getAvailableStarterKitsTool,
  claimAvailableStarterKitTool,
} from "@/lib/ai/tools/starter-kit";

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    selectedChatModel,
  }: { id: string; messages: Array<Message>; selectedChatModel: string } =
    await request.json();

  const attachments = messages.flatMap(
    (message) => message.experimental_attachments ?? []
  );

  let userProfile = "User is not signed in";
  const session = await auth();
  const userMessage = getMostRecentUserMessage(messages);

  if (!userMessage) {
    return new Response("No user message found", { status: 400 });
  }

  if (session?.user?.id) {
    const userInfo = await getUser(session.user.id);
    userProfile = `USER-WALLET-ADDRESS=${
      session.user.id
    }. ${generateUserProfile({
      userInfo: userInfo[0],
      attachments,
    })}`;

    const chat = await getChatById({ id });
    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message: userMessage,
      });
      await saveChat({ id, userId: session.user.id, title });
    }
    await saveMessages({
      messages: [{ ...userMessage, createdAt: new Date(), chatId: id }],
    });
  }

  const agentKit = await setupAgentKit();

  const tools = agentKitToTools(agentKit);

  return createDataStreamResponse({
    execute: (dataStream) => {
      const result = streamText({
        model: myProvider.languageModel(selectedChatModel),
        system: generateSystemPrompt({ selectedChatModel }) + userProfile,
        messages,
        maxSteps: 10,
        // experimental_activeTools:
        //   selectedChatModel === "chat-model-reasoning"
        //     ? []
        //     : ["createDocument", "updateDocument", "requestSuggestions"],
        experimental_output: Output.object({
          schema: z.object({
            agent: z.string(),
            content: z.string(),
            userActions: z.array(
              z.object({
                action: z.string(),
                label: z
                  .string()
                  .optional()
                  .describe(
                    "An additional label with more context about the action for the user"
                  ),
                args: z.array(z.record(z.any())).optional(),
              })
            ),
          }),
        }),
        // experimental_transform: smoothStream({ chunking: "word" }),
        experimental_generateMessageId: generateUUID,
        tools: {
          ...tools,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({
            session,
            dataStream,
          }),
          saveUserInformation: saveUserInformation({ session }),
          getUserInformation: getUserInformation({ session }),
          getAvailableStarterKits: getAvailableStarterKitsTool(),
          claimAvailableStarterKit: claimAvailableStarterKitTool(),
        },
        onFinish: async ({ response, reasoning, text }) => {
          // currently the content of the last message is truncated, so passing in the text as a partial fix
          const assistantMessages = response.messages.filter(
            (message) => message.role === "assistant"
          );
          const lastAssistantMessage =
            assistantMessages[assistantMessages.length - 1];
          if (lastAssistantMessage) {
            response.messages[response.messages.length - 1] = {
              ...lastAssistantMessage,
              content: [
                {
                  type: "text",
                  text,
                },
              ],
            };
          }
          if (session.user?.id) {
            try {
              const sanitizedResponseMessages = sanitizeResponseMessages({
                messages: response.messages,
                reasoning,
              });

              await saveMessages({
                messages: sanitizedResponseMessages.map((message) => {
                  return {
                    id: message.id,
                    chatId: id,
                    role: message.role,
                    content:
                      typeof message.content === "string"
                        ? message.content
                        : JSON.stringify(message.content),
                    createdAt: new Date(),
                  };
                }),
              });
            } catch (error) {
              console.error("Failed to save chat");
            }
          }
        },
      });

      result.mergeIntoDataStream(dataStream, {
        sendReasoning: true,
      });
    },
    onError: (error) => {
      return `Oops, an error occured! ${error}`;
    },
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return new Response("Not Found", { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    await deleteChatById({ id });

    return new Response("Chat deleted", { status: 200 });
  } catch (error) {
    return new Response("An error occurred while processing your request", {
      status: 500,
    });
  }
}
