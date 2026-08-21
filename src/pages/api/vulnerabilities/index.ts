import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { createVulnerability } from "@/lib/services/patchqueue";

export const prerender = false;

const schema = z.object({
  assetId: z.uuid("Nieprawidłowy zasób"),
  identifier: z.string().trim().min(1, "Identyfikator podatności jest wymagany").max(100),
  cvss: z.coerce
    .number({ message: "Ocena CVSS musi być liczbą" })
    .min(0, "Ocena CVSS nie może być ujemna")
    .max(10, "Ocena CVSS nie może przekraczać 10"),
  description: z.string().trim().max(5000).default(""),
});

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const payload = Object.fromEntries(await context.request.formData());
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const assetId = typeof payload.assetId === "string" ? payload.assetId : "";
    return backTo(context, `/assets/${assetId}`, firstIssue(parsed.error.issues));
  }

  try {
    const created = await createVulnerability(session.db, session.userId, parsed.data);
    return backTo(context, `/items/${created.id}`);
  } catch (error) {
    return backTo(context, `/assets/${parsed.data.assetId}`, messageOf(error));
  }
};
