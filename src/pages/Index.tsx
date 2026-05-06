import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Factory, FileText, FilePlus2, LayoutDashboard, LogOut, MessageCircle, PackageCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Cotizaciones } from "@/components/Cotizaciones";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";

type OrderStatus = "En curso" | "Atrasado" | "Confirmado" | "Entregado";

type PurchaseOrder = {
  id: number | string;
  orderNumber: string;
  supplier: string;
  supplierId: string;
  supplierPhone: string;
  status: OrderStatus;
  rawStatus: string;
  ocNumber: string;
  eta: string;
  notes: string;
  cliente: string;
  vendedor: string;
  fecha: string;
};

type PurchaseOrderRow = {
  id: number | string;
  numero_pedido: string;
  proveedor_id: string;
  proveedores?: { nombre: string; telefono: string | null } | { nombre: string; telefono: string | null }[] | null;
  estado: string;
  numero_oc_qubigo: string | null;
  fecha_estimada_entrega: string | null;
  observaciones: string | null;
  cliente: string | null;
  vendedor: string | null;
  fecha: string | null;
};

type Supplier = {
  id: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  condicion_pago?: string | null;
  plazo_promedio_dias?: number | null;
};

type SupplierForm = {
  nombre: string;
  email: string;
  telefono: string;
  condicionPago: string;
  plazoPromedioDias: string;
};

type PurchaseTotalBySupplier = {
  proveedor: string;
  total: number;
  moneda: string;
};

type PedidoItem = {
  id: string;
  descripcion: string;
  cantidad_pedida: number;
  cantidad_recibida: number;
  cantidad_pendiente: number;
  unidad?: string;
  costo_unitario?: number;
  moneda?: string;
  cod_articulo?: string;
  estado_entrega?: string;
};

type PedidoForm = {
  fecha: string;
  supplierId: string;
  cliente: string;
  numeroOcCliente: string;
  plazoEntregaCliente: string;
  plazoEntregaProveedor: string;
  vendedor: string;
  observaciones: string;
  condicionesPago: string;
  numeroPedido: string;
  numeroOcQubigo: string;
  estado: string;
  fechaEstimadaEntrega: string;
  mailVendedor: string;
};

type PedidoItemForm = {
  descripcion: string;
  cantidadPedida: string;
  unidad: string;
  costoUnitario: string;
  moneda: string;
  codArticulo: string;
};

type PedidoItemEditForm = PedidoItemForm & { id: string };

type PedidoAlerta = {
  id: string;
  pedido_id: string;
  item_id: string | null;
  tipo: string;
  fecha_estimada: string | null;
  fecha_aviso: string;
  estado: string;
};

type AlertaRow = PedidoAlerta & {
  pedidos?: {
    cliente: string | null;
    numero_pedido: string | null;
    numero_oc_qubigo: string | null;
    vendedor: string | null;
    estado: string | null;
    proveedores?: { nombre: string | null } | { nombre: string | null }[] | null;
  } | {
    cliente: string | null;
    numero_pedido: string | null;
    numero_oc_qubigo: string | null;
    vendedor: string | null;
    estado: string | null;
    proveedores?: { nombre: string | null } | { nombre: string | null }[] | null;
  }[] | null;
};

type AlertaListItem = {
  id: string;
  proveedor: string;
  cliente: string;
  numeroPedido: string;
  numeroOcQubigo: string;
  tipo: string;
  fechaEstimada: string | null;
  fechaAviso: string | null;
  estado: string;
  pedidoEstado: string;
  vendedor: string;
  daysRemaining: number | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const pedidoEstados = [
  "pedido_cargado",
  "oc_generada",
  "pedido_enviado",
  "en_curso",
  "recibido_parcial",
  "recibido_total",
  "terminado",
  "anulado",
];

const safeText = (value?: string | number | null) => String(value ?? "").trim();

const optionalValue = (value?: string | number | null) => {
  const trimmed = safeText(value);
  return trimmed ? trimmed : null;
};

const safeNumber = (value?: string | number | null) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isValidUuid = (value?: string | null) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(safeText(value));

const isValidDateValue = (date?: string | null) => {
  const value = safeText(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1];
};

const safeDateForDisplay = (date?: string | null) => isValidDateValue(date) ? safeText(date) : null;

const isUpcomingDueDate = (date: string) => {
  const safeDate = safeDateForDisplay(date);
  if (!safeDate) return false;
  const current = new Date(`${today()}T00:00:00`);
  const dueDate = new Date(`${safeDate}T00:00:00`);
  const sevenDaysFromNow = new Date(current);
  sevenDaysFromNow.setDate(current.getDate() + 7);

  return dueDate >= current && dueDate <= sevenDaysFromNow;
};

const getDaysRemaining = (date?: string | null) => {
  const safeDate = safeDateForDisplay(date);
  if (!safeDate) return null;
  const current = new Date(`${today()}T00:00:00`);
  const dueDate = new Date(`${safeDate}T00:00:00`);
  return Math.round((dueDate.getTime() - current.getTime()) / 86400000);
};

const isClosedAlerta = (estado?: string | null) => ["resuelta", "cerrada", "terminada", "terminado", "anulada", "anulado"].includes(safeText(estado).toLowerCase());

const getAlertaPriorityClass = (alerta: Pick<AlertaListItem, "estado" | "daysRemaining"> | PedidoAlerta) => {
  const days = "daysRemaining" in alerta ? alerta.daysRemaining : getDaysRemaining(alerta.fecha_aviso);
  if (isClosedAlerta(alerta.estado)) return "bg-muted text-muted-foreground border-border";
  if (days === null) return "bg-secondary text-secondary-foreground border-border";
  if (days < 0) return "bg-destructive/10 text-destructive border-destructive/30";
  if (days <= 3) return "bg-warning/20 text-warning-foreground border-warning/40";
  return "bg-primary/10 text-primary border-primary/25";
};

const getAlertaUrgency = (fechaEstimada?: string | null, fechaAviso?: string | null): { label: string; className: string } => {
  const todayStr = today();
  const estimadaValid = isValidDateValue(fechaEstimada) ? (fechaEstimada as string) : null;
  const avisoValid = isValidDateValue(fechaAviso) ? (fechaAviso as string) : null;
  if (estimadaValid && estimadaValid < todayStr) {
    return { label: "Atrasado", className: "bg-destructive/10 text-destructive border-destructive/30" };
  }
  if (avisoValid && avisoValid <= todayStr && (!estimadaValid || estimadaValid >= todayStr)) {
    return { label: "Próxima", className: "bg-warning/20 text-warning-foreground border-warning/40" };
  }
  if (avisoValid && avisoValid > todayStr) {
    return { label: "Futura", className: "bg-secondary text-secondary-foreground border-border" };
  }
  return { label: "-", className: "bg-secondary text-secondary-foreground border-border" };
};

const initialOrders: PurchaseOrder[] = [
  { id: 1, orderNumber: "PED-1048", supplier: "Metalúrgica Norte", supplierId: "", supplierPhone: "", status: "En curso", rawStatus: "en_curso", ocNumber: "OC-77821", eta: "2026-05-03", notes: "Despacho parcial confirmado", cliente: "Planta Norte", vendedor: "María", fecha: "2026-04-20" },
  { id: 2, orderNumber: "PED-1049", supplier: "Global Parts", supplierId: "", supplierPhone: "", status: "Atrasado", rawStatus: "pedido_cargado", ocNumber: "-", eta: "2026-04-22", notes: "Pendiente respuesta proveedor", cliente: "Mantenimiento", vendedor: "Juan", fecha: "2026-04-18" },
  { id: 3, orderNumber: "PED-1050", supplier: "Insumos Delta", supplierId: "", supplierPhone: "", status: "Confirmado", rawStatus: "confirmado", ocNumber: "OC-77859", eta: "2026-05-08", notes: "Entrega en planta central", cliente: "Producción", vendedor: "María", fecha: "2026-04-21" },
  { id: 4, orderNumber: "PED-1051", supplier: "Tecno Industrial", supplierId: "", supplierPhone: "", status: "Entregado", rawStatus: "terminado", ocNumber: "OC-77866", eta: "2026-04-25", notes: "Recepción sin novedades", cliente: "Calidad", vendedor: "Sofía", fecha: "2026-04-16" },
];

const fallbackSuppliers: Supplier[] = [
  { id: "demo-metalurgica-norte", nombre: "Metalúrgica Norte", email: "compras@metalnorte.com", telefono: "+54 9 11 5555-1001", condicion_pago: "30 días", plazo_promedio_dias: 12 },
  { id: "demo-global-parts", nombre: "Global Parts", email: "ventas@globalparts.com", telefono: "+54 9 11 5555-1002", condicion_pago: "Contado", plazo_promedio_dias: 7 },
  { id: "demo-insumos-delta", nombre: "Insumos Delta", email: "oc@insumosdelta.com", telefono: "+54 9 11 5555-1003", condicion_pago: "15 días", plazo_promedio_dias: 10 },
  { id: "demo-tecno-industrial", nombre: "Tecno Industrial", email: "pedidos@tecnoindustrial.com", telefono: "+54 9 11 5555-1004", condicion_pago: "45 días", plazo_promedio_dias: 18 },
  { id: "demo-logistica-andina", nombre: "Logística Andina", email: "admin@andina.com", telefono: "+54 9 11 5555-1005", condicion_pago: "30 días", plazo_promedio_dias: 5 },
];

const demoItemsByOrderId: Record<string, PedidoItem[]> = {
  "1": [
    { id: "demo-1-1", descripcion: "Ruleman 6205", cantidad_pedida: 10, cantidad_recibida: 6, cantidad_pendiente: 4 },
    { id: "demo-1-2", descripcion: "Correa industrial A42", cantidad_pedida: 18, cantidad_recibida: 18, cantidad_pendiente: 0 },
  ],
  "2": [{ id: "demo-2-1", descripcion: "Válvula neumática 1/2", cantidad_pedida: 8, cantidad_recibida: 0, cantidad_pendiente: 8 }],
  "3": [{ id: "demo-3-1", descripcion: "Sensor inductivo M12", cantidad_pedida: 12, cantidad_recibida: 4, cantidad_pendiente: 8 }],
  "4": [{ id: "demo-4-1", descripcion: "Acople flexible", cantidad_pedida: 6, cantidad_recibida: 6, cantidad_pendiente: 0 }],
};

const demoAlertasByOrderId: Record<string, PedidoAlerta[]> = {
  "1": [{ id: "demo-alerta-1", pedido_id: "1", item_id: "demo-1-1", tipo: "pendiente_parcial", fecha_estimada: "2026-05-03", fecha_aviso: "2026-05-01", estado: "en_curso" }],
  "2": [{ id: "demo-alerta-2", pedido_id: "2", item_id: "demo-2-1", tipo: "entrega_atrasada", fecha_estimada: "2026-04-22", fecha_aviso: today(), estado: "en_curso" }],
};

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Alertas", icon: CalendarClock },
  { label: "Cotizaciones", icon: FileText },
  { label: "Pedidos", icon: ClipboardList },
  { label: "Proveedores", icon: Factory },
  { label: "Reportes", icon: BarChart3 },
];

const statusClasses: Record<OrderStatus, string> = {
  "En curso": "bg-primary/10 text-primary border-primary/20",
  Atrasado: "bg-destructive/10 text-destructive border-destructive/20",
  Confirmado: "bg-warning/20 text-warning-foreground border-warning/30",
  Entregado: "bg-success/10 text-success border-success/20",
};

const rawStatusClasses: Record<string, string> = {
  en_curso: "bg-success/10 text-success border-success/30",
  pedido_cargado: "bg-primary/10 text-primary border-primary/25",
  anulado: "bg-foreground/10 text-foreground border-foreground/25",
  pendiente: "bg-warning/20 text-warning-foreground border-warning/40",
  sin_oc: "bg-warning/20 text-warning-foreground border-warning/40",
  terminado: "bg-muted text-muted-foreground border-border",
  recibido_total: "bg-success/10 text-success border-success/20",
  recibido_parcial: "bg-success/10 text-success border-success/30",
};

const getStatusBadgeClass = (rawStatus: string, ocNumber?: string | null) => {
  if (rawStatus === "pedido_cargado" && (!ocNumber || ocNumber === "-")) return rawStatusClasses.sin_oc;
  return rawStatusClasses[rawStatus] || "bg-secondary text-secondary-foreground border-border";
};

