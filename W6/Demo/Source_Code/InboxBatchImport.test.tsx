import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InboxPage } from "../../src/features/inbox/InboxPage";
import { createMockClient } from "../../src/api/mock";
import { UiMemory, UiSessionProvider } from "../../src/uiSession";
import type { AccountScope } from "../../src/api/types";
import { t } from "../../src/strings";
import { SAMPLE_EML } from "../../src/api/fixtures";

describe("InboxPage Batch .eml Import", () => {
  const scope: AccountScope = { workspace_id: "ws-mock", account_id: "a" };

  it("renders a file input supporting multiple .eml selection and drag-drop zone", () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      accounts: [{ id: "a", display_name: "Account A" }],
    });

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <InboxPage client={client} scope={scope} onOpenTask={vi.fn()} />
      </UiSessionProvider>,
    );

    const input = screen.getByLabelText(t.inbox.importLabel) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("file");
    expect(input.multiple).toBe(true);
    expect(input.accept).toContain(".eml");
  });

  it("imports multiple valid .eml files sequentially and displays completion count", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      jobPolls: 0,
      accounts: [{ id: "a", display_name: "Account A" }],
    });

    const importSpy = vi.spyOn(client, "importEml");

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <InboxPage client={client} scope={scope} onOpenTask={vi.fn()} pollIntervalMs={5} />
      </UiSessionProvider>,
    );

    const input = screen.getByLabelText(t.inbox.importLabel);
    const file1 = new File([SAMPLE_EML], "email1.eml", { type: "message/rfc822" });
    const file2 = new File([SAMPLE_EML], "email2.eml", { type: "message/rfc822" });

    fireEvent.change(input, { target: { files: [file1, file2] } });

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.getByText(t.inbox.importDoneCount(2))).toBeInTheDocument();
    });
  });

  it("filters out invalid files, warns user, and processes remaining valid files", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      jobPolls: 0,
      accounts: [{ id: "a", display_name: "Account A" }],
    });

    const importSpy = vi.spyOn(client, "importEml");

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <InboxPage client={client} scope={scope} onOpenTask={vi.fn()} pollIntervalMs={5} />
      </UiSessionProvider>,
    );

    const input = screen.getByLabelText(t.inbox.importLabel);
    const validFile = new File([SAMPLE_EML], "valid.eml", { type: "message/rfc822" });
    const invalidFile = new File(["not an email"], "invalid.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [invalidFile, validFile] } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(t.inbox.invalidFilesSkipped(1));
    });

    await waitFor(() => {
      expect(importSpy).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText(t.inbox.importDone)).toBeInTheDocument();
    });
  });

  it("retries an uncertain upload with the original key and continues the batch", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      jobPolls: 0,
      accounts: [{ id: "a", display_name: "Account A" }],
    });
    const importSpy = vi.spyOn(client, "importEml").mockRejectedValueOnce(new Error("Network lost"));
    render(
      <UiSessionProvider memory={new UiMemory()}>
        <InboxPage client={client} scope={scope} onOpenTask={vi.fn()} pollIntervalMs={5} />
      </UiSessionProvider>,
    );

    const first = new File([SAMPLE_EML], "first.eml", { type: "message/rfc822" });
    const second = new File([SAMPLE_EML], "second.eml", { type: "message/rfc822" });
    fireEvent.change(screen.getByLabelText(t.inbox.importLabel), { target: { files: [first, second] } });
    fireEvent.click(await screen.findByRole("button", { name: t.common.retry }));
    await screen.findByText(t.inbox.importDoneCount(2));

    expect(importSpy).toHaveBeenCalledTimes(3);
    const firstKey = importSpy.mock.calls[0][2];
    expect(importSpy.mock.calls[1].slice(1, 3)).toEqual([first, firstKey]);
    expect(importSpy.mock.calls[2][1]).toBe(second);
    expect(importSpy.mock.calls[2][2]).not.toBe(firstKey);
  });

  it("rejects batch if all files are invalid", async () => {
    const client = createMockClient({
      workspaceId: "ws-mock",
      jobPolls: 0,
      accounts: [{ id: "a", display_name: "Account A" }],
    });

    const importSpy = vi.spyOn(client, "importEml");

    render(
      <UiSessionProvider memory={new UiMemory()}>
        <InboxPage client={client} scope={scope} onOpenTask={vi.fn()} pollIntervalMs={5} />
      </UiSessionProvider>,
    );

    const input = screen.getByLabelText(t.inbox.importLabel);
    const invalid1 = new File(["1"], "doc.txt", { type: "text/plain" });
    const invalid2 = new File(["2"], "image.png", { type: "image/png" });

    fireEvent.change(input, { target: { files: [invalid1, invalid2] } });

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(t.inbox.invalidFile);
    });

    expect(importSpy).not.toHaveBeenCalled();
  });
});
