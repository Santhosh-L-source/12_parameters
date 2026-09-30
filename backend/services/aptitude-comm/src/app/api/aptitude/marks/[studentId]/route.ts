import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  if (!studentId) {
    return NextResponse.json({ error: "studentId is required" }, { status: 400 });
  }

  return NextResponse.json({
    studentId,
    module: "Aptitude & Communication",
    maxMarks: 20,
    marks: 0,
    aptitudeMarks: 0,
    communicationMarks: 0,
    evidenceCount: 0,
  });
}
