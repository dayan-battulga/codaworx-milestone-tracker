import { createDemoStore } from './demo-store.mjs';

const demo = createDemoStore();
const app = document.querySelector('#app');
const flash = document.querySelector('#flash');
const state = { user: null, list: [], notifications: [], templates: null, detail: null, creating: false };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const label = (value) => String(value || '').replaceAll('_', ' ');
const date = (value) => value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
const status = (value) => `<span class="pill ${esc(value)}">${esc(label(value))}</span>`;
const notify = (message, bad = false) => { flash.textContent = message; flash.className = `flash${bad ? ' error' : ''}`; flash.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => flash.hidden = true, 5500); };

async function api(view, id) {
  return demo.api(view, id);
}
async function action(name, payload = {}) {
  return demo.action(name, payload);
}

function fileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('codaworx-demo-files', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser cannot save demo attachments.'));
  });
}
async function clearDemoFiles() {
  const database = await fileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('files', 'readwrite');
    transaction.objectStore('files').clear();
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(new Error('Could not clear demo attachments.')); };
  });
}
async function fileOperation(mode, id, file) {
  const database = await fileDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('files', mode);
    const request = mode === 'readwrite' ? transaction.objectStore('files').put(file, id) : transaction.objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Could not access this demo attachment.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
  });
}
async function downloadFile(id) {
  const file = await fileOperation('readonly', id);
  if (!file) throw new Error('This file is no longer stored in this browser.');
  const url = URL.createObjectURL(file);
  const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function downloadCsv() {
  const d = state.detail, cells = (values) => values.map((value) => { const text = String(value ?? ''); return `"${(/^[\s]*[=+\-@]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`; }).join(',');
  const rows = [cells(['Project', 'Artist', 'Milestone', 'Deliverable', 'Target date', 'Status', 'Payout %', 'Paid at', 'Payment method']), ...d.milestones.map((m) => cells([d.commission.title, d.commission.artist_email, m.title, m.deliverable, m.due_date, m.status, m.payout_percent, m.paid_at, m.payment_method]))];
  const url = URL.createObjectURL(new Blob([`\uFEFF${rows.join('\r\n')}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = `milestones-${d.commission.id}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const currentId = () => decodeURIComponent(location.hash.slice(1));
const button = (text, command, cls = 'secondary', extra = '') => `<button class="${cls}" type="button" data-action="${command}" ${extra}>${text}</button>`;
const field = (name, text, value = '', opts = '') => `<label class="field">${text}<input name="${name}" value="${esc(value)}" ${opts}></label>`;
const textarea = (name, text, value = '', opts = '') => `<label class="field${opts.includes('span-2') ? ' span-2' : ''}">${text}<textarea name="${name}" ${opts}>${esc(value)}</textarea></label>`;

async function refresh() {
  try {
    const id = currentId();
    if (!state.templates) state.templates = await api('templates');
    const listing = await api('list');
    state.user = listing.user;
    state.list = listing.commissions;
    document.querySelectorAll('[data-role]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.role === demo.role())));
    if (id && id !== 'new') {
      state.detail = await api('detail', id);
      renderDetail();
    } else if (id === 'new') {
      if (demo.role() === 'commissioner') renderCreate();
      else app.innerHTML = `<div class="card empty"><h3>Commissioner action</h3><p>Switch to Commissioner view to create an award plan.</p><a href="#">Back to projects</a></div>`;
    } else {
      state.notifications = (await api('notifications')).notifications;
      renderList();
    }
  } catch (error) {
    app.innerHTML = `<div class="card empty"><h3>Could not load the demo</h3><p>${esc(error.message)}</p>${button('Try again', 'refresh')}</div>`;
  }
}

function renderList() {
  const counts = { active: 0, review: 0, hold: 0, completed: 0 };
  for (const row of state.list) {
    if (row.status === 'active') counts.active++;
    if (row.status === 'invited' || row.status === 'changes_requested') counts.review++;
    if (row.status === 'hold') counts.hold++;
    if (row.status === 'completed') counts.completed++;
  }
  const rows = state.list.map((row) => `<a class="card project-row" href="#${encodeURIComponent(row.id)}"><div class="project-row-top"><div><h3>${esc(row.title)}</h3><p>${esc(label(row.type))} · ${esc(row.location || 'Location not set')}</p></div>${status(row.status)}</div><div class="project-meta"><span>${row.commissioner_id === state.user.userId ? `Artist: ${esc(row.artist_email)}` : 'You are the artist'}</span><strong>${row.approved_count || 0} of ${row.milestone_count || 0} approved</strong></div><div class="progress"><span style="width:${row.milestone_count ? 100 * row.approved_count / row.milestone_count : 0}%"></span></div></a>`).join('');
  const notices = state.notifications.slice(0, 8).map((item) => `<div class="notice"><strong>${esc(label(item.kind))}${item.read_at ? '' : ' · New'}</strong><p>${esc(item.message)}</p><time>${date(item.created_at)}</time> ${!item.read_at ? `<button type="button" class="quiet small" data-action="read" data-id="${esc(item.id)}">Mark read</button>` : ''}</div>`).join('');
  app.innerHTML = `<div class="demo-note"><strong>Explore the milestone workflow.</strong> Switch between Commissioner and Artist above. Your changes and attachments stay in this browser; no account or invitation email is needed. <button type="button" data-action="reset">Reset sample projects</button></div><div class="page-head"><div><span class="eyebrow">Post-award workspace</span><h1>Demo projects</h1><p>You are viewing as ${esc(state.user.displayName)}. Follow each commission from agreement to final approval.</p></div>${demo.role() === 'commissioner' ? '<a href="#new" class="primary" style="text-decoration:none">+ Create award plan</a>' : ''}</div><div class="overview"><div class="card stat"><b>${state.list.length}</b><span>Total projects</span></div><div class="card stat"><b>${counts.active}</b><span>In progress</span></div><div class="card stat"><b>${counts.review}</b><span>Awaiting agreement</span></div><div class="card stat"><b>${counts.completed}</b><span>Completed</span></div></div><div class="layout"><section><div class="section-title"><h2>All commissions</h2><span class="subtle">${state.list.length} projects</span></div><div class="project-list">${rows || '<div class="card empty">No projects yet. Reset the sample projects to explore the demo.</div>'}</div></section><aside><div class="card side-card"><h2>Activity & reminders</h2>${notices || '<p class="subtle">No activity yet. Updates will appear here as you work together.</p>'}</div><div class="card side-card"><h2>Try this first</h2><p class="subtle">Open Riverfront Light Sculpture as Commissioner and review its first milestone. Then switch to Artist to accept the Community Garden Mural plan.</p></div></aside></div>`;
}

function milestoneInputs(m = {}, index = 0) {
  return `<div class="milestone-form" data-milestone><header><h3>Milestone ${index + 1}</h3><button type="button" class="quiet small" data-action="remove-milestone">Remove</button></header><div class="form-grid">${field('milestoneTitle', 'Name', m.title || '', 'required maxlength="120"')}${field('dueDate', 'Target date', m.dueDate || '', 'type="date" required')}${textarea('deliverable', 'Expected deliverable', m.deliverable || '', 'class="span-2" required maxlength="1000"')}${field('payoutPercent', 'Payout % (optional)', m.payoutPercent ?? '', 'type="number" min="0" max="100"')}</div></div>`;
}

function renderCreate(existing = null) {
  const commission = existing?.commission;
  const rows = existing?.milestones?.map((m) => ({ title: m.title, deliverable: m.deliverable, dueDate: m.due_date, payoutPercent: m.payout_percent })) || state.templates.sculpture.slice(0, 3).map((title) => ({ title }));
  app.innerHTML = `<a class="back" href="${commission ? `#${encodeURIComponent(commission.id)}` : '#'}">← Back to projects</a><div class="page-head"><div><span class="eyebrow">Award handoff</span><h1>${commission ? 'Revise milestone plan' : 'Create award plan'}</h1><p>Define the work before it begins. Your artist will review and accept the plan.</p></div></div><form id="award-form" class="card section-card"><div class="form-grid">${field('title', 'Project name', commission?.title, 'required maxlength="120"')}${field('artistEmail', 'Artist email', commission?.artist_email, 'type="email" required maxlength="200"')}<label class="field">Commission type<select name="type" id="commission-type"><option value="sculpture">Sculpture</option><option value="mural">Mural</option><option value="digital">Digital installation</option></select></label>${field('location', 'Location', commission?.location, 'maxlength="160"')}${textarea('description', 'Project brief', commission?.description, 'class="span-2" maxlength="2000"')}</div><div class="section-title" style="margin-top:30px"><h2>Milestones</h2>${button('+ Add milestone', 'add-milestone', 'secondary small')}</div><p class="form-help">Use 3–5 milestones. Dates must be in order. Payout percentages are optional; if used, enter all of them and make the total 100%.</p><div id="milestone-inputs">${rows.map(milestoneInputs).join('')}</div><div class="button-row" style="margin-top:22px"><button type="submit" class="primary">${commission ? 'Send revised plan' : 'Send plan to artist'}</button></div></form>`;
  document.querySelector('#commission-type').value = commission?.type || 'sculpture';
  document.querySelector('#commission-type').addEventListener('change', (event) => {
    if (commission) return;
    const names = state.templates[event.target.value];
    document.querySelectorAll('[name=milestoneTitle]').forEach((input, i) => { if (names[i]) input.value = names[i]; });
  });
  document.querySelector('#award-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const milestones = [...form.querySelectorAll('[data-milestone]')].map((el) => ({ title: el.querySelector('[name=milestoneTitle]').value, dueDate: el.querySelector('[name=dueDate]').value, deliverable: el.querySelector('[name=deliverable]').value, payoutPercent: el.querySelector('[name=payoutPercent]').value }));
    try {
      const result = await action(commission ? 'revise_plan' : 'create', { id: commission?.id, title: values.get('title'), artistEmail: values.get('artistEmail'), type: values.get('type'), location: values.get('location'), description: values.get('description'), milestones });
      notify(commission ? 'Revised demo plan is ready in Artist view.' : 'Demo plan created. Switch to Artist view to review it.');
      location.hash = commission?.id || result.id;
      await refresh();
    } catch (error) { notify(error.message, true); }
  });
}

function renderDetail() {
  const d = state.detail, c = d.commission;
  const approved = d.milestones.filter((m) => m.status === 'approved').length;
  const canWork = c.status === 'active';
  const milestoneHtml = d.milestones.map((m, i) => {
    const submissions = d.submissions.filter((s) => s.milestone_id === m.id);
    const history = submissions.map((s) => `<div class="submission"><strong>Submitted ${date(s.created_at)}</strong><p>${esc(s.note)}</p><div class="file-list">${d.attachments.filter((a) => a.submission_id === s.id).map((a) => `<button type="button" data-action="file" data-id="${esc(a.id)}">↗ ${esc(a.filename)}</button>`).join('')}</div></div>`).join('');
    let controls = '';
    if (d.role === 'artist' && canWork && (m.status === 'pending' || m.status === 'revision_requested')) controls = `<form class="work-form" data-id="${esc(m.id)}">${textarea('note', 'Progress note', '', 'required maxlength="2000"')}<label class="field" style="margin-top:12px">Attach files (up to 5, 20 MB each)<input name="files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.zip,.docx" /></label><div class="button-row" style="margin-top:13px"><button class="primary small" type="submit">Submit for review</button></div></form>`;
    if (d.role === 'commissioner' && canWork && m.status === 'submitted') controls = `<form class="review-form" data-id="${esc(m.id)}">${textarea('note', 'Review note (required for revision)', '', 'maxlength="1000"')}<div class="button-row" style="margin-top:12px"><button class="primary small" type="submit" name="decision" value="approve">Approve milestone</button><button class="secondary small" type="submit" name="decision" value="revision">Request revision</button></div></form>`;
    if (d.role === 'commissioner' && m.status === 'approved' && !m.paid_at) controls += `<form class="paid-form" data-id="${esc(m.id)}"><div class="form-grid"><label class="field">Payment method<select name="method"><option value="po">Purchase order</option><option value="check">Check</option><option value="other">Other</option></select></label>${field('reference', 'Reference (optional)', '', 'maxlength="120"')}</div><div class="button-row" style="margin-top:12px"><button class="secondary small" type="submit">Record payment</button></div></form>`;
    return `<article class="milestone"><div class="milestone-top"><div><span class="eyebrow">Phase ${i + 1} of ${d.milestones.length}</span><h3>${esc(m.title)}</h3><p>${esc(m.deliverable)}</p></div>${status(m.status)}</div><div class="milestone-meta"><span>Target ${date(m.due_date)}</span>${m.payout_percent !== null ? `<span>${m.payout_percent}% payout</span>` : ''}${m.paid_at ? `<span>Paid ${date(m.paid_at)} · ${esc(label(m.payment_method))}</span>` : ''}</div>${history}${controls}</article>`;
  }).join('');
  const agreement = c.status === 'invited' && d.role === 'artist' ? `<div class="card section-card"><h2>Review the plan</h2><p class="subtle">Check the deliverables and dates. Accept to start work or request changes first.</p><div class="button-row">${button('Accept plan', 'accept', 'primary')}${button('Request changes', 'request-plan-change')}</div></div>` : '';
  const canRevise = d.role === 'commissioner' && (c.status === 'invited' || c.status === 'changes_requested');
  const showcase = c.status === 'completed' && d.role === 'commissioner' && !d.showcase ? `<div class="card section-card"><h2>Publish to the showcase</h2><p class="form-help">Only publish work you have permission to display. The project title, location, artist name, description, and selected image will appear publicly.</p><form id="showcase-form">${field('artistName', 'Public artist name', '', 'required maxlength="120"')}${textarea('description', 'Showcase description', c.description, 'required maxlength="2000"')}<label class="field">Image (optional)<select name="attachmentId"><option value="">No image</option>${d.attachments.filter((a) => a.mime.startsWith('image/')).map((a) => `<option value="${esc(a.id)}">${esc(a.filename)}</option>`).join('')}</select></label><div class="button-row" style="margin-top:14px"><button type="submit" class="primary">Publish project</button></div></form></div>` : '';
  const actions = `<div class="card side-card actions"><h2>Project actions</h2><div class="button-row">${button('Download CSV', 'csv', 'secondary small')}${button('Print / PDF', 'print', 'secondary small')}${canRevise ? button('Revise plan', 'revise-plan', 'secondary small') : ''}${c.status === 'active' ? button('Put on hold', 'hold', 'secondary small') : ''}${c.status === 'hold' ? button('Resume work', 'resume', 'secondary small') : ''}</div>${c.hold_reason ? `<p class="muted-box">Hold reason: ${esc(c.hold_reason)}</p>` : ''}</div>`;
  app.innerHTML = `<a class="back" href="#">← All projects</a><div class="detail-head"><span class="eyebrow">${esc(label(c.type))} commission · ${d.role === 'artist' ? 'Artist view' : 'Commissioner view'}</span><div class="detail-lede"><div><h1>${esc(c.title)}</h1><p>${esc(c.location || 'Location not set')} · Artist: ${esc(c.artist_email)}</p></div>${status(c.status)}</div></div><div class="overview"><div class="card stat"><b>${approved}/${d.milestones.length}</b><span>Milestones approved</span></div><div class="card stat"><b>${d.milestones.length - approved}</b><span>Remaining</span></div><div class="card stat"><b>${d.submissions.length}</b><span>Submissions</span></div><div class="card stat"><b>${d.milestones.filter((m) => m.paid_at).length}</b><span>Payments recorded</span></div></div><div class="detail-layout"><div class="stack">${agreement}${c.status === 'changes_requested' ? `<div class="callout">The artist requested changes. The commissioner can revise the plan and send it for review again.</div>` : ''}${c.status === 'hold' ? `<div class="callout">Work is on hold. Submissions and reviews are paused until the project resumes.</div>` : ''}<section class="card section-card"><div class="section-title"><h2>Milestone plan</h2><span class="subtle">${approved} of ${d.milestones.length} approved</span></div>${milestoneHtml}</section>${showcase}</div><aside>${actions}<div class="card side-card"><h2>Activity history</h2><ol class="activity">${d.events.map((event) => `<li><strong>${esc(label(event.kind))}</strong>${event.note ? ` — ${esc(event.note)}` : ''}<time>${date(event.created_at)}</time></li>`).join('')}</ol></div>${d.showcase ? `<div class="card side-card"><h2>In the showcase</h2><p class="subtle">Published ${date(d.showcase.published_at)}.</p><a href="./index.html#projects">View gallery →</a></div>` : ''}</aside></div>`;
  bindDetailForms();
}

function bindDetailForms() {
  document.querySelectorAll('.work-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const id = state.detail.commission.id, milestoneId = form.dataset.id;
    const files = [...form.querySelector('[name=files]').files];
    if (files.length > 5) return notify('Attach up to five files.', true);
    const attachmentIds = [];
    try {
      form.querySelector('[type=submit]').disabled = true;
      for (const file of files) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Each file must be 20 MB or less.');
        if (!/\.(jpg|jpeg|png|webp|gif|pdf|zip|docx)$/i.test(file.name)) throw new Error('Use JPG, PNG, WebP, GIF, PDF, ZIP, or DOCX files.');
        const fileId = crypto.randomUUID();
        await fileOperation('readwrite', fileId, file);
        demo.addAttachment({ id: fileId, commissionId: id, milestoneId, filename: file.name, mime: file.type || 'application/octet-stream', bytes: file.size });
        attachmentIds.push(fileId);
      }
      await action('submit', { id, milestoneId, note: form.querySelector('[name=note]').value, attachmentIds });
      notify('Milestone sent for review.'); await refresh();
    } catch (error) { notify(error.message, true); form.querySelector('[type=submit]').disabled = false; }
  }));
  document.querySelectorAll('.review-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const decision = event.submitter?.value;
    try { await action('review', { id: state.detail.commission.id, milestoneId: form.dataset.id, decision, note: form.querySelector('[name=note]').value }); notify(decision === 'approve' ? 'Milestone approved.' : 'Revision requested.'); await refresh(); } catch (error) { notify(error.message, true); }
  }));
  document.querySelectorAll('.paid-form').forEach((form) => form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try { await action('paid', { id: state.detail.commission.id, milestoneId: form.dataset.id, method: data.get('method'), reference: data.get('reference') }); notify('Payment recorded.'); await refresh(); } catch (error) { notify(error.message, true); }
  }));
  document.querySelector('#showcase-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try { await action('publish', { id: state.detail.commission.id, artistName: data.get('artistName'), description: data.get('description'), attachmentId: data.get('attachmentId') }); notify('Published to the project gallery.'); await refresh(); } catch (error) { notify(error.message, true); }
  });
}

