import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const month = new Date().toISOString().slice(0, 7);
type Snapshot = Record<string, unknown>;
let snapshot: Snapshot;
let version: string;
let writes = 0;
let conflictWrites = 0;
let rejectWrites = 0;
let loseResponseWrites = 0;

const result = () => ({ data: { data: snapshot, updated_at: version }, error: null });

function appSnapshotQuery() {
  let updatePayload: { data: Snapshot; updated_at: string } | null = null;
  const query: any = {
    select: () => query,
    eq: () => query,
    maybeSingle: async () => {
      if (!updatePayload) return result();
      if (rejectWrites > 0) {
        rejectWrites -= 1;
        return { data: null, error: { message: "network failure" } };
      }
      if (conflictWrites > 0) {
        conflictWrites -= 1;
        version = `remote-${Date.now()}-${writes}`;
        snapshot = { ...snapshot, ticketCollections: [...(snapshot.ticketCollections as any[]), { id: `other-${writes}`, affiliateId: "other", month, ticketsCharged: 1 }] };
        return { data: null, error: null };
      }
      snapshot = updatePayload.data;
      version = `v-${++writes}`;
      if (loseResponseWrites > 0) {
        loseResponseWrites -= 1;
        return { data: null, error: { message: "response lost" } };
      }
      return { data: { updated_at: version }, error: null };
    },
    update: (payload: { data: Snapshot; updated_at: string }) => { updatePayload = payload; return query; },
  };
  return query;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => table === "app_snapshots" ? appSnapshotQuery() : ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }), order: async () => ({ data: [], error: null }) }), delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));
vi.mock("@/contexts/UserProfileContext", () => ({
  useCurrentUserProfile: () => ({ currentUserProfile: { nombre: "TEST", rol: "admin" }, email: "test@example.com", signOut: async () => {} }),
}));

import InsuranceCollections from "./InsuranceCollections";

const affiliate = { id: "a1", fullName: "OMAR TEST", policyNumber: "OMAR-1", plan: "A 238", value: 100, phone: "", address: "", dependency: "", collector: "OFICINA", request: "", latestNews: "", selectedForMonthly: true };
const baseSnapshot = (): Snapshot => ({ affiliates: [affiliate], monthlyItems: [{ affiliateId: "a1", month, tickets: 10 }], monthlyNewPolicyIds: {}, ticketCollections: [], ticketReturnControls: [], receipts: [], notes: [], rendition: { cashRenders: [], transferRenders: [] }, cashMovements: [], cashOpeningBalances: [], cashTurnNotes: [], cashTurnClosures: [], affiliateCorrectionAudits: [], collectorRecords: ["OFICINA"], customDependencies: [], collectorWhatsapp: "", activeMonth: month });

async function openForm() {
  render(<InsuranceCollections />);
  await waitFor(() => expect(screen.getByText(/Datos online cargados/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText("Cobranza", { exact: true }));
  const policy = document.querySelector("form input") as HTMLInputElement;
  fireEvent.change(policy, { target: { value: "OMAR-1" } });
  await screen.findByText("OMAR TEST");
}
async function saveOnce() { fireEvent.click(screen.getByRole("button", { name: "Guardar cobro" })); await waitFor(() => expect(screen.getByText(/Tickets guardados online/i)).toBeInTheDocument()); }

beforeEach(() => { snapshot = baseSnapshot(); version = "v-0"; writes = 0; conflictWrites = 0; rejectWrites = 0; loseResponseWrites = 0; });

describe("regresión de cobranza con Supabase simulado", () => {
  it("persiste cinco cobros consecutivos desde el formulario sin duplicar", async () => {
    await openForm();
    for (let i = 0; i < 5; i += 1) await saveOnce();
    expect(snapshot.ticketCollections).toHaveLength(5);
    expect(new Set((snapshot.ticketCollections as any[]).map((x) => x.id)).size).toBe(5);
  });

  it("bloquea doble clic y deja un solo cobro", async () => {
    await openForm();
    const button = screen.getByRole("button", { name: "Guardar cobro" });
    fireEvent.click(button); fireEvent.click(button);
    await waitFor(() => expect(snapshot.ticketCollections).toHaveLength(1));
    expect(snapshot.cashMovements).toHaveLength(0);
  });

  it("ante fallo libera el formulario y conserva sus datos", async () => {
    rejectWrites = 1;
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cobro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/formulario quedó disponible/i));
    expect(screen.getByRole("button", { name: "Guardar cobro" })).toBeEnabled();
    expect(document.querySelector("form input")).toHaveValue("OMAR-1");
  });

  it("reintenta conflicto preservando el cobro concurrente", async () => {
    conflictWrites = 1;
    await openForm(); await saveOnce();
    expect((snapshot.ticketCollections as any[]).map((x) => x.id)).toContain("other-0");
    expect(snapshot.ticketCollections).toHaveLength(2);
  });

  it("reconoce el mismo ID después de una respuesta perdida", async () => {
    loseResponseWrites = 1;
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cobro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cobro" }));
    await waitFor(() => expect(screen.getByText(/Tickets guardados online/i)).toBeInTheDocument());
    expect(snapshot.ticketCollections).toHaveLength(1);
    expect(new Set((snapshot.ticketCollections as any[]).map((item) => item.id)).size).toBe(1);
  });

  it("agota conflictos y deja el formulario disponible", async () => {
    conflictWrites = 3;
    await openForm();
    fireEvent.click(screen.getByRole("button", { name: "Guardar cobro" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/formulario quedó disponible/i));
    expect(screen.getByRole("button", { name: "Guardar cobro" })).toBeEnabled();
  });
});
