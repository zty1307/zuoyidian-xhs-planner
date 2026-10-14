(function (root) {
  'use strict';
  const minutes = (text) => { const match = /^(\d{2}):(\d{2})$/.exec(String(text || '')); if (!match) return NaN; const hour = Number(match[1]), minute = Number(match[2]); return hour <= 23 && minute <= 59 ? hour * 60 + minute : NaN; };
  const modeOf = (item) => ['home', 'out', 'any'].includes(item.mode) ? item.mode : 'home';
  function blockReason(item, config) {
    if (item.prepared === false) return item.materials ? `${item.materials} 尚未备齐` : '准备工作还没完成';
    if (config.rain && modeOf(item) === 'out' && item.outdoor) return '下雨，暂缓户外活动';
    const day = new Date(`${config.date}T12:00:00`).getDay();
    if (item.weekendsOnly && day !== 0 && day !== 6) return '只能周末做';
    if ((item.open && !Number.isFinite(minutes(item.open))) || (item.close && !Number.isFinite(minutes(item.close)))) return '时间限制需要重新确认';
    if (!Number.isInteger(Number(item.duration)) || Number(item.duration) < 5) return '请补充预计耗时';
    return '';
  }
  function nextContext(item, previous) {
    if (modeOf(item) === 'any') return previous;
    return { mode: modeOf(item), area: item.area || '', address: item.address || '' };
  }
  function transferTime(item, previous, config) {
    if (!previous || modeOf(item) === 'any') return 0;
    if (previous.mode === 'home' && modeOf(item) === 'home') return 0;
    if (previous.mode === 'out' && modeOf(item) === 'out') {
      if (item.address && previous.address === item.address) return 0;
      if (item.area && previous.area === item.area) return Math.max(10, Math.round(Number(config.travel || 25) * .55));
    }
    return Number(config.travel || 25);
  }
  function buildPlan(items, selectedIds, config, done = {}) {
    const selected = items.filter((item) => selectedIds.includes(item.id));
    const byId = new Map(items.map((item) => [item.id, item]));
    const dayStart = minutes(config.start), dayEnd = minutes(config.end);
    if (!Number.isFinite(dayStart) || !Number.isFinite(dayEnd) || dayStart >= dayEnd) return { entries: [], excluded: [] };
    const available = selected.filter((item) => !blockReason(item, config));
    const completed = (id) => Boolean(done[`${config.date}:${id}`]);
    let frontier = [{ time: dayStart, entries: [], used: [], score: 0, context: {mode:'home'}, categories: [] }];
    let best = frontier[0];
    const limit = Math.min(Number(config.maxTasks || 4), available.length);
    for (let depth = 0; depth < limit; depth++) {
      const next = [];
      for (const node of frontier) {
        for (const item of available) {
          if (node.used.includes(item.id)) continue;
          if (item.afterId && !node.used.includes(item.afterId) && !completed(item.afterId)) continue;
          const transfer = transferTime(item, node.context, config);
          const rest = node.entries.length ? Number(config.rest || 0) : 0;
          const arrival = node.time + transfer + rest;
          const begins = Math.max(arrival, item.open ? minutes(item.open) : dayStart);
          const finishes = begins + Number(item.duration);
          if (finishes > dayEnd || (item.close && finishes > minutes(item.close))) continue;
          const wait = begins - arrival;
          const score = node.score + 100 + (item.priority ? 50 : 0) + (node.categories.includes(item.category) ? 0 : 5) - wait * .12 - transfer * .12;
          const candidate = { time: finishes, entries: [...node.entries, { id: item.id, start: begins, end: finishes, transfer, rest, wait }], used: [...node.used, item.id], score, context: nextContext(item, node.context), categories: [...node.categories, item.category] };
          next.push(candidate);
          if (score > best.score || (score === best.score && finishes < best.time)) best = candidate;
        }
      }
      frontier = next.sort((a, b) => b.score - a.score || a.time - b.time).slice(0, 180);
      if (!frontier.length) break;
    }
    const excluded = selected.filter((item) => !best.used.includes(item.id)).map((item) => {
      let reason = blockReason(item, config);
      if (!reason && item.afterId && !best.used.includes(item.afterId) && !completed(item.afterId)) reason = `需要先完成“${byId.get(item.afterId)?.title || '前置事项'}”`;
      if (!reason && best.entries.length >= limit) reason = '本次件数已满，可以调高上限或换一件';
      if (!reason) reason = '这段时间放不下，或不符合时间限制';
      return { item, reason };
    });
    return { entries: best.entries, excluded };
  }
  function addDays(value, amount) {
    const date = new Date(`${value}T12:00:00`); if(Number.isNaN(date.getTime()))return '';
    date.setDate(date.getDate()+amount);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function buildAgenda(items,selectedIds,config,done={},count=7){
    const days=[],scheduled=new Set(),carry=new Set();let excluded=[];
    // Prior completed prerequisites carry forward; planning never writes completion state.
    for(let offset=0;offset<count;offset++){
      const date=addDays(config.date,offset),effective={...done};
      for(const [key,value] of Object.entries(done))if(value&&key.slice(0,10)<date)effective[`${date}:${key.slice(11)}`]=true;
      for(const id of carry)effective[`${date}:${id}`]=true;
      const eligible=selectedIds.filter(id=>!scheduled.has(id)&&(!config.preferredDates?.[id]||config.preferredDates[id]<=date));
      const plan=buildPlan(items,eligible,{...config,...config.dailyWindows?.[date],date},effective);
      days.push({date,entries:plan.entries});excluded=plan.excluded.map(({item,reason})=>({id:item.id,reason}));
      for(const entry of plan.entries){scheduled.add(entry.id);carry.add(entry.id);}
    }
    return {startDate:config.date,days,excluded};
  }
  const api = Object.freeze({ buildPlan, buildAgenda, addDays, blockReason, minutes, modeOf });
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ActivityPlanner = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
