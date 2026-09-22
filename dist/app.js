import { starterPets, visibleTraits, COLORS, phenotype, makeChild, RULE_VERSION, validatePet } from './genes.js';
import { petSVG, escapeHTML as esc } from './pet-renderer.js';
import { openStorage, defaultState, LOCK_NAME, CHANNEL_NAME } from './storage.js';

const $ = s => document.querySelector(s);
const dna = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 7C43 16 5 32 34 41M34 7C5 16 43 32 14 41M17 12H31M17 24H31M17 36H31"/></svg>';
const icons = {
 sound: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4V5zM15 8q5 4 0 8M18 5q8 7 0 14"/></svg>',
 mute: '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H3v6h3l5 4V5zM16 9l5 6m0-6l-5 6"/></svg>',
 settings: '<svg viewBox="0 0 24 24"><path d="M10 3h4l1 3 3 1 3 3v4l-3 3-3 1-1 3h-4l-1-3-3-1-3-3v-4l3-3 3-1z"/><circle cx="12" cy="12" r="3"/></svg>',
 edit: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 4l5 5M4 20l5-1L21 7l-5-5L4 14v6z"/></svg>'
};
let state = defaultState(matchMedia('(prefers-reduced-motion: reduce)').matches), storage, writable = false, ready = false, busy = false;
let selectedId = state.pets[0].id, stage = 'empty', secondId = null, filter = 'all', sort = 'new', page = 0;
let pendingBirth = null, animationTimers = [], lastLabKey = '', toastTimer, renameId, releaseLock, lockPending = false, resultResolver;
let audioContext, writeQueue = Promise.resolve();
const channel = 'BroadcastChannel' in window ? new BroadcastChannel(CHANNEL_NAME) : null;
const findPet = id => state.pets.find(p=>p.id===id);
const currentTask = () => state.currentTaskId ? state.tasks[state.currentTaskId] : null;
const activeBusy = () => busy || stage === 'committing' || stage === 'breeding';
const canEdit = () => writable && ready;

function toast(message) { clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3300); }
function showError(message, retry = false) {
  const el=$('#error-banner');el.hidden=false;el.replaceChildren(document.createTextNode(message));
  if(retry){const button=document.createElement('button');button.textContent='重试保存';button.addEventListener('click',retryBirth);el.append(button);}
}
function clearError() { $('#error-banner').hidden=true; }
function assertWritable() { if(!canEdit()) throw new Error('当前为查看模式，请关闭另一张实验室页面后继续'); }
function persist(mutator) {
  const operation = writeQueue.catch(()=>{}).then(async()=>{
    assertWritable();$('#save-status').textContent='正在保存';
    const result=await storage.update(mutator);
    state=result;$('#save-status').textContent='已保存到本地';channel?.postMessage({type:'saved'});return result;
  });
  writeQueue=operation;
  return operation.catch(e=>{ $('#save-status').textContent='保存未完成';throw e; });
}
function playTone(type) {
 if(!state.settings.sound)return;
 try { audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();const notes=type==='birth'?[523,659,784]:type==='start'?[330,440]:[540];notes.forEach((hz,i)=>{const o=audioContext.createOscillator(),g=audioContext.createGain(),t=audioContext.currentTime+i*.11;o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.055,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g).connect(audioContext.destination);o.start(t);o.stop(t+.34);});}catch{/* Sound is optional. */}
}

