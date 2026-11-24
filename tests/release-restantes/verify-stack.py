from pathlib import Path
import json,hashlib
S=Path(__file__).resolve().parent;R=S.parents[1]
for p,h in json.loads((S/'stack-pins.json').read_text()).items():
 assert hashlib.sha256((R/p).read_bytes()).hexdigest()==h,p+' hash mismatch'
print('PASS exact cumulative SQL stack20..37 ->42 ->41 ->40 ->43-composed ->44 ->38c ->45; no lexicographic installation')
