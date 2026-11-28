from pathlib import Path
import re,hashlib
p=Path(__file__).resolve().parents[2]/'drizzle/0067_lista_controles_organizacao.sql'
s=p.read_text()
for m in list(re.finditer(r'CREATE FUNCTION ([\w.]+)\((.*?)\) RETURNS .*? AS \$\$(.*?)\$\$;',s,re.S)):
 name,args,body=m.groups()
 sha=hashlib.sha256(body.encode()).hexdigest()
 pattern=r"(p\.oid='"+re.escape(name)+r"\([^']*\)'::regprocedure AND encode\(extensions\.digest\(p\.prosrc,'sha256'\),'hex'\)=')[a-f0-9]{64}(')"
 s,n=re.subn(pattern,lambda x:x[1]+sha+x[2],s)
 assert n==1,(name,n)
p.write_text(s)
print('67 only new bodies pinned from current source')
