commit ec080c1e15ec8da13bb4620e2f7bb8866bb30d34
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Nov 10 17:46:44 2026 +0700

    test(inbox): add unit tests for batch .eml file selection and sequential queue

 .../tests/platform/InboxBatchImport.test.tsx       | 123 +++++++++++++++++++++
 1 file changed, 123 insertions(+)

commit f9ae1ff5561caa49c91c8d3e2d2c556fcb1ab1cf
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Nov 10 17:46:33 2026 +0700

    fix(inbox): prevent re-entry loop in import queue runner

 apps/desktop/src/features/inbox/InboxPage.tsx | 26 +++++++++++++++++---------
 1 file changed, 17 insertions(+), 9 deletions(-)

commit 3f1ebdb091b86423653dcf35d13f1272cfa542c7
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Nov 10 17:33:14 2026 +0700

    feat(ui): support batch .eml file selection and sequential import queue

 apps/desktop/src/features/inbox/InboxPage.tsx | 281 ++++++++++++++++++++++----
 1 file changed, 240 insertions(+), 41 deletions(-)

commit c1a59e42b9334fa3ab6f4e84600d4f4172cd11ed
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:27:22 2026 +0700

    test(ui): clean up unused imports and satisfy strict typecheck in W02 tests

 apps/desktop/tests/platform/DecisionPreviewPage.test.tsx | 2 +-
 apps/desktop/tests/platform/TaskDeadlineAndLink.test.tsx | 3 ++-
 2 files changed, 3 insertions(+), 2 deletions(-)

commit f4a434b88164b9862c3d573b8bf036fcaa1b45ee
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:25:51 2026 +0700

    test(ui): add tests for TaskEditor deadline confirmation, history, and linking error handling

 .../tests/platform/TaskDeadlineAndLink.test.tsx    | 168 +++++++++++++++++++++
 1 file changed, 168 insertions(+)

commit e082bb0a0ceb0c29c5f411110e410199461b7b39
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:24:52 2026 +0700

    test(ui): add tests for DecisionPreviewPage constraints, ranking, attention queue, and stale notice

 .../tests/platform/DecisionPreviewPage.test.tsx    | 137 +++++++++++++++++++++
 1 file changed, 137 insertions(+)

commit 89be25a42159490e301720474ba4c0163dd97675
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:24:06 2026 +0700

    feat(ui): add Decision Preview navigation item to AppSidebar

 .../src/components/upstream/circle/AppSidebar.tsx  | 98 +++++++++++++++++-----
 1 file changed, 77 insertions(+), 21 deletions(-)

commit 5fe2f10b2a0214a39f0a8914719090efcb151eaa
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:22:36 2026 +0700

    feat(ui): implement DecisionPreviewPage with 9 parameters and 3 result sections

 .../src/features/decisions/DecisionPreviewPage.tsx | 765 +++++++++++++++++++++
 1 file changed, 765 insertions(+)

commit 89782997d2e288db0ac7ebf96658e8ef8806928c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:20:19 2026 +0700

    feat(ui): add deadline confirmation, history dialog, and email link/unlink to TaskEditor

 apps/desktop/src/features/tasks/TaskEditor.tsx | 877 ++++++++++++++++++++-----
 1 file changed, 706 insertions(+), 171 deletions(-)

commit 336a373f4e0a8b9347746eb80207f019126710ca
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:17:54 2026 +0700

    feat(ui): add deadline from/to filters to TaskDashboard

 apps/desktop/src/features/tasks/TaskDashboard.tsx | 536 ++++++++++++++--------
 1 file changed, 355 insertions(+), 181 deletions(-)

commit 0f82a1f3033b68059c3bfaebb631aa4ec97e380f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 14:49:01 2026 +0700

    feat(decisions): implement pure decision engine algorithms for mock parity

 apps/desktop/src/lib/decisionPreviewMock.test.ts | 209 ++++++++++
 apps/desktop/src/lib/decisionPreviewMock.ts      | 461 +++++++++++++++++++++++
 2 files changed, 670 insertions(+)

commit 4432313c62f696ca95420cebb4206b5258155884
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Oct 28 10:54:13 2026 +0700

    Update InboxPage.tsx: implement Notesnook mail list density, search, and GitButler parallel ReviewWorkspace

 apps/desktop/src/features/inbox/InboxPage.tsx | 364 +++++++++++++++++++-------
 1 file changed, 267 insertions(+), 97 deletions(-)

commit 5bb21fba68be31f208c2b4fdde14dbbdeef14ebf
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Oct 28 10:31:29 2026 +0700

    Update TaskDashboard.tsx: remove unsupported sort, add owner and search_query filters, use deadline_effective

 apps/desktop/src/features/tasks/TaskDashboard.tsx | 50 +++++++++++++----------
 1 file changed, 28 insertions(+), 22 deletions(-)

commit 82ce80da7b9d95756f74234a579e3c229fc04a40
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Oct 28 09:45:48 2026 +0700

    Update InboxPage.tsx: restrict EML size to 10 MiB, preserve raw body_text, and align MessageView fields with v0.5 spec

 apps/desktop/src/features/inbox/InboxPage.tsx | 21 +++++++++++----------
 1 file changed, 11 insertions(+), 10 deletions(-)

commit 5790f71021abcec63551704e7132d812349986e5
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Tue Oct 27 23:21:25 2026 +0700

    Update TaskEditor.tsx: use 'normal' importance instead of 'medium' and deadline_effective instead of deadline

 apps/desktop/src/features/tasks/TaskEditor.tsx | 6 +++---
 1 file changed, 3 insertions(+), 3 deletions(-)

commit 015af2a6b74fc412f230b02c3f56a1729331de6f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Oct 23 11:51:35 2026 +0700

    Dashboard: view, filter and sort tasks, and edit state, owner, estimate and importance with version checking

 apps/desktop/src/features/tasks/TaskDashboard.tsx | 247 ++++++++++++++++++++++
 apps/desktop/src/features/tasks/TaskEditor.tsx    | 191 +++++++++++++++++
 2 files changed, 438 insertions(+)

commit e4977f32ae358fb1de89dd7fae5f69c11e8b3072
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Oct 23 11:50:16 2026 +0700

    Rendered inbox page

 apps/desktop/src/features/inbox/InboxPage.tsx | 268 ++++++++++++++++++++++++++
 1 file changed, 268 insertions(+)
