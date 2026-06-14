import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  CheckSquare,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Smartphone,
  Users,
  Plus,
  ReceiptText,
  Search,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type PlanType = string;
type PaymentMethod = "E" | "T" | "";
type Section = "Base" | "CobradorMovil" | "Cobradores" | "Mensual" | "Cobranza" | "Recibos" | "Novedades" | "Totales" | "Rendicion";

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
  ticketsCharged: number;
  paymentMethod: PaymentMethod;
  transfer?: TransferData;
};

type ReceiptCollection = {
  id: string;
  collectionMonth: string;
  receiptNumber: string;
  fullName: string;
  plan: PlanType;
  paidMonth: string;
  monthCount: number;
  monthlyAmount: number;
  paymentMethod: PaymentMethod;
  transfer?: TransferData;
};

type AffiliateNote = {
  id: string;
  affiliateId: string;
  month: string;
  date: string;
  text: string;
};

type Rendition = {
  cashRenders: Array<{ id: string; date: string; amount: number; detail: string }>;
  transferRenders: Array<{ id: string; date: string; amount: number; proof: string }>;
};

type AffiliateForm = Omit<Affiliate, "id" | "selectedForMonthly">;

type AffiliateImportPreview = {
  source: string;
  rows: Affiliate[];
  newRows: Affiliate[];
  existingCount: number;
  changedRows: Array<{ incoming: Affiliate; previous: Affiliate; fields: string[] }>;
  duplicatedCount: number;
};

type CollectorRecord = {
  name: string;
  phone: string;
};

type CloudSnapshot = {
  affiliates: Affiliate[];
  monthlyItems: MonthlyItem[];
  ticketCollections: TicketCollection[];
  receipts: ReceiptCollection[];
  notes: AffiliateNote[];
  rendition: Rendition;
  collectorRecords: CollectorRecord[];
  customDependencies: string[];
  collectorWhatsapp: string;
  activeMonth: string;
};

