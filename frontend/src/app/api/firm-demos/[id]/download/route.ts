import { NextResponse } from "next/server";
import { FIRM_DEMO_TABLE, getSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(FIRM_DEMO_TABLE)
    .select("title,demo_html,demo_html_filename")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }
  if (!data.demo_html) {
    return NextResponse.json(
      { error: "No HTML uploaded for this meeting yet" },
      { status: 404 },
    );
  }

  const fallbackName = `${(data.title || "demo")
    .replace(/[^a-z0-9-_]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "demo"}.html`;
  const filename = data.demo_html_filename || fallbackName;

  return new NextResponse(data.demo_html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
