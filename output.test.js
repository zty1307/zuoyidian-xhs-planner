const test=require('node:test'),assert=require('node:assert/strict');
const output=require('./plan-output'),categories=require('./categories'),planner=require('./travel-planner');require('./travel-data');
test('默认旅行每个游览日均有真实来源午晚餐，出海午餐在船上',()=>{
 const notes=globalThis.TRAVEL_ALBUM.notes,places=planner.collect(notes),plan=planner.arrange(places,places.map(p=>p.id),12),meals=planner.matchDayMeals(plan.days,places,planner.collectMeals(notes));
 plan.days.forEach((day,i)=>{if(day.length){for(const slot of ['午餐','晚餐']){assert.ok(meals[i][slot],`第${i+1}天缺${slot}`);assert.ok(meals[i][slot].sources.every(id=>notes.some(n=>n.id===id&&n.url)));}assert.equal(Object.hasOwn(meals[i],'早餐'),false);}});
 const boat=plan.days.findIndex(d=>d.some(id=>places.find(p=>p.id===id).name==='红海出海与浮潜'));assert.match(meals[boat].午餐.name,/船上午餐/);
 const short=planner.arrange(places,places.map(p=>p.id),7);assert.equal(short.days.length,7);assert.equal(short.excluded.length,5);assert.equal(short.days.flat().length+short.excluded.length,places.length);
});
test('自动分类按标题即时匹配，餐厅优先于金字塔，交通优先于攻略',()=>{
 assert.deepEqual(categories.explain('埃及｜9 Pyramids 金字塔餐厅攻略',true),{category:'美食',keyword:'餐厅',method:'keyword'});
 assert.equal(categories.explain('埃及GoBus攻略',true).category,'交通');assert.equal(categories.explain('强烈推荐赫尔格达这个出海项目',true).category,'路线');assert.equal(categories.explain('学一个低盘发').category,'发型');
});
test('分享页转义用户内容并拒绝危险来源链接，工作簿生成真实 ZIP',()=>{
 const plan={title:'<script>bad()</script>',days:[{date:'2026-10-17',label:'第1天',items:[{title:'=1+1',sources:[{title:'危险',url:'javascript:alert(1)'},{title:'原文',url:'https://www.xiaohongshu.com/explore/abc'}]}]}],sources:[]};
 const html=output.planHtml(plan);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));assert.ok(html.includes('&lt;script&gt;'));const bytes=output.workbook(plan);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);const text=new TextDecoder().decode(bytes);assert.ok(text.includes('t="inlineStr"'));assert.ok(!text.includes('<f>'));assert.ok(text.includes('行程安排'));
});
test('Excel 合并同一天日期及连续相同地点，跨天不合并地点',()=>{
 const plan={title:'合并测试',days:[{date:'2026-10-17',label:'第1天',items:[{title:'A',area:'在家'},{title:'B',area:'在家'},{title:'C',area:'咖啡店'}]},{date:'2026-10-18',label:'第2天',items:[{title:'D',area:'咖啡店'},{title:'E',area:'咖啡店'}]}],sources:[]};
 const xml=new TextDecoder().decode(output.workbook(plan));
 for(const ref of ['A2:A4','B2:B4','C2:C3','A5:A6','B5:B6','C5:C6'])assert.ok(xml.includes('mergeCell ref="'+ref+'"'),ref);
 assert.ok(!xml.includes('mergeCell ref="C4:C6"'));
});
