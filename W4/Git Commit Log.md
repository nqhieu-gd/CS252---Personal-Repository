commit 31d267f2b6e656dd36aa64baee08d7e4ad11281f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 17:02:43 2026 +0700

    fix(e2e): update offline-smoke assertion for W02 real Gmail account creation

commit c1a59e42b9334fa3ab6f4e84600d4f4172cd11ed
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:27:22 2026 +0700

    test(ui): clean up unused imports and satisfy strict typecheck in W02 tests

commit f4a434b88164b9862c3d573b8bf036fcaa1b45ee
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:25:51 2026 +0700

    test(ui): add tests for TaskEditor deadline confirmation, history, and linking error handling

commit e082bb0a0ceb0c29c5f411110e410199461b7b39
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:24:52 2026 +0700

    test(ui): add tests for DecisionPreviewPage constraints, ranking, attention queue, and stale notice

commit e12a3a66cdc47609b90fe14be42f6def9bb858c1
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:24:15 2026 +0700

    feat(ui): integrate DecisionPreviewPage into App view router

commit 89be25a42159490e301720474ba4c0163dd97675
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:24:06 2026 +0700

    feat(ui): add Decision Preview navigation item to AppSidebar

commit 5fe2f10b2a0214a39f0a8914719090efcb151eaa
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:22:36 2026 +0700

    feat(ui): implement DecisionPreviewPage with 9 parameters and 3 result sections

commit 89782997d2e288db0ac7ebf96658e8ef8806928c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:20:19 2026 +0700

    feat(ui): add deadline confirmation, history dialog, and email link/unlink to TaskEditor

commit 336a373f4e0a8b9347746eb80207f019126710ca
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:17:54 2026 +0700

    feat(ui): add deadline from/to filters to TaskDashboard

commit 48511f471c033f3eb27c5389f43e6297e4a17aca
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:15:36 2026 +0700

    feat(ui): add Gmail OAuth and local account data deletion UI to AccountsPage

commit bc477beed7a8b13b095d0ee23f75f5900af2bcf4
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 16:00:12 2026 +0700

    test(api): refine client test helpers and strict type definitions

commit b53569aa1343904a6ad9dcd9b1106b12d3f44348
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:57:45 2026 +0700

    test(api): add parity and lifecycle tests for W02 mock client

commit ac135154d6ec2612f28cd5bc4bfd5f12f5b761de
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:56:39 2026 +0700

    fix(mock): support idempotency replay for deleteLocalAccountData

commit 94486610607e1cffbc81cad56334be881be30a55
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:54:34 2026 +0700

    fix(mock): allow optional or undefined evidence_id on manual deadline confirm

commit a8ed38d910f06ed858368a43465d1f32e73d3b27
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:52:30 2026 +0700

    test(api): add unit tests for W02 client endpoints and error translation

commit 89109e6bc90eb8562620ccaf63cd817d7191dcb3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:50:40 2026 +0700

    test(platform): update AppEntry ApiClient test double with W02 methods

commit 2d4e4bde32ffebcf90ce9c95e996ebe1b589a3de
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:50:31 2026 +0700

    fix(mock): align TaskCandidateView properties with canonical domain DTO

commit 45925ce8abf88e0c6bd03099df836b36bb5d7cc8
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:48:51 2026 +0700

    feat(api): implement W02 mock parity for OAuth, deletion, deadline, and decision preview

commit 5d497f43d2927902b959a6354561b008f95a1a75
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 15:44:17 2026 +0700

    feat(api): implement W02 endpoints on HTTP ApiClient

commit 0f82a1f3033b68059c3bfaebb631aa4ec97e380f
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 14:49:01 2026 +0700

    feat(decisions): implement pure decision engine algorithms for mock parity

commit d29e7d6e87d7e46ca1933dc5c782a7407b74bb6c
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 14:42:25 2026 +0700

    feat(api): synchronize canonical W02 DTOs and ApiClient signatures from Thao Anh

commit 676b006ab9cc95914f897fd71a0dd49211941fd3
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Fri Nov 6 14:41:43 2026 +0700

    feat(ui): add W02 copy strings for deadline, oauth, delete-local, and decision preview

commit f1cf4727c100259517bd52baa91d280b9797b3d8
Merge: a72e18b b23cc14
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Thu Nov 5 07:52:03 2026 +0700

    Merge branch 'feat/w2-interfaces' of https://github.com/kietanhnguyen2007/CS252 into feat/w2-UI

commit a72e18b7903429912e18e5083f4ec953a86ec88e
Merge: 03a03fb 8bb1234
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 4 23:35:00 2026 +0700

    Merge branches 'feat/w1-UI' and 'dev' of https://github.com/kietanhnguyen2007/CS252 into feat/w1-UI

commit 03a03fb47fc0aea5d74e0124fbef5a5555799ee4
Merge: 46781a4 eaf2e37
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 4 23:33:40 2026 +0700

    Merge branch 'feat/w1-UI' of https://github.com/kietanhnguyen2007/CS252 into feat/w1-UI

commit 46781a435fa338a3c152e7bb89cf91639ed59d58
Author: nqhieu-gd <nqh517@gmail.com>
Date:   Wed Nov 4 23:30:45 2026 +0700

    Updated New Workflow for week 2
