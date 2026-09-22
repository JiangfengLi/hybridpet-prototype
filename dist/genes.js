export const VERSION = 'gene-63-v1';
export const RULE_VERSION = 'breed-mulberry32-v1';
export const RENDER_VERSION = 'pet-svg-v1';
export const COLORS = ['#f18c90', '#f5b36f', '#eddb86', '#8cd3b0', '#85d8df', '#8cb5ed', '#baa1ee', '#737f99'];
export const COLOR_NAMES = ['红色', '橙色', '黄色', '绿色', '青色', '蓝色', '紫色', '黑色'];
export const MATERIAL_NAMES = ['光滑', '粗糙', '鳞片', '羽毛', '甲壳', '金属'];
export const SIZES = [.6, .75, .9, 1, 1.15, 1.3, 1.5, 1.75];
export const BONE_NAMES = ['圆躯四足型','修长四足型','厚重四足型','长颈四足型','低伏四足型','修长双足型','圆躯双足型','跳跃双足型','短颈鸟型','长颈鸟型','蛇型','蠕虫型','鱼型','扁平鱼型','鳗型','昆虫型','蛛型','甲壳型','软体多触手型','球形','团块型','星形','菌伞型','植物型','水母型'];
export const PARTS = ['眼','口','鼻','耳','角冠','毛发','翼','尾','背脊／鳍','四肢','爪','发光器官'];
const ABILITY_NAMES = ['陆地移动速度','游泳能力','飞行能力','攀爬能力','攻击','防御','特殊攻击','特殊防御','速度（先手）','体力','回复','攻击属性','抗性属性','感知范围','夜视','温度耐受','负重','后代数量','好感度成长速率','工作适性','攻击性','驯服难度','食性'];
const alphabet = n => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, n);
export const LOCI = [
  ...['骨骼','体型','主体色','主体质感'].map((name, i) => ({ position: i + 1, name, alleles: alphabet([25,8,8,6][i]), section: 'appearance' })),
  ...PARTS.flatMap((part, p) => ['有无','颜色','质感'].map((type, j) => ({ position: 5 + p * 3 + j, name: `${part}·${type}`, alleles: alphabet([2,8,6][j]), section: 'appearance', gate: j ? 5 + p * 3 : null }))),
  ...ABILITY_NAMES.map((name, i) => ({ position: i + 41, name, alleles: alphabet([11,12,19].includes(i) ? 8 : 5), section: i < 20 ? 'ability' : 'personality' }))
];
export const alleleIndex = char => char.charCodeAt(0) - 65;
export function validateGenes(genes) {
  if (typeof genes !== 'string' || genes.length !== 63) throw new Error('基因样本长度不正确');
  for (const locus of LOCI) if (!locus.alleles.includes(genes[locus.position - 1])) throw new Error('基因样本包含无效内容');
  return true;
}
export function validatePet(pet) {
  if (!pet || typeof pet.id !== 'string' || !pet.id || pet.schemaVersion !== VERSION || pet.renderVersion !== RENDER_VERSION) throw new Error('这份样本的版本暂不受支持');
  if (!Number.isSafeInteger(pet.generation) || pet.generation < 0) throw new Error('宠物代数不正确');
  validateGenes(pet.genes);
  return true;
}
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function recombine(a, b, seed, { mutationRate = .01, random } = {}) {
  validatePet(a); validatePet(b);
  if (a.id === b.id) throw new Error('请选择另一只宠物');
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('随机种子不正确');
  if (!(mutationRate >= 0 && mutationRate <= 1)) throw new Error('突变概率不正确');
  const rng = random || seededRandom(seed);
  const draw = () => { const n = rng(); if (!(n >= 0 && n < 1)) throw new Error('随机数超出范围'); return n; };
  const sources = LOCI.map(() => draw() < .5 ? 0 : 1);
  const inherited = sources.map((p,i) => (p ? b : a).genes[i]);
  const child = [...inherited];
  const triggered = [], changed = [];
  LOCI.forEach((locus,i) => {
    if (draw() < mutationRate) { triggered.push(i + 1); child[i] = locus.alleles[Math.floor(draw() * locus.alleles.length)]; if (child[i] !== inherited[i]) changed.push(i + 1); }
  });
  return { genes: child.join(''), sources, triggered, changed };
}
export function phenotype(genes) {
  validateGenes(genes);
  return { bone: alleleIndex(genes[0]), size: alleleIndex(genes[1]), color: alleleIndex(genes[2]), material: alleleIndex(genes[3]), parts: PARTS.map((name,i) => {
    const gate = 4 + i * 3, present = genes[gate] === 'B';
    return { name, present, color: present ? alleleIndex(genes[gate+1]) : null, material: present ? alleleIndex(genes[gate+2]) : null };
  }) };
}
export function visibleTraits(pet) {
  const p = phenotype(pet.genes);
  const special = [4,6,11,7,3,5,8].find(i => p.parts[i].present);
  return [COLOR_NAMES[p.color] + '身体', MATERIAL_NAMES[p.material] + '质感', special === undefined ? BONE_NAMES[p.bone] : '长着' + PARTS[special]];
}
export function makeChild(a,b,{ id, seed, createdAt }) {
  const result = recombine(a,b,seed);
  const p = phenotype(result.genes);
  const nicknames = ['团子','啵啵','糯糯','小满','布丁','泡芙','栗子','云朵'];
  const name = ['绯','橘','金','青','晴','蓝','紫','墨'][p.color] + nicknames[seed % nicknames.length];
  return { pet: { id, name, genes: result.genes, schemaVersion: VERSION, renderVersion: RENDER_VERSION, parentIds: [a.id,b.id], generation: Math.max(a.generation,b.generation)+1, createdAt, favorite: false }, trace: result };
}
export function starterPets() {
  const recipes = [
    { name:'青柠团子', bone:0, size:3, color:3, material:0, parts:[0,1,2,3,5,7,9] },
    { name:'紫芋啵啵', bone:6, size:3, color:6, material:0, parts:[0,1,3,4,7,9,11] },
    { name:'蜜桃泡芙', bone:19, size:4, color:0, material:3, parts:[0,1,3,5,6,9] },
    { name:'晴空小鱼', bone:12, size:3, color:5, material:2, parts:[0,1,7,8] },
    { name:'橘子年糕', bone:2, size:4, color:1, material:1, parts:[0,1,2,3,7,9,10] },
    { name:'星星布丁', bone:21, size:3, color:2, material:5, parts:[0,1,11] }
  ];
  return recipes.map((r,n) => {
    const rng = seededRandom(200+n), g = LOCI.map(l=>l.alleles[Math.floor(rng()*l.alleles.length)]);
    [r.bone,r.size,r.color,r.material].forEach((x,i)=>g[i]=alphabet(26)[x]);
    PARTS.forEach((_,i)=>{ g[4+i*3]=r.parts.includes(i)?'B':'A'; g[5+i*3]=alphabet(26)[[0,1,2].includes(i)?7:r.color]; g[6+i*3]='A'; });
    return { id:`origin-${n+1}`, name:r.name, genes:g.join(''), schemaVersion:VERSION, renderVersion:RENDER_VERSION, parentIds:[], generation:0, createdAt:1700000000000+n, favorite:false };
  });
}
