import { starterPets, validatePet } from './genes.js';
const DB_NAME = 'evo-pet-laboratory-v1';
export const LOCK_NAME = 'evo-pet-save-writer-v1';
export const CHANNEL_NAME = 'evo-pet-save-changes-v1';
export function defaultState(reduced = false) {
  return { version: 1, pets: starterPets(), tasks: {}, currentTaskId: null, sampleId: null, settings: { sound: false, reduced }, progress: { births: 0, usedDescendant: false } };
}
export function validateState(state) {
  if (state?.version !== 1 || !Array.isArray(state.pets) || !state.tasks || !state.settings || !state.progress) throw new Error('这个存档的格式暂不受支持，请保留浏览器数据');
  const ids = new Set();
  state.pets.forEach(p => { validatePet(p); if (ids.has(p.id)) throw new Error('存档包含重复宠物'); ids.add(p.id); });
  if (state.sampleId && !ids.has(state.sampleId)) throw new Error('存档中的样本来源不存在');
  if (state.currentTaskId && (!state.tasks[state.currentTaskId] || !ids.has(state.tasks[state.currentTaskId].childId))) throw new Error('正在进行的繁衍记录不完整');
  return state;
}
export async function openStorage() {
  if (!globalThis.indexedDB) throw new Error('浏览器暂时无法保存宠物，请使用支持本地存储的浏览器');
  const db = await new Promise((resolve,reject) => {
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded = () => req.result.createObjectStore('documents');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('无法打开本地存档，请检查浏览器的存储权限'));
    req.onblocked = () => reject(new Error('请关闭旧的实验室页面，再重新打开'));
  });
  db.onversionchange = () => db.close();
  return {
    load() { return new Promise((resolve,reject) => { const tx=db.transaction('documents','readonly'), req=tx.objectStore('documents').get('save'); req.onsuccess=()=>{try{resolve(req.result ? validateState(req.result) : null);}catch(e){reject(e);}}; req.onerror=()=>reject(req.error); }); },
    update(mutator,initial) {
      return new Promise((resolve,reject) => {
        const tx=db.transaction('documents','readwrite'), objectStore=tx.objectStore('documents');
        let result, caught;
        const req=objectStore.get('save');
        req.onsuccess=()=>{ try { const draft=req.result || initial; if(!draft) throw new Error('没有可用存档'); result=mutator(structuredClone(validateState(draft))); validateState(result); objectStore.put(result,'save'); } catch(e) { caught=e;tx.abort(); } };
        tx.oncomplete=()=>resolve(result);
        tx.onabort=()=>reject(caught || new Error('保存失败，请检查浏览器的可用空间后重试'));
        tx.onerror=()=>{ caught ||= new Error('保存失败，请检查浏览器的可用空间后重试'); };
      });
    },
    close() { db.close(); }
  };
}
