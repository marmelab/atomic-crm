import { describe, it, expect } from "vitest";
import {
  stripForwardingHeaderBlock,
  stripSubjectForwardingPrefix,
} from "./forwardedParser";

describe("stripForwardingHeaderBlock", () => {
  describe("returns original text when no forwarding separator is found", () => {
    it("returns the original text for plain content", () => {
      const text = "Hello, this is a regular email body.";
      expect(stripForwardingHeaderBlock(text)).toBe(text);
    });

    it("trims whitespace when no separator is found", () => {
      const text = "  Hello world  ";
      expect(stripForwardingHeaderBlock(text)).toBe("Hello world");
    });

    it("returns original text when separator is not on the first line", () => {
      const text =
        "Some intro line\n---------- Forwarded message ----------\nActual content";
      expect(stripForwardingHeaderBlock(text)).toBe(text.trim());
    });
  });

  describe("Gmail forwarded separator", () => {
    it("strips the Gmail forwarded header block", () => {
      const text = [
        "---------- Forwarded message ----------",
        "From: Alice <alice@example.com>",
        "Date: Mon, 24 Feb 2026 10:00:00 +0000",
        "Subject: Meeting notes",
        "To: Bob <bob@example.com>",
        "",
        "Hi Bob,",
        "",
        "Here are the meeting notes.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "Hi Bob,\n\nHere are the meeting notes.",
      );
    });
  });

  describe("Apple Mail forwarded separator", () => {
    it("strips the Apple Mail forwarded header block", () => {
      const text = [
        "Begin forwarded message:",
        "From: Alice <alice@example.com>",
        "Subject: Hello",
        "Date: 24 Feb 2026",
        "To: Bob <bob@example.com>",
        "",
        "This is the original message.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "This is the original message.",
      );
    });
  });

  describe("Outlook / Exchange forwarded separator", () => {
    it("strips the Outlook forwarded header block", () => {
      const text = [
        "-----Original Message-----",
        "From: Alice <alice@example.com>",
        "Sent: Monday, February 24, 2026 10:00 AM",
        "To: Bob <bob@example.com>",
        "Subject: Project update",
        "",
        "Please find the update below.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "Please find the update below.",
      );
    });
  });

  describe("French forwarded separators", () => {
    it("strips the 'Message transféré' header block", () => {
      const text = [
        "---------- Message transféré ----------",
        "De : Alice <alice@example.com>",
        "Date : 24 févr. 2026",
        "Objet : Réunion",
        "",
        "Bonjour,",
        "",
        "Voici le message.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "Bonjour,\n\nVoici le message.",
      );
    });

    it("strips the 'Transféré' header block", () => {
      const text = [
        "----- Transféré -----",
        "De : Alice <alice@example.com>",
        "",
        "Le message transféré.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe("Le message transféré.");
    });

    it("strips the ASCII-variant 'Message transfere' header block", () => {
      const text = [
        "---------- Message transfere ----------",
        "De : Alice <alice@example.com>",
        "",
        "Bonjour.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe("Bonjour.");
    });
  });

  describe("German forwarded separator", () => {
    it("strips the 'Weitergeleitete Nachricht' header block", () => {
      const text = [
        "---------- Weitergeleitete Nachricht ----------",
        "Von: Alice <alice@example.com>",
        "Datum: 24. Feb. 2026",
        "Betreff: Projekt",
        "",
        "Hallo,",
        "",
        "Hier ist die Nachricht.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "Hallo,\n\nHier ist die Nachricht.",
      );
    });
  });

  describe("edge cases", () => {
    it("returns original text when stripping results in an empty body", () => {
      const text = [
        "---------- Forwarded message ----------",
        "From: Alice <alice@example.com>",
      ].join("\n");

      // No blank line → bodyStartIndex stays 0, slicing from 0 is the whole text.
      // In this case, the while loop never finds a blank line and bodyStartIndex = 0.
      // The strippedBody will be the original text trimmed.
      expect(stripForwardingHeaderBlock(text)).toBe(text.trim());
    });

    it("returns original text when body after header block is empty", () => {
      const text = [
        "---------- Forwarded message ----------",
        "From: Alice <alice@example.com>",
        "",
        "   ",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(text.trim());
    });

    it("preserves multi-paragraph body content", () => {
      const text = [
        "---------- Forwarded message ----------",
        "From: Alice <alice@example.com>",
        "",
        "First paragraph.",
        "",
        "Second paragraph.",
        "",
        "Third paragraph.",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe(
        "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
      );
    });

    it("trims leading and trailing whitespace from the result", () => {
      const text = [
        "---------- Forwarded message ----------",
        "From: Alice",
        "",
        "  ",
        "  Body content  ",
        "  ",
      ].join("\n");

      expect(stripForwardingHeaderBlock(text)).toBe("Body content");
    });
  });
});

describe("stripSubjectForwardingPrefix", () => {
  it("strips 'Fwd:' prefix", () => {
    expect(stripSubjectForwardingPrefix("Fwd: Hello")).toBe("Hello");
  });

  it("strips 'FW:' prefix", () => {
    expect(stripSubjectForwardingPrefix("FW: Hello")).toBe("Hello");
  });

  it("strips 'FWD:' prefix", () => {
    expect(stripSubjectForwardingPrefix("FWD: Hello")).toBe("Hello");
  });

  it("strips 'Tr:' prefix (French)", () => {
    expect(stripSubjectForwardingPrefix("Tr: Bonjour")).toBe("Bonjour");
  });

  it("strips 'SV:' prefix (Scandinavian)", () => {
    expect(stripSubjectForwardingPrefix("SV: Hei")).toBe("Hei");
  });

  it("strips 'VS:' prefix", () => {
    expect(stripSubjectForwardingPrefix("VS: Hallo")).toBe("Hallo");
  });

  it("strips 'WG:' prefix (German)", () => {
    expect(stripSubjectForwardingPrefix("WG: Hallo")).toBe("Hallo");
  });

  it("is case-insensitive", () => {
    expect(stripSubjectForwardingPrefix("fwd: lowercase")).toBe("lowercase");
    expect(stripSubjectForwardingPrefix("FWD - Mixed")).toBe("Mixed");
  });

  it("returns the subject unchanged when no prefix is present", () => {
    expect(stripSubjectForwardingPrefix("Meeting notes")).toBe("Meeting notes");
  });

  it("handles dash separator instead of colon", () => {
    expect(stripSubjectForwardingPrefix("Fwd - My subject")).toBe("My subject");
  });

  it("should return original subject if stripping results in empty string", () => {
    const subject = "Fwd: ";
    expect(stripSubjectForwardingPrefix(subject)).toBe(subject);
  });
});
