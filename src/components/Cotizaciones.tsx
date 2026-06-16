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
const upperText = (value?: string | number | null) => String(value ?? "").trim().toLocaleUpperCase("es-AR");

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

const getPriceDiff = (cot: Cotizacion, base?: Cotizacion | null) => {
  if (!base?.costo_unitario || !cot.costo_unitario) return { label: "-", className: "text-muted-foreground" };
  if ((cot.moneda || "").toUpperCase() !== (base.moneda || "").toUpperCase()) return { label: "-", className: "text-muted-foreground" };
  const diff = ((cot.costo_unitario - base.costo_unitario) / base.costo_unitario) * 100;
  const label = `${diff > 0 ? "+" : ""}${diff.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  if (Math.abs(diff) < 0.05) return { label: "0,0%", className: "text-muted-foreground" };
  return { label, className: diff > 0 ? "text-destructive" : "text-success" };
};

const formatMoney = (amount: number, currency: string) =>
  `${amount.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const formatSavingsPercent = (saving: number, highestTotal: number) =>
  highestTotal > 0
    ? `${((saving / highestTotal) * 100).toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
    : "0,0%";

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char] || char));

const getTotalSavingsDiff = (amount: number, maxAmount?: number | null) => {
  if (!maxAmount || !amount || maxAmount <= amount) return null;
  const diff = ((maxAmount - amount) / maxAmount) * 100;
  if (Math.abs(diff) < 0.05) return null;
  return `-${diff.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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
  const cotizacionesInReportPeriod = useMemo(() => {
    return cotizaciones.filter((cot) => {
      const fecha = cot.fecha_cotizacion || "";
      const [year, month] = fecha.split("-").map(Number);
      if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
      if (year !== filterYear) return false;
      if (filterMonth === 0) return true;
      return month === filterMonth;
    });
  }, [cotizaciones, filterMonth, filterYear]);
  const cotizacionesReport = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const totals = ["ARS", "USD"].reduce((acc, currency) => {
      acc[currency] = { totalCotizado: 0, totalElegido: 0, ahorro: 0 };
      return acc;
    }, {} as Record<string, { totalCotizado: number; totalElegido: number; ahorro: number }>);
    const detailRows = cotizacionesInReportPeriod.map((cot) => {
      const item = itemById.get(cot.item_id);
      const quantity = Number(item?.cantidad_pedida) || 0;
      const currency = upperText(cot.moneda) || "ARS";
      const total = quantity * (Number(cot.costo_unitario) || 0);
      return {
        pedido: item ? getPedidoMeta(item).numeroPedido : "-",
        cliente: item ? getPedidoMeta(item).cliente : "-",
        item: item?.descripcion || item?.cod_articulo || cot.item_id,
        proveedor: getProveedorNombre(cot, suppliers),
        cantidad: quantity,
        precio: Number(cot.costo_unitario) || 0,
        moneda: currency,
        total,
        elegida: cot.elegida ? "SI" : "NO",
        fecha: cot.fecha_cotizacion || "-",
      };
    });
    const periodCotsByItem = cotizacionesInReportPeriod.reduce((map, cot) => {
      const list = map.get(cot.item_id) || [];
      list.push(cot);
      map.set(cot.item_id, list);
      return map;
    }, new Map<string, Cotizacion[]>());
    const savingsRows: Array<{ pedido: string; item: string; moneda: string; proveedorElegido: string; totalMayor: number; totalElegido: number; ahorro: number }> = [];
    periodCotsByItem.forEach((list, itemId) => {
      const item = itemById.get(itemId);
      if (!item) return;
      const quantity = Number(item.cantidad_pedida) || 0;
      ["ARS", "USD"].forEach((currency) => {
        const sameCurrency = list.filter((cot) => upperText(cot.moneda) === currency && Number(cot.costo_unitario) > 0);
        const chosen = sameCurrency.find((cot) => cot.elegida);
        if (!chosen) return;
        const maxUnit = Math.max(...sameCurrency.map((cot) => Number(cot.costo_unitario) || 0));
        const chosenUnit = Number(chosen.costo_unitario) || 0;
        const ahorro = Math.max(maxUnit - chosenUnit, 0) * quantity;
        totals[currency].totalCotizado += maxUnit * quantity;
        totals[currency].totalElegido += chosenUnit * quantity;
        totals[currency].ahorro += ahorro;
        savingsRows.push({
          pedido: getPedidoMeta(item).numeroPedido,
          item: item.descripcion || item.cod_articulo || item.id,
          moneda: currency,
          proveedorElegido: getProveedorNombre(chosen, suppliers),
          totalMayor: maxUnit * quantity,
          totalElegido: chosenUnit * quantity,
          ahorro,
        });
      });
    });
    return {
      cantidadCotizaciones: cotizacionesInReportPeriod.length,
      cantidadItems: new Set(cotizacionesInReportPeriod.map((cot) => cot.item_id)).size,
      cantidadItemsComparados: new Set(savingsRows.map((row) => `${row.pedido}-${row.item}-${row.moneda}`)).size,
      totals,
      detailRows,
      savingsRows,
    };
  }, [cotizacionesInReportPeriod, items, suppliers]);
  const reportPeriodLabel = filterMonth === 0
    ? `Todo ${filterYear}`
    : `${["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"][filterMonth - 1]} ${filterYear}`;

  const downloadCotizacionesReport = () => {
    const table = (title: string, headers: string[], rows: Array<Array<string | number>>) => `
      <h2>${escapeHtml(title)}</h2>
      <table border="1">
        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.length > 0 ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}">Sin datos</td></tr>`}</tbody>
      </table>
    `;
    const html = `<!doctype html><html><head><meta charset="utf-8" /></head><body>
      <h1>Reporte de cotizaciones - ${escapeHtml(reportPeriodLabel)}</h1>
      ${table("Resumen", ["Concepto", "ARS", "USD"], [
        ["Cotizaciones realizadas", cotizacionesReport.cantidadCotizaciones, cotizacionesReport.cantidadCotizaciones],
        ["Items cotizados", cotizacionesReport.cantidadItems, cotizacionesReport.cantidadItems],
        ["Items comparados", cotizacionesReport.cantidadItemsComparados, cotizacionesReport.cantidadItemsComparados],
        ["Total con proveedor de mayor valor", cotizacionesReport.totals.ARS.totalCotizado, cotizacionesReport.totals.USD.totalCotizado],
        ["Total con proveedor elegido", cotizacionesReport.totals.ARS.totalElegido, cotizacionesReport.totals.USD.totalElegido],
        ["Ahorro logrado", cotizacionesReport.totals.ARS.ahorro, cotizacionesReport.totals.USD.ahorro],
        ["Ahorro porcentual", formatSavingsPercent(cotizacionesReport.totals.ARS.ahorro, cotizacionesReport.totals.ARS.totalCotizado), formatSavingsPercent(cotizacionesReport.totals.USD.ahorro, cotizacionesReport.totals.USD.totalCotizado)],
      ])}
      ${table("Detalle de cotizaciones", ["Pedido", "Cliente", "Item", "Proveedor", "Cantidad", "Precio unitario", "Moneda", "Total", "Elegida", "Fecha"], cotizacionesReport.detailRows.map((row) => [row.pedido, row.cliente, row.item, row.proveedor, row.cantidad, row.precio, row.moneda, row.total, row.elegida, row.fecha]))}
      ${table("Ahorro por item", ["Pedido", "Item", "Moneda", "Proveedor elegido", "Total mayor", "Total elegido", "Ahorro"], cotizacionesReport.savingsRows.map((row) => [row.pedido, row.item, row.moneda, row.proveedorElegido, row.totalMayor, row.totalElegido, row.ahorro]))}
    </body></html>`;
    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `reporte-cotizaciones-${reportPeriodLabel.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const editingItem = editing ? items.find((row) => row.id === editing.itemId) : null;
  const editingMeta = editingItem ? getPedidoMeta(editingItem) : null;

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
      moneda: upperText(form.moneda) || "ARS",
      condicion_pago: upperText(form.condicion_pago) || null,
      plazo_entrega_dias: Number(form.plazo_entrega_dias),
      observaciones: upperText(form.observaciones) || null,
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

  const quitarItemDeCotizaciones = async (item: ItemRow) => {
    if (!isAdmin) return;
    if (!confirm("¿Quitar este ítem del módulo Cotizaciones?")) return;
    const { error: cotError } = await supabase.from("cotizaciones_items" as any).delete().eq("item_id", item.id);
    if (cotError) {
      toast({ title: "Error", description: cotError.message, variant: "destructive" });
      return;
    }
    const { error: itemError } = await supabase
      .from("pedido_items")
      .update({ estado_cotizacion: null } as any)
      .eq("id", item.id);
    if (itemError) {
      toast({ title: "No se pudo actualizar el ítem", description: itemError.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ítem quitado de Cotizaciones" });
    setExpanded((current) => current === item.id ? null : current);
    await loadAll();
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
      const detalleItem = upperText(item.descripcion) || upperText(item.cod_articulo) || "ARTICULO SIN DESCRIPCION";
      const observacionCotizacion = [
        "Cotizacion enviada a pedido.",
        `Item: ${detalleItem}.`,
        `Proveedor elegido: ${proveedorElegido}.`,
        elegida.observaciones ? `Obs. cotizacion: ${upperText(elegida.observaciones)}` : "",
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
          condiciones_pago: upperText(elegida.condicion_pago) || null,
          observaciones: upperText(observacionesPedido),
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
          moneda: upperText(elegida.moneda) || "ARS",
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
        cliente: meta.cliente !== "-" ? upperText(meta.cliente) : "",
        vendedor: meta.vendedor !== "-" ? upperText(meta.vendedor) : "",
        plazo_entrega_cliente: "",
        plazo_entrega_proveedor: elegida.plazo_entrega_dias != null ? `${elegida.plazo_entrega_dias} dias` : null,
        condiciones_pago: upperText(elegida.condicion_pago) || null,
        observaciones: upperText(observacionesPedido),
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
        descripcion: upperText(row.descripcion) || upperText(row.cod_articulo) || "ARTICULO SIN DESCRIPCION",
        cantidad_pedida: row.cantidad_pedida,
        cantidad_recibida: 0,
        cantidad_pendiente: row.cantidad_pedida,
        unidad: upperText(row.unidad) || null,
        cod_articulo: upperText(row.cod_articulo) || null,
        costo_unitario: cot.costo_unitario,
        moneda: upperText(cot.moneda) || "ARS",
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
    window.dispatchEvent(new CustomEvent("pedidos:refresh", { detail: { pedidoId: nuevoPedidoId } }));
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
          <Button type="button" variant="outline" onClick={downloadCotizacionesReport}>
            Exportar reporte
          </Button>
        </div>
      </div>

      <div className="grid gap-3 border-b bg-surface-subtle/40 p-5 lg:grid-cols-[1.2fr_1fr_1fr]">
        <div className="rounded-md border bg-card p-4">
          <p className="text-sm font-semibold">Reporte {reportPeriodLabel}</p>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Cotizaciones realizadas</p>
              <p className="text-2xl font-semibold">{cotizacionesReport.cantidadCotizaciones}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ítems cotizados</p>
              <p className="text-2xl font-semibold">{cotizacionesReport.cantidadItems}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ítems comparados</p>
              <p className="text-2xl font-semibold">{cotizacionesReport.cantidadItemsComparados}</p>
            </div>
          </div>
        </div>
        {["ARS", "USD"].map((currency) => {
          const totals = cotizacionesReport.totals[currency];
          return (
            <div key={currency} className="rounded-md border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{currency}</p>
                <span className="rounded-md border bg-surface-subtle px-2 py-0.5 text-xs font-semibold">Ahorro</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-success">{formatMoney(totals.ahorro, currency)}</p>
              <p className="mt-1 text-xs font-semibold text-success">{formatSavingsPercent(totals.ahorro, totals.totalCotizado)} de ahorro</p>
              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <p>Total proveedor de mayor valor: <span className="font-semibold text-foreground">{formatMoney(totals.totalCotizado, currency)}</span></p>
                <p>Total proveedor elegido: <span className="font-semibold text-foreground">{formatMoney(totals.totalElegido, currency)}</span></p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="divide-y">
        {itemsToShow.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No hay ítems de cotización para mostrar.</p>
        )}
        {itemsToShow.map((item) => {
          const cots = cotsByItem.get(item.id) || [];
          const estado = computeEstado(cots, item.estado_cotizacion);
          const elegida = cots.find((c) => c.elegida);
          const diffBase = elegida || cots.find((c) => c.sugerida) || null;
          const meta = getPedidoMeta(item);
          const isExpanded = expanded === item.id;
          const itemBg = estado === "proveedor_elegido" ? "bg-success/5" : estado === "enviado_a_pedido" ? "bg-primary/5" : estado === "pendiente_cotizacion" ? "bg-warning/5" : "";
          const pedidoItems = items.filter((row) => row.pedido_id === item.pedido_id);
          const totalsBySupplier = Array.from(pedidoItems.reduce((map, row) => {
            const rowCots = cotsByItem.get(row.id) || [];
            rowCots.forEach((cot) => {
              if (!cot.proveedor_id || !cot.costo_unitario) return;
              const current = map.get(cot.proveedor_id) || {
                proveedorId: cot.proveedor_id,
                proveedor: getProveedorNombre(cot, suppliers),
                itemIds: new Set<string>(),
                totals: new Map<string, number>(),
              };
              const currency = upperText(cot.moneda) || "ARS";
              current.itemIds.add(row.id);
              current.totals.set(currency, (current.totals.get(currency) || 0) + (Number(row.cantidad_pedida) || 0) * cot.costo_unitario);
              map.set(cot.proveedor_id, current);
            });
            return map;
          }, new Map<string, { proveedorId: string; proveedor: string; itemIds: Set<string>; totals: Map<string, number> }>()).values()).sort((a, b) => {
            const coverageDiff = b.itemIds.size - a.itemIds.size;
            if (coverageDiff !== 0) return coverageDiff;
            return a.proveedor.localeCompare(b.proveedor, "es");
          });
          const completeTotalsBySupplier = totalsBySupplier.filter((summary) => summary.itemIds.size === pedidoItems.length);
          const totalBaselineSource = completeTotalsBySupplier.length > 0 ? completeTotalsBySupplier : totalsBySupplier;
          const totalComparisons = totalBaselineSource.reduce((map, summary) => {
            summary.totals.forEach((amount, currency) => {
              const current = map.get(currency) || [];
              current.push(amount);
              map.set(currency, current);
            });
            return map;
          }, new Map<string, number[]>());
          totalComparisons.forEach((amounts, currency) => {
            totalComparisons.set(currency, Array.from(new Set(amounts)).sort((a, b) => a - b));
          });

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
                    <Button size="sm" variant="outline" type="button" title="Quitar item del modulo Cotizaciones" className="border-destructive/40 text-destructive hover:text-destructive" onClick={() => quitarItemDeCotizaciones(item)}>
                      <Trash2 className="h-4 w-4" /> Quitar cotización
                    </Button>
                  )}
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
                <div className="mt-4 space-y-4">
                  <div className="rounded-md border bg-card p-4">
                    <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-semibold">Totales cotizados por proveedor</p>
                        <p className="text-xs text-muted-foreground">Pedido {meta.numeroPedido} · {pedidoItems.length} ítem{pedidoItems.length === 1 ? "" : "s"} del pedido</p>
                      </div>
                    </div>
                    {totalsBySupplier.length > 0 ? (
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {totalsBySupplier.map((summary) => (
                          <div key={summary.proveedorId} className="rounded-md border bg-surface-subtle p-3">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold">{summary.proveedor}</p>
                              <span className="rounded-md border bg-card px-2 py-0.5 text-xs font-semibold">
                                {summary.itemIds.size}/{pedidoItems.length} ítems
                              </span>
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                              {Array.from(summary.totals.entries()).map(([currency, amount]) => {
                                const comparisons = totalComparisons.get(currency) || [];
                                const maxAmount = comparisons[comparisons.length - 1];
                                const savingsDiff = getTotalSavingsDiff(amount, maxAmount);
                                return (
                                  <div key={currency}>
                                    <p className="select-text font-semibold text-primary">{formatMoney(amount, currency)}</p>
                                    {savingsDiff && <p className="text-xs font-semibold text-success">Dif. vs mayor: {savingsDiff}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-md border bg-surface-subtle p-3 text-sm text-muted-foreground">Todavía no hay cotizaciones cargadas para sumar.</p>
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Proveedor</th>
                        <th className="px-4 py-2 text-left">Precio</th>
                        <th className="px-4 py-2 text-left">Dif. %</th>
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
                        <tr><td className="px-4 py-3 text-muted-foreground" colSpan={9}>Sin cotizaciones cargadas.</td></tr>
                      )}
                      {cots.map((cot) => {
                        const diff = getPriceDiff(cot, diffBase);
                        return (
                        <tr key={cot.id} className={cot.elegida ? "bg-success/10" : cot.sugerida ? "bg-warning/5" : ""}>
                          <td className="px-4 py-2 font-medium">
                            {getProveedorNombre(cot, suppliers)}
                            {cot.sugerida && <span className="ml-2 inline-flex items-center rounded-md border border-warning/40 bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning-foreground">Proveedor sugerido</span>}
                            {cot.elegida && <span className="ml-2 inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />elegida</span>}
                          </td>
                          <td className="px-4 py-2">{cot.costo_unitario ?? "-"}</td>
                          <td className={`px-4 py-2 font-semibold ${diff.className}`}>{diff.label}</td>
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
                                <Button size="sm" variant="ghost" type="button" className="text-destructive hover:text-destructive" onClick={() => eliminarCotizacion(cot)}>
                                  <Trash2 className="h-3 w-3" /> Eliminar
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
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
            {editingItem && (
              <div className="rounded-md border bg-muted/35 px-3 py-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">Articulo a cotizar</p>
                <p className="mt-1 text-sm font-semibold">{editingItem.descripcion?.trim() || editingItem.cod_articulo?.trim() || "Articulo sin descripcion"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {editingItem.cantidad_pedida} {editingItem.unidad || "u"} · Pedido {editingMeta?.numeroPedido || "-"} · Cliente: {editingMeta?.cliente || "-"}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label>Proveedor *</Label>
              <select required value={form.proveedor_id} onChange={(e) => setForm({ ...form, proveedor_id: e.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="">Seleccionar</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={closeDialog}>Cancelar</Button>
              <Button className="w-full sm:w-auto" type="submit" variant="command" disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
