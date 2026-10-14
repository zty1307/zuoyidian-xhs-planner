(() => {
  'use strict';
  const $=s=>document.querySelector(s),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='zuoyidian-travel-v1',seed=globalThis.TRAVEL_ALBUM;
  const cleanUrl=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&(/(^|\.)xiaohongshu\.com$/.test(u.hostname)||/^(www\.)xhslink\.(com|cn)$/.test(u.hostname))?u.href:'';}catch{return '';}};
  let saved;try{saved=JSON.parse(localStorage.getItem(key));}catch{}
  let state={version:seed.version,notes:seed.notes.map(({cover,images,avatar,...n})=>n),selected:[],days:[],dayCount:seed.defaultDays||7,start:'',mealChoices:{},dayMeta:[],...saved};
  const seedEmpty=!saved||(!saved.notes?.length&&!saved.days?.length);
  if(state.version<seed.version){for(const n of seed.notes)if(!state.notes.some(x=>x.id===n.id)){const {cover,images,avatar,...data}=n;state.notes.push(data);}state.version=seed.version;}
  for(const note of state.notes)for(const meal of note.meals||[])if(meal.name==='The Yemenian Restaurant'&&meal.dish==='也门菜、肉类拼餐')meal.dish='也门菜';
  if(state.demoVersion!==6){
    if(!state.start){const current=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());state.start=ActivityPlanner.addDays(current,(6-new Date(current+'T12:00:00').getDay()+7)%7);}
    state.demoVersion=6;
  }
  if(seedEmpty&&seed.notes.length){state.dayCount=seed.defaultDays||7;const all=TravelPlanner.collect(state.notes);state.selected=all.map(p=>p.id);state.days=TravelPlanner.arrange(all,state.selected,state.dayCount).days;}

  if(state.engineVersion!==7){
    try{localStorage.setItem('zuoyidian-travel-before-v7',JSON.stringify(state));}catch{}
    for(const note of state.notes){const original=seed.notes.find(n=>n.id===note.id);if(!original)continue;
      for(const p of note.places||[]){const match=original.places?.find(x=>x.city===p.city&&x.name===p.name);if(match)for(const field of ['region','duration','early'])if(match[field]!==undefined)p[field]=match[field];}
      if(original.meals){note.meals=note.meals||[];for(const m of original.meals){const found=note.meals.find(x=>x.city===m.city&&x.name===m.name);if(found)Object.assign(found,m);else note.meals.push({...m});}}
    }
    if(state.dayCount===10)state.dayCount=12;
    const plan=TravelPlanner.arrange(TravelPlanner.collect(state.notes),state.selected,state.dayCount);state.days=plan.days;state.dayMeta=plan.meta;state.mealChoices={};state.engineVersion=7;
  }
  let view='notes',query='',editing=null,mode='daily',activeCity='all',kindTouched=false;
  const media=id=>seed.notes.find(n=>n.id===id)||{};
  const places=()=>TravelPlanner.collect(state.notes);
  const meals=()=>TravelPlanner.collectMeals(state.notes);
  for(const note of state.notes)if(note.categorySource!=='manual'){note.kind=NoteCategories.explain(note.title,true).category;note.categorySource='title-rule';}
  const category=n=>['景点','路线'].includes(n.kind)?'routes':n.kind==='美食'?'food':n.kind==='交通'?'transport':n.kind==='住宿'?'stay':'references';
  const dayMeals=()=>TravelPlanner.matchDayMeals(state.days,places(),meals(),state.mealChoices);
  const save=()=>{try{localStorage.setItem(key,JSON.stringify(state));SharedAlbum.publish('travel',state);}catch{$('#tripStatus').textContent='本机保存失败，请导出备份';}};
  const assigned=()=>state.days.flat();
  function switchMode(next){mode=next;history.replaceState(null,'',next==='travel'?'#travel':'#daily');$('#dailyWorkspace').hidden=next!=='daily';$('#travelWorkspace').hidden=next!=='travel';document.querySelectorAll('[data-workspace]').forEach(b=>{b.classList.toggle('active',b.dataset.workspace===next);b.setAttribute('aria-pressed',b.dataset.workspace===next);});$('#addBtn').hidden=next==='travel';$('#searchInput').placeholder=next==='travel'?'搜索旅行收藏与地点':'搜索收藏';if(next==='travel'){document.querySelector('#notePreview video')?.pause();render();}}
  function render(){
    const ps=places();state.selected=ps.map(p=>p.id);
    $('#albumName').textContent=seed.name;$('#albumMeta').textContent=`${state.notes.length} 篇收藏`;;
    $('#tripDayCount').value=state.dayCount;$('#tripStart').value=state.start;
    $('#tripViews').innerHTML=[['notes','全部'],['routes','景点路线'],['food','美食'],['transport','交通'],['stay','住宿'],['references','行前准备']].map(([id,name])=>[id,name,id==='notes'?state.notes.length:state.notes.filter(n=>category(n)===id).length]).filter(([id,,count])=>id!=='stay'||count).map(([id,name,count])=>`<button data-trip-view="${id}" class="category-filter ${view===id?'active':''}">${name} <span>${count}篇</span></button>`).join('');
    const notes=state.notes.filter(n=>(view==='notes'||category(n)===view)&&(!query||[n.title,n.author,...(n.places||[]).map(p=>p.city+p.name)].join(' ').toLowerCase().includes(query)));
    if(view==='notes')notes.sort((a,b)=>(a.id==='egypt-1'?0:a.meals?.length?1:2)-(b.id==='egypt-1'?0:b.meals?.length?1:2));
    $('#tripLibrary').className='collection-list';
    $('#tripLibrary').innerHTML=notes.map(n=>`<article class="save-card"><div class="cover-wrap"><button class="cover-link" data-trip-preview="${esc(n.id)}" aria-label="查看${esc(n.title)}">${media(n.id).cover?`<img class="note-cover" src="${esc(media(n.id).cover)}" alt="${esc(n.title)}" loading="lazy"/>`:`<div class="cover-placeholder"><span>${esc(n.kind)}</span></div>`}</button><span class="duration-badge">${esc(n.kind)}</span></div><div class="card-caption"><h3><button data-trip-preview="${esc(n.id)}">${esc(n.title)}</button></h3><div class="author-row"><span class="author">${media(n.id).avatar?`<img src="${esc(media(n.id).avatar)}" alt=""/>`:''}${esc(n.author||'我的收藏')}</span><button class="text-button" data-trip-edit="${esc(n.id)}">整理</button></div></div></article>`).join('');
    if(!$('#tripLibrary').innerHTML)$('#tripLibrary').innerHTML=`<div class="trip-empty"><span class="empty-bookmark">▱</span><h3>${state.notes.length?'没有匹配的内容':'把这个专辑变成一次旅行'}</h3><p>${state.notes.length?'换个关键词试试。':'添加攻略，标出想去的地方。整理好的地点会出现在这里。'}</p>${!state.notes.length?'<button class="button button-quiet" data-trip-add>添加攻略</button><small>专辑尚未导入，等待小红书重新登录</small>':''}</div>`;
    $('#tripSelection').textContent='';
    renderDays();
  }
  function renderDays(){
    const ps=places(),food=meals(),matched=dayMeals(),scheduled=assigned(),pending=ps.filter(p=>state.selected.includes(p.id)&&!scheduled.includes(p.id));
    const cityOf=(ids,index)=>ids.map(id=>ps.find(p=>p.id===id)?.city).find(Boolean)||state.dayMeta[index]?.city||'机动';
    const route=[...new Set(state.days.map(cityOf))];if(activeCity!=='all'&&!route.includes(activeCity))activeCity='all';
    const usedSources=new Set(ps.filter(p=>scheduled.includes(p.id)).flatMap(p=>p.sources));
    for(const day of matched)for(const m of Object.values(day))if(m)m.sources.forEach(id=>usedSources.add(id));
    const mentions=state.notes.reduce((n,note)=>n+(note.places||[]).filter(p=>ps.some(x=>scheduled.includes(x.id)&&x.name===p.name&&x.city===p.city)).length,0);
    $('#tripSynthesis').innerHTML='<details class="synthesis"><summary>综合 '+usedSources.size+' 篇笔记安排 <span>查看依据 ⌄</span></summary><p>'+mentions+' 次地点提及，合并为 '+new Set(scheduled).size+' 处；同区域集中，整天项目单列，跨城单留交通日。</p><p>游览时长与区内交通为人工估算；班次和营业时间未实时核验。</p></details>';
    $('#tripRoute').innerHTML=[...['all'],...route].map(city=>'<button data-trip-city="'+esc(city)+'" class="'+(city===activeCity?'active':'')+'" aria-pressed="'+(city===activeCity)+'">'+(city==='all'?'全部 '+state.days.length+' 天':esc(city))+'</button>').join('');
    $('#tripItinerary').innerHTML=state.days.map((ids,index)=>{
      if(activeCity!=='all'&&cityOf(ids,index)!==activeCity)return '';
      const entries=ids.map(id=>ps.find(p=>p.id===id)).filter(Boolean),cities=[...new Set(entries.map(p=>p.city))],meta=state.dayMeta[index]||{},dailyMeals=matched[index]||{};
      let date='';if(state.start){const d=new Date(state.start+'T12:00:00');d.setDate(d.getDate()+index);date=(d.getMonth()+1)+'月'+d.getDate()+'日';}
      const mealSources=Object.values(dailyMeals).filter(Boolean).flatMap(m=>m.sources),sourceIds=[...new Set([...entries.flatMap(p=>p.sources),...mealSources])];
      const alerts=[];if(cities.length>1)alerts.push('当天跨城，需确认交通');if(entries.length>1&&entries.some(p=>p.fullDay))alerts.push('整天游览与其他地点重叠');
      const plannedMinutes=entries.reduce((n,p)=>n+(p.fullDay?420:p.duration||120),0)+Math.max(0,entries.length-1)*30;
      if(plannedMinutes>420)alerts.push('预计游览与区内交通超过 7 小时');
      const regions=[...new Set(entries.map(p=>p.region).filter(Boolean))];if(regions.length>1)alerts.push('当天跨区域，需再确认交通');
      const visits=entries.map((p,i)=>{const evidence=TravelPlanner.evidence(p,state.notes);return '<div class="journey-row"><span class="journey-label">'+(p.early?'清晨':i===0?'游览':'')+'</span><div><button class="journey-name" data-trip-preview="'+esc(p.sources[0])+'">'+esc(p.name)+'</button>'+(p.fullDay?'<small class="journey-full-day">整天</small>':'')+'<button class="evidence-link" data-evidence="'+esc(p.id)+'">'+evidence.count+' 篇提及</button></div></div>';}).join('');
      const mealRow=entries.length?['午餐','晚餐'].map(slot=>{const meal=dailyMeals[slot];if(!meal)return '';return '<div class="journey-row meal-row"><span class="journey-label">'+slot+'</span><div>'+(meal?'<button class="journey-name" data-trip-preview="'+esc(meal.sources[0])+'">'+esc(meal.name)+'</button><small class="journey-description">'+esc([meal.dish,meal.area].filter(Boolean).join(' · '))+'</small>':'')+'</div></div>';}).join(''):'';
      const controls=entries.map((p,i)=>'<label class="journey-edit-row"><span>'+esc(p.name)+'</span><select data-move="'+esc(p.id)+'" aria-label="将'+esc(p.name)+'移到">'+state.days.map((_,d)=>'<option value="'+d+'" '+(d===index?'selected':'')+'>第 '+(d+1)+' 天</option>').join('')+'<option value="-1">暂不安排</option></select><button data-up="'+esc(p.id)+'" aria-label="上移'+esc(p.name)+'" '+(i===0?'disabled':'')+'>↑</button></label>').join('');
      const mealControl=entries.length?['午餐','晚餐'].map(slot=>{const choices=food.filter(m=>cities.includes(m.city)&&(m.slots||[m.slot||'晚餐']).includes(slot));return choices.length?'<label class="journey-edit-meal"><span>'+slot+'</span><select data-meal-day="'+index+':'+slot+'" aria-label="第'+(index+1)+'天'+slot+'餐厅"><option value="">暂不安排</option>'+choices.map(m=>'<option value="'+esc(m.id)+'" '+(dailyMeals[slot]?.id===m.id?'selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select></label>':'';}).join(''):'';
      const body=meta.kind==='transfer'&&!entries.length?'<div class="transfer-day"><strong>'+esc(meta.from)+' → '+esc(meta.city)+'</strong><span>交通日 · 车次或航班待确认</span></div>':visits+mealRow+(!entries.length?'<p class="free-day">自由安排</p>':'');
      const rationale=entries.length?regions.join(' / ')+' · 预计游览与区内交通 '+(plannedMinutes/60).toFixed(1).replace('.0','')+' 小时；另留午餐时间。':'';
      return '<section class="journey-day"><header><strong>第 '+(index+1)+' 天</strong><time>'+date+' · '+esc(cityOf(ids,index))+'</time></header>'+alerts.map(a=>'<p class="journey-alert">'+esc(a)+'</p>').join('')+'<div class="journey-body">'+body+'</div>'+(sourceIds.length?'<footer><details class="journey-sources"><summary>编排依据 · '+sourceIds.length+' 篇</summary><p class="day-rationale">'+esc(rationale)+'</p>'+sourceIds.map(id=>{const n=state.notes.find(n=>n.id===id);return '<button data-trip-preview="'+esc(id)+'">'+esc(n.title)+'</button>';}).join('')+'</details><details class="journey-adjust"><summary>调整</summary>'+controls+mealControl+'</details></footer>':'')+'</section>';
    }).join('');
    if(!state.days.length)$('#tripItinerary').innerHTML='<p class="trip-plan-empty">添加攻略后，安排一下。</p>';
    $('#tripPending').innerHTML=pending.length?'<details open><summary>'+pending.length+' 处超出当前天数</summary><div class="pending-resolution"><span>保留全部地点，预计需要 '+requiredDays()+' 天</span><button class="text-button" data-fit-trip>调整为 '+requiredDays()+' 天</button></div>'+pending.map(p=>'<div class="pending-place"><span>'+esc(p.name)+'</span><select data-move="'+esc(p.id)+'" aria-label="安排'+esc(p.name)+'"><option value="-1">选择日期</option>'+state.days.map((_,d)=>'<option value="'+d+'">第 '+(d+1)+' 天</option>').join('')+'</select></div>').join('')+'</details>':'';
    $('#tripAddDay').hidden=!state.days.length;$('#tripExport').disabled=!scheduled.length;
  }
  function openEvidence(id){
    const p=places().find(p=>p.id===id);if(!p)return;const e=TravelPlanner.evidence(p,state.notes);
    $('#tripNoteBody').innerHTML='<div class="evidence-panel"><p class="trip-note-kind">收藏中的依据</p><h2>'+esc(p.name)+'</h2><div class="evidence-rate"><strong>'+e.percent+'%</strong><span>同城攻略提及率<br/>'+e.count+' / '+e.total+' 篇</span></div><p class="trip-note-summary">统计范围：已整理、包含'+esc(p.city)+'地点的笔记。提及不等于推荐或好评。</p>'+e.sources.map(id=>{const n=state.notes.find(n=>n.id===id);return '<button class="evidence-source" data-trip-preview="'+esc(id)+'"><strong>'+esc(n.title)+'</strong><span>'+esc(n.author)+' ↗</span></button>';}).join('')+'</div>';
    $('#tripNotePanel').hidden=false;$('#tripLibrary').hidden=true;$('.trip-library-toolbar').hidden=true;
  }
  function openNote(id){
    const n=state.notes.find(n=>n.id===id);if(!n)return;const m=media(id),url=cleanUrl(n.url);
    $('#tripNoteBody').innerHTML=`${m.cover?`<img src="${esc(m.cover)}" alt="${esc(n.title)}"/>`:''}<div><p class="trip-note-kind">${esc(n.kind)}</p><h2>${esc(n.title)}</h2><p class="trip-note-author">${esc(n.author||'我的收藏')}</p>${n.summary?`<p class="trip-note-summary">${esc(n.summary)}</p>`:''}${n.meals?.length?'<h3>想吃</h3>'+n.meals.map(m=>'<p class="note-place">'+esc(m.city)+' <strong>'+esc(m.name)+'</strong><br/>'+esc(m.dish)+'</p>').join(''):'<h3>想去</h3>'}${(n.places||[]).map(p=>`<p class="note-place">${esc(p.city)} <strong>${esc(p.name)}</strong></p>`).join('')||(n.meals?.length?'':'<p class="free-day">行前参考</p>')}<button class="button button-quiet" data-trip-edit="${esc(id)}">编辑整理</button>${url?`<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">小红书原帖 ↗</a>`:''}</div>`;
    $('#tripNotePanel').hidden=false;$('#tripLibrary').hidden=true;$('.trip-library-toolbar').hidden=true;$('#tripNotePanel').scrollIntoView({block:'start',behavior:'smooth'});
  }
  function editNote(id){
    $('#tripNotePanel').hidden=true;$('#tripLibrary').hidden=false;$('.trip-library-toolbar').hidden=false;editing=id||null;const n=state.notes.find(n=>n.id===id),f=$('#tripNoteForm');f.reset();$('#tripFormError').textContent='';$('#tripEditTitle').textContent=n?'整理攻略':'添加攻略';
    for(const k of ['title','url','author','kind','summary'])if(n)f.elements[k].value=n[k]||'';
    kindTouched=n?.categorySource==='manual';suggestTripKind();if(kindTouched)$('#tripCategoryHint').textContent='已手动选择';
    f.elements.places.value=(n?.places||[]).map(p=>`${p.city} / ${p.name}${p.fullDay?' / 整天':''}`).join('\n');$('#tripEditDialog').showModal();f.elements.title.focus();
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.workspace)return switchMode(b.dataset.workspace);
    if(b.hasAttribute('data-trip-add'))return editNote();
    if(b.dataset.tripEdit)return editNote(b.dataset.tripEdit);
    if(b.dataset.tripPreview)return openNote(b.dataset.tripPreview);
    if(b.dataset.evidence)return openEvidence(b.dataset.evidence);
    if(b.dataset.tripView){view=b.dataset.tripView;render();}
    if(b.hasAttribute('data-fit-trip')){$('#tripDayCount').value=requiredDays();return arrangeTrip();}
    if(b.dataset.tripCity){activeCity=b.dataset.tripCity;renderDays();}
    if(b.dataset.up){const day=state.days.find(d=>d.includes(b.dataset.up)),i=day.indexOf(b.dataset.up);if(i>0)[day[i-1],day[i]]=[day[i],day[i-1]];save();renderDays();}
  });
  $('#travelWorkspace').addEventListener('change',e=>{if(e.target.hasAttribute('data-meal-day')){state.mealChoices[e.target.dataset.mealDay]=e.target.value;save();renderDays();return;}if(e.target.dataset.move){const id=e.target.dataset.move,d=Number(e.target.value);state.days=state.days.map(day=>day.filter(x=>x!==id));if(d>=0&&state.days[d]){state.days[d].push(id);if(state.dayMeta[d]?.kind==='transfer')state.dayMeta[d]={kind:'visit',city:places().find(p=>p.id===id)?.city};}save();render();}});
  function arrangeTrip(){
    if(!state.selected.length){$('#tripStatus').textContent='先添加一篇景点或路线攻略';return;}
    state.dayCount=Math.max(1,Math.min(30,Math.floor(Number($('#tripDayCount').value)||7)));state.start=$('#tripStart').value;
    const before=JSON.stringify({days:state.days,mealChoices:state.mealChoices,dayMeta:state.dayMeta});state.mealChoices={};const plan=TravelPlanner.arrange(places(),state.selected,state.dayCount);state.days=plan.days;state.dayMeta=plan.meta;save();render();$('#tripStatus').innerHTML='已更新 <button id="tripUndo">撤销</button>';$('#tripUndo').onclick=()=>{Object.assign(state,JSON.parse(before));save();render();$('#tripDayCount').value=state.days.length;state.dayCount=state.days.length;save();$('#tripStatus').textContent='已撤销重新安排';};
  }
  $('#tripArrange').addEventListener('click',arrangeTrip);
  function requiredDays(){const plan=TravelPlanner.arrange(places(),state.selected,30);return plan.meta.reduce((last,m,i)=>m.kind!=='free'?i+1:last,1);}
  for(const id of ['tripStart','tripDayCount'])$('#'+id).addEventListener('change',()=>{state.start=$('#tripStart').value;state.dayCount=Math.max(1,Math.min(30,Math.floor(Number($('#tripDayCount').value)||7)));save();renderDays();if(id==='tripDayCount')arrangeTrip();});
  const tripToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function shiftStart(amount){state.start=ActivityPlanner.addDays(state.start||tripToday(),amount);$('#tripStart').value=state.start;save();renderDays();}
  $('#tripPrevDate').onclick=()=>shiftStart(-1);$('#tripNextDate').onclick=()=>shiftStart(1);
  $('#tripAddDay').addEventListener('click',()=>{if(state.days.length>=30)return;state.days.push([]);state.dayMeta.push({kind:'free'});state.dayCount=state.days.length;save();render();});
  $('#tripNoteForm').addEventListener('submit',e=>{
    e.preventDefault();const f=e.currentTarget,raw=f.elements.url.value.trim(),url=cleanUrl(raw),title=f.elements.title.value.trim();
    if(!title||raw&&!url){$('#tripFormError').textContent=!title?'请填写笔记标题':'请输入小红书笔记或分享链接';return;}
    const lines=f.elements.places.value.split('\n').filter(x=>x.trim()),ps=[];
    for(const line of lines){const parts=line.split('/').map(p=>p.trim()),[city,name,span]=parts;if(!city||!name||parts.length>3||(span&&span!=='整天')){$('#tripFormError').textContent='每行填写“城市 / 地点”，需独占一天可再加“ / 整天”';return;}const prior=state.notes.find(n=>n.id===editing)?.places?.find(p=>p.city===city&&p.name===name);ps.push({...prior,city,name,fullDay:span==='整天'});}
    const note={meals:state.notes.find(n=>n.id===editing)?.meals||[],id:editing||'trip-'+crypto.randomUUID(),title,url,author:f.elements.author.value.trim(),kind:f.elements.kind.value,categorySource:kindTouched?'manual':'title-rule',summary:f.elements.summary.value.trim(),places:ps};
    const index=state.notes.findIndex(n=>n.id===editing);if(index>=0)state.notes[index]=note;else state.notes.push(note);
    const valid=new Set(places().map(p=>p.id));state.days=state.days.map(d=>d.filter(id=>valid.has(id)));save();$('#tripEditDialog').close();render();
  });
  function travelOutput(){
    const ps=places(),matched=dayMeals(),sourcesFor=ids=>ids.map(id=>state.notes.find(n=>n.id===id)).filter(Boolean).map(n=>({title:n.title,url:n.url,author:n.author,kind:n.kind}));
    return {title:seed.name+' · 旅行计划',sources:sourcesFor(state.notes.map(n=>n.id)),days:state.days.map((ids,i)=>{const meta=state.dayMeta[i]||{},entries=ids.map(id=>ps.find(p=>p.id===id)).filter(Boolean),items=entries.map(p=>({slot:p.early?'清晨':'游览',title:p.name,detail:p.fullDay?'整天':'',sources:sourcesFor(p.sources)}));for(const [slot,m] of Object.entries(matched[i]||{}))if(m)items.push({slot,title:m.name,detail:[m.dish,m.area].filter(Boolean).join(' · '),sources:sourcesFor(m.sources)});if(meta.kind==='transfer'&&!entries.length)items.push({slot:'交通',title:meta.from+' → '+meta.city,detail:'车次或航班待确认',sources:[]});return {label:'第 '+(i+1)+' 天',date:state.start?ActivityPlanner.addDays(state.start,i):'',city:entries[0]?.city||meta.city||'',items};})};
  }
  $('#tripExport').onclick=()=>PlanOutput.exportExcel(travelOutput());
  $('#shareTrip').onclick=()=>SharedAlbum.open('travel');
  $('#classifyTrip').onclick=()=>NoteCategories.review(state.notes.map(n=>({id:n.id,title:n.title,category:n.kind,manual:n.categorySource==='manual'})),{travel:true,onChange:n=>{const note=state.notes.find(x=>x.id===n.id);note.kind=n.category;note.categorySource=n.manual?'manual':'title-rule';save();render();}});
  function suggestTripKind(){if(kindTouched)return;const f=$('#tripNoteForm'),result=NoteCategories.explain(f.elements.title.value,true);f.elements.kind.value=result.category;$('#tripCategoryHint').textContent=result.keyword?'自动归入 '+result.category+' · 识别到「'+result.keyword+'」':'按标题自动分类';}
  $('#tripNoteForm').elements.title.addEventListener('input',suggestTripKind);
  $('#tripNoteForm').elements.kind.addEventListener('change',()=>{kindTouched=true;$('#tripCategoryHint').textContent='已手动选择';});
  $('#searchInput').addEventListener('input',e=>{query=e.target.value.trim().toLowerCase();if(mode==='travel')render();});
  document.querySelectorAll('[data-trip-close]').forEach(b=>b.onclick=()=>{if(b.closest('dialog'))b.closest('dialog').close();else{$('#tripNotePanel').hidden=true;$('#tripLibrary').hidden=false;$('.trip-library-toolbar').hidden=false;}});
  render();save();switchMode('daily');
  SharedAlbum.register('travel',{anchor:'#travelWorkspace .plan-heading',snapshot:()=>state,receive:next=>{if(!Array.isArray(next.notes)||!Array.isArray(next.days))return;state=next;render();save();}});
})();
