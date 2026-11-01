// @vitest-environment node
import { afterEach, describe, it, expect, vi } from "vitest";
import { getCandidateNames, type WebhookPayload } from "./candidateNames";

const BUCKET_URL =
  "http://127.0.0.1:54321/storage/v1/object/public/attachments";

const payloadWith = (attachments: unknown[]) =>
  ({ old_record: { attachments } }) as WebhookPayload;

describe("getCandidateNames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the file names stored in the attachments paths", () => {
    const payload = payloadWith([
      { path: "0.8262106278726917.pdf" },
      { path: "0.1234" },
    ]);

    expect(getCandidateNames(payload)).toEqual([
      "0.8262106278726917.pdf",
      "0.1234",
    ]);
  });

  it("reads the name from the src URL when the path is missing or empty", () => {
    const payload = payloadWith([
      { src: `${BUCKET_URL}/0.11.pdf` },
      { path: "", src: `${BUCKET_URL}/0.22.png` },
      { path: null, src: `${BUCKET_URL}/0.33.my%20ext` },
    ]);

    expect(getCandidateNames(payload)).toEqual([
      "0.11.pdf",
      "0.22.png",
      "0.33.my ext",
    ]);
  });

  it("ignores names that do not look like files uploaded by the app", () => {
    const payload = payloadWith([
      { path: "../0.1.txt" },
      { path: "dir/0.12.txt" },
      { path: "attachments/0.13.txt" },
      { path: "logo.png" },
      { path: "0.14.tar.gz" },
      { path: "9.5e-7.pdf" },
      { src: `${BUCKET_URL}/logo.png` },
      { src: `${BUCKET_URL}/..%2F0.15.txt` },
      { src: "not a url" },
    ]);

    expect(getCandidateNames(payload)).toEqual([]);
  });

  it("returns each name once", () => {
    const payload = payloadWith([
      { path: "0.5.pdf" },
      { path: "0.5.pdf", src: `${BUCKET_URL}/0.5.pdf` },
    ]);

    expect(getCandidateNames(payload)).toEqual(["0.5.pdf"]);
  });

  it("returns no names when the payload has no usable attachments", () => {
    expect(getCandidateNames({})).toEqual([]);
    expect(getCandidateNames({ old_record: null })).toEqual([]);
    expect(
      getCandidateNames({
        old_record: { attachments: "0.1.pdf" },
      } as unknown as WebhookPayload),
    ).toEqual([]);
    expect(getCandidateNames(payloadWith([null, 42, {}]))).toEqual([]);
  });

  it("checks at most 100 names per call", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const payload = payloadWith(
      Array.from({ length: 120 }, (_, i) => ({ path: `0.${i + 1}.pdf` })),
    );

    const names = getCandidateNames(payload);

    expect(names).toHaveLength(100);
    expect(names[0]).toBe("0.1.pdf");
    expect(names[99]).toBe("0.100.pdf");
  });
});
