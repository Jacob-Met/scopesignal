# Current ScopeSignal history integration receiving

One actual Chromium flow passed all four sequential phases on the exact prepared source commit `75229a22b6a0190b1cd8f56a70312d357d49981e` (tree `3f10a79e87edfec89f19340e55e891bb84bfcf47`). The flow exercised the real revision download, actual file reopen, and native checkpoint duplication controls while a historical prefix was selected. It finished with exit code 0 in 5.879535701998975 seconds, with no timeout or page errors.

This is a bounded independent integration result. The earlier authored suites and screenshots retain their original historical source pins and counts; this receipt does not relabel those executions as tests of the current composition. No additional suite or browser replay followed the four-phase result.

## What the flow established

| Sequential phase | Observed result |
| --- | --- |
| Active approved/unknown review with history at zero | A fictional two-checkpoint review had one explicit approval, a created order, a capture request and a lost-response event. The active review showed approval 1 / 2, unknown capture, and zero captured. Selecting historical point 0 showed historical approval 0 / 2 without changing the active review. An ordinary file-open preview was pending. |
| Real revision download | Clicking the actual Download revision draft control produced a draft-only JSON file with exact original raw terms and no prior events or evidence drafts. The active state, history cursor and pending file-open preview were preserved. Ordinary current-workspace downloads immediately before and after the revision download were byte-identical. |
| Actual revision reopen and duplicate control | Applying the actual downloaded revision cleared the previous history and evidence. Clicking the native duplicate-first-checkpoint control created three draft occurrences with exact fields in original ordinal order [0, 0, 1]. Beginning the new review produced no inherited approvals, events, capture state, or evidence, despite the repeated title and same plan label. |
| Approval belongs only to the newly copied occurrence | Explicit approval of the fresh copied occurrence, scope-2, produced the new review's only event: sequence 1, checkpoint.approved. Its new accepted text belonged only to scope-2; scope-1 and scope-3 remained unapproved. Selecting the new historical point 0 removed the approval from the historical display while the active review remained at 1 / 3. Original downloads remained unchanged. |

The immutable oracle includes repeated checkpoint titles, literal angle-bracket text, leading newlines, whitespace and original numeric spellings, original accepted text and an unapproved pending note. The probe uses fictional local state and the application's real controls. It does not infer occurrence identity from a title.

## Exact original evidence

[packet.json](packet.json) is the complete original canonical native export, without an added trailing newline:

- Schema: `scopesignal.history.current-browser-evidence-export-v1`.
- 71,407 bytes; SHA256 `a5d885f41090d08e7c3ee2a77f738f8347528e693ba7d5b2e177496e8068a9c9`.
- All 13 original files are present, totaling 51,487 decoded bytes, with zero missing files.
- Every file retains its original path, byte length, SHA256, mode and complete `content_base64` bytes.
- The original gzip transport was 21,911 bytes, SHA256 `151b9f71ab786b1a4892403640aff1165bd48b7ca87b06214ea41c5277d3a846`. The canonical export and transport were losslessly reconstructed and compared before publication.

The 13 originals comprise the frozen probe, oracle, source index, receiving wrapper, invocation, stdout, stderr, execution record, complete native result, and four actual downloads. The empty stderr file is retained. The native result records source readbacks, actual served inputs, each assertion, runtime, network observation and console messages.

| Original evidence | SHA256 |
| --- | --- |
| probe-current-history.cjs | b6520d9f0e4c225e800ac6bf23f7bfbc2cf64e90bdb01a9276a5515b7a931030 |
| oracle.json | e91549ed599d3f67ba45d81bb1696ebd5cc20de043b3caebb392f0c772f71b85 |
| source-pins.json | 7247a5982fc20a78903a95115be19e59cce2e915caf623c472df7c24559f8d49 |
| receiving-wrapper.py | 45b75f60329e3c504db2e5a7675a62c449892fb972f806d64ca6cd603907b7fa |
| output/result.json | e1f2ba3240fa6ecdd16ddc144759ea3ff46a302fa4d1cb32153b78b6b7cf49a1 |

The probe/oracle/source-index/wrapper packet was frozen before execution. Its original XZ container was 8,960 bytes, SHA256 `26418032e961899c91a78e7db97b2ecffb1297505c50a18eda275db470d16732`; its decoded content was 30,703 bytes, SHA256 `8f7971131c0e998572be7e85cee919b7b94c0f92094e798b861e93eefed2fcad`. All four underlying original files are retained losslessly in this native export.

### Actual downloads

