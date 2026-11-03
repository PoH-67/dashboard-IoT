import { NextRequest, NextResponse } from "next/server";
import { ref, get, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";

// Helper to look up device by authToken
async function findDeviceByToken(token: string) {
  if (!token || typeof token !== "string") return null;
  const cleanToken = token.trim();

  // 1. Direct index lookup in device_tokens/{cleanToken}
  const tokenSnap = await get(ref(rtdb, `device_tokens/${cleanToken}`));
  if (tokenSnap.exists()) {
    return tokenSnap.val() as { uid: string; deviceId: string; deviceName?: string };
  }

  // 2. Fallback: Search all users if index doesn't have it yet
  const usersSnap = await get(ref(rtdb, "users"));
  if (usersSnap.exists()) {
    const usersData = usersSnap.val();
    for (const [uid, userVal] of Object.entries<any>(usersData)) {
      if (userVal?.devices) {
        for (const [devId, devVal] of Object.entries<any>(userVal.devices)) {
          if (devVal?.authToken === cleanToken) {
            // Self-heal: save to device_tokens index for fast subsequent lookups
            await update(ref(rtdb, `device_tokens/${cleanToken}`), {
              uid,
              deviceId: devId,
              deviceName: devVal.name || "Device",
            });
            return { uid, deviceId: devId, deviceName: devVal.name };
          }
        }
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // not JSON or empty
    }

    const { searchParams } = new URL(req.url);
    const token =
      body.token ||
      searchParams.get("token") ||
      req.headers.get("x-auth-token") ||
      req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Auth Token. Masukkan Auth Token perangkat Anda." },
        { status: 401 }
      );
    }

    const match = await findDeviceByToken(token);
    if (!match) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid Auth Token. Token tidak terdaftar di sistem." },
        { status: 401 }
      );
    }

    const { uid, deviceId } = match;
    const now = Date.now();
    const updates: Record<string, any> = {
      [`users/${uid}/devices/${deviceId}/status`]: "online",
      [`users/${uid}/devices/${deviceId}/lastSeen`]: now,
    };

    // Support batch pins update: e.g. { pins: { V1: 60.5, V3: 27.4 } }
    if (body.pins && typeof body.pins === "object") {
      for (const [pin, val] of Object.entries(body.pins)) {
        updates[`users/${uid}/devices/${deviceId}/datastreams/${pin}/value`] = val;
      }
    }

    // Support single pin update: e.g. { pin: "V3", value: 27.4 }
    if (body.pin) {
      updates[`users/${uid}/devices/${deviceId}/datastreams/${body.pin}/value`] = body.value;
    }

    // Also support query param: ?pin=V3&value=27.4
    const qPin = searchParams.get("pin");
    const qVal = searchParams.get("value");
    if (qPin && qVal !== null) {
      const numVal = isNaN(Number(qVal)) ? qVal : Number(qVal);
      updates[`users/${uid}/devices/${deviceId}/datastreams/${qPin}/value`] = numVal;
    }

    await update(ref(rtdb), updates);

    return NextResponse.json({
      success: true,
      status: "online",
      deviceId,
      deviceName: match.deviceName,
      timestamp: now,
    });
  } catch (err: any) {
    console.error("API error in /api/device/update:", err);
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token") || req.headers.get("x-auth-token");
    const pin = searchParams.get("pin");

    if (!token) {
      return NextResponse.json(
        { error: "Unauthorized: Missing Auth Token." },
        { status: 401 }
      );
    }

    const match = await findDeviceByToken(token);
    if (!match) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid Auth Token." },
        { status: 401 }
      );
    }

    const { uid, deviceId } = match;

    if (pin) {
      const snap = await get(ref(rtdb, `users/${uid}/devices/${deviceId}/datastreams/${pin}`));
      const val = snap.exists() ? snap.val()?.value : null;
      return NextResponse.json({ pin, value: val });
    }

    const snap = await get(ref(rtdb, `users/${uid}/devices/${deviceId}/datastreams`));
    return NextResponse.json({
      deviceId,
      datastreams: snap.exists() ? snap.val() : {},
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal Server Error" }, { status: 500 });
  }
}
