from pathlib import Path
import re,json,hashlib
OUT=Path(__file__).resolve().parent; REPO=OUT.parents[1]; (OUT/'artifacts').mkdir(exist_ok=True)
sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
p43=OUT/'fixtures/original43.sql'
p40=REPO/'drizzle/0040_cheques_transacionais.sql'
s43=p43.read_text();s40=p40.read_text()
assert sha(s43)=='5ac45bc8a32d003285fc62c806fe8ce3b86aea205a4f9624758799f543e30d2d'
assert sha(s40)=='d829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af'
names=['ciclo_guardar','legados_guardar','multimodal_guardar','multa36_guardar','multa36_ponte','caixa37_ponte','caixa37_ledger','caixa37_perna_comprovada']
witness=json.loads((OUT/'certification/bridge40-prosrc.json').read_text())
new=s43;delta=[]
for n in names:
 m=re.search(r'CREATE OR REPLACE FUNCTION public\.'+n+r'\(.*?AS (\$\$|\$fn\$)(.*?)\1;',s40,re.S);assert m,n
 h=sha(m.group(2));w=next(x for x in witness if x['nspname']=='public' and x['proname']==n);assert sha(w['prosrc'])==h
 pattern=r'(\{"name":"'+n+r'","args":"[^"]*","hash":")([a-f0-9]{64})(")'
 hits=list(re.finditer(pattern,new));assert len(hits)==2,(n,len(hits));old=hits[0][2];assert hits[1][2]==old
 new=re.sub(pattern,lambda m:m[1]+h+m[3],new)
 delta.append({'name':n,'before42':old,'after40':h,'occurrences':2,'source':str(p40),'liveOfflineWitnessMatches':True})
new=new.replace('-- CANDIDATO43 FINAL OFFLINE. Baseline obrigatório:37 + 42final SHA0df0301a (ponte8 intacta).','-- CANDIDATO43 COMPOSTO PRIVADO OFFLINE. Baseline obrigatório:20..37 ->42final ->41final ->40v2 SHA d829fa99f81b3ec0f023480cad0cdb80a5c704e58c6aed532fc2ad10ec91d1af.')
new=new.replace('-- Quatro funções35 recebem somente ramo43 exato. Ponte8 de42 final integralmente preservada.','-- Quatro funções35 recebem somente ramo43 exato. Ponte8 cumulativa40 integralmente preservada.')
# Inverse substitution proves all executable content except 16 source pins is byte-identical.
inverse=new
for d in delta: inverse=inverse.replace(d['after40'],d['before42'])
assert '\n'.join(inverse.splitlines()[3:])=='\n'.join(s43.splitlines()[3:])
name=OUT/'artifacts/0043_reparcelamento_execucao.sql';name.write_text(new)
assert sha(new)=='8d4bc41efa0ae6917e2f685b2d3e7f6ee293f75a9aef5e07be736cc80d1fc4c7'
assert (REPO/'drizzle/0043_reparcelamento_execucao.sql').read_text()==new
(OUT/'artifacts/regenerated43.json').write_text(json.dumps({'original':str(p43),'originalSha256':sha(s43),'successor':str(name),'successorSha256':sha(new),'onlyExecutableChanges':'16 exact source pin replacements; 8 before + 8 after; no function body changes','pins':delta},indent=2)+'\n')
print(sha(new),name)
