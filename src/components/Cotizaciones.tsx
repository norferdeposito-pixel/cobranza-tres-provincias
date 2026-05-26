import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";
import { useCurrentUserProfile } from "@/contexts/UserProfileContext";

type Supplier = { id: string; nombre: string };

type ItemRow = {
  id: string;
  pedido_id: string;
  descripcion: string;
  cantidad_pedida: number;
  unidad: string | null;
  cod_articulo: string | null;
  costo_unitario: number | null;
  moneda: string | null;
  estado_cotizacion: string | null;
  pedidos?: { cliente: string | null; vendedor: string | null; numero_pedido: string | null } | { cliente: string | null; vendedor: string | null; numero_pedido: string | null }[] | null;
};

type Cotizacion = {
  id: string;
  item_id: string;
  proveedor_id: string;
  costo_unitario: number | null;
  moneda: string | null;
  condicion_pago: string | null;
  plazo_entrega_dias: number | null;
  observaciones: string | null;
  fecha_cotizacion: string | null;
  elegida: boolean;
  sugerida?: boolean;
  proveedores?: { nombre: string | null } | { nombre: string | null }[] | null;
};

type CotizacionForm = {
  proveedor_id: string;
  costo_unitario: string;
  moneda: string;
  condicion_pago: string;
  plazo_entrega_dias: string;
  observaciones: string;
  fecha_cotizacion: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (): CotizacionForm => ({
  proveedor_id: "",
  costo_unitario: "",
  moneda: "ARS",
  condicion_pago: "",
  plazo_entrega_dias: "",
  observaciones: "",
  fecha_cotizacion: today(),
});

const getProveedorNombre = (cot: Cotizacion, suppliers: Supplier[]) => {
  const fromJoin = Array.isArray(cot.proveedores) ? cot.proveedores[0]?.nombre : cot.proveedores?.nombre;
  if (fromJoin) return fromJoin;
  return suppliers.find((s) => s.id === cot.proveedor_id)?.nombre || "Sin proveedor";
};

const getPedidoMeta = (item: ItemRow) => {
  const p = Array.isArray(item.pedidos) ? item.pedidos[0] : item.pedidos;
  return { cliente: p?.cliente || "-", vendedor: p?.vendedor || "-", numeroPedido: p?.numero_pedido || "-" };
};

const computeEstado = (cots: Cotizacion[], current: string | null | undefined) => {
  if (current === "enviado_a_pedido" || current === "anulado") return current;
  if (cots.length === 0) return "pendiente_cotizacion";
  if (cots.some((c) => c.elegida)) return "proveedor_elegido";
  return "cotizado_parcialmente";
};

const estadoBadge: Record<string, string> = {
  pendiente_cotizacion: "bg-warning/20 text-warning-foreground border-warning/40",
  cotizado_parcialmente: "bg-secondary text-secondary-foreground border-border",
  proveedor_elegido: "bg-success/15 text-success border-success/30",
  enviado_a_pedido: "bg-primary/15 text-primary border-primary/30",
  anulado: "bg-muted text-muted-foreground border-border",
};

export const Cotizaciones = () => {
  const { currentUserProfile } = useCurrentUserProfile();
  const rol = (currentUserProfile?.rol || "").toLowerCase();
  const isAdmin = rol === "admin" || rol === "compras";

  const [items, setItems] = useState<ItemRow[]>([]);
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ itemId: string; cotId: string | null } | null>(null);
  const [form, setForm] = useState<CotizacionForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<number>(0);
  const [filterYear, setFilterYear] = useState<number>(now.getFullYear());
  const [statusFilter, setStatusFilter] = useState("todos");

  const loadAll = async () => {
    setLoading(true);
    const [itemsRes, cotsRes, suppRes] = await Promise.all([
      supabase
        .from("pedido_items")
        .select("id, pedido_id, descripcion, cantidad_pedida, unidad, cod_articulo, costo_unitario, moneda, estado_cotizacion, pedidos(cliente, vendedor, numero_pedido)")
        .order("created_at", { ascending: false }),
      supabase
        .from("cotizaciones_items" as any)
        .select("id, item_id, proveedor_id, costo_unitario, moneda, condicion_pago, plazo_entrega_dias, observaciones, fecha_cotizacion, elegida, sugerida, proveedores(nombre)"),
      supabase.from("proveedores").select("id, nombre").eq("activo", true).order("nombre"),
    ]);
    if (itemsRes.error || cotsRes.error || suppRes.error) {
      toast({ title: "Error cargando cotizaciones", description: itemsRes.error?.message || cotsRes.error?.message || suppRes.error?.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setItems((itemsRes.data || []) as any);
    setCotizaciones((cotsRes.data || []) as any);
    setSuppliers((suppRes.data || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const cotsByItem = useMemo(() => {
    const map = new Map<string, Cotizacion[]>();
    cotizaciones.forEach((c) => {
      const arr = map.get(c.item_id) || [];
      arr.push(c);
      map.set(c.item_id, arr);
    });
    return map;
  }, [cotizaciones]);

  const itemsToShow = useMemo(() => {
    return items.filter((it) => {
      const cots = cotsByItem.get(it.id) || [];
      // Solo mostrar items que fueron explícitamente enviados a cotizar
      if (!it.estado_cotizacion && cots.length === 0) return false;
      const estado = computeEstado(cots, it.estado_cotizacion);
      if (estado === "anulado") return false;
      if (statusFilter !== "todos" && estado !== statusFilter) return false;
      if (filterMonth === 0) return true;
      if (cots.length === 0) return false;
      return cots.some((cot) => {
        const fecha = cot.fecha_cotizacion || "";
        const [year, month] = fecha.split("-").map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
        return year === filterYear && month === filterMonth;
      });
    });
  }, [items, cotsByItem, filterMonth, filterYear, statusFilter]);

  const openNew = (itemId: string) => {
    setEditing({ itemId, cotId: null });
    setForm(emptyForm());
  };

  const openEdit = (cot: Cotizacion) => {
    setEditing({ itemId: cot.item_id, cotId: cot.id });
    setForm({
      proveedor_id: cot.proveedor_id || "",
      costo_unitario: cot.costo_unitario != null ? String(cot.costo_unitario) : "",
      moneda: cot.moneda || "ARS",
      condicion_pago: cot.condicion_pago || "",
      plazo_entrega_dias: cot.plazo_entrega_dias != null ? String(cot.plazo_entrega_dias) : "",
      observaciones: cot.observaciones || "",
      fecha_cotizacion: cot.fecha_cotizacion || today(),
    });
  };

  const closeDialog = () => {
    setEditing(null);
    setForm(emptyForm());
  };

  const saveCotizacion = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!form.proveedor_id || !form.costo_unitario || !form.moneda || !form.plazo_entrega_dias) {
      toast({ title: "Faltan datos", description: "Proveedor, costo, moneda y plazo son obligatorios.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: any = {
      item_id: editing.itemId,
      proveedor_id: form.proveedor_id,
      costo_unitario: Number(form.costo_unitario),
      moneda: form.moneda,
      condicion_pago: form.condicion_pago || null,
      plazo_entrega_dias: Number(form.plazo_entrega_dias),
      observaciones: form.observaciones || null,
      fecha_cotizacion: form.fecha_cotizacion || today(),
    };
    const res = editing.cotId
      ? await supabase.from("cotizaciones_items" as any).update(payload).eq("id", editing.cotId)
      : await supabase.from("cotizaciones_items" as any).insert({ ...payload, elegida: false });
    setSaving(false);
    if (res.error) {
      toast({ title: "Error al guardar", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing.cotId ? "Cotización actualizada" : "Cotización agregada" });
    closeDialog();
    await loadAll();
    await syncEstadoItem(editing.itemId);
  };

  const syncEstadoItem = async (itemId: string) => {
    const { data } = await supabase.from("cotizaciones_items" as any).select("elegida").eq("item_id", itemId);
    const arr = (data || []) as any[];
    const item = items.find((i) => i.id === itemId);
    const nuevo = computeEstado(arr.map((a) => ({ elegida: !!a.elegida })) as any, item?.estado_cotizacion);
    await supabase.from("pedido_items").update({ estado_cotizacion: nuevo } as any).eq("id", itemId);
  };

  const elegirProveedor = async (cot: Cotizacion) => {
    if (!isAdmin) return;
    // Desmarcar todas
    const { error: e1 } = await supabase
      .from("cotizaciones_items" as any)
      .update({ elegida: false })
      .eq("item_id", cot.item_id);
    if (e1) {
      toast({ title: "Error", description: e1.message, variant: "destructive" });
      return;
    }
    const { error: e2 } = await supabase
      .from("cotizaciones_items" as any)
      .update({ elegida: true })
      .eq("id", cot.id);
    if (e2) {
      toast({ title: "Error", description: e2.message, variant: "destructive" });
      return;
    }
    toast({ title: "Proveedor elegido" });
    await loadAll();
    await syncEstadoItem(cot.item_id);
  };

  const eliminarCotizacion = async (cot: Cotizacion) => {
    if (!isAdmin) return;
    if (!confirm("¿Eliminar esta cotización?")) return;
    const { error } = await supabase.from("cotizaciones_items" as any).delete().eq("id", cot.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Cotización eliminada" });
    await loadAll();
    await syncEstadoItem(cot.item_id);
  };

  const enviarAPedido = async (item: ItemRow) => {
    if (!isAdmin) return;
    const cots = cotsByItem.get(item.id) || [];
    const elegida = cots.find((c) => c.elegida);
    if (!elegida) {
      toast({ title: "Sin proveedor elegido", variant: "destructive" });
      return;
    }
    const meta = getPedidoMeta(item);
    const proveedorElegido = getProveedorNombre(elegida, suppliers);

    if (item.estado_cotizacion === "enviado_a_pedido") {
      const detalleItem = item.descripcion?.trim() || item.cod_articulo?.trim() || "Articulo sin descripcion";
      const observacionCotizacion = [
        "Cotizacion enviada a pedido.",
        `Item: ${detalleItem}.`,
        `Proveedor elegido: ${proveedorElegido}.`,
        elegida.observaciones ? `Obs. cotizacion: ${elegida.observaciones}` : "",
      ].filter(Boolean).join(" ");
      const { data: pedidoActual } = await supabase
        .from("pedidos")
        .select("observaciones")
        .eq("id", item.pedido_id)
        .maybeSingle();
      const observacionesPedido = [
        (pedidoActual as any)?.observaciones || "",
        observacionCotizacion,
      ].filter(Boolean).join("\n");
      const { error: pedidoError } = await supabase
        .from("pedidos")
        .update({
          proveedor_id: elegida.proveedor_id,
          plazo_entrega_proveedor: elegida.plazo_entrega_dias != null ? `${elegida.plazo_entrega_dias} dias` : null,
          condiciones_pago: elegida.condicion_pago,
          observaciones: observacionesPedido,
        })
        .eq("id", item.pedido_id);
      if (pedidoError) {
        toast({ title: "Error al actualizar pedido", description: pedidoError.message, variant: "destructive" });
        return;
      }
      const { error: itemError } = await supabase
        .from("pedido_items")
        .update({
          costo_unitario: elegida.costo_unitario,
          moneda: elegida.moneda || "ARS",
          estado_cotizacion: "enviado_a_pedido",
        } as any)
        .eq("id", item.id);
      if (itemError) {
        toast({ title: "Error al actualizar item", description: itemError.message, variant: "destructive" });
        return;
      }
      toast({ title: "Pedido actualizado", description: `Se actualizo el pedido ${meta.numeroPedido}.` });
      await loadAll();
      return;
    }

    const getElegida = (row: ItemRow) => (cotsByItem.get(row.id) || []).find((cot) => cot.elegida);
    const itemsAgrupados = items.filter((row) => {
      if (row.pedido_id !== item.pedido_id) return false;
      if (row.estado_cotizacion === "enviado_a_pedido") return false;
      const elegidaRow = getElegida(row);
      return elegidaRow?.proveedor_id === elegida.proveedor_id;
    });
    const itemsParaPedido = itemsAgrupados.length > 0 ? itemsAgrupados : [item];
    const numero = `COT-${Date.now().toString().slice(-6)}`;
    const observacionesPedido = [
      `Pedido creado desde cotizaciones. Pedido origen: ${meta.numeroPedido}.`,
      `Proveedor elegido: ${proveedorElegido}.`,
      `Items incluidos: ${itemsParaPedido.map((row) => row.descripcion?.trim() || row.cod_articulo?.trim() || "Articulo sin descripcion").join("; ")}.`,
    ].join("\n");
    const { data: pedido, error: pedidoError } = await supabase
      .from("pedidos")
      .insert({
        fecha: today(),
        numero_pedido: numero,
        proveedor_id: elegida.proveedor_id,
        cliente: meta.cliente !== "-" ? meta.cliente : "",
        vendedor: meta.vendedor !== "-" ? meta.vendedor : "",
        plazo_entrega_cliente: "",
        plazo_entrega_proveedor: elegida.plazo_entrega_dias != null ? `${elegida.plazo_entrega_dias} dias` : null,
        condiciones_pago: elegida.condicion_pago,
        observaciones: observacionesPedido,
        estado: "pedido_cargado",
      })
      .select("id")
      .maybeSingle();
    if (pedidoError) {
      toast({ title: "Error al crear pedido", description: pedidoError.message, variant: "destructive" });
      return;
    }
    const nuevoPedidoId = (pedido as any)?.id;
    if (!nuevoPedidoId) {
      toast({ title: "Error al crear pedido", description: "No se pudo obtener el pedido creado.", variant: "destructive" });
      return;
    }
    const itemsInsert = itemsParaPedido.map((row) => {
      const cot = getElegida(row) || elegida;
      return {
        pedido_id: nuevoPedidoId,
        descripcion: row.descripcion?.trim() || row.cod_articulo?.trim() || "Articulo sin descripcion",
        cantidad_pedida: row.cantidad_pedida,
        cantidad_recibida: 0,
        cantidad_pendiente: row.cantidad_pedida,
        unidad: row.unidad,
        cod_articulo: row.cod_articulo,
        costo_unitario: cot.costo_unitario,
        moneda: cot.moneda || "ARS",
        estado_entrega: "pendiente",
      };
    });
    const { error: insertItemsError } = await supabase.from("pedido_items").insert(itemsInsert as any);
    if (insertItemsError) {
      toast({ title: "Error al copiar items", description: insertItemsError.message, variant: "destructive" });
      return;
    }
    const idsAgrupados = itemsParaPedido.map((row) => row.id);
    const { error: itemError } = await supabase
      .from("pedido_items")
      .update({
        estado_cotizacion: "enviado_a_pedido",
      } as any)
      .in("id", idsAgrupados);
    if (itemError) {
      toast({ title: "Pedido creado con aviso", description: itemError.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pedido agrupado creado", description: `${itemsParaPedido.length} item(s) para ${proveedorElegido}. Pedido ${numero}.` });
    await loadAll();
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Cargando cotizaciones...</p>;
  }

  return (
    <section className="rounded-md border bg-card shadow-command">
      <div className="flex flex-col gap-4 border-b px-5 py-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cotizaciones</h3>
          <p className="text-sm text-muted-foreground">Ítems cotizados e historial de envíos a pedido.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cotizacion-mes">Mes</Label>
            <select id="cotizacion-mes" value={filterMonth} onChange={(event) => setFilterMonth(Number(event.target.value))} className="flex h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value={0}>Todos</option>
              {["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"].map((label, index) => (
                <option key={label} value={index + 1}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cotizacion-anio">Año</Label>
            <select id="cotizacion-anio" value={filterYear} onChange={(event) => setFilterYear(Number(event.target.value))} className="flex h-10 w-28 rounded-md border border-input bg-background px-3 py-2 text-sm">
              {Array.from({ length: 6 }, (_, i) => now.getFullYear() - 3 + i).map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="cotizacion-estado">Estado</Label>
            <select id="cotizacion-estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="todos">Todos los estados</option>
              <option value="pendiente_cotizacion">Pendiente</option>
              <option value="cotizado_parcialmente">Cotizado</option>
              <option value="proveedor_elegido">Proveedor elegido</option>
              <option value="enviado_a_pedido">Enviado a pedido</option>
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y">
        {itemsToShow.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay ítems de cotización para mostrar.</p>
        )}
        {itemsToShow.map((item) => {
          const cots = cotsByItem.get(item.id) || [];
          const estado = computeEstado(cots, item.estado_cotizacion);
          const elegida = cots.find((c) => c.elegida);
          const meta = getPedidoMeta(item);
          const isExpanded = expanded === item.id;
          const itemBg = estado === "proveedor_elegido" ? "bg-success/5" : estado === "enviado_a_pedido" ? "bg-primary/5" : estado === "pendiente_cotizacion" ? "bg-warning/5" : "";

          return (
            <div key={item.id} className={`p-5 ${itemBg}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="font-semibold">{item.descripcion?.trim() || item.cod_articulo?.trim() || "Articulo sin descripcion"}</p>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${estadoBadge[estado] || ""}`}>{estado}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.cantidad_pedida} {item.unidad || "u"} · Pedido {meta.numeroPedido} · Cliente: {meta.cliente} · Vendedor: {meta.vendedor}
                  </p>
                  <p className="text-xs">
                    {cots.length} cotización{cots.length === 1 ? "" : "es"} · {elegida ? <span className="font-semibold text-success">Elegido: {getProveedorNombre(elegida, suppliers)}</span> : <span className="text-muted-foreground">Sin proveedor elegido</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <Button size="sm" variant="outline" type="button" onClick={() => openNew(item.id)}>
                      <Plus className="h-4 w-4" /> Nueva cotización
                    </Button>
                  )}
                  {isAdmin && elegida && (
                    <Button size="sm" variant="command" type="button" onClick={() => enviarAPedido(item)}>
                      <Send className="h-4 w-4" /> {estado === "enviado_a_pedido" ? "Actualizar pedido" : "Enviar a pedido"}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" type="button" onClick={() => setExpanded(isExpanded ? null : item.id)}>
                    {isExpanded ? "Ocultar" : "Ver cotizaciones"}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Proveedor</th>
                        <th className="px-4 py-2 text-left">Precio</th>
                        <th className="px-4 py-2 text-left">Moneda</th>
                        <th className="px-4 py-2 text-left">Plazo (días)</th>
                        <th className="px-4 py-2 text-left">Cond. pago</th>
                        <th className="px-4 py-2 text-left">Observaciones</th>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cots.length === 0 && (
                        <tr><td className="px-4 py-3 text-muted-foreground" colSpan={8}>Sin cotizaciones cargadas.</td></tr>
                      )}
                      {cots.map((cot) => (
                        <tr key={cot.id} className={cot.elegida ? "bg-success/10" : cot.sugerida ? "bg-warning/5" : ""}>
                          <td className="px-4 py-2 font-medium">
                            {getProveedorNombre(cot, suppliers)}
                            {cot.sugerida && <span className="ml-2 inline-flex items-center rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground">Proveedor sugerido</span>}
                            {cot.elegida && <span className="ml-2 inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />elegida</span>}
                          </td>
                          <td className="px-4 py-2">{cot.costo_unitario ?? "-"}</td>
                          <td className="px-4 py-2">{cot.moneda || "-"}</td>
                          <td className="px-4 py-2">{cot.plazo_entrega_dias ?? "-"}</td>
                          <td className="px-4 py-2">{cot.condicion_pago || "-"}</td>
                          <td className="px-4 py-2">{cot.observaciones || "-"}</td>
                          <td className="px-4 py-2">{cot.fecha_cotizacion || "-"}</td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              {isAdmin && !cot.elegida && (
                                <Button size="sm" variant="outline" type="button" onClick={() => elegirProveedor(cot)}>
                                  <Check className="h-3 w-3" /> Elegir
                                </Button>
                              )}
                              {isAdmin && (
                                <Button size="sm" variant="ghost" type="button" onClick={() => openEdit(cot)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button size="sm" variant="ghost" type="button" onClick={() => eliminarCotizacion(cot)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.cotId ? "Editar cotización" : "Nueva cotización"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveCotizacion} className="space-y-3">
            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <select required value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Seleccionar</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Costo unitario *</Label>
                <Input required type="number" step="0.01" value={form.costo_unitario} onChange={(e) => setForm({ ...form, costo_unitario: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Moneda *</Label>
                <select required value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Plazo entrega (días) *</Label>
                <Input required type="number" value={form.plazo_entrega_dias} onChange={(e) => setForm({ ...form, plazo_entrega_dias: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Fecha cotización</Label>
                <Input type="date" value={form.fecha_cotizacion} onChange={(e) => setForm({ ...form, fecha_cotizacion: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Condición de pago</Label>
              <Input value={form.condicion_pago} onChange={(e) => setForm({ ...form, condicion_pago: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeDialog}>Cancelar</Button>
              <Button type="submit" variant="command" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
