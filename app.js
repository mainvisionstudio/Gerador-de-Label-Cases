const $=id=>document.getElementById(id);let currentUrl;
function fitText(font,text,w,h,max,min=7){
 for(let size=max;size>=min;size=Math.round((size-.25)*100)/100){
  const lines=[];let tooWide=false;
  for(const paragraph of text.split('\n')){let line='';for(const word of paragraph.split(/\s+/)){
   if(font.widthOfTextAtSize(word,size)>w){tooWide=true;break;}
   const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>w){lines.push(line);line=word;}else line=next;
  }lines.push(line);if(tooWide)break;}
  if(!tooWide&&lines.length*size*1.22<=h)return {lines,size};
 }throw Error('O texto excede o espaço disponível no PDF. Reduz o conteúdo ou abrevia as descrições.');
}
// Preserve the user's explicit column assignment. Never move items automatically.
function fitContent(font,columns,w,h){
 const gap=14,width=(w-gap*(columns.length-1))/columns.length;
 for(let size=12;size>=6;size-=.25){
  const output=[];let fits=true;
  for(let column=0;column<columns.length;column++){
   const text=columns[column].trim();if(!text)continue;
   try{const fit=fitText(font,text,width,h,size,size);
    fit.lines.forEach((line,i)=>output.push({text:line,x:column*(width+gap),offset:i*size*1.22}));
   }catch{fits=false;break;}
  }
  if(fits)return {size,lines:output,columns:columns.length};
 }
 throw Error(columns.length===1?'O conteúdo excede o espaço de uma coluna. Ativa «Usar duas colunas» e coloca alguns elementos à direita, ou abrevia as descrições.':'Uma das colunas está cheia. Redistribui os elementos entre as colunas ou abrevia as descrições.');
}
async function buildPdf(values,photo){const {PDFDocument,StandardFonts,rgb}=PDFLib;const bytes=Uint8Array.from(atob(TEMPLATE),c=>c.charCodeAt(0));const doc=await PDFDocument.load(bytes);for(const p of doc.getPages())p.node.delete(PDFLib.PDFName.of("Annots"));doc.catalog.delete(PDFLib.PDFName.of("AcroForm"));const page=doc.getPages()[0];page.pushOperators(PDFLib.setCharacterSpacing(0),PDFLib.setWordSpacing(0));doc.registerFontkit(fontkit);const font=await doc.embedFont(Uint8Array.from(atob(FONT),c=>c.charCodeAt(0)),{subset:false});
 const boxes={department:[89,258,372,14,12],equipment:[21,194,438,38,15],content:[134,112,325,57,12],event:[33,47,210,40,12],date:[265,47,190,40,14]};
 for(const [key,[x,y,w,h,max]] of Object.entries(boxes)){const text=(values[key]||'').trim();if(key==='content'){const layout=fitContent(font,values.contentColumns||[text],w,h);for(const line of layout.lines)page.drawText(line.text,{x:x+line.x,y:y+h-layout.size-line.offset,size:layout.size,font,color:rgb(.08,.08,.08)});continue;}if(!text)continue;let fit;try{fit=fitText(font,text,w,h,max,key==='content'?6:7)}catch(e){throw Error(key+': '+e.message)}fit.lines.forEach((line,i)=>page.drawText(line,{x,y:(key==='department'?265.18:y+h-fit.size)-i*fit.size*1.22,size:fit.size,font,color:rgb(.08,.08,.08)}));}
 if(photo){const im=photo.type==='image/png'?await doc.embedPng(photo.bytes):await doc.embedJpg(photo.bytes);const s=Math.min(97/im.width,73/im.height);page.drawImage(im,{x:22+(97-im.width*s)/2,y:112+(73-im.height*s)/2,width:im.width*s,height:im.height*s});}return doc.save();}
