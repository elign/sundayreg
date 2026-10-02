"use client";

import { useActionState, useEffect, useState } from "react";
import { registerVisitor } from "@/app/actions/register";
import { initialRegisterState } from "@/lib/register-state";
import { GENDERS } from "@/lib/types";
import { siteConfig } from "@/lib/config";
import { PassCard } from "./pass-card";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
      {message}
    </p>
  );
}

const inputClass =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-base text-ink-900 shadow-sm outline-none transition focus:border-saffron-500 focus:ring-2 focus:ring-saffron-200";

export function RegistrationForm() {
  const [resetKey, setResetKey] = useState(0);

  // `useActionState` has no reset, and the form is unmounted while the pass is
  // showing, so the only way back to an empty form is to remount it.
  return (
    <RegistrationFormFields
      key={resetKey}
      onRegisterAnother={() => setResetKey((k) => k + 1)}
    />
  );
}

function RegistrationFormFields({
  onRegisterAnother,
}: {
  onRegisterAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    registerVisitor,
    initialRegisterState,
  );

  const done = state.status === "success";

  useEffect(() => {
    if (state.status === "error") {
      document.getElementById("register-error")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [state]);

  if (done) {
    return (
      <div className="space-y-4">
        <PassCard
          name={state.name}
          passId={state.passId}
          qrSvg={state.qrSvg}
          phoneMasked={state.phoneMasked}
          issuedDate={state.programDate}
          variant={state.created ? "new" : "welcome"}
          totalVisits={state.totalVisits}
          mismatch={state.mismatch}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <a
              href={state.passUrl}
              className="rounded-lg bg-saffron-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-saffron-700"
            >
              Open printable pass
            </a>
            <button
              type="button"
              onClick={onRegisterAnother}
              className="rounded-lg border border-cream-300 bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-cream-50"
            >
              Register someone else
            </button>
          </div>
        </PassCard>

        {state.created ? (
          <p className="text-center text-sm text-ink-700">
            Your details are saved. Welcome to the {siteConfig.centreName}{" "}
            Sunday program.
          </p>
        ) : (
          <p className="text-center text-sm text-ink-700">
            We found your existing pass and marked your attendance for today.
          </p>
        )}
      </div>
    );
  }

  const errors = state.status === "error" ? state.errors : undefined;

  return (
    <form
      action={formAction}
      noValidate
      className="rounded-2xl border border-cream-300 bg-white p-6 shadow-sm sm:p-8"
    >
      <h2 className="text-xl font-bold text-ink-900">Your details</h2>
      <p className="mt-1 text-sm text-ink-700">
        We only ask for what we need to issue your pass.
      </p>

      {state.status === "error" && (
        <p
          id="register-error"
          role="alert"
          aria-live="polite"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
        >
          {state.message}
        </p>
      )}

      <div className="mt-6 space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-semibold text-ink-900">
            Full name <span className="text-red-600">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={80}
            aria-invalid={errors?.name ? true : undefined}
            aria-describedby={errors?.name ? "name-error" : undefined}
            className={`mt-1.5 ${inputClass} ${errors?.name ? "border-red-400" : ""}`}
          />
          <FieldError id="name-error" message={errors?.name} />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-semibold text-ink-900">
            Contact number <span className="text-red-600">*</span>
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="98765 43210"
            aria-invalid={errors?.phone ? true : undefined}
            aria-describedby={`${errors?.phone ? "phone-error" : "phone-hint"}`}
            className={`mt-1.5 ${inputClass} ${errors?.phone ? "border-red-400" : ""}`}
          />
          {errors?.phone ? (
            <FieldError id="phone-error" message={errors.phone} />
          ) : (
            <p id="phone-hint" className="mt-1.5 text-sm text-ink-500">
              We use this to find your pass next Sunday.
            </p>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-ink-900">
            Gender <span className="text-red-600">*</span>
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GENDERS.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-cream-300 bg-white px-3 py-2.5 text-sm font-medium text-ink-700 transition has-checked:border-saffron-500 has-checked:bg-saffron-50"
              >
                <input
                  type="radio"
                  name="gender"
                  value={option.value}
                  required
                  className="size-4 accent-saffron-600"
                />
                {option.label}
              </label>
            ))}
          </div>
          <FieldError id="gender-error" message={errors?.gender} />
        </fieldset>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream-300 bg-cream-50 px-4 py-3 text-sm text-ink-700">
          <input type="checkbox" name="firstTime" className="mt-0.5 size-4 accent-saffron-600" />
          <span>
            This is my <strong className="font-semibold">first</strong> time at
            the Sunday program. Leave unticked if you have attended before.
          </span>
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-7 w-full rounded-lg bg-saffron-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-saffron-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Saving your details…" : "Get my Sunday pass"}
      </button>

      <p className="mt-4 text-center text-xs text-ink-500">
        Your details are stored securely and are never shown publicly.
      </p>
    </form>
  );
}
