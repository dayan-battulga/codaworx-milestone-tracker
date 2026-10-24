const KEY = 'codaworx-milestone-demo-v1';
const templates = {
  sculpture: ['Concept & design approval', 'Fabrication', 'Installation & handoff'],
  mural: ['Concept & mockups', 'Surface preparation & painting', 'Final review & handoff'],
  digital: ['Creative concept', 'Prototype & testing', 'Installation & handoff'],
};
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const required = (value, name, max = 2000) => {
  const text = String(value ?? '').trim();
  if (!text || text.length > max) throw new Error(`${name} is required (up to ${max} characters).`);
  return text;
};

function validatePlan(body) {
  const title = required(body.title, 'Project name', 120);
  const artistEmail = required(body.artistEmail, 'Artist email', 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(artistEmail)) throw new Error('Enter a valid artist email.');
  if (!templates[body.type]) throw new Error('Choose a commission type.');
  if (!Array.isArray(body.milestones) || body.milestones.length < 3 || body.milestones.length > 5) throw new Error('Use 3–5 milestones.');
  const milestones = body.milestones.map((m) => ({
    title: required(m.title, 'Milestone name', 120),
    deliverable: required(m.deliverable, 'Expected deliverable', 1000),
    due_date: required(m.dueDate, 'Target date', 10),
    payout_percent: m.payoutPercent === '' || m.payoutPercent == null ? null : Number(m.payoutPercent),
  }));
  if (milestones.some((m) => !/^\d{4}-\d{2}-\d{2}$/.test(m.due_date) || Number.isNaN(Date.parse(`${m.due_date}T00:00:00Z`)))) throw new Error('Enter valid target dates.');
  if (milestones.some((m, i) => i && m.due_date < milestones[i - 1].due_date)) throw new Error('Target dates must be in order.');
  const payouts = milestones.map((m) => m.payout_percent);
  if (payouts.some((n) => n !== null) && (payouts.some((n) => n === null || !Number.isFinite(n) || n < 0 || n > 100) || payouts.reduce((a, b) => a + b, 0) !== 100)) throw new Error('Payout percentages must be entered for every milestone and total 100%.');
  return { title, artist_email: artistEmail, type: body.type, location: String(body.location ?? '').trim().slice(0, 160), description: String(body.description ?? '').trim().slice(0, 2000), milestones };
}

function seed() {
  const created = now();
  const projects = [
    { id: 'demo-riverfront', title: 'Riverfront Light Sculpture', type: 'sculpture', location: 'Chicago, IL', description: 'A welcoming light sculpture for a public riverfront plaza.', status: 'active', milestoneTitles: templates.sculpture, milestoneStatus: ['submitted', 'pending', 'pending'] },
    { id: 'demo-garden', title: 'Community Garden Mural', type: 'mural', location: 'Oak Park, IL', description: 'A colorful mural inspired by neighborhood gardens.', status: 'invited', milestoneTitles: templates.mural, milestoneStatus: ['pending', 'pending', 'pending'] },
  ];
  const commissions = projects.map((p) => ({ id: p.id, title: p.title, type: p.type, location: p.location, description: p.description, status: p.status, commissioner_id: 'demo-commissioner', commissioner_email: 'commissioner@example.com', artist_id: p.status === 'active' ? 'demo-artist' : null, artist_email: 'artist@example.com', hold_reason: null, created_at: created, updated_at: created }));
  const milestones = projects.flatMap((p) => p.milestoneTitles.map((title, position) => ({ id: `${p.id}-${position + 1}`, commission_id: p.id, position, title, deliverable: position === 0 ? 'Share sketches, material choices, and an agreed direction.' : position === 1 ? 'Document the work in progress and key decisions.' : 'Deliver the finished work and handoff notes.', due_date: daysFromNow((position + 1) * 21), payout_percent: [30, 40, 30][position], status: p.milestoneStatus[position], submitted_at: p.id === 'demo-riverfront' && position === 0 ? created : null, approved_at: null, paid_at: null, payment_method: null, payment_reference: null })));
  return { role: 'commissioner', commissions, milestones, submissions: [{ id: 'demo-submission', commission_id: 'demo-riverfront', milestone_id: 'demo-riverfront-1', author_id: 'demo-artist', note: 'Initial sketches and lighting approach are ready for review.', created_at: created }], attachments: [], events: [{ id: uid(), commission_id: 'demo-riverfront', milestone_id: 'demo-riverfront-1', actor_id: 'demo-artist', kind: 'milestone_submitted', note: 'Initial sketches and lighting approach are ready for review.', created_at: created }, { id: uid(), commission_id: 'demo-garden', milestone_id: null, actor_id: 'demo-commissioner', kind: 'award_created', note: 'Milestone plan sent to the artist.', created_at: created }], notifications: [{ id: uid(), commission_id: 'demo-riverfront', recipient: 'commissioner', kind: 'milestone_submitted', message: 'Concept & design approval is ready for review.', created_at: created, read_at: null }, { id: uid(), commission_id: 'demo-garden', recipient: 'artist', kind: 'award_invite', message: 'A milestone plan is ready for your review.', created_at: created, read_at: null }], showcase: [] };
}