app.addEventListener('click', async (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const command = target.dataset.action;
  if (command === 'refresh') return refresh();
  if (command === 'csv') return downloadCsv();
  if (command === 'file') { try { await downloadFile(target.dataset.id); } catch (error) { notify(error.message, true); } return; }
  if (command === 'reset') { target.textContent = 'Confirm reset'; target.dataset.action = 'confirm-reset'; return; }
  if (command === 'confirm-reset') { try { await clearDemoFiles(); demo.reset(); location.hash = ''; await refresh(); notify('Sample projects restored.'); } catch (error) { notify(error.message, true); } return; }
  if (command === 'print') return window.print();
  if (command === 'add-milestone') {
    const box = document.querySelector('#milestone-inputs');
    if (box.children.length >= 5) return notify('Use no more than five milestones.', true);
    box.insertAdjacentHTML('beforeend', milestoneInputs({}, box.children.length)); return;
  }
  if (command === 'remove-milestone') {
    const box = document.querySelector('#milestone-inputs');
    if (box.children.length <= 3) return notify('Use at least three milestones.', true);
    target.closest('[data-milestone]').remove();
    box.querySelectorAll('h3').forEach((el, i) => el.textContent = `Milestone ${i + 1}`); return;
  }
  if (command === 'revise-plan') return renderCreate(state.detail);
  if (command === 'read') { try { await action('read_notification', { id: target.dataset.id }); await refresh(); } catch (error) { notify(error.message, true); } return; }
  if (command === 'request-plan-change' || command === 'hold') {
    const note = prompt(command === 'hold' ? 'Why is this project going on hold?' : 'What needs to change in the plan?');
    if (note === null) return;
    try { await action(command === 'hold' ? 'hold' : 'request_plan_change', { id: state.detail.commission.id, note }); notify('Your update was recorded.'); await refresh(); } catch (error) { notify(error.message, true); } return;
  }
  if (command === 'accept' || command === 'resume') {
    try { await action(command, { id: state.detail.commission.id }); notify(command === 'accept' ? 'Plan accepted. Work can begin.' : 'Project resumed.'); await refresh(); } catch (error) { notify(error.message, true); }
  }
});
document.querySelectorAll('[data-role]').forEach((button) => button.addEventListener('click', async () => { demo.setRole(button.dataset.role); await refresh(); }));
addEventListener('hashchange', refresh);
refresh();
