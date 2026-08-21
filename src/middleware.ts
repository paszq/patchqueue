import { defineMiddleware } from "astro:middleware";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = [
  "/dashboard",
  "/queue",
  "/assets",
  "/items",
  "/import",
  "/api/assets",
  "/api/vulnerabilities",
  "/api/decisions",
  "/api/import",
];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  if (supabase) {
    const { data, error } = await supabase.auth.getUser();

    // Ciasteczko sesji, ktorego serwer nie potrafi odczytac — nadgryzione, wygasle albo
    // pozostale po innym projekcie — zostawialoby uzytkownika w petli: strona chroniona
    // odsyla na logowanie, logowanie ustawia nowe ciasteczko obok starego, a odczyt
    // sesji nadal sie nie udaje. Zepsuta sesja jest wiec usuwana od razu.
    //
    // Czyszczenie obejmuje wylacznie zwykle wejscia na strony. Przy wywolaniach do
    // punktow koncowych sesja moze byc wlasnie odswiezana i skasowanie ciasteczka
    // wylogowaloby uzytkownika w polowie operacji.
    if (error && context.request.method === "GET") {
      for (const part of (context.request.headers.get("Cookie") ?? "").split(";")) {
        const name = part.split("=")[0]?.trim() ?? "";
        if (name.startsWith("sb-")) {
          context.cookies.delete(name, { path: "/" });
        }
      }
    }

    context.locals.user = error ? null : data.user;
  } else {
    context.locals.user = null;
  }

  if (PROTECTED_ROUTES.some((route) => context.url.pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  return next();
});
