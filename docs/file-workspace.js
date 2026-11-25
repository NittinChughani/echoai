/* ECHO Attach, Lens, Trace, Transform, Compare, Focus and Replay interface. */
(() => {
  'use strict';
  const F=window.EchoFiles,$=id=>document.getElementById(id);
  let hooks,items=[],busy=false,generation=0,visionReady=false,current=null,canvas=null,rect=null,dragStart=null;
  const libraryByChat=new Map();let activeKey='draft';
  // Keep the composer compact unless the visitor explicitly opens file controls.
  let expanded=false;
  function setExpanded(value){expanded=Boolean(value);render();}
  const replayKey='echo-replay-v1';
  let workflows=[];try{const data=JSON.parse(localStorage.getItem(replayKey)||'[]');if(Array.isArray(data))workflows=data.filter(F.validWorkflow).slice(0,30);}catch{}
  const button=(label,fn,cls='file-small-btn')=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);return b;};
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const size=n=>n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';
  function notify(s){hooks.toast(s);}
  function saveReplay(){try{localStorage.setItem(replayKey,JSON.stringify(workflows));}catch{notify('Could not save workflows in this browser.');}}
  function setBusy(value,status=''){busy=value;$('file-status').textContent=status;render();hooks.change();}
  function dispose(f){if(f.pdf)void f.pdf.destroy().catch(()=>{});}
  function switchChat(id){
    const key=id||'draft';if(key===activeKey)return;
    generation++;busy=false;libraryByChat.set(activeKey,items);
    activeKey=key;items=libraryByChat.get(key)||[];current=null;canvas=null;rect=null;expanded=false;
    if($('file-workspace').open)$('file-workspace').close();
    $('file-status').textContent='';render();
  }
  function adopt(id){if(activeKey==='draft'){libraryByChat.delete('draft');activeKey=id;libraryByChat.set(id,items);}}
  function forget(id){const list=libraryByChat.get(id)||[];list.forEach(dispose);libraryByChat.delete(id);if(id===activeKey){items=[];generation++;busy=false;expanded=false;$('file-status').textContent='';render();}}
  function fresh(){const list=libraryByChat.get('draft')||[];list.forEach(dispose);libraryByChat.delete('draft');if(activeKey==='draft'){items=[];generation++;busy=false;current=null;expanded=false;$('file-status').textContent='';render();}else switchChat(null);}
  async function addFiles(list){
    if(busy||hooks.isGenerating())return;
    const remaining=F.MAX_FILES-items.length;if(remaining<=0)return notify('Maximum four active files per conversation.');
    const files=Array.from(list).slice(0,remaining);if(!files.length)return;
    if(!items.length)expanded=false;
    const token=++generation;setBusy(true,'Reading files on your device…');
    let errors=[];
    try{
      for(const file of files){
        let f;
        try{
          f=await F.parseFile(file);
          if(token!==generation){dispose(f);return;}
          // Text-only deployment remains useful for screenshots and scanned pages.
          if(F.images.has(f.type)&&!visionReady){
            $('file-status').textContent='Reading image text locally…';
            try{const c=await F.canvasFor(f,f.units[0]);const text=await F.ocr(c,'eng',s=>{if(token===generation)$('file-status').textContent=s;});f.units[0].text=text.slice(0,150000);f.units[0].ocr=true;f.note=text?'Image text extracted locally. Full scene understanding requires vision support.':'No text recognized. Open Lens to crop and retry; full visual understanding is unavailable.';}
            catch(e){f.note='Image OCR unavailable: '+(e.message||'try again in Lens');}
          }else if(F.images.has(f.type)&&visionReady){
            const c=await F.canvasFor(f,f.units[0]);try{f.units[0].visualData=F.encodeImage(c);}catch(e){f.note=e.message;}
          }
          if(token!==generation){dispose(f);return;}
          items.push(f);
        }catch(e){if(f)dispose(f);errors.push(file.name+': '+(e.message||'Could not read file.'));}
      }
    }finally{if(token===generation){setBusy(false,errors.join(' · '));if(errors.length)notify(errors[0]);}}
  }
  function remove(f){if(busy||hooks.isGenerating())return;const i=items.indexOf(f);if(i<0)return;items.splice(i,1);dispose(f);if(current?.f===f){current=null;canvas=null;rect=null;}$('file-status').textContent='';render();hooks.change();}
  function clear(){if(busy||hooks.isGenerating())return;items.forEach(dispose);items.splice(0);current=null;canvas=null;rect=null;expanded=false;$('file-status').textContent='';render();hooks.change();}
  function render(){
    const strip=$('attachment-list'),smart=$('file-actions'),panel=$('attachment-panel');
    const status=$('file-status');
    strip.replaceChildren();smart.replaceChildren();panel.hidden=!items.length&&!busy&&!status.textContent;
    if(panel.hidden)expanded=false;
    const toggle=$('workspace-toggle');
    $('attachment-details').hidden=!expanded;
    panel.classList.toggle('is-expanded',expanded);
    toggle.setAttribute('aria-expanded',String(expanded));
    toggle.title=expanded?'Minimize attached workspace':'Expand attached workspace';
    $('workspace-toggle-label').textContent=expanded?'Minimize':'Expand';
    const total=items.reduce((n,f)=>n+f.units.filter(u=>u.selected).length,0);
    $('workspace-count').textContent=items.length?items.length+(items.length===1?' file attached':' files attached'):'File workspace';
    $('workspace-state').textContent=busy?'Processing…':items.length?total+' selected':status.textContent?'File notice':'';
    status.hidden=!status.textContent;
    status.title=status.textContent;
    $('attach-button').disabled=busy||hooks?.isGenerating();$('file-workspace-button').disabled=busy||!items.length||hooks?.isGenerating();
    $('clear-files').disabled=busy||!items.length||hooks?.isGenerating();
    for(const f of items){
      const chip=el('div','attachment-chip');const label=button(f.name,()=>open(f),'attachment-name');label.title=f.name+' · '+size(f.size);
      const count=f.units.filter(u=>u.selected).length;const meta=el('small','',f.type.toUpperCase()+' · '+count+'/'+f.units.length+' selected');
      const info=el('div','attachment-info');info.append(label,meta);
      const x=button('×',()=>remove(f),'attachment-remove');x.setAttribute('aria-label','Remove '+f.name);x.disabled=busy||hooks?.isGenerating();
      chip.append(el('span','attachment-kind',f.type.toUpperCase().slice(0,4)),info,x);strip.append(chip);
    }
    if(items.length)for(const [label,prompt] of F.actions(items).slice(0,7)){const b=button(label,()=>hooks.prompt(prompt));b.disabled=busy||hooks?.isGenerating();smart.append(b);}
    if(items.length)smart.append(button('All actions / Focus',()=>open(items[0])));
    if($('file-workspace').open)renderWorkspaceList();
  }
  function renderWorkspaceList(){
    const list=$('workspace-files');list.replaceChildren();
    for(const f of items){const b=button(f.name,()=>selectFile(f),'workspace-file'+(current?.f===f?' active':''));b.title=f.name;list.append(b);}
    const f=current?.f;if(!f)return;
    $('workspace-note').textContent=f.note||'Select the sections ECHO may read.';
    $('unit-list').replaceChildren();
    f.units.forEach((u,i)=>{
      const row=el('div','workspace-unit');const cb=document.createElement('input');cb.type='checkbox';cb.checked=u.selected;cb.setAttribute('aria-label','Include '+u.label);cb.addEventListener('change',()=>{u.selected=cb.checked;render();hooks.change();});
      row.append(cb,button(u.label,()=>showUnit(f,u),'unit-button'+(current?.u===u?' active':'')),el('small','',u.selection?'Selection':u.visualData?'Image':u.text?u.text.length+' chars':'No text'));
      $('unit-list').append(row);
    });
    const actions=$('workspace-actions');actions.replaceChildren();for(const [label,prompt] of F.actions(items))actions.append(button(label,()=>{hooks.prompt(prompt);$('file-workspace').close();}));
    const packet=F.buildPacket(items,hooks.getPrompt(),visionReady);$('focus-budget').textContent=packet.sources.length+' excerpts · '+packet.prompt.length+' characters · '+packet.selectedCount+' selected sections'+(packet.image?' · 1 image':'')+(packet.limited?' · relevant excerpts only':'');
  }
  function selectFile(f){if(!items.includes(f))return;void showUnit(f,f.units[0]);}
  function open(f){if(busy||hooks.isGenerating()||!f)return;if(!$('file-workspace').open)$('file-workspace').showModal();if(current?.f===f&&current.u)void showUnit(f,current.u);else selectFile(f);}
  let viewToken=0;
  async function showUnit(f,u){
    current={f,u};const token=++viewToken;canvas=null;rect=null;dragStart=null;updateCrop();
    $('lens-title').textContent=f.name+' · '+u.label;
    $('lens-text').value=u.selection||u.text;
    $('lens-text').placeholder='No extracted text. Use OCR on a visual page.';
    $('lens-visual').hidden=true;$('lens-canvas').replaceChildren();$('lens-status').textContent='';
    $('lens-use-text').disabled=!u.text&&!u.selection;$('lens-reset').disabled=false;
    $('lens-ocr').hidden=!(f.pdf||F.images.has(f.type));$('lens-image').hidden=!visionReady||!(f.pdf||F.images.has(f.type));
    $('lens-ocr').disabled=true;$('lens-image').disabled=true;renderWorkspaceList();
    if(f.pdf||F.images.has(f.type)){
      $('lens-status').textContent='Rendering local preview…';
      try{const c=await F.canvasFor(f,u);if(token!==viewToken||current?.u!==u)return;canvas=c;$('lens-canvas').append(c);$('lens-visual').hidden=false;$('lens-ocr').disabled=false;$('lens-image').disabled=false;$('lens-status').textContent='Drag over the image to select an area. OCR reads text; full vision requires a compatible backend.';}
      catch(e){if(token===viewToken)$('lens-status').textContent=e.message||'Preview unavailable.';}
    }
  }
  function updateCrop(){
    const marker=$('lens-crop');marker.hidden=!rect;
    if(rect){marker.style.left=(rect.x*100)+'%';marker.style.top=(rect.y*100)+'%';marker.style.width=(rect.w*100)+'%';marker.style.height=(rect.h*100)+'%';}
  }
  function pos(e){const b=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};}
  async function lensOCR(){
    if(!canvas||!current||busy)return;const {f,u}=current,token=generation,view=viewToken;setBusy(true,'Reading selected area…');
    $('lens-ocr').disabled=true;
    try{
      const text=await F.ocr(F.cropCanvas(canvas,rect),$('ocr-language').value,s=>{if(view===viewToken)$('lens-status').textContent=s;});
      if(token!==generation||!items.includes(f))return;
      if(!text)throw Error('No readable text recognized in this area.');
      if(rect)u.selection=text.slice(0,MAX_CONTEXT_SELECTION);else{u.text=text.slice(0,150000);delete u.selection;}
      u.ocr=true;u.selected=true;delete u.visualData;
      if(view===viewToken){$('lens-text').value=u.selection||u.text;$('lens-use-text').disabled=false;$('lens-status').textContent='OCR text ready. Verify it before sending.';}
    }catch(e){if(view===viewToken)$('lens-status').textContent=e.message||'OCR failed.';}
    finally{if(token===generation){$('lens-ocr').disabled=false;setBusy(false);}}
  }
  const MAX_CONTEXT_SELECTION=12000;
  function useText(){
    if(!current)return;const t=$('lens-text'),s=t.value.slice(t.selectionStart,t.selectionEnd).trim();
    if(!s)return notify('Highlight text in the preview first.');
    current.u.selection=s.slice(0,MAX_CONTEXT_SELECTION);current.u.selected=true;delete current.u.visualData;render();$('lens-status').textContent='Selection will be used instead of the full section.';
  }
  function useImage(){
    if(!current||!canvas||!visionReady)return;
    let data;try{data=F.encodeImage(F.cropCanvas(canvas,rect));}catch(e){$('lens-status').textContent=e.message;return;}
    for(const f of items)for(const u of f.units)delete u.visualData;
    current.u.visualData=data;current.u.selected=true;render();$('lens-status').textContent='Selected image will be included in the next AI request.';
  }
  function resetUnit(){if(!current)return;delete current.u.selection;delete current.u.visualData;rect=null;updateCrop();$('lens-text').value=current.u.text;render();$('lens-status').textContent='Using the full extracted section.';}
  function previewPacket(){
    const p=F.buildPacket(items,hooks.getPrompt(),visionReady);$('source-title').textContent='Focus · exact excerpt preview';$('source-text').textContent=p.sources.length?p.sources.map(s=>'['+s.id+'] '+s.name+' / '+s.label+'\n'+s.text).join('\n\n'):'No extracted text selected.';
    $('source-meta').textContent=(p.image?'One selected image will also be sent. ':'')+(p.visualCount>1?'Choose one visual selection before sending. ':'')+(p.unreadable.length?'Unreadable selected files: '+p.unreadable.join(', ')+'. ':'')+'These are the excerpts for the current draft; editing your question may change relevance ranking.';
    if(!$('source-dialog').open)$('source-dialog').showModal();
  }
  function source(s){$('source-title').textContent=s.name+' · '+s.label;$('source-text').textContent=s.text;$('source-meta').textContent=(s.ocr?'OCR text; verify against the original. ':'')+'This exact excerpt was supplied to the AI. A matching source ID does not prove that the AI interpreted it correctly.';$('source-dialog').showModal();}
  function renderEvidence(container,message){
    if(!message.sources?.length)return;
    const box=el('div','trace-box');const matched=F.cited(message.content,message.sources);
    box.append(el('strong','',matched.length?'ECHO Trace · referenced excerpts':'ECHO Trace · supplied excerpts'));
    const row=el('div','trace-chips');for(const s of (matched.length?matched:message.sources))row.append(button('['+s.id+'] '+s.name+' · '+s.label,()=>source(s),'trace-chip'));
    box.append(row,el('small','',matched.length?'Source IDs matched against sent excerpts; check interpretation.':'The response did not cite a recognized source ID.'));
    container.append(box);
  }
  function renderReplay(){
    const list=$('replay-list');list.replaceChildren();
    if(!workflows.length)list.append(el('p','workspace-muted','Save a useful prompt once and apply it to new files whenever you need it.'));
    for(const [i,w] of workflows.entries()){
      const row=el('div','replay-item'),info=el('div','replay-info');info.append(el('strong','',w.name),el('small','',w.prompt));row.append(info,button('Use',()=>{hooks.prompt(w.prompt);$('replay-dialog').close();}),button('Delete',()=>{workflows.splice(i,1);saveReplay();renderReplay();}));list.append(row);
    }
  }
  function replay(){if(hooks.isGenerating())return;$('replay-prompt').value=hooks.getPrompt().slice(0,1400);$('replay-name').value='';renderReplay();$('replay-dialog').showModal();}
  function downloadReplay(){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify({version:1,workflows},null,2)],{type:'application/json'}));a.href=url;a.download='echo-workflows.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function bind(h){
    hooks=h;$('file-input').accept=F.accept;
    $('attach-button').addEventListener('click',()=>$('file-input').click());
    $('file-input').addEventListener('change',e=>{void addFiles(e.target.files);e.target.value='';});
    $('workspace-toggle').addEventListener('click',()=>setExpanded(!expanded));
    $('workspace-minimize').addEventListener('click',()=>{$('file-workspace').close();setExpanded(false);$('workspace-toggle').focus();});
    $('file-workspace-button').addEventListener('click',()=>open(current?.f&&items.includes(current.f)?current.f:items[0]));
    $('clear-files').addEventListener('click',clear);
    $('replay-button').addEventListener('click',replay);
    const composer=$('composer');
    composer.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer.types).includes('Files')){e.preventDefault();composer.classList.add('drop-active');}});
    composer.addEventListener('dragleave',e=>{if(!composer.contains(e.relatedTarget))composer.classList.remove('drop-active');});
    composer.addEventListener('drop',e=>{if(e.dataTransfer.files.length){e.preventDefault();composer.classList.remove('drop-active');void addFiles(e.dataTransfer.files);}});
    $('message-input').addEventListener('paste',e=>{const files=Array.from(e.clipboardData?.files||[]);if(files.length){e.preventDefault();void addFiles(files);}});
    $('focus-all').addEventListener('click',()=>{if(current){current.f.units.forEach(u=>u.selected=true);render();}});
    $('focus-none').addEventListener('click',()=>{if(current){current.f.units.forEach(u=>u.selected=false);render();}});
    $('focus-preview').addEventListener('click',previewPacket);
    $('lens-use-text').addEventListener('click',useText);$('lens-reset').addEventListener('click',resetUnit);
    $('lens-ocr').addEventListener('click',()=>void lensOCR());$('lens-image').addEventListener('click',useImage);
    const stage=$('lens-stage');
    stage.addEventListener('pointerdown',e=>{if(!canvas||busy)return;e.preventDefault();stage.setPointerCapture(e.pointerId);dragStart=pos(e);rect={x:dragStart.x,y:dragStart.y,w:0,h:0};updateCrop();});
    stage.addEventListener('pointermove',e=>{if(!dragStart)return;const p=pos(e);rect={x:Math.min(p.x,dragStart.x),y:Math.min(p.y,dragStart.y),w:Math.abs(p.x-dragStart.x),h:Math.abs(p.y-dragStart.y)};updateCrop();});
    const end=()=>{dragStart=null;if(rect&&(rect.w<.015||rect.h<.015))rect=null;updateCrop();};
    stage.addEventListener('pointerup',end);stage.addEventListener('pointercancel',end);
    $('save-replay').addEventListener('click',()=>{const w={name:$('replay-name').value.trim(),prompt:$('replay-prompt').value.trim()};if(!F.validWorkflow(w))return notify('Enter a workflow name and instructions.');if(workflows.length>=30)return notify('Delete a workflow before adding another.');workflows.push(w);saveReplay();renderReplay();$('replay-name').value='';notify('Workflow saved locally.');});
    $('export-replay').addEventListener('click',downloadReplay);
    $('import-replay').addEventListener('click',()=>$('replay-file').click());
    $('replay-file').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{if(f.size>100000)throw Error('Workflow file too large.');const data=JSON.parse(await f.text());if(data.version!==1||!Array.isArray(data.workflows)||!data.workflows.every(F.validWorkflow))throw Error('Invalid ECHO workflow file.');workflows=[...workflows,...data.workflows].slice(0,30);saveReplay();renderReplay();notify('Workflows imported.');}catch(err){notify(err.message);}});
    render();
  }
  function packet(question){
    if(!items.length)return null;
    const p=F.buildPacket(items,question,visionReady);
    if(!p.selectedCount)throw Error('Select at least one file section in ECHO Focus, or remove the files.');
    if(p.visualCount>1)throw Error('Choose one image in Lens per request; use OCR for other images or deselect them.');
    if(p.unreadable.length)throw Error('No readable selected content in '+p.unreadable[0]+'. Use Lens OCR, select a supported image, or deselect that file.');
    if(!p.sources.length&&!p.image)throw Error('No readable text or supported image selected. Open Lens to extract text or remove the file.');
    return p;
  }
  window.EchoWorkspace={bind,switchChat,adopt,forget,fresh,packet,renderEvidence,render,hasFiles:()=>items.length>0,isBusy:()=>busy,setVision:value=>{visionReady=!!value;$('vision-state').textContent=visionReady?'Image vision enabled · OCR also available':'Image OCR available · full visual understanding not enabled';}};
})();