const plans: PlanType[] = ["A 238", "A 269", "G 238", "09", "G 269", "C", "Vida"];
const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/17_pvb9vNQPJULu5XWJ3Yuy7HHbbT1GKfhgwe_4_--q0/edit?usp=sharing";
const affiliatesStorageKey = "insurance-affiliates-v2";
const monthlyStorageKey = "insurance-monthly-v2";
const ticketCollectionsStorageKey = "insurance-ticket-collections-v2";
const receiptsStorageKey = "insurance-receipts-v2";
const notesStorageKey = "insurance-affiliate-notes-v2";
const renditionStorageKey = "insurance-rendition-v2";
const collectorWhatsappStorageKey = "insurance-collector-whatsapp-v2";
const collectorsStorageKey = "insurance-collectors-v2";
const dependenciesStorageKey = "insurance-dependencies-v2";
const cloudSnapshotKey = "cobranza-tres-provincias";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

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
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseNumber = (value: string | number | undefined) => {
  const parsed = Number(String(value ?? "").replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

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
  if (normalized === "A") return { plan: "A 327", dependency: "327" };
  if (normalized === "G") return { plan: "G 327", dependency: "327" };
  if (normalized === "C") return { plan: "C", dependency: "327" };
  if (normalized === "VIDA" || normalized === "V") return { plan: "Vida", dependency: "268" };
  if (normalized === "09") return { plan: "09", dependency: "OFICINA" };
  return { plan: normalizePlan(rawPlan), dependency: "SIN DEFINIR" };
};

const looksLikeTresProvinciasCollection = (rows: string[][]) => {
  return rows.some((row) => {
    const headers = row.map((cell) => normalizeHeader(cell));
    return headers.includes("POLIZA") && headers.includes("APELLIDO") && headers.includes("NOMBRE") && headers.some((cell) => cell.includes("COBRADOR"));
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
  const seen = new Set<string>();
  let duplicatedCount = 0;

  const affiliates = rows.slice(headerIndex + 1).flatMap((row, index): Affiliate[] => {
    const policyNumber = (row[policyColumn] || "").trim();
    const rawPlan = (row[planColumn] || "").trim();
    const lastName = (row[lastNameColumn] || "").trim();
    const firstName = (row[firstNameColumn] || "").trim();
    if (!/^\d+$/.test(policyNumber) || !rawPlan || (!lastName && !firstName)) return [];
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
      collector: (row[collectorColumn] || "").trim().toLocaleUpperCase("es-AR") || "OFICINA",
      request: "",
      latestNews: "",
      selectedForMonthly: true,
      sourceTickets: 1,
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

const normalizeCollectorRecords = (value: unknown): CollectorRecord[] => {
  const rows = Array.isArray(value) ? value : ["OFICINA"];
  const normalized = rows.flatMap((item): CollectorRecord[] => {
    if (typeof item === "string") return [{ name: item.trim().toLocaleUpperCase("es-AR"), phone: "" }];
    if (item && typeof item === "object" && "name" in item) {
      const record = item as { name?: unknown; phone?: unknown };
      return [{ name: String(record.name || "").trim().toLocaleUpperCase("es-AR"), phone: String(record.phone || "").trim() }];
    }
    return [];
  }).filter((item) => item.name);
  const byName = new Map<string, CollectorRecord>();
  normalized.forEach((item) => byName.set(item.name, item));
  if (!byName.has("OFICINA")) byName.set("OFICINA", { name: "OFICINA", phone: "" });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, "es-AR", { numeric: true }));
};

const isDemoAffiliateBase = (rows: Affiliate[]) => {
  if (rows.length !== demoAffiliates.length) return false;
  const demoIds = new Set(demoAffiliates.map((item) => item.id));
  return rows.every((item) => demoIds.has(item.id));
};

const buildAffiliateImportPreview = (rows: Affiliate[], current: Affiliate[], source: string, duplicatedCount: number): AffiliateImportPreview => {
  const currentById = new Map(current.map((item) => [item.id, item]));
  const newRows: Affiliate[] = [];
  const changedRows: AffiliateImportPreview["changedRows"] = [];
  let existingCount = 0;

  rows.forEach((incoming) => {
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

  return { source, rows, newRows, existingCount, changedRows, duplicatedCount };
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

const InsuranceCollections = () => {
  const [activeSection, setActiveSection] = useState<Section>("Base");
  const [activeMonth, setActiveMonth] = useState(currentMonth);
  const [affiliates, setAffiliates] = useState<Affiliate[]>(() => loadStorage(affiliatesStorageKey, demoAffiliates));
  const [monthlyItems, setMonthlyItems] = useState<MonthlyItem[]>(() => loadStorage(monthlyStorageKey, []));
  const [ticketCollections, setTicketCollections] = useState<TicketCollection[]>(() => loadStorage(ticketCollectionsStorageKey, []));
  const [receipts, setReceipts] = useState<ReceiptCollection[]>(() => loadStorage(receiptsStorageKey, []));
  const [notes, setNotes] = useState<AffiliateNote[]>(() => loadStorage(notesStorageKey, []));
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
  const [collectorRecords, setCollectorRecords] = useState<CollectorRecord[]>(() => normalizeCollectorRecords(loadStorage(collectorsStorageKey, ["OFICINA"])));
  const [customDependencies, setCustomDependencies] = useState<string[]>(() => loadStorage(dependenciesStorageKey, []));
  const [newCollectorName, setNewCollectorName] = useState("");
  const [newCollectorPhone, setNewCollectorPhone] = useState("");
  const [collectorToRename, setCollectorToRename] = useState("");
  const [collectorRenameValue, setCollectorRenameValue] = useState("");
  const [collectorPhoneValue, setCollectorPhoneValue] = useState("");
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
  const [collectionPolicy, setCollectionPolicy] = useState("");
  const [collectionPlan, setCollectionPlan] = useState<PlanType>("A 238");
  const [collectionTickets, setCollectionTickets] = useState("1");
  const [collectionMethod, setCollectionMethod] = useState<PaymentMethod>("E");
  const [collectionTransfer, setCollectionTransfer] = useState<TransferData>(emptyTransferForm);
  const [mobileCollector, setMobileCollector] = useState("todos");
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileSelectedAffiliateId, setMobileSelectedAffiliateId] = useState("");
  const [mobileNoteText, setMobileNoteText] = useState("");
  const [receiptForm, setReceiptForm] = useState({
    receiptNumber: "",
    fullName: "",
    plan: "A 238" as PlanType,
    paidMonth: "",
    monthCount: "1",
    monthlyAmount: "",
    paymentMethod: "E" as PaymentMethod,
    transfer: emptyTransfer(),
  });
  const [cashRenderForm, setCashRenderForm] = useState({ date: today(), amount: "", detail: "" });
  const [transferRenderForm, setTransferRenderForm] = useState({ date: today(), amount: "", proof: "" });
  const [cloudStatus, setCloudStatus] = useState("Modo local activo");
  const [cloudBusy, setCloudBusy] = useState(false);

  useEffect(() => saveStorage(affiliatesStorageKey, affiliates), [affiliates]);
  useEffect(() => saveStorage(monthlyStorageKey, monthlyItems), [monthlyItems]);
  useEffect(() => saveStorage(ticketCollectionsStorageKey, ticketCollections), [ticketCollections]);
  useEffect(() => saveStorage(receiptsStorageKey, receipts), [receipts]);
  useEffect(() => saveStorage(notesStorageKey, notes), [notes]);
  useEffect(() => saveStorage(renditionStorageKey, rendition), [rendition]);
  useEffect(() => saveStorage(collectorWhatsappStorageKey, collectorWhatsapp), [collectorWhatsapp]);
  useEffect(() => saveStorage(collectorsStorageKey, collectorRecords), [collectorRecords]);
  useEffect(() => saveStorage(dependenciesStorageKey, customDependencies), [customDependencies]);

  const buildCloudSnapshot = (): CloudSnapshot => ({
    affiliates,
    monthlyItems,
    ticketCollections,
    receipts,
    notes,
    rendition,
    collectorRecords,
    customDependencies,
    collectorWhatsapp,
    activeMonth,
  });

  const applyCloudSnapshot = (snapshot: Partial<CloudSnapshot>) => {
    setAffiliates(Array.isArray(snapshot.affiliates) ? snapshot.affiliates : demoAffiliates);
    setMonthlyItems(Array.isArray(snapshot.monthlyItems) ? snapshot.monthlyItems : []);
    setTicketCollections(Array.isArray(snapshot.ticketCollections) ? snapshot.ticketCollections : []);
    setReceipts(Array.isArray(snapshot.receipts) ? snapshot.receipts : []);
    setNotes(Array.isArray(snapshot.notes) ? snapshot.notes : []);
    setRendition(snapshot.rendition && Array.isArray(snapshot.rendition.cashRenders) && Array.isArray(snapshot.rendition.transferRenders) ? snapshot.rendition : { cashRenders: [], transferRenders: [] });
    setCollectorRecords(normalizeCollectorRecords(snapshot.collectorRecords || ["OFICINA"]));
    setCustomDependencies(Array.isArray(snapshot.customDependencies) ? snapshot.customDependencies : []);
    setCollectorWhatsapp(String(snapshot.collectorWhatsapp || ""));
    if (snapshot.activeMonth) setActiveMonth(snapshot.activeMonth);
  };

  const saveCloudSnapshot = async () => {
    setCloudBusy(true);
    setCloudStatus("Guardando en la base online...");
    const { error } = await supabase
      .from("app_snapshots")
      .upsert({ key: cloudSnapshotKey, data: buildCloudSnapshot(), updated_at: new Date().toISOString() }, { onConflict: "key" });
    setCloudBusy(false);
    if (error) {
      setCloudStatus(`No se pudo guardar online: ${error.message}`);
      return;
    }
    setCloudStatus(`Guardado online ${new Date().toLocaleString("es-AR")}`);
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
      return;
    }
    applyCloudSnapshot(data.data as Partial<CloudSnapshot>);
    setCloudStatus(`Datos online cargados. Ultima actualizacion: ${new Date(data.updated_at).toLocaleString("es-AR")}`);
  };

  const affiliatesById = useMemo(() => new Map(affiliates.map((item) => [item.id, item])), [affiliates]);

  const getPendingTickets = (affiliateId: string) => {
    const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliateId);
    const charged = ticketCollections
      .filter((item) => item.month === activeMonth && item.affiliateId === affiliateId)
      .reduce((sum, item) => sum + item.ticketsCharged, 0);
    return Math.max((monthly?.tickets || 0) - charged, 0);
  };

  const filteredAffiliates = useMemo(() => {
    const normalized = query.trim().toLocaleUpperCase("es-AR");
    return affiliates
      .filter((item) => !normalized || `${item.fullName} ${item.policyNumber} ${item.plan} ${item.dependency} ${item.collector || "OFICINA"}`.toLocaleUpperCase("es-AR").includes(normalized))
      .filter((item) => dependencyFilter === "todos" || (item.dependency || "SIN DEFINIR") === dependencyFilter)
      .filter((item) => collectorFilter === "todos" || (item.collector || "OFICINA") === collectorFilter)
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
  }, [activeMonth, affiliates, collectorFilter, dependencyFilter, pendingFilter, query, monthlyItems, ticketCollections]);

  const dependencies = useMemo(() => {
    return uniqueSorted([...customDependencies, ...affiliates.map((item) => item.dependency || "SIN DEFINIR")]);
  }, [affiliates, customDependencies]);

  const collectors = useMemo(() => {
    return uniqueSorted([...collectorRecords.map((item) => item.name), "OFICINA", ...affiliates.map((item) => item.collector || "OFICINA")]);
  }, [affiliates, collectorRecords]);

  const collectorPhoneByName = useMemo(() => new Map(collectorRecords.map((item) => [item.name, item.phone])), [collectorRecords]);

  const collectorRows = useMemo(() => {
    return collectors.map((collector) => {
      const assigned = affiliates.filter((item) => (item.collector || "OFICINA") === collector);
      const tickets = assigned.reduce((sum, affiliate) => {
        const monthly = monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id);
        return sum + (monthly?.tickets || 0);
      }, 0);
      const chargedTickets = ticketCollections
        .filter((item) => item.month === activeMonth && (affiliatesById.get(item.affiliateId)?.collector || "OFICINA") === collector)
        .reduce((sum, item) => sum + item.ticketsCharged, 0);
      const chargedAmount = ticketCollections
        .filter((item) => item.month === activeMonth && (affiliatesById.get(item.affiliateId)?.collector || "OFICINA") === collector)
        .reduce((sum, item) => sum + (affiliatesById.get(item.affiliateId)?.value || 0) * item.ticketsCharged, 0);
      return {
        collector,
        phone: collectorPhoneByName.get(collector) || "",
        dependencies: Array.from(new Set(assigned.map((item) => item.dependency || "SIN DEFINIR"))).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true })),
        affiliates: assigned.length,
        tickets,
        chargedTickets,
        pendingTickets: Math.max(tickets - chargedTickets, 0),
        chargedAmount,
      };
    });
  }, [activeMonth, affiliates, affiliatesById, collectorPhoneByName, collectors, monthlyItems, ticketCollections]);

  const monthlyRows = useMemo(() => {
    return affiliates
      .filter((item) => item.selectedForMonthly)
      .map((affiliate) => ({
        affiliate,
        monthly: monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === affiliate.id) || { month: activeMonth, affiliateId: affiliate.id, tickets: 0 },
      }));
  }, [activeMonth, affiliates, monthlyItems]);

  const selectedMonthlyAffiliate = useMemo(() => {
    return affiliates.find((item) => item.policyNumber === collectionPolicy.trim() && item.plan === collectionPlan) || null;
  }, [affiliates, collectionPlan, collectionPolicy]);

  const selectedMonthlyItem = selectedMonthlyAffiliate ? monthlyItems.find((item) => item.month === activeMonth && item.affiliateId === selectedMonthlyAffiliate.id) : null;
  const alreadyChargedTickets = selectedMonthlyAffiliate
    ? ticketCollections.filter((item) => item.month === activeMonth && item.affiliateId === selectedMonthlyAffiliate.id).reduce((sum, item) => sum + item.ticketsCharged, 0)
    : 0;
  const ticketsToCharge = Math.max((selectedMonthlyItem?.tickets || 0) - alreadyChargedTickets, 0);
  const hasUnansweredRequest = !!selectedMonthlyAffiliate?.request?.trim() && !selectedMonthlyAffiliate?.latestNews?.trim();
  const mobileCollectorRows = useMemo(() => {
    const normalized = mobileSearch.trim().toLocaleUpperCase("es-AR");
    return monthlyRows
      .map(({ affiliate, monthly }) => ({
        affiliate,
        monthly,
        pending: getPendingTickets(affiliate.id),
      }))
      .filter((row) => row.pending > 0)
      .filter((row) => mobileCollector === "todos" || (row.affiliate.collector || "OFICINA") === mobileCollector)
      .filter((row) => !normalized || `${row.affiliate.fullName} ${row.affiliate.policyNumber} ${row.affiliate.plan} ${row.affiliate.dependency}`.toLocaleUpperCase("es-AR").includes(normalized))
      .sort((a, b) => b.pending - a.pending || a.affiliate.fullName.localeCompare(b.affiliate.fullName, "es-AR"));
  }, [activeMonth, mobileCollector, mobileSearch, monthlyRows, ticketCollections]);

  const mobileSelectedAffiliate = useMemo(() => {
    return affiliates.find((item) => item.id === mobileSelectedAffiliateId) || selectedMonthlyAffiliate || null;
  }, [affiliates, mobileSelectedAffiliateId, selectedMonthlyAffiliate]);

  const openMobileCollection = (affiliate: Affiliate) => {
    setMobileSelectedAffiliateId(affiliate.id);
    setCollectionPolicy(affiliate.policyNumber);
    setCollectionPlan(affiliate.plan);
    setCollectionTickets(String(Math.max(1, getPendingTickets(affiliate.id))));
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
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
    const phone = (collectorPhoneByName.get(affiliate.collector || "OFICINA") || collectorWhatsapp).replace(/\D/g, "");
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

  const totalsByPlan = useMemo(() => {
    return availablePlans.map((plan) => {
      const monthlyForPlan = monthlyRows.filter(({ affiliate }) => affiliate.plan === plan);
      const collectionsForPlan = ticketCollections.filter((item) => item.month === activeMonth && affiliatesById.get(item.affiliateId)?.plan === plan);
      const receiptsForPlan = receipts.filter((item) => item.collectionMonth === activeMonth && item.plan === plan);
      const ticketValue = (collection: TicketCollection) => {
        const affiliate = affiliatesById.get(collection.affiliateId);
        return (affiliate?.value || 0) * collection.ticketsCharged;
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
  }, [activeMonth, affiliatesById, availablePlans, monthlyRows, receipts, ticketCollections]);

  const totalCashCollected = totalsByPlan.reduce((sum, item) => sum + item.ticketCashAmount + item.receiptCashAmount, 0);
  const totalTransferCollected = totalsByPlan.reduce((sum, item) => sum + item.ticketTransferAmount + item.receiptTransferAmount, 0);
  const totalCollected = totalCashCollected + totalTransferCollected;
  const commission = totalCollected * 0.12;
  const totalToRender = totalCollected - commission;
  const totalTransferRendered = rendition.transferRenders.reduce((sum, item) => sum + item.amount, 0);
  const totalCashRendered = rendition.cashRenders.reduce((sum, item) => sum + item.amount, 0);
  const totalRendered = totalCashRendered + totalTransferRendered;

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

  const importAffiliates = (imported: Affiliate[]) => {
    const currentById = new Map(affiliates.map((item) => [item.id, item]));
    const merged = imported.map((item) => {
      const previous = currentById.get(item.id);
      return previous ? { ...item, phone: previous.phone, address: previous.address, dependency: item.dependency || previous.dependency, collector: previous.collector || item.collector || "OFICINA", request: previous.request || item.request || "", latestNews: previous.latestNews || item.latestNews || "", selectedForMonthly: true } : item;
    });
    setAffiliates(merged);
    setMonthlyItems((current) => [
      ...current.filter((item) => item.month !== activeMonth),
      ...merged
        .filter((item) => item.selectedForMonthly)
        .map((item) => ({ month: activeMonth, affiliateId: item.id, tickets: Math.max(0, item.sourceTickets || 0) })),
    ]);
    setImportMessage(`Base importada: ${merged.length} afiliados cargados en Dependencia 001 para ${activeMonth}.`);
    setAffiliateImportPreview(null);
  };

  const previewAffiliates = (imported: Affiliate[], source: string, duplicatedCount: number) => {
    setAffiliateImportPreview(buildAffiliateImportPreview(imported, affiliates, source, duplicatedCount));
    setImportMessage(`${source}: ${imported.length} afiliados listos para revisar antes de aplicar.`);
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
    reader.readAsText(file);
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
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, request } : item));
  };

  const updateAffiliateNews = (affiliateId: string, latestNews: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, latestNews } : item));
  };

  const updateAffiliateDependency = (affiliateId: string, dependency: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, dependency } : item));
  };

  const updateAffiliateCollector = (affiliateId: string, collector: string) => {
    setAffiliates((current) => current.map((item) => item.id === affiliateId ? { ...item, collector } : item));
  };

  const addCollector = () => {
    const name = newCollectorName.trim().toLocaleUpperCase("es-AR");
    if (!name) return;
    setCollectorRecords((current) => normalizeCollectorRecords([...current, { name, phone: newCollectorPhone.trim() }]));
    setNewCollectorName("");
    setNewCollectorPhone("");
  };

  const renameCollector = () => {
    const from = collectorToRename.trim();
    const to = collectorRenameValue.trim().toLocaleUpperCase("es-AR");
    if (!from) return;
    const finalName = to || from;
    setAffiliates((current) => current.map((item) => (item.collector || "OFICINA") === from ? { ...item, collector: finalName } : item));
    setCollectorRecords((current) => normalizeCollectorRecords(current.map((item) => item.name === from ? { name: finalName, phone: collectorPhoneValue.trim() } : item).concat({ name: finalName, phone: collectorPhoneValue.trim() })));
    if (collectorFilter === from) setCollectorFilter(finalName);
    setCollectorToRename("");
    setCollectorRenameValue("");
    setCollectorPhoneValue("");
  };

  const addDependency = () => {
    const name = newDependencyName.trim().toLocaleUpperCase("es-AR");
    if (!name) return;
    setCustomDependencies((current) => uniqueSorted([...current, name]));
    setNewDependencyName("");
  };

  const selectCollectorToEdit = (collector: string) => {
    setCollectorToRename(collector);
    setCollectorRenameValue(collector);
    setCollectorPhoneValue(collectorPhoneByName.get(collector) || "");
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

  const saveTicketCollection = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMonthlyAffiliate) return;
    if (hasUnansweredRequest) {
      alert("Esta póliza tiene un pedido pendiente. Para guardar el cobro, primero completá la novedad/respuesta.");
      return;
    }
    const tickets = Math.max(0, Math.min(parseNumber(collectionTickets), ticketsToCharge));
    if (tickets <= 0) return;
    setTicketCollections((current) => [...current, {
      id: `ticket-${Date.now()}`,
      month: activeMonth,
      affiliateId: selectedMonthlyAffiliate.id,
      ticketsCharged: tickets,
      paymentMethod: collectionMethod,
      transfer: collectionMethod === "T" ? collectionTransfer : undefined,
    }]);
    setCollectionTickets("1");
    setCollectionMethod("E");
    setCollectionTransfer(emptyTransfer());
    setMobileSelectedAffiliateId("");
    setMobileNoteText("");
  };

  const saveReceipt = (event: FormEvent) => {
    event.preventDefault();
    setReceipts((current) => [...current, {
      id: `receipt-${Date.now()}`,
      collectionMonth: activeMonth,
      receiptNumber: receiptForm.receiptNumber.trim() || `S/N-${Date.now()}`,
      fullName: receiptForm.fullName.trim().toLocaleUpperCase("es-AR"),
      plan: receiptForm.plan,
      paidMonth: receiptForm.paidMonth,
      monthCount: Math.max(1, parseNumber(receiptForm.monthCount)),
      monthlyAmount: parseMoney(receiptForm.monthlyAmount),
      paymentMethod: receiptForm.paymentMethod,
      transfer: receiptForm.paymentMethod === "T" ? receiptForm.transfer : undefined,
    }]);
    setReceiptForm({ receiptNumber: "", fullName: "", plan: "A 238", paidMonth: "", monthCount: "1", monthlyAmount: "", paymentMethod: "E", transfer: emptyTransfer() });
  };

  const exportAffiliatesCsv = () => {
    const escapeCsv = (value: string | number | boolean) => {
      const text = String(value ?? "");
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
    };
    const header = ["Nombre y apellido", "Numero de poliza", "Plan", "Valor", "Telefono", "Direccion", "Dependencia", "Cobrador", "Pedido", "Novedad", "Seleccionado mensual"].join(",");
    const rows = affiliates.map((item) => [item.fullName, item.policyNumber, item.plan, item.value, item.phone, item.address, item.dependency || "001", item.collector || "OFICINA", item.request || "", item.latestNews || "", item.selectedForMonthly ? "SI" : "NO"].map(escapeCsv).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "base-afiliados.csv";
    link.click();
    URL.revokeObjectURL(url);
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

  const navItems: Array<{ id: Section; label: string; icon: typeof ClipboardList }> = [
    { id: "Base", label: "Base de afiliados", icon: ClipboardList },
    { id: "CobradorMovil", label: "Vista cobrador", icon: Smartphone },
    { id: "Cobradores", label: "Cobradores", icon: Users },
    { id: "Mensual", label: "Cobranza mensual", icon: CheckSquare },
    { id: "Cobranza", label: "Cobranza", icon: Banknote },
    { id: "Recibos", label: "Recibos", icon: ReceiptText },
    { id: "Novedades", label: "Novedades", icon: ClipboardList },
    { id: "Totales", label: "Totales", icon: Calculator },
    { id: "Rendicion", label: "Rendición", icon: ShieldCheck },
  ];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="border-b bg-card">
        <div className="flex w-full flex-col gap-4 px-3 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground sm:h-11 sm:w-11">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold leading-tight sm:text-2xl">Sistema de afiliados y cobranza</h1>
              <p className="text-sm text-muted-foreground">Base de datos, cobranza mensual, recibos, totales y rendición</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <div className="col-span-2 flex h-10 items-center gap-2 rounded-md border bg-background px-3 sm:col-span-1">
              <Label htmlFor="active-month" className="mb-0 text-xs text-muted-foreground">Mes</Label>
              <Input id="active-month" type="month" value={activeMonth} onChange={(event) => setActiveMonth(event.target.value || currentMonth())} className="h-8 w-36 border-0 p-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button type="button" variant="command" className="w-full sm:w-auto" onClick={() => openAffiliateForm()}>
              <Plus className="h-4 w-4" />
              Nuevo afiliado
            </Button>
            <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground sm:w-auto sm:px-4">
              <Upload className="h-4 w-4" />
              Importar CSV cobranza
              <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
            </label>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={exportAffiliatesCsv}>
              <Download className="h-4 w-4" />
              Exportar base
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={loadCloudSnapshot} disabled={cloudBusy}>
              Cargar online
            </Button>
            <Button type="button" variant="command" className="w-full sm:w-auto" onClick={saveCloudSnapshot} disabled={cloudBusy}>
              Guardar online
            </Button>
          </div>
        </div>
        <div className="px-3 pb-3 text-xs text-muted-foreground sm:px-5">{cloudStatus}</div>
      </div>

      <div className="grid w-full gap-4 px-3 py-4 sm:px-5 sm:py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-md border bg-card p-3 sm:p-4 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between gap-3 lg:block">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Módulo</p>
            <h2 className="text-base font-semibold sm:text-lg lg:mt-1">Cobranza Tres Provincias</h2>
            <p className="hidden text-xs text-muted-foreground sm:block lg:mt-1">Cartera, cobradores, tickets y rendición.</p>
          </div>
        </aside>

        <div className="grid min-w-0 gap-4 sm:gap-5">
        <section className={`${affiliateImportPreview ? "" : "hidden"} rounded-md border bg-card p-3 sm:p-4`}>
          {affiliateImportPreview && (
            <div className="rounded-md border bg-surface-subtle p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="font-semibold">Previsualización de importación</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{affiliateImportPreview.source} · {affiliateImportPreview.rows.length} afiliados leídos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.newRows.length}</strong> nuevos</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.existingCount}</strong> existentes</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.changedRows.length}</strong> con cambios</span>
                  <span className="rounded-md border bg-card px-3 py-2 text-sm"><strong>{affiliateImportPreview.duplicatedCount}</strong> duplicados</span>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border bg-card p-3">
                  <h3 className="text-sm font-semibold">Nuevos afiliados</h3>
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {affiliateImportPreview.newRows.slice(0, 12).map((item) => (
                      <div key={`new-${item.id}`} className="rounded-md bg-surface-subtle px-3 py-2 text-sm">
                        <strong>{item.fullName || "Sin nombre"}</strong>
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
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Afiliados", affiliates.length, "Clientes en base"],
            ["Seleccionados", affiliates.filter((item) => item.selectedForMonthly).length, "Pasan a cobranza mensual"],
            ["Tickets mensuales", monthlyItems.filter((item) => item.month === activeMonth).reduce((sum, item) => sum + item.tickets, 0), "Tickets recibidos"],
            ["Novedades", notes.filter((item) => item.month === activeMonth).length, "Cargadas en el mes"],
            ["Total a rendir", currency.format(totalToRender), "Cobrado menos comisión"],
          ].map(([label, value, helper]) => (
            <div key={String(label)} className="rounded-md border bg-card p-3 shadow-command sm:p-4">
              <p className="text-sm font-medium text-muted-foreground">{String(label)}</p>
              <p className="mt-2 text-2xl font-semibold sm:text-3xl">{String(value)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{String(helper)}</p>
            </div>
          ))}
        </section>

        <nav className="grid grid-cols-2 gap-2 rounded-md border bg-card p-2 sm:flex sm:flex-wrap">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Button key={id} type="button" className="justify-start sm:justify-center" variant={activeSection === id ? "command" : "ghost"} onClick={() => setActiveSection(id)}>
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </nav>

        {activeSection === "Base" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
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
                    {dependencies.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
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
                    {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
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
                    <th className="w-52 px-3 py-3 text-left">Pedido</th>
                    <th className="w-52 px-3 py-3 text-left">Novedad</th>
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
                          {dependencies.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
                        </select>
                      </td>
                      <td className="w-28 px-2 py-3">
                        <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs" value={item.collector || "OFICINA"} onChange={(event) => updateAffiliateCollector(item.id, event.target.value)}>
                          {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                        </select>
                      </td>
                      <td className="w-28 px-3 py-3 text-right">{currency.format(item.value)}</td>
                      <td className="w-20 px-2 py-3 text-center">{monthlyItems.find((monthly) => monthly.month === activeMonth && monthly.affiliateId === item.id)?.tickets || 0}</td>
                      <td className="w-24 px-2 py-3 text-center">{getPendingTickets(item.id)}</td>
                      <td className="w-52 px-3 py-3"><Input className="h-8 text-xs sm:text-sm" value={item.request || ""} onChange={(event) => updateAffiliateRequest(item.id, event.target.value)} placeholder="Pedir info" /></td>
                      <td className="w-52 px-3 py-3"><Input className="h-8 text-xs sm:text-sm" value={item.latestNews || ""} onChange={(event) => updateAffiliateNews(item.id, event.target.value)} placeholder="Respuesta / novedad" /></td>
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
              <div className="grid gap-3 border-b p-3 sm:grid-cols-[1fr_1fr] sm:p-4">
                <div className="space-y-1">
                  <Label htmlFor="mobile-collector">Cobrador</Label>
                  <select
                    id="mobile-collector"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={mobileCollector}
                    onChange={(event) => setMobileCollector(event.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
                  </select>
                </div>
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
              </div>
              <div className="grid gap-3 p-3 sm:p-4">
                {mobileCollectorRows.slice(0, 40).map(({ affiliate, pending }) => {
                  const selected = mobileSelectedAffiliateId === affiliate.id || selectedMonthlyAffiliate?.id === affiliate.id;
                  return (
                    <button
                      key={affiliate.id}
                      type="button"
                      className={`rounded-md border p-3 text-left transition hover:bg-accent ${selected ? "border-primary bg-primary/5" : "bg-background"}`}
                      onClick={() => openMobileCollection(affiliate)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold leading-tight">{affiliate.fullName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Póliza {affiliate.policyNumber} · {affiliate.plan} · Dep. {affiliate.dependency || "-"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Cobrador: {affiliate.collector || "OFICINA"}</p>
                        </div>
                        <div className="shrink-0 rounded-md bg-surface-subtle px-3 py-2 text-center">
                          <p className="text-xl font-semibold">{pending}</p>
                          <p className="text-[10px] uppercase text-muted-foreground">pend.</p>
                        </div>
                      </div>
                      {affiliate.request?.trim() && (
                        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">Pedido: {affiliate.request}</p>
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
                  <p className="mt-1 text-muted-foreground">Póliza {mobileSelectedAffiliate.policyNumber} · {mobileSelectedAffiliate.plan}</p>
                  <p className="mt-1 text-muted-foreground">Pendientes: {ticketsToCharge} · Ticket: {currency.format(mobileSelectedAffiliate.value)}</p>
                </div>
              ) : (
                <p className="mt-3 rounded-md border bg-surface-subtle p-3 text-sm text-muted-foreground">Seleccioná un afiliado de la lista para cargar el cobro.</p>
              )}

              {selectedMonthlyAffiliate?.request?.trim() && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                  <p className="font-semibold">Pedido obligatorio</p>
                  <p className="mt-1">{selectedMonthlyAffiliate.request}</p>
                  <div className="mt-3 space-y-1">
                    <Label htmlFor="mobile-request-answer">Respuesta del cobrador</Label>
                    <Input
                      id="mobile-request-answer"
                      value={selectedMonthlyAffiliate.latestNews || ""}
                      onChange={(event) => updateAffiliateNews(selectedMonthlyAffiliate.id, event.target.value)}
                      placeholder="Dato informado o motivo"
                    />
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
              <Button type="submit" className="mt-4 w-full" variant="command" disabled={!selectedMonthlyAffiliate || ticketsToCharge <= 0 || hasUnansweredRequest}>Guardar cobro</Button>
              <Button type="button" className="mt-2 w-full" variant="outline" onClick={saveCloudSnapshot} disabled={cloudBusy}>Guardar online</Button>
            </form>
          </section>
        )}

        {activeSection === "Cobradores" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
              <h2 className="font-semibold">Cobradores</h2>
              <p className="text-sm text-muted-foreground">Resumen de cartera por cobrador para el período {activeMonth}.</p>
            </div>
            <div className="grid gap-4 border-b p-3 sm:p-4 xl:grid-cols-2">
              <div className="rounded-md border bg-surface-subtle p-3">
                <h3 className="font-semibold">Agregar / modificar cobrador</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="new-collector">Nombre y apellido</Label>
                    <Input id="new-collector" value={newCollectorName} onChange={(event) => setNewCollectorName(event.target.value)} placeholder="Ej: JUAN PEREZ" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="new-collector-phone">Teléfono</Label>
                    <Input id="new-collector-phone" value={newCollectorPhone} onChange={(event) => setNewCollectorPhone(event.target.value)} placeholder="549..." />
                  </div>
                  <Button type="button" variant="command" className="self-end" onClick={addCollector}>Agregar</Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor="collector-to-rename">Cobrador actual</Label>
                    <select id="collector-to-rename" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={collectorToRename} onChange={(event) => selectCollectorToEdit(event.target.value)}>
                      <option value="">Seleccionar</option>
                      {collectors.map((collector) => <option key={collector} value={collector}>{collector}</option>)}
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
                  <Button type="button" variant="outline" className="self-end" onClick={renameCollector}>Modificar</Button>
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
                      {dependencies.map((dependency) => <option key={dependency} value={dependency}>{dependency}</option>)}
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-xs sm:text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Cobrador</th>
                    <th className="px-4 py-3 text-left">Teléfono</th>
                    <th className="px-4 py-3 text-left">Dependencias</th>
                    <th className="px-4 py-3 text-right">Afiliados</th>
                    <th className="px-4 py-3 text-right">Tickets recibidos</th>
                    <th className="px-4 py-3 text-right">Tickets cobrados</th>
                    <th className="px-4 py-3 text-right">Tickets pendientes</th>
                    <th className="px-4 py-3 text-right">Cobrado</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {collectorRows.map((row) => (
                    <tr key={row.collector}>
                      <td className="px-4 py-3 font-medium">{row.collector}</td>
                      <td className="px-4 py-3">{row.phone || "-"}</td>
                      <td className="px-4 py-3">{row.dependencies.join(", ") || "-"}</td>
                      <td className="px-4 py-3 text-right">{row.affiliates}</td>
                      <td className="px-4 py-3 text-right">{row.tickets}</td>
                      <td className="px-4 py-3 text-right">{row.chargedTickets}</td>
                      <td className="px-4 py-3 text-right">{row.pendingTickets}</td>
                      <td className="px-4 py-3 text-right">{currency.format(row.chargedAmount)}</td>
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
                              setCollectorFilter(row.collector);
                              setActiveSection("Base");
                            }}
                          >
                            Ver cartera
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {collectorRows.length === 0 && <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={9}>Todavía no hay cobradores cargados.</td></tr>}
                </tbody>
              </table>
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
              <h2 className="font-semibold">Registrar cobranza por tickets</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>N° de póliza</Label><Input value={collectionPolicy} onChange={(event) => setCollectionPolicy(event.target.value)} /></div>
                <div className="space-y-2"><Label>Plan</Label><select value={collectionPlan} onChange={(event) => setCollectionPlan(event.target.value as PlanType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{availablePlans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
              </div>
              {selectedMonthlyAffiliate && (
                <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-sm">
                  <strong>{selectedMonthlyAffiliate.fullName}</strong>
                  <p className="text-muted-foreground">Tickets a cobrar: {ticketsToCharge} · Valor ticket: {currency.format(selectedMonthlyAffiliate.value)}</p>
                  {selectedMonthlyAffiliate.request?.trim() && (
                    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
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
              <div className="mt-4 flex justify-end"><Button type="submit" className="w-full sm:w-auto" variant="command" disabled={!selectedMonthlyAffiliate || ticketsToCharge <= 0 || hasUnansweredRequest}>Guardar cobro</Button></div>
            </form>
            <div className="space-y-5">
              <RecentTicketCollections collections={ticketCollections.filter((item) => item.month === activeMonth)} affiliatesById={affiliatesById} />
              <RecentNotes notes={notes.filter((item) => item.month === activeMonth)} affiliatesById={affiliatesById} />
            </div>
          </section>
        )}

        {activeSection === "Recibos" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-[1fr_420px]">
            <form className="rounded-md border bg-card p-3 sm:p-4" onSubmit={saveReceipt}>
              <h2 className="font-semibold">Registrar recibo sin ticket</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>N° recibo</Label><Input value={receiptForm.receiptNumber} onChange={(event) => setReceiptForm({ ...receiptForm, receiptNumber: event.target.value })} /></div>
                <div className="space-y-2"><Label>Nombre y apellido</Label><Input value={receiptForm.fullName} onChange={(event) => setReceiptForm({ ...receiptForm, fullName: event.target.value })} required /></div>
                <div className="space-y-2"><Label>Plan</Label><select value={receiptForm.plan} onChange={(event) => setReceiptForm({ ...receiptForm, plan: event.target.value as PlanType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{availablePlans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
                <div className="space-y-2"><Label>Mes que paga</Label><Input type="month" value={receiptForm.paidMonth} onChange={(event) => setReceiptForm({ ...receiptForm, paidMonth: event.target.value })} /></div>
                <div className="space-y-2"><Label>Cant. de meses</Label><Input type="number" min="1" value={receiptForm.monthCount} onChange={(event) => setReceiptForm({ ...receiptForm, monthCount: event.target.value })} /></div>
                <div className="space-y-2"><Label>Monto mensual</Label><Input value={receiptForm.monthlyAmount} onChange={(event) => setReceiptForm({ ...receiptForm, monthlyAmount: event.target.value })} required /></div>
                <div className="space-y-2"><Label>Método de pago</Label><select value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm({ ...receiptForm, paymentMethod: event.target.value as PaymentMethod })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="E">E</option><option value="T">T</option></select></div>
              </div>
              {receiptForm.paymentMethod === "T" && <TransferFields value={receiptForm.transfer} onChange={(transfer) => setReceiptForm({ ...receiptForm, transfer })} />}
              <div className="mt-4 flex justify-end"><Button type="submit" className="w-full sm:w-auto" variant="command">Guardar recibo</Button></div>
            </form>
            <RecentReceipts receipts={receipts.filter((item) => item.collectionMonth === activeMonth)} />
          </section>
        )}

        {activeSection === "Novedades" && (
          <section className="overflow-hidden rounded-md border bg-card">
            <div className="border-b p-3 sm:p-4">
              <h2 className="font-semibold">Novedades del mes</h2>
              <p className="text-sm text-muted-foreground">Texto libre cargado por afiliado o ticket. Período {activeMonth}.</p>
            </div>
            <div className="border-b bg-surface-subtle px-3 py-2 text-xs text-muted-foreground sm:hidden">Deslizá la tabla hacia los costados para leer todas las novedades.</div>
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
                  {notes.filter((item) => item.month === activeMonth).map((item) => {
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
                  {notes.filter((item) => item.month === activeMonth).length === 0 && (
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

        {activeSection === "Rendicion" && (
          <section className="grid gap-4 sm:gap-5 lg:grid-cols-2">
            <div className="rounded-md border bg-card p-3 sm:p-4">
              <h2 className="font-semibold">Rendición final</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryBox label="Cobrado efectivo" value={currency.format(totalCashCollected)} />
                <SummaryBox label="Cobrado transferencia" value={currency.format(totalTransferCollected)} />
                <SummaryBox label="Total cobrado" value={currency.format(totalCollected)} />
                <SummaryBox label="Comisión 12%" value={currency.format(commission)} />
                <SummaryBox label="Total a rendir" value={currency.format(totalToRender)} />
                <SummaryBox label="Total rendido" value={currency.format(totalRendered)} />
                <SummaryBox label="Resta por rendir" value={currency.format(totalToRender - totalRendered)} />
              </div>
            </div>
            <div className="rounded-md border bg-card p-3 sm:p-4">
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
            </div>
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
            <div className="space-y-2 md:col-span-2"><Label>Pedido al cobrador</Label><Input value={affiliateForm.request} onChange={(event) => setAffiliateForm({ ...affiliateForm, request: event.target.value })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Novedad / respuesta</Label><Input value={affiliateForm.latestNews} onChange={(event) => setAffiliateForm({ ...affiliateForm, latestNews: event.target.value })} /></div>
            <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="outline" onClick={() => setAffiliateDialogOpen(false)}>Cancelar</Button><Button type="submit" variant="command">Guardar</Button></div>
          </form>
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

const RecentTicketCollections = ({ collections, affiliatesById }: { collections: TicketCollection[]; affiliatesById: Map<string, Affiliate> }) => (
  <aside className="rounded-md border bg-card p-4">
    <h2 className="font-semibold">Últimos cobros</h2>
    <div className="mt-3 space-y-3">
      {collections.slice(-8).reverse().map((item) => {
        const affiliate = affiliatesById.get(item.affiliateId);
        return (
          <div key={item.id} className="rounded-md border bg-surface-subtle p-3 text-sm">
            <strong>{affiliate?.fullName || "Afiliado"}</strong>
            <p className="text-muted-foreground">{item.ticketsCharged} ticket(s) · {methodLabel(item.paymentMethod)} · {currency.format((affiliate?.value || 0) * item.ticketsCharged)}</p>
          </div>
        );
      })}
      {collections.length === 0 && <p className="text-sm text-muted-foreground">Sin cobros registrados.</p>}
    </div>
  </aside>
);

const RecentReceipts = ({ receipts }: { receipts: ReceiptCollection[] }) => (
  <aside className="rounded-md border bg-card p-4">
    <h2 className="font-semibold">Últimos recibos</h2>
    <div className="mt-3 space-y-3">
      {receipts.slice(-8).reverse().map((item) => (
        <div key={item.id} className="rounded-md border bg-surface-subtle p-3 text-sm">
          <strong>{item.fullName}</strong>
          <p className="text-muted-foreground">Recibo {item.receiptNumber} · {item.plan} · {methodLabel(item.paymentMethod)} · {currency.format(item.monthlyAmount * item.monthCount)}</p>
        </div>
      ))}
      {receipts.length === 0 && <p className="text-sm text-muted-foreground">Sin recibos registrados.</p>}
    </div>
  </aside>
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
