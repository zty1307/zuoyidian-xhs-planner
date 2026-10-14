(function(root){
  const rules = [
    ['餐厅', /餐厅|餐馆|火锅|云南菜|下山虎|一坐一忘|吃饭探店/],
    ['探店', /探店|逛店|咖啡店|store/],
    ['发型', /盘发|编发|扎发|扎头发|发型|卷发|刘海|丸子头/],
    ['美妆', /化妆|妆容|淡妆|彩妆|底妆|眼影|眼线|口红|护肤|美甲/],
    ['美食', /食谱|做饭|早餐|午餐|晚餐|烘焙|蛋糕|面包|汤面|番茄|咖啡|料理|饼干/],
    ['手作', /手工|手作|折纸|a4纸|a4 纸|钩织|编织|黏土|粘土|刺绣|diy/],
    ['运动', /运动|健身|拉伸|瑜伽|普拉提|跑步|晨练|游泳|跳绳|训练/],
    ['穿搭', /穿搭|搭配|衣服|ootd|衣橱|衬衫|毛衣|裙子|配色/],
    ['园艺', /园艺|盆栽|绿植|养花|多肉|绣球|浇水|换盆|移栽/],
    ['家居', /收纳|整理|打扫|清洁|桌面|书架|家居|房间/],
    ['摄影', /摄影|拍照|拍摄|相机|构图|修图|滤镜/],
    ['阅读', /阅读|读书|书单|小说|读完|书摘/],
    ['学习', /学习|教程|英语|单词|excel|ppt|编程|笔记方法|简历|面试/],
    ['出门', /旅行|旅游|散步|公园|探店|展览|逛展|骑行|徒步|citywalk/]
  ];
  const categories=[...rules.map(([name])=>name),'其他'];
  function suggest(text){const value=String(text||'').toLowerCase();return rules.find(([,rule])=>rule.test(value))?.[0]||'其他';}
  const travelRules=[['美食',/美食|吃什么|吃饭|餐厅|餐食|食物|restaurant|海鲜|烤鸡/i],['交通',/gobus|交通|车票|乘车|航班|机场接送/i],['住宿',/住宿|酒店推荐|住哪里|民宿/i],['行前准备',/必备|物品清单|穿衣|穿搭|签证|换汇|电话卡/i],['景点',/景点|金字塔|神庙|博物馆/i],['路线',/攻略|自由行|路线|行程|旅行|旅游|出海/i]];
  function explain(text,travel=false){
    const value=String(text||''),hit=(travel?travelRules:rules).map(([category,rule])=>({category,match:value.match(new RegExp(rule.source,'i'))})).find(x=>x.match);
    return hit?{category:hit.category,keyword:hit.match[0],method:'keyword'}:{category:travel?'行前准备':'其他',keyword:'',method:'fallback'};
  }
  function review(items,{travel=false,onChange}){
    const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    let d=document.querySelector('#categoryReview');if(!d){d=document.createElement('dialog');d.id='categoryReview';d.className='category-dialog';document.body.append(d);}
    const options=travel?['景点','路线','美食','交通','住宿','行前准备']:categories;
    const draw=()=>{d.innerHTML='<div class="dialog-heading"><h2>自动分类</h2><button class="icon-button" data-close aria-label="关闭分类">×</button></div><p class="share-intro">识别标题关键词，自动归类；手动修改后会保留你的选择。</p><div class="classification-list">'+items.map((n,i)=>{const result=explain(n.title,travel);return '<div class="classification-row"><div><strong>'+esc(n.title)+'</strong><small>'+(n.manual?'已手动分类':result.keyword?'识别到「'+esc(result.keyword)+'」':'未识别关键词，使用默认分类')+'</small></div><select data-classify="'+i+'" aria-label="'+esc(n.title)+'的分类">'+options.map(c=>'<option '+(c===n.category?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select>'+(n.manual?'<button class="text-button" data-auto="'+i+'">恢复自动</button>':'<span class="auto-label">自动</span>')+'</div>';}).join('')+'</div>';d.querySelector('[data-close]').onclick=()=>d.close();};
    d.onchange=e=>{if(!e.target.hasAttribute('data-classify'))return;const i=Number(e.target.dataset.classify);items[i].category=e.target.value;items[i].manual=true;onChange(items[i]);draw();};
    d.onclick=e=>{const b=e.target.closest('[data-auto]');if(!b)return;const n=items[Number(b.dataset.auto)];n.category=explain(n.title,travel).category;n.manual=false;onChange(n);draw();};draw();d.showModal();
  }
  const api={categories,suggest,explain,review};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.NoteCategories=api;
})(globalThis);
