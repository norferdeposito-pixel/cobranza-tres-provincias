import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { toast } from "@/hooks/use-toast";

type Devolucion = {
  id: string;
  fecha_devolucion: string | null;
  proveedor: string | null;
  numero_devolucion: string | null;
  numero_oc: string | null;
  numero_factura: string | null;
  numero_nc: string | null;
  estado: string | null;
  observaciones: string | null;
};

type DevolucionForm = {
  fechaDevolucion: string;
  proveedor: string;
  numeroDevolucion: string;
  numeroOc: string;
  numeroFactura: string;
  numeroNc: string;
  estado: string;
  observaciones: string;
};

const emptyForm = (): DevolucionForm => ({
  fechaDevolucion: new Date().toISOString().slice(0, 10),
  proveedor: "",
  numeroDevolucion: "",
  numeroOc: "",
  numeroFactura: "",
  numeroNc: "",
  estado: "PENDIENTE",
  observaciones: "",
});

const upperText = (value?: string | number | null) => String(value ?? "").trim().toLocaleUpperCase("es-AR");

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
  const delimiters = [";", "\t", ","];
  let delimiter = ",";
  const headerIndex = lines.findIndex((line) =>
    delimiters.some((candidate) => {
      const normalized = splitDelimitedLine(line, candidate).map(normalizeKey);
      const isHeader = normalized.includes("proveedor") && (normalized.includes("fecha_devolucion") || normalized.includes("n_devolucion") || normalized.includes("numero_devolucion"));
      if (isHeader) delimiter = candidate;
      return isHeader;
    })
  );
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

