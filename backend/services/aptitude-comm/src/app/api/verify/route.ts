import { NextRequest, NextResponse } from "next/server";
import { verifyCertificate } from "@/lib/verifier";

export const maxDuration = 60;

// Supported file types and their Claude-compatible media types
const SUPPORTED_TYPES: Record<string, string> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
  "application/pdf": "application/pdf",
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("certificate") as File | null;
    const userName = (formData.get("userName") as string | null)?.trim();
    const rollNumber = ((formData.get("rollNumber") as string | null) ?? "").trim();

    if (!file) {
      return NextResponse.json({ error: "No certificate file uploaded." }, { status: 400 });
    }
    if (!userName) {
      return NextResponse.json({ error: "Student name is required." }, { status: 400 });
    }

    const resolvedType = SUPPORTED_TYPES[file.type] ?? SUPPORTED_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""];
    if (!resolvedType) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${file.type}". Upload a PDF or image (JPEG, PNG, WebP, GIF).`,
        },
        { status: 400 }
      );
    }

    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large. Maximum 20 MB." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const result = await verifyCertificate(base64, resolvedType, userName, rollNumber);
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[verify]", err);
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
