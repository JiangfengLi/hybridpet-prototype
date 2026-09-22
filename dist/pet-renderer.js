import { phenotype, COLORS, SIZES } from './genes.js';
let serial = 0;
export const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SHAPES = [
 'M82 174Q68 120 104 106Q112 78 146 89Q175 76 196 112Q225 128 218 172Q216 218 150 219Q89 219 82 174Z',
 'M55 163Q50 130 91 129Q98 99 135 110Q153 95 177 115Q223 112 248 144Q265 180 232 193L86 198Q56 192 55 163Z',
 'M67 177Q61 113 112 102Q156 74 201 108Q244 126 236 178Q228 220 152 224Q83 228 67 177Z',
 'M87 188Q80 163 127 158L127 98Q103 90 121 67Q152 38 180 71Q192 95 164 107L166 155Q227 145 228 188Q231 215 156 222Q95 224 87 188Z',
 'M50 187Q45 157 85 150Q117 122 158 151Q223 140 250 176Q261 200 224 210L82 213Q49 209 50 187Z',
 'M108 196Q101 157 112 127Q97 102 124 79Q152 58 177 84Q198 105 183 128Q213 179 191 211Q156 235 123 214Z',
 'M95 190Q72 150 96 118Q111 86 148 96Q187 80 210 121Q230 153 207 193Q197 227 151 224Q107 228 95 190Z',
 'M77 181Q72 140 129 129Q121 109 145 85Q172 71 192 101Q205 123 182 141Q223 173 196 207Q158 238 108 215Z',
 'M92 190Q75 153 108 131Q106 98 139 88Q178 78 188 116Q221 131 210 175Q199 216 157 224Q117 224 92 190Z',
 'M99 189Q83 150 136 143L137 99Q114 86 131 65Q159 43 181 68Q193 90 168 106L171 145Q218 151 213 183Q208 223 160 226Q111 229 99 189Z',
 'M87 212Q55 192 79 174Q98 157 121 175Q161 208 178 182Q189 165 164 145Q135 130 140 101Q144 67 174 77Q206 88 192 119Q235 168 208 205Q166 249 128 210Q102 190 87 212Z',
 'M59 173Q47 140 82 128Q105 119 119 139Q131 115 155 128Q178 105 203 127Q240 118 249 153Q266 199 220 208L91 210Q59 210 59 173Z',
 'M64 153Q96 94 151 99Q213 99 241 148Q219 201 156 203Q99 205 64 153Z',
 'M46 163Q111 133 142 89Q155 80 166 100Q199 147 259 160Q201 172 172 211Q155 228 141 210Q109 178 46 163Z',
 'M49 187Q55 150 110 176Q156 193 175 162Q190 137 163 126Q135 112 151 89Q176 67 198 91Q232 135 206 178Q171 225 111 208Q73 197 49 187Z',
 'M113 210Q87 191 109 169Q81 145 114 124Q93 90 126 81Q159 67 185 94Q199 116 175 132Q206 155 183 173Q206 206 174 223Q134 238 113 210Z',
 'M100 212Q69 184 89 154Q103 132 127 140Q109 116 132 93Q160  seventy 181 102L192 116Q190 140 177 145Q211 151 219 180Q219 226 167 231Q121 236 100 212Z',
 'M63 173Q63 116 114 102Q150 84 193 107Q236 120 238 173L220 211Q151 239 83 211Z',
 'M103 199Q75 166 94 124Q111 89 155 94Q196 91 208 131Q231 174 198 203Q150 232 103 199Z',
 'M83 155A68 68 0 1 0 219 155A68 68 0 1 0 83 155Z',
 'M91 201Q58 176 89 145Q68 112 107 102Q132 77 157 100Q199  seventy 216 122Q243 140 217 165Q233 207 184 215Q141 239 119 212Z',
 'M150 83Q158 81 166 119L211 112Q232 110 211 141L235 176Q244 192 209 190L177 192L160 231Q152 247 142 220L126 192L81 193Q58 189 81 169L105 143L88 112Q82 98 108 109L137 121Z',
 'M131 158L121 218Q150 239 180 218L170 158Q220 164 238 144Q227 85 157 80Q85 79 65 143Q84 164 131 158Z',
 'M133 218L128 171Q80 178  seventy 136Q109 121 136 145L142 126Q113 104 127 76Q157 80 159 112Q181 78 210 94Q210 131 171 139L168 166Q205 140 227 164Q212 199 169 190L173 219Z',
 'M69 155Q seventy 89 144 81Q223 79 236 153Q217 183 191 157Q169 184 149 158Q123 187 101 158Q84 180 69 155Z'
].map(p=>p.replaceAll('seventy','70'));
export function petSVG(pet, { label = true } = {}) {
 const p = phenotype(pet.genes), id = `pet${++serial}`, body = COLORS[p.color], scale = .66 * SIZES[p.size];
 const gradients = [];
 const paint = (color, material, key) => {
   const gid=`${id}-${key}`, c=COLORS[color];
   gradients.push(`<linearGradient id="${gid}" x1="15%" x2="85%" y1="0%" y2="100%"><stop stop-color="${c}"/><stop offset=".5" stop-color="${c}"/><stop offset="1" stop-color="#172332" stop-opacity=".53"/></linearGradient>`);
   if(material===0) return `url(#${gid})`;
   const pattern = [ '', '<circle cx="3" cy="3" r="1" fill="#14222c" opacity=".18"/><circle cx="9" cy="8" r="1.4" fill="#fff" opacity=".2"/>', '<path d="M0 1Q6 12 12 1M-6 8Q0 19 6 8M6 8Q12 19 18 8" fill="none" stroke="#233843" stroke-opacity=".28"/>', '<path d="M2 0L10 12M9 0L2 10M4 4L9 3M5 8L1 7" fill="none" stroke="#fff" stroke-opacity=".3"/>', '<path d="M0 3L6 0L12 3L12 10L6 13L0 10Z" fill="none" stroke="#182b39" stroke-opacity=".38"/>', '<path d="M-6 16L10 0M1 18L17 2" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>' ][material];
   gradients.push(`<pattern id="${gid}-t" width="12" height="14" patternUnits="userSpaceOnUse"><rect width="12" height="14" fill="${c}"/>${pattern}</pattern>`);
   return `url(#${gid}-t)`;
 };
 const fill=paint(p.color,p.material,'body');
 const part=(n,path,extra='')=>{const a=p.parts[n];return a.present?`<path d="${path}" fill="${paint(a.color,a.material,`part${n}`)}" stroke="#23313e" stroke-opacity=".28" stroke-width="2.5" stroke-linejoin="round" ${extra}/>`:'';};
 const rear = [
 part(7,'M204 183Q268 161 252 124Q281 152 257 197Q238 220 206 203Z'),
 part(6,'M98 151Q42 80 39 130Q25 141 45 157Q31 180 62 180L97 188M203 151Q257 80 260 130Q275 141 255 157Q269 180 240 180L204 188'),
 part(8,'M130 101L149 62L165 97L189 77L197 117Z'),
 part(9,p.bone===15||p.bone===16?'M110 146L64 126L49 140L96 162M110 173L57 170L42 187L100 190M187 147L239 126L252 141L205 164M190 177L244 174L259 191L202 196M109 203L85 227L94 238L131 215M188 204L215 228L205 239L167 216':'M105 187Q82 221 103 231L123 231L133 192M177 190L184 230L204 230Q222 216 197 185'),
 part(3, p.bone===0?'M104 120Q65 63 96 57Q122 66 127 114M179 114Q188 60 212 60Q239 72 207 129':'M108 124Q76 75 102 78Q127 82 132 111M177 111Q184 78 213 79Q235 88 199 130'),
 part(4,'M117 111Q109 92 121 64Q129 86 143 104M163 103Q180 88 181 63Q199 99 183 116')
 ].join('');
 const front = [
 part(5,'M106 111L102 91L120 100L128 80L142 94L154 78L167 96L185 89L188 115Q149 133 106 111Z'),
 p.parts[0].present?`<g fill="${paint(p.parts[0].color,p.parts[0].material,'eyes')}"><ellipse cx="128" cy="151" rx="10" ry="14"/><ellipse cx="176" cy="151" rx="10" ry="14"/><ellipse cx="130" cy="153" rx="4" ry="7" fill="#142334"/><ellipse cx="174" cy="153" rx="4" ry="7" fill="#142334"/><circle cx="126" cy="147" r="3" fill="#fff"/><circle cx="172" cy="147" r="3" fill="#fff"/></g>`:'',
 part(2,'M144 163Q151 158 159 163Q155 172 151 171Q145 170 144 163Z'),
 part(1,'M140 180Q152 190 165 179Q159 198 151 196Q143 193 140 180Z'),
 part(10,'M102 216L97 231L105 227L110 234L114 221M188 221L191 235L198 228L204 232L199 214'),
 p.parts[11].present?`<g><circle cx="151" cy="203" r="21" fill="${COLORS[p.parts[11].color]}" opacity=".2"/><circle cx="151" cy="203" r="10" fill="${paint(p.parts[11].color,p.parts[11].material,'glow')}" stroke="#fff" stroke-opacity=".8"/><circle cx="148" cy="200" r="3" fill="#fff" opacity=".7"/></g>`:''
 ].join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" class="pet-svg" ${label?`role="img" aria-label="${escapeHTML(pet.name)}"`:'aria-hidden="true"'}><defs>${gradients.join('')}<radialGradient id="${id}-shade"><stop stop-color="#000" stop-opacity=".22"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs><ellipse cx="151" cy="258" rx="${70*scale}" ry="14" fill="url(#${id}-shade)"/><g transform="translate(150 235) scale(${scale}) translate(-150 -235)">${rear}<path d="${SHAPES[p.bone]}" fill="${fill}" stroke="${body}" stroke-width="3"/><path d="M110 129Q125 107 150 108" fill="none" stroke="#fff" stroke-opacity=".17" stroke-width="9" stroke-linecap="round"/>${front}</g></svg>`;
}
