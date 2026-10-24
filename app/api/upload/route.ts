import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "application/zip", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const error = (message: string, status = 400) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return error("Sign in to upload files.", 401);
  if (!env.DB || !env.BUCKET) return error("File storage is unavailable.", 503);
  const form = await request.formData().catch(() => null);
  const commissionId = form?.get("commissionId");
  const milestoneId = form?.get("milestoneId");
  const file = form?.get("file");
  if (typeof commissionId !== "string" || typeof milestoneId !== "string" || !(file instanceof File)) return error("Choose a milestone and file.");
  if (!allowed.has(file.type)) return error("Use a JPG, PNG, WebP, GIF, PDF, ZIP, or DOCX file.");
  if (!file.size || file.size > 20 * 1024 * 1024) return error("Files must be between 1 byte and 20 MB.");
  const commission = await env.DB.prepare("SELECT artist_id, artist_email, status FROM commissions WHERE id = ?").bind(commissionId).first<{ artist_id: string | null; artist_email: string; status: string }>();
  if (!commission || !(commission.artist_id === user.userId || commission.artist_email.toLowerCase() === user.email.toLowerCase())) return error("Project not found.", 404);
  if (commission.status !== "active") return error("This project is not accepting files.", 409);
  const milestone = await env.DB.prepare("SELECT status FROM milestones WHERE id = ? AND commission_id = ?").bind(milestoneId, commissionId).first<{ status: string }>();
  if (!milestone || (milestone.status !== "pending" && milestone.status !== "revision_requested")) return error("This milestone is not accepting files.", 409);
  const id = crypto.randomUUID();
  const key = `milestones/${commissionId}/${id}`;
  const filename = file.name.replace(/[\\/\r\n\x00-\x1f]/g, "_").slice(0, 180) || "attachment";
  try {
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    await env.DB.prepare("INSERT INTO attachments (id, commission_id, milestone_id, uploader_id, object_key, filename, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, commissionId, milestoneId, user.userId, key, filename, file.type, file.size, new Date().toISOString()).run();
    return Response.json({ id, filename });
  } catch (cause) {
    await env.BUCKET.delete(key).catch(() => {});
    console.error(cause);
    return error("Upload failed. Try again.", 500);
  }
}
