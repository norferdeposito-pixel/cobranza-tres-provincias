import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Calculator,
  CheckSquare,
  ClipboardList,
  Download,
  FileSpreadsheet,
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

type PlanType = "A 238" | "A 269" | "G 238" | "09" | "G 269" | "C" | "Vida";
type PaymentMethod = "E" | "T" | "";
type Section = "Base" | "Mensual" | "Cobranza" | "Recibos" | "Novedades" | "Totales" | "Rendicion";

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

const plans: PlanType[] = ["A 238", "A 269", "G 238", "09", "G 269", "C", "Vida"];
const defaultSheetUrl = "https://docs.google.com/spreadsheets/d/17_pvb9vNQPJULu5XWJ3Yuy7HHbbT1GKfhgwe_4_--q0/edit?usp=sharing";
const affiliatesStorageKey = "insurance-affiliates-v2";
const monthlyStorageKey = "insurance-monthly-v2";
const ticketCollectionsStorageKey = "insurance-ticket-collections-v2";
const receiptsStorageKey = "insurance-receipts-v2";
const notesStorageKey = "insurance-affiliate-notes-v2";
const renditionStorageKey = "insurance-rendition-v2";
const collectorWhatsappStorageKey = "insurance-collector-whatsapp-v2";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const today = () => new Date().toISOString().slice(0, 10);
const currentMonth = () => new Date().toISOString().slice(0, 7);

