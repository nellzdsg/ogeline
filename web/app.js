// ОГЭлайн — статический тренажёр по открытому банку заданий ОГЭ (ФИПИ).
//
// Экраны: главная (что это и выбор предмета) → номера заданий → список заданий
// номера → задание. Никаких серверов: данные загружаются из data/, прогресс
// хранится в localStorage. Навигация — через hash, чтобы работала кнопка «назад».

const THEME_KEY = 'ogeline:theme';
const MAX_ATTEMPTS = 3;

const KIND_LABELS = {
  short: 'Краткий ответ',
  choice: 'Выбор ответа',
  multi: 'Выбор нескольких ответов',
  full: 'Развёрнутый ответ',
  accord: 'Установление соответствия',
};

const MOON =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M21 12.9A9 9 0 1 1 11.1 3a7 7 0 0 0 9.9 9.9Z"/></svg>';
const SUN =
  '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 16.5a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Zm0-13a1 1 0 0 1 1 1V6a1 1 0 1 1-2 0V4.5a1 1 0 0 1 1-1Zm0 13a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V18a1 1 0 0 1 1-1ZM3.5 12a1 1 0 0 1 1-1H6a1 1 0 1 1 0 2H4.5a1 1 0 0 1-1-1Zm13 0a1 1 0 0 1 1-1h1.5a1 1 0 1 1 0 2H18a1 1 0 0 1-1-1ZM6.3 6.3a1 1 0 0 1 1.4 0l1 1a1 1 0 1 1-1.4 1.4l-1-1a1 1 0 0 1 0-1.4Zm9 9a1 1 0 0 1 1.4 0l1 1a1 1 0 0 1-1.4 1.4l-1-1a1 1 0 0 1 0-1.4Zm1.4-9a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4-1.4l1-1a1 1 0 0 1 1.4 0Zm-9 9a1 1 0 0 1 0 1.4l-1 1a1 1 0 0 1-1.4-1.4l1-1a1 1 0 0 1 1.4 0Z"/></svg>';

const app = document.getElementById('app');
const themeButton = document.getElementById('theme-toggle');

const state = {
  subjects: null, // список предметов ОГЭ (data/subjects.json)
  subject: null, // ключ загруженного предмета
  data: null, // данные предмета (data/<ключ>.json)
  group: null, // выбранный номер задания
  variation: 'all', // фильтр внутри номера
  status: 'all', // фильтр по прогрессу
  taskId: null,
  open: null, // состояние экрана задания
};

const tasksById = new Map();
let progress = {};

// --- тема --------------------------------------------------------------------

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeButton) {
    themeButton.innerHTML = theme === 'dark' ? SUN : MOON;
    themeButton.setAttribute('aria-label', theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
  }
}

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* приватный режим — просто не запоминаем */
  }
  applyTheme(next);
}

// --- прогресс ----------------------------------------------------------------

function progressKey(subject) {
  return `ogeline:${subject}:progress:v1`;
}

