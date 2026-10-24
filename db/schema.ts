import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const commissions = sqliteTable("commissions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull().default(""),
  location: text("location").notNull().default(""),
  commissionerId: text("commissioner_id").notNull(),
  commissionerEmail: text("commissioner_email").notNull(),
  artistEmail: text("artist_email").notNull(),
  artistId: text("artist_id"),
  status: text("status").notNull().default("invited"),
  holdReason: text("hold_reason"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const milestones = sqliteTable("milestones", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id),
  position: integer("position").notNull(),
  title: text("title").notNull(),
  deliverable: text("deliverable").notNull(),
  dueDate: text("due_date").notNull(),
  payoutPercent: integer("payout_percent"),
  status: text("status").notNull().default("pending"),
  submittedAt: text("submitted_at"),
  approvedAt: text("approved_at"),
  paidAt: text("paid_at"),
  paymentMethod: text("payment_method"),
  paymentReference: text("payment_reference"),
});

export const submissions = sqliteTable("submissions", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id),
  milestoneId: text("milestone_id").notNull().references(() => milestones.id),
  authorId: text("author_id").notNull(),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id),
  milestoneId: text("milestone_id").notNull().references(() => milestones.id),
  submissionId: text("submission_id").references(() => submissions.id),
  uploaderId: text("uploader_id").notNull(),
  objectKey: text("object_key").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: text("created_at").notNull(),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id),
  milestoneId: text("milestone_id").references(() => milestones.id),
  actorId: text("actor_id").notNull(),
  kind: text("kind").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id),
  recipientId: text("recipient_id"),
  recipientEmail: text("recipient_email").notNull(),
  kind: text("kind").notNull(),
  message: text("message").notNull(),
  dedupeKey: text("dedupe_key").notNull(),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull(),
}, (table) => [uniqueIndex("notifications_dedupe_key_unique").on(table.dedupeKey)]);

export const showcaseEntries = sqliteTable("showcase_entries", {
  id: text("id").primaryKey(),
  commissionId: text("commission_id").notNull().references(() => commissions.id).unique(),
  title: text("title").notNull(),
  artistName: text("artist_name").notNull(),
  location: text("location").notNull(),
  description: text("description").notNull(),
  imageAttachmentId: text("image_attachment_id").references(() => attachments.id),
  publishedAt: text("published_at").notNull(),
});
