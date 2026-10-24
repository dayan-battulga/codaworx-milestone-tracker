const projects = window.codaworxProjects;

const $ = (selector) => document.querySelector(selector);
const asset = (name) => `./assets/${encodeURIComponent(name)}`;
const stored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
};
const persist = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { /* The page still works when browser storage is unavailable. */ }
};

const extraProjects = stored('codaworx-projects', []);
const demoShowcase = stored('codaworx-milestone-demo-v1', {}).showcase || [];
const showcaseProjects = demoShowcase.map((item) => [item.title, item.location || 'Completed commission', item.artist_name, 'showcase-placeholder.svg']);
const savedProjects = new Set(stored('codaworx-saved', []));
const grid = $('#project-grid');
let query = '';
let searchType = 'all';
let savedOnly = false;
let visibleCount = 12;
let activeProject = null;

const allProjects = () => [...showcaseProjects, ...extraProjects, ...projects];
const projectId = (project) => `${project[0]}|${project[1]}`;
const projectImage = (project) => project[3]?.startsWith('https://') || project[3]?.startsWith('http://') || project[3]?.startsWith('/api/') || project[3]?.startsWith('blob:') ? project[3] : asset(project[3] || 'DL10.webp');
const matches = (project) => {
  if (savedOnly && !savedProjects.has(projectId(project))) return false;
  if (!query) return true;
  const fields = searchType === 'title' ? [project[0]] : searchType === 'location' ? [project[1]] : searchType === 'artist' ? [project[2]] : project.slice(0, 3);
  return fields.some((field) => field.toLocaleLowerCase().includes(query));
};

function updateSaveButtons(project) {
  const id = projectId(project);
  document.querySelectorAll('[data-project-id]').forEach((button) => {
    if (button.dataset.projectId !== id) return;
    const isSaved = savedProjects.has(id);
    button.setAttribute('aria-pressed', String(isSaved));
    if (button.classList.contains('save-button')) button.textContent = isSaved ? 'SAVED' : 'SAVE';
    if (button.id === 'dialog-save') button.textContent = isSaved ? 'Saved project' : 'Save project';
  });
}

function toggleSave(project) {
  const id = projectId(project);
  savedProjects.has(id) ? savedProjects.delete(id) : savedProjects.add(id);
  persist('codaworx-saved', [...savedProjects]);
  if (savedOnly) render(); else updateSaveButtons(project);
}

function projectCard(project) {
  const card = document.createElement('article');
  card.className = 'project-card';

  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'project-image-button';
  imageButton.setAttribute('aria-label', `View ${project[0]}`);
  const image = document.createElement('img');
  image.src = projectImage(project);
  image.alt = project[0];
  image.loading = 'lazy';
  imageButton.append(image);
  const overlay = document.createElement('span');
  overlay.className = 'image-overlay';
  overlay.textContent = 'VIEW PROJECT';
  imageButton.append(overlay);
  const artist = document.createElement('span');
  artist.className = 'artist-chip';
  if (project[4]) {
    const avatar = document.createElement('img');
    avatar.src = asset(project[4]);
    avatar.alt = '';
    artist.append(avatar);
  } else {
    const initials = document.createElement('span');
    initials.className = 'artist-initials';
    initials.textContent = project[2].split(' ').slice(0, 2).map((word) => word[0]).join('').toUpperCase();
    artist.append(initials);
  }
  artist.append(document.createTextNode(project[2]));
  imageButton.append(artist);
  imageButton.addEventListener('click', () => openProject(project));

  const info = document.createElement('div');
  info.className = 'project-info';
  const copy = document.createElement('div');
  copy.className = 'project-copy';
  const title = document.createElement('h3');
  title.textContent = project[0];
  title.title = project[0];
  const location = document.createElement('p');
  location.textContent = project[1];
  if (['Daisy Lane Portal', 'Parallels / Interactive Light Installation', 'Arc ZERO at City Place', 'Convergence Well Being Wall', 'Chairwave, Poem Booth, and Roast Booth', 'Équinoxe Chromatique', 'Tulips - The Magnificent Mile Association', 'Flight of Butterflies - Peggy Notebaert Nature Museum'].includes(project[0])) {
    const temp = document.createElement('span');
    temp.className = 'temp-tag';
    temp.textContent = 'TEMP';
    location.append(temp);
  }
  copy.append(title, location);
  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const heart = document.createElement('button');
  heart.type = 'button';
  heart.className = 'heart-button';
  heart.dataset.projectId = projectId(project);
  heart.setAttribute('aria-label', `Save ${project[0]}`);
  heart.setAttribute('aria-pressed', String(savedProjects.has(projectId(project))));
  heart.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5c-2.3-2-8.3-7.1-9.3-9.9C1.4 7 3.5 4 6.7 4c2.1 0 4 1.2 5.3 3 1.3-1.8 3.2-3 5.3-3 3.2 0 5.3 3 4 6.6-1 2.8-7 7.9-9.3 9.9Z" stroke-linejoin="round"/></svg>';
  heart.addEventListener('click', () => toggleSave(project));
  const save = document.createElement('button');
  save.type = 'button';
  save.className = 'save-button';
  save.dataset.projectId = projectId(project);
  save.setAttribute('aria-pressed', String(savedProjects.has(projectId(project))));
  save.textContent = savedProjects.has(projectId(project)) ? 'SAVED' : 'SAVE';
  save.addEventListener('click', () => toggleSave(project));
  actions.append(heart, save);
  info.append(copy, actions);
  card.append(imageButton, info);
  return card;
}

