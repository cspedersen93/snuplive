import { NextResponse } from "next/server";
import { vareTekst } from "@/lib/format";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function fail(error: string, status: number) {
  return json({ error: vareTekst(error) }, status);
}