const deriveStatusByOc = (numeroOcQubigo: string, estado: string | null) => {
  const currentStatus = optionalValue(estado || "") || "";
  const protectedStatuses = ["terminado", "anulado", "recibido_total", "recibido_parcial"];
  if (protectedStatuses.includes(currentStatus)) return currentStatus;
  if (optionalValue(numeroOcQubigo) && (currentStatus === "" || currentStatus === "pedido_cargado")) return "en_curso";
  return currentStatus || "pedido_cargado";
};

const getPedidoLifecycleStatus = (items: PedidoItem[], currentStatus?: string) => {
  if (currentStatus === "anulado") return "anulado";
  if (items.length > 0 && items.every((item) => safeNumber(item.cantidad_pendiente) <= 0)) return "terminado";
  if (items.some((item) => safeNumber(item.cantidad_recibida) > 0)) return "recibido_parcial";
  return "en_curso";
};

const getItemSubtotal = (item: PedidoItem) => safeNumber(item.cantidad_pedida) * safeNumber(item.costo_unitario);

const formatDate = (date?: string | null) => {
  const safeDate = safeDateForDisplay(date);
  if (!safeDate) return "-";
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${safeDate}T12:00:00`));
};

const normalizeStatus = (status: string, eta: string): OrderStatus => {
  if (status === "cerrado" || status === "entregado" || status === "terminado" || status === "recibido_total") return "Entregado";
  const safeEta = safeDateForDisplay(eta);
  if (safeEta && new Date(`${safeEta}T12:00:00`) < new Date() && status !== "cerrado") return "Atrasado";
  if (status === "oc_generada" || status === "confirmado") return "Confirmado";
  return "En curso";
};

const normalizePhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, "");

const getDemoItems = (orderId: string | number) => demoItemsByOrderId[String(orderId)] || [];
const getDemoAlertas = (orderId: string | number) => demoAlertasByOrderId[String(orderId)] || [];

const createEmptyOrderForm = (supplierId = ""): PedidoForm => ({
  fecha: today(),
  supplierId,
  cliente: "",
  numeroOcCliente: "",
  plazoEntregaCliente: "",
  plazoEntregaProveedor: "",
  vendedor: "",
  observaciones: "",
  condicionesPago: "",
  numeroPedido: "",
  numeroOcQubigo: "",
  estado: "pedido_cargado",
  fechaEstimadaEntrega: "",
  mailVendedor: "",
});

const createEmptyItemForm = (): PedidoItemForm => ({
  descripcion: "",
  cantidadPedida: "",
  unidad: "",
  costoUnitario: "",
  moneda: "ARS",
  codArticulo: "",
});

const createEmptySupplierForm = (): SupplierForm => ({ nombre: "", email: "", telefono: "", condicionPago: "", plazoPromedioDias: "" });

const optionalDateValue = (value?: string | null) => safeDateForDisplay(value);

const generateOrderNumber = () => `PED-${Date.now()}`;

const getSellerEmail = (seller: string, explicitEmail: string) => {
  const trimmedEmail = safeText(explicitEmail);
  if (trimmedEmail) return trimmedEmail;
  const trimmedSeller = safeText(seller);
  return /\S+@\S+\.\S+/.test(trimmedSeller) ? trimmedSeller : null;
};

const itemToForm = (item: PedidoItem): PedidoItemEditForm => ({
  id: item.id,
  descripcion: item.descripcion || "",
  cantidadPedida: String(item.cantidad_pedida ?? ""),
  unidad: item.unidad || "",
  costoUnitario: item.costo_unitario == null ? "" : String(item.costo_unitario),
  moneda: item.moneda || "ARS",
  codArticulo: item.cod_articulo || "",
});

const mapOrderFromSupabase = (order: PurchaseOrderRow): PurchaseOrder => ({
  id: order.id,
  orderNumber: order.numero_pedido,
  supplier: Array.isArray(order.proveedores) ? order.proveedores[0]?.nombre || "Sin proveedor" : order.proveedores?.nombre || "Sin proveedor",
  supplierPhone: Array.isArray(order.proveedores) ? order.proveedores[0]?.telefono || "" : order.proveedores?.telefono || "",
  supplierId: order.proveedor_id || "",
  status: normalizeStatus(order.estado || "pedido_cargado", order.fecha_estimada_entrega || ""),
  rawStatus: order.estado || "pedido_cargado",
  ocNumber: order.numero_oc_qubigo || "-",
  eta: order.fecha_estimada_entrega || "",
  notes: order.observaciones || "Sin observaciones",
  cliente: order.cliente || "-",
  vendedor: order.vendedor || "-",
  fecha: order.fecha || "",
});

const mapAlertaFromSupabase = (alerta: AlertaRow): AlertaListItem => {
  const pedido = Array.isArray(alerta.pedidos) ? alerta.pedidos[0] : alerta.pedidos;
  const proveedor = Array.isArray(pedido?.proveedores) ? pedido?.proveedores[0]?.nombre : pedido?.proveedores?.nombre;
  const fechaAviso = safeDateForDisplay(alerta.fecha_aviso);
  return {
    id: alerta.id,
    proveedor: proveedor || "Sin proveedor",
    cliente: pedido?.cliente || "-",
    numeroPedido: pedido?.numero_pedido || "-",
    numeroOcQubigo: pedido?.numero_oc_qubigo || "-",
    tipo: alerta.tipo || "-",
    fechaEstimada: safeDateForDisplay(alerta.fecha_estimada),
    fechaAviso,
    estado: alerta.estado || "-",
    pedidoEstado: pedido?.estado || "",
    vendedor: pedido?.vendedor || "-",
    daysRemaining: getDaysRemaining(fechaAviso),
  };
};

const Index = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [activeSection, setActiveSection] = useState("Dashboard");
  const [alertas, setAlertas] = useState<AlertaListItem[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(fallbackSuppliers);
  const [query, setQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const defaultStatusFilters = ["pedido_cargado", "en_curso", "recibido_parcial"];
  const [statusFilters, setStatusFilters] = useState<string[]>(defaultStatusFilters);
  const [supplierFilter, setSupplierFilter] = useState("todos");
  const [alertaEstadoFilter, setAlertaEstadoFilter] = useState("en_curso");
  const [alertaTipoFilter, setAlertaTipoFilter] = useState("todos");
  const [alertaProveedorFilter, setAlertaProveedorFilter] = useState("todos");
  const [alertaVendedorFilter, setAlertaVendedorFilter] = useState("todos");
  const [onlyExpiredAlertas, setOnlyExpiredAlertas] = useState(false);
  const [onlyUpcomingAlertas, setOnlyUpcomingAlertas] = useState(false);
  const [onlyWithoutOc, setOnlyWithoutOc] = useState(false);
  const [onlyMyActiveOrders, setOnlyMyActiveOrders] = useState(false);
  const [form, setForm] = useState<PedidoForm>(() => createEmptyOrderForm());
  const [itemForms, setItemForms] = useState<PedidoItemForm[]>([createEmptyItemForm()]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);
  const [pedidoItems, setPedidoItems] = useState<PedidoItem[]>([]);
  const [pedidoAlertas, setPedidoAlertas] = useState<PedidoAlerta[]>([]);
  const [previewItemsByOrderId, setPreviewItemsByOrderId] = useState<Record<string, PedidoItem[]>>({});
  const [dashboardAlertasCount, setDashboardAlertasCount] = useState(0);
  const [receptionForm, setReceptionForm] = useState({ itemId: "", quantity: "", date: today(), newEta: "", notes: "" });
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingReception, setIsSavingReception] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(() => createEmptySupplierForm());
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [purchaseTotalsBySupplier, setPurchaseTotalsBySupplier] = useState<PurchaseTotalBySupplier[]>([]);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; email: string | null; telefono: string | null }>>([]);
  const now = new Date();
  const [reportMonth, setReportMonth] = useState<number>(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(now.getFullYear());
  const [reportFilterMode, setReportFilterMode] = useState<"mes" | "rango">("mes");
  const [reportFechaDesde, setReportFechaDesde] = useState<string>("");
  const [reportFechaHasta, setReportFechaHasta] = useState<string>("");
  const [sellerMessage, setSellerMessage] = useState("");
  const [isSellerMessageOpen, setIsSellerMessageOpen] = useState(false);
  const [editForm, setEditForm] = useState<PedidoForm>(() => createEmptyOrderForm());
  const [editItemForms, setEditItemForms] = useState<PedidoItemEditForm[]>([]);
  const itemDescriptionRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const { currentUserProfile, email: userEmail, signOut } = useCurrentUserProfile();
  const userRol = (currentUserProfile?.rol || "").toLowerCase();
  const isAdminRole = userRol === "admin" || userRol === "compras";
  const isVendedor = userRol === "vendedor";
  const isDeposito = userRol === "deposito";
  const isAdmin = isAdminRole || isVendedor; // controls cost columns visibility
  const canViewCosts = isAdminRole || isVendedor;
  const canEditPedido = isAdminRole;
  const canAddRecepcion = isAdminRole || isDeposito;
  const canSeeAlertas = isAdminRole;
  const canSeeReportes = isAdminRole;
  const canSeeProveedores = isAdminRole;
  const canCreatePedido = isAdminRole || isVendedor;
  const canSendMessages = isAdminRole;
  const canSeeCotizaciones = isAdminRole || isVendedor;
  const currentSeller = currentUserProfile?.nombre || "María";

  useEffect(() => {
    const loadOrders = async () => {
      const [{ data: suppliersData, error: suppliersError }, { data, error }, { data: alertasData, error: alertasError }, { data: alertasListData, error: alertasListError }, { data: totalsData, error: totalsError }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre, email, telefono, condicion_pago, plazo_promedio_dias").eq("activo", true).order("nombre", { ascending: true }),
        supabase
          .from("pedidos")
          .select("id, fecha, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones, cliente, vendedor")
          .order("fecha_estimada_entrega", { ascending: true }),
        supabase.from("alertas").select("id, fecha_aviso, estado"),
        supabase
          .from("alertas")
          .select("id, pedido_id, item_id, tipo, fecha_estimada, fecha_aviso, estado, pedidos(cliente, numero_pedido, numero_oc_qubigo, vendedor, estado, proveedores(nombre))")
          .order("fecha_aviso", { ascending: true }),
        supabase
          .from("pedido_items")
          .select("cantidad_pedida, costo_unitario, moneda, pedidos(proveedores(nombre))")
          .not("costo_unitario", "is", null),
      ]);

      if (suppliersError || error || alertasError || alertasListError) {
        toast({
          title: "Preview interactivo activado",
          description: "No se pudo conectar con la base remota, se usan datos demo editables.",
        });
        setIsPreviewMode(true);
        setSuppliers(fallbackSuppliers);
        setForm((current) => ({ ...current, supplierId: fallbackSuppliers[0]?.id || "" }));
        setOrders(initialOrders);
        setAlertas(Object.values(demoAlertasByOrderId).flat().map((alerta) => {
          const order = initialOrders.find((item) => item.id === alerta.pedido_id);
          return { id: alerta.id, proveedor: order?.supplier || "Sin proveedor", cliente: order?.cliente || "-", numeroPedido: order?.orderNumber || "-", numeroOcQubigo: order?.ocNumber || "-", tipo: alerta.tipo || "-", fechaEstimada: safeDateForDisplay(alerta.fecha_estimada), fechaAviso: safeDateForDisplay(alerta.fecha_aviso), estado: alerta.estado || "-", pedidoEstado: order?.rawStatus || "", vendedor: order?.vendedor || "-", daysRemaining: getDaysRemaining(alerta.fecha_aviso) };
        }));
        setPurchaseTotalsBySupplier([]);
        setDashboardAlertasCount(Object.values(demoAlertasByOrderId).flat().filter((alerta) => alerta.estado !== "resuelta" && isUpcomingDueDate(alerta.fecha_aviso)).length);
        setSelectedOrderId(initialOrders[0]?.id || null);
        setIsLoading(false);
        return;
      }

      const activeSuppliers = suppliersData || [];
      setSuppliers(activeSuppliers.length > 0 ? activeSuppliers : fallbackSuppliers);
      setForm((current) => ({ ...current, supplierId: activeSuppliers[0]?.id || "" }));
      const mappedOrders = ((data || []) as PurchaseOrderRow[]).map(mapOrderFromSupabase);
      setOrders(mappedOrders);
      setAlertas(((alertasListData || []) as AlertaRow[]).map(mapAlertaFromSupabase));
      const totalsMap = new Map<string, PurchaseTotalBySupplier>();
      (totalsError ? [] : totalsData || []).forEach((row: any) => {
        const pedido = Array.isArray(row.pedidos) ? row.pedidos[0] : row.pedidos;
        const proveedor = Array.isArray(pedido?.proveedores) ? pedido?.proveedores[0]?.nombre : pedido?.proveedores?.nombre;
        const name = proveedor || "Sin proveedor";
        const moneda = optionalValue(row.moneda) || "ARS";
        const key = `${name}-${moneda}`;
        const current = totalsMap.get(key) || { proveedor: name, total: 0, moneda };
        current.total += safeNumber(row.cantidad_pedida) * safeNumber(row.costo_unitario);
        totalsMap.set(key, current);
      });
      setPurchaseTotalsBySupplier(Array.from(totalsMap.values()).sort((a, b) => b.total - a.total));
      setDashboardAlertasCount((alertasData || []).filter((alerta) => alerta.estado !== "resuelta" && isUpcomingDueDate(alerta.fecha_aviso)).length);
      setSelectedOrderId(mappedOrders[0]?.id || null);
      setIsLoading(false);
    };

    const loadClientes = async () => {
      try {
        const { data, error } = await supabase.from("clientes" as any).select("id, nombre, email, telefono");
        if (!error && Array.isArray(data)) {
          setClientes(data as any);
        }
      } catch {
        // table may not exist yet — safe no-op
      }
    };

    loadOrders();
    loadClientes();
  }, []);

  useEffect(() => {
    if (!selectedOrderId) {
      setPedidoItems([]);
      setPedidoAlertas([]);
      return;
    }

    const loadPedidoItems = async () => {
      setIsLoadingItems(true);
      if (isPreviewMode) {
        const items = previewItemsByOrderId[String(selectedOrderId)] || getDemoItems(selectedOrderId);
        setPedidoItems(items);
        setPedidoAlertas(getDemoAlertas(selectedOrderId));
        setReceptionForm({ itemId: items[0]?.id || "", quantity: "", date: today(), newEta: "", notes: "" });
        setIsLoadingItems(false);
        return;
      }

      const [{ data, error }, { data: alertasData, error: alertasError }] = await Promise.all([
        supabase
          .from("pedido_items")
          .select("id, descripcion, cantidad_pedida, cantidad_recibida, cantidad_pendiente, unidad, costo_unitario, moneda, cod_articulo, estado_entrega")
          .eq("pedido_id", selectedOrderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("alertas")
          .select("id, pedido_id, item_id, tipo, fecha_estimada, fecha_aviso, estado")
          .eq("pedido_id", selectedOrderId)
          .order("fecha_aviso", { ascending: true }),
      ]);

      if (error || alertasError) {
        toast({ title: "No se pudo cargar el detalle", description: "Revisá los permisos de lectura de pedido_items y alertas.", variant: "destructive" });
        setPedidoItems([]);
        setPedidoAlertas([]);
        setIsLoadingItems(false);
        return;
      }

      const items = (data || []) as PedidoItem[];
      setPedidoItems(items);
      setPedidoAlertas((alertasData || []) as PedidoAlerta[]);
      setReceptionForm({ itemId: items[0]?.id || "", quantity: "", date: today(), newEta: "", notes: "" });
      setIsLoadingItems(false);
    };

    loadPedidoItems();
  }, [selectedOrderId, isPreviewMode, previewItemsByOrderId]);

  const sellerOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.vendedor).filter(Boolean))).sort(), [orders]);
  const supplierOptions = useMemo(() => Array.from(new Set(orders.map((order) => order.supplier).filter(Boolean))).sort(), [orders]);
  const alertaEstadoOptions = useMemo(() => Array.from(new Set(alertas.map((alerta) => alerta.estado).filter(Boolean))).sort(), [alertas]);
  const alertaTipoOptions = useMemo(() => Array.from(new Set(alertas.map((alerta) => alerta.tipo).filter(Boolean))).sort(), [alertas]);
  const alertaProveedorOptions = useMemo(() => Array.from(new Set(alertas.map((alerta) => alerta.proveedor).filter(Boolean))).sort(), [alertas]);
  const alertaVendedorOptions = useMemo(() => Array.from(new Set(alertas.map((alerta) => alerta.vendedor).filter(Boolean))).sort(), [alertas]);
  const filteredAlertas = useMemo(
    () => alertas.filter((alerta) => {
      const pedidoEstado = (alerta.pedidoEstado || "").toLowerCase();
      if (!["en_curso", "recibido_parcial"].includes(pedidoEstado)) return false;
      const matchesEstado = alertaEstadoFilter === "todos" || alerta.estado === alertaEstadoFilter;
      const matchesTipo = alertaTipoFilter === "todos" || alerta.tipo === alertaTipoFilter;
      const matchesProveedor = alertaProveedorFilter === "todos" || alerta.proveedor === alertaProveedorFilter;
      const matchesVendedor = alertaVendedorFilter === "todos" || alerta.vendedor === alertaVendedorFilter;
      const matchesExpired = !onlyExpiredAlertas || (alerta.daysRemaining !== null && alerta.daysRemaining < 0 && !isClosedAlerta(alerta.estado));
      const matchesUpcoming = !onlyUpcomingAlertas || (alerta.daysRemaining !== null && alerta.daysRemaining >= 0 && alerta.daysRemaining <= 3 && !isClosedAlerta(alerta.estado));
      return matchesEstado && matchesTipo && matchesProveedor && matchesVendedor && matchesExpired && matchesUpcoming;
    }),
    [alertas, alertaEstadoFilter, alertaTipoFilter, alertaProveedorFilter, alertaVendedorFilter, onlyExpiredAlertas, onlyUpcomingAlertas],
  );
  const sortedOrders = useMemo(() => {
    const todayStr = today();
    const withDate: PurchaseOrder[] = [];
    const withoutDate: PurchaseOrder[] = [];
    orders.forEach((o) => (safeDateForDisplay(o.eta) ? withDate : withoutDate).push(o));
    withDate.sort((a, b) => {
      const aOverdue = a.eta < todayStr ? 0 : 1;
      const bOverdue = b.eta < todayStr ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return a.eta.localeCompare(b.eta);
    });
    return [...withDate, ...withoutDate];
  }, [orders]);
  const filteredOrders = useMemo(
    () => sortedOrders.filter((order) => {
      const withoutOc = order.rawStatus === "pedido_cargado" && (!order.ocNumber || order.ocNumber === "-");
      const matchesSearch = `${order.orderNumber} ${order.supplier} ${order.ocNumber} ${order.status} ${order.vendedor}`.toLowerCase().includes(query.toLowerCase());
      const matchesSeller = sellerFilter === "todos" || order.vendedor === sellerFilter;
      const matchesStatus = statusFilters.length === 0 || statusFilters.includes(order.rawStatus);
      const matchesSupplier = supplierFilter === "todos" || order.supplier === supplierFilter;
      const matchesWithoutOc = !onlyWithoutOc || withoutOc;
      const matchesMyActive = !onlyMyActiveOrders || (order.vendedor === currentSeller && ["en_curso", "recibido_parcial"].includes(order.rawStatus));
      return matchesSearch && matchesSeller && matchesStatus && matchesSupplier && matchesWithoutOc && matchesMyActive;
    }),
    [sortedOrders, query, sellerFilter, statusFilters, supplierFilter, onlyWithoutOc, onlyMyActiveOrders],
  );

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const upcomingAlertItemIds = new Set(
    pedidoAlertas
      .filter((alerta) => alerta.item_id && alerta.estado !== "resuelta" && alerta.fecha_aviso >= today())
      .map((alerta) => alerta.item_id),
  );

  const nextDeliveries = orders.filter((order) => order.status !== "Entregado").slice(0, 3);

  const ordersWithoutOcCount = orders.filter((order) => order.rawStatus === "pedido_cargado" && (!order.ocNumber || order.ocNumber === "-")).length;
  const totalOcAmount = pedidoItems.reduce((total, item) => total + getItemSubtotal(item), 0);
  const totalOcCurrency = pedidoItems.find((item) => item.moneda)?.moneda || "ARS";

  const metrics = [
    { label: "Total pedidos en curso", value: orders.filter((order) => order.rawStatus !== "cerrado" && order.rawStatus !== "entregado").length, icon: PackageCheck },
    { label: "Pedidos atrasados", value: orders.filter((order) => order.status === "Atrasado").length, icon: AlertTriangle },
    { label: "Alertas próximas a vencer", value: dashboardAlertasCount, icon: CalendarClock },
    { label: "Pedidos sin OC", value: ordersWithoutOcCount, icon: AlertTriangle },
  ];

  const ordersByStatus = useMemo(() => pedidoEstados.map((estado) => ({ estado, count: orders.filter((order) => order.rawStatus === estado).length })).filter((item) => item.count > 0), [orders]);
  const activeAlertasCount = alertas.filter((alerta) => !isClosedAlerta(alerta.estado)).length;
  const recentOrders = orders.slice(0, 6);

  // Operational dashboard data
  const todayIsoStr = today();
  const overdueOrders = useMemo(() => {
    return orders
      .filter((o) => ["en_curso", "pedido_cargado", "recibido_parcial"].includes(o.rawStatus) && safeDateForDisplay(o.eta) && o.eta < todayIsoStr)
      .map((o) => ({ order: o, diasAtraso: Math.abs(getDaysRemaining(o.eta) ?? 0) }))
      .sort((a, b) => b.diasAtraso - a.diasAtraso)
      .slice(0, 5);
  }, [orders, todayIsoStr]);
  const upcomingDeliveries = useMemo(() => {
    return orders
      .filter((o) => {
        if (!["en_curso", "pedido_cargado", "recibido_parcial"].includes(o.rawStatus)) return false;
        const days = getDaysRemaining(o.eta);
        return days !== null && days >= 0 && days <= 3;
      })
      .sort((a, b) => a.eta.localeCompare(b.eta));
  }, [orders, todayIsoStr]);
  const ordersWithoutOc = useMemo(
    () => orders.filter((o) => o.rawStatus === "pedido_cargado" && (!o.ocNumber || o.ocNumber === "-")),
    [orders],
  );
  const totalEnCurso = orders.filter((o) => ["en_curso", "pedido_cargado", "recibido_parcial"].includes(o.rawStatus)).length;
  const totalAtrasados = orders.filter((o) => ["en_curso", "pedido_cargado", "recibido_parcial"].includes(o.rawStatus) && safeDateForDisplay(o.eta) && o.eta < todayIsoStr).length;
  const finalizedOrders = orders.filter((o) => ["terminado", "recibido_total"].includes(o.rawStatus));
  const onTimeFinalized = finalizedOrders.filter((o) => safeDateForDisplay(o.eta) && o.eta >= o.fecha).length;
  const cumplimientoPct = finalizedOrders.length > 0 ? Math.round((onTimeFinalized / finalizedOrders.length) * 100) : 0;

  useEffect(() => {
    if (!isAdminRole && (activeSection === "Dashboard" || activeSection === "Alertas" || activeSection === "Reportes" || activeSection === "Proveedores")) {
      setActiveSection("Pedidos");
    }
  }, [isAdminRole, activeSection]);

  // Reportes filter — supports month/year or custom date range. Uses pedido.fecha (YYYY-MM-DD).
  const isInReportPeriod = (fecha: string | null | undefined) => {
    if (!fecha || typeof fecha !== "string") return false;
    if (reportFilterMode === "rango") {
      if (!reportFechaDesde && !reportFechaHasta) return true;
      if (reportFechaDesde && fecha < reportFechaDesde) return false;
      if (reportFechaHasta && fecha > reportFechaHasta) return false;
      return true;
    }
    const parts = fecha.split("-");
    if (parts.length < 2) return false;
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return false;
    return y === reportYear && m === reportMonth;
  };
  const ordersInReportMonth = useMemo(() => orders.filter((o) => isInReportPeriod(o.fecha)), [orders, reportMonth, reportYear, reportFilterMode, reportFechaDesde, reportFechaHasta]);
  const ordersByStatusReport = useMemo(() => pedidoEstados.map((estado) => ({ estado, count: ordersInReportMonth.filter((o) => o.rawStatus === estado).length })).filter((item) => item.count > 0), [ordersInReportMonth]);
  const ordersWithoutOcReport = ordersInReportMonth.filter((o) => o.rawStatus === "pedido_cargado" && (!o.ocNumber || o.ocNumber === "-")).length;
  const activeAlertasReport = useMemo(() => {
    const orderIdsInMonth = new Set(ordersInReportMonth.map((o) => String(o.id)));
    // alertas don't carry pedido fecha directly; match by numero_pedido
    const numerosInMonth = new Set(ordersInReportMonth.map((o) => o.orderNumber));
    return alertas.filter((a) => !isClosedAlerta(a.estado) && numerosInMonth.has(a.numeroPedido)).length;
  }, [alertas, ordersInReportMonth]);
  const purchaseTotalsBySupplierReport = useMemo(() => {
    // Filter purchase totals by supplier name appearing in this month's orders
    const allowedSuppliers = new Set(ordersInReportMonth.map((o) => o.supplier));
    return purchaseTotalsBySupplier.filter((p) => allowedSuppliers.has(p.proveedor));
  }, [purchaseTotalsBySupplier, ordersInReportMonth]);

  // Cliente lookup for selected pedido
  const selectedClienteContact = useMemo(() => {
    const order = orders.find((o) => o.id === selectedOrderId);
    if (!order || !order.cliente) return null;
    const match = clientes.find((c) => (c.nombre || "").trim().toLowerCase() === (order.cliente || "").trim().toLowerCase());
    return match || null;
  }, [orders, selectedOrderId, clientes]);

  const updateItemForm = (index: number, field: keyof PedidoItemForm, value: string) => {
    setItemForms((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addItemForm = () => {
    const nextIndex = itemForms.length;
    setItemForms((current) => [...current, createEmptyItemForm()]);
    window.requestAnimationFrame(() => itemDescriptionRefs.current[`create-${nextIndex}`]?.focus());
  };

  const removeItemForm = (index: number) => setItemForms((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));

  const updateEditItemForm = (index: number, field: keyof PedidoItemForm, value: string) => {
    setEditItemForms((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addEditItemForm = () => {
    const id = `new-${Date.now()}`;
    setEditItemForms((current) => [...current, { ...createEmptyItemForm(), id }]);
    window.requestAnimationFrame(() => itemDescriptionRefs.current[id]?.focus());
  };

  const openEditOrder = async () => {
    if (!selectedOrder) return;
    setIsEditOpen(true);
    setIsLoadingEdit(true);

    if (isPreviewMode) {
      setEditForm({
        fecha: today(),
        supplierId: selectedOrder.supplierId || suppliers[0]?.id || "",
        cliente: "",
        numeroOcCliente: "",
        plazoEntregaCliente: "",
        plazoEntregaProveedor: "",
        vendedor: "",
        observaciones: selectedOrder.notes === "Sin observaciones" ? "" : selectedOrder.notes,
        condicionesPago: "",
        numeroPedido: selectedOrder.orderNumber,
        numeroOcQubigo: selectedOrder.ocNumber === "-" ? "" : selectedOrder.ocNumber,
        estado: selectedOrder.rawStatus || "pedido_cargado",
        fechaEstimadaEntrega: isValidDateValue(selectedOrder.eta) ? selectedOrder.eta : "",
        mailVendedor: "",
      });
      setEditItemForms(pedidoItems.map(itemToForm));
      setIsLoadingEdit(false);
      return;
    }

    const { data, error } = await supabase
      .from("pedidos")
      .select("proveedor_id, cliente, numero_oc_cliente, plazo_entrega_cliente, plazo_entrega_proveedor, vendedor, observaciones, condiciones_pago, numero_pedido, numero_oc_qubigo, estado, fecha_estimada_entrega, mail_vendedor")
      .eq("id", selectedOrder.id)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "No se pudo cargar el pedido", description: error?.message || "Pedido no encontrado.", variant: "destructive" });
      setIsLoadingEdit(false);
      return;
    }

    setEditForm({
      fecha: "",
      supplierId: data.proveedor_id || "",
      cliente: data.cliente || "",
      numeroOcCliente: data.numero_oc_cliente || "",
      plazoEntregaCliente: data.plazo_entrega_cliente || "",
      plazoEntregaProveedor: data.plazo_entrega_proveedor || "",
      vendedor: data.vendedor || "",
      observaciones: data.observaciones || "",
      condicionesPago: data.condiciones_pago || "",
      numeroPedido: data.numero_pedido || "",
      numeroOcQubigo: data.numero_oc_qubigo || "",
      estado: data.estado || "pedido_cargado",
      fechaEstimadaEntrega: isValidDateValue(data.fecha_estimada_entrega) ? data.fecha_estimada_entrega : "",
      mailVendedor: data.mail_vendedor || "",
    });
    setEditItemForms(pedidoItems.map(itemToForm));
    setIsLoadingEdit(false);
  };

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validItems = itemForms.filter((item) => safeText(item.descripcion) && safeNumber(item.cantidadPedida) > 0 && safeText(item.unidad));
    if (!form.supplierId || !safeText(form.cliente) || !safeText(form.vendedor) || !safeText(form.plazoEntregaCliente) || validItems.length === 0) return;

    setIsSaving(true);
    const nextOrderNumber = optionalValue(form.numeroPedido) || generateOrderNumber();
    const nextStatus = deriveStatusByOc(form.numeroOcQubigo, form.estado);
    const nextSellerEmail = getSellerEmail(form.vendedor, form.mailVendedor);

    if (isPreviewMode) {
      const supplier = suppliers.find((item) => item.id === form.supplierId);
      const createdOrder: PurchaseOrder = {
        id: `preview-${Date.now()}`,
        orderNumber: nextOrderNumber,
        supplier: supplier?.nombre || "Sin proveedor",
        supplierId: form.supplierId,
        supplierPhone: supplier?.telefono || "",
        status: normalizeStatus(nextStatus, form.fechaEstimadaEntrega || today()),
        rawStatus: nextStatus,
        ocNumber: form.numeroOcQubigo,
        eta: form.fechaEstimadaEntrega || today(),
        notes: form.observaciones || "Sin observaciones",
        cliente: safeText(form.cliente),
        vendedor: safeText(form.vendedor),
        fecha: form.fecha,
      };
      const createdItems: PedidoItem[] = validItems.map((item, index) => ({
        id: `${createdOrder.id}-item-${index + 1}`,
        descripcion: safeText(item.descripcion),
        cantidad_pedida: safeNumber(item.cantidadPedida),
        cantidad_recibida: 0,
        cantidad_pendiente: safeNumber(item.cantidadPedida),
        unidad: safeText(item.unidad),
        costo_unitario: optionalValue(item.costoUnitario) ? safeNumber(item.costoUnitario) : 0,
        moneda: optionalValue(item.moneda) || "ARS",
        cod_articulo: optionalValue(item.codArticulo) || "",
        estado_entrega: "pendiente",
      }));
      setOrders((current) => [createdOrder, ...current]);
      setSelectedOrderId(createdOrder.id);
      setPedidoItems(createdItems);
      setPreviewItemsByOrderId((current) => ({ ...current, [String(createdOrder.id)]: createdItems }));
      setPedidoAlertas([]);
      setForm(createEmptyOrderForm(suppliers[0]?.id || ""));
      setItemForms([createEmptyItemForm()]);
      setIsSaving(false);
      toast({ title: "Pedido creado en preview", description: "El pedido quedó disponible para probar la interacción." });
      return;
    }

    if (!isValidUuid(form.supplierId)) {
      toast({ title: "Proveedor inválido", description: "Seleccioná un proveedor válido antes de guardar.", variant: "destructive" });
      setIsSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        fecha: optionalDateValue(form.fecha),
        numero_pedido: nextOrderNumber,
        proveedor_id: form.supplierId,
        cliente: safeText(form.cliente),
        numero_oc_cliente: optionalValue(form.numeroOcCliente),
        numero_oc_qubigo: optionalValue(form.numeroOcQubigo),
        plazo_entrega_cliente: safeText(form.plazoEntregaCliente),
        plazo_entrega_proveedor: optionalValue(form.plazoEntregaProveedor),
        vendedor: safeText(form.vendedor),
        observaciones: optionalValue(form.observaciones),
        condiciones_pago: optionalValue(form.condicionesPago),
        estado: nextStatus,
        mail_vendedor: nextSellerEmail,
      })
      .select("id, fecha, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones, cliente, vendedor")
      .maybeSingle();

    if (error) {
      toast({
        title: "Error al guardar pedido",
        description: error.message,
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    if (data) {
      const createdOrder = mapOrderFromSupabase(data as PurchaseOrderRow);
      const itemsToInsert = validItems.map((item) => ({
        pedido_id: createdOrder.id,
        descripcion: safeText(item.descripcion),
        cantidad_pedida: safeNumber(item.cantidadPedida),
        cantidad_recibida: 0,
        cantidad_pendiente: safeNumber(item.cantidadPedida),
        unidad: safeText(item.unidad),
        costo_unitario: optionalValue(item.costoUnitario) ? safeNumber(item.costoUnitario) : null,
        moneda: optionalValue(item.moneda) || "ARS",
        cod_articulo: optionalValue(item.codArticulo),
        estado_entrega: "pendiente",
      }));
      const { data: createdItems, error: itemsError } = await supabase
        .from("pedido_items")
        .insert(itemsToInsert)
        .select("id, descripcion, cantidad_pedida, cantidad_recibida, cantidad_pendiente, unidad, costo_unitario, moneda, cod_articulo, estado_entrega");

      if (itemsError) {
      toast({ title: "Error al guardar ítems", description: itemsError.message, variant: "destructive" });
        setIsSaving(false);
        return;
      }

      setOrders((current) => [createdOrder, ...current]);
      setSelectedOrderId(createdOrder.id);
      setPedidoItems((createdItems || []) as PedidoItem[]);
    }
    setForm(createEmptyOrderForm(suppliers[0]?.id || ""));
    setItemForms([createEmptyItemForm()]);
    setIsSaving(false);
    toast({ title: "Pedido guardado", description: "La OC quedó registrada en pedidos." });
  };

  const saveEditOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrder) return;

    setIsSavingEdit(true);
    const derivedStatus = deriveStatusByOc(editForm.numeroOcQubigo, editForm.estado);
    const nextEta = optionalDateValue(editForm.fechaEstimadaEntrega);
    const nextItems = editItemForms.map((item) => {
      const ordered = safeNumber(item.cantidadPedida);
      const original = pedidoItems.find((current) => current.id === item.id);
      const received = safeNumber(original?.cantidad_recibida);
      return {
        ...original,
        id: item.id,
        descripcion: safeText(item.descripcion),
        cantidad_pedida: ordered,
        cantidad_recibida: received,
        cantidad_pendiente: Math.max(ordered - received, 0),
        unidad: safeText(item.unidad),
        costo_unitario: optionalValue(item.costoUnitario) ? safeNumber(item.costoUnitario) : 0,
        moneda: optionalValue(item.moneda) || "ARS",
        cod_articulo: optionalValue(item.codArticulo) || "",
        estado_entrega: Math.max(ordered - received, 0) <= 0 ? "recibido_total" : original?.estado_entrega || "pendiente",
      } as PedidoItem;
    });
    const protectedStatuses = ["terminado", "anulado", "recibido_parcial", "recibido_total"];
    const userPicked = optionalValue(editForm.estado) || "";
    const nextStatus = protectedStatuses.includes(userPicked)
      ? userPicked
      : (getPedidoLifecycleStatus(nextItems, derivedStatus) === "en_curso" && !optionalValue(editForm.numeroOcQubigo)
          ? derivedStatus
          : getPedidoLifecycleStatus(nextItems, derivedStatus));

    if (isPreviewMode) {
      const supplier = suppliers.find((item) => item.id === editForm.supplierId);
      setOrders((current) => current.map((order) => order.id === selectedOrder.id ? {
        ...order,
        supplier: supplier?.nombre || order.supplier,
        supplierId: editForm.supplierId,
        rawStatus: nextStatus,
        status: normalizeStatus(nextStatus, nextEta || ""),
        ocNumber: editForm.numeroOcQubigo || "-",
        eta: nextEta || "",
        notes: editForm.observaciones || "Sin observaciones",
        cliente: safeText(editForm.cliente) || order.cliente,
        vendedor: safeText(editForm.vendedor) || order.vendedor,
      } : order));
      setPedidoItems(nextItems);
      setPreviewItemsByOrderId((current) => ({ ...current, [String(selectedOrder.id)]: nextItems }));
      setIsSavingEdit(false);
      setIsEditOpen(false);
      toast({ title: "Pedido actualizado en preview", description: "Los cambios se aplicaron localmente." });
      return;
    }

    if (!isValidUuid(editForm.supplierId)) {
      toast({ title: "Proveedor inválido", description: "Seleccioná un proveedor válido antes de guardar.", variant: "destructive" });
      setIsSavingEdit(false);
      return;
    }

    const { data, error } = await supabase
      .from("pedidos")
      .update({
        proveedor_id: editForm.supplierId,
        cliente: optionalValue(editForm.cliente),
        numero_oc_cliente: optionalValue(editForm.numeroOcCliente),
        plazo_entrega_cliente: optionalValue(editForm.plazoEntregaCliente),
        plazo_entrega_proveedor: optionalValue(editForm.plazoEntregaProveedor),
        vendedor: optionalValue(editForm.vendedor),
        observaciones: optionalValue(editForm.observaciones),
        condiciones_pago: optionalValue(editForm.condicionesPago),
        numero_oc_qubigo: optionalValue(editForm.numeroOcQubigo),
        estado: nextStatus,
        fecha_estimada_entrega: nextEta,
        mail_vendedor: getSellerEmail(editForm.vendedor, editForm.mailVendedor),
      })
      .eq("id", selectedOrder.id)
      .select("id, fecha, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones, cliente, vendedor")
      .maybeSingle();

    if (error) {
      toast({ title: "No se pudo actualizar el pedido", description: error.message, variant: "destructive" });
      setIsSavingEdit(false);
      return;
    }

    for (const item of editItemForms.filter((current) => !current.id.startsWith("new-"))) {
      const ordered = safeNumber(item.cantidadPedida);
      const original = pedidoItems.find((current) => current.id === item.id);
      const received = safeNumber(original?.cantidad_recibida);
      const { error: itemError } = await supabase
        .from("pedido_items")
        .update({
          descripcion: safeText(item.descripcion),
          cantidad_pedida: ordered,
          cantidad_pendiente: Math.max(ordered - received, 0),
          unidad: safeText(item.unidad),
          moneda: optionalValue(item.moneda) || "ARS",
          costo_unitario: optionalValue(item.costoUnitario) ? safeNumber(item.costoUnitario) : null,
          cod_articulo: optionalValue(item.codArticulo),
          estado_entrega: Math.max(ordered - received, 0) <= 0 ? "recibido_total" : "pendiente",
        })
        .eq("id", item.id);

      if (itemError) {
        toast({ title: "Pedido actualizado, pero falló un ítem", description: itemError.message, variant: "destructive" });
        setIsSavingEdit(false);
        return;
      }
    }

    const newItems = editItemForms.filter((item) => item.id.startsWith("new-") && safeText(item.descripcion) && safeNumber(item.cantidadPedida) > 0 && safeText(item.unidad));
    if (newItems.length > 0) {
      const { data: insertedItems, error: insertItemsError } = await supabase
        .from("pedido_items")
        .insert(newItems.map((item) => ({
          pedido_id: selectedOrder.id,
          descripcion: safeText(item.descripcion),
          cantidad_pedida: safeNumber(item.cantidadPedida),
          cantidad_recibida: 0,
          cantidad_pendiente: safeNumber(item.cantidadPedida),
          unidad: safeText(item.unidad),
          moneda: optionalValue(item.moneda) || "ARS",
          costo_unitario: optionalValue(item.costoUnitario) ? safeNumber(item.costoUnitario) : null,
          cod_articulo: optionalValue(item.codArticulo),
          estado_entrega: "pendiente",
        })))
        .select("id, descripcion, cantidad_pedida, cantidad_recibida, cantidad_pendiente, unidad, costo_unitario, moneda, cod_articulo, estado_entrega");

      if (insertItemsError) {
        toast({ title: "Pedido actualizado, pero falló un ítem nuevo", description: insertItemsError.message, variant: "destructive" });
        setIsSavingEdit(false);
        return;
      }
      nextItems.splice(nextItems.length - newItems.length, newItems.length, ...((insertedItems || []) as PedidoItem[]));
    }

    // Refetch pedido from Supabase to ensure UI matches DB (estado, etc.)
    const { data: refetched } = await supabase
      .from("pedidos")
      .select("id, fecha, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones, cliente, vendedor")
      .eq("id", selectedOrder.id)
      .maybeSingle();
    const finalRow = (refetched || data) as PurchaseOrderRow | null;
    if (finalRow) setOrders((current) => current.map((order) => order.id === selectedOrder.id ? mapOrderFromSupabase(finalRow) : order));
    setPedidoItems(nextItems);
    setIsSavingEdit(false);
    setIsEditOpen(false);
    toast({ title: "Pedido actualizado", description: "Los cambios fueron guardados." });
  };

  const addReception = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedItem = pedidoItems.find((item) => item.id === receptionForm.itemId);
    const receivedQuantity = safeNumber(receptionForm.quantity);

    if (!selectedOrderId || !selectedItem || !receivedQuantity || receivedQuantity <= 0) return;

    setIsSavingReception(true);
    const nextReceived = safeNumber(selectedItem.cantidad_recibida) + receivedQuantity;
    const nextPending = Math.max(safeNumber(selectedItem.cantidad_pedida) - nextReceived, 0);
    const updatedItems = pedidoItems.map((item) => item.id === selectedItem.id ? { ...item, cantidad_recibida: nextReceived, cantidad_pendiente: nextPending, estado_entrega: nextPending <= 0 ? "recibido_total" : item.estado_entrega || "pendiente" } : item);
    const nextOrderStatus = getPedidoLifecycleStatus(updatedItems, selectedOrder?.rawStatus);

    if (isPreviewMode) {
      setPedidoItems(updatedItems);
      setPreviewItemsByOrderId((current) => ({ ...current, [String(selectedOrderId)]: updatedItems }));
      setOrders((current) => current.map((order) => order.id === selectedOrderId && order.rawStatus !== "anulado" ? { ...order, rawStatus: nextOrderStatus, status: normalizeStatus(nextOrderStatus, order.eta) } : order));
      setReceptionForm((current) => ({ ...current, quantity: "", date: today(), newEta: "", notes: "" }));
      setIsSavingReception(false);
      toast({ title: "Recepción cargada en preview", description: "Las cantidades se actualizaron localmente." });
      return;
    }

    const { error: receptionError } = await supabase.from("recepciones").insert({
      pedido_id: selectedOrderId,
      item_id: selectedItem.id,
      fecha_recepcion: optionalDateValue(receptionForm.date) || today(),
      cantidad_recibida: receivedQuantity,
      nueva_fecha_entrega: optionalDateValue(receptionForm.newEta),
      observaciones: optionalValue(receptionForm.notes) || "Recepción cargada desde OC Control",
    });

    if (receptionError) {
      toast({ title: "Error al guardar recepción", description: receptionError.message, variant: "destructive" });
      setIsSavingReception(false);
      return;
    }

    const { error: itemError } = await supabase
      .from("pedido_items")
      .update({ cantidad_recibida: nextReceived, cantidad_pendiente: nextPending, estado_entrega: nextPending <= 0 ? "recibido_total" : "pendiente" })
      .eq("id", selectedItem.id);

    if (itemError) {
      toast({ title: "Recepción guardada, pero no se actualizó el ítem", description: itemError.message, variant: "destructive" });
      setIsSavingReception(false);
      return;
    }

    if (selectedOrder?.rawStatus !== "anulado") {
      await supabase.from("pedidos").update({ estado: nextOrderStatus }).eq("id", selectedOrderId);
      setOrders((current) => current.map((order) => order.id === selectedOrderId ? { ...order, rawStatus: nextOrderStatus, status: normalizeStatus(nextOrderStatus, order.eta) } : order));
    }
    setPedidoItems(updatedItems);
    setReceptionForm((current) => ({ ...current, quantity: "", date: today(), newEta: "", notes: "" }));
    setIsSavingReception(false);
    toast({ title: "Recepción cargada", description: "Las cantidades del ítem fueron actualizadas." });
  };

  const openWhatsAppMessage = (order: PurchaseOrder) => {
    const pendingItems = selectedOrderId === order.id ? pedidoItems.filter((item) => item.cantidad_pendiente > 0) : [];
    const pendingText = pendingItems.length > 0
      ? pendingItems.map((item) => `- ${item.descripcion}: pendiente ${item.cantidad_pendiente} de ${item.cantidad_pedida}`).join("\n")
      : "- Ítems pendientes según OC.";
    const message = `Hola ${order.supplier}, consultamos por la OC ${order.ocNumber}.\nFecha estimada de entrega: ${formatDate(order.eta)}.\nÍtems pendientes:\n${pendingText}\nPor favor confirmar estado y fecha de entrega.`;
    const phone = normalizePhoneForWhatsApp(order.supplierPhone);
    window.open(`https://wa.me/${phone ? `${phone}?` : "?"}text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const openSellerMessage = () => {
    if (!selectedOrder) return;
    const lines = pedidoItems.map((item, index) => `${index + 1}. ${item.descripcion} – COD ${item.cod_articulo || "F/STOCK"} – ${item.cantidad_pedida} ${item.unidad || ""}`);
    const message = `Hola,

Te compartimos el detalle completo desde Gestión OC:

* Fecha carga: ${formatDate(selectedOrder.fecha)}

* Proveedor: ${selectedOrder.supplier}

* Cliente: ${selectedOrder.cliente || "-"}

* N° OC QUBIGO: ${selectedOrder.ocNumber || "-"}

* Estado: ENVIADO

* Fecha estimada: ${formatDate(selectedOrder.eta)}

Artículos asignados:

${lines.join("\n") || "-"}

MONTO TOTAL OC: ${totalOcAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${totalOcCurrency}

Saludos,

Equipo NORFER`;
    setSellerMessage(message);
    setIsSellerMessageOpen(true);
  };

  const copySellerMessage = async () => {
    await navigator.clipboard.writeText(sellerMessage);
    toast({ title: "Mensaje copiado", description: "Listo para pegar en WhatsApp." });
  };

  const startEditSupplier = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSupplierForm({
      nombre: supplier.nombre || "",
      email: supplier.email || "",
      telefono: supplier.telefono || "",
      condicionPago: supplier.condicion_pago || "",
      plazoPromedioDias: supplier.plazo_promedio_dias == null ? "" : String(supplier.plazo_promedio_dias),
    });
  };

  const resetSupplierForm = () => {
    setEditingSupplierId(null);
    setSupplierForm(createEmptySupplierForm());
  };

  const saveSupplier = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!safeText(supplierForm.nombre)) return;
    setIsSavingSupplier(true);
    const payload = {
      nombre: safeText(supplierForm.nombre),
      email: optionalValue(supplierForm.email),
      telefono: optionalValue(supplierForm.telefono),
      condicion_pago: optionalValue(supplierForm.condicionPago),
      plazo_promedio_dias: optionalValue(supplierForm.plazoPromedioDias) ? safeNumber(supplierForm.plazoPromedioDias) : null,
      activo: true,
    };

    if (isPreviewMode) {
      const nextSupplier = { id: editingSupplierId || `demo-${Date.now()}`, ...payload } as Supplier;
      setSuppliers((current) => editingSupplierId ? current.map((supplier) => supplier.id === editingSupplierId ? nextSupplier : supplier) : [...current, nextSupplier]);
      resetSupplierForm();
      setIsSavingSupplier(false);
      toast({ title: editingSupplierId ? "Proveedor actualizado" : "Proveedor creado", description: "Cambio aplicado en preview." });
      return;
    }

    const request = editingSupplierId
      ? supabase.from("proveedores").update(payload).eq("id", editingSupplierId).select("id, nombre, email, telefono, condicion_pago, plazo_promedio_dias").maybeSingle()
      : supabase.from("proveedores").insert(payload).select("id, nombre, email, telefono, condicion_pago, plazo_promedio_dias").maybeSingle();
    const { data, error } = await request;
    if (error) {
      toast({ title: "Error al guardar proveedor", description: error.message, variant: "destructive" });
      setIsSavingSupplier(false);
      return;
    }
    if (data) setSuppliers((current) => editingSupplierId ? current.map((supplier) => supplier.id === editingSupplierId ? data as Supplier : supplier) : [...current, data as Supplier].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    resetSupplierForm();
    setIsSavingSupplier(false);
    toast({ title: editingSupplierId ? "Proveedor actualizado" : "Proveedor creado", description: "Los datos quedaron guardados." });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 flex-col bg-rail text-rail-foreground lg:flex">
          <div className="border-b border-sidebar-border p-6">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-command-gradient shadow-command">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-sidebar-foreground/70">Compras</p>
                <h1 className="text-xl font-semibold tracking-normal">OC Control</h1>
              </div>
            </div>
          </div>
          <nav className="space-y-2 p-4">
            {navItems.filter((item) => {
              if (item.label === "Alertas") return canSeeAlertas;
              if (item.label === "Reportes") return canSeeReportes;
              if (item.label === "Proveedores") return canSeeProveedores;
              if (item.label === "Cotizaciones") return canSeeCotizaciones;
              if (item.label === "Dashboard") return isAdminRole;
              return true;
            }).map((item, index) => (
              <button key={item.label} onClick={() => setActiveSection(item.label)} className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition hover:bg-sidebar-accent ${activeSection === item.label || (index === 0 && activeSection === "Dashboard") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/78"}`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto p-4">
            <div className="rounded-md border border-sidebar-border bg-sidebar-accent/60 p-4">
              <p className="text-sm font-medium">Preparado para Cloud</p>
              <p className="mt-1 text-xs leading-5 text-sidebar-foreground/70">La interfaz está lista para reemplazar los datos locales por tablas, usuarios y permisos.</p>
            </div>
          </div>
        </aside>

        <section className="flex-1 overflow-hidden">
          <header className="border-b bg-surface-elevated/80 px-5 py-4 backdrop-blur md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gestión de órdenes de compra</p>
                <h2 className="mt-1 text-2xl font-semibold md:text-3xl">{activeSection}</h2>
              </div>
              <div className="flex items-center gap-3">
                {(currentUserProfile?.nombre || userEmail) && (
                  <div className="hidden text-right text-xs text-muted-foreground md:block">
                    <p className="font-medium text-foreground">{currentUserProfile?.nombre || userEmail}</p>
                    {currentUserProfile?.rol && <p className="capitalize">{currentUserProfile.rol}</p>}
                  </div>
                )}
                {canCreatePedido && (
                  <Button variant="command" onClick={() => { setActiveSection("Pedidos"); window.requestAnimationFrame(() => document.getElementById("crear-pedido")?.scrollIntoView({ behavior: "smooth" })); }}>
                    <FilePlus2 className="h-4 w-4" />
                    Nuevo pedido
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => signOut()}>
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </Button>
              </div>
            </div>
          </header>

          <div className={`grid gap-6 p-5 md:p-8 ${["Dashboard", "Pedidos"].includes(activeSection) && canCreatePedido ? "xl:grid-cols-[1fr_360px]" : ""}`}>
            <div id="panel-operativo" className="space-y-6">
              {activeSection === "Dashboard" && (
                <>
                  <section className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: "Total pedidos en curso", value: totalEnCurso, icon: PackageCheck },
                      { label: "Pedidos atrasados", value: totalAtrasados, icon: AlertTriangle },
                      { label: "% Cumplimiento", value: `${cumplimientoPct}%`, icon: CheckCircle2 },
                      { label: "Pedidos sin OC", value: ordersWithoutOc.length, icon: ClipboardList },
                    ].map((metric, index) => (
                      <article key={metric.label} className="animate-rise-in rounded-md border bg-card p-5 shadow-command transition hover:-translate-y-1" style={{ animationDelay: `${index * 80}ms` }}>
                        <div className="flex items-center justify-between">
                          <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                            <metric.icon className="h-5 w-5" />
                          </div>
                          <span className="text-3xl font-semibold">{metric.value}</span>
                        </div>
                        <p className="mt-4 text-sm font-medium text-muted-foreground">{metric.label}</p>
                      </article>
                    ))}
                  </section>

                  <section className="rounded-md border bg-card shadow-command">
                    <div className="border-b p-5">
                      <h3 className="text-lg font-semibold">🚨 Pedidos atrasados</h3>
                      <p className="text-sm text-muted-foreground">Top 5 con mayor cantidad de días de atraso.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Proveedor</th>
                            <th className="px-5 py-3 font-semibold">numero_oc_qubigo</th>
                            <th className="px-5 py-3 font-semibold">Días de atraso</th>
                            <th className="px-5 py-3 font-semibold">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {overdueOrders.map(({ order, diasAtraso }) => (
                            <tr key={order.id} className="transition hover:bg-surface-subtle/70">
                              <td className="px-5 py-4">{order.supplier || "-"}</td>
                              <td className="px-5 py-4 text-primary">{order.ocNumber || "-"}</td>
                              <td className="px-5 py-4"><span className="inline-flex rounded-md border bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive border-destructive/30">{diasAtraso} días</span></td>
                              <td className="px-5 py-4"><Button size="sm" variant="outline" type="button" onClick={() => { setSelectedOrderId(order.id); setActiveSection("Pedidos"); }}>Ver pedido</Button></td>
                            </tr>
                          ))}
                          {overdueOrders.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>Sin pedidos atrasados.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-md border bg-card shadow-command">
                    <div className="border-b p-5">
                      <h3 className="text-lg font-semibold">⏳ Próximas entregas</h3>
                      <p className="text-sm text-muted-foreground">Pedidos con entrega en los próximos 3 días.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Proveedor</th>
                            <th className="px-5 py-3 font-semibold">fecha_estimada</th>
                            <th className="px-5 py-3 font-semibold">numero_oc_qubigo</th>
                            <th className="px-5 py-3 font-semibold">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {upcomingDeliveries.map((order) => (
                            <tr key={order.id} className="transition hover:bg-surface-subtle/70">
                              <td className="px-5 py-4">{order.supplier || "-"}</td>
                              <td className="px-5 py-4">{formatDate(order.eta) || "-"}</td>
                              <td className="px-5 py-4 text-primary">{order.ocNumber || "-"}</td>
                              <td className="px-5 py-4"><Button size="sm" variant="outline" type="button" onClick={() => { setSelectedOrderId(order.id); setActiveSection("Pedidos"); }}>Ver pedido</Button></td>
                            </tr>
                          ))}
                          {upcomingDeliveries.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>Sin entregas en los próximos 3 días.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-md border bg-card shadow-command">
                    <div className="border-b p-5">
                      <h3 className="text-lg font-semibold">⚠ Pedidos sin OC</h3>
                      <p className="text-sm text-muted-foreground">Pedidos cargados sin número de OC asignado.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[640px] text-left text-sm">
                        <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-5 py-3 font-semibold">Pedido</th>
                            <th className="px-5 py-3 font-semibold">Proveedor</th>
                            <th className="px-5 py-3 font-semibold">Cliente</th>
                            <th className="px-5 py-3 font-semibold">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {ordersWithoutOc.slice(0, 10).map((order) => (
                            <tr key={order.id} className="transition hover:bg-surface-subtle/70">
                              <td className="px-5 py-4 font-medium">{order.orderNumber}</td>
                              <td className="px-5 py-4">{order.supplier || "-"}</td>
                              <td className="px-5 py-4">{order.cliente || "-"}</td>
                              <td className="px-5 py-4"><Button size="sm" variant="outline" type="button" onClick={() => { setSelectedOrderId(order.id); setActiveSection("Pedidos"); }}>Abrir</Button></td>
                            </tr>
                          ))}
                          {ordersWithoutOc.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>Todos los pedidos tienen OC.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </>
              )}

              {activeSection === "Alertas" && <section id="alertas" className="rounded-md border bg-card shadow-command">
                <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Alertas</h3>
                    <p className="text-sm text-muted-foreground">Alertas vinculadas a pedidos y proveedores.</p>
                  </div>
                  <span className="rounded-md border bg-surface-subtle px-3 py-1 text-sm font-semibold text-muted-foreground">{filteredAlertas.length}</span>
                </div>
                <div className="grid gap-3 border-b p-5 md:grid-cols-6">
                  <select value={alertaEstadoFilter} onChange={(event) => setAlertaEstadoFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los estados</option>{alertaEstadoOptions.map((estado) => <option key={estado} value={estado}>{estado}</option>)}</select>
                  <select value={alertaTipoFilter} onChange={(event) => setAlertaTipoFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los tipos</option>{alertaTipoOptions.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}</select>
                  <select value={alertaProveedorFilter} onChange={(event) => setAlertaProveedorFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los proveedores</option>{alertaProveedorOptions.map((proveedor) => <option key={proveedor} value={proveedor}>{proveedor}</option>)}</select>
                  <select value={alertaVendedorFilter} onChange={(event) => setAlertaVendedorFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los vendedores</option>{alertaVendedorOptions.map((vendedor) => <option key={vendedor} value={vendedor}>{vendedor}</option>)}</select>
                  <Button type="button" variant={onlyExpiredAlertas ? "command" : "outline"} onClick={() => setOnlyExpiredAlertas((current) => !current)}>Vencidas</Button>
                  <Button type="button" variant={onlyUpcomingAlertas ? "command" : "outline"} onClick={() => setOnlyUpcomingAlertas((current) => !current)}>Próximas</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">proveedor</th><th className="px-5 py-3 font-semibold">cliente</th><th className="px-5 py-3 font-semibold">numero_pedido</th><th className="px-5 py-3 font-semibold">numero_oc_qubigo</th><th className="px-5 py-3 font-semibold">tipo</th><th className="px-5 py-3 font-semibold">fecha_estimada</th><th className="px-5 py-3 font-semibold">fecha_aviso</th><th className="px-5 py-3 font-semibold">estado</th><th className="px-5 py-3 font-semibold">urgencia</th><th className="px-5 py-3 font-semibold">days_remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!isLoading && filteredAlertas.map((alerta) => {
                        const urgency = getAlertaUrgency(alerta.fechaEstimada, alerta.fechaAviso);
                        return (
                        <tr key={alerta.id} className="transition hover:bg-surface-subtle/70">
                          <td className="px-5 py-4">{alerta.proveedor}</td><td className="px-5 py-4">{alerta.cliente}</td><td className="px-5 py-4 font-medium">{alerta.numeroPedido}</td><td className="px-5 py-4 text-primary">{alerta.numeroOcQubigo}</td><td className="px-5 py-4">{alerta.tipo}</td><td className="px-5 py-4">{formatDate(alerta.fechaEstimada)}</td><td className="px-5 py-4">{formatDate(alerta.fechaAviso)}</td><td className="px-5 py-4"><span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${getAlertaPriorityClass(alerta)}`}>{alerta.estado}</span></td><td className="px-5 py-4"><span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${urgency.className}`}>{urgency.label}</span></td><td className="px-5 py-4 font-semibold">{alerta.daysRemaining ?? "-"}</td>
                        </tr>
                        );
                      })}
                      {!isLoading && filteredAlertas.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={10}>No hay alertas para mostrar.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </section>}

              {activeSection === "Cotizaciones" && canSeeCotizaciones && <Cotizaciones />}

              {activeSection === "Pedidos" && <section className="rounded-md border bg-card shadow-command">
                <div className="flex flex-col gap-4 border-b p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Listado de pedidos</h3>
                    <p className="text-sm text-muted-foreground">{isLoading ? "Cargando pedidos desde Supabase..." : "Pedidos desde Supabase con proveedor, estado, OC y entrega estimada."}</p>
                  </div>
                  <div className="relative md:w-80">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido u OC" className="pl-9" />
                  </div>
                </div>
                <div className="space-y-3 border-b p-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    <select value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los vendedores</option>{sellerOptions.map((seller) => <option key={seller} value={seller}>{seller}</option>)}</select>
                    <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="todos">Todos los proveedores</option>{supplierOptions.map((supplier) => <option key={supplier} value={supplier}>{supplier}</option>)}</select>
                    <Button type="button" variant={onlyWithoutOc ? "command" : "outline"} onClick={() => setOnlyWithoutOc((current) => !current)}>Sin OC</Button>
                    <Button type="button" variant={onlyMyActiveOrders ? "command" : "outline"} onClick={() => setOnlyMyActiveOrders((current) => !current)}>Mis pedidos en curso</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground">Estado:</span>
                    {["pedido_cargado", "en_curso", "recibido_parcial", "terminado", "anulado"].map((estado) => {
                      const active = statusFilters.includes(estado);
                      return (
                        <Button key={estado} type="button" size="sm" variant={active ? "command" : "outline"} onClick={() => setStatusFilters((current) => current.includes(estado) ? current.filter((s) => s !== estado) : [...current, estado])}>{estado}</Button>
                      );
                    })}
                    <Button type="button" size="sm" variant={statusFilters.length === 5 ? "command" : "outline"} onClick={() => setStatusFilters(["pedido_cargado", "en_curso", "recibido_parcial", "terminado", "anulado"])}>Ver todos</Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setStatusFilters(defaultStatusFilters)}>Restablecer</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Proveedor</th>
                        <th className="px-5 py-3 font-semibold">Estado</th>
                        <th className="px-5 py-3 font-semibold">numero_oc_qubigo</th>
                        <th className="px-5 py-3 font-semibold">fecha_estimada_entrega</th>
                        {canSendMessages && <th className="px-5 py-3 font-semibold">WhatsApp</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!isLoading && filteredOrders.map((order) => (
                        <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`cursor-pointer transition hover:bg-surface-subtle/70 ${selectedOrderId === order.id ? "bg-surface-subtle" : ""}`}>
                          <td className="px-5 py-4">{order.supplier}</td>
                          <td className="px-5 py-4"><span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(order.rawStatus, order.ocNumber)}`}>{order.rawStatus === "pedido_cargado" && (!order.ocNumber || order.ocNumber === "-") ? "pendiente sin OC" : order.rawStatus}</span></td>
                          <td className="px-5 py-4 font-medium text-primary">{order.ocNumber}</td>
                          <td className="px-5 py-4">{formatDate(order.eta)}</td>
                          {canSendMessages && (
                            <td className="px-5 py-4">
                              <Button size="icon" variant="outline" type="button" onClick={(event) => { event.stopPropagation(); openWhatsAppMessage(order); }}>
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {!isLoading && filteredOrders.length === 0 && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={canSendMessages ? 5 : 4}>No hay pedidos para mostrar.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>}

              {activeSection === "Pedidos" && <section className="rounded-md border bg-card shadow-command">
                <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Detalle de pedido</h3>
                    <p className="text-sm text-muted-foreground">{selectedOrder ? `${selectedOrder.supplier} · ${selectedOrder.ocNumber}` : "Seleccioná un pedido para ver sus ítems."}</p>
                  </div>
                  {selectedOrder && (
                    <div className="flex flex-wrap gap-2">
                      {canSendMessages && (
                        <Button size="sm" variant="outline" type="button" onClick={openSellerMessage}>
                          <MessageCircle className="h-4 w-4" />
                          Mensaje vendedor
                        </Button>
                      )}
                      {canEditPedido && (
                        <Button size="sm" variant="outline" type="button" onClick={openEditOrder}>
                          <Pencil className="h-4 w-4" />
                          Editar pedido
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                {selectedOrder && (() => {
                  const proveedor = suppliers.find((s) => s.id === selectedOrder.supplierId) || null;
                  const hasContact = !!(proveedor && (proveedor.email || proveedor.telefono));
                  const phone = (proveedor?.telefono || "").replace(/\D/g, "");
                  return (
                    <div className="border-b bg-surface-subtle/40 p-5">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="font-semibold">Contacto del proveedor</h4>
                          {hasContact ? (
                            <p className="text-sm text-muted-foreground">
                              {proveedor?.nombre || "-"}
                              {proveedor?.email ? ` · ${proveedor.email}` : ""}
                              {proveedor?.telefono ? ` · ${proveedor.telefono}` : ""}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground">Proveedor sin datos de contacto</p>
                          )}
                        </div>
                        {canSendMessages && (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" variant="outline" type="button" disabled={!proveedor?.email} onClick={() => proveedor?.email && window.open(`mailto:${proveedor.email}`, "_blank", "noopener,noreferrer")}>
                              Enviar mail
                            </Button>
                            <Button size="sm" variant="outline" type="button" disabled={!phone} onClick={() => phone && window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer")}>
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">descripcion</th>
                        <th className="px-5 py-3 font-semibold">cantidad_pedida</th>
                        <th className="px-5 py-3 font-semibold">cantidad_recibida</th>
                        <th className="px-5 py-3 font-semibold">cantidad_pendiente</th>
                        {isAdmin && <th className="px-5 py-3 font-semibold">costo</th>}
                        {isAdmin && <th className="px-5 py-3 font-semibold">subtotal</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!isLoadingItems && pedidoItems.map((item) => {
                        const hasUpcomingAlert = item.cantidad_pendiente > 0 && upcomingAlertItemIds.has(item.id);

                        return (
                        <tr key={item.id} className={`transition hover:bg-surface-subtle/70 ${hasUpcomingAlert ? "bg-warning/20" : ""}`}>
                          <td className="px-5 py-4 font-medium">
                            <div className="flex items-center gap-2">
                              {hasUpcomingAlert && <AlertTriangle className="h-4 w-4 text-warning-foreground" />}
                              <span>{item.descripcion}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">{item.cantidad_pedida}</td>
                          <td className="px-5 py-4">{item.cantidad_recibida}</td>
                          <td className="px-5 py-4 font-medium text-primary">{item.cantidad_pendiente}</td>
                          {isAdmin && <td className="px-5 py-4">{item.costo_unitario ?? "-"} {item.moneda || "ARS"}</td>}
                          {isAdmin && <td className="px-5 py-4 font-semibold">{getItemSubtotal(item).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.moneda || "ARS"}</td>}
                        </tr>
                        );
                      })}
                      {!isLoadingItems && selectedOrder && pedidoItems.length === 0 && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={isAdmin ? 6 : 4}>Este pedido no tiene ítems cargados.</td>
                        </tr>
                      )}
                      {!selectedOrder && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={isAdmin ? 6 : 4}>No hay pedido seleccionado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {selectedOrder && (
                  <div className="border-t p-5">
                    {canAddRecepcion && pedidoItems.length > 0 && (
                      <div className="mb-4 rounded-md border bg-surface-subtle p-3 text-sm font-semibold">MONTO TOTAL OC: {totalOcAmount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {totalOcCurrency}</div>
                    )}
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Alertas del pedido</h4>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted-foreground">{pedidoAlertas.length}</span>
                        {canSendMessages && (
                          <Button size="sm" variant="outline" type="button" onClick={() => selectedOrder && openWhatsAppMessage(selectedOrder)}>
                            <MessageCircle className="h-4 w-4" />
                            WhatsApp
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {pedidoAlertas.map((alerta) => (
                        <div key={alerta.id} className={`rounded-md border p-3 ${getAlertaPriorityClass(alerta)}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{alerta.tipo}</p>
                            <span className="rounded-md border px-2 py-0.5 text-xs font-semibold">{alerta.estado}</span>
                          </div>
                          <p className="mt-1 text-sm">fecha_estimada: {formatDate(alerta.fecha_estimada)} · fecha_aviso: {formatDate(alerta.fecha_aviso)}</p>
                        </div>
                      ))}
                      {!isLoadingItems && pedidoAlertas.length === 0 && (
                        <div className="rounded-md bg-surface-subtle p-3 text-sm text-muted-foreground md:col-span-2">Sin alertas</div>
                      )}
                    </div>
                  </div>
                )}
                {selectedOrder && pedidoItems.length > 0 && canAddRecepcion && (
                  <form className="grid gap-4 border-t p-5 md:grid-cols-2 xl:grid-cols-5" onSubmit={addReception}>
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="reception-item">Ítem</Label>
                      <select id="reception-item" value={receptionForm.itemId} onChange={(event) => setReceptionForm({ ...receptionForm, itemId: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {pedidoItems.map((item) => <option key={item.id} value={item.id}>{item.descripcion}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reception-quantity">Cantidad recibida</Label>
                      <Input id="reception-quantity" type="number" min="0" step="0.01" value={receptionForm.quantity} onChange={(event) => setReceptionForm({ ...receptionForm, quantity: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reception-date">Fecha recepción</Label>
                      <Input id="reception-date" type="date" value={receptionForm.date} onChange={(event) => setReceptionForm({ ...receptionForm, date: event.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reception-new-eta">Nueva entrega</Label>
                      <Input id="reception-new-eta" type="date" value={receptionForm.newEta} onChange={(event) => setReceptionForm({ ...receptionForm, newEta: event.target.value })} />
                    </div>
                    <div className="space-y-2 md:col-span-2 xl:col-span-4">
                      <Label htmlFor="reception-notes">Observaciones</Label>
                      <Input id="reception-notes" value={receptionForm.notes} onChange={(event) => setReceptionForm({ ...receptionForm, notes: event.target.value })} placeholder="Entrega parcial, remito o comentario" />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full" variant="command" type="submit" disabled={isSavingReception}>
                        <PackageCheck className="h-4 w-4" />
                        {isSavingReception ? "Cargando..." : "Agregar recepción"}
                      </Button>
                    </div>
                  </form>
                )}
              </section>}
            </div>

            {["Dashboard", "Pedidos"].includes(activeSection) && canCreatePedido && <aside className="space-y-6">
              <section id="crear-pedido" className="rounded-md border bg-card p-5 shadow-command">
                <div className="mb-5 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-command-gradient text-primary-foreground">
                    <FilePlus2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Crear pedido</h3>
                    <p className="text-sm text-muted-foreground">Alta rápida de una nueva OC.</p>
                  </div>
                </div>
                <form className="space-y-4" onSubmit={createOrder}>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Proveedor</Label>
                    <select id="supplier" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      {suppliers.map((supplier) => <option key={supplier.id || supplier.nombre} value={supplier.id}>{supplier.nombre}</option>)}
                    </select>
                  </div>

                  <div className="space-y-3 border-t pt-4">
                    <h4 className="font-semibold">Paso 1 · Requeridos</h4>
                    {itemForms.map((item, index) => (
                      <div key={index} className="space-y-3 rounded-md border bg-surface-subtle p-3">
                        <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Ítem {index + 1}</p><Button type="button" size="icon" variant="ghost" onClick={() => removeItemForm(index)} disabled={itemForms.length === 1}><Trash2 className="h-4 w-4" /></Button></div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                          <div className="space-y-2"><Label>descripcion</Label><Input ref={(element) => { itemDescriptionRefs.current[`create-${index}`] = element; }} value={item.descripcion} onChange={(event) => updateItemForm(index, "descripcion", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>cantidad_pedida</Label><Input type="number" min="0" step="0.01" value={item.cantidadPedida} onChange={(event) => updateItemForm(index, "cantidadPedida", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>unidad</Label><Input value={item.unidad} onChange={(event) => updateItemForm(index, "unidad", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>moneda</Label><Input value={item.moneda} onChange={(event) => updateItemForm(index, "moneda", event.target.value)} placeholder="ARS" /></div>
                        </div>
                      </div>
                    ))}
                    <Button type="button" size="sm" variant="outline" onClick={addItemForm}><Plus className="h-4 w-4" />Agregar ítem</Button>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                      <div className="space-y-2"><Label htmlFor="cliente">cliente</Label><Input id="cliente" value={form.cliente} onChange={(event) => setForm({ ...form, cliente: event.target.value })} required /></div>
                      <div className="space-y-2"><Label htmlFor="vendedor">vendedor</Label><Input id="vendedor" value={form.vendedor} onChange={(event) => setForm({ ...form, vendedor: event.target.value })} required /></div>
                      <div className="space-y-2"><Label htmlFor="plazo-cliente">plazo_entrega_cliente</Label><Input id="plazo-cliente" value={form.plazoEntregaCliente} onChange={(event) => setForm({ ...form, plazoEntregaCliente: event.target.value })} required /></div>
                    </div>
                  </div>

                  <details className="rounded-md border bg-surface-subtle p-3">
                    <summary className="cursor-pointer font-semibold">Paso 2 · Opcionales</summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                      {itemForms.map((item, index) => (
                        <div className="space-y-2" key={`costo-${index}`}><Label htmlFor={`costo-unitario-${index}`}>costo_unitario {itemForms.length > 1 ? `ítem ${index + 1}` : ""}</Label><Input id={`costo-unitario-${index}`} type="number" min="0" step="0.01" value={item.costoUnitario} onChange={(event) => updateItemForm(index, "costoUnitario", event.target.value)} /></div>
                      ))}
                      <div className="space-y-2"><Label htmlFor="numero-oc-cliente">numero_oc_cliente</Label><Input id="numero-oc-cliente" value={form.numeroOcCliente} onChange={(event) => setForm({ ...form, numeroOcCliente: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="plazo-proveedor">plazo_entrega_proveedor</Label><Input id="plazo-proveedor" value={form.plazoEntregaProveedor} onChange={(event) => setForm({ ...form, plazoEntregaProveedor: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="numero-oc-qubigo">numero_oc_qubigo</Label><Input id="numero-oc-qubigo" value={form.numeroOcQubigo} onChange={(event) => setForm({ ...form, numeroOcQubigo: event.target.value, estado: event.target.value.trim() && form.estado === "pedido_cargado" ? "en_curso" : form.estado })} /></div>
                      <div className="space-y-2">
                        <Label htmlFor="estado">estado</Label>
                        <select id="estado" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                          {pedidoEstados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2 md:col-span-2 xl:col-span-1"><Label htmlFor="observaciones">observaciones</Label><Textarea id="observaciones" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></div>
                      <div className="space-y-2"><Label htmlFor="condiciones-pago">condiciones_pago</Label><Input id="condiciones-pago" value={form.condicionesPago} onChange={(event) => setForm({ ...form, condicionesPago: event.target.value })} /></div>
                    </div>
                  </details>

                  <Button className="w-full" variant="command" type="submit" disabled={isSaving}>
                    <CheckCircle2 className="h-4 w-4" />
                    {isSaving ? "Guardando..." : "Guardar pedido"}
                  </Button>
                </form>
              </section>

              <section className="rounded-md border bg-card p-5 shadow-command">
                <h3 className="font-semibold">Próximas entregas</h3>
                <div className="mt-4 space-y-3">
                  {nextDeliveries.map((order) => (
                    <div key={order.id} className="rounded-md bg-surface-subtle p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{order.ocNumber}</p>
                        <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClasses[order.status]}`}>{order.status}</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{order.supplier} · {formatDate(order.eta)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>}
            {activeSection === "Proveedores" && (
              <section className="space-y-6">
                <div className="rounded-md border bg-card shadow-command">
                  <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between"><div><h3 className="text-lg font-semibold">Proveedores</h3><p className="text-sm text-muted-foreground">Datos cargados desde la tabla proveedores.</p></div><span className="rounded-md border bg-surface-subtle px-3 py-1 text-sm font-semibold text-muted-foreground">{suppliers.length}</span></div>
                  <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-surface-subtle text-xs uppercase text-muted-foreground"><tr><th className="px-5 py-3 font-semibold">nombre</th><th className="px-5 py-3 font-semibold">email</th><th className="px-5 py-3 font-semibold">telefono</th><th className="px-5 py-3 font-semibold">condicion_pago</th><th className="px-5 py-3 font-semibold">plazo_promedio_dias</th><th className="px-5 py-3 font-semibold">acciones</th></tr></thead><tbody className="divide-y">{suppliers.map((supplier) => (<tr key={supplier.id || supplier.nombre} className="transition hover:bg-surface-subtle/70"><td className="px-5 py-4 font-medium">{supplier.nombre || "-"}</td><td className="px-5 py-4">{supplier.email || "-"}</td><td className="px-5 py-4">{supplier.telefono || "-"}</td><td className="px-5 py-4">{supplier.condicion_pago || "-"}</td><td className="px-5 py-4">{supplier.plazo_promedio_dias ?? "-"}</td><td className="px-5 py-4"><Button type="button" size="sm" variant="outline" onClick={() => startEditSupplier(supplier)}><Pencil className="h-4 w-4" />Editar</Button></td></tr>))}</tbody></table></div>
                </div>
                <section className="rounded-md border bg-card p-5 shadow-command">
                  <h3 className="font-semibold">{editingSupplierId ? "Editar proveedor" : "Crear proveedor"}</h3>
                  <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={saveSupplier}>
                    <div className="space-y-2"><Label htmlFor="supplier-name">nombre</Label><Input id="supplier-name" value={supplierForm.nombre} onChange={(event) => setSupplierForm({ ...supplierForm, nombre: event.target.value })} required /></div>
                    <div className="space-y-2"><Label htmlFor="supplier-email">email</Label><Input id="supplier-email" type="email" value={supplierForm.email} onChange={(event) => setSupplierForm({ ...supplierForm, email: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="supplier-phone">telefono</Label><Input id="supplier-phone" value={supplierForm.telefono} onChange={(event) => setSupplierForm({ ...supplierForm, telefono: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="supplier-payment">condicion_pago</Label><Input id="supplier-payment" value={supplierForm.condicionPago} onChange={(event) => setSupplierForm({ ...supplierForm, condicionPago: event.target.value })} /></div>
                    <div className="space-y-2"><Label htmlFor="supplier-days">plazo_promedio_dias</Label><Input id="supplier-days" type="number" min="0" step="1" value={supplierForm.plazoPromedioDias} onChange={(event) => setSupplierForm({ ...supplierForm, plazoPromedioDias: event.target.value })} /></div>
                    <div className="flex items-end gap-3"><Button type="submit" variant="command" disabled={isSavingSupplier}>{isSavingSupplier ? "Guardando..." : editingSupplierId ? "Guardar cambios" : "Crear proveedor"}</Button>{editingSupplierId && <Button type="button" variant="outline" onClick={resetSupplierForm}>Cancelar</Button>}</div>
                  </form>
                </section>
              </section>
            )}
            {activeSection === "Reportes" && (
              <section className="space-y-6">
                <div className="rounded-md border bg-card p-5 shadow-command">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="font-semibold">Filtro de período</h3>
                      <p className="text-sm text-muted-foreground">Los reportes se calculan sobre pedidos.fecha del período seleccionado.</p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="report-mode">Modo</Label>
                        <select id="report-mode" value={reportFilterMode} onChange={(event) => setReportFilterMode(event.target.value as "mes" | "rango")} className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm">
                          <option value="mes">Mes</option>
                          <option value="rango">Rango personalizado</option>
                        </select>
                      </div>
                      {reportFilterMode === "mes" ? (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="report-month">Mes</Label>
                            <select id="report-month" value={reportMonth} onChange={(event) => setReportMonth(Number(event.target.value))} className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm">
                              {[
                                "Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
                              ].map((label, idx) => <option key={label} value={idx + 1}>{label}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="report-year">Año</Label>
                            <select id="report-year" value={reportYear} onChange={(event) => setReportYear(Number(event.target.value))} className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm">
                              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((y) => <option key={y} value={y}>{y}</option>)}
                            </select>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="report-desde">Desde</Label>
                            <Input id="report-desde" type="date" value={reportFechaDesde} onChange={(event) => setReportFechaDesde(event.target.value)} className="w-44" />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="report-hasta">Hasta</Label>
                            <Input id="report-hasta" type="date" value={reportFechaHasta} onChange={(event) => setReportFechaHasta(event.target.value)} className="w-44" />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-md border bg-card p-5 shadow-command"><h3 className="font-semibold">Pedidos by estado</h3><div className="mt-4 space-y-3">{ordersByStatusReport.map((item) => (<div key={item.estado} className="flex items-center justify-between rounded-md bg-surface-subtle p-3"><span>{item.estado}</span><strong>{item.count}</strong></div>))}{ordersByStatusReport.length === 0 && <p className="text-sm text-muted-foreground">Sin pedidos en el período.</p>}</div></div>
                  <div className="rounded-md border bg-card p-5 shadow-command"><h3 className="font-semibold">Pedidos without OC</h3><p className="mt-4 text-4xl font-semibold">{ordersWithoutOcReport}</p><p className="mt-1 text-sm text-muted-foreground">Pedidos en pedido_cargado sin numero_oc_qubigo (período seleccionado).</p></div>
                  <div className="rounded-md border bg-card p-5 shadow-command"><h3 className="font-semibold">Active alertas</h3><p className="mt-4 text-4xl font-semibold">{activeAlertasReport}</p><p className="mt-1 text-sm text-muted-foreground">Alertas activas asociadas a pedidos del período.</p></div>
                  <div className="rounded-md border bg-card p-5 shadow-command"><h3 className="font-semibold">Total purchase amount by proveedor</h3><div className="mt-4 space-y-3">{purchaseTotalsBySupplierReport.map((item) => (<div key={`${item.proveedor}-${item.moneda}`} className="flex items-center justify-between rounded-md bg-surface-subtle p-3"><span>{item.proveedor}</span><strong>{item.total.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.moneda}</strong></div>))}{purchaseTotalsBySupplierReport.length === 0 && <p className="text-sm text-muted-foreground">Sin costos unitarios cargados para el período.</p>}</div></div>
                </div>
              </section>
            )}
          </div>
        </section>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar pedido</DialogTitle>
          </DialogHeader>
          {isLoadingEdit ? (
            <p className="text-sm text-muted-foreground">Cargando datos del pedido...</p>
          ) : (
            <form className="space-y-5" onSubmit={saveEditOrder}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="edit-proveedor">proveedor_id</Label><select id="edit-proveedor" value={editForm.supplierId} onChange={(event) => setEditForm({ ...editForm, supplierId: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{suppliers.map((supplier) => <option key={supplier.id || supplier.nombre} value={supplier.id}>{supplier.nombre}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="edit-cliente">cliente</Label><Input id="edit-cliente" value={editForm.cliente} onChange={(event) => setEditForm({ ...editForm, cliente: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-oc-cliente">numero_oc_cliente</Label><Input id="edit-oc-cliente" value={editForm.numeroOcCliente} onChange={(event) => setEditForm({ ...editForm, numeroOcCliente: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-plazo-cliente">plazo_entrega_cliente</Label><Input id="edit-plazo-cliente" value={editForm.plazoEntregaCliente} onChange={(event) => setEditForm({ ...editForm, plazoEntregaCliente: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-plazo-proveedor">plazo_entrega_proveedor</Label><Input id="edit-plazo-proveedor" value={editForm.plazoEntregaProveedor} onChange={(event) => setEditForm({ ...editForm, plazoEntregaProveedor: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-vendedor">vendedor</Label><Input id="edit-vendedor" value={editForm.vendedor} onChange={(event) => setEditForm({ ...editForm, vendedor: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-condiciones">condiciones_pago</Label><Input id="edit-condiciones" value={editForm.condicionesPago} onChange={(event) => setEditForm({ ...editForm, condicionesPago: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-oc-qubigo">numero_oc_qubigo</Label><Input id="edit-oc-qubigo" value={editForm.numeroOcQubigo} onChange={(event) => setEditForm({ ...editForm, numeroOcQubigo: event.target.value, estado: event.target.value.trim() && editForm.estado === "pedido_cargado" ? "en_curso" : editForm.estado })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-estado">estado</Label><select id="edit-estado" value={editForm.estado} onChange={(event) => setEditForm({ ...editForm, estado: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{pedidoEstados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="edit-fecha-estimada">fecha_estimada_entrega</Label><Input id="edit-fecha-estimada" type="date" value={editForm.fechaEstimadaEntrega} onChange={(event) => setEditForm({ ...editForm, fechaEstimadaEntrega: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-mail">mail_vendedor</Label><Input id="edit-mail" type="email" value={editForm.mailVendedor} onChange={(event) => setEditForm({ ...editForm, mailVendedor: event.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="edit-observaciones">observaciones</Label><Textarea id="edit-observaciones" value={editForm.observaciones} onChange={(event) => setEditForm({ ...editForm, observaciones: event.target.value })} /></div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h4 className="font-semibold">Ítems del pedido</h4>
                {editItemForms.map((item, index) => (
                  <div key={item.id} className="grid gap-3 rounded-md border bg-surface-subtle p-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2"><Label>descripcion</Label><Input ref={(element) => { itemDescriptionRefs.current[item.id] = element; }} value={item.descripcion} onChange={(event) => updateEditItemForm(index, "descripcion", event.target.value)} /></div>
                    <div className="space-y-2"><Label>cantidad_pedida</Label><Input type="number" min="0" step="0.01" value={item.cantidadPedida} onChange={(event) => updateEditItemForm(index, "cantidadPedida", event.target.value)} /></div>
                    <div className="space-y-2"><Label>unidad</Label><Input value={item.unidad} onChange={(event) => updateEditItemForm(index, "unidad", event.target.value)} /></div>
                    <div className="space-y-2"><Label>moneda</Label><Input value={item.moneda} onChange={(event) => updateEditItemForm(index, "moneda", event.target.value)} placeholder="ARS" /></div>
                    <div className="space-y-2"><Label>costo_unitario</Label><Input type="number" min="0" step="0.01" value={item.costoUnitario} onChange={(event) => updateEditItemForm(index, "costoUnitario", event.target.value)} /></div>
                    <div className="space-y-2"><Label>cod_articulo</Label><Input value={item.codArticulo} onChange={(event) => updateEditItemForm(index, "codArticulo", event.target.value)} /></div>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={addEditItemForm}><Plus className="h-4 w-4" />Agregar ítem</Button>
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="command" disabled={isSavingEdit}>{isSavingEdit ? "Guardando..." : "Guardar cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isSellerMessageOpen} onOpenChange={setIsSellerMessageOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Mensaje vendedor</DialogTitle>
          </DialogHeader>
          <Textarea value={sellerMessage} onChange={(event) => setSellerMessage(event.target.value)} className="min-h-[420px] font-mono text-sm" />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsSellerMessageOpen(false)}>Cerrar</Button>
            <Button type="button" variant="command" onClick={copySellerMessage}>Copiar mensaje</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Index;