| Export path | Bytes | SHA256 |
| --- | ---: | --- |
| output/downloads/01-original-current.json | 1,574 | 2653cd62d944ca72e9f8c3d7d732611f0cd7b16824cc238c320044b9a83c04ae |
| output/downloads/02-actual-revision.json | 609 | 3b309a28a568ad3753a1b61a25bc277f23d3d25685e871664dbd1386607c9b4f |
| output/downloads/03-current-after-revision.json | 1,574 | 2653cd62d944ca72e9f8c3d7d732611f0cd7b16824cc238c320044b9a83c04ae |
| output/downloads/04-fresh-copy-approved.json | 981 | e5e098878268050ab0eebf4774d30162f13ec7306c2b22c4d9f68077a71d6bda |

The ordinary downloads used the application's suggested filename `scopesignal-workspace-v1.json`; the revision used `scopesignal-revision-draft-v1.json`. The numbered evidence paths distinguish the actual downloads without changing their bytes.

## Source and runtime boundary

All 13 actual runtime inputs, totaling 100,766 bytes, were reconstructed from the immutable source commit above and verified against Git blob, SHA256, byte length and mode. Before/after pins matched, and actual served inputs matched the declared closure. The complete map is in the original `source-pins.json` and native result; source contents remain in the immutable commit instead of a duplicate source archive.

The closure includes `scope-history.css`, `scope-workspace.css`, `styles.css`, `scope.html`, and the actual controller, plan, workspace record, review export, ledger, payment status, history model/view and revision-draft module. In particular, `src/scope-revision-draft.mjs` is explicitly bound: Git blob `e94e190710a7902b816184333bb40ad2ed90bcc0`, SHA256 `56d4e15441a28676d53d1ce10d73c363c43246f1057251895fec255c0283d61e`. The controller Git blob is `2552977c7e01c32bc5621ddf192a9b14a3387eb3`, SHA256 `d68ede63929fba3a5d77e2db20229261ac553e8edfa16f7e7d05428265a70fac`.

The existing local runtime was Node v24.19.0, Playwright 1.62.1 and Chromium 153.0.8010.0. Their executable/module paths and actual invocation are preserved in the export. A new private persistent Chromium context used an exclusive local receiving directory; no previous browser profile was reused. The wrapper served only the declared files over its own local HTTP server, captured its one Node child and browser outcome, and exported all originals before the ephemeral directory ended. Reported PID 5 is the local Node process identity, not a Mac receiving process.

No provider, account or payment endpoint was called. This flow did not run on the remote Mac, deploy a site, exercise hosted operation, or qualify installed state. The original core ledger and workspace codec source remained unchanged.

## Inherited font request and console error

One external GET stylesheet request was observed and blocked by the private receiver:

```text
https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,500;0,600;1,500;1,600&display=swap
```

The native result identifies it as the inherited Google Fonts request and retains the corresponding console error:

```text
Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector
```

There were zero page errors. The result does not claim zero external requests or zero console errors, and does not establish external font availability.

## Lossless verification and preservation

The complete original export survived in tool memory. After successful browser receiving, an attempt to materialize a compact archive on the shared local filesystem failed with ENOSPC and left a zero-byte stub. That stub is excluded. The original native result, downloads, probe and execution were not altered or rerun in response. This publication uses the verified original export directly from memory.

A reader can verify the envelope and every original without executing the application or writing decoded files:

```python
import base64, hashlib, json
from pathlib import Path

raw = Path("packet.json").read_bytes()
assert len(raw) == 71407
assert hashlib.sha256(raw).hexdigest() == (
    "a5d885f41090d08e7c3ee2a77f738f8347528e693ba7d5b2e177496e8068a9c9"
)
packet = json.loads(raw)
assert packet["missing"] == []
assert len(packet["files"]) == 13
seen, total = set(), 0
for entry in packet["files"]:
    assert entry["path"] not in seen
    seen.add(entry["path"])
    value = base64.b64decode(entry["content_base64"], validate=True)
    assert len(value) == entry["bytes"]
    assert hashlib.sha256(value).hexdigest() == entry["sha256"]
    assert entry["mode"] == "0o644"
    total += len(value)
assert total == 51487
print("Verified 13 original files, 51,487 bytes")
```

The frozen probe, invocation and wrapper provide the original receiving recipe. The prior execution count remains one; reading this packet adds no test result. Source reconstruction should use the exact immutable commit and the 13 path-level pins before any separately authorized future execution.

[publication-manifest.json](publication-manifest.json) maps the original 43 publication files unchanged plus this README and the complete packet. It excludes only its own recursive entry: 45 mapped files, 46 owned files including that manifest. The additive evidence commit preserves every one of the 561 existing leaves in its prepared parent and adds exactly these three current-native files.
