import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  Calculator,
  CheckSquare,
  ClipboardList,
  FileSpreadsheet,
  Smartphone,
  Users,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Upload,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";

type PlanType = string;
type PaymentMethod = "E" | "T" | "";
type Section = "Base" | "CobradorMovil" | "Cobradores" | "Caja" | "Mensual" | "Cobranza" | "Recibos" | "Pedidos" | "Novedades" | "Totales" | "Rendicion" | "Usuarios";

type TransferData = {
  transactionNumber: string;
  receiptNumber: string;
  date: string;
  holder: string;
  proof: string;
  notes: string;
};

type Affiliate = {
  id: string;
  fullName: string;
  policyNumber: string;
  plan: PlanType;
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

type MonthlyItem = {
  month: string;
  affiliateId: string;
  tickets: number;
};

type TicketCollection = {
  id: string;
  month: string;
  affiliateId: string;
  fullName?: string;
  policyNumber?: string;
  plan?: PlanType;
  dependency?: string;
  collector?: string;
  ticketValue?: number;
  ticketsCharged: number;
  paymentMethod: PaymentMethod;
  transfer?: TransferData;
};

type ReceiptCollection = {
  id: string;
  collectionMonth: string;
  receiptNumber: string;
  policyNumber?: string;
  fullName: string;
  collector?: string;
  plan: PlanType;
  paidMonth: string;
  paidMonths?: string[];
  monthCount: number;
  monthlyAmount: number;
  paymentMethod: PaymentMethod;
  transfer?: TransferData;
  status?: "activo" | "anulado";
  isProduction?: boolean;
  voidedAt?: string;
  voidReason?: string;
};

type AffiliateNote = {
  id: string;
  affiliateId: string;
  month: string;
  date: string;
  text: string;
};

type TicketReturnControl = {
  id: string;
  month: string;
  affiliateId: string;
  collector: string;
  hasPhysicalTickets: boolean;
  observation: string;
  updatedAt: string;
};

type Rendition = {
  cashRenders: Array<{ id: string; date: string; amount: number; detail: string }>;
  transferRenders: Array<{ id: string; date: string; amount: number; proof: string }>;
};

type CashMovement = {
  id: string;
  date: string;
  month: string;
  office: string;
  shift: string;
  user: string;
  type: "ingreso" | "egreso";
  source: "SERVICIOS" | "PRE NECESIDAD" | "TRES PROVINCIAS" | "OTROS";
  paymentMethod: "EFECTIVO" | "TARJETA" | "TRANSFERENCIA" | "OTRO";
  receiptType: string;
  receiptNumber: string;
  concept: string;
  amount: number;
  notes: string;
};

type CashOpeningBalance = {
  id: string;
  date: string;
  month: string;
  office: string;
  user: string;
  amount: number;
  notes: string;
};

type CashTurnNote = {
  id: string;
  date: string;
  month: string;
  office: string;
  shift: string;
  user: string;
  entryType?: "NOVEDAD" | "TAREA";
  text: string;
  completed?: boolean;
  completedAt?: string;
  createdAt: string;
};

type AffiliateForm = Omit<Affiliate, "id" | "selectedForMonthly">;

type AffiliateImportPreview = {
  source: string;
  rows: Affiliate[];
  newRows: Affiliate[];
  newPolicyRows: Affiliate[];
  existingCount: number;
  changedRows: Array<{ incoming: Affiliate; previous: Affiliate; fields: string[] }>;
  duplicatedCount: number;
};

type CollectorRecord = {
  name: string;
  phone: string;
  commissionBase: number;
  bonusEnabled: boolean;
  bonusThreshold: number;
  bonusRate: number;
};

type CloudSnapshot = {
  affiliates: Affiliate[];
  monthlyItems: MonthlyItem[];
  monthlyNewPolicyIds?: Record<string, string[]>;
  ticketCollections: TicketCollection[];
  ticketReturnControls?: TicketReturnControl[];
  receipts: ReceiptCollection[];
  notes: AffiliateNote[];
  rendition: Rendition;
  cashMovements: CashMovement[];
  cashOpeningBalances: CashOpeningBalance[];
  cashTurnNotes?: CashTurnNote[];
  collectorRecords: CollectorRecord[];
  customDependencies: string[];
  collectorWhatsapp: string;
  activeMonth: string;
};

type UserAdminProfile = {
  email: string;
  nombre: string;
  rol: string;
  collector_name?: string;
  permisos?: string[] | null;
  activo?: boolean;
};

const plans: PlanType[] = ["A 238", "A 269", "G 238", "09", "G 269", "C", "Vida"];
const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/17_pvb9vNQPJULu5XWJ3Yuy7HHbbT1GKfhgwe_4_--q0/edit?usp=sharing";
const affiliatesStorageKey = "insurance-affiliates-v2";
const monthlyStorageKey = "insurance-monthly-v2";
const monthlyNewPoliciesStorageKey = "insurance-monthly-new-policies-v1";
const ticketCollectionsStorageKey = "insurance-ticket-collections-v2";
const ticketReturnControlsStorageKey = "insurance-ticket-return-controls-v1";
const receiptsStorageKey = "insurance-receipts-v2";
const notesStorageKey = "insurance-affiliate-notes-v2";
const renditionStorageKey = "insurance-rendition-v2";
const cashMovementsStorageKey = "insurance-cash-movements-v1";
const cashOpeningBalancesStorageKey = "insurance-cash-opening-balances-v1";
const cashTurnNotesStorageKey = "insurance-cash-turn-notes-v1";
const collectorWhatsappStorageKey = "insurance-collector-whatsapp-v2";
const collectorsStorageKey = "insurance-collectors-v2";
const dependenciesStorageKey = "insurance-dependencies-v2";
const cloudSnapshotKey = "cobranza-tres-provincias";
const activeSessionsTable = "sesiones_activas";
const activeSessionTimeoutMinutes = 30;

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const addMonths = (month: string, amount: number) => {
  const [year, monthIndex] = month.split("-").map((value) => Number(value));
  const date = new Date(year, (monthIndex || 1) - 1 + amount, 1);
  return date.toISOString().slice(0, 7);
};
const monthLabel = (month: string) => {
  const [year, monthIndex] = month.split("-").map((value) => Number(value));
  if (!year || !monthIndex) return month || "-";
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, monthIndex - 1, 1)))
    .toLocaleUpperCase("es-AR");
};
function normalizeCollectorName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("es-AR") || "OFICINA";
}

const officeNames = ["SAN MARTIN", "TUNUYAN", "EUGENIO BUSTOS"];
const officeCollectorByOffice: Record<string, string> = {
  "SAN MARTIN": "SAN MARTIN OFICINA",
  TUNUYAN: "TUNUYAN OFICINA",
  "EUGENIO BUSTOS": "EUGENIO BUSTOS OFICINA",
};
const officePermissionPrefix = "oficina:";
const officePermission = (office: string) => `${officePermissionPrefix}${normalizeCollectorName(office)}`;
const officesFromPermissions = (permisos?: string[] | null) => {
  return uniqueSorted((permisos || [])
    .map((permission) => String(permission || ""))
    .filter((permission) => permission.toLocaleLowerCase("es-AR").startsWith(officePermissionPrefix))
    .map((permission) => normalizeCollectorName(permission.slice(officePermissionPrefix.length)))
    .filter((office) => officeNames.includes(office)));
};
const officeFromCollector = (collectorName: string) => {
  const normalized = normalizeCollectorName(collectorName);
  return officeNames.find((office) => normalizeCollectorName(officeCollectorByOffice[office]) === normalized || normalized.includes(office)) || "";
};
const collectorForOffice = (office: string) => officeCollectorByOffice[normalizeCollectorName(office)] || "";

const demoAffiliates: Affiliate[] = [
  { id: "31774-A238", fullName: "TAGUA DORALISA", policyNumber: "31774", plan: "A 238", value: 13000, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true, sourceTickets: 1 },
  { id: "37096-A238", fullName: "RIVAMAR GLADYS", policyNumber: "37096", plan: "A 238", value: 21700, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true, sourceTickets: 1 },
  { id: "45446-G238", fullName: "CARTECHINI JUAN", policyNumber: "45446", plan: "G 238", value: 19600, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: false, sourceTickets: 1 },
  { id: "159327-A269", fullName: "AGUIRRE OSCAR", policyNumber: "159327", plan: "A 269", value: 29600, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true, sourceTickets: 4 },
  { id: "199554-G269", fullName: "ALCANO MARIA", policyNumber: "199554", plan: "G 269", value: 14900, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true, sourceTickets: 4 },
  { id: "106792-Vida", fullName: "ROMERO EDGARDO", policyNumber: "106792", plan: "Vida", value: 2484, phone: "", address: "", dependency: "001", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: false, sourceTickets: 1 },
];

const emptyTransfer = (): TransferData => ({
  transactionNumber: "",
  receiptNumber: "",
  date: today(),
  holder: "",
  proof: "",
  notes: "",
});

const normalizePlan = (value: string): PlanType => {
  const normalized = value.trim().toLocaleUpperCase("es-AR").replace("-", " ");
  if (normalized === "A") return "A 238";
  if (normalized === "G") return "G 238";
  if (normalized === "G 269") return "G 269";
  if (normalized === "A 269") return "A 269";
  if (normalized === "G 238") return "G 238";
  if (normalized === "A 238") return "A 238";
  if (normalized === "VIDA" || normalized === "V") return "Vida";
  if (normalized === "09") return "09";
  if (normalized === "C") return "C";
  return "A 238";
};

const parseMoney = (value: string) => {
  const clean = value.replace(/\$/g, "").replace(/\s/g, "").trim();
  const lastComma = clean.lastIndexOf(",");
  const lastDot = clean.lastIndexOf(".");
  let normalized = clean;
  if (lastComma >= 0 && lastDot >= 0) normalized = lastComma > lastDot ? clean.replace(/\./g, "").replace(/,/g, ".") : clean.replace(/,/g, "");
  else if (lastComma >= 0) normalized = clean.replace(/,/g, ".");
  else if (lastDot >= 0 && /^\d{1,3}(\.\d{3})+$/.test(clean)) normalized = clean.replace(/\./g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseNumber = (value: string | number | undefined) => {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};
const escapeHtml = (value: string | number | undefined | null) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
};

const detectDelimiter = (text: string) => {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join("\n");
  const counts = [
    { delimiter: ";", count: (firstLines.match(/;/g) || []).length },
    { delimiter: "\t", count: (firstLines.match(/\t/g) || []).length },
    { delimiter: ",", count: (firstLines.match(/,/g) || []).length },
  ];
  return counts.sort((a, b) => b.count - a.count)[0]?.delimiter || ",";
};

const parseDelimitedLine = (line: string, delimiter: string) => {
  if (delimiter === ",") return parseCsvLine(line);
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === "\"") quoted = !quoted;
    else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells;
};

const parseDelimitedRows = (text: string) => {
  const delimiter = detectDelimiter(text);
  return text.split(/\r?\n/).map((line) => parseDelimitedLine(line, delimiter));
};

const normalizeHeader = (value: string) => value.trim().toLocaleUpperCase("es-AR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getCollectionPlanData = (rawPlan: string) => {
  const normalized = rawPlan.trim().toLocaleUpperCase("es-AR").replace(/\s+/g, " ");
  const compact = normalized.replace(/[-\s]/g, "");
  const coded = compact.match(/^([AG])C[AG](\d+)$/);
  if (coded) return { plan: `${coded[1]} ${coded[2]}`, dependency: coded[2] };
  const suffixed = normalized.match(/^([AG])[-\s]?(\d+)$/);
  if (suffixed) return { plan: `${suffixed[1]} ${suffixed[2]}`, dependency: suffixed[2] };
  const cSuffixed = normalized.match(/^C[-\s]?(\d+)$/);
  if (cSuffixed) return { plan: `C ${cSuffixed[1]}`, dependency: cSuffixed[1] };
  const vidaSuffixed = normalized.match(/^VIDA\s*[-\s]\s*(\d+)$/);
  if (vidaSuffixed) return { plan: `Vida ${vidaSuffixed[1]}`, dependency: vidaSuffixed[1] };
  if (normalized === "A") return { plan: "A 327", dependency: "327" };
  if (normalized === "G") return { plan: "G 327", dependency: "327" };
  if (normalized === "C") return { plan: "C", dependency: "327" };
  if (normalized === "VIDA" || normalized === "V") return { plan: "Vida", dependency: "268" };
  if (normalized === "09") return { plan: "09", dependency: "OFICINA" };
  return { plan: normalizePlan(rawPlan), dependency: "SIN DEFINIR" };
};

const isCollectionPlanCode = (rawPlan: string) => {
  const normalized = rawPlan.trim().toLocaleUpperCase("es-AR").replace(/\s+/g, " ");
  const compact = normalized.replace(/[-\s]/g, "");
  return /^([AG])C[AG]\d+$/.test(compact)
    || /^([AG])[-\s]?\d+$/.test(normalized)
    || /^C[-\s]?\d+$/.test(normalized)
    || /^VIDA\s*[-\s]\s*\d+$/.test(normalized)
    || ["A", "G", "C", "VIDA", "V", "09"].includes(normalized);
};

const looksLikeTresProvinciasCollection = (rows: string[][]) => {
  return rows.some((row) => {
    const headers = row.map((cell) => normalizeHeader(cell));
    return headers.includes("POLIZA") && headers.includes("PLAN") && headers.includes("APELLIDO") && headers.includes("NOMBRE");
  });
};

const parseTresProvinciasCollectionRows = (rows: string[][]) => {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((cell) => normalizeHeader(cell));
    return headers.includes("POLIZA") && headers.includes("APELLIDO") && headers.includes("NOMBRE");
  });
  if (headerIndex < 0) return { affiliates: [] as Affiliate[], duplicatedCount: 0 };
  const headers = rows[headerIndex].map((cell) => normalizeHeader(cell));
  const findColumn = (names: string[]) => headers.findIndex((header) => names.some((name) => header === name || header.includes(name)));
  const policyColumn = findColumn(["POLIZA"]);
  const planColumn = findColumn(["PLAN"]);
  const lastNameColumn = findColumn(["APELLIDO"]);
  const firstNameColumn = findColumn(["NOMBRE"]);
  const amountColumn = findColumn(["MONTO CUOTA", "MONTO", "CUOTA"]);
  const collectorColumn = findColumn(["COBRADOR"]);
  const ticketsColumn = findColumn(["CANTIDAD", "TICKETS"]);
  const seen = new Set<string>();
  let duplicatedCount = 0;

  const affiliates = rows.slice(headerIndex + 1).flatMap((row, index): Affiliate[] => {
    const rawPolicyNumber = (row[policyColumn] || "").trim();
    const policyNumber = rawPolicyNumber.replace(/\D/g, "").trim();
    const rawPlan = (row[planColumn] || "").trim();
    const lastName = (row[lastNameColumn] || "").trim();
    const firstName = (row[firstNameColumn] || "").trim();
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(rawPolicyNumber) || !/^\d+$/.test(policyNumber) || Number(policyNumber) <= 0 || !isCollectionPlanCode(rawPlan) || (!lastName && !firstName)) return [];
    const { plan, dependency } = getCollectionPlanData(rawPlan);
    const id = `${policyNumber}-${plan}`;
    if (seen.has(id)) {
      duplicatedCount += 1;
      return [];
    }
    seen.add(id);
    return [{
      id: id || `SIN-${index}`,
      fullName: `${lastName} ${firstName}`.trim().toLocaleUpperCase("es-AR"),
      policyNumber,
      plan,
      value: parseMoney(row[amountColumn] || ""),
      phone: "",
      address: "",
      dependency,
      collector: normalizeCollectorName(row[collectorColumn] || ""),
      request: "",
      latestNews: "",
      selectedForMonthly: true,
      sourceTickets: Math.max(0, ticketsColumn >= 0 ? parseNumber(row[ticketsColumn]) : 1),
    }];
  });

  return { affiliates, duplicatedCount };
};

const parseAffiliatesCsv = (text: string) => {
  const rows = parseDelimitedRows(text);
  if (looksLikeTresProvinciasCollection(rows)) return parseTresProvinciasCollectionRows(rows);
  const seen = new Set<string>();
  let duplicatedCount = 0;
  const affiliates = rows.slice(1).flatMap((row, index): Affiliate[] => {
    const fullName = row[1]?.trim().toLocaleUpperCase("es-AR");
    const policyNumber = row[2]?.trim();
    if (!fullName && !policyNumber) return [];
    const plan = normalizePlan(row[4] || "");
    const id = `${policyNumber || `SIN-${index}`}-${plan}`;
    if (seen.has(id)) {
      duplicatedCount += 1;
      return [];
    }
    seen.add(id);
    return [{
      id,
      fullName,
      policyNumber,
      plan,
      value: parseMoney(row[6] || ""),
      phone: "",
      address: "",
      dependency: "001",
      collector: "OFICINA",
      request: "",
      latestNews: "",
      selectedForMonthly: true,
      sourceTickets: Math.max(0, parseNumber(row[3])),
    }];
  });
  return { affiliates, duplicatedCount };
};

const getGoogleSheetCsvUrl = (url: string) => {
  const match = url.match(/\/spreadsheets\/d\/([^/]+)/);
  const id = match?.[1] || url.trim();
  return id ? `https://docs.google.com/spreadsheets/d/${id}/export?format=csv` : "";
};

const loadStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) as T : fallback;
  } catch {
    return fallback;
  }
};

const saveStorage = (key: string, value: unknown) => {
  window.localStorage.setItem(key, JSON.stringify(value));
};

const methodLabel = (method: PaymentMethod) => method === "E" ? "Efectivo" : method === "T" ? "Transferencia" : "Sin definir";

const uniqueSorted = (values: string[]) => Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
const mergeRowsById = <T extends { id: string }>(onlineRows: T[], localRows: T[]) => {
  const rows = new Map<string, T>();
  onlineRows.forEach((row) => rows.set(row.id, row));
  localRows.forEach((row) => rows.set(row.id, row));
  return Array.from(rows.values());
};

const knownCollectorCommissions: Record<string, Pick<CollectorRecord, "commissionBase" | "bonusEnabled" | "bonusThreshold" | "bonusRate">> = {
  "ALCIDES OMAR": { commissionBase: 12, bonusEnabled: true, bonusThreshold: 90, bonusRate: 13 },
  "BENJAMIN NAVARRO": { commissionBase: 12, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "DANIEL HLOSKA": { commissionBase: 13, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "EUGENIO BUSTOS OFICINA": { commissionBase: 5, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "FABIAN GONZALEZ": { commissionBase: 12, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "FEDERICO CASTILLO": { commissionBase: 12, bonusEnabled: true, bonusThreshold: 90, bonusRate: 13 },
  "GUADALUPE GONZALEZ": { commissionBase: 12, bonusEnabled: true, bonusThreshold: 90, bonusRate: 13 },
  "GUSTAVO ARIEL GARCIA": { commissionBase: 12, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "JORGE FUNES": { commissionBase: 12, bonusEnabled: true, bonusThreshold: 90, bonusRate: 13 },
  "SAN MARTIN OFICINA": { commissionBase: 5, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "SILVIA PELLEGRINI": { commissionBase: 12, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
  "TUNUYAN OFICINA": { commissionBase: 5, bonusEnabled: false, bonusThreshold: 90, bonusRate: 13 },
};

const defaultCollectorConfig = (name: string, phone = ""): CollectorRecord => ({
  name: normalizeCollectorName(name),
  phone,
  ...(knownCollectorCommissions[normalizeCollectorName(name)] || {
    commissionBase: 12,
    bonusEnabled: false,
    bonusThreshold: 90,
    bonusRate: 13,
  }),
});

const normalizeCollectorRecords = (value: unknown): CollectorRecord[] => {
  const rows = Array.isArray(value) ? value : ["OFICINA"];
  const normalized = rows.flatMap((item): CollectorRecord[] => {
    if (typeof item === "string") return [defaultCollectorConfig(item)];
    if (item && typeof item === "object" && "name" in item) {
      const record = item as { name?: unknown; phone?: unknown; commissionBase?: unknown; bonusEnabled?: unknown; bonusThreshold?: unknown; bonusRate?: unknown };
      return [{
        name: normalizeCollectorName(String(record.name || "")),
        phone: String(record.phone || "").trim(),
        commissionBase: Math.max(0, parseNumber(record.commissionBase as string) || defaultCollectorConfig(String(record.name || "")).commissionBase),
        bonusEnabled: record.bonusEnabled === undefined ? defaultCollectorConfig(String(record.name || "")).bonusEnabled : Boolean(record.bonusEnabled),
        bonusThreshold: Math.max(0, parseNumber(record.bonusThreshold as string) || defaultCollectorConfig(String(record.name || "")).bonusThreshold),
        bonusRate: Math.max(0, parseNumber(record.bonusRate as string) || defaultCollectorConfig(String(record.name || "")).bonusRate),
      }];
    }
    return [];
  }).filter((item) => item.name);
  const byName = new Map<string, CollectorRecord>();
  normalized.forEach((item) => byName.set(item.name, item));
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "es-AR", { numeric: true }));
};

const isDemoAffiliateBase = (rows: Affiliate[]) => {
  if (rows.length !== demoAffiliates.length) return false;
  const demoIds = new Set(demoAffiliates.map((item) => item.id));
  return rows.every((item) => demoIds.has(item.id));
};

const buildAffiliateImportPreview = (rows: Affiliate[], current: Affiliate[], source: string, duplicatedCount: number): AffiliateImportPreview => {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const currentPolicyNumbers = new Set(current.map((item) => item.policyNumber).filter(Boolean));
  const seenNewPolicies = new Set<string>();
  const newRows: Affiliate[] = [];
  const newPolicyRows: Affiliate[] = [];
  const changedRows: AffiliateImportPreview["changedRows"] = [];
  let existingCount = 0;

  rows.forEach((incoming) => {
    if (incoming.policyNumber && !currentPolicyNumbers.has(incoming.policyNumber) && !seenNewPolicies.has(incoming.policyNumber)) {
      newPolicyRows.push(incoming);
      seenNewPolicies.add(incoming.policyNumber);
    }
    const previous = currentById.get(incoming.id);
    if (!previous) {
      newRows.push(incoming);
      return;
    }
    existingCount += 1;
    const fields = [
      previous.fullName !== incoming.fullName ? "nombre" : "",
      previous.policyNumber !== incoming.policyNumber ? "póliza" : "",
      previous.plan !== incoming.plan ? "plan" : "",
      previous.value !== incoming.value ? "valor" : "",
      (previous.sourceTickets || 0) !== (incoming.sourceTickets || 0) ? "tickets" : "",
    ].filter(Boolean);
    if (fields.length > 0) changedRows.push({ incoming, previous, fields });
  });

  return { source, rows, newRows, newPolicyRows, existingCount, changedRows, duplicatedCount };
};

const emptyAffiliateForm = (): AffiliateForm => ({
  fullName: "",
  policyNumber: "",
  plan: "A 238",
  value: 0,
  phone: "",
  address: "",
  dependency: "001",
  collector: "OFICINA",
  request: "",
  latestNews: "",
  sourceTickets: 0,
});

const emptyTransferForm = emptyTransfer;
const emptyCashMovementForm = () => ({
  date: today(),
  office: "",
  shift: "",
  type: "ingreso" as CashMovement["type"],
  source: "SERVICIOS" as CashMovement["source"],
  paymentMethod: "EFECTIVO" as CashMovement["paymentMethod"],
  receiptType: "",
  receiptNumber: "",
  concept: "",
  amount: "",
  notes: "",
});
const emptyCashOpeningForm = () => ({
  date: today(),
  office: "",
  amount: "",
  notes: "",
});
const emptyCashTurnNoteForm = () => ({
  date: today(),
  office: "",
  shift: "",
  entryType: "NOVEDAD" as CashTurnNote["entryType"],
  text: "",
});
const cashExpenseConcepts = [
  "SERVICIO DE BUFETE",
  "PANADERIA",
  "COMBUSTIBLE",
  "SERVICIO DE CATERING",
  "REPARACION DE VEHICULOS",
  "REPARACION DE EDIFICIO",
  "COMPRAS ARTICULOS FUNERARIOS",
  "LIBRERIA",
  "SUELDOS",
  "COMISIONES",
  "RETIRO DE EFECTIVO",
  "DEPOSITO EN EFECTIVO",
  "PRODUCCIONES",
  "OTROS GASTOS",
];
const userRoleOptions = [
  { value: "cobrador", label: "Cobrador" },
  { value: "oficina", label: "Oficina" },
  { value: "oficina_cobrador", label: "Oficina + cobrador" },
  { value: "consulta", label: "Consulta" },
  { value: "admin", label: "Administrador" },
];

const InsuranceCollections = () => {
  const { currentUserProfile, email: userEmail, signOut } = useCurrentUserProfile();
  const [activeSection, setActiveSection] = useState<Section>("Base");
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [affiliates, setAffiliates] = useState<Affiliate[]>(() => loadStorage(affiliatesStorageKey, demoAffiliates));
  const [monthlyItems, setMonthlyItems] = useState<MonthlyItem[]>(() => loadStorage(monthlyStorageKey, []));
  const [monthlyNewPolicyIds, setMonthlyNewPolicyIds] = useState<Record<string, string[]>>(() => loadStorage(monthlyNewPoliciesStorageKey, {}));
  const [ticketCollections, setTicketCollections] = useState<TicketCollection[]>(() => loadStorage(ticketCollectionsStorageKey, []));
  const [ticketReturnControls, setTicketReturnControls] = useState<TicketReturnControl[]>(() => loadStorage(ticketReturnControlsStorageKey, []));
  const [receipts, setReceipts] = useState<ReceiptCollection[]>(() => loadStorage(receiptsStorageKey, []));
  const [notes, setNotes] = useState<AffiliateNote[]>(() => loadStorage(notesStorageKey, []));
  const [cashMovements, setCashMovements] = useState<CashMovement[]>(() => loadStorage(cashMovementsStorageKey, []));
  const [cashOpeningBalances, setCashOpeningBalances] = useState<CashOpeningBalance[]>(() => loadStorage(cashOpeningBalancesStorageKey, []));
  const [cashTurnNotes, setCashTurnNotes] = useState<CashTurnNote[]>(() => loadStorage(cashTurnNotesStorageKey, []));
  const [cashMovementForm, setCashMovementForm] = useState(emptyCashMovementForm);
  const [cashOpeningForm, setCashOpeningForm] = useState(emptyCashOpeningForm);
  const [cashTurnNoteForm, setCashTurnNoteForm] = useState(emptyCashTurnNoteForm);
  const [cashOfficeFilter, setCashOfficeFilter] = useState("todos");
  const [cashTypeFilter, setCashTypeFilter] = useState("todos");
  const [cashReportDate, setCashReportDate] = useState(today());
  const [cashReportShift, setCashReportShift] = useState("");
  const [rendition, setRendition] = useState<Rendition>(() => {
    const stored = loadStorage<any>(renditionStorageKey, { cashRenders: [], transferRenders: [] });
    return {
      cashRenders: Array.isArray(stored.cashRenders)
        ? stored.cashRenders
        : stored.cashRendered
          ? [{ id: "cash-migrated", date: today(), amount: stored.cashRendered, detail: "Efectivo rendido" }]
          : [],
      transferRenders: Array.isArray(stored.transferRenders) ? stored.transferRenders : [],
    };
  });
  const [query, setQuery] = useState("");
  const [pendingFilter, setPendingFilter] = useState("todos");
  const [dependencyFilter, setDependencyFilter] = useState("todos");
  const [collectorFilter, setCollectorFilter] = useState("todos");
  const [collectorPickerAffiliateId, setCollectorPickerAffiliateId] = useState<string | null>(null);
  const [collectorRecords, setCollectorRecords] = useState<CollectorRecord[]>(() => normalizeCollectorRecords(loadStorage(collectorsStorageKey, ["OFICINA"])));
  const [customDependencies, setCustomDependencies] = useState<string[]>(() => loadStorage(dependenciesStorageKey, []));
  const [newCollectorName, setNewCollectorName] = useState("");
  const [newCollectorPhone, setNewCollectorPhone] = useState("");
  const [newCollectorCommission, setNewCollectorCommission] = useState("12");
  const [newCollectorBonusEnabled, setNewCollectorBonusEnabled] = useState(false);
  const [collectorToRename, setCollectorToRename] = useState("");
  const [collectorRenameValue, setCollectorRenameValue] = useState("");
  const [collectorPhoneValue, setCollectorPhoneValue] = useState("");
  const [collectorCommissionValue, setCollectorCommissionValue] = useState("12");
  const [collectorBonusEnabled, setCollectorBonusEnabled] = useState(false);
  const [collectorDetailName, setCollectorDetailName] = useState("");
  const [collectorSettingsOpen, setCollectorSettingsOpen] = useState(false);
  const [collectorReportOpen, setCollectorReportOpen] = useState(false);
  const [adminReportScope, setAdminReportScope] = useState<"collector" | "all">("collector");
  const [collectorMergeFrom, setCollectorMergeFrom] = useState("");
  const [collectorMergeTo, setCollectorMergeTo] = useState("");
  const [newDependencyName, setNewDependencyName] = useState("");
  const [dependencyToRename, setDependencyToRename] = useState("");
  const [dependencyRenameValue, setDependencyRenameValue] = useState("");
  const [collectorWhatsapp, setCollectorWhatsapp] = useState(() => loadStorage(collectorWhatsappStorageKey, ""));
  const [sheetUrl, setSheetUrl] = useState(defaultSheetUrl);
  const [importMessage, setImportMessage] = useState("Base demo cargada. Podés importar la planilla original.");
  const [autoImportTried, setAutoImportTried] = useState(false);
  const [affiliateImportPreview, setAffiliateImportPreview] = useState<AffiliateImportPreview | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);
  const [affiliateDialogOpen, setAffiliateDialogOpen] = useState(false);
  const [editingAffiliateId, setEditingAffiliateId] = useState<string | null>(null);
  const [affiliateForm, setAffiliateForm] = useState<AffiliateForm>(emptyAffiliateForm);
  const [noteAffiliateId, setNoteAffiliateId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [newsAffiliateQuery, setNewsAffiliateQuery] = useState("");
  const [newsAffiliateId, setNewsAffiliateId] = useState("");
  const [newsText, setNewsText] = useState("");
  const [collectionPolicy, setCollectionPolicy] = useState("");
  const [collectionTickets, setCollectionTickets] = useState("1");
  const [collectionMethod, setCollectionMethod] = useState<PaymentMethod>("E");
  const [collectionTransfer, setCollectionTransfer] = useState<TransferData>(emptyTransferForm);
  const [editingTicketCollectionId, setEditingTicketCollectionId] = useState<string | null>(null);
  const [isSavingTicketCollection, setIsSavingTicketCollection] = useState(false);
  const [mobileCollector, setMobileCollector] = useState("todos");
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileTicketFilter, setMobileTicketFilter] = useState<"pending" | "all" | "paid">("pending");
  const [mobileSelectedAffiliateId, setMobileSelectedAffiliateId] = useState("");
  const [mobileNoteText, setMobileNoteText] = useState("");
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: "",
    policyNumber: "",
    fullName: "",
    collector: "OFICINA",
    plan: "A 238" as PlanType,
    paidMonth: "",
    paidMonths: [] as string[],
    monthCount: "0",
    monthlyAmount: "",
    paymentMethod: "E" as PaymentMethod,
    isProduction: false,
    transfer: emptyTransfer(),
  });
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [cashRenderForm, setCashRenderForm] = useState({ date: today(), amount: "", detail: "" });
  const [transferRenderForm, setTransferRenderForm] = useState({ date: today(), amount: "", proof: "" });
  const [nextCollectionMonth, setNextCollectionMonth] = useState(() => addMonths(currentMonth(), 1));
  const [userForm, setUserForm] = useState({ nombre: "", email: "", password: "", rol: "cobrador", collectorName: "", offices: [] as string[] });
  const [userProfiles, setUserProfiles] = useState<UserAdminProfile[]>([]);
  const [userAdminStatus, setUserAdminStatus] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [activeOffice, setActiveOffice] = useState("");
  const [sessionToken] = useState(() => {
    const existing = window.sessionStorage.getItem("gestion-san-miguel-session-token");
    if (existing) return existing;
    const next = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `session-${Date.now()}-${Math.random()}`;
    window.sessionStorage.setItem("gestion-san-miguel-session-token", next);
    return next;
  });
  const [sessionBlockMessage, setSessionBlockMessage] = useState("");
  const [cloudStatus, setCloudStatus] = useState("Modo local activo");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [lastCloudLoadedAt, setLastCloudLoadedAt] = useState("");
  const autoSaveTimer = useRef<number | null>(null);
  const userRole = (currentUserProfile?.rol || "").trim().toLowerCase();
  const isAdminUser = userRole === "admin";
  const isOfficeUser = ["admin", "oficina", "oficina_cobrador", "administracion", "compras"].includes(userRole);
  const isCollectorUser = ["cobrador", "oficina_cobrador"].includes(userRole);
  const canUseManualSync = isOfficeUser && !isCollectorUser;
  const currentCollectorName = normalizeCollectorName(currentUserProfile?.collectorName || currentUserProfile?.nombre || "");
  const assignedOfficeOptions = useMemo(() => {
    if (isAdminUser) return officeNames;
    if (!isOfficeUser) return [];
    const fromPermissions = officesFromPermissions(currentUserProfile?.permisos);
    if (fromPermissions.length) return fromPermissions;
    const fallbackOffice = officeFromCollector(currentUserProfile?.collectorName || currentUserProfile?.nombre || "");
    return fallbackOffice ? [fallbackOffice] : [];
  }, [currentUserProfile?.collectorName, currentUserProfile?.nombre, currentUserProfile?.permisos, isAdminUser, isOfficeUser]);
  const activeOfficeCollectorName = collectorForOffice(activeOffice);
  const officeCollectorScope = !isAdminUser && isOfficeUser && activeOfficeCollectorName ? activeOfficeCollectorName : "";
  const hasOfficeCollectorScope = !!officeCollectorScope;
  const canSeeAllCobranza = isAdminUser && isOfficeUser && !hasOfficeCollectorScope;

  const sessionCutoffIso = () => new Date(Date.now() - activeSessionTimeoutMinutes * 60 * 1000).toISOString();

  const pruneExpiredSessions = async () => {
    await supabase.from(activeSessionsTable as any).delete().lt("last_seen", sessionCutoffIso());
  };

  const activeSessionPayload = (office = activeOffice) => ({
    session_token: sessionToken,
    email: (userEmail || "").trim().toLowerCase(),
    nombre: (currentUserProfile?.nombre || userEmail || "USUARIO").toLocaleUpperCase("es-AR"),
    rol: userRole || "sin_rol",
    office: office || null,
    last_seen: new Date().toISOString(),
  });

  const saveActiveSession = async (office = activeOffice) => {
    if (!userEmail || isAdminUser) return true;
    const { error } = await supabase
      .from(activeSessionsTable as any)
      .upsert(activeSessionPayload(office), { onConflict: "session_token" });
    if (error) {
      setCloudStatus(`No se pudo registrar la sesion activa: ${error.message}`);
      return false;
    }
    return true;
  };

  const releaseActiveSession = async () => {
    await supabase.from(activeSessionsTable as any).delete().eq("session_token", sessionToken);
    const email = (userEmail || "").trim().toLowerCase();
    if (email) {
      await supabase.from(activeSessionsTable as any).delete().eq("email", email);
    }
  };

  const handleSignOut = async () => {
    await releaseActiveSession().catch(() => null);
    await signOut();
  };

  const activateOffice = async (office: string) => {
    if (!office) return;
    if (isAdminUser) {
      setActiveOffice(office);
      return;
    }
    await pruneExpiredSessions().catch(() => null);
    const { data, error } = await supabase
      .from(activeSessionsTable as any)
      .select("email,nombre,office,last_seen,session_token")
      .eq("office", office)
      .neq("session_token", sessionToken)
      .gte("last_seen", sessionCutoffIso())
      .limit(1);
    if (error) {
      setCloudStatus(`No se pudo verificar sesiones de oficina: ${error.message}`);
      setActiveOffice(office);
      return;
    }
    if (Array.isArray(data) && data.length > 0) {
      const active = data[0] as any;
      setSessionBlockMessage(`LA OFICINA ${office} YA TIENE UNA SESION ACTIVA CON ${active.nombre || active.email}. PARA INGRESAR, PRIMERO DEBEN CERRAR ESA SESION O INGRESAR COMO ADMIN.`);
      return;
    }
    setActiveOffice(office);
    await saveActiveSession(office);
  };

  const defaultCashDateForActiveMonth = () => activeMonth === currentMonth() ? today() : `${activeMonth}-01`;

  useEffect(() => saveStorage(affiliatesStorageKey, affiliates), [affiliates]);
  useEffect(() => saveStorage(monthlyStorageKey, monthlyItems), [monthlyItems]);
  useEffect(() => saveStorage(monthlyNewPoliciesStorageKey, monthlyNewPolicyIds), [monthlyNewPolicyIds]);
  useEffect(() => saveStorage(ticketCollectionsStorageKey, ticketCollections), [ticketCollections]);
  useEffect(() => saveStorage(ticketReturnControlsStorageKey, ticketReturnControls), [ticketReturnControls]);
  useEffect(() => saveStorage(receiptsStorageKey, receipts), [receipts]);
  useEffect(() => saveStorage(notesStorageKey, notes), [notes]);
  useEffect(() => saveStorage(cashMovementsStorageKey, cashMovements), [cashMovements]);
  useEffect(() => saveStorage(cashOpeningBalancesStorageKey, cashOpeningBalances), [cashOpeningBalances]);
  useEffect(() => saveStorage(cashTurnNotesStorageKey, cashTurnNotes), [cashTurnNotes]);
  useEffect(() => saveStorage(renditionStorageKey, rendition), [rendition]);
  useEffect(() => saveStorage(collectorWhatsappStorageKey, collectorWhatsapp), [collectorWhatsapp]);
  useEffect(() => saveStorage(collectorsStorageKey, collectorRecords), [collectorRecords]);
  useEffect(() => saveStorage(dependenciesStorageKey, customDependencies), [customDependencies]);

  useEffect(() => {
    setCashMovementForm((current) => {
      if (current.amount || current.concept || current.receiptNumber || current.notes) return current;
      return { ...current, date: defaultCashDateForActiveMonth() };
    });
    setCashOpeningForm((current) => {
      if (current.amount || current.notes) return current;
      return { ...current, date: defaultCashDateForActiveMonth() };
    });
    setCashTurnNoteForm((current) => {
      if (current.text) return current;
      return { ...current, date: defaultCashDateForActiveMonth() };
    });
  }, [activeMonth]);

  useEffect(() => {
    if (!userEmail || !currentUserProfile || isAdminUser) return;
    let cancelled = false;
    const registerSession = async () => {
      await pruneExpiredSessions().catch(() => null);
      const { data, error } = await supabase
        .from(activeSessionsTable as any)
        .select("email,nombre,office,last_seen,session_token")
        .eq("email", userEmail.trim().toLowerCase())
        .neq("session_token", sessionToken)
        .gte("last_seen", sessionCutoffIso())
        .limit(1);
      if (cancelled) return;
      if (error) {
        setCloudStatus(`No se pudo verificar sesiones activas: ${error.message}`);
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        const active = data[0] as any;
        setSessionBlockMessage(`ESTE USUARIO YA TIENE UNA SESION ACTIVA${active.office ? ` EN ${active.office}` : ""}. PARA INGRESAR, PRIMERO DEBE CERRAR LA OTRA SESION.`);
        return;
      }
      await saveActiveSession("");
    };
    void registerSession();
    return () => {
      cancelled = true;
    };
  }, [userEmail, currentUserProfile?.nombre, userRole, isAdminUser, sessionToken]);

  useEffect(() => {
    if (!userEmail || !currentUserProfile || isAdminUser || sessionBlockMessage) return;
    const heartbeat = () => {
      void saveActiveSession(activeOffice);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 20000);
    return () => window.clearInterval(timer);
  }, [activeOffice, currentUserProfile?.nombre, isAdminUser, sessionBlockMessage, sessionToken, userEmail, userRole]);

  useEffect(() => {
    if (!isOfficeUser || isAdminUser) return;
    if (assignedOfficeOptions.length === 1) {
      if (activeOffice !== assignedOfficeOptions[0]) void activateOffice(assignedOfficeOptions[0]);
      return;
    }
    if (activeOffice && !assignedOfficeOptions.includes(activeOffice)) setActiveOffice("");
  }, [activeOffice, assignedOfficeOptions, isAdminUser, isOfficeUser]);

  useEffect(() => {
    if (!activeOffice || isAdminUser) return;
    setCashMovementForm((current) => ({ ...current, office: activeOffice }));
    setCashOpeningForm((current) => ({ ...current, office: activeOffice }));
    setCashTurnNoteForm((current) => ({ ...current, office: activeOffice }));
    setCashOfficeFilter(activeOffice);
  }, [activeOffice, isAdminUser]);

  const buildCloudSnapshot = (overrides: Partial<CloudSnapshot> = {}): CloudSnapshot => ({
    affiliates: overrides.affiliates ?? affiliates,
    monthlyItems: overrides.monthlyItems ?? monthlyItems,
    monthlyNewPolicyIds: overrides.monthlyNewPolicyIds ?? monthlyNewPolicyIds,
    ticketCollections: overrides.ticketCollections ?? ticketCollections,
    ticketReturnControls: overrides.ticketReturnControls ?? ticketReturnControls,
    receipts: overrides.receipts ?? receipts,
    notes: overrides.notes ?? notes,
    rendition: overrides.rendition ?? rendition,
    cashMovements: overrides.cashMovements ?? cashMovements,
    cashOpeningBalances: overrides.cashOpeningBalances ?? cashOpeningBalances,
    cashTurnNotes: overrides.cashTurnNotes ?? cashTurnNotes,
    collectorRecords: overrides.collectorRecords ?? collectorRecords,
    customDependencies: overrides.customDependencies ?? customDependencies,
    collectorWhatsapp: overrides.collectorWhatsapp ?? collectorWhatsapp,
    activeMonth: overrides.activeMonth ?? activeMonth,
  });

  const applyCloudSnapshot = (snapshot: Partial<CloudSnapshot>) => {
    setAffiliates(Array.isArray(snapshot.affiliates) ? snapshot.affiliates : demoAffiliates);
    setMonthlyItems(Array.isArray(snapshot.monthlyItems) ? snapshot.monthlyItems : []);
    setMonthlyNewPolicyIds(snapshot.monthlyNewPolicyIds && typeof snapshot.monthlyNewPolicyIds === "object" ? snapshot.monthlyNewPolicyIds : {});
    setTicketCollections(Array.isArray(snapshot.ticketCollections) ? snapshot.ticketCollections : []);
    setTicketReturnControls(Array.isArray(snapshot.ticketReturnControls) ? snapshot.ticketReturnControls : []);
    setReceipts(Array.isArray(snapshot.receipts) ? snapshot.receipts : []);
    setNotes(Array.isArray(snapshot.notes) ? snapshot.notes : []);
    setCashMovements(Array.isArray(snapshot.cashMovements) ? snapshot.cashMovements : []);
    setCashOpeningBalances(Array.isArray(snapshot.cashOpeningBalances) ? snapshot.cashOpeningBalances : []);
    setCashTurnNotes(Array.isArray(snapshot.cashTurnNotes) ? snapshot.cashTurnNotes : []);
    setRendition(snapshot.rendition && Array.isArray(snapshot.rendition.cashRenders) && Array.isArray(snapshot.rendition.transferRenders) ? snapshot.rendition : { cashRenders: [], transferRenders: [] });
    setCollectorRecords(normalizeCollectorRecords(snapshot.collectorRecords || ["OFICINA"]));
    setCustomDependencies(Array.isArray(snapshot.customDependencies) ? snapshot.customDependencies : []);
    setCollectorWhatsapp(String(snapshot.collectorWhatsapp || ""));
    if (snapshot.activeMonth) setActiveMonth(snapshot.activeMonth);
  };

  const validateCloudSnapshotBeforeSave = async (snapshot: CloudSnapshot) => {
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) return { ok: false, message: `No se pudo verificar la base online: ${error.message}` };

    const onlineSnapshot = data?.data as Partial<CloudSnapshot> | undefined;
    const onlineCount = Array.isArray(onlineSnapshot?.affiliates) ? onlineSnapshot.affiliates.length : 0;
    const nextCount = Array.isArray(snapshot.affiliates) ? snapshot.affiliates.length : 0;
    const isDangerousShrink = onlineCount >= 1000 && nextCount > 0 && nextCount < onlineCount * 0.8;
    const onlineCollections = Array.isArray(onlineSnapshot?.ticketCollections) ? onlineSnapshot.ticketCollections.length : 0;
    const nextCollections = Array.isArray(snapshot.ticketCollections) ? snapshot.ticketCollections.length : 0;
    const onlineReceipts = Array.isArray(onlineSnapshot?.receipts) ? onlineSnapshot.receipts.length : 0;
    const nextReceipts = Array.isArray(snapshot.receipts) ? snapshot.receipts.length : 0;
    const isLosingMovements = (onlineCollections > nextCollections) || (onlineReceipts > nextReceipts);
    const onlineUpdatedAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
    const loadedAt = lastCloudLoadedAt ? new Date(lastCloudLoadedAt).getTime() : 0;
    const remoteChangedAfterLoad = onlineUpdatedAt > 0 && loadedAt > 0 && onlineUpdatedAt > loadedAt + 1000;

    if (isDangerousShrink) {
      const updatedAt = data?.updated_at ? ` Ultima base online: ${new Date(data.updated_at).toLocaleString("es-AR")}.` : "";
      return {
        ok: false,
        message: `Proteccion activa: no se guardo online porque esta pantalla tiene ${nextCount} afiliados y la base online tiene ${onlineCount}.${updatedAt} Primero usá Cargar online.`,
      };
    }

    if (isLosingMovements) {
      return {
        ok: false,
        message: `Proteccion activa: no se guardo online porque esta pantalla tiene menos movimientos que la base online. Primero usá Cargar online.`,
      };
    }

    if (remoteChangedAfterLoad) {
      return {
        ok: false,
        message: "Proteccion activa: otra PC actualizo la base online. Se cancelo el guardado; usá Cargar online antes de guardar.",
      };
    }

    return { ok: true, message: "" };
  };

  const saveCloudSnapshot = async (overrides: Partial<CloudSnapshot> = {}) => {
    setCloudBusy(true);
    setCloudStatus("Guardando en la base online...");
    const snapshot = buildCloudSnapshot(overrides);
    const validation = await validateCloudSnapshotBeforeSave(snapshot);
    if (!validation.ok) {
      setCloudBusy(false);
      setCloudStatus(validation.message);
      return;
    }
    const { error } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setCloudBusy(false);
    if (error) {
      setCloudStatus(`No se pudo guardar online: ${error.message}`);
      return;
    }
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Guardado online ${new Date().toLocaleString("es-AR")}`);
  };

  const saveCloudSnapshotSilent = async () => {
    const snapshot = buildCloudSnapshot();
    const validation = await validateCloudSnapshotBeforeSave(snapshot);
    if (!validation.ok) {
      setCloudStatus(validation.message);
      return;
    }
    const { error } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) {
      setCloudStatus(`No se pudo sincronizar online: ${error.message}`);
      return;
    }
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Sincronizado online ${new Date().toLocaleTimeString("es-AR")}`);
  };

  const saveRequestOrNews = async (affiliateId?: string, patch?: Partial<Pick<Affiliate, "request" | "latestNews">>) => {
    setCloudStatus("Guardando pedido/novedad...");
    if (!affiliateId || !patch) {
      await saveCloudSnapshot();
      return;
    }
    const normalizedPatch: Partial<Pick<Affiliate, "request" | "latestNews">> = {};
    if (patch.request !== undefined) normalizedPatch.request = patch.request.toLocaleUpperCase("es-AR");
    if (patch.latestNews !== undefined) normalizedPatch.latestNews = patch.latestNews.toLocaleUpperCase("es-AR");
    const nextAffiliates = affiliates.map((item) => item.id === affiliateId ? { ...item, ...normalizedPatch } : item);
    setAffiliates(nextAffiliates);
    await saveCloudSnapshot({ affiliates: nextAffiliates });
  };

  const saveReceiptsOnline = async (nextReceipts: ReceiptCollection[]) => {
    setCloudStatus("Guardando recibos online...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) {
      setCloudStatus(`No se pudieron guardar recibos online: ${error.message}`);
      return;
    }

    const onlineSnapshot = (data?.data || {}) as Partial<CloudSnapshot>;
    const onlineReceipts = Array.isArray(onlineSnapshot.receipts) ? onlineSnapshot.receipts : [];
    const mergedReceipts = mergeRowsById(onlineReceipts, nextReceipts);
    const snapshot = {
      ...buildCloudSnapshot(),
      ...onlineSnapshot,
      receipts: mergedReceipts,
    };

    const { error: saveError } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (saveError) {
      setCloudStatus(`No se pudieron guardar recibos online: ${saveError.message}`);
      return;
    }
    setReceipts(mergedReceipts);
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Recibos guardados online ${new Date().toLocaleTimeString("es-AR")}`);
  };

  const saveTicketCollectionsOnline = async (nextTicketCollections: TicketCollection[], nextNotes: AffiliateNote[] = notes) => {
    setCloudStatus("Guardando tickets online...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) {
      setCloudStatus(`No se pudieron guardar tickets online: ${error.message}`);
      return;
    }

    const onlineSnapshot = (data?.data || {}) as Partial<CloudSnapshot>;
    const onlineTicketCollections = Array.isArray(onlineSnapshot.ticketCollections) ? onlineSnapshot.ticketCollections : [];
    const onlineNotes = Array.isArray(onlineSnapshot.notes) ? onlineSnapshot.notes : [];
    const mergedTicketCollections = mergeRowsById(onlineTicketCollections, nextTicketCollections);
    const mergedNotes = mergeRowsById(onlineNotes, nextNotes);
    const snapshot = {
      ...buildCloudSnapshot(),
      ...onlineSnapshot,
      ticketCollections: mergedTicketCollections,
      notes: mergedNotes,
    };

    const { error: saveError } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (saveError) {
      setCloudStatus(`No se pudieron guardar tickets online: ${saveError.message}`);
      return;
    }
    setTicketCollections(mergedTicketCollections);
    setNotes(mergedNotes);
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Tickets guardados online ${new Date().toLocaleTimeString("es-AR")}`);
  };

  const saveTicketReturnControlsOnline = async (nextControls: TicketReturnControl[]) => {
    setCloudStatus("Guardando control de devolucion online...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) {
      setCloudStatus(`No se pudo guardar el control online: ${error.message}`);
      return;
    }

    const onlineSnapshot = (data?.data || {}) as Partial<CloudSnapshot>;
    const onlineControls = Array.isArray(onlineSnapshot.ticketReturnControls) ? onlineSnapshot.ticketReturnControls : [];
    const mergedControls = mergeRowsById(onlineControls, nextControls);
    const snapshot = {
      ...buildCloudSnapshot(),
      ...onlineSnapshot,
      ticketReturnControls: mergedControls,
    };

    const { error: saveError } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (saveError) {
      setCloudStatus(`No se pudo guardar el control online: ${saveError.message}`);
      return;
    }
    setTicketReturnControls(mergedControls);
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Control de devolucion guardado online ${new Date().toLocaleTimeString("es-AR")}`);
  };

  const ensureLatestOnlineDataBeforeReport = async () => {
    setCloudStatus("Verificando base online antes del reporte...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) {
      setCloudStatus(`No se pudo verificar la base online: ${error.message}`);
      alert("No se pudo verificar la base online. Volve a intentar en unos segundos.");
      return false;
    }
    if (!data?.data) return true;

    const onlineUpdatedAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
    const loadedAt = lastCloudLoadedAt ? new Date(lastCloudLoadedAt).getTime() : 0;
    if (!loadedAt || (onlineUpdatedAt > 0 && onlineUpdatedAt > loadedAt + 1000)) {
      applyCloudSnapshot(data.data as Partial<CloudSnapshot>);
      setLastCloudLoadedAt(data.updated_at || new Date().toISOString());
      setCloudStatus("La base online tenia cambios. Se actualizo la pantalla; volve a descargar el reporte.");
      alert("Habia cambios online de otra PC. Actualice la pantalla con la ultima base. Volve a tocar Descargar reporte Excel.");
      return false;
    }

    setCloudStatus(`Base online verificada ${new Date().toLocaleTimeString("es-AR")}`);
    return true;
  };

  const deleteTicketCollectionOnline = async (collectionId: string, nextTicketCollections: TicketCollection[]) => {
    setCloudStatus("Eliminando ticket online...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    if (error) {
      setCloudStatus(`No se pudo eliminar el ticket online: ${error.message}`);
      return;
    }

    const onlineSnapshot = (data?.data || {}) as Partial<CloudSnapshot>;
    const onlineTicketCollections = Array.isArray(onlineSnapshot.ticketCollections) ? onlineSnapshot.ticketCollections : [];
    const mergedTicketCollections = mergeRowsById(
      onlineTicketCollections.filter((item) => item.id !== collectionId),
      nextTicketCollections.filter((item) => item.id !== collectionId),
    );
    const snapshot = {
      ...buildCloudSnapshot(),
      ...onlineSnapshot,
      ticketCollections: mergedTicketCollections,
    };

    const { error: saveError } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: snapshot, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (saveError) {
      setCloudStatus(`No se pudo eliminar el ticket online: ${saveError.message}`);
      return;
    }
    setTicketCollections(mergedTicketCollections);
    setLastCloudLoadedAt(new Date().toISOString());
    setCloudStatus(`Ticket eliminado online ${new Date().toLocaleTimeString("es-AR")}`);
  };

  const loadCloudSnapshot = async () => {
    setCloudBusy(true);
    setCloudStatus("Cargando datos online...");
    const { data, error } = await supabase
      .from("app_snapshots")
      .select("data, updated_at")
      .eq("key", cloudSnapshotKey)
      .maybeSingle();
    setCloudBusy(false);
    if (error) {
      setCloudStatus(`No se pudo cargar online: ${error.message}`);
      return;
    }
    if (!data?.data) {
      setCloudStatus("Todavia no hay datos guardados online.");
      setCloudReady(true);
      return;
    }
    applyCloudSnapshot(data.data as Partial<CloudSnapshot>);
    setLastCloudLoadedAt(data.updated_at || new Date().toISOString());
    setCloudStatus(`Datos online cargados. Ultima actualizacion: ${new Date(data.updated_at).toLocaleString("es-AR")}`);
    setCloudReady(true);
  };

  useEffect(() => {
    void loadCloudSnapshot();
  }, []);

  useEffect(() => {
    if (!cloudReady) return;
    if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => {
      void saveCloudSnapshotSilent();
    }, 1200);
    return () => {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
    };
  }, [affiliates, monthlyItems, monthlyNewPolicyIds, ticketCollections, ticketReturnControls, receipts, notes, rendition, cashMovements, cashOpeningBalances, cashTurnNotes, collectorRecords, customDependencies, collectorWhatsapp, activeMonth, cloudReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadCloudSnapshot();
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loadUserProfiles = async () => {
    if (!isAdminUser) return;
    const { data, error } = await supabase
      .from("perfiles_usuarios" as any)
      .select("*")
      .order("nombre", { ascending: true });
    if (error) {
      setUserAdminStatus(`No se pudieron cargar usuarios: ${error.message}`);
      return;
    }
    setUserProfiles((data || []) as unknown as UserAdminProfile[]);
  };

  useEffect(() => {
    void loadUserProfiles();
  }, [isAdminUser]);

  const affiliatesById = useMemo(() => new Map(affiliates.map((item) => [item.id, item])), [affiliates]);
  const collectorPickerAffiliate = collectorPickerAffiliateId ? affiliatesById.get(collectorPickerAffiliateId) || null : null;
  const canSeeAffiliateInCobranza = (affiliate: Affiliate) => {
    if (hasOfficeCollectorScope) return normalizeCollectorName(affiliate.collector || "OFICINA") === officeCollectorScope;
    if (isOfficeUser) return isAdminUser;
    return normalizeCollectorName(affiliate.collector || "OFICINA") === currentCollectorName;
  };
  const canSeeTicketCollectionInCobranza = (collection: TicketCollection) => {
    const collectionCollector = normalizeCollectorName(collection.collector || "");
    if (!isOfficeUser && collectionCollector && collectionCollector === currentCollectorName) return true;
    if (hasOfficeCollectorScope && collectionCollector === officeCollectorScope) return true;
    const affiliate = affiliatesById.get(collection.affiliateId);
    if (affiliate) return canSeeAffiliateInCobranza(affiliate);
    if (hasOfficeCollectorScope) return normalizeCollectorName(collection.collector || "") === officeCollectorScope;
    if (isOfficeUser) return isAdminUser;
    return normalizeCollectorName(collection.collector || "") === currentCollectorName;
  };
  const canSeeReceiptInCobranza = (receipt: ReceiptCollection) => {
    if (hasOfficeCollectorScope && normalizeCollectorName(receipt.collector || "") !== officeCollectorScope) return false;
    const affiliate = affiliates.find((item) => item.policyNumber === receipt.policyNumber && item.plan === receipt.plan)
      || affiliates.find((item) => item.policyNumber === receipt.policyNumber);
    if (affiliate) return canSeeAffiliateInCobranza(affiliate);
    if (isOfficeUser) return isAdminUser;
    return normalizeCollectorName(receipt.collector || "") === currentCollectorName;
  };
  const activeReceipts = useMemo(() => receipts.filter((receipt) => receipt.status !== "anulado"), [receipts]);
  const collectionReceipts = useMemo(() => activeReceipts.filter((receipt) => !receipt.isProduction), [activeReceipts]);
  const monthlyTicketsByAffiliate = useMemo(() => {
    const rows = new Map<string, number>();
    monthlyItems
      .filter((item) => item.month === activeMonth)
      .forEach((item) => rows.set(item.affiliateId, item.tickets || 0));
    return rows;
  }, [activeMonth, monthlyItems]);
  const chargedTicketsByAffiliate = useMemo(() => {
    const rows = new Map<string, number>();
    ticketCollections
      .filter((item) => item.month === activeMonth)
      .forEach((item) => rows.set(item.affiliateId, (rows.get(item.affiliateId) || 0) + item.ticketsCharged));
    return rows;
  }, [activeMonth, ticketCollections]);
  const affiliateSearchTextById = useMemo(() => {
    return new Map(affiliates.map((item) => [
      item.id,
      `${item.fullName} ${item.policyNumber} ${item.plan} ${item.dependency} ${item.collector || "OFICINA"}`.toLocaleUpperCase("es-AR"),
    ]));
  }, [affiliates]);

  const getPendingTickets = (affiliateId: string) => {
    return Math.max((monthlyTicketsByAffiliate.get(affiliateId) || 0) - (chargedTicketsByAffiliate.get(affiliateId) || 0), 0);
  };

  const filteredAffiliates = useMemo(() => {
    const normalized = query.trim().toLocaleUpperCase("es-AR");
    return affiliates
      .filter((item) => !normalized || (affiliateSearchTextById.get(item.id) || "").includes(normalized))
      .filter((item) => canSeeAffiliateInCobranza(item))
      .filter((item) => dependencyFilter === "todos" || (item.dependency || "SIN DEFINIR") === dependencyFilter)
      .filter((item) => collectorFilter === "todos" || normalizeCollectorName(item.collector || "OFICINA") === normalizeCollectorName(collectorFilter))
      .filter((item) => {
        const pending = getPendingTickets(item.id);
        if (pendingFilter === "con") return pending > 0;
        if (pendingFilter === "sin") return pending === 0;
        return true;
      })
      .sort((a, b) => {
        if (pendingFilter === "mayor" || pendingFilter === "con") return getPendingTickets(b.id) - getPendingTickets(a.id);
        return 0;
      });
  }, [affiliateSearchTextById, affiliates, chargedTicketsByAffiliate, collectorFilter, dependencyFilter, monthlyTicketsByAffiliate, pendingFilter, query]);

  const dependencies = useMemo(() => {
    return uniqueSorted([...customDependencies, ...affiliates.map((item) => item.dependency || "SIN DEFINIR")]);
  }, [affiliates, customDependencies]);
  const visibleDependenciesForCobranza = hasOfficeCollectorScope
    ? dependencies.filter((dependency) => affiliates.some((affiliate) =>
      (affiliate.dependency || "SIN DEFINIR") === dependency && canSeeAffiliateInCobranza(affiliate),
    ))
    : dependencies;

  const collectors = useMemo(() => {
    const rows = uniqueSorted([...collectorRecords.map((item) => item.name), ...affiliates.map((item) => normalizeCollectorName(item.collector || "OFICINA"))]);
    return rows.length > 0 ? rows : ["OFICINA"];
  }, [affiliates, collectorRecords]);

  const collectorPhoneByName = useMemo(() => new Map(collectorRecords.map((item) => [normalizeCollectorName(item.name), item.phone])), [collectorRecords]);
  const collectorConfigByName = useMemo(() => new Map(collectorRecords.map((item) => [normalizeCollectorName(item.name), item])), [collectorRecords]);

  const collectorRows = useMemo(() => {
    return collectors.map((collector) => {
      const normalizedCollector = normalizeCollectorName(collector);
      const assigned = affiliates.filter((item) => normalizeCollectorName(item.collector || "OFICINA") === normalizedCollector);
      const affiliateCollectorByName = new Map(affiliates.map((affiliate) => [normalizeHeader(affiliate.fullName), normalizeCollectorName(affiliate.collector || "OFICINA")]));
      const tickets = assigned.reduce((sum, affiliate) => {
        const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id);
        return sum + (monthly?.tickets || 0);
      }, 0);
      const assignedAmount = assigned.reduce((sum, affiliate) => {
        const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id);
        return sum + (monthly?.tickets || 0) * affiliate.value;
      }, 0);
      const ticketCollectionsForCollector = ticketCollections
        .filter((item) => item.month === activeMonth && normalizeCollectorName(item.collector || affiliatesById.get(item.affiliateId)?.collector || "OFICINA") === normalizedCollector);
      const assignedIds = new Set(assigned.map((affiliate) => affiliate.id));
      const ticketCollectionsForAssigned = ticketCollections
        .filter((item) => item.month === activeMonth && assignedIds.has(item.affiliateId));
      const receiptsForCollector = collectionReceipts.filter((receipt) => {
        const receiptCollector = receipt.collector ? normalizeCollectorName(receipt.collector) : affiliateCollectorByName.get(normalizeHeader(receipt.fullName));
        return receipt.collectionMonth === activeMonth && receiptCollector === normalizedCollector;
      });
      const chargedTickets = ticketCollectionsForCollector.reduce((sum, item) => sum + item.ticketsCharged, 0);
      const assignedChargedTickets = ticketCollectionsForAssigned.reduce((sum, item) => sum + item.ticketsCharged, 0);
      const ticketChargedAmount = ticketCollectionsForCollector.reduce((sum, item) => sum + (affiliatesById.get(item.affiliateId)?.value ?? item.ticketValue ?? 0) * item.ticketsCharged, 0);
      const receiptAmount = receiptsForCollector.reduce((sum, item) => sum + item.monthCount * item.monthlyAmount, 0);
      const chargedAmount = ticketChargedAmount + receiptAmount;
      const config = collectorConfigByName.get(normalizedCollector) || defaultCollectorConfig(collector);
      const effectiveness = assignedAmount > 0 ? (ticketChargedAmount / assignedAmount) * 100 : 0;
      const bonusAchieved = config.bonusEnabled && effectiveness >= config.bonusThreshold;
      const appliedCommissionRate = bonusAchieved ? config.bonusRate : config.commissionBase;
      const commissionAmount = chargedAmount * (appliedCommissionRate / 100);
      return {
        collector,
        phone: collectorPhoneByName.get(collector) || "",
        dependencies: Array.from(new Set(assigned.map((item) => item.dependency || "SIN DEFINIR"))).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true })),
        affiliates: assigned.length,
        tickets,
        assignedAmount,
        chargedTickets,
        pendingTickets: Math.max(tickets - assignedChargedTickets, 0),
        chargedAmount,
        ticketChargedAmount,
        receiptCount: new Set(receiptsForCollector.map((item) => `${item.receiptNumber}-${item.plan}`)).size,
        receiptAmount,
        commissionBase: config.commissionBase,
        bonusEnabled: config.bonusEnabled,
        bonusThreshold: config.bonusThreshold,
        bonusRate: config.bonusRate,
        effectiveness,
        bonusAchieved,
        appliedCommissionRate,
        commissionAmount,
        amountToRender: chargedAmount - commissionAmount,
      };
    });
  }, [activeMonth, affiliates, affiliatesById, collectionReceipts, collectorConfigByName, collectorPhoneByName, collectors, monthlyItems, ticketCollections]);

  const monthlyRows = useMemo(() => {
    return affiliates
      .filter((item) => item.selectedForMonthly)
      .map((affiliate) => ({
        affiliate,
        monthly: monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id) || { month: activeMonth, affiliateId: affiliate.id, tickets: 0 },
      }));
  }, [activeMonth, affiliates, monthlyItems]);

  const selectedMonthlyCandidates = useMemo(() => {
    const policy = collectionPolicy.trim();
    if (!policy) return [];
    return affiliates
      .filter((item) => item.policyNumber === policy);
  }, [affiliates, collectionPolicy]);

  const selectedMonthlyAffiliate = useMemo(() => {
    if (mobileSelectedAffiliateId) {
      return selectedMonthlyCandidates.find((item) => item.id === mobileSelectedAffiliateId) || null;
    }
    return selectedMonthlyCandidates
      .slice()
      .sort((a, b) => getPendingTickets(b.id) - getPendingTickets(a.id) || a.fullName.localeCompare(b.fullName, "es-AR"))[0] || null;
  }, [getPendingTickets, mobileSelectedAffiliateId, selectedMonthlyCandidates]);

  const selectedMonthlyItem = selectedMonthlyAffiliate ? monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === selectedMonthlyAffiliate.id) : null;
  const alreadyChargedTickets = selectedMonthlyAffiliate
    ? ticketCollections
      .filter((item) => item.month === activeMonth && item.affiliateId === selectedMonthlyAffiliate.id && item.id !== editingTicketCollectionId)
      .reduce((sum, item) => sum + item.ticketsCharged, 0)
    : 0;
  const ticketsToCharge = Math.max((selectedMonthlyItem?.tickets || 0) - alreadyChargedTickets, 0);
  const hasUnansweredRequest = !!selectedMonthlyAffiliate?.request?.trim() && !selectedMonthlyAffiliate?.latestNews?.trim();
  const activeCobranzaCollectorName = normalizeCollectorName(
    hasOfficeCollectorScope
      ? officeCollectorScope
      : !isAdminUser && currentCollectorName
      ? currentCollectorName
      : selectedMonthlyAffiliate?.collector || "OFICINA"
  );
  const selectedAffiliateAssignedCollector = normalizeCollectorName(selectedMonthlyAffiliate?.collector || "OFICINA");
  const selectedAffiliateIsFromOtherCollector = !!selectedMonthlyAffiliate
    && !isAdminUser
    && !!activeCobranzaCollectorName
    && selectedAffiliateAssignedCollector !== activeCobranzaCollectorName;
  const otherCollectorWarningText = selectedAffiliateIsFromOtherCollector
    ? `Ticket correspondiente a la cobranza de ${selectedAffiliateAssignedCollector}.`
    : "";
  const mobileCollectorRows = useMemo(() => {
    const normalized = mobileSearch.trim().toLocaleUpperCase("es-AR");
    return monthlyRows
      .map(({ affiliate, monthly }) => ({
        affiliate,
        monthly,
        pending: getPendingTickets(affiliate.id),
      }))
      .filter((row) => mobileTicketFilter === "all" || (mobileTicketFilter === "pending" ? row.pending > 0 : row.pending === 0 && (row.monthly.tickets || 0) > 0))
      .filter((row) => canSeeAllCobranza
        ? mobileCollector === "todos" || normalizeCollectorName(row.affiliate.collector || "OFICINA") === normalizeCollectorName(mobileCollector)
        : canSeeAffiliateInCobranza(row.affiliate))
      .filter((row) => !normalized || `${row.affiliate.fullName} ${row.affiliate.policyNumber} ${row.affiliate.plan} ${row.affiliate.dependency}`.toLocaleUpperCase("es-AR").includes(normalized))
      .sort((a, b) => a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR") || b.pending - a.pending);
  }, [canSeeAllCobranza, mobileCollector, mobileSearch, mobileTicketFilter, monthlyRows]);

  const mobileSelectedAffiliate = useMemo(() => {
    return affiliates.find((item) => item.id === mobileSelectedAffiliateId) || selectedMonthlyAffiliate || null;
  }, [affiliates, mobileSelectedAffiliateId, selectedMonthlyAffiliate]);

  const visibleCollectorsForCobranza = useMemo(() => {
    if (canSeeAllCobranza) return collectors;
    const visibleNames = collectors.filter((collector) => {
      const normalizedCollector = normalizeCollectorName(collector);
      return affiliates.some((affiliate) =>
        normalizeCollectorName(affiliate.collector || "OFICINA") === normalizedCollector
        && canSeeAffiliateInCobranza(affiliate)
      );
    });
    return visibleNames.length ? visibleNames : [currentCollectorName].filter(Boolean);
  }, [affiliates, canSeeAllCobranza, collectors, currentCollectorName]);

  const selectedCollectorName = !isOfficeUser && currentCollectorName
    ? currentCollectorName
    : collectorDetailName && visibleCollectorsForCobranza.includes(collectorDetailName)
    ? collectorDetailName
      : mobileCollector !== "todos" && visibleCollectorsForCobranza.includes(mobileCollector)
      ? mobileCollector
      : visibleCollectorsForCobranza[0] || "";
  const canControlTicketReturns = isCollectorUser && !isAdminUser && normalizeCollectorName(selectedCollectorName || "") === currentCollectorName;
  const selectedCollectorSummary = collectorRows.find((row) => row.collector === selectedCollectorName) || null;
  const visibleCollectorRows = collectorRows.filter((row) => visibleCollectorsForCobranza.includes(row.collector));
  const selectedCollectorPortfolio = useMemo(() => {
    if (!selectedCollectorName) return [];
    const normalizedCollector = normalizeCollectorName(selectedCollectorName);
    return affiliates
      .filter((affiliate) => normalizeCollectorName(affiliate.collector || "OFICINA") === normalizedCollector && canSeeAffiliateInCobranza(affiliate))
      .map((affiliate) => {
        const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id);
        const chargedTickets = ticketCollections
          .filter((item) => item.month === activeMonth && item.affiliateId === affiliate.id)
          .reduce((sum, item) => sum + item.ticketsCharged, 0);
        const tickets = monthly?.tickets || 0;
        return {
          affiliate,
          tickets,
          chargedTickets,
          pendingTickets: Math.max(tickets - chargedTickets, 0),
          chargedAmount: chargedTickets * affiliate.value,
          pendingAmount: Math.max(tickets - chargedTickets, 0) * affiliate.value,
        };
      })
      .sort((a, b) => b.pendingTickets - a.pendingTickets || a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR"));
  }, [activeMonth, affiliates, monthlyItems, selectedCollectorName, ticketCollections]);

  const selectedCollectorStats = useMemo(() => {
    const affiliateIds = new Set(selectedCollectorPortfolio.map((row) => row.affiliate.id));
    const collections = ticketCollections.filter((item) => {
      if (item.month !== activeMonth) return false;
      const collectionCollector = normalizeCollectorName(item.collector || "");
      if (collectionCollector) return collectionCollector === normalizeCollectorName(selectedCollectorName || "OFICINA");
      return affiliateIds.has(item.affiliateId);
    });
    const cashCollections = collections.filter((item) => item.paymentMethod === "E");
    const transferCollections = collections.filter((item) => item.paymentMethod === "T");
    const amountFor = (collection: TicketCollection) => (affiliatesById.get(collection.affiliateId)?.value ?? collection.ticketValue ?? 0) * collection.ticketsCharged;
    const normalizedCollector = normalizeCollectorName(selectedCollectorName || "OFICINA");
    const affiliateCollectorByName = new Map(affiliates.map((affiliate) => [normalizeHeader(affiliate.fullName), normalizeCollectorName(affiliate.collector || "OFICINA")]));
    const receiptsForCollector = collectionReceipts.filter((receipt) => {
      const receiptCollector = receipt.collector ? normalizeCollectorName(receipt.collector) : affiliateCollectorByName.get(normalizeHeader(receipt.fullName));
      return receipt.collectionMonth === activeMonth && receiptCollector === normalizedCollector;
    });
    const receiptAmount = (receipt: ReceiptCollection) => receipt.monthCount * receipt.monthlyAmount;
    const receiptCash = receiptsForCollector.filter((receipt) => receipt.paymentMethod === "E");
    const receiptTransfer = receiptsForCollector.filter((receipt) => receipt.paymentMethod === "T");
    const notesForCollector = notes
      .filter((item) => item.month === activeMonth && affiliateIds.has(item.affiliateId))
      .sort((a, b) => b.date.localeCompare(a.date));
    const ticketCashAmount = cashCollections.reduce((sum, item) => sum + amountFor(item), 0);
    const ticketTransferAmount = transferCollections.reduce((sum, item) => sum + amountFor(item), 0);
    const receiptCashAmount = receiptCash.reduce((sum, item) => sum + receiptAmount(item), 0);
    const receiptTransferAmount = receiptTransfer.reduce((sum, item) => sum + receiptAmount(item), 0);
    const reportCashAmount = ticketCashAmount + receiptCashAmount;
    const reportTransferAmount = ticketTransferAmount + receiptTransferAmount;
    const reportTotalAmount = reportCashAmount + reportTransferAmount;
    const reportCommissionAmount = reportTotalAmount * ((selectedCollectorSummary?.appliedCommissionRate || 0) / 100);
    return {
      cashTickets: cashCollections.reduce((sum, item) => sum + item.ticketsCharged, 0),
      cashAmount: ticketCashAmount,
      transferTickets: transferCollections.reduce((sum, item) => sum + item.ticketsCharged, 0),
      transferAmount: ticketTransferAmount,
      receiptCount: new Set(receiptsForCollector.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size,
      receiptAmount: receiptsForCollector.reduce((sum, item) => sum + receiptAmount(item), 0),
      receiptCashCount: new Set(receiptCash.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size,
      receiptCashAmount,
      receiptTransferCount: new Set(receiptTransfer.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size,
      receiptTransferAmount,
      totalCashAmount: reportCashAmount,
      totalTransferAmount: reportTransferAmount,
      totalCollectionAmount: reportTotalAmount,
      reportCommissionAmount,
      reportRenditionAmount: reportTotalAmount - reportCommissionAmount,
      pendingAmount: selectedCollectorPortfolio.reduce((sum, item) => sum + item.pendingAmount, 0),
      returnedRows: selectedCollectorPortfolio.filter((item) => item.pendingTickets > 0),
      requestCount: selectedCollectorPortfolio.filter((item) => item.affiliate.request.trim()).length,
      unansweredRequestCount: selectedCollectorPortfolio.filter((item) => item.affiliate.request.trim() && !item.affiliate.latestNews.trim()).length,
      answeredRequestCount: selectedCollectorPortfolio.filter((item) => item.affiliate.request.trim() && item.affiliate.latestNews.trim()).length,
      newsCount: notesForCollector.length,
      latestNotes: notesForCollector.slice(0, 6),
    };
  }, [activeMonth, affiliates, affiliatesById, collectionReceipts, notes, selectedCollectorName, selectedCollectorPortfolio, selectedCollectorSummary?.appliedCommissionRate, ticketCollections]);

  const selectedCollectorReturnControls = useMemo(() => {
    const normalizedCollector = normalizeCollectorName(selectedCollectorName || "OFICINA");
    return new Map(
      ticketReturnControls
        .filter((item) => item.month === activeMonth && normalizeCollectorName(item.collector || "OFICINA") === normalizedCollector)
        .map((item) => [item.affiliateId, item]),
    );
  }, [activeMonth, selectedCollectorName, ticketReturnControls]);

  const selectedCollectorReturnRows = useMemo(() => {
    return selectedCollectorStats.returnedRows.map((row) => {
      const control = selectedCollectorReturnControls.get(row.affiliate.id);
      return {
        ...row,
        control,
        hasPhysicalTickets: !!control?.hasPhysicalTickets,
        observation: control?.observation || "",
      };
    });
  }, [selectedCollectorReturnControls, selectedCollectorStats.returnedRows]);

  const updateTicketReturnControl = async (affiliateId: string, patch: Partial<Pick<TicketReturnControl, "hasPhysicalTickets" | "observation">>) => {
    if (!selectedCollectorName) return;
    const normalizedCollector = normalizeCollectorName(selectedCollectorName);
    const existing = ticketReturnControls.find((item) =>
      item.month === activeMonth
      && item.affiliateId === affiliateId
      && normalizeCollectorName(item.collector || "OFICINA") === normalizedCollector,
    );
    const nextControl: TicketReturnControl = {
      id: existing?.id || `return-${activeMonth}-${affiliateId}-${normalizedCollector.replace(/[^A-Z0-9]+/g, "-")}`,
      month: activeMonth,
      affiliateId,
      collector: normalizedCollector,
      hasPhysicalTickets: patch.hasPhysicalTickets ?? existing?.hasPhysicalTickets ?? false,
      observation: patch.observation !== undefined ? patch.observation.toLocaleUpperCase("es-AR") : existing?.observation || "",
      updatedAt: new Date().toISOString(),
    };
    const nextControls = existing
      ? ticketReturnControls.map((item) => item.id === existing.id ? nextControl : item)
      : [...ticketReturnControls, nextControl];
    setTicketReturnControls(nextControls);
    await saveTicketReturnControlsOnline(nextControls);
  };

  const openMobileCollection = (affiliate: Affiliate) => {
    setMobileSelectedAffiliateId(affiliate.id);
    setCollectionPolicy(affiliate.policyNumber);
    setCollectionTickets(String(Math.max(0, getPendingTickets(affiliate.id))));
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
    setActiveSection("Cobranza");
  };

  const saveMobileNote = () => {
    const affiliate = mobileSelectedAffiliate;
    if (!affiliate || !mobileNoteText.trim()) return;
    setNotes((current) => [
      {
        id: `note-${Date.now()}`,
        affiliateId: affiliate.id,
        month: activeMonth,
        date: new Date().toISOString(),
        text: mobileNoteText.trim(),
      },
      ...current,
    ]);
    setMobileNoteText("");
  };

  const getWhatsappUrl = (affiliate: Affiliate) => {
    const phone = (collectorPhoneByName.get(normalizeCollectorName(affiliate.collector || "OFICINA")) || collectorWhatsapp).replace(/\D/g, "");
    const pending = getPendingTickets(affiliate.id);
    const message = [
      `Hola, por favor concentrarse en cobrar a ${affiliate.fullName}.`,
      `Póliza: ${affiliate.policyNumber || "-"}.`,
      `Plan: ${affiliate.plan}.`,
      `Dependencia: ${affiliate.dependency || "001"}.`,
      `Tickets pendientes: ${pending}.`,
    ].join(" ");
    return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : "";
  };

  const availablePlans = useMemo(() => {
    const collected = new Set([...plans, ...affiliates.map((item) => item.plan), ...receipts.map((item) => item.plan)]);
    return Array.from(collected).filter(Boolean).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
  }, [affiliates, receipts]);

  const findReceiptAffiliate = (policyNumber: string, plan?: PlanType) => {
    const policy = policyNumber.trim();
    if (!policy) return null;
    const candidates = affiliates
      .filter((affiliate) => affiliate.policyNumber === policy)
      .filter((affiliate) => canSeeAffiliateInCobranza(affiliate))
      .sort((a, b) => Number(b.selectedForMonthly) - Number(a.selectedForMonthly)
        || (b.sourceTickets || 0) - (a.sourceTickets || 0)
        || a.fullName.localeCompare(b.fullName, "es-AR"));
    return candidates.find((affiliate) => affiliate.plan === plan) || candidates[0] || null;
  };

  const receiptPolicyCandidates = useMemo(() => {
    const policy = receiptForm.policyNumber.trim();
    if (!policy) return [];
    return affiliates
      .filter((affiliate) => affiliate.policyNumber === policy)
      .filter((affiliate) => canSeeAffiliateInCobranza(affiliate))
      .sort((a, b) => a.plan.localeCompare(b.plan, "es-AR", { numeric: true }));
  }, [affiliates, receiptForm.policyNumber]);

  const receiptPlanOptions = useMemo(() => {
    const policyPlans = uniqueSorted(receiptPolicyCandidates.map((affiliate) => affiliate.plan));
    return policyPlans.length ? policyPlans : availablePlans;
  }, [availablePlans, receiptPolicyCandidates]);

  const selectedReceiptAffiliate = useMemo(() => {
    return receiptPolicyCandidates.find((affiliate) => affiliate.plan === receiptForm.plan) || receiptPolicyCandidates[0] || null;
  }, [receiptForm.plan, receiptPolicyCandidates]);

  const receiptMonthOptions = useMemo(() => {
    const year = Number(activeMonth.split("-")[0]) || new Date().getFullYear();
    return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`);
  }, [activeMonth]);

  const totalsByPlan = useMemo(() => {
    return availablePlans.map((plan) => {
      const monthlyForPlan = monthlyRows.filter(({ affiliate }) => affiliate.plan === plan && canSeeAffiliateInCobranza(affiliate));
      const collectionsForPlan = ticketCollections.filter((item) => item.month === activeMonth && (affiliatesById.get(item.affiliateId)?.plan || item.plan) === plan && canSeeTicketCollectionInCobranza(item));
      const receiptsForPlan = collectionReceipts.filter((item) => item.collectionMonth === activeMonth && item.plan === plan && canSeeReceiptInCobranza(item));
      const ticketValue = (collection: TicketCollection) => {
        const affiliate = affiliatesById.get(collection.affiliateId);
        return (affiliate?.value ?? collection.ticketValue ?? 0) * collection.ticketsCharged;
      };
      const receiptValue = (receipt: ReceiptCollection) => receipt.monthCount * receipt.monthlyAmount;
      const ticketCash = collectionsForPlan.filter((item) => item.paymentMethod === "E");
      const ticketTransfer = collectionsForPlan.filter((item) => item.paymentMethod === "T");
      const receiptCash = receiptsForPlan.filter((item) => item.paymentMethod === "E");
      const receiptTransfer = receiptsForPlan.filter((item) => item.paymentMethod === "T");
      const ticketsReceived = monthlyForPlan.reduce((sum, row) => sum + row.monthly.tickets, 0);
      const ticketsCharged = collectionsForPlan.reduce((sum, item) => sum + item.ticketsCharged, 0);
      return {
        plan,
        ticketsReceived,
        ticketsCharged,
        ticketCashCount: ticketCash.reduce((sum, item) => sum + item.ticketsCharged, 0),
        ticketCashAmount: ticketCash.reduce((sum, item) => sum + ticketValue(item), 0),
        ticketTransferCount: ticketTransfer.reduce((sum, item) => sum + item.ticketsCharged, 0),
        ticketTransferAmount: ticketTransfer.reduce((sum, item) => sum + ticketValue(item), 0),
        ticketsNotCharged: Math.max(ticketsReceived - ticketsCharged, 0),
        receiptCount: new Set(receiptsForPlan.map((item) => `${item.receiptNumber}-${item.plan}`)).size,
        receiptCashCount: new Set(receiptCash.map((item) => `${item.receiptNumber}-${item.plan}`)).size,
        receiptCashAmount: receiptCash.reduce((sum, item) => sum + receiptValue(item), 0),
        receiptTransferCount: new Set(receiptTransfer.map((item) => `${item.receiptNumber}-${item.plan}`)).size,
        receiptTransferAmount: receiptTransfer.reduce((sum, item) => sum + receiptValue(item), 0),
      };
    });
  }, [activeMonth, affiliatesById, availablePlans, collectionReceipts, monthlyRows, ticketCollections]);

  const totalCashCollected = totalsByPlan.reduce((sum, item) => sum + item.ticketCashAmount + item.receiptCashAmount, 0);
  const totalTransferCollected = totalsByPlan.reduce((sum, item) => sum + item.ticketTransferAmount + item.receiptTransferAmount, 0);
  const totalCollected = totalCashCollected + totalTransferCollected;
  const commission = collectorRows.reduce((sum, item) => sum + item.commissionAmount, 0);
  const totalToRender = totalCollected - commission;
  const totalTransferRendered = rendition.transferRenders.reduce((sum, item) => sum + item.amount, 0);
  const totalCashRendered = rendition.cashRenders.reduce((sum, item) => sum + item.amount, 0);
  const totalRendered = totalCashRendered + totalTransferRendered;
  const bonusCollectorRows = collectorRows.filter((item) => item.bonusAchieved);
  const visibleAffiliateIds = new Set(
    affiliates.filter((item) => canSeeAffiliateInCobranza(item)).map((item) => item.id),
  );
  const monthlyNewPolicyRows = useMemo(() => {
    const ids = monthlyNewPolicyIds[activeMonth] || [];
    return ids
      .map((id) => affiliatesById.get(id))
      .filter((item): item is Affiliate => Boolean(item) && visibleAffiliateIds.has(item.id))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es-AR", { numeric: true }));
  }, [activeMonth, affiliatesById, monthlyNewPolicyIds, visibleAffiliateIds]);
  const visibleAffiliatesCount = visibleAffiliateIds.size;
  const visibleSelectedCount = affiliates.filter((item) => visibleAffiliateIds.has(item.id) && item.selectedForMonthly).length;
  const visibleMonthlyTickets = monthlyItems
    .filter((item) => item.month === activeMonth && visibleAffiliateIds.has(item.affiliateId))
    .reduce((sum, item) => sum + item.tickets, 0);
  const visibleNotes = notes.filter((item) => item.month === activeMonth && visibleAffiliateIds.has(item.affiliateId));
  const visibleNotesCount = visibleNotes.length;
  const visibleTicketCollections = ticketCollections.filter((item) => {
    if (item.month !== activeMonth) return false;
    return canSeeTicketCollectionInCobranza(item);
  });
  const visibleReceipts = receipts.filter((item) => {
    if (item.collectionMonth !== activeMonth) return false;
    return canSeeReceiptInCobranza(item);
  });
  const visibleCollectionAmount = visibleTicketCollections.reduce((sum, item) => {
    const affiliate = affiliatesById.get(item.affiliateId);
    return sum + (affiliate?.value ?? item.ticketValue ?? 0) * item.ticketsCharged;
  }, 0) + visibleReceipts
    .filter((item) => item.status !== "anulado" && !item.isProduction)
    .reduce((sum, item) => sum + item.monthCount * item.monthlyAmount, 0);
  const visibleCommissionAmount = hasOfficeCollectorScope
    ? visibleCollectorRows.reduce((sum, item) => sum + item.commissionAmount, 0)
    : commission;
  const newsAffiliateOptions = useMemo(() => {
    const normalized = newsAffiliateQuery.trim().toLocaleUpperCase("es-AR");
    return affiliates
      .filter((affiliate) => visibleAffiliateIds.has(affiliate.id))
      .filter((affiliate) => !normalized || `${affiliate.fullName} ${affiliate.policyNumber} ${affiliate.plan} ${affiliate.dependency || ""}`.toLocaleUpperCase("es-AR").includes(normalized))
      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es-AR"))
      .slice(0, 80);
  }, [affiliates, newsAffiliateQuery, visibleAffiliateIds]);
  const visibleTotalToRender = canSeeAllCobranza
    ? totalToRender
    : hasOfficeCollectorScope
      ? visibleCollectionAmount - visibleCommissionAmount
      : selectedCollectorStats.reportRenditionAmount;
  const visibleTotalLabel = isOfficeUser ? "Cobrado menos comision" : "Tu cobranza menos comision";
  const requestRows = useMemo(() => {
    return affiliates
      .filter((affiliate) => affiliate.request.trim())
      .filter((affiliate) => canSeeAffiliateInCobranza(affiliate))
      .map((affiliate) => ({
        affiliate,
        pendingTickets: getPendingTickets(affiliate.id),
        answered: !!affiliate.latestNews.trim(),
      }))
      .sort((a, b) => {
        if (a.answered !== b.answered) return a.answered ? 1 : -1;
        return b.pendingTickets - a.pendingTickets || a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR");
      });
  }, [activeMonth, affiliates, currentCollectorName, isOfficeUser, monthlyItems, ticketCollections]);

  const cashOfficeOptions = useMemo(() => {
    if (!isAdminUser) return assignedOfficeOptions;
    return uniqueSorted([
      ...officeNames,
      ...cashMovements.map((item) => item.office).filter(Boolean),
      ...cashOpeningBalances.map((item) => item.office).filter(Boolean),
      ...cashTurnNotes.map((item) => item.office).filter(Boolean),
    ]);
  }, [assignedOfficeOptions, cashMovements, cashOpeningBalances, cashTurnNotes, isAdminUser]);

  const visibleCashMovements = useMemo(() => {
    return cashMovements
      .filter((item) => item.month === activeMonth)
      .filter((item) => isAdminUser ? cashOfficeFilter === "todos" || item.office === cashOfficeFilter : item.office === activeOffice)
      .filter((item) => cashTypeFilter === "todos" || item.type === cashTypeFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [activeMonth, activeOffice, cashMovements, cashOfficeFilter, cashTypeFilter, isAdminUser]);

  const visibleCashOpeningBalances = useMemo(() => {
    return cashOpeningBalances
      .filter((item) => item.month === activeMonth)
      .filter((item) => isAdminUser ? cashOfficeFilter === "todos" || item.office === cashOfficeFilter : item.office === activeOffice);
  }, [activeMonth, activeOffice, cashOpeningBalances, cashOfficeFilter, isAdminUser]);

  const visibleCashTurnNotes = useMemo(() => {
    return cashTurnNotes
      .filter((item) => item.month === activeMonth)
      .filter((item) => isAdminUser ? cashOfficeFilter === "todos" || item.office === cashOfficeFilter : item.office === activeOffice)
      .sort((a, b) => `${b.date}-${b.createdAt}`.localeCompare(`${a.date}-${a.createdAt}`, "es-AR"));
  }, [activeMonth, activeOffice, cashOfficeFilter, cashTurnNotes, isAdminUser]);

  const cashTotals = useMemo(() => {
    const totals = {
      opening: 0,
      income: 0,
      expense: 0,
      balance: 0,
      cash: 0,
      card: 0,
      transfer: 0,
      other: 0,
    };
    visibleCashOpeningBalances.forEach((item) => {
      totals.opening += item.amount;
      totals.balance += item.amount;
      totals.cash += item.amount;
    });
    visibleCashMovements.forEach((item) => {
      const signed = item.type === "ingreso" ? item.amount : -item.amount;
      if (item.type === "ingreso") totals.income += item.amount;
      else totals.expense += item.amount;
      totals.balance += signed;
      if (item.paymentMethod === "EFECTIVO") totals.cash += signed;
      if (item.paymentMethod === "TARJETA") totals.card += signed;
      if (item.paymentMethod === "TRANSFERENCIA") totals.transfer += signed;
      if (item.paymentMethod === "OTRO") totals.other += signed;
    });
    return totals;
  }, [visibleCashMovements, visibleCashOpeningBalances]);

  const saveCashOpeningBalance = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseMoney(cashOpeningForm.amount);
    const office = isAdminUser ? cashOpeningForm.office.trim().toLocaleUpperCase("es-AR") || "SIN OFICINA" : activeOffice;
    if (!isAdminUser && !office) return;
    if (!cashOpeningForm.date || amount < 0) return;
    const month = cashOpeningForm.date.slice(0, 7);
    const alreadyExists = cashOpeningBalances.some((item) => item.month === month && item.office === office);
    if (alreadyExists) {
      setCloudStatus(`La caja de ${office} ya tiene saldo inicial cargado para ${month}.`);
      return;
    }
    const opening: CashOpeningBalance = {
      id: `cash-opening-${Date.now()}`,
      date: cashOpeningForm.date,
      month,
      office,
      user: (currentUserProfile?.nombre || userEmail || "USUARIO").toLocaleUpperCase("es-AR"),
      amount,
      notes: cashOpeningForm.notes.trim().toLocaleUpperCase("es-AR"),
    };
    setCashOpeningBalances((current) => [opening, ...current]);
    setCashOpeningForm((current) => ({ ...emptyCashOpeningForm(), date: defaultCashDateForActiveMonth(), office: current.office }));
  };

  const saveCashMovement = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseMoney(cashMovementForm.amount);
    const office = isAdminUser ? cashMovementForm.office.trim().toLocaleUpperCase("es-AR") || "SIN OFICINA" : activeOffice;
    if (!isAdminUser && !office) return;
    if (!cashMovementForm.date || amount <= 0) return;
    const movement: CashMovement = {
      id: `cash-${Date.now()}`,
      date: cashMovementForm.date,
      month: cashMovementForm.date.slice(0, 7),
      office,
      shift: cashMovementForm.shift.trim().toLocaleUpperCase("es-AR"),
      user: (currentUserProfile?.nombre || userEmail || "USUARIO").toLocaleUpperCase("es-AR"),
      type: cashMovementForm.type,
      source: cashMovementForm.source,
      paymentMethod: cashMovementForm.paymentMethod,
      receiptType: cashMovementForm.receiptType.trim().toLocaleUpperCase("es-AR"),
      receiptNumber: cashMovementForm.receiptNumber.trim().toLocaleUpperCase("es-AR"),
      concept: cashMovementForm.concept.trim().toLocaleUpperCase("es-AR"),
      amount,
      notes: cashMovementForm.notes.trim().toLocaleUpperCase("es-AR"),
    };
    setCashMovements((current) => [movement, ...current]);
    setCashMovementForm((current) => ({ ...emptyCashMovementForm(), date: defaultCashDateForActiveMonth(), office, shift: current.shift }));
  };

  const deleteCashMovement = (id: string) => {
    if (!window.confirm("Eliminar este movimiento de caja?")) return;
    setCashMovements((current) => current.filter((item) => item.id !== id));
  };

  const saveCashTurnNote = (event: FormEvent) => {
    event.preventDefault();
    const office = isAdminUser ? cashTurnNoteForm.office.trim().toLocaleUpperCase("es-AR") || "SIN OFICINA" : activeOffice;
    const text = cashTurnNoteForm.text.trim().toLocaleUpperCase("es-AR");
    if (!isAdminUser && !office) return;
    if (!cashTurnNoteForm.date || !text) return;
    const note: CashTurnNote = {
      id: `cash-turn-note-${Date.now()}`,
      date: cashTurnNoteForm.date,
      month: cashTurnNoteForm.date.slice(0, 7),
      office,
      shift: cashTurnNoteForm.shift.trim().toLocaleUpperCase("es-AR"),
      user: (currentUserProfile?.nombre || userEmail || "USUARIO").toLocaleUpperCase("es-AR"),
      entryType: cashTurnNoteForm.entryType || "NOVEDAD",
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    setCashTurnNotes((current) => [note, ...current]);
    setCashTurnNoteForm((current) => ({ ...emptyCashTurnNoteForm(), date: defaultCashDateForActiveMonth(), office, shift: current.shift }));
  };

  const deleteCashTurnNote = (id: string) => {
    if (!window.confirm("Eliminar esta novedad del turno?")) return;
    setCashTurnNotes((current) => current.filter((item) => item.id !== id));
  };

  const toggleCashTurnTask = (id: string) => {
    setCashTurnNotes((current) => current.map((item) => {
      if (item.id !== id) return item;
      const completed = !item.completed;
      return { ...item, completed, completedAt: completed ? new Date().toISOString() : undefined };
    }));
  };

  const cashOpeningFormOffice = isAdminUser ? cashOpeningForm.office.trim().toLocaleUpperCase("es-AR") || "SIN OFICINA" : activeOffice;
  const cashOpeningAlreadyExists = cashOpeningBalances.some((item) => item.month === cashOpeningForm.date.slice(0, 7) && item.office === cashOpeningFormOffice);

  const printCashTurnReport = () => {
    const reportOffice = isAdminUser ? cashOfficeFilter : activeOffice;
    const normalizedShift = cashReportShift.trim().toLocaleUpperCase("es-AR");
    const officeLabel = reportOffice === "todos" ? "TODAS LAS OFICINAS" : reportOffice || "SIN OFICINA";
    const movementRows = cashMovements
      .filter((item) => item.date === cashReportDate)
      .filter((item) => reportOffice === "todos" || item.office === reportOffice)
      .filter((item) => !normalizedShift || item.shift === normalizedShift)
      .sort((a, b) => `${a.office}-${a.shift}-${a.id}`.localeCompare(`${b.office}-${b.shift}-${b.id}`, "es-AR"));
    const openingRows = cashOpeningBalances
      .filter((item) => item.month === activeMonth)
      .filter((item) => reportOffice === "todos" || item.office === reportOffice);
    const turnNoteRows = cashTurnNotes
      .filter((item) => item.date === cashReportDate)
      .filter((item) => reportOffice === "todos" || item.office === reportOffice)
      .filter((item) => !normalizedShift || item.shift === normalizedShift)
      .sort((a, b) => `${a.office}-${a.shift}-${a.createdAt}`.localeCompare(`${b.office}-${b.shift}-${b.createdAt}`, "es-AR"));
    const totals = movementRows.reduce((acc, item) => {
      const signed = item.type === "ingreso" ? item.amount : -item.amount;
      if (item.type === "ingreso") acc.income += item.amount;
      else acc.expense += item.amount;
      acc.balance += signed;
      if (item.paymentMethod === "EFECTIVO") acc.cash += signed;
      if (item.paymentMethod === "TARJETA") acc.card += signed;
      if (item.paymentMethod === "TRANSFERENCIA") acc.transfer += signed;
      if (item.paymentMethod === "OTRO") acc.other += signed;
      return acc;
    }, { income: 0, expense: 0, balance: 0, cash: 0, card: 0, transfer: 0, other: 0 });
    const openingTotal = openingRows.reduce((sum, item) => sum + item.amount, 0);
    const officeCollectors = reportOffice === "todos"
      ? officeNames.map(collectorForOffice).filter(Boolean)
      : [collectorForOffice(reportOffice)].filter(Boolean);
    const officeCollectorSet = new Set(officeCollectors.map(normalizeCollectorName));
    const affiliateByIdForReport = new Map(affiliates.map((item) => [item.id, item]));
    const planStats = new Map<string, { received: number; charged: number; pending: number; chargedAmount: number; pendingAmount: number }>();
    monthlyItems
      .filter((item) => item.month === activeMonth)
      .forEach((monthly) => {
        const affiliate = affiliateByIdForReport.get(monthly.affiliateId);
        if (!affiliate) return;
        const affiliateCollector = normalizeCollectorName(affiliate.collector || "OFICINA");
        if (officeCollectorSet.size && !officeCollectorSet.has(affiliateCollector)) return;
        const charged = ticketCollections
          .filter((collection) => collection.month === activeMonth && collection.affiliateId === affiliate.id)
          .reduce((sum, collection) => sum + collection.ticketsCharged, 0);
        const received = Math.max(0, monthly.tickets || 0);
        const pending = Math.max(received - charged, 0);
        const current = planStats.get(affiliate.plan) || { received: 0, charged: 0, pending: 0, chargedAmount: 0, pendingAmount: 0 };
        current.received += received;
        current.charged += charged;
        current.pending += pending;
        current.chargedAmount += charged * affiliate.value;
        current.pendingAmount += pending * affiliate.value;
        planStats.set(affiliate.plan, current);
      });
    const planRows = Array.from(planStats.entries()).sort((a, b) => a[0].localeCompare(b[0], "es-AR", { numeric: true }));
    const generatedAt = new Date().toLocaleString("es-AR");
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      alert("No se pudo abrir el reporte. Revisá si el navegador bloqueó la ventana emergente.");
      return;
    }
    const movementHtml = movementRows.length
      ? movementRows.map((item) => `
        <tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(item.office)}</td>
          <td>${escapeHtml(item.shift || "-")}</td>
          <td>${item.type === "ingreso" ? "INGRESO" : "EGRESO"}</td>
          <td>${escapeHtml(item.source)}</td>
          <td>${escapeHtml(item.paymentMethod)}</td>
          <td>${escapeHtml([item.receiptType, item.receiptNumber].filter(Boolean).join(" ") || "-")}</td>
          <td>${escapeHtml(item.concept || "-")}${item.notes ? `<br><small>${escapeHtml(item.notes)}</small>` : ""}</td>
          <td class="right">${currency.format(item.amount)}</td>
          <td>${escapeHtml(item.user)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="10" class="empty">SIN MOVIMIENTOS PARA EL TURNO SELECCIONADO</td></tr>`;
    const planHtml = planRows.length
      ? planRows.map(([plan, stats]) => `
        <tr>
          <td>${escapeHtml(plan)}</td>
          <td class="right">${stats.received}</td>
          <td class="right">${stats.charged}</td>
          <td class="right">${stats.pending}</td>
          <td class="right">${currency.format(stats.chargedAmount)}</td>
          <td class="right">${currency.format(stats.pendingAmount)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="6" class="empty">SIN TICKETS ASOCIADOS A ESTA OFICINA</td></tr>`;
    const turnNotesHtml = turnNoteRows.length
      ? turnNoteRows.map((item) => `
        <tr>
          <td>${escapeHtml(item.date)}</td>
          <td>${escapeHtml(item.office)}</td>
          <td>${escapeHtml(item.shift || "-")}</td>
          <td>${escapeHtml(item.entryType || "NOVEDAD")}</td>
          <td>${item.entryType === "TAREA" ? (item.completed ? "REALIZADA" : "PENDIENTE") : "-"}</td>
          <td>${escapeHtml(item.user)}</td>
          <td class="${item.entryType === "TAREA" && item.completed ? "done" : ""}">${escapeHtml(item.text)}</td>
        </tr>
      `).join("")
      : `<tr><td colspan="7" class="empty">SIN NOVEDADES DEL TURNO</td></tr>`;
    reportWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Reporte de turno - ${escapeHtml(officeLabel)}</title>
          <style>
            * { box-sizing: border-box; }
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
            h1 { font-size: 20px; margin: 0 0 4px; }
            h2 { font-size: 15px; margin: 22px 0 8px; }
            p { margin: 2px 0; }
            .header { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0b5cad; padding-bottom: 12px; }
            .meta { text-align: right; font-size: 12px; }
            .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 16px 0; }
            .box { border: 1px solid #cbd5e1; padding: 8px; min-height: 54px; }
            .label { color: #475569; font-size: 11px; text-transform: uppercase; }
            .value { font-size: 16px; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #0b5cad; color: #fff; text-align: left; padding: 7px; }
            td { border: 1px solid #d8e1ec; padding: 6px; vertical-align: top; }
            .right { text-align: right; }
            .empty { text-align: center; color: #64748b; padding: 14px; }
            .done { text-decoration: line-through; color: #64748b; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 52px; }
            .signature { border-top: 1px solid #0f172a; text-align: center; padding-top: 8px; font-size: 12px; }
            @media print {
              body { margin: 12mm; }
              button { display: none; }
              .page-break { break-before: page; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>REPORTE DE TURNO - CAJA</h1>
              <p><strong>Oficina:</strong> ${escapeHtml(officeLabel)}</p>
              <p><strong>Fecha:</strong> ${escapeHtml(cashReportDate)} · <strong>Turno:</strong> ${escapeHtml(normalizedShift || "TODOS")}</p>
            </div>
            <div class="meta">
              <p><strong>Generado:</strong> ${escapeHtml(generatedAt)}</p>
              <p><strong>Usuario:</strong> ${escapeHtml(currentUserProfile?.nombre || userEmail || "USUARIO")}</p>
              <button onclick="window.print()">IMPRIMIR</button>
            </div>
          </div>
          <div class="grid">
            <div class="box"><div class="label">Saldo inicial</div><div class="value">${currency.format(openingTotal)}</div></div>
            <div class="box"><div class="label">Ingresos turno</div><div class="value">${currency.format(totals.income)}</div></div>
            <div class="box"><div class="label">Egresos turno</div><div class="value">${currency.format(totals.expense)}</div></div>
            <div class="box"><div class="label">Saldo turno</div><div class="value">${currency.format(totals.balance)}</div></div>
            <div class="box"><div class="label">Saldo final</div><div class="value">${currency.format(openingTotal + totals.balance)}</div></div>
          </div>
          <div class="grid">
            <div class="box"><div class="label">Efectivo</div><div class="value">${currency.format(totals.cash)}</div></div>
            <div class="box"><div class="label">Tarjeta</div><div class="value">${currency.format(totals.card)}</div></div>
            <div class="box"><div class="label">Transferencia</div><div class="value">${currency.format(totals.transfer)}</div></div>
            <div class="box"><div class="label">Otro</div><div class="value">${currency.format(totals.other)}</div></div>
            <div class="box"><div class="label">Movimientos</div><div class="value">${movementRows.length}</div></div>
          </div>
          <h2>NOVEDADES DEL TURNO</h2>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Oficina</th><th>Turno</th><th>Tipo</th><th>Estado</th><th>Usuario</th><th>Detalle</th></tr>
            </thead>
            <tbody>${turnNotesHtml}</tbody>
          </table>
          <h2>MOVIMIENTOS DEL TURNO</h2>
          <table>
            <thead>
              <tr><th>Fecha</th><th>Oficina</th><th>Turno</th><th>Tipo</th><th>Origen</th><th>Medio</th><th>Comprobante</th><th>Concepto</th><th>Monto</th><th>Usuario</th></tr>
            </thead>
            <tbody>${movementHtml}</tbody>
          </table>
          <h2>COBRANZA TRES PROVINCIAS - RESUMEN POR PLAN</h2>
          <table>
            <thead>
              <tr><th>Plan</th><th>Tickets recibidos</th><th>Tickets cobrados</th><th>Tickets pendientes</th><th>Monto cobrado</th><th>Monto pendiente</th></tr>
            </thead>
            <tbody>${planHtml}</tbody>
          </table>
          <div class="signatures">
            <div class="signature">FIRMA TURNO SALIENTE</div>
            <div class="signature">FIRMA TURNO ENTRANTE</div>
          </div>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
  };

  const openAffiliateForm = (affiliate?: Affiliate) => {
    setEditingAffiliateId(affiliate?.id || null);
    setAffiliateForm(affiliate ? {
      fullName: affiliate.fullName,
      policyNumber: affiliate.policyNumber,
      plan: affiliate.plan,
      value: affiliate.value,
      phone: affiliate.phone,
      address: affiliate.address,
      dependency: affiliate.dependency || "001",
      collector: affiliate.collector || "OFICINA",
      request: affiliate.request || "",
      latestNews: affiliate.latestNews || "",
      sourceTickets: affiliate.sourceTickets || 0,
    } : emptyAffiliateForm());
    setAffiliateDialogOpen(true);
  };

  const openNoteDialog = (affiliateId: string) => {
    setNoteAffiliateId(affiliateId);
    setNoteText("");
  };

  const saveNote = (event: FormEvent) => {
    event.preventDefault();
    if (!noteAffiliateId || !noteText.trim()) return;
    setNotes((current) => [
      {
        id: `note-${Date.now()}`,
        affiliateId: noteAffiliateId,
        month: activeMonth,
        date: new Date().toISOString(),
        text: noteText.trim(),
      },
      ...current,
    ]);
    setNoteAffiliateId(null);
    setNoteText("");
  };

  const saveDirectNews = (event: FormEvent) => {
    event.preventDefault();
    if (!newsAffiliateId || !newsText.trim()) return;
    setNotes((current) => [
      {
        id: `note-${Date.now()}`,
        affiliateId: newsAffiliateId,
        month: activeMonth,
        date: new Date().toISOString(),
        text: newsText.trim(),
      },
      ...current,
    ]);
    setNewsText("");
  };

  const saveAffiliate = (event: FormEvent) => {
    event.preventDefault();
    const id = editingAffiliateId || `${affiliateForm.policyNumber || Date.now()}-${affiliateForm.plan}`;
    const payload: Affiliate = {
      id,
      fullName: affiliateForm.fullName.trim().toLocaleUpperCase("es-AR"),
      policyNumber: affiliateForm.policyNumber.trim(),
      plan: affiliateForm.plan,
      value: Number(affiliateForm.value) || 0,
      phone: affiliateForm.phone.trim(),
      address: affiliateForm.address.trim(),
      dependency: affiliateForm.dependency.trim() || "001",
      collector: affiliateForm.collector.trim().toLocaleUpperCase("es-AR") || "OFICINA",
      request: affiliateForm.request.trim(),
      latestNews: affiliateForm.latestNews.trim(),
      selectedForMonthly: affiliates.find((item) => item.id === editingAffiliateId)?.selectedForMonthly || false,
      sourceTickets: Math.max(0, Number(affiliateForm.sourceTickets) || 0),
    };
    setAffiliates((current) => editingAffiliateId ? current.map((item) => item.id === editingAffiliateId ? payload : item) : [payload, ...current]);
    setAffiliateDialogOpen(false);
  };

  const prepareMonthlyImport = (imported: Affiliate[]) => {
    const currentById = new Map(affiliates.map((item) => [item.id, item]));
    const currentByPolicy = new Map<string, Affiliate[]>();
    const officeByDependency = new Map<string, Map<string, number>>();

    affiliates.forEach((item) => {
      const policyRows = currentByPolicy.get(item.policyNumber) || [];
      policyRows.push(item);
      currentByPolicy.set(item.policyNumber, policyRows);

      const collector = normalizeCollectorName(item.collector || "OFICINA");
      const dependency = item.dependency || "SIN DEFINIR";
      if (!collector.includes("OFICINA")) return;
      const counts = officeByDependency.get(dependency) || new Map<string, number>();
      counts.set(collector, (counts.get(collector) || 0) + 1);
      officeByDependency.set(dependency, counts);
    });

    const officeCollectorFor = (dependency: string) => {
      const counts = officeByDependency.get(dependency);
      if (counts && counts.size > 0) {
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es-AR"))[0][0];
      }
      const officeFallbackByDependency: Record<string, string> = {
        "238": "SAN MARTIN OFICINA",
        "241": "MEDRANO OFICINA",
        "261": "SANTA ROSA OFICINA",
        "268": "TUNUYAN OFICINA",
        "269": "SAN MARTIN OFICINA",
        "313": "SAN MARTIN OFICINA",
        "327": "TUNUYAN OFICINA",
        "328": "SAN MARTIN OFICINA",
      };
      return officeFallbackByDependency[dependency] || "OFICINA";
    };

    const previousFor = (incoming: Affiliate) => {
      const exact = currentById.get(incoming.id);
      if (exact) return exact;
      const samePolicy = currentByPolicy.get(incoming.policyNumber) || [];
      if (samePolicy.length === 1) return samePolicy[0];
      return samePolicy.find((item) => item.plan === incoming.plan)
        || samePolicy.find((item) => item.fullName === incoming.fullName)
        || null;
    };

    return imported.map((incoming) => {
      const previous = previousFor(incoming);
      if (previous) return { ...incoming, id: previous.id, collector: previous.collector || officeCollectorFor(incoming.dependency) };
      return { ...incoming, collector: officeCollectorFor(incoming.dependency) };
    });
  };

  const importAffiliates = (imported: Affiliate[]) => {
    const prepared = prepareMonthlyImport(imported);
    const previousPolicyNumbers = new Set(affiliates.map((item) => item.policyNumber).filter(Boolean));
    const seenNewPolicyNumbers = new Set<string>();
    const newPolicyIds = prepared
      .filter((item) => {
        if (!item.policyNumber || previousPolicyNumbers.has(item.policyNumber) || seenNewPolicyNumbers.has(item.policyNumber)) return false;
        seenNewPolicyNumbers.add(item.policyNumber);
        return true;
      })
      .map((item) => item.id);
    const currentById = new Map(affiliates.map((item) => [item.id, item]));
    const merged = prepared.map((item) => {
      const previous = currentById.get(item.id);
      return previous ? { ...item, phone: previous.phone, address: previous.address, dependency: item.dependency || previous.dependency, collector: previous.collector || item.collector || "OFICINA", request: previous.request || item.request || "", latestNews: previous.latestNews || item.latestNews || "", selectedForMonthly: true } : { ...item, selectedForMonthly: true };
    });
    const importedIds = new Set(merged.map((item) => item.id));
    const retained = affiliates
      .filter((item) => !importedIds.has(item.id))
      .map((item) => ({ ...item, selectedForMonthly: false }));
    const nextAffiliates = [...merged, ...retained];
    const importedCollectors = uniqueSorted(nextAffiliates.map((item) => normalizeCollectorName(item.collector || "OFICINA")));
    setAffiliates(nextAffiliates);
    setMonthlyNewPolicyIds((current) => ({
      ...current,
      [activeMonth]: Array.from(new Set([...(current[activeMonth] || []), ...newPolicyIds])),
    }));
    setCollectorRecords((current) => normalizeCollectorRecords([
      ...current,
      ...importedCollectors.map((collector) => defaultCollectorConfig(collector)),
    ]));
    setMonthlyItems((current) => [
      ...current.filter((item) => item.month !== activeMonth),
      ...merged
        .filter((item) => item.selectedForMonthly)
        .map((item) => ({ month: activeMonth, affiliateId: item.id, tickets: Math.max(0, item.sourceTickets || 0) })),
    ]);
    setImportMessage(`Cobranza importada: ${merged.length} afiliados para ${activeMonth}. La base general conserva ${retained.length} pólizas sin tickets en este listado.`);
    setAffiliateImportPreview(null);
  };

  const previewAffiliates = (imported: Affiliate[], source: string, duplicatedCount: number) => {
    const prepared = prepareMonthlyImport(imported);
    setAffiliateImportPreview(buildAffiliateImportPreview(prepared, affiliates, source, duplicatedCount));
    setImportMessage(`${source}: ${prepared.length} afiliados listos para revisar antes de aplicar.`);
  };

  const importCsv = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseAffiliatesCsv(String(reader.result || ""));
      if (parsed.affiliates.length > 0) previewAffiliates(parsed.affiliates, file.name, parsed.duplicatedCount);
      else setImportMessage("No encontré afiliados válidos en el archivo.");
      event.target.value = "";
    };
    reader.readAsText(file, "windows-1252");
  };

  const importGoogleSheet = async (applyImmediately = false) => {
    setIsLoadingSheet(true);
    setImportMessage("Leyendo Google Sheets...");
    try {
      const response = await fetch(getGoogleSheetCsvUrl(sheetUrl));
      if (!response.ok) throw new Error("No se pudo leer la planilla.");
      const parsed = parseAffiliatesCsv(await response.text());
      if (parsed.affiliates.length === 0) throw new Error("La planilla no tiene afiliados válidos.");
      if (applyImmediately) importAffiliates(parsed.affiliates);
      else previewAffiliates(parsed.affiliates, "Google Sheets", parsed.duplicatedCount);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No se pudo importar la planilla.");
    } finally {
      setIsLoadingSheet(false);
    }
  };

  useEffect(() => {
    if (autoImportTried || !isDemoAffiliateBase(affiliates)) return;
    setAutoImportTried(true);
    void importGoogleSheet(true);
  }, [affiliates, autoImportTried]);

  const toggleMonthly = (affiliateId: string, checked: boolean) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, selectedForMonthly: checked } : item));
    if (checked) setMonthlyItems((current) => current.some((item) => item.month === activeMonth && item.affiliateId === affiliateId) ? current : [...current, { month: activeMonth, affiliateId, tickets: 0 }]);
    else setMonthlyItems((current) => current.filter((item) => !(item.month === activeMonth && item.affiliateId === affiliateId)));
  };

  const setAllFilteredMonthly = (checked: boolean) => {
    const ids = new Set(filteredAffiliates.map((item) => item.id));
    setAffiliates((current) => current.map((item) => ids.has(item.id) ? { ...item, selectedForMonthly: checked } : item));
    setMonthlyItems((current) => {
      const withoutFiltered = current.filter((item) => !(item.month === activeMonth && ids.has(item.affiliateId)));
      if (!checked) return withoutFiltered;
      return [
        ...withoutFiltered,
        ...filteredAffiliates.map((item) => ({
          month: activeMonth,
          affiliateId: item.id,
          tickets: Math.max(0, item.sourceTickets || 0),
        })),
      ];
    });
  };

  const updateAffiliateRequest = (affiliateId: string, request: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, request: request.toLocaleUpperCase("es-AR") } : item));
  };

  const updateAffiliateNews = (affiliateId: string, latestNews: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, latestNews: latestNews.toLocaleUpperCase("es-AR") } : item));
  };

  const updateAffiliateDependency = (affiliateId: string, dependency: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, dependency } : item));
  };

  const updateAffiliateCollector = (affiliateId: string, collector: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, collector } : item));
  };

  const addCollector = () => {
    const name = normalizeCollectorName(newCollectorName);
    if (!name) return;
    setCollectorRecords((current) => normalizeCollectorRecords([...current, {
      name,
      phone: newCollectorPhone.trim(),
      commissionBase: Math.max(0, parseNumber(newCollectorCommission) || 12),
      bonusEnabled: newCollectorBonusEnabled,
      bonusThreshold: 90,
      bonusRate: 13,
    }]));
    setNewCollectorName("");
    setNewCollectorPhone("");
    setNewCollectorCommission("12");
    setNewCollectorBonusEnabled(false);
  };

  const renameCollector = () => {
    const from = normalizeCollectorName(collectorToRename);
    const to = normalizeCollectorName(collectorRenameValue);
    if (!from) return;
    const finalName = to || from;
    setAffiliates((current) => current.map((item) => normalizeCollectorName(item.collector || "OFICINA") === from ? { ...item, collector: finalName } : item));
    setCollectorRecords((current) => normalizeCollectorRecords([
      ...current.filter((item) => normalizeCollectorName(item.name) !== from),
      {
        name: finalName,
        phone: collectorPhoneValue.trim(),
        commissionBase: Math.max(0, parseNumber(collectorCommissionValue) || 12),
        bonusEnabled: collectorBonusEnabled,
        bonusThreshold: 90,
        bonusRate: 13,
      },
    ]));
    if (normalizeCollectorName(collectorFilter) === from) setCollectorFilter(finalName);
    if (normalizeCollectorName(mobileCollector) === from) setMobileCollector(finalName);
    setCollectorToRename("");
    setCollectorRenameValue("");
    setCollectorPhoneValue("");
    setCollectorCommissionValue("12");
    setCollectorBonusEnabled(false);
  };

  const removeCollector = (collector: string) => {
    const normalizedCollector = normalizeCollectorName(collector);
    const assigned = affiliates.some((item) => normalizeCollectorName(item.collector || "OFICINA") === normalizedCollector);
    if (assigned) {
      alert("Este cobrador tiene afiliados asignados. Primero combiná o reasigná su cartera.");
      return;
    }
    setCollectorRecords((current) => normalizeCollectorRecords(current.filter((item) => normalizeCollectorName(item.name) !== normalizedCollector)));
    if (normalizeCollectorName(collectorFilter) === normalizedCollector) setCollectorFilter("todos");
    if (normalizeCollectorName(mobileCollector) === normalizedCollector) setMobileCollector("todos");
    if (normalizeCollectorName(collectorToRename) === normalizedCollector) {
      setCollectorToRename("");
      setCollectorRenameValue("");
      setCollectorPhoneValue("");
      setCollectorCommissionValue("12");
      setCollectorBonusEnabled(false);
    }
  };

  const mergeCollectors = () => {
    const from = normalizeCollectorName(collectorMergeFrom);
    const to = normalizeCollectorName(collectorMergeTo);
    if (!from || !to || from === to) return;
    const destinationPhone = collectorPhoneByName.get(to) || collectorPhoneByName.get(from) || "";
    const destinationConfig = collectorConfigByName.get(to) || collectorConfigByName.get(from) || defaultCollectorConfig(to, destinationPhone);
    setAffiliates((current) => current.map((item) => normalizeCollectorName(item.collector || "OFICINA") === from ? { ...item, collector: to } : item));
    setCollectorRecords((current) => normalizeCollectorRecords([
      ...current.filter((item) => normalizeCollectorName(item.name) !== from && normalizeCollectorName(item.name) !== to),
      { ...destinationConfig, name: to, phone: destinationPhone },
    ]));
    if (normalizeCollectorName(collectorFilter) === from) setCollectorFilter(to);
    if (normalizeCollectorName(mobileCollector) === from) setMobileCollector(to);
    if (normalizeCollectorName(collectorToRename) === from) {
      setCollectorToRename("");
      setCollectorRenameValue("");
      setCollectorPhoneValue("");
    }
    setCollectorMergeFrom("");
    setCollectorMergeTo("");
  };

  const addDependency = () => {
    const name = newDependencyName.trim().toLocaleUpperCase("es-AR");
    if (!name) return;
    setCustomDependencies((current) => uniqueSorted([...current, name]));
    setNewDependencyName("");
  };

  const selectCollectorToEdit = (collector: string) => {
    const normalizedCollector = normalizeCollectorName(collector);
    const config = collectorConfigByName.get(normalizedCollector) || defaultCollectorConfig(normalizedCollector);
    setCollectorToRename(normalizedCollector);
    setCollectorRenameValue(normalizedCollector);
    setCollectorPhoneValue(collectorPhoneByName.get(normalizedCollector) || "");
    setCollectorCommissionValue(String(config.commissionBase));
    setCollectorBonusEnabled(config.bonusEnabled);
  };

  const renameDependency = () => {
    const from = dependencyToRename.trim();
    const to = dependencyRenameValue.trim().toLocaleUpperCase("es-AR");
    if (!from || !to) return;
    setAffiliates((current) => current.map((item) => (item.dependency || "SIN DEFINIR") === from ? { ...item, dependency: to } : item));
    setCustomDependencies((current) => uniqueSorted(current.map((item) => item === from ? to : item).concat(to)));
    if (dependencyFilter === from) setDependencyFilter(to);
    setDependencyToRename("");
    setDependencyRenameValue("");
  };

  const updateMonthlyTickets = (affiliateId: string, tickets: number) => {
    setMonthlyItems((current) => current.some((item) => item.month === activeMonth && item.affiliateId === affiliateId)
      ? current.map((item) => item.month === activeMonth && item.affiliateId === affiliateId ? { ...item, tickets } : item)
      : [...current, { month: activeMonth, affiliateId, tickets }]);
  };

  const saveTicketCollection = async (event: FormEvent) => {
    event.preventDefault();
    if (isSavingTicketCollection) return;
    if (!selectedMonthlyAffiliate) return;
    if (hasUnansweredRequest) {
      alert("Esta póliza tiene un pedido pendiente. Para guardar el cobro, primero completá la novedad/respuesta.");
      return;
    }
    const assignedCollector = normalizeCollectorName(selectedMonthlyAffiliate.collector || "OFICINA");
    const actualCollector = activeCobranzaCollectorName || assignedCollector;
    const isOtherCollectorTicket = !isAdminUser && !!currentCollectorName && actualCollector !== assignedCollector;
    if (isOtherCollectorTicket) {
      const shouldCharge = window.confirm(`Este ticket corresponde a la cobranza de ${assignedCollector}. Queres cobrarlo igual?`);
      if (!shouldCharge) return;
    }
    const tickets = Math.max(0, Math.min(parseNumber(collectionTickets), ticketsToCharge));
    if (tickets <= 0) return;
    setIsSavingTicketCollection(true);
    const payload: TicketCollection = {
      id: editingTicketCollectionId || `ticket-${Date.now()}`,
      month: activeMonth,
      affiliateId: selectedMonthlyAffiliate.id,
      fullName: selectedMonthlyAffiliate.fullName,
      policyNumber: selectedMonthlyAffiliate.policyNumber,
      plan: selectedMonthlyAffiliate.plan,
      dependency: selectedMonthlyAffiliate.dependency,
      collector: actualCollector,
      ticketValue: selectedMonthlyAffiliate.value,
      ticketsCharged: tickets,
      paymentMethod: collectionMethod,
      transfer: collectionMethod === "T" ? collectionTransfer : undefined,
    };
    const automaticNote: AffiliateNote | null = isOtherCollectorTicket
      ? {
        id: `note-${Date.now()}`,
        affiliateId: selectedMonthlyAffiliate.id,
        month: activeMonth,
        date: new Date().toISOString(),
        text: `TICKET CORRESPONDIENTE A LA COBRANZA DE ${assignedCollector}. COBRADO POR ${actualCollector}.`,
      }
      : null;
    const nextNotes = automaticNote ? [automaticNote, ...notes] : notes;
    const nextTicketCollections = editingTicketCollectionId
      ? ticketCollections.map((item) => item.id === editingTicketCollectionId ? payload : item)
      : [...ticketCollections, payload];
    setTicketCollections((current) => editingTicketCollectionId
      ? current.map((item) => item.id === editingTicketCollectionId ? payload : item)
      : current.some((item) => item.id === payload.id) ? current : [...current, payload]);
    setEditingTicketCollectionId(null);
    setCollectionTickets("1");
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
    setMobileSelectedAffiliateId("");
    setMobileNoteText("");
    if (automaticNote) setNotes(nextNotes);
    await saveTicketCollectionsOnline(nextTicketCollections, nextNotes);
    setIsSavingTicketCollection(false);
  };

  const editTicketCollection = (collection: TicketCollection) => {
    if (!isAdminUser) return;
    const affiliate = affiliatesById.get(collection.affiliateId);
    if (!affiliate) return;
    setEditingTicketCollectionId(collection.id);
    setCollectionPolicy(affiliate.policyNumber);
    setMobileSelectedAffiliateId(affiliate.id);
    setCollectionTickets(String(collection.ticketsCharged));
    setCollectionMethod(collection.paymentMethod || "E");
    setCollectionTransfer(collection.transfer || emptyTransfer());
    setActiveSection("Cobranza");
  };

  const cancelTicketCollectionEdit = () => {
    setEditingTicketCollectionId(null);
    setCollectionPolicy("");
    setCollectionTickets("1");
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
    setMobileSelectedAffiliateId("");
  };

  const deleteTicketCollection = async (collectionId: string) => {
    if (!isAdminUser) return;
    if (isSavingTicketCollection) return;
    if (!window.confirm("¿Eliminar este cobro de tickets? Esta acción corrige los totales y no se puede deshacer.")) return;
    setIsSavingTicketCollection(true);
    const nextTicketCollections = ticketCollections.filter((item) => item.id !== collectionId);
    setTicketCollections(nextTicketCollections);
    if (editingTicketCollectionId === collectionId) cancelTicketCollectionEdit();
    await deleteTicketCollectionOnline(collectionId, nextTicketCollections);
    setIsSavingTicketCollection(false);
  };

  const applyReceiptAffiliate = (affiliate: Affiliate | null) => {
    if (!affiliate) return;
    setReceiptForm((current) => ({
      ...current,
      policyNumber: affiliate.policyNumber,
      fullName: affiliate.fullName,
      collector: isOfficeUser ? normalizeCollectorName(affiliate.collector || "OFICINA") : currentCollectorName,
      plan: affiliate.plan,
      monthlyAmount: affiliate.value ? String(affiliate.value) : current.monthlyAmount,
    }));
  };

  const updateReceiptPolicy = (value: string) => {
    const policyNumber = value.replace(/\D/g, "");
    const affiliate = findReceiptAffiliate(policyNumber, receiptForm.plan);
    if (affiliate) {
      applyReceiptAffiliate(affiliate);
      return;
    }
    setReceiptForm((current) => ({ ...current, policyNumber }));
  };

  const updateReceiptPlan = (plan: PlanType) => {
    const affiliate = findReceiptAffiliate(receiptForm.policyNumber, plan);
    if (affiliate) {
      applyReceiptAffiliate(affiliate);
      return;
    }
    setReceiptForm((current) => ({ ...current, plan }));
  };

  const updateReceiptPaidMonth = (month: string, checked: boolean) => {
    setReceiptForm((current) => {
      const paidMonths = checked
        ? uniqueSorted([...current.paidMonths, month])
        : current.paidMonths.filter((item) => item !== month);
      return {
        ...current,
        paidMonths,
        paidMonth: paidMonths[0] || "",
        monthCount: String(paidMonths.length),
      };
    });
  };

  const resetReceiptForm = () => {
    setEditingReceiptId(null);
    setReceiptForm({
      receiptNumber: "",
      policyNumber: "",
      fullName: "",
      collector: selectedCollectorName || "OFICINA",
      plan: "A 238",
      paidMonth: "",
      paidMonths: [],
      monthCount: "0",
      monthlyAmount: "",
      paymentMethod: "E",
      isProduction: false,
      transfer: emptyTransfer(),
    });
  };

  const editReceipt = (receipt: ReceiptCollection) => {
    setEditingReceiptId(receipt.id);
    setReceiptForm({
      receiptNumber: receipt.receiptNumber || "",
      policyNumber: receipt.policyNumber || "",
      fullName: receipt.fullName || "",
      collector: receipt.collector || selectedCollectorName || "OFICINA",
      plan: receipt.plan || "A 238",
      paidMonth: receipt.paidMonth || "",
      paidMonths: receipt.paidMonths?.length ? receipt.paidMonths : receipt.paidMonth ? [receipt.paidMonth] : [],
      monthCount: String(receipt.paidMonths?.length || receipt.monthCount || 0),
      monthlyAmount: receipt.monthlyAmount ? String(receipt.monthlyAmount) : "",
      paymentMethod: receipt.paymentMethod || "E",
      isProduction: !!receipt.isProduction,
      transfer: receipt.transfer || emptyTransfer(),
    });
  };

  const voidReceipt = (receiptId: string) => {
    if (!isAdminUser) return;
    if (!window.confirm("¿Anular este recibo? Quedará visible, pero no sumará en totales ni rendición.")) return;
    setReceipts((current) => current.map((receipt) => receipt.id === receiptId ? {
      ...receipt,
      status: "anulado",
      voidedAt: new Date().toISOString(),
      voidReason: "ANULADO POR ADMINISTRADOR",
    } : receipt));
    if (editingReceiptId === receiptId) resetReceiptForm();
  };

  const deleteReceipt = (receiptId: string) => {
    if (!isAdminUser) return;
    if (!window.confirm("¿Eliminar definitivamente este recibo? Esta acción no se puede deshacer.")) return;
    setReceipts((current) => current.filter((receipt) => receipt.id !== receiptId));
    if (editingReceiptId === receiptId) resetReceiptForm();
  };

  const saveReceipt = async (event: FormEvent) => {
    event.preventDefault();
    if (isSavingReceipt) return;
    if (!receiptForm.paidMonths.length) {
      alert("Seleccioná al menos un mes que paga el afiliado.");
      return;
    }
    setIsSavingReceipt(true);
    const receiptPayload: ReceiptCollection = {
      id: editingReceiptId || `receipt-${Date.now()}`,
      collectionMonth: activeMonth,
      receiptNumber: receiptForm.receiptNumber.trim() || `S/N-${Date.now()}`,
      policyNumber: receiptForm.policyNumber.trim(),
      fullName: receiptForm.fullName.trim().toLocaleUpperCase("es-AR"),
      collector: normalizeCollectorName(isOfficeUser ? receiptForm.collector || selectedCollectorName || "OFICINA" : currentCollectorName || "OFICINA"),
      plan: receiptForm.plan,
      paidMonth: receiptForm.paidMonths[0] || receiptForm.paidMonth,
      paidMonths: receiptForm.paidMonths,
      monthCount: receiptForm.paidMonths.length,
      monthlyAmount: parseMoney(receiptForm.monthlyAmount),
      paymentMethod: receiptForm.paymentMethod,
      transfer: receiptForm.paymentMethod === "T" ? receiptForm.transfer : undefined,
      status: receipts.find((receipt) => receipt.id === editingReceiptId)?.status || "activo",
      isProduction: receiptForm.isProduction,
      voidedAt: receipts.find((receipt) => receipt.id === editingReceiptId)?.voidedAt,
      voidReason: receipts.find((receipt) => receipt.id === editingReceiptId)?.voidReason,
    };
    const nextReceipts = editingReceiptId
      ? receipts.map((receipt) => receipt.id === editingReceiptId ? receiptPayload : receipt)
      : [...receipts, receiptPayload];
    setReceipts((current) => editingReceiptId
      ? current.map((receipt) => receipt.id === editingReceiptId ? receiptPayload : receipt)
      : current.some((receipt) => receipt.id === receiptPayload.id) ? current : [...current, receiptPayload]);
    resetReceiptForm();
    await saveReceiptsOnline(nextReceipts);
    setIsSavingReceipt(false);
  };

  const exportAffiliatesExcel = async () => {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const { getOrderOfSiblings, getSelfClosingTagMarkup, insertElementMarkupAccordingToOrderOfSiblings } = await import("write-excel-file/utility");
    const monthlyByAffiliate = new Map(
      monthlyItems
        .filter((item) => item.month === activeMonth)
        .map((item) => [item.affiliateId, item.tickets]),
    );
    const rows = affiliates
      .filter((affiliate) => canSeeAffiliateInCobranza(affiliate))
      .map((affiliate) => {
        const tickets = Math.max(0, monthlyByAffiliate.get(affiliate.id) || 0);
        return { affiliate, tickets, monthlyAmount: tickets * affiliate.value };
      })
      .sort((a, b) => Number(a.tickets === 0) - Number(b.tickets === 0)
        || a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR"));

    const moneyCell = (value: number) => ({ value, type: Number, format: "$ #,##0", align: "right" as const });
    const numberCell = (value: number) => ({ value, type: Number, format: "0", align: "right" as const });
    const numericTextCell = (value: string, fallback = "-") => {
      const clean = String(value || "").replace(/\D/g, "");
      return clean ? numberCell(Number(clean)) : fallback;
    };
    const headerCell = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#0B5CAD", textColor: "#FFFFFF", align: "center" as const, wrap: true });
    const titleCell = (value: string, columnSpan: number) => ({ value, columnSpan, fontWeight: "bold" as const, fontSize: 16, backgroundColor: "#0B5CAD", textColor: "#FFFFFF", align: "center" as const });
    const statusCell = (tickets: number) => tickets > 0
      ? { value: "EN COBRANZA", fontWeight: "bold" as const, textColor: "#166534", backgroundColor: "#DCFCE7", align: "center" as const }
      : { value: "SIN TICKETS", fontWeight: "bold" as const, textColor: "#991B1B", backgroundColor: "#FEE2E2", align: "center" as const };

    const baseData: any[][] = [
      [titleCell("BASE GENERAL DE AFILIADOS", 9)],
      [{ value: `Período: ${activeMonth}`, columnSpan: 9, fontWeight: "bold", align: "center" }],
      [{ value: `${affiliates.length} afiliados · ${rows.filter((row) => row.tickets > 0).length} con tickets · ${rows.filter((row) => row.tickets === 0).length} sin tickets`, columnSpan: 9, align: "center" }],
      [null],
      [
        headerCell("Nombre y apellido"),
        headerCell("Póliza"),
        headerCell("Plan"),
        headerCell("Dependencia"),
        headerCell("Cobrador"),
        headerCell("Valor por ticket"),
        headerCell("Tickets del mes"),
        headerCell("Total mensual"),
        headerCell("Estado"),
      ],
      ...rows.map(({ affiliate, tickets, monthlyAmount }) => [
        affiliate.fullName,
        numericTextCell(affiliate.policyNumber),
        affiliate.plan,
        numericTextCell(affiliate.dependency || ""),
        affiliate.collector || "OFICINA",
        moneyCell(affiliate.value),
        { ...numberCell(tickets), align: "center" },
        moneyCell(monthlyAmount),
        statusCell(tickets),
      ]),
    ];

    const buildSummary = (groupName: "collector" | "dependency") => {
      const groups = new Map<string, { affiliates: number; withTickets: number; withoutTickets: number; tickets: number; amount: number }>();
      rows.forEach(({ affiliate, tickets, monthlyAmount }) => {
        const key = groupName === "collector" ? affiliate.collector || "OFICINA" : affiliate.dependency || "SIN DEFINIR";
        const current = groups.get(key) || { affiliates: 0, withTickets: 0, withoutTickets: 0, tickets: 0, amount: 0 };
        current.affiliates += 1;
        current.withTickets += tickets > 0 ? 1 : 0;
        current.withoutTickets += tickets === 0 ? 1 : 0;
        current.tickets += tickets;
        current.amount += monthlyAmount;
        groups.set(key, current);
      });
      return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "es-AR", { numeric: true }));
    };

    const summarySheet = (title: string, firstHeader: string, summaryRows: ReturnType<typeof buildSummary>): any[][] => [
      [titleCell(title, 6)],
      [{ value: `Período: ${activeMonth}`, columnSpan: 6, fontWeight: "bold", align: "center" }],
      [null],
      [headerCell(firstHeader), headerCell("Afiliados"), headerCell("Con tickets"), headerCell("Sin tickets"), headerCell("Tickets"), headerCell("Importe asignado")],
      ...summaryRows.map(([name, summary]) => [
        firstHeader === "Dependencia" ? numericTextCell(name, name) : name,
        numberCell(summary.affiliates),
        numberCell(summary.withTickets),
        numberCell(summary.withoutTickets),
        numberCell(summary.tickets),
        moneyCell(summary.amount),
      ]),
      [
        { value: "TOTAL", fontWeight: "bold", backgroundColor: "#E8F0F8" },
        { ...numberCell(affiliates.length), fontWeight: "bold" },
        { ...numberCell(rows.filter((row) => row.tickets > 0).length), fontWeight: "bold" },
        { ...numberCell(rows.filter((row) => row.tickets === 0).length), fontWeight: "bold" },
        { ...numberCell(rows.reduce((sum, row) => sum + row.tickets, 0)), fontWeight: "bold" },
        { ...moneyCell(rows.reduce((sum, row) => sum + row.monthlyAmount, 0)), fontWeight: "bold" },
      ],
    ];

    const collectorSummaryRows = buildSummary("collector");
    const dependencySummaryRows = buildSummary("dependency");
    const filterRanges = [
      `A5:I${5 + rows.length}`,
      `A4:F${4 + collectorSummaryRows.length + 1}`,
      `A4:F${4 + dependencySummaryRows.length + 1}`,
    ];
    const autoFilterFeature: any = {
      files: {
        transform: {
          "xl/worksheets/sheet{id}.xml": {
            transform: (content: string, _options: unknown, properties: { sheetIndex: number }) => {
              const ref = filterRanges[properties.sheetIndex];
              if (!ref) return content;
              return insertElementMarkupAccordingToOrderOfSiblings(
                content,
                getSelfClosingTagMarkup("autoFilter", { ref }),
                getOrderOfSiblings("xl/worksheets/sheet{id}.xml", "worksheet"),
                "worksheet",
              );
            },
          },
        },
      },
    };

    await writeExcelFile([
      {
        data: baseData,
        sheet: "Base de afiliados",
        columns: [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 26 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 16 }],
        orientation: "landscape",
        stickyRowsCount: 5,
      },
      {
        data: summarySheet("RESUMEN POR COBRADOR", "Cobrador", collectorSummaryRows),
        sheet: "Por cobrador",
        columns: [{ width: 30 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }],
        stickyRowsCount: 4,
      },
      {
        data: summarySheet("RESUMEN POR DEPENDENCIA", "Dependencia", dependencySummaryRows),
        sheet: "Por dependencia",
        columns: [{ width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 20 }],
        stickyRowsCount: 4,
      },
    ], { features: [autoFilterFeature] }).toFile(`base-afiliados-${activeMonth}.xlsx`);
  };

  const exportCollectorReportExcel = async () => {
    if (!selectedCollectorSummary) return;
    const canExport = await ensureLatestOnlineDataBeforeReport();
    if (!canExport) return;
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const moneyCell = (value: number) => ({ value, type: Number, format: "$ #,##0", align: "right" as const });
    const metricLabel = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#E8F0F8" });
    const headerCell = (value: string) => ({
      value,
      fontWeight: "bold" as const,
      backgroundColor: "#0B5CAD",
      textColor: "#FFFFFF",
      align: "center" as const,
      wrap: true,
    });

    const chargedRows = ticketCollections
      .filter((item) => {
        if (item.month !== activeMonth) return false;
        const collectionCollector = normalizeCollectorName(item.collector || "");
        if (collectionCollector) return collectionCollector === normalizeCollectorName(selectedCollectorName || "OFICINA");
        return selectedCollectorPortfolio.some((row) => row.affiliate.id === item.affiliateId);
      })
      .map((collection) => {
        const affiliate = affiliatesById.get(collection.affiliateId);
        return {
          collection,
          affiliate,
          amount: (affiliate?.value ?? collection.ticketValue ?? 0) * collection.ticketsCharged,
        };
      })
      .sort((a, b) =>
        (a.affiliate?.plan || a.collection.plan || "").localeCompare(b.affiliate?.plan || b.collection.plan || "", "es-AR", { numeric: true })
        || (a.affiliate?.fullName || a.collection.fullName || "").localeCompare(b.affiliate?.fullName || b.collection.fullName || "", "es-AR")
        || (a.affiliate?.policyNumber || a.collection.policyNumber || "").localeCompare(b.affiliate?.policyNumber || b.collection.policyNumber || "", "es-AR", { numeric: true })
      );
    const chargedTicketsByPlanRows = Array.from(chargedRows.reduce((rows, { collection, affiliate }) => {
      const plan = affiliate?.plan || collection.plan || "SIN PLAN";
      rows.set(plan, (rows.get(plan) || 0) + collection.ticketsCharged);
      return rows;
    }, new Map<string, number>()))
      .sort(([planA], [planB]) => planA.localeCompare(planB, "es-AR", { numeric: true }));

    const summaryData: any[][] = [
      [{ value: "REPORTE DE COBRANZA", columnSpan: 2, fontWeight: "bold", fontSize: 16, backgroundColor: "#0B5CAD", textColor: "#FFFFFF", align: "center" }],
      [metricLabel("Cobrador"), selectedCollectorName || "COBRADOR"],
      [metricLabel("Período"), activeMonth],
      [metricLabel("Dependencias"), selectedCollectorSummary.dependencies.join(", ") || "-"],
      [null, null],
      [headerCell("Indicador"), headerCell("Resultado")],
      [metricLabel("Afiliados asignados"), selectedCollectorSummary.affiliates],
      [metricLabel("Tickets recibidos"), selectedCollectorSummary.tickets],
      [metricLabel("Tickets cobrados"), selectedCollectorSummary.chargedTickets],
      [null, null],
      [headerCell("Tickets cobrados por plan"), headerCell("Cantidad")],
      ...(chargedTicketsByPlanRows.length
        ? chargedTicketsByPlanRows.map(([plan, tickets]) => [metricLabel(plan), tickets])
        : [[metricLabel("Sin tickets cobrados"), 0]]),
      [null, null],
      [metricLabel("Tickets devueltos"), selectedCollectorSummary.pendingTickets],
      [metricLabel("Tickets cobrados en efectivo"), selectedCollectorStats.cashTickets],
      [metricLabel("Monto tickets en efectivo"), moneyCell(selectedCollectorStats.cashAmount)],
      [metricLabel("Tickets cobrados por transferencia"), selectedCollectorStats.transferTickets],
      [metricLabel("Monto tickets por transferencia"), moneyCell(selectedCollectorStats.transferAmount)],
      [metricLabel("Recibos cobrados"), selectedCollectorStats.receiptCount],
      [metricLabel("Monto recibos"), moneyCell(selectedCollectorStats.receiptAmount)],
      [metricLabel("Recibos en efectivo"), selectedCollectorStats.receiptCashCount],
      [metricLabel("Monto recibos en efectivo"), moneyCell(selectedCollectorStats.receiptCashAmount)],
      [metricLabel("Recibos por transferencia"), selectedCollectorStats.receiptTransferCount],
      [metricLabel("Monto recibos por transferencia"), moneyCell(selectedCollectorStats.receiptTransferAmount)],
      [metricLabel("Cobranza total en efectivo"), moneyCell(selectedCollectorStats.totalCashAmount)],
      [metricLabel("Cobranza total por transferencia"), moneyCell(selectedCollectorStats.totalTransferAmount)],
      [metricLabel("Monto total cobrado"), moneyCell(selectedCollectorStats.totalCollectionAmount)],
      [metricLabel("Porcentaje de comisión"), { value: selectedCollectorSummary.appliedCommissionRate / 100, type: Number, format: "0%", align: "right" }],
      [metricLabel("Monto comisión"), moneyCell(selectedCollectorStats.reportCommissionAmount)],
      [metricLabel("Monto a rendir"), moneyCell(selectedCollectorStats.reportRenditionAmount)],
      [metricLabel("Monto pendiente/devoluciones"), moneyCell(selectedCollectorStats.pendingAmount)],
    ];

    const returnedData: any[][] = [
      [
        headerCell("Nombre y apellido"),
        headerCell("Póliza"),
        headerCell("Plan"),
        headerCell("Dependencia"),
        headerCell("Tickets devueltos"),
        headerCell("Monto pendiente"),
        headerCell("Control fisico"),
        headerCell("Observacion"),
      ],
      ...selectedCollectorReturnRows.map(({ affiliate, pendingTickets, pendingAmount, hasPhysicalTickets, observation }) => [
        affiliate.fullName,
        affiliate.policyNumber || "-",
        affiliate.plan,
        affiliate.dependency || "-",
        pendingTickets,
        moneyCell(pendingAmount),
        hasPhysicalTickets ? "PRESENTA TICKETS" : "NO PRESENTA TICKETS",
        observation || (hasPhysicalTickets ? "CONTROLADO PARA DEVOLUCION" : "NO INFORMADO / NO PRESENTADO POR EL COBRADOR"),
      ]),
    ];

    if (selectedCollectorReturnRows.length === 0) {
      returnedData.push([{ value: "SIN DEVOLUCIONES", columnSpan: 8, align: "center", fontWeight: "bold" }]);
    }

    const chargedData: any[][] = [
      [
        headerCell("Nombre y apellido"),
        headerCell("Poliza"),
        headerCell("Plan"),
        headerCell("Dependencia"),
        headerCell("Tickets cobrados"),
        headerCell("Forma de pago"),
        headerCell("Importe cobrado"),
        headerCell("Comprobante"),
      ],
      ...chargedRows.map(({ collection, affiliate, amount }) => [
        affiliate?.fullName || collection.fullName || "-",
        affiliate?.policyNumber || collection.policyNumber || "-",
        affiliate?.plan || collection.plan || "-",
        affiliate?.dependency || collection.dependency || "-",
        collection.ticketsCharged,
        methodLabel(collection.paymentMethod),
        moneyCell(amount),
        collection.transfer?.receiptNumber || collection.transfer?.transactionNumber || "-",
      ]),
    ];

    if (chargedRows.length === 0) {
      chargedData.push([{ value: "SIN TICKETS COBRADOS", columnSpan: 8, align: "center", fontWeight: "bold" }]);
    }

    const safeCollectorName = (selectedCollectorName || "cobrador").toLocaleLowerCase("es-AR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await writeExcelFile([
      {
        data: summaryData,
        sheet: "Resumen",
        columns: [{ width: 38 }, { width: 24 }],
        showGridLines: false,
        stickyRowsCount: 1,
      },
      {
        data: returnedData,
        sheet: "Devoluciones",
        columns: [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 20 }, { width: 20 }, { width: 22 }, { width: 42 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
      {
        data: chargedData,
        sheet: "Tickets cobrados",
        columns: [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
    ]).toFile(`reporte-cobranza-${safeCollectorName}-${activeMonth}.xlsx`);
  };

  const exportGeneralCollectionReportExcel = async () => {
    const canExport = await ensureLatestOnlineDataBeforeReport();
    if (!canExport) return;
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const moneyCell = (value: number) => ({ value, type: Number, format: "$ #,##0", align: "right" as const });
    const metricLabel = (value: string) => ({ value, fontWeight: "bold" as const, backgroundColor: "#E8F0F8" });
    const headerCell = (value: string) => ({
      value,
      fontWeight: "bold" as const,
      backgroundColor: "#0B5CAD",
      textColor: "#FFFFFF",
      align: "center" as const,
      wrap: true,
    });

    const activeVisibleReceipts = visibleReceipts.filter((receipt) => receipt.status !== "anulado" && !receipt.isProduction);
    const ticketAmount = (collection: TicketCollection) => {
      const affiliate = affiliatesById.get(collection.affiliateId);
      return (affiliate?.value ?? collection.ticketValue ?? 0) * collection.ticketsCharged;
    };
    const receiptAmount = (receipt: ReceiptCollection) => receipt.monthCount * receipt.monthlyAmount;
    const ticketCash = visibleTicketCollections.filter((item) => item.paymentMethod === "E");
    const ticketTransfer = visibleTicketCollections.filter((item) => item.paymentMethod === "T");
    const receiptCash = activeVisibleReceipts.filter((item) => item.paymentMethod === "E");
    const receiptTransfer = activeVisibleReceipts.filter((item) => item.paymentMethod === "T");
    const ticketsCharged = visibleTicketCollections.reduce((sum, item) => sum + item.ticketsCharged, 0);
    const receiptCount = new Set(activeVisibleReceipts.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size;
    const visiblePendingTickets = visibleCollectorRows.reduce((sum, row) => sum + row.pendingTickets, 0);
    const ticketCashAmount = ticketCash.reduce((sum, item) => sum + ticketAmount(item), 0);
    const ticketTransferAmount = ticketTransfer.reduce((sum, item) => sum + ticketAmount(item), 0);
    const receiptCashAmount = receiptCash.reduce((sum, item) => sum + receiptAmount(item), 0);
    const receiptTransferAmount = receiptTransfer.reduce((sum, item) => sum + receiptAmount(item), 0);
    const totalCashAmount = ticketCashAmount + receiptCashAmount;
    const totalTransferAmount = ticketTransferAmount + receiptTransferAmount;
    const totalCollectionAmount = totalCashAmount + totalTransferAmount;
    const reportCommissionAmount = visibleCommissionAmount;
    const reportRenditionAmount = totalCollectionAmount - reportCommissionAmount;

    const chargedRows = visibleTicketCollections
      .map((collection) => {
        const affiliate = affiliatesById.get(collection.affiliateId);
        return {
          collection,
          affiliate,
          amount: ticketAmount(collection),
        };
      })
      .sort((a, b) =>
        (a.collection.collector || a.affiliate?.collector || "").localeCompare(b.collection.collector || b.affiliate?.collector || "", "es-AR")
        || (a.affiliate?.plan || a.collection.plan || "").localeCompare(b.affiliate?.plan || b.collection.plan || "", "es-AR", { numeric: true })
        || (a.affiliate?.fullName || a.collection.fullName || "").localeCompare(b.affiliate?.fullName || b.collection.fullName || "", "es-AR")
        || (a.affiliate?.policyNumber || a.collection.policyNumber || "").localeCompare(b.affiliate?.policyNumber || b.collection.policyNumber || "", "es-AR", { numeric: true })
      );

    const returnedRows = affiliates
      .filter((affiliate) => visibleAffiliateIds.has(affiliate.id))
      .map((affiliate) => {
        const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id);
        const tickets = monthly?.tickets || 0;
        const charged = ticketCollections
          .filter((item) => item.month === activeMonth && item.affiliateId === affiliate.id)
          .reduce((sum, item) => sum + item.ticketsCharged, 0);
        const pendingTickets = Math.max(tickets - charged, 0);
        return {
          affiliate,
          pendingTickets,
          pendingAmount: pendingTickets * affiliate.value,
        };
      })
      .filter((row) => row.pendingTickets > 0)
      .sort((a, b) =>
        normalizeCollectorName(a.affiliate.collector || "OFICINA").localeCompare(normalizeCollectorName(b.affiliate.collector || "OFICINA"), "es-AR")
        || a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR")
      );

    const summaryData: any[][] = [
      [{ value: "REPORTE GENERAL DE COBRANZA", columnSpan: 2, fontWeight: "bold", fontSize: 16, backgroundColor: "#0B5CAD", textColor: "#FFFFFF", align: "center" }],
      [metricLabel("Alcance"), "TODOS LOS COBRADORES"],
      [metricLabel("Periodo"), activeMonth],
      [null, null],
      [headerCell("Indicador"), headerCell("Resultado")],
      [metricLabel("Afiliados visibles"), visibleAffiliatesCount],
      [metricLabel("Afiliados seleccionados"), visibleSelectedCount],
      [metricLabel("Tickets recibidos"), visibleMonthlyTickets],
      [metricLabel("Tickets cobrados"), ticketsCharged],
      [metricLabel("Tickets devueltos / pendientes"), visiblePendingTickets],
      [metricLabel("Tickets cobrados en efectivo"), ticketCash.reduce((sum, item) => sum + item.ticketsCharged, 0)],
      [metricLabel("Monto tickets en efectivo"), moneyCell(ticketCashAmount)],
      [metricLabel("Tickets cobrados por transferencia"), ticketTransfer.reduce((sum, item) => sum + item.ticketsCharged, 0)],
      [metricLabel("Monto tickets por transferencia"), moneyCell(ticketTransferAmount)],
      [metricLabel("Recibos cobrados"), receiptCount],
      [metricLabel("Monto recibos"), moneyCell(activeVisibleReceipts.reduce((sum, item) => sum + receiptAmount(item), 0))],
      [metricLabel("Recibos en efectivo"), new Set(receiptCash.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size],
      [metricLabel("Monto recibos en efectivo"), moneyCell(receiptCashAmount)],
      [metricLabel("Recibos por transferencia"), new Set(receiptTransfer.map((receipt) => `${receipt.receiptNumber}-${receipt.plan}`)).size],
      [metricLabel("Monto recibos por transferencia"), moneyCell(receiptTransferAmount)],
      [metricLabel("Cobranza total en efectivo"), moneyCell(totalCashAmount)],
      [metricLabel("Cobranza total por transferencia"), moneyCell(totalTransferAmount)],
      [metricLabel("Monto total cobrado"), moneyCell(totalCollectionAmount)],
      [metricLabel("Monto comisiones"), moneyCell(reportCommissionAmount)],
      [metricLabel("Monto a rendir"), moneyCell(reportRenditionAmount)],
    ];

    const collectorsData: any[][] = [
      [
        headerCell("Cobrador"),
        headerCell("Dependencias"),
        headerCell("Afiliados"),
        headerCell("Tickets recibidos"),
        headerCell("Tickets cobrados"),
        headerCell("Tickets pendientes"),
        headerCell("Monto cobrado"),
        headerCell("% comision"),
        headerCell("Comision"),
        headerCell("A rendir"),
      ],
      ...visibleCollectorRows.map((row) => [
        row.collector,
        row.dependencies.join(", ") || "-",
        row.affiliates,
        row.tickets,
        row.chargedTickets,
        row.pendingTickets,
        moneyCell(row.chargedAmount),
        { value: row.appliedCommissionRate / 100, type: Number, format: "0%", align: "right" as const },
        moneyCell(row.commissionAmount),
        moneyCell(row.amountToRender),
      ]),
    ];

    const plansData: any[][] = [
      [
        headerCell("Plan"),
        headerCell("Tickets recibidos"),
        headerCell("Tickets cobrados"),
        headerCell("Tickets pendientes"),
        headerCell("Tickets efectivo"),
        headerCell("Monto efectivo"),
        headerCell("Tickets transferencia"),
        headerCell("Monto transferencia"),
        headerCell("Recibos"),
        headerCell("Recibos efectivo"),
        headerCell("Monto recibos efectivo"),
        headerCell("Recibos transferencia"),
        headerCell("Monto recibos transferencia"),
      ],
      ...totalsByPlan.map((row) => [
        row.plan,
        row.ticketsReceived,
        row.ticketsCharged,
        row.ticketsNotCharged,
        row.ticketCashCount,
        moneyCell(row.ticketCashAmount),
        row.ticketTransferCount,
        moneyCell(row.ticketTransferAmount),
        row.receiptCount,
        row.receiptCashCount,
        moneyCell(row.receiptCashAmount),
        row.receiptTransferCount,
        moneyCell(row.receiptTransferAmount),
      ]),
    ];

    const chargedData: any[][] = [
      [
        headerCell("Cobrador"),
        headerCell("Nombre y apellido"),
        headerCell("Poliza"),
        headerCell("Plan"),
        headerCell("Dependencia"),
        headerCell("Tickets cobrados"),
        headerCell("Forma de pago"),
        headerCell("Importe cobrado"),
        headerCell("Comprobante"),
      ],
      ...chargedRows.map(({ collection, affiliate, amount }) => [
        collection.collector || affiliate?.collector || "-",
        affiliate?.fullName || collection.fullName || "-",
        affiliate?.policyNumber || collection.policyNumber || "-",
        affiliate?.plan || collection.plan || "-",
        affiliate?.dependency || collection.dependency || "-",
        collection.ticketsCharged,
        methodLabel(collection.paymentMethod),
        moneyCell(amount),
        collection.transfer?.receiptNumber || collection.transfer?.transactionNumber || "-",
      ]),
    ];
    if (chargedRows.length === 0) {
      chargedData.push([{ value: "SIN TICKETS COBRADOS", columnSpan: 9, align: "center", fontWeight: "bold" }]);
    }

    const returnedData: any[][] = [
      [
        headerCell("Cobrador"),
        headerCell("Nombre y apellido"),
        headerCell("Poliza"),
        headerCell("Plan"),
        headerCell("Dependencia"),
        headerCell("Tickets pendientes"),
        headerCell("Monto pendiente"),
      ],
      ...returnedRows.map(({ affiliate, pendingTickets, pendingAmount }) => [
        affiliate.collector || "OFICINA",
        affiliate.fullName,
        affiliate.policyNumber || "-",
        affiliate.plan,
        affiliate.dependency || "-",
        pendingTickets,
        moneyCell(pendingAmount),
      ]),
    ];
    if (returnedRows.length === 0) {
      returnedData.push([{ value: "SIN DEVOLUCIONES", columnSpan: 7, align: "center", fontWeight: "bold" }]);
    }

    const receiptsData: any[][] = [
      [
        headerCell("Cobrador"),
        headerCell("Recibo"),
        headerCell("Nombre y apellido"),
        headerCell("Poliza"),
        headerCell("Plan"),
        headerCell("Meses pagados"),
        headerCell("Cantidad meses"),
        headerCell("Monto mensual"),
        headerCell("Monto total"),
        headerCell("Forma de pago"),
        headerCell("Comprobante"),
      ],
      ...activeVisibleReceipts
        .slice()
        .sort((a, b) => (a.collector || "").localeCompare(b.collector || "", "es-AR") || a.fullName.localeCompare(b.fullName, "es-AR"))
        .map((receipt) => [
          receipt.collector || "-",
          receipt.receiptNumber,
          receipt.fullName,
          receipt.policyNumber || "-",
          receipt.plan,
          (receipt.paidMonths?.length ? receipt.paidMonths : [receipt.paidMonth]).filter(Boolean).join(", "),
          receipt.monthCount,
          moneyCell(receipt.monthlyAmount),
          moneyCell(receiptAmount(receipt)),
          methodLabel(receipt.paymentMethod),
          receipt.transfer?.receiptNumber || receipt.transfer?.transactionNumber || "-",
        ]),
    ];
    if (activeVisibleReceipts.length === 0) {
      receiptsData.push([{ value: "SIN RECIBOS", columnSpan: 11, align: "center", fontWeight: "bold" }]);
    }

    await writeExcelFile([
      {
        data: summaryData,
        sheet: "Resumen",
        columns: [{ width: 38 }, { width: 24 }],
        showGridLines: false,
        stickyRowsCount: 1,
      },
      {
        data: collectorsData,
        sheet: "Por cobrador",
        columns: [{ width: 28 }, { width: 24 }, { width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 20 }, { width: 14 }, { width: 18 }, { width: 18 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
      {
        data: plansData,
        sheet: "Por plan",
        columns: [{ width: 14 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 20 }, { width: 20 }, { width: 14 }, { width: 18 }, { width: 22 }, { width: 22 }, { width: 24 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
      {
        data: chargedData,
        sheet: "Tickets cobrados",
        columns: [{ width: 26 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
      {
        data: returnedData,
        sheet: "Devoluciones",
        columns: [{ width: 26 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 16 }, { width: 18 }, { width: 20 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
      {
        data: receiptsData,
        sheet: "Recibos",
        columns: [{ width: 26 }, { width: 16 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 28 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 }],
        orientation: "landscape",
        stickyRowsCount: 1,
      },
    ]).toFile(`reporte-cobranza-general-${activeMonth}.xlsx`);
  };

  const exportRenditionReportExcel = async () => {
    if (isOfficeUser && !isCollectorUser && adminReportScope === "all") {
      await exportGeneralCollectionReportExcel();
      return;
    }
    await exportCollectorReportExcel();
  };

  const exportReceiptsExcel = async () => {
    const { default: writeExcelFile } = await import("write-excel-file/browser");
    const moneyCell = (value: number) => ({ value, type: Number, format: "$ #,##0", align: "right" as const });
    const numberCell = (value: number) => ({ value, type: Number, format: "0", align: "right" as const });
    const headerCell = (value: string) => ({
      value,
      fontWeight: "bold" as const,
      backgroundColor: "#0B5CAD",
      textColor: "#FFFFFF",
      align: "center" as const,
      wrap: true,
    });
    const titleCell = (value: string, columnSpan: number) => ({
      value,
      columnSpan,
      fontWeight: "bold" as const,
      fontSize: 16,
      backgroundColor: "#0B5CAD",
      textColor: "#FFFFFF",
      align: "center" as const,
    });
    const receiptAmount = (receipt: ReceiptCollection) => receipt.monthCount * receipt.monthlyAmount;
    const safeCollector = currentCollectorName.toLocaleLowerCase("es-AR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cobrador";
    const rows = visibleReceipts
      .slice()
      .sort((a, b) => (a.collector || "").localeCompare(b.collector || "", "es-AR") || a.fullName.localeCompare(b.fullName, "es-AR"));

    const receiptsData: any[][] = [
      [titleCell("REPORTE DE RECIBOS", 14)],
      [{ value: `Periodo: ${activeMonth}`, columnSpan: 14, fontWeight: "bold", align: "center" }],
      [{ value: isOfficeUser ? "Vista administracion" : `Cobrador: ${currentCollectorName || "-"}`, columnSpan: 14, align: "center" }],
      [null],
      [
        headerCell("Estado"),
        headerCell("Tipo"),
        headerCell("N recibo"),
        headerCell("Apellido y nombre"),
        headerCell("Poliza"),
        headerCell("Plan"),
        headerCell("Cobrador"),
        headerCell("Meses pagados"),
        headerCell("Cant. meses"),
        headerCell("Monto mensual"),
        headerCell("Total"),
        headerCell("Metodo"),
        headerCell("Comprobante"),
        headerCell("Observacion"),
      ],
      ...rows.map((receipt) => [
        receipt.status === "anulado" ? "ANULADO" : "ACTIVO",
        receipt.isProduction ? "PRODUCCION" : "COBRANZA",
        receipt.receiptNumber || "-",
        receipt.fullName || "-",
        receipt.policyNumber || "-",
        receipt.plan || "-",
        receipt.collector || "OFICINA",
        receipt.paidMonths?.length ? receipt.paidMonths.map(monthLabel).join(" / ") : monthLabel(receipt.paidMonth),
        numberCell(receipt.monthCount || 0),
        moneyCell(receipt.monthlyAmount || 0),
        moneyCell(receiptAmount(receipt)),
        methodLabel(receipt.paymentMethod),
        receipt.transfer?.receiptNumber || receipt.transfer?.transactionNumber || "-",
        receipt.voidReason || "",
      ]),
    ];

    if (rows.length === 0) {
      receiptsData.push([{ value: "SIN RECIBOS CARGADOS", columnSpan: 14, align: "center", fontWeight: "bold" }]);
    }

    const activeCollectionReceipts = rows.filter((receipt) => receipt.status !== "anulado" && !receipt.isProduction);
    const productionReceipts = rows.filter((receipt) => receipt.status !== "anulado" && receipt.isProduction);
    const voidedReceipts = rows.filter((receipt) => receipt.status === "anulado");
    const summaryData: any[][] = [
      [titleCell("RESUMEN DE RECIBOS", 4)],
      [null],
      [headerCell("Concepto"), headerCell("Cantidad"), headerCell("Importe"), headerCell("Aclaracion")],
      ["Recibos de cobranza", numberCell(activeCollectionReceipts.length), moneyCell(activeCollectionReceipts.reduce((sum, receipt) => sum + receiptAmount(receipt), 0)), "Suman a cobranza"],
      ["Recibos de produccion", numberCell(productionReceipts.length), moneyCell(productionReceipts.reduce((sum, receipt) => sum + receiptAmount(receipt), 0)), "No suman a cobranza"],
      ["Recibos anulados", numberCell(voidedReceipts.length), moneyCell(voidedReceipts.reduce((sum, receipt) => sum + receiptAmount(receipt), 0)), "No suman"],
    ];

    await writeExcelFile([
      {
        data: receiptsData,
        sheet: "Recibos",
        columns: [{ width: 14 }, { width: 16 }, { width: 16 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 24 }, { width: 34 }, { width: 14 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 22 }, { width: 28 }],
        orientation: "landscape",
        stickyRowsCount: 5,
      },
      {
        data: summaryData,
        sheet: "Resumen",
        columns: [{ width: 24 }, { width: 14 }, { width: 18 }, { width: 24 }],
        stickyRowsCount: 3,
      },
    ]).toFile(`recibos-${isOfficeUser ? "general" : safeCollector}-${activeMonth}.xlsx`);
  };

  const addTransferRender = () => {
    const amount = parseNumber(transferRenderForm.amount);
    if (amount <= 0 && !transferRenderForm.proof.trim()) return;
    setRendition((current) => ({
      ...current,
      transferRenders: [...current.transferRenders, { id: `render-${Date.now()}`, date: transferRenderForm.date || today(), amount, proof: transferRenderForm.proof.trim() }],
    }));
    setTransferRenderForm({ date: today(), amount: "", proof: "" });
  };

  const addCashRender = () => {
    const amount = parseNumber(cashRenderForm.amount);
    if (amount <= 0 && !cashRenderForm.detail.trim()) return;
    setRendition((current) => ({
      ...current,
      cashRenders: [...current.cashRenders, { id: `cash-${Date.now()}`, date: cashRenderForm.date || today(), amount, detail: cashRenderForm.detail.trim() }],
    }));
    setCashRenderForm({ date: today(), amount: "", detail: "" });
  };

  const prepareNewCollection = () => {
    const targetMonth = nextCollectionMonth || addMonths(activeMonth, 1);
    const sameMonth = targetMonth === activeMonth;
    const message = sameMonth
      ? `Vas a limpiar los movimientos del mes ${targetMonth}. Esta acción conserva afiliados y cobradores, pero borra tickets cobrados, recibos, novedades y rendición de ese mes.`
      : `Vas a preparar la cobranza ${targetMonth}. Se conservan afiliados, cobradores, dependencias y datos cerrados de ${activeMonth}. Se limpia la rendición y cualquier prueba cargada en ${targetMonth}.`;
    if (!window.confirm(`${message}\n\n¿Continuar?`)) return;

    setActiveMonth(targetMonth);
    setMonthlyItems((current) => current.filter((item) => item.month !== targetMonth));
    setTicketCollections((current) => current.filter((item) => item.month !== targetMonth));
    setReceipts((current) => current.filter((item) => item.collectionMonth !== targetMonth));
    setNotes((current) => current.filter((item) => item.month !== targetMonth));
    setRendition({ cashRenders: [], transferRenders: [] });
    setCollectionPolicy("");
    setCollectionTickets("1");
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
    setMobileSelectedAffiliateId("");
    setMobileNoteText("");
    resetReceiptForm();
    setNextCollectionMonth(addMonths(targetMonth, 1));
    setImportMessage(`Nueva cobranza preparada para ${targetMonth}. Ahora podés importar el listado actualizado.`);
  };

  const saveUserProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!isAdminUser) return;
    if (!userForm.nombre.trim() || !userForm.email.trim() || !userForm.password.trim()) return;
    setIsSavingUser(true);
    setUserAdminStatus("Guardando usuario...");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setIsSavingUser(false);
      setUserAdminStatus("Sesión vencida. Volvé a iniciar sesión.");
      return;
    }

    const response = await fetch("/api/admin-create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nombre: userForm.nombre,
        email: userForm.email,
        password: userForm.password,
        rol: userForm.rol,
        collectorName: userForm.collectorName,
        permisos: userForm.offices.map(officePermission),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setIsSavingUser(false);
    if (!response.ok) {
      setUserAdminStatus(result.error || "No se pudo guardar el usuario.");
      return;
    }
    setUserForm({ nombre: "", email: "", password: "", rol: "cobrador", collectorName: "", offices: [] });
    setUserAdminStatus(result.userAlreadyExists ? "Perfil actualizado." : "Usuario creado.");
    await loadUserProfiles();
  };

  const updateUserProfile = async (profile: UserAdminProfile, patch: Partial<UserAdminProfile>) => {
    if (!isAdminUser) return;
    const payload = {
      nombre: patch.nombre ?? profile.nombre,
      rol: patch.rol ?? profile.rol,
      collector_name: patch.collector_name ?? profile.collector_name ?? "",
      permisos: patch.permisos ?? profile.permisos ?? [],
      activo: patch.activo ?? profile.activo ?? true,
    };
    const { error } = await supabase.from("perfiles_usuarios" as any).update(payload).eq("email", profile.email);
    if (error) {
      setUserAdminStatus(`No se pudo actualizar ${profile.email}: ${error.message}`);
      return;
    }
    setUserAdminStatus("Usuario actualizado.");
    await loadUserProfiles();
  };

  const toggleOfficePermission = (currentPermisos: string[] | null | undefined, office: string, checked: boolean) => {
    const permission = officePermission(office);
    const otherPermissions = (currentPermisos || []).filter((item) => !item.toLocaleLowerCase("es-AR").startsWith(officePermissionPrefix));
    const currentOffices = new Set(officesFromPermissions(currentPermisos));
    if (checked) currentOffices.add(office);
    else currentOffices.delete(office);
    return [...otherPermissions, ...Array.from(currentOffices).map(officePermission)];
  };

  const navItems: Array<{ id: Section; label: string; icon: typeof ClipboardList }> = [
    { id: "Base", label: "Base de afiliados", icon: ClipboardList },
    { id: "CobradorMovil", label: "Vista cobrador", icon: Smartphone },
    { id: "Cobradores", label: "Cobradores", icon: Users },
    { id: "Mensual", label: "Cobranza mensual", icon: CheckSquare },
    { id: "Cobranza", label: "Cobranza", icon: Banknote },
    { id: "Recibos", label: "Recibos", icon: ReceiptText },
    { id: "Pedidos", label: "Pedidos", icon: ClipboardList },
    { id: "Novedades", label: "Novedades", icon: ClipboardList },
    { id: "Totales", label: "Totales", icon: Calculator },
    { id: "Rendicion", label: "Rendición", icon: ShieldCheck },
    { id: "Usuarios", label: "Usuarios", icon: UserPlus },
  ];
  const visibleNavItems = navItems.filter((item) => {
    if (item.id === "Usuarios") return isAdminUser;
    if (isOfficeUser) return true;
    return ["CobradorMovil", "Cobranza", "Recibos", "Pedidos", "Novedades", "Rendicion"].includes(item.id);
  });

  const forceUppercaseInput = (event: React.FormEvent<HTMLElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    const type = target instanceof HTMLInputElement ? target.type : "textarea";
    if (["email", "password", "number", "date", "month", "time"].includes(type)) return;
    const upperValue = target.value.toLocaleUpperCase("es-AR");
    if (target.value === upperValue) return;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    target.value = upperValue;
    if (start !== null && end !== null) target.setSelectionRange(start, end);
  };

  useEffect(() => {
    if (activeSection === "Caja" && isOfficeUser) return;
    if (!visibleNavItems.some((item) => item.id === activeSection)) {
      setActiveSection(visibleNavItems[0]?.id || "CobradorMovil");
    }
  }, [activeSection, isOfficeUser, visibleNavItems]);

  const needsOfficeSelection = isOfficeUser && !isAdminUser && assignedOfficeOptions.length > 1 && !activeOffice;

  if (sessionBlockMessage) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4 text-foreground">
        <div className="w-full max-w-lg rounded-md border bg-card p-8 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-4 text-xl font-semibold">Sesion activa detectada</h1>
          <p className="mt-3 text-sm text-muted-foreground">{sessionBlockMessage}</p>
          <Button type="button" className="mt-6" variant="outline" onClick={handleSignOut}>
            Cerrar sesion
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground" onInputCapture={forceUppercaseInput}>
      <div className="border-b bg-card">
        <div className="flex w-full flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground sm:h-11 sm:w-11">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Sistema de afiliados y cobranza</h1>
              <p className="text-sm text-muted-foreground">Base de datos, cobranza mensual, recibos, totales y rendición</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentUserProfile?.nombre || userEmail} · {userRole || "sin rol"}{currentCollectorName ? ` · ${currentCollectorName}` : ""}
              </p>
            </div>
          </div>
          {isOfficeUser && !isAdminUser && (
            <div className="rounded-md border bg-surface-subtle px-4 py-3 text-sm lg:min-w-[260px]">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Oficina activa</p>
              <p className="mt-1 text-base font-semibold">{activeOffice || "Seleccionar oficina"}</p>
              <p className="mt-1 text-xs text-muted-foreground">Para cambiarla, cerrar sesion y volver a ingresar.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <div className="col-span-2 flex h-10 items-center gap-2 rounded-md border bg-background px-3 sm:col-span-1">
              <Label htmlFor="active-month" className="mb-0 text-xs text-muted-foreground">Mes</Label>
              <Input id="active-month" type="month" value={activeMonth} onChange={(event) => setActiveMonth(event.target.value || currentMonth())} className="h-8 w-36 border-0 p-0 shadow-none focus-visible:ring-0" />
            </div>
            {isOfficeUser && <Button type="button" variant="command" className="w-full sm:w-auto" onClick={() => openAffiliateForm()}>
              <Plus className="h-4 w-4" />
              Nuevo afiliado
            </Button>}
            {isOfficeUser && <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-4">
              <Upload className="h-4 w-4" />
              Importar CSV cobranza
              <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
            </label>}
            {isOfficeUser && <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={exportAffiliatesExcel}>
              <FileSpreadsheet className="h-4 w-4" />
              Exportar base Excel
            </Button>}
            {canUseManualSync && <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={loadCloudSnapshot} disabled={cloudBusy}>
              Cargar online
            </Button>}
            {canUseManualSync && <Button type="button" variant="command" className="w-full sm:w-auto" onClick={() => saveCloudSnapshot()} disabled={cloudBusy}>
              Guardar online
            </Button>}
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </div>
        <div className="px-3 pb-3 text-xs text-muted-foreground sm:px-5">{cloudStatus}</div>
      </div>

      <div className="grid w-full gap-4 px-3 py-4 sm:px-5 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {needsOfficeSelection && (
          <section className="rounded-md border bg-card p-5 lg:col-span-2">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-xl font-semibold">Seleccionar oficina</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Elegi la oficina donde vas a trabajar en este turno. La seleccion queda fija hasta cerrar sesion.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {assignedOfficeOptions.map((office) => (
                  <Button key={office} type="button" variant="command" className="h-14 text-base" onClick={() => activateOffice(office)}>
                    {office}
                  </Button>
                ))}
              </div>
              <p className="mt-4 rounded-md border bg-surface-subtle px-3 py-2 text-sm font-medium text-muted-foreground">
                Si elegis una oficina incorrecta, cerra sesion y volve a ingresar.
              </p>
            </div>
          </section>
        )}
        <aside className={`${needsOfficeSelection ? "hidden" : ""} rounded-md border bg-card p-3 sm:p-4 lg:sticky lg:top-4 lg:self-start`}>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Módulo</p>
            <div className="mt-2 grid gap-2">
              <button
                type="button"
                className={`rounded-md border p-3 text-left transition ${activeSection !== "Caja" ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                onClick={() => setActiveSection(isOfficeUser ? "Base" : "CobradorMovil")}
              >
                <span className="block text-base font-semibold leading-tight">Cobranza Tres Provincias</span>
                <span className={`mt-1 block text-xs ${activeSection !== "Caja" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Cartera, cobradores, tickets y rendición.</span>
              </button>
              {isOfficeUser && (
                <button
                  type="button"
                  className={`rounded-md border p-3 text-left transition ${activeSection === "Caja" ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
                  onClick={() => setActiveSection("Caja")}
                >
                  <span className="block text-base font-semibold leading-tight">Caja</span>
                  <span className={`mt-1 block text-xs ${activeSection === "Caja" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>Movimientos, ingresos, egresos y saldos.</span>
                </button>
              )}
            </div>
          </div>
          <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{currentUserProfile?.nombre || userEmail || "Usuario"}</p>
            <p className="mt-1">{userRole || "sin rol"}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full" onClick={handleSignOut}>
              Cerrar sesión
            </Button>
          </div>
        </aside>

        <div className={`${needsOfficeSelection ? "hidden" : ""} grid min-w-0 gap-4 sm:gap-5`}>
        {affiliateImportPreview && (
          <section className="rounded-md border bg-card p-3 sm:p-4">
            <div className="rounded-md border bg-surface-subtle p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">Previsualización de importación</h2>
                    <span className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">IMPORTADOR MENSUAL V2</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{affiliateImportPreview.source} · {affiliateImportPreview.rows.length} afiliados leídos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.newRows.length}</strong> nuevos</span>
                  <span className="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-900"><strong>{affiliateImportPreview.newPolicyRows.length}</strong> polizas nuevas</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.existingCount}</strong> existentes</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.changedRows.length}</strong> con cambios</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.duplicatedCount}</strong> duplicados</span>
                </div>
              </div>
              {affiliateImportPreview.newPolicyRows.length > 0 && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="text-sm font-semibold text-amber-950">Polizas nuevas respecto del mes anterior</h3>
                    <p className="text-xs font-medium text-amber-900">{affiliateImportPreview.newPolicyRows.length} para revisar antes de aplicar</p>
                  </div>
                  <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                    {affiliateImportPreview.newPolicyRows.slice(0, 40).map((item) => (
                      <div key={`new-policy-${item.id}`} className="grid gap-2 rounded-md bg-card px-3 py-2 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                        <div>
                          <strong>{item.fullName || "Sin nombre"}</strong>
                          <p className="mt-1 text-xs text-muted-foreground">Poliza {item.policyNumber || "-"} · {item.plan} · Dep. {item.dependency || "-"} · {item.sourceTickets || 0} tickets · {currency.format(item.value)}</p>
                        </div>
                        <span className="rounded bg-surface-subtle px-2 py-1 text-xs font-semibold text-foreground">Destino inicial: {item.collector || "OFICINA"}</span>
                      </div>
                    ))}
                    {affiliateImportPreview.newPolicyRows.length > 40 && <p className="text-xs text-amber-900">Mostrando 40 de {affiliateImportPreview.newPolicyRows.length} polizas nuevas.</p>}
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border bg-card p-3">
                  <h3 className="text-sm font-semibold">Nuevos afiliados</h3>
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {affiliateImportPreview.newRows.slice(0, 12).map((item) => (
                      <div key={`new-${item.id}`} className="rounded-md bg-surface-subtle px-3 py-2 text-sm">
                        <strong>{item.fullName || "Sin nombre"}</strong>
                        <p className="mt-1 text-xs font-medium text-foreground">Dep. {item.dependency || "-"} · Destino inicial: {item.collector || "OFICINA"}</p>
                        <p className="text-xs text-muted-foreground">Póliza {item.policyNumber || "-"} · {item.plan} · {item.sourceTickets || 0} tickets · {currency.format(item.value)}</p>
                      </div>
                    ))}
                    {affiliateImportPreview.newRows.length === 0 && <p className="text-sm text-muted-foreground">No hay afiliados nuevos.</p>}
                    {affiliateImportPreview.newRows.length > 12 && <p className="text-xs text-muted-foreground">Mostrando 12 de {affiliateImportPreview.newRows.length}.</p>}
                  </div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <h3 className="text-sm font-semibold">Cambios detectados</h3>
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {affiliateImportPreview.changedRows.slice(0, 12).map(({ incoming, fields }) => (
                      <div key={`changed-${incoming.id}`} className="rounded-md bg-surface-subtle px-3 py-2 text-sm">
                        <strong>{incoming.fullName || "Sin nombre"}</strong>
                        <p className="text-xs text-muted-foreground">Póliza {incoming.policyNumber || "-"} · cambia {fields.join(", ")}</p>
                      </div>
                    ))}
                    {affiliateImportPreview.changedRows.length === 0 && <p className="text-sm text-muted-foreground">No hay cambios en afiliados existentes.</p>}
                    {affiliateImportPreview.changedRows.length > 12 && <p className="text-xs text-muted-foreground">Mostrando 12 de {affiliateImportPreview.changedRows.length}.</p>}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAffiliateImportPreview(null)}>Cancelar</Button>
                <Button type="button" variant="command" onClick={() => importAffiliates(affiliateImportPreview.rows)}>Aplicar importación</Button>
              </div>
            </div>
          </section>
        )}

        {activeSection !== "Caja" && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ["Afiliados", visibleAffiliatesCount, isOfficeUser ? "Clientes en base" : "Tu cartera asignada"],
                ["Seleccionados", visibleSelectedCount, isOfficeUser ? "Pasan a cobranza mensual" : "En tu cobranza mensual"],
                ["Tickets mensuales", visibleMonthlyTickets, isOfficeUser ? "Tickets recibidos" : "Tus tickets recibidos"],
                ["Pedidos", requestRows.filter((item) => !item.answered).length, isOfficeUser ? "Solicitudes pendientes" : "Tus pedidos pendientes"],
                ["Novedades", visibleNotesCount, isOfficeUser ? "Cargadas en el mes" : "Tus novedades del mes"],
                ["Total a rendir", currency.format(visibleTotalToRender), visibleTotalLabel],
              ].map(([label, value, helper]) => (
                <div key={String(label)} className="rounded-md border bg-card p-3 shadow-command sm:p-4">
                  <p className="text-sm font-medium text-muted-foreground">{String(label)}</p>
                  <p className="mt-2 text-2xl font-semibold sm:text-3xl">{String(value)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{String(helper)}</p>
                </div>
              ))}
            </section>

            {monthlyNewPolicyRows.length > 0 && (
              <section className="rounded-md border border-amber-200 bg-amber-50 p-3 sm:p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-amber-950">Polizas nuevas del mes</h2>
                    <p className="mt-1 text-sm text-amber-900">Quedan visibles durante {activeMonth} para control y asignacion.</p>
                  </div>
                  <span className="rounded-md bg-card px-3 py-2 text-sm font-semibold text-amber-950">{monthlyNewPolicyRows.length} polizas</span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {monthlyNewPolicyRows.slice(0, 18).map((item) => (
                    <div key={`monthly-new-${item.id}`} className="rounded-md border bg-card px-3 py-2 text-sm">
                      <strong>{item.fullName || "Sin nombre"}</strong>
                      <p className="mt-1 text-xs text-muted-foreground">Poliza {item.policyNumber || "-"} · {item.plan} · Dep. {item.dependency || "-"} · {monthlyTicketsByAffiliate.get(item.id) || item.sourceTickets || 0} tickets · {currency.format(item.value)}</p>
                      <p className="mt-1 text-xs font-medium text-foreground">Cobrador: {item.collector || "OFICINA"}</p>
                    </div>
                  ))}
                </div>
                {monthlyNewPolicyRows.length > 18 && <p className="mt-2 text-xs text-amber-900">Mostrando 18 de {monthlyNewPolicyRows.length}. El listado completo queda disponible en la base filtrando/buscando por poliza o cobrador.</p>}
              </section>
            )}

            <nav className="grid grid-cols-2 gap-2 rounded-md border bg-card p-2 sm:flex sm:flex-wrap">
              {visibleNavItems.map(({ id, label, icon: Icon }) => (
                <Button key={id} type="button" className="justify-start sm:justify-center" variant={activeSection === id ? "command" : "ghost"} onClick={() => setActiveSection(id)}>
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </nav>
          </>
        )}

        {activeSection === "Base" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative w-full flex-1 lg:max-w-lg">
                  <Label htmlFor="base-search" className="sr-only">Buscar</Label>
                  <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="base-search" className="pl-9" placeholder="Buscar por nombre, póliza o plan" value={query} onChange={(event) => setQuery(event.target.value)} />
                </div>
                <div className="w-full space-y-1 lg:w-56">
                  <Label htmlFor="collector-whatsapp">WhatsApp cobrador 001</Label>
                  <Input id="collector-whatsapp" value={collectorWhatsapp} onChange={(event) => setCollectorWhatsapp(event.target.value)} placeholder="549..." />
                </div>
                <div className="w-full space-y-1 lg:w-56">
                  <Label htmlFor="pending-filter">Tickets pendientes</Label>
                  <select
                    id="pending-filter"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={pendingFilter}
                    onChange={(event) => setPendingFilter(event.target.value)}
                  >
                    <option value="todos">Todos</option>
                    <option value="con">Con pendientes</option>
                    <option value="sin">Sin pendientes</option>
                    <option value="mayor">Mas pendientes primero</option>
                  </select>
                </div>
                <div className="w-full space-y-1 lg:w-48">
                  <Label htmlFor="dependency-filter">Dependencia</Label>
                  <select
                    id="dependency-filter"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={dependencyFilter}
                    onChange={(event) => setDependencyFilter(event.target.value)}
                  >
                    <option value="todos">Todas</option>
                    {visibleDependenciesForCobranza.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
                  </select>
                </div>
                <div className="w-full space-y-1 lg:w-48">
                  <Label htmlFor="collector-filter">Cobrador</Label>
                  <select
                    id="collector-filter"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={collectorFilter}
                    onChange={(event) => setCollectorFilter(event.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                  </select>
                </div>
                <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={() => setAllFilteredMonthly(true)}>Tildar todos</Button>
                  <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={() => setAllFilteredMonthly(false)}>Destildar todos</Button>
                </div>
              </div>
            </div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para ver todas las columnas.</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-16 px-2 py-3 text-center">Sel.</th>
                    <th className="w-56 px-3 py-3 text-left">Nombre y apellido</th>
                    <th className="px-4 py-3 text-left">Póliza</th>
                    <th className="w-20 px-3 py-3 text-left">Plan</th>
                    <th className="w-24 px-3 py-3 text-left">Dep.</th>
                    <th className="w-28 px-3 py-3 text-left">Cobrador</th>
                    <th className="w-28 px-3 py-3 text-right">Valor</th>
                    <th className="w-20 px-2 py-3 text-center">Tickets mes</th>
                    <th className="w-24 px-2 py-3 text-center">Pendientes</th>
                    <th className="w-96 px-3 py-3 text-left">Pedido</th>
                    <th className="w-96 px-3 py-3 text-left">Novedad</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAffiliates.map((item) => (
                    <tr key={item.id}>
                      <td className="w-16 px-2 py-3 text-center"><input type="checkbox" checked={item.selectedForMonthly} onChange={(event) => toggleMonthly(item.id, event.target.checked)} className="h-4 w-4" /></td>
                      <td className="w-56 px-3 py-3 font-medium leading-tight">{item.fullName}</td>
                      <td className="px-4 py-3">{item.policyNumber || "-"}</td>
                      <td className="w-20 px-3 py-3">{item.plan}</td>
                      <td className="w-24 px-2 py-3">
                        <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={item.dependency || "SIN DEFINIR"} onChange={(event) => updateAffiliateDependency(item.id, event.target.value)}>
                          {visibleDependenciesForCobranza.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
                        </select>
                      </td>
                      <td className="w-28 px-2 py-3">
                        <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 w-full justify-start px-2 py-1 text-left text-xs" onClick={() => setCollectorPickerAffiliateId(item.id)}>
                          {item.collector || "OFICINA"}
                        </Button>
                      </td>
                      <td className="w-28 px-3 py-3 text-right">{currency.format(item.value)}</td>
                      <td className="w-20 px-2 py-3 text-center">{monthlyTicketsByAffiliate.get(item.id) || 0}</td>
                      <td className="w-24 px-2 py-3 text-center">{getPendingTickets(item.id)}</td>
                      <td className="w-96 px-3 py-3">
                        <div className="flex items-start gap-2">
                          <Textarea className="min-h-20 text-xs sm:text-sm" value={item.request || ""} onChange={(event) => updateAffiliateRequest(item.id, event.target.value)} placeholder="Pedir info" />
                          <Button type="button" size="sm" variant="outline" onClick={() => saveRequestOrNews(item.id, { request: item.request || "" })} disabled={cloudBusy}>Guardar</Button>
                        </div>
                      </td>
                      <td className="w-96 px-3 py-3">
                        <div className="flex items-start gap-2">
                          <Textarea className="min-h-20 text-xs sm:text-sm" value={item.latestNews || ""} onChange={(event) => updateAffiliateNews(item.id, event.target.value)} placeholder="Respuesta / novedad" />
                          <Button type="button" size="sm" variant="outline" onClick={() => saveRequestOrNews(item.id, { latestNews: item.latestNews || "" })} disabled={cloudBusy}>Guardar</Button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const url = getWhatsappUrl(item);
                              if (url) window.open(url, "_blank", "noopener,noreferrer");
                              else alert("Cargá primero el WhatsApp del cobrador 001.");
                            }}
                          >
                            WhatsApp
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => openAffiliateForm(item)}>Editar</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "CobradorMovil" && (
          <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-md border bg-card">
              <div className="border-b p-3 sm:p-4">
                <h2 className="font-semibold">Vista cobrador</h2>
                <p className="text-sm text-muted-foreground">Búsqueda rápida de tickets pendientes para cobrar desde el celular.</p>
              </div>
              <div className="grid gap-3 border-b p-3 sm:grid-cols-2 md:grid-cols-3 sm:p-4">
                {isOfficeUser && <div className="space-y-1">
                  <Label htmlFor="mobile-collector">Cobrador</Label>
                  <select
                    id="mobile-collector"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mobileCollector}
                    onChange={(event) => setMobileCollector(event.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                  </select>
                </div>}
                <div className="space-y-1">
                  <Label htmlFor="mobile-search">Buscar</Label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="mobile-search"
                      className="pl-9"
                      value={mobileSearch}
                      onChange={(event) => setMobileSearch(event.target.value)}
                      placeholder="Póliza, nombre o plan"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="mobile-ticket-filter">Mostrar</Label>
                  <select
                    id="mobile-ticket-filter"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mobileTicketFilter}
                    onChange={(event) => setMobileTicketFilter(event.target.value as "pending" | "all" | "paid")}
                  >
                    <option value="pending">Pendientes</option>
                    <option value="all">Todas</option>
                    <option value="paid">Cobradas</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-2 p-2 sm:p-3">
                {mobileCollectorRows.map(({ affiliate, pending }) => {
                  const selected = mobileSelectedAffiliateId === affiliate.id || selectedMonthlyAffiliate?.id === affiliate.id;
                  return (
                    <button
                      key={affiliate.id}
                      type="button"
                      className={`rounded-md border px-3 py-2 text-left transition hover:bg-accent ${selected ? "border-primary bg-primary/5" : "bg-background"}`}
                      onClick={() => openMobileCollection(affiliate)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight">{affiliate.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Póliza {affiliate.policyNumber} · {affiliate.plan} · Dep. {affiliate.dependency || "-"}</p>
                          {canUseManualSync && <p className="mt-1 text-xs text-muted-foreground">Cobrador: {affiliate.collector || "OFICINA"}</p>}
                        </div>
                        <div className="shrink-0 rounded-md bg-surface-subtle px-2.5 py-1.5 text-center">
                          <p className="text-lg font-semibold leading-tight">{pending}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">{pending > 0 ? "pend." : "cobr."}</p>
                        </div>
                      </div>
                      {affiliate.request?.trim() && (
                        <p className="mt-2 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-xs font-semibold text-red-950">Pedido: {affiliate.request}</p>
                      )}
                    </button>
                  );
                })}
                {mobileCollectorRows.length === 0 && (
                  <div className="rounded-md border bg-surface-subtle p-4 text-center text-sm text-muted-foreground">
                    No hay tickets pendientes para este filtro.
                  </div>
                )}
              </div>
            </div>

            <form className="rounded-md border bg-card p-3 sm:p-4 lg:sticky lg:top-4 lg:self-start" onSubmit={saveTicketCollection}>
              <h2 className="font-semibold">Cobro rápido</h2>
              {mobileSelectedAffiliate ? (
                <div className="mt-3 rounded-md border bg-surface-subtle p-3 text-sm">
                  <strong>{mobileSelectedAffiliate.fullName}</strong>
                  {selectedAffiliateIsFromOtherCollector && (
                    <p className="mt-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 font-semibold text-amber-900">
                      {otherCollectorWarningText} Si lo cobras, quedara registrada una novedad automatica.
                    </p>
                  )}
                  <p className="mt-1 text-muted-foreground">Póliza {mobileSelectedAffiliate.policyNumber} · {mobileSelectedAffiliate.plan}</p>
                  <p className="mt-1 text-muted-foreground">Pendientes: {ticketsToCharge} · Ticket: {currency.format(mobileSelectedAffiliate.value)}</p>
                </div>
              ) : (
                <p className="mt-3 rounded-md border bg-surface-subtle p-3 text-sm text-muted-foreground">Seleccioná un afiliado de la lista para cargar el cobro.</p>
              )}

              {selectedMonthlyAffiliate?.request?.trim() && (
                <div className="mt-3 rounded-md border border-red-300 bg-red-100 p-3 text-sm text-red-950">
                  <p className="font-semibold">Pedido obligatorio</p>
                  <p className="mt-1">{selectedMonthlyAffiliate.request}</p>
                  <div className="mt-3 space-y-1">
                    <Label htmlFor="mobile-request-answer">Respuesta del cobrador</Label>
                    <div className="flex gap-2">
                      <Input
                        id="mobile-request-answer"
                        value={selectedMonthlyAffiliate.latestNews || ""}
                        onChange={(event) => updateAffiliateNews(selectedMonthlyAffiliate.id, event.target.value)}
                        placeholder="Dato informado o motivo"
                      />
                      <Button type="button" variant="command" onClick={() => saveRequestOrNews(selectedMonthlyAffiliate.id, { latestNews: selectedMonthlyAffiliate.latestNews || "" })} disabled={cloudBusy}>Guardar</Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-3">
                <div className="space-y-1">
                  <Label>Tickets cobrados</Label>
                  <Input type="number" min="0" max={ticketsToCharge} value={collectionTickets} onChange={(event) => setCollectionTickets(event.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Forma de pago</Label>
                  <select value={collectionMethod} onChange={(event) => setCollectionMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="E">E - efectivo</option>
                    <option value="T">T - transferencia</option>
                  </select>
                </div>
              </div>
              {collectionMethod === "T" && <TransferFields value={collectionTransfer} onChange={setCollectionTransfer} />}

              <div className="mt-4 space-y-2">
                <Label htmlFor="mobile-note">Novedad libre</Label>
                <Textarea
                  id="mobile-note"
                  value={mobileNoteText}
                  onChange={(event) => setMobileNoteText(event.target.value)}
                  placeholder="Ej: no estaba, cambió teléfono, promete pagar..."
                />
                <Button type="button" className="w-full" variant="outline" disabled={!mobileSelectedAffiliate || !mobileNoteText.trim()} onClick={saveMobileNote}>Guardar novedad</Button>
              </div>

              {hasUnansweredRequest && <p className="mt-3 text-sm text-amber-700">Para guardar el cobro, primero respondé el pedido pendiente.</p>}
              <Button type="submit" className="mt-4 w-full" variant="command" disabled={isSavingTicketCollection || !selectedMonthlyAffiliate || ticketsToCharge <= 0 || hasUnansweredRequest}>{isSavingTicketCollection ? "Guardando..." : "Guardar cobro"}</Button>
              {canUseManualSync && <Button type="button" className="mt-2 w-full" variant="outline" onClick={() => saveCloudSnapshot()} disabled={cloudBusy}>Guardar online</Button>}
            </form>
          </section>
        )}

        {activeSection === "Cobradores" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="flex flex-col gap-3 border-b p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="font-semibold">Cobradores</h2>
              <Button type="button" variant="outline" onClick={() => setCollectorSettingsOpen(true)}>
                Configurar cobradores y dependencias
              </Button>
              <p className="text-sm text-muted-foreground">Resumen de cartera por cobrador para el período {activeMonth}.</p>
            </div>
            <Dialog open={collectorSettingsOpen} onOpenChange={setCollectorSettingsOpen}>
              <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Configurar cobradores y dependencias</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-md border bg-surface-subtle p-3">
                <h3 className="font-semibold">Agregar / modificar cobrador</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="new-collector">Nombre y apellido</Label>
                    <Input id="new-collector" value={newCollectorName} onChange={(event) => setNewCollectorName(event.target.value)} placeholder="Ej: JUAN PEREZ" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-collector-phone">Teléfono</Label>
                    <Input id="new-collector-phone" value={newCollectorPhone} onChange={(event) => setNewCollectorPhone(event.target.value)} placeholder="549..." />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-collector-commission">% comisión</Label>
                    <Input id="new-collector-commission" type="number" min="0" step="0.1" value={newCollectorCommission} onChange={(event) => setNewCollectorCommission(event.target.value)} />
                  </div>
                  <Button type="button" variant="command" className="self-end" onClick={addCollector}>Agregar</Button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={newCollectorBonusEnabled} onChange={(event) => setNewCollectorBonusEnabled(event.target.checked)} />
                  Tiene premio: si cobra 90% o más, pasa al 13%
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_120px_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="collector-to-rename">Cobrador actual</Label>
                    <select id="collector-to-rename" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={collectorToRename} onChange={(event) => selectCollectorToEdit(event.target.value)}>
                      <option value="">Seleccionar</option>
                      {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="collector-rename-value">Nuevo nombre</Label>
                    <Input id="collector-rename-value" value={collectorRenameValue} onChange={(event) => setCollectorRenameValue(event.target.value)} placeholder="Nuevo nombre" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="collector-phone-value">Teléfono</Label>
                    <Input id="collector-phone-value" value={collectorPhoneValue} onChange={(event) => setCollectorPhoneValue(event.target.value)} placeholder="549..." />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="collector-commission-value">% comisión</Label>
                    <Input id="collector-commission-value" type="number" min="0" step="0.1" value={collectorCommissionValue} onChange={(event) => setCollectorCommissionValue(event.target.value)} />
                  </div>
                  <Button type="button" variant="outline" className="self-end" onClick={renameCollector}>Modificar</Button>
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={collectorBonusEnabled} onChange={(event) => setCollectorBonusEnabled(event.target.checked)} />
                  Tiene premio: si cobra 90% o más, pasa al 13%
                </label>
                <div className="mt-4 rounded-md border bg-background p-3">
                  <h4 className="font-semibold">Combinar / reasignar cobradores</h4>
                  <p className="mt-1 text-xs text-muted-foreground">Pasa toda la cartera del cobrador origen al cobrador correcto y elimina el origen si queda sin afiliados.</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <div className="space-y-1">
                      <Label htmlFor="collector-merge-from">Cobrador origen</Label>
                      <select id="collector-merge-from" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={collectorMergeFrom} onChange={(event) => setCollectorMergeFrom(event.target.value)}>
                        <option value="">Seleccionar</option>
                        {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="collector-merge-to">Cobrador correcto</Label>
                      <select id="collector-merge-to" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={collectorMergeTo} onChange={(event) => setCollectorMergeTo(event.target.value)}>
                        <option value="">Seleccionar</option>
                        {visibleCollectorsForCobranza.filter((collector) => collector !== collectorMergeFrom).map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                      </select>
                    </div>
                    <Button type="button" variant="command" className="self-end" disabled={!collectorMergeFrom || !collectorMergeTo || collectorMergeFrom === collectorMergeTo} onClick={mergeCollectors}>Combinar</Button>
                  </div>
                </div>
              </div>

              <div className="rounded-md border bg-surface-subtle p-3">
                <h3 className="font-semibold">Agregar / modificar dependencia</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="new-dependency">Nueva dependencia</Label>
                    <Input id="new-dependency" value={newDependencyName} onChange={(event) => setNewDependencyName(event.target.value)} placeholder="Ej: 328" />
                  </div>
                  <Button type="button" variant="command" className="self-end" onClick={addDependency}>Agregar</Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="dependency-to-rename">Dependencia actual</Label>
                    <select id="dependency-to-rename" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={dependencyToRename} onChange={(event) => setDependencyToRename(event.target.value)}>
                      <option value="">Seleccionar</option>
                      {visibleDependenciesForCobranza.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dependency-rename-value">Nuevo nombre</Label>
                    <Input id="dependency-rename-value" value={dependencyRenameValue} onChange={(event) => setDependencyRenameValue(event.target.value)} placeholder="Nuevo nombre" />
                  </div>
                  <Button type="button" variant="outline" className="self-end" onClick={renameDependency}>Modificar</Button>
                </div>
              </div>
            </div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para ver el resumen completo.</div>
              </DialogContent>
            </Dialog>
            {bonusCollectorRows.length > 0 && (
              <div className="border-b bg-emerald-50 p-3 text-emerald-950 sm:p-4">
                <h3 className="font-semibold">Felicitaciones, objetivo alcanzado</h3>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {bonusCollectorRows.filter((row) => visibleCollectorsForCobranza.includes(row.collector)).map((row) => (
                    <div key={`bonus-${row.collector}`} className="rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm">
                      <strong>{row.collector}</strong> logró {row.effectiveness.toFixed(1)}% de cobranza. Su comisión pasa al {row.appliedCommissionRate}%.
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="border-b p-3 sm:p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="font-semibold">Vista por cobrador</h3>
                  <p className="text-sm text-muted-foreground">Elegí un cobrador para revisar su cartera, tickets pendientes y cobranza del período.</p>
                </div>
                <div className="w-full space-y-1 lg:w-72">
                  <div className="space-y-1">
                  <Label htmlFor="collector-detail-name">Cobrador</Label>
                  <select
                    id="collector-detail-name"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={selectedCollectorName}
                    onChange={(event) => setCollectorDetailName(event.target.value)}
                  >
                    {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                  </select>
                  </div>
                </div>
              </div>

              {selectedCollectorSummary && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryBox label="Afiliados" value={String(selectedCollectorSummary.affiliates)} />
                  <SummaryBox label="Tickets recibidos" value={String(selectedCollectorSummary.tickets)} />
                  <SummaryBox label="Tickets cobrados" value={String(selectedCollectorSummary.chargedTickets)} />
                  <SummaryBox label="Tickets pendientes" value={String(selectedCollectorSummary.pendingTickets)} />
                  <SummaryBox label="Monto asignado" value={currency.format(selectedCollectorSummary.assignedAmount)} />
                  <SummaryBox label="Tickets $" value={currency.format(selectedCollectorSummary.ticketChargedAmount)} />
                  <SummaryBox label="Recibos" value={`${selectedCollectorSummary.receiptCount} - ${currency.format(selectedCollectorSummary.receiptAmount)}`} />
                  <SummaryBox label="Cobrado total" value={currency.format(selectedCollectorSummary.chargedAmount)} />
                  <SummaryBox label="Pendiente $" value={currency.format(selectedCollectorStats.pendingAmount)} />
                  <SummaryBox label="Efectividad" value={`${selectedCollectorSummary.effectiveness.toFixed(1)}%`} />
                  <SummaryBox label="Efectivo" value={currency.format(selectedCollectorStats.totalCashAmount)} />
                  <SummaryBox label="Transferencia" value={currency.format(selectedCollectorStats.totalTransferAmount)} />
                  <SummaryBox label="Comisión" value={currency.format(selectedCollectorSummary.commissionAmount)} />
                  <SummaryBox label="A rendir" value={currency.format(selectedCollectorSummary.amountToRender)} />
                </div>
              )}

              {selectedCollectorSummary && (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-md border bg-surface-subtle p-3">
                    <p className="text-sm font-medium text-muted-foreground">Comisión del cobrador</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedCollectorSummary.appliedCommissionRate}%</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Base {selectedCollectorSummary.commissionBase}%{selectedCollectorSummary.bonusEnabled ? ` · Premio al ${selectedCollectorSummary.bonusThreshold}%: ${selectedCollectorSummary.bonusAchieved ? "logrado" : "pendiente"}` : " · Sin premio"}
                    </p>
                  </div>
                  <div className="rounded-md border bg-surface-subtle p-3">
                    <p className="text-sm font-medium text-muted-foreground">Tickets por forma de pago</p>
                    <p className="mt-2 text-lg font-semibold">E: {selectedCollectorStats.cashTickets} · T: {selectedCollectorStats.transferTickets}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Importes separados en efectivo y transferencia.</p>
                  </div>
                  <div className="rounded-md border bg-surface-subtle p-3">
                    <p className="text-sm font-medium text-muted-foreground">Pedidos y novedades</p>
                    <p className="mt-2 text-lg font-semibold">{selectedCollectorStats.unansweredRequestCount} pedidos sin responder</p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedCollectorStats.answeredRequestCount} respondidos · {selectedCollectorStats.newsCount} novedades cargadas.</p>
                  </div>
                </div>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border bg-card p-3">
                  <h4 className="font-semibold">Pedidos pendientes del cobrador</h4>
                  <div className="mt-3 space-y-2">
                    {selectedCollectorPortfolio.filter((item) => item.affiliate.request.trim() && !item.affiliate.latestNews.trim()).slice(0, 6).map(({ affiliate, pendingTickets }) => (
                      <div key={`request-${affiliate.id}`} className="rounded-md bg-surface-subtle px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <strong>{affiliate.fullName}</strong>
                          <span>{pendingTickets} pend.</span>
                        </div>
                        <p className="mt-1 text-muted-foreground">{affiliate.request}</p>
                      </div>
                    ))}
                    {selectedCollectorStats.unansweredRequestCount === 0 && <p className="text-sm text-muted-foreground">No hay pedidos pendientes para este cobrador.</p>}
                  </div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <h4 className="font-semibold">Últimas novedades</h4>
                  <div className="mt-3 space-y-2">
                    {selectedCollectorStats.latestNotes.map((note) => {
                      const affiliate = affiliatesById.get(note.affiliateId);
                      return (
                        <div key={`collector-note-${note.id}`} className="rounded-md bg-surface-subtle px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <strong>{affiliate?.fullName || "Afiliado"}</strong>
                            <span>{new Date(note.date).toLocaleDateString("es-AR")}</span>
                          </div>
                          <p className="mt-1 text-muted-foreground">{note.text}</p>
                        </div>
                      );
                    })}
                    {selectedCollectorStats.latestNotes.length === 0 && <p className="text-sm text-muted-foreground">Sin novedades cargadas para este cobrador.</p>}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-x-auto rounded-md border">
                <table className="w-full min-w-[1120px] text-xs sm:text-sm">
                  <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left">Nombre y apellido</th>
                      <th className="px-3 py-3 text-left">Póliza</th>
                      <th className="px-3 py-3 text-left">Plan</th>
                      <th className="px-3 py-3 text-left">Dep.</th>
                      <th className="px-3 py-3 text-right">Valor</th>
                      <th className="px-3 py-3 text-center">Tickets mes</th>
                      <th className="px-3 py-3 text-center">Cobrados</th>
                      <th className="px-3 py-3 text-center">Pendientes</th>
                      <th className="px-3 py-3 text-left">Pedido</th>
                      <th className="px-3 py-3 text-left">Novedad</th>
                      <th className="px-3 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedCollectorPortfolio.map(({ affiliate, tickets, chargedTickets, pendingTickets }) => (
                      <tr key={`collector-detail-${affiliate.id}`}>
                        <td className="px-3 py-3 font-medium">{affiliate.fullName}</td>
                        <td className="px-3 py-3">{affiliate.policyNumber || "-"}</td>
                        <td className="px-3 py-3">{affiliate.plan}</td>
                        <td className="px-3 py-3">{affiliate.dependency || "-"}</td>
                        <td className="px-3 py-3 text-right">{currency.format(affiliate.value)}</td>
                        <td className="px-3 py-3 text-center">{tickets}</td>
                        <td className="px-3 py-3 text-center">{chargedTickets}</td>
                        <td className="px-3 py-3 text-center font-medium">{pendingTickets}</td>
                        <td className="min-w-80 px-3 py-3"><Textarea className="min-h-20 text-xs sm:text-sm" value={affiliate.request || ""} onChange={(event) => updateAffiliateRequest(affiliate.id, event.target.value)} placeholder="Pedir info" /></td>
                        <td className="min-w-80 px-3 py-3"><Textarea className="min-h-20 text-xs sm:text-sm" value={affiliate.latestNews || ""} onChange={(event) => updateAffiliateNews(affiliate.id, event.target.value)} placeholder="Respuesta / novedad" /></td>
                        <td className="px-3 py-3 text-right">
                          <Button type="button" size="sm" variant="outline" onClick={() => openMobileCollection(affiliate)}>
                            Cargar
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {selectedCollectorPortfolio.length === 0 && (
                      <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={11}>Este cobrador todavía no tiene afiliados asignados.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1480px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Cobrador</th>
                    <th className="px-4 py-3 text-left">Teléfono</th>
                    <th className="px-4 py-3 text-left">Dependencias</th>
                    <th className="px-4 py-3 text-right">Afiliados</th>
                    <th className="px-4 py-3 text-right">Tickets recibidos</th>
                    <th className="px-4 py-3 text-right">Tickets cobrados</th>
                    <th className="px-4 py-3 text-right">Tickets pendientes</th>
                    <th className="px-4 py-3 text-right">Tickets $</th>
                    <th className="px-4 py-3 text-right">Recibos</th>
                    <th className="px-4 py-3 text-right">Cobrado total</th>
                    <th className="px-4 py-3 text-right">Efectividad</th>
                    <th className="px-4 py-3 text-right">% comisión</th>
                    <th className="px-4 py-3 text-right">Comisión</th>
                    <th className="px-4 py-3 text-right">A rendir</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleCollectorRows.map((row) => (
                    <tr key={row.collector}>
                      <td className="px-4 py-3 font-medium">{row.collector}</td>
                      <td className="px-4 py-3">{row.phone || "-"}</td>
                      <td className="px-4 py-3">{row.dependencies.join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-right">{row.affiliates}</td>
                      <td className="px-4 py-3 text-right">{row.tickets}</td>
                      <td className="px-4 py-3 text-right">{row.chargedTickets}</td>
                      <td className="px-4 py-3 text-right">{row.pendingTickets}</td>
                      <td className="px-4 py-3 text-right">{currency.format(row.ticketChargedAmount)}</td>
                      <td className="px-4 py-3 text-right">{row.receiptCount} / {currency.format(row.receiptAmount)}</td>
                      <td className="px-4 py-3 text-right">{currency.format(row.chargedAmount)}</td>
                      <td className="px-4 py-3 text-right">{row.effectiveness.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium">{row.appliedCommissionRate}%</div>
                        {row.bonusEnabled && <div className="text-[10px] text-muted-foreground">Premio {row.bonusThreshold}%</div>}
                      </td>
                      <td className="px-4 py-3 text-right">{currency.format(row.commissionAmount)}</td>
                      <td className="px-4 py-3 text-right">{currency.format(row.amountToRender)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {row.phone && (
                            <Button type="button" size="sm" variant="outline" onClick={() => window.open(`https://wa.me/${row.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}>WhatsApp</Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setCollectorDetailName(row.collector);
                            }}
                          >
                            Ver cartera
                          </Button>
                          {row.affiliates === 0 && (
                            <Button type="button" size="sm" variant="outline" onClick={() => removeCollector(row.collector)}>Quitar</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visibleCollectorRows.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={15}>Todavía no hay cobradores cargados.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "Caja" && isOfficeUser && (
          <section className="grid gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
            <div className="grid gap-4">
            <form onSubmit={saveCashOpeningBalance} className="rounded-md border bg-card">
              <div className="border-b p-4">
                <h2 className="font-semibold">Estado inicial de caja</h2>
                <p className="mt-1 text-sm text-muted-foreground">Carga por unica vez el saldo con el que arranca la caja.</p>
              </div>
              <div className="grid gap-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Fecha</Label>
                    <Input type="date" value={cashOpeningForm.date} onChange={(event) => setCashOpeningForm((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Oficina</Label>
                    <Input
                      value={isAdminUser ? cashOpeningForm.office : activeOffice}
                      onChange={(event) => setCashOpeningForm((current) => ({ ...current, office: event.target.value }))}
                      placeholder="EJ: TUNUYAN"
                      readOnly={!isAdminUser}
                    />
                  </div>
                </div>
                <div>
                  <Label>Saldo inicial</Label>
                  <Input inputMode="decimal" value={cashOpeningForm.amount} onChange={(event) => setCashOpeningForm((current) => ({ ...current, amount: event.target.value }))} placeholder="$ 0" />
                </div>
                <div>
                  <Label>Observación</Label>
                  <Textarea value={cashOpeningForm.notes} onChange={(event) => setCashOpeningForm((current) => ({ ...current, notes: event.target.value }))} placeholder="DETALLE DEL ESTADO INICIAL" />
                </div>
                {cashOpeningAlreadyExists && (
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    YA EXISTE SALDO INICIAL PARA {cashOpeningFormOffice} EN {cashOpeningForm.date.slice(0, 7)}.
                  </p>
                )}
                <Button type="submit" variant="command" disabled={cashOpeningAlreadyExists}>Cargar saldo inicial</Button>
              </div>
            </form>
            <form onSubmit={saveCashMovement} className="rounded-md border bg-card">
              <div className="border-b p-4">
                <h2 className="font-semibold">Caja</h2>
                <p className="mt-1 text-sm text-muted-foreground">Carga de ingresos y egresos por oficina, usuario y turno.</p>
              </div>
              <div className="grid gap-3 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Fecha</Label>
                    <Input type="date" value={cashMovementForm.date} onChange={(event) => setCashMovementForm((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Oficina</Label>
                    <Input
                      value={isAdminUser ? cashMovementForm.office : activeOffice}
                      onChange={(event) => setCashMovementForm((current) => ({ ...current, office: event.target.value }))}
                      placeholder="EJ: TUNUYAN"
                      readOnly={!isAdminUser}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Turno</Label>
                    <Input value={cashMovementForm.shift} onChange={(event) => setCashMovementForm((current) => ({ ...current, shift: event.target.value }))} placeholder="EJ: MAÑANA" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={cashMovementForm.type}
                      onChange={(event) => setCashMovementForm((current) => ({ ...current, type: event.target.value as CashMovement["type"], concept: "" }))}
                    >
                      <option value="ingreso">Ingreso</option>
                      <option value="egreso">Egreso</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Origen</Label>
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cashMovementForm.source} onChange={(event) => setCashMovementForm((current) => ({ ...current, source: event.target.value as CashMovement["source"] }))}>
                      <option value="SERVICIOS">Servicios</option>
                      <option value="PRE NECESIDAD">Pre Necesidad</option>
                      <option value="TRES PROVINCIAS">Tres Provincias</option>
                      <option value="OTROS">Otros</option>
                    </select>
                  </div>
                  <div>
                    <Label>Medio de pago</Label>
                    <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cashMovementForm.paymentMethod} onChange={(event) => setCashMovementForm((current) => ({ ...current, paymentMethod: event.target.value as CashMovement["paymentMethod"] }))}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="OTRO">Otro</option>
                    </select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tipo comprobante</Label>
                    <Input value={cashMovementForm.receiptType} onChange={(event) => setCashMovementForm((current) => ({ ...current, receiptType: event.target.value }))} placeholder="RECIBO / TICKET" />
                  </div>
                  <div>
                    <Label>N° comprobante</Label>
                    <Input value={cashMovementForm.receiptNumber} onChange={(event) => setCashMovementForm((current) => ({ ...current, receiptNumber: event.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label>Concepto</Label>
                  {cashMovementForm.type === "egreso" ? (
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={cashMovementForm.concept}
                      onChange={(event) => setCashMovementForm((current) => ({ ...current, concept: event.target.value }))}
                    >
                      <option value="">SELECCIONAR EGRESO</option>
                      {cashExpenseConcepts.map((concept) => (
                        <option key={concept} value={concept}>{concept}</option>
                      ))}
                    </select>
                  ) : (
                    <Input value={cashMovementForm.concept} onChange={(event) => setCashMovementForm((current) => ({ ...current, concept: event.target.value }))} placeholder="DETALLE DEL MOVIMIENTO" />
                  )}
                </div>
                <div>
                  <Label>Monto</Label>
                  <Input inputMode="decimal" value={cashMovementForm.amount} onChange={(event) => setCashMovementForm((current) => ({ ...current, amount: event.target.value }))} placeholder="$ 0" />
                </div>
                <div>
                  <Label>Observación</Label>
                  {cashMovementForm.type === "egreso" && cashMovementForm.concept === "OTROS GASTOS" && (
                    <p className="mb-2 text-xs font-medium text-destructive">DETALLAR EL GASTO EN OBSERVACIONES.</p>
                  )}
                  <Textarea
                    value={cashMovementForm.notes}
                    onChange={(event) => setCashMovementForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder={cashMovementForm.type === "egreso" && cashMovementForm.concept === "OTROS GASTOS" ? "DETALLE DE OTROS GASTOS" : ""}
                    required={cashMovementForm.type === "egreso" && cashMovementForm.concept === "OTROS GASTOS"}
                  />
                </div>
                <Button type="submit" variant="command">Agregar movimiento</Button>
              </div>
            </form>
            </div>

            <div className="grid gap-4">
              <form onSubmit={saveCashTurnNote} className="rounded-md border bg-card">
                <div className="border-b p-4">
                  <h2 className="font-semibold">Novedades del turno</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Texto libre para dejar asentadas situaciones del turno. Se imprime en el reporte de caja.</p>
                </div>
                <div className="grid gap-3 p-4 xl:grid-cols-[145px_175px_160px_170px_minmax(320px,1fr)_170px] xl:items-end">
                  <div>
                    <Label>Fecha</Label>
                    <Input type="date" value={cashTurnNoteForm.date} onChange={(event) => setCashTurnNoteForm((current) => ({ ...current, date: event.target.value }))} />
                  </div>
                  <div>
                    <Label>Oficina</Label>
                    <Input
                      value={isAdminUser ? cashTurnNoteForm.office : activeOffice}
                      onChange={(event) => setCashTurnNoteForm((current) => ({ ...current, office: event.target.value }))}
                      placeholder="EJ: TUNUYAN"
                      readOnly={!isAdminUser}
                    />
                  </div>
                  <div>
                    <Label>Turno</Label>
                    <Input value={cashTurnNoteForm.shift} onChange={(event) => setCashTurnNoteForm((current) => ({ ...current, shift: event.target.value }))} placeholder="EJ: MANANA" />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={cashTurnNoteForm.entryType}
                      onChange={(event) => setCashTurnNoteForm((current) => ({ ...current, entryType: event.target.value as CashTurnNote["entryType"] }))}
                    >
                      <option value="NOVEDAD">Novedad</option>
                      <option value="TAREA">Tarea</option>
                    </select>
                  </div>
                  <div>
                    <Label>{cashTurnNoteForm.entryType === "TAREA" ? "Tarea" : "Novedad"}</Label>
                    <Textarea
                      className="min-h-20"
                      value={cashTurnNoteForm.text}
                      onChange={(event) => setCashTurnNoteForm((current) => ({ ...current, text: event.target.value }))}
                      placeholder={cashTurnNoteForm.entryType === "TAREA" ? "DETALLE DE LA TAREA DEL TURNO" : "DETALLE DE LA NOVEDAD DEL TURNO"}
                      required
                    />
                  </div>
                  <Button type="submit" variant="command" className="h-10">{cashTurnNoteForm.entryType === "TAREA" ? "Agregar tarea" : "Agregar novedad"}</Button>
                </div>
              </form>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryBox label="Saldo inicial" value={currency.format(cashTotals.opening)} />
                <SummaryBox label="Ingresos" value={currency.format(cashTotals.income)} />
                <SummaryBox label="Egresos" value={currency.format(cashTotals.expense)} />
                <SummaryBox label="Saldo caja" value={currency.format(cashTotals.balance)} />
                <SummaryBox label="Movimientos" value={String(visibleCashMovements.length)} />
              </div>

              <div className="rounded-md border bg-card">
                <div className="grid gap-3 border-b p-4 md:grid-cols-[1fr_150px_160px_180px_180px_170px]">
                  <div>
                    <h3 className="font-semibold">Movimientos de caja</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Periodo {activeMonth}</p>
                  </div>
                  <Input
                    type="date"
                    value={cashReportDate}
                    onChange={(event) => setCashReportDate(event.target.value)}
                    title="Fecha del reporte"
                  />
                  <Input
                    value={cashReportShift}
                    onChange={(event) => setCashReportShift(event.target.value.toLocaleUpperCase("es-AR"))}
                    placeholder="TURNO"
                    title="Turno del reporte"
                  />
                  <select
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={isAdminUser ? cashOfficeFilter : activeOffice}
                    onChange={(event) => setCashOfficeFilter(event.target.value)}
                    disabled={!isAdminUser}
                  >
                    {isAdminUser && <option value="todos">Todas las oficinas</option>}
                    {cashOfficeOptions.map((office) => <option key={office} value={office}>{office}</option>)}
                  </select>
                  <select className="h-10 rounded-md border bg-background px-3 text-sm" value={cashTypeFilter} onChange={(event) => setCashTypeFilter(event.target.value)}>
                    <option value="todos">Ingresos y egresos</option>
                    <option value="ingreso">Ingresos</option>
                    <option value="egreso">Egresos</option>
                  </select>
                  <Button type="button" variant="command" onClick={printCashTurnReport}>
                    Imprimir reporte
                  </Button>
                </div>
                <div className="grid gap-3 border-b bg-surface-subtle p-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Efectivo</p>
                    <p className="text-lg font-semibold">{currency.format(cashTotals.cash)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Tarjeta</p>
                    <p className="text-lg font-semibold">{currency.format(cashTotals.card)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Transferencia</p>
                    <p className="text-lg font-semibold">{currency.format(cashTotals.transfer)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Otro</p>
                    <p className="text-lg font-semibold">{currency.format(cashTotals.other)}</p>
                  </div>
                </div>
                {visibleCashOpeningBalances.length > 0 && (
                  <div className="border-b p-4">
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Saldos iniciales cargados</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {visibleCashOpeningBalances.map((item) => (
                        <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{item.office}</p>
                              <p className="text-xs text-muted-foreground">{item.date} · {item.user}</p>
                            </div>
                            <p className="font-semibold">{currency.format(item.amount)}</p>
                          </div>
                          {item.notes && <p className="mt-2 text-xs text-muted-foreground">{item.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="border-b p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold">Novedades del turno</p>
                      <p className="text-xs text-muted-foreground">Se incluyen en el reporte impreso segun fecha, oficina y turno.</p>
                    </div>
                    <span className="rounded-md bg-surface-subtle px-3 py-1 text-xs font-semibold text-muted-foreground">
                      {visibleCashTurnNotes.length} registro(s)
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {visibleCashTurnNotes.slice(0, 8).map((item) => (
                      <div key={item.id} className="rounded-md border bg-background p-3 text-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {item.entryType === "TAREA" && (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={!!item.completed}
                                  onChange={() => toggleCashTurnTask(item.id)}
                                  title="Marcar tarea realizada"
                                />
                              )}
                              <p className="font-semibold">{item.office} {item.shift ? `- ${item.shift}` : ""}</p>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.entryType === "TAREA" ? "bg-amber-100 text-amber-800" : "bg-surface-subtle text-muted-foreground"}`}>
                                {item.entryType || "NOVEDAD"}
                              </span>
                              {item.entryType === "TAREA" && (
                                <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${item.completed ? "bg-emerald-100 text-emerald-800" : "bg-destructive/10 text-destructive"}`}>
                                  {item.completed ? "REALIZADA" : "PENDIENTE"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.date} - {item.user}</p>
                            <p className={`mt-2 ${item.entryType === "TAREA" && item.completed ? "text-muted-foreground line-through" : ""}`}>{item.text}</p>
                          </div>
                          <Button type="button" size="sm" variant="outline" onClick={() => deleteCashTurnNote(item.id)}>Eliminar</Button>
                        </div>
                      </div>
                    ))}
                    {visibleCashTurnNotes.length === 0 && (
                      <p className="rounded-md border bg-surface-subtle px-3 py-3 text-sm text-muted-foreground">No hay novedades de turno cargadas para este periodo.</p>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-sm">
                    <thead className="bg-surface-subtle text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Oficina</th>
                        <th className="px-4 py-3">Turno</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Origen</th>
                        <th className="px-4 py-3">Medio</th>
                        <th className="px-4 py-3">Comprobante</th>
                        <th className="px-4 py-3">Concepto</th>
                        <th className="px-4 py-3 text-right">Monto</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCashMovements.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-3">{item.date}</td>
                          <td className="px-4 py-3">{item.office}</td>
                          <td className="px-4 py-3">{item.shift || "-"}</td>
                          <td className="px-4 py-3 font-medium">{item.type === "ingreso" ? "INGRESO" : "EGRESO"}</td>
                          <td className="px-4 py-3">{item.source}</td>
                          <td className="px-4 py-3">{item.paymentMethod}</td>
                          <td className="px-4 py-3">{[item.receiptType, item.receiptNumber].filter(Boolean).join(" ") || "-"}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.concept || "-"}</p>
                            {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${item.type === "egreso" ? "text-destructive" : ""}`}>{currency.format(item.amount)}</td>
                          <td className="px-4 py-3">{item.user}</td>
                          <td className="px-4 py-3 text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => deleteCashMovement(item.id)}>Eliminar</Button>
                          </td>
                        </tr>
                      ))}
                      {visibleCashMovements.length === 0 && (
                        <tr>
                          <td className="px-4 py-8 text-center text-muted-foreground" colSpan={11}>No hay movimientos de caja cargados para este periodo.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}

        {activeSection === "Mensual" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
              <h2 className="font-semibold">Planilla de cobranza mensual</h2>
              <p className="text-sm text-muted-foreground">Período {activeMonth}. Aparecen solo los afiliados tildados en la base. Acá se carga la cantidad de tickets.</p>
            </div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para editar tickets y totales.</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Póliza</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-right">Cantidad tickets</th>
                    <th className="px-4 py-3 text-right">Total nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {monthlyRows.map(({ affiliate, monthly }) => (
                    <tr key={affiliate.id}>
                      <td className="px-4 py-3 font-medium">{affiliate.fullName}</td>
                      <td className="px-4 py-3">{affiliate.policyNumber}</td>
                      <td className="px-4 py-3">{affiliate.plan}</td>
                      <td className="px-4 py-3 text-right">{currency.format(affiliate.value)}</td>
                      <td className="px-4 py-3 text-right">
                        <Input className="ml-auto w-28 text-right" type="number" min="0" value={monthly.tickets} onChange={(event) => updateMonthlyTickets(affiliate.id, Math.max(0, parseNumber(event.target.value)))} />
                      </td>
                      <td className="px-4 py-3 text-right">{currency.format(affiliate.value * monthly.tickets)}</td>
                    </tr>
                  ))}
                  {monthlyRows.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>No hay afiliados seleccionados para la cobranza mensual.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "Cobranza" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_420px]">
            <form className="rounded-md border bg-card p-3 sm:p-4" onSubmit={saveTicketCollection}>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-semibold">{editingTicketCollectionId ? "Editar cobranza por tickets" : "Registrar cobranza por tickets"}</h2>
                {editingTicketCollectionId && (
                  <Button type="button" variant="outline" size="sm" onClick={cancelTicketCollectionEdit}>
                    Cancelar edicion
                  </Button>
                )}
              </div>
              <div className="mt-4 grid gap-4">
                <div className="space-y-2"><Label>N° de póliza</Label><Input value={collectionPolicy} onChange={(event) => setCollectionPolicy(event.target.value)} /></div>
              </div>
              {selectedMonthlyAffiliate && (
                <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-sm">
                  <strong>{selectedMonthlyAffiliate.fullName}</strong>
                  {selectedAffiliateIsFromOtherCollector && (
                    <p className="mt-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                      {otherCollectorWarningText} Si lo cobras, quedara registrada una novedad automatica.
                    </p>
                  )}
                  <p className="text-muted-foreground">Póliza {selectedMonthlyAffiliate.policyNumber} · Plan detectado: {selectedMonthlyAffiliate.plan}</p>
                  <p className="text-muted-foreground">Tickets a cobrar: {ticketsToCharge} · Valor ticket: {currency.format(selectedMonthlyAffiliate.value)}</p>
                  {selectedMonthlyCandidates.length > 1 && (
                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Esta póliza tiene {selectedMonthlyCandidates.length} registros. Se toma el que tiene tickets pendientes.
                    </p>
                  )}
                  {selectedMonthlyAffiliate.request?.trim() && (
                    <div className="mt-3 rounded-md border border-red-300 bg-red-100 p-3 text-red-950">
                      <p className="font-semibold">Pedido pendiente para el cobrador</p>
                      <p className="mt-1">{selectedMonthlyAffiliate.request}</p>
                      <div className="mt-3 space-y-1">
                        <Label htmlFor="collection-request-answer">Respuesta / novedad obligatoria</Label>
                        <Input
                          id="collection-request-answer"
                          value={selectedMonthlyAffiliate.latestNews || ""}
                          onChange={(event) => updateAffiliateNews(selectedMonthlyAffiliate.id, event.target.value)}
                          placeholder="Completar dato solicitado o explicar por qué no se pudo"
                        />
                        <Button type="button" variant="command" className="mt-2" onClick={() => saveRequestOrNews(selectedMonthlyAffiliate.id, { latestNews: selectedMonthlyAffiliate.latestNews || "" })} disabled={cloudBusy}>Guardar</Button>
                      </div>
                    </div>
                  )}
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => openNoteDialog(selectedMonthlyAffiliate.id)}>Agregar novedad</Button>
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Tickets cobrados</Label><Input type="number" min="0" max={ticketsToCharge} value={collectionTickets} onChange={(event) => setCollectionTickets(event.target.value)} /></div>
                <div className="space-y-2"><Label>Forma de pago</Label><select value={collectionMethod} onChange={(event) => setCollectionMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="E">E</option><option value="T">T</option></select></div>
              </div>
              {collectionMethod === "T" && <TransferFields value={collectionTransfer} onChange={setCollectionTransfer} />}
              {hasUnansweredRequest && <p className="mt-3 text-sm text-amber-700">Para guardar el cobro, primero respondé el pedido pendiente.</p>}
              <div className="mt-4 flex justify-end"><Button type="submit" className="w-full sm:w-auto" variant="command" disabled={isSavingTicketCollection || !selectedMonthlyAffiliate || ticketsToCharge <= 0 || hasUnansweredRequest}>{isSavingTicketCollection ? "Guardando..." : editingTicketCollectionId ? "Guardar cambios" : "Guardar cobro"}</Button></div>
              <TicketCollectionsDetail collections={visibleTicketCollections} affiliatesById={affiliatesById} isAdminUser={isAdminUser} onEdit={editTicketCollection} onDelete={deleteTicketCollection} />
            </form>
            <div className="space-y-5">
              <RecentNotes notes={visibleNotes} affiliatesById={affiliatesById} />
            </div>
          </section>
        )}

        {activeSection === "Recibos" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_420px]">
            <form className="rounded-md border bg-card p-3 sm:p-4" onSubmit={saveReceipt}>
              <h2 className="font-semibold">{editingReceiptId ? "Editar recibo" : "Registrar recibo sin ticket"}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>N° recibo</Label><Input value={receiptForm.receiptNumber} onChange={(event) => setReceiptForm({ ...receiptForm, receiptNumber: event.target.value.toLocaleUpperCase("es-AR") })} /></div>
                <div className="space-y-2"><Label>N° de póliza</Label><Input inputMode="numeric" value={receiptForm.policyNumber} onChange={(event) => updateReceiptPolicy(event.target.value)} placeholder="EJ: 31774" /></div>
                <div className="space-y-2"><Label>Apellido y nombre</Label><Input value={receiptForm.fullName} onChange={(event) => setReceiptForm({ ...receiptForm, fullName: event.target.value.toLocaleUpperCase("es-AR") })} required /></div>
                <div className="space-y-2"><Label>Cobrador</Label><select value={isOfficeUser ? receiptForm.collector : currentCollectorName} onChange={(event) => setReceiptForm({ ...receiptForm, collector: event.target.value })} disabled={!isOfficeUser} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{(isOfficeUser ? visibleCollectorsForCobranza : [currentCollectorName]).filter(Boolean).map((collector) => <option key={collector} value={collector}>{collector}</option>)}</select></div>
                <div className="space-y-2"><Label>Plan</Label><select value={receiptForm.plan} onChange={(event) => updateReceiptPlan(event.target.value as PlanType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{receiptPlanOptions.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
                <div className="space-y-2">
                  <Label>Meses que paga</Label>
                  <details className="rounded-md border border-input bg-background">
                    <summary className="cursor-pointer px-3 py-2 text-sm">
                      {receiptForm.paidMonths.length ? receiptForm.paidMonths.map(monthLabel).join(" / ") : "SELECCIONAR MESES"}
                    </summary>
                    <div className="max-h-56 overflow-auto border-t p-2">
                      {receiptMonthOptions.map((month) => (
                        <label key={month} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-subtle">
                          <input
                            type="checkbox"
                            checked={receiptForm.paidMonths.includes(month)}
                            onChange={(event) => updateReceiptPaidMonth(month, event.target.checked)}
                          />
                          <span>{monthLabel(month)}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div className="space-y-2"><Label>Cant. de meses</Label><Input readOnly value={receiptForm.monthCount} className="bg-surface-subtle" /></div>
                <div className="space-y-2"><Label>Monto mensual</Label><Input value={receiptForm.monthlyAmount} onChange={(event) => setReceiptForm({ ...receiptForm, monthlyAmount: event.target.value })} required /></div>
                <div className="space-y-2"><Label>Método de pago</Label><select value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm({ ...receiptForm, paymentMethod: event.target.value as PaymentMethod })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="E">E</option><option value="T">T</option></select></div>
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={receiptForm.isProduction}
                  onChange={(event) => setReceiptForm({ ...receiptForm, isProduction: event.target.checked })}
                />
                <span>Produccion</span>
              </label>
              {receiptForm.isProduction && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  Este recibo queda registrado como produccion y no suma a cobranza, rendicion ni comision.
                </p>
              )}
              {selectedReceiptAffiliate && (
                <p className="mt-3 rounded-md border bg-surface-subtle px-3 py-2 text-sm text-muted-foreground">
                  Datos encontrados: {selectedReceiptAffiliate.fullName} - Póliza {selectedReceiptAffiliate.policyNumber} - {selectedReceiptAffiliate.plan} - Cobrador {selectedReceiptAffiliate.collector || "OFICINA"}
                </p>
              )}
              {receiptForm.paymentMethod === "T" && <TransferFields value={receiptForm.transfer} onChange={(transfer) => setReceiptForm({ ...receiptForm, transfer })} />}
              <div className="mt-4 flex flex-col justify-end gap-2 sm:flex-row">
                {editingReceiptId && <Button type="button" className="w-full sm:w-auto" variant="outline" onClick={resetReceiptForm}>Cancelar edición</Button>}
                <Button type="submit" className="w-full sm:w-auto" variant="command" disabled={isSavingReceipt}>{isSavingReceipt ? "Guardando..." : editingReceiptId ? "Guardar cambios" : "Guardar recibo"}</Button>
              </div>
            </form>
            <ReceiptsList receipts={visibleReceipts} isAdminUser={isAdminUser} onEdit={editReceipt} onVoid={voidReceipt} onDelete={deleteReceipt} onExport={exportReceiptsExcel} />
          </section>
        )}

        {activeSection === "Pedidos" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
              <h2 className="font-semibold">Pedidos de administracion</h2>
              <p className="text-sm text-muted-foreground">
                Solicitudes cargadas por administracion para completar datos o informar novedades antes de cobrar.
              </p>
            </div>
            <div className="grid gap-3 p-3 sm:p-4">
              {requestRows.map(({ affiliate, pendingTickets, answered }) => (
                <div key={`request-panel-${affiliate.id}`} className="rounded-md border bg-background p-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{affiliate.fullName}</p>
                        <span className={`rounded px-2 py-1 text-xs font-semibold ${answered ? "bg-emerald-50 text-emerald-700" : "bg-red-600 text-white"}`}>
                          {answered ? "Respondido" : "Pendiente"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Poliza {affiliate.policyNumber || "-"} - {affiliate.plan} - Dep. {affiliate.dependency || "-"} - Cobrador {affiliate.collector || "OFICINA"}
                      </p>
                      <p className="mt-2 rounded-md border border-red-300 bg-red-100 px-3 py-2 text-sm font-semibold text-red-950">
                        {affiliate.request}
                      </p>
                    </div>
                    <div className="shrink-0 rounded-md bg-surface-subtle px-3 py-2 text-center">
                      <p className="text-2xl font-semibold">{pendingTickets}</p>
                      <p className="text-[10px] uppercase text-muted-foreground">tickets pend.</p>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto_auto] lg:items-start">
                    <Textarea
                      className="min-h-24"
                      value={affiliate.latestNews || ""}
                      onChange={(event) => updateAffiliateNews(affiliate.id, event.target.value)}
                      placeholder="Respuesta del cobrador o dato informado"
                    />
                    <Button type="button" variant="command" onClick={() => saveRequestOrNews(affiliate.id, { latestNews: affiliate.latestNews || "" })} disabled={cloudBusy}>
                      Guardar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        openMobileCollection(affiliate);
                        setActiveSection("Cobranza");
                      }}
                    >
                      Cargar cobro
                    </Button>
                  </div>
                </div>
              ))}
              {requestRows.length === 0 && (
                <div className="rounded-md border bg-surface-subtle p-4 text-center text-sm text-muted-foreground">
                  No hay pedidos pendientes para este usuario.
                </div>
              )}
            </div>
          </section>
        )}

        {activeSection === "Novedades" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
              <h2 className="font-semibold">Novedades del mes</h2>
              <p className="text-sm text-muted-foreground">Texto libre cargado por afiliado o ticket. Período {activeMonth}.</p>
            </div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para leer todas las novedades.</div>
            <form className="grid gap-3 border-b bg-surface-subtle p-3 sm:p-4 lg:grid-cols-[1fr_1fr_2fr_auto] lg:items-end" onSubmit={saveDirectNews}>
              <div className="space-y-1">
                <Label htmlFor="news-affiliate-search">Buscar afiliado</Label>
                <Input
                  id="news-affiliate-search"
                  value={newsAffiliateQuery}
                  onChange={(event) => setNewsAffiliateQuery(event.target.value)}
                  placeholder="Nombre, poliza o plan"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="news-affiliate">Afiliado</Label>
                <select
                  id="news-affiliate"
                  value={newsAffiliateId}
                  onChange={(event) => setNewsAffiliateId(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Seleccionar</option>
                  {newsAffiliateOptions.map((affiliate) => (
                    <option key={affiliate.id} value={affiliate.id}>
                      {affiliate.fullName} - {affiliate.policyNumber || "-"} - {affiliate.plan}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="news-text">Novedad</Label>
                <Textarea
                  id="news-text"
                  className="min-h-20"
                  value={newsText}
                  onChange={(event) => setNewsText(event.target.value)}
                  placeholder="Escribi la novedad del afiliado"
                  required
                />
              </div>
              <Button type="submit" variant="command" disabled={!newsAffiliateId || !newsText.trim()}>
                Guardar novedad
              </Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Afiliado</th>
                    <th className="px-4 py-3 text-left">Póliza</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Dependencia</th>
                    <th className="px-4 py-3 text-left">Novedad</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleNotes.map((item) => {
                    const affiliate = affiliatesById.get(item.affiliateId);
                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3">{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.date))}</td>
                        <td className="px-4 py-3 font-medium">{affiliate?.fullName || "Afiliado"}</td>
                        <td className="px-4 py-3">{affiliate?.policyNumber || "-"}</td>
                        <td className="px-4 py-3">{affiliate?.plan || "-"}</td>
                        <td className="px-4 py-3">{affiliate?.dependency || "001"}</td>
                        <td className="px-4 py-3">{item.text}</td>
                      </tr>
                    );
                  })}
                  {visibleNotes.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Sin novedades cargadas para este mes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "Totales" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4"><h2 className="font-semibold">Totales por plan</h2></div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para ver importes y cantidades.</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Plan</th>
                    <th className="px-3 py-3 text-right">Tickets recibidos</th>
                    <th className="px-3 py-3 text-right">Tickets cobrados E</th>
                    <th className="px-3 py-3 text-right">Importe E</th>
                    <th className="px-3 py-3 text-right">Tickets cobrados T</th>
                    <th className="px-3 py-3 text-right">Importe T</th>
                    <th className="px-3 py-3 text-right">No cobrados</th>
                    <th className="px-3 py-3 text-right">Recibos E</th>
                    <th className="px-3 py-3 text-right">Importe E</th>
                    <th className="px-3 py-3 text-right">Recibos T</th>
                    <th className="px-3 py-3 text-right">Importe T</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {totalsByPlan.map((item) => (
                    <tr key={item.plan}>
                      <td className="px-3 py-3 font-semibold">{item.plan}</td>
                      <td className="px-3 py-3 text-right">{item.ticketsReceived}</td>
                      <td className="px-3 py-3 text-right">{item.ticketCashCount}</td>
                      <td className="px-3 py-3 text-right">{currency.format(item.ticketCashAmount)}</td>
                      <td className="px-3 py-3 text-right">{item.ticketTransferCount}</td>
                      <td className="px-3 py-3 text-right">{currency.format(item.ticketTransferAmount)}</td>
                      <td className="px-3 py-3 text-right">{item.ticketsNotCharged}</td>
                      <td className="px-3 py-3 text-right">{item.receiptCashCount}</td>
                      <td className="px-3 py-3 text-right">{currency.format(item.receiptCashAmount)}</td>
                      <td className="px-3 py-3 text-right">{item.receiptTransferCount}</td>
                      <td className="px-3 py-3 text-right">{currency.format(item.receiptTransferAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "Usuarios" && isAdminUser && (
          <section className="space-y-4">
            <div className="rounded-md border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">Usuarios y roles</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Alta inicial de usuarios de cobranza. Los roles base son cobrador, oficina, oficina + cobrador y administrador.
              </p>
              <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_180px_220px_260px_auto]" onSubmit={saveUserProfile}>
                <div className="space-y-1">
                  <Label htmlFor="new-user-name">Nombre</Label>
                  <Input id="new-user-name" value={userForm.nombre} onChange={(event) => setUserForm({ ...userForm, nombre: event.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-user-email">Email</Label>
                  <Input id="new-user-email" type="email" value={userForm.email} onChange={(event) => setUserForm({ ...userForm, email: event.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-user-password">Clave inicial</Label>
                  <Input id="new-user-password" type="password" minLength={6} value={userForm.password} onChange={(event) => setUserForm({ ...userForm, password: event.target.value })} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-user-role">Rol</Label>
                  <select id="new-user-role" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={userForm.rol} onChange={(event) => setUserForm({ ...userForm, rol: event.target.value })}>
                    {userRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2 xl:col-span-1">
                  <Label htmlFor="new-user-collector">Cobrador asociado</Label>
                  <select id="new-user-collector" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={userForm.collectorName} onChange={(event) => setUserForm({ ...userForm, collectorName: event.target.value })}>
                    <option value="">Sin cobrador</option>
                    {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                  </select>
                </div>
                <div className="space-y-1 md:col-span-2 xl:col-span-1">
                  <Label>Oficinas habilitadas</Label>
                  <div className="grid gap-1 rounded-md border bg-background p-2 text-xs">
                    {officeNames.map((office) => (
                      <label key={`new-user-office-${office}`} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={userForm.offices.includes(office)}
                          onChange={(event) => setUserForm((current) => ({
                            ...current,
                            offices: event.target.checked
                              ? uniqueSorted([...current.offices, office])
                              : current.offices.filter((item) => item !== office),
                          }))}
                        />
                        <span>{office}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="submit" variant="command" className="self-end" disabled={isSavingUser}>
                  {isSavingUser ? "Guardando..." : "Crear usuario"}
                </Button>
              </form>
              {userAdminStatus && <p className="mt-3 rounded-md bg-surface-subtle p-3 text-sm text-muted-foreground">{userAdminStatus}</p>}
            </div>

            <div className="overflow-x-auto rounded-md border bg-card">
              <table className="w-full min-w-[1100px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-3 text-left">Usuario</th>
                    <th className="px-3 py-3 text-left">Email</th>
                    <th className="px-3 py-3 text-left">Rol</th>
                    <th className="px-3 py-3 text-left">Cobrador asociado</th>
                    <th className="px-3 py-3 text-left">Oficinas habilitadas</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {userProfiles.map((profile) => (
                    <tr key={profile.email}>
                      <td className="px-3 py-3 font-medium">{profile.nombre || "-"}</td>
                      <td className="px-3 py-3">{profile.email}</td>
                      <td className="px-3 py-3">
                        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" value={profile.rol || "cobrador"} onChange={(event) => updateUserProfile(profile, { rol: event.target.value })}>
                          {userRoleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-xs" value={profile.collector_name || ""} onChange={(event) => updateUserProfile(profile, { collector_name: event.target.value })}>
                          <option value="">Sin cobrador</option>
                          {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid gap-1">
                          {officeNames.map((office) => (
                            <label key={`${profile.email}-${office}`} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={officesFromPermissions(profile.permisos).includes(office)}
                                onChange={(event) => updateUserProfile(profile, { permisos: toggleOfficePermission(profile.permisos, office, event.target.checked) })}
                              />
                              <span>{office}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button type="button" size="sm" variant="outline" onClick={() => updateUserProfile(profile, { activo: !(profile.activo ?? true) })}>
                          {(profile.activo ?? true) ? "Activo" : "Inactivo"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {userProfiles.length === 0 && <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={6}>Todavía no hay usuarios cargados o no se pudo leer la tabla de perfiles.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === "Rendicion" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <div className="rounded-md border bg-card p-3 sm:p-4 lg:col-span-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold">{isOfficeUser && !isCollectorUser && adminReportScope === "all" ? "Rendicion general" : "Rendición del cobrador"}</h2>
                  <p className="text-sm text-muted-foreground">
                    Información correspondiente a {isOfficeUser && !isCollectorUser && adminReportScope === "all" ? "todos los cobradores" : selectedCollectorName || "el cobrador actual"} para el período {activeMonth}.
                  </p>
                </div>
                {isOfficeUser && !isCollectorUser && visibleCollectorsForCobranza.length > 1 && (
                  <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-[34rem]">
                    <div className="space-y-1">
                      <Label htmlFor="rendition-report-scope">Reporte</Label>
                      <select
                        id="rendition-report-scope"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={adminReportScope}
                        onChange={(event) => setAdminReportScope(event.target.value as "collector" | "all")}
                      >
                        <option value="collector">Un cobrador</option>
                        <option value="all">Todos los cobradores</option>
                      </select>
                    </div>
                    {adminReportScope === "collector" && (
                      <div className="space-y-1">
                        <Label htmlFor="rendition-collector-name">Cobrador</Label>
                        <select
                          id="rendition-collector-name"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          value={selectedCollectorName}
                          onChange={(event) => setCollectorDetailName(event.target.value)}
                        >
                          {visibleCollectorsForCobranza.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {isOfficeUser && !isCollectorUser && adminReportScope === "all" ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryBox label="Tickets cobrados" value={String(visibleTicketCollections.reduce((sum, item) => sum + item.ticketsCharged, 0))} />
                  <SummaryBox label="Tickets devueltos" value={String(visibleCollectorRows.reduce((sum, item) => sum + item.pendingTickets, 0))} />
                  <SummaryBox label="Cobranza efectivo" value={currency.format(visibleTicketCollections.filter((item) => item.paymentMethod === "E").reduce((sum, item) => sum + ((affiliatesById.get(item.affiliateId)?.value ?? item.ticketValue ?? 0) * item.ticketsCharged), 0) + visibleReceipts.filter((item) => item.status !== "anulado" && !item.isProduction && item.paymentMethod === "E").reduce((sum, item) => sum + item.monthCount * item.monthlyAmount, 0))} />
                  <SummaryBox label="Cobranza transferencia" value={currency.format(visibleTicketCollections.filter((item) => item.paymentMethod === "T").reduce((sum, item) => sum + ((affiliatesById.get(item.affiliateId)?.value ?? item.ticketValue ?? 0) * item.ticketsCharged), 0) + visibleReceipts.filter((item) => item.status !== "anulado" && !item.isProduction && item.paymentMethod === "T").reduce((sum, item) => sum + item.monthCount * item.monthlyAmount, 0))} />
                  <SummaryBox label="Recibos cobrados" value={String(new Set(visibleReceipts.filter((item) => item.status !== "anulado" && !item.isProduction).map((item) => `${item.receiptNumber}-${item.plan}`)).size)} />
                  <SummaryBox label="Monto cobranza" value={currency.format(visibleCollectionAmount)} />
                  <SummaryBox label="ComisiÃ³n" value={currency.format(visibleCommissionAmount)} />
                  <SummaryBox label="A rendir" value={currency.format(visibleCollectionAmount - visibleCommissionAmount)} />
                </div>
              ) : selectedCollectorSummary && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryBox label="Tickets cobrados" value={String(selectedCollectorSummary.chargedTickets)} />
                  <SummaryBox label="Tickets devueltos" value={String(selectedCollectorSummary.pendingTickets)} />
                  <SummaryBox label="Cobranza efectivo" value={currency.format(selectedCollectorStats.totalCashAmount)} />
                  <SummaryBox label="Cobranza transferencia" value={currency.format(selectedCollectorStats.totalTransferAmount)} />
                  <SummaryBox label="Recibos cobrados" value={String(selectedCollectorStats.receiptCount)} />
                  <SummaryBox label="Monto cobranza" value={currency.format(selectedCollectorStats.totalCollectionAmount)} />
                  <SummaryBox label="Comisión" value={currency.format(selectedCollectorStats.reportCommissionAmount)} />
                  <SummaryBox label="A rendir" value={currency.format(selectedCollectorStats.reportRenditionAmount)} />
                  {canControlTicketReturns && <SummaryBox label="Pendientes a controlar" value={String(selectedCollectorReturnRows.length)} />}
                </div>
              )}
              {selectedCollectorSummary && canControlTicketReturns && (
                <div className="mt-4 rounded-md border bg-background">
                  <div className="border-b bg-surface-subtle p-3">
                    <h3 className="font-semibold">Control de tickets para devolucion</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Antes de descargar el reporte, tilda los tickets fisicos que el cobrador presenta. Los no tildados saldran observados en el Excel.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-xs sm:text-sm">
                      <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                        <tr>
                          <th className="px-3 py-3 text-center">Presenta</th>
                          <th className="px-3 py-3 text-left">Afiliado</th>
                          <th className="px-3 py-3 text-left">Poliza</th>
                          <th className="px-3 py-3 text-left">Plan</th>
                          <th className="px-3 py-3 text-center">Tickets</th>
                          <th className="px-3 py-3 text-right">Monto</th>
                          <th className="px-3 py-3 text-left">Observacion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedCollectorReturnRows.map(({ affiliate, pendingTickets, pendingAmount, hasPhysicalTickets, observation }) => (
                          <tr key={`return-control-${affiliate.id}`}>
                            <td className="px-3 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={hasPhysicalTickets}
                                onChange={(event) => void updateTicketReturnControl(affiliate.id, { hasPhysicalTickets: event.target.checked })}
                                className="h-4 w-4"
                              />
                            </td>
                            <td className="px-3 py-3 font-medium">{affiliate.fullName}</td>
                            <td className="px-3 py-3">{affiliate.policyNumber || "-"}</td>
                            <td className="px-3 py-3">{affiliate.plan}</td>
                            <td className="px-3 py-3 text-center">{pendingTickets}</td>
                            <td className="px-3 py-3 text-right">{currency.format(pendingAmount)}</td>
                            <td className="px-3 py-3">
                              <Textarea
                                defaultValue={observation}
                                onBlur={(event) => void updateTicketReturnControl(affiliate.id, { observation: event.target.value })}
                                className="min-h-16 min-w-[260px]"
                                placeholder="OBSERVACION SI NO PRESENTA LOS TICKETS"
                              />
                            </td>
                          </tr>
                        ))}
                        {selectedCollectorReturnRows.length === 0 && (
                          <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={7}>Sin tickets pendientes para devolver.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              <div className="mt-4 flex justify-end">
                <Button type="button" variant="command" onClick={exportRenditionReportExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Descargar reporte Excel
                </Button>
              </div>
            </div>
            {isOfficeUser && <div className="rounded-md border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">Rendición final</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryBox label="Cobrado efectivo" value={currency.format(totalCashCollected)} />
                <SummaryBox label="Cobrado transferencia" value={currency.format(totalTransferCollected)} />
                <SummaryBox label="Total cobrado" value={currency.format(totalCollected)} />
                <SummaryBox label="Comisión cobradores" value={currency.format(commission)} />
                <SummaryBox label="Total a rendir" value={currency.format(totalToRender)} />
                <SummaryBox label="Total rendido" value={currency.format(totalRendered)} />
                <SummaryBox label="Resta por rendir" value={currency.format(totalToRender - totalRendered)} />
              </div>
            </div>}
            {isOfficeUser && <div className="rounded-md border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">Monto rendido</h2>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-semibold">Efectivo rendido</h3>
              </div>
              <div className="mt-3 grid gap-2 rounded-md border bg-surface-subtle p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input type="date" value={cashRenderForm.date} onChange={(event) => setCashRenderForm({ ...cashRenderForm, date: event.target.value })} />
                <Input type="number" min="0" placeholder="Monto" value={cashRenderForm.amount} onChange={(event) => setCashRenderForm({ ...cashRenderForm, amount: event.target.value })} />
                <Input placeholder="Detalle" value={cashRenderForm.detail} onChange={(event) => setCashRenderForm({ ...cashRenderForm, detail: event.target.value })} />
                <Button type="button" variant="outline" onClick={addCashRender}>Agregar</Button>
              </div>
              <div className="mt-3 space-y-2">
                {rendition.cashRenders.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                    <span>{item.date}</span>
                    <strong>{currency.format(item.amount)}</strong>
                    <span className="text-muted-foreground">{item.detail || "Efectivo"}</span>
                  </div>
                ))}
                {rendition.cashRenders.length === 0 && <p className="rounded-md bg-surface-subtle p-3 text-sm text-muted-foreground">Sin efectivo rendido cargado.</p>}
              </div>
              <div className="mt-5 flex items-center justify-between">
                <h3 className="font-semibold">Transferencias rendidas</h3>
              </div>
              <div className="mt-3 grid gap-2 rounded-md border bg-surface-subtle p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input type="date" value={transferRenderForm.date} onChange={(event) => setTransferRenderForm({ ...transferRenderForm, date: event.target.value })} />
                <Input type="number" min="0" placeholder="Monto" value={transferRenderForm.amount} onChange={(event) => setTransferRenderForm({ ...transferRenderForm, amount: event.target.value })} />
                <Input placeholder="Comprobante" value={transferRenderForm.proof} onChange={(event) => setTransferRenderForm({ ...transferRenderForm, proof: event.target.value })} />
                <Button type="button" variant="outline" onClick={addTransferRender}>Agregar</Button>
              </div>
              <div className="mt-3 space-y-2">
                {rendition.transferRenders.map((item) => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3 text-sm">
                    <span>{item.date}</span>
                    <strong>{currency.format(item.amount)}</strong>
                    <span className="text-muted-foreground">{item.proof || "Sin comprobante"}</span>
                  </div>
                ))}
                {rendition.transferRenders.length === 0 && <p className="rounded-md bg-surface-subtle p-3 text-sm text-muted-foreground">Sin transferencias rendidas cargadas.</p>}
              </div>
            </div>}
            {isOfficeUser && <div className="rounded-md border bg-card p-3 sm:p-4 lg:col-span-2">
              <h2 className="font-semibold">Preparar nueva cobranza</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Usar al finalizar la cobranza y rendición. Conserva afiliados, cobradores, dependencias y comisiones; deja listo el nuevo período para importar el próximo listado.
              </p>
              <div className="mt-4 grid gap-3 rounded-md border bg-surface-subtle p-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
                <div className="space-y-1">
                  <Label htmlFor="next-collection-month">Nuevo período</Label>
                  <Input id="next-collection-month" type="month" value={nextCollectionMonth} onChange={(event) => setNextCollectionMonth(event.target.value)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  El mes cerrado queda guardado por fecha. Si ya cargaste pruebas en el nuevo período, esta acción las limpia para empezar de cero.
                </p>
                <Button type="button" variant="outline" onClick={prepareNewCollection}>
                  Preparar nueva cobranza
                </Button>
              </div>
            </div>}
          </section>
        )}
      </div>
      </div>

      <Dialog open={affiliateDialogOpen} onOpenChange={setAffiliateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingAffiliateId ? "Editar afiliado" : "Nuevo afiliado"}</DialogTitle></DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveAffiliate}>
            <div className="space-y-2 md:col-span-2"><Label>Nombre y apellido</Label><Input value={affiliateForm.fullName} onChange={(event) => setAffiliateForm({ ...affiliateForm, fullName: event.target.value })} required /></div>
            <div className="space-y-2"><Label>N° de póliza</Label><Input value={affiliateForm.policyNumber} onChange={(event) => setAffiliateForm({ ...affiliateForm, policyNumber: event.target.value })} /></div>
            <div className="space-y-2"><Label>Plan</Label><select value={affiliateForm.plan} onChange={(event) => setAffiliateForm({ ...affiliateForm, plan: event.target.value as PlanType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{availablePlans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
            <div className="space-y-2"><Label>Valor</Label><Input type="number" min="0" value={affiliateForm.value} onChange={(event) => setAffiliateForm({ ...affiliateForm, value: parseNumber(event.target.value) })} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={affiliateForm.phone} onChange={(event) => setAffiliateForm({ ...affiliateForm, phone: event.target.value })} /></div>
            <div className="space-y-2"><Label>Dependencia</Label><Input value={affiliateForm.dependency} onChange={(event) => setAffiliateForm({ ...affiliateForm, dependency: event.target.value })} /></div>
            <div className="space-y-2"><Label>Cobrador</Label><Input value={affiliateForm.collector} onChange={(event) => setAffiliateForm({ ...affiliateForm, collector: event.target.value })} /></div>
            <div className="space-y-2"><Label>Tickets base</Label><Input type="number" min="0" value={affiliateForm.sourceTickets || 0} onChange={(event) => setAffiliateForm({ ...affiliateForm, sourceTickets: parseNumber(event.target.value) })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Dirección</Label><Input value={affiliateForm.address} onChange={(event) => setAffiliateForm({ ...affiliateForm, address: event.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Pedido al cobrador</Label><Textarea className="min-h-24" value={affiliateForm.request} onChange={(event) => setAffiliateForm({ ...affiliateForm, request: event.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Novedad / respuesta</Label><Textarea className="min-h-24" value={affiliateForm.latestNews} onChange={(event) => setAffiliateForm({ ...affiliateForm, latestNews: event.target.value })} /></div>
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setAffiliateDialogOpen(false)}>Cancelar</Button><Button type="submit" variant="command">Guardar</Button></div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!collectorPickerAffiliateId} onOpenChange={(open) => !open && setCollectorPickerAffiliateId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Cambiar cobrador</DialogTitle></DialogHeader>
          {collectorPickerAffiliate && (
            <div className="rounded-md border bg-surface-subtle p-3 text-sm">
              <strong>{collectorPickerAffiliate.fullName}</strong>
              <p className="text-muted-foreground">Poliza {collectorPickerAffiliate.policyNumber || "-"} - {collectorPickerAffiliate.plan} - Actual: {collectorPickerAffiliate.collector || "OFICINA"}</p>
            </div>
          )}
          <div className="grid max-h-[55vh] gap-2 overflow-auto pr-1 sm:grid-cols-2">
            {visibleCollectorsForCobranza.map((collector) => (
              <Button
                key={collector}
                type="button"
                variant={normalizeCollectorName(collectorPickerAffiliate?.collector || "OFICINA") === normalizeCollectorName(collector) ? "command" : "outline"}
                className="justify-start"
                onClick={() => {
                  if (collectorPickerAffiliateId) updateAffiliateCollector(collectorPickerAffiliateId, collector);
                  setCollectorPickerAffiliateId(null);
                }}
              >
                {collector}
              </Button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => setCollectorPickerAffiliateId(null)}>Cancelar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!noteAffiliateId} onOpenChange={(open) => !open && setNoteAffiliateId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Agregar novedad</DialogTitle></DialogHeader>
          <form className="space-y-4" onSubmit={saveNote}>
            {noteAffiliateId && (
              <div className="rounded-md border bg-surface-subtle p-3 text-sm">
                <strong>{affiliatesById.get(noteAffiliateId)?.fullName || "Afiliado"}</strong>
                <p className="text-muted-foreground">
                  Póliza {affiliatesById.get(noteAffiliateId)?.policyNumber || "-"} · {affiliatesById.get(noteAffiliateId)?.plan || "-"} · Mes {activeMonth}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Novedad libre</Label>
              <Textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} className="min-h-32" placeholder="Escribí la novedad del afiliado o del ticket" required />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNoteAffiliateId(null)}>Cancelar</Button>
              <Button type="submit" variant="command">Guardar novedad</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={collectorReportOpen} onOpenChange={setCollectorReportOpen}>
        <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reporte de cobranza - {selectedCollectorName || "Cobrador"}</DialogTitle>
          </DialogHeader>
          {selectedCollectorSummary && (
            <div className="space-y-4">
              <div className="rounded-md border bg-surface-subtle p-3 text-sm">
                <strong>Período {activeMonth}</strong>
                <p className="mt-1 text-muted-foreground">Reporte consolidado de tickets, recibos, comisiones, rendición y devoluciones.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryBox label="Tickets cobrados" value={String(selectedCollectorSummary.chargedTickets)} />
                <SummaryBox label="Tickets devueltos" value={String(selectedCollectorSummary.pendingTickets)} />
                <SummaryBox label="Monto cobranza" value={currency.format(selectedCollectorStats.totalCollectionAmount)} />
                <SummaryBox label="Monto rendición" value={currency.format(selectedCollectorStats.reportRenditionAmount)} />
                <SummaryBox label="Monto comisión" value={currency.format(selectedCollectorStats.reportCommissionAmount)} />
                <SummaryBox label="Cobranza efectivo" value={currency.format(selectedCollectorStats.totalCashAmount)} />
                <SummaryBox label="Cobranza transferencia" value={currency.format(selectedCollectorStats.totalTransferAmount)} />
                <SummaryBox label="Recibos cobrados" value={String(selectedCollectorStats.receiptCount)} />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-md border bg-card p-3">
                  <h3 className="font-semibold">Detalle de tickets</h3>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p>Tickets en efectivo: <strong>{selectedCollectorStats.cashTickets}</strong></p>
                    <p>Monto efectivo tickets: <strong>{currency.format(selectedCollectorStats.cashAmount)}</strong></p>
                    <p>Tickets por transferencia: <strong>{selectedCollectorStats.transferTickets}</strong></p>
                    <p>Monto transferencia tickets: <strong>{currency.format(selectedCollectorStats.transferAmount)}</strong></p>
                  </div>
                </div>
                <div className="rounded-md border bg-card p-3">
                  <h3 className="font-semibold">Detalle de recibos</h3>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p>Recibos efectivo: <strong>{selectedCollectorStats.receiptCashCount}</strong></p>
                    <p>Monto efectivo recibos: <strong>{currency.format(selectedCollectorStats.receiptCashAmount)}</strong></p>
                    <p>Recibos transferencia: <strong>{selectedCollectorStats.receiptTransferCount}</strong></p>
                    <p>Monto transferencia recibos: <strong>{currency.format(selectedCollectorStats.receiptTransferAmount)}</strong></p>
                    <p>Total recibos: <strong>{selectedCollectorStats.receiptCount}</strong></p>
                    <p>Monto recibos: <strong>{currency.format(selectedCollectorStats.receiptAmount)}</strong></p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full min-w-[760px] text-xs sm:text-sm">
                  <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-left">Devolución</th>
                      <th className="px-3 py-3 text-left">Póliza</th>
                      <th className="px-3 py-3 text-left">Plan</th>
                      <th className="px-3 py-3 text-left">Dependencia</th>
                      <th className="px-3 py-3 text-center">Tickets devueltos</th>
                      <th className="px-3 py-3 text-right">Monto pendiente</th>
                      <th className="px-3 py-3 text-left">Control</th>
                      <th className="px-3 py-3 text-left">Observacion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {selectedCollectorReturnRows.map(({ affiliate, pendingTickets, pendingAmount, hasPhysicalTickets, observation }) => (
                      <tr key={`returned-${affiliate.id}`}>
                        <td className="px-3 py-3 font-medium">{affiliate.fullName}</td>
                        <td className="px-3 py-3">{affiliate.policyNumber || "-"}</td>
                        <td className="px-3 py-3">{affiliate.plan}</td>
                        <td className="px-3 py-3">{affiliate.dependency || "-"}</td>
                        <td className="px-3 py-3 text-center">{pendingTickets}</td>
                        <td className="px-3 py-3 text-right">{currency.format(pendingAmount)}</td>
                        <td className="px-3 py-3">{hasPhysicalTickets ? "Presenta tickets" : "No presenta tickets"}</td>
                        <td className="px-3 py-3">{observation || (hasPhysicalTickets ? "Controlado para devolucion" : "No informado / no presentado")}</td>
                      </tr>
                    ))}
                    {selectedCollectorReturnRows.length === 0 && (
                      <tr><td className="px-3 py-8 text-center text-muted-foreground" colSpan={8}>Sin devoluciones para este cobrador.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCollectorReportOpen(false)}>Cerrar</Button>
                <Button type="button" variant="command" onClick={exportCollectorReportExcel}>
                  <FileSpreadsheet className="h-4 w-4" />
                  Descargar Excel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

const SummaryBox = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-md bg-surface-subtle p-3">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className="mt-1 text-xl font-semibold">{value}</p>
  </div>
);

const TransferFields = ({ value, onChange }: { value: TransferData; onChange: (value: TransferData) => void }) => (
  <div className="mt-4 rounded-md border bg-surface-subtle p-3">
    <h3 className="font-semibold">Datos de transferencia</h3>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="space-y-1"><Label>N° transacción</Label><Input value={value.transactionNumber} onChange={(event) => onChange({ ...value, transactionNumber: event.target.value })} /></div>
      <div className="space-y-1"><Label>Comprobante</Label><Input value={value.proof} onChange={(event) => onChange({ ...value, proof: event.target.value })} /></div>
      <div className="space-y-1"><Label>Fecha</Label><Input type="date" value={value.date} onChange={(event) => onChange({ ...value, date: event.target.value })} /></div>
      <div className="space-y-1"><Label>Titular</Label><Input value={value.holder} onChange={(event) => onChange({ ...value, holder: event.target.value })} /></div>
      <div className="space-y-1 md:col-span-2"><Label>Observaciones</Label><Textarea value={value.notes} onChange={(event) => onChange({ ...value, notes: event.target.value })} /></div>
    </div>
  </div>
);

const TicketCollectionsDetail = ({ collections, affiliatesById, isAdminUser = false, onEdit, onDelete }: { collections: TicketCollection[]; affiliatesById: Map<string, Affiliate>; isAdminUser?: boolean; onEdit?: (collection: TicketCollection) => void; onDelete?: (collectionId: string) => void }) => {
  const [policySearch, setPolicySearch] = useState("");
  const normalizedSearch = policySearch.trim().replace(/\D/g, "");
  const filteredCollections = collections.filter((item) => {
    if (!normalizedSearch) return true;
    const affiliate = affiliatesById.get(item.affiliateId);
    return (affiliate?.policyNumber || item.policyNumber || "").replace(/\D/g, "").includes(normalizedSearch);
  });

  return (
  <div className="mt-6 rounded-md border bg-background p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="font-semibold">Detalle de tickets cobrados</h2>
        <p className="text-xs text-muted-foreground">{filteredCollections.length} de {collections.length} cobro(s) visible(s)</p>
      </div>
      <div className="w-full sm:max-w-xs">
        <Label htmlFor="ticket-policy-search">Buscar por poliza</Label>
        <Input
          id="ticket-policy-search"
          inputMode="numeric"
          value={policySearch}
          onChange={(event) => setPolicySearch(event.target.value)}
          placeholder="N de poliza"
        />
      </div>
    </div>
    <div className="mt-3 max-h-[680px] space-y-3 overflow-auto pr-1">
      {filteredCollections.slice().reverse().map((item) => {
        const affiliate = affiliatesById.get(item.affiliateId);
        const fullName = affiliate?.fullName || item.fullName || "Afiliado";
        const policyNumber = affiliate?.policyNumber || item.policyNumber || "-";
        const plan = affiliate?.plan || item.plan || "-";
        const dependency = affiliate?.dependency || item.dependency || "-";
        const amountLabel = currency.format((affiliate?.value ?? item.ticketValue ?? 0) * item.ticketsCharged);
        return (
          <div key={item.id} className="rounded-md border bg-surface-subtle p-3 text-sm">
            <strong>{fullName}</strong>
            <p className="text-xs text-muted-foreground">Poliza {policyNumber} - {plan} - Dep. {dependency}</p>
            {isAdminUser && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit?.(item)}>Editar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onDelete?.(item.id)}>Eliminar</Button>
              </div>
            )}
            <p className="text-muted-foreground">{item.ticketsCharged} ticket(s) · {methodLabel(item.paymentMethod)} · {amountLabel}</p>
          </div>
        );
      })}
      {filteredCollections.length === 0 && <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>}
    </div>
  </div>
  );
};

const ReceiptsList = ({
  receipts,
  isAdminUser,
  onEdit,
  onVoid,
  onDelete,
  onExport,
}: {
  receipts: ReceiptCollection[];
  isAdminUser: boolean;
  onEdit: (receipt: ReceiptCollection) => void;
  onVoid: (receiptId: string) => void;
  onDelete: (receiptId: string) => void;
  onExport: () => void;
}) => (
  <div className="mt-6 rounded-md border bg-background p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold">Recibos cargados</h2>
        <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onExport}>
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </Button>
        <p className="text-xs text-muted-foreground">{receipts.length} recibo(s) en el período visible</p>
      </div>
    </div>
    <div className="mt-3 max-h-[680px] space-y-3 overflow-auto pr-1">
      {receipts.slice().reverse().map((item) => {
        const paidMonths = item.paidMonths?.length ? item.paidMonths.map(monthLabel).join(" / ") : monthLabel(item.paidMonth);
        const isVoided = item.status === "anulado";
        return (
          <div key={item.id} className={`rounded-md border p-3 text-sm ${isVoided ? "border-red-200 bg-red-50 text-red-950" : "bg-surface-subtle"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong>{item.fullName}</strong>
                <p className="text-muted-foreground">Recibo {item.receiptNumber} · Póliza {item.policyNumber || "-"} · {item.plan}</p>
                <p className="text-muted-foreground">{paidMonths} · {methodLabel(item.paymentMethod)} · {currency.format(item.monthlyAmount * item.monthCount)}</p>
                {item.collector && <p className="text-xs text-muted-foreground">Cobrador: {item.collector}</p>}
                {item.isProduction && <p className="mt-2 text-xs font-semibold uppercase text-amber-700">Produccion</p>}
                {isVoided && <p className="mt-2 text-xs font-semibold uppercase text-red-700">Anulado</p>}
              </div>
              <span className={`rounded px-2 py-1 text-[10px] font-semibold uppercase ${isVoided ? "bg-red-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                {isVoided ? "Anulado" : "Activo"}
              </span>
            </div>
            {isAdminUser && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onEdit(item)}>Editar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onVoid(item.id)} disabled={isVoided}>Anular</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onDelete(item.id)}>Eliminar</Button>
              </div>
            )}
          </div>
        );
      })}
      {receipts.length === 0 && <p className="text-sm text-muted-foreground">Sin recibos registrados.</p>}
    </div>
  </div>
);

const RecentNotes = ({ notes, affiliatesById }: { notes: AffiliateNote[]; affiliatesById: Map<string, Affiliate> }) => (
  <aside className="rounded-md border bg-card p-4">
    <h2 className="font-semibold">Últimas novedades</h2>
    <div className="mt-3 space-y-3">
      {notes.slice(0, 8).map((item) => {
        const affiliate = affiliatesById.get(item.affiliateId);
        return (
          <div key={item.id} className="rounded-md border bg-surface-subtle p-3 text-sm">
            <strong>{affiliate?.fullName || "Afiliado"}</strong>
            <p className="text-xs text-muted-foreground">
              Póliza {affiliate?.policyNumber || "-"} · {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.date))}
            </p>
            <p className="mt-2">{item.text}</p>
          </div>
        );
      })}
      {notes.length === 0 && <p className="text-sm text-muted-foreground">Sin novedades cargadas.</p>}
    </div>
  </aside>
);

export default InsuranceCollections;
