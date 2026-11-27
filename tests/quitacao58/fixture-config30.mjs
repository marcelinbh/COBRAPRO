// NEW local fixture only, before connecting owner and before all predecessor seals.
// No checker/runtime/source changes, no online reseal, no production action.
export async function configure({bootstrap,profile,assert,save,result}) {
 const expected=profile==='private'?{"anon":null,"authenticated":null,"postgres":null,"service_role":null}:{"anon":["statement_timeout=3s"],"authenticated":["statement_timeout=8s"],"postgres":["search_path=\"\\$user\", public, extensions"],"service_role":null};
 if(profile==='supabase')await bootstrap.query("ALTER ROLE anon SET statement_timeout TO '3s'; ALTER ROLE authenticated SET statement_timeout TO '8s'; ALTER ROLE postgres SET search_path TO \"\\$user\", public, extensions; ALTER DATABASE postgres SET app.settings.jwt_exp TO '3600';");
 const roles=(await bootstrap.query("SELECT rolname,rolconfig FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role') ORDER BY rolname LIMIT 4")).rows;
 assert.deepEqual(Object.fromEntries(roles.map(x=>[x.rolname,x.rolconfig])),expected);
 const actual=(await bootstrap.query("SELECT coalesce(jsonb_agg(jsonb_build_object('database_name',CASE WHEN s.setdatabase=0 THEN '*' ELSE d.datname END,'role_name',CASE WHEN s.setrole=0 THEN '*' ELSE r.rolname END,'setconfig',to_jsonb(s.setconfig)) ORDER BY CASE WHEN s.setdatabase=0 THEN '*' ELSE d.datname END,CASE WHEN s.setrole=0 THEN '*' ELSE r.rolname END),'[]'::jsonb)\n FROM pg_db_role_setting s LEFT JOIN pg_database d ON d.oid=s.setdatabase LEFT JOIN pg_roles r ON r.oid=s.setrole\n WHERE r.rolname IN('postgres','service_role','anon','authenticated') OR (s.setrole=0 AND (s.setdatabase=0 OR s.setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database())));")).rows[0].coalesce;
 assert.deepEqual(actual,profile==='private'?[]:[{"database_name":"*","role_name":"anon","setconfig":["statement_timeout=3s"]},{"database_name":"*","role_name":"authenticated","setconfig":["statement_timeout=8s"]},{"database_name":"*","role_name":"postgres","setconfig":["search_path=\"\\$user\", public, extensions"]},{"database_name":"postgres","role_name":"*","setconfig":["app.settings.jwt_exp=3600"]}]);
 result.explicitRoleConfigFixture={profile,beforeOwnerConnection:true,beforeAllPredecessorSeals:true,privateOnly:true,production:false,roles,settings:actual,checkerOrRuntimeChanged:false,onlineReseal:false};
 save('roleconfig-fixture30.json',result.explicitRoleConfigFixture);
 console.log('PASS30 EXPLICIT CONFIG FIXTURE '+profile);
}
