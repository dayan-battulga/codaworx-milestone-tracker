export const templates = {
  sculpture: ["Site prep & concept sign-off", "Design approval", "Fabrication review", "Delivery & installation", "Final acceptance"],
  mural: ["Site survey & concept", "Design approval", "Surface preparation", "Painting & progress review", "Final acceptance"],
  digital: ["Requirements & concept", "Prototype review", "Production build", "Installation & testing", "Final acceptance"],
} as const;

export type MilestoneInput = { title: string; deliverable: string; dueDate: string; payoutPercent: number | null };

export function validateAward(input: unknown): { title: string; type: keyof typeof templates; description: string; location: string; artistEmail: string; milestones: MilestoneInput[] } {
  if (!input || typeof input !== "object") throw new Error("Enter the project details.");
  const value = input as Record<string, unknown>;
  const title = clean(value.title, 120, "Project name");
  const type = value.type;
  if (type !== "sculpture" && type !== "mural" && type !== "digital") throw new Error("Choose a commission type.");
  const artistEmail = clean(value.artistEmail, 200, "Artist email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artistEmail)) throw new Error("Enter a valid artist email.");
  const description = optional(value.description, 2000);
  const location = optional(value.location, 160);
  if (!Array.isArray(value.milestones) || value.milestones.length < 3 || value.milestones.length > 5) throw new Error("Use 3 to 5 milestones.");
  const milestones = value.milestones.map((row: unknown) => {
    if (!row || typeof row !== "object") throw new Error("Complete every milestone.");
    const item = row as Record<string, unknown>;
    const title = clean(item.title, 120, "Milestone name");
    const deliverable = clean(item.deliverable, 1000, "Deliverable description");
    const dueDate = clean(item.dueDate, 10, "Target date");
    const parsedDate = Date.parse(`${dueDate}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !Number.isFinite(parsedDate) || new Date(parsedDate).toISOString().slice(0, 10) !== dueDate) throw new Error("Use valid target dates.");
    const payoutPercent = item.payoutPercent === "" || item.payoutPercent === null || item.payoutPercent === undefined ? null : Number(item.payoutPercent);
    if (payoutPercent !== null && (!Number.isInteger(payoutPercent) || payoutPercent < 0 || payoutPercent > 100)) throw new Error("Payout percentages must be whole numbers from 0 to 100.");
    return { title, deliverable, dueDate, payoutPercent };
  });
  const percentages = milestones.map((row) => row.payoutPercent);
  if (percentages.some((value) => value !== null) && (percentages.some((value) => value === null) || percentages.reduce<number>((sum, value) => sum + (value ?? 0), 0) !== 100)) {
    throw new Error("When payout percentages are used, every milestone needs one and the total must be 100%.");
  }
  for (let index = 1; index < milestones.length; index++) {
    if (milestones[index].dueDate < milestones[index - 1].dueDate) throw new Error("Milestone dates must be in order.");
  }
  return { title, type, description, location, artistEmail, milestones };
}

export function clean(value: unknown, max: number, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) throw new Error(`${label} is required and must be ${max} characters or fewer.`);
  return value.trim();
}

export function optional(value: unknown, max: number): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || value.trim().length > max) throw new Error(`Text must be ${max} characters or fewer.`);
  return value.trim();
}

export function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
