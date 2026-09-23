const STORAGE_KEY = 'taskready-ai-state-v1';

const weights = {
  context: 20,
  data: 20,
  expected: 15,
  success: 15,
  constraints: 10,
  users: 10,
  business: 10,
};

const fieldLabels = {
  context: 'Контекст и потребность',
  data: 'Данные и материалы',
  expected: 'Ожидаемый результат',
  success: 'Критерии успеха',
  constraints: 'Ограничения',
  users: 'Пользователи',
  business: 'Связь с бизнесом',
};

const initialState = {
  view: 'dashboard',
  role: 'business',
  draftStep: 1,
  draft: {
    raw: '', title: '', context: '', data: '', expected: '', success: '', constraints: '', users: '', business: '', industry: 'Другое', contact: '', interaction: 'Онлайн-встречи',
    questions: [], analyzed: false, confirmed: false,
  },
  tasks: [
    { id: 't1', title: 'Сократить время обработки входящих заявок', industry: 'Сервисы', context: 'Менеджеры вручную переносят заявки из почты и мессенджеров в таблицу.', data: '100–150 заявок в месяц, выгрузка CSV и 20 обезличенных примеров.', expected: 'Прототип маршрутизации заявок в единый реестр.', success: '80% заявок попадают в реестр без ручного копирования; экономия 4 часов в неделю.', constraints: 'MVP за 2 недели, без доступа к продакшену.', users: 'Менеджеры отдела продаж и руководитель.', business: 'Еженедельный созвон с руководителем; контакт — Айдана.', contact: 'Айдана, руководитель отдела', interaction: 'Онлайн-встречи', score: 92, level: 'Приоритетная', status: 'published', created: 'Сегодня', tags: ['автоматизация', 'данные'], owner: 'business', confirmed: true },
    { id: 't2', title: 'Понятный навигатор по городским кружкам', industry: 'Образование', context: 'Родители тратят много времени на поиск подходящих занятий для детей.', data: 'Список кружков, возрастные группы, расписания и цены.', expected: 'Каталог с фильтрами и подбором по интересам ребёнка.', success: 'Пользователь находит 3 подходящих кружка менее чем за 2 минуты.', constraints: 'Только веб-прототип; данные синтетические.', users: 'Родители детей 7–16 лет.', business: 'Проверка прототипа с 5 родителями раз в неделю.', contact: 'Данияр, городской центр', interaction: 'Онлайн-встречи', score: 84, level: 'Готовая', status: 'published', created: 'Вчера', tags: ['рекомендации', 'город'], owner: 'business', confirmed: true },
    { id: 't3', title: 'Прозрачный сбор обратной связи студентов', industry: 'Образование', context: 'Обратная связь приходит в разных формах и теряется.', data: '', expected: 'Единая форма для сбора и просмотра обратной связи.', success: '', constraints: 'Нужно показать результат к концу месяца.', users: 'Студенты и преподаватели.', business: 'Контакт с куратором проекта.', contact: 'Куратор образовательных программ', interaction: 'Чат и еженедельный созвон', score: 48, level: 'Рабочая', status: 'published', created: '2 дня назад', tags: ['feedback'], owner: 'business', confirmed: true },
    { id: 't4', title: 'Помощник для первичной классификации обращений', industry: 'Госуслуги', context: 'Операторы тратят время на распределение обращений по категориям.', data: 'История обращений пока не структурирована.', expected: 'Демонстрационный классификатор с объяснением решения.', success: 'Не определены.', constraints: '', users: 'Операторы контакт-центра.', business: '', contact: '', interaction: 'Гибридно', score: 28, level: 'Черновик', status: 'published', created: '3 дня назад', tags: ['AI', 'классификация'], owner: 'business', confirmed: true },
  ],
  teams: [
    { id: 'team1', name: 'Data Nomads', initials: 'DN', skills: ['Python', 'аналитика', 'автоматизация'], interests: ['сервисы', 'данные'], tech: 'FastAPI · React · PostgreSQL', points: 120 },
    { id: 'team2', name: 'Qadam Studio', initials: 'QS', skills: ['UX', 'прототипирование', 'исследования'], interests: ['образование', 'город'], tech: 'Figma · React · UX research', points: 95 },
    { id: 'team3', name: 'Orda AI', initials: 'OA', skills: ['NLP', 'ML', 'Python'], interests: ['AI', 'классификация'], tech: 'Python · transformers · FastAPI', points: 80 },
  ],
  offers: [
    { id: 'o1', taskId: 't1', teamId: 'team1', idea: 'Сделаем inbox-пайплайн: импорт CSV/почты, нормализация полей и очередь исключений.', plan: '1) схема данных 2) импорт 3) дашборд 4) тест на 20 примерах', deadline: '10 дней', prototype: 'https://github.com/demo/inbox-flow', status: 'pending', created: 'сегодня' },
    { id: 'o2', taskId: 't1', teamId: 'team2', idea: 'Сфокусируемся на простом интерфейсе оператора и быстрых горячих действиях.', plan: 'Интервью → карта пути → кликабельный прототип → тестирование', deadline: '7 дней', prototype: 'https://figma.com/demo/operator', status: 'pending', created: 'сегодня' },
    { id: 'o3', taskId: 't2', teamId: 'team2', idea: 'Создадим подбор по возрасту, интересам и доступному времени.', plan: 'Сегменты → фильтры → карточка кружка → тест с родителями', deadline: '8 дней', prototype: 'https://figma.com/demo/clubs', status: 'accepted', created: 'вчера' },
  ],
};

