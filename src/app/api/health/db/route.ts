import { verifyDatabaseConnection } from "@/lib/db/mongoose";

export async function GET(): Promise<Response> {
  try {
    const connected = await verifyDatabaseConnection();

    if (!connected) {
      return Response.json(
        { status: "unavailable", database: "disconnected" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return Response.json(
      { status: "ok", database: "connected" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", database: "disconnected" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
