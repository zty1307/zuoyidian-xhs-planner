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
  function today() { const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=t=>parts.find(p=>p.type===t).value;return `${part('year')}-${part('month')}-${part('day')}`; }
  function initialState() {
    const items = (globalThis.DEMO_NOTES || []).map(({cover,avatar,video,videoSrc,images,...item}) => ({ mode: 'home', open: '', close: '', area: '', address: '', prepared: true, afterId: '', ...item }));
    return { catalogVersion:3, items, selected: items.filter(item=>!item.catalogVersion).map((item) => item.id), filter: 'all', hasPlan: true, done: {}, config: { date: today(), viewDays:3, start: '10:00', end: '13:00', maxTasks: 4, rest: 10, rain: false, travel: 25 } };
  }
  function loadState() {
    const fallback = initialState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && Array.isArray(saved.items) && Array.isArray(saved.selected)) {
        const items = saved.items.filter((item) => item && typeof item.id === 'string' && typeof item.title === 'string');
        const pilates=items.find(item=>item.id==='note-pilates'&&item.title==='学一组普拉提动作'&&item.materials==='瑜伽垫');
        if(pilates)Object.assign(pilates,{title:'看一节普拉提动作讲解',mode:'any',duration:15,materials:''});
        if ((saved.catalogVersion || 1)<3) items.unshift(...fallback.items.filter(item=>(item.catalogVersion||1)>(saved.catalogVersion||1)&&!items.some(existing=>existing.id===item.id)));
        return { ...fallback, ...saved, catalogVersion:3, items, selected: saved.selected.filter((id) => items.some((item) => item.id === id)), filter: ['all', 'selected', 'unready'].includes(saved.filter) ? saved.filter : 'all', done: saved.done && typeof saved.done === 'object' ? saved.done : {}, config: { ...fallback.config, ...saved.config } };
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
  // Seed a complete week for the presentation, retaining the previous local version.
  if(state.demoVersion!==9||state.demoWeekStart!==today()){
    try{localStorage.setItem('zuoyidian-before-demo-v9',JSON.stringify(state));}catch{}
    if(state.demoVersion!==9){
      for(const n of globalThis.DEMO_NOTES||[])if(!state.items.some(i=>i.id===n.id)){const {cover,avatar,video,videoSrc,images,...item}=n;state.items.push(item);}
      const dinner=state.items.find(n=>n.id==='note-food');if(dinner){dinner.open='19:00';dinner.close='21:00';}
    }
    const week=DemoWeek.create(today(),state.items,planner.addDays);
    state.config={...state.config,...week.config};state.selected=week.selected;
    state.agenda=planner.buildAgenda(state.items,state.selected,state.config,state.done,7);
    state.demoVersion=9;state.demoWeekStart=today();
  }
  state.config.date=today();state.config.viewDays=7;
  for(const item of state.items)if(item.categorySource!=='manual'){item.category=NoteCategories.suggest(item.sourceTitle||item.title);item.categorySource='title-rule';}
  let activeCategory = '全部', searchQuery = '', previewId=null, categoryTouched=false, browseScroll=0;
  const categoryOptions = (selected) => globalThis.NoteCategories.categories.map(category=>`<option ${category===selected?'selected':''}>${esc(category)}</option>`).join('');
  const mediaFor = (item) => (globalThis.DEMO_NOTES || []).find((note) => note.id === item.id) || {};
  const icon = (name) => { const paths = {check:'<path d="m5 12 4 4L19 6"/>',plus:'<path d="M12 5v14M5 12h14"/>',play:'<path d="m9 6 9 6-9 6Z" fill="currentColor" stroke="none"/>',edit:'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',bookmark:'<path d="M6 4h12v17l-6-4-6 4Z"/>' }; return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.bookmark}</svg>`; };
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); SharedAlbum.publish('daily',state); } catch { showToast('本机保存失败，建议导出计划'); } }
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
    document.querySelectorAll('[data-filter]').forEach((button) => button.classList.toggle('active', button.dataset.filter === state.filter));
    const categories = ['全部', ...new Set(state.items.map((item)=>item.category || '其他'))];
    if (!categories.includes(activeCategory)) activeCategory='全部';
    $('#categoryFilters').innerHTML = categories.map(category=>`<button type="button" class="category-filter ${category===activeCategory?'active':''}" data-category="${esc(category)}" aria-pressed="${category===activeCategory}">${esc(category)}</button>`).join('');
    const items = state.items.filter((item) => (state.filter === 'all' || (state.filter === 'selected' ? state.selected.includes(item.id) : readiness(item).length)) && (activeCategory==='全部'||item.category===activeCategory) && (!searchQuery||[item.title,item.sourceTitle,item.author,item.category].some(value=>String(value||'').toLowerCase().includes(searchQuery))));
    $('#collectionList').innerHTML = items.length ? items.map((item) => {
      const chosen = state.selected.includes(item.id), link = safeUrl(item.url), gaps = readiness(item);
      const media = mediaFor(item), title = item.sourceTitle || item.title;
      return `<article class="save-card ${chosen ? 'selected' : ''}" data-id="${esc(item.id)}">
        <div class="cover-wrap"><button class="cover-link" data-action="preview" type="button" aria-label="${media.video?'播放':'查看'}：${esc(title)}">${media.cover?`<img class="note-cover" src="${esc(media.cover)}" alt="${esc(title)}" loading="lazy" />`:`<div class="cover-placeholder">${icon('bookmark')}<span>${esc(item.category)}</span></div>`}</button>${media.video?`<span class="video-badge">${icon('play')}</span>`:`<span class="cover-photo-badge">图文${media.images?.length?' · '+media.images.length:''}</span>`}<button class="cover-select" data-action="choose" type="button" aria-label="${chosen?'取消选择':'选择'}${esc(item.title)}" aria-pressed="${chosen}">${icon(chosen?'check':'plus')}</button><span class="duration-badge">${esc(item.duration)} 分钟</span></div>
        <div class="card-caption"><h3><button data-action="preview" type="button">${esc(title)}</button></h3><div class="author-row"><span class="author">${media.avatar?`<img src="${esc(media.avatar)}" alt="" />`:'<span class="avatar-placeholder">我</span>'}<span>${esc(item.author || '我的收藏')}</span></span><details class="card-menu"><summary aria-label="管理${esc(item.title)}">${icon('more')}</summary><div class="menu-popover"><button data-action="edit" type="button">编辑安排</button><button data-action="priority" type="button">${item.priority?'取消优先':'优先安排'}</button><button data-action="delete" type="button">删除收藏</button></div></details></div>${gaps.length?`<button class="unready-tag" data-action="${item.prepared===false?'prepared':'edit'}" type="button">${item.prepared===false?'材料待准备 · 标为备齐':'地点待确认'}</button>`:''}</div>
      </article>`;
    }).join('') : '<div class="empty-list">没有找到收藏</div>';
  }
  function closePreview() {
    $('#notePreview video')?.pause(); $('#notePreview').replaceChildren(); $('#notePreview').hidden=true; $('#collectionBrowse').hidden=false;
    const previous=previewId; previewId=null;
    [...document.querySelectorAll('.save-card')].find(card=>card.dataset.id===previous)?.querySelector('.cover-link')?.focus({preventScroll:true});
    window.scrollTo({top:browseScroll,behavior:'instant'});
  }
  function openPreview(id) {
    const item=state.items.find(note=>note.id===id); if(!item)return;
    if(!previewId)browseScroll=window.scrollY;
    $('#notePreview video')?.pause();previewId=id;
    const media=mediaFor(item),chosen=state.selected.includes(id),link=safeUrl(item.url);
    $('#collectionBrowse').hidden=true;$('#notePreview').hidden=false;
    $('#notePreview').innerHTML=`<div class="preview-toolbar"><button data-preview-action="close" type="button">← 返回收藏</button>${link?`<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">原笔记 ↗</a>`:''}</div><div class="preview-media">${media.videoSrc?`<video controls playsinline preload="metadata" poster="${esc(media.cover||'')}" src="${esc(media.videoSrc)}" aria-label="${esc(item.sourceTitle||item.title)}"></video>`:media.cover?`<img src="${esc(media.cover)}" alt="${esc(item.sourceTitle||item.title)}"/>`:`<div class="cover-placeholder">${icon('bookmark')}</div>`}</div><p id="videoError" class="video-error" ${media.video&&!media.videoSrc?'':'hidden'}>这条笔记暂时需要到小红书播放。</p><h2>${esc(item.sourceTitle||item.title)}</h2><div class="preview-author"><span class="author">${media.avatar?`<img src="${esc(media.avatar)}" alt=""/>`:''}${esc(item.author||'我的收藏')}</span><label class="preview-category"><span>分类</span><select id="previewCategory" aria-label="笔记分类">${categoryOptions(item.category)}</select></label></div><div class="preview-action-row"><div><strong>${esc(item.title)}</strong><span>${esc(modeLabel(item))} · 预计 ${esc(item.duration)} 分钟</span></div><button class="text-button" data-preview-action="edit" type="button">编辑</button></div>${item.mode==='out'?`<p class="preview-location">${esc(item.address||'具体门店待确认')}</p>`:''}${item.materials?`<p class="preview-materials">准备：${esc(item.materials)}</p>`:''}<button class="button ${chosen?'button-quiet':'button-coral'} preview-choose" data-preview-action="choose" type="button" aria-pressed="${chosen}">${chosen?'✓ 已加入计划':'加入计划'}</button>`;
    const video=$('#notePreview video'); if(video){video.addEventListener('error',()=>{$('#videoError').hidden=false;});video.play().catch(()=>{});}
    if(!media.videoSrc && media.cover){
      const images=media.images?.length?media.images:[media.cover];let page=0;
      const frame=$('#notePreview .preview-media');
      frame.insertAdjacentHTML('beforeend',`<span class="photo-label">图文 · <span id="photoCount">1 / ${images.length}</span></span>${images.length>1?'<button class="photo-prev" aria-label="上一张图片" type="button">‹</button><button class="photo-next" aria-label="下一张图片" type="button">›</button>':''}`);
      function turn(delta){page=(page+delta+images.length)%images.length;frame.querySelector('img').src=images[page];frame.querySelector('img').alt=`${item.sourceTitle||item.title} · 第 ${page+1} 张`;$('#photoCount').textContent=`${page+1} / ${images.length}`;}
      frame.querySelector('.photo-prev')?.addEventListener('click',()=>turn(-1));frame.querySelector('.photo-next')?.addEventListener('click',()=>turn(1));
      frame.tabIndex=0;frame.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();turn(event.key==='ArrowRight'?1:-1);}});
    }
    $('#notePreview [data-preview-action="close"]').focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
  function suggestCategory() {
    if(categoryTouched)return;
    const form=$('#addForm'),text=form.elements.title.value+' '+form.elements.sourceTitle.value;
    const category=globalThis.NoteCategories.suggest(text);form.elements.category.value=category;
    const match=NoteCategories.explain(text);$('#categoryHint').textContent=match.keyword?'自动归入 '+category+' · 识别到「'+match.keyword+'」':'未识别分类，可手动选择';
  }
  function readConfig() {
    const date=$('#planDate').value;
    state.config={...state.config,date,viewDays:7};
    state.config.dailyWindows={...state.config.dailyWindows,[date]:{...state.config.dailyWindows?.[date],start:$('#startTime').value,end:$('#endTime').value}};saveState();
  }
  function syncDayTime(){const window=state.config.dailyWindows?.[state.config.date]||state.config;$('#startTime').value=window.start;$('#endTime').value=window.end;}
  function planError() {
    if (!state.config.date) return '先选一个日期';
    const window=state.config.dailyWindows?.[state.config.date]||state.config;
    if (!Number.isFinite(planner.minutes(window.start)) || !Number.isFinite(planner.minutes(window.end)) || planner.minutes(window.start) >= planner.minutes(window.end)) return '结束时间需要晚于开始时间';
    if (!state.selected.length) return '先选一件这次想做的事';
    return '';
  }
  function rebuildAgenda(startDate=state.agenda?.startDate||state.config.date){
    if(!startDate)return;
    state.agenda=planner.buildAgenda(state.items,state.selected,{...state.config,date:startDate},state.done,7);
  }
  function arrangeCurrentDay(){
    const date=state.config.date,days=state.agenda?.days||[],effective={...state.done};
    for(const day of days)if(day.date<date)for(const entry of day.entries)effective[`${date}:${entry.id}`]=true;
    const elsewhere=new Set(days.filter(day=>day.date!==date).flatMap(day=>day.entries.map(e=>e.id)));
    const selected=state.selected.filter(id=>!elsewhere.has(id));
    const plan=planner.buildPlan(state.items,selected,{...state.config,...state.config.dailyWindows?.[date]},effective);
    const otherDays=days.filter(day=>day.date!==date);
    state.agenda={startDate:state.agenda?.startDate||date,days:[...otherDays,{date,entries:plan.entries}].sort((a,b)=>a.date.localeCompare(b.date)),excluded:plan.excluded.map(({item,reason})=>({id:item.id,reason}))};
  }
  const visibleDays=()=>Array.from({length:7},(_,offset)=>{const date=planner.addDays(state.config.date,offset);return state.agenda?.days?.find(day=>day.date===date)||{date,entries:[]};});
  function dateLabel(text) { const date = new Date(`${text}T12:00:00`); return Number.isNaN(date.getTime()) ? text : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(date); }
  function renderPlan() {
    const resultEl=$('#planResult'),notesEl=$('#planNotes');
    const error=planError();if(error){resultEl.innerHTML=`<div class="plan-empty"><strong>${esc(error)}</strong></div>`;notesEl.innerHTML='';return;}
    const days=visibleDays(),total=days.reduce((n,d)=>n+d.entries.length,0);
    resultEl.innerHTML=days.map((day,index)=>{
      const complete=day.entries.filter(e=>state.done[day.date+':'+e.id]).length;
      const d=new Date(day.date+'T12:00:00'),label=new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',weekday:'short'}).format(d);
      return `<section class="agenda-day" data-date="${day.date}"><header><div><h3>${label}</h3></div><small>${day.entries.length?complete+' / '+day.entries.length+' 完成':'暂无安排'}</small></header>${day.entries.length?'<div class="timeline">'+day.entries.map(entry=>{
        const item=state.items.find(n=>n.id===entry.id);if(!item)return '';
        const done=Boolean(state.done[day.date+':'+item.id]);
        return `<div class="timeline-item"><div class="timeline-time">${clock(entry.start)}<span>${clock(entry.end)}</span></div><div class="timeline-body ${done?'done':''}"><div class="task-title"><h3><button class="plan-note-link" data-preview-id="${esc(item.id)}">${esc(item.title)}</button></h3><button class="done-btn ${done?'checked':''}" data-done="${esc(item.id)}" data-date="${day.date}" aria-label="${done?'取消完成':'完成'}${esc(item.title)}（${day.date}）" aria-pressed="${done}">${done?icon('check'):''}</button></div><p>${esc(modeLabel(item))} · ${item.duration} 分钟${entry.transfer?' · 通勤预留 '+entry.transfer+' 分钟':''}</p>${item.materials?`<details class="task-prep"><summary>准备</summary><p>${esc(item.materials)}</p></details>`:''}</div></div>`;
      }).join('')+'</div>':''}</section>`;
    }).join('');
    const excluded=(state.agenda?.excluded||[]).map(e=>({item:state.items.find(n=>n.id===e.id),reason:e.reason})).filter(e=>e.item);
    const notes=excluded.map(e=>e.item.title+'：'+e.reason);
    notesEl.innerHTML=notes.length?`<details><summary>${excluded.length} 件未安排</summary>${[...new Set(notes)].map(note=>`<p class="note-line">${esc(note)}</p>`).join('')}</details>`:'';
  }
  function renderAll(replan=true) {renderCollection();if(replan||!state.agenda)rebuildAgenda();renderPlan();saveState();}
  function syncMode() { $('#locationFields').hidden = $('#activityMode').value !== 'out'; }
  function openDialog(id = null) {
    const form = $('#addForm'); form.reset(); $('#shareText').value = ''; $('#formError').textContent = ''; $('#advancedFields').open = false;
    form.elements.category.innerHTML=categoryOptions('其他');categoryTouched=false;$('#categoryHint').textContent='根据标题建议，可修改';
    editingId = typeof id === 'string' ? id : null;
    const item = state.items.find((candidate) => candidate.id === editingId);
    form.elements.afterId.innerHTML = '<option value="">没有先后要求</option>' + state.items.filter((candidate) => candidate.id !== editingId).map((candidate) => `<option value="${esc(candidate.id)}">${esc(candidate.title)}</option>`).join('');
    $('#dialogTitle').textContent = item ? '编辑安排' : '添加收藏';
    $('#dialogSubmitBtn').textContent = item ? '保存' : '添加';
    if (item) {
      categoryTouched=true;$('#categoryHint').textContent='可手动修改';
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
    if (title) { $('#addForm').elements.sourceTitle.value = title.slice(0, 120); if (!$('#addForm').elements.title.value.trim()) $('#addForm').elements.title.value = title.slice(0, 60); suggestCategory(); }
    showToast(link ? title ? '已识别标题和链接，补个实践耗时就好' : '已识别链接，请填写想做什么' : title ? '已识别标题，请补充笔记链接' : '未识别出标题或链接，请手动填写');
  }
  function dailyOutput(){
    const days=visibleDays().map(day=>({date:day.date,label:dateLabel(day.date),items:day.entries.map(e=>{const n=state.items.find(n=>n.id===e.id);return n?{slot:clock(e.start)+'—'+clock(e.end),title:n.title,area:modeLabel(n),detail:[modeLabel(n),n.address,n.materials].filter(Boolean).join(' · '),sources:n.url?[{title:n.sourceTitle||n.title,url:n.url,author:n.author}]:[]}:null;}).filter(Boolean)}));
    return {title:'做一点 · 日常计划',days,sources:state.items.filter(n=>days.some(d=>d.items.some(i=>i.sources.some(s=>s.url===n.url)))).map(n=>({title:n.sourceTitle||n.title,url:n.url,author:n.author,kind:n.category}))};
  }
  function exportPlan(){if(planError())return showToast('先生成一份计划');PlanOutput.exportExcel(dailyOutput());}
  $('#shareDaily').onclick=()=>SharedAlbum.open('daily');
  $('#classifyDaily').onclick=()=>NoteCategories.review(state.items.map(n=>({id:n.id,title:n.sourceTitle||n.title,category:n.category,manual:n.categorySource==='manual'})),{onChange:n=>{const item=state.items.find(i=>i.id===n.id);item.category=n.category;item.categorySource=n.manual?'manual':'title-rule';saveState();renderCollection();}});
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
  $('#addForm').elements.title.addEventListener('input',suggestCategory);
  $('#addForm').elements.category.addEventListener('change',()=>{categoryTouched=true;$('#categoryHint').textContent='已手动选择';});
  $('#notePreview').addEventListener('click',event=>{
    const action=event.target.closest('[data-preview-action]')?.dataset.previewAction;if(!action)return;
    if(action==='close')return closePreview();
    if(action==='edit')return openDialog(previewId);
    if(action==='choose'){
      if(state.selected.includes(previewId))state.selected=state.selected.filter(id=>id!==previewId);else chooseWithPrerequisites(previewId);
      saveState();renderAll();const chosen=state.selected.includes(previewId),button=$('#notePreview .preview-choose');button.textContent=chosen?'✓ 已加入计划':'加入计划';button.setAttribute('aria-pressed',String(chosen));button.classList.toggle('button-quiet',chosen);button.classList.toggle('button-coral',!chosen);
    }
  });
  $('#notePreview').addEventListener('change',event=>{if(event.target.id==='previewCategory'){const item=state.items.find(item=>item.id===previewId);item.category=event.target.value;item.categorySource='manual';saveState();renderCollection();}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&previewId&&!$('#addDialog').open)closePreview();});
  $('#searchInput').addEventListener('input', event => { searchQuery=event.target.value.trim().toLowerCase(); renderCollection(); });
  $('#categoryFilters').addEventListener('click', event=>{const button=event.target.closest('[data-category]');if(button){activeCategory=button.dataset.category;renderCollection();}});
  $('#activityMode').addEventListener('change', syncMode);
  $('#closeDialogBtn').addEventListener('click', closeDialog);
  $('#cancelDialogBtn').addEventListener('click', closeDialog);
  $('#addDialog').addEventListener('click', (event) => { if (event.target === $('#addDialog')) closeDialog(); });
  $('#parseShareBtn').addEventListener('click', extractShare);
  $('#exportBtn').addEventListener('click', exportPlan);
  $('#planBtn').addEventListener('click', () => { readConfig(); const error = planError(); if (error) return showToast(error); state.hasPlan = true; arrangeCurrentDay();saveState(); renderPlan(); });
  ['startTime','endTime'].forEach(id=>$('#'+id).addEventListener('change',()=>{readConfig();if(!planError())arrangeCurrentDay();saveState();renderPlan();}));
  function viewDate(date){state.config.date=date;$('#planDate').value=date;syncDayTime();saveState();renderPlan();}
  $('#planDate').addEventListener('change',()=>viewDate($('#planDate').value));
  $('#prevDate').onclick=()=>viewDate(planner.addDays(state.config.date||today(),-1));
  $('#nextDate').onclick=()=>viewDate(planner.addDays(state.config.date||today(),1));

  document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => { state.filter = button.dataset.filter; saveState(); renderCollection(); }));
  $('#collectionList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const id = button.closest('[data-id]')?.dataset.id, item = state.items.find((candidate) => candidate.id === id); if (!item) return;
    const action = button.dataset.action;
    if (action === 'preview') return openPreview(id);
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
  $('#planResult').addEventListener('click', (event) => { const preview=event.target.closest('[data-preview-id]');if(preview)return openPreview(preview.dataset.previewId);const button = event.target.closest('[data-done]'); if (!button) return; const key = `${button.dataset.date}:${button.dataset.done}`; state.done[key] = !state.done[key]; saveState(); renderPlan(); });
  $('#addForm').addEventListener('submit', (event) => {
    event.preventDefault(); const data = new FormData(event.currentTarget), title = String(data.get('title') || '').trim(), rawUrl = String(data.get('url') || '').trim(), open = String(data.get('open') || ''), close = String(data.get('close') || ''), duration = Number(data.get('duration')), id = editingId || newId(), afterId = String(data.get('afterId') || '');
    if (!title) return $('#formError').textContent = '请填写想做什么';
    if (!Number.isInteger(duration) || duration < 5 || duration > 720) return $('#formError').textContent = '实践耗时请填 5—720 的整数分钟';
    if (rawUrl && !safeUrl(rawUrl)) return $('#formError').textContent = '请填写小红书笔记或 xhslink 分享链接';
    if (open && close && planner.minutes(open) >= planner.minutes(close)) return $('#formError').textContent = '最晚结束需要晚于最早开始';
    if (createsCycle(id, afterId)) return $('#formError').textContent = '先后顺序形成了循环，请换一个前置事项';
    const mode = String(data.get('mode') || 'home');
    const item = { id, title, category: String(data.get('category') || '其他'), duration, mode, materials: String(data.get('materials') || '').trim(), prepared: data.has('prepared'), area: mode === 'out' ? String(data.get('area') || '').trim() : '', address: mode === 'out' ? String(data.get('address') || '').trim() : '', open, close, afterId, url: safeUrl(rawUrl), sourceTitle: String(data.get('sourceTitle') || ''), author: String(data.get('author') || ''), outdoor: mode === 'out' && data.has('outdoor'), weekendsOnly: data.has('weekendsOnly'), reservation: mode === 'out' && data.has('reservation'), priority: data.has('priority') };
    item.categorySource=categoryTouched?'manual':'title-rule';
    const edited = Boolean(editingId);
    if (edited) state.items = state.items.map((candidate) => candidate.id === id ? item : candidate);
    else { state.items.unshift(item); chooseWithPrerequisites(id); }
    state.filter = 'all'; activeCategory='全部'; searchQuery=''; $('#searchInput').value=''; saveState(); renderAll(); closeDialog(); if(previewId===item.id)openPreview(item.id);showToast(edited ? '已保存' : '已添加收藏');
  });
  for(const id of ['startTime','endTime']){const values=Array.from({length:96},(_,i)=>clock(i*15));values.push('23:59');if(state.config[id==='startTime'?'start':'end']&&!values.includes(state.config[id==='startTime'?'start':'end']))values.push(state.config[id==='startTime'?'start':'end']);$('#'+id).innerHTML=values.sort().map(value=>'<option value="'+value+'">'+value+'</option>').join('');}

  $('#planDate').value = state.config.date; $('#startTime').value = state.config.start; $('#endTime').value = state.config.end;
  syncDayTime();renderAll(false);saveState();
  SharedAlbum.register('daily',{anchor:'#dailyWorkspace .plan-heading',snapshot:()=>state,receive:next=>{if(!Array.isArray(next.items)||!next.config||!next.agenda)return;state=next;$('#planDate').value=state.config.date;syncDayTime();renderAll(false);}});
})();
