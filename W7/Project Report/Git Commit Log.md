# Git Commit Log — Week 7 (Project Week 4)

`git log` output for individual contributions by `nqhieu-gd` merged into `origin/dev` from `2026-11-23` to `2026-11-27` (110 non-merge commits across PRs #68, #71, #72, and #73), generated with:

```bash
git log origin/dev --author="nqhieu-gd" --no-merges --since="2026-11-20" --stat
```

```text
commit e84cd9d65652d9abeba75c81ee146bf4874cfc1d
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 27 00:59:57 2026 +0700

    docs(week4): gate Gate A/D and PKG-01 on wiring 9 remaining v22 IPC stubs (#59/#61)

 docs/week4/W4_FINAL_RELEASE_SIGNOFF.md | 24 ++++++++++++++++--------
 1 file changed, 16 insertions(+), 8 deletions(-)

commit baf0c6003ceaf2d510c82f2708ef8e9aa2f1bb46
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 27 00:59:53 2026 +0700

    docs(week4): sync all J1-J5 UI labels, use brace-OR code query, and note 9 IPC stubs

 docs/week4/W4_DEMO_SCRIPT_J1_J5.md | 31 ++++++++++++++++---------------
 1 file changed, 16 insertions(+), 15 deletions(-)

commit 2dd3cdaaa282e3d7c177a39381b84b7d42adedc8
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 27 00:12:09 2026 +0700

    docs(week4): add Gate A-E final release sign-off report for dev@ef79fd9 (W4-07 Task 3.8a)

 docs/week4/W4_FINAL_RELEASE_SIGNOFF.md | 139 +++++++++++++++++++++++++++++++++
 1 file changed, 139 insertions(+)

commit a9fdc7dabf88ec700f5fa058f0e3521acbf4117e
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 27 00:12:04 2026 +0700

    docs(week4): add Week 10 J1-J5 demo script with 15-EML pack and offline fallback (W4-07 Task 3.8a)

 docs/week4/W4_DEMO_SCRIPT_J1_J5.md | 146 +++++++++++++++++++++++++++++++++++++
 1 file changed, 146 insertions(+)

commit 090e8600b7a4a38ea0b1c8da468e8654c3e4d7f4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 23:19:47 2026 +0700

    test(v2-core): format tests_part2 and add FD-08/FD-10 integration and proptest coverage

 apps/desktop/src-tauri/v2-core/src/tests_part2.rs | 197 +++++++++++++++++++++-
 1 file changed, 190 insertions(+), 7 deletions(-)

commit d7040ed3ae1d6a664953023f57fa3bc220c9bc24
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 23:19:46 2026 +0700

    test(v2-core): update mail query length limit assertion to v22 512-char bound

 apps/desktop/src-tauri/v2-core/src/tests.rs | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit bf5256e036e1dbfc824b0307c8ba92f19029618c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 23:19:45 2026 +0700

    fix(v2-core): select project_board link timestamp by alias instead of column index

 apps/desktop/src-tauri/v2-core/src/profile/projects.rs | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)

commit 07608994776564cc7a347547d2b42cc9b8bab12b
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 23:02:42 2026 +0700

    style(v2-core): match rustfmt output in mail_actions and paging

 .../src-tauri/v2-core/src/profile/mail_actions.rs  | 10 ++++------
 .../src-tauri/v2-core/src/profile/paging.rs        | 22 ++++++++++++++++------
 2 files changed, 20 insertions(+), 12 deletions(-)

commit 8c1e57538ea2bcd650c253ef4dc827119d8d6e95
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:47:04 2026 +0700

    fix(v2-core): fix paging compile errors, search SQL, bare codes, and mailbox filtering

 .../src-tauri/v2-core/src/profile/paging.rs        | 550 ++++++++++++++++-----
 1 file changed, 419 insertions(+), 131 deletions(-)

commit 1ff931659819ad670a28f1ade62e1b356dec1750
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:47:03 2026 +0700

    fix(v2-core): fix mail_actions borrows, counts, undo safety, and saved searches

 .../src-tauri/v2-core/src/profile/mail_actions.rs  | 899 +++++++++++++++++----
 1 file changed, 753 insertions(+), 146 deletions(-)

commit e01ac907a7998f46934f676416e59ae3029b0009
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:26:37 2026 +0700

    fix(v2-core): match both To and Cc participants for mail rule recipient

 apps/desktop/src-tauri/v2-core/src/profile/mail_rules.rs | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)

commit 023b0557e545f0a946d01dfb84b20ca93f81e5c3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:22:18 2026 +0700

    fix(v2-core): restore provider_label_ids, guard v21 task_columns, and populate original_meta headers

 apps/desktop/src-tauri/v2-core/src/profile.rs | 82 ++++++++++++++++++++-------
 1 file changed, 60 insertions(+), 22 deletions(-)

commit 7dee38b1cea1d82e46d70ea21d80df919e53f5ae
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:22:18 2026 +0700

    fix(v2-core): harden Gmail search operator parser and chips

 .../src-tauri/v2-core/src/profile/search_query.rs  | 379 +++++++++++++++------
 1 file changed, 272 insertions(+), 107 deletions(-)

commit 9dab0d15cadf453ab2bb62424eea75aa363e66a1
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:16:29 2026 +0700

    fix(v2-core): preserve code order, exclude hex colors, and parse RFC-5322 participants

 apps/desktop/src-tauri/v2-core/src/code_index.rs | 88 ++++++++++++++++--------
 1 file changed, 60 insertions(+), 28 deletions(-)

commit bf8ff154ae8154e8bf41572471cb3f864b8b6ea7
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:16:29 2026 +0700

    fix(v2-core): unify mail_rules Unicode folding, empty filters, and fmt

 .../src-tauri/v2-core/src/profile/mail_rules.rs    | 62 +++++++++++++++++-----
 1 file changed, 50 insertions(+), 12 deletions(-)

commit 88aede312cae03668e69581b5c660778e37aa272
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:16:29 2026 +0700

    fix(v2-core): qualify SCHEMA_VERSION in migration_staging_tests

 apps/desktop/src-tauri/v2-core/src/migration_staging_tests.rs | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit d09e9f7359874bfcb184609871675b2910bc1a16
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:16:29 2026 +0700

    chore(v2-core): drop cosmetic reorder diff in accounts.rs

 apps/desktop/src-tauri/v2-core/src/profile/accounts.rs | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)

commit b9edba6f4967e6dd7d6d696fff2d10cb608cb020
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:13:43 2026 +0700

    fix(v2-core): refresh task_code_index before reloading updated task

 apps/desktop/src-tauri/v2-core/src/profile/task_edit.rs | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 65f1ba5ae560c9e13c44dea2cd2fda975178dc0f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 26 22:13:42 2026 +0700

    feat(v2-core): re-export code_index public items per W4-03 contract

 apps/desktop/src-tauri/v2-core/src/lib.rs | 1 +
 1 file changed, 1 insertion(+)

commit bcd15731be06ee1b45a0a8bb1c5ad5c879416c8c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:27:49 2026 +0700

    test(v2): enforce zero screen-level cross-file CSS selector collisions across V2

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 130 ++++++++++++++++++++++++++++-
 1 file changed, 129 insertions(+), 1 deletion(-)

commit e23402596f5a96a24443118d91aaf662e9036d8f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:27:45 2026 +0700

    style(v2): remove duplicate .mc-danger rules already defined in desktop.css

 apps/desktop/src/v2/settings.css | 13 -------------
 1 file changed, 13 deletions(-)

commit 9ff8ad745c4af50e5f5bfe71da39a5a1f06ca8bd
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:27:40 2026 +0700

    fix(v2): use .mc-danger-text on Assistant secondary delete button

 apps/desktop/src/v2/AssistantView.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 8aafe4220baf3a7e58d23dd54c0a8fbbd9655869
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:27:35 2026 +0700

    style(v2): remove conflicting .mc-danger rule from lazy assistant.css

 apps/desktop/src/v2/assistant.css | 1 -
 1 file changed, 1 deletion(-)

commit 1b828d437cf31c877d6b745cad7d0c7909136ab2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:27:29 2026 +0700

    style(v2): remove dead BatchAnalysisDialog CSS conflicting with W4-06 .mc-batch-toolbar

 apps/desktop/src/v2/mail-analysis.css | 124 ----------------------------------
 1 file changed, 124 deletions(-)

commit e42105ae9bd8f683c55ab50d210eedad4626e15d
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:07:42 2026 +0700

    build(v2): bundle upstream Jan, Lobe UI, and Circle notices into dist-v2 (W4-07 Task 3.7b)

 apps/desktop/vite.v2.config.ts | 6 ++++++
 1 file changed, 6 insertions(+)

commit 4095ee6730ae3179568b0e31b60c5d453674ea76
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 19:07:37 2026 +0700

    docs(v2): complete full 40-char upstream pins and Week 4 attributions (W4-07 Task 3.7b)

 apps/desktop/src/v2/THIRD_PARTY_NOTICES.md | 19 ++++++++++---------
 1 file changed, 10 insertions(+), 9 deletions(-)

commit 41fdb746785e0dddb627a8e1a373bbffb6469c9c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 18:52:59 2026 +0700

    test(v2): enforce FD-03 >= 40% 7-screen copy reduction and WCAG 2.2 AA / GM-07 audit

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 110 ++++++++++++++++++++++++++---
 1 file changed, 102 insertions(+), 8 deletions(-)

commit 9707e33942e1873fd0ed486a9635a967c9bbf601
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 18:52:54 2026 +0700

    style(v2): extend GM-07 print hiding and forced-colors border for W4-06 inbox chrome

 apps/desktop/src/v2/desktop.css | 10 ++++++++++
 1 file changed, 10 insertions(+)

commit 58dbb59cfec94c489e6c1a45fac244d4d93630e9
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:47 2026 +0700

    test(v2): add central wiring integration tests for GM-05, GM-06, FD-06, and FD-09

 apps/desktop/src/v2/MailCompass.test.tsx | 168 ++++++++++++++++++++++++++++++-
 1 file changed, 165 insertions(+), 3 deletions(-)

commit de8deac60f2e9aca2d67505530a16aaeb818bbe2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:43 2026 +0700

    feat(v2): wire GM-05 shortcuts, GM-06 rule draft, FD-06 settings, FD-09 presets, and FD-03 Today copy

 apps/desktop/src/v2/MailCompass.tsx | 92 +++++++++++++++++++++++++++++++++----
 1 file changed, 83 insertions(+), 9 deletions(-)

commit fa4a549f180c8ef097fd3bc43f1874f41b12593f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:38 2026 +0700

    test(v2): align AssistantView local submit button assertions with Tìm trên máy

 apps/desktop/src/v2/AssistantView.test.tsx | 16 ++++++++--------
 1 file changed, 8 insertions(+), 8 deletions(-)

commit 61e5c940a3290908c824ae72df2a33740aa7773c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:33 2026 +0700

    feat(v2): rename local assistant submit button to Tìm trên máy (FD-06)

 apps/desktop/src/v2/AssistantView.tsx | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)

commit 240e298a049c170b6c6ea3c650164621aa83b0b1
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:29 2026 +0700

    feat(v2): close clean search-launched rule dialog directly on Escape

 apps/desktop/src/v2/MailRuleManager.tsx | 4 +++-
 1 file changed, 3 insertions(+), 1 deletion(-)

commit 88a2b88bf545af6b8b534dff21b01edd87f843ba
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:25 2026 +0700

    test(v2): cover visible and hidden child overlay guards for GM-05 shortcuts

 apps/desktop/src/v2/useGmailShortcuts.test.tsx | 21 +++++++++++++++++++++
 1 file changed, 21 insertions(+)

commit fcfcdfd582291ce20843fcc0e4664b5f12f5b856
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 17:51:19 2026 +0700

    fix(v2): guard GM-05 window shortcuts against visible child overlays

 apps/desktop/src/v2/useGmailShortcuts.ts | 25 ++++++++++++++++++++++++-
 1 file changed, 24 insertions(+), 1 deletion(-)

commit cd2d8393400450b902e0d2b35e2d1eee12b87ee0
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:40 2026 +0700

    refactor(v2): normalize NotificationBell.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/NotificationBell.tsx | 11 +++--------
 1 file changed, 3 insertions(+), 8 deletions(-)

commit 7f4a48d065ca5e605f4d56d6f9078209b71017d6
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:34 2026 +0700

    refactor(v2): normalize NotificationsView.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/NotificationsView.tsx | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)

commit b35bbcc780004b7b3dd7b321444653c678c7a898
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:30 2026 +0700

    chore(v2): import NotificationItem directly from api.ts in NotificationsView.test.tsx

 apps/desktop/src/v2/NotificationsView.test.tsx | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)

commit 8f4b81296a80f8a13414d150ca530cebc8e10643
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:26 2026 +0700

    refactor(v2): normalize DeadlineDialog.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/DeadlineDialog.tsx | 45 ++++++++--------------------------
 1 file changed, 10 insertions(+), 35 deletions(-)

commit 52fab4de109e7f84b684ed5ccf65b3bf6f45e918
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:22 2026 +0700

    chore(v2): import official v22 reminder preset DTOs from api.ts in DeadlineProposal.test.tsx

 apps/desktop/src/v2/DeadlineProposal.test.tsx | 17 ++++++-----------
 1 file changed, 6 insertions(+), 11 deletions(-)

commit 34001caae739e8f90e1e46dc718faf0c6ea0f6c6
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:18 2026 +0700

    refactor(v2): normalize SettingsView.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/SettingsView.tsx | 37 +++++++++++-------------------------
 1 file changed, 11 insertions(+), 26 deletions(-)

commit 5442cef9d57c9586e6ad9cca7950a7af2181f96b
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:14 2026 +0700

    chore(v2): import official v22 settings DTOs from api.ts in SettingsView.test.tsx

 apps/desktop/src/v2/SettingsView.test.tsx | 11 +++++------
 1 file changed, 5 insertions(+), 6 deletions(-)

commit 48609462c6bb633815f3cef06382e558126d22fa
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:10 2026 +0700

    refactor(v2): normalize AiProviderSelectorBar.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/AiProviderSelectorBar.tsx | 30 +++------------------------
 1 file changed, 3 insertions(+), 27 deletions(-)

commit c0bf8a2d3d345c1f783bfe9ca2239621e5e71787
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:06 2026 +0700

    refactor(v2): normalize AssistantView.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/AssistantView.tsx | 15 +++++++--------
 1 file changed, 7 insertions(+), 8 deletions(-)

commit ff311d813d9361eec64abe78925a1fb3260de1b7
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:55:02 2026 +0700

    chore(v2): import official v22 assistant DTOs from api.ts in AssistantView.test.tsx

 apps/desktop/src/v2/AssistantView.test.tsx | 13 +++++--------
 1 file changed, 5 insertions(+), 8 deletions(-)

commit de8bbdcfdefb2262e2315e6c8c97b6bf331f8611
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:54:57 2026 +0700

    refactor(v2): normalize MailRuleManager.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/MailRuleManager.tsx | 29 +++++++++++------------------
 1 file changed, 11 insertions(+), 18 deletions(-)

commit e9893a38b1c77c38edf87822f2c4afe275e88a05
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:54:53 2026 +0700

    chore(v2): import MailRule directly from api.ts in MailRuleManager.test.tsx

 apps/desktop/src/v2/MailRuleManager.test.tsx | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

commit 0111c36ad35228a813edcc1670b796881eb5e92c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:54:48 2026 +0700

    refactor(v2): normalize MailAnalysisPanel.tsx to official v22 api.ts DTOs

 apps/desktop/src/v2/MailAnalysisPanel.tsx | 26 +++++++++-----------------
 1 file changed, 9 insertions(+), 17 deletions(-)

commit c531bb026e2985ce45066a4a44b3c990b6eb2cf2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 25 15:54:43 2026 +0700

    chore(v2): import WorkCandidateView directly from api.ts in MailAnalysisPanel.test.tsx

 apps/desktop/src/v2/MailAnalysisPanel.test.tsx | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)

commit 9560bbd4b7c670e440d95a160c514517deade539
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Nov 24 00:44:41 2026 +0700

    test(e2e): stabilize w2-api initial inbox navigation on dev (matches PR #65)

 apps/desktop/tests/w2-api.spec.ts | 4 ++++
 1 file changed, 4 insertions(+)

commit b7598a03d7aa5c3acf1a8ab0d4e27d0be924ee10
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Nov 24 00:44:37 2026 +0700

    test(e2e): align offline-smoke alert copy with dev (matches PR #65)

 apps/desktop/tests/offline-smoke.spec.ts | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 1129594e7321ecd31d0989e9e2d0aac95d992739
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:50:00 2026 +0700

    ci(v2): build dist-v2 before src-tauri V2 Rust tests and align rustfmt flags

 .github/workflows/v2-ci.yml | 30 +++++++++++++++---------------
 1 file changed, 15 insertions(+), 15 deletions(-)

commit 02ba36d478b7d40b712f8404852c716d251f46ef
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:49:18 2026 +0700

    docs(v2): complete Week 4 shadcn/ui Tier 1 attributions in THIRD_PARTY_NOTICES.md

 apps/desktop/src/v2/THIRD_PARTY_NOTICES.md | 7 ++++++-
 1 file changed, 6 insertions(+), 1 deletion(-)

commit a5e2549342eb1ec7c8be39f5b5ca07e04f945a15
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:39:10 2026 +0700

    test(v2): guard >=50% FD-03 copy reduction across Hiếu's 5 independent screens

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 18 ++++++++++++++++++
 1 file changed, 18 insertions(+)

commit df533040710a17cc617fa8e835191e4b4d6029db
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:37:57 2026 +0700

    test(v2): verify partial-scan help popover in WorkBriefView (FD-03)

 apps/desktop/src/v2/WorkBriefView.test.tsx | 20 ++++++++++++++++++++
 1 file changed, 20 insertions(+)

commit 560a608513a546e7d75e98b196df4266ff159532
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:37:28 2026 +0700

    test(v2): update local privacy hint assertion in AssistantView.test (FD-03)

 apps/desktop/src/v2/AssistantView.test.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 797e377e025fa0699326d88e3c6efc90d548c87f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:37:03 2026 +0700

    test(v2): verify shortened empty copy and timezone help popover in CalendarView

 apps/desktop/src/v2/CalendarView.test.tsx | 5 ++++-
 1 file changed, 4 insertions(+), 1 deletion(-)

commit 683fdeeea91299219ed4b241cb120c857d13adb6
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:36:14 2026 +0700

    style(v2): add truncated help-row and forced-colors rules in work-brief.css

 apps/desktop/src/v2/work-brief.css | 7 ++++++-
 1 file changed, 6 insertions(+), 1 deletion(-)

commit 693428258226aad5e89bc7cd482e52b90d4e035a
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:35:38 2026 +0700

    style(v2): add recurrence help-row and forced-colors rules in recurrences.css

 apps/desktop/src/v2/recurrences.css | 7 ++++++-
 1 file changed, 6 insertions(+), 1 deletion(-)

commit 540dde6eed3481dc16057959ab975a7cd05a0673
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:34:50 2026 +0700

    style(v2): add forced-colors and min-width hardening in commitments.css

 apps/desktop/src/v2/commitments.css | 6 +++++-
 1 file changed, 5 insertions(+), 1 deletion(-)

commit eebaa0f18ebb4f904328bcee5434c4287ddddf83
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:34:02 2026 +0700

    style(v2): add agenda title-row, 200% zoom stacking, and forced-colors hardening in calendar.css

 apps/desktop/src/v2/calendar.css | 13 ++++++++++---
 1 file changed, 10 insertions(+), 3 deletions(-)

commit fe31b32e6b468c1e77e4abd28b15bf9f4d43d32a
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:33:19 2026 +0700

    style(v2): add shared help popover styles and work-sections forced-colors border in desktop.css

 apps/desktop/src/v2/desktop.css | 35 ++++++++++++++++++++++++++++++++++-
 1 file changed, 34 insertions(+), 1 deletion(-)

commit 7e8bb2a336b909fa8d45fd8ca15f2cc95bee6364
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:32:13 2026 +0700

    refactor(v2): move partial-scan notice to help popover and tighten copy in WorkBriefView

 apps/desktop/src/v2/WorkBriefView.tsx | 32 +++++++++++++++++++++++++++-----
 1 file changed, 27 insertions(+), 5 deletions(-)

commit 53f4f35a63ef7a35dc8b64759e423caa46dd1140
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:31:28 2026 +0700

    refactor(v2): move recurrence timezone note to help popover and tighten copy in RecurrencesView

 apps/desktop/src/v2/RecurrencesView.tsx | 26 +++++++++++++++++++++++---
 1 file changed, 23 insertions(+), 3 deletions(-)

commit 66cbb1fb88bf84f2da851289d0825e4f5325d08f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:30:40 2026 +0700

    refactor(v2): tighten FD-03 empty state copy in CommitmentsView

 apps/desktop/src/v2/CommitmentsView.tsx | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 6ff402a3802ce746bb2b7b76ee5486b083d06daa
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:29:53 2026 +0700

    refactor(v2): tighten FD-03 static guidance copy in AssistantView

 apps/desktop/src/v2/AssistantView.tsx | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

commit 95e385666bd963e2f763ea1cee5974202cf3e499
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:28:48 2026 +0700

    refactor(v2): standardize single-line empty state in NotificationsView (FD-03)

 apps/desktop/src/v2/NotificationsView.tsx | 1 -
 1 file changed, 1 deletion(-)

commit 0f78faa982007ca98ebf18471d6be26cacfd4591
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:28:08 2026 +0700

    refactor(v2): move timezone note to help popover and tighten empty copy in CalendarView

 apps/desktop/src/v2/CalendarView.tsx | 25 +++++++++++++++++++++----
 1 file changed, 21 insertions(+), 4 deletions(-)

commit fcca36566b627acf76421bb80193006360405bfd
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:27:23 2026 +0700

    refactor(v2): tighten FD-03 empty state and dialog copy in ProjectsView

 apps/desktop/src/v2/ProjectsView.tsx | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

commit 9f2b8482b65503c6a5bcb98e9ed2aa54bcfc926c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:26:35 2026 +0700

    refactor(v2): tighten FD-03 empty state copy in TaskWorklist

 apps/desktop/src/v2/TaskWorklist.tsx | 8 ++++----
 1 file changed, 4 insertions(+), 4 deletions(-)

commit 40f7cfd502d3965f7996e38e4783d58c32da09fd
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 22:25:58 2026 +0700

    refactor(v2): tighten FD-03 copy and allow optional EmptyState description in Shell

 apps/desktop/src/v2/Shell.tsx | 10 +++++-----
 1 file changed, 5 insertions(+), 5 deletions(-)

commit 78ac1cd6b49294126bbbd1495070fa84b2d34931
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 21:27:45 2026 +0700

    fix(v2): derive account reminder presets synchronously and guard initial epoch in SettingsView

 apps/desktop/src/v2/SettingsView.tsx | 33 ++++++++++++++++-----------------
 1 file changed, 16 insertions(+), 17 deletions(-)

commit 86e2ddf48937809687c0f23ed72f60c3147f95e2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 21:21:12 2026 +0700

    test(v2): add FD-01, FD-09, and GM-05 tests for SettingsView

 apps/desktop/src/v2/SettingsView.test.tsx | 137 +++++++++++++++++++++++++++++-
 1 file changed, 135 insertions(+), 2 deletions(-)

commit 83760b8b71f9a33a80df8cb5e19697963523942a
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 21:18:41 2026 +0700

    feat(v2): add FD-01 attachment policy, FD-09 account presets, and GM-05 shortcuts switch to SettingsView

 apps/desktop/src/v2/SettingsView.tsx | 272 ++++++++++++++++++++++++++++++++++-
 1 file changed, 267 insertions(+), 5 deletions(-)

commit 5b5587c49df374c802ed5052406f42644f191101
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 21:12:12 2026 +0700

    style(v2): add settings cards, help popover, and switch styles for FD-01/FD-09/GM-05

 apps/desktop/src/v2/settings.css | 167 +++++++++++++++++++++++++++++++++++++++
 1 file changed, 167 insertions(+)

commit 78a0f80fa09b7d5086335ee3be00280e686e6189
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 20:54:54 2026 +0700

    test(v2): add FD-09 multi-stage event_key isolation and bell popover badge tests (W4-07 Task 3.3)

 apps/desktop/src/v2/NotificationsView.test.tsx | 211 ++++++++++++++++++++++++-
 1 file changed, 210 insertions(+), 1 deletion(-)

commit c27e13d8d240decb112e121919886f4e13db522f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 20:50:56 2026 +0700

    feat(v2): render per-stage FD-09 reminder badges and §6 errors in NotificationsView (W4-07 Task 3.3)

 apps/desktop/src/v2/NotificationsView.tsx | 23 ++++++++++++++++-------
 1 file changed, 16 insertions(+), 7 deletions(-)

commit 1197e3f9b348d70cf8554038d5b5b39e364a8f05
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 20:47:28 2026 +0700

    feat(v2): display FD-09 multi-horizon stage badges in NotificationBell popover (W4-07 Task 3.3)

 apps/desktop/src/v2/NotificationBell.tsx | 82 +++++++++++++++++++++++++++-----
 1 file changed, 70 insertions(+), 12 deletions(-)

commit 8ef44806aec5af5b4874abe7832e0ec5333f81b3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 20:45:02 2026 +0700

    style(v2): add WCAG-compliant FD-09 stage badge styles in notifications.css (W4-07 Task 3.3)

 apps/desktop/src/v2/notifications.css | 39 +++++++++++++++++++++++++++++++++++
 1 file changed, 39 insertions(+)

commit aa9901df5f9ce44bc87b94a7aec72f80e40f61a4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 18:10:34 2026 +0700

    test(v2): add FD-09 multi-horizon preset tests for DeadlineDialog (W4-07 Task 3.2)

 apps/desktop/src/v2/DeadlineProposal.test.tsx | 145 +++++++++++++++++++++++++-
 1 file changed, 143 insertions(+), 2 deletions(-)

commit 6f580686c05362e872e46a1b3c93a2338792d120
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 18:09:32 2026 +0700

    feat(v2): integrate FD-09 multi-horizon ReminderLeadPresetChips in DeadlineDialog (W4-07 Task 3.2)

 apps/desktop/src/v2/DeadlineDialog.tsx | 271 +++++++++++++++++++++++++++------
 1 file changed, 221 insertions(+), 50 deletions(-)

commit 677e556c86535874ab9e24f739be248dfb926c35
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 18:06:49 2026 +0700

    style(v2): add deadline presets header alignment helper in desktop.css (W4-07 Task 3.2)

 apps/desktop/src/v2/desktop.css | 2 ++
 1 file changed, 2 insertions(+)

commit b222a6b68fde726082f1582119683cb66906b8f2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:58:12 2026 +0700

    test(v2): add FD-06 AiProviderSelectorBar, roving focus, consent strip, gemini_paid, and provider_mismatch tests (W4-07 Task 3.1)

 apps/desktop/src/v2/AssistantView.test.tsx | 219 +++++++++++++++++++++++++++--
 1 file changed, 210 insertions(+), 9 deletions(-)

commit 61bd228de483a556792fc3845ec53ceba441afb6
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:57:53 2026 +0700

    fix(v2): prevent duplicate loadStatus/loadProviders fetch on initial mount in AssistantView (W4-07 Task 3.1)

 apps/desktop/src/v2/AssistantView.tsx | 4 ++++
 1 file changed, 4 insertions(+)

commit 20db85e8238fff890a999f6ae19716bf028a027d
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:55:34 2026 +0700

    feat(v2): integrate AiProviderSelectorBar, provider_id preview, and provider_mismatch handling in AssistantView (W4-07 Task 3.1)

 apps/desktop/src/v2/AssistantView.tsx | 205 +++++++++++++++++++++++-----------
 1 file changed, 138 insertions(+), 67 deletions(-)

commit 7ba3d599862ccdec5ff688eddfe0d39eb7e872b2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:53:24 2026 +0700

    style(v2): add PromptInput unified composer and AiProviderSelectorBar WCAG styles in assistant.css (W4-07 Task 3.1)

 apps/desktop/src/v2/assistant.css | 157 ++++++++++++++++++++++++++++++++++----
 1 file changed, 143 insertions(+), 14 deletions(-)

commit 33d673ee8ee65c91371280db393d089846f91ac4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:52:22 2026 +0700

    feat(v2): add AiProviderSelectorBar with WAI-ARIA radiogroup and consent alert strip (W4-07 Task 3.1)

 apps/desktop/src/v2/AiProviderSelectorBar.tsx | 362 ++++++++++++++++++++++++++
 1 file changed, 362 insertions(+)

commit 5007b6f9035d9f255f60e1c79ed5c6aaf2bee845
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:50:53 2026 +0700

    docs(v2): record ibelick/prompt-kit MIT attribution pin in THIRD_PARTY_NOTICES.md (W4-07 Task 3.1)

 apps/desktop/src/v2/THIRD_PARTY_NOTICES.md | 32 ++++++++++++++++++++++++++++++
 1 file changed, 32 insertions(+)

commit 897d669c66694a3c9eeff4eee92f7a3e31f091e7
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:50:14 2026 +0700

    test(v2): guard monotonic non-regression against frozen FD-03 baseline prior to Task 3.6 (W4-07 Task 3.1)

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 7 ++++---
 1 file changed, 4 insertions(+), 3 deletions(-)

commit fce59656e78bd600c15f5506b5ee8cb1c3170f06
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:10:39 2026 +0700

    test(v2): add GM-06 recipient, code, initialCriteria, and conflict reload tests (W4-07 Task 2.2)

 apps/desktop/src/v2/MailRuleManager.test.tsx | 194 ++++++++++++++++++++++++++-
 1 file changed, 192 insertions(+), 2 deletions(-)

commit 087dad81a97d25fef11cfa12487a17784c01d968
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:09:37 2026 +0700

    feat(v2): support GM-06 recipient, code, initialCriteria, and summary badges in MailRuleManager (W4-07 Task 2.2)

 apps/desktop/src/v2/MailRuleManager.tsx | 268 +++++++++++++++++++++++++-------
 1 file changed, 215 insertions(+), 53 deletions(-)

commit 1575f0b1c092b336941b38686fa84f0af132ee6d
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 17:07:35 2026 +0700

    style(v2): add rule criteria summary chip styles in mail-rule-manager.css (W4-07 Task 2.2)

 apps/desktop/src/v2/mail-rule-manager.css | 24 ++++++++++++++++++++++++
 1 file changed, 24 insertions(+)

commit 010f644a41a5403dd39bb88358e8fc94b2b2b4da
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:51:16 2026 +0700

    test(v2): add FD-05 title clarity review badge and auto-focus tests (W4-07 Task 2.1)

 apps/desktop/src/v2/MailAnalysisPanel.test.tsx | 111 ++++++++++++++++++++++++-
 1 file changed, 110 insertions(+), 1 deletion(-)

commit 44ba983759e04d0735e4de2efd41da5a0ddbcb76
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:50:21 2026 +0700

    feat(v2): add FD-05 title clarity review badge and auto-focus in MailAnalysisPanel (W4-07 Task 2.1)

 apps/desktop/src/v2/MailAnalysisPanel.tsx | 76 +++++++++++++++++++++++++++----
 1 file changed, 67 insertions(+), 9 deletions(-)

commit 36f6c6369b3b184f8c602663f99f25433956d9c3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:48:30 2026 +0700

    style(v2): add WCAG clarity review badge and alert styles in mail-analysis.css (W4-07 Task 2.1)

 apps/desktop/src/v2/mail-analysis.css | 43 +++++++++++++++++++++++++++++++++++
 1 file changed, 43 insertions(+)

commit 9891583609a3b8761f7746bcfc9afd60ff646124
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:27:02 2026 +0700

    ci(v2): add .github/workflows/v2-ci.yml with 7-step Rust, Vitest, and PKG-02 gate (W4-07 Task 1.6)

 .github/workflows/v2-ci.yml | 67 +++++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 67 insertions(+)

commit 41e956dab95b044aab8f4a093a597642c6b4f28a
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:26:11 2026 +0700

    chore(ci): add PKG-02 V2 bundle budget checker script (W4-07 Task 1.6)

 scripts/check-v2-bundle-budget.mjs | 351 +++++++++++++++++++++++++++++++++++++
 1 file changed, 351 insertions(+)

commit dae9524a4471594fc396d577c182b5e81436432e
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:18:46 2026 +0700

    test(v2): add unit tests for ReminderLeadPresetChips (W4-07 Task 1.5)

 .../src/v2/ReminderLeadPresetChips.test.tsx        | 116 +++++++++++++++++++++
 1 file changed, 116 insertions(+)

commit ec7c112bcc3ede66097971a37843051c24396fad
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:17:38 2026 +0700

    feat(v2): add pure controlled ReminderLeadPresetChips component (W4-07 Task 1.5)

 apps/desktop/src/v2/ReminderLeadPresetChips.tsx | 133 ++++++++++++++++++++++++
 1 file changed, 133 insertions(+)

commit 57acfb54fe4c10aee35129de92236f3e3612664c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 16:16:40 2026 +0700

    style(v2): add WCAG-compliant .mc-reminder-presets styles in desktop.css (W4-07 Task 1.5)

 apps/desktop/src/v2/desktop.css | 49 +++++++++++++++++++++++++++++++++++++++++
 1 file changed, 49 insertions(+)

commit 868445e0e8bfe557fa0b8e3ea754dac6c8b6c0ad
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:54:59 2026 +0700

    test(v2): add unit tests for presentation Week 4 errors and reminder helpers (W4-07 Task 1.4)

 apps/desktop/src/v2/presentation.test.ts | 99 ++++++++++++++++++++++++++++++++
 1 file changed, 99 insertions(+)

commit 48b9af297c83ed77ad30d61a1da3a36425060650
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:54:08 2026 +0700

    feat(v2): add Week 4 error map and reminder stage/preset helpers in presentation.ts (W4-07 Task 1.4)

 apps/desktop/src/v2/presentation.ts | 75 +++++++++++++++++++++++++++++++++++++
 1 file changed, 75 insertions(+)

commit 5892961ddcd6436a794f54a9cfe29b864a14ecb4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:49:56 2026 +0700

    test(v2): add unit and lazy dialog tests for GM-05 Gmail shortcuts (W4-07 Task 1.3)

 apps/desktop/src/v2/useGmailShortcuts.test.tsx | 309 +++++++++++++++++++++++++
 1 file changed, 309 insertions(+)

commit bb257de87c54f8d99825c5782242a5ebafd9beb4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:47:38 2026 +0700

    feat(v2): add lazy-loadable KeyboardShortcutsDialog for GM-05 (W4-07 Task 1.3)

 apps/desktop/src/v2/KeyboardShortcutsDialog.tsx | 130 ++++++++++++++++++++++++
 1 file changed, 130 insertions(+)

commit b3e026b35772b1e1b5d4498aa48ccc2949c72842
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:46:48 2026 +0700

    style(v2): add keyboard-shortcuts.css for GM-05 dialog (W4-07 Task 1.3)

 apps/desktop/src/v2/keyboard-shortcuts.css | 106 +++++++++++++++++++++++++++++
 1 file changed, 106 insertions(+)

commit a3baaeb67f7390ed7e6a8141d057ba246fbd2ef2
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:46:05 2026 +0700

    feat(v2): add IME-safe useGmailShortcuts hook and localStorage helper (W4-07 Task 1.3)

 apps/desktop/src/v2/useGmailShortcuts.ts | 265 +++++++++++++++++++++++++++++++
 1 file changed, 265 insertions(+)

commit 245c5323003c7bc1b6b40a6d9055399d7ab27022
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:41:19 2026 +0700

    fix(v2): keep @media print hide rules last so [hidden]/[data-no-print] win cascade

 apps/desktop/src/v2/desktop.css | 69 +++++++++++++++++++++--------------------
 1 file changed, 35 insertions(+), 34 deletions(-)

commit 3b377f392790bf4de56d1b3bf169b75444d7e8a3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 15:37:49 2026 +0700

    style(v2): add clean @media print rules for GM-07 (W4-07 Task 1.2)

 apps/desktop/src/v2/desktop.css | 177 ++++++++++++++++++++++++++++++++++++++++
 1 file changed, 177 insertions(+)

commit b1379c4b0e5f8d44a12cebcf27d7e6c28ed08ad0
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 14:17:45 2026 +0700

    fix(v2): match ProfileAccount and AgendaPage types in fd03CopyAudit mock

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 5 ++---
 1 file changed, 2 insertions(+), 3 deletions(-)

commit ca3d02f40cacadbb4daf3000331ab5c84237ca72
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Mon Nov 23 14:09:27 2026 +0700

    test(v2): freeze FD-03 7-screen static copy baseline (W4-07 Task 1.1)

 apps/desktop/src/v2/fd03CopyAudit.test.tsx | 431 +++++++++++++++++++++++++++++
 1 file changed, 431 insertions(+)
```
