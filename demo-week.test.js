const test=require('node:test'),assert=require('node:assert/strict'),planner=require('./planner'),week=require('./demo-week');require('./demo-notes');
test('任意星期起始的七天均有安排，工作日19点起且1—2件，周末更丰富',()=>{
 for(let offset=0;offset<7;offset++){
  const start=planner.addDays('2026-10-14',offset),items=globalThis.DEMO_NOTES.map(n=>({...n}));
  Object.assign(items.find(n=>n.id==='note-food'),{open:'19:00',close:'21:00'});
  const setup=week.create(start,items,planner.addDays),agenda=planner.buildAgenda(items,setup.selected,setup.config,{},7);
  assert.equal(agenda.days.length,7);assert.equal(agenda.excluded.length,0);
  for(const day of agenda.days){const dow=new Date(day.date+'T12:00:00').getDay();assert.ok(day.entries.length,day.date);if(dow!==0&&dow!==6){assert.ok(day.entries.length<=2);assert.ok(day.entries.every(e=>e.start>=19*60&&e.end<=21*60));}else assert.ok(day.entries.length>=2);}
  assert.equal(new Set(agenda.days.flatMap(d=>d.entries.map(e=>e.id))).size,10);
 }
});
