# Git Checkpoint & Auto-Push Rules

Whenever you successfully create, edit, or delete a tracked file inside the active Git workspace, immediately create a per-file Git checkpoint commit and push it to the current branch on GitHub (`origin`) so every file change can be cleanly reviewed, managed, or rewound.

## Workflow
1. **Per-File Atomic Checkpoint:** For each file successfully modified inside the repository (ignoring scratch/artifact files outside the repo and `.gitignore`d files), stage that file (`git add -- <path>`), commit it with a concise descriptive message (e.g., `checkpoint(<scope>): update <filename> - <short summary>`), and push immediately to the workspace's active branch (`git push origin <current-branch>`).
2. **Multi-File Turns:** If a task requires editing multiple files, create one atomic checkpoint commit per modified file in logical order so each file change remains individually reviewable and revertible, then ensure all commits are pushed to `origin/<current-branch>`.
3. **Skip Only Non-Repo / Ignored Files:** Do not attempt to stage or push files outside the repository root, temporary scratch files, secrets (`.env`, credentials), or gitignored build/environment directories (`.venv/`, `node_modules/`, `dist/`).

## Safety Guardrails
- Always push to the **currently checked-out branch** (`git rev-parse --abbrev-ref HEAD`); never switch branches silently or push from a detached `HEAD`.
- **Never** use `git push --force`, `git push --force-with-lease`, or `git commit --amend` on commits that have already been pushed to the remote.
- If `git commit` or `git push` fails (e.g., network offline, authentication error, or remote diverged), stop and report the exact Git error immediately rather than retrying destructively.
