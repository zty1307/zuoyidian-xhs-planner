(() => {
  'use strict';
  const STORAGE_KEY = 'zuoyidian-collection-v3';
  const planner = globalThis.ActivityPlanner;
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const clock = (value) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const safeUrl = (value) => { try { const url = new URL(value); const host = url.hostname.toLowerCase(); const xhs = host === 'xiaohongshu.com' || host.endsWith('.xiaohongshu.com') || ['xhslink.com', 'www.xhslink.com', 'xhslink.cn', 'www.xhslink.cn'].includes(host); return ['http:', 'https:'].includes(url.protocol) && xhs ? url.href : ''; } catch { return ''; } };
  const newId = () => crypto.randomUUID ? crypto.randomUUID() : `save-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const modeLabel = (item) => planner.modeOf(item) === 'home' ? '在家' : planner.modeOf(item) === 'any' ? '不限地点' : item.area || '出门';
  function nextSaturday() { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() + ((6 - date.getDay() + 7) % 7)); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  function initialState() {
    const items = (globalThis.DEMO_NOTES || []).map(({cover,avatar,video,...item}) => ({ mode: 'home', open: '', close: '', area: '', address: '', prepared: true, afterId: '', ...item }));
    return { items, selected: items.map((item) => item.id), filter: 'all', hasPlan: true, done: {}, config: { date: nextSaturday(), start: '10:00', end: '13:00', maxTasks: 4, rest: 10, rain: false, travel: 25 } };
  }
  function loadState() {
    const fallback = initialState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.items) && Array.isArray(saved.selected)) {
        const items = saved.items.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string');
        return { ...fallback, ...saved, items, selected: saved.selected.filter((id) => items.some((item) => item.id === id)), filter: ['all', 'selected', 'unready'].includes(saved.filter) ? saved.filter : 'all', done: saved.done && typeof saved.done === 'object' ? saved.done : {}, config: { ...fallback.config, ...saved.config } };
      }
      const old = JSON.parse(localStorage.getItem('quyitang-collection-v2'));
      if (old && Array.isArray(old.items)) {
        const custom = old.items.filter((item) => item && !item.sample).map((item) => ({ ...item, mode: 'out', category: '出门', prepared: true, materials: '', afterId: '' }));
        fallback.items.push(...custom);
        fallback.selected.push(...custom.filter((item) => old.selected?.includes(item.id)).map((item) => item.id));
      }
    } catch {}
    return fallback;
  }
  let state = loadState(), editingId = null, toastTimer;
  let activeCategory = '全部', searchQuery = '';
  const mediaFor = (item) => (globalThis.DEMO_NOTES || []).find((note) => note.id === item.id) || {};
  const icon = (name) => { const paths = {check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',bookmark:'<path d="M6 4h12v17l-6-4-6 4Z"/>' }; return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bookmark}</svg>`; };
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { showToast('本机保存失败，建议导出计划'); } }
  function showToast(message, action) {
    const toast = $('#toast'); toast.replaceChildren(document.createTextNode(message));
    if (action) { const button = document.createElement('button'); button.type = 'button'; button.textContent = '撤销'; button.addEventListener('click', () => { action(); toast.classList.remove('show'); }, { once: true }); toast.appendChild(button); }
    toast.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), action ? 7000 : 3200);
  }
  function readiness(item) {
    const gaps = [];
    if (item.prepared === false) gaps.push('材料待备齐');
    if (planner.modeOf(item) === 'out' && !item.address) gaps.push('地点待确认');
    return gaps;
  }
  function renderCollection() {
    $('#collectionCount').textContent = state.items.length;
    $('#selectedCount').textContent = state.selected.length;
    $('#unreadyCount').textContent = state.items.filter((item) => readiness(item).length).length;
    $('#rainOption').hidden = !state.items.some((item) => state.selected.includes(item.id) && planner.modeOf(item) === 'out' && item.outdoor);
    $('#travelOption').hidden = !state.items.some((item) => state.selected.includes(item.id) && planner.modeOf(item) === 'out');
    document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.filter));
    const categories = ['全部', ...new Set(state.items.map((item)=>item.category || '其他'))];
    if (!categories.includes(activeCategory)) activeCategory='全部';
    $('#categoryFilters').innerHTML = categories.map(category=>`<button type="button" class="category-filter ${category===activeCategory?'active':''}" data-category="${esc(category)}" aria-pressed="${category===activeCategory}">${esc(category)}</button>`).join('');
    const items = state.items.filter((item) => (state.filter === 'all' || (state.filter === 'selected' ? state.selected.includes(item.id) : readiness(item).length)) && (activeCategory==='全部'||item.category===activeCategory) && (!searchQuery||[item.title,item.sourceTitle,item.author,item.category].some(value=>String(value||'').toLowerCase().includes(searchQuery))));
    $('#collectionList').innerHTML = items.length ? items.map((item) => {
      const chosen = state.selected.includes(item.id), link = safeUrl(item.url), gaps = readiness(item);
      const media = mediaFor(item), title = item.sourceTitle || item.title;
      return `<article class="save-card ${chosen ? 'selected' : ''}" data-id="${esc(item.id)}">
        <div class="cover-wrap">${link ? `<a class="cover-link" href="${esc(link)}" target="_blank" rel="noopener noreferrer" aria-label="查看原笔记：${esc(title)}">` : '<div class="cover-link">'}${media.cover?`<img class="note-cover" src="${esc(media.cover)}" alt="${esc(title)}" loading="eager" />`:`<div class="cover-placeholder">${icon('bookmark')}<span>${esc(item.category)}</span></div>`}${link?'</a>':'</div>'}${media.video?`<span class="video-badge">${icon('play')}</span>`:''}<button class="cover-select" data-action="choose" type="button" aria-label="${chosen?'取消选择':'选择'}${esc(item.title)}" aria-pressed="${chosen}">${icon(chosen?'check':'plus')}</button><span class="duration-badge">${esc(item.duration)} 分钟</span></div>
        <div class="card-caption"><h3>${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(title)}</a>`:esc(title)}</h3><div class="author-row"><span class="author">${media.avatar?`<img src="${esc(media.avatar)}" alt="" />`:'<span class="avatar-placeholder">我</span>'}<span>${esc(item.author || '我的收藏')}</span></span><details class="card-menu"><summary aria-label="管理${esc(item.title)}">${icon('more')}</summary><div class="menu-popover"><button data-action="edit" type="button">编辑安排</button><button data-action="priority" type="button">${item.priority?'取消优先':'优先安排'}</button><button data-action="delete" type="button">删除收藏</button></div></details></div>${gaps.length?`<button class="unready-tag" data-action="${item.prepared===false?'prepared':'edit'}" type="button">${item.prepared===false?'材料待准备 · 标为备齐':'地点待确认'}</button>`:''}</div>
      </article>`;
    }).join('') : '<div class="empty-list">没有找到收藏</div>';
  }
  function readConfig() { state.config = { date: $('#planDate').value, start: $('#startTime').value, end: $('#endTime').value, maxTasks: Number($('#maxTasks').value), rest: Number($('#restBuffer').value), rain: $('#rainToggle').checked, travel: Number($('#travelBuffer').value) }; saveState(); }
  function planError() {
    if (!state.config.date) return '先选一个日期';
    if (!Number.isFinite(planner.minutes(state.config.start)) || !Number.isFinite(planner.minutes(state.config.end)) || planner.minutes(state.config.start) >= planner.minutes(state.config.end)) return '结束时间需要晚于开始时间';
    if (!state.selected.length) return '先选一件这次想做的事';
    return '';
  }
  const buildPlan = () => planner.buildPlan(state.items, state.selected, state.config, state.done);
  function dateLabel(text) { const date = new Date(`${text}T12:00:00`); return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date); }
  function planNotes(plan) {
    const notes = [];
    if (plan.entries.some((entry) => entry.transfer)) notes.push('通勤为预留时间，出门前核对实际路程。');
    for (let index = 1; index < plan.entries.length; index++) {
      const entry = plan.entries[index], previous = plan.entries[index - 1];
      const free = entry.start - previous.end - entry.transfer - entry.rest;
      if (free >= 30) notes.push(`${clock(previous.end)}—${clock(entry.start - entry.transfer)} 有空档，可休息或自行安排。`);
    }
    for (const entry of plan.entries) {
      const item = state.items.find((candidate) => candidate.id === entry.id);
      if (planner.modeOf(item) === 'out' && !item.address) notes.push(`${item.title}：地点待确认`);
      if (item.reservation) notes.push(`${item.title}：先确认预约`);
    }
    notes.push(...plan.excluded.map(({ item, reason }) => `${item.title}：${reason}`));
    return notes;
  }
  function renderPlan() {
    const resultEl = $('#planResult'), notesEl = $('#planNotes');
    if (!state.hasPlan) { resultEl.innerHTML = '<div class="plan-empty"><strong>还没有计划</strong><p>选好收藏后，点“安排一下”。</p></div>'; notesEl.innerHTML = ''; return; }
    const error = planError();
    if (error) { resultEl.innerHTML = `<div class="plan-empty"><strong>${esc(error)}</strong></div>`; notesEl.innerHTML = ''; return; }
    const plan = buildPlan();
    if (!plan.entries.length) resultEl.innerHTML = '<div class="plan-empty"><strong>这次暂时排不进去</strong><p>看看下面的原因，或换一段空闲时间。</p></div>';
    else {
      const completed = plan.entries.filter((entry) => state.done[`${state.config.date}:${entry.id}`]).length;
      resultEl.innerHTML = `<div class="plan-summary"><strong>${plan.entries.length} 件安排</strong><small>${completed} / ${plan.entries.length} 完成</small></div><div class="timeline">${plan.entries.map((entry) => {
        const item = state.items.find((candidate) => candidate.id === entry.id), link = safeUrl(item.url), isDone = Boolean(state.done[`${state.config.date}:${entry.id}`]);
        return `<div class="timeline-item"><div class="timeline-time">${clock(entry.start)}<span>${clock(entry.end)}</span></div><div class="timeline-body ${isDone ? 'done' : ''}"><div class="task-title"><h3>${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a>`:esc(item.title)}</h3><button class="done-btn ${isDone?'checked':''}" data-done="${esc(item.id)}" type="button" aria-label="${isDone?'取消完成':'完成'}${esc(item.title)}" aria-pressed="${isDone}">${isDone?icon('check'):''}</button></div><p>${esc(modeLabel(item))} · ${esc(item.duration)} 分钟${entry.transfer ? ` · 通勤 ${entry.transfer} 分钟` : ''}</p>${item.materials ? `<details class="task-prep"><summary>准备</summary><p>${esc(item.materials)}</p></details>` : ''}</div></div>`;
      }).join('')}</div>`;
    }
    const notes = planNotes(plan);
    notesEl.innerHTML = notes.length ? `<details><summary>${plan.excluded.length?`${plan.excluded.length} 件未安排`:'安排提醒'}</summary>${notes.map((note) => `<p class="note-line">${esc(note)}</p>`).join('')}</details>` : '';
  }
  function renderAll() { renderCollection(); renderPlan(); }
  function syncMode() { $('#locationFields').hidden = $('#activityMode').value !== 'out'; }
  function openDialog(id = null) {
    const form = $('#addForm'); form.reset(); $('#shareText').value = ''; $('#formError').textContent = ''; $('#advancedFields').open = false;
    editingId = typeof id === 'string' ? id : null;
    const item = state.items.find((candidate) => candidate.id === editingId);
    form.elements.afterId.innerHTML = '<option value="">没有先后要求</option>' + state.items.filter((candidate) => candidate.id !== editingId).map((candidate) => `<option value="${esc(candidate.id)}">${esc(candidate.title)}</option>`).join('');
    $('#dialogTitle').textContent = item ? '编辑安排' : '添加收藏';
    $('#dialogSubmitBtn').textContent = item ? '保存' : '添加';
    if (item) {
      ['title', 'category', 'duration', 'mode', 'materials', 'area', 'address', 'open', 'close', 'url', 'sourceTitle', 'author', 'afterId'].forEach((name) => { form.elements[name].value = item[name] ?? ''; });
      ['outdoor', 'weekendsOnly', 'reservation', 'priority'].forEach((name) => { form.elements[name].checked = Boolean(item[name]); });
      form.elements.prepared.checked = item.prepared !== false;
      $('#advancedFields').open = Boolean(item.open || item.close || item.afterId || item.weekendsOnly);
    }
    syncMode(); $('#addDialog').showModal(); form.elements.title.focus();
  }
  function closeDialog() { $('#addDialog').close(); editingId = null; }
  function extractShare() {
    const text = $('#shareText').value.trim(); if (!text) return showToast('先粘贴小红书分享文案或链接');
    const links = text.match(/https?:\/\/[^\s<>"'，。]+/gi) || [];
    const link = links.map((value) => safeUrl(value.replace(/[),.;!?]+$/, ''))).find(Boolean) || '';
    const bracketTitle = [...text.matchAll(/【([^】]+)】/g)].map((match) => match[1].replace(/\s*-\s*小红书.*$/, '').trim()).find((value) => value && value !== '小红书');
    const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line && !/https?:\/\//i.test(line) && !/(发布了一篇小红书笔记|复制本条信息|打开小红书|快来看吧)/.test(line));
    const title = bracketTitle || firstLine;
    if (link) $('#addForm').elements.url.value = link;
    if (title) { $('#addForm').elements.sourceTitle.value = title.slice(0, 120); if (!$('#addForm').elements.title.value.trim()) $('#addForm').elements.title.value = title.slice(0, 60); }
    showToast(link ? title ? '已识别标题和链接，补个实践耗时就好' : '已识别链接，请填写想做什么' : title ? '已识别标题，请补充笔记链接' : '未识别出标题或链接，请手动填写');
  }
  function exportPlan() {
    readConfig(); if (!state.hasPlan || planError()) return showToast('先生成一份计划');
    const plan = buildPlan(); if (!plan.entries.length) return showToast('目前没有可导出的事项');
    const lines = [`做一点 · ${dateLabel(state.config.date)}`, `${state.config.start}—${state.config.end} · ${plan.entries.length} 件`, ''];
    plan.entries.forEach((entry, index) => { const item = state.items.find((candidate) => candidate.id === entry.id); lines.push(`${index + 1}. ${clock(entry.start)}—${clock(entry.end)} ${item.title}`, `   ${modeLabel(item)}${item.address ? ` · ${item.address}` : ''}`); if (item.materials) lines.push(`   准备：${item.materials}`); if (item.url) lines.push(`   原笔记：${item.url}`); lines.push(''); });
    const notes = planNotes(plan); if (notes.length) lines.push('安排说明：', ...notes.map((note) => `- ${note}`));
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })); link.download = `做一点-${state.config.date}.txt`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 1000); showToast('计划已导出');
  }
  function chooseWithPrerequisites(id, visited = new Set()) {
    if (visited.has(id)) return; visited.add(id);
    const item = state.items.find((candidate) => candidate.id === id); if (!item) return;
    if (!state.selected.includes(id)) state.selected.push(id);
    if (item.afterId) chooseWithPrerequisites(item.afterId, visited);
  }
  function createsCycle(id, afterId) {
    const visited = new Set([id]); let next = afterId;
    while (next) { if (visited.has(next)) return true; visited.add(next); next = state.items.find((item) => item.id === next)?.afterId; }
    return false;
  }
  $('#addBtn').addEventListener('click', () => openDialog());
  $('#searchInput').addEventListener('input', event => { searchQuery=event.target.value.trim().toLowerCase(); renderCollection(); });
  $('#categoryFilters').addEventListener('click', event=>{const button=event.target.closest('[data-category]');if(button){activeCategory=button.dataset.category;renderCollection();}});
  $('#activityMode').addEventListener('change', syncMode);
  $('#closeDialogBtn').addEventListener('click', closeDialog);
  $('#cancelDialogBtn').addEventListener('click', closeDialog);
  $('#addDialog').addEventListener('click', (event) => { if (event.target === $('#addDialog')) closeDialog(); });
  $('#parseShareBtn').addEventListener('click', extractShare);
  $('#exportBtn').addEventListener('click', exportPlan);
  $('#planBtn').addEventListener('click', () => { readConfig(); const error = planError(); if (error) return showToast(error); state.hasPlan = true; saveState(); renderPlan(); $('#planResult').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
  ['planDate', 'startTime', 'endTime', 'maxTasks', 'restBuffer', 'rainToggle', 'travelBuffer'].forEach((id) => $(`#${id}`).addEventListener('change', () => { readConfig(); if (state.hasPlan) renderPlan(); }));
  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; saveState(); renderCollection(); }));
  $('#collectionList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const id = button.closest('[data-id]')?.dataset.id, item = state.items.find((candidate) => candidate.id === id); if (!item) return;
    const action = button.dataset.action;
    if (action === 'edit') return openDialog(id);
    if (action === 'choose') { if (state.selected.includes(id)) state.selected = state.selected.filter((value) => value !== id); else chooseWithPrerequisites(id); }
    if (action === 'priority') item.priority = !item.priority;
    if (action === 'prepared') item.prepared = true;
    if (action === 'delete') {
      const index = state.items.indexOf(item), wasSelected = state.selected.includes(id), dependents = state.items.filter((candidate) => candidate.afterId === id).map((candidate) => candidate.id);
      state.items = state.items.filter((candidate) => candidate.id !== id); state.selected = state.selected.filter((value) => value !== id);
      state.items.forEach((candidate) => { if (candidate.afterId === id) candidate.afterId = ''; });
      showToast('已删除这件事', () => { state.items.splice(Math.min(index, state.items.length), 0, item); if (wasSelected) chooseWithPrerequisites(id); state.items.forEach((candidate) => { if (dependents.includes(candidate.id) && !candidate.afterId) candidate.afterId = id; }); saveState(); renderAll(); });
    }
    saveState(); renderAll();
  });
  $('#planResult').addEventListener('click', (event) => { const button = event.target.closest('[data-done]'); if (!button) return; const key = `${state.config.date}:${button.dataset.done}`; state.done[key] = !state.done[key]; saveState(); renderPlan(); });
  $('#addForm').addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), title = String(data.get('title') || '').trim(), rawUrl = String(data.get('url') || '').trim(), open = String(data.get('open') || ''), close = String(data.get('close') || ''), duration = Number(data.get('duration')), id = editingId || newId(), afterId = String(data.get('afterId') || '');
    if (!title) return $('#formError').textContent = '请填写想做什么';
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) return $('#formError').textContent = '实践耗时请填 5—720 的整数分钟';
    if (rawUrl && !safeUrl(rawUrl)) return $('#formError').textContent = '请填写小红书笔记或 xhslink 分享链接';
    if (open && close && planner.minutes(open) >= planner.minutes(close)) return $('#formError').textContent = '最晚结束需要晚于最早开始';
    if (createsCycle(id, afterId)) return $('#formError').textContent = '先后顺序形成了循环，请换一个前置事项';
    const mode = String(data.get('mode') || 'home');
    const item = { id, title, category: String(data.get('category') || '其他'), duration, mode, materials: String(data.get('materials') || '').trim(), prepared: data.has('prepared'), area: mode === 'out' ? String(data.get('area') || '').trim() : '', address: mode === 'out' ? String(data.get('address') || '').trim() : '', open, close, afterId, url: safeUrl(rawUrl), sourceTitle: String(data.get('sourceTitle') || ''), author: String(data.get('author') || ''), outdoor: mode === 'out' && data.has('outdoor'), weekendsOnly: data.has('weekendsOnly'), reservation: mode === 'out' && data.has('reservation'), priority: data.has('priority') };
    const edited = Boolean(editingId);
    if (edited) state.items = state.items.map((candidate) => candidate.id === id ? item : candidate);
    else { state.items.unshift(item); chooseWithPrerequisites(id); }
    state.filter = 'all'; activeCategory='全部'; searchQuery=''; $('#searchInput').value=''; saveState(); renderAll(); closeDialog(); showToast(edited ? '已保存' : '已添加收藏');
  });
  $('#planDate').value = state.config.date; $('#startTime').value = state.config.start; $('#endTime').value = state.config.end; $('#maxTasks').value = String(state.config.maxTasks); $('#restBuffer').value = String(state.config.rest); $('#rainToggle').checked = Boolean(state.config.rain); $('#travelBuffer').value = String(state.config.travel);
  renderAll();
})();