function renderCollection() {
 const hiddenId=stage==='breeding'?currentTask()?.childId:null;
 let list=state.pets.filter(p=>p.id!==hiddenId && (filter!=='favorite'||p.favorite));
 if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
 else if(sort==='generation')list.sort((a,b)=>b.generation-a.generation||b.createdAt-a.createdAt);
 else list.sort((a,b)=>a.generation===0&&b.generation===0?a.createdAt-b.createdAt:b.createdAt-a.createdAt);
 const maxPage=Math.max(0,Math.ceil(list.length/12)-1);page=Math.min(page,maxPage);
 const count=state.pets.length-(hiddenId?1:0);
 $('#collection-count').textContent=count;$('#nav-count').textContent=String(count).padStart(2,'0');
 const disabled=!canEdit()||activeBusy();
 $('#pet-grid').innerHTML=list.slice(page*12,page*12+12).map(p=>`<article class="pet-card ${selectedId===p.id?'selected':''} ${state.sampleId===p.id?'sample-selected':''}" data-pet-id="${esc(p.id)}"><span class="card-stamp">${p.generation?'BORN':'ORIGIN'}</span><button class="favorite-mini ${p.favorite?'is-favorite':''}" data-action="favorite" data-id="${esc(p.id)}" aria-label="${p.favorite?'取消收藏':'收藏'} ${esc(p.name)}" aria-pressed="${!!p.favorite}" ${disabled?'disabled':''}>${p.favorite?'★':'☆'}</button><button class="card-view" data-action="view" data-id="${esc(p.id)}" aria-label="查看 ${esc(p.name)}"><div class="pet-image" style="--pet-tint:${COLORS[phenotype(p.genes).color]}">${petSVG(p,{label:false})}</div><span class="pet-card-name">${esc(p.name)}</span></button><div class="card-meta"><span class="generation">GEN. ${String(p.generation).padStart(2,'0')}</span><button class="sample-add" draggable="${!disabled}" data-drag="${esc(p.id)}" data-action="sample" data-id="${esc(p.id)}" aria-label="放入 ${esc(p.name)} 的样本" aria-pressed="${state.sampleId===p.id}" ${disabled?'disabled':''}>${state.sampleId===p.id?'✓':'+'}</button></div></article>`).join('') || '<div class="empty-collection">还没有收藏的宠物<br>点击宠物卡上的星星，留下喜欢的它。</div>';
 $('#pagination').hidden=maxPage===0;$('#page-number').textContent=`${page+1} / ${maxPage+1}`;$('#prev-page').disabled=page===0;$('#next-page').disabled=page===maxPage;
}

function renderObserver() {
 const pet=findPet(selectedId)||state.pets[0];if(!pet)return;
 const newBorn=stage==='result'&&pet.id===currentTask()?.childId;
 const disabled=!canEdit()||activeBusy();
 $('#observation').innerHTML=`<div class="observation-body"><div class="observation-image" style="--pet-tint:${COLORS[phenotype(pet.genes).color]}"><span class="observation-id">SPECIMEN / ${String(state.pets.indexOf(pet)+1).padStart(3,'0')}</span>${petSVG(pet)}</div><div class="name-line"><h3>${esc(pet.name)}</h3><div class="name-tools"><button class="bare-button" data-action="rename" data-id="${esc(pet.id)}" aria-label="给 ${esc(pet.name)} 改名" ${disabled?'disabled':''}>${icons.edit}</button></div></div><div class="observation-subline"><span class="origin-pill">${newBorn?'新生伙伴':pet.generation?'家族后代':'初始伙伴'}</span><span>第 ${pet.generation} 代</span></div><div class="divider"></div><div class="detail-title">可见特征</div><div class="traits">${visibleTraits(pet).map(t=>`<span class="trait">${esc(t)}</span>`).join('')}</div><div class="divider"></div><div class="detail-title">${pet.parentIds.length?'它的双亲':'家族档案'}</div>${pet.parentIds.length?`<div class="family">${pet.parentIds.map(id=>{const p=findPet(id);return p?`<button class="parent-button" data-action="view" data-id="${esc(id)}" aria-label="查看亲本 ${esc(p.name)}">${petSVG(p,{label:false})}<span>${esc(p.name)}</span></button>`:'<span class="origin-note">亲本记录缺失</span>';}).join('')}</div>`:'<div class="origin-note">故事从它开始。<br>挑选一位伙伴，发现新的可能。</div>'}<button class="primary-button" data-action="use" data-id="${esc(pet.id)}" ${disabled?'disabled':''}>${newBorn?'以它继续繁衍':state.sampleId===pet.id?'样本已在繁衍格中':'放入基因样本'} <span>${newBorn?'↗':'＋'}</span></button><p class="observation-footnote">${newBorn?'已经加入收藏，故事可以继续了':'采集样本不会消耗宠物'}</p></div>`;
}

