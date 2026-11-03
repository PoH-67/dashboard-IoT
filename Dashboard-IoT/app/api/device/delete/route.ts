import { NextRequest, NextResponse } from "next/server";
import { ref, remove } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { uid, deviceId, authToken } = body;

    if (!uid || !deviceId) {
      return NextResponse.json({ error: "Missing uid or deviceId" }, { status: 400 });
    }

    // 1. Remove the device under users/{uid}/devices/{deviceId}
    await remove(ref(rtdb, `users/${uid}/devices/${deviceId}`));

    // 2. Remove token index if provided
    if (authToken) {
      try {
        await remove(ref(rtdb, `device_tokens/${authToken}`));
      } catch (tokenErr) {
        console.warn("Failed to delete device_token index:", tokenErr);
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API Error deleting device:", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
