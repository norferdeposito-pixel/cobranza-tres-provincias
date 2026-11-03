export type ImportAffiliate = {
  id: string;
  fullName: string;
  policyNumber: string;
  plan: string;
  value: number;
  phone: string;
  address: string;
  dependency: string;
  collector: string;
  request: string;
  latestNews: string;
  selectedForMonthly: boolean;
  sourceTickets?: number;
};

export type ImportMonthlyItem = { month: string; affiliateId: string; tickets: number; ticketValue?: number };

export const mergeMonthlyImport = ({ prepared, affiliates, monthlyItems, activeMonth }: {
  prepared: ImportAffiliate[];
  affiliates: ImportAffiliate[];
  monthlyItems: ImportMonthlyItem[];
  activeMonth: string;
}) => {
  const currentById = new Map(affiliates.map((item) => [item.id, item]));
  const merged = prepared.map((item) => {
    const previous = currentById.get(item.id);
    return previous
      ? { ...item, phone: previous.phone, address: previous.address, dependency: item.dependency || previous.dependency, collector: previous.collector || item.collector || "OFICINA", request: previous.request || item.request || "", latestNews: previous.latestNews || item.latestNews || "", selectedForMonthly: true }
      : { ...item, selectedForMonthly: true };
  });
  const importedIds = new Set(merged.map((item) => item.id));
  const retained = affiliates.filter((item) => !importedIds.has(item.id)).map((item) => ({ ...item, selectedForMonthly: false }));
  const nextAffiliates = [...merged, ...retained];

  // Legacy snapshots stored the unit value only on Affiliate. Freeze that
  // previous value into every earlier monthly item before an import updates it.
  const historicItems = monthlyItems
    .filter((item) => item.month !== activeMonth)
    .map((item) => item.ticketValue === undefined
      ? { ...item, ticketValue: currentById.get(item.affiliateId)?.value ?? 0 }
      : item);
  const activeItems = merged.map((item) => ({
    month: activeMonth,
    affiliateId: item.id,
    tickets: Math.max(0, item.sourceTickets || 0),
    ticketValue: item.value,
  }));

  return { merged, retained, nextAffiliates, nextMonthlyItems: [...historicItems, ...activeItems] };
};
