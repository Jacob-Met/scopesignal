import fs from 'node:fs/promises';
import {encodeScopeWorkspace} from './baseline-contract/src/scope-workspace-record.mjs';
import {createScopeReview,validateScopeDraft} from './baseline-contract/src/scope-plan.mjs';
const f=JSON.parse(await fs.readFile('./baseline-native-fixtures-v1.json','utf8'));
const d=f.accepted.find(x=>x.id==='literal-CRLF-BOM').draft;
const a=f.accepted.find(x=>x.id==='unfinished-"1e3"').draft;a.checkpoints[0].amount='1.00';
console.log(JSON.stringify({literalValidation:validateScopeDraft(d),literalReviewedEncoding:encodeScopeWorkspace({draft:d,review:createScopeReview(d)}),correctedValidation:validateScopeDraft(a),correctedReviewedEncoding:encodeScopeWorkspace({draft:a,review:createScopeReview(a)})},null,2));
