# ScopeSignal local font receiving and portable delivery

The product repair is commit `7c2e70d756734ff49f693a84b43b9660be542962`.
It removes the remote font import, makes the browser gate refuse all external
attempts, and documents the existing installed-font stacks. This directory
retains the delivery support and exact receiving evidence for that repair.

`START-HERE.txt` and the two launchers are intended for the downloadable package,
where an adjacent `app/` directory contains the exact 44 runtime files listed
in `SOURCE-MANIFEST.json`. They do not launch from this evidence directory in a
full repository checkout. The package is assembled by copying those files from
the pinned product commit, keeping their original paths under `app/`, then
placing the guide and launchers at its root. The repository's existing
`scripts/serve.mjs` remains unchanged. No dependency installation is needed to
run the application with an existing Node.js 24 or newer installation.

`EVIDENCE.txt` distinguishes the original external-font failure and cleanup
timeout from the candidate's clean 21/21 native result. Native receipt bytes
were recovered from MSI and checked against their process-record hashes. Every
runtime digest from both native copies is bound to the published source; the
original comparison differs only by its retained original stylesheet.

The native runner scripts preserve the executed procedure. Their temporary
base64 carrier and machine-specific browser/module locations are transport
inputs, not part of the application. The two strict browser receiver files are
retained for inspection; running them requires an available native Chrome and
Puppeteer Core module. The package's ordinary launcher does not depend on them.

The independent portable review covers the shell launcher's real working
directory and error behavior and a static review of the Windows CMD launcher.
`evidence/portable-launch-receipt.json` then records an actual launch of a fresh
ZIP extraction from a foreign directory containing decoys and spaces/Unicode:
all 44 HTTP bodies matched source, the missing route returned 404, and the owned
server stopped. This package's CMD launcher was not executed on Windows.

This support increment adds files only. It does not change product source,
default-branch policy, or the separately held installed release.