function loadProgress(subject) {
  try {
    const raw = localStorage.getItem(progressKey(subject));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress() {
  try {
    localStorage.setItem(progressKey(state.subject), JSON.stringify(progress));
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

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
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

function tasksOf(numberId) {
  return state.data.tasks.filter((t) => t.number === numberId);
}

function progressBar(solved, total) {
  const percent = total ? Math.round((solved / total) * 100) : 0;
  return `
    <div class="progress">
      <div class="progress__bar"><div class="progress__fill" style="width:${percent}%"></div></div>
      <div class="progress__stats">Решено ${solved} из ${total} (${percent}%)</div>
    </div>`;
}

// --- маршрутизация -----------------------------------------------------------

function parseHash() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

async function loadSubjects() {
  const res = await fetch('data/subjects.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.subjects || [];
}

async function loadSubject(key) {
  const res = await fetch(`data/${key}.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function render() {
  const parts = parseHash();

  try {
    if (!state.subjects) {
      app.innerHTML = '<div class="loading">Загружаем…</div>';
      state.subjects = await loadSubjects();
    }
  } catch (err) {
    app.innerHTML = `<div class="loading">Не удалось загрузить данные (${escapeHtml(err.message)}).<br>Откройте сайт через локальный сервер: <code>npm run serve</code>.</div>`;
    return;
  }

  if (!parts.length) {
    state.subject = null;
    state.data = null;
    state.taskId = null;
    return renderHome();
  }

  const key = parts[0];
  const subject = state.subjects.find((s) => s.key === key) || { key, title: key, ready: false, tasks: 0 };

  if (!subject.ready) return renderSoon(subject);

  if (state.subject !== key) {
    app.innerHTML = '<div class="loading">Загружаем задания…</div>';
    try {
      state.data = await loadSubject(key);
    } catch (err) {
      app.innerHTML = `<div class="loading">Не удалось загрузить задания (${escapeHtml(err.message)}).</div>`;
      return;
    }
    state.subject = key;
    tasksById.clear();
    for (const t of state.data.tasks) tasksById.set(t.id, t);
    progress = loadProgress(key);
  }

  if (parts.length === 1) {
    state.group = null;
    state.taskId = null;
    return renderSubject();
  }

  const group = state.data.numbers.find((n) => n.id === parts[1]);
  if (!group || !group.count) {
    // Номер есть в структуре экзамена, но заданий по нему ещё нет — возвращаем к списку.
    location.hash = `#/${key}`;
    return;
  }

  if (state.group !== group.id) {
    state.group = group.id;
    state.variation = 'all';
    state.status = 'all';
    state.taskId = null;
  }

  if (parts.length === 2) {
    state.taskId = null;
    return renderGroup(group);
  }

  const task = tasksById.get(parts[2]);
  if (!task) {
    location.hash = `#/${key}/${group.id}`;
    return;
  }
  if (state.taskId !== task.id) {
    state.taskId = task.id;
    state.open = { id: task.id, selected: null, feedback: null, solutionShown: false, userAnswer: '' };
  }
  return renderTaskScreen(task, group);
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

// --- главная -----------------------------------------------------------------

function renderHome() {
  const subjects = state.subjects;
  app.innerHTML = `
    <section class="hero">
      <h1 class="hero__title">ОГЭлайн</h1>
      <p class="hero__lead">
        Бесплатный тренажёр для подготовки к ОГЭ. Задания — настоящие: они взяты из открытого
        банка заданий ФИПИ, из которого составляют варианты на самом экзамене.
      </p>
      <div class="hero__points">
        <div class="point">
          <span class="point__icon">✓</span>
          <div><strong>Бесплатно и без регистрации</strong>
          <p>Ни платных тем, ни рекламы. Прогресс хранится в вашем браузере.</p></div>
        </div>
        <div class="point">
          <span class="point__icon">✓</span>
          <div><strong>Как в экзамене</strong>
          <p>Задания собраны по номерам 1–25 и разбиты по темам.</p></div>
        </div>
        <div class="point">
          <span class="point__icon">✓</span>
          <div><strong>Подсказки вместо готового ответа</strong>
          <p>Три попытки: каждая ошибка даёт подсказку всё точнее, а после третьей — полный разбор.</p></div>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>Как пользоваться</h2>
      <ol class="steps">
        <li>Выберите предмет, а затем номер задания — так же, как пронумерованы задания в варианте ОГЭ.</li>
        <li>Решите задание на бумаге или в графическом редакторе.</li>
        <li>Введите полученный ответ и нажмите «Проверить».</li>
        <li>Ошиблись — появится подсказка. После третьей попытки открывается подробный разбор.</li>
        <li>Прогресс сохраняется: можно закрыть сайт и вернуться к решению позже.</li>
      </ol>
    </section>

    <section class="block">
      <h2>Выберите предмет</h2>
      <p class="muted">В ОГЭ четырнадцать предметов. Задания появляются постепенно — рядом с предметом видно, сколько их уже готово.</p>
      <div class="subject-grid">
        ${subjects.map(subjectCard).join('')}
      </div>
    </section>
  `;

  for (const el of app.querySelectorAll('[data-subject]')) {
    el.addEventListener('click', () => go(`#/${el.dataset.subject}`));
  }
  window.scrollTo({ top: 0 });
}

function subjectCard(s) {
  const meta = s.ready ? `${s.tasks} ${plural(s.tasks, 'задание', 'задания', 'заданий')}` : 'скоро';
  return `
    <button class="subject ${s.ready ? 'subject--ready' : 'subject--soon'}" data-subject="${s.key}" ${s.ready ? '' : 'disabled'}>
      <span class="subject__title">${escapeHtml(s.title)}</span>
      <span class="subject__meta">${meta}</span>
    </button>`;
}

function renderSoon(subject) {
  app.innerHTML = `
    <div class="crumbs"><a href="#/">← К выбору предмета</a></div>
    <h1>${escapeHtml(subject.title)}</h1>
    <p class="muted">Задания по этому предмету пока не добавлены. Они появятся позже — сначала мы наполняем математику.</p>
  `;
  window.scrollTo({ top: 0 });
}

// --- предмет: сетка номеров --------------------------------------------------

function renderSubject() {
  const d = state.data;
  const total = d.tasks.length;
  const solved = d.tasks.filter((t) => statusOf(t.id) === 'solved').length;

  app.innerHTML = `
    <div class="crumbs"><a href="#/">← К выбору предмета</a></div>
    <h1>${escapeHtml(d.title)}</h1>
    <p class="muted">Выберите номер задания — так же пронумерованы задания в варианте ОГЭ. Внутри каждого номера собраны все задания из банка ФИПИ.</p>
    ${progressBar(solved, total)}
    <div class="number-grid">
      ${d.numbers.map(numberCard).join('')}
    </div>
  `;

  for (const el of app.querySelectorAll('[data-group]')) {
    el.addEventListener('click', () => go(`#/${d.subject}/${el.dataset.group}`));
  }
  window.scrollTo({ top: 0 });
}

function numberCard(n) {
  const ready = n.count > 0;
  let meta = 'скоро';
  if (ready) {
    const tasks = tasksOf(n.id);
    const solved = tasks.filter((t) => statusOf(t.id) === 'solved').length;
    meta = `${n.count} ${plural(n.count, 'задание', 'задания', 'заданий')}${solved ? ` · решено ${solved}` : ''}`;
  }
  return `
    <button class="number-card ${ready ? '' : 'number-card--soon'}" data-group="${n.id}" ${ready ? '' : 'disabled'}>
      <span class="number-card__label">${n.label}</span>
      <span class="number-card__title">${escapeHtml(n.title)}</span>
      <span class="number-card__meta">${meta}</span>
      ${n.note ? `<span class="number-card__note">${escapeHtml(n.note)}</span>` : ''}
    </button>`;
}

// --- номер: список заданий ---------------------------------------------------

function renderGroup(group) {
  const all = tasksOf(group.id);
  const variations = [...new Set(all.map((t) => t.variation).filter(Boolean))];
  const filtered = all.filter(
    (t) =>
      (state.variation === 'all' || t.variation === state.variation) &&
      (state.status === 'all' || statusOf(t.id) === state.status),
  );
  const solved = all.filter((t) => statusOf(t.id) === 'solved').length;

  app.innerHTML = `
    <div class="crumbs"><a href="#/${state.subject}">← ${escapeHtml(state.data.title)}</a></div>
    <h1>${group.label}. ${escapeHtml(group.title)}</h1>
    ${group.note ? `<p class="muted">${escapeHtml(group.note)}</p>` : ''}
    ${progressBar(solved, all.length)}

    ${variations.length > 1 ? `<div class="filters" id="filters-var">
      <span class="filters__label">${escapeHtml(group.variationLabel || 'Раздел')}:</span>
      ${variationChip('all', 'Все')}
      ${variations.map((v) => variationChip(v, v)).join('')}
    </div>` : ''}

    <div class="filters" id="filters-status">
      <span class="filters__label">Показывать:</span>
      ${statusChip('all', 'Все')}
      ${statusChip('new', 'Нерешённые')}
      ${statusChip('failed', 'С ошибкой')}
      ${statusChip('solved', 'Решённые')}
    </div>

    <p class="found">Найдено заданий: ${filtered.length}</p>

    <div class="task-grid">
      ${filtered.map((t) => taskCard(t, all.indexOf(t) + 1)).join('')}
    </div>
  `;

  bindChips();
  for (const card of app.querySelectorAll('[data-task]')) {
    card.addEventListener('click', () => go(`#/${state.subject}/${group.id}/${card.dataset.task}`));
  }
  window.scrollTo({ top: 0 });
}

function chip(group, value, label, active) {
  return `<button class="chip" data-group="${group}" data-value="${escapeHtml(value)}" aria-pressed="${active}">${escapeHtml(label)}</button>`;
}

function variationChip(value, label) {
  return chip('variation', value, label, state.variation === value);
}

function statusChip(value, label) {
  return chip('status', value, label, state.status === value);
}

function bindChips() {
  for (const el of app.querySelectorAll('.chip')) {
    el.addEventListener('click', () => {
      state[el.dataset.group === 'variation' ? 'variation' : 'status'] = el.dataset.value;
      renderGroup(state.data.numbers.find((n) => n.id === state.group));
    });
  }
}

function taskCard(t, index) {
  const st = statusOf(t.id);
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
        ${t.variation ? `<span class="tag tag--variation">${escapeHtml(t.variation)}</span>` : `<span class="card__kind">${KIND_LABELS[t.kind] || t.kind}</span>`}
      </div>
      <div class="card__preview">${escapeHtml(stripText(t.stem).slice(0, 140))}</div>
      <div class="card__status">${badge}</div>
    </button>`;
}

// --- экран задания -----------------------------------------------------------

function renderTaskScreen(task, group) {
  const all = tasksOf(group.id);
  const idx = all.findIndex((t) => t.id === task.id);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;
  const st = statusOf(task.id);
  const attempts = attemptsOf(task.id);
  const solved = st === 'solved';
  const failed = st === 'failed';

  app.innerHTML = `
    <div class="panel">
      <div class="panel__head">
        <button class="btn btn--ghost" id="back">← ${group.label}. ${escapeHtml(group.title)}</button>
        <span class="muted">№ ${idx + 1} из ${all.length}${task.variation ? ` · ${escapeHtml(task.variation)}` : ` · ${KIND_LABELS[task.kind] || task.kind}`}</span>
      </div>

      <div class="statement">${task.stem}</div>

      ${task.options ? renderOptions(task, solved) : renderInput(task, solved, failed)}

      <div class="actions">
        <button class="btn btn--primary" id="check" ${solved || failed ? 'disabled' : ''}>Проверить</button>
        <button class="btn" id="reveal">${state.open.solutionShown ? 'Скрыть решение' : 'Показать решение'}</button>
        <span class="attempts">${attemptsLabel(attempts, solved, failed)}</span>
      </div>

      <div id="feedback"></div>
      <div id="hints"></div>
      ${state.open.solutionShown ? renderSolution(task) : ''}

      <div class="panel__nav">
        <button class="btn" id="prev" ${prev ? '' : 'disabled'}>← Предыдущее</button>
        <button class="btn" id="next" ${next ? '' : 'disabled'}>Следующее →</button>
      </div>
    </div>
  `;

  document.getElementById('back').addEventListener('click', () => go(`#/${state.subject}/${group.id}`));
  document.getElementById('check').addEventListener('click', onCheck);
  document.getElementById('reveal').addEventListener('click', onReveal);
  if (prev) document.getElementById('prev').addEventListener('click', () => go(`#/${state.subject}/${group.id}/${prev.id}`));
  if (next) document.getElementById('next').addEventListener('click', () => go(`#/${state.subject}/${group.id}/${next.id}`));

  if (task.options) {
    for (const el of app.querySelectorAll('input[name="option"]')) {
      el.addEventListener('change', () => {
        state.open.selected = el.value;
        for (const o of app.querySelectorAll('.option')) o.classList.toggle('option--selected', o.dataset.n === state.open.selected);
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
  window.scrollTo({ top: 0 });
}

function attemptsLabel(attempts, solved, failed) {
  if (solved) return 'Задание решено 👍';
  if (failed) return 'Попытки исчерпаны';
  return `Использовано попыток: ${attempts} из ${MAX_ATTEMPTS}`;
}

function renderOptions(task, solved) {
  return `<div class="options">${task.options
    .map((o) => {
      const cls = o.n === state.open.selected ? 'option option--selected' : 'option';
      const checked = o.n === state.open.selected ? 'checked' : '';
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
             placeholder="например, 1,26" value="${state.open.userAnswer ? escapeHtml(state.open.userAnswer) : ''}">
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
  if (!box || !state.open.feedback) return;
  box.innerHTML = `<div class="feedback feedback--${state.open.feedback.type}">${state.open.feedback.text}</div>`;
}

function renderHints() {
  const box = document.getElementById('hints');
  if (!box) return;
  const task = tasksById.get(state.open.id);
  const attempts = attemptsOf(task.id);
  const hints = (task.hints || []).slice(0, Math.min(attempts, MAX_ATTEMPTS));
  box.innerHTML = hints
    .map((h, i) => `<div class="hint"><div class="hint__title">Подсказка ${i + 1}</div><div>${escapeHtml(h)}</div></div>`)
    .join('');
}

function onReveal() {
  const task = tasksById.get(state.open.id);
  state.open.solutionShown = !state.open.solutionShown;
  if (state.open.solutionShown && statusOf(task.id) !== 'solved') {
    updateProgress(task.id, { status: 'failed', attempts: Math.max(attemptsOf(task.id), MAX_ATTEMPTS) });
  }
  const group = state.data.numbers.find((n) => n.id === state.group);
  renderTaskScreen(task, group);
}

function onCheck() {
  const task = tasksById.get(state.open.id);
  if (!task) return;

  let userAnswer = null;
  if (task.options) {
    if (state.open.selected == null) {
      state.open.feedback = { type: 'bad', text: 'Сначала выберите один из вариантов ответа.' };
      renderFeedback();
      return;
    }
    userAnswer = state.open.selected;
  } else {
    const input = document.getElementById('answer-input');
    const value = input.value.trim();
    state.open.userAnswer = value;
    if (!value) {
      state.open.feedback = { type: 'bad', text: 'Введите ответ.' };
      renderFeedback();
      return;
    }
    userAnswer = value;
  }

  const correct = sameAnswer(userAnswer, task.answer);
  const attempts = attemptsOf(task.id) + 1;
  const alreadySolved = statusOf(task.id) === 'solved';

  if (correct) {
    updateProgress(task.id, { status: 'solved', attempts });
    state.open.feedback = { type: 'good', text: 'Верно! Отличная работа.' };
    state.open.solutionShown = false;
  } else if (attempts >= MAX_ATTEMPTS) {
    updateProgress(task.id, { status: 'failed', attempts });
    state.open.feedback = {
      type: 'bad',
      text: 'Пока неверно. Попытки закончились — посмотрите разбор ниже и попробуйте похожие задания.',
    };
    state.open.solutionShown = true;
  } else {
    updateProgress(task.id, { status: alreadySolved ? 'solved' : 'new', attempts });
    state.open.feedback = {
      type: 'bad',
      text: `Неверно. Вот подсказка, которая поможет найти ошибку. Осталось попыток: ${MAX_ATTEMPTS - attempts}.`,
    };
  }

  const group = state.data.numbers.find((n) => n.id === state.group);
  renderTaskScreen(task, group);

  // Прокрутим к подсказке, чтобы её было видно.
  const hints = document.getElementById('hints');
  if (hints && hints.children.length) hints.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
  const img = e.target.closest?.('.statement img.q-img, .option img.q-img');
  if (img) openZoom(img.getAttribute('src'), img.getAttribute('alt'));
});

// --- запуск ------------------------------------------------------------------

async function main() {
  if (themeButton) {
    applyTheme(document.documentElement.dataset.theme || 'light');
    themeButton.addEventListener('click', toggleTheme);
  }
  window.addEventListener('hashchange', () => render());
  await render();
}

main();
