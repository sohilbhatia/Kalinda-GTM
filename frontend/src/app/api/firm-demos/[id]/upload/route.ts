import { NextResponse } from "next/server";
import { FIRM_DEMO_TABLE, getSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB ceiling per upload

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (!/\.(html?|htm)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "Only .html / .htm files are accepted" },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (${file.size} bytes; max ${MAX_BYTES})` },
      { status: 413 },
    );
  }

  const html = await file.text();
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from(FIRM_DEMO_TABLE)
    .update({
      demo_html: html,
      demo_html_filename: file.name,
      demo_html_size_bytes: file.size,
      demo_html_uploaded_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,demo_html_filename,demo_html_size_bytes,demo_html_uploaded_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Supabase update failed: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, meeting: data });
}
