import test from 'node:test';
import assert from 'node:assert/strict';
import { LOCI, VERSION, RENDER_VERSION, starterPets, validateGenes, recombine, phenotype, makeChild, seededRandom } from '../dist/genes.js';
import { petSVG } from '../dist/pet-renderer.js';
import { defaultState, validateState } from '../dist/storage.js';
const [a,b]=starterPets();
test('配置覆盖 63 位，40 外表、20 能力、3 性格，范围与设计一致',()=>{
 assert.equal(LOCI.length,63);assert.equal(LOCI.filter(l=>l.section==='appearance').length,40);assert.equal(LOCI.filter(l=>l.section==='ability').length,20);assert.equal(LOCI.filter(l=>l.section==='personality').length,3);
 assert.deepEqual(LOCI.map(l=>l.position),Array.from({length:63},(_,i)=>i+1));
 assert.equal(LOCI[0].alleles,'ABCDEFGHIJKLMNOPQRSTUVWXY');assert.equal(LOCI[57].alleles,'ABCDE');
 for(const p of starterPets()){assert.equal(p.genes.length,63);assert.ok(validateGenes(p.genes));}
});
test('无突变时逐位继承，种子可复现，不跨位点',()=>{
 for(let seed=0;seed<250;seed++){
  const child=recombine(a,b,seed,{mutationRate:0});
  assert.equal(child.genes.length,63);child.genes.split('').forEach((v,i)=>assert.ok(v===a.genes[i]||v===b.genes[i]));
  assert.deepEqual(child,recombine(a,b,seed,{mutationRate:0}));
 }
});
test('不同个体同基因可繁衍；同 ID、错误长度、越界字母、版本错误被拒绝',()=>{
 const copy={...a,id:'a-copy'};assert.equal(recombine(a,copy,3,{mutationRate:0}).genes,a.genes);
 assert.throws(()=>recombine(a,a,1));assert.throws(()=>validateGenes('A'.repeat(62)));assert.throws(()=>validateGenes(a.genes.slice(0,4)+'Z'+a.genes.slice(5)));
 assert.throws(()=>recombine({...a,schemaVersion:'gene-100'},b,1));
});
test('突变使用当前位点完整字母表，允许抽回原字母',()=>{
 const allA={...a,genes:'A'.repeat(63)}, other={...b,genes:'A'.repeat(63)};
 const same=recombine(allA,other,0,{mutationRate:1,random:()=>0});
 assert.equal(same.triggered.length,63);assert.equal(same.changed.length,0);assert.equal(same.genes,allA.genes);
 const last=recombine(allA,other,0,{mutationRate:1,random:()=>.999999});
 assert.equal(last.genes,LOCI.map(l=>l.alleles.at(-1)).join(''));assert.equal(last.changed.length,63);
});
test('门控不清除隐藏字母，不影响能力层；12 条门控全覆盖',()=>{
 for(let part=0;part<12;part++){
  const g=a.genes.split(''),gate=4+part*3;g[gate]='A';g[gate+1]='G';g[gate+2]='F';
  assert.deepEqual(phenotype(g.join('')).parts[part],{name:phenotype(a.genes).parts[part].name,present:false,color:null,material:null});
  const parent={...a,genes:g.join('')}, copy={...b,genes:g.join('')};
  assert.equal(recombine(parent,copy,3,{mutationRate:0}).genes[gate+1],'G');
  g[gate]='B';assert.equal(phenotype(g.join('')).parts[part].color,6);assert.equal(phenotype(g.join('')).parts[part].material,5);
 }
});
test('5000 次繁衍的触发数接近 63 × 1%，不是全胎 1%',()=>{
 let sum=0,changed=0;for(let i=0;i<5000;i++){const r=recombine(a,b,i);sum+=r.triggered.length;changed+=r.changed.length;validateGenes(r.genes);}
 assert.ok(sum/5000>.58&&sum/5000<.68,`mean ${sum/5000}`);assert.ok(changed<sum);
});
test('三个连续世代正确，ID 独立，双亲不变',()=>{
 const before=JSON.stringify([a,b]);let p=a;
 for(let g=1;g<=3;g++){const {pet}=makeChild(p,b,{id:`child-${g}`,seed:g,createdAt:g});assert.equal(pet.generation,g);assert.deepEqual(pet.parentIds,[p.id,b.id]);assert.equal(pet.schemaVersion,VERSION);assert.equal(pet.renderVersion,RENDER_VERSION);p=pet;}
 assert.equal(JSON.stringify([a,b]),before);
});
test('25 个骨骼、8 种体型和6种材质可以绘制，不暴露基因串',()=>{
 const outlines=new Set();
 for(let i=0;i<25;i++){const p={...a,name:'<pet & friend>',genes:String.fromCharCode(65+i)+a.genes.slice(1)};const svg=petSVG(p);assert.ok(svg.includes('&lt;pet &amp; friend&gt;'));assert.ok(!svg.includes(p.genes));const path=svg.match(/<path d="([^"]+)" fill="url\(#pet\d+-body/);assert.ok(path);outlines.add(path[1]);}
 assert.equal(outlines.size,25);
 for(let size=0;size<8;size++)for(let material=0;material<6;material++){const g=a.genes.split('');g[1]=String.fromCharCode(65+size);g[3]=String.fromCharCode(65+material);assert.ok(petSVG({...a,genes:g.join('')}).includes('</svg>'));}
});
test('默认存档合法，重复宠物或断裂的当前任务拒绝加载',()=>{
 const s=defaultState();assert.equal(validateState(s).pets.length,6);
 assert.throws(()=>validateState({...s,pets:[...s.pets,s.pets[0]]}));
 assert.throws(()=>validateState({...s,currentTaskId:'missing'}));
});
