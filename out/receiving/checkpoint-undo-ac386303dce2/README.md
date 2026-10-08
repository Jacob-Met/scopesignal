# Last checkpoint removal: source and receiving

This packet adds one-step Undo to the existing authored draft. It restores the removed checkpoint's exact field strings and original position without requiring an earlier saved file. Later draft edits, structural changes, entry to review or an applied workspace replacement retire the action. Downloads and invalid/canceled file previews preserve it. Recovery remains in this tab's memory.

The original base was 847505d2fe9f8295110fc13a3fb9e05ec71f6644. The initially qualified candidate above it had controller SHA-256 676c4b3d331cfb8efe7a62cccbb7420de583271f3865e3270e2ddfdc8cd47db1 and HTML SHA-256 b663dad1e86d86c827efb547a6f2337a9940c3c9b5b21d6192c8020964a0a94b. The published candidate receives current authored-history mainfb6d8771db190fc6499db0c63644ef8a016fe7b7 (tree48f0cdfd20f79ab96893de6d0adb5d23cdcab5a6). The only three-way conflict was adjacent top-level declarations. Both current scopeHistory and checkpointRemoval declarations remain; all history imports, renderReview and clear behavior are preserved. No provider, payment, ledger, codec or workflow source changes.

| Published candidate | SHA-256 | Git blob |
| --- | --- | --- |
| src/scope-workspace.mjs | bb8ade4a133b1499c29441178fcc6cf6ed858c4fa731e1c4d7cfa320551c42cb | 33628aebe7279fe7f1a97a796b65e53ec1a8ac4a |
| scope.html | eb083506992aea01ade9fa529017e308c627d7bc5dbe57ab7bf5d8ef871f81b7 | 67879a2a202d147cd556233b7ec12450d24eeeeb |
| README.md | 90b7d1834646de6395130c34caf325d2b2aeebb569ac9660999d36373821736b | f1c1fa4bbd621f30d9b70ab746d84355d634884e |
| scripts/check-scope-checkpoint-undo.cjs | 698d1c9eae4c69a5d5fe7b707e950e8954a2a674ad322ee4fdda582c696405b9 | 65615a4333f274846ffdd5d4a0821e979b201d06 |

## Exact controls and native receiving

- Original two-case before-control: both complete/unfinished removals lack Undo; existing Remove, raw data, save and minimum bounds pass. The same probe passes2/2 on the initial candidate.
- Original expanded before-control:12 missing-Undo failures and1 existing-control group. The unchanged thirteen-group probe passes13/13 on the initial candidate.
- The maintained executable runs those same thirteen groups through its real file entry;13/13 pass both on the original candidate and on the current history composition. Current raw report SHA-256:75c533e4ce851da0dde6aa29cc66daf8c8403a02bbeba1b799b0429fdb9f577f.
- Independent original receiving:3/3 distinct native file/lifecycle cases pass, including imported locked uncertain-capture history, saved-draft immutability across Undo/reload/reopen and actual script-free HTML export. The separate contributor's exact receipt is independent-qualification.md.
- Independent current source preservation: all six incoming files and twelve unscoped application inputs match current main; the exact prior Undo delta is retained.
- **Current independent native download receiving is held:** the unchanged independent probe passed its first group and timed out on two later downloads. Full source, raw results, browser diagnostics, completed downloads and launcher output are retained in current-independent-negative.json.gz. Chromium reported download-database/cache write failures; a contemporaneous small author write returned ENOSPC. This is an observed native I/O boundary, not a current3/3 pass or a proven production source defect. See current-independent-boundary.json.

The ordinary alternate Windows route also stopped before any case: installed Chrome154 refused debugging in the native service context, despite a fresh owned profile. The complete zero-case startup result, original adapter and source, browser log, measured profile peak and successful cleanup are preserved in windows-startup-negative.json.gz and windows-startup-boundary.md. A later read-only known-folder query supports a bounded context inference; no installed policy, account, registry or environment was changed. This is not a Windows behavior qualification. The current independent browser gate remains held.

The successful ThinkPad browser runs used Node22.22.1 and installed Chrome153.0.8010.47 in fresh owned profiles, with fictional loopback inputs. Source remained exact, browser exit was0 and profiles were removed. Google Fonts requests were explicitly blocked. ScopeSignal declares Node>=24; ordinary published-tree hosted CI remains a separate gate. No existing browser profile, provider account, live service or another worker's source was changed.

The expanded suite uses native keyboard input, downloads and file selection. One labeled case holds only completion delivery after a real File.arrayBuffer read has finished. Hidden/disabled synthetic clicks are used only to assert no effect. The before-removal saved JSON is an independent serialization oracle; it does not imply that deliberately reopening an older saved file is broken.

## Lossless custody

| File | Contents | SHA-256 |
| --- | --- | --- |
| original-evidence.tar.gz |185 payloads plus manifest:158 original author files,24 independent files and3 author metadata files |39db7d48ecc88b22878900906da992635618c1f579ffe7f8808a89a944a54b83 |
| current-author-evidence.tar.gz |65 original current composition/source/merge/native-receiving files plus manifest |27144a97676da841c958402fd9999d50eae72c300dcbec85db63c4c104651277 |
| current-independent-negative.json.gz |26 complete independent current-run members, including original source/probe and raw negative |4737cc350717979af2539fcce3ef77d9c0b84b90795deecb4ea42345b7753462 |
| windows-startup-negative.json.gz |36 complete Windows adapter/source/launcher/startup members; zero cases |f595b91735570e4aeb4f58207c5424b62ab945e4c767cfa857419fc4b5e21ef7 |

The tar archives use deterministic USTAR metadata and were decompressed and checked member-by-member against original bytes. The JSON capsule's manifest binds each decoded member. Original environment failures, earlier accepted sources and all negatives are retained. No result was normalized into success. Native originals and compact custody also remain in the contributor's unique ThinkPad receipt/capsule paths recorded by the manifests.

Claim:https://github.com/Jacob-Met/scopesignal/issues/34 . Root registered the source scope before edits; neighboring authored-history ownership was explicitly respected. Final current-tree receiving, normal hosted CI, root merge and the existing automatic Pages deployment are separate gates. This packet does not claim the public page or an existing visitor tab has loaded the candidate.
