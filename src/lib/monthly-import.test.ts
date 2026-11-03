import { describe, expect, it } from "vitest";
import { mergeMonthlyImport } from "./monthly-import";
import { resolvePeriodTicketValue } from "./period-ticket-value";

const affiliate = (value: number, sourceTickets = 1) => ({
  id: "a-1", fullName: "AFILIADO", policyNumber: "123", plan: "A 238", value, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true, sourceTickets,
});

describe("importación mensual con importes históricos", () => {
  it("preserva el importe de períodos antiguos sin ticketValue al importar un mes nuevo", () => {
    const result = mergeMonthlyImport({
      prepared: [affiliate(150, 2)],
      affiliates: [affiliate(100, 1)],
      monthlyItems: [{ month: "2026-09", affiliateId: "a-1", tickets: 3 }],
      activeMonth: "2026-10",
    });
    const updated = result.nextAffiliates.find((item) => item.id === "a-1")!;
    expect(updated.value).toBe(150);
    expect(resolvePeriodTicketValue(result.nextMonthlyItems, "a-1", "2026-09", updated.value)).toBe(100);
    expect(resolvePeriodTicketValue(result.nextMonthlyItems, "a-1", "2026-10", updated.value)).toBe(150);
  });
});
