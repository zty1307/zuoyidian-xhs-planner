(function(root){
  'use strict';
  function create(start,items,addDays){
    const weekdays=[['note-food'],['note-organize'],['note-outfit'],['note-pilates'],['note-craft']];
    const weekend={6:['note-hair','note-makeup','note-hotpot'],0:['note-plants','note-store']};
    const dailyWindows={},preferredDates={},selected=[];let weekday=0;
    for(let offset=0;offset<7;offset++){
      const date=addDays(start,offset),day=new Date(date+'T12:00:00').getDay(),isWeekend=day===0||day===6;
      dailyWindows[date]={start:isWeekend?'10:00':'19:00',end:isWeekend?'16:00':'21:00',maxTasks:isWeekend?4:2};
      const ids=isWeekend?weekend[day]:weekdays[weekday++];
      for(const id of ids)if(items.some(n=>n.id===id)){selected.push(id);preferredDates[id]=date;}
    }
    return {selected,config:{date:start,viewDays:7,start:'19:00',end:'21:00',maxTasks:2,rest:10,travel:25,rain:false,dailyWindows,preferredDates}};
  }
  const api={create};root.DemoWeek=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
