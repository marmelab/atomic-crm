/**
 * notifyReportDiscord — Discord-notis för månadsrapporten (Bot API med knappar,
 * webhook-fallback). Kopia av notifyDiscord-mönstret i orchestrate_proposal
 * (kopierad i Fas 1 för att hålla ändringen additiv/lågrisk; utlyft till en
 * gemensam helper som separat refaktor senare). Kastar aldrig.
 */

import { supabaseAdmin } from "../supabaseAdmin.ts";
import { getDiscordApiUrl } from "../serviceEndpoints.ts";

export async function notifyReportDiscord(
  embed: {
    title: string;
    description: string;
    color: number;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
  },
  buttons?: Array<{ label: string; url: string }>,
): Promise<void> {
  try {
    const botToken = Deno.env.get("DISCORD_BOT_TOKEN") || "";
    const channelId = Deno.env.get("DISCORD_CHANNEL_ID") || "";
    const embedPayload = { ...embed, timestamp: new Date().toISOString() };

    if (botToken && channelId) {
      const payload: Record<string, unknown> = { embeds: [embedPayload] };
      if (buttons && buttons.length > 0) {
        payload.components = [
          {
            type: 1,
            components: buttons.map((btn) => ({
              type: 2,
              style: 5,
              label: btn.label,
              url: btn.url,
            })),
          },
        ];
      }
      const res = await fetch(
        `${getDiscordApiUrl()}/channels/${channelId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bot ${botToken}`,
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        console.error(
          `notifyReportDiscord: Bot API failed ${res.status} ${await res.text()}`,
        );
      }
      return;
    }

    let webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL") || "";
    if (!webhookUrl) {
      const { data } = await supabaseAdmin.rpc("get_discord_webhook_url");
      webhookUrl = (data as string) || "";
    }
    if (!webhookUrl) {
      console.warn("notifyReportDiscord: no discord webhook URL configured");
      return;
    }
    if (buttons && buttons.length > 0) {
      embedPayload.description += `\n\n${buttons
        .map((btn) => `**${btn.label}:** ${btn.url}`)
        .join("\n")}`;
    }
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embedPayload] }),
    });
  } catch (error) {
    console.warn("notifyReportDiscord: swallowed error (continuing):", error);
  }
}
