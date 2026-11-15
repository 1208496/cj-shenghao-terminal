import catalog from './setup-presets.json' with {type:'json'};

const numericAndDate={age:['22','26','30','35'],cashYuan:['0','10000','100000','1000000'],startDate:['2026-01-05','2026-06-01','2026-11-16'],startTime:['08:00','10:00','14:00','19:00'],a_value:['10000','100000','1000000'],c_age:['22','26','30','35'],c_aff:['20','40','50','60'],c_heightCm:['158','163','168','173'],c_weightKg:['45','50','55','60'],c_bustCm:['80','84','88','92'],c_waistCm:['58','62','66','70'],c_hipCm:['84','88','92','96'],c_shoeSizeEu:['35','36','37','38','39']};
export const contactPresets=catalog.contacts;
export function fieldOptions(key){return [...new Set(numericAndDate[key]||catalog.fields[key]||[])].map(String);}
export function contactPresetValues(p){return {c_name:p.name,c_age:p.age,c_relation:p.relationshipLabel,c_aff:p.affection,c_job:p.occupation,c_personalityTags:p.personalityTags.join('、'),c_appearance:p.appearance,c_body:p.body,c_heightCm:p.heightCm,c_weightKg:p.weightKg,c_bustCm:p.bustCm,c_waistCm:p.waistCm,c_hipCm:p.hipCm,c_shoeSizeEu:p.shoeSizeEu,c_notes:p.notes};}

// One dropdown supports editable inputs and textareas, including numeric/date fields.
export function installFieldOptions({enabled,options=fieldOptions,onChange=()=>{}}){
  let anchor=null,popup=null,active=-1,items=[];
  function close(){if(anchor){anchor.setAttribute('aria-expanded','false');anchor.removeAttribute('aria-activedescendant');}popup?.remove();popup=null;anchor=null;items=[];active=-1;}
  function mark(index){active=index;items.forEach((el,i)=>el.setAttribute('aria-selected',String(i===active)));if(anchor&&items[index]){anchor.setAttribute('aria-activedescendant',items[index].id);items[index].scrollIntoView({block:'nearest'});}}
  function choose(index){if(!anchor||!items[index])return;const input=anchor;input.value=items[index].dataset.value;close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.focus();onChange(input);}
  function open(input){
    if(!enabled||!input.matches('input[data-field],textarea[data-field]'))return;
    const values=options(input.dataset.field);close();if(!values.length||input.disabled||input.readOnly)return;anchor=input;
    popup=document.createElement('div');popup.className='setup-field-options';popup.id='cj-setup-field-options';popup.setAttribute('role','listbox');popup.setAttribute('aria-label','预设'+(input.labels?.[0]?.textContent||'选项'));
    for(const [i,value] of values.entries()){const item=document.createElement('button');item.type='button';item.id='cj-setup-option-'+i;item.setAttribute('role','option');item.setAttribute('aria-selected','false');item.dataset.value=value;item.textContent=value;item.addEventListener('pointerdown',e=>e.preventDefault());item.addEventListener('click',()=>choose(i));popup.append(item);}
    document.body.append(popup);items=[...popup.children];input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-haspopup','listbox');input.setAttribute('aria-expanded','true');
    const rect=input.getBoundingClientRect(),gap=4,below=innerHeight-rect.bottom-gap,above=rect.top-gap,height=Math.min(200,Math.max(below,above)-8);popup.style.width=Math.min(rect.width,innerWidth-16)+'px';popup.style.left=Math.max(8,Math.min(rect.left,innerWidth-popup.offsetWidth-8))+'px';popup.style.maxHeight=Math.max(48,height)+'px';
    if(below>=Math.min(160,popup.scrollHeight)||below>=above)popup.style.top=rect.bottom+gap+'px';else popup.style.bottom=innerHeight-rect.top+gap+'px';
  }
  function keydown(e){if(!popup)return false;if(e.key==='Escape'){close();e.preventDefault();return true;}if(e.key==='Tab'){close();return false;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();mark(active<0?(e.key==='ArrowDown'?0:items.length-1):(active+(e.key==='ArrowDown'?1:-1)+items.length)%items.length);return true;}if(e.key==='Enter'&&active>=0){e.preventDefault();choose(active);return true;}return false;}
  document.addEventListener('focusin',e=>open(e.target));
  document.addEventListener('click',e=>{if(e.target.matches('input[data-field],textarea[data-field]')&&!popup)open(e.target);});
  document.addEventListener('pointerdown',e=>{if(popup&&!popup.contains(e.target)&&e.target!==anchor)close();});
  document.addEventListener('focusout',()=>queueMicrotask(()=>{if(popup&&document.activeElement!==anchor&&!popup.contains(document.activeElement))close();}));
  document.addEventListener('scroll',e=>{if(popup&&!popup.contains(e.target))close();},true);
  window.addEventListener('resize',close);
  return {close,keydown};
}
