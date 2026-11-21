import { expect, test, type Response } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { DecisionPreview, DecisionPreviewRequest } from "../src/api/types";

test.use({ actionTimeout: 10_000, timezoneId: "UTC" });

const PROVIDER_MODE = (process.env.E2E_PROVIDER_MODE ?? "recorded").trim().toLowerCase();

const API_MODE = (process.env.E2E_MODE ?? "").trim().toLowerCase() === "api";
const RECORDED_BODY = (JSON.parse(readFileSync(
  new URL("../../../backend/tests/fixtures/analysis/unicode_vietnamese_deadline.json", import.meta.url),
  "utf8",
)) as { body_text: string }).body_text;
const W3_EML = readFileSync(new URL("../../../backend/tests/fixtures/mail/w3_release.eml", import.meta.url));

if (!API_MODE) {
  test("Week 3 requires the real API fixture", () => {
    test.skip(true, "Select E2E_MODE=api to run this suite.");
  });
}

if (API_MODE) {
  test("reopens a task brief, loads older commitments and returns from linked email in the same account", async ({
    page,
    request,
  }) => {
    test.setTimeout(75_000);
    const apiBaseUrl = process.env.E2E_API_URL!;
    const sessionToken = process.env.E2E_SESSION_TOKEN!;
    const headers = { "X-MailCompass-Session": sessionToken };
    const health = await request.get(`${apiBaseUrl}/health`, { headers });
    expect(health.status()).toBe(200);
    const { workspace_id: workspaceId } = await health.json();
    const accountsUrl = `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts`;
    async function createAccount(displayName: string): Promise<string> {
      const response = await request.post(accountsUrl, {
        headers,
        data: { kind: "eml", display_name: displayName },
      });
      expect(response.status()).toBe(201);
      return (await response.json()).id;
    }
    const primary = await createAccount("W3 Brief Source");
    const other = await createAccount("W3 Brief Other");
    const scopeUrl = `${accountsUrl}/${primary}`;
    const subject = "W3 Brief Linked Email";
    const body = "Figures confirmed in the original message.";
    const title = "W3 Brief Task";

    await page.addInitScript((runtime) => {
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          invoke: async (command: string) => {
            if (command !== "get_runtime_config") throw new Error(`Unexpected command ${command}`);
            return runtime;
          },
        },
      });
    }, { apiBaseUrl, sessionToken });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hộp thư", level: 2 })).toBeVisible();
    const account = page.getByRole("combobox", { name: "Tài khoản", exact: true });
    await account.selectOption(primary);
    await page.getByLabel("Nhập file .eml", { exact: true }).setInputFiles({
      name: "brief-linked.eml",
      mimeType: "message/rfc822",
      buffer: Buffer.from([
        "From: lan@example.test",
        "To: user@example.test",
        `Subject: ${subject}`,
        "Date: Mon, 09 Nov 2026 09:00:00 +0000",
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
      ].join("\r\n")),
    });
    await expect(page.getByRole("heading", { name: subject, exact: true })).toBeVisible();
    const messages = await request.get(`${scopeUrl}/messages`, { headers });
    expect(messages.status()).toBe(200);
    const email = (await messages.json()).items.find((item: { subject: string }) => item.subject === subject);
    expect(email).toBeDefined();

    const createdTask = await request.post(`${scopeUrl}/tasks`, {
      headers,
      data: { title, owner: "Lan", message_id: email.id, idempotency_key: "w3-brief-task" },
    });
    expect(createdTask.status()).toBe(201);
    const task = await createdTask.json();
    const deadline = await request.post(`${scopeUrl}/tasks/${task.id}/deadline`, {
      headers,
      data: {
        deadline: "2026-11-30T15:00:00Z",
        expected_version: task.version,
        reason: "Confirmed in the project notes",
        source_kind: "manual",
        evidence_id: null,
        idempotency_key: "w3-brief-deadline",
      },
    });
    expect(deadline.status()).toBe(200);
    for (let index = 1; index <= 21; index++) {
      const commitment = await request.post(`${scopeUrl}/work-assistant/commitments`, {
        headers,
        data: {
          task_id: task.id,
          direction: "owed_to_me",
          party_label: "Lan",
          statement: `Brief follow-up ${index}`,
          message_id: email.id,
          idempotency_key: `w3-brief-commitment-${index}`,
        },
      });
      expect(commitment.status()).toBe(201);
    }

    const navigation = page.getByRole("navigation", { name: "Điều hướng chính" });
    await navigation.getByRole("button", { name: "Công việc", exact: true }).click();
    await page.getByTestId("task-row").filter({ hasText: title }).click();
    await page.getByRole("button", { name: "Theo dõi và bàn giao", exact: true }).click();
    const brief = page.getByRole("region", { name: "Hồ sơ công việc" });
    await expect(brief.getByRole("heading", { name: title, exact: true })).toBeVisible();
    await expect(brief.getByText("Confirmed in the project notes")).toBeVisible();
    await expect(brief.getByText("Đã tải 20/21 cam kết")).toBeVisible();
    await brief.getByRole("button", { name: "Xem thêm cam kết", exact: true }).click();
    await expect(brief.getByText("Đã tải 21/21 cam kết")).toBeVisible();
    await expect(brief.getByRole("heading", { name: /^Brief follow-up / })).toHaveCount(21);

    await brief.getByRole("button", { name: subject, exact: true }).click();
    await expect(page.getByLabel("Nội dung email")).toContainText(body);
    const backToBrief = page.getByRole("button", { name: "Quay lại hồ sơ công việc", exact: true });
    await backToBrief.click();
    await expect(brief.getByRole("heading", { name: title, exact: true })).toBeVisible();

    const isolated = await request.get(`${accountsUrl}/${other}/work-assistant/tasks/${task.id}/brief`, { headers });
    expect(isolated.status()).toBe(404);
    await brief.getByRole("button", { name: subject, exact: true }).click();
    await expect(backToBrief).toBeVisible();
    await account.selectOption(other);
    await expect(backToBrief).toHaveCount(0);
    await expect(page.getByLabel("Nội dung email")).toHaveCount(0);
    await expect(brief).toHaveCount(0);
  });
}

