# Download a saved fixture record review

Open `record.html`, choose a saved ScopeSignal version 1 fixture-record JSON file,
and inspect the admitted record. Choose **Download record review** to save
`scopesignal-record-review.html`. Open that file directly in a browser to read
offline, print it, or use the browser's **Save as PDF** destination.

The original JSON retains its exact file bytes, formatting and escape spellings;
this review preserves admitted values and saved array order.

The download contains the complete record currently displayed: its literal file
label, schema and fixture metadata, totals, every checkpoint's recorded approval
and capture fields, and every recorded event field in saved order. An absent
approval or identity remains explicit `null`; booleans remain `true` or `false`.
Amounts are labeled **USD integer cents**, so `40000` means $400.00. Approval
counts and event sequence numbers are ordinary counts. T+ values are sequence
markers, not clock times. A pending or unknown outcome stays uncounted, and a
duplicate receipt remains visible without counting the capture twice.

This is an unsigned synthetic fixture review. It does not verify authorship,
human action, identity or a real payment. The file has no scripts, external
assets or payment controls. It is a readable snapshot; keep the original JSON
to reopen the interactive viewer. The HTML does not import a workspace or
replace the active fixture.

## Preserve the review you opened

Downloading leaves the current view and pending file reads in place. If another
file is still being read, the download uses the record already displayed. Wait
for the replacement to open, inspect it and download again to include that
replacement. Refused file selections keep the previous record's download
available. **Clear view** removes the displayed record and its download control.

The report includes all recorded events regardless of any separate history or
filter view. Accepted evidence comes only from the admitted record, not from
unapproved editor text. The exporter calls the same unchanged strict
`readFixtureRecord` admission used by the viewer.

Literal Unicode, leading line breaks, tabs, and CR/LF values are preserved in the
HTML text. NUL and unpaired UTF-16 surrogates cannot be retained by HTML, so their
presence in a field or file label refuses the download. The original JSON and
opened record remain available. A preparation failure is shown beside the
button and can be retried. Local browser fonts determine printed glyphs; keep
the HTML and original JSON when exact characters matter.

## Check the exporter

Requires the project's existing Node.js 24 or newer runtime, with no packages
to install:

```sh
node --test tests/record-reader.test.mjs tests/record-review-export.test.mjs
```

The focused tests cover all eight fixture-history prefixes, every scalar saved
field, partial and unknown outcomes, duplicate receipts, native admission,
literal text escaping, refusal without mutation, deterministic output and the
absence of active or remote content.

## Receive actual browser downloads

The optional maintained receiver uses Python with the existing Playwright
package and an existing Chrome/Chromium executable. It does not install a
browser or packages. Use a fresh output directory outside the source tree.
The source directory must contain the existing record viewer and its local
module dependencies; a Git checkout is suitable.

```sh
python scripts/check-record-review.py --source . --output /path/to/new/evidence --chrome /path/to/chrome
```

On the received Windows route, the equivalent uses `C:\Python314\python.exe`
and `C:\Program Files\Google\Chrome\Application\chrome.exe`.
Pass `--baseline` only for a retained original source without the new download
control. Optional `--fixtures /path/to/existing/fixtures` reuses exact previously
frozen JSON inputs instead of generating new fictional records.

The receiver serves the chosen source on loopback with an explicit JavaScript
module MIME type and uses a fresh browser context. It prepares fictional records
through the unchanged ledger/exporter, checks actual file selection and
downloads, opens HTML offline, compares literal text and complete raw fields,
and exercises refusal, pending-read preservation, keyboard use, 390px layout and
browser PDF printing. It retains source hashes and a result receipt along with
the actual JSON, HTML and captures. External page requests are refused. This
does not assert physical mobile, assistive-technology, printed-paper, deployed
website or installed-application acceptance.

The first original receiving attempt on MSI stopped before fixture creation
because its fixture HTTP server did not label `.mjs` as JavaScript. That
prerequisite failure is retained separately. The corrected original receiver
established the working viewer and absent download action before candidate
exposure. It is not a product failure.