function renderLab() {
 const task=currentTask(), key=[stage,state.sampleId,secondId,task?.id,!!pendingBirth].join('|');
 const same=lastLabKey===key;lastLabKey=key;
 const parents=(stage==='breeding'||stage==='result')&&task?task.parentIds:[state.sampleId,secondId];
 $('#source-tray').innerHTML=[0,1].map(i=>{const pet=findPet(parents[i]);return `<div class="source-chip ${i?'second':''} ${pet?'filled':''}"><span class="source-icon">${pet?petSVG(pet,{label:false}):i?'◇':'○'}</span><div class="source-info"><strong>${pet?esc(pet.name):`等待亲本${i?'乙':'甲'}`}</strong><small>${pet?`亲本${i?'乙':'甲'} · 第 ${pet.generation} 代`:'放入一份基因样本'}</small></div>${pet&&stage==='one'&&!i?'<button class="remove-sample" data-action="remove" aria-label="移除第一份样本" '+(!canEdit()||busy?'disabled':'')+'>×</button>':''}</div>`;}).join('');
 if(same)return;
 const content=$('#chamber-content'),status=$('#lab-status'),title=$('#stage-title'),subtitle=$('#stage-subtitle'),actions=$('#stage-actions');actions.innerHTML='';
 $('#drop-zone').setAttribute('aria-busy',String(stage==='committing'||stage==='breeding'));
 if(stage==='empty'){
  status.textContent='等待样本';title.textContent='等待一场奇妙的相遇';subtitle.textContent='将两份基因样本放进同一个格子';
  content.innerHTML=`<div class="empty-symbol">${dna}</div><div class="chamber-empty-label"><b>0</b> / 2 份样本</div>`;
 }else if(stage==='one'){
  const p=findPet(state.sampleId);status.textContent='已放入 1 / 2';title.textContent='再邀请一位伙伴';subtitle.textContent='第二份样本放入后，将自动开始繁衍';
  content.innerHTML=`<div class="sample-orb" draggable="${canEdit()}" data-drag="${esc(p.id)}" data-from-chamber="true">${petSVG(p)}</div>`;
  actions.innerHTML='<button class="small-button" data-action="remove">移除样本，重新选择</button>';
 }else if(stage==='committing'){
  status.textContent=pendingBirth?'准备新生命':'准备重组';title.textContent='正在准备重组';subtitle.textContent='保存本次结果后，开始拆解样本';content.innerHTML=`<div class="empty-symbol">${dna}</div>`;
 }else if(stage==='breeding'){
  status.textContent='正在重组';title.textContent='两个故事，交织成新的生命';subtitle.textContent='样本正在拆解…';
  const reduced=state.settings.reduced;
  const particles=Array.from({length:18},(_,i)=>{const from=task.trace.sources[Math.floor(i*63/18)],angle=i*2.39996,r=50+(i%4)*18;return `<i class="particle ${from?'from-b':''}" style="--sx:${from?75:-75}px;--x:${Math.cos(angle)*r}px;--y:${Math.sin(angle)*r}px;--delay:${(i%3)*.015}s"></i>`;}).join('');
  content.innerHTML=reduced?`<div class="empty-symbol">${dna}</div>`:`<div class="particle-field" aria-hidden="true">${particles}<div class="dna-core">${dna}</div><div class="birth-preview">${petSVG(findPet(task.childId),{label:false})}</div><span class="phase-text">拆解 · 重组 · 新生</span></div>`;
  actions.innerHTML='<button class="small-button" data-action="skip">跳过动画 →</button>';
 }else if(stage==='result'){
  const p=findPet(task.childId);status.textContent='新生命已诞生';title.textContent=`你好，${p.name}`;subtitle.textContent=`第 ${p.generation} 代 · 已经加入你的收藏`;
  content.innerHTML=`<div class="born-pet"><span class="new-life-badge">✦ 新的相遇</span>${petSVG(p)}</div>`;
  actions.innerHTML=`<button class="secondary-button" data-action="continue" data-id="${esc(p.id)}">以它继续繁衍 ↗</button><button class="small-button" data-action="complete">完成</button>`;
 }
}

