import {
  detectForwarded,
  parseForwardedBlock,
  parseFromLine,
} from "./detectForwarded.ts";
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
    expect(result.originalBody).toBe("This is the original message body.");
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
    expect(result.originalBody).toBe("Here are the meeting notes.");
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
    expect(result.originalBody).toBe("Budget details attached.");
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
    expect(result.originalBody).toBe("Body text.");
  });

  describe("parseFromLine", () => {
    it("parses 'Name <email>' format", () => {
      const result = parseFromLine("John Doe <john@doe.com>");
      expect(result).toEqual({ name: "John Doe", email: "john@doe.com" });
    });

    it("parses 'email' format", () => {
      const result = parseFromLine("john@doe.com");
      expect(result).toEqual({ name: "", email: "john@doe.com" });
    });

    it("returns undefined for invalid format", () => {
      const result = parseFromLine("not-an-email");
      expect(result).toBeUndefined();
    });
  });

  describe("parseForwardedBlock", () => {
    it("parses forwarded block with From and body", () => {
      const blockText = `From: John Doe <john@doe.com>
Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: Hello

This is the original message body.`;
      const result = parseForwardedBlock(blockText);
      expect(result.originalFrom).toEqual({
        name: "John Doe",
        email: "john@doe.com",
      });
      expect(result.originalBody).toBe("This is the original message body.");
    });

    it("handles missing From line", () => {
      const blockText = `Date: Mon, 1 Jan 2024 10:00:00 +0000
Subject: Hello

Body without From line.`;
      const result = parseForwardedBlock(blockText);
      expect(result.originalFrom).toBeUndefined();
      expect(result.originalBody).toBe("Body without From line.");
    });

    it("handles no blank line by leaving the body untounched", () => {
      const blockText = `From: John Doe <john@doe.com>
This is the body without a blank line separator.`;
      const result = parseForwardedBlock(blockText);
      expect(result.originalFrom).toEqual({
        name: "John Doe",
        email: "john@doe.com",
      });
      expect(result.originalBody).toBe(
        "From: John Doe <john@doe.com>\nThis is the body without a blank line separator.",
      );
    });
  });
});
