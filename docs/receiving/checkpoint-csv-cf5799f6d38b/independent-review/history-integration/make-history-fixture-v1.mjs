import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {encodeScopeWorkspace,decodeScopeWorkspace} from './baseline-contract/src/scope-workspace-record.mjs';
import {createScopeReview} from './baseline-contract/src/scope-plan.mjs';
const originalDraft={label:'PEER previous reviewed scope',brief:'Retain this active fictional review while another draft is prepared.',cap:'30.00',checkpoints:[
 {title:'Prior approved checkpoint',amount:'10.00',evidence:'Original planned evidence'},
 {title:'Prior unfinished review',amount:'5.00',evidence:'Other planned evidence'}
]};
const review=createScopeReview(originalDraft);
review.act('scope-1','approve','Distinct accepted evidence\nwith a second line');
for(const action of ['order','request','lose'])review.act('scope-1',action);
const contents=encodeScopeWorkspace({draft:originalDraft,review,evidenceDrafts:new Map([['scope-2','  Pending unapproved note\nkept literally  ']])});
const received=decodeScopeWorkspace(contents),state=received.review.snapshot();
if(state.events.length!==4||state.approved!==1||state.captured!==0||state.checkpoints[0].captureStatus!=='unknown'||received.evidenceDrafts.size!==1)throw Error('Native fixture disagrees with declared integration oracle');
await writeFile(new URL('./history-native-fixture-v1.json',import.meta.url),contents);
console.log(JSON.stringify({runtime:process.version,bytes:Buffer.byteLength(contents),sha256:createHash('sha256').update(contents).digest('hex'),events:state.events.length,approved:state.approved,captured:state.captured,captureStatus:state.checkpoints[0].captureStatus,pendingEvidence:[...received.evidenceDrafts]}));
