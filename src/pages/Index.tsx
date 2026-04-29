import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Factory, FilePlus2, LayoutDashboard, MessageCircle, PackageCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

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
  telefono?: string | null;
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

const isValidDateValue = (date?: string | null) => {
  if (!date) return false;
  const parsedDate = new Date(`${date}T12:00:00`);
  return !Number.isNaN(parsedDate.getTime());
};

const isUpcomingDueDate = (date: string) => {
  if (!isValidDateValue(date)) return false;
  const current = new Date(`${today()}T00:00:00`);
  const dueDate = new Date(`${date}T00:00:00`);
  const sevenDaysFromNow = new Date(current);
  sevenDaysFromNow.setDate(current.getDate() + 7);

  return dueDate >= current && dueDate <= sevenDaysFromNow;
};

const initialOrders: PurchaseOrder[] = [
  { id: 1, orderNumber: "PED-1048", supplier: "Metalúrgica Norte", supplierId: "", supplierPhone: "", status: "En curso", rawStatus: "en_curso", ocNumber: "OC-77821", eta: "2026-05-03", notes: "Despacho parcial confirmado", cliente: "Planta Norte", vendedor: "María", fecha: "2026-04-20" },
  { id: 2, orderNumber: "PED-1049", supplier: "Global Parts", supplierId: "", supplierPhone: "", status: "Atrasado", rawStatus: "pedido_cargado", ocNumber: "-", eta: "2026-04-22", notes: "Pendiente respuesta proveedor", cliente: "Mantenimiento", vendedor: "Juan", fecha: "2026-04-18" },
  { id: 3, orderNumber: "PED-1050", supplier: "Insumos Delta", supplierId: "", supplierPhone: "", status: "Confirmado", rawStatus: "confirmado", ocNumber: "OC-77859", eta: "2026-05-08", notes: "Entrega en planta central", cliente: "Producción", vendedor: "María", fecha: "2026-04-21" },
  { id: 4, orderNumber: "PED-1051", supplier: "Tecno Industrial", supplierId: "", supplierPhone: "", status: "Entregado", rawStatus: "terminado", ocNumber: "OC-77866", eta: "2026-04-25", notes: "Recepción sin novedades", cliente: "Calidad", vendedor: "Sofía", fecha: "2026-04-16" },
];

const fallbackSuppliers: Supplier[] = [
  { id: "demo-metalurgica-norte", nombre: "Metalúrgica Norte", telefono: "+54 9 11 5555-1001" },
  { id: "demo-global-parts", nombre: "Global Parts", telefono: "+54 9 11 5555-1002" },
  { id: "demo-insumos-delta", nombre: "Insumos Delta", telefono: "+54 9 11 5555-1003" },
  { id: "demo-tecno-industrial", nombre: "Tecno Industrial", telefono: "+54 9 11 5555-1004" },
  { id: "demo-logistica-andina", nombre: "Logística Andina", telefono: "+54 9 11 5555-1005" },
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
  const currentStatus = optionalValue(estado || "") || "pedido_cargado";
  const protectedStatuses = ["terminado", "anulado", "recibido_total", "recibido_parcial"];
  if (optionalValue(numeroOcQubigo) && currentStatus === "pedido_cargado" && !protectedStatuses.includes(currentStatus)) return "en_curso";
  return currentStatus;
};

const getPedidoLifecycleStatus = (items: PedidoItem[], currentStatus?: string) => {
  if (currentStatus === "anulado") return "anulado";
  if (items.length > 0 && items.every((item) => Number(item.cantidad_pendiente) <= 0)) return "terminado";
  if (items.some((item) => Number(item.cantidad_recibida) > 0)) return "recibido_parcial";
  return "en_curso";
};

const getItemSubtotal = (item: PedidoItem) => Number(item.cantidad_pedida || 0) * Number(item.costo_unitario || 0);

const formatDate = (date?: string | null) => {
  if (!isValidDateValue(date)) return "-";
  return new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
};

