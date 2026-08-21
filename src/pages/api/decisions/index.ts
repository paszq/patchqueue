import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { recordDecision } from "@/lib/services/patchqueue";

export const prerender = false;

/**
 * Odrzucenie bez powodu jest niemożliwe — pilnuje tego również ograniczenie w bazie.
 * Sprawdzenie tutaj istnieje po to, żeby użytkownik dostał czytelny komunikat zamiast
 * błędu bazy, a nie po to, żeby zastąpić tamtą regułę.
 */
const schema = z
  .object({
    vulnerabilityId: z.uuid("Nieprawidłowa pozycja"),
    kind: z.enum(["patched", "rejected", "reopened"], { message: "Nieznany rodzaj rozstrzygnięcia" }),
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((value) => value.kind !== "rejected" || (value.reason ?? "").length > 0, {
    message: "Odrzucenie wymaga podania powodu",
    path: ["reason"],
  });

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const payload = Object.fromEntries(await context.request.formData());
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    const id = typeof payload.vulnerabilityId === "string" ? payload.vulnerabilityId : "";
    return backTo(context, `/items/${id}`, firstIssue(parsed.error.issues));
  }

  try {
    await recordDecision(session.db, session.userId, {
      vulnerabilityId: parsed.data.vulnerabilityId,
      kind: parsed.data.kind,
      reason: parsed.data.reason ?? null,
    });
    return backTo(context, `/items/${parsed.data.vulnerabilityId}`);
  } catch (error) {
    return backTo(context, `/items/${parsed.data.vulnerabilityId}`, messageOf(error));
  }
};
