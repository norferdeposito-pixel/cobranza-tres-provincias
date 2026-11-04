import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TicketCollectionsDetail } from "./InsuranceCollections";
import { resolvePeriodTicketValue } from "@/lib/period-ticket-value";

describe("detalle de tickets cobrados", () => {
  it("renderiza un ticket de un snapshot antiguo sin ticketValue", () => {
    const affiliate = {
      id: "affiliate-1",
      fullName: "Afiliado histórico",
      policyNumber: "123",
      plan: "Plan A",
      value: 125,
      phone: "",
      address: "",
      dependency: "",
      collector: "",
      request: "",
      latestNews: "",
      selectedForMonthly: false,
    };
    const collection = {
      id: "ticket-1",
      month: "2026-10",
      affiliateId: affiliate.id,
      ticketsCharged: 2,
      paymentMethod: "E" as const,
    };

    render(
      <TicketCollectionsDetail
        collections={[collection]}
        affiliatesById={new Map([[affiliate.id, affiliate]])}
        ticketCollectionValue={(item) => resolvePeriodTicketValue(
          [{ month: item.month, affiliateId: item.affiliateId }],
          item.affiliateId,
          item.month,
          affiliate.value,
        )}
      />,
    );

    expect(screen.getByText(/2 ticket\(s\).*\$\s?250/i)).toBeInTheDocument();
  });
});
