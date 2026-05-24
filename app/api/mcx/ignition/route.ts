import { NextResponse } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://greeknova-backend-production.up.railway.app";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/mcx/ignition`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`Backend returned ${response.status}`);

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
