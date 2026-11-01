import { describe, expect, it } from "vitest";
import { collectorOptions, createCollector, type CollectorRecord } from "./collector-management";

const recordFor = (name: string): CollectorRecord => ({
  name,
  phone: "",
  commissionBase: 12,
  bonusEnabled: false,
  bonusThreshold: 90,
  bonusRate: 13,
});

class FakeSupabaseSnapshots {
  private snapshot: { collectorRecords: CollectorRecord[] };
  shouldFail = false;

  constructor(records: CollectorRecord[] = [recordFor("OFICINA")]) {
    this.snapshot = { collectorRecords: records.map((record) => ({ ...record })) };
  }

  async saveCollectorRecords(collectorRecords: CollectorRecord[]) {
    if (this.shouldFail) return { ok: false };
    this.snapshot = { collectorRecords: collectorRecords.map((record) => ({ ...record })) };
    return { ok: true };
  }

  async reload() {
    return { collectorRecords: this.snapshot.collectorRecords.map((record) => ({ ...record })) };
  }
}

describe("alta de cobradores con app_snapshots simulado", () => {
  it("crea CORIA, lo persiste y lo recupera para vinculación y asignación de tickets", async () => {
    const supabase = new FakeSupabaseSnapshots();
    const initial = await supabase.reload();
    const created = createCollector({
      isAdmin: true,
      name: "  coria  ",
      collectorRecords: initial.collectorRecords,
      existingCollectorNames: collectorOptions(initial.collectorRecords, []),
      createRecord: recordFor,
    });

    expect(created).toMatchObject({ ok: true, name: "CORIA" });
    if (!created.ok) throw new Error("El cobrador debería haberse creado");
    expect(await supabase.saveCollectorRecords(created.collectorRecords)).toEqual({ ok: true });

    const reloaded = await supabase.reload();
    const selectors = collectorOptions(reloaded.collectorRecords, []);
    const linkedUser = { email: "coria2026@gmail.com", collector_name: "CORIA" };

    expect(selectors).toContain("CORIA");
    expect(selectors).toContain(linkedUser.collector_name);
  });

  it("rechaza vacío y duplicados aunque cambien mayúsculas o espacios", () => {
    const records = [recordFor("CORIA")];
    const options = collectorOptions(records, []);
    for (const name of ["", "   ", "coria", " CORIA ", "CoRiA"]) {
      const result = createCollector({ isAdmin: true, name, collectorRecords: records, existingCollectorNames: options, createRecord: recordFor });
      expect(result.ok).toBe(false);
    }
  });

  it("bloquea el alta a un usuario que no es administrador", () => {
    const result = createCollector({
      isAdmin: false,
      name: "CORIA",
      collectorRecords: [recordFor("OFICINA")],
      existingCollectorNames: ["OFICINA"],
      createRecord: recordFor,
    });

    expect(result).toEqual({ ok: false, reason: "forbidden" });
  });

  it("no confirma persistencia si el guardado del snapshot falla", async () => {
    const supabase = new FakeSupabaseSnapshots();
    supabase.shouldFail = true;
    const before = await supabase.reload();
    const created = createCollector({
      isAdmin: true,
      name: "CORIA",
      collectorRecords: before.collectorRecords,
      existingCollectorNames: collectorOptions(before.collectorRecords, []),
      createRecord: recordFor,
    });

    if (!created.ok) throw new Error("El cobrador debería poder prepararse localmente");
    expect(await supabase.saveCollectorRecords(created.collectorRecords)).toEqual({ ok: false });
    expect(collectorOptions((await supabase.reload()).collectorRecords, [])).not.toContain("CORIA");
  });
});