export function createDemoStore(storage = localStorage) {
  let db;
  try { db = JSON.parse(storage.getItem(KEY)); } catch { /* use sample data */ }
  if (!db || !Array.isArray(db.commissions)) db = seed();
  const save = () => { try { storage.setItem(KEY, JSON.stringify(db)); } catch { throw new Error('Browser storage is full or unavailable. Export your work before resetting the demo.'); } };
  save();
  const role = () => db.role === 'artist' ? 'artist' : 'commissioner';
  const actor = () => role() === 'artist' ? 'demo-artist' : 'demo-commissioner';
  const project = (id) => { const value = db.commissions.find((c) => c.id === id); if (!value) throw new Error('Project not found.'); return value; };
  const milestone = (id, milestoneId) => { const value = db.milestones.find((m) => m.id === milestoneId && m.commission_id === id); if (!value) throw new Error('Milestone not found.'); return value; };
  const needs = (wanted) => { if (role() !== wanted) throw new Error(`Switch to ${wanted} view to do that.`); };
  const event = (id, milestoneId, kind, note = '') => db.events.unshift({ id: uid(), commission_id: id, milestone_id: milestoneId, actor_id: actor(), kind, note, created_at: now() });
  const notice = (id, recipient, kind, message) => db.notifications.unshift({ id: uid(), commission_id: id, recipient, kind, message, created_at: now(), read_at: null });
  const addMilestones = (id, values) => db.milestones.push(...values.map((m, position) => ({ ...m, id: uid(), commission_id: id, position, status: 'pending', submitted_at: null, approved_at: null, paid_at: null, payment_method: null, payment_reference: null })));
  return {
    role,
    setRole(next) { if (!['commissioner', 'artist'].includes(next)) return; db.role = next; save(); },
    reset() { db = seed(); save(); },
    api(view, id) {
      if (view === 'templates') return templates;
      if (view === 'list') return { user: { userId: actor(), displayName: role() === 'artist' ? 'Demo Artist' : 'Demo Commissioner' }, commissions: db.commissions.map((c) => ({ ...c, milestone_count: db.milestones.filter((m) => m.commission_id === c.id).length, approved_count: db.milestones.filter((m) => m.commission_id === c.id && m.status === 'approved').length })).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
      if (view === 'notifications') return { notifications: db.notifications.filter((n) => n.recipient === role()) };
      if (view === 'detail') return { commission: project(id), role: role(), milestones: db.milestones.filter((m) => m.commission_id === id).sort((a, b) => a.position - b.position), submissions: db.submissions.filter((s) => s.commission_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)), attachments: db.attachments.filter((a) => a.commission_id === id), events: db.events.filter((e) => e.commission_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)), showcase: db.showcase.find((s) => s.commission_id === id) ?? null };
      if (view === 'showcase') return { entries: db.showcase };
      throw new Error('Unknown demo view.');
    },
    action(name, body = {}) {
      if (name === 'read_notification') { const item = db.notifications.find((n) => n.id === body.id && n.recipient === role()); if (item) item.read_at = now(); save(); return { ok: true }; }
      if (name === 'create') {
        needs('commissioner');
        const value = validatePlan(body), id = uid();
        db.commissions.unshift({ id, title: value.title, type: value.type, description: value.description, location: value.location, commissioner_id: actor(), commissioner_email: 'commissioner@example.com', artist_id: null, artist_email: value.artist_email, status: 'invited', hold_reason: null, created_at: now(), updated_at: now() });
        addMilestones(id, value.milestones); event(id, null, 'award_created', 'Demo plan created.'); notice(id, 'artist', 'award_invite', `Review the plan for ${value.title}.`); save(); return { id };
      }
      const c = project(body.id), timestamp = now();
      if (name === 'accept' || name === 'request_plan_change') {
        needs('artist'); if (c.status !== 'invited') throw new Error('This plan is not awaiting artist review.');
        const note = name === 'accept' ? 'Artist accepted the milestone plan.' : required(body.note, 'Change request', 1000);
        c.status = name === 'accept' ? 'active' : 'changes_requested'; if (name === 'accept') c.artist_id = actor();
        event(c.id, null, name === 'accept' ? 'plan_accepted' : 'plan_change_requested', note); notice(c.id, 'commissioner', name, `${c.title}: ${note}`);
      } else if (name === 'revise_plan') {
        needs('commissioner'); if (!['invited', 'changes_requested'].includes(c.status)) throw new Error('Only a pending plan can be revised.');
        const value = validatePlan(body); Object.assign(c, { title: value.title, type: value.type, description: value.description, location: value.location, artist_email: value.artist_email, status: 'invited' });
        db.milestones = db.milestones.filter((m) => m.commission_id !== c.id); addMilestones(c.id, value.milestones); event(c.id, null, 'plan_revised', 'Revised plan ready for artist review.'); notice(c.id, 'artist', 'plan_revised', `Review the revised plan for ${c.title}.`);
      } else if (name === 'hold' || name === 'resume') {
        if (name === 'hold' && c.status !== 'active' || name === 'resume' && c.status !== 'hold') throw new Error('This project cannot change hold status now.');
        const reason = name === 'hold' ? required(body.note, 'Hold reason', 1000) : null;
        c.status = name === 'hold' ? 'hold' : 'active'; c.hold_reason = reason; event(c.id, null, name === 'hold' ? 'project_on_hold' : 'project_resumed', reason || 'Work resumed.');
      } else if (name === 'publish') {
        needs('commissioner'); if (c.status !== 'completed' || db.showcase.some((s) => s.commission_id === c.id)) throw new Error('Approve all milestones before publishing once.');
        const artistName = required(body.artistName, 'Artist name', 120), description = required(body.description, 'Showcase description', 2000);
        if (body.attachmentId && !db.attachments.some((a) => a.id === body.attachmentId && a.commission_id === c.id && a.mime.startsWith('image/'))) throw new Error('Choose an image from this project.');
        db.showcase.unshift({ id: uid(), commission_id: c.id, title: c.title, artist_name: artistName, location: c.location, description, image_attachment_id: body.attachmentId || null, published_at: timestamp }); event(c.id, null, 'showcase_published', 'Added to this browser’s demo gallery.');
      } else {
        const m = milestone(c.id, body.milestoneId);
        if (name === 'submit') {
          needs('artist'); if (c.status !== 'active' || !['pending', 'revision_requested'].includes(m.status)) throw new Error('This milestone is not ready for submission.');
          const note = required(body.note, 'Progress note');
          const ids = body.attachmentIds || []; if (ids.length > 5 || ids.some((id) => !db.attachments.some((a) => a.id === id && a.commission_id === c.id && a.milestone_id === m.id && !a.submission_id))) throw new Error('An attachment is missing or already submitted.');
          const submissionId = uid(); db.submissions.unshift({ id: submissionId, commission_id: c.id, milestone_id: m.id, author_id: actor(), note, created_at: timestamp }); db.attachments.filter((a) => ids.includes(a.id)).forEach((a) => a.submission_id = submissionId); m.status = 'submitted'; m.submitted_at = timestamp; event(c.id, m.id, 'milestone_submitted', note); notice(c.id, 'commissioner', 'milestone_submitted', `${m.title} is ready for review.`);
        } else if (name === 'review') {
          needs('commissioner'); if (c.status !== 'active' || m.status !== 'submitted') throw new Error('This milestone is not awaiting review.');
          if (!['approve', 'revision'].includes(body.decision)) throw new Error('Choose approve or request revision.');
          const note = body.decision === 'revision' ? required(body.note, 'Revision request', 1000) : String(body.note ?? '').trim().slice(0, 1000);
          m.status = body.decision === 'approve' ? 'approved' : 'revision_requested'; m.approved_at = body.decision === 'approve' ? timestamp : null; event(c.id, m.id, body.decision === 'approve' ? 'milestone_approved' : 'revision_requested', note); notice(c.id, 'artist', m.status, `${m.title} was ${body.decision === 'approve' ? 'approved' : 'sent back for revision'}.`);
          if (db.milestones.filter((row) => row.commission_id === c.id).every((row) => row.status === 'approved')) { c.status = 'completed'; event(c.id, null, 'project_completed', 'Every milestone was approved.'); }
        } else if (name === 'paid') {
          needs('commissioner'); if (m.status !== 'approved' || m.paid_at) throw new Error('Approve the milestone before recording payment.');
          if (!['po', 'check', 'other'].includes(body.method)) throw new Error('Choose a payment method.');
          m.paid_at = timestamp; m.payment_method = body.method; m.payment_reference = String(body.reference ?? '').trim().slice(0, 120); event(c.id, m.id, 'payment_recorded', `${body.method}${m.payment_reference ? `: ${m.payment_reference}` : ''}`);
        } else throw new Error('Unknown demo action.');
      }
      c.updated_at = timestamp; save(); return { ok: true };
    },
    addAttachment({ commissionId, milestoneId, filename, mime, bytes, id }) {
      milestone(commissionId, milestoneId);
      db.attachments.push({ id, commission_id: commissionId, milestone_id: milestoneId, submission_id: null, filename, mime, bytes, created_at: now() }); save();
    },
  };
}