const demoAffiliates: Affiliate[] = [
  { id: "31774-A238", fullName: "TAGUA DORALISA", policyNumber: "31774", plan: "A 238", value: 13000, phone: "", address: "", dependency: "001", selectedForMonthly: true, sourceTickets: 1 },
  { id: "37096-A238", fullName: "RIVAMAR GLADYS", policyNumber: "37096", plan: "A 238", value: 21700, phone: "", address: "", dependency: "001", selectedForMonthly: true, sourceTickets: 1 },
  { id: "45446-G238", fullName: "CARTECHINI JUAN", policyNumber: "45446", plan: "G 238", value: 19600, phone: "", address: "", dependency: "001", selectedForMonthly: false, sourceTickets: 1 },
  { id: "159327-A269", fullName: "AGUIRRE OSCAR", policyNumber: "159327", plan: "A 269", value: 29600, phone: "", address: "", dependency: "001", selectedForMonthly: true, sourceTickets: 4 },
  { id: "199554-G269", fullName: "ALCANO MARIA", policyNumber: "199554", plan: "G 269", value: 14900, phone: "", address: "", dependency: "001", selectedForMonthly: true, sourceTickets: 4 },
  { id: "106792-Vida", fullName: "ROMERO EDGARDO", policyNumber: "106792", plan: "Vida", value: 2484, phone: "", address: "", dependency: "001", selectedForMonthly: false, sourceTickets: 1 },
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

const parseAffiliatesCsv = (text: string) => {
  const rows = text.split(/\r?\n/).map(parseCsvLine);
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
  const [collectorWhatsapp, setCollectorWhatsapp] = useState(() => loadStorage(collectorWhatsappStorageKey, ""));
  const [sheetUrl, setSheetUrl] = useState(defaultSheetUrl);
  const [importMessage, setImportMessage] = useState("Base demo cargada. Podés importar la planilla original.");
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

  useEffect(() => saveStorage(affiliatesStorageKey, affiliates), [affiliates]);
  useEffect(() => saveStorage(monthlyStorageKey, monthlyItems), [monthlyItems]);
  useEffect(() => saveStorage(ticketCollectionsStorageKey, ticketCollections), [ticketCollections]);
  useEffect(() => saveStorage(receiptsStorageKey, receipts), [receipts]);
  useEffect(() => saveStorage(notesStorageKey, notes), [notes]);
  useEffect(() => saveStorage(renditionStorageKey, rendition), [rendition]);
  useEffect(() => saveStorage(collectorWhatsappStorageKey, collectorWhatsapp), [collectorWhatsapp]);

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
      .filter((item) => !normalized || `${item.fullName} ${item.policyNumber} ${item.plan}`.toLocaleUpperCase("es-AR").includes(normalized))
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
  }, [activeMonth, affiliates, pendingFilter, query, monthlyItems, ticketCollections]);

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

  const getWhatsappUrl = (affiliate: Affiliate) => {
    const phone = collectorWhatsapp.replace(/\D/g, "");
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

  const totalsByPlan = useMemo(() => {
    return plans.map((plan) => {
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
  }, [activeMonth, affiliatesById, monthlyRows, receipts, ticketCollections]);

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
      return previous ? { ...item, phone: previous.phone, address: previous.address, dependency: previous.dependency || item.dependency, selectedForMonthly: true } : item;
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

  const importGoogleSheet = async () => {
    setIsLoadingSheet(true);
    setImportMessage("Leyendo Google Sheets...");
    try {
      const response = await fetch(getGoogleSheetCsvUrl(sheetUrl));
      if (!response.ok) throw new Error("No se pudo leer la planilla.");
      const parsed = parseAffiliatesCsv(await response.text());
      if (parsed.affiliates.length === 0) throw new Error("La planilla no tiene afiliados válidos.");
      previewAffiliates(parsed.affiliates, "Google Sheets", parsed.duplicatedCount);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : "No se pudo importar la planilla.");
    } finally {
      setIsLoadingSheet(false);
    }
  };

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

  const updateMonthlyTickets = (affiliateId: string, tickets: number) => {
    setMonthlyItems((current) => current.some((item) => item.month === activeMonth && item.affiliateId === affiliateId)
      ? current.map((item) => item.month === activeMonth && item.affiliateId === affiliateId ? { ...item, tickets } : item)
      : [...current, { month: activeMonth, affiliateId, tickets }]);
  };

  const saveTicketCollection = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedMonthlyAffiliate) return;
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
    const header = ["Nombre y apellido", "Numero de poliza", "Plan", "Valor", "Telefono", "Direccion", "Dependencia", "Seleccionado mensual"].join(",");
    const rows = affiliates.map((item) => [item.fullName, item.policyNumber, item.plan, item.value, item.phone, item.address, item.dependency || "001", item.selectedForMonthly ? "SI" : "NO"].map(escapeCsv).join(","));
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
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-primary-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Sistema de afiliados y cobranza</h1>
              <p className="text-sm text-muted-foreground">Base de datos, cobranza mensual, recibos, totales y rendición</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex h-10 items-center gap-2 rounded-md border bg-background px-3">
              <Label htmlFor="active-month" className="mb-0 text-xs text-muted-foreground">Mes</Label>
              <Input id="active-month" type="month" value={activeMonth} onChange={(event) => setActiveMonth(event.target.value || currentMonth())} className="h-8 w-36 border-0 p-0 shadow-none focus-visible:ring-0" />
            </div>
            <Button type="button" variant="command" onClick={() => openAffiliateForm()}>
              <Plus className="h-4 w-4" />
              Nuevo afiliado
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
              <Upload className="h-4 w-4" />
              Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={importCsv} />
            </label>
            <Button type="button" variant="outline" onClick={exportAffiliatesCsv}>
              <Download className="h-4 w-4" />
              Exportar base
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6">
        <section className="rounded-md border bg-card p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="space-y-2">
              <Label htmlFor="sheet-url">Planilla original</Label>
              <Input id="sheet-url" value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} />
            </div>
            <Button type="button" variant="command" onClick={importGoogleSheet} disabled={isLoadingSheet}>
              <FileSpreadsheet className="h-4 w-4" />
              {isLoadingSheet ? "Cargando..." : "Cargar base"}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{importMessage}</p>
          {affiliateImportPreview && (
            <div className="mt-4 rounded-md border bg-surface-subtle p-4">
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

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            ["Afiliados", affiliates.length, "Clientes en base"],
            ["Seleccionados", affiliates.filter((item) => item.selectedForMonthly).length, "Pasan a cobranza mensual"],
            ["Tickets mensuales", monthlyItems.filter((item) => item.month === activeMonth).reduce((sum, item) => sum + item.tickets, 0), "Tickets recibidos"],
            ["Novedades", notes.filter((item) => item.month === activeMonth).length, "Cargadas en el mes"],
            ["Total a rendir", currency.format(totalToRender), "Cobrado menos comisión"],
          ].map(([label, value, helper]) => (
            <div key={String(label)} className="rounded-md border bg-card p-4 shadow-command">
              <p className="text-sm font-medium text-muted-foreground">{String(label)}</p>
              <p className="mt-2 text-3xl font-semibold">{String(value)}</p>
              <p className="mt-2 text-xs text-muted-foreground">{String(helper)}</p>
            </div>
          ))}
        </section>

        <nav className="flex flex-wrap gap-2 rounded-md border bg-card p-2">
          {navItems.map(({ id, label, icon: Icon }) => (
            <Button key={id} type="button" variant={activeSection === id ? "command" : "ghost"} onClick={() => setActiveSection(id)}>
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </nav>

        {activeSection === "Base" && (
          <section className="rounded-md border bg-card">
            <div className="border-b p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative max-w-lg flex-1">
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
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setAllFilteredMonthly(true)}>Tildar todos</Button>
                  <Button type="button" variant="outline" onClick={() => setAllFilteredMonthly(false)}>Destildar todos</Button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="bg-muted/45 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Seleccionar</th>
                    <th className="px-4 py-3 text-left">Nombre y apellido</th>
                    <th className="px-4 py-3 text-left">Póliza</th>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-left">Dependencia</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-right">Tickets mes</th>
                    <th className="px-4 py-3 text-right">Tickets pendientes</th>
                    <th className="px-4 py-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAffiliates.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3"><input type="checkbox" checked={item.selectedForMonthly} onChange={(event) => toggleMonthly(item.id, event.target.checked)} className="h-4 w-4" /></td>
                      <td className="px-4 py-3 font-medium">{item.fullName}</td>
                      <td className="px-4 py-3">{item.policyNumber || "-"}</td>
                      <td className="px-4 py-3">{item.plan}</td>
                      <td className="px-4 py-3">{item.dependency || "001"}</td>
                      <td className="px-4 py-3 text-right">{currency.format(item.value)}</td>
                      <td className="px-4 py-3 text-right">{monthlyItems.find((monthly) => monthly.month === activeMonth && monthly.affiliateId === item.id)?.tickets || 0}</td>
                      <td className="px-4 py-3 text-right">{getPendingTickets(item.id)}</td>
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

        {activeSection === "Mensual" && (
          <section className="rounded-md border bg-card">
            <div className="border-b p-4">
              <h2 className="font-semibold">Planilla de cobranza mensual</h2>
              <p className="text-sm text-muted-foreground">Período {activeMonth}. Aparecen solo los afiliados tildados en la base. Acá se carga la cantidad de tickets.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
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
          <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <form className="rounded-md border bg-card p-4" onSubmit={saveTicketCollection}>
              <h2 className="font-semibold">Registrar cobranza por tickets</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>N° de póliza</Label><Input value={collectionPolicy} onChange={(event) => setCollectionPolicy(event.target.value)} /></div>
                <div className="space-y-2"><Label>Plan</Label><select value={collectionPlan} onChange={(event) => setCollectionPlan(event.target.value as PlanType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{plans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
              </div>
              {selectedMonthlyAffiliate && (
                <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-sm">
                  <strong>{selectedMonthlyAffiliate.fullName}</strong>
                  <p className="text-muted-foreground">Tickets a cobrar: {ticketsToCharge} · Valor ticket: {currency.format(selectedMonthlyAffiliate.value)}</p>
                  <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => openNoteDialog(selectedMonthlyAffiliate.id)}>Agregar novedad</Button>
                </div>
              )}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Tickets cobrados</Label><Input type="number" min="0" max={ticketsToCharge} value={collectionTickets} onChange={(event) => setCollectionTickets(event.target.value)} /></div>
                <div className="space-y-2"><Label>Forma de pago</Label><select value={collectionMethod} onChange={(event) => setCollectionMethod(event.target.value as PaymentMethod)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="E">E</option><option value="T">T</option></select></div>
              </div>
              {collectionMethod === "T" && <TransferFields value={collectionTransfer} onChange={setCollectionTransfer} />}
              <div className="mt-4 flex justify-end"><Button type="submit" variant="command" disabled={!selectedMonthlyAffiliate || ticketsToCharge <= 0}>Guardar cobro</Button></div>
            </form>
            <div className="space-y-5">
              <RecentTicketCollections collections={ticketCollections.filter((item) => item.month === activeMonth)} affiliatesById={affiliatesById} />
              <RecentNotes notes={notes.filter((item) => item.month === activeMonth)} affiliatesById={affiliatesById} />
            </div>
          </section>
        )}

        {activeSection === "Recibos" && (
          <section className="grid gap-5 lg:grid-cols-[1fr_420px]">
            <form className="rounded-md border bg-card p-4" onSubmit={saveReceipt}>
              <h2 className="font-semibold">Registrar recibo sin ticket</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>N° recibo</Label><Input value={receiptForm.receiptNumber} onChange={(event) => setReceiptForm({ ...receiptForm, receiptNumber: event.target.value })} /></div>
                <div className="space-y-2"><Label>Nombre y apellido</Label><Input value={receiptForm.fullName} onChange={(event) => setReceiptForm({ ...receiptForm, fullName: event.target.value })} required /></div>
                <div className="space-y-2"><Label>Plan</Label><select value={receiptForm.plan} onChange={(event) => setReceiptForm({ ...receiptForm, plan: event.target.value as PlanType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{plans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
                <div className="space-y-2"><Label>Mes que paga</Label><Input type="month" value={receiptForm.paidMonth} onChange={(event) => setReceiptForm({ ...receiptForm, paidMonth: event.target.value })} /></div>
                <div className="space-y-2"><Label>Cant. de meses</Label><Input type="number" min="1" value={receiptForm.monthCount} onChange={(event) => setReceiptForm({ ...receiptForm, monthCount: event.target.value })} /></div>
                <div className="space-y-2"><Label>Monto mensual</Label><Input value={receiptForm.monthlyAmount} onChange={(event) => setReceiptForm({ ...receiptForm, monthlyAmount: event.target.value })} required /></div>
                <div className="space-y-2"><Label>Método de pago</Label><select value={receiptForm.paymentMethod} onChange={(event) => setReceiptForm({ ...receiptForm, paymentMethod: event.target.value as PaymentMethod })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="E">E</option><option value="T">T</option></select></div>
              </div>
              {receiptForm.paymentMethod === "T" && <TransferFields value={receiptForm.transfer} onChange={(transfer) => setReceiptForm({ ...receiptForm, transfer })} />}
              <div className="mt-4 flex justify-end"><Button type="submit" variant="command">Guardar recibo</Button></div>
            </form>
            <RecentReceipts receipts={receipts.filter((item) => item.collectionMonth === activeMonth)} />
          </section>
        )}

        {activeSection === "Novedades" && (
          <section className="rounded-md border bg-card">
            <div className="border-b p-4">
              <h2 className="font-semibold">Novedades del mes</h2>
              <p className="text-sm text-muted-foreground">Texto libre cargado por afiliado o ticket. Período {activeMonth}.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
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
          <section className="rounded-md border bg-card">
            <div className="border-b p-4"><h2 className="font-semibold">Totales por plan</h2></div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1280px] text-sm">
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
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-md border bg-card p-4">
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
            <div className="rounded-md border bg-card p-4">
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

      <Dialog open={affiliateDialogOpen} onOpenChange={setAffiliateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingAffiliateId ? "Editar afiliado" : "Nuevo afiliado"}</DialogTitle></DialogHeader>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={saveAffiliate}>
            <div className="space-y-2 md:col-span-2"><Label>Nombre y apellido</Label><Input value={affiliateForm.fullName} onChange={(event) => setAffiliateForm({ ...affiliateForm, fullName: event.target.value })} required /></div>
            <div className="space-y-2"><Label>N° de póliza</Label><Input value={affiliateForm.policyNumber} onChange={(event) => setAffiliateForm({ ...affiliateForm, policyNumber: event.target.value })} /></div>
            <div className="space-y-2"><Label>Plan</Label><select value={affiliateForm.plan} onChange={(event) => setAffiliateForm({ ...affiliateForm, plan: event.target.value as PlanType })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{plans.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
            <div className="space-y-2"><Label>Valor</Label><Input type="number" min="0" value={affiliateForm.value} onChange={(event) => setAffiliateForm({ ...affiliateForm, value: parseNumber(event.target.value) })} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={affiliateForm.phone} onChange={(event) => setAffiliateForm({ ...affiliateForm, phone: event.target.value })} /></div>
            <div className="space-y-2"><Label>Dependencia</Label><Input value={affiliateForm.dependency} onChange={(event) => setAffiliateForm({ ...affiliateForm, dependency: event.target.value })} /></div>
            <div className="space-y-2"><Label>Tickets base</Label><Input type="number" min="0" value={affiliateForm.sourceTickets || 0} onChange={(event) => setAffiliateForm({ ...affiliateForm, sourceTickets: parseNumber(event.target.value) })} /></div>
            <div className="space-y-2 md:col-span-2"><Label>Dirección</Label><Input value={affiliateForm.address} onChange={(event) => setAffiliateForm({ ...affiliateForm, address: event.target.value })} /></div>
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