const normalizeStatus = (status: string, eta: string): OrderStatus => {
  if (status === "cerrado" || status === "entregado" || status === "terminado" || status === "recibido_total") return "Entregado";
  if (isValidDateValue(eta) && new Date(`${eta}T12:00:00`) < new Date() && status !== "cerrado") return "Atrasado";
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

const optionalValue = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const optionalDateValue = (value: string) => isValidDateValue(value) ? value : null;

const generateOrderNumber = () => `PED-${Date.now()}`;

const getSellerEmail = (seller: string, explicitEmail: string) => {
  const trimmedEmail = explicitEmail.trim();
  if (trimmedEmail) return trimmedEmail;
  const trimmedSeller = seller.trim();
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
  supplierId: order.proveedor_id,
  status: normalizeStatus(order.estado, order.fecha_estimada_entrega || ""),
  rawStatus: order.estado,
  ocNumber: order.numero_oc_qubigo || "-",
  eta: order.fecha_estimada_entrega || "",
  notes: order.observaciones || "Sin observaciones",
  cliente: order.cliente || "-",
  vendedor: order.vendedor || "-",
  fecha: order.fecha || "",
});

const Index = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [suppliers, setSuppliers] = useState<Supplier[]>(fallbackSuppliers);
  const [query, setQuery] = useState("");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [supplierFilter, setSupplierFilter] = useState("todos");
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
  const [sellerMessage, setSellerMessage] = useState("");
  const [isSellerMessageOpen, setIsSellerMessageOpen] = useState(false);
  const [editForm, setEditForm] = useState<PedidoForm>(() => createEmptyOrderForm());
  const [editItemForms, setEditItemForms] = useState<PedidoItemEditForm[]>([]);
  const itemDescriptionRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const isAdmin = true;
  const currentSeller = "María";

  useEffect(() => {
    const loadOrders = async () => {
      const [{ data: suppliersData, error: suppliersError }, { data, error }, { data: alertasData, error: alertasError }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre, telefono").eq("activo", true).order("nombre", { ascending: true }),
        supabase
          .from("pedidos")
          .select("id, fecha, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones, cliente, vendedor")
          .order("fecha_estimada_entrega", { ascending: true }),
        supabase.from("alertas").select("id, fecha_aviso, estado"),
      ]);

      if (suppliersError || error || alertasError) {
        toast({
          title: "Preview interactivo activado",
          description: "No se pudo conectar con la base remota, se usan datos demo editables.",
        });
        setIsPreviewMode(true);
        setSuppliers(fallbackSuppliers);
        setForm((current) => ({ ...current, supplierId: fallbackSuppliers[0]?.id || "" }));
        setOrders(initialOrders);
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
      setDashboardAlertasCount((alertasData || []).filter((alerta) => alerta.estado !== "resuelta" && isUpcomingDueDate(alerta.fecha_aviso)).length);
      setSelectedOrderId(mappedOrders[0]?.id || null);
      setIsLoading(false);
    };

    loadOrders();
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
  const filteredOrders = useMemo(
    () => orders.filter((order) => {
      const withoutOc = order.rawStatus === "pedido_cargado" && (!order.ocNumber || order.ocNumber === "-");
      const matchesSearch = `${order.orderNumber} ${order.supplier} ${order.ocNumber} ${order.status} ${order.vendedor}`.toLowerCase().includes(query.toLowerCase());
      const matchesSeller = sellerFilter === "todos" || order.vendedor === sellerFilter;
      const matchesStatus = statusFilter === "todos" || order.rawStatus === statusFilter;
      const matchesSupplier = supplierFilter === "todos" || order.supplier === supplierFilter;
      const matchesWithoutOc = !onlyWithoutOc || withoutOc;
      const matchesMyActive = !onlyMyActiveOrders || (order.vendedor === currentSeller && ["en_curso", "recibido_parcial"].includes(order.rawStatus));
      return matchesSearch && matchesSeller && matchesStatus && matchesSupplier && matchesWithoutOc && matchesMyActive;
    }),
    [orders, query, sellerFilter, statusFilter, supplierFilter, onlyWithoutOc, onlyMyActiveOrders],
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

  const updateItemForm = (index: number, field: keyof PedidoItemForm, value: string) => {
    setItemForms((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const addItemForm = () => setItemForms((current) => [...current, createEmptyItemForm()]);

  const removeItemForm = (index: number) => setItemForms((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index));

  const updateEditItemForm = (index: number, field: keyof PedidoItemForm, value: string) => {
    setEditItemForms((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
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
    const validItems = itemForms.filter((item) => item.descripcion.trim() && Number(item.cantidadPedida) > 0 && item.unidad.trim());
    if (!form.supplierId || !form.cliente.trim() || !form.vendedor.trim() || !form.plazoEntregaCliente.trim() || validItems.length === 0) return;

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
        cliente: form.cliente.trim(),
        vendedor: form.vendedor.trim(),
        fecha: form.fecha,
      };
      const createdItems: PedidoItem[] = validItems.map((item, index) => ({
        id: `${createdOrder.id}-item-${index + 1}`,
        descripcion: item.descripcion,
        cantidad_pedida: Number(item.cantidadPedida),
        cantidad_recibida: 0,
        cantidad_pendiente: Number(item.cantidadPedida),
        unidad: item.unidad.trim(),
        costo_unitario: Number(item.costoUnitario) || undefined,
        moneda: optionalValue(item.moneda) || "ARS",
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

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        fecha: optionalValue(form.fecha),
        numero_pedido: nextOrderNumber,
        proveedor_id: form.supplierId,
        cliente: form.cliente.trim(),
        numero_oc_cliente: optionalValue(form.numeroOcCliente),
        numero_oc_qubigo: optionalValue(form.numeroOcQubigo),
        plazo_entrega_cliente: form.plazoEntregaCliente.trim(),
        plazo_entrega_proveedor: optionalValue(form.plazoEntregaProveedor),
        vendedor: form.vendedor.trim(),
        observaciones: optionalValue(form.observaciones),
        condiciones_pago: optionalValue(form.condicionesPago),
        estado: nextStatus,
        mail_vendedor: nextSellerEmail,
      })
      .select("id, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
      .maybeSingle();

    if (error) {
      toast({
        title: "No se pudo guardar el pedido",
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
        descripcion: item.descripcion.trim(),
        cantidad_pedida: Number(item.cantidadPedida),
        cantidad_recibida: 0,
        cantidad_pendiente: Number(item.cantidadPedida),
        unidad: item.unidad.trim(),
        costo_unitario: item.costoUnitario.trim() ? Number(item.costoUnitario) : null,
        moneda: optionalValue(item.moneda) || "ARS",
      }));
      const { data: createdItems, error: itemsError } = await supabase
        .from("pedido_items")
        .insert(itemsToInsert)
        .select("id, descripcion, cantidad_pedida, cantidad_recibida, cantidad_pendiente, unidad, costo_unitario, moneda, cod_articulo");

      if (itemsError) {
        toast({ title: "Pedido guardado, pero no se guardaron los ítems", description: itemsError.message, variant: "destructive" });
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
    const nextStatus = optionalValue(editForm.estado) || "pedido_cargado";
    const nextEta = optionalDateValue(editForm.fechaEstimadaEntrega);
    const nextItems = editItemForms.map((item) => {
      const ordered = Number(item.cantidadPedida) || 0;
      const original = pedidoItems.find((current) => current.id === item.id);
      const received = original?.cantidad_recibida || 0;
      return {
        ...original,
        id: item.id,
        descripcion: item.descripcion.trim(),
        cantidad_pedida: ordered,
        cantidad_recibida: received,
        cantidad_pendiente: Math.max(ordered - received, 0),
        unidad: item.unidad.trim(),
        costo_unitario: item.costoUnitario.trim() ? Number(item.costoUnitario) : undefined,
        moneda: optionalValue(item.moneda) || "ARS",
        cod_articulo: optionalValue(item.codArticulo) || undefined,
      } as PedidoItem;
    });

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
      } : order));
      setPedidoItems(nextItems);
      setPreviewItemsByOrderId((current) => ({ ...current, [String(selectedOrder.id)]: nextItems }));
      setIsSavingEdit(false);
      setIsEditOpen(false);
      toast({ title: "Pedido actualizado en preview", description: "Los cambios se aplicaron localmente." });
      return;
    }

    const { data, error } = await supabase
      .from("pedidos")
      .update({
        proveedor_id: editForm.supplierId,
        cliente: editForm.cliente.trim(),
        numero_oc_cliente: optionalValue(editForm.numeroOcCliente),
        plazo_entrega_cliente: optionalValue(editForm.plazoEntregaCliente),
        plazo_entrega_proveedor: optionalValue(editForm.plazoEntregaProveedor),
        vendedor: editForm.vendedor.trim(),
        observaciones: optionalValue(editForm.observaciones),
        condiciones_pago: optionalValue(editForm.condicionesPago),
        numero_oc_qubigo: optionalValue(editForm.numeroOcQubigo),
        estado: nextStatus,
        fecha_estimada_entrega: nextEta,
        mail_vendedor: getSellerEmail(editForm.vendedor, editForm.mailVendedor),
      })
      .eq("id", selectedOrder.id)
      .select("id, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
      .maybeSingle();

    if (error) {
      toast({ title: "No se pudo actualizar el pedido", description: error.message, variant: "destructive" });
      setIsSavingEdit(false);
      return;
    }

    for (const item of editItemForms) {
      const ordered = Number(item.cantidadPedida) || 0;
      const original = pedidoItems.find((current) => current.id === item.id);
      const received = original?.cantidad_recibida || 0;
      const { error: itemError } = await supabase
        .from("pedido_items")
        .update({
          descripcion: item.descripcion.trim(),
          cantidad_pedida: ordered,
          cantidad_pendiente: Math.max(ordered - received, 0),
          unidad: item.unidad.trim(),
          moneda: optionalValue(item.moneda) || "ARS",
          costo_unitario: item.costoUnitario.trim() ? Number(item.costoUnitario) : null,
          cod_articulo: optionalValue(item.codArticulo),
        })
        .eq("id", item.id);

      if (itemError) {
        toast({ title: "Pedido actualizado, pero falló un ítem", description: itemError.message, variant: "destructive" });
        setIsSavingEdit(false);
        return;
      }
    }

    if (data) setOrders((current) => current.map((order) => order.id === selectedOrder.id ? mapOrderFromSupabase(data as PurchaseOrderRow) : order));
    setPedidoItems(nextItems);
    setIsSavingEdit(false);
    setIsEditOpen(false);
    toast({ title: "Pedido actualizado", description: "Los cambios fueron guardados." });
  };

  const addReception = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedItem = pedidoItems.find((item) => item.id === receptionForm.itemId);
    const receivedQuantity = Number(receptionForm.quantity);

    if (!selectedOrderId || !selectedItem || !receivedQuantity || receivedQuantity <= 0) return;

    setIsSavingReception(true);
    const nextReceived = selectedItem.cantidad_recibida + receivedQuantity;
    const nextPending = Math.max(selectedItem.cantidad_pedida - nextReceived, 0);

    if (isPreviewMode) {
      setPedidoItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, cantidad_recibida: nextReceived, cantidad_pendiente: nextPending } : item));
      setReceptionForm((current) => ({ ...current, quantity: "", date: today(), newEta: "", notes: "" }));
      setIsSavingReception(false);
      toast({ title: "Recepción cargada en preview", description: "Las cantidades se actualizaron localmente." });
      return;
    }

    const { error: receptionError } = await supabase.from("recepciones").insert({
      pedido_id: selectedOrderId,
      item_id: selectedItem.id,
      fecha_recepcion: receptionForm.date,
      cantidad_recibida: receivedQuantity,
      nueva_fecha_entrega: receptionForm.newEta || null,
      observaciones: receptionForm.notes || "Recepción cargada desde OC Control",
    });

    if (receptionError) {
      toast({ title: "No se pudo guardar la recepción", description: "Revisá los permisos de inserción de recepciones.", variant: "destructive" });
      setIsSavingReception(false);
      return;
    }

    const { error: itemError } = await supabase
      .from("pedido_items")
      .update({ cantidad_recibida: nextReceived, cantidad_pendiente: nextPending })
      .eq("id", selectedItem.id);

    if (itemError) {
      toast({ title: "Recepción guardada, pero no se actualizó el ítem", description: "Revisá los permisos de actualización de pedido_items.", variant: "destructive" });
      setIsSavingReception(false);
      return;
    }

    setPedidoItems((current) => current.map((item) => item.id === selectedItem.id ? { ...item, cantidad_recibida: nextReceived, cantidad_pendiente: nextPending } : item));
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
            {navItems.map((item, index) => (
              <button key={item.label} className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition hover:bg-sidebar-accent ${index === 0 ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/78"}`}>
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
                <h2 className="mt-1 text-2xl font-semibold md:text-3xl">Panel operativo de pedidos</h2>
              </div>
              <Button variant="command" onClick={() => document.getElementById("crear-pedido")?.scrollIntoView({ behavior: "smooth" })}>
                <FilePlus2 className="h-4 w-4" />
                Nuevo pedido
              </Button>
            </div>
          </header>

          <div className="grid gap-6 p-5 md:p-8 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-3">
                {metrics.map((metric, index) => (
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
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">Proveedor</th>
                        <th className="px-5 py-3 font-semibold">Estado</th>
                        <th className="px-5 py-3 font-semibold">numero_oc_qubigo</th>
                        <th className="px-5 py-3 font-semibold">fecha_estimada_entrega</th>
                        <th className="px-5 py-3 font-semibold">WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!isLoading && filteredOrders.map((order) => (
                        <tr key={order.id} onClick={() => setSelectedOrderId(order.id)} className={`cursor-pointer transition hover:bg-surface-subtle/70 ${selectedOrderId === order.id ? "bg-surface-subtle" : ""}`}>
                          <td className="px-5 py-4">{order.supplier}</td>
                          <td className="px-5 py-4"><span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClasses[order.status]}`}>{order.rawStatus}</span></td>
                          <td className="px-5 py-4 font-medium text-primary">{order.ocNumber}</td>
                          <td className="px-5 py-4">{formatDate(order.eta)}</td>
                          <td className="px-5 py-4">
                            <Button size="icon" variant="outline" type="button" onClick={(event) => { event.stopPropagation(); openWhatsAppMessage(order); }}>
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!isLoading && filteredOrders.length === 0 && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>No hay pedidos para mostrar.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border bg-card shadow-command">
                <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">Detalle de pedido</h3>
                    <p className="text-sm text-muted-foreground">{selectedOrder ? `${selectedOrder.supplier} · ${selectedOrder.ocNumber}` : "Seleccioná un pedido para ver sus ítems."}</p>
                  </div>
                  {isAdmin && selectedOrder && (
                    <Button size="sm" variant="outline" type="button" onClick={openEditOrder}>
                      <Pencil className="h-4 w-4" />
                      Editar pedido
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-5 py-3 font-semibold">descripcion</th>
                        <th className="px-5 py-3 font-semibold">cantidad_pedida</th>
                        <th className="px-5 py-3 font-semibold">cantidad_recibida</th>
                        <th className="px-5 py-3 font-semibold">cantidad_pendiente</th>
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
                        </tr>
                        );
                      })}
                      {!isLoadingItems && selectedOrder && pedidoItems.length === 0 && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>Este pedido no tiene ítems cargados.</td>
                        </tr>
                      )}
                      {!selectedOrder && (
                        <tr>
                          <td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>No hay pedido seleccionado.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {selectedOrder && (
                  <div className="border-t p-5">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Alertas del pedido</h4>
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border bg-surface-subtle px-2.5 py-1 text-xs font-semibold text-muted-foreground">{pedidoAlertas.length}</span>
                        <Button size="sm" variant="outline" type="button" onClick={() => selectedOrder && openWhatsAppMessage(selectedOrder)}>
                          <MessageCircle className="h-4 w-4" />
                          WhatsApp
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {pedidoAlertas.map((alerta) => (
                        <div key={alerta.id} className={`rounded-md border p-3 ${alerta.fecha_aviso >= today() && alerta.estado !== "resuelta" ? "bg-warning/20 border-warning/30" : "bg-surface-subtle"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{alerta.tipo}</p>
                            <span className="rounded-md border px-2 py-0.5 text-xs font-semibold">{alerta.estado}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">Aviso: {formatDate(alerta.fecha_aviso)}{alerta.fecha_estimada ? ` · Estimada: ${formatDate(alerta.fecha_estimada)}` : ""}</p>
                        </div>
                      ))}
                      {!isLoadingItems && pedidoAlertas.length === 0 && (
                        <div className="rounded-md bg-surface-subtle p-3 text-sm text-muted-foreground md:col-span-2">Este pedido no tiene alertas.</div>
                      )}
                    </div>
                  </div>
                )}
                {selectedOrder && pedidoItems.length > 0 && (
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
              </section>
            </div>

            <aside className="space-y-6">
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
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold">Paso 1 · Requeridos</h4>
                      <Button type="button" size="sm" variant="outline" onClick={addItemForm}><Plus className="h-4 w-4" />Ítem</Button>
                    </div>
                    {itemForms.map((item, index) => (
                      <div key={index} className="space-y-3 rounded-md border bg-surface-subtle p-3">
                        <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium">Ítem {index + 1}</p><Button type="button" size="icon" variant="ghost" onClick={() => removeItemForm(index)} disabled={itemForms.length === 1}><Trash2 className="h-4 w-4" /></Button></div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                          <div className="space-y-2"><Label>descripcion</Label><Input value={item.descripcion} onChange={(event) => updateItemForm(index, "descripcion", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>cantidad_pedida</Label><Input type="number" min="0" step="0.01" value={item.cantidadPedida} onChange={(event) => updateItemForm(index, "cantidadPedida", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>unidad</Label><Input value={item.unidad} onChange={(event) => updateItemForm(index, "unidad", event.target.value)} required /></div>
                          <div className="space-y-2"><Label>moneda</Label><Input value={item.moneda} onChange={(event) => updateItemForm(index, "moneda", event.target.value)} placeholder="ARS" /></div>
                        </div>
                      </div>
                    ))}
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
                      <div className="space-y-2"><Label htmlFor="numero-oc-qubigo">numero_oc_qubigo</Label><Input id="numero-oc-qubigo" value={form.numeroOcQubigo} onChange={(event) => setForm({ ...form, numeroOcQubigo: event.target.value })} /></div>
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
            </aside>
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
                <div className="space-y-2"><Label htmlFor="edit-oc-qubigo">numero_oc_qubigo</Label><Input id="edit-oc-qubigo" value={editForm.numeroOcQubigo} onChange={(event) => setEditForm({ ...editForm, numeroOcQubigo: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-estado">estado</Label><select id="edit-estado" value={editForm.estado} onChange={(event) => setEditForm({ ...editForm, estado: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{pedidoEstados.map((estado) => <option key={estado} value={estado}>{estado}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor="edit-fecha-estimada">fecha_estimada_entrega</Label><Input id="edit-fecha-estimada" type="date" value={editForm.fechaEstimadaEntrega} onChange={(event) => setEditForm({ ...editForm, fechaEstimadaEntrega: event.target.value })} /></div>
                <div className="space-y-2"><Label htmlFor="edit-mail">mail_vendedor</Label><Input id="edit-mail" type="email" value={editForm.mailVendedor} onChange={(event) => setEditForm({ ...editForm, mailVendedor: event.target.value })} /></div>
                <div className="space-y-2 md:col-span-2"><Label htmlFor="edit-observaciones">observaciones</Label><Textarea id="edit-observaciones" value={editForm.observaciones} onChange={(event) => setEditForm({ ...editForm, observaciones: event.target.value })} /></div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <h4 className="font-semibold">Ítems del pedido</h4>
                {editItemForms.map((item, index) => (
                  <div key={item.id} className="grid gap-3 rounded-md border bg-surface-subtle p-3 md:grid-cols-3">
                    <div className="space-y-2 md:col-span-2"><Label>descripcion</Label><Input value={item.descripcion} onChange={(event) => updateEditItemForm(index, "descripcion", event.target.value)} /></div>
                    <div className="space-y-2"><Label>cantidad_pedida</Label><Input type="number" min="0" step="0.01" value={item.cantidadPedida} onChange={(event) => updateEditItemForm(index, "cantidadPedida", event.target.value)} /></div>
                    <div className="space-y-2"><Label>unidad</Label><Input value={item.unidad} onChange={(event) => updateEditItemForm(index, "unidad", event.target.value)} /></div>
                    <div className="space-y-2"><Label>moneda</Label><Input value={item.moneda} onChange={(event) => updateEditItemForm(index, "moneda", event.target.value)} placeholder="ARS" /></div>
                    <div className="space-y-2"><Label>costo_unitario</Label><Input type="number" min="0" step="0.01" value={item.costoUnitario} onChange={(event) => updateEditItemForm(index, "costoUnitario", event.target.value)} /></div>
                    <div className="space-y-2"><Label>cod_articulo</Label><Input value={item.codArticulo} onChange={(event) => updateEditItemForm(index, "codArticulo", event.target.value)} /></div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 border-t pt-4">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                <Button type="submit" variant="command" disabled={isSavingEdit}>{isSavingEdit ? "Guardando..." : "Guardar cambios"}</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default Index;