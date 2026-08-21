/**
 * Wspólna obsługa punktów końcowych sterowanych zwykłymi formularzami HTML.
 *
 * Formularze bez JavaScriptu potrafią wyłącznie GET i POST, więc rodzaj operacji
 * przyjeżdża w polu `_action`. W zamian cała aplikacja działa bez skryptów po stronie
 * przeglądarki, co realizuje NFR-03 (przejście ścieżki wyłącznie klawiaturą) bez
 * dokładania obsługi skrótów.
 */
import type { APIContext } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

export interface Session {
  db: SupabaseClient;
  userId: string;
}

/** Zwraca sesję albo odpowiedź przekierowującą do logowania. */
export function requireSession(context: APIContext): Session | Response {
  const user = context.locals.user;
  const db = createClient(context.request.headers, context.cookies);
  if (!user || !db) {
    return context.redirect("/auth/signin");
  }
  return { db, userId: user.id };
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

export function backTo(context: APIContext, path: string, error?: string): Response {
  const target =
    error === undefined ? path : `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(error)}`;
  return context.redirect(target, 303);
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Nieznany błąd";
}

/** Pierwszy komunikat walidacji, w formie nadającej się do pokazania użytkownikowi. */
export function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Nieprawidłowe dane";
}
