from pathlib import Path

path = Path("src/pages/InsuranceCollections.tsx")
text = path.read_text(encoding="utf-8")

old_input = '''                <div className="space-y-2"><Label>N° de póliza</Label><Input value={collectionPolicy} onChange={(event) => setCollectionPolicy(event.target.value)} /></div>'''
new_input = '''                <div className="space-y-2"><Label>N° de póliza</Label><Input value={collectionPolicy} onChange={(event) => { setCollectionPolicy(event.target.value); setMobileSelectedAffiliateId(""); }} /></div>'''
if old_input not in text:
    raise SystemExit("No se encontro el campo de poliza de cobranza")
text = text.replace(old_input, new_input, 1)

anchor = '''              {selectedMonthlyAffiliate && (\n                <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-sm">'''
selector = '''              {selectedMonthlyCandidates.length > 1 && (\n                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3">\n                  <Label htmlFor="collection-affiliate-match">Afiliado de esta póliza</Label>\n                  <select\n                    id="collection-affiliate-match"\n                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"\n                    value={selectedMonthlyAffiliate?.id || ""}\n                    onChange={(event) => {\n                      const affiliateId = event.target.value;\n                      setMobileSelectedAffiliateId(affiliateId);\n                      const affiliate = selectedMonthlyCandidates.find((item) => item.id === affiliateId);\n                      if (affiliate) setCollectionTickets(String(Math.max(0, getPendingTickets(affiliate.id))));\n                    }}\n                  >\n                    {selectedMonthlyCandidates\n                      .slice()\n                      .sort((a, b) => a.fullName.localeCompare(b.fullName, "es-AR") || a.plan.localeCompare(b.plan, "es-AR", { numeric: true }))\n                      .map((affiliate) => (\n                        <option key={affiliate.id} value={affiliate.id}>\n                          {affiliate.fullName} · {affiliate.plan} · {currency.format(affiliate.value)} · {getPendingTickets(affiliate.id)} pend.\n                        </option>\n                      ))}\n                  </select>\n                  <p className="mt-2 text-xs font-medium text-amber-900">\n                    Esta póliza corresponde a más de un afiliado. Elegí a quién se le va a registrar el cobro.\n                  </p>\n                </div>\n              )}\n              {selectedMonthlyAffiliate && (\n                <div className="mt-4 rounded-md border bg-surface-subtle p-3 text-sm">'''
if anchor not in text:
    raise SystemExit("No se encontro el bloque del afiliado seleccionado")
text = text.replace(anchor, selector, 1)

old_warning = '''                  {selectedMonthlyCandidates.length > 1 && (\n                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">\n                      Esta póliza tiene {selectedMonthlyCandidates.length} registros. Se toma el que tiene tickets pendientes.\n                    </p>\n                  )}'''
new_warning = '''                  {selectedMonthlyCandidates.length > 1 && (\n                    <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">\n                      Seleccionado: {selectedMonthlyAffiliate.fullName} · {selectedMonthlyAffiliate.plan}.\n                    </p>\n                  )}'''
if old_warning not in text:
    raise SystemExit("No se encontro el aviso de poliza duplicada")
text = text.replace(old_warning, new_warning, 1)

path.write_text(text, encoding="utf-8")
print("Correccion aplicada: selector para polizas con mas de un afiliado")
