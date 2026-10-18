// ОГЭлайн — статический тренажёр.
//
// Всё работает в браузере: данные заданий загружаются один раз из data/math.json,
// прогресс хранится в localStorage. Никаких серверов и внешних библиотек.

const SUBJECT = 'math';
const DATA_URL = `data/${SUBJECT}.json`;
const STORAGE_KEY = `ogeline:${SUBJECT}:progress:v1`;
const MAX_ATTEMPTS = 3;

const KIND_LABELS = {
  short: 'Краткий ответ',
  choice: 'Выбор ответа',
  multi: 'Выбор нескольких ответов',
  full: 'Развёрнутый ответ',
  accord: 'Установление соответствия',
};

let data = null;
const tasksById = new Map();
let progress = loadProgress();

const filters = { kind: 'all', kes: 'all', status: 'all' };
let open = null; // { id, selected, feedback, solutionShown }

const app = document.getElementById('app');
document.getElementById('brand').addEventListener('click', (e) => {
  e.preventDefault();
  goList();
});

// --- прогресс ----------------------------------------------------------------

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* приватный режим — просто не сохраняем */
  }
}

function statusOf(id) {
  return progress[id]?.status ?? 'new';
}

function attemptsOf(id) {
  return progress[id]?.attempts ?? 0;
}

function updateProgress(id, patch) {
  progress[id] = { ...(progress[id] || {}), ...patch, updatedAt: Date.now() };
  saveProgress();
}

// --- утилиты -----------------------------------------------------------------

function normalize(s) {
  return String(s)
    .trim()
    .replace(/\s+/g, '')
    .replace(/[.·]/g, ',')
    .replace(/[−–—]/g, '-');
}

function sameAnswer(user, correct) {
  const a = normalize(user);
  const b = normalize(correct);
  if (a === b) return true;
  const na = Number(a.replace(',', '.'));
  const nb = Number(b.replace(',', '.'));
  if (Number.isFinite(na) && Number.isFinite(nb)) return Math.abs(na - nb) < 1e-9;
  return false;
}

function stripText(html) {
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || '').replace(/\s+/g, ' ').trim();
}

