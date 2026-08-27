import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { adapterFor, detectAdapter } from "@/lib/domain/import/adapters";
import { SOURCE_FORMATS } from "@/lib/domain/import/finding";
import { importFindings } from "@/lib/services/import";

export const prerender = false;

const schema = z.object({
  raw: z.string().trim().min(1, "Załącz plik albo wklej treść do wczytania"),
  format: z.union([z.enum(SOURCE_FORMATS), z.literal("auto")]).default("auto"),
  fallbackAssetId: z.string().optional(),
});

/** Granica dla załącznika. Raport skanera w CSV mieści się w tym z dużym zapasem. */
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** `FormData` zwraca też pliki — do pól tekstowych przepuszczamy wyłącznie łańcuchy. */
function textField(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === "string" && value !== "" ? value : undefined;
}

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const form = await context.request.formData();

  // Załącznik i wklejona treść wchodzą tą samą ścieżką: plik jest tylko innym sposobem
  // dostarczenia tekstu, a nie osobnym trybem wczytywania. Dzięki temu adaptery,
  // dopasowanie do zasobów i podsumowanie działają identycznie w obu przypadkach.
  const upload = form.get("file");
  const file = upload instanceof File && upload.size > 0 ? upload : null;
  if (file !== null && file.size > MAX_UPLOAD_BYTES) {
    return backTo(
      context,
      "/import",
      `Plik jest za duży — limit to ${(MAX_UPLOAD_BYTES / 1024 / 1024).toString()} MB.`,
    );
  }

  const parsed = schema.safeParse({
    // Gdy użytkownik zrobił obie rzeczy naraz, wygrywa plik — to on jest jawnym wyborem.
    raw: file !== null ? await file.text() : (textField(form, "raw") ?? ""),
    format: textField(form, "format") ?? "auto",
    fallbackAssetId: textField(form, "fallbackAssetId"),
  });
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
