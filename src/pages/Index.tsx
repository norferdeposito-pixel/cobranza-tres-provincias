import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Factory, FilePlus2, LayoutDashboard, MessageCircle, PackageCheck, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
};

type PurchaseOrderRow = {
  id: number | string;
  numero_pedido: string;
  proveedor_id: string;
  proveedores?: { nombre: string; telefono: string | null } | { nombre: string; telefono: string | null }[] | null;
  estado: string;
  numero_oc_qubigo: string;
  fecha_estimada_entrega: string;
  observaciones: string | null;
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
};

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

const isUpcomingDueDate = (date: string) => {
  const current = new Date(`${today()}T00:00:00`);
  const dueDate = new Date(`${date}T00:00:00`);
  const sevenDaysFromNow = new Date(current);
  sevenDaysFromNow.setDate(current.getDate() + 7);

  return dueDate >= current && dueDate <= sevenDaysFromNow;
};

const initialOrders: PurchaseOrder[] = [
  { id: 1, orderNumber: "PED-1048", supplier: "Metalúrgica Norte", supplierId: "", supplierPhone: "", status: "En curso", rawStatus: "en_curso", ocNumber: "OC-77821", eta: "2026-05-03", notes: "Despacho parcial confirmado" },
  { id: 2, orderNumber: "PED-1049", supplier: "Global Parts", supplierId: "", supplierPhone: "", status: "Atrasado", rawStatus: "atrasado", ocNumber: "OC-77834", eta: "2026-04-22", notes: "Pendiente respuesta proveedor" },
  { id: 3, orderNumber: "PED-1050", supplier: "Insumos Delta", supplierId: "", supplierPhone: "", status: "Confirmado", rawStatus: "confirmado", ocNumber: "OC-77859", eta: "2026-05-08", notes: "Entrega en planta central" },
  { id: 4, orderNumber: "PED-1051", supplier: "Tecno Industrial", supplierId: "", supplierPhone: "", status: "Entregado", rawStatus: "entregado", ocNumber: "OC-77866", eta: "2026-04-25", notes: "Recepción sin novedades" },
];

const fallbackSuppliers: Supplier[] = [
  { id: "", nombre: "Metalúrgica Norte" },
  { id: "", nombre: "Global Parts" },
  { id: "", nombre: "Insumos Delta" },
  { id: "", nombre: "Tecno Industrial" },
  { id: "", nombre: "Logística Andina" },
];

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

const formatDate = (date: string) => new Intl.DateTimeFormat("es", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));

const normalizeStatus = (status: string, eta: string): OrderStatus => {
  if (status === "cerrado" || status === "entregado") return "Entregado";
  if (new Date(`${eta}T12:00:00`) < new Date() && status !== "cerrado") return "Atrasado";
  if (status === "oc_generada" || status === "confirmado") return "Confirmado";
  return "En curso";
};

const normalizePhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, "");

const mapOrderFromSupabase = (order: PurchaseOrderRow): PurchaseOrder => ({
  id: order.id,
  orderNumber: order.numero_pedido,
  supplier: Array.isArray(order.proveedores) ? order.proveedores[0]?.nombre || "Sin proveedor" : order.proveedores?.nombre || "Sin proveedor",
  supplierPhone: Array.isArray(order.proveedores) ? order.proveedores[0]?.telefono || "" : order.proveedores?.telefono || "",
  supplierId: order.proveedor_id,
  status: normalizeStatus(order.estado, order.fecha_estimada_entrega),
  rawStatus: order.estado,
  ocNumber: order.numero_oc_qubigo,
  eta: order.fecha_estimada_entrega,
  notes: order.observaciones || "Sin observaciones",
});

