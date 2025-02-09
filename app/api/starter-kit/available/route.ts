import {
  getAvailableStarterKits,
  claimAvailableStarterKit,
} from "@/lib/db/queries";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const kits = await getAvailableStarterKits();
    return NextResponse.json({ kits });
  } catch (error) {
    console.error("Failed to get available starter kits:", error);
    return NextResponse.json(
      { error: "Failed to get available starter kits" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    const kit = await claimAvailableStarterKit(userId);

    if (!kit) {
      return NextResponse.json(
        { error: "No starter kits available" },
        { status: 404 }
      );
    }

    return NextResponse.json({ kit });
  } catch (error) {
    console.error("Failed to claim starter kit:", error);
    return NextResponse.json(
      { error: "Failed to claim starter kit" },
      { status: 500 }
    );
  }
}
