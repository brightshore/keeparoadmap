# Roadmap

Last reviewed: 2026-11-14

This is where Ferry is headed. It's a plan, not a promise: items move as we
learn more, and nothing here has a date. Work that has shipped is listed in the
[changelog](CHANGELOG.md). To suggest something, open an issue.

## Now

- **Windows support.** Run the same `ferry` commands on Windows, with a copy
  fallback wherever symlinks aren't allowed. [#214]
- **Faster first sync.** The first sync of a large home folder takes minutes;
  caching file hashes should bring it down to seconds. [#198]

## Next

- **Encrypted secrets.** Keep tokens and SSH config in your dotfiles repo,
  encrypted at rest and decrypted only on machines you trust. [#156]
- **Per-machine overrides.** One repo for every machine, with small differences
  for each one and no long-lived branches. [#173]
- **Plain-language errors.** Every error says what went wrong and what to try
  next, instead of printing a stack trace. [#220]

## Later

- **Package lists.** Reinstall your Homebrew, apt or winget packages on a new
  machine along with your files. [#240]
- **Sync hooks.** Run your own scripts before and after a sync. [#131]

## Not planned

- **A hosted sync service.** Ferry works with any Git remote you already have.
  Running a service would take time away from the tool itself. [#102]
- **Automatic background sync.** Syncing on every file change made conflicts
  silent and hard to undo, so syncs stay something you start. [#119]

[#102]: https://github.com/ferry-cli/ferry/issues/102
[#119]: https://github.com/ferry-cli/ferry/issues/119
[#131]: https://github.com/ferry-cli/ferry/issues/131
[#156]: https://github.com/ferry-cli/ferry/issues/156
[#173]: https://github.com/ferry-cli/ferry/issues/173
[#198]: https://github.com/ferry-cli/ferry/issues/198
[#214]: https://github.com/ferry-cli/ferry/issues/214
[#220]: https://github.com/ferry-cli/ferry/issues/220
[#240]: https://github.com/ferry-cli/ferry/issues/240
