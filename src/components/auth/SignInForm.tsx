import React, { useState } from "react";
import { Mail, Lock, LogIn } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

interface Props {
  serverError?: string | null;
}

/** FormData.get zwraca tez pliki — do walidacji interesuje nas wylacznie tekst. */
function textField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export default function SignInForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  /**
   * Walidacja czyta wartosci z samego formularza, a nie ze stanu komponentu.
   *
   * Menedzer hasel i autouzupelnianie przegladarki wpisuja wartosci prosto do DOM,
   * nie wywolujac zdarzen, na ktorych opiera sie stan Reacta. Sprawdzanie stanu
   * uznawalo wtedy wypelnione pola za puste i blokowalo wysylke - uzytkownik widzial
   * wpisane dane i niedzialajacy przycisk. To samo dotyczy wpisywania, zanim wyspa
   * zdazy sie uaktywnic.
   */
  function validate(form: HTMLFormElement) {
    const data = new FormData(form);
    const emailValue = textField(data.get("email")).trim();
    const passwordValue = textField(data.get("password"));

    const next: typeof errors = {};
    if (!emailValue) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      next.email = "Enter a valid email address";
    }
    if (!passwordValue) {
      next.password = "Password is required";
    }
    const valid = Object.keys(next).length === 0;
    setErrors(valid ? {} : next);
    return valid;
  }

  function clearError(field: keyof typeof errors) {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  /**
   * Wysylka jest wstrzymywana zawsze, a formularz wysylany recznie po sprawdzeniu.
   *
   * Powod: przy polach kontrolowanych React po kazdym renderze przywraca wartosci ze
   * stanu. Wywolanie setErrors tuz przed natywna wysylka kasowalo wiec wartosci
   * wpisane przez menedzer hasel albo autouzupelnianie - do serwera szly puste pola.
   * form.submit() startuje nawigacje z tym, co faktycznie jest w polach, i pomija
   * ponowne wywolanie tej funkcji.
   */
  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (validate(form)) {
      form.submit();
    }
  }

  return (
    <form method="POST" action="/api/auth/signin" className="space-y-4" onSubmit={handleSubmit} noValidate>
      <FormField
        id="email"
        type="email"
        label="Email"
        value={email}
        onChange={(v) => {
          setEmail(v);
          clearError("email");
        }}
        placeholder="you@example.com"
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <FormField
        id="password"
        label="Password"
        type={showPassword ? "text" : "password"}
        value={password}
        onChange={(v) => {
          setPassword(v);
          clearError("password");
        }}
        placeholder="Your password"
        error={errors.password}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showPassword}
            onToggle={() => {
              setShowPassword(!showPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Signing in..." icon={<LogIn className="size-4" />}>
        Sign in
      </SubmitButton>
    </form>
  );
}
