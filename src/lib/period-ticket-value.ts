export type PeriodTicketItem = { month: string; affiliateId: string; ticketValue?: number };

export const resolvePeriodTicketValue = (items: PeriodTicketItem[], affiliateId: string, month: string, fallbackValue: number) => {
  const item = items.find((candidate) => candidate.month === month && candidate.affiliateId === affiliateId);
  return item?.ticketValue ?? fallbackValue;
};

export const periodTicketTotal = (tickets: number, ticketValue: number) => tickets * ticketValue;
