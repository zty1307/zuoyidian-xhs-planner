const test=require('node:test'),assert=require('node:assert/strict');
const {collect,arrange,collectMeals,matchMeals,matchDayMeals,evidence}=require('./travel-planner');
test('同城同名合并来源，不合并不同城市的同名地点',()=>{
 const p=collect([{id:'a',places:[{city:'悉尼',name:'歌剧院'},{city:'悉尼',name:'歌剧院'}]},{id:'b',places:[{city:' 悉尼 ',name:'歌 剧 院'},{city:'墨尔本',name:'歌剧院'}]}]);
 assert.equal(p.length,2);assert.deepEqual(p[0].sources,['a','b']);
});
test('按时长装入同城地点，跨城留交通日，排不下的保留',()=>{
 const p=collect([{id:'a',places:[{city:'A',name:'1'},{city:'B',name:'2'},{city:'A',name:'3'},{city:'A',name:'4'},{city:'B',name:'5'}]}]);
 const r=arrange(p,p.map(x=>x.id),2);assert.equal(r.days.length,2);assert.deepEqual(r.days.map(x=>x.length),[3,0]);assert.equal(r.meta[1].kind,'transfer');assert.equal(r.excluded.length,2);assert.equal(new Set(r.days.flat().concat(r.excluded)).size,5);
});

test('同岸集中，清晨事项先排，每日不按固定地点个数切分',()=>{
 const p=collect([{id:'a',places:[{city:'卢克索',name:'东岸一',region:'东岸',duration:90},{city:'卢克索',name:'西岸一',region:'西岸',duration:180},{city:'卢克索',name:'东岸二',region:'东岸',duration:90},{city:'卢克索',name:'东岸三',region:'东岸',duration:90},{city:'卢克索',name:'热气球',region:'西岸',duration:180,early:true}]}]);
 const r=arrange(p,p.map(x=>x.id),3);
 assert.deepEqual(r.days.map(d=>d.length),[3,2,0]);
 assert.equal(p.find(x=>x.id===r.days[1][0]).name,'热气球');
 assert.ok(r.meta.filter(x=>x.kind==='visit').every(x=>x.minutes<=420));
});

test('餐次独立匹配，缺失来源不填假餐厅，手动删除只影响对应餐次',()=>{
 const p=collect([{id:'a',places:[{city:'开罗',name:'馆',region:'馆区'}]}]);
 const m=collectMeals([{id:'food',meals:[{city:'开罗',name:'馆内午餐',near:'馆',slot:'午餐'},{city:'开罗',name:'晚餐',slot:'晚餐'},{city:'别城',name:'早餐',slot:'早餐'}]}]);
 const first=matchDayMeals([[p[0].id]],p,m)[0];assert.equal(Object.hasOwn(first,'早餐'),false);assert.equal(first.午餐.name,'馆内午餐');assert.equal(first.晚餐.name,'晚餐');
 const changed=matchDayMeals([[p[0].id]],p,m,{'0:午餐':''})[0];assert.equal(changed.午餐,null);assert.equal(changed.晚餐.name,'晚餐');
});

test('提及率分母仅含同城地点笔记，重复提及不增加分子',()=>{
 const notes=[{id:'a',places:[{city:'开罗',name:'塔'},{city:'开罗',name:'塔'}]},{id:'b',places:[{city:'开罗',name:'馆'}]},{id:'c',places:[{city:'卢克索',name:'塔'}]},{id:'food',meals:[{city:'开罗',name:'吃饭'}]}];
 const p=collect(notes)[0],result=evidence(p,notes);assert.deepEqual(result,{count:1,total:2,percent:50,sources:['a']});
});
test('只安排选中的地点且空闲天保留',()=>{const p=collect([{id:'a',places:[{city:'A',name:'1'},{city:'B',name:'2'}]}]);const r=arrange(p,[p[1].id],3,2);assert.deepEqual(r.days,[[p[1].id],[],[]]);});
test('整天事项独占一天，重复来源保留较保守的整天设定',()=>{const p=collect([{id:'a',places:[{city:'A',name:'博物馆'},{city:'A',name:'集市'}]},{id:'b',places:[{city:'A',name:'博物馆',fullDay:true}]}]);assert.equal(p[0].fullDay,true);const r=arrange(p,p.map(x=>x.id),2,3);assert.deepEqual(r.days,[[p[0].id],[p[1].id]]);});

test('餐厅按同城匹配，馆内餐厅只匹配博物馆当天且不重复推荐',()=>{
 const notes=[{id:'a',places:[{city:'开罗',name:'集市'},{city:'开罗',name:'博物馆'},{city:'卢克索',name:'神庙'}],meals:[{city:'开罗',name:'馆内餐厅',near:'博物馆'},{city:'开罗',name:'烤肉店'}]}];
 const p=collect(notes),m=collectMeals(notes),result=matchMeals(p.map(x=>[x.id]),p,m);
 assert.deepEqual(result.map(x=>x?.name||null),['烤肉店','馆内餐厅',null]);
 const moved=matchMeals([[p[1].id],[p[0].id]],p,m);
 assert.equal(moved[0].name,'馆内餐厅');
});
test('手动换餐厅与暂不安排优先于自动匹配，并保留多篇来源',()=>{
 const notes=[{id:'a',places:[{city:'开罗',name:'集市'}],meals:[{city:'开罗',name:'烤肉店'}]},{id:'b',meals:[{city:'开罗',name:'烤肉店'},{city:'开罗',name:'咖啡店'}]}];
 const p=collect(notes),m=collectMeals(notes),days=[[p[0].id],[p[0].id]];
 assert.deepEqual(m[0].sources,['a','b']);
 const result=matchMeals(days,p,m,{0:m[1].id,1:''});
 assert.equal(result[0].name,'咖啡店');assert.equal(result[1],null);
});
