import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { deleteVulnerability, getVulnerabilityWithAsset, updateVulnerability } from "@/lib/services/patchqueue";

export const prerender = false;

const updateSchema = z.object({
  _action: z.literal("update"),
  // Wielkie litery, bo tak samo normalizuje identyfikator ścieżka wczytywania.
  // Bez tego regułę unikalności w bazie dałoby się obejść zmianą wielkości liter.
  identifier: z
    .string()
    .trim()
    .min(1, "Identyfikator podatności jest wymagany")
    .max(100)
    .transform((value) => value.toUpperCase()),
  cvss: z.coerce
    .number({ message: "Ocena CVSS musi być liczbą" })
    .min(0, "Ocena CVSS nie może być ujemna")
    .max(10, "Ocena CVSS nie może przekraczać 10"),
  description: z.string().trim().max(5000).default(""),
});

const deleteSchema = z.object({ _action: z.literal("delete") });

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const id = context.params.id ?? "";
  const payload = Object.fromEntries(await context.request.formData());

  if (deleteSchema.safeParse(payload).success) {
    try {
      const entry = await getVulnerabilityWithAsset(session.db, id);
      await deleteVulnerability(session.db, id);
      return backTo(context, `/assets/${entry.asset.id}`);
    } catch (error) {
      return backTo(context, `/items/${id}`, messageOf(error));
    }
  }

  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) {
    return backTo(context, `/items/${id}`, firstIssue(parsed.error.issues));
  }

  try {
    const { _action, ...input } = parsed.data;
    void _action;
    await updateVulnerability(session.db, id, input);
    return backTo(context, `/items/${id}`);
  } catch (error) {
    return backTo(context, `/items/${id}`, messageOf(error));
  }
};
