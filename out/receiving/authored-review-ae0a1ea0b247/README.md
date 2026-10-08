# Authored ScopeSignal review receiving

ScopeSignal issue [#20](https://github.com/Jacob-Met/scopesignal/issues/20)
adds a portable HTML review of the current fictional authored workspace. The
existing workspace serializer and private replay remain its source of truth.
The exporter does not introduce another ledger or restore path.

## Source

- Original native baseline: `8a241c9ce409fa9b22ab0bbdc339e46fd4b38525`.
- Receiving parent: actual PR #22 merge `65d47f90e609c36f51648c303e06f74a1d95f856` on `paypal-ai`, tree `88073a0984b05b629d85563ae2e113e6c932e8ec`.
- The small local closure contains 44 exact parent Git blobs. `source-pin.json`
  inside the archive records every input; the local snapshot commit is not a
  proposed canonical ancestor.
- Independent source/native acceptance: local candidate
  `e60084d731d441e00efdda680f288fb3e711803a`, exporter blob
  `6b4ad847283ffb275e99634982dd515f5bc604f5`, controller
  `9877f98ae1a5f0853afe9d1bd6d84f9f84548562`, HTML
  `162c570f09e9e0d02d066fc44e36e8fdcd04d85c`.
- The final print supplement at `c32f4e6f319ad1a9b46b3a496feaf2017bd3318f`
  changes only two exporter literals: print styling and the raw integer-cent
  explanation. Final exporter blob is
  `d5e56a7a3f1608a1927bce2c08c1f787bf50e2ad`.

The product delta is one new exporter, one controller import and separate
synchronous download handler, one button/help addition, tests, an optional
browser receiver and README usage. Workspace codec, scope model, ledger,
fixed-example reader, dependencies and workflows retain their parent bytes.
The separately owned #18 native-field/open-intent repair retains those regions;
the export consumes the current codec without modifying it.

## Executed evidence

- The exact parent passes all 107 native Node 24.19.0 tests. The final
  contribution passes 115, including eight added contract groups.
- Actual baseline Chromium preserves its JSON download and has no portable
  review control. Actual candidate receiving passes six browser groups:
  keyboard draft download, mixed review and every event field, preparation
  refusal/retry, preserved open preview, phone layout and offline reading,
  and real Chromium PDF output. Ten browser downloads include exact before/after
  JSON comparisons; repeated reviewed HTML downloads have identical bytes.
- The independent receiver passes six distinct source/native groups with eight
  checkpoints and 19 interleaved events. Its tokenizer checks all 706 passive
  HTML elements, exact evidence and event fields, seven source refusals and
  caller preservation against independently calculated amounts and journal.
- The browser received all loaded production files by recorded SHA-256.
  Desktop and 390-pixel views were inspected visually, with no horizontal
  overflow. External requests were blocked; the original page's Google Fonts
  attempt is recorded. The downloaded document has no external resources.

The original PDF exposed two presentation issues: ambiguous raw `amount` units
and event fragmentation. The final HTML explains integer cents and prints the
bounded example's complete event records together. Print attempts and their
failures are retained separately; they are not counted as complete print passes.

The final PDF is `browser/print-final-2/review.pdf`, SHA-256
`2727dacb20fe933f18184f5fe0677a7458f0100bf5ccdeb089e1efb8df97e0b2`,
seven pages, produced from the unchanged actual browser-downloaded workspace
SHA-256 `c9999559cd8bca2a4aef3888edb94444a8b3b4c7612f2edf67d0e69f948e96de`.
The original PDF and independent ten-page inspection remain in the packet.

## Current-owner receiving and final print review

PR #22 merged its field/open-intent repair before this contribution. The receiving
controller removes exactly our import and separate download listener back to
owner blob `adc9bb3e53ffa72671a8f46e9b067b879ac3adff`; the owner codec
`d9141b3e1ac74b33f996ec6d68756ece5c190162` and nine owner tests are unchanged.
The joined controller is `a4d665d42bd145936be71197f6c57a41cce56e5f`.
The final native suite passes **124/124**; the same six actual-browser groups
pass on this receiving source. Its downloaded reviewed HTML SHA-256 is
`24e91e2ee4eb31c7df8f8daf6b5e266574a11992574f5bb0fe7b4ea8f91320ea`,
byte-identical to the independently inspected final print input.

Root rendered and visually inspected all seven pages of the exact final PDF.
All event cards stay intact, the cents note is clear, and no clipping or overlap
was observed. The exact receipt SHA-256 is
`7b6e4d681c5d7bd39bbec710775b1dc14c4bfca22cc5bb905ea8c1b8ba61282a`;
representative pages 4 and 6 and all raster hashes are retained. This acceptance
retains the explicitly bounded font limitation below.

## Limits and retained failures

The HTML retains literal Unicode. This sandbox's installed DejaVu fonts lack
the authored compass U+1F9ED: the printed PDF shows a missing glyph and text
extraction returns NUL there. No complete Unicode PDF fidelity is claimed.
Keep the HTML and workspace JSON for exact text. No fonts, packages, providers
or other dependencies were installed to change the receiving environment.

Two initial author expectations were corrected without a product change:
native approval trims its input before recording, and a regular expression
incorrectly classified escaped literal `src`/`href` text as a resource.
Initial source/tests and the development receipt are retained. The independent
receiver's initial untracked-helper precondition stop is also retained.
The print-only receiver initially blocked its own `file:` navigation; it was
corrected to allow the local artifact while refusing network requests.

All inputs are fictional. This qualifies software behavior, not real human
approval, payment, identity, a physical printer or any provider integration.
Source integration and the existing automatic Pages workflow are reported
separately on the native issue/PR, not inferred from these local results.

## Reproduction

Run `npm test` with Node 24 or later. With an existing Playwright/Chromium,
set `SCOPESIGNAL_PLAYWRIGHT`, `SCOPESIGNAL_CHROME` and an isolated
`SCOPESIGNAL_EVIDENCE`, then run
`node scripts/check-scope-review-export.mjs`. `SCOPESIGNAL_BASELINE_REF`
optionally serves an exact local Git snapshot for the missing-feature control.

`receiving-evidence.tar.gz` contains raw logs, receivers, exact inputs and
downloads, source pins, independent reviews, screenshots, PDF attempts and
per-file SHA-256 manifest. `archive.json` pins the archive bytes. No live or
private user artifacts were read.
