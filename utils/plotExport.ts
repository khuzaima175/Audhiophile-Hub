/** Export the visible SVG with wrapped captions and no transient cursor/hit targets. */
export async function exportPlot(svg: SVGSVGElement, name: string, format: 'svg'|'png', caption: string) {
  const copy=svg.cloneNode(true) as SVGSVGElement;
  const width=svg.viewBox.baseVal.width, height=svg.viewBox.baseVal.height;
  const characters=Math.max(24,Math.floor((width-32)/7));
  const lines:string[]=[];let line='';
  for(const word of caption.split(/\s+/)) {
    if(line && line.length+word.length+1>characters){lines.push(line);line='';}
    for(let i=0;i<word.length;i+=characters){const part=word.slice(i,i+characters);line+=(line?' ':'')+part;if(i+characters<word.length){lines.push(line);line='';}}
  }
  if(line)lines.push(line);
  const shown=lines.slice(0,8);if(lines.length>8)shown[7]+='…';
  const exportHeight=height+Math.max(40,shown.length*17+24);
  copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
  copy.setAttribute('width',String(width));copy.setAttribute('height',String(exportHeight));copy.setAttribute('viewBox',`0 0 ${width} ${exportHeight}`);
  copy.querySelectorAll('[data-testid="graph-crosshair"],.eq-handle ellipse').forEach(n=>n.remove());
  const ns='http://www.w3.org/2000/svg';
  const bg=document.createElementNS(ns,'rect');bg.setAttribute('width',String(width));bg.setAttribute('height',String(exportHeight));bg.setAttribute('fill','#171b1f');copy.prepend(bg);
  shown.forEach((text,index)=>{const label=document.createElementNS(ns,'text');label.setAttribute('x','16');label.setAttribute('y',String(height+22+index*17));label.setAttribute('fill','#e7eaee');label.setAttribute('font-family','sans-serif');label.setAttribute('font-size','12');label.textContent=text;copy.append(label);});
  const blob=new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'});
  const sourceUrl=URL.createObjectURL(blob);
  try {
    if(format==='svg') { download(sourceUrl,name+'.svg');return; }
    const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Graph image could not be rendered'));img.src=sourceUrl;});
    const canvas=document.createElement('canvas');canvas.width=Math.round(width*2);canvas.height=Math.round(exportHeight*2);
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image export is unavailable');ctx.scale(2,2);ctx.drawImage(img,0,0,width,exportHeight);
    const result=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!result)throw new Error('Image export failed');
    const url=URL.createObjectURL(result);download(url,name+'.png');setTimeout(()=>URL.revokeObjectURL(url),1000);
  } finally {setTimeout(()=>URL.revokeObjectURL(sourceUrl),1000);}
}
function download(url:string,name:string){const a=document.createElement('a');a.href=url;a.download=name;a.click();}