function plural(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

// --- список заданий ----------------------------------------------------------

function filteredTasks() {
  return data.tasks.filter((t) => {
    if (filters.kind !== 'all' && t.kind !== filters.kind) return false;
    if (filters.kes !== 'all' && !t.kes.includes(filters.kes)) return false;
    const st = statusOf(t.id);
    if (filters.status === 'new' && st !== 'new') return false;
    if (filters.status === 'solved' && st !== 'solved') return false;
    if (filters.status === 'failed' && st !== 'failed') return false;
    return true;
  });
}

function renderList() {
  const list = filteredTasks();
  const total = data.tasks.length;
  const solved = data.tasks.filter((t) => statusOf(t.id) === 'solved').length;
  const percent = total ? Math.round((solved / total) * 100) : 0;

  const kesCodes = [...new Set(data.tasks.map((t) => t.kes[0]))].sort((a, b) =>
    a.localeCompare(b, 'ru', { numeric: true }),
  );

  app.innerHTML = `
    <h1>${data.title}</h1>
    <p class="muted">Выберите задание, решите его и введите ответ. При ошибке появятся подсказки, после трёх попыток — разбор.</p>

    <div class="progress">
      <div class="progress__bar"><div class="progress__fill" style="width:${percent}%"></div></div>
      <div class="progress__stats">Решено ${solved} из ${total} (${percent}%)</div>
    </div>

    <div class="filters" id="filters-kind">
      ${kindChip('all', 'Все типы')}
      ${kindChip('short', 'Краткий ответ')}
      ${kindChip('choice', 'Выбор ответа')}
    </div>

    <div class="filters" id="filters-kes">
      ${kesChip('all', 'Все подтемы')}
      ${kesCodes.map((c) => kesChip(c, `КЭС ${c}`)).join('')}
    </div>

    <div class="filters" id="filters-status">
      ${statusChip('all', 'Все задания')}
      ${statusChip('new', 'Нерешённые')}
      ${statusChip('failed', 'С ошибкой')}
      ${statusChip('solved', 'Решённые')}
    </div>

    <p class="muted" style="margin-top:4px">Найдено заданий: ${list.length}</p>

    <div class="task-grid">
      ${list.map((t) => taskCard(t)).join('')}
    </div>
  `;

  bindFilters();
  for (const card of app.querySelectorAll('[data-task]')) {
    card.addEventListener('click', () => goTask(card.dataset.task));
  }
}

function chip(group, value, label, active, extra = '') {
  return `<button class="chip" data-group="${group}" data-value="${value}" aria-pressed="${active}"${extra}>${label}</button>`;
}

function kindChip(value, label) {
  return chip('kind', value, label, filters.kind === value);
}
function kesChip(value, label) {
  const title = value !== 'all' && data.kesTitles?.[value] ? ` title="${escapeHtml(data.kesTitles[value])}"` : '';
  return chip('kes', value, label, filters.kes === value, title);
}
function statusChip(value, label) {
  return chip('status', value, label, filters.status === value);
}

function bindFilters() {
  for (const el of app.querySelectorAll('.chip')) {
    el.addEventListener('click', () => {
      filters[el.dataset.group] = el.dataset.value;
      renderList();
    });
  }
}

function taskCard(t) {
  const st = statusOf(t.id);
  const index = data.tasks.indexOf(t) + 1;
  const badge =
    st === 'solved'
      ? '<span class="tag tag--solved">Решено</span>'
      : st === 'failed'
        ? '<span class="tag tag--failed">С ошибкой</span>'
        : '<span class="tag tag--new">Не решено</span>';
  return `
    <button class="card card--${st}" data-task="${t.id}">
      <div class="card__top">
        <span class="card__no">№ ${index}</span>
        <span class="card__kind">${KIND_LABELS[t.kind] || t.kind}</span>
      </div>
      <div class="card__preview">${escapeHtml(stripText(t.stem).slice(0, 140))}</div>
      <div class="card__status">${badge}</div>
    </button>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// --- экран задания -----------------------------------------------------------

function goList() {
  open = null;
  renderList();
  window.scrollTo({ top: 0 });
}

function goTask(id) {
  const task = tasksById.get(id);
  if (!task) return;
  open = { id, selected: null, feedback: null, solutionShown: false };
  renderTask();
  window.scrollTo({ top: 0 });
}

function neighbors(id) {
  const idx = data.tasks.findIndex((t) => t.id === id);
  return {
    prev: idx > 0 ? data.tasks[idx - 1] : null,
    next: idx >= 0 && idx < data.tasks.length - 1 ? data.tasks[idx + 1] : null,
    index: idx + 1,
  };
}

function renderTask() {
  const task = tasksById.get(open.id);
  const { prev, next, index } = neighbors(open.id);
  const st = statusOf(task.id);
  const attempts = attemptsOf(task.id);
  const solved = st === 'solved';
  const failed = st === 'failed';

  app.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <button class="btn btn--ghost" id="back">← К списку заданий</button>
        <span class="muted">Задание № ${index} · ${KIND_LABELS[task.kind] || task.kind}${
          task.kes.length ? ` · КЭС ${task.kes.join(', ')}` : ''
        }</span>
      </div>

      <div class="statement">${task.stem}</div>

      ${
        task.options
          ? renderOptions(task, solved)
          : renderInput(task, solved, failed)
      }

      <div class="actions">
        ${
          task.options
            ? `<button class="btn btn--primary" id="check" ${solved ? 'disabled' : ''}>Проверить</button>`
            : `<button class="btn btn--primary" id="check" ${solved || failed ? 'disabled' : ''}>Проверить</button>`
        }
        <button class="btn" id="reveal">${open.solutionShown ? 'Скрыть решение' : 'Показать решение'}</button>
        <span class="attempts">${attemptsLabel(attempts, solved, failed)}</span>
      </div>

      <div id="feedback"></div>
      <div id="hints"></div>
      ${open.solutionShown ? renderSolution(task) : ''}

      <div class="panel__nav">
        <button class="btn" id="prev" ${prev ? '' : 'disabled'}>← Предыдущее</button>
        <button class="btn" id="next" ${next ? '' : 'disabled'}>Следующее →</button>
      </div>
    </div>
  `;

  document.getElementById('back').addEventListener('click', goList);
  const checkBtn = document.getElementById('check');
  if (checkBtn) checkBtn.addEventListener('click', onCheck);
  document.getElementById('reveal').addEventListener('click', onReveal);
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  if (prev) prevBtn.addEventListener('click', () => goTask(prev.id));
  if (next) nextBtn.addEventListener('click', () => goTask(next.id));

  if (task.options) {
    for (const el of app.querySelectorAll('input[name="option"]')) {
      el.addEventListener('change', () => {
        open.selected = el.value;
        for (const o of app.querySelectorAll('.option')) o.classList.toggle('option--selected', o.dataset.n === open.selected);
      });
    }
  } else {
    const input = document.getElementById('answer-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') onCheck();
      });
      input.focus();
    }
  }

  renderFeedback();
  renderHints();
}

