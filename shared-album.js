(function(root){
  'use strict';
  const storageKey='zuoyidian-shared-albums-v1',adapters={},viewers={},applying=new Set();
  const people=[{id:'me',name:'我',color:'#ea4356'},{id:'xiaoman',name:'小满',color:'#b79b76'},{id:'ayao',name:'阿遥',color:'#7e9c91'}];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const read=()=>{try{return JSON.parse(localStorage.getItem(storageKey))||{};}catch{return {};}};
  function persist(value){localStorage.setItem(storageKey,JSON.stringify(value));}
  const person=id=>people.find(p=>p.id===id)||people[0];
  function viewer(kind){let id=viewers[kind];if(!id){try{id=sessionStorage.getItem(storageKey+':viewer:'+kind);}catch{}}return read()[kind]?.members.includes(id)?id:'me';}
  function draw(kind){
    const a=adapters[kind],album=read()[kind];if(!a)return;let bar=document.querySelector('#shared-'+kind);
    if(!bar){bar=document.createElement('div');bar.id='shared-'+kind;bar.className='shared-album-bar';document.querySelector(a.anchor).after(bar);}
    bar.hidden=!album;if(!album)return;
    bar.innerHTML='<div class="shared-people">'+album.members.map(id=>{const p=person(id);return '<span style="--person-color:'+p.color+'" title="'+p.name+'">'+p.name.slice(-1)+'</span>';}).join('')+'</div><div class="shared-album-label"><strong>'+esc(album.title)+'</strong><small>'+esc(album.lastEditor?person(album.lastEditor).name+'更新了专辑':'一起安排这份计划')+'</small></div><button class="text-button" data-manage-shared>管理</button>';
    bar.querySelector('[data-manage-shared]').onclick=()=>open(kind);
  }
  function publish(kind,snapshot){
    if(applying.has(kind))return;const all=read(),album=all[kind];if(!album||JSON.stringify(album.snapshot)===JSON.stringify(snapshot))return;
    album.snapshot=JSON.parse(JSON.stringify(snapshot));album.lastEditor=viewer(kind);album.revision=(album.revision||0)+1;persist(all);draw(kind);
  }
  function register(kind,adapter){
    adapters[kind]=adapter;const album=read()[kind];if(album?.snapshot){applying.add(kind);try{adapter.receive(album.snapshot);}finally{applying.delete(kind);}}draw(kind);
  }
  function open(kind){
    const a=adapters[kind];if(!a)return;const album=read()[kind];let d=document.querySelector('#sharedAlbumDialog');
    if(!d){d=document.createElement('dialog');d.id='sharedAlbumDialog';d.className='shared-album-dialog';document.body.append(d);}
    d.innerHTML='<form><div class="dialog-heading"><h2>共同专辑</h2><button class="icon-button" type="button" data-shared-close aria-label="关闭共同专辑">×</button></div><label class="shared-title-field"><span>专辑名称</span><input name="title" maxlength="32" required value="'+esc(album?.title||(kind==='travel'?'一起去埃及':'一起做一点'))+'"/></label><div class="shared-members">'+people.map(p=>'<label class="shared-member"><span class="shared-avatar" style="--person-color:'+p.color+'">'+p.name.slice(-1)+'</span><span>'+p.name+(p.id==='me'?'<small>创建者</small>':'<small>可共同安排</small>')+'</span><input type="checkbox" name="member" value="'+p.id+'" '+(p.id==='me'?'checked disabled':(album?.members||['xiaoman']).includes(p.id)?'checked':'')+'/></label>').join('')+'</div>'+(album?'<label class="shared-viewer"><span>体验好友视角</span><select name="viewer" aria-label="协作演示身份">'+album.members.map(id=>'<option value="'+id+'" '+(viewer(kind)===id?'selected':'')+'>'+person(id).name+'</option>').join('')+'</select></label>':'')+'<div class="shared-dialog-footer"><small>演示好友 · 未连接小红书账号</small><button class="button button-coral" type="submit">'+(album?'完成':'创建共同专辑')+'</button></div><p class="shared-feedback" role="status"></p></form>';
    d.querySelector('[data-shared-close]').onclick=()=>d.close();
    d.querySelector('form').onsubmit=e=>{e.preventDefault();const f=e.currentTarget,members=['me',...Array.from(f.querySelectorAll('[name=member]:checked')).map(x=>x.value).filter(id=>id!=='me')];if(members.length<2){d.querySelector('[role=status]').textContent='选择一位一起安排的好友';return;}const all=read();all[kind]={id:album?.id||crypto.randomUUID(),title:f.elements.title.value.trim()||(kind==='travel'?'一起去埃及':'一起做一点'),members,snapshot:JSON.parse(JSON.stringify(a.snapshot())),revision:album?.revision||0,lastEditor:album?.lastEditor||''};const selected=f.elements.viewer?.value||'me';viewers[kind]=members.includes(selected)?selected:'me';try{sessionStorage.setItem(storageKey+':viewer:'+kind,viewers[kind]);persist(all);draw(kind);d.close();}catch{d.querySelector('[role=status]').textContent='保存失败，请检查浏览器存储空间';}};
    d.showModal();
  }
  addEventListener('storage',e=>{if(e.key!==storageKey)return;const all=read();for(const [kind,a] of Object.entries(adapters)){if(all[kind]?.snapshot){applying.add(kind);try{a.receive(all[kind].snapshot);}finally{applying.delete(kind);}}draw(kind);}});
  root.SharedAlbum={register,publish,open};
})(globalThis);
