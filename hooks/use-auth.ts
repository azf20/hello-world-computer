"use client";

import { useState } from "react";
import { useAccount, useAccountEffect, useSignMessage } from "wagmi";
import { auth, logout } from "@/app/auth-actions";
import useSWR, { useSWRConfig } from "swr";
import { useRouter } from "next/navigation";

export function useAuth() {
  const { address, status } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isLoading, setIsLoading] = useState(false);
  const { mutate: globalMutate } = useSWRConfig();
  const router = useRouter();

  const { data: session, mutate: mutateSession } = useSWR(
    status === "connected" ? ["auth", address] : null,
    () => auth()
  );

  const isAuthenticated = !!(session?.user && session.user.id === address);

  useAccountEffect({
    onConnect(data) {
      console.log("Wallet connected!", data);
    },
    onDisconnect: async () => {
      console.log("Wallet disconnected!");
      await logout();
      mutateSession();
      router.push("/");
    },
  });

  async function login() {
    try {
      console.log("Logging in...");
      setIsLoading(true);

      // Get challenge
      const challengeRes = await fetch("/api/auth/siwe/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });

      if (!challengeRes.ok) throw new Error("Failed to get challenge");
      const { message } = await challengeRes.json();

      // Sign message
      const signature = await signMessageAsync({ message });

      // Verify signature
      const verifyRes = await fetch("/api/auth/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, signature }),
      });

      if (!verifyRes.ok) {
        const error = await verifyRes.text();
        throw new Error(`Failed to verify signature: ${error}`);
      }

      const result = await verifyRes.json();

      // Update both auth state and history
      await Promise.all([mutateSession(), globalMutate("/api/history")]);
    } catch (error) {
      console.error("Login failed:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isAuthenticated,
    isLoading,
    login,
    address,
    sessionAddress: session?.user?.id,
  };
}