function spotlightCard() {
  const card = document.createElement('article');
  card.className = 'spotlight-card';
  card.id = 'spotlight';
  card.innerHTML = '<div class="spotlight-content"><h3>Community spotlight:</h3><p>Read our interview with Kelly Nunes, a creative director and multidisciplinary artist.</p><a href="https://knowledge.codaworx.com/codazine" target="_blank" rel="noopener noreferrer">Read on CODAzine</a></div>';
  return card;
}

function render() {
  const filtered = allProjects().filter(matches);
  const shown = filtered.slice(0, visibleCount);
  grid.replaceChildren();
  shown.forEach((project, index) => {
    if (index === 2 && !savedOnly && !query) grid.append(spotlightCard());
    grid.append(projectCard(project));
  });
  $('#load-more').hidden = shown.length >= filtered.length;
  $('#empty-state').hidden = filtered.length > 0;
  $('#results-summary').textContent = query || savedOnly ? `${filtered.length} ${filtered.length === 1 ? 'project' : 'projects'}${savedOnly ? ' saved' : ' found'}` : '';
  $('#feed-heading').textContent = savedOnly ? 'Saved projects' : query ? 'Search results' : 'Recommended for you';
}

function openProject(project) {
  activeProject = project;
  $('#dialog-image').src = projectImage(project);
  $('#dialog-image').alt = project[0];
  $('#dialog-artist').textContent = project[2];
  $('#dialog-title').textContent = project[0];
  $('#dialog-location').textContent = project[1];
  const save = $('#dialog-save');
  save.dataset.projectId = projectId(project);
  save.setAttribute('aria-pressed', String(savedProjects.has(projectId(project))));
  save.textContent = savedProjects.has(projectId(project)) ? 'Saved project' : 'Save project';
  $('#project-dialog').showModal();
}

$('#search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  query = $('#search-input').value.trim().toLocaleLowerCase();
  searchType = $('#search-type').value;
  savedOnly = false;
  $('#personalize-button').setAttribute('aria-pressed', 'false');
  visibleCount = 12;
  render();
  $('#projects').scrollIntoView({ behavior: 'smooth' });
});
$('#clear-search').addEventListener('click', () => {
  query = '';
  $('#search-input').value = '';
  visibleCount = 12;
  render();
});
$('#load-more').addEventListener('click', () => { visibleCount += 12; render(); });
$('#personalize-button').addEventListener('click', () => {
  savedOnly = !savedOnly;
  query = '';
  $('#search-input').value = '';
  $('#personalize-button').setAttribute('aria-pressed', String(savedOnly));
  visibleCount = 12;
  render();
});
$('#show-saved-menu').addEventListener('click', () => {
  savedOnly = true;
  query = '';
  $('#personalize-button').setAttribute('aria-pressed', 'true');
  $('.profile-menu').open = false;
  render();
  $('#projects').scrollIntoView({ behavior: 'smooth' });
});
$('#dialog-save').addEventListener('click', () => { if (activeProject) toggleSave(activeProject); });

document.querySelectorAll('[data-open-upload]').forEach((button) => button.addEventListener('click', () => $('#upload-dialog').showModal()));
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); }));
$('#upload-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const image = String(form.get('image') || '').trim();
  const project = [String(form.get('title')).trim(), String(form.get('location')).trim(), String(form.get('artist')).trim(), image];
  if (!project[0] || !project[1] || !project[2]) return;
  if (image && !/^https?:\/\//i.test(image)) return;
  extraProjects.unshift(project);
  persist('codaworx-projects', extraProjects);
  event.currentTarget.reset();
  $('#upload-dialog').close();
  savedOnly = false;
  query = '';
  $('#search-input').value = '';
  visibleCount = 12;
  render();
  $('#projects').scrollIntoView({ behavior: 'smooth' });
});

$('#chat-button').addEventListener('click', () => {
  const panel = $('#chat-panel');
  panel.hidden = !panel.hidden;
  $('#chat-button').setAttribute('aria-expanded', String(!panel.hidden));
});
$('#close-chat').addEventListener('click', () => {
  $('#chat-panel').hidden = true;
  $('#chat-button').setAttribute('aria-expanded', 'false');
});
$('#mobile-menu-button').addEventListener('click', () => {
  const isOpen = $('#main-nav').classList.toggle('is-open');
  $('#mobile-menu-button').setAttribute('aria-expanded', String(isOpen));
  $('#mobile-menu-button').setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
});
document.querySelectorAll('.main-nav a').forEach((link) => link.addEventListener('click', () => {
  $('#main-nav').classList.remove('is-open');
  $('#mobile-menu-button').setAttribute('aria-expanded', 'false');
}));
document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('[data-language]').forEach((choice) => choice.removeAttribute('aria-current'));
  button.setAttribute('aria-current', 'true');
  $('.language-menu summary').childNodes[1].textContent = ` ${button.dataset.language.toUpperCase()} `;
  $('.language-menu').open = false;
}));
render();
if (demoShowcase.some((item) => item.image_attachment_id)) {
  const request = indexedDB.open('codaworx-demo-files', 1);
  request.onsuccess = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains('files')) return;
    demoShowcase.forEach((item, index) => {
      if (!item.image_attachment_id) return;
      const fileRequest = database.transaction('files', 'readonly').objectStore('files').get(item.image_attachment_id);
      fileRequest.onsuccess = () => { if (fileRequest.result) { showcaseProjects[index][3] = URL.createObjectURL(fileRequest.result); render(); } };
    });
  };
}
fetch('/api/tracker?view=showcase').then((response) => response.ok ? response.json() : null).then((data) => {
  if (!data?.entries) return;
  showcaseProjects.push(...data.entries.map((item) => [item.title, item.location || 'Completed commission', item.artist_name, item.image_attachment_id ? `/api/file?id=${encodeURIComponent(item.image_attachment_id)}` : 'showcase-placeholder.svg']));
  render();
}).catch(() => {});