if (API_MODE && PROVIDER_MODE === "recorded") {
  test.describe("Week 3 Recorded Provider Acceptance", () => {
    test("recorded flow: import 2 EML -> analyze -> evidence -> confirm -> deadline -> history -> reminder -> preview -> account isolation", async ({
      page,
      request,
    }) => {
      test.setTimeout(75_000);
      const apiBaseUrl = process.env.E2E_API_URL!;
      const sessionToken = process.env.E2E_SESSION_TOKEN!;

      await page.clock.setFixedTime(new Date("2026-11-13T09:00:00Z"));
      await page.addInitScript(
        (runtime) => {
          Object.assign(window, {
            isTauri: true,
            __TAURI_INTERNALS__: {
              invoke: async (command: string) => {
                if (command !== "get_runtime_config") throw new Error(`Unexpected command ${command}`);
                return runtime;
              },
            },
          });
        },
        { apiBaseUrl, sessionToken }
      );

      const headers = { "X-MailCompass-Session": sessionToken };
      const nav = (name: string) =>
        page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("button", { name, exact: true });

      const eml = (subject: string, body: string) =>
        Buffer.from(
          [
            "From: lan@example.test",
            "To: user@example.test",
            `Subject: ${subject}`,
            "Date: Mon, 09 Nov 2026 09:00:00 +0000",
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
          ].join("\r\n")
        );

      // Robust EML importer with explicit completion wait
      async function importMail(subject: string, body: string) {
        await page
          .getByLabel("Nhập file .eml", { exact: true })
          .setInputFiles({ name: `${subject.replace(/\s+/g, "-")}.eml`, mimeType: "message/rfc822", buffer: eml(subject, body) });
        await expect(page.getByRole("heading", { level: 3, name: subject, exact: true })).toBeVisible({ timeout: 15_000 });
      }

      let workspaceId: string;
      let accountId: string;
      let taskId: string;

      // 1. Verify health and open inbox
      await test.step("1. Verify health and initialize desktop inbox", async () => {
        const healthRes = await request.get(`${apiBaseUrl}/health`, { headers });
        expect(healthRes.status()).toBe(200);
        const healthData = await healthRes.json();
        workspaceId = healthData.workspace_id;

        const created = await request.post(`${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts`, {
          headers,
          data: { kind: "eml", display_name: "W3 EML A" },
        });
        expect(created.status()).toBe(201);
        accountId = (await created.json()).id;
        await page.goto("/");
        await expect(page.getByRole("heading", { name: "Hộp thư", level: 2 })).toBeVisible();
        await page.getByRole("combobox", { name: "Tài khoản", exact: true }).selectOption(accountId);
      });

      // 2. Import two EML files
      await test.step("2. Import 2 EML files (supporting email and main report)", async () => {
        await importMail("W3 Supporting email", "Supporting email for the report.");
        await importMail("W3 Report", RECORDED_BODY);
      });

      // 3. Trigger analysis and wait for completion
      await test.step("3. Trigger analysis and verify proposal", async () => {
        const analyzeBtn = page.getByRole("button", { name: "Phân tích", exact: true });
        await expect(analyzeBtn).toBeVisible();
        const started = page.waitForResponse(
          (r) => r.url().endsWith("/analyses") && r.request().method() === "POST",
        );
        await analyzeBtn.click();
        expect((await started).status()).toBe(202);

        const viewProposalBtn = page.getByRole("button", { name: /^Xem đề xuất/ });
        await expect(viewProposalBtn).toBeVisible({ timeout: 15_000 });
        await viewProposalBtn.click();
      });

      // 4. Review candidates and evidence
      await test.step("4. Review candidates and extracted evidence", async () => {
        const candidate = page.getByTestId("candidate");
        await expect(candidate).toHaveCount(1);
        await expect(candidate).toContainText("Gửi báo cáo tuần");
        await candidate.getByRole("button", { name: "Xem trong thư 1" }).click();
        await expect(page.getByTestId("evidence-quote")).toHaveText(
          "Chị Lan ơi, gửi báo cáo tuần trước 2026-10-30T17:00:00+07:00",
        );
      });

      // 5. Confirm candidate and assert idempotent task creation
      await test.step("5. Confirm candidate and assert idempotency", async () => {
        const candidate = page.getByTestId("candidate");
        const createTaskBtn = candidate.getByRole("button", { name: "Tạo công việc", exact: true });
        const confirmation = page.waitForResponse(
          (r) => r.url().endsWith("/tasks/from-candidate") && r.request().method() === "POST",
        );
        await createTaskBtn.click();
        const created = await confirmation;
        expect(created.status()).toBe(201);
        const createdTask = await created.json();
        const replay = await request.post(created.url(), {
          headers,
          data: created.request().postDataJSON(),
        });
        expect(replay.status()).toBe(200);
        expect((await replay.json()).id).toBe(createdTask.id);

        // Idempotency: "Tạo công việc" transforms into "Mở công việc" so repeated click cannot duplicate
        const openTaskBtn = candidate.getByRole("button", { name: "Mở công việc", exact: true });
        await expect(openTaskBtn).toBeVisible();

        // Verify at API layer that exactly 1 task exists for this candidate
        const tasksRes = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks`,
          { headers }
        );
        expect(tasksRes.status()).toBe(200);
        const tasks = (await tasksRes.json()).items;
        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Gửi báo cáo tuần");
        taskId = tasks[0].id;

        await openTaskBtn.click();
      });

      // 6. Set and update deadline in TaskEditor
      await test.step("6. Set and update deadline with reason in TaskEditor", async () => {
        const form = page.getByRole("form", { name: "Gửi báo cáo tuần", exact: true });
        const deadlineSec = form.locator(".workflow-deadline");
        await expect(deadlineSec).toBeVisible();

        await form.getByRole("button", { name: "Đặt hạn chót", exact: true }).click();
        await form.getByLabel("Ngày và giờ đến hạn").fill("2026-11-13T16:00");
        // Verify UTC preview is rendered
        await expect(form.getByText("Giờ quốc tế (UTC)", { exact: false })).toBeVisible();

        await form.getByPlaceholder("Nhập lý do xác nhận hạn chót (1–500 ký tự)").fill("Đã xác nhận với Lan");
        await form.getByRole("button", { name: "Xác nhận hạn chót" }).click();
        await expect(form.getByText("Đã cập nhật hạn chót.")).toBeVisible();

        // Verify deadline button changed to "Đổi hạn chót"
        await expect(form.getByRole("button", { name: "Đổi hạn chót", exact: true })).toBeVisible();
      });

      // 7. Verify deadline change history and audit trail
      await test.step("7. Verify deadline change history and audit trail", async () => {
        const form = page.getByRole("form", { name: "Gửi báo cáo tuần", exact: true });
        await form.getByRole("button", { name: /Lịch sử thay đổi hạn chót/ }).click();

        const historyDialog = page.getByRole("dialog", { name: "Lịch sử thay đổi hạn chót" });
        await expect(historyDialog).toBeVisible();
        await expect(historyDialog.getByText("Đã xác nhận với Lan", { exact: true })).toBeVisible();
        await expect(historyDialog.getByText(/Hạn mới/)).toBeVisible();
        await expect(historyDialog.getByText(/Người dùng xác nhận/)).toBeVisible();

        // Dismiss dialog via Escape and verify history modal closes while task editor remains open
        await page.keyboard.press("Escape");
        await expect(historyDialog).toBeHidden();
        await expect(form).toBeVisible();

        // Verify persistent audit history via API endpoint in SQLite
        const historyRes = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks/${taskId}/deadline-history`,
          { headers }
        );
        expect(historyRes.status()).toBe(200);
        const historyData = await historyRes.json();
        expect(historyData.items.length).toBeGreaterThanOrEqual(1);
        const latestHistory = historyData.items[0];
        expect(latestHistory.reason).toBe("Đã xác nhận với Lan");
        expect(latestHistory.source_kind).toBe("manual");
        expect(latestHistory.actor).toBe("local_user");
      });

      // 8. Link supporting email to task and unlink
      await test.step("8. Link supporting email and unlink with API verification", async () => {
        const form = page.getByRole("form", { name: "Gửi báo cáo tuần", exact: true });
        await form.getByRole("button", { name: "Thêm email liên quan", exact: true }).click();
        const linking = page.getByRole("dialog", { name: "Thêm email liên quan" });
        await expect(linking).toBeVisible();

        // Filter via search input
        const searchInput = linking.getByLabel("Tìm email");
        await searchInput.fill("Supporting");

        const item = linking.getByRole("listitem").filter({ hasText: "W3 Supporting email" });
        await expect(item).toBeVisible();
        await item.getByRole("button", { name: "Thêm", exact: true }).click();
        await expect(linking).toBeHidden();

        const linked = form.locator(".workflow-email").filter({ hasText: "W3 Supporting email" });
        await expect(linked).toBeVisible();

        // Verify at API layer that task message_ids includes supporting email
        const taskAfterLink = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks/${taskId}`,
          { headers }
        );
        expect(taskAfterLink.status()).toBe(200);
        const taskDataLinked = await taskAfterLink.json();
        expect(taskDataLinked.message_ids.length).toBeGreaterThanOrEqual(2);

        // Unlink supporting email
        await linked.getByRole("button", { name: "Gỡ liên kết", exact: true }).click();
        await expect(linked).toHaveCount(0);

        // Verify at API layer that task message_ids count decreased after unlinking
        const taskAfterUnlink = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks/${taskId}`,
          { headers }
        );
        expect(taskAfterUnlink.status()).toBe(200);
        const taskDataUnlinked = await taskAfterUnlink.json();
        expect(taskDataUnlinked.message_ids.length).toBe(taskDataLinked.message_ids.length - 1);

        await page.getByRole("button", { name: "Đóng chi tiết công việc" }).click();
        await expect(form).toBeHidden();
        const dueSoon = page.getByTestId("deadline-reminder-due-soon");
        await expect(dueSoon).toContainText("Gửi báo cáo tuần");
      });

      // 9. Navigate to Decision Preview ("Việc nên làm trước")
      let response: Response;
      let preview: DecisionPreview;
      let previewedTask: DecisionPreview["items"][number] | undefined;
      await test.step("9. Navigate to Decision Preview and verify scores", async () => {
        await nav("Việc nên làm trước").click();
        const previewResponse = page.waitForResponse(
          (r) => r.url().endsWith("/decision-preview") && r.request().method() === "POST"
        );
        await page.getByRole("button", { name: "Xem gợi ý", exact: true }).click();
        response = await previewResponse;
        expect(response.status()).toBe(200);
        preview = await response.json();
        expect(preview.policy_version).toBe("w2-decision-v1");
        previewedTask = preview.items.find((item) => item.title === "Gửi báo cáo tuần");
        expect(previewedTask).toBeDefined();

        // Verify priority scores structure
        const taskScore = preview.scores.find(
          (s) => s.ref.account_id === previewedTask!.ref.account_id && s.ref.task_id === previewedTask!.ref.task_id
        );
        expect(taskScore).toBeDefined();
        expect(typeof taskScore!.priority_score).toBe("number");

        await expect(page.getByText("Các công việc khác", { exact: false })).toBeVisible();
      });

      // 10. Assert Decision Preview is read-only and does not mutate task in SQLite
      await test.step("10. Assert Decision Preview read-only behavior across varying budgets", async () => {
        const taskUrl = response
          .url()
          .replace(
            /\/decision-preview$/,
            `/accounts/${previewedTask!.ref.account_id}/tasks/${previewedTask!.ref.task_id}`
          );
        const before = await request.get(taskUrl, { headers });
        expect(before.status()).toBe(200);
        const beforeData = await before.json();

        const input = response.request().postDataJSON() as DecisionPreviewRequest;
        async function previewWithBudget(budget: number): Promise<DecisionPreview> {
          const result = await request.post(response.url(), {
            headers,
            data: {
              ...input,
              policy: { ...input.policy, priority_threshold: 0, notification_budget: budget },
            },
          });
          expect(result.status()).toBe(200);
          return result.json();
        }

        // Budget 0: task cannot fit in budget, placed in over_budget
        const resBudget0 = await previewWithBudget(0);
        expect(resBudget0.selection.over_budget).toContainEqual(previewedTask!.ref);

        // Budget 1: task fits in budget, placed in selected
        const resBudget1 = await previewWithBudget(1);
        expect(resBudget1.selection.selected).toContainEqual(previewedTask!.ref);

        // Verify task in SQLite remains 100% unmutated (read-only constraint)
        const after = await request.get(taskUrl, { headers });
        expect(after.status()).toBe(200);
        const afterData = await after.json();
        expect(afterData).toEqual(beforeData);
        expect(afterData.version).toBe(beforeData.version);
        expect(afterData.updated_at).toBe(beforeData.updated_at);
      });

      // 11. Account isolation: deleting Account B does not delete Account A data
      await test.step("11. Verify account isolation: deleting Account B preserves Account A tasks and messages", async () => {
        const accountsUrl = `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts`;
        const otherName = `W3 EML B ${accountId.slice(0, 8)}`;
        const otherAccount = await request.post(accountsUrl, {
          headers,
          data: { kind: "eml", display_name: otherName },
        });
        expect(otherAccount.status()).toBe(201);
        const { id: otherId } = (await otherAccount.json()) as { id: string };
        const otherUrl = `${accountsUrl}/${otherId}`;
        const imported = await request.post(`${otherUrl}/imports`, {
          headers: { ...headers, "Idempotency-Key": "w3-import-account-b" },
          multipart: {
            file: {
              name: "account-b.eml",
              mimeType: "message/rfc822",
              buffer: eml("W3 Account B only", "This email belongs to the second test account."),
            },
          },
        });
        expect(imported.status()).toBe(202);
        const { id: importId } = (await imported.json()) as { id: string };
        await expect.poll(async () => {
          const job = await request.get(`${otherUrl}/jobs/${importId}`, { headers });
          expect(job.status()).toBe(200);
          return (await job.json()).status;
        }).toBe("succeeded");

        await page.reload();
        const accountPicker = page.getByRole("combobox", { name: "Tài khoản", exact: true });
        await accountPicker.selectOption(otherId);
        await nav("Hộp thư").click();
        await expect(page.getByRole("button", { name: /W3 Account B only/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /W3 Report/ })).toHaveCount(0);
        await nav("Tài khoản").click();
        const accountB = page.getByTestId("account-row").and(page.getByLabel(otherName, { exact: true }));
        await accountB.getByText("Quản lý", { exact: true }).click();
        await accountB.getByRole("button", { name: "Ngắt kết nối", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: "Ngắt kết nối", exact: true }).click();
        await accountB.getByRole("button", { name: "Xóa bản lưu trên máy", exact: true }).click();
        await page.getByRole("alertdialog").getByRole("button", { name: /xóa/i }).click();
        await expect(accountB.getByText("Đã xóa bản lưu trên máy.", { exact: true })).toBeVisible();
        const receipt = await request.get(`${otherUrl}/delete-local`, { headers });
        expect(receipt.status()).toBe(200);
        expect(await receipt.json()).toMatchObject({
          status: "succeeded",
          phase: "completed",
          db_counts: { messages: 1 },
        });

        // Switch back to Account A
        await accountPicker.selectOption(accountId);

        // 1. Verify Account A's tasks in UI
        await nav("Công việc").click();
        const taskRow = page.getByTestId("task-row").filter({ hasText: "Gửi báo cáo tuần" });
        await expect(taskRow).toBeVisible();

        // 2. Verify Account A's messages in UI
        await nav("Hộp thư").click();
        const backToList = page.getByRole("button", { name: "Quay lại danh sách" });
        if (await backToList.isVisible()) await backToList.click();
        await expect(page.getByRole("button", { name: /W3 Report/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /W3 Supporting email/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /W3 Account B only/ })).toHaveCount(0);

        // 3. Verify Account A's tasks and messages in SQLite via API
        const tasksRes = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks`,
          { headers }
        );
        expect(tasksRes.status()).toBe(200);
        const tasksData = await tasksRes.json();
        expect(tasksData.items.length).toBeGreaterThanOrEqual(1);
        expect(tasksData.items.some((t: any) => t.id === taskId)).toBe(true);

        const messagesRes = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/messages`,
          { headers }
        );
        expect(messagesRes.status()).toBe(200);
        const messagesData = await messagesRes.json();
        expect(messagesData.items.length).toBeGreaterThanOrEqual(2);

        const historyRes = await request.get(
          `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}/tasks/${taskId}/deadline-history`,
          { headers }
        );
        expect(historyRes.status()).toBe(200);
        const historyData = await historyRes.json();
        expect(historyData.items.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  test("W03 sync-state API, UTF-8 quoted import and recorded analysis through the desktop UI", async ({ page, request }) => {
    test.setTimeout(75_000);
    const apiBaseUrl = process.env.E2E_API_URL!;
    const sessionToken = process.env.E2E_SESSION_TOKEN!;
    const headers = { "X-MailCompass-Session": sessionToken };
    await page.addInitScript((runtime) => {
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: { invoke: async (command: string) => {
          if (command !== "get_runtime_config") throw new Error(`Unexpected command ${command}`);
          return runtime;
        } },
      });
    }, { apiBaseUrl, sessionToken });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Hộp thư", level: 2 })).toBeVisible();
    await page.getByLabel("Nhập file .eml", { exact: true }).setInputFiles({
      name: "w3_release.eml",
      mimeType: "message/rfc822",
      buffer: W3_EML,
    });
    await expect(
      page.getByRole("heading", { level: 3, name: "Báo cáo cần tháng 11", exact: true }),
    ).toBeVisible();
    const body = page.getByLabel("Nội dung email");
    await expect(body).toContainText(
      "Minh, vui lòng gửi báo cáo trước 2026-11-20T17:00:00+07:00.",
    );
    await expect(body).toContainText("Buổi họp diễn ra lúc 9 giờ.");
    await expect(body).toContainText("> Lan, gửi tài liệu cũ.");

    const analysis = page.waitForResponse(
      (response) => response.url().endsWith("/analyses") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Phân tích", exact: true }).click();
    expect((await analysis).status()).toBe(202);
    await page.getByRole("button", { name: /^Xem đề xuất/ }).click();
    await expect(page.getByTestId("candidate")).toHaveCount(1);

    const health = await request.get(`${apiBaseUrl}/health`, { headers });
    expect(health.status()).toBe(200);
    const { workspace_id } = (await health.json()) as { workspace_id: string };
    const accountsUrl = `${apiBaseUrl}/api/v1/workspaces/${workspace_id}/accounts`;

    const gmailResponse = await request.post(accountsUrl, {
      headers,
      data: { kind: "gmail", display_name: "W3 Sync-state Gmail" },
    });
    expect(gmailResponse.status()).toBe(201);
    const gmail = (await gmailResponse.json()) as { id: string };
    const syncStateUrl = `${accountsUrl}/${gmail.id}/sync-state`;
    const initial = await request.get(syncStateUrl, { headers });
    expect(initial.status()).toBe(200);
    expect(await initial.json()).toEqual({
      mode: "history_only",
      status: "disconnected",
      last_success_at: null,
      watch_expires_at: null,
      needs_full_sync: true,
      has_more: true,
      data_version: 0,
      error: null,
      consent_required: false,
    });
    const consent = await request.post(`${accountsUrl}/${gmail.id}/sync-consent`, { headers });
    expect(consent.status()).toBe(409);
    expect((await consent.json()).error.code).toBe("account_disconnected");

    // The fixture runtime intentionally has no desktop OAuth client, so the
    // public API must report configuration instead of pretending to connect.
    const oauth = await request.post(`${accountsUrl}/${gmail.id}/oauth/start`, {
      headers: { ...headers, "Idempotency-Key": "w3-oauth" },
      data: {},
    });
    expect(oauth.status()).toBe(503);
    expect((await oauth.json()).error.code).toBe("provider_not_configured");

    const emlResponse = await request.post(accountsUrl, {
      headers,
      data: { kind: "eml", display_name: "W3 Local" },
    });
    expect(emlResponse.status()).toBe(201);
    const eml = (await emlResponse.json()) as { id: string };
    const unsupported = await request.get(`${accountsUrl}/${eml.id}/sync-state`, { headers });
    expect(unsupported.status()).toBe(422);
    expect((await unsupported.json()).error.code).toBe("sync_not_supported");

    await page.getByRole("button", { name: "Quay lại hộp thư", exact: true }).click();
    await page.getByLabel("Nhập file .eml", { exact: true }).setInputFiles({
      name: "unapproved.eml",
      mimeType: "message/rfc822",
      buffer: Buffer.from(
        "From: private@example.test\r\nTo: user@example.test\r\n"
        + "Subject: Thư ngoài bộ demo\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n"
        + "Dữ liệu giả lập cần được giữ trên máy.",
      ),
    });
    await expect(page.getByRole("heading", { level: 3, name: "Thư ngoài bộ demo" })).toBeVisible();
    const blocked = page.waitForResponse(
      (response) => response.url().endsWith("/analyses") && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Phân tích", exact: true }).click();
    const denied = await blocked;
    expect(denied.status()).toBe(403);
    expect((await denied.json()).error.code).toBe("analysis_demo_only");
    await expect(page.getByText(/Gemini chỉ xử lý thư mẫu/)).toBeVisible();
  });
}

if (API_MODE && PROVIDER_MODE === "unconfigured") {
  test.describe("Week 3 Unconfigured Provider Acceptance", () => {
    test("app opens, imports and reads EML, POST analysis returns 503 and creates no proposal or task", async ({
      page,
      request,
    }) => {
      test.setTimeout(75_000);
      const apiBaseUrl = process.env.E2E_API_URL!;
      const sessionToken = process.env.E2E_SESSION_TOKEN!;

      await page.addInitScript(
        (runtime) => {
          Object.assign(window, {
            isTauri: true,
            __TAURI_INTERNALS__: {
              invoke: async (command: string) => {
                if (command !== "get_runtime_config") throw new Error(`Unexpected command ${command}`);
                return runtime;
              },
            },
          });
        },
        { apiBaseUrl, sessionToken }
      );

      const headers = { "X-MailCompass-Session": sessionToken };

      // 1. Verify /health returns ready with workspace_id in unconfigured mode
      const healthRes = await request.get(`${apiBaseUrl}/health`, { headers });
      expect(healthRes.status()).toBe(200);
      const healthData = await healthRes.json();
      expect(healthData.status).toBe("ready");
      expect(healthData.api_version).toBe("v1");
      expect(typeof healthData.workspace_id).toBe("string");
      const workspaceId = healthData.workspace_id;

      // 2. Open desktop UI and verify Inbox loads
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Hộp thư", level: 2 })).toBeVisible();

      // 3. Query initial account and baseline task counts via API
      const accountsRes = await request.get(
        `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts`,
        { headers }
      );
      expect(accountsRes.status()).toBe(200);
      const accounts = await accountsRes.json();
      expect(Array.isArray(accounts)).toBe(true);
      expect(accounts.length).toBeGreaterThan(0);
      const accountId = accounts[0].id;
      const baseApi = `${apiBaseUrl}/api/v1/workspaces/${workspaceId}/accounts/${accountId}`;

      const tasksBeforeRes = await request.get(`${baseApi}/tasks`, { headers });
      expect(tasksBeforeRes.status()).toBe(200);
      const tasksBeforeCount = (await tasksBeforeRes.json()).items.length;

      // 4. Import synthetic EML file through UI
      const eml = (subject: string, body: string) =>
        Buffer.from(
          [
            "From: lan@example.test",
            "To: user@example.test",
            `Subject: ${subject}`,
            "Date: Mon, 09 Nov 2026 09:00:00 +0000",
            "Content-Type: text/plain; charset=utf-8",
            "",
            body,
          ].join("\r\n")
        );

      const testSubject = "W3 Unconfigured Test Email";
      const testBody = "🧭 Chị Lan ơi, kiểm tra lỗi cấu hình mô hình LLM.";

      await page
        .getByLabel("Nhập file .eml", { exact: true })
        .setInputFiles({
          name: "unconfigured-test.eml",
          mimeType: "message/rfc822",
          buffer: eml(testSubject, testBody),
        });

      // Import opens the saved email in the reader.
      const mailHeading = page.getByRole("heading", { level: 3, name: testSubject, exact: true });
      await expect(mailHeading).toBeVisible();

      // 5. Read the email in the reader
      await expect(page.getByLabel("Nội dung email")).toContainText(testBody);

      // Verify message is retrievable via API
      const messagesRes = await request.get(`${baseApi}/messages`, { headers });
      expect(messagesRes.status()).toBe(200);
      const messagesData = await messagesRes.json();
      const importedMessage = messagesData.items.find((m: any) => m.subject === testSubject);
      expect(importedMessage).toBeDefined();
      const messageId = importedMessage.id;

      // 6. Trigger analysis and assert 503 response
      const analysisPromise = page.waitForResponse(
        (r) => r.url().includes("/analyses") && r.request().method() === "POST"
      );

      const analyzeBtn = page.getByRole("button", { name: "Phân tích", exact: true });
      await expect(analyzeBtn).toBeVisible();
      await analyzeBtn.click();

      const analysisResponse = await analysisPromise;
      expect(analysisResponse.status()).toBe(503);
      const errorBody = await analysisResponse.json();
      expect(errorBody.error.code).toBe("provider_not_configured");

      // 7. Verify UI displays safe error notice and email remains open & readable
      await expect(page.getByTestId("analysis-setup-needed")).toBeVisible();
      await expect(page.getByRole("button", { name: "Hủy tác vụ" })).toHaveCount(0);
      await expect(page.getByLabel("Nội dung email")).toContainText(testBody);

      // 8. Assert that no proposal was written to SQLite and task count is unchanged
      const latestAnalysisRes = await request.get(
        `${baseApi}/messages/${messageId}/analyses/latest`,
        { headers }
      );
      expect(latestAnalysisRes.status()).toBe(404);

      const tasksAfterRes = await request.get(`${baseApi}/tasks`, { headers });
      expect(tasksAfterRes.status()).toBe(200);
      const tasksAfterCount = (await tasksAfterRes.json()).items.length;
      expect(tasksAfterCount).toBe(tasksBeforeCount);

      await page.getByRole("button", { name: "Tạo việc từ thư", exact: true }).click();
      await page.getByRole("textbox", { name: "Tên công việc", exact: true }).fill("Manual work without AI");
      const created = page.waitForResponse(
        r => r.url() === `${baseApi}/tasks` && r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Lưu công việc", exact: true }).click();
      const manual = await created;
      expect(manual.status()).toBe(201);
      const saved = await manual.json();
      expect(saved.deadline_effective).toBeNull();
      expect(saved.message_ids).toContain(messageId);
      await expect(page.getByRole("dialog")).toBeVisible();
    });
  });
}
