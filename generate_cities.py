"""
Downloads GeoNames cities15000.txt (all cities with population > 15k, ~23k entries)
and saves data/cities.json keyed by ISO-3166 country code.
Run once: python generate_cities.py
"""
import io
import json
import os
import zipfile
import collections
import requests

URL     = 'https://download.geonames.org/export/dump/cities15000.zip'
OUTFILE = os.path.join(os.path.dirname(__file__), 'data', 'cities.json')

# Feature codes to include (capital, 1st/2nd/3rd order admin seats, populated places)
INCLUDE = {'PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPL', 'PPLA4'}

print('Downloading GeoNames cities15000.zip …')
r = requests.get(URL, timeout=60)
r.raise_for_status()

print('Processing …')
z    = zipfile.ZipFile(io.BytesIO(r.content))
data = z.read('cities15000.txt').decode('utf-8')

by_country = collections.defaultdict(set)
for line in data.splitlines():
    parts = line.split('\t')
    if len(parts) < 15:
        continue
    name         = parts[1].strip()
    country_code = parts[8].strip().upper()
    feature_code = parts[7].strip()
    if name and country_code and feature_code in INCLUDE:
        by_country[country_code].add(name)

result = {cc: sorted(names, key=str.lower) for cc, names in by_country.items()}

os.makedirs(os.path.dirname(OUTFILE), exist_ok=True)
with open(OUTFILE, 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, separators=(',', ':'))

print(f'Saved {OUTFILE}')
print(f'Countries: {len(result)}')
for cc in ('DE', 'MK', 'US', 'GB', 'FR'):
    print(f'  {cc}: {len(result.get(cc, []))} cities')
