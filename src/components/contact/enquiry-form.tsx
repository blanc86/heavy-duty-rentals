"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MailIcon, WhatsAppIcon, buttonClass, cn } from "@/components/ui";
import { mailtoHref, whatsappHref } from "@/lib/contact";
import type { Dictionary } from "@/lib/i18n";

export interface EquipmentOption {
  value: string;
  label: string;
  group: string;
}

/**
 * Quote request form, with no server behind it.
 *
 * The site has no backend to receive a submission, and no email transport to
 * forward one — so instead of a form that pretends to send, this one composes
 * the request and hands it to the visitor's own WhatsApp or email app, filled
 * in and ready. The visitor sees exactly what is being sent and presses send
 * themselves, and the note under the buttons says so. Nothing is stored here.
 *
 * That is also the better conversion path for this market: WhatsApp is where
 * Saudi buyers already talk to suppliers, and a message there reaches a person,
 * where a form submission reaches an inbox.
 *
 * Only name and phone are required. Every other field is optional because each
 * required field is a reason to leave, and whatever is missing can be asked in
 * the chat.
 *
 * A machine page links here with ?equipment=<slug>, which preselects it.
 */
export function EnquiryForm({
  dict,
  equipmentOptions,
}: {
  dict: Dictionary;
  equipmentOptions: EquipmentOption[];
}) {
  const f = dict.contact.fields;
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  // Bumped on every failed attempt, so the summary takes focus again even when
  // the errors are unchanged from the last try.
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [equipment, setEquipment] = useState("");

  // Move focus to the error summary once it has rendered, so a screen reader
  // announces what went wrong and a keyboard user starts from the problem.
  // An effect runs after React commits, which a timer or animation frame does
  // not guarantee.
  useEffect(() => {
    if (failedAttempts > 0) summaryRef.current?.focus();
  }, [failedAttempts]);

  // Read the preselection after hydration: reading search params during render
  // would opt this static page out of static generation.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("equipment");
    if (slug && equipmentOptions.some((option) => option.value === slug)) setEquipment(slug);
  }, [equipmentOptions]);

  function compose(): string | null {
    const form = formRef.current;
    if (!form) return null;
    const data = new FormData(form);
    const value = (key: string) => String(data.get(key) ?? "").trim();

    const next: typeof errors = {};
    if (value("name").length < 2) next.name = dict.contact.errorName;
    // Loose on purpose: people type local, international and spaced formats.
    if (value("phone").replace(/\D/g, "").length < 7) next.phone = dict.contact.errorPhone;
    setErrors(next);
    if (Object.keys(next).length > 0) {
      setFailedAttempts((n) => n + 1);
      return null;
    }

    const chosen = equipmentOptions.find((option) => option.value === value("equipment"));
    const operatorLabels: Record<string, string> = {
      yes: f.operatorYes,
      no: f.operatorNo,
      unsure: f.operatorUnsure,
    };
    const lines: [string, string][] = [
      [f.name, value("name")],
      [f.phone, value("phone")],
      [f.company, value("company")],
      [f.equipment, chosen ? chosen.label : value("equipment") === "unsure" ? f.equipmentNotSure : ""],
      [f.location, value("location")],
      [f.startDate, value("startDate")],
      [f.duration, value("duration")],
      [f.operator, operatorLabels[value("operator")] ?? ""],
      [f.message, value("message")],
    ];
    return [dict.contact.messageIntro, "", ...lines.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].join("\n");
  }

  function send(channel: "whatsapp" | "email") {
    const message = compose();
    if (!message) return;
    if (channel === "whatsapp") {
      window.open(whatsappHref(message), "_blank", "noopener,noreferrer");
    } else {
      window.location.href = mailtoHref({ subject: dict.messages.emailSubject, body: message });
    }
  }

  const fieldClass =
    "mt-1.5 block min-h-12 w-full rounded-control border border-steel-300 bg-white px-3.5 py-2.5 text-[1rem] text-steel-900 placeholder:text-steel-500 focus:border-steel-900 focus:outline-none focus-visible:outline-3 focus-visible:outline-machine-500";
  const labelClass = "block font-semibold text-steel-900";
  const hasErrors = Boolean(errors.name || errors.phone);

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        send("whatsapp");
      }}
      className="grid gap-5"
    >
      {hasErrors && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control border-s-4 border-red-700 bg-red-50 px-4 py-3 font-semibold text-red-800"
        >
          {dict.contact.errorSummary}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className={labelClass}>
            {f.name}
          </label>
          <input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            required
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id}-name-error` : undefined}
            className={cn(fieldClass, errors.name && "border-red-700")}
          />
          {errors.name && (
            <p id={`${id}-name-error`} className="mt-1.5 text-sm font-semibold text-red-800">
              {errors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${id}-phone`} className={labelClass}>
            {f.phone}
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            required
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? `${id}-phone-error` : undefined}
            className={cn(fieldClass, "text-start rtl:text-end", errors.phone && "border-red-700")}
          />
          {errors.phone && (
            <p id={`${id}-phone-error`} className="mt-1.5 text-sm font-semibold text-red-800">
              {errors.phone}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-equipment`} className={labelClass}>
            {f.equipment} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
          </label>
          <select
            id={`${id}-equipment`}
            name="equipment"
            value={equipment}
            onChange={(event) => setEquipment(event.target.value)}
            className={fieldClass}
          >
            <option value="" />
            <option value="unsure">{f.equipmentNotSure}</option>
            {[...new Set(equipmentOptions.map((option) => option.group))].map((group) => (
              <optgroup key={group} label={group}>
                {equipmentOptions
                  .filter((option) => option.group === group)
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${id}-company`} className={labelClass}>
            {f.company} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
          </label>
          <input id={`${id}-company`} name="company" autoComplete="organization" className={fieldClass} />
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-location`} className={labelClass}>
          {f.location} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
        </label>
        <input
          id={`${id}-location`}
          name="location"
          aria-describedby={`${id}-location-hint`}
          className={fieldClass}
        />
        <p id={`${id}-location-hint`} className="mt-1.5 text-sm text-steel-600">
          {f.locationHint}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-start`} className={labelClass}>
            {f.startDate} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
          </label>
          <input id={`${id}-start`} name="startDate" type="date" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`${id}-duration`} className={labelClass}>
            {f.duration} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
          </label>
          <input
            id={`${id}-duration`}
            name="duration"
            aria-describedby={`${id}-duration-hint`}
            className={fieldClass}
          />
          <p id={`${id}-duration-hint`} className="mt-1.5 text-sm text-steel-600">
            {f.durationHint}
          </p>
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>
          {f.operator} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["yes", f.operatorYes],
              ["no", f.operatorNo],
              ["unsure", f.operatorUnsure],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-control border border-steel-300 px-4 has-[:checked]:border-steel-900 has-[:checked]:bg-steel-100"
            >
              <input type="radio" name="operator" value={value} className="h-4 w-4 accent-steel-900" />
              <span className="font-semibold">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-message`} className={labelClass}>
          {f.message} <span className="font-normal text-steel-600">({dict.contact.optional})</span>
        </label>
        <textarea
          id={`${id}-message`}
          name="message"
          rows={4}
          aria-describedby={`${id}-message-hint`}
          className={cn(fieldClass, "min-h-28")}
        />
        <p id={`${id}-message-hint`} className="mt-1.5 text-sm text-steel-600">
          {f.messageHint}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <button type="submit" className={buttonClass("whatsapp", "min-h-14 text-[1.05rem]")}>
          <WhatsAppIcon />
          {dict.contact.sendWhatsapp}
        </button>
        <button type="button" onClick={() => send("email")} className={buttonClass("outline", "min-h-14 text-[1.05rem]")}>
          <MailIcon />
          {dict.contact.sendEmail}
        </button>
      </div>
      <p className="text-sm text-steel-600">{dict.contact.formNote}</p>
    </form>
  );
}