const normalizeDate = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const formatDate = (value?: string | null) => {
  const safe = normalizeDate(value);
  if (!safe) return "-";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${safe}T12:00:00`));
};

const estadoClass: Record<string, string> = {
  PENDIENTE: "border-warning/40 bg-warning/20 text-warning-foreground",
  TERMINADO: "border-success/30 bg-success/10 text-success",
  ANULADO: "border-border bg-muted text-muted-foreground",
};

export const Devoluciones = () => {
  const [rows, setRows] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DevolucionForm>(emptyForm());

  const loadRows = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("devoluciones" as any)
      .select("*")
      .order("fecha_devolucion", { ascending: false });
    setLoading(false);
    if (error) {
      toast({ title: "No se pudieron cargar devoluciones", description: error.message, variant: "destructive" });
      return;
    }
    setRows((data || []) as any);
  };

  useEffect(() => {
    loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    const search = query.toLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !search || `${row.proveedor || ""} ${row.numero_devolucion || ""} ${row.numero_oc || ""} ${row.numero_factura || ""} ${row.numero_nc || ""} ${row.observaciones || ""}`.toLowerCase().includes(search);
      const matchesEstado = estadoFilter === "todos" || upperText(row.estado) === estadoFilter;
      return matchesSearch && matchesEstado;
    });
  }, [rows, query, estadoFilter]);

  const summary = {
    total: rows.length,
    pendientes: rows.filter((row) => upperText(row.estado) === "PENDIENTE").length,
    terminadas: rows.filter((row) => upperText(row.estado) === "TERMINADO").length,
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const editRow = (row: Devolucion) => {
    setEditingId(row.id);
    setForm({
      fechaDevolucion: normalizeDate(row.fecha_devolucion) || "",
      proveedor: row.proveedor || "",
      numeroDevolucion: row.numero_devolucion || "",
      numeroOc: row.numero_oc || "",
      numeroFactura: row.numero_factura || "",
      numeroNc: row.numero_nc || "",
      estado: upperText(row.estado) || "PENDIENTE",
      observaciones: row.observaciones || "",
    });
  };

  const saveRow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.fechaDevolucion || !form.proveedor) return;
    setSaving(true);
    const payload = {
      fecha_devolucion: normalizeDate(form.fechaDevolucion),
      proveedor: upperText(form.proveedor),
      numero_devolucion: upperText(form.numeroDevolucion) || null,
      numero_oc: upperText(form.numeroOc) || null,
      numero_factura: upperText(form.numeroFactura) || null,
      numero_nc: upperText(form.numeroNc) || null,
      estado: upperText(form.estado) || "PENDIENTE",
      observaciones: upperText(form.observaciones) || null,
    };
    const res = editingId
      ? await supabase.from("devoluciones" as any).update(payload).eq("id", editingId)
      : await supabase.from("devoluciones" as any).insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: "No se pudo guardar devolución", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: editingId ? "Devolución actualizada" : "Devolución cargada" });
    resetForm();
    await loadRows();
  };

  const deleteRow = async (row: Devolucion) => {
    if (!confirm("¿Eliminar esta devolución?")) return;
    const { error } = await supabase.from("devoluciones" as any).delete().eq("id", row.id);
    if (error) {
      toast({ title: "No se pudo eliminar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Devolución eliminada" });
    await loadRows();
  };

  const importCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const parsed = parseCsv(await file.text());
    const payload = parsed.map((row) => ({
      fecha_devolucion: normalizeDate(getFirstValue(row, ["fecha_devolucion", "fecha"])),
      proveedor: upperText(getFirstValue(row, ["proveedor"])),
      numero_devolucion: upperText(getFirstValue(row, ["n_devolucion", "numero_devolucion", "devolucion"])) || null,
      numero_oc: upperText(getFirstValue(row, ["n_oc", "numero_oc", "oc"])) || null,
      numero_factura: upperText(getFirstValue(row, ["n_factura", "numero_factura", "factura"])) || null,
      numero_nc: upperText(getFirstValue(row, ["n_nc", "numero_nc", "nc"])) || null,
      estado: upperText(getFirstValue(row, ["estado"])) || "PENDIENTE",
      observaciones: upperText(getFirstValue(row, ["observaciones", "obs"])) || null,
    })).filter((row) => row.fecha_devolucion && row.proveedor);
    if (payload.length === 0) {
      toast({ title: "Archivo sin datos válidos", description: "Necesita Fecha devolución y Proveedor.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("devoluciones" as any).upsert(payload, { onConflict: "numero_devolucion" });
    if (error) {
      toast({ title: "No se pudo importar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Devoluciones importadas", description: `${payload.length} registros procesados.` });
    await loadRows();
  };

  return (
    <section className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Total devoluciones", summary.total],
          ["Pendientes", summary.pendientes],
          ["Terminadas", summary.terminadas],
        ].map(([label, value]) => (
          <article key={label} className="rounded-md border bg-card p-5 shadow-command">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-md border bg-card shadow-command">
        <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Devoluciones</h3>
            <p className="text-sm text-muted-foreground">Seguimiento de devoluciones a proveedores, OC, facturas y NC asociadas.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="devoluciones-import">Importar CSV</Label>
            <Input id="devoluciones-import" type="file" accept=".csv,.txt" onChange={importCsv} />
          </div>
        </div>
        <div className="grid gap-3 border-b p-5 md:grid-cols-3">
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar proveedor, OC, factura, NC u observación" />
          <select value={estadoFilter} onChange={(event) => setEstadoFilter(event.target.value)} className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="todos">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="TERMINADO">Terminado</option>
            <option value="ANULADO">Anulado</option>
          </select>
          <Button type="button" variant="outline" onClick={loadRows}><Download className="h-4 w-4" />Actualizar</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-surface-subtle text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Fecha devolución</th>
                <th className="px-5 py-3">Proveedor</th>
                <th className="px-5 py-3">N° devolución</th>
                <th className="px-5 py-3">N° OC</th>
                <th className="px-5 py-3">N° factura</th>
                <th className="px-5 py-3">N° NC</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Observaciones</th>
                <th className="px-5 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRows.map((row) => (
                <tr key={row.id} className="transition hover:bg-surface-subtle/70">
                  <td className="px-5 py-4">{formatDate(row.fecha_devolucion)}</td>
                  <td className="px-5 py-4 font-semibold">{row.proveedor || "-"}</td>
                  <td className="px-5 py-4">{row.numero_devolucion || "-"}</td>
                  <td className="px-5 py-4">{row.numero_oc || "-"}</td>
                  <td className="px-5 py-4">{row.numero_factura || "-"}</td>
                  <td className="px-5 py-4">{row.numero_nc || "-"}</td>
                  <td className="px-5 py-4"><span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${estadoClass[upperText(row.estado)] || "border-border bg-secondary text-secondary-foreground"}`}>{row.estado || "-"}</span></td>
                  <td className="max-w-[360px] px-5 py-4">{row.observaciones || "-"}</td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => editRow(row)}><Pencil className="h-4 w-4" />Editar</Button>
                      <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteRow(row)}><Trash2 className="h-4 w-4" />Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 && <tr><td className="px-5 py-8 text-center text-muted-foreground" colSpan={9}>No hay devoluciones para mostrar.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-md border bg-card p-5 shadow-command">
        <h3 className="text-lg font-semibold">{editingId ? "Editar devolución" : "Crear devolución"}</h3>
        <form className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4" onSubmit={saveRow}>
          <div className="space-y-2"><Label htmlFor="dev-fecha">Fecha devolución</Label><Input id="dev-fecha" type="date" value={form.fechaDevolucion} onChange={(event) => setForm({ ...form, fechaDevolucion: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="dev-proveedor">Proveedor</Label><Input id="dev-proveedor" value={form.proveedor} onChange={(event) => setForm({ ...form, proveedor: event.target.value })} required /></div>
          <div className="space-y-2"><Label htmlFor="dev-numero">N° devolución</Label><Input id="dev-numero" value={form.numeroDevolucion} onChange={(event) => setForm({ ...form, numeroDevolucion: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="dev-oc">N° OC</Label><Input id="dev-oc" value={form.numeroOc} onChange={(event) => setForm({ ...form, numeroOc: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="dev-factura">N° factura</Label><Input id="dev-factura" value={form.numeroFactura} onChange={(event) => setForm({ ...form, numeroFactura: event.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="dev-nc">N° NC</Label><Input id="dev-nc" value={form.numeroNc} onChange={(event) => setForm({ ...form, numeroNc: event.target.value })} /></div>
          <div className="space-y-2">
            <Label htmlFor="dev-estado">Estado</Label>
            <select id="dev-estado" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="PENDIENTE">PENDIENTE</option>
              <option value="TERMINADO">TERMINADO</option>
              <option value="ANULADO">ANULADO</option>
            </select>
          </div>
          <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label htmlFor="dev-obs">Observaciones</Label><Textarea id="dev-obs" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} /></div>
          <div className="flex items-end gap-3">
            <Button type="submit" variant="command" disabled={saving}><Plus className="h-4 w-4" />{saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear devolución"}</Button>
            {editingId && <Button type="button" variant="outline" onClick={resetForm}>Cancelar</Button>}
          </div>
        </form>
      </section>
    </section>
  );
};
