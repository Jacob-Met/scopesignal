'use strict';
// Create-only receiver staging for one already identified, owned review folder.
// This program does not launch a browser, server, shell, test or product command.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ROOT = 'C:\\Users\\Veria\\hamon-e1438c9d058f-scopesignal-visible-events-82';
const HOME = 'C:\\Users\\Veria';
const REVISION = 'dcad391d11a66a43df32ae1051a48c5ebd22ff34';
const NODE = {path:'C:\\Program Files\\nodejs\\node.exe',bytes:92825416,sha256:'3602f2bb1a10f2cbab4c36886218a33c1ab3db87290e73b033c46c77147d0237'};
const EDGE = {path:'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',bytes:5438280,sha256:'4bb4545b4ab80a3cf463a588ce570ca42de38fe6db16e3baeb0798ac75b4648b'};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
function statValue(p) {
  const s = fs.lstatSync(p, {bigint:true});
  assert(s.isFile() && !s.isSymbolicLink(), 'not a plain regular file: '+p);
  assert(s.size <= 128n*1024n*1024n, 'file exceeds staging read cap');
  return {path:p,type:'regular',bytes:Number(s.size),mode:Number(s.mode),mtime_ns:String(s.mtimeNs),inode:String(s.ino),device:String(s.dev)};
}
function readStable(p) {
  const before = statValue(p);
  const b = fs.readFileSync(p);
  assert(same(before,statValue(p)) && b.length === before.bytes, 'file changed while read: '+p);
  return {body:b,identity:{...before,sha256:sha(b)}};
}
function plainDirectory(p) {
  const s=fs.lstatSync(p);
  assert(s.isDirectory() && !s.isSymbolicLink(), 'not a plain directory: '+p);
}
function exclusive(p,b) {
  fs.writeFileSync(p,b,{flag:'wx'});
  const got=readStable(p);
  assert(got.body.equals(b),'write/read mismatch: '+p);
  return got.identity;
}
function environment() {
  assert(process.platform==='win32' && process.arch==='x64','wrong platform');
  assert(os.hostname()==='MSI' && os.userInfo().username==='Veria','wrong host or user');
  assert(os.homedir()===HOME && process.env.USERPROFILE===HOME,'wrong account home');
  assert(process.execPath===NODE.path && process.version==='v24.19.0','wrong Node runtime');
  for(const p of ['C:\\','C:\\Users',HOME]) plainDirectory(p);
  const node=readStable(NODE.path).identity, browser=readStable(EDGE.path).identity;
  for(const [actual,pin] of [[node,NODE],[browser,EDGE]])
    assert(actual.bytes===pin.bytes && actual.sha256===pin.sha256,'runtime bytes changed');
  return {node,browser};
}
function bootstrap() {
  const runtime=environment();
  assert(!fs.existsSync(ROOT),'review root already exists');
  fs.mkdirSync(ROOT); // no recursive parent creation and no existing-folder reuse
  const receipt={schema:'scopesignal.shown-disclosures.bootstrap/1',root:ROOT,
    host:os.hostname(),user:os.userInfo().username,account_home:HOME,
    observed_at:new Date().toISOString(),runtime};
  const identity=exclusive(path.join(ROOT,'bootstrap-receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
  console.log(JSON.stringify({status:'CREATED_EMPTY_REVIEW_ROOT',root:ROOT,receipt:identity}));
}
function stage(packetSHA,selfSHA) {
  assert(/^[0-9a-f]{64}$/.test(packetSHA||'') && /^[0-9a-f]{64}$/.test(selfSHA||''),'two exact SHA256 arguments required');
  const runtime=environment();
  plainDirectory(ROOT);
  assert(path.resolve(__filename)===path.join(ROOT,'stage.cjs'),'unexpected controller location');
  assert(same(fs.readdirSync(ROOT).sort(),['bootstrap-receipt.json','incoming.json','stage.cjs']),'initial review folder membership differs');
  const self=readStable(__filename);
  assert(self.identity.sha256===selfSHA,'controller SHA differs');
  const bootstrapRead=readStable(path.join(ROOT,'bootstrap-receipt.json'));
  const boot=JSON.parse(bootstrapRead.body);
  assert(boot.schema==='scopesignal.shown-disclosures.bootstrap/1' && boot.root===ROOT && boot.host==='MSI' && boot.user==='Veria' && boot.account_home===HOME,'bootstrap identity differs');
  assert(same(boot.runtime,runtime),'runtime metadata changed since bootstrap');
  const incoming=readStable(path.join(ROOT,'incoming.json'));
  assert(incoming.identity.sha256===packetSHA && incoming.body.length<=1500000,'packet identity differs or oversized');
  const packet=JSON.parse(incoming.body);
  assert(packet.schema==='scopesignal.shown-disclosures.transfer/1' && packet.root===ROOT && packet.source_revision===REVISION,'packet target differs');
  assert(Array.isArray(packet.files) && packet.files.length===56,'expected 56 static bodies');
  const names=packet.files.map(f=>f.path);
  assert(same(names,[...names].sort()) && new Set(names.map(n=>n.toLowerCase())).size===56,'duplicate or unsorted members');
  const kit=names.filter(n=>n.startsWith('kit/')).map(n=>n.slice(4));
  assert(kit.length===54 && names.includes('controls/receive.cjs') && names.includes('controls/expected-review.html'),'incorrect transfer closure');
  assert(same(kit,packet.kit_members),'kit member map differs');
  let total=0;
  const bodies=packet.files.map(f=>{
    assert(typeof f.path==='string' && /^(kit|controls)\/[A-Za-z0-9_.\/-]+$/.test(f.path),'invalid relative name');
    assert(f.path.length<=180 && f.path.split('/').every(x=>x!=='' && x!=='.' && x!=='..' && !x.endsWith('.')),'unsafe path segment');
    assert(Number.isSafeInteger(f.bytes) && f.bytes>=0 && f.bytes<=200000 && /^[0-9a-f]{64}$/.test(f.sha256),'invalid member pin');
    assert(typeof f.base64==='string' && f.base64.length<=270000,'oversized encoded member');
    const b=Buffer.from(f.base64,'base64');
    assert(b.toString('base64')===f.base64 && b.length===f.bytes && sha(b)===f.sha256,'member body differs: '+f.path);
    total+=b.length; return [f.path,b];
  });
  assert(total<=600000 && total===packet.payload_bytes,'payload total differs');
  const expected=bodies.find(([n])=>n==='controls/expected-review.html')[1];
  assert(expected.length===13519 && sha(expected)==='414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4','reference review differs');
  // No filesystem mutation above this line. Preserve any partial work below on error.
  const directories=new Set();
  for(const [n] of bodies) {
    let parent=path.posix.dirname(n);
    while(parent!=='.'){directories.add(parent);parent=path.posix.dirname(parent);}
  }
  for(const d of [...directories].sort((a,b)=>a.split('/').length-b.split('/').length || a.localeCompare(b)))
    fs.mkdirSync(path.join(ROOT,...d.split('/')));
  const inputs=bodies.map(([n,b])=>exclusive(path.join(ROOT,...n.split('/')),b));
  const config={schema:'scopesignal.shown-disclosures.windows-browser-config/1',
    root:ROOT,source_root:path.join(ROOT,'kit'),fixture:path.join(ROOT,'kit','examples','shown-events.fixture.json'),
    expected_review:path.join(ROOT,'controls','expected-review.html'),receiver:path.join(ROOT,'controls','receive.cjs'),
    output:path.join(ROOT,'browser-v1'),source_revision:REVISION,host:'MSI',user:'Veria',account_home:HOME,
    node:runtime.node,browser:runtime.browser,node_version:'v24.19.0',browser_version:'155.0.4283.45',
    inputs,kit_members:kit,timeout_seconds:120,cleanup_timeout_seconds:20};
  const configIdentity=exclusive(path.join(ROOT,'browser-config.json'),Buffer.from(JSON.stringify(config,null,2)+'\n'));
  for(const id of inputs) assert(same(readStable(id.path).identity,id),'staged member changed');
  assert(same(environment(),runtime),'runtime changed during staging');
  const receipt={schema:'scopesignal.shown-disclosures.staging/1',status:'STAGED_NOT_EXECUTED',root:ROOT,
    source_revision:REVISION,packet:incoming.identity,controller:self.identity,bootstrap:bootstrapRead.identity,
    static_members:inputs.length,kit_members:kit.length,payload_bytes:total,config:configIdentity,observed_at:new Date().toISOString()};
  const receiptIdentity=exclusive(path.join(ROOT,'stage-receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
  console.log(JSON.stringify({status:receipt.status,config:configIdentity,receipt:receiptIdentity}));
}
if(require.main===module) {
  try {
    if(process.argv.length===3 && process.argv[2]==='--bootstrap') bootstrap();
    else {assert(process.argv.length===4,'unexpected arguments');stage(process.argv[2],process.argv[3]);}
  } catch(e) {console.error(JSON.stringify({status:'FAILED_PRESERVED',error:String(e.stack||e)}));process.exitCode=1;}
}
module.exports={bootstrap};
