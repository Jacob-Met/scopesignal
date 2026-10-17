'use strict';
// Read only the fixed, team-created files from the exact Scope82 review root.
// The compressed carrier is transport; every whole original has its own digest.
const fs=require('node:fs'),crypto=require('node:crypto'),zlib=require('node:zlib'),os=require('node:os'),path=require('node:path');
const ROOT='C:\\Users\\Veria\\hamon-e1438c9d058f-scopesignal-visible-events-82';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assert=(b,m)=>{if(!b)throw Error(m);};
function identity(p,s){return {path:p,type:s.isSymbolicLink()?'symlink':s.isFile()?'regular':s.isDirectory()?'directory':'other',bytes:Number(s.size),mode:Number(s.mode),mtime_ns:String(s.mtimeNs),inode:String(s.ino),device:String(s.dev)};}
function readStable(p,cap){
  const a=fs.lstatSync(p,{bigint:true});
  const observed=identity(p,a);
  try{
  assert(a.isFile()&&!a.isSymbolicLink()&&a.size<=BigInt(cap),'invalid or oversized original');
  const b=fs.readFileSync(p),s=fs.lstatSync(p,{bigint:true});
  for(const k of ['dev','ino','mode','size','mtimeNs'])assert(a[k]===s[k],'original changed during read');
  assert(b.length===Number(a.size),'short original');
  return b;
  }catch(e){e.observed_identity=observed;throw e;}
}
function collect(mode){
  assert(process.platform==='win32'&&os.hostname()==='MSI'&&os.userInfo().username==='Veria'&&os.homedir()==='C:\\Users\\Veria','wrong account');
  const dirs=['C:\\','C:\\Users','C:\\Users\\Veria',ROOT];
  for(const p of dirs){const s=fs.lstatSync(p);assert(s.isDirectory()&&!s.isSymbolicLink(),'nonplain parent');}
  assert(['stage','browser','receipt'].includes(mode),'invalid mode');
  const names=mode==='stage'?['bootstrap-receipt.json','browser-config-v2.json','stage-v2-receipt.json']:
    mode==='receipt'?['browser-v2/receiving.json','browser-v2/browser.stdout','browser-v2/browser.stderr']:
    ['browser-v2/receiving.json','browser-v2/browser.stdout','browser-v2/browser.stderr','browser-v2/events-desktop.png','browser-v2/events-narrow.png','browser-v2/downloads/scopesignal-record-review.html'];
  const files=[],missing=[],refused=[];
  for(const name of names){try{
    const parts=name.split('/');
    for(let i=1;i<parts.length;i++){const parent=path.join(ROOT,...parts.slice(0,i)),s=fs.lstatSync(parent,{bigint:true});
      if(!s.isDirectory()||s.isSymbolicLink()){const e=Error('nonplain original parent');e.observed_identity=identity(parent,s);throw e;}}
    const cap=mode==='stage'||name.endsWith('/receiving.json')?2097152:name.endsWith('.png')?8388608:name.endsWith('.stdout')||name.endsWith('.stderr')?4194304:65536;
    const body=readStable(path.join(ROOT,...parts),cap);
    files.push({path:name,bytes:body.length,sha256:sha(body),base64:body.toString('base64')});
  }catch(e){
    if(mode!=='browser')throw e;
    const row={path:name,reason:String(e.message||e),code:e.code||null};
    if(e.observed_identity)row.observed_identity=e.observed_identity;
    (e.code==='ENOENT'?missing:refused).push(row);
  }}
  const total=files.reduce((n,f)=>n+f.bytes,0);assert(total<=(mode==='stage'?4194304:28311552),'original set exceeds cap');
  const envelope=Buffer.from(JSON.stringify({schema:'scopesignal.shown-disclosures.readback/1',root:ROOT,mode,files,...(mode==='browser'?{missing,refused}:{})}));
  const gz=zlib.gzipSync(envelope,{level:9}), encoded=gz.toString('base64');
  assert(gz.length<=(mode==='stage'?2097152:16777216),'carrier exceeds cap; no original truncated');
  console.log('SC82_BEGIN '+JSON.stringify({mode,gzip_bytes:gz.length,gzip_sha256:sha(gz),envelope_bytes:envelope.length,envelope_sha256:sha(envelope),chunks:Math.ceil(encoded.length/3000)}));
  for(let i=0;i<encoded.length;i+=3000)console.log('SC82_DATA '+String(i/3000).padStart(4,'0')+' '+encoded.slice(i,i+3000));
  console.log('SC82_END');
}
module.exports={collect};
