# ScopeSignal shown-event browser receiving

The practical [54-file review kit](https://drive.google.com/file/d/1SYgZt9kTD9Jp2vTvv54Pts3k6WTxd69o/view) is pinned to [source dcad391d](https://github.com/Jacob-Met/scopesignal/tree/dcad391d11a66a43df32ae1051a48c5ebd22ff34). Its eight focused controlled-DOM/model groups and complete file transfer passed independently. Actual browser receiving is tracked separately here.

## First actual Edge course: incomplete

The first course ran on the verified MSI device under the Veria Windows account using Node 24.19.0 and Edge 155.0.4283.45. It loaded the exact fictional eight-event JSON through the browser file input, observed the maintained page, and exercised mouse and keyboard events through the Chrome DevTools Protocol. It used an owned immutable loopback server and fresh browser profile. This does not claim an operating-system file chooser or execution of the maintained server CLI.

The original outer process exited **1** after 115.84 seconds. Four completed states were retained: initial admission, independently opened events 1 and 8, filters showing events 5 and 6, and Space activation of **Expand shown events**. At the fourth state, events 1, 5, 6 and 8 were open; the two hidden events kept their earlier state. All eight complete saved events, their existing node identities, full-record totals, filter values and announcement were checked at each completed state. The desktop PNG shows the focused Expand button and the two matching disclosures open at 1360 × 1000.

The next **Collapse shown events** control received keyboard focus, but the state checker timed out after its Enter event. The first checker discarded failed polling snapshots, so the exact post-Enter disclosure state was not retained. This is an incomplete course; it does not establish a product defect or a completed collapse/download/narrow-layout result.

Four original files were recovered completely, totaling 155,385 bytes: the receiving JSON, empty browser stdout, 2,788-byte browser stderr, and the 58,217-byte desktop PNG. The narrow PNG and actual downloaded review were absent. The complete failed receipt is 94,380 bytes, SHA-256 `1fbe4ced79ca7b8fdeea20c901dc6ad595e71add17ee09d3539a821b2a906c31`. The desktop PNG SHA-256 is `7d2d77085bd4a0fcea080dce4cdc9c3444124d73fbe4692d3aa377e3a4fa43f9`.

All 56 static inputs, the configuration and both executable identities matched before and after. The browser acknowledged `Browser.close` and its CDP socket closed. The direct child and its output streams did not finish within the 20-second observation window; the observed browser PID still existed at that check. No forced termination was attempted. A later read-only Windows process query found that exact PID absent at **2026-10-17 06:25:54 UTC**. This later observation does not change the original failed cleanup result or establish the process's precise exit time.

## Corrected second course: passed

The second receiver preserves the first source and outputs, uses new controller/configuration/output names, and makes three targeted changes:

- It supplies character text for Enter and Space, using `rawKeyDown` for noncharacter keys. The [CDP input contract](https://chromedevtools.github.io/devtools-protocol/tot/Input/) defines the text fields; [Puppeteer's keyboard layout](https://github.com/puppeteer/puppeteer/blob/main/packages/puppeteer-core/src/common/USKeyboardLayout.ts) maps Enter to carriage-return text. The first receiver supplied no such text. This receiver correction was exercised successfully in the second course.
- It retains the last complete attempted DOM snapshot when a state does not settle, so any subsequent failure includes the observed row and focus state.
- It observes normal browser closure and stream drainage for up to 60 seconds, following the incomplete original 20-second window. It adds no forced termination or browser background-mode flag.

The corrected receiver is 29,835 bytes, SHA-256 `3ab7128af97b68700941e1a44363df074aba70bc2b8d11be2e3afc4e75a90431`. The product source, fictional input and expected complete-review HTML are unchanged. Preparation verifies the original 56 input identities and failed receipt before exclusively creating the new receiver/configuration. The second outer process exited **0** after 140.83 seconds. All eight states completed, and all six original files were recovered intact, totaling **243,391 bytes**. An independent worker reviewed the originals and accepted the complete course; both original PNGs were also visually inspected by the team lead.


### Observed second-course behavior

| State | Shown event numbers | Open event numbers | Result |
| --- | --- | --- | --- |
| Initial record | 1–8 | None | All eight saved events admitted |
| Independent disclosure choices | 1–8 | 1, 8 | Existing individual controls work |
| Three intersected filters | 5, 6 | 1, 8 | Hidden disclosures retain their state |
| Space on Expand shown events | 5, 6 | 1, 5, 6, 8 | Focus stays on Expand; announcement reports two |
| Enter on Collapse shown events | 5, 6 | 1, 8 | Focus stays on Collapse; announcement reports two |
| Query with no matches | None | 1, 8 | Both bulk controls disabled |
| Show all events | 1–8 | 1, 8 | Filters reset without changing disclosure choices |
| Narrow literal query | 1 | 1, 8 | Literal angle-bracket text matches safely; controls fit |

All eight complete event values and the existing event-node references were conserved at every state. Full-record totals and the exact saved evidence remained unchanged. The desktop image is 1360 × 1000; the narrow image is 390 × 1000. The inspected controls stay within the viewport, labels remain readable, and keyboard focus is visible. These images are viewport captures, not full-page screenshots.

The real browser download completed as **scopesignal-record-review.html**, 13,519 bytes, SHA-256 `414e1212721e42d8cd827167090cf446ed5dd2f039f1538d636392bf4c7e52f4`. Its whole body equals the unchanged maintained exporter reference and contains the full eight-event record. It was downloaded while the visible event list was filtered; the filter did not truncate the exported record.

Normal cleanup began at 06:37:08.500 UTC. Edge acknowledged the close request; the CDP socket, directly spawned child, stdout and stderr all closed. The child exited 0 at 06:37:35.652 UTC; the exact observed browser PID was absent at 06:37:35.825 UTC, and the helper server closed. This is a 27.326-second cleanup observation within the corrected 60-second window. It makes no claim about all descendants or other browser processes.

The 56 static input identities, configuration, Node binary and Edge binary were identical before and after. Application exception, console, log and asynchronous-error collections were empty. Edge itself wrote 3,115 bytes to stderr, including renderer-task-provider diagnostics; those original diagnostics are preserved, and no empty-stderr claim is made. Local and session storage remained empty. Page network observations contained only the ten allowed loopback resources.

The practical kit and product code are unchanged by the receiver correction. The existing source offer and review artifacts are ready to use; this verification does not alter the held default branch, Pages configuration or Actions policy. It does not claim a real payment, production deployment, operating-system file chooser or an accessibility audit. Invalid-query retention and replacement-record isolation remain covered by the earlier focused tests, outside this eight-state browser course.
