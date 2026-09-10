import { describe, expect, it } from "vitest";
import { renderBookingConfirmation, type BookingConfirmationVars } from "@/lib/notifications/templates";

/**
 * THE CONFIRMATION EMAIL.
 *
 * This is the only thing a customer receives, and for a site with no accounts
 * it carries the one piece of information they cannot recover on their own:
 * the booking reference. So the reference, the promise that someone will be in
 * touch, and the money figures are all pinned here rather than left to whoever
 * next edits the copy.
 */

const VARS: BookingConfirmationVars = {
  reference: "RNT-4K7QM2",
  customerName: "Saleh Al-Harbi",
  className: "20 t Excavator",
  startDate: new Date("2026-11-02T00:00:00Z"),
  endDate: new Date("2026-11-09T00:00:00Z"),
  siteCity: "Dammam",
  chargedHalalas: 338675n,
  depositHalalas: 120000n,
  currency: "SAR",
  bookingUrl: "https://example.com/en/booking/RNT-4K7QM2",
  companyName: "Heavy Duty Rentals",
  companyPhone: "+966 11 000 0000",
};

describe("booking confirmation, English", () => {
  const mail = renderBookingConfirmation("en", VARS);

  it("puts the reference in the subject, where it survives a crowded inbox", () => {
    expect(mail.subject).toContain("RNT-4K7QM2");
  });

  it("confirms the booking and promises contact, which is what was asked for", () => {
    expect(mail.text).toMatch(/confirmed/i);
    expect(mail.text).toMatch(/contact you shortly/i);
  });

  it("repeats the reference in the body and says why it matters", () => {
    expect(mail.text).toContain("RNT-4K7QM2");
    // No accounts exist, so a lost reference is a phone call.
    expect(mail.text).toMatch(/do not have an account/i);
  });

  it("separates what was charged from the deposit that was not", () => {
    expect(mail.text).toMatch(/Charged now/);
    expect(mail.text).toMatch(/not charged today/i);
    expect(mail.text).toContain("3,386.75");
    expect(mail.text).toContain("1,200.00");
  });

  it("carries a link back to the booking", () => {
    expect(mail.text).toContain(VARS.bookingUrl);
    expect(mail.html).toContain(VARS.bookingUrl);
  });

  it("always has a plain-text body, which is the one that always arrives", () => {
    expect(mail.text.length).toBeGreaterThan(120);
  });
});

describe("booking confirmation, Arabic", () => {
  const mail = renderBookingConfirmation("ar", VARS);

  it("is genuinely translated, not English with Arabic furniture", () => {
    expect(mail.subject).toMatch(/تم تأكيد الحجز/);
    expect(mail.text).toMatch(/سيتواصل معك/);
  });

  it("keeps the reference in Latin characters so it can be typed back in", () => {
    expect(mail.text).toContain("RNT-4K7QM2");
  });

  it("sets right-to-left direction on the HTML part", () => {
    expect(mail.html).toContain('dir="rtl"');
  });
});

describe("safety of interpolated values", () => {
  it("escapes HTML in customer-supplied fields", () => {
    // A name is whatever the customer typed at checkout. It reaches an inbox,
    // so it must not be able to carry markup into the message body.
    const mail = renderBookingConfirmation("en", {
      ...VARS,
      customerName: '<img src=x onerror="alert(1)">',
      siteCity: "</td><script>alert(2)</script>",
    });
    expect(mail.html).not.toContain("<img src=x");
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;img");
  });

  it("omits the deposit row entirely when there is no deposit", () => {
    const mail = renderBookingConfirmation("en", { ...VARS, depositHalalas: 0n });
    expect(mail.text).not.toMatch(/Refundable deposit/);
  });

  it("omits the site row when no city was given", () => {
    const mail = renderBookingConfirmation("en", { ...VARS, siteCity: null });
    expect(mail.text).not.toMatch(/Delivery site/);
  });
});
