import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ClipboardList, Factory, FilePlus2, LayoutDashboard, PackageCheck, Search } from "lucide-react";
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
  status: OrderStatus;
  ocNumber: string;
  eta: string;
  notes: string;
};

type PurchaseOrderRow = {
  id: number | string;
  numero_pedido: string;
  proveedor_id: string;
  proveedores?: { nombre: string } | { nombre: string }[] | null;
  estado: string;
  numero_oc_qubigo: string;
  fecha_estimada_entrega: string;
  observaciones: string | null;
};

type Supplier = {
  id: string;
  nombre: string;
};

const initialOrders: PurchaseOrder[] = [
  { id: 1, orderNumber: "PED-1048", supplier: "Metalúrgica Norte", supplierId: "", status: "En curso", ocNumber: "OC-77821", eta: "2026-05-03", notes: "Despacho parcial confirmado" },
  { id: 2, orderNumber: "PED-1049", supplier: "Global Parts", supplierId: "", status: "Atrasado", ocNumber: "OC-77834", eta: "2026-04-22", notes: "Pendiente respuesta proveedor" },
  { id: 3, orderNumber: "PED-1050", supplier: "Insumos Delta", supplierId: "", status: "Confirmado", ocNumber: "OC-77859", eta: "2026-05-08", notes: "Entrega en planta central" },
  { id: 4, orderNumber: "PED-1051", supplier: "Tecno Industrial", supplierId: "", status: "Entregado", ocNumber: "OC-77866", eta: "2026-04-25", notes: "Recepción sin novedades" },
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

const mapOrderFromSupabase = (order: PurchaseOrderRow): PurchaseOrder => ({
  id: order.id,
  orderNumber: order.numero_pedido,
  supplier: Array.isArray(order.proveedores) ? order.proveedores[0]?.nombre || "Sin proveedor" : order.proveedores?.nombre || "Sin proveedor",
  supplierId: order.proveedor_id,
  status: normalizeStatus(order.estado, order.fecha_estimada_entrega),
  ocNumber: order.numero_oc_qubigo,
  eta: order.fecha_estimada_entrega,
  notes: order.observaciones || "Sin observaciones",
});

const Index = () => {
  const [orders, setOrders] = useState(initialOrders);
  const [suppliers, setSuppliers] = useState<Supplier[]>(fallbackSuppliers);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ supplierId: "", ocNumber: "", eta: "", notes: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadOrders = async () => {
      const [{ data: suppliersData, error: suppliersError }, { data, error }] = await Promise.all([
        supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre", { ascending: true }),
        supabase
          .from("pedidos")
          .select("id, numero_pedido, proveedor_id, proveedores(nombre), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
          .order("fecha_estimada_entrega", { ascending: true }),
      ]);

      if (suppliersError || error) {
        toast({
          title: "No se pudieron cargar pedidos desde Supabase",
          description: "Verificá los permisos de lectura de pedidos y proveedores.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const activeSuppliers = suppliersData || [];
      setSuppliers(activeSuppliers.length > 0 ? activeSuppliers : fallbackSuppliers);
      setForm((current) => ({ ...current, supplierId: activeSuppliers[0]?.id || "" }));
      setOrders(((data || []) as PurchaseOrderRow[]).map(mapOrderFromSupabase));
      setIsLoading(false);
    };

    loadOrders();
  }, []);

  const filteredOrders = useMemo(
    () => orders.filter((order) => `${order.orderNumber} ${order.supplier} ${order.ocNumber} ${order.status}`.toLowerCase().includes(query.toLowerCase())),
    [orders, query],
  );

  const nextDeliveries = orders.filter((order) => order.status !== "Entregado").slice(0, 3);

  const metrics = [
    { label: "Pedidos en curso", value: orders.filter((order) => order.status === "En curso" || order.status === "Confirmado").length, icon: PackageCheck },
    { label: "Pedidos atrasados", value: orders.filter((order) => order.status === "Atrasado").length, icon: AlertTriangle },
    { label: "Próximas entregas", value: nextDeliveries.length, icon: CalendarClock },
  ];

  const createOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.supplierId || !form.ocNumber || !form.eta) return;

    setIsSaving(true);
    const nextOrderNumber = `PED-${1048 + orders.length}`;

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
      .select("id, numero_pedido, proveedor_id, proveedores(nombre), estado, numero_oc_qubigo, fecha_estimada_entrega, observaciones")
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

    if (data) setOrders((current) => [mapOrderFromSupabase(data as PurchaseOrderRow), ...current]);
    setForm({ supplierId: suppliers[0]?.id || "", ocNumber: "", eta: "", notes: "" });
    setIsSaving(false);
    toast({ title: "Pedido guardado", description: "La OC quedó registrada en pedidos." });
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
                    <p className="text-sm text-muted-foreground">{isLoading ? "Cargando pedidos desde Supabase..." : "Seguimiento centralizado por proveedor, estado y OC."}</p>
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
                        <th className="px-5 py-3 font-semibold">Número de pedido</th>
                        <th className="px-5 py-3 font-semibold">Proveedor</th>
                        <th className="px-5 py-3 font-semibold">Estado</th>
                        <th className="px-5 py-3 font-semibold">Número de OC</th>
                        <th className="px-5 py-3 font-semibold">Entrega estimada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {!isLoading && filteredOrders.map((order) => (
                        <tr key={order.id} className="transition hover:bg-surface-subtle/70">
                          <td className="px-5 py-4 font-medium">{order.orderNumber}</td>
                          <td className="px-5 py-4">{order.supplier}</td>
                          <td className="px-5 py-4"><span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClasses[order.status]}`}>{order.status}</span></td>
                          <td className="px-5 py-4 font-medium text-primary">{order.ocNumber}</td>
                          <td className="px-5 py-4">{formatDate(order.eta)}</td>
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