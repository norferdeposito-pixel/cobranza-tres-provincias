import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

type StockArticle = {
  id?: string;
  codigo: string;
  descripcion: string;
  familia: string | null;
  unidad: string | null;
  proveedor_habitual: string | null;
  lead_time_nacional_dias: number | null;
  lead_time_importacion_dias: number | null;
  stock_seguridad: number | null;
  punto_pedido: number | null;
  cantidad_a_pedir: number | null;
  activo: boolean | null;
};

type StockRow = {
  codigo_articulo: string;
  stock_actual: number | null;
  fecha_ultima_actualizacion: string | null;
};

type StockForm = {
  codigo: string;
  descripcion: string;
  familia: string;
  unidad: string;
  proveedorHabitual: string;
  leadTimeNacional: string;
  leadTimeImportacion: string;
  stockSeguridad: string;
  puntoPedido: string;
  cantidadAPedir: string;
  stockActual: string;
  activo: boolean;
};

type StockStatus = "sin_stock" | "seguridad" | "punto_pedido" | "ok";

const today = () => new Date().toISOString().slice(0, 10);
const upperText = (value?: string | number | null) => String(value ?? "").trim().toLocaleUpperCase("es-AR");
const safeNumber = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const emptyForm = (): StockForm => ({
  codigo: "",
  descripcion: "",
  familia: "MOTORES",
  unidad: "UNI",
  proveedorHabitual: "",
  leadTimeNacional: "",
  leadTimeImportacion: "",
  stockSeguridad: "",
  puntoPedido: "",
  cantidadAPedir: "",
  stockActual: "",
  activo: true,
});

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const splitDelimitedLine = (line: string, delimiter: string) => {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
};

const parseCsv = (text: string) => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes(";") ? ";" : lines[0].includes("\t") ? "\t" : ",";
  const headerIndex = lines.findIndex((line) => {
    const normalized = splitDelimitedLine(line, delimiter).map(normalizeKey);
    const joined = normalized.join(" ");
    return (
      normalized.includes("cod_articulo") ||
      normalized.includes("codigo") ||
      normalized.includes("codigo_articulo") ||
      (joined.includes("articulo") && (joined.includes("descripcion") || joined.includes("existencias")))
    );
  });
  if (headerIndex < 0) return [];
  const headers = splitDelimitedLine(lines[headerIndex], delimiter).map(normalizeKey);
  return lines.slice(headerIndex + 1).map((line) => {
    const cells = splitDelimitedLine(line, delimiter);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] || "";
      return row;
    }, {});
  });
};

const getFirstValue = (row: Record<string, string>, keys: string[]) => {
  const normalizedKeys = keys.map(normalizeKey);
  const rowKeys = Object.keys(row);
  const found = normalizedKeys.find((key) => row[key])
    || rowKeys.find((rowKey) => normalizedKeys.some((key) => rowKey === key || rowKey.includes(key) || key.includes(rowKey)));
  return found ? row[found] : "";
};

const getStockStatus = (article: StockArticle, stock?: StockRow): StockStatus => {
  const current = safeNumber(stock?.stock_actual);
  if (current <= 0) return "sin_stock";
  if (current <= safeNumber(article.stock_seguridad)) return "seguridad";
  if (current <= safeNumber(article.punto_pedido)) return "punto_pedido";
  return "ok";
};

const statusLabel: Record<StockStatus, string> = {
  sin_stock: "Sin stock",
  seguridad: "Bajo stock seguridad",
  punto_pedido: "Punto de pedido",
  ok: "OK",
};

const statusClass: Record<StockStatus, string> = {
  sin_stock: "border-destructive/40 bg-destructive/10 text-destructive",
  seguridad: "border-warning/50 bg-warning/20 text-warning-foreground",
  punto_pedido: "border-primary/30 bg-primary/10 text-primary",
  ok: "border-success/30 bg-success/10 text-success",
};

