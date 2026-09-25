# WP-REL-003 Handover

WORK PACKAGE / STATUS: WP-REL-003 — in PR, pending CI and merge.

PR URL + CI RESULT: https://github.com/AtchayamG/arin-jobfit/pull/1; pending.

TAG: v0.1.1 will be created on the protected-main merge commit.

RELEASE URLs: [v0.1.0](https://github.com/AtchayamG/arin-jobfit/releases/tag/v0.1.0);
v0.1.1 draft will be available from the [releases page](https://github.com/AtchayamG/arin-jobfit/releases).

FILES MODIFIED: root/product READMEs; both package manifests and lockfile root
versions; both product CLI sources and E2E tests.

COMMIT: 7cec560 — WP-REL-003: post-publish polish, usage text fix, v0.1.1.

OWNER NEXT STEP: after npm publication, run `cd naukri-mcp; npm.cmd publish`,
then `cd ../indeed-mcp; npm.cmd publish` with npm 2FA enabled. Publish the
v0.1.1 GitHub draft release after both packages are live.
