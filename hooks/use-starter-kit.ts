import useSWR from "swr";
import type { StarterKit } from "@/lib/db/schema";
import { useAuth } from "@/hooks/use-auth";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface AvailableResponse {
  kits: StarterKit[];
}

type ClaimedResponse = StarterKit[];
type CreatedResponse = StarterKit[];

const REFRESH_INTERVAL = 15000; // 15 seconds in milliseconds

export function useStarterKit() {
  const { isAuthenticated } = useAuth();

  const { data: claimedData, error: claimedError } = useSWR<ClaimedResponse>(
    isAuthenticated ? "/api/starter-kit/claimed/list" : null,
    fetcher
  );

  const { data: availableData, error: availableError } =
    useSWR<AvailableResponse>("/api/starter-kit/available", fetcher, {
      refreshInterval: claimedData?.length ? 0 : REFRESH_INTERVAL,
    });

  const { data: createdData, error: createdError } = useSWR<CreatedResponse>(
    isAuthenticated ? "/api/starter-kit/created/list" : null,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
    }
  );

  const isLoading =
    (!availableData && !availableError) ||
    (isAuthenticated && !claimedData && !claimedError) ||
    (isAuthenticated && !createdData && !createdError);

  const error = availableError || claimedError || createdError;

  return {
    available: availableData?.kits.length ?? 0,
    claimed: claimedData?.length ?? 0,
    created: createdData?.length ?? 0,
    availableKits: availableData?.kits ?? [],
    claimedKits: claimedData ?? [],
    createdKits: createdData ?? [],
    isLoading,
    error,
  };
}
