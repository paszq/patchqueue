import React, { useState } from "react";
import { Mail, Lock, UserPlus } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { PasswordToggle } from "@/components/auth/PasswordToggle";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";

const MIN_PASSWORD_LENGTH = 6;

interface Props {
  serverError?: string | null;
}

/** FormData.get zwraca tez pliki — do walidacji interesuje nas wylacznie tekst. */
function textField(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

export default function SignUpForm({ serverError }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});

  /**
   * Walidacja czyta wartosci z samego formularza, a nie ze stanu komponentu — patrz
   * komentarz w SignInForm. Autouzupelnianie i wpisywanie przed uaktywnieniem wyspy
   * omijaja stan Reacta, a formularz i tak musi dzialac.
   */
  function validate(form: HTMLFormElement) {
    const data = new FormData(form);
    const emailValue = textField(data.get("email")).trim();
    const passwordValue = textField(data.get("password"));
    const confirmValue = textField(data.get("confirmPassword"));

    const next: typeof errors = {};

    if (!emailValue) {
      next.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      next.email = "Enter a valid email address";
    }

    if (!passwordValue) {
      next.password = "Password is required";
    } else if (passwordValue.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    }

    if (!confirmValue) {
      next.confirmPassword = "Please confirm your password";
    } else if (passwordValue !== confirmValue) {
      next.confirmPassword = "Passwords do not match";
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

  const passwordHint =
    !errors.password && password.length > 0 && password.length < MIN_PASSWORD_LENGTH ? (
      <p className="mt-1 text-xs text-blue-100/50">
        {MIN_PASSWORD_LENGTH - password.length} more character
        {MIN_PASSWORD_LENGTH - password.length !== 1 ? "s" : ""} needed
      </p>
    ) : undefined;

  return (
    <form method="POST" action="/api/auth/signup" className="space-y-4" onSubmit={handleSubmit} noValidate>
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
        placeholder="Min. 6 characters"
        error={errors.password}
        hint={passwordHint}
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

      <FormField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm password"
        type={showConfirmPassword ? "text" : "password"}
        value={confirmPassword}
        onChange={(v) => {
          setConfirmPassword(v);
          clearError("confirmPassword");
        }}
        placeholder="Re-enter your password"
        error={errors.confirmPassword}
        icon={<Lock className="size-4" />}
        endContent={
          <PasswordToggle
            visible={showConfirmPassword}
            onToggle={() => {
              setShowConfirmPassword(!showConfirmPassword);
            }}
          />
        }
      />

      <ServerError message={serverError} />

      <SubmitButton pendingText="Creating account..." icon={<UserPlus className="size-4" />}>
        Create account
      </SubmitButton>
    </form>
  );
}