function attemptsLabel(attempts, solved, failed) {
  if (solved) return 'Задание решено 👍';
  if (failed) return 'Попытки исчерпаны';
  return `Использовано попыток: ${attempts} из ${MAX_ATTEMPTS}`;
}

function renderOptions(task, solved) {
  return `<div class="options">${task.options
    .map((o) => {
      const cls = o.n === open.selected ? 'option option--selected' : 'option';
      const checked = o.n === open.selected ? 'checked' : '';
      const disabled = solved ? 'disabled' : '';
      return `
        <label class="${cls}" data-n="${o.n}">
          <input type="radio" name="option" value="${o.n}" ${checked} ${disabled}>
          <span class="option__num">${o.n})</span>
          <span class="option__body">${o.html}</span>
        </label>`;
    })
    .join('')}</div>`;
}

function renderInput(task, solved, failed) {
  const disabled = solved || failed ? 'disabled' : '';
  return `
    <div class="answer-row">
      <label for="answer-input">Ответ:</label>
      <input id="answer-input" type="text" inputmode="text" autocomplete="off" ${disabled}
             placeholder="например, 1,26" value="${open.userAnswer ? escapeHtml(open.userAnswer) : ''}">
      <span class="muted">Десятичную дробь можно писать с запятой или точкой.</span>
    </div>`;
}

function renderSolution(task) {
  const steps = task.solution || [];
  return `
    <div class="solution">
      <strong>Разбор решения</strong>
      <ol>${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ol>
      ${task.answer ? `<p style="margin-top:12px"><strong>Правильный ответ: ${escapeHtml(task.answer)}</strong></p>` : ''}
    </div>`;
}

function renderFeedback() {
  const box = document.getElementById('feedback');
  if (!box || !open.feedback) return;
  box.innerHTML = `<div class="feedback feedback--${open.feedback.type}">${open.feedback.text}</div>`;
}

function renderHints() {
  const box = document.getElementById('hints');
  if (!box) return;
  const task = tasksById.get(open.id);
  const attempts = attemptsOf(task.id);
  const hints = (task.hints || []).slice(0, Math.min(attempts, MAX_ATTEMPTS));
  box.innerHTML = hints
    .map(
      (h, i) =>
        `<div class="hint"><div class="hint__title">Подсказка ${i + 1}</div><div>${escapeHtml(h)}</div></div>`,
    )
    .join('');
}

