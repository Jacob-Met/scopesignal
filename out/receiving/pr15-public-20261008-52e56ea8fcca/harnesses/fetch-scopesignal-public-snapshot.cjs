// Download the current public static product, verify immutable Git blob pins,
// and retain exact response bytes for native browser receiving on loopback.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=path.resolve(process.argv[3]);
if(!/^[0-9a-f]{40}$/.test(cfg.sourceCommit))throw Error('Exact commit required');
if(cfg.baseUrl!=='https://jacobmetoyer.com/scopesignal/')throw Error('Unrecognized receiving destination');
fs.mkdirSync(out,{recursive:true});
const receipt={schema:'scopesignal.public-assets.v1',startedAt:new Date().toISOString(),sourceCommit:cfg.sourceCommit,sourceTree:cfg.sourceTree,sourceRepository:'Jacob-Met/scopesignal',defaultBranch:'paypal-ai',publicUrl:cfg.baseUrl,expectedAssets:cfg.assets,requiredBrowserAssets:cfg.requiredBrowserAssets,fetchAssets:{},execution:{kind:'public HTTP asset parity only',livePublicPageInteraction:false},limitations:['Exact public HTTP response bytes are verified and saved. No direct public-page browser observation is asserted.']};
(async()=>{
  for(const [name,expected] of Object.entries(cfg.assets)){
    if(name.startsWith('/')||name.split('/').includes('..'))throw Error('Invalid source path');
    const url=new URL(name==='index.html'?'':name,cfg.baseUrl).href;
    const response=await fetch(url,{cache:'no-store',redirect:'error'});
    const bytes=Buffer.from(await response.arrayBuffer());
    const sha256=crypto.createHash('sha256').update(bytes).digest('hex');
    const gitBlob=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
    receipt.fetchAssets[name]={status:response.status,url:response.url,bytes:bytes.length,sha256,gitBlob,etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified')};
    if(response.status!==200)throw Error(name+' HTTP '+response.status);
    if(gitBlob!==expected.gitBlob)throw Error(name+' mismatched Git blob: '+gitBlob+' expected '+expected.gitBlob);
    if(expected.sha256&&sha256!==expected.sha256)throw Error(name+' SHA256 mismatch');
    const destination=path.join(out,'public-source',name);
    fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,bytes);
  }
  receipt.passed=true;
})().catch(error=>{receipt.passed=false;receipt.failure=error.stack;process.exitCode=1}).finally(()=>{
  receipt.completedAt=new Date().toISOString();
  fs.writeFileSync(path.join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
  console.log(JSON.stringify({passed:receipt.passed,sourceCommit:receipt.sourceCommit,sourceTree:receipt.sourceTree,files:Object.keys(receipt.fetchAssets).length,startedAt:receipt.startedAt,completedAt:receipt.completedAt,failure:receipt.failure},null,2));
});
