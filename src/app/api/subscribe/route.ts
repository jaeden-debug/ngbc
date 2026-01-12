import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email } = (await req.json()) as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // TODO: connect to your email platform later (Postmark, Mailchimp, ConvertKit, etc.)
    // For now we just accept it so your UI works and no errors happen.
    console.log("[subscribe]", email);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}