import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "../../chatgpt-auth";
import { clean, csvCell, optional, templates, validateAward } from "../../../lib/tracker-core";

export const dynamic = "force-dynamic";

type Commission = {
  id: string; title: string; type: string; description: string; location: string;
  commissioner_id: string; commissioner_email: string; artist_email: string; artist_id: string | null;
  status: string; hold_reason: string | null; created_at: string; updated_at: string;
};
type Milestone = {
  id: string; commission_id: string; position: number; title: string; deliverable: string;
  due_date: string; payout_percent: number | null; status: string; submitted_at: string | null;
  approved_at: string | null; paid_at: string | null; payment_method: string | null; payment_reference: string | null;
};

class ApiError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
const database = () => { if (!env.DB) throw new ApiError("Database is unavailable.", 503); return env.DB; };
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const response = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
const lower = (value: string) => value.toLowerCase();
const statement = (sql: string, ...args: unknown[]) => database().prepare(sql).bind(...args);
const eventStatement = (commissionId: string, milestoneId: string | null, actorId: string, kind: string, note = "") =>
  statement("INSERT INTO events (id, commission_id, milestone_id, actor_id, kind, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)", uid(), commissionId, milestoneId, actorId, kind, note, now());
const noticeStatement = (commissionId: string, recipientId: string | null, recipientEmail: string, kind: string, message: string, dedupeKey: string) =>
  statement("INSERT OR IGNORE INTO notifications (id, commission_id, recipient_id, recipient_email, kind, message, dedupe_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", uid(), commissionId, recipientId, lower(recipientEmail), kind, message, dedupeKey, now());

async function requireUser(): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new ApiError("Sign in to manage milestones.", 401);
  return user;
}

function roleFor(commission: Commission, user: ChatGPTUser): "commissioner" | "artist" | null {
  if (commission.commissioner_id === user.userId) return "commissioner";
  if (commission.artist_id === user.userId || lower(commission.artist_email) === lower(user.email)) return "artist";
  return null;
}

async function getCommission(id: string, user: ChatGPTUser) {
  const commission = await statement("SELECT * FROM commissions WHERE id = ?", id).first<Commission>();
  if (!commission) throw new ApiError("Project not found.", 404);
  const role = roleFor(commission, user);
  if (!role) throw new ApiError("You do not have access to this project.", 403);
  return { commission, role };
}

async function getMilestone(commissionId: string, milestoneId: string) {
  const milestone = await statement("SELECT * FROM milestones WHERE id = ? AND commission_id = ?", milestoneId, commissionId).first<Milestone>();
  if (!milestone) throw new ApiError("Milestone not found.", 404);
  return milestone;
}

function requireRole(actual: string, expected: string) {
  if (actual !== expected) throw new ApiError(`Only the ${expected} can do that.`, 403);
}