function renderProgress() {
 const count=state.progress.births-(stage==='breeding'?1:0), generation=Math.max(0,...state.pets.filter(p=>stage!=='breeding'||p.id!==currentTask()?.childId).map(p=>p.generation));
 const flags=[count>0,state.progress.usedDescendant,generation>=3];
 $('#milestones').innerHTML=['首次繁衍','让后代成为亲本','延续至第三代'].map((t,i)=>`<li class="${flags[i]?'done':''}"><span class="milestone-dot">${flags[i]?'✓':i+1}</span>${t}</li>`).join('');
 $('#birth-count').textContent=`${Math.max(0,count)} 次新生`;
}
function renderSettings() {
 $('#sound-toggle').innerHTML=state.settings.sound?icons.sound:icons.mute;
 $('#sound-toggle').setAttribute('aria-label',state.settings.sound?'关闭声音':'开启声音');$('#sound-toggle').title=state.settings.sound?'关闭声音':'开启声音';
 $('#sound-toggle').disabled=!canEdit();$('#sound-setting').disabled=!canEdit();$('#motion-setting').disabled=!canEdit();
 $('#settings-open').innerHTML=icons.settings;$('#sound-setting').checked=state.settings.sound;$('#motion-setting').checked=state.settings.reduced;document.body.classList.toggle('reduce-motion',state.settings.reduced);
 $('#read-only-banner').hidden=writable||!ready;
}
function renderAll() { renderCollection();renderObserver();renderLab();renderProgress();renderSettings(); }

async function chooseSample(id) {
 assertWritable();if(activeBusy())throw new Error('正在繁衍，请稍候');
 if(stage==='result')throw new Error('请先点击「完成」，或选择「以它继续繁衍」');
 if(pendingBirth)throw new Error('请先重试保存当前结果');
 const pet=findPet(id);validatePet(pet);
 if(state.sampleId===id)throw new Error('这份样本已经在格子里，请选择另一只宠物');
 clearError();
 if(!state.sampleId){
  busy=true;renderAll();
  try {await persist(s=>{s.sampleId=id;return s;});stage='one';selectedId=id;playTone('sample');}
  finally {busy=false;renderAll();}
  return {status:'sample_placed',petId:id};
 }
 busy=true;stage='committing';secondId=id;renderAll();
 if(matchMedia('(max-width:700px)').matches)$('#workbench').scrollIntoView({behavior:'instant',block:'start'});
 try{
  const a=findPet(state.sampleId),seed=crypto.getRandomValues(new Uint32Array(1))[0],createdAt=Date.now(),idTask=crypto.randomUUID();
  const child=makeChild(a,pet,{id:crypto.randomUUID(),seed,createdAt});
  pendingBirth={pet:child.pet,task:{id:idTask,parentIds:[a.id,pet.id],parentSnapshots:[structuredClone(a),structuredClone(pet)],seed,ruleVersion:RULE_VERSION,childId:child.pet.id,childGenes:child.pet.genes,trace:child.trace,createdAt}};
  await commitPendingBirth();
 }catch(e){showError(e.message,!!pendingBirth);throw e;}
 finally{busy=false;renderAll();}
 return new Promise(resolve=>{resultResolver=resolve;if(stage==='result'){resolve({status:'born',petId:currentTask().childId});resultResolver=null;}});
}
async function commitPendingBirth(){
 const birth=pendingBirth;if(!birth)return;
 await persist(s=>{
  if(s.tasks[birth.task.id])return s;
  if(s.currentTaskId)throw new Error('还有一个出生结果尚未查看');
  for(const snap of birth.task.parentSnapshots){const stored=s.pets.find(p=>p.id===snap.id);validatePet(stored);if(stored.genes!==snap.genes)throw new Error('亲本样本已改变，请重新选择');}
  s.pets.push(birth.pet);s.tasks[birth.task.id]=birth.task;s.currentTaskId=birth.task.id;s.sampleId=null;
  s.progress.births++;s.progress.usedDescendant ||= birth.task.parentSnapshots.some(p=>p.generation>0);return s;
 });
 pendingBirth=null;clearError();stage='breeding';page=0;lastLabKey='';renderAll();playTone('start');
 animationTimers.forEach(clearTimeout);animationTimers=[];
 if(!state.settings.reduced){animationTimers.push(setTimeout(()=>{if(stage==='breeding')$('#stage-subtitle').textContent='片段交错，组成新的基因组合…';},1100));animationTimers.push(setTimeout(()=>{if(stage==='breeding')$('#stage-subtitle').textContent='一个新的小生命，正在成形…';},2150));}
 animationTimers.push(setTimeout(revealBirth,state.settings.reduced?180:3000));
}
async function retryBirth(){if(!pendingBirth||busy)return;busy=true;renderAll();try{await commitPendingBirth();}catch(e){showError(e.message,true);}finally{busy=false;renderAll();}}
function revealBirth(){
 if(stage!=='breeding')return;animationTimers.forEach(clearTimeout);animationTimers=[];stage='result';busy=false;selectedId=currentTask().childId;secondId=null;renderAll();playTone('birth');
 resultResolver?.({status:'born',petId:selectedId,name:findPet(selectedId).name});resultResolver=null;
}
async function clearChamber(nextId=null){
 assertWritable();if(activeBusy()||pendingBirth)throw new Error('请等待当前繁衍完成');
 if(nextId)validatePet(findPet(nextId));busy=true;renderAll();
 try {await persist(s=>{s.currentTaskId=null;s.sampleId=nextId;return s;});stage=nextId?'one':'empty';secondId=null;if(nextId)selectedId=nextId;}
 finally{busy=false;lastLabKey='';renderAll();}
}
async function removeSample(){if(stage==='one')await clearChamber();}
async function usePet(id){if(stage==='result')return clearChamber(id);if(state.sampleId===id){toast('样本已在格子里，再选择另一只宠物');return;}return chooseSample(id);}
async function favoritePet(id){assertWritable();if(activeBusy())return;await persist(s=>{const p=s.pets.find(p=>p.id===id);if(p)p.favorite=!p.favorite;return s;});renderCollection();}
async function setSetting(name,value){try{await persist(s=>{s.settings[name]=value;return s;});renderSettings();if(name==='sound'&&value)playTone('sample');if(name==='reduced'&&value&&stage==='breeding')revealBirth();}catch(e){toast(e.message);renderSettings();}}

