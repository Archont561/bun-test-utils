import { defineCollection } from "astro:content";
import { docsLoader } from "@astrojs/starlight/loaders";
import { docsSchema } from "@astrojs/starlight/schema";
import { z } from "astro/zod";

/**
 * Starlight's frontmatter plus the fields the docs conventions render:
 * `src/remark/status-badges.mjs` turns them into the badge row at the top of
 * a page, and `apps/docs/README.md` says when to set them.
 */
export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** Maturity tier from ADR 0018/0019: `stable` renders "Stable". */
        status: z.enum(["stable", "experimental"]).optional(),
        /** Package version the page first described. */
        since: z.string().optional(),
        /** Optional peer packages the page's capability needs. */
        requires: z.array(z.string()).optional(),
        /** Support window, when the page narrows it below Linux and macOS. */
        platforms: z.string().optional(),
      }),
    }),
  }),
};
