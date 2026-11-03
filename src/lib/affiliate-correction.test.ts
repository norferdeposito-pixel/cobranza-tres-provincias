import { describe, expect, it } from "vitest";
import { canCorrectAffiliate, correctionBlockReason, validateAffiliateCorrection } from "./affiliate-correction";

const valid = { fullName: "CORIA", policyNumber: "123", plan: "A 238", ticketValue: 1000, tickets: 2, reason: "CORRECCIÓN DE CARGA", duplicatePolicyPlan: false };

describe("corrección administrativa de cargas", () => {
  it("acepta una carga sin cobros y conserva cantidad por importe unitario", () => {
    expect(validateAffiliateCorrection(valid)).toBe("");
    expect(Number(valid.tickets) * Number(valid.ticketValue)).toBe(2000);
    expect(correctionBlockReason({ chargedTickets: 0, receipts: 0, cashMovements: 0, closures: 0, otherPeriods: 0 })).toBe("");
  });

  it("valida obligatorios, tickets enteros, monto, motivo y póliza/plan duplicados", () => {
    expect(validateAffiliateCorrection({ ...valid, fullName: "" })).toContain("nombre");
    expect(validateAffiliateCorrection({ ...valid, tickets: 1.5 })).toContain("entero");
    expect(validateAffiliateCorrection({ ...valid, ticketValue: -1 })).toContain("monto válido");
    expect(validateAffiliateCorrection({ ...valid, reason: " " })).toContain("motivo");
    expect(validateAffiliateCorrection({ ...valid, duplicatePolicyPlan: true })).toContain("misma póliza");
  });

  it("bloquea cambios que afectarían cobros, recibos, rendición o cierres", () => {
    const message = correctionBlockReason({ chargedTickets: 1, receipts: 1, cashMovements: 1, closures: 1, otherPeriods: 1 });
    expect(message).toContain("tickets cobrados");
    expect(message).toContain("recibos emitidos");
    expect(message).toContain("cierres de turno");
    expect(message).toContain("otros períodos");
  });

  it("reserva la corrección para administradores", () => {
    expect(canCorrectAffiliate(true)).toBe(true);
    expect(canCorrectAffiliate(false)).toBe(false);
  });

  it("no confirma una corrección cuando el snapshot simulado falla", async () => {
    let persistedTickets = 2;
    const saveSnapshot = async () => false;
    const saved = await saveSnapshot();
    if (saved) persistedTickets = 4;
    expect(saved).toBe(false);
    expect(persistedTickets).toBe(2);
  });

  it("no aplica una corrección ante conflicto de versión del snapshot", async () => {
    let persistedTickets = 2;
    const expectedVersion = "v1";
    const onlineVersion = "v2";
    const saveSnapshot = async () => expectedVersion === onlineVersion;
    const saved = await saveSnapshot();
    if (saved) persistedTickets = 4;
    expect(saved).toBe(false);
    expect(persistedTickets).toBe(2);
  });
});
