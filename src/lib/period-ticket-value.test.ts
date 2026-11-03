import { describe, expect, it } from "vitest";
import { periodTicketTotal, resolvePeriodTicketValue } from "./period-ticket-value";

describe("importe de ticket por período", () => {
  it("corrige un período sin cambiar los demás", () => {
    const items = [
      { month: "2026-09", affiliateId: "a-1", ticketValue: 100 },
      { month: "2026-10", affiliateId: "a-1", ticketValue: 150 },
    ];
    expect(resolvePeriodTicketValue(items, "a-1", "2026-09", 80)).toBe(100);
    expect(resolvePeriodTicketValue(items, "a-1", "2026-10", 80)).toBe(150);
  });

  it("mantiene compatibilidad con ítems antiguos sin ticketValue", () => {
    expect(resolvePeriodTicketValue([{ month: "2026-09", affiliateId: "a-1" }], "a-1", "2026-09", 80)).toBe(80);
  });

  it("mantiene coherencia entre cantidad, importe unitario y total", () => {
    expect(periodTicketTotal(3, 125.5)).toBe(376.5);
  });
});
