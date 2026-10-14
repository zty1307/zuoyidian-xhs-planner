(function(root){
  'use strict';
  const normalize=value=>String(value||'').normalize('NFKC').trim().toLowerCase().replace(/[\s·•]/g,'');
  function collect(notes){
    const map=new Map();
    for(const note of notes)for(const place of note.places||[]){
      if(!place.city?.trim()||!place.name?.trim())continue;
      const key=normalize(place.city)+'|'+normalize(place.name);
      if(!map.has(key))map.set(key,{...place,id:key,city:place.city.trim(),name:place.name.trim(),sources:[],fullDay:false});
      const found=map.get(key);found.fullDay=found.fullDay||Boolean(place.fullDay);if(!found.sources.includes(note.id))found.sources.push(note.id);
    }
    return [...map.values()];
  }
  // Planning estimates: 7 hours of visits/transfers, plus a lunch break.
  // Areas and durations are curated annotations, not live navigation or opening hours.
  function arrange(places,selected,dayCount){
    const days=Array.from({length:Math.max(1,Math.min(30,Number(dayCount)||1))},()=>[]),meta=days.map(()=>({kind:'free'})),groups=new Map(),excluded=[];
    for(const p of places.filter(p=>selected.includes(p.id))){if(!groups.has(p.city))groups.set(p.city,[]);groups.get(p.city).push(p);}
    let cursor=0,previous='';
    const flush=(batch,city,region)=>{if(!batch.length)return;if(cursor<days.length){days[cursor]=batch.map(p=>p.id);meta[cursor++]={kind:'visit',city,region,minutes:batch.reduce((n,p)=>n+(p.fullDay?420:p.duration||120),0)+Math.max(0,batch.length-1)*30};}else excluded.push(...batch.map(p=>p.id));};
    for(const [city,group] of groups){
      if(previous&&cursor<days.length){meta[cursor++]={kind:'transfer',city,from:previous};}
      const regions=new Map();for(const p of group){const region=p.region||'区域待确认';if(!regions.has(region))regions.set(region,[]);regions.get(region).push(p);}
      for(const [region,items] of regions){
        items.sort((a,b)=>Number(Boolean(b.early))-Number(Boolean(a.early)));
        let batch=[],minutes=0;
        for(const p of items){const duration=p.fullDay?420:p.duration||120;
          if(p.fullDay){flush(batch,city,region);batch=[];minutes=0;flush([p],city,region);continue;}
          if(batch.length&&minutes+30+duration>420){flush(batch,city,region);batch=[];minutes=0;}
          minutes+=(batch.length?30:0)+duration;batch.push(p);
        }flush(batch,city,region);
      }previous=city;
    }
    return {days,meta,excluded};
  }
  function evidence(place,notes){
    const relevant=notes.filter(n=>(n.places||[]).some(p=>normalize(p.city)===normalize(place.city)));
    const ids=[...new Set(place.sources)].filter(id=>relevant.some(n=>n.id===id));
    return {count:ids.length,total:relevant.length,percent:relevant.length?Math.round(ids.length/relevant.length*100):0,sources:ids};
  }
  function collectMeals(notes){
    const map=new Map();
    for(const note of notes)for(const meal of note.meals||[]){
      const id=normalize(meal.city)+'|'+normalize(meal.name);
      if(!map.has(id))map.set(id,{...meal,id,sources:[]});
      map.get(id).sources.push(note.id);
    }
    return [...map.values()];
  }
  function matchMeals(days,places,meals,choices={}){
    const used=new Set(Object.values(choices).filter(Boolean));
    return days.map((ids,index)=>{
      const entries=ids.map(id=>places.find(p=>p.id===id)).filter(Boolean);
      const cities=new Set(entries.map(p=>normalize(p.city)));
      if(Object.hasOwn(choices,index))return meals.find(m=>m.id===choices[index]&&cities.has(normalize(m.city)))||null;
      const candidates=meals.filter(m=>cities.has(normalize(m.city))&&!used.has(m.id)&&(!m.near||entries.some(p=>p.name===m.near)));
      candidates.sort((a,b)=>Number(Boolean(b.near))-Number(Boolean(a.near)));
      const meal=candidates[0]||null;if(meal)used.add(meal.id);return meal;
    });
  }
  function matchDayMeals(days,places,meals,choices={}){
    const used=new Set(Object.values(choices).filter(Boolean));
    return days.map((ids,index)=>{
      const entries=ids.map(id=>places.find(p=>p.id===id)).filter(Boolean),cities=new Set(entries.map(p=>normalize(p.city))),result={};
      for(const slot of ['午餐','晚餐']){
        const key=index+':'+slot;
        const valid=m=>cities.has(normalize(m.city))&&(m.slots||[m.slot||'晚餐']).includes(slot);
        if(Object.hasOwn(choices,key)){result[slot]=meals.find(m=>m.id===choices[key]&&valid(m))||null;continue;}
        const candidates=meals.filter(m=>valid(m)&&!used.has(m.id)&&(!m.near||entries.some(p=>p.name===m.near))&&(!m.region||entries.some(p=>p.region===m.region)));
        candidates.sort((a,b)=>Number(Boolean(b.near))-Number(Boolean(a.near)));
        result[slot]=candidates[0]||null;if(result[slot])used.add(result[slot].id);
      }return result;
    });
  }
  const api={collect,arrange,collectMeals,matchMeals,matchDayMeals,evidence};root.TravelPlanner=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
