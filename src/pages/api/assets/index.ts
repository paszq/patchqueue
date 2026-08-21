import type { APIRoute } from "astro";
import { z } from "zod";
import { backTo, firstIssue, isResponse, messageOf, requireSession } from "@/lib/api";
import { createAsset } from "@/lib/services/patchqueue";

export const prerender = false;

const assetSchema = z.object({
  name: z.string().trim().min(1, "Nazwa zasobu jest wymagana").max(200),
  component: z.string().trim().min(1, "Komponent jest wymagany").max(200),
  version: z.string().trim().min(1, "Wersja jest wymagana").max(100),
  exposure: z.enum(["public", "internal", "isolated"], { message: "Wybierz poziom ekspozycji" }),
  criticality: z.enum(["high", "medium", "low"], { message: "Wybierz krytyczność" }),
});

export const POST: APIRoute = async (context) => {
  const session = requireSession(context);
  if (isResponse(session)) return session;

  const form = await context.request.formData();
  const parsed = assetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return backTo(context, "/assets", firstIssue(parsed.error.issues));
  }

  try {
    const asset = await createAsset(session.db, session.userId, parsed.data);
    return backTo(context, `/assets/${asset.id}`);
  } catch (error) {
    return backTo(context, "/assets", messageOf(error));
  }
};
