# Independent Windows receiving: startup boundary

The current ScopeSignal Undo composition remains bb8ade4a133b1499c29441178fcc6cf6ed858c4fa731e1c4d7cfa320551c42cb (controller) and eb083506992aea01ade9fa529017e308c627d7bc5dbe57ab7bf5d8ef871f81b7 (HTML), with fourteen source inputs pinned in source-binding.json. This receipt records a native launcher failure, not a production behavior result.

On 2026-10-08 at 19:26:48–19:27:12 UTC, the independently authored file/lifecycle receiver ran through installed Node v24.21.0 on DESKTOP-LA7CMTA, launching installed Chrome 154.0.8037.98 in a fresh task-owned profile. Chrome did not create DevToolsActivePort. No case executed. The complete result is RECEIVING_ERROR, exit1; its 6,413-byte result.json SHA-256 is 122929632b46dfdcb44c1140e8aa9a6609305ed716bf82285ff5ba1fdf5c56fa. All application source bytes remained unchanged. The owned browser was terminated and the fresh profile removed.

The original Linux driver is 067bc57f467b1dddd8be324fb55e0f33615d8ba6bf1cda0220e9b3e1a98eeaf9. The distinct Windows adapter is 30786c9fc3960339a484ad8a5ccceeaa6f5ef1fb55401717ca47e24fc5b3ebbd (Git blob b6163bcedd7201eb591928e312900170da9c27b7). All three case bodies remain byte-identical: 5,192 bytes, SHA-256 dcba4d10d6b57ef20751bbf55713e269c5e4d06b6de02c8dcd61aeb859a90d2b. Only host/browser/evidence-parent selection, platform reporting, file URL encoding at CDP dispatch and profile-budget plumbing differ. Runtime independently read the actual diff and accepted this bounded adapter.

The profile was sampled 78 times at 250 ms, with observed peak 64,932,954 bytes. A conservative 80 MiB stop threshold sat below the authorized 96 MiB limit; cache hints were 1 MiB. Sampling is not a filesystem quota. Source and retained receipts were far below the authorized 25 MiB bound.

Chrome's exact log reports that remote debugging requires a non-default data directory despite the explicit fresh --user-data-dir. It also reports failures creating long nested profile icon directories. A later read-only Windows known-folder query returned LocalApplicationData unresolved, length0. Official nearby Chromium tag154.0.8037.73 sources return unknown if default data-directory resolution fails, and treat unknown as default for debugging admission. This supports a bounded inference about the observed SYSTEM-context startup boundary; it does not prove the installed154.0.8037.98 source or establish long-path failures as the sole cause.

Primary source paths:
- https://github.com/chromium/chromium/blob/154.0.8037.73/chrome/browser/devtools/remote_debugging_server.cc
- https://github.com/chromium/chromium/blob/154.0.8037.73/chrome/common/chrome_paths.cc
- https://github.com/chromium/chromium/blob/154.0.8037.73/chrome/common/chrome_paths_win.cc

No browser policy, registry, environment, account identity, installed source, existing profile or application source was changed. No debugging-check bypass was attempted. One earlier PowerShell quoting failure occurred before any native transfer file or browser existed; corrected bounded chunks were reassembled and hash-verified before execution.

The complete 36-member startup-negative.json.gz is 153,898 bytes, SHA-256 f595b91735570e4aeb4f58207c5424b62ab945e4c767cfa857419fc4b5e21ef7, Git blob597d33dded981ce1beb7bce74121855aa45cd936. It preserves source, driver, launcher, original packet and transfer bytes, raw output, result and browser log. Its exact manifest is Git blobd0d9684c3e442233e94245cb13fb73b7bb605822, SHA-256 06262805faf6e22c8a8e014d9b8a7fa7e98e5b0ffa84b91ed17491fdb1dcb45c. Both have durable native custody under C:\Windows\SystemTemp\hamon-scopesignal-independent-ac386303dce2-6625f054-40dc-4417-bd20-4002d1c26c88.

Original ThinkPad receiving (3/3 PASS), current ThinkPad composition receiving (1 PASS and two native-download timeouts with storage diagnostics), and this Windows zero-case startup result remain distinct. None was normalized into a successful current browser qualification. The current receiving gate remains open pending an ordinary usable browser route.
