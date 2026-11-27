SELECT jsonb_build_object(
 'namespaces',(SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.oid),'[]'::jsonb) FROM pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'relations',(SELECT coalesce(jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid),'[]'::jsonb) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'attributes',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum),'[]'::jsonb) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'constraints',(SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.oid),'[]'::jsonb) FROM pg_constraint k JOIN pg_namespace n ON n.oid=k.connamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'defaults',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) FROM pg_attrdef d JOIN pg_class c ON c.oid=d.adrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'indexes',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.indexrelid),'[]'::jsonb) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'sequenceConfig',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid),'[]'::jsonb) FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'types',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema'),
 'defaultACL',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.oid),'[]'::jsonb) FROM pg_default_acl a),
 'roles',(SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.oid),'[]'::jsonb) FROM pg_roles r),
 'memberships',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY m.oid),'[]'::jsonb) FROM pg_auth_members m),
 'roleDatabaseConfig',(SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.setdatabase,s.setrole),'[]'::jsonb) FROM pg_db_role_setting s),
 'databaseACL',(SELECT jsonb_build_object('oid',d.oid,'datname',d.datname,'datdba',d.datdba,'datacl',d.datacl,'datallowconn',d.datallowconn,'datconnlimit',d.datconnlimit,'datistemplate',d.datistemplate) FROM pg_database d WHERE d.datname=current_database()),
 'extensionFunctions',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='extensions'),
 'settings',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',s.name,'setting',s.setting,'unit',s.unit,'source',s.source,'reset_val',s.reset_val,'pending_restart',s.pending_restart) ORDER BY s.name),'[]'::jsonb) FROM pg_settings s)
);
