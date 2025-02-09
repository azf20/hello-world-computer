"use client";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  ConnectWallet,
  Wallet,
  WalletDropdown,
  WalletDropdownDisconnect,
} from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity } from "@coinbase/onchainkit/identity";
import { color } from "@coinbase/onchainkit/theme";
import { useStarterKit } from "@/hooks/use-starter-kit";
import { SparklesIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ConnectButton() {
  const { login, isAuthenticated, address, isLoading } = useAuth();
  const { claimed } = useStarterKit();

  const hasStarterKit = claimed > 0;

  return (
    <div className="flex items-center gap-2">
      {!isAuthenticated && address && (
        <Button type="button" onClick={login} disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign In"}
        </Button>
      )}
      {isAuthenticated && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "relative",
                hasStarterKit && "text-yellow-500 hover:text-yellow-600"
              )}
            >
              <SparklesIcon />
              {!hasStarterKit && (
                <span className="absolute -top-1 -right-1 flex size-3">
                  <span className="animate-ping absolute inline-flex size-full rounded-full bg-sky-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full size-3 bg-sky-500"></span>
                </span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {hasStarterKit
              ? "You have a starter kit"
              : "Ask the agent for a starter kit!"}
          </TooltipContent>
        </Tooltip>
      )}
      <Wallet>
        <ConnectWallet onConnect={login}>
          <Avatar className="size-6" />
          <Name />
        </ConnectWallet>
        <WalletDropdown>
          <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
            <Avatar />
            <Name />
            <Address className={color.foregroundMuted} />
          </Identity>
          <WalletDropdownDisconnect />
        </WalletDropdown>
      </Wallet>
    </div>
  );
}

