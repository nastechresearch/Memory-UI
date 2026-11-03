import { createFileRoute } from "@tanstack/react-router";
import { MemoryHud } from "@/components/hud/MemoryHud";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nastech Neural Memory HUD" },
      { name: "description", content: "Live animated holographic AI memory HUD: thinking, recall, learning and reasoning in real time." },
      { property: "og:title", content: "Nastech Neural Memory HUD" },
      { property: "og:description", content: "Live animated holographic AI memory HUD for the Nastech holographic plugin." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MemoryHud,
});
