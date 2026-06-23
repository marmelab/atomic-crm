import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { ReportAiContent, ReportViewModel } from "./types.ts";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function statusLabel(status: string): string {
  if (status === "good") return "Bra";
  if (status === "needs_attention") return "Kan förbättras";
  if (status === "poor") return "Behöver åtgärdas";
  return "Data saknas";
}

function pct(value: number | null): string {
  if (value == null) return "ingen jämförelse";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded} %`;
}

export async function buildReportPdf(input: {
  viewModel: ReportViewModel;
  aiContent: ReportAiContent;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const colors = {
    ink: rgb(0.06, 0.09, 0.16),
    muted: rgb(0.35, 0.4, 0.48),
    line: rgb(0.88, 0.9, 0.93),
    blue: rgb(0.11, 0.39, 0.72),
    paleBlue: rgb(0.93, 0.96, 1),
    green: rgb(0.09, 0.55, 0.32),
    amber: rgb(0.82, 0.48, 0.06),
    red: rgb(0.78, 0.16, 0.16),
  };

  let page: PDFPage;
  let y: number;

  const newPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText("AXONA DIGITAL", {
      x: MARGIN,
      y,
      size: 10,
      font: bold,
      color: colors.blue,
    });
    page.drawText(input.viewModel.period.label, {
      x: PAGE_WIDTH - MARGIN - 85,
      y,
      size: 9,
      font: regular,
      color: colors.muted,
    });
    y -= 28;
  };

  const ensure = (height: number) => {
    if (y - height < MARGIN) newPage();
  };

  const heading = (text: string, size = 17) => {
    ensure(size + 18);
    page.drawText(text, { x: MARGIN, y, size, font: bold, color: colors.ink });
    y -= size + 10;
  };

  const paragraph = (
    text: string,
    options: { size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    const size = options.size ?? 10.5;
    const lines = wrapText(text, regular, size, CONTENT_WIDTH);
    ensure(lines.length * (size + 4) + 8);
    for (const line of lines) {
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font: regular,
        color: options.color ?? colors.muted,
      });
      y -= size + 4;
    }
    y -= 5;
  };

  const labelValue = (label: string, value: string, note?: string) => {
    ensure(34);
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 9,
      font: regular,
      color: colors.muted,
    });
    page.drawText(value, {
      x: MARGIN + 210,
      y,
      size: 11,
      font: bold,
      color: colors.ink,
    });
    if (note) {
      page.drawText(note, {
        x: MARGIN + 330,
        y,
        size: 9,
        font: regular,
        color: colors.muted,
      });
    }
    y -= 22;
    page.drawLine({
      start: { x: MARGIN, y: y + 8 },
      end: { x: PAGE_WIDTH - MARGIN, y: y + 8 },
      thickness: 0.5,
      color: colors.line,
    });
  };

  newPage();
  page.drawRectangle({
    x: 0,
    y: PAGE_HEIGHT - 235,
    width: PAGE_WIDTH,
    height: 175,
    color: colors.paleBlue,
  });
  page.drawText("Månatlig synlighetsrapport", {
    x: MARGIN,
    y: PAGE_HEIGHT - 110,
    size: 25,
    font: bold,
    color: colors.ink,
  });
  page.drawText(input.viewModel.companyName, {
    x: MARGIN,
    y: PAGE_HEIGHT - 143,
    size: 17,
    font: regular,
    color: colors.blue,
  });
  page.drawText(
    `${input.viewModel.period.start} – ${input.viewModel.period.end}`,
    {
      x: MARGIN,
      y: PAGE_HEIGHT - 170,
      size: 10,
      font: regular,
      color: colors.muted,
    },
  );
  y = PAGE_HEIGHT - 270;
  heading("Månadens viktigaste");
  paragraph(input.aiContent.summary, { size: 12, color: colors.ink });
  paragraph(
    `Datatäckning: ${input.viewModel.coverage.available} av ${input.viewModel.coverage.total} källor. ${
      input.viewModel.coverage.missingSources.length
        ? `Saknas: ${input.viewModel.coverage.missingSources.join(", ")}.`
        : "Alla planerade källor kunde analyseras."
    }`,
  );

  heading("Google-synlighet");
  const metrics = input.viewModel.metrics;
  labelValue(
    "Klick från Google",
    metrics.clicks.current?.toLocaleString("sv-SE") ?? "Data saknas",
    pct(metrics.clicks.deltaPct),
  );
  labelValue(
    "Visningar i sökresultat",
    metrics.impressions.current?.toLocaleString("sv-SE") ?? "Data saknas",
    pct(metrics.impressions.deltaPct),
  );
  labelValue(
    "Klickfrekvens",
    metrics.ctr.current == null
      ? "Data saknas"
      : `${metrics.ctr.current.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} %`,
    pct(metrics.ctr.deltaPct),
  );
  labelValue(
    "Genomsnittlig position",
    metrics.position.current?.toLocaleString("sv-SE", {
      maximumFractionDigits: 1,
    }) ?? "Data saknas",
    metrics.position.deltaAbsolute == null
      ? undefined
      : `${metrics.position.deltaAbsolute < 0 ? "förbättring" : "försämring"} ${Math.abs(metrics.position.deltaAbsolute).toFixed(1)}`,
  );

  if (metrics.topQueries.length) {
    heading("Sökord som driver trafik", 14);
    metrics.topQueries
      .slice(0, 5)
      .forEach((query) =>
        labelValue(
          query.query,
          `${query.clicks.toLocaleString("sv-SE")} klick`,
          `position ${query.position.toFixed(1)}`,
        ),
      );
  }

  if (metrics.opportunities.length) {
    heading("Sökord med störst potential", 14);
    metrics.opportunities.slice(0, 6).forEach((item) => {
      const reason =
        item.kind === "low_ctr"
          ? "många visningar men få klick"
          : item.kind === "position_4_10"
            ? "redan på första sidan"
            : "nära första sidan";
      labelValue(
        item.query,
        `${item.impressions.toLocaleString("sv-SE")} visningar`,
        reason,
      );
    });
  }

  heading("Fyra delar av synligheten");
  const statusRows = [
    ["Google-synlighet", input.viewModel.statuses.googleVisibility],
    ["Sidupplevelse", input.viewModel.statuses.pageExperience],
    ["Lokal synlighet", input.viewModel.statuses.localVisibility],
    ["Teknisk grund", input.viewModel.statuses.technicalFoundation],
  ] as const;
  statusRows.forEach(([label, status]) => {
    const color =
      status === "good"
        ? colors.green
        : status === "poor"
          ? colors.red
          : status === "missing"
            ? colors.muted
            : colors.amber;
    ensure(30);
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 11,
      font: bold,
      color: colors.ink,
    });
    page.drawText(statusLabel(status), {
      x: MARGIN + 260,
      y,
      size: 10,
      font: bold,
      color,
    });
    y -= 25;
  });

  heading("Sidupplevelse");
  const realLcp = metrics.field_lcp_ms.current;
  labelValue(
    "Verklig laddtid (LCP)",
    realLcp == null ? "Fältdata saknas" : `${(realLcp / 1000).toFixed(1)} s`,
    realLcp == null
      ? "Lighthouse visas separat som labbtest"
      : "mål: under 2,5 s",
  );
  labelValue(
    "Verklig svarstid (INP)",
    metrics.field_inp_ms.current == null
      ? "Fältdata saknas"
      : `${Math.round(metrics.field_inp_ms.current)} ms`,
    "mål: under 200 ms",
  );
  labelValue(
    "Layoutstabilitet (CLS)",
    metrics.field_cls.current == null
      ? "Fältdata saknas"
      : metrics.field_cls.current.toFixed(2),
    "mål: under 0,10",
  );
  labelValue(
    "Lighthouse prestandapoäng",
    metrics.performance_score.current?.toFixed(0) ?? "Data saknas",
    "syntetiskt mobiltest, inte verkliga besökare",
  );

  heading("Teknisk grund");
  input.viewModel.technicalChecks.forEach((check) =>
    labelValue(
      check.label,
      check.passed == null
        ? "Ej kontrollerad"
        : check.passed
          ? "Finns"
          : "Saknas",
      check.explanation,
    ),
  );

  heading("Prioriterad åtgärdsplan");
  if (input.viewModel.recommendations.length) {
    input.viewModel.recommendations.slice(0, 6).forEach((item, index) => {
      ensure(70);
      page.drawText(`${index + 1}. ${item.title}`, {
        x: MARGIN,
        y,
        size: 11,
        font: bold,
        color: colors.ink,
      });
      y -= 17;
      paragraph(`${item.description} Rekommenderad insats: ${item.service}.`);
    });
  } else {
    paragraph("Inga tydliga kritiska brister hittades i tillgängliga källor.");
  }

  heading("Vad vi rekommenderar härnäst");
  paragraph(input.aiContent.recommended_action, {
    size: 12,
    color: colors.ink,
  });
  paragraph(input.aiContent.upsell_pitch);

  heading("Så ska rapporten läsas", 14);
  paragraph(
    "Search Console visar faktisk organisk synlighet under den angivna kalenderperioden. Verkliga Core Web Vitals bygger på besöksdata när Google har tillräckligt underlag. Lighthouse är ett kontrollerat mobiltest och används som teknisk diagnostik, inte som ersättning för verklig besöksdata.",
  );

  const pages = pdf.getPages();
  pages.forEach((currentPage, index) => {
    currentPage.drawText(`Sida ${index + 1} av ${pages.length}`, {
      x: PAGE_WIDTH - MARGIN - 60,
      y: 24,
      size: 8,
      font: regular,
      color: colors.muted,
    });
  });

  pdf.setTitle(
    `Synlighetsrapport ${input.viewModel.companyName} ${input.viewModel.period.label}`,
  );
  pdf.setAuthor("Axona Digital AB");
  return pdf.save();
}
