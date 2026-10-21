/* Export prototype geometry as editable SVG text, shapes and content images.
 * Requires Playwright only for tooling; the prototype itself has no build dependencies.
 * Usage: node design/export-design.cjs
 */
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.GEKI_PLAYWRIGHT_PATH||'C:/Users/HP/AppData/Local/Temp/geki-design-tools/node_modules/playwright');
const out=path.join(__dirname,'figma-import');
const previews=path.join(__dirname,'previews');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function renderSvg(assetMap){
 const defs=[],used=[],symbols=new Set();let serial=0;
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 const r=n=>Math.round(n*100)/100;
 const transparent=c=>!c||c==='transparent'||c==='rgba(0, 0, 0, 0)';
 function gradient(bg){
  if(!bg||bg==='none')return null;
  const colors=[...bg.matchAll(/rgba?\([^)]*\)/g)].map(m=>m[0]);if(colors.length<2)return null;
  const id='grad'+(++serial);const horizontal=/90deg|to right/.test(bg);const offsets=colors.map((c,i)=>i/(colors.length-1));
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${horizontal?'1':'0'}" y2="${horizontal?'0':'1'}">${colors.map((c,i)=>`<stop offset="${offsets[i]}" stop-color="${c}"/>`).join('')}</linearGradient>`);return `url(#${id})`;
 }
 function rect(box,c,rad=0,stroke='',sw=0){if(box.width<=0||box.height<=0)return '';return `<rect x="${r(box.x)}" y="${r(box.y)}" width="${r(box.width)}" height="${r(box.height)}" rx="${r(rad)}" fill="${c||'none'}"${stroke?` stroke="${stroke}" stroke-width="${r(sw)}"`:''}/>`}
 function text(str,box,style){if(!str?.trim())return '';return `<text x="${r(box.x)}" y="${r(box.y+parseFloat(style.fontSize)*.83)}" font-family="${esc(style.fontFamily.split(',')[0].replace(/["']/g,''))}, Arial, sans-serif" font-size="${style.fontSize}" font-weight="${style.fontWeight}" fill="${style.color}"${style.letterSpacing!=='normal'?` letter-spacing="${style.letterSpacing}"`:''}>${esc(str)}</text>`}
 function rawText(node,style){
  if(!node.textContent.trim())return '';const pieces=[];const src=node.textContent;let line='',lineBox=null,lastY=null;
  for(const m of src.matchAll(/\S+\s*/g)){const range=document.createRange();range.setStart(node,m.index);range.setEnd(node,m.index+m[0].length);const box=range.getBoundingClientRect();if(!box.width)continue;if(lastY!==null&&Math.abs(box.y-lastY)>3){pieces.push(text(line,lineBox,style));line='';lineBox=null}if(!lineBox)lineBox=box;line+=m[0];lastY=box.y;}
  if(lineBox)pieces.push(text(line,lineBox,style));return pieces.join('');
 }
 function img(el,b){const key=new URL(el.currentSrc||el.src).pathname.split('/').pop();const asset=assetMap[key];if(!asset)return '';symbols.add(key);const id='img-'+key.replace(/\W/g,'-');const clip='clip'+(++serial);const st=getComputedStyle(el);const rad=parseFloat(st.borderRadius)||0;defs.push(`<clipPath id="${clip}">${rect(b,'white',rad)}</clipPath>`);const natW=el.naturalWidth,natH=el.naturalHeight;const scale=Math.max(b.width/natW,b.height/natH);const iw=natW*scale,ih=natH*scale;let pos=st.objectPosition.split(' ').map(parseFloat);if(!Number.isFinite(pos[0]))pos=[50,50];const x=b.x-(iw-b.width)*pos[0]/100,y=b.y-(ih-b.height)*(pos[1]||50)/100;let result=`<g clip-path="url(#${clip})"><use href="#${id}" transform="translate(${r(x)} ${r(y)}) scale(${r(iw)} ${r(ih)})"/></g>`;
  const brightness=/brightness\(([^)]+)\)/.exec(st.filter);if(brightness&&Number(brightness[1])<1)result+=rect(b,`rgba(0,0,0,${1-Number(brightness[1])})`,rad);return result;
 }
 function pseudo(el,type,b){const s=getComputedStyle(el,type);if(s.content==='none'||s.display==='none')return '';if(type==='::before'&&el.classList.contains('eyebrow'))return rect({x:b.x,y:b.y+b.height/2-2.5,width:5,height:5},'#d71920');return '';}
 function walk(el){if(!(el instanceof Element))return '';const s=getComputedStyle(el);const b=el.getBoundingClientRect();if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity)===0||b.width<=0||b.height<=0||['SCRIPT','STYLE','DIALOG'].includes(el.tagName)||el.closest('.review-launch')||el.id==='toast')return '';
  let body='';const rad=parseFloat(s.borderTopLeftRadius)||0;const bg=gradient(s.backgroundImage)||(!transparent(s.backgroundColor)?s.backgroundColor:null);if(bg)body+=rect(b,bg,rad);
  if(parseFloat(s.borderTopWidth)>0&&!transparent(s.borderTopColor)){
   if(parseFloat(s.borderBottomWidth)>0&&parseFloat(s.borderLeftWidth)>0&&parseFloat(s.borderRightWidth)>0)body+=rect(b,'none',rad,s.borderTopColor,parseFloat(s.borderTopWidth));
   else{for(const side of ['Top','Bottom','Left','Right']){let w=parseFloat(s['border'+side+'Width']);if(w&&s['border'+side+'Style']!=='none'){const x1=side==='Right'?b.right:b.x,y1=side==='Bottom'?b.bottom:b.y,x2=['Left','Right'].includes(side)?x1:b.right,y2=['Top','Bottom'].includes(side)?y1:b.bottom;body+=`<line x1="${r(x1)}" y1="${r(y1)}" x2="${r(x2)}" y2="${r(y2)}" stroke="${s['border'+side+'Color']}" stroke-width="${w}"/>`}}}
  }
  if(el.tagName==='IMG')body+=img(el,b);
  else if(el.tagName.toLowerCase()==='svg'){let svg=el.outerHTML.replace(/class="[^"]*"/g,'').replace(/currentColor/g,s.color);svg=svg.replace('<svg ',`<svg x="${r(b.x)}" y="${r(b.y)}" width="${r(b.width)}" height="${r(b.height)}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="${s.strokeWidth}" `);body+=svg;}
  else if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)){
   if(el.type==='file')body+=text('Choose video file',{x:b.x+15,y:b.y+b.height/2-7},s);
   else if(el.type==='radio'){body+=`<circle cx="${r(b.x+b.width/2)}" cy="${r(b.y+b.height/2)}" r="6" fill="${el.checked?'#d71920':'#222'}" stroke="#777"/>`;}
   else{let value=el.tagName==='SELECT'?el.options[el.selectedIndex]?.text:el.type==='password'?'••••••••':el.value||el.placeholder;const ts={fontSize:s.fontSize,fontWeight:s.fontWeight,color:el.value?s.color:'#929292',fontFamily:s.fontFamily,letterSpacing:s.letterSpacing};const lines=value.match(/.{1,55}(?:\s|$)|.{1,55}/g)||[value];body+=lines.slice(0,el.tagName==='TEXTAREA'?3:1).map((v,i)=>text(v,{x:b.x+parseFloat(s.paddingLeft),y:b.y+parseFloat(s.paddingTop)+i*parseFloat(s.fontSize)*1.6},ts)).join('');}
  }else{
   body+=pseudo(el,'::before',b);
   const photoParent=['hero','banner','continue-card','video-box','card-image'].some(c=>el.classList.contains(c));
   for(const n of el.childNodes){if(n.nodeType===Node.TEXT_NODE)body+=rawText(n,s);else if(n instanceof Element){body+=walk(n);if(photoParent&&n.tagName==='IMG'){let overlay=el.classList.contains('hero')?'linear-gradient(90deg,rgba(10,10,10,0.95),rgba(10,10,10,0.5),rgba(10,10,10,0.05))':el.classList.contains('banner')?'linear-gradient(90deg,rgba(10,10,10,1),rgba(10,10,10,0))':'linear-gradient(0deg,rgba(10,10,10,0.85),rgba(10,10,10,0))';body+=rect(b,gradient(overlay),rad);}}}
  }
  if(el.classList.contains('ring')){const cx=b.x+b.width/2,cy=b.y+b.height/2,rr=b.width/2-2.5;body+=`<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rr)}" fill="none" stroke="#d71920" stroke-width="5" stroke-dasharray="${rr*2*Math.PI*.35} ${rr*2*Math.PI*.65}" transform="rotate(-90 ${cx} ${cy})"/>`;}
  if(s.opacity!=='1')body=`<g opacity="${s.opacity}">${body}</g>`;return `<g id="${esc(el.id||el.getAttribute('aria-label')||el.className||el.tagName).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,70)}">${body}</g>`;
 }
 const width=innerWidth,height=document.querySelector('#app').getBoundingClientRect().height;
 const body=walk(document.querySelector('#app'));
 return {width,height,body,defs:defs.join(''),assets:[...symbols]};
}
async function main(){
 fs.mkdirSync(out,{recursive:true});fs.mkdirSync(previews,{recursive:true});
 const b=await chromium.launch({channel:'chrome',headless:true});const p=await b.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:4173');await p.evaluate(()=>document.fonts.ready);
 const routes=await p.evaluate(()=>window.GEKI_DESIGN.routes);const assets={};
 for(const name of ['hero.jpg','kumite.jpg','dojo.png']){const buf=fs.readFileSync(path.join(__dirname,'assets',name));assets[name]=`data:image/${name.endsWith('.png')?'png':'jpeg'};base64,${buf.toString('base64')}`;}
 // Desaturate actual content photos once, preserving them as editable image fills in SVG exports.
 for(const name of Object.keys(assets)){assets[name]=await p.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');const scale=Math.min(1,1400/img.naturalWidth);c.width=img.naturalWidth*scale;c.height=img.naturalHeight*scale;const x=c.getContext('2d');x.filter='grayscale(1)';x.drawImage(img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.78)},assets[name]);}
 const manifest=[];const overflow=[];
 for(const width of [1440,1280,768,390]){
  await p.setViewportSize({width,height:1000});const frames=[];
  for(let i=0;i<routes.length;i++){
   const [route,title]=routes[i];await p.goto('http://127.0.0.1:4173/#/'+route);await p.evaluate(()=>{document.body.classList.add('export-mode');document.querySelectorAll('.scroll-reveal').forEach(n=>n.classList.add('visible'))});await p.evaluate(()=>Promise.all([...document.images].map(im=>im.decode().catch(()=>{}))));await p.evaluate(()=>document.fonts.ready);
   const info=await p.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth,broken:[...document.images].filter(im=>!im.naturalWidth).map(im=>im.src)}));if(info.doc>width+2||info.broken.length)overflow.push({width,route,...info});
   const frame=await p.evaluate(renderSvg,assets);frame.title=title;frame.route=route;frames.push(frame);
   if(width===1440&&['','lesson','admin/subtitles','system','components','dashboard'].includes(route)||width===390&&['','lesson','dashboard','admin/subtitles','quiz'].includes(route)||width===768&&route==='library'){
    const file=`${route.replace(/\//g,'-')||'home'}-${width}.png`;await p.screenshot({path:path.join(previews,file),fullPage:true});
   }
  }
  // Each sheet is intentionally bounded to eight artboards for reliable Figma import.
  for(let start=0;start<frames.length;start+=8){
   const subset=frames.slice(start,start+8),cols=width<=768?4:2,gap=90,pad=70,placements=[];let y=120;
   for(let row=0;row<Math.ceil(subset.length/cols);row++){let rowHeight=0;for(let col=0;col<cols;col++){const f=subset[row*cols+col];if(!f)continue;placements.push({f,x:pad+col*(width+gap),y});rowHeight=Math.max(rowHeight,f.height+96)}y+=rowHeight+gap;}
   const sheetWidth=pad*2+Math.min(cols,subset.length)*width+(Math.min(cols,subset.length)-1)*gap;
   let defs=Object.entries(assets).map(([name,data])=>`<image id="img-${name.replace(/\W/g,'-')}" width="1" height="1" preserveAspectRatio="none" href="${data}"/>`).join('');
   let body='';for(let j=0;j<placements.length;j++){const {f,x,y}=placements[j];const prefix=`f${j}-`;const rename=s=>s.replace(/(id=")([^\"]+)(")/g,(_,a,id,c)=>a+prefix+id+c).replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#${prefix}${id})`);defs+=rename(f.defs);body+=`<g id="${escape(f.title.replace(/\W/g,'-'))}-${width}" transform="translate(${x} ${y})"><text x="0" y="-24" font-family="Arial" font-size="16" fill="#bbb">${escape(f.title)} · ${width}px</text><rect x="0" y="0" width="${width}" height="${f.height+34}" rx="12" fill="#0a0a0a" stroke="#444"/><rect width="${width}" height="34" rx="8" fill="#1b1b1b"/><circle cx="15" cy="17" r="3" fill="#666"/><circle cx="27" cy="17" r="3" fill="#555"/><circle cx="39" cy="17" r="3" fill="#444"/><text x="${width/2}" y="21" text-anchor="middle" fill="#929292" font-family="Arial" font-size="9">geki.academy / ${escape(f.route||'home')}</text><g transform="translate(0 34)">${rename(f.body)}</g></g>`;}
   const sheet=`GEKI-${width}-${String(start/8+1).padStart(2,'0')}.svg`;const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${Math.ceil(y)}" viewBox="0 0 ${sheetWidth} ${Math.ceil(y)}"><title>GEKI Academy — Editable ${width}px screen sheet ${start/8+1}</title><defs>${defs}</defs><rect width="100%" height="100%" fill="#252525"/><text x="70" y="60" fill="#eee" font-family="Arial" font-size="24">GEKI ACADEMY / ${width}px / ${start+1}–${start+subset.length}</text>${body}</svg>`;fs.writeFileSync(path.join(out,sheet),svg);manifest.push({file:sheet,width,screens:subset.map(f=>({route:f.route,title:f.title,height:f.height})),bytes:Buffer.byteLength(svg)});
  }
  console.log(`Exported ${routes.length} screens at ${width}px`);
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({created:'2026-10-19',fileKey:'s44SOnDJib43TUdtvoBGGP',screensPerWidth:routes.length,widths:[1440,1280,768,390],manifest,overflow,errors},null,2));
 // Consolidated final presentation: one named board per breakpoint, with shared image assets.
 for(const width of [1440,1280,768,390]){
  const sheets=manifest.filter(m=>m.width===width);let x=0,maxHeight=0;const content=[];
  for(let i=0;i<sheets.length;i++){
   const source=fs.readFileSync(path.join(out,sheets[i].file),'utf8');const size=/width="(\d+)" height="(\d+)"/.exec(source);const sw=Number(size[1]),sh=Number(size[2]);let inner=source.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'');
   if(i>0)inner=inner.replace(/<image id="img-[\s\S]*?\/>/g,'');
   inner=inner.replace(/id="(?!img-)([^\"]+)"/g,(_,id)=>`id="s${i}-${id}"`).replace(/url\(#([^)]*)\)/g,(_,id)=>`url(#s${i}-${id})`);
   content.push(`<g id="Sheet-${i+1}" transform="translate(${x} 100)">${inner}</g>`);x+=sw+100;maxHeight=Math.max(maxHeight,sh+150);
  }
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${x}" height="${maxHeight}"><title>GEKI Academy FINAL — ${width}px — 40 screens</title><rect width="100%" height="100%" fill="#252525"/><text x="70" y="65" fill="#f5f4f0" font-family="Arial" font-size="32">GEKI ACADEMY / FINAL DESIGN / ${width}px / 40 SCREENS</text>${content.join('')}</svg>`;
  fs.writeFileSync(path.join(out,`GEKI-FINAL-${width}.svg`),svg);
 }
 console.log(JSON.stringify({sheets:manifest.length,overflow,errors,maxBytes:Math.max(...manifest.map(m=>m.bytes))}));await b.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