export const StockModule = () => {
  const [articles, setArticles] = useState<StockArticle[]>([]);
  const [stockRows, setStockRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [query, setQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("criticos");
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [form, setForm] = useState<StockForm>(emptyForm());
  const [lastImportResult, setLastImportResult] = useState<{ updated: number; ignored: string[] } | null>(null);

  const stockByCode = useMemo(() => new Map(stockRows.map((row) => [upperText(row.codigo_articulo), row])), [stockRows]);
  const families = useMemo(() => Array.from(new Set(articles.map((article) => article.familia || "SIN FAMILIA"))).sort(), [articles]);

  const stockSummaries = useMemo(() => {
    return articles
      .filter((article) => article.activo !== false)
      .map((article) => {
        const stock = stockByCode.get(upperText(article.codigo));
        const status = getStockStatus(article, stock);
        return { article, stock, status };
      });
  }, [articles, stockByCode]);

  const filteredSummaries = useMemo(() => {
    const search = query.toLowerCase();
    return stockSummaries
      .filter(({ article, status }) => {
        const matchesSearch = !search || `${article.codigo} ${article.descripcion} ${article.familia || ""} ${article.proveedor_habitual || ""}`.toLowerCase().includes(search);
        const matchesFamily = familyFilter === "todos" || (article.familia || "SIN FAMILIA") === familyFilter;
        const matchesStatus = statusFilter === "todos" || (statusFilter === "criticos" ? status !== "ok" : status === statusFilter);
        return matchesSearch && matchesFamily && matchesStatus;
      })
      .sort((a, b) => {
        const severity = { sin_stock: 0, seguridad: 1, punto_pedido: 2, ok: 3 };
        return severity[a.status] - severity[b.status] || a.article.codigo.localeCompare(b.article.codigo);
      });
  }, [stockSummaries, query, familyFilter, statusFilter]);

  const summary = {
    controlled: stockSummaries.length,
    reorder: stockSummaries.filter((item) => item.status === "punto_pedido").length,
    safety: stockSummaries.filter((item) => item.status === "seguridad").length,
    out: stockSummaries.filter((item) => item.status === "sin_stock").length,
  };

  const loadStock = async () => {
    setLoading(true);
    const [articlesRes, stockRes] = await Promise.all([
      supabase.from("stock_articulos" as any).select("*").order("codigo", { ascending: true }),
      supabase.from("stock_actual" as any).select("*"),
    ]);
    setLoading(false);
    if (articlesRes.error || stockRes.error) {
      toast({
        title: "No se pudo cargar Stock",
        description: articlesRes.error?.message || stockRes.error?.message || "Revisá que las tablas estén creadas en Supabase.",
        variant: "destructive",
      });
      return;
    }
    setArticles((articlesRes.data || []) as any);
    setStockRows((stockRes.data || []) as any);
  };

  useEffect(() => {
    loadStock();
  }, []);

  const startEdit = (article: StockArticle) => {
    const stock = stockByCode.get(upperText(article.codigo));
    setEditingCode(article.codigo);
    setForm({
      codigo: article.codigo,
      descripcion: article.descripcion,
      familia: article.familia || "MOTORES",
      unidad: article.unidad || "UNI",
      proveedorHabitual: article.proveedor_habitual || "",
      leadTimeNacional: article.lead_time_nacional_dias != null ? String(article.lead_time_nacional_dias) : "",
      leadTimeImportacion: article.lead_time_importacion_dias != null ? String(article.lead_time_importacion_dias) : "",
      stockSeguridad: article.stock_seguridad != null ? String(article.stock_seguridad) : "",
      puntoPedido: article.punto_pedido != null ? String(article.punto_pedido) : "",
      cantidadAPedir: article.cantidad_a_pedir != null ? String(article.cantidad_a_pedir) : "",
      stockActual: stock?.stock_actual != null ? String(stock.stock_actual) : "",
      activo: article.activo !== false,
    });
  };

  const resetForm = () => {
    setEditingCode(null);
    setForm(emptyForm());
  };

  const saveArticle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.codigo || !form.descripcion) return;
    setSaving(true);
    const articlePayload = {
      codigo: upperText(form.codigo),
      descripcion: upperText(form.descripcion),
      familia: upperText(form.familia) || "MOTORES",
      unidad: upperText(form.unidad) || "UNI",
      proveedor_habitual: upperText(form.proveedorHabitual) || null,
      lead_time_nacional_dias: form.leadTimeNacional ? safeNumber(form.leadTimeNacional) : null,
      lead_time_importacion_dias: form.leadTimeImportacion ? safeNumber(form.leadTimeImportacion) : null,
      stock_seguridad: form.stockSeguridad ? safeNumber(form.stockSeguridad) : 0,
      punto_pedido: form.puntoPedido ? safeNumber(form.puntoPedido) : 0,
      cantidad_a_pedir: form.cantidadAPedir ? safeNumber(form.cantidadAPedir) : 0,
      activo: form.activo,
    };
    const articleRes = editingCode
      ? await supabase.from("stock_articulos" as any).update(articlePayload).eq("codigo", editingCode)
      : await supabase.from("stock_articulos" as any).insert(articlePayload);
    if (articleRes.error) {
      setSaving(false);
      toast({ title: "No se pudo guardar artículo", description: articleRes.error.message, variant: "destructive" });
      return;
    }
    if (form.stockActual !== "") {
      const stockRes = await supabase.from("stock_actual" as any).upsert({
        codigo_articulo: upperText(form.codigo),
        stock_actual: safeNumber(form.stockActual),
        fecha_ultima_actualizacion: today(),
      }, { onConflict: "codigo_articulo" });
      if (stockRes.error) {
        setSaving(false);
        toast({ title: "Artículo guardado, pero no se actualizó stock", description: stockRes.error.message, variant: "destructive" });
        return;
      }
    }
    setSaving(false);
    resetForm();
    await loadStock();
    toast({ title: "Stock actualizado", description: "El artículo quedó guardado." });
  };

  const processInitialCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProcessing(true);
    const rows = parseCsv(await file.text());
    const articlePayloads = rows.map((row) => ({
      codigo: upperText(getFirstValue(row, ["codigo", "cod_articulo", "c_d_articulo", "articulo"])),
      descripcion: upperText(getFirstValue(row, ["descripcion", "descripci_n", "detalle", "articulo_descripcion"])),
      familia: upperText(getFirstValue(row, ["familia", "linea", "rubro"])) || "MOTORES",
      unidad: upperText(getFirstValue(row, ["unidad"])) || "UNI",
      proveedor_habitual: upperText(getFirstValue(row, ["proveedor", "proveedor_habitual", "proveedor_proveedores", "marca"])) || null,
      lead_time_nacional_dias: safeNumber(getFirstValue(row, ["lead_time_nacional", "lead_time_nacional_dias"])),
      lead_time_importacion_dias: safeNumber(getFirstValue(row, ["lead_time_importacion", "lead_time_importacion_dias"])),
      stock_seguridad: safeNumber(getFirstValue(row, ["stock_seguridad", "stock_de_seguridad", "seguridad"])),
      punto_pedido: safeNumber(getFirstValue(row, ["punto_pedido", "punto_de_pedido", "punto pedido", "pto_pedido", "pedido", "reposicion", "punto_reposicion"])),
      cantidad_a_pedir: safeNumber(getFirstValue(row, ["cantidad_a_pedir", "cant_a_pedir", "cant. a pedir", "cant a pedir", "cantidad_pedir", "pedido_sugerido"])),
      activo: true,
      stock: safeNumber(getFirstValue(row, ["stock", "stock_actual", "existencias", "cantidad"])),
    })).filter((row) => row.codigo && row.descripcion);

    if (articlePayloads.length === 0) {
      setProcessing(false);
      toast({ title: "Archivo sin datos válidos", description: "Necesita columnas Código, Descripción y Stock.", variant: "destructive" });
      return;
    }

    const { error: articleError } = await supabase.from("stock_articulos" as any).upsert(
      articlePayloads.map(({ stock, ...article }) => article),
      { onConflict: "codigo" },
    );
    const { error: stockError } = await supabase.from("stock_actual" as any).upsert(
      articlePayloads.map((row) => ({ codigo_articulo: row.codigo, stock_actual: row.stock, fecha_ultima_actualizacion: today() })),
      { onConflict: "codigo_articulo" },
    );
    setProcessing(false);
    if (articleError || stockError) {
      toast({ title: "No se pudo importar stock inicial", description: articleError?.message || stockError?.message, variant: "destructive" });
      return;
    }
    await loadStock();
    toast({ title: "Carga inicial importada", description: `${articlePayloads.length} artículos procesados.` });
  };

  const processBillingCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProcessing(true);
    const rows = parseCsv(await file.text());
    const articlesSet = new Set(articles.filter((article) => article.activo !== false).map((article) => upperText(article.codigo)));
    const totals = new Map<string, number>();
    const ignored = new Set<string>();
    rows.forEach((row) => {
      const code = upperText(getFirstValue(row, ["codigo", "cod_articulo", "articulo", "codigo_articulo"]));
      const quantity = safeNumber(getFirstValue(row, ["cantidad", "cant", "cantidad_facturada", "unidades"]));
      if (!code || quantity <= 0) return;
      if (!articlesSet.has(code)) {
        ignored.add(code);
        return;
      }
      totals.set(code, (totals.get(code) || 0) + quantity);
    });

    const updatedRows = Array.from(totals.entries()).map(([code, quantity]) => {
      const current = safeNumber(stockByCode.get(code)?.stock_actual);
      return {
        codigo_articulo: code,
        stock_actual: Math.max(current - quantity, 0),
        fecha_ultima_actualizacion: today(),
      };
    });

    if (updatedRows.length > 0) {
      const { error } = await supabase.from("stock_actual" as any).upsert(updatedRows, { onConflict: "codigo_articulo" });
      if (error) {
        setProcessing(false);
        toast({ title: "No se pudo procesar facturación", description: error.message, variant: "destructive" });
        return;
      }
    }
    setProcessing(false);
    setLastImportResult({ updated: updatedRows.length, ignored: Array.from(ignored).sort() });
    await loadStock();
    toast({ title: "Reporte procesado", description: `${updatedRows.length} artículos actualizados. ${ignored.size} no encontrados.` });
  };

  if (loading) return <p className="text-sm text-muted-foreground">Cargando stock...</p>;

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Artículos controlados", value: summary.controlled, icon: CheckCircle2 },
          { label: "En punto de pedido", value: summary.reorder, icon: AlertTriangle },
          { label: "Bajo stock seguridad", value: summary.safety, icon: AlertTriangle },
          { label: "Sin stock", value: summary.out, icon: AlertTriangle },
        ].map((metric) => (
          <article key={metric.label} className="rounded-md border bg-card p-5 shadow-command">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary"><metric.icon className="h-5 w-5" /></div>
              <span className="text-3xl font-semibold">{metric.value}</span>
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">{metric.label}</p>
          </article>
        ))}
      </section>

      <section className="rounded-md border bg-card shadow-command">
        <div className="flex flex-col gap-3 border-b p-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Control de stock</h3>
            <p className="text-sm text-muted-foreground">Alertas por punto de pedido, stock de seguridad y faltantes.</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="stock-inicial">Carga inicial CSV</Label>
              <Input id="stock-inicial" type="file" accept=".csv,.txt" onChange={processInitialCsv} disabled={processing} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="stock-facturacion">Facturación diaria CSV</Label>
              <Input id="stock-facturacion" type="file" accept=".csv,.txt" onChange={processBillingCsv} disabled={processing} />
            </div>
          </div>
        </div>
        {lastImportResult && (
          <div className="border-b bg-surface-subtle/60 p-5 text-sm">
            <p><strong>Última importación:</strong> {lastImportResult.updated} artículos actualizados. {lastImportResult.ignored.length} artículos no encontrados.</p>
            {lastImportResult.ignored.length > 0 && <p className="mt-1 text-muted-foreground">No encontrados: {lastImportResult.ignored.slice(0, 30).join(", ")}{lastImportResult.ignored.length > 30 ? "..." : ""}</p>}
          </div>
        )}
        <div className="grid gap-3 border-b p-5 md:grid-cols-4">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar código, descripción o proveedor" />
          <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todos">Todas las familias</option>
            {families.map((family) => <option key={family} value={family}>{family}</option>)}
          </select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="criticos">Solo críticos</option>
            <option value="todos">Todos</option>
            <option value="punto_pedido">Punto de pedido</option>
            <option value="seguridad">Stock seguridad</option>
            <option value="sin_stock">Sin stock</option>
            <option value="ok">OK</option>
          </select>
          <Button type="button" variant="outline" onClick={loadStock}><Download className="h-4 w-4" />Actualizar</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Descripción</th>
                <th className="px-5 py-3">Familia</th>
                <th className="px-5 py-3">Stock actual</th>
                <th className="px-5 py-3">Punto pedido</th>
                <th className="px-5 py-3">Cant. a pedir</th>
                <th className="px-5 py-3">Stock seguridad</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Actualizado</th>
                <th className="px-5 py-3">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredSummaries.map(({ article, stock, status }) => (
                <tr key={article.codigo} className="transition hover:bg-surface-subtle/70">
                  <td className="px-5 py-4 font-semibold">{article.codigo}</td>
                  <td className="px-5 py-4">{article.descripcion}</td>
                  <td className="px-5 py-4">{article.familia || "-"}</td>
                  <td className="px-5 py-4 font-semibold">{stock?.stock_actual ?? 0} {article.unidad || ""}</td>
                  <td className="px-5 py-4">{article.punto_pedido ?? 0}</td>
                  <td className="px-5 py-4 font-semibold">{article.cantidad_a_pedir ?? 0}</td>
                  <td className="px-5 py-4">{article.stock_seguridad ?? 0}</td>
                  <td className="px-5 py-4"><span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${statusClass[status]}`}>{statusLabel[status]}</span></td>
                  <td className="px-5 py-4">{stock?.fecha_ultima_actualizacion || "-"}</td>
                  <td className="px-5 py-4"><Button type="button" size="sm" variant="outline" onClick={() => startEdit(article)}><Pencil className="h-4 w-4" />Editar</Button></td>
                </tr>
              ))}
              {filteredSummaries.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={10}>No hay artículos para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-command">
        <h3 className="text-lg font-semibold">{editingCode ? "Editar artículo" : "Agregar artículo"}</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={saveArticle}>
          <div className="space-y-2"><Label htmlFor="stock-codigo">Código</Label><Input id="stock-codigo" value={form.codigo} onChange={(event) => setForm({ ...form, codigo: event.target.value })} disabled={!!editingCode} required /></div>
          <div className="space-y-2 xl:col-span-2"><Label htmlFor="stock-descripcion">Descripción</Label><Input id="stock-descripcion" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="stock-familia">Familia</Label><Input id="stock-familia" value={form.familia} onChange={(event) => setForm({ ...form, familia: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-unidad">Unidad</Label><Input id="stock-unidad" value={form.unidad} onChange={(event) => setForm({ ...form, unidad: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-proveedor">Proveedor habitual</Label><Input id="stock-proveedor" value={form.proveedorHabitual} onChange={(event) => setForm({ ...form, proveedorHabitual: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-actual">Stock actual</Label><Input id="stock-actual" type="number" step="0.01" value={form.stockActual} onChange={(event) => setForm({ ...form, stockActual: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-punto">Punto de pedido</Label><Input id="stock-punto" type="number" step="0.01" value={form.puntoPedido} onChange={(event) => setForm({ ...form, puntoPedido: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-cant-pedir">Cant. a pedir</Label><Input id="stock-cant-pedir" type="number" step="0.01" value={form.cantidadAPedir} onChange={(event) => setForm({ ...form, cantidadAPedir: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-seguridad">Stock seguridad</Label><Input id="stock-seguridad" type="number" step="0.01" value={form.stockSeguridad} onChange={(event) => setForm({ ...form, stockSeguridad: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-lt-nacional">Lead Time Nacional</Label><Input id="stock-lt-nacional" type="number" step="1" value={form.leadTimeNacional} onChange={(event) => setForm({ ...form, leadTimeNacional: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="stock-lt-importacion">Lead Time Importación</Label><Input id="stock-lt-importacion" type="number" step="1" value={form.leadTimeImportacion} onChange={(event) => setForm({ ...form, leadTimeImportacion: event.target.value })} /></div>
          <label className="flex items-center gap-2 rounded-md border bg-surface-subtle px-3 py-2 text-sm font-medium">
            <input type="checkbox" checked={form.activo} onChange={(event) => setForm({ ...form, activo: event.target.checked })} />
            Activo
          </label>
          <div className="flex items-end gap-3">
            <Button type="submit" variant="command" disabled={saving}><Plus className="h-4 w-4" />{saving ? "Guardando..." : editingCode ? "Guardar cambios" : "Agregar artículo"}</Button>
            {editingCode && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
          </div>
        </form>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-command">
        <h3 className="font-semibold">Formato de importación</h3>
        <p className="mt-1 text-sm text-muted-foreground">El CSV puede estar separado por coma, punto y coma o tabulación. Columnas recomendadas para carga inicial: Código, Descripción, Stock actual, Punto de pedido y Cant. a pedir. Para facturación diaria: Código y Cantidad.</p>
      </section>
    </section>
  );
};
