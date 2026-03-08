import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  Minus,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AiBlock, AiBlockColor } from "@/lib/analytics/annualAnalysis";

// ── Color map ──

const colorMap: Record<AiBlockColor, string> = {
  emerald: "text-emerald-700 dark:text-emerald-400",
  red: "text-red-700 dark:text-red-400",
  amber: "text-amber-700 dark:text-amber-400",
  sky: "text-sky-700 dark:text-sky-400",
  gray: "text-gray-500 dark:text-gray-400",
  blue: "text-blue-700 dark:text-blue-400",
  violet: "text-violet-700 dark:text-violet-400",
  rose: "text-rose-700 dark:text-rose-400",
};

const bgColorMap: Record<AiBlockColor, string> = {
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  amber: "bg-amber-500",
  sky: "bg-sky-500",
  gray: "bg-gray-400",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  rose: "bg-rose-500",
};

const hexColorMap: Record<AiBlockColor, string> = {
  emerald: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  gray: "#9ca3af",
  blue: "#3b82f6",
  violet: "#8b5cf6",
  rose: "#f43f5e",
};

const calloutStyles: Record<string, string> = {
  info: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200",
  warning:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200",
  success:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
};

const calloutIcons: Record<string, React.ReactNode> = {
  info: <Info className="h-4 w-4 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />,
  success: <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />,
};

// ── Main renderer ──

export function AiBlockRenderer({ blocks }: { blocks: AiBlock[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => (
        <AiBlockItem key={index} block={block} />
      ))}
    </div>
  );
}

function AiBlockItem({ block }: { block: AiBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.content} />;
    case "callout":
      return <CalloutBlock tone={block.tone} content={block.content} />;
    case "action":
      return <ActionBlock content={block.content} />;
    case "metrics":
      return <MetricsBlock items={block.items} />;
    case "list":
      return <ListBlock title={block.title} items={block.items} />;
    case "bar-chart":
      return <BarChartBlock title={block.title} items={block.items} />;
    case "progress":
      return (
        <ProgressBlock
          label={block.label}
          current={block.current}
          total={block.total}
          color={block.color}
        />
      );
    case "trend":
      return (
        <TrendBlock
          label={block.label}
          points={block.points}
          unit={block.unit}
        />
      );
    case "comparison":
      return (
        <ComparisonBlock
          left={block.left}
          right={block.right}
          delta={block.delta}
          deltaDirection={block.deltaDirection}
        />
      );
    case "breakdown":
      return <BreakdownBlock title={block.title} items={block.items} />;
    default:
      return null;
  }
}

// ── Block components ──

function TextBlock({ content }: { content: string }) {
  return <p className="text-sm leading-relaxed">{content}</p>;
}

function CalloutBlock({
  tone,
  content,
}: {
  tone: string;
  content: string;
}) {
  return (
    <div
      className={`flex gap-2 rounded-md border px-3 py-2 text-sm ${calloutStyles[tone] ?? calloutStyles.info}`}
    >
      {calloutIcons[tone] ?? calloutIcons.info}
      <span>{content}</span>
    </div>
  );
}

function ActionBlock({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{content}</span>
    </div>
  );
}

