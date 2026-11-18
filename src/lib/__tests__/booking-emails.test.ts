import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { bookingCancelledEmails, bookingConfirmedEmails, type EmailBooking } from "@/lib/booking-emails";

const b: EmailBooking = {
  id: "ckbookingabc12345",
  checkIn: new Date("2027-06-10T00:00:00Z"),
  checkOut: new Date("2027-06-13T00:00:00Z"),
  guests: 2,
  nights: 3,
  subtotalCents: 37_500,
  cleaningFeeCents: 6_000,
  taxCents: 5_220,
  processingCents: 1_536,
  platformFeeCents: 0,
  donationCents: 500,
  totalCents: 50_756,
  hostPayoutCents: 48_720,
  refundCents: 0,
  currency: "usd",
  cancelledBy: null,
  listing: { id: "l1", title: "Cabin <by> the lake", city: "Asheville", region: "NC", country: "USA", host: { name: "Hana Host", email: "host@x.test" } },
  guest: { name: "Gus Guest", email: "guest@x.test" },
};

describe("bookingConfirmedEmails", () => {
  const [guest, host] = bookingConfirmedEmails(b, "https://fairbnb.test");
  it("guest email: dates, city, host, itemized total with a $0 Fairbnb fee, trip link", () => {
    expect(guest.to).toBe("guest@x.test");
    expect(guest.text).toContain("Asheville, NC, USA");
    expect(guest.text).toContain("Host: Hana Host");
    expect(guest.text).toContain("Thu, Jun 10, 2027 – Sun, Jun 13, 2027");
    expect(guest.text).toContain("Fairbnb fee: $0");
    expect(guest.text).toContain("Total: $507.56");
    expect(guest.text).toContain("https://fairbnb.test/trips/ckbookingabc12345");
    expect(guest.html).toContain("Cabin &lt;by&gt; the lake"); // escaped
  });
  it("host email: payout amount", () => {
    expect(host.to).toBe("host@x.test");
    expect(host.text).toContain("Your payout: $487.20");
  });
});

describe("bookingCancelledEmails", () => {
  it("states the refund amount to both parties", () => {
    const [guest, host] = bookingCancelledEmails({ ...b, refundCents: 49_220, cancelledBy: "guest" }, "https://fairbnb.test");
    expect(guest.text).toContain("$492.20 has been refunded to your card");
    expect(host.text).toContain("$492.20 was refunded to the guest");
    expect(host.text).toContain("$15.36 of the payment was non-refundable");
  });
  it("unpaid cancellation says nothing was charged", () => {
    const [guest] = bookingCancelledEmails({ ...b, refundCents: 0, cancelledBy: "system" });
    expect(guest.text).toContain("nothing to refund");
  });
});
