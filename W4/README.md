# Lab CS252 - AI Usage Report

**Course**: CS252 - Programming Systems  
**Student**: Nguyen Quang Hieu - 25125043  
**Week**: Week 4  
**Topic**: Phased Vibe-coding with AI (MailCompass UI)

---

## AI Usage Declaration

**Declaration B: I did use AI for this homework.**

### Division of Work & Collaboration
- **Student Ownership & Research**:
  + **Specification & Phased Workflow Planning**: Analyzed project requirements from `Issue_2.md` and `w2-07-hieu-ui.md`, established a 5-phase sequential development plan, and strictly enforced an initial read-only analysis gate before code modification.
  + **Execution Supervision & Checkpoints**: Enforced an atomic commit-and-push discipline after every file modification (26 commits), prevented autonomous AI branching decisions, and mandated multi-tier testing gates (TypeScript typecheck, Vitest, and Playwright E2E).
  + **Review & Edge-Case Troubleshooting**: Supervised final integration, identified and directed the resolution of the UTF-8 font encoding issue in PR #30, and resolved the legacy smoke test failure in GitHub Actions CI.

- **AI Assistance**:
  + **Code Implementation & Boilerplate Generation**: Assisted in implementing canonical TypeScript DTOs, HTTP API client methods, and stateful Mock Client adapters adhering to team contracts.
  + **UI Feature & Algorithm Coding**: Assisted in developing the task deadline confirmation with live UTC preview, deadline history dialog, email linking/unlinking, and pure decision engine algorithms in `TaskEditor.tsx` and `DecisionPreviewPage.tsx`.
  + **Test Suite & Documentation**: Generated unit and integration tests (`TaskDeadlineAndLink.test.tsx`, `DecisionPreviewPage.test.tsx`, `client.test.ts`, `mock.test.ts`), and assisted in compiling commit logs and technical reports.