function MetricsBlock({
  items,
}: {
  items: { label: string; value: string; color?: AiBlockColor }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((item, i) => (
        <div key={i} className="rounded-md border px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p
            className={`text-lg font-bold ${colorMap[item.color ?? "sky"]}`}
          >
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function ListBlock({ title, items }: { title?: string; items: string[] }) {
  return (
    <div>
      {title && (
        <p className="text-sm font-semibold mb-1">{title}</p>
      )}
      <ul className="list-disc pl-5 space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function BarChartBlock({
  title,
  items,
}: {
  title?: string;
  items: { label: string; value: number; color?: AiBlockColor }[];
}) {
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  return (
    <div>
      {title && (
        <p className="text-sm font-semibold mb-2">{title}</p>
      )}
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = Math.round((item.value / maxValue) * 100);
          const color = item.color ?? "sky";
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-28 truncate text-right shrink-0">
                {item.label}
              </span>
              <div className="flex-1 h-5 rounded bg-muted/40 overflow-hidden">
                <div
                  className={`h-full rounded ${bgColorMap[color]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-medium w-16 text-right shrink-0">
                {formatNumber(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProgressBlock({
  label,
  current,
  total,
  color,
}: {
  label: string;
  current: number;
  total: number;
  color?: AiBlockColor;
}) {
  const pct = total > 0 ? Math.min(Math.round((current / total) * 100), 100) : 0;
  const barColor = color ?? "emerald";

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">
          {formatNumber(current)} / {formatNumber(total)} ({pct}%)
        </span>
      </div>
      <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
        <div
          className={`h-full rounded-full ${bgColorMap[barColor]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TrendBlock({
  label,
  points,
  unit,
}: {
  label?: string;
  points: { label: string; value: number }[];
  unit?: string;
}) {
  const suffix = unit ?? "€";

  return (
    <div>
      {label && (
        <p className="text-sm font-semibold mb-2">{label}</p>
      )}
      <ResponsiveContainer width="100%" height={180}>
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            strokeOpacity={0.18}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={11}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            fontSize={11}
            tickFormatter={(v) => `${formatNumber(v as number)} ${suffix}`}
          />
          <Tooltip
            content={({ active, payload, label: tipLabel }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border bg-background px-3 py-2 shadow-sm">
                  <p className="text-xs text-muted-foreground">{tipLabel}</p>
                  <p className="text-sm font-medium">
                    {formatNumber(payload[0].value as number)} {suffix}
                  </p>
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#0ea5e9"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#0ea5e9" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ComparisonBlock({
  left,
  right,
  delta,
  deltaDirection,
}: {
  left: { label: string; value: string };
  right: { label: string; value: string };
  delta?: string;
  deltaDirection?: "up" | "down" | "flat";
}) {
  const DeltaIcon =
    deltaDirection === "up"
      ? ChevronUp
      : deltaDirection === "down"
        ? ChevronDown
        : Minus;

  const deltaColor =
    deltaDirection === "up"
      ? "text-emerald-600"
      : deltaDirection === "down"
        ? "text-red-600"
        : "text-gray-500";

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="flex-1 text-center">
        <p className="text-xs text-muted-foreground">{left.label}</p>
        <p className="text-lg font-bold">{left.value}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <DeltaIcon className={`h-4 w-4 ${deltaColor}`} />
        {delta && (
          <span className={`text-xs font-medium ${deltaColor}`}>{delta}</span>
        )}
      </div>
      <div className="flex-1 text-center">
        <p className="text-xs text-muted-foreground">{right.label}</p>
        <p className="text-lg font-bold">{right.value}</p>
      </div>
    </div>
  );
}

function BreakdownBlock({
  title,
  items,
}: {
  title?: string;
  items: { label: string; value: number; color?: AiBlockColor }[];
}) {
  // If >5 items, render as bar chart instead of donut (readability rule)
  if (items.length > 5) {
    return <BarChartBlock title={title} items={items} />;
  }

  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const defaultColors: AiBlockColor[] = [
    "sky",
    "emerald",
    "amber",
    "red",
    "violet",
  ];

  return (
    <div>
      {title && (
        <p className="text-sm font-semibold mb-2">{title}</p>
      )}
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const pct = Math.round((item.value / total) * 100);
          const color = item.color ?? defaultColors[i % defaultColors.length];
          return (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full shrink-0 ${bgColorMap[color]}`}
              />
              <span className="text-sm flex-1 truncate">{item.label}</span>
              <span className="text-xs text-muted-foreground">{pct}%</span>
              <span className="text-sm font-medium w-16 text-right">
                {formatNumber(item.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ──

function formatNumber(n: number): string {
  return new Intl.NumberFormat("it-IT", {
    maximumFractionDigits: 0,
  }).format(n);
}

// Suppress unused export warning — hexColorMap will be used for future chart
// color customization (trend lines, pie slices).
void hexColorMap;
