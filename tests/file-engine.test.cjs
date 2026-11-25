const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {join}=require('node:path');
const {runInNewContext}=require('node:vm');
const sandbox={window:{}};
runInNewContext(readFileSync(join(__dirname,'../docs/file-engine.js'),'utf8'),sandbox);
const F=sandbox.window.EchoFiles;
const unit=(label,text,selected=true,extra={})=>({label,text,selected,...extra});
const item=(name,units,type='txt')=>({name,units,type});
test('focus excludes unselected text',()=>{
  const p=F.buildPacket([item('notes.pdf',[unit('Page 1','12 V'),unit('Page 2','SECRET',false)])],'voltage');
  assert.ok(p.prompt.includes('12 V'));assert.ok(!p.prompt.includes('SECRET'));
});
test('highlight replaces full section',()=>{
  const p=F.buildPacket([item('a.txt',[unit('Block','private',true,{selection:'chosen'})])],'explain');
  assert.ok(p.prompt.includes('chosen'));assert.ok(!p.prompt.includes('private'));
});
test('comparison includes all four files within existing backend limit',()=>{
  const files=['a','b','c','d'].map(n=>item(n.repeat(100)+'.txt',[unit('Section','example text '.repeat(1000))]));
  const p=F.buildPacket(files,'compare '.repeat(175));assert.ok(p.prompt.length<=6200);
  assert.equal(new Set(p.sources.map(s=>s.name)).size,4);
});
test('trace filters invented IDs',()=>{
  const p=F.buildPacket([item('a.txt',[unit('Section','facts')])],'explain');
  assert.equal(F.cited('[S1] [S999]',p.sources).length,1);
});
test('vision capability and selection gates pixels',()=>{
  const data='data:image/jpeg;base64,AAAA',f=item('p.jpg',[unit('Image','',true,{visualData:data})],'jpg');
  assert.equal(F.buildPacket([f],'describe',false).image,null);
  assert.equal(F.buildPacket([f],'describe',true).image,data);
  f.units[0].selected=false;assert.equal(F.buildPacket([f],'describe',true).image,null);
});
test('unreadable files and multiple images are flagged',()=>{
  const p=F.buildPacket([item('a.txt',[unit('Section','text')]),item('scan.pdf',[unit('Page 1','')])],'compare');
  assert.equal(p.unreadable[0],'scan.pdf');
  const f=n=>item(n+'.jpg',[unit('Image','',true,{visualData:'data:image/jpeg;base64,AAAA'})],'jpg');
  assert.equal(F.buildPacket([f('a'),f('b')],'compare',true).visualCount,2);
});
test('workflow validation and contextual actions',()=>{
  assert.ok(F.validWorkflow({name:'Review',prompt:'Check calculations'}));
  assert.ok(!F.validWorkflow({name:'',prompt:'test'}));
  const a=F.actions([item('a.cpp',[],'cpp'),item('b.csv',[],'csv')]).map(x=>x[0]);
  for(const name of ['Compare files','Debug code','Analyze table'])assert.ok(a.includes(name));
});
test('actual text ingestion and invalid file rejection',async()=>{
  const text='Hello ECHO\nVoltage: 12 V';
  const f=await F.parseFile({name:'notes.txt',size:text.length,text:async()=>text});
  assert.equal(f.units[0].text,text);
  await assert.rejects(F.parseFile({name:'app.exe',size:100}),/Unsupported/);
  await assert.rejects(F.parseFile({name:'big.txt',size:13*1024*1024}),/12 MB/);
  await assert.rejects(F.parseFile({name:'bad.txt',size:5,text:async()=>'\u0001bad'}),/UTF-8/);
});
