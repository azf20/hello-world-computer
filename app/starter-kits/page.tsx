"use client";

import { useStarterKit } from "@/hooks/use-starter-kit";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SparklesIcon } from "@/components/icons";

export default function StarterKitsPage() {
  const { isAuthenticated } = useAuth();
  const { claimedKits, createdKits, isLoading } = useStarterKit();

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">
          Please connect your wallet to view starter kits
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-muted-foreground">Loading starter kits...</p>
      </div>
    );
  }

  return (
    <div className="container p-8 space-y-8">
      <h1 className="text-2xl font-bold">Starter Kits</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="text-yellow-500">
                <SparklesIcon />
              </div>
              Claimed Kits ({claimedKits.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {claimedKits.length === 0 ? (
              <p className="text-muted-foreground">
                No claimed starter kits yet
              </p>
            ) : (
              <ul className="space-y-4">
                {claimedKits.map((kit) => (
                  <li
                    key={kit.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">Creator: {kit.creatorId}</p>
                      <p className="text-sm text-muted-foreground">
                        Claimed: {new Date(kit.claimedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SparklesIcon />
              Created Kits ({createdKits.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {createdKits.length === 0 ? (
              <p className="text-muted-foreground">
                No created starter kits yet
              </p>
            ) : (
              <ul className="space-y-4">
                {createdKits.map((kit) => (
                  <li
                    key={kit.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">ID: {kit.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(kit.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {kit.claimerId ? "Claimed" : "Unclaimed"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
