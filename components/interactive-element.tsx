import { Button } from "./ui/button";
import { FundButton } from "@coinbase/onchainkit/fund";
import { ConnectButton } from "./connect-button";
import { useCallback, } from "react";
import type { UserAction } from "@/lib/utils/message-helpers";
import { useChatContext } from "@/contexts/chat-context";
import { StarterKitCheckout } from "./starter-kit-checkout";
import { NFTCard } from "@coinbase/onchainkit/nft";
import { NFTMedia, NFTNetwork, NFTTitle } from "@coinbase/onchainkit/nft/view";

interface ActionButtonsProps {
  args: Array<Record<string, any>>;
  chatId: string;
}

function ActionButtons({ args, chatId }: ActionButtonsProps) {
  const { append } = useChatContext();

  const handleSelect = useCallback(
    (option: Record<string, any>) => {
      append({
        role: "user",
        content: option.label,
      });
    },
    [append]
  );

  return (
    <div className="flex flex-col gap-2">
      {args.map((arg) => (
        <Button
          key={arg.value}
          variant={arg.value === "selected" ? "default" : "outline"}
          onClick={() => handleSelect(arg)}
          className="justify-start"
        >
          <div className="text-left">
            <div>{arg.label}</div>
            {arg.description && (
              <div className="text-sm text-muted-foreground">
                {arg.description}
              </div>
            )}
          </div>
        </Button>
      ))}
    </div>
  );
}

interface InteractiveElementProps {
  actions: UserAction[];
  chatId: string;
}

export function InteractiveElement({
  actions,
  chatId,
}: InteractiveElementProps) {
  const { append } = useChatContext();

  const handleAction = useCallback(
    (message: string) => {
      append({
        role: "user",
        content: message,
      });
    },
    [append]
  );

  // Find the first action that matches each type
  const connectWalletAction = actions.find(
    (a) => a.action === "connect-wallet"
  );
  const fundWalletAction = actions.find((a) => a.action === "fund-wallet");
  const buyStarterKitAction = actions.find(
    (a) => a.action === "buy-starter-kit"
  );
  const giftStarterKitAction = actions.find(
    (a) => a.action === "gift-starter-kit"
  );
  const transactionAction = actions.find((a) => a.action === "transaction");
  const optionsAction = actions.find((a) => a.action === "options");
  const helpAction = actions.find((a) => a.action === "help");
  const showNftActions = actions.filter((a) => a.action === "show-nft");

  return (
    <div className="flex flex-col gap-4">
      {connectWalletAction && <ConnectButton />}

      {fundWalletAction && <FundButton />}

      {buyStarterKitAction && (
        <StarterKitCheckout
          onSuccess={() => {
            console.log("successfully bought a starter kit");
          }}
        />
      )}

      {giftStarterKitAction && (
        <StarterKitCheckout
          isGift={true}
          onSuccess={() => {
            console.log("successfully bought a starter kit as a gift");
          }}
        />
      )}

      {transactionAction?.args && (
        <div className="flex flex-col gap-2 p-4 border rounded-lg">
          <h3 className="font-medium">Transaction Details</h3>
          <div className="text-sm text-muted-foreground">
            <p>To: {transactionAction.args[0].to}</p>
            <p>Value: {transactionAction.args[0].value} ETH</p>
          </div>
          <Button>Confirm Transaction</Button>
        </div>
      )}

      {optionsAction?.args && (
        <ActionButtons args={optionsAction.args} chatId={chatId} />
      )}

      {helpAction && (
        <Button
          variant="outline"
          onClick={() =>
            handleAction(helpAction.label || "Help, I don't understand")
          }
        >
          {helpAction.label || "Help, I don't understand"}
        </Button>
      )}

      {showNftActions.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
          {showNftActions.map((action, index) => (
            <NFTCard
              key={`${action.args?.[0].contractAddress}-${action.args?.[0].tokenId}-${index}`}
              contractAddress={action.args?.[0]?.contractAddress}
              tokenId={action.args?.[0]?.tokenId}
            >
              <NFTMedia />
              <NFTTitle />
              <NFTNetwork />
            </NFTCard>
          ))}
        </div>
      )}
    </div>
  );
}
