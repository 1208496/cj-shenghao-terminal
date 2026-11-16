import catalog from './setup-presets.json' with {type:'json'};

const numericAndDate={startDate:['2026-01-05','2026-06-01','2026-11-16','2026-02-14','2026-05-01','2026-10-01'],startTime:['08:00','10:00','14:00','19:00','07:00','09:00','12:00','21:00'],a_value:['10000','100000','1000000','5000','50000','500000'],c_aff:['20','40','50','60','25','30','35','45'],c_heightCm:['158','163','168','173','155','160','165','170'],c_weightKg:['45','50','55','60','48','52','58','65'],c_bustCm:['80','84','88','92','78','82','86','90'],c_waistCm:['58','62','66','70','56','60','64','68'],c_hipCm:['84','88','92','96','82','86','90','94'],c_shoeSizeEu:['35','36','37','38','39','34','35.5','36.5','37.5','40']};
export const contactPresets=catalog.contacts;
export function fieldOptions(key){if(['name','age','c_name','c_age','cashYuan'].includes(key))return [];return [...new Set(numericAndDate[key]||catalog.fields[key]||[])].map(String);}
export function contactPresetValues(p){return {c_name:p.name,c_age:p.age,c_beauty:p.beautyScore??60,c_relation:p.relationshipLabel,c_aff:p.affection,c_job:p.occupation,c_personalityTags:p.personalityTags.join('、'),c_appearance:p.appearance,c_body:p.body,c_heightCm:p.heightCm,c_weightKg:p.weightKg,c_bustCm:p.bustCm,c_waistCm:p.waistCm,c_hipCm:p.hipCm,c_shoeSizeEu:p.shoeSizeEu,c_notes:p.notes};}

// One dropdown supports editable inputs and textareas, including numeric/date fields.
export function installFieldOptions({enabled,options=fieldOptions,onChange=()=>{}}){
  let anchor=null,popup=null,active=-1,items=[],keyboardFocus=false;
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
  document.addEventListener('keydown',e=>{keyboardFocus=e.key==='Tab';},true);
  document.addEventListener('focusin',e=>{if(keyboardFocus){keyboardFocus=false;open(e.target);}});
  document.addEventListener('click',e=>{if(e.target.matches('input[data-field],textarea[data-field]')&&!popup)open(e.target);});
  document.addEventListener('pointerdown',e=>{if(popup&&!popup.contains(e.target)&&e.target!==anchor)close();});
  document.addEventListener('focusout',()=>queueMicrotask(()=>{if(popup&&document.activeElement!==anchor&&!popup.contains(document.activeElement))close();}));
  document.addEventListener('scroll',e=>{if(popup&&!popup.contains(e.target))close();},true);
  window.addEventListener('resize',close);
  return {close,keydown};
}
