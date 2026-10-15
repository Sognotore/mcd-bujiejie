"""Refresh the public mainland China reference data; no account or MCP token used."""
from pathlib import Path
from urllib.request import Request, urlopen
from datetime import datetime, timezone
import hashlib, json, re, math

URL = 'https://www.mcdonalds.com.cn/nutrition_calculator'
root = Path(__file__).resolve().parent.parent
raw = urlopen(Request(URL, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read().decode()
match = re.search(r'var raw_data\s*=\s*', raw)
if not match:
    raise ValueError('Official nutrition format changed; review before importing')
data = json.JSONDecoder().raw_decode(raw[match.end():])[0]
updated = re.search(r'上述营养成分数据更新时间为(\d{4})年(\d+)月', raw)
if not updated:
    raise ValueError('Missing official reference update date')
records = []
for product in data['Product'].values():
    for variant_id in product['ProductType']:
        variant = data['ProductType'][variant_id]
        values = [float(value) for value in variant['nutrition']]
        if len(values) < 14 or any(not math.isfinite(value) or value < 0 for value in values):
            raise ValueError('Invalid official nutrient values')
        records.append({'key': product['id'] + ':' + variant_id, 'name': product['title'], 'serving': variant['title'],
                        'energyKj': values[1], 'proteinG': values[2], 'fatG': values[3],
                        'carbG': values[4], 'sodiumMg': values[5], 'calciumMg': values[13]})
metadata = {'sourceUrl': URL, 'market': '中国大陆', 'referenceUpdated': f'{updated[1]}-{int(updated[2]):02}',
            'retrievedAt': datetime.now(timezone.utc).isoformat(), 'productCount': len(data['Product']),
            'servingCount': len(records), 'sourceSha256': hashlib.sha256(json.dumps(data, ensure_ascii=False, sort_keys=True).encode()).hexdigest()}
target = root / 'src/domain/nutrition-data.mjs'
target.write_text('// Mainland China official standard-recipe reference; not a live availability list.\n'
                  + 'export const nutritionSource=' + json.dumps(metadata, ensure_ascii=False, separators=(',', ':')) + ';\n'
                  + 'export const nutritionRecords=' + json.dumps(records, ensure_ascii=False, indent=1) + ';\n')
(root / '.local').mkdir(exist_ok=True)
(root / '.local/nutrition-source.json').write_text(json.dumps(data, ensure_ascii=False))
print(f'Imported {len(records)} serving records from {URL}; reference date {metadata["referenceUpdated"]}')
