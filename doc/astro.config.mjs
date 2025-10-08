// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  base: "/atomic-crm/doc/",
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    assets: "assets",
  },
  integrations: [
    starlight({
      title: "Atomic CRM",
      favicon: "./public/favicon.svg",
      customCss: ["./src/styles/global.css"],
      logo: {
        dark: "./public/logo_atomic_crm_dark.svg",
        light: "./public/logo_atomic_crm_light.svg",
      },
      head: [
        {
          tag: "meta",
          attrs: {
            property: "og:title",
            content: "Atomic CRM Documentation",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:description",
            content: "A full-featured CRM toolkit for personalized solutions.",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:type",
            content: "website",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:url",
            content: "https://marmelab.com/atomic-crm/doc",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content:
              "https://marmelab.com/atomic-crm/img/atomic-crm-banner.png",
          },
        },
        // add Umami analytics script tag.
        {
          tag: "script",
          attrs: {
            src: "https://gursikso.marmelab.com/script.js",
            "data-website-id": "1dc1c802-5494-4c69-b507-3f2eff25091f",
            defer: true,
            async: true,
          },
        },
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/marmelab/atomic-crm",
        },
      ],
      sidebar: [
        {
          label: "Getting Started",
          link: "/",
        },
        {
          label: "Users Documentation",
          autogenerate: { directory: "users" },
        },
        {
          label: "Developers Documentation",
          autogenerate: { directory: "developers" },
        },
      ],
    }),
  ],
});
