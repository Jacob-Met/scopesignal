'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),zlib=require('node:zlib');
const ROOT='C:\\Users\\Veria\\hamon-e1438c9d058f-scopesignal-visible-events-82';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(b,m)=>{if(!b)throw Error(m);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const same=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function read(p){
  const a=fs.lstatSync(p,{bigint:true});need(a.isFile()&&!a.isSymbolicLink()&&a.size<=128n*1024n*1024n,'invalid file');
  const body=fs.readFileSync(p),b=fs.lstatSync(p,{bigint:true});
  for(const k of ['dev','ino','mode','size','mtimeNs'])need(a[k]===b[k],'changed during read');
  need(body.length===Number(a.size),'short file');
  return {body,identity:{path:p,type:'regular',bytes:body.length,sha256:sha(body),mode:Number(a.mode),mtime_ns:String(a.mtimeNs),inode:String(a.ino),device:String(a.dev)}};
}
function absent(p){try{fs.lstatSync(p);throw Error('occupied new path: '+p);}catch(e){if(e.code!=='ENOENT')throw e;}}
function write(p,b){fs.writeFileSync(p,b,{flag:'wx'});const r=read(p);need(r.body.equals(b),'write differs');return r.identity;}
function prepare(encoded){
  need(process.platform==='win32'&&process.arch==='x64'&&process.version==='v24.19.0'&&process.execPath==='C:\\Program Files\\nodejs\\node.exe','wrong Node');
  need(os.hostname()==='MSI'&&os.userInfo().username==='Veria'&&os.homedir()==='C:\\Users\\Veria'&&process.env.USERPROFILE==='C:\\Users\\Veria','wrong account');
  for(const p of ['C:\\','C:\\Users','C:\\Users\\Veria',ROOT,path.join(ROOT,'controls')]){const s=fs.lstatSync(p);need(s.isDirectory()&&!s.isSymbolicLink(),'nonplain parent');}
  const original=read(path.join(ROOT,'browser-config.json'));need(original.identity.sha256==='99ca2f79e8b57a0ec172de5c8da42c6224b291282392a1b447851770cdada883','original config differs');
  const old=JSON.parse(original.body);need(old.inputs.length===56&&old.kit_members.length===54,'original closure differs');
  const observed=old.inputs.map(x=>{const r=read(x.path);need(same(x,r.identity),'original static input changed');return r.identity;});
  for(const x of [old.node,old.browser])need(same(read(x.path).identity,x),'runtime changed');
  const prior=read(path.join(ROOT,'browser-v1','receiving.json')),priorJSON=JSON.parse(prior.body);
  need(prior.identity.bytes===94380&&prior.identity.sha256==='1fbe4ced79ca7b8fdeea20c901dc6ad595e71add17ee09d3539a821b2a906c31','first course receipt differs');
  need(priorJSON.status==='FAIL'&&priorJSON.source_revision===old.source_revision&&same(priorJSON.before,priorJSON.after),'first course conservation differs');
  const receiver=path.join(ROOT,'controls','receive-v2.cjs'),config=path.join(ROOT,'browser-config-v2.json'),receipt=path.join(ROOT,'stage-v2-receipt.json'),output=path.join(ROOT,'browser-v2');
  [receiver,config,receipt,output].forEach(absent);
  const body=zlib.gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:65536});
  need(body.length===29835&&sha(body)==='3ab7128af97b68700941e1a44363df074aba70bc2b8d11be2e3afc4e75a90431','v2 receiver source differs');
  const next={...old,receiver,output,cleanup_timeout_seconds:60};
  need(old.inputs.filter(x=>x.path===old.receiver).length===1,'old receiver membership differs');
  const newIdentity=write(receiver,body);
  next.inputs=old.inputs.map(x=>x.path===old.receiver?newIdentity:x);
  const configIdentity=write(config,Buffer.from(JSON.stringify(next,null,2)+'\n'));
  for(const x of observed)need(same(read(x.path).identity,x),'original static input changed after preparation');
  need(same(read(original.identity.path).identity,original.identity)&&same(read(prior.identity.path).identity,prior.identity),'original config or receipt changed');
  const result={schema:'scopesignal.shown-disclosures.staging-v2/1',status:'PREPARED_NOT_EXECUTED',source_revision:old.source_revision,
    original_config:original.identity,original_failed_receipt:prior.identity,receiver:newIdentity,config:configIdentity,
    static_members:56,kit_members:54,cleanup_seconds:60,observed_at:new Date().toISOString()};
  const receiptIdentity=write(receipt,Buffer.from(JSON.stringify(result,null,2)+'\n'));
  console.log(JSON.stringify({status:result.status,config:configIdentity,receipt:receiptIdentity}));
}
module.exports={prepare};
