# ScopeSignal two-file comparison: current PR browser acceptance

Qualified source: Jacob-Met/scopesignal PR 28 at
38e7042dab037cd01227320bc997bf070aea95a7, based on
bab391c7c6fec1193e221997e4d66d89bd914cfd.

All 16 browser assertion groups passed on macOS 26.6.2, Chrome
154.0.8037.98 and existing Puppeteer Core 25.12.0. Node 26.3.0 drove
the browser. The minimum-Node model evidence remains the previously accepted
Node 24.19.0 qualification; root also recorded hosted Node 24.21 CI at 140/140.

The published browser driver is byte-for-byte unchanged. The separate receiver
adapter translates its API to existing Puppeteer. The first Mac attempt found
an adapter name-lookup error on the author button's aria-hidden arrow; v3 uses
Puppeteer's native accessibility tree. macOS headless native select navigation
was independently checked against a plain select: native typeahead works, while
the attempted arrow sequences do not. One select interaction therefore sends
the actual b key, with trusted keydown/input/change events recorded. The fixture
data, every assertion and all application bytes are unchanged.

The successful run makes two actual authoring downloads, opens real files,
checks accepted/pending evidence and capture reconciliation, explicit one-to-one
pairing, reordered/repeated definitions, divergent histories, invalid/oversized/
bad-UTF-8 files, CR/LF admission, competing reads, clear/swap/chooser cancellation,
literal markup, desktop/phone layout, and preservation of the authoring tab.
The parent missing-entry negative control passed. All 102 candidate and baseline
source files remained unchanged. The browser closed and its fresh profile was
removed. No comparison external request or page error occurred.

ACCEPTANCE.json gives exact pins and boundaries. browser-bab-v2 contains raw
receipts, downloads, synthetic fixtures and screenshots. browser-bab-v1 preserves
the failed adapter attempt. The preparation tool timeout, v2/v3 adapter sources
and independent native-select diagnostic remain separate. Prior Linux startup
failures are retained in the PR's current-parent-draft diagnostic record and are
not treated as application failures or as evidence of a specific resource cause.

candidate-bab and baseline-bab are the exact receiving source closures.
check-scope-compare.mjs is a direct copy of the published driver (SHA256
5783f9f7fdf1925cf0550a263ec0e461f8a38cbb95ac16d4cbea752766dc1bec).
The adapter reloads the fresh comparison popup once after its request guard is
attached, before any files are chosen. It does not edit the application.

Visual review inspected desktop-files.png and phone-pairing.png: the chosen
files, amount differences, explicit pairing caveat and controls are readable,
with no horizontal overflow in the measured desktop and phone viewports.
