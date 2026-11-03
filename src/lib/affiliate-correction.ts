export type AffiliateCorrectionInput = {
  fullName: string;
  policyNumber: string;
  plan: string;
  ticketValue: unknown;
  tickets: unknown;
  reason: string;
  duplicatePolicyPlan: boolean;
};

export const validateAffiliateCorrection = (input: AffiliateCorrectionInput) => {
  if (!input.fullName.trim() || !input.policyNumber.trim() || !input.plan.trim()) return "Completá nombre, póliza y plan.";
  if (input.duplicatePolicyPlan) return "Ya existe otro afiliado con la misma póliza y plan.";
  const tickets = Number(input.tickets);
  if (!Number.isInteger(tickets) || tickets < 0) return "La cantidad de tickets debe ser un número entero mayor o igual a cero.";
  const ticketValue = Number(input.ticketValue);
  if (!Number.isFinite(ticketValue) || ticketValue < 0) return "El importe por ticket debe ser un monto válido mayor o igual a cero.";
  if (!input.reason.trim()) return "Indicá el motivo de la corrección.";
  return "";
};

export const canCorrectAffiliate = (isAdmin: boolean) => isAdmin;

export type CorrectionActivity = {
  chargedTickets: number;
  receipts: number;
  cashMovements: number;
  closures: number;
  otherPeriods: number;
};

export const correctionBlockReason = (activity: CorrectionActivity) => {
  const reasons = [
    activity.chargedTickets > 0 ? "tickets cobrados" : "",
    activity.receipts > 0 ? "recibos emitidos" : "",
    activity.cashMovements > 0 ? "movimientos de caja o rendición" : "",
    activity.closures > 0 ? "cierres de turno" : "",
    activity.otherPeriods > 0 ? "cargas de otros períodos que se conservarán como histórico" : "",
  ].filter(Boolean);
  return reasons.length ? `No se puede corregir esta carga porque tiene ${reasons.join(", ")}.` : "";
};
