export type CollectorRecord = {
  name: string;
  phone: string;
  commissionBase: number;
  bonusEnabled: boolean;
  bonusThreshold: number;
  bonusRate: number;
};

export const normalizeCollectorEntry = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR");

type CreateCollectorInput = {
  isAdmin: boolean;
  name: string;
  collectorRecords: CollectorRecord[];
  existingCollectorNames: string[];
  createRecord: (name: string) => CollectorRecord;
};

type CreateCollectorResult =
  | { ok: true; name: string; collectorRecords: CollectorRecord[] }
  | { ok: false; reason: "forbidden" | "empty" | "duplicate" };

export const createCollector = ({ isAdmin, name, collectorRecords, existingCollectorNames, createRecord }: CreateCollectorInput): CreateCollectorResult => {
  if (!isAdmin) return { ok: false, reason: "forbidden" };
  const normalizedName = normalizeCollectorEntry(name);
  if (!normalizedName) return { ok: false, reason: "empty" };
  if (existingCollectorNames.some((collector) => normalizeCollectorEntry(collector) === normalizedName)) {
    return { ok: false, reason: "duplicate" };
  }
  return { ok: true, name: normalizedName, collectorRecords: [...collectorRecords, createRecord(normalizedName)] };
};

export const collectorOptions = (collectorRecords: CollectorRecord[], affiliateCollectorNames: string[]) => Array.from(new Set([
  ...collectorRecords.map((record) => normalizeCollectorEntry(record.name)),
  ...affiliateCollectorNames.map(normalizeCollectorEntry),
].filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