let state = loadState();
let serverSaveTimer = null;

function loadState() {
  try { return { ...initialState, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; } catch { return structuredClone(initialState); }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (/^https?:$/.test(location.protocol)) {
    clearTimeout(serverSaveTimer);
    serverSaveTimer = setTimeout(() => {
      fetch('/api/state', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) }).catch(() => {});
    }, 220);
  }
}

async function bootstrapServer() {
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const response = await fetch('/api/state');
    if (!response.ok) return;
    const remote = await response.json();
    if (Array.isArray(remote.tasks) && remote.tasks.length) {
      state = { ...state, ...remote };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      render();
    } else if (state.tasks.length) {
      saveState();
    }
  } catch (_) {
    // Standalone HTML mode keeps working with localStorage.
  }
}
function escapeHtml(value = '') { return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch])); }
function initials(name='') { return name.split(' ').map(x => x[0]).slice(0,2).join('').toUpperCase(); }
function levelFor(score) { return score >= 90 ? 'Приоритетная' : score >= 70 ? 'Готовая' : score >= 40 ? 'Рабочая' : 'Черновик'; }
function levelClass(level) { return ({ 'Приоритетная':'purple', 'Готовая':'green', 'Рабочая':'blue', 'Черновик':'orange' })[level] || 'gray'; }
function toast(message) { const root = document.getElementById('toast-root'); const el = document.createElement('div'); el.className = 'toast'; el.textContent = message; root.appendChild(el); setTimeout(() => el.remove(), 3400); }
function scoreFor(item) {
  const vals = ['context','data','expected','success','constraints','users','business'];
  return Math.min(100, Math.round(vals.reduce((sum, key) => sum + weights[key] * completeness(item[key]), 0)));
}
function completeness(value) {
  if (!value || value.trim().length < 8) return 0;
  if (value.trim().length < 42) return .5;
  return 1;
}
function breakdownFor(item) { return Object.keys(weights).map(key => ({ key, label: fieldLabels[key], points: Math.round(weights[key] * completeness(item[key])), weight: weights[key] })); }
function nextActions(item) { return breakdownFor(item).filter(x => x.points < x.weight).sort((a,b) => (b.weight-b.points) - (a.weight-a.points)).slice(0,3); }
function scoreRing(score) { return `<div class="score-ring" style="background:conic-gradient(#63d1d5 0 ${score}%, rgba(255,255,255,.17) ${score}% 100%)"><div class="score-in"><strong>${score}</strong><span>из 100</span></div></div>`; }
function metric(label, value, detail) { return `<div class="card metric"><div class="eyebrow">${label}</div><div class="value">${value}</div><div class="detail">${detail}</div></div>`; }
function navButton(id, icon, label) { return `<button title="${label}" aria-label="${label}" class="${state.view === id ? 'active' : ''}" data-view="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`; }
function render() {
  const app = document.getElementById('app');
  app.innerHTML = `<aside class="sidebar">
    <div class="brand"><div class="brand-mark">✦</div><div><strong>TaskReady AI</strong><small>HackAlem MVP</small></div></div>
    <nav class="nav">
      ${navButton('dashboard','⌂','Обзор')}
      ${navButton('create','✦','Создать задачу')}
      ${navButton('catalog','▦','Каталог задач')}
      ${navButton('offers','◌','Отклики')}
      ${navButton('analytics','◒','Аналитика')}
    </nav>
    <div class="sidebar-bottom"><div class="demo-note"><strong>Режим демо</strong>Все данные хранятся локально в браузере. Можно безопасно пройти сценарий без API-ключей.</div></div>
  </aside>
  <main class="main">
    <header class="topbar"><div class="breadcrumb">Пространство / <strong>${state.view === 'create' ? 'Новая задача' : titleForView()}</strong></div><div class="top-actions"><div class="role-switch"><button class="${state.role === 'business' ? 'active' : ''}" data-role="business">Бизнес</button><button class="${state.role === 'team' ? 'active' : ''}" data-role="team">Команда</button></div><div class="avatar">${state.role === 'business' ? 'АБ' : 'DN'}</div></div></header>
    <section class="content">${renderView()}</section>
  </main>`;
  bindEvents();
}
function titleForView() { return ({ dashboard:'Обзор', catalog:'Каталог задач', offers:'Отклики', analytics:'Аналитика' })[state.view] || 'Обзор'; }
function renderView() { return ({ dashboard: renderDashboard, create: renderCreate, catalog: renderCatalog, offers: renderOffers, analytics: renderAnalytics })[state.view](); }
function renderDashboard() {
  const published = state.tasks.filter(t=>t.status==='published');
  const avg = Math.round(published.reduce((a,t)=>a+t.score,0)/published.length);
  const pending = state.offers.filter(o=>o.status==='pending').length;
  const top = [...published].sort((a,b)=>b.score-a.score)[0];
  const sampleQuestions = state.draft.questions.length ? state.draft.questions : [
    { field:'users', question:'Кто сталкивается с проблемой каждый день?' },
    { field:'data', question:'Какие данные будут доступны команде?' },
    { field:'success', question:'Как измерить успешный результат?' }
  ];
  const dna = breakdownFor(top);
  const recentOffers = state.offers.slice(0,3);
  return `<div class="page-heading design-heading"><div><div class="eyebrow-line">READINESS OS <span>· AI-POWERED TASK PREPARATION</span></div><h1>Центр готовности задач</h1><p>Соберите сильную бизнес-задачу, объясните её ценность и дайте командам честный шанс сделать предложение.</p></div><div class="heading-actions"><button class="btn primary" data-action="new-task">＋ Новая задача</button></div></div>
  <div class="os-grid os-grid-3">
    <div class="card os-panel score-panel-main"><div class="os-panel-head"><div><span class="eyebrow">READINESS SCORE</span><h2>Ваш главный сигнал</h2></div><span class="mini-status">● live</span></div><div class="score-main-body"><div class="big-ring" style="--score:${top.score}"><div><strong>${top.score}</strong><span>/ 100</span></div></div><div class="legend-list">${dna.map((row,i)=>`<div class="legend-item"><i class="legend-dot dot-${i}"></i><span>${row.label}</span><b>${row.points}</b></div>`).join('')}</div></div><div class="panel-footer-note">${Math.max(0,100-top.score)} баллов до полной готовности <button class="btn soft small" data-task="${top.id}">Next leap&nbsp; +${Math.min(15,100-top.score)} →</button></div></div>
    <div class="card os-panel ai-step-panel"><div class="os-panel-head"><div><span class="eyebrow ai-eyebrow">AI STEP</span><h2>Сначала — уточнить</h2></div><span class="ai-spark">✦</span></div><div class="ai-preview-list">${sampleQuestions.slice(0,3).map((q,i)=>`<div class="ai-preview-row"><span class="q-num">${String(i+1).padStart(2,'0')}</span><span>${escapeHtml(q.question)}</span><b>→</b></div>`).join('')}</div><div class="evidence-cloud"><span class="evidence-chip found">Найдено в описании</span><span class="evidence-chip ask">Нужно уточнить</span><span class="evidence-chip human">Подтверждено человеком</span></div><button class="btn primary full-btn" data-action="new-task">Открыть AI Step ✦</button></div>
    <div class="card os-panel dna-preview-panel"><div class="os-panel-head"><div><span class="eyebrow">READINESS DNA</span><h2>Task Card</h2></div><button class="icon-btn" data-task="${top.id}" aria-label="Редактировать">↗</button></div><div class="task-ribbon"><span class="badge ${levelClass(top.level)}">${top.level}</span><span class="badge gray">${top.industry}</span><span class="badge blue">${top.score} points</span></div><h3>${escapeHtml(top.title)}</h3><p>${escapeHtml(top.context)}</p><div class="dna-bars">${dna.slice(0,4).map(row=>`<div class="dna-bar-row"><span>${row.label.split(' ')[0]}</span><div class="progress"><i style="width:${Math.round(row.points/row.weight*100)}%"></i></div><b>${row.points}</b></div>`).join('')}</div><button class="btn success full-btn" data-task="${top.id}">Открыть карточку →</button></div>
  </div>
  <div class="os-grid os-grid-3 os-grid-lower">
    <div class="card os-panel catalog-mini"><div class="os-panel-head"><div><span class="eyebrow">CATALOG</span><h2>Открытый пул задач</h2></div><button class="link-btn" data-view="catalog">Все задачи →</button></div><div class="catalog-mini-grid">${published.slice(0,3).map(t=>`<button class="catalog-mini-card" data-task="${t.id}"><strong>${t.score}</strong><span>${escapeHtml(t.title)}</span><em class="badge ${levelClass(t.level)}">${t.level}</em></button>`).join('')}</div></div>
    <div class="card os-panel decision-mini"><div class="os-panel-head"><div><span class="eyebrow">DECISION ROOM</span><h2>Сравнение команд</h2></div><button class="link-btn" data-view="offers">Открыть →</button></div><div class="decision-mini-list">${recentOffers.map(o=>{const team=state.teams.find(t=>t.id===o.teamId); const task=state.tasks.find(t=>t.id===o.taskId); return `<div class="decision-mini-row"><div class="team-avatar">${team.initials}</div><div><strong>${team.name}</strong><span>${escapeHtml(task.title)}</span></div><em class="badge ${o.status==='accepted'?'green':'orange'}">${o.status==='accepted'?'Выбрано':'Сравнить'}</em></div>`}).join('')}</div></div>
    <div class="card os-panel analytics-mini"><div class="os-panel-head"><div><span class="eyebrow">ANALYTICS</span><h2>Динамика готовности</h2></div><button class="link-btn" data-view="analytics">Подробнее →</button></div><div class="mini-chart"><svg viewBox="0 0 320 110" role="img" aria-label="Рост средней готовности задач"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3c83e6" stop-opacity=".25"/><stop offset="1" stop-color="#3c83e6" stop-opacity="0"/></linearGradient></defs><path d="M0 91 C38 75, 55 72, 82 70 S128 75, 155 60 S205 62, 230 49 S278 51, 320 18 L320 110 L0 110 Z" fill="url(#area)"/><path d="M0 91 C38 75, 55 72, 82 70 S128 75, 155 60 S205 62, 230 49 S278 51, 320 18" fill="none" stroke="#347fe1" stroke-width="3" stroke-linecap="round"/><circle cx="230" cy="49" r="4" fill="#347fe1"/><text x="238" y="43" fill="#17212b" font-size="11" font-weight="700">${avg} avg</text></svg><div class="chart-labels"><span>Неделя 1</span><span>Неделя 2</span><span>Сегодня</span></div></div></div>
  </div>`;
}
function recommendation(key) { return ({ context:'Опишите текущий процесс и конкретную боль в одном абзаце.', data:'Добавьте источник данных, пример записи или доступный набор материалов.', expected:'Сформулируйте артефакт, который команда должна передать бизнесу.', success:'Укажите измеримый порог: время, долю, количество или конверсию.', constraints:'Зафиксируйте срок, доступы и технологии, которые нельзя использовать.', users:'Назовите основную группу пользователей и её рабочий контекст.', business:'Укажите контакт, частоту консультаций и способ быстрой обратной связи.' })[key]; }
function renderCreate() {
  const d = state.draft; const score = scoreFor(d); const rows = breakdownFor(d); const isQuestion = state.draftStep === 2;
  return `<div class="page-heading"><div><h1>Конструктор задачи</h1><p>Начните с одной фразы — AI поможет найти важные пробелы, но не придумает факты.</p></div><div class="heading-actions"><button class="btn" data-action="reset-draft">Сбросить</button></div></div>
  <div class="stepper">${['Черновик','Уточнение','Карточка','Публикация'].map((x,i)=>`<div class="step ${state.draftStep === i+1 ? 'active' : state.draftStep > i+1 ? 'done':''}"><span class="num">${state.draftStep > i+1 ? '✓' : i+1}</span>${x}</div>`).join('')}</div>
  ${state.draftStep === 1 ? renderDraftStep(d) : state.draftStep === 2 ? renderQuestionsStep(d) : renderCardStep(d, score, rows)}
  `;
}
function renderDraftStep(d) { return `<div class="form-layout"><div class="card form-card"><div class="ai-banner"><div class="ai-orb">✦</div><div><strong>AI-навигатор включён</strong><p>Опишите проблему своими словами. Мы выделим контекст и предложим вопросы именно по недостающим сведениям.</p></div></div><div class="field"><label for="raw">Что нужно изменить?</label><textarea class="textarea" id="raw" placeholder="Например: менеджеры вручную переносят заявки из почты в таблицу, из-за этого теряются обращения...">${escapeHtml(d.raw)}</textarea></div><div class="form-grid" style="margin-top:15px"><div class="field"><label for="industry">Отрасль</label><select class="select" id="industry">${['Сервисы','Образование','Госуслуги','Ритейл','Здравоохранение','Другое'].map(x=>`<option ${d.industry===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label for="contact">Контакт бизнеса <span>(необязательно)</span></label><input class="input" id="contact" value="${escapeHtml(d.contact)}" placeholder="Имя и роль" /></div></div><div style="display:flex;justify-content:flex-end;margin-top:18px"><button class="btn primary" data-action="analyze">Проанализировать черновик ✦</button></div></div><div class="card score-panel"><div class="section-title"><h3>Как это работает</h3><span>3 шага</span></div><div class="journey" style="display:grid;gap:15px;padding:2px 0"><div class="journey-step" style="display:flex;gap:10px;text-align:left;align-items:center"><div class="journey-dot" style="margin:0">1</div><div><strong>AI находит пробелы</strong><span>Без выдуманных фактов</span></div></div><div class="journey-step" style="display:flex;gap:10px;text-align:left;align-items:center"><div class="journey-dot" style="margin:0;background:var(--purple-soft);color:var(--purple)">2</div><div><strong>Бизнес подтверждает</strong><span>Карточка редактируется</span></div></div><div class="journey-step" style="display:flex;gap:10px;text-align:left;align-items:center"><div class="journey-dot" style="margin:0;background:var(--green-soft);color:var(--green)">3</div><div><strong>Команды выбираются</strong><span>Никакого автоподбора</span></div></div></div></div></div>`; }
function renderQuestionsStep(d) { return `<div class="form-layout"><div class="card form-card"><div class="ai-banner"><div class="ai-orb">✦</div><div><strong>Нашли ${d.questions.length} точки роста</strong><p>Ответьте на вопросы — ответы попадут в редактируемую карточку. Если вопрос не подходит, его можно пропустить.</p></div></div><div class="questions">${d.questions.map((q,i)=>`<div class="question"><div class="q-top"><strong>${i+1}. ${escapeHtml(q.question)}</strong><small>поле: ${escapeHtml(fieldLabels[q.field] || q.field)}</small></div><textarea class="textarea question-answer" data-field="${q.field}" placeholder="Ваш ответ..." style="min-height:76px;margin-top:9px">${escapeHtml(d[q.field] || '')}</textarea></div>`).join('')}</div><div style="display:flex;justify-content:space-between;gap:10px;margin-top:18px"><button class="btn" data-action="back-step">← Назад</button><button class="btn primary" data-action="build-card">Собрать карточку →</button></div></div><div class="card score-panel"><div class="section-title"><h3>Принцип доверия</h3></div><div class="insight" style="margin-bottom:12px"><div class="insight-icon">⌁</div><div><strong>Только ваши факты</strong><p>AI не имеет права добавлять сведения о сроках, пользователях или данных, которых нет в ответах.</p></div></div><div class="section-title" style="margin-top:20px"><h3>Сейчас известно</h3></div><div class="task-meta">${d.industry ? `<span>◈ ${escapeHtml(d.industry)}</span>` : ''}${d.contact ? `<span>♙ ${escapeHtml(d.contact)}</span>` : ''}</div></div></div>`; }
function renderCardStep(d, score, rows) { return `<div class="form-layout"><div class="card form-card"><div class="ai-banner"><div class="ai-orb">✓</div><div><strong>Карточка готова к редактуре</strong><p>Проверьте формулировки и добавьте точные детали. Рейтинг изменяется в реальном времени.</p></div></div><div class="form-grid"><div class="field full"><label>Название задачи</label><input class="input draft-field" data-field="title" value="${escapeHtml(d.title)}" placeholder="Короткое название результата" /></div>${Object.keys(fieldLabels).map(key=>`<div class="field ${key==='context'||key==='data'||key==='expected'||key==='success'?'full':''}"><label>${fieldLabels[key]} <span>до ${weights[key]} баллов</span></label><textarea class="textarea draft-field" data-field="${key}" style="min-height:78px">${escapeHtml(d[key])}</textarea></div>`).join('')}<div class="field"><label>Формат взаимодействия</label><select class="select draft-field" data-field="interaction">${['Онлайн-встречи','Чат и еженедельный созвон','Гибридно','Асинхронно'].map(x=>`<option ${d.interaction===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Контакт</label><input class="input draft-field" data-field="contact" value="${escapeHtml(d.contact)}" /></div></div><label class="publish-check"><input type="checkbox" id="confirm-card" ${d.confirmed?'checked':''} /><span>Я подтверждаю, что сведения в карточке предоставлены бизнесом и готовы к публикации.</span></label><div style="display:flex;justify-content:space-between;gap:10px"><button class="btn" data-action="back-step">← Вопросы</button><button class="btn primary" data-action="publish-draft" ${d.confirmed?'':'disabled'}>Подтвердить и опубликовать →</button></div></div><div class="card score-panel"><div class="section-title"><h3>Readiness DNA</h3><span>объяснимый score</span></div><div class="score-big"><div class="score-number">${score}</div><div class="score-caption"><strong>${levelFor(score)}</strong><span>готовность задачи</span></div></div><div class="progress" style="height:10px;margin-bottom:18px"><i style="width:${score}%"></i></div><div class="breakdown">${rows.map(row=>`<div class="breakdown-row"><div><div class="label"><span>${row.label}</span><b>${row.points}/${row.weight}</b></div><div class="progress"><i style="width:${Math.round(row.points/row.weight*100)}%"></i></div></div></div>`).join('')}</div>${nextActions(d).length ? `<div class="missing"><h4>Что повысит рейтинг</h4><ul>${nextActions(d).map(a=>`<li>${a.label}: ещё +${a.weight-a.points}</li>`).join('')}</ul></div>` : ''}</div></div>`; }
function taskCard(task, showMatch=false) { const match = showMatch ? matchFor(task) : null; return `<div class="card task-card"><div class="task-card-head"><div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.context)}</p></div><span class="badge ${levelClass(task.level)}">${task.score} · ${task.level}</span></div><div class="task-meta"><span>◈ ${escapeHtml(task.industry)}</span><span>◷ ${escapeHtml(task.created)}</span>${task.tags.map(x=>`<span>#${escapeHtml(x)}</span>`).join('')}</div><div class="task-score"><div class="progress"><i style="width:${task.score}%"></i></div><strong>${task.score}%</strong></div>${match ? `<div class="insight" style="margin-top:14px;padding:10px;background:var(--purple-soft);border-color:#ded8fa"><div class="insight-icon" style="background:white">✦</div><div><strong style="color:#5d4cab">${match}% совпадение с Data Nomads</strong><p style="color:#746b9d">${matchReason(task)}</p></div></div>` : ''}<div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn soft small" data-task="${task.id}">Подробнее →</button></div></div>`; }
function renderCatalog() { const tasks = state.tasks.filter(t=>t.status==='published'); return `<div class="page-heading"><div><h1>Открытый каталог задач</h1><p>Все опубликованные задачи доступны командам — независимо от рейтинга.</p></div><div class="heading-actions"><span class="badge green">● ${tasks.length} опубликовано</span></div></div><div class="catalog-toolbar"><input class="input" id="catalog-search" placeholder="Поиск по задачам..." /><select class="select" id="catalog-industry"><option value="">Все отрасли</option>${[...new Set(tasks.map(t=>t.industry))].map(x=>`<option>${x}</option>`).join('')}</select><select class="select" id="catalog-level"><option value="">Все уровни</option>${['Приоритетная','Готовая','Рабочая','Черновик'].map(x=>`<option>${x}</option>`).join('')}</select><select class="select" id="catalog-sort"><option value="score">Сначала готовые</option><option value="new">Сначала новые</option></select></div><div id="catalog-list" class="grid grid-2">${tasks.sort((a,b)=>b.score-a.score).map(t=>taskCard(t,state.role==='team')).join('')}</div>`; }
function matchFor(task) { const text = `${task.title} ${task.context} ${task.tags.join(' ')}`.toLowerCase(); const keywords = ['данные','автоматизация','образование','город','ai','классификация','рекомендации']; return Math.min(98, 58 + keywords.filter(k=>text.includes(k)).length*7); }
function matchReason(task) { return task.tags.includes('AI') ? 'Сильное совпадение по NLP и ML.' : task.tags.includes('автоматизация') ? 'Сильное совпадение по Python и процессам.' : 'Совпадают интересы и формат прототипирования.'; }
function renderOffers() { const mine = state.role === 'team'; const offers = mine ? state.offers.filter(o=>o.teamId==='team1') : state.offers; return `<div class="page-heading"><div><h1>${mine ? 'Мои отклики' : 'Комната решений'}</h1><p>${mine ? 'Следите за решениями бизнеса и прогрессом по выбранным задачам.' : 'Сравните предложения и примите решение самостоятельно — без автоматического назначения.'}</p></div><div class="heading-actions">${mine ? '<span class="badge purple">Data Nomads · 120 баллов</span>' : '<span class="badge blue">Решение за бизнесом</span>'}</div></div>${!mine ? `<div class="card section-card" style="margin-bottom:18px"><div class="section-title"><h3>Новые отклики</h3><span>${offers.filter(o=>o.status==='pending').length} требуют решения</span></div><div class="grid grid-2">${offers.map(offerCard).join('')}</div></div>` : `<div class="grid grid-2">${offers.length ? offers.map(offerCard).join('') : '<div class="card empty">Пока нет откликов</div>'}</div>`}`; }
function offerCard(o) { const task = state.tasks.find(t=>t.id===o.taskId); const team = state.teams.find(t=>t.id===o.teamId); return `<div class="card offer-card"><div class="offer-top"><div class="team-name"><div class="team-avatar">${team.initials}</div><div><h3>${team.name}</h3><p>для: ${escapeHtml(task.title)}</p></div></div><span class="badge ${o.status==='accepted'?'green':o.status==='rejected'?'gray':'orange'}">${o.status==='accepted'?'Выбрано':o.status==='rejected'?'Отклонено':'На рассмотрении'}</span></div><div class="offer-body"><strong style="display:block;color:var(--navy);font-size:12px;margin-bottom:5px">Идея</strong>${escapeHtml(o.idea)}<br/><br/><strong style="display:block;color:var(--navy);font-size:12px;margin-bottom:5px">План</strong>${escapeHtml(o.plan)}</div><div class="task-meta"><span>◷ ${escapeHtml(o.deadline)}</span><span>↗ <a href="${escapeHtml(o.prototype)}" target="_blank" rel="noreferrer">Прототип</a></span></div>${state.role==='business' && o.status==='pending' ? `<div class="offer-actions"><button class="btn danger small" data-offer="${o.id}" data-decision="reject">Отклонить</button><button class="btn success small" data-offer="${o.id}" data-decision="accept">Выбрать команду</button></div>` : o.status==='accepted' ? `<div class="offer-actions"><button class="btn soft small" data-offer="${o.id}" data-decision="progress">＋ Подтвердить прогресс</button></div>` : ''}</div>`; }
function renderAnalytics() { const tasks = state.tasks.filter(t=>t.status==='published'); const avg = Math.round(tasks.reduce((a,t)=>a+t.score,0)/tasks.length); return `<div class="page-heading"><div><h1>Аналитика доверия</h1><p>Показываем не только результат, но и путь от идеи до решения.</p></div><div class="heading-actions"><button class="btn soft" data-action="export">Экспорт demo JSON</button></div></div><div class="card section-card" style="margin-bottom:18px"><div class="kpi-strip"><div class="kpi"><strong>${avg}</strong><span>средняя готовность</span></div><div class="kpi"><strong>${tasks.filter(t=>t.score>=70).length}</strong><span>готовых задач</span></div><div class="kpi"><strong>${state.offers.length}</strong><span>всего откликов</span></div><div class="kpi"><strong>${state.offers.filter(o=>o.status==='accepted').length}</strong><span>ручных решений</span></div></div></div><div class="grid grid-2"><div class="card section-card"><div class="section-title"><h3>Путь задачи</h3><span>сквозной сценарий</span></div><div class="journey">${[['01','Черновик','сырой текст'],['02','Уточнение','AI-вопросы'],['03','Карточка','human review'],['04','Каталог','open pool'],['05','Решение','ручной выбор']].map(x=>`<div class="journey-step"><div class="journey-dot">${x[0]}</div><strong>${x[1]}</strong><span>${x[2]}</span></div>`).join('')}</div></div><div class="card section-card"><div class="section-title"><h3>Распределение задач</h3><span>готовность</span></div>${['Приоритетная','Готовая','Рабочая','Черновик'].map(l=>{const n=tasks.filter(t=>t.level===l).length; return `<div class="readiness-row" style="grid-template-columns:110px 1fr 28px;margin-bottom:12px"><label>${l}</label><div class="progress"><i style="width:${Math.max(8,n/tasks.length*100)}%;background:${l==='Приоритетная'?'var(--purple)':l==='Готовая'?'var(--green)':l==='Рабочая'?'var(--blue)':'var(--orange)'}"></i></div><strong>${n}</strong></div>`}).join('')}</div></div><div class="card section-card" style="margin-top:18px"><div class="section-title"><h3>Открытый каталог</h3><span>низкий score не блокирует участие</span></div><div class="grid grid-3">${tasks.slice(0,3).map(t=>`<div class="task-card" style="box-shadow:none"><div class="task-card-head"><h3>${escapeHtml(t.title)}</h3><span class="badge ${levelClass(t.level)}">${t.score}</span></div><p style="margin-top:8px">${escapeHtml(t.level)} · ${escapeHtml(t.industry)}</p></div>`).join('')}</div></div>`; }
function bindEvents() {
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>{ state.view=btn.dataset.view; if(state.view==='create' && state.draftStep===4) state.draftStep=1; saveState(); render(); }));
  document.querySelectorAll('[data-role]').forEach(btn=>btn.addEventListener('click',()=>{ state.role=btn.dataset.role; saveState(); render(); }));
  document.querySelectorAll('[data-action="new-task"]').forEach(btn=>btn.addEventListener('click',()=>{ state.view='create'; state.draftStep=1; saveState(); render(); }));
  document.querySelectorAll('[data-action="reset-draft"]').forEach(btn=>btn.addEventListener('click',()=>{ state.draft=structuredClone(initialState.draft); state.draftStep=1; saveState(); render(); }));
  const raw = document.getElementById('raw'); if(raw) raw.addEventListener('input', e=>{state.draft.raw=e.target.value;});
  const industry = document.getElementById('industry'); if(industry) industry.addEventListener('change', e=>{state.draft.industry=e.target.value;});
  const contact = document.getElementById('contact'); if(contact) contact.addEventListener('input', e=>{state.draft.contact=e.target.value;});
  document.querySelectorAll('[data-action="analyze"]').forEach(btn=>btn.addEventListener('click', analyzeDraft));
  document.querySelectorAll('[data-action="back-step"]').forEach(btn=>btn.addEventListener('click',()=>{state.draftStep=Math.max(1,state.draftStep-1);saveState();render();}));
  document.querySelectorAll('[data-action="build-card"]').forEach(btn=>btn.addEventListener('click',()=>{ document.querySelectorAll('.question-answer').forEach(el=>state.draft[el.dataset.field]=el.value); const d=state.draft; d.title=d.title || titleFromDraft(d.raw); state.draftStep=3; saveState(); render(); }));
  document.querySelectorAll('.draft-field').forEach(el=>el.addEventListener('input', e=>{state.draft[e.target.dataset.field]=e.target.value; refreshCreateOnly();}));
  const confirm = document.getElementById('confirm-card'); if(confirm) confirm.addEventListener('change', e=>{state.draft.confirmed=e.target.checked; saveState(); render();});
  document.querySelectorAll('[data-action="publish-draft"]').forEach(btn=>btn.addEventListener('click',publishDraft));
  document.querySelectorAll('[data-task]').forEach(btn=>btn.addEventListener('click',()=>openTask(btn.dataset.task)));
  document.querySelectorAll('[data-offer]').forEach(btn=>btn.addEventListener('click',()=>decideOffer(btn.dataset.offer,btn.dataset.decision)));
  const search=document.getElementById('catalog-search'); const ind=document.getElementById('catalog-industry'); const lev=document.getElementById('catalog-level'); const sort=document.getElementById('catalog-sort');
  [search,ind,lev,sort].filter(Boolean).forEach(el=>el.addEventListener('input',()=>filterCatalog()));
  document.querySelectorAll('[data-action="export"]').forEach(btn=>btn.addEventListener('click',exportData));
}
async function analyzeDraft() {
  if(state.draft.raw.trim().length < 15) { toast('Добавьте хотя бы пару предложений — AI нужен контекст.'); return; }
  const raw = state.draft.raw.trim();
  const industry = state.draft.industry;
  const contact = state.draft.contact;
  let remoteDraft = null;
  if (/^https?:$/.test(location.protocol)) {
    try {
      const response = await fetch('/api/tasks/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({raw, industry, contact}) });
      if (response.ok) remoteDraft = (await response.json()).draft;
    } catch (_) {}
  }
  if (remoteDraft) {
    state.draft = { ...state.draft, ...remoteDraft };
  } else {
    const lower=raw.toLowerCase(); const questions=[];
    const probes = [
      ['users','Кто сейчас сталкивается с этой проблемой и для кого создаётся решение?', ['клиент','пользовател','родител','студент','менеджер','оператор','для ']],
      ['data','Какие данные, примеры или материалы будут доступны команде?', ['данн','таблиц','csv','пример','источн','выгруз','истори']],
      ['expected','Какой конкретный результат команда должна передать бизнесу?', ['прототип','сервис','система','результат','решен','дашборд','каталог']],
      ['success','По какому измеримому признаку вы примете решение, что задача решена?', ['процент','час','минут','количеств','сократ','увелич','точност','успеш']],
      ['constraints','Какие сроки, технологии, доступы или ограничения нужно учитывать?', ['срок','недел','месяц','огранич','доступ','нельзя','только']],
      ['business','Кто будет давать обратную связь и как часто можно сверяться?', ['контакт','созвон','обратн','встреч','куратор','руковод']],
    ];
    probes.forEach(([field,question,keys])=>{ if(!keys.some(k=>lower.includes(k))) questions.push({field,question}); });
    while(questions.length<3) questions.push({field:['success','data','constraints'][questions.length-1],question:probes.find(p=>p[0]===['success','data','constraints'][questions.length-1])[1]});
    state.draft.questions=questions.slice(0,5); state.draft.title=titleFromDraft(raw); state.draft.context=raw; state.draft.industry=industry; state.draft.contact=contact; state.draft.analyzed=true;
  }
  state.draftStep=2; saveState(); render(); toast(`Готово: нашли ${state.draft.questions.length} точек для усиления задачи.`);
}
function titleFromDraft(raw) { const clean=raw.replace(/^[\s\W]+/,'').split(/[.!?\n]/)[0].trim(); return clean.length>64 ? clean.slice(0,61)+'…' : clean || 'Новая бизнес-задача'; }
function refreshCreateOnly() { const score=scoreFor(state.draft); const num=document.querySelector('.score-number'); if(num) num.textContent=score; const cap=document.querySelector('.score-caption strong'); if(cap) {cap.textContent=levelFor(score); } document.querySelectorAll('.breakdown-row').forEach((row,i)=>{const data=breakdownFor(state.draft)[i]; const b=row.querySelector('b'); const bar=row.querySelector('i'); if(b)b.textContent=`${data.points}/${data.weight}`; if(bar)bar.style.width=`${Math.round(data.points/data.weight*100)}%`;}); const pub=document.querySelector('[data-action="publish-draft"]'); if(pub)pub.disabled=!state.draft.confirmed; saveState(); }
function publishDraft() { const d=state.draft; const score=scoreFor(d); const task={ id:'t'+Date.now(), title:d.title||titleFromDraft(d.raw), industry:d.industry, context:d.context||d.raw, data:d.data, expected:d.expected, success:d.success, constraints:d.constraints, users:d.users, business:d.business, contact:d.contact, interaction:d.interaction, score, level:levelFor(score), status:'published', created:'только что', tags:['новая задача'], owner:'business', confirmed:true }; state.tasks.unshift(task); state.draft=structuredClone(initialState.draft); state.draftStep=1; state.view='catalog'; saveState(); render(); toast(`Задача опубликована с рейтингом ${score}/100.`); }
function filterCatalog() { const q=(document.getElementById('catalog-search')?.value||'').toLowerCase(); const ind=document.getElementById('catalog-industry')?.value||''; const lev=document.getElementById('catalog-level')?.value||''; const sort=document.getElementById('catalog-sort')?.value||'score'; const tasks=state.tasks.filter(t=>t.status==='published').filter(t=>(!q||`${t.title} ${t.context} ${t.tags.join(' ')}`.toLowerCase().includes(q))&&(!ind||t.industry===ind)&&(!lev||t.level===lev)).sort((a,b)=>sort==='new' ? b.id.localeCompare(a.id) : b.score-a.score); const list=document.getElementById('catalog-list'); if(list)list.innerHTML=tasks.length?tasks.map(t=>taskCard(t,state.role==='team')).join(''):`<div class="card empty" style="grid-column:1/-1"><div class="empty-icon">⌕</div>Ничего не нашли. Попробуйте изменить фильтр.</div>`; document.querySelectorAll('[data-task]').forEach(btn=>btn.addEventListener('click',()=>openTask(btn.dataset.task))); }
function openTask(id) { const t=state.tasks.find(x=>x.id===id); if(!t)return; document.getElementById('modal-root').innerHTML=`<div class="modal-backdrop" data-close-modal><div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div><span class="badge ${levelClass(t.level)}">${t.score} · ${t.level}</span><h2>${escapeHtml(t.title)}</h2><p>${escapeHtml(t.industry)} · опубликовано ${escapeHtml(t.created)}</p></div><button class="close" data-close>×</button></div><div class="insight"><div class="insight-icon">✦</div><div><strong style="color:#5d4cab">Почему этот score?</strong><p style="color:#746b9d">${t.score >= 70 ? 'Карточка содержит достаточно деталей, чтобы команда могла начать работу.' : 'Задача доступна для откликов, но бизнесу стоит добавить данные и критерии успеха.'}</p></div></div><div class="modal-section"><h4>Карточка задачи</h4><div class="detail-grid">${Object.keys(fieldLabels).map(key=>`<div class="detail-item"><span>${fieldLabels[key]}</span><b>${escapeHtml(t[key]||'Не заполнено')}</b></div>`).join('')}</div></div>${state.role==='team'?`<div class="modal-section"><h4>Подать предложение</h4><textarea class="textarea" id="offer-idea" placeholder="Какая идея решения?" style="min-height:82px"></textarea><textarea class="textarea" id="offer-plan" placeholder="Какой план и срок?" style="min-height:82px;margin-top:8px"></textarea><input class="input" id="offer-link" placeholder="Ссылка на прототип (необязательно)" style="margin-top:8px"/><button class="btn primary" data-submit-offer="${t.id}" style="margin-top:12px;width:100%">Отправить предложение</button></div>`:''}</div></div>`; document.querySelector('[data-close]')?.addEventListener('click',closeModal); document.querySelector('[data-close-modal]')?.addEventListener('click',closeModal); document.querySelector('[data-submit-offer]')?.addEventListener('click',()=>submitOffer(t.id)); }
function closeModal(){document.getElementById('modal-root').innerHTML='';}
function submitOffer(taskId){const idea=document.getElementById('offer-idea')?.value.trim(); const plan=document.getElementById('offer-plan')?.value.trim(); if(!idea||!plan){toast('Добавьте идею и план — бизнесу важно сравнивать конкретику.');return;} state.offers.push({id:'o'+Date.now(),taskId,teamId:'team1',idea,plan,deadline:'уточняется',prototype:document.getElementById('offer-link')?.value.trim()||'#',status:'pending',created:'только что'}); saveState(); closeModal(); render(); toast('Отклик отправлен бизнесу.');}
function decideOffer(id,decision){const o=state.offers.find(x=>x.id===id); if(!o)return; if(decision==='accept'){o.status='accepted';toast('Команда выбрана вручную. Ей начислены баллы за старт.');}else if(decision==='reject'){o.status='rejected';toast('Отклик отклонён.');}else if(decision==='progress'){const team=state.teams.find(t=>t.id===o.teamId);team.points+=10;toast('Прогресс подтверждён: команде начислено +10 баллов.');}saveState();render();}
function exportData(){const blob=new Blob([JSON.stringify({tasks:state.tasks,teams:state.teams,offers:state.offers},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='taskready-demo-data.json';a.click();URL.revokeObjectURL(url);toast('Demo JSON выгружен.');}
render();
bootstrapServer();