$('form').addEventListener('submit',async e=>{e.preventDefault();$('generate').disabled=true;$('download').hidden=true;$('status').textContent='A preparar o PDF…';try{const values={department:$('department').value,equipment:$('equipment').value,contentColumns:$('twoColumns').checked?[readItems('items'),readItems('itemsRight')]:[readItems('items')],event:$('event').value,date:$('date').value.split('-').reverse().join('/')};const f=$('photo').files[0];if(f&&(!['image/png','image/jpeg'].includes(f.type)||f.size>10*1024*1024))throw Error('Seleciona uma imagem JPG ou PNG até 10 MB.');const bytes=await buildPdf(values,f?{type:f.type,bytes:await f.arrayBuffer()}:null);if(currentUrl)URL.revokeObjectURL(currentUrl);currentUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));$('preview').src=currentUrl;$('preview').hidden=false;$('model').hidden=true;$('download').href=currentUrl;$('download').download='Etiqueta-'+(values.equipment.slice(0,50).replace(/[^a-zA-Z0-9À-ÿ_-]/g,'-')||'case')+'.pdf';$('download').hidden=false;$('previewNote').textContent='Resultado da última geração. Se alterares os dados, gera novamente.';$('status').textContent='PDF pronto. Confirma o resultado e descarrega.';}catch(err){$('status').textContent='Não foi possível gerar: '+err.message;}finally{$('generate').disabled=false;}});
$('form').addEventListener('input',()=>{$('download').hidden=true;$('status').textContent='Dados alterados. Clica em «Gerar PDF» para atualizar.';});$('form').addEventListener('reset',()=>{$('items').replaceChildren();$('itemsRight').replaceChildren();$('twoColumns').checked=false;$('rightColumn').hidden=true;$('leftTitle').textContent='Elementos';addItem();if(currentUrl)URL.revokeObjectURL(currentUrl);$('preview').hidden=true;$('preview').removeAttribute('src');$('model').hidden=false;$('download').hidden=true;$('status').textContent='';$('previewNote').textContent='Modelo original. Clica em «Gerar PDF» para ver o resultado.';});

function markChanged(){ $('download').hidden=true;$('status').textContent='Dados alterados. Clica em «Gerar PDF» para atualizar.'; }
function addItem(focus=false,target='items'){
 const row=document.createElement('div');row.className='item-row';
 row.innerHTML='<label>Quantidade<input class="quantity" type="number" min="1" max="9999" step="1" value="1" required aria-label="Quantidade"></label><label>Descrição<input class="description" type="text" maxlength="150" placeholder="Ex.: Cabo HDMI" aria-label="Descrição do elemento"></label><button type="button" class="remove-item" aria-label="Remover elemento" title="Remover elemento">×</button>';
 row.querySelector('.remove-item').addEventListener('click',()=>{row.remove();if(!$(target).children.length)addItem(false,target);markChanged();});
 $(target).append(row);if(focus)row.querySelector('.description').focus();
}
function readItems(target='items'){return [...$(target).children].map(row=>{const description=row.querySelector('.description').value.trim();if(!description)return '';const quantity=Number(row.querySelector('.quantity').value);if(!Number.isInteger(quantity)||quantity<1||quantity>9999)throw Error('Usa quantidades inteiras entre 1 e 9999.');return quantity+' × '+description;}).filter(Boolean).join('\n');}
$('addRight').addEventListener('click',()=>{addItem(true,'itemsRight');markChanged();});
$('twoColumns').addEventListener('change',()=>{
 const enabled=$('twoColumns').checked;
 $('rightColumn').hidden=!enabled;$('leftTitle').textContent=enabled?'Coluna esquerda':'Elementos';
 if(enabled){$('leftTitle').textContent='Coluna esquerda';if(!$('itemsRight').children.length)addItem(false,'itemsRight');}
 else {
  // Preserve entered data when returning to one column.
  for(const row of [...$('itemsRight').children]){
   if(row.querySelector('.description').value.trim()){
    addItem(false,'items');const destination=$('items').lastElementChild;
    destination.querySelector('.quantity').value=row.querySelector('.quantity').value;
    destination.querySelector('.description').value=row.querySelector('.description').value;
   }
  }
  $('itemsRight').replaceChildren();
 }
 markChanged();
});
$('addItem').addEventListener('click',()=>{addItem(true);markChanged();});addItem();
