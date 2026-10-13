const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),{spawnSync}=require('child_process');
const {pathToFileURL}=require('url'),stage=__dirname,packet=JSON.parse(fs.readFileSync(path.join(stage,'source-packet.json'),'utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const source=[];
 for(const [name,text] of Object.entries(packet.files)){
  const p=path.join(stage,name),b=Buffer.from(text);
  if(name.startsWith('original/')){const rel=name.slice(9),git=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');if(git!==packet.originalBlobs[rel])throw Error('Git blob mismatch '+name);}
  fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);source.push({path:name,bytes:b.length,sha256:sha(b)});
 }
 const {createLedger,replayFixture}=await import(pathToFileURL(path.join(stage,'original/src/ledger.mjs')));
 const {createFixtureRecord}=await import(pathToFileURL(path.join(stage,'original/src/fixture-record.mjs')));
 const l=createLedger();
 l.approve('journey','Literal <img src=x> & café\nSecond line');l.approve('accessibility','Keyboard walkthrough — authored sample');l.createOrder('journey');l.createOrder('accessibility');l.recordCaptureAttempt('journey');l.recordLostCaptureResponse('journey');l.recordWebhook('accessibility','WH-ACCESS','CAP-ACCESS');l.recordWebhook('journey','WH-JOURNEY','CAP-JOURNEY');l.recordWebhook('journey','WH-JOURNEY','CAP-JOURNEY');l.reconcile('journey','CAP-JOURNEY');l.approve('handoff','Pending handoff evidence');l.createOrder('handoff');l.recordCaptureAttempt('handoff');
 const max=replayFixture();for(let i=7;i<512;i++)max.recordWebhook('journey','WH-EVT-FIXTURE-001','CAP-FIXTURE-001');
 fs.mkdirSync(path.join(stage,'fixtures'),{recursive:true});
 for(const [name,events]of Object.entries({'mixed.json':l.events,'held-mixed.json':l.events,'partial.json':l.events.slice(0,6),'empty.json':[],'maximum.json':max.events})){fs.writeFileSync(path.join(stage,'fixtures',name),JSON.stringify(createFixtureRecord(events),null,2)+'\n');}
 fs.writeFileSync(path.join(stage,'fixtures','invalid.json'),'{"invalid":true}\n');
 const receipt={started:new Date().toISOString(),pid:process.pid,sourceBase:packet.source,runtime:{host:os.hostname(),user:os.userInfo().username,platform:os.platform(),release:os.release(),node:process.version},source,children:[]};
 for(const [name,args,cwd]of [['maintained',['--test','tests/record-reader.test.mjs','tests/fixture-record.test.mjs'],path.join(stage,'candidate')],['original',[path.join(stage,'receive.cjs'),'original'],stage],['candidate',[path.join(stage,'receive.cjs'),'candidate'],stage]]){
  const started=new Date().toISOString(),r=spawnSync(process.execPath,args,{cwd,encoding:'utf8',timeout:120000,maxBuffer:2e6});
  fs.writeFileSync(path.join(stage,name+'.stdout'),r.stdout||'');fs.writeFileSync(path.join(stage,name+'.stderr'),r.stderr||'');receipt.children.push({name,args,cwd,pid:r.pid,status:r.status,signal:r.signal,error:r.error?String(r.error):null,started,finished:new Date().toISOString(),stdoutSha256:sha(r.stdout||''),stderrSha256:sha(r.stderr||'')});console.log(JSON.stringify(receipt.children.at(-1)));
 }
 for(const entry of source)if(sha(fs.readFileSync(path.join(stage,entry.path)))!==entry.sha256)throw Error('Source changed '+entry.path);
 receipt.sourceUnchanged=true;receipt.finished=new Date().toISOString();fs.writeFileSync(path.join(stage,'execution.json'),JSON.stringify(receipt,null,2)+'\n');
 const candidate=JSON.parse(fs.readFileSync(path.join(stage,'candidate-browser/result.json'),'utf8'));
 if(receipt.children[0].status!==0||receipt.children[1].status!==1||receipt.children[2].status!==0||candidate.passed!==candidate.total)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=2;});
