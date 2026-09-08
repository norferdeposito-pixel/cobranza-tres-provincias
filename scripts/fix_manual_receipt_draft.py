from pathlib import Path

path = Path('src/pages/InsuranceCollections.tsx')
text = path.read_text(encoding='utf-8')
old = '''    setReceiptForm((current) => ({
      ...current,
      policyNumber,
      fullName: editingReceiptId ? current.fullName : "",
      totalAmount: editingReceiptId ? current.totalAmount : "",
      monthlyAmount: editingReceiptId ? current.monthlyAmount : "",
    }));'''
new = '''    setReceiptForm((current) => ({
      ...current,
      policyNumber,
    }));'''
if old not in text:
    raise SystemExit('No se encontro el bloque esperado; no se modifico el archivo.')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Correccion aplicada: los datos manuales se conservan al escribir/corregir la poliza.')
