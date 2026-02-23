import { detectForwarded } from "./detectForwarded.ts";
import { describe, expect, it } from "vitest";

describe("detectForwarded", () => {
  it("detects Gmail forwarded block", () => {
    const subject = "Fwd: Project update";
    const textBody = `Hello team,

----- Forwarded message -----
From: John Doe <john@example.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: Re: Project update
To: sales@atomic-crm.com

This is the original message body.`;
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom!).toEqual({
      name: "John Doe",
      email: "john@example.com",
    });
    expect(result.originalBody).toContain("This is the original message body.");
  });

  it("detects Apple Mail forwarded block", () => {
    const subject = "FW: Meeting notes";
    const textBody = `Begin forwarded message:
From: Jane Smith <jane@company.com>
Date: Tue, 2 Feb 2024 09:00:00 +0000
Subject: Meeting notes
To: sales@atomic-crm.com

Here are the meeting notes.`;
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom).toEqual({
      name: "Jane Smith",
      email: "jane@company.com",
    });
    expect(result.originalBody).toContain("Here are the meeting notes.");
  });

  it("detects Outlook forwarded block", () => {
    const subject = "Fwd: Budget";
    const textBody = `-----Original Message-----
From: Bob Brown <bob@biz.com>
Sent: Wednesday, March 3, 2024 8:00 AM
To: sales@atomic-crm.com
Subject: Budget

Budget details attached.`;
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom).toEqual({
      name: "Bob Brown",
      email: "bob@biz.com",
    });
    expect(result.originalBody).toContain("Budget details attached.");
  });

  it("detects Resent-From header", () => {
    const subject = "Fwd: Invoice";
    const textBody = "See attached invoice.";
    const headers = [
      { Name: "Resent-From", Value: "Alice <alice@domain.com>" },
    ];
    const result = detectForwarded(subject, textBody, headers);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom).toEqual({
      name: "Alice",
      email: "alice@domain.com",
    });
  });

  it("flags subject prefix only", () => {
    const subject = "Fwd: No body separator";
    const textBody = "Just a forwarded message, no separator.";
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom).toBeUndefined();
  });

  it("does not flag replies", () => {
    const subject = "Re: Follow up";
    const textBody = "This is a reply, not a forward.";
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(false);
  });

  it("handles malformed From line", () => {
    const subject = "Fwd: Weird format";
    const textBody = `----- Forwarded message -----
From: not-an-email
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: Re: Project update
To: sales@atomic-crm.com

Body text.`;
    const result = detectForwarded(subject, textBody);
    expect(result.isForwarded).toBe(true);
    expect(result.originalFrom).toBeUndefined();
    expect(result.originalBody).toContain("Body text.");
  });
});