const Index = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [suppliers, setSuppliers] = useState<Supplier[]>(fallbackSuppliers);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ orderNumber: "", supplierId: "", ocNumber: "", eta: "", notes: "" });
  const [selectedOrderId, setSelectedOrderId] = useState<string | number | null>(null);
  const [pedidoItems, setPedidoItems] = useState<PedidoItem[]>([]);
  const [pedidoAlertas, setPedidoAlertas] = useState<PedidoAlerta[]>([]);
  const [dashboardAlertasCount, setDashboardAlertasCount] = useState(0);
  const [receptionForm, setReceptionForm] = useState({ itemId: "", quantity: "", date: today(), newEta: "", notes: "" });
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingReception, setIsSavingReception] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      const [{ data: suppliersData, error: suppliersError }, { data, error }, { data: alertasData, error: alertasError }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre, telefono").eq("activo", true).order("nombre", { ascending: true }),
        supabase
          .from("pedidos")
          .select("id, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
          .order("fecha_estimada_entrega", { ascending: true }),
        supabase.from("alertas").select("id, fecha_aviso, estado"),
      ]);

      if (suppliersError || error || alertasError) {
        toast({
          title: "No se pudieron cargar pedidos desde Supabase",
          description: "Verificá los permisos de lectura de pedidos, proveedores y alertas.",
          variant: "destructive",
        });
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
      const [{ data, error }, { data: alertasData, error: alertasError }] = await Promise.all([
        supabase
          .from("pedido_items")
          .select("id, descripcion, cantidad_pedida, cantidad_recibida, cantidad_pendiente")
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
  }, [selectedOrderId]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => `${order.orderNumber} ${order.supplier} ${order.ocNumber} ${order.status}`.toLowerCase().includes(query.toLowerCase())),
    [orders, query],
  );

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) || null;
  const upcomingAlertItemIds = new Set(
    pedidoAlertas
      .filter((alerta) => alerta.item_id && alerta.estado !== "resuelta" && alerta.fecha_aviso >= today())
      .map((alerta) => alerta.item_id),
  );

  const nextDeliveries = orders.filter((order) => order.status !== "Entregado").slice(0, 3);

  const metrics = [
    { label: "Total pedidos en curso", value: orders.filter((order) => order.rawStatus !== "cerrado" && order.rawStatus !== "entregado").length, icon: PackageCheck },
    { label: "Pedidos atrasados", value: orders.filter((order) => order.status === "Atrasado").length, icon: AlertTriangle },
    { label: "Alertas próximas a vencer", value: dashboardAlertasCount, icon: CalendarClock },
  ];

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.supplierId || !form.ocNumber || !form.eta) return;

    setIsSaving(true);
    const nextOrderNumber = form.orderNumber || `${orders.length + 1}`;

    const { data, error } = await supabase
      .from("pedidos")
      .insert({
        numero_pedido: nextOrderNumber,
        proveedor_id: form.supplierId,
        origen: "compras",
        estado: "oc_generada",
        numero_oc_qubigo: form.ocNumber,
        fecha_pedido: new Date().toISOString().slice(0, 10),
        fecha_estimada_entrega: form.eta,
        observaciones: form.notes || "Sin observaciones",
      })
        .select("id, numero_pedido, proveedor_id, proveedores(nombre, telefono), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
      .maybeSingle();

    if (error) {
      toast({
        title: "No se pudo guardar el pedido",
        description: "Revisá los permisos de inserción de la tabla pedidos.",
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    if (data) {
      const createdOrder = mapOrderFromSupabase(data as PurchaseOrderRow);
      setOrders((current) => [createdOrder, ...current]);
      setSelectedOrderId(createdOrder.id);
    }
    setForm({ orderNumber: "", supplierId: suppliers[0]?.id || "", ocNumber: "", eta: "", notes: "" });
    setIsSaving(false);
    toast({ title: "Pedido guardado", description: "La OC quedó registrada en pedidos." });
  };

  const addReception = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedItem = pedidoItems.find((item) => item.id === receptionForm.itemId);
    const receivedQuantity = Number(receptionForm.quantity);

    if (!selectedOrderId || !selectedItem || !receivedQuantity || receivedQuantity <= 0) return;

    setIsSavingReception(true);
    const nextReceived = selectedItem.cantidad_recibida + receivedQuantity;
    const nextPending = Math.max(selectedItem.cantidad_pedida - nextReceived, 0);

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
                <div className="border-b p-5">
                  <h3 className="text-lg font-semibold">Detalle de pedido</h3>
                  <p className="text-sm text-muted-foreground">{selectedOrder ? `${selectedOrder.supplier} · ${selectedOrder.ocNumber}` : "Seleccioná un pedido para ver sus ítems."}</p>
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
                    <Label htmlFor="order-number">Número de pedido</Label>
                    <Input id="order-number" value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} placeholder="2" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Proveedor</Label>
                    <select id="supplier" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      {suppliers.map((supplier) => <option key={supplier.id || supplier.nombre} value={supplier.id}>{supplier.nombre}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="oc">Número de OC</Label>
                    <Input id="oc" value={form.ocNumber} onChange={(event) => setForm({ ...form, ocNumber: event.target.value })} placeholder="OC-77900" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eta">Fecha estimada de entrega</Label>
                    <Input id="eta" type="date" value={form.eta} onChange={(event) => setForm({ ...form, eta: event.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Observaciones</Label>
                    <Textarea id="notes" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Detalle de despacho, recepción o condición especial" />
                  </div>
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
    </main>
  );
};

export default Index;