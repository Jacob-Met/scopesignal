# ScopeSignal — open the original browser results

The corrected receiving course used the delivered [54-file shown-event review kit](https://drive.google.com/file/d/1SYgZt9kTD9Jp2vTvv54Pts3k6WTxd69o/view), unchanged source [dcad391d](https://github.com/Jacob-Met/scopesignal/tree/dcad391d11a66a43df32ae1051a48c5ebd22ff34), and its fictional eight-event record. These three files are the original outputs from that course, each uploaded once and checked against one complete fresh download.

The [complete browser account](https://github.com/Jacob-Met/scopesignal/blob/b0cacf72edfa2330bcf917590c1eefdcf694029b/docs/verification/shown-event-fields-e1438-82/browser/README.md) preserves the first incomplete course, the corrected eight-state result, original records and exact cleanup qualifications.

| Open | What it shows |
| --- | --- |
| [Desktop screenshot](https://drive.google.com/file/d/1oXc9RFmY4YB6xa6sds_Fp2YbXzso7L-U/view) | The 1360 × 1000 viewport with the Expand shown events control focused and the two matching event disclosures open. |
| [Narrow screenshot](https://drive.google.com/file/d/1P0268SbsuBgqZlykEjDRbyZAZG6-gSki/view) | The 390 × 1000 viewport, stacked filters and actions, visible search focus and the literal query result. |
| [Complete downloaded record review](https://drive.google.com/file/d/1D_e61uE_jWsDpjtgCvHVvuMNir9XiJ0h/view) | The original 13,519-byte HTML downloaded while the interactive event list was filtered. It still contains all eight complete events. Download this file from Drive and open it in a browser to read it. |

The HTML review is an offline document with inline styles, no scripts and no external assets. It is distinct from the interactive viewer: it records the complete fictional record, not the current filter or disclosure choices. Keep the original `examples/shown-events.fixture.json` in the kit to reopen the interactive viewer. The record and review are synthetic examples, not payment evidence.

## Reproduce the opening steps yourself

Extract the whole kit and read `OPEN_FIRST.md`. With Node 24 or newer, run `node scripts/serve.mjs` from the extracted root. Open `http://127.0.0.1:4173/record.html`, then choose `examples/shown-events.fixture.json`. Individual event disclosures, literal search, type/checkpoint filters and the two bulk controls can be used together. Bulk expand/collapse changes only currently shown events; Show all reveals the retained choices for previously hidden events.

The accepted second browser course observed eight complete states, real CDP keyboard/mouse input and one complete review download. Existing event nodes and values stayed unchanged, hidden disclosure choices were preserved, and normal browser/stream/server closure was observed. Root visually inspected both viewport captures. This does not claim an operating-system file chooser, a full accessibility audit, a real transaction or production deployment. The earlier first course remains documented as incomplete; its four originals and failed cleanup observation were not replaced by the second result.

## Exact delivered files

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Desktop PNG | 58,217 | `7d2d77085bd4a0fcea080dce4cdc9c3444124d73fbe4692d3aa377e3a4fa43f9` |
| Narrow PNG | 40,351 | `02000859b760342c763fbb1c45560e6252c2118c245f9b6c44f5e7295f579857` |
| Complete review HTML | 13,519 | `414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4` |

The screenshots are viewport captures, not full-page images. The HTML is the whole original downloaded document; no conversion, regenerated report or browser replay was used for delivery.
