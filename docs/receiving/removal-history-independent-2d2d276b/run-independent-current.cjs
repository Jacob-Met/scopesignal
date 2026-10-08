const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root='C:\\Users\\minec\\hamon-ultra-2d2d276b-scope-removal', source=path.join(root,'current-08b4d1c'), out=path.join(root,'independent-current-08b4d1c');
if(fs.existsSync(out))throw Error('independent output exists');
fs.mkdirSync(out);
const original=fs.readFileSync(path.join(root,'current-receiving-08b4d1c','current-browser-receiver.mjs'),'utf8'),start=original.indexOf("  await fresh();\n  await check('filled middle-row"),end=original.indexOf('  assert.deepEqual(pageErrors, []);',start);
if(start<0||end<0)throw Error('driver boundaries missing');
const driver=path.join(out,'independent-history-receiver.mjs');
fs.writeFileSync(driver,original.slice(0,start)+fs.readFileSync(path.join(root,'independent-current-oracle.txt'),'utf8')+original.slice(end));
const mutation=path.join(out,'mutation-source');fs.cpSync(source,mutation,{recursive:true});
const controller=path.join(mutation,'src','scope-workspace.mjs'),text=fs.readFileSync(controller,'utf8'),needle='  scopeHistory.clear();';
if(text.split(needle).length!==2)throw Error('clear hook not unique');
fs.writeFileSync(controller,text.replace(needle,'  // Independent negative control: omit history clear.'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const record={started:new Date().toISOString(),sourceCommit:'08b4d1cc4656efcb12880bc1f970aa1dfed1d930',sourceTree:'d8b5638fbd626df5021491f333a92b30a24a3f40',runtime:process.version,transport:'author CDP bootstrap, independent replacement oracle',driverSha256:hash(fs.readFileSync(driver)),originalControllerSha256:hash(fs.readFileSync(path.join(source,'src','scope-workspace.mjs'))),mutationControllerSha256:hash(fs.readFileSync(controller)),runs:[]};
for(const[name,input]of[['candidate',source],['negative',mutation]]){
 const r=cp.spawnSync(process.execPath,[driver,input,path.join(out,name),'candidate'],{encoding:null,timeout:120000,maxBuffer:1000000});
 fs.writeFileSync(path.join(out,name+'.stdout.log'),r.stdout||'');fs.writeFileSync(path.join(out,name+'.stderr.log'),r.stderr||'');
 record.runs.push({name,status:r.status,signal:r.signal,error:r.error?.message});fs.writeFileSync(path.join(out,'execution.json'),JSON.stringify(record,null,2)+'\n');
}
record.finished=new Date().toISOString();record.expectedStatuses=record.runs[0]?.status===0&&record.runs[1]?.status===1;fs.writeFileSync(path.join(out,'execution.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));