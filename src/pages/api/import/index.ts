import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { adapterFor, detectAdapter } from "@/lib/domain/import/adapters";
import { SOURCE_FORMATS } from "@/lib/domain/import/finding";
import { importFindings } from "@/lib/services/import";

export const prerender = false;

const schema = z.object({
  raw: z.string().trim().min(1, "Wklej treść do wczytania"),
  format: z.union([z.enum(SOURCE_FORMATS), z.literal("auto")]).default("auto"),
  fallbackAssetId: z.string().optional(),
});

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const parsed = schema.safeParse(Object.fromEntries(await context.request.formData()));
  if (!parsed.success) {
    return backTo(context, "/import", firstIssue(parsed.error.issues));
  }

  const { raw, format, fallbackAssetId } = parsed.data;
  const adapter = format === "auto" ? detectAdapter(raw) : adapterFor(format);
  if (adapter === null) {
    return backTo(context, "/import", "Nie rozpoznano formatu — wskaż go ręcznie na liście.");
  }

  try {
    const result = adapter.parse(raw);
    const summary = await importFindings(
      session.db,
      session.userId,
      result.findings,
      fallbackAssetId !== undefined && fallbackAssetId !== "" ? fallbackAssetId : null,
    );

    const params = new URLSearchParams({
      format: adapter.format,
      added: String(summary.added),
      skipped: String(summary.skipped),
      rejected: String(result.rejected.length),
    });
    return context.redirect(`/import?${params.toString()}`, 303);
  } catch (error) {
    return backTo(context, "/import", messageOf(error));
  }
};
