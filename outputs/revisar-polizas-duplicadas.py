import json, pathlib, collections
path = pathlib.Path('outputs/snapshot-restaurado-3057.json')
data = json.loads(path.read_text(encoding='utf-8'))['data']
aff = data['affiliates']
by = collections.defaultdict(list)
for a in aff:
    policy = str(a.get('policyNumber', '')).strip()
    if policy:
        by[policy].append(a)
dup = {p: rows for p, rows in by.items() if len({r.get('plan') for r in rows}) > 1}
print('polizas_con_mas_de_un_plan', len(dup))
print('registros_involucrados', sum(len(v) for v in dup.values()))
for p, rows in sorted(dup.items(), key=lambda kv: (int(kv[0]) if kv[0].isdigit() else 10**12, kv[0])):
    plans = sorted({str(r.get('plan', '')) for r in rows})
    names = sorted({str(r.get('fullName', '')) for r in rows})
    print(p + '\t' + str(len(rows)) + ' registros\tplanes: ' + ' | '.join(plans) + '\tnombres: ' + ' | '.join(names[:4]))