async function createReminders(user: ChatGPTUser) {
  // shortcut: reminders are generated on dashboard visits; add a scheduled worker when unattended email delivery is configured.
  const rows = await statement(`SELECT c.id AS commission_id, c.title AS commission_title, c.commissioner_id, c.commissioner_email, c.artist_id, c.artist_email,
    m.id AS milestone_id, m.title AS milestone_title, m.due_date
    FROM commissions c JOIN milestones m ON m.commission_id = c.id
    WHERE c.status = 'active' AND m.status != 'approved' AND (c.commissioner_id = ? OR c.artist_id = ? OR lower(c.artist_email) = ?)` , user.userId, user.userId, lower(user.email)).all<{
      commission_id: string; commission_title: string; commissioner_id: string; commissioner_email: string; artist_id: string | null; artist_email: string;
      milestone_id: string; milestone_title: string; due_date: string;
    }>();
  const today = new Date();
  const day = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const writes: D1PreparedStatement[] = [];
  for (const row of rows.results) {
    const difference = Math.round((Date.parse(`${row.due_date}T00:00:00Z`) - day) / 86_400_000);
    const kind = difference === 3 ? "due_soon" : difference === 0 ? "due_today" : difference === -5 ? "overdue" : null;
    if (!kind) continue;
    const recipient = row.commissioner_id === user.userId ? { id: row.commissioner_id, email: row.commissioner_email } : { id: row.artist_id, email: row.artist_email };
    writes.push(noticeStatement(row.commission_id, recipient.id, recipient.email, kind, `${row.milestone_title} in ${row.commission_title} is ${difference > 0 ? "due in 3 days" : difference === 0 ? "due today" : "5 days overdue"}.`, `${kind}:${row.milestone_id}:${recipient.email}`));
  }
  if (writes.length) await database().batch(writes);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "list";
    if (view === "templates") return response(templates);
    if (view === "showcase") {
      const entries = await statement("SELECT * FROM showcase_entries ORDER BY published_at DESC LIMIT 100").all();
      return response({ entries: entries.results });
    }
    const user = await requireUser();
    if (view === "me") return response({ user });
    if (view === "list") {
      await createReminders(user);
      const rows = await statement(`SELECT c.*, COUNT(m.id) AS milestone_count, SUM(CASE WHEN m.status = 'approved' THEN 1 ELSE 0 END) AS approved_count
        FROM commissions c LEFT JOIN milestones m ON m.commission_id = c.id
        WHERE c.commissioner_id = ? OR c.artist_id = ? OR lower(c.artist_email) = ?
        GROUP BY c.id ORDER BY c.updated_at DESC`, user.userId, user.userId, lower(user.email)).all();
      return response({ commissions: rows.results, user });
    }
    if (view === "notifications") {
      await createReminders(user);
      const rows = await statement("SELECT * FROM notifications WHERE recipient_id = ? OR lower(recipient_email) = ? ORDER BY created_at DESC LIMIT 100", user.userId, lower(user.email)).all();
      return response({ notifications: rows.results });
    }
    const id = url.searchParams.get("id") ?? "";
    const { commission, role } = await getCommission(id, user);
    if (view === "detail") {
      const [milestones, submissions, attachments, events, showcase] = await Promise.all([
        statement("SELECT * FROM milestones WHERE commission_id = ? ORDER BY position", id).all(),
        statement("SELECT * FROM submissions WHERE commission_id = ? ORDER BY created_at DESC", id).all(),
        statement("SELECT id, commission_id, milestone_id, submission_id, filename, mime, bytes, created_at FROM attachments WHERE commission_id = ? ORDER BY created_at DESC", id).all(),
        statement("SELECT * FROM events WHERE commission_id = ? ORDER BY created_at DESC", id).all(),
        statement("SELECT * FROM showcase_entries WHERE commission_id = ?", id).first(),
      ]);
      return response({ commission, role, milestones: milestones.results, submissions: submissions.results, attachments: attachments.results, events: events.results, showcase });
    }
    if (view === "csv") {
      const rows = await statement("SELECT * FROM milestones WHERE commission_id = ? ORDER BY position", id).all<Milestone>();
      const content = [
        ["Project", "Artist", "Milestone", "Deliverable", "Target date", "Status", "Payout %", "Paid at", "Payment method"].map(csvCell).join(","),
        ...rows.results.map((m) => [commission.title, commission.artist_email, m.title, m.deliverable, m.due_date, m.status, m.payout_percent ?? "", m.paid_at ?? "", m.payment_method ?? ""].map(csvCell).join(",")),
      ].join("\r\n");
      return new Response(content, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="milestones-${id}.csv"`, "Cache-Control": "no-store" } });
    }
    throw new ApiError("Unknown view.", 404);
  } catch (error) { return handleError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await request.json().catch(() => { throw new ApiError("Send valid JSON."); }) as Record<string, unknown>;
    if (!body || typeof body !== "object") throw new ApiError("Send valid project data.");
    const action = body.action;
    if (action === "create") {
      const value = validateAward(body);
      if (lower(value.artistEmail) === lower(user.email)) throw new ApiError("Choose a different artist email.");
      const count = await statement("SELECT COUNT(*) AS count FROM commissions WHERE commissioner_id = ?", user.userId).first<{ count: number }>();
      if ((count?.count ?? 0) >= 25) throw new ApiError("This pilot supports up to 25 projects per commissioner.", 409);
      const id = uid(), timestamp = now();
      const writes = [statement(`INSERT INTO commissions (id, title, type, description, location, commissioner_id, commissioner_email, artist_email, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'invited', ?, ?)`, id, value.title, value.type, value.description, value.location, user.userId, lower(user.email), value.artistEmail, timestamp, timestamp),
        ...value.milestones.map((m, position) => statement(`INSERT INTO milestones (id, commission_id, position, title, deliverable, due_date, payout_percent, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`, uid(), id, position, m.title, m.deliverable, m.dueDate, m.payoutPercent)),
        eventStatement(id, null, user.userId, "award_created", "Milestone plan sent to the artist."),
        noticeStatement(id, null, value.artistEmail, "award_invite", `${user.displayName} invited you to agree on milestones for ${value.title}.`, `invite:${id}:1`)];
      await database().batch(writes);
      return response({ id }, 201);
    }
    if (action === "read_notification") {
      const id = clean(body.id, 100, "Notification");
      await statement("UPDATE notifications SET read_at = ? WHERE id = ? AND (recipient_id = ? OR lower(recipient_email) = ?)", now(), id, user.userId, lower(user.email)).run();
      return response({ ok: true });
    }
    const id = clean(body.id, 100, "Project");
    const { commission, role } = await getCommission(id, user);
    const timestamp = now();
    if (action === "accept") {
      requireRole(role, "artist");
      if (commission.status !== "invited") throw new ApiError("This plan is not awaiting acceptance.", 409);
      await database().batch([
        statement("UPDATE commissions SET status = 'active', artist_id = ?, updated_at = ? WHERE id = ? AND status = 'invited'", user.userId, timestamp, id),
        eventStatement(id, null, user.userId, "plan_accepted", "Artist accepted the milestone plan."),
        noticeStatement(id, commission.commissioner_id, commission.commissioner_email, "plan_accepted", `${user.displayName} accepted milestones for ${commission.title}.`, `accepted:${id}`),
      ]);
      return response({ ok: true });
    }
    if (action === "request_plan_change") {
      requireRole(role, "artist");
      if (commission.status !== "invited") throw new ApiError("This plan is not awaiting review.", 409);
      const note = clean(body.note, 1000, "Change request");
      await database().batch([
        statement("UPDATE commissions SET status = 'changes_requested', updated_at = ? WHERE id = ? AND status = 'invited'", timestamp, id),
        eventStatement(id, null, user.userId, "plan_change_requested", note),
        noticeStatement(id, commission.commissioner_id, commission.commissioner_email, "plan_change_requested", `${user.displayName} requested milestone changes for ${commission.title}.`, `plan-change:${id}:${timestamp}`),
      ]);
      return response({ ok: true });
    }
    if (action === "revise_plan") {
      requireRole(role, "commissioner");
      if (commission.status !== "changes_requested" && commission.status !== "invited") throw new ApiError("The active milestone plan cannot be replaced.", 409);
      const value = validateAward(body);
      const old = await statement("SELECT COUNT(*) AS count FROM submissions WHERE commission_id = ?", id).first<{ count: number }>();
      if (old?.count) throw new ApiError("A plan with submissions cannot be replaced.", 409);
      const writes = [statement("DELETE FROM milestones WHERE commission_id = ?", id),
        statement(`UPDATE commissions SET title = ?, type = ?, description = ?, location = ?, artist_email = ?, status = 'invited', updated_at = ? WHERE id = ?`, value.title, value.type, value.description, value.location, value.artistEmail, timestamp, id),
        ...value.milestones.map((m, position) => statement(`INSERT INTO milestones (id, commission_id, position, title, deliverable, due_date, payout_percent, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`, uid(), id, position, m.title, m.deliverable, m.dueDate, m.payoutPercent)),
        eventStatement(id, null, user.userId, "plan_revised", "Revised milestone plan sent to the artist."),
        noticeStatement(id, commission.artist_id, value.artistEmail, "plan_revised", `A revised milestone plan is ready for ${value.title}.`, `revised:${id}:${timestamp}`)];
      await database().batch(writes);
      return response({ ok: true });
    }
    if (action === "hold" || action === "resume") {
      if (action === "hold" && commission.status !== "active") throw new ApiError("Only active projects can be put on hold.", 409);
      if (action === "resume" && commission.status !== "hold") throw new ApiError("This project is not on hold.", 409);
      const note = action === "hold" ? clean(body.note, 1000, "Hold reason") : optional(body.note, 1000);
      await database().batch([
        statement("UPDATE commissions SET status = ?, hold_reason = ?, updated_at = ? WHERE id = ?", action === "hold" ? "hold" : "active", action === "hold" ? note : null, timestamp, id),
        eventStatement(id, null, user.userId, action === "hold" ? "project_on_hold" : "project_resumed", note),
      ]);
      return response({ ok: true });
    }
    if (action === "publish") {
      requireRole(role, "commissioner");
      if (commission.status !== "completed") throw new ApiError("Approve every milestone before publishing.", 409);
      const description = clean(body.description, 2000, "Showcase description");
      const artistName = clean(body.artistName, 120, "Artist name");
      const attachmentId = body.attachmentId ? clean(body.attachmentId, 100, "Image") : null;
      if (attachmentId) {
        const file = await statement("SELECT id, mime FROM attachments WHERE id = ? AND commission_id = ?", attachmentId, id).first<{ id: string; mime: string }>();
        if (!file || !file.mime.startsWith("image/")) throw new ApiError("Choose an image from this project.");
      }
      const exists = await statement("SELECT id FROM showcase_entries WHERE commission_id = ?", id).first();
      if (exists) throw new ApiError("This project is already in the showcase.", 409);
      await database().batch([
        statement("INSERT INTO showcase_entries (id, commission_id, title, artist_name, location, description, image_attachment_id, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", uid(), id, commission.title, artistName, commission.location, description, attachmentId, timestamp),
        eventStatement(id, null, user.userId, "showcase_published", "Project published to the showcase."),
      ]);
      return response({ ok: true });
    }
    const milestoneId = clean(body.milestoneId, 100, "Milestone");
    const milestone = await getMilestone(id, milestoneId);
    if (action === "submit") {
      requireRole(role, "artist");
      if (commission.status !== "active" || (milestone.status !== "pending" && milestone.status !== "revision_requested")) throw new ApiError("This milestone is not ready for submission.", 409);
      const note = clean(body.note, 2000, "Progress note");
      const attachmentIds = Array.isArray(body.attachmentIds) ? body.attachmentIds : [];
      if (attachmentIds.length > 5 || attachmentIds.some((value) => typeof value !== "string")) throw new ApiError("Attach up to five files.");
      if (attachmentIds.length) {
        const placeholders = attachmentIds.map(() => "?").join(",");
        const files = await statement(`SELECT id FROM attachments WHERE id IN (${placeholders}) AND commission_id = ? AND milestone_id = ? AND uploader_id = ? AND submission_id IS NULL`, ...attachmentIds, id, milestoneId, user.userId).all();
        if (files.results.length !== attachmentIds.length) throw new ApiError("An attachment is missing or already submitted.");
      }
      const submissionId = uid();
      await database().batch([
        statement("UPDATE milestones SET status = 'submitted', submitted_at = ? WHERE id = ? AND status IN ('pending', 'revision_requested')", timestamp, milestoneId),
        statement("INSERT INTO submissions (id, commission_id, milestone_id, author_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?)", submissionId, id, milestoneId, user.userId, note, timestamp),
        ...attachmentIds.map((fileId) => statement("UPDATE attachments SET submission_id = ? WHERE id = ?", submissionId, fileId)),
        eventStatement(id, milestoneId, user.userId, "milestone_submitted", note),
        noticeStatement(id, commission.commissioner_id, commission.commissioner_email, "milestone_submitted", `${milestone.title} is ready for review in ${commission.title}.`, `submitted:${milestoneId}:${submissionId}`),
      ]);
      return response({ ok: true });
    }
    if (action === "review") {
      requireRole(role, "commissioner");
      if (commission.status !== "active" || milestone.status !== "submitted") throw new ApiError("This milestone is not awaiting review.", 409);
      const decision = body.decision;
      if (decision !== "approve" && decision !== "revision") throw new ApiError("Choose approve or request revision.");
      const note = decision === "revision" ? clean(body.note, 1000, "Revision request") : optional(body.note, 1000);
      await database().batch([
        statement("UPDATE milestones SET status = ?, approved_at = ? WHERE id = ? AND status = 'submitted'", decision === "approve" ? "approved" : "revision_requested", decision === "approve" ? timestamp : null, milestoneId),
        eventStatement(id, milestoneId, user.userId, decision === "approve" ? "milestone_approved" : "revision_requested", note),
        noticeStatement(id, commission.artist_id, commission.artist_email, decision === "approve" ? "milestone_approved" : "revision_requested", `${milestone.title} was ${decision === "approve" ? "approved" : "sent back for revision"}.`, `review:${milestoneId}:${timestamp}`),
      ]);
      if (decision === "approve") {
        const remaining = await statement("SELECT COUNT(*) AS count FROM milestones WHERE commission_id = ? AND status != 'approved'", id).first<{ count: number }>();
        if (remaining?.count === 0) await database().batch([
          statement("UPDATE commissions SET status = 'completed', updated_at = ? WHERE id = ? AND status = 'active'", timestamp, id),
          eventStatement(id, null, user.userId, "project_completed", "Every milestone was approved."),
        ]);
      }
      return response({ ok: true });
    }
    if (action === "paid") {
      requireRole(role, "commissioner");
      if (milestone.status !== "approved" || milestone.paid_at) throw new ApiError("Approve this milestone before recording payment.", 409);
      const method = body.method;
      if (method !== "po" && method !== "check" && method !== "other") throw new ApiError("Choose a payment method.");
      const reference = optional(body.reference, 120);
      await database().batch([
        statement("UPDATE milestones SET paid_at = ?, payment_method = ?, payment_reference = ? WHERE id = ? AND paid_at IS NULL", timestamp, method, reference, milestoneId),
        eventStatement(id, milestoneId, user.userId, "payment_recorded", `${method}${reference ? `: ${reference}` : ""}`),
      ]);
      return response({ ok: true });
    }
    throw new ApiError("Unknown action.", 404);
  } catch (error) { return handleError(error); }
}

function handleError(error: unknown) {
  if (error instanceof ApiError) return response({ error: error.message }, error.status);
  if (error instanceof Error && /required|milestone|payout|date|text|choose|email|project details|complete every/i.test(error.message)) return response({ error: error.message }, 400);
  console.error(error);
  return response({ error: "The request could not be completed." }, 500);
}