function onReveal() {
  open.solutionShown = !open.solutionShown;
  const task = tasksById.get(open.id);
  if (open.solutionShown && statusOf(task.id) !== 'solved') {
    updateProgress(task.id, { status: 'failed', attempts: Math.max(attemptsOf(task.id), MAX_ATTEMPTS) });
  }
  renderTask();
}

function onCheck() {
  const task = tasksById.get(open.id);
  if (!task) return;

  let userAnswer = null;
  if (task.options) {
    if (open.selected == null) {
      open.feedback = { type: 'bad', text: 'Сначала выберите один из вариантов ответа.' };
      renderFeedback();
      return;
    }
    userAnswer = open.selected;
  } else {
    const input = document.getElementById('answer-input');
    const value = input.value.trim();
    open.userAnswer = value;
    if (!value) {
      open.feedback = { type: 'bad', text: 'Введите ответ.' };
      renderFeedback();
      return;
    }
    userAnswer = value;
  }

  const correct = sameAnswer(userAnswer, task.answer);
  const attempts = attemptsOf(task.id) + 1;

  if (correct) {
    updateProgress(task.id, { status: 'solved', attempts });
    open.feedback = { type: 'good', text: 'Верно! Отличная работа.' };
    open.solutionShown = false;
    renderTask();
    return;
  }

  if (attempts >= MAX_ATTEMPTS) {
    updateProgress(task.id, { status: 'failed', attempts });
    open.feedback = {
      type: 'bad',
      text: 'Пока неверно. Попытки закончились — посмотрите разбор ниже и попробуйте похожие задания.',
    };
    open.solutionShown = true;
  } else {
    updateProgress(task.id, { status: progress[task.id]?.status === 'solved' ? 'solved' : 'new', attempts });
    open.feedback = {
      type: 'bad',
      text: `Неверно. Вот подсказка, которая поможет найти ошибку. Осталось попыток: ${MAX_ATTEMPTS - attempts}.`,
    };
  }
  renderTask();
  // Прокрутим к подсказке, чтобы её было видно.
  const hints = document.getElementById('hints');
  if (hints) hints.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- увеличение чертежа ------------------------------------------------------

let zoomEl = null;

function onZoomKey(e) {
  if (e.key === 'Escape') closeZoom();
}

function closeZoom() {
  if (!zoomEl) return;
  document.removeEventListener('keydown', onZoomKey);
  zoomEl.remove();
  zoomEl = null;
  document.body.classList.remove('is-zoomed');
}

function openZoom(src, alt) {
  if (!src) return;
  closeZoom();

  const overlay = document.createElement('div');
  overlay.className = 'img-zoom';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', alt || 'Изображение к заданию');

  const img = document.createElement('img');
  img.src = src;
  img.alt = alt || '';

  const hint = document.createElement('div');
  hint.className = 'img-zoom__hint';
  hint.textContent = 'Разведите два пальца, чтобы увеличить сильнее. Закрыть — тап по фону или ✕.';

  const close = document.createElement('button');
  close.className = 'img-zoom__close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Закрыть');
  close.textContent = '×';

  overlay.append(img, hint, close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === close) closeZoom();
  });

  document.addEventListener('keydown', onZoomKey);
  document.body.appendChild(overlay);
  document.body.classList.add('is-zoomed');
  zoomEl = overlay;
  close.focus();
}

// Клик по чертежу в условии открывает его крупно.
app.addEventListener('click', (e) => {
  const img = e.target.closest?.('.statement img.q-img');
  if (img) openZoom(img.getAttribute('src'), img.getAttribute('alt'));
});

// --- запуск ------------------------------------------------------------------

async function main() {
  app.innerHTML = '<div class="loading">Загружаем задания…</div>';
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    app.innerHTML = `<div class="loading">Не удалось загрузить задания (${escapeHtml(err.message)}).<br>Откройте сайт через локальный сервер: <code>npm run serve</code>.</div>`;
    return;
  }

  for (const t of data.tasks) tasksById.set(t.id, t);
  renderList();
}

main();