document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
 const {action,id}=button.dataset;
 try {
  if(action==='view'){selectedId=id;renderCollection();renderObserver();}
  if(action==='sample')await chooseSample(id);
  if(action==='use')await usePet(id);
  if(action==='remove')await removeSample();
  if(action==='skip')revealBirth();
  if(action==='continue')await clearChamber(id);
  if(action==='complete')await clearChamber();
  if(action==='favorite')await favoritePet(id);
  if(action==='rename'){assertWritable();renameId=id;$('#pet-name').value=findPet(id).name;$('#rename-dialog').showModal();$('#pet-name').focus();$('#pet-name').select();}
 }catch(e){toast(e.message);}
});
document.addEventListener('dragstart',event=>{const el=event.target.closest('[data-drag]');if(!el)return;if(!canEdit()||activeBusy()){event.preventDefault();return;}event.dataTransfer.setData('text/plain',el.dataset.drag);event.dataTransfer.effectAllowed='copyMove';});
const zone=$('#drop-zone');
zone.addEventListener('dragover',e=>{e.preventDefault();if(canEdit()&&!activeBusy()){e.dataTransfer.dropEffect='copy';zone.classList.add('drag-over');}});
zone.addEventListener('dragleave',e=>{if(!zone.contains(e.relatedTarget))zone.classList.remove('drag-over');});
zone.addEventListener('drop',async e=>{e.preventDefault();zone.classList.remove('drag-over');const id=e.dataTransfer.getData('text/plain');try{await chooseSample(id);}catch(err){toast(err.message);}});
document.addEventListener('dragend',async e=>{zone.classList.remove('drag-over');const el=e.target.closest('[data-from-chamber]');if(!el||e.clientX<=0||stage!=='one')return;const r=zone.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom){try{await removeSample();}catch(err){toast(err.message);}}});
document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;page=0;document.querySelectorAll('[data-filter]').forEach(n=>n.classList.toggle('active',n===b));renderCollection();}));
$('#sort-order').addEventListener('change',e=>{sort=e.target.value;page=0;renderCollection();});
$('#prev-page').addEventListener('click',()=>{page--;renderCollection();});$('#next-page').addEventListener('click',()=>{page++;renderCollection();});
$('#nav-lab').addEventListener('click',()=>{$('#workbench').scrollIntoView({behavior:state.settings.reduced?'instant':'smooth',block:'center'});$('#drop-zone').focus({preventScroll:true});});
$('#nav-collection').addEventListener('click',()=>{$('#collection').scrollIntoView({behavior:state.settings.reduced?'instant':'smooth',block:'start'});$('#pet-grid .card-view')?.focus({preventScroll:true});});
$('#help-open').addEventListener('click',()=>$('#help-dialog').showModal());$('#settings-open').addEventListener('click',()=>$('#settings-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#sound-toggle').addEventListener('click',()=>setSetting('sound',!state.settings.sound));$('#sound-setting').addEventListener('change',e=>setSetting('sound',e.target.checked));$('#motion-setting').addEventListener('change',e=>setSetting('reduced',e.target.checked));
$('#pet-name').addEventListener('input',e=>e.target.setCustomValidity(''));
$('#rename-form').addEventListener('submit',async e=>{
 e.preventDefault();const name=$('#pet-name').value.trim();if(!name){$('#pet-name').setCustomValidity('请填写宠物名字');$('#pet-name').reportValidity();return;}
 const button=e.submitter;if(button)button.disabled=true;
 try{await persist(s=>{const p=s.pets.find(p=>p.id===renameId);if(!p)throw new Error('宠物不存在');p.name=name.slice(0,20);return s;});$('#rename-dialog').close();lastLabKey='';renderAll();toast('新的名字，已经记下了');}catch(err){toast(err.message);}finally{if(button)button.disabled=false;}
});

async function claimLock() {
 if(writable||lockPending)return;
 if(!navigator.locks){ready=true;showError('此浏览器不支持可靠的存档锁，请使用较新的 Chrome、Edge 或 Safari。当前仅可查看。');return;}
 lockPending=true;
 await new Promise(resolve=>{
  navigator.locks.request(LOCK_NAME,{mode:'exclusive',ifAvailable:true},async lock=>{
   writable=!!lock;lockPending=false;resolve();
   if(lock)await new Promise(done=>{releaseLock=done;});
  }).catch(e=>{lockPending=false;resolve();showError(e.message);});
 });
}
async function initialize(){
 try{
  storage=await openStorage();await claimLock();let saved=await storage.load();
  if(!saved&&writable)saved=await storage.update(s=>s,defaultState(matchMedia('(prefers-reduced-motion: reduce)').matches));
  if(saved)state=saved;
  ready=true;const task=currentTask();stage=task?'result':state.sampleId?'one':'empty';selectedId=task?.childId||state.sampleId||state.pets[0].id;
  $('#save-status').textContent=writable?'已保存到本地':'查看模式';renderAll();registerWebTools();
 }catch(e){ready=true;writable=false;showError(e.message||'暂时无法读取本地存档，请检查浏览器设置');renderAll();}
}
async function refreshReadOnly(){
 if(writable||!storage)return;
 try{await claimLock();const saved=await storage.load();if(saved)state=saved;else if(writable)state=await storage.update(s=>s,defaultState());
  const task=currentTask();stage=task?'result':state.sampleId?'one':'empty';if(!findPet(selectedId))selectedId=state.pets[0].id;lastLabKey='';$('#save-status').textContent=writable?'已保存到本地':'查看模式';renderAll();
 }catch(e){showError(e.message);}
}
channel?.addEventListener('message',()=>{if(!writable)refreshReadOnly();});
setInterval(()=>{if(ready&&!writable&&storage)refreshReadOnly();},2200);
window.addEventListener('pagehide',()=>{releaseLock?.();writable=false;channel?.close();storage?.close();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});

function registerWebTools(){
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const tools=[
  {name:'list_pets',title:'查看宠物收藏',description:'读取当前可见的宠物收藏、名字、代数与外观。不会返回隐藏基因。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:()=>({pets:state.pets.filter(p=>stage!=='breeding'||p.id!==currentTask()?.childId).map(p=>({id:p.id,name:p.name,generation:p.generation,traits:visibleTraits(p)})),stage,sampleId:state.sampleId})},
  {name:'place_gene_sample',title:'放入基因样本',description:'将指定宠物样本放入繁衍格。第二份不同个体样本会自动繁衍并保存一只新宠物；原宠物保留。与页面放入操作相同。',inputSchema:{type:'object',properties:{petId:{type:'string'}},required:['petId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:async input=>{if(!input||typeof input.petId!=='string'||Object.keys(input).some(k=>k!=='petId'))throw new Error('请提供有效宠物 ID');return chooseSample(input.petId);}}
 ];
 for(const tool of tools){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Optional browser capability. */}}
}
renderAll();initialize();
