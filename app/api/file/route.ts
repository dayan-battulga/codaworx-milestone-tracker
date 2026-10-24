import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.DB || !env.BUCKET) return new Response("File storage unavailable", { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return new Response("File not found", { status: 404 });
  const file = await env.DB.prepare(`SELECT a.object_key, a.filename, a.mime, c.commissioner_id, c.artist_id, c.artist_email,
    (SELECT COUNT(*) FROM showcase_entries s WHERE s.image_attachment_id = a.id) AS public_image
    FROM attachments a JOIN commissions c ON c.id = a.commission_id WHERE a.id = ?`).bind(id).first<{
      object_key: string; filename: string; mime: string; commissioner_id: string; artist_id: string | null; artist_email: string; public_image: number;
    }>();
  if (!file) return new Response("File not found", { status: 404 });
  const user = await getChatGPTUser();
  const authorized = user && (user.userId === file.commissioner_id || user.userId === file.artist_id || user.email.toLowerCase() === file.artist_email.toLowerCase());
  const publicImage = file.public_image > 0 && file.mime.startsWith("image/");
  if (!authorized && !publicImage) return new Response("Access denied", { status: 403 });
  const object = await env.BUCKET.get(file.object_key);
  if (!object) return new Response("File not found", { status: 404 });
  const safeName = file.filename.replace(/["\\\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "Content-Type": file.mime,
      "Content-Disposition": `${publicImage ? "inline" : "attachment"}; filename="${safeName}"`,
      "Cache-Control": publicImage ? "public, max-age=3600" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
