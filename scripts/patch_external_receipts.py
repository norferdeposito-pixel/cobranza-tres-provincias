from pathlib import Path

path = Path('src/pages/InsuranceCollections.tsx')
text = path.read_text(encoding='utf-8')

old_policy = '''  const updateReceiptPolicy = (value: string) => {
    const policyNumber = value.replace(/\\D/g, "");
    const affiliate = findReceiptAffiliate(policyNumber, receiptForm.plan);
    if (affiliate) {
      applyReceiptAffiliate(affiliate);
      return;
    }
    setReceiptForm((current) => ({ ...current, policyNumber }));
  };
'''
new_policy = '''  const updateReceiptPolicy = (value: string) => {
    const policyNumber = value.replace(/\\D/g, "");
    const affiliate = findReceiptAffiliate(policyNumber, receiptForm.plan);
    if (affiliate) {
      applyReceiptAffiliate(affiliate);
      return;
    }
    setReceiptForm((current) => ({
      ...current,
      policyNumber,
      fullName: editingReceiptId ? current.fullName : "",
      totalAmount: editingReceiptId ? current.totalAmount : "",
      monthlyAmount: editingReceiptId ? current.monthlyAmount : "",
    }));
  };
'''
if text.count(old_policy) != 1:
    raise SystemExit(f'Bloque updateReceiptPolicy inesperado: {text.count(old_policy)}')
text = text.replace(old_policy, new_policy)

marker = '''  const updateReceiptTotalAmount = (value: string) => {
    setReceiptForm((current) => ({
      ...current,
      totalAmount: value,
      monthlyAmount: calculateReceiptMonthlyAmount(value, current.paidMonths.length),
    }));
  };
'''
replacement = marker + '''

  const updateReceiptMonthlyAmount = (value: string) => {
    setReceiptForm((current) => {
      const monthlyValue = parseMoney(value);
      return {
        ...current,
        monthlyAmount: value,
        totalAmount: monthlyValue && current.paidMonths.length
          ? formatReceiptAmountInput(monthlyValue * current.paidMonths.length)
          : current.totalAmount,
      };
    });
  };
'''
if text.count(marker) != 1:
    raise SystemExit(f'Bloque updateReceiptTotalAmount inesperado: {text.count(marker)}')
text = text.replace(marker, replacement)

old_save = '''    const totalReceiptAmount = parseMoney(receiptForm.totalAmount);
    const monthlyReceiptAmount = parseMoney(receiptForm.monthlyAmount) || (receiptForm.paidMonths.length ? totalReceiptAmount / receiptForm.paidMonths.length : 0);
    if (!totalReceiptAmount || !monthlyReceiptAmount) {
      alert("Colocá el total del recibo para calcular la cuota mensual.");
      return;
    }
'''
new_save = '''    const totalReceiptAmount = parseMoney(receiptForm.totalAmount);
    const monthlyReceiptAmount = parseMoney(receiptForm.monthlyAmount) || (receiptForm.paidMonths.length ? totalReceiptAmount / receiptForm.paidMonths.length : 0);
    if (!receiptForm.fullName.trim()) {
      alert("Colocá el apellido y nombre del afiliado.");
      return;
    }
    if (!receiptForm.policyNumber.trim()) {
      alert("Colocá el número de póliza del recibo.");
      return;
    }
    if (!receiptForm.plan.trim()) {
      alert("Colocá el plan del recibo.");
      return;
    }
    if (!totalReceiptAmount || !monthlyReceiptAmount) {
      alert("Colocá el total del recibo o el monto mensual.");
      return;
    }
'''
if text.count(old_save) != 1:
    raise SystemExit(f'Validacion saveReceipt inesperada: {text.count(old_save)}')
text = text.replace(old_save, new_save)

old_plan = '''                <div className="space-y-2"><Label>Plan</Label><select value={receiptForm.plan} onChange={(event) => updateReceiptPlan(event.target.value as PlanType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{receiptPlanOptions.map((plan) => <option key={plan}>{plan}</option>)}</select></div>
'''
new_plan = '''                <div className="space-y-2">
                  <Label>Plan</Label>
                  {receiptForm.policyNumber.trim() && !selectedReceiptAffiliate ? (
                    <Input
                      value={receiptForm.plan}
                      onChange={(event) => setReceiptForm((current) => ({ ...current, plan: event.target.value.toLocaleUpperCase("es-AR") }))}
                      placeholder="PLAN DEL RECIBO"
                      required
                    />
                  ) : (
                    <select value={receiptForm.plan} onChange={(event) => updateReceiptPlan(event.target.value as PlanType)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{receiptPlanOptions.map((plan) => <option key={plan}>{plan}</option>)}</select>
                  )}
                </div>
'''
if text.count(old_plan) != 1:
    raise SystemExit(f'JSX Plan inesperado: {text.count(old_plan)}')
text = text.replace(old_plan, new_plan)

old_amount = '''                <div className="space-y-2"><Label>Total del recibo</Label><Input value={receiptForm.totalAmount} onChange={(event) => updateReceiptTotalAmount(event.target.value)} required /></div>
                <div className="space-y-2"><Label>Monto mensual</Label><Input readOnly value={receiptForm.monthlyAmount} className="bg-surface-subtle" /></div>
'''
new_amount = '''                <div className="space-y-2"><Label>Total del recibo</Label><Input value={receiptForm.totalAmount} onChange={(event) => updateReceiptTotalAmount(event.target.value)} required /></div>
                <div className="space-y-2">
                  <Label>Monto mensual</Label>
                  <Input
                    value={receiptForm.monthlyAmount}
                    onChange={(event) => updateReceiptMonthlyAmount(event.target.value)}
                    readOnly={!!selectedReceiptAffiliate}
                    className={selectedReceiptAffiliate ? "bg-surface-subtle" : ""}
                    placeholder={selectedReceiptAffiliate ? "" : "MONTO MANUAL"}
                  />
                </div>
'''
if text.count(old_amount) != 1:
    raise SystemExit(f'JSX monto inesperado: {text.count(old_amount)}')
text = text.replace(old_amount, new_amount)

old_warning = '''              {receiptForm.policyNumber.trim() && !selectedReceiptAffiliate && (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  Poliza no encontrada en la base. Se puede guardar igual como recibo manual externo.
                </p>
              )}
'''
new_warning = '''              {receiptForm.policyNumber.trim() && !selectedReceiptAffiliate && (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <p className="font-semibold">Recibo de afiliado externo</p>
                  <p className="mt-1">La póliza no está en la base. Completá manualmente nombre, plan, cobrador, meses y monto. El recibo se guardará normalmente sin crear al afiliado en la base.</p>
                </div>
              )}
'''
if text.count(old_warning) != 1:
    raise SystemExit(f'Aviso externo inesperado: {text.count(old_warning)}')
text = text.replace(old_warning, new_warning)

path.write_text(text, encoding='utf-8')
