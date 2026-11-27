-- Incremento60: leitura dedicada da lista. Nenhuma função original/ação financeira alterada.
BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;
DO $pre60$ BEGIN
 IF current_user<>'postgres' OR current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION '60 instalador/contexto não autorizado' USING ERRCODE='55000';END IF;
 IF to_regnamespace('emprestimos_lista60') IS NOT NULL OR to_regprocedure('public.rpc_lista_emprestimos60(integer)') IS NOT NULL THEN RAISE EXCEPTION '60 já instalado ou superfície desconhecida' USING ERRCODE='55000';END IF;
 IF (SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls,rolcanlogin) ORDER BY rolname) FROM pg_roles WHERE rolname IN('postgres','anon','authenticated','service_role')) NOT IN(
 '[ ["anon",false,false,false],["authenticated",false,false,false],["postgres",false,false,true],["service_role",false,false,false]]'::jsonb,
 '[ ["anon",false,false,false],["authenticated",false,false,false],["postgres",false,true,true],["service_role",false,true,false]]'::jsonb) THEN RAISE EXCEPTION '60 perfil de roles desconhecido' USING ERRCODE='55000';END IF;
 PERFORM public.legados_verificar();
 PERFORM public.multimodal_verificar();
 PERFORM public.multa36_verificar();
 PERFORM public.caixa37_verificar();
 PERFORM despesa_cancelamento_v1.verificar();
 PERFORM telefone41.verificar();
 PERFORM manutencao44.verificar();
 PERFORM caixa_manutencao45.verificar();
 PERFORM calendario46.verificar();
 PERFORM private47.verificar();
 PERFORM manutencao48.verificar();
 PERFORM despesas49.verificar();
 PERFORM obrigacoes51.verificar();
 PERFORM inclusao52.verificar();
 PERFORM sucessores53.verificar();
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.dia(text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '4d54c66d83bb6a451ed957ce400f937e0591bdda683a7f0b8b1f16abf621f541' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.dia' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.dinheiro(text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '47302aaabd643d87d45d1447eb73318930c5fc8db841d00196b60cb13eb4300c' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.dinheiro' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.id(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'd983abb4e502916dfcc07ae8088f6c1aba7c5e35ff60b47da5ff7b596bfc2f41' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.id' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.proposta(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '6d2775c93ea38574555f9d6f83ee6d0d3557df0db3c57d8b899cf793b628ba81' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.proposta' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_data(date,text,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'de590009d69281ba942b0a74d8c3c60197e5cceee41bac6297c224d3ea323ccb' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_data' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_moeda(numeric)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '598fc912a15224ad6dd9bbfa33456c7f07190a329b6e2d373d979b812a42dbf9' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_moeda' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='inclusao52.plano(jsonb,jsonb,timestamptz,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '7d63b4eea6064a40897a7a2f72c3a0ba23dc74fc6b8961dbffde4c02ff9c3e75' THEN RAISE EXCEPTION '60 origem pinada divergente: inclusao52.plano' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.fechar(integer,uuid,jsonb,uuid,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'ee49208f6e5b6a02f17e4f06094a180cbbe339687b169f680a7dc17b9b0ff57e' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.fechar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.hash(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'ad95c9ac0f3d569429a85b97b2ae3db0e8d022019eb2f330f19043bfc0030f4d' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.hash' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.request(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'b58dca9d771b58faed9bf3c9b301471ec37a1406a03f8349b51ade8940550b3f' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.request' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='inclusao52.provar(uuid)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '6c838ab5d648b71fcb337681ad86c0dd48ed92379376074e79df3e228fe50a6a' THEN RAISE EXCEPTION '60 origem pinada divergente: inclusao52.provar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='manutencao48.proposta(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '62b08b06949ebd44eb0fe64e79d0727d11516fb35bc41ee974fd6207822261b9' THEN RAISE EXCEPTION '60 origem pinada divergente: manutencao48.proposta' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='manutencao48.request(integer,text,jsonb,text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '95284be5040ea050afdaf5cea1acc973ec456db07b54b0cab4ad552e464698a9' THEN RAISE EXCEPTION '60 origem pinada divergente: manutencao48.request' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_payload(integer,text,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '7299cfc6959b4f8b27e788cdfdde3de9f31730904832fc3110e32eb29072e841' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_payload' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='inclusao52.provar35(uuid)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '683de1daec82f41ab882c21ce3d2c4de2cd2677c8c753aae2047d43b2512376b' THEN RAISE EXCEPTION '60 origem pinada divergente: inclusao52.provar35' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='manutencao44.agenda(integer,date[],date,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'a41ea8cd91801a6b066ab8ee789935f6e39170c3ce62804a9ffb80ae2ebec9fc' THEN RAISE EXCEPTION '60 origem pinada divergente: manutencao44.agenda' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='manutencao44.request(integer,text,date[],text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '9f00d4d0e8c807060493e6e2e015d50988ac28e5809d469eaa3469e4618fa786' THEN RAISE EXCEPTION '60 origem pinada divergente: manutencao44.request' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.plano(jsonb,jsonb,timestamptz,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'cb575b453113ccbe2e5a0baed27d3e7183f396d9c87878329fd9fa67fe5832af' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.plano' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='manutencao48.plano(jsonb,jsonb,timestamptz)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'b031e7cebc69e0d4e796556a665459bfe316d53ef069daaca5fc5a6361560c53' THEN RAISE EXCEPTION '60 origem pinada divergente: manutencao48.plano' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.registrada(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'd367c97f6ebca0e3f47d9376b5ed42fc476d400ad3c97550b5b70b987ef79c8c' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.registrada' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.eventos_leitura(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'e6fbe9c6a8823c8de858d76b4482e3d06033c5779f6ebf405c961fd52da92b70' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.eventos_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.moeda_leitura(numeric)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'e1aa796fcba97654b7075faf798708c0222ba3f2081b75d2e7ae96c64ce550fb' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.moeda_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.registrada_leitura(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '12c57deb18a94f2b087959f4919e54811287932f32b7de5ff6d35662f58fcdfe' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.registrada_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.vinculos_leitura(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '98808a1d2dd74489b6542071d6f65d5944b9a708fa0b3486823d7cb99f3b5899' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.vinculos_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.travar_leitura(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'acd1c8db8d684548a1fc68a00603de6b1def56fe90ef7c54877230c6d88ae167' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.travar_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='private47.hash(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'ad95c9ac0f3d569429a85b97b2ae3db0e8d022019eb2f330f19043bfc0030f4d' THEN RAISE EXCEPTION '60 origem pinada divergente: private47.hash' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_calcular(text,numeric,numeric,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '1cc63f5b6daa602ec4fb5da538f38322388f599321b3edebbe95eb8460bd2922' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_calcular' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='private47.estado_auditado(integer,integer,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '6ea5cd3f887aad54a2a9c1d35a888d18643d64f29a35dd69a780dfe76e781c3d' THEN RAISE EXCEPTION '60 origem pinada divergente: private47.estado_auditado' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_snapshot(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '270dd6a909af9599ca422550cee90fd520b47643a7d0555516d037ff11dff794' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_snapshot' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='private47.validar_op(uuid)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'bc8b5b6f3b6b9a2f8e7a99980019209cc6847932a21332f79cd04447b3c14fc4' THEN RAISE EXCEPTION '60 origem pinada divergente: private47.validar_op' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.vinculos(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '08dd5ebaf5e5f1022d3f41ece9f2d5042cd6196850f42774dc3d3851968ca5d3' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.vinculos' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.closure(integer,uuid,jsonb,uuid,text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'fe345d9368f9e432f30bda2fb8d9e91b50bf08eaa99006e0d03ad51f8aa6d129' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.closure' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.hash(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'ad95c9ac0f3d569429a85b97b2ae3db0e8d022019eb2f330f19043bfc0030f4d' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.hash' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.abertas(integer,jsonb,timestamptz)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '0303303e1a0b2e9802ceacdd1eecc0aa8bfdfb010f414a193286bf22fb4a1291' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.abertas' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.proposta(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '95a55ed6cf71ab4287c6456a79f56e2c87cccd83d5dbfadc62ef336b8ae5f592' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.proposta' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.plano(integer,jsonb,jsonb,timestamptz,uuid,text,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'e9a6d7e6bdb9bfb8c4e8c19ad6851b849011ae9deb7f002eda936cae9b5fbc89' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.plano' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.ciclo_encargos(numeric,numeric,numeric,date,timestamptz)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'd3487e4663c8d2a5f917cf1e61a9d00c4314de10e48c5c2db0da40155c227dd1' THEN RAISE EXCEPTION '60 origem pinada divergente: public.ciclo_encargos' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.recebimento(integer,integer,jsonb,public.multimodal_operacoes)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '980633498683ee53e9db7d3e2997eabddc4877882f254bd3e1d2cec660196a79' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.recebimento' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.request(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'df1b701fcbe8b88eacc32aae14df3aeedd2e57b88af5672313cfbde40d5ce732' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.request' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='sucessores53.replay(integer,integer,jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8133b4115294993add1d73782e6c26bf7f7639571a62dceeae06b7ddfb3056c8' THEN RAISE EXCEPTION '60 origem pinada divergente: sucessores53.replay' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='private47.validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '644b1e8cc8f6a2657545ec68adf2d3776d30e4ce9da1154302231363b4ad3fac' THEN RAISE EXCEPTION '60 origem pinada divergente: private47.validar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.ciclo_snapshot(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '5573383b340f3d434d9f68d1b450eddd1d32b1d236a705fc818a57f2ca6333bd' THEN RAISE EXCEPTION '60 origem pinada divergente: public.ciclo_snapshot' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.ciclo_validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'd7c746affad83bf7200a5fe45577f746e2f16e662215efcdfa10e36915d67ea2' THEN RAISE EXCEPTION '60 origem pinada divergente: public.ciclo_validar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.legados_snapshot(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '22c82078375404e314bbcf5b6385e645d4580b6461f8e27ccba85e77191e5755' THEN RAISE EXCEPTION '60 origem pinada divergente: public.legados_snapshot' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multa36_snapshot(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '360a5f322515eced3bed4077d38cda5e7d206f1edaf160a57029dc58726dd66d' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multa36_snapshot' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multa36_vinculos(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '1208cb15649978c2cd34164903d160ceae9631e057ab7459fa5b145af58f3911' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multa36_vinculos' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multa36_validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8d1daa4e9476ebd95ce6e85e747571063dbc043c7c2d1a33b341ba6166a0a655' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multa36_validar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.reparcelamento43_snapshot(integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '9598f6127c820c3ad7f0051a1e8f4aebb55e7ff854695262e6cb94fc0f712aa6' THEN RAISE EXCEPTION '60 origem pinada divergente: public.reparcelamento43_snapshot' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.reparcelamento43_validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'e3713f9e4b4c8b4bd555fe4f56cff05e9fc17484b8a0dfc4e51e91f5f420e2cb' THEN RAISE EXCEPTION '60 origem pinada divergente: public.reparcelamento43_validar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_decimal(numeric)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '24a10a0ef443414c673f47e8fea8769f35288bea62477035d5c2597515bcb97a' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_decimal' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_hash(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'ad95c9ac0f3d569429a85b97b2ae3db0e8d022019eb2f330f19043bfc0030f4d' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_hash' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_dinheiro(text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8252280e7fbb0650f309fefedd104da71e58226ca15a010a61abb6e5e43b248b' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_dinheiro' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_intencao(text,integer,integer,text,text)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '4aa97316e745786361a373bb14bc1942ec579519faec1495a48b5806f2d28ea8' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_intencao' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_request(jsonb)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8095192113b8ec70318d3e527108d9f9690cb50fc1f2d4e7dc3300061c1b689c' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_request' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_validar_op(uuid)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '39202100ec2fefc00d5d9adb37232f1a1debc3d83d3a517a729fef7d6c966385' THEN RAISE EXCEPTION '60 origem pinada divergente: public.caixa37_validar_op' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.reparcelamento43_validar_conta(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8fbd79d18bc582f4e689cbcf6f7ed32cbbae23e43a93a1f43e75c05eacd7824b' THEN RAISE EXCEPTION '60 origem pinada divergente: public.reparcelamento43_validar_conta' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.reparcelamento43_validar_recebimento(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '85c05e352ae9d81e9fcc83a4b8b8c3aeb764acea262c349acb3a5541c773df66' THEN RAISE EXCEPTION '60 origem pinada divergente: public.reparcelamento43_validar_recebimento' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multimodal_validar(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '8c580aa77c29a79cd0199727662ebbdca7da40288e29e139100e3afcfea65452' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multimodal_validar' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.validar_leitura(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '4b2cd09d5affbc4c07ae4b0bf506452c08ca47d9d1f3ccbe97028dec4c3320ab' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.validar_leitura' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='obrigacoes51.estado(integer,integer)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'cbdb504680ef4d27df0ed4b7171354545c3c6c8c3c152f3d98090f8ddfde971b' THEN RAISE EXCEPTION '60 origem pinada divergente: obrigacoes51.estado' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.multa36_cotacao(integer,integer,integer,timestamptz)'::regprocedure),'sha256'),'hex') IS DISTINCT FROM 'bcb0ef3ca7f7cf434055bf107005eac2ef1b3850ee365b7d1f5c3b705ad896ed' THEN RAISE EXCEPTION '60 origem pinada divergente: public.multa36_cotacao' USING ERRCODE='55000';END IF;
 IF encode(extensions.digest((SELECT prosrc FROM pg_proc WHERE oid='public.caixa37_metadata()'::regprocedure),'sha256'),'hex') IS DISTINCT FROM '088bced7e8df832b95b32a44f83c2d19450eaa076c487179df54b410dd224280' THEN RAISE EXCEPTION '60 expressão37 não pinada' USING ERRCODE='55000';END IF;
END $pre60$;
CREATE TEMP TABLE witness60_functions AS SELECT oid,to_jsonb(p) row FROM pg_proc p;
CREATE TEMP TABLE witness60_data (rel text PRIMARY KEY,hash text);
DO $data60$ DECLARE t record; h text; projection text; BEGIN
 FOR t IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname NOT LIKE 'pg_%' AND n.nspname NOT IN('information_schema','extensions') AND n.nspname||'.'||c.relname=ANY(ARRAY['caixa_manutencao45.operacoes','despesa_cancelamento_v1.fences','despesa_cancelamento_v1.flags','despesa_cancelamento_v1.operacoes','despesas49.flags','despesas49.operacoes','manutencao44.fences','manutencao44.operacoes','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.fences','obrigacoes51.operacoes','private47.cadeia','private47.capacidades','private47.cotacoes','private47.fences','private47.flags','private47.operacoes','private47.recebimentos','public.assinaturas','public.assinaturas42_capacidades','public.assinaturas42_fences','public.assinaturas42_operacoes','public.auditoria_financeira','public.caixa37_capacidades','public.caixa37_coexistencia','public.caixa37_contas','public.caixa37_fences','public.caixa37_operacoes','public.caixa37_pernas','public.cheques','public.cheques40_ausencias','public.cheques40_capacidades','public.cheques40_contas','public.cheques40_operacoes','public.cheques40_origens','public.ciclo_autorizacoes','public.ciclo_despesas_autorizacoes','public.ciclo_estados','public.ciclo_operacoes','public.ciclo_pernas','public.clientes','public.contas_caixa','public.contas_pagar','public.contrato_historico','public.contratos','public.despesas_rpc_operacoes','public.despesas_rpc_origens','public.despesas_rpc_pagamentos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.financial_intent_fences','public.koletores','public.legados_auditoria','public.legados_capacidades','public.legados_estados','public.legados_operacoes','public.multa36_capacidades','public.multa36_coexistencia','public.multa36_encargos','public.multa36_estados','public.multa36_fences','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_autorizacoes','public.multimodal_coexistencia','public.multimodal_estados','public.multimodal_fences','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.operacoes_financeiras','public.pagamentos_assinatura','public.parcelas','public.parcelas_venda_telefone','public.renovacao_capacidades','public.renovacao_operacoes','public.renovacao_provas','public.reparcelamento43_cadeia','public.reparcelamento43_capacidades','public.reparcelamento43_estados','public.reparcelamento43_fences','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.vendas_telefone','telefone41.capacidades','telefone41.fences','telefone41.operacoes','telefone41.origens','telefone41.pernas','telefone41.ponte_capacidades','public.legados_manifesto','public.multimodal_manifesto','public.multa36_manifesto','public.caixa37_manifesto','despesa_cancelamento_v1.manifesto','telefone41.manifesto','manutencao44.manifesto','caixa_manutencao45.manifesto','calendario46.manifesto','private47.manifesto','manutencao48.manifesto','despesas49.manifesto','obrigacoes51.manifesto','inclusao52.manifesto','sucessores53.manifesto']) ORDER BY n.nspname,c.relname LOOP
  projection:=CASE WHEN t.nspname='public' AND t.relname='caixa37_manifesto' THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %I.%I x',projection,projection,t.nspname,t.relname) INTO h;
  INSERT INTO witness60_data VALUES(t.nspname||'.'||t.relname,h);
 END LOOP;
END $data60$;
CREATE TEMP TABLE witness60_seal AS SELECT assinatura FROM public.caixa37_manifesto WHERE id=1;
CREATE SCHEMA emprestimos_lista60 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA emprestimos_lista60 FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION emprestimos_lista60.obrigacoes51__dia(s text) RETURNS date STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ DECLARE d date; BEGIN IF s IS NULL OR s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RAISE EXCEPTION '51 DATE civil obrigatória' USING ERRCODE='22023'; END IF; d:=s::date; IF NOT isfinite(d) OR d NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR d::text<>s THEN RAISE EXCEPTION '51 DATE inválida' USING ERRCODE='22023'; END IF; RETURN d; END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__dinheiro(s text) RETURNS numeric STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ BEGIN IF s IS NULL OR s !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' THEN RAISE EXCEPTION '51 centavos textuais exatos obrigatórios' USING ERRCODE='22023'; END IF; RETURN s::numeric; END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__id(j jsonb) RETURNS integer STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ BEGIN IF jsonb_typeof(j) IS DISTINCT FROM 'number' OR j::text !~ '^[1-9][0-9]{0,9}$' OR j::numeric>2147483647 THEN RAISE EXCEPTION '51 ID int32 positivo obrigatório' USING ERRCODE='22023'; END IF; RETURN j::text::integer; END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__proposta(v jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE a text:=v->>'acao'; target jsonb; expected jsonb; amount numeric;
BEGIN
 IF v IS NULL OR jsonb_typeof(v) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION '51 proposta estrita obrigatória' USING ERRCODE='22023'; END IF;
 IF a='adicionar' THEN
 expected:=jsonb_build_object('acao',a,'valor',v->>'valor','dataVencimento',v->>'dataVencimento','classificacao','obrigacao_adicional_nao_desembolsada');amount:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'valor');PERFORM emprestimos_lista60.obrigacoes51__dia(v->>'dataVencimento');IF amount<=0 THEN RAISE EXCEPTION '51 valor positivo obrigatório' USING ERRCODE='22023';END IF;
 ELSIF a='editar' THEN
 expected:=jsonb_build_object('acao',a,'parcelaId',emprestimos_lista60.obrigacoes51__id(v->'parcelaId'));
 IF v ? 'novoValor' THEN amount:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'novoValor');IF amount<=0 THEN RAISE EXCEPTION '51 valor positivo obrigatório' USING ERRCODE='22023';END IF;expected:=expected||jsonb_build_object('novoValor',v->>'novoValor');END IF;
 IF v ? 'novaDataVencimento' THEN PERFORM emprestimos_lista60.obrigacoes51__dia(v->>'novaDataVencimento');expected:=expected||jsonb_build_object('novaDataVencimento',v->>'novaDataVencimento');END IF;
 IF NOT(v ? 'novoValor' OR v ? 'novaDataVencimento') THEN RAISE EXCEPTION '51 valor e/ou data obrigatórios' USING ERRCODE='22023';END IF;
 ELSIF a IN('cancelar','arquivar') THEN
 target:=CASE v->'alvo'->>'tipo' WHEN 'contrato' THEN jsonb_build_object('tipo','contrato') WHEN 'parcela' THEN jsonb_build_object('tipo','parcela','parcelaId',emprestimos_lista60.obrigacoes51__id(v->'alvo'->'parcelaId')) ELSE NULL END;
 IF target IS NULL OR target IS DISTINCT FROM v->'alvo' THEN RAISE EXCEPTION '51 alvo fechado inválido' USING ERRCODE='22023';END IF;
 expected:=jsonb_build_object('acao',a,'alvo',target);IF a='cancelar' THEN expected:=expected||jsonb_build_object('reconhecoSemEstorno',true);END IF;
 ELSIF a='quitar' THEN amount:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'valorRecebido');IF amount<=0 THEN RAISE EXCEPTION '51 dinheiro real positivo obrigatório' USING ERRCODE='22023';END IF;expected:=jsonb_build_object('acao',a,'contaCaixaId',emprestimos_lista60.obrigacoes51__id(v->'contaCaixaId'),'valorRecebido',v->>'valorRecebido','reconhecoDinheiroReal',true);
 ELSE RAISE EXCEPTION '51 ação inválida' USING ERRCODE='22023';END IF;
 IF expected IS DISTINCT FROM v THEN RAISE EXCEPTION '51 proposta exata/campos extras/consentimento inválidos' USING ERRCODE='22023';END IF;RETURN v;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_data(p_primeira date,p_modalidade text,p_indice integer) RETURNS date
LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT CASE WHEN p_modalidade IN('mensal','tabela_price') THEN
 ((date_trunc('month',p_primeira::timestamp)+make_interval(months=>p_indice))::date +
 (least(extract(day FROM p_primeira)::int,extract(day FROM date_trunc('month',p_primeira::timestamp)+make_interval(months=>p_indice+1)-interval '1 day')::int)-1))
 ELSE p_primeira+p_indice*CASE p_modalidade WHEN 'semanal' THEN 7 WHEN 'quinzenal' THEN 15 WHEN 'diario' THEN 1 END END;
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_moeda(v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT v IS NOT NULL AND v::text NOT IN('NaN','Infinity','-Infinity') AND v=round(v,2) AND v BETWEEN 0 AND 9999999999.99;
$clone60s$;
CREATE FUNCTION emprestimos_lista60.inclusao52__plano(s jsonb,v jsonb,instante timestamptz,nova jsonb DEFAULT NULL) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE c jsonb:=s->'contrato';p jsonb;np jsonb;ps jsonb:=s->'parcelas';n integer:=jsonb_array_length(ps);i integer:=0;total numeric:=0;amount numeric;d date;firstd date;modal text:=c->>'modalidade';tax text:=c->>'tipo_taxa';today date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 v:=emprestimos_lista60.obrigacoes51__proposta(v);
 IF v->>'acao' IS DISTINCT FROM 'adicionar' OR c->>'status' IS DISTINCT FROM 'ativo' OR NOT((modal='mensal' AND tax='mensal') OR (modal='semanal' AND tax='semanal') OR (modal='quinzenal' AND tax='quinzenal') OR (modal='diario' AND tax='diaria')) OR n NOT BETWEEN 1 AND 59 OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text THEN RAISE EXCEPTION '52 inclusão somente raiz ativa coorte fechada1..59; Price fora' USING ERRCODE='0A000';END IF;
 amount:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'valor');d:=emprestimos_lista60.obrigacoes51__dia(v->>'dataVencimento');firstd:=(c->>'data_vencimento_primeira')::date;
 IF firstd IS NULL OR firstd NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR (modal='mensal' AND extract(day FROM firstd)>28) OR d<=today OR d IS DISTINCT FROM emprestimos_lista60.public__multimodal_data(firstd,modal,n) THEN RAISE EXCEPTION '52 próxima DATE explícita canônica obrigatória' USING ERRCODE='22023';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(ps) ORDER BY (value->>'numero')::int LOOP
 i:=i+1;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text OR p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'data_vencimento')::date<=today OR (p->>'data_vencimento')::date IS DISTINCT FROM emprestimos_lista60.public__multimodal_data(firstd,modal,i-1) OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric OR NOT emprestimos_lista60.public__multimodal_moeda((p->>'valor')::numeric) OR (p->>'valor')::numeric<=0 OR (p ? 'contagem_renovacoes' AND (p->>'contagem_renovacoes')::integer IS DISTINCT FROM 0) THEN RAISE EXCEPTION '52 linhas anteriores abertas futuras canônicas e aliases explícitos; sem saneamento' USING ERRCODE='23514';END IF;
 total:=total+(p->>'valor')::numeric;
 END LOOP;
 IF total IS DISTINCT FROM (c->>'total_contrato')::numeric OR NOT emprestimos_lista60.public__multimodal_moeda(total) OR NOT emprestimos_lista60.public__multimodal_moeda(total+amount) THEN RAISE EXCEPTION '52 header nominal divergente ou overflow12' USING ERRCODE='22023';END IF;
 IF c->>'data_vencimento' IS DISTINCT FROM emprestimos_lista60.public__multimodal_data(firstd,modal,n-1)::text OR (c->>'dia_vencimento')::int IS DISTINCT FROM extract(day FROM firstd)::int THEN RAISE EXCEPTION '52 calendário/header divergente' USING ERRCODE='23514';END IF;
 IF nova IS NOT NULL THEN
 PERFORM emprestimos_lista60.obrigacoes51__id(nova->'id');
 np:=nova||jsonb_build_object('user_id',(c->>'user_id')::int,'contrato_id',(c->>'id')::int,'cliente_id',(c->>'cliente_id')::int,'koletor_id',(c->>'koletor_id')::int,'conta_caixa_id',(c->>'conta_caixa_id')::int,'numero',n+1,'numero_parcela',n+1,'valor',amount,'valor_original',amount,'valor_juros',0,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'multa_manual',0,'multa_diaria_usada',0,'data_vencimento',d,'data_pagamento',NULL,'status','pendente','createdAt',instante,'updatedAt',instante);
 ps:=ps||jsonb_build_array(np);
 END IF;
 total:=total+amount;n:=n+1;c:=c||jsonb_build_object('num_parcelas',n,'numero_parcelas',n,'data_vencimento',d,'total_contrato',total,'valor_parcela',round(total/n,2),'updatedAt',instante);
 RETURN jsonb_build_object('contrato',c,'parcelas',(SELECT jsonb_agg(j ORDER BY (j->>'id')::int) FROM jsonb_array_elements(ps) j),'totalContrato',total::numeric(12,2)::text,'jurosTotal',(SELECT sum((j->>'valor_juros')::numeric)::numeric(12,2)::text FROM jsonb_array_elements(ps) j),'obrigacaoCancelada','0.00','alteradas',1,'regra','inclusao52_v1');
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__fechar(uid integer,k uuid,r jsonb,oid51 uuid,res jsonb) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT jsonb_build_object('status','confirmed','sameIntentOnly',true,'versao','obrigacoes51_v1','userId',uid,'idempotencyKey',k,'request',r,'resultado',res)
$clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__hash(j jsonb) RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__request(r jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE e jsonb;
BEGIN
 IF r IS NULL OR jsonb_typeof(r) IS DISTINCT FROM 'object' OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' OR r->>'motivo' IS NULL OR length(r->>'motivo') NOT BETWEEN 3 AND 500 OR r->>'motivo'<>btrim(r->>'motivo') THEN RAISE EXCEPTION '51 intenção estrita inválida' USING ERRCODE='22023';END IF;
 e:=jsonb_build_object('contratoId',emprestimos_lista60.obrigacoes51__id(r->'contratoId'),'proposta',emprestimos_lista60.obrigacoes51__proposta(r->'proposta'),'estadoHash',r->>'estadoHash','dataCalculo',emprestimos_lista60.obrigacoes51__dia(r->>'dataCalculo'),'motivo',r->>'motivo');IF e IS DISTINCT FROM r THEN RAISE EXCEPTION '51 request exato sem owner/chave/conta arbitrários' USING ERRCODE='22023';END IF;RETURN r;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.inclusao52__provar(oid51 uuid) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE op obrigacoes51.operacoes%ROWTYPE;a inclusao52.adicionais%ROWTYPE;s jsonb;after_s jsonb;plan jsonb;expected jsonb;h jsonb;stamp timestamptz;
BEGIN
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=oid51 LIMIT 1;SELECT * INTO STRICT a FROM inclusao52.adicionais WHERE operacao51=oid51 LIMIT 1;
 s:=op.antes->'financeiro';after_s:=op.depois->'financeiro';stamp:=(a.linha_inicial->>'createdAt')::timestamptz;
 IF op.resultado IS NULL OR op.concluida_em IS NULL OR op.depois IS NULL OR a.user_id IS DISTINCT FROM op.user_id OR a.contrato_id IS DISTINCT FROM op.contrato_id OR a.origem_tipo IS DISTINCT FROM op.antes->>'origemTipo' OR a.regra IS DISTINCT FROM 'inclusao52_v1' OR op.request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__request(op.request) OR op.hash_request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.request) OR op.hash_resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.resultado) OR op.resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__fechar(op.user_id,op.chave,op.request,op.id,jsonb_build_object('operationId',op.id,'contratoId',op.contrato_id,'acao','adicionar','idsAfetados',jsonb_build_array(a.parcela_id),'valorRecebido','0.00','contaDestinoId',NULL,'caixaPreservado',true)) OR op.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(jsonb_build_object('base',op.antes,'dia',op.request->>'dataCalculo')) OR a.hash_linha IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.linha_inicial->>'numero' IS DISTINCT FROM a.numero::text OR a.linha_inicial->>'numero_parcela' IS DISTINCT FROM a.numero::text OR (a.linha_inicial->>'valor')::numeric IS DISTINCT FROM a.valor OR (op.request->'proposta'->>'valor')::numeric IS DISTINCT FROM a.valor OR EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=a.parcela_id LIMIT 1) OR NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=a.parcela_id AND user_id=a.user_id AND contrato_id=a.contrato_id AND numero=a.numero AND numero_parcela=a.numero AND valor_original=a.valor AND valor_juros=0 LIMIT 1) THEN RAISE EXCEPTION '52 testemunho A sem closure/owner/linha/pedido genuínos' USING ERRCODE='23514';END IF;
 plan:=emprestimos_lista60.inclusao52__plano(s,op.request->'proposta',stamp,a.linha_inicial);
 h:=after_s->'historico'->jsonb_array_length(s->'historico');
 IF h->>'tipo' IS DISTINCT FROM 'inclusao_obrigacao' OR h->>'descricao' IS DISTINCT FROM 'Inclusão52 '||op.id::text||': '||(op.request->>'motivo') OR h->>'user_id' IS DISTINCT FROM op.user_id::text OR h->>'contrato_id' IS DISTINCT FROM op.contrato_id::text OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb OR op.concluida_em<stamp THEN RAISE EXCEPTION '52 histórico A integral inválido' USING ERRCODE='23514';END IF;
 expected:=jsonb_set(jsonb_set(jsonb_set(s,'{contrato}',plan->'contrato'),'{parcelas}',plan->'parcelas'),'{historico}',s->'historico'||jsonb_build_array(h));
 IF expected IS DISTINCT FROM after_s OR op.antes->'conta' IS DISTINCT FROM op.depois->'conta' OR op.antes->'livroConta' IS DISTINCT FROM op.depois->'livroConta' OR NOT(op.depois->'adicionais52' @> jsonb_build_array(to_jsonb(a))) THEN RAISE EXCEPTION '52 delta inteiro/A/conta/livro divergente' USING ERRCODE='23514';END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.manutencao48__proposta(v jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE a text; s text;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'object' THEN RAISE EXCEPTION '48 invalid proposal' USING ERRCODE='22023'; END IF;
 a:=v->>'acao';
 IF a IN('adicionar','editar') THEN RETURN emprestimos_lista60.obrigacoes51__proposta(v); END IF;
 IF a='cancelar' AND v=jsonb_build_object('acao',a) THEN RETURN v; END IF;
 IF a='juros' AND v=jsonb_build_object('acao',a,'taxaJuros',v->>'taxaJuros') THEN
  s:=v->>'taxaJuros';
  IF s ~ '^(0|[1-9][0-9]{0,2})\.[0-9]{4}$' AND s::numeric<=100 AND round(s::numeric,2)=s::numeric THEN RETURN v; END IF;
 ELSIF a IN('valor','desconto') AND v=jsonb_build_object('acao',a,'parcelaId',v->'parcelaId','valor',v->>'valor') THEN
  s:=v->>'valor';
  IF jsonb_typeof(v->'parcelaId')='number' AND (v->>'parcelaId') ~ '^[1-9][0-9]{0,9}$' AND (v->>'parcelaId')::numeric<=2147483647
   AND s ~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' THEN RETURN v; END IF;
 END IF;
 RAISE EXCEPTION '48 exact proposal invalid; rate must fit physical NUMERIC(5,2)' USING ERRCODE='22023';
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.manutencao48__request(cid integer,estado text,v jsonb,motivo text) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
BEGIN
 IF cid IS NULL OR cid<=0 OR estado IS NULL OR estado !~ '^[a-f0-9]{64}$' OR motivo IS NULL OR length(motivo) NOT BETWEEN 3 AND 500 OR motivo<>btrim(motivo) THEN RAISE EXCEPTION '48 invalid exact intent' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('contratoId',cid,'estadoHash',estado,'alteracao',emprestimos_lista60.manutencao48__proposta(v),'motivo',motivo);
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_payload(p_user integer,p_family text,r jsonb) RETURNS jsonb
STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE v jsonb;
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR r ? 'userId' OR r ? 'p_user_id' OR r ? 'idempotencyKey' THEN RAISE EXCEPTION 'Request original sem user/key obrigatória' USING ERRCODE='22023'; END IF;
 IF p_family='multimodal_calendario46' THEN
  RETURN r||jsonb_build_object('regra','calendario_mensal_sem_baixa_v1','userId',p_user);
 END IF;
 IF p_family='multimodal_manutencao48' THEN
  RETURN r||jsonb_build_object('regra','manutencao25_obrigacao_v1','userId',p_user);
 END IF;
 IF p_family='multimodal_criar' THEN
 v:=jsonb_build_object('regra','multimodal_v1','userId',p_user,'clienteId',(r->>'clienteId')::integer,'contaCaixaId',(r->>'contaCaixaId')::integer,
 'modalidade',r->>'modalidade','tipoTaxa',r->>'tipoTaxa','valorPrincipal',(r->>'valorPrincipal')::numeric(15,2)::text,'taxaJuros',(r->>'taxaJuros')::numeric(5,2)::text,
 'numeroParcelas',(r->>'numeroParcelas')::integer,'dataInicio',(r->>'dataInicio')::date,'dataDesembolso',(r->>'dataDesembolso')::date,
 'vencimentos',r->'vencimentos','descricao',nullif(btrim(r->>'descricao'),''),'observacoes',nullif(btrim(r->>'observacoes'),''),
 'multaAtraso',coalesce((r->>'multaAtraso')::numeric,2)::numeric(8,4)::text,'jurosMoraDiario',coalesce((r->>'jurosMoraDiario')::numeric,0.033)::numeric(8,4)::text);
 ELSE
 v:=jsonb_build_object('regra',CASE p_family WHEN 'multimodal_receber' THEN 'recebimento_multimodal_brt_v1' ELSE 'renovacao_multimodal_brt_v1' END,
 'userId',p_user,'contratoId',(r->>'contratoId')::integer,'parcelaId',(r->>'parcelaId')::integer,
 'valorRecebido',(r->>'valorRecebido')::numeric(15,2)::text,'totalExigido',(r->>'totalExigido')::numeric(15,2)::text,
 'dataPagamento',(r->>'dataPagamento')::date,'estadoHash',r->>'estadoHash','observacoes',nullif(btrim(r->>'observacoes'),''));
 IF p_family='multimodal_receber' THEN v:=v||jsonb_build_object('modo',r->>'modo'); ELSE v:=v||jsonb_build_object('novoVencimento',(r->>'novoVencimento')::date); END IF;
 END IF;
 RETURN v;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.inclusao52__provar35(oid51 uuid) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE op obrigacoes51.operacoes%ROWTYPE;a obrigacoes51.adicionais%ROWTYPE;mop public.multimodal_operacoes%ROWTYPE;s jsonb;expected jsonb;plan jsonb;h jsonb;stamp timestamptz;
BEGIN
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=oid51 LIMIT 1;
 SELECT * INTO STRICT a FROM obrigacoes51.adicionais WHERE op.resultado->'resultado'->'idsAfetados'=jsonb_build_array(parcela_id) LIMIT 1;
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=a.operacao48 LIMIT 1;s:=op.antes->'financeiro';stamp:=(a.linha_inicial->>'createdAt')::timestamptz;
 IF op.antes->>'origemTipo' IS DISTINCT FROM 'multimodal35' OR op.resultado IS NULL OR op.hash_request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.request) OR op.request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__request(op.request) OR op.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(jsonb_build_object('base',op.antes,'dia',op.request->>'dataCalculo')) OR op.hash_resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.resultado) OR mop.user_id IS DISTINCT FROM op.user_id OR a.user_id IS DISTINCT FROM op.user_id OR a.contrato_id IS DISTINCT FROM op.contrato_id OR mop.family IS DISTINCT FROM 'multimodal_manutencao48' OR mop.chave IS DISTINCT FROM op.chave OR mop.request IS DISTINCT FROM emprestimos_lista60.manutencao48__request(op.contrato_id,emprestimos_lista60.obrigacoes51__hash(s),op.request->'proposta',op.request->>'motivo') OR mop.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(op.user_id,'multimodal_manutencao48',mop.request) OR mop.hash_payload IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(mop.payload) OR mop.auditoria->'payload' IS DISTINCT FROM mop.payload OR mop.resultado IS NULL OR mop.auditoria->'resultado' IS DISTINCT FROM mop.resultado OR mop.auditoria->'antes' IS DISTINCT FROM s OR mop.auditoria->'extra'->>'operacao51' IS DISTINCT FROM op.id::text OR EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=mop.id LIMIT 1) OR a.hash_linha IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.numero IS DISTINCT FROM jsonb_array_length(s->'parcelas')+1 OR (a.linha_inicial->>'valor')::numeric IS DISTINCT FROM a.valor OR NOT EXISTS(SELECT 1 FROM public.parcelas WHERE id=a.parcela_id AND user_id=op.user_id AND contrato_id=op.contrato_id AND numero=a.numero AND numero_parcela=a.numero AND valor_original=a.valor AND valor_juros=0 LIMIT 1) THEN RAISE EXCEPTION '52 A35 sem operação48/51 real única íntegra' USING ERRCODE='23514';END IF;
 plan:=emprestimos_lista60.inclusao52__plano(s,op.request->'proposta',stamp,a.linha_inicial);h:=mop.auditoria->'depois'->'historico'->jsonb_array_length(s->'historico');
 IF h->>'tipo' IS DISTINCT FROM 'manutencao_adicionar' OR h->>'descricao' IS DISTINCT FROM 'Manutenção25 '||mop.id::text||': '||(op.request->>'motivo') OR h->>'user_id' IS DISTINCT FROM op.user_id::text OR h->>'contrato_id' IS DISTINCT FROM op.contrato_id::text OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '52 histórico35 falso' USING ERRCODE='23514';END IF;
 expected:=jsonb_set(jsonb_set(jsonb_set(s,'{contrato}',plan->'contrato'),'{parcelas}',plan->'parcelas'),'{historico}',s->'historico'||jsonb_build_array(h));
 IF expected IS DISTINCT FROM mop.auditoria->'depois' OR expected IS DISTINCT FROM op.depois->'financeiro' OR op.antes->'conta' IS DISTINCT FROM op.depois->'conta' OR op.antes->'livroConta' IS DISTINCT FROM op.depois->'livroConta' OR op.resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__fechar(op.user_id,op.chave,op.request,op.id,jsonb_build_object('operationId',op.id,'contratoId',op.contrato_id,'acao','adicionar','idsAfetados',jsonb_build_array(a.parcela_id),'valorRecebido','0.00','contaDestinoId',NULL,'caixaPreservado',true)) THEN RAISE EXCEPTION '52 delta35 ou closure divergente' USING ERRCODE='23514';END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.manutencao44__agenda(cid integer,dias date[],inicio date,n integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE i integer;
BEGIN
 IF dias IS NULL OR array_ndims(dias) IS DISTINCT FROM 1 OR array_lower(dias,1) IS DISTINCT FROM 1 OR cardinality(dias) IS DISTINCT FROM n OR n NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Agenda44 exige exatamente N datas' USING ERRCODE='22023'; END IF;
 FOR i IN 1..n LOOP
 IF dias[i] IS NULL OR NOT isfinite(dias[i]) OR dias[i] NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' OR dias[i]<inicio
 OR (n>1 AND extract(day FROM dias[1])>28) OR dias[i] IS DISTINCT FROM (dias[1]+make_interval(months=>i-1))::date THEN RAISE EXCEPTION 'Agenda44 mensal consecutiva inválida' USING ERRCODE='22023'; END IF;
 END LOOP;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.manutencao44__request(cid integer,estado text,dias date[],motivo text) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
BEGIN
 IF cid IS NULL OR cid<=0 OR estado IS NULL OR estado !~ '^[a-f0-9]{64}$' OR motivo IS NULL OR length(btrim(motivo)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Intenção44 inválida' USING ERRCODE='22023'; END IF;
 PERFORM emprestimos_lista60.manutencao44__agenda(cid,dias,DATE '1900-01-01',cardinality(dias));
 RETURN jsonb_build_object('contratoId',cid,'estadoHash',estado,'vencimentos',dias,'motivo',btrim(motivo));
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__plano(s jsonb,v jsonb,instante timestamptz,nova jsonb DEFAULT NULL) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE c jsonb:=s->'contrato';p jsonb;np jsonb;ps jsonb:='[]';n integer:=jsonb_array_length(s->'parcelas');i integer:=0;changed integer:=0;pid integer;amount numeric;share numeric;total numeric:=0;today date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;d date;prev date;nextd date;firstd date;lastd date;action text;
BEGIN
 v:=emprestimos_lista60.obrigacoes51__proposta(v);action:=v->>'acao';
 IF action NOT IN('adicionar','editar') OR c->>'status' IS DISTINCT FROM 'ativo' OR c->>'modalidade' IS DISTINCT FROM 'mensal' OR c->>'tipo_taxa' IS DISTINCT FROM 'mensal' OR n NOT BETWEEN 1 AND 60 OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text THEN RAISE EXCEPTION '51 edição/inclusão requer contrato mensal ativo íntegro' USING ERRCODE='0A000';END IF;
 IF action='adicionar' THEN
 IF n>=60 THEN RAISE EXCEPTION '51 máximo 60 parcelas' USING ERRCODE='22023';END IF;
 amount:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'valor');d:=emprestimos_lista60.obrigacoes51__dia(v->>'dataVencimento');firstd:=(c->>'data_vencimento_primeira')::date;
 IF firstd IS NULL OR extract(day FROM firstd)>28 OR d<=today OR d IS DISTINCT FROM emprestimos_lista60.public__multimodal_data(firstd,'mensal',n) THEN RAISE EXCEPTION '51 inclusão: data informada deve ser próximo mês explícito ancorado1..28' USING ERRCODE='22023';END IF;
 END IF;
 IF action='editar' THEN
 pid:=emprestimos_lista60.obrigacoes51__id(v->'parcelaId');IF (EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE parcela_id=pid LIMIT 1) OR EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE parcela_id=pid LIMIT 1)) THEN RAISE EXCEPTION '51 editar componente adicional exige regra própria; não virar principal/juros' USING ERRCODE='0A000';END IF;
 SELECT (j->>'data_vencimento')::date INTO prev FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int<(SELECT (x->>'numero')::int FROM jsonb_array_elements(s->'parcelas') x WHERE (x->>'id')::int=pid) ORDER BY (j->>'numero')::int DESC LIMIT 1;
 SELECT (j->>'data_vencimento')::date INTO nextd FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int>(SELECT (x->>'numero')::int FROM jsonb_array_elements(s->'parcelas') x WHERE (x->>'id')::int=pid) ORDER BY (j->>'numero')::int LIMIT 1;
 END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LOOP
 i:=i+1;np:=p;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text THEN RAISE EXCEPTION '51 sequência original divergente' USING ERRCODE='23514';END IF;
 IF action='adicionar' OR (p->>'id')::int=pid THEN
 IF p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'data_vencimento')::date<=today OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric THEN RAISE EXCEPTION '51 alvo somente integralmente aberto futuro sem baixa/encargos' USING ERRCODE='23514';END IF;
 IF action='adicionar' AND (p->>'data_vencimento')::date IS DISTINCT FROM emprestimos_lista60.public__multimodal_data(firstd,'mensal',i-1) THEN RAISE EXCEPTION '51 append requer calendário mensal; exceção individual não é sanada' USING ERRCODE='23514';END IF;
 IF action='editar' THEN
 share:=(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;amount:=CASE WHEN v ? 'novoValor' THEN emprestimos_lista60.obrigacoes51__dinheiro(v->>'novoValor') ELSE (p->>'valor')::numeric END;d:=CASE WHEN v ? 'novaDataVencimento' THEN emprestimos_lista60.obrigacoes51__dia(v->>'novaDataVencimento') ELSE (p->>'data_vencimento')::date END;
 IF share<=0 OR amount<share OR d<=today OR d<(c->>'data_inicio')::date OR (prev IS NOT NULL AND d<=prev) OR (nextd IS NOT NULL AND d>=nextd) THEN RAISE EXCEPTION '51 preservar principal e DATE estrita entre vizinhos reais' USING ERRCODE='22023';END IF;
 IF amount IS DISTINCT FROM (p->>'valor')::numeric OR d IS DISTINCT FROM (p->>'data_vencimento')::date THEN np:=p||jsonb_build_object('valor',amount,'valor_original',amount,'valor_juros',amount-share,'data_vencimento',d,'updatedAt',instante);changed:=1;END IF;
 END IF;
 END IF;
 total:=total+(np->>'valor')::numeric;ps:=ps||jsonb_build_array(np);
 END LOOP;
 IF action='adicionar' THEN
 IF nova IS NOT NULL THEN
 np:=nova||jsonb_build_object('user_id',(c->>'user_id')::int,'contrato_id',(c->>'id')::int,'cliente_id',(c->>'cliente_id')::int,'koletor_id',(c->>'koletor_id')::int,'conta_caixa_id',(c->>'conta_caixa_id')::int,'numero',n+1,'numero_parcela',n+1,'valor',amount,'valor_original',amount,'valor_juros',0,'valor_pago',0,'valor_multa',0,'valor_desconto',0,'saldo_residual',0,'multa_manual',0,'multa_diaria_usada',0,'data_vencimento',d,'data_pagamento',NULL,'status','pendente','createdAt',instante,'updatedAt',instante);
 ps:=ps||jsonb_build_array(np);END IF;
 total:=total+amount;n:=n+1;changed:=1;c:=c||jsonb_build_object('num_parcelas',n,'numero_parcelas',n,'data_vencimento',d);
 ELSE
 IF changed=0 THEN RAISE EXCEPTION '51 sem delta real' USING ERRCODE='22023';END IF;
 SELECT (j->>'data_vencimento')::date INTO firstd FROM jsonb_array_elements(ps) j ORDER BY (j->>'numero')::int LIMIT 1;SELECT (j->>'data_vencimento')::date INTO lastd FROM jsonb_array_elements(ps) j ORDER BY (j->>'numero')::int DESC LIMIT 1;
 c:=c||jsonb_build_object('data_vencimento_primeira',firstd,'dia_vencimento',extract(day FROM firstd)::int,'data_vencimento',lastd);
 END IF;
 IF NOT emprestimos_lista60.public__multimodal_moeda(total) THEN RAISE EXCEPTION '51 overflow nominal/histórico' USING ERRCODE='22023';END IF;
 IF action='adicionar' OR total IS DISTINCT FROM (c->>'total_contrato')::numeric THEN c:=c||jsonb_build_object('total_contrato',total,'valor_parcela',round(total/n,2));END IF;
 c:=c||jsonb_build_object('updatedAt',instante);
 RETURN jsonb_build_object('contrato',c,'parcelas',(SELECT jsonb_agg(j ORDER BY (j->>'id')::int) FROM jsonb_array_elements(ps) j),'totalContrato',total::numeric(12,2)::text,'jurosTotal',(SELECT sum((j->>'valor_juros')::numeric)::numeric(12,2)::text FROM jsonb_array_elements(ps) j),'obrigacaoCancelada','0.00','alteradas',1,'regra','obrigacoes51_v1');
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.manutencao48__plano(s jsonb,v jsonb,instante timestamptz) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE a text; p jsonb; np jsonb; ps jsonb:='[]'; c jsonb:=s->'contrato'; total numeric:=0; oldTotal numeric:=0; juros numeric:=0; base numeric:=0; jref numeric; n integer:=jsonb_array_length(s->'parcelas'); m integer:=0; i integer:=0; changed integer:=0; share numeric; j numeric; val numeric; discount numeric; cancelado numeric:=0; extra_ids integer[]:='{}'; initial_n integer; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 v:=emprestimos_lista60.manutencao48__proposta(v); a:=v->>'acao';
 IF a IN('adicionar','editar') THEN RETURN emprestimos_lista60.obrigacoes51__plano(s,v,instante); END IF;
 SELECT coalesce(array_agg(parcela_id),'{}'::int[]) INTO extra_ids FROM obrigacoes51.adicionais WHERE contrato_id=(c->>'id')::int;
 SELECT numero_inicial INTO initial_n FROM public.multimodal_origens WHERE contrato_id=(c->>'id')::int;
 IF a IN('valor','desconto') AND (v->>'parcelaId')::int=ANY(extra_ids) THEN RAISE EXCEPTION '51 componente adicional não é principal/juros' USING ERRCODE='0A000'; END IF;
 IF a='juros' THEN
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') LOOP
 IF p->>'status' IN('pendente','atrasada','vencendo_hoje','parcial') AND NOT((p->>'id')::int=ANY(extra_ids)) THEN
  IF p->>'status'<>'pendente' OR (p->>'valor_pago')::numeric<>0 OR p->'data_pagamento'<>'null'::jsonb OR (p->>'saldo_residual')::numeric<>0 OR (p->>'valor_desconto')::numeric<>0 OR (p->>'data_vencimento')::date<=hoje THEN RAISE EXCEPTION '48 repricing only wholly open future; paid rows stay byte-exact' USING ERRCODE='23514'; END IF;
  m:=m+1; base:=base+(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;
 END IF;
 END LOOP;
 IF m=0 OR (v->>'taxaJuros')::numeric=(c->>'taxa_juros')::numeric THEN RAISE EXCEPTION '48 rate unchanged or no future obligations' USING ERRCODE='22023'; END IF;
 juros:=round(base*(v->>'taxaJuros')::numeric/100*coalesce(initial_n,n),2); jref:=round(juros/m,2);
 END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LOOP
 np:=p; share:=(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;
 oldTotal:=oldTotal+(p->>'valor')::numeric;
 IF a='cancelar' AND p->>'status' IN('pendente','atrasada','vencendo_hoje','parcial') THEN
  cancelado:=cancelado+CASE WHEN p->>'status'='parcial' THEN (p->>'saldo_residual')::numeric ELSE greatest(0,(p->>'valor')::numeric-(p->>'valor_pago')::numeric) END;
  np:=p||jsonb_build_object('status','cancelada','updatedAt',instante); changed:=changed+1;
 ELSIF a='juros' AND p->>'status'='pendente' AND NOT((p->>'id')::int=ANY(extra_ids)) THEN
  i:=i+1; j:=CASE WHEN i=m THEN juros-jref*(m-1) ELSE jref END; val:=share+j;
  IF (p->>'valor_multa')::numeric<>0 OR (p->>'multa_manual')::numeric<>0 OR (p->>'multa_diaria_usada')::numeric<>0 OR share<=0 OR j<0 OR NOT emprestimos_lista60.public__multimodal_moeda(val) THEN RAISE EXCEPTION '48 principal-preserving rate allocation unrepresentable' USING ERRCODE='23514'; END IF;
  np:=p||jsonb_build_object('valor',val,'valor_original',val,'valor_juros',j,'updatedAt',instante); changed:=changed+1;
 ELSIF a IN('valor','desconto') AND (p->>'id')::int=(v->>'parcelaId')::int THEN
  IF p->>'status'<>'pendente' OR (p->>'valor_pago')::numeric<>0 OR p->'data_pagamento'<>'null'::jsonb OR (p->>'saldo_residual')::numeric<>0 OR (p->>'data_vencimento')::date<=hoje
  OR (p->>'valor_multa')::numeric<>0 OR (p->>'multa_manual')::numeric<>0 OR (p->>'multa_diaria_usada')::numeric<>0 THEN RAISE EXCEPTION '48 only targeted wholly open future row; never rewrite receipt' USING ERRCODE='23514'; END IF;
  val:=(v->>'valor')::numeric;
  IF a='valor' THEN
   IF (p->>'valor_desconto')::numeric<>0 OR val<=0 OR val<share OR val=(p->>'valor')::numeric THEN RAISE EXCEPTION '48 amount must preserve principal, no discount, nonzero delta' USING ERRCODE='22023'; END IF;
   np:=p||jsonb_build_object('valor',val,'valor_original',val,'valor_juros',val-share,'updatedAt',instante);
  ELSE
   IF val>(p->>'valor_juros')::numeric+(p->>'valor_desconto')::numeric OR val=(p->>'valor_desconto')::numeric THEN RAISE EXCEPTION '48 discount must leave positive claim, nonzero delta' USING ERRCODE='22023'; END IF;
   discount:=(p->>'valor_desconto')::numeric;
   np:=p||jsonb_build_object('valor',(p->>'valor')::numeric+discount-val,'valor_original',(p->>'valor_original')::numeric+discount-val,'valor_juros',(p->>'valor_juros')::numeric+discount-val,'valor_desconto',val,'updatedAt',instante);
  END IF;
  changed:=changed+1;
 END IF;
 total:=total+(np->>'valor')::numeric; ps:=ps||jsonb_build_array(np);
 END LOOP;
 IF changed=0 OR NOT emprestimos_lista60.public__multimodal_moeda(total) THEN RAISE EXCEPTION '48 no target/change or unrepresentable total' USING ERRCODE='22023'; END IF;
 IF a='juros' THEN c:=c||jsonb_build_object('taxa_juros',(v->>'taxaJuros')::numeric); END IF;
 IF a IN('juros','valor','desconto') THEN c:=c||jsonb_build_object('total_contrato',total,'valor_parcela',round(total/n,2)); END IF;
 IF a='cancelar' THEN c:=c||jsonb_build_object('status','cancelado'); END IF;
 c:=c||jsonb_build_object('updatedAt',instante);
 RETURN jsonb_build_object('contrato',c,'parcelas',(SELECT jsonb_agg(jj ORDER BY (jj->>'id')::int) FROM jsonb_array_elements(ps) jj),'totalContrato',total::numeric(15,2)::text,'jurosTotal',(SELECT sum((jj->>'valor_juros')::numeric)::numeric(15,2)::text FROM jsonb_array_elements(ps) jj),'obrigacaoCancelada',cancelado::numeric(15,2)::text,'alteradas',changed,'regra','manutencao25_obrigacao_v1');
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__registrada(p jsonb) RETURNS numeric STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE v numeric; paid numeric; residual numeric;
BEGIN
 IF p->>'status' IN('paga','pago','cancelada','cancelado','renovada') THEN RETURN 0;END IF;
 IF p->>'status' NOT IN('pendente','atrasada','atrasado','vencendo_hoje','parcial') OR p->'valor' IS NULL OR p->'valor_original' IS NULL OR p->'valor_pago' IS NULL OR p->'saldo_residual' IS NULL THEN RAISE EXCEPTION '51 obrigação registrada ambígua' USING ERRCODE='23514';END IF;
 v:=(p->>'valor')::numeric;paid:=(p->>'valor_pago')::numeric;residual:=(p->>'saldo_residual')::numeric;
 IF NOT emprestimos_lista60.public__multimodal_moeda(v) OR NOT emprestimos_lista60.public__multimodal_moeda(paid) OR NOT emprestimos_lista60.public__multimodal_moeda(residual) OR v<=0 OR p->>'valor_original' IS NULL OR NOT emprestimos_lista60.public__multimodal_moeda((p->>'valor_original')::numeric) THEN RAISE EXCEPTION '51 valores registrados inválidos' USING ERRCODE='23514';END IF;
 IF p->>'status'='parcial' THEN
 IF paid<=0 OR residual<=0 OR (p->>'valor_original')::numeric+(p->>'valor_multa')::numeric+(p->>'multa_diaria_usada')::numeric-paid IS DISTINCT FROM residual OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION '51 residual parcial ambíguo' USING ERRCODE='23514';END IF;RETURN residual;
 END IF;
 IF v IS DISTINCT FROM (p->>'valor_original')::numeric OR paid IS DISTINCT FROM 0::numeric OR residual IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '51 aliases/baixa registrada ambíguos' USING ERRCODE='23514';END IF;RETURN v;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__eventos_leitura(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE op obrigacoes51.operacoes%ROWTYPE; ev record; p jsonb; a obrigacoes51.adicionais%ROWTYPE; mop public.multimodal_operacoes%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM inclusao52.adicionais WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND request->'proposta'->>'acao'='adicionar' AND antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LIMIT 1) THEN -- Catalog-only audit moved to installation/review60.
END IF;
 FOR op IN SELECT x.* FROM obrigacoes51.operacoes x WHERE x.contrato_id=cid ORDER BY x.created_at,x.id LOOP
 IF op.user_id IS DISTINCT FROM uid OR op.request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__request(op.request) OR op.request->>'contratoId' IS DISTINCT FROM cid::text OR op.hash_request IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.request)
 OR op.resultado IS NULL OR op.depois IS NULL OR op.concluida_em IS NULL OR op.hash_resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(op.resultado)
 OR op.resultado IS DISTINCT FROM emprestimos_lista60.obrigacoes51__fechar(uid,op.chave,op.request,op.id,op.resultado->'resultado')
 OR op.resultado->'resultado'->>'operationId' IS DISTINCT FROM op.id::text OR op.resultado->'resultado'->>'contratoId' IS DISTINCT FROM cid::text
 OR op.resultado->'resultado'->>'acao' IS DISTINCT FROM op.request->'proposta'->>'acao'
 OR op.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(jsonb_build_object('base',op.antes,'dia',emprestimos_lista60.obrigacoes51__dia(op.request->>'dataCalculo')))
 THEN RAISE EXCEPTION '51 evento sem closure exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.cancelamentos x WHERE x.contrato_id=cid ORDER BY x.parcela_id LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 SELECT to_jsonb(x) INTO STRICT p FROM public.parcelas x WHERE id=ev.parcela_id AND contrato_id=cid LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid OR op.request->'proposta'->>'acao' IS DISTINCT FROM 'cancelar'
 OR NOT(op.resultado->'resultado'->'idsAfetados' @> jsonb_build_array(ev.parcela_id))
 OR NOT(op.depois->'cancelamentos' @> jsonb_build_array(ev.row51))
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(op.antes->'financeiro'->'parcelas') j WHERE j=p LIMIT 1)
 OR ev.status_original IS DISTINCT FROM p->>'status' OR ev.status_original NOT IN('pendente','atrasada','atrasado','vencendo_hoje','parcial')
 OR ev.valor_pago_preservado IS DISTINCT FROM (p->>'valor_pago')::numeric OR ev.obrigacao_registrada IS DISTINCT FROM emprestimos_lista60.obrigacoes51__registrada(p)
 THEN RAISE EXCEPTION '51 renúncia sem prova registrada exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.encerramentos x WHERE x.contrato_id=cid LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid
 OR op.request->'proposta' IS DISTINCT FROM jsonb_build_object('acao','cancelar','alvo',jsonb_build_object('tipo','contrato'),'reconhecoSemEstorno',true)
 OR op.depois->'encerramento' IS DISTINCT FROM ev.row51 OR NOT EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE operacao_id=op.id AND contrato_id=cid AND user_id=uid LIMIT 1)
 THEN RAISE EXCEPTION '51 encerramento sem renúncia comprovada' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT x.*,to_jsonb(x) row51 FROM obrigacoes51.arquivos x WHERE x.contrato_id=cid LOOP
 SELECT * INTO STRICT op FROM obrigacoes51.operacoes WHERE id=ev.operacao_id LIMIT 1;
 IF ev.user_id IS DISTINCT FROM uid OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid
 OR op.request->'proposta' IS DISTINCT FROM jsonb_build_object('acao','arquivar','alvo',CASE WHEN ev.parcela_id IS NULL THEN jsonb_build_object('tipo','contrato') ELSE jsonb_build_object('tipo','parcela','parcelaId',ev.parcela_id) END)
 OR NOT(op.depois->'arquivos' @> jsonb_build_array(ev.row51))
 THEN RAISE EXCEPTION '51 arquivo sem prova exata' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR a IN SELECT x.* FROM obrigacoes51.adicionais x WHERE x.contrato_id=cid ORDER BY x.parcela_id LOOP
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=a.operacao48 LIMIT 1;
 IF a.user_id IS DISTINCT FROM uid OR a.hash_linha IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(a.linha_inicial) OR a.linha_inicial->>'id' IS DISTINCT FROM a.parcela_id::text OR a.linha_inicial->>'contrato_id' IS DISTINCT FROM cid::text
 OR mop.user_id IS DISTINCT FROM uid OR mop.family IS DISTINCT FROM 'multimodal_manutencao48' OR mop.resultado IS NULL OR mop.hash_payload IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(mop.payload)
 OR mop.request->'alteracao'->>'acao' IS DISTINCT FROM 'adicionar' OR (mop.request->'alteracao'->>'valor')::numeric IS DISTINCT FROM a.valor
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(mop.auditoria->'depois'->'parcelas') j WHERE j=a.linha_inicial LIMIT 1)
 THEN RAISE EXCEPTION '51 adicional sem testemunho exato' USING ERRCODE='23514';END IF;
 END LOOP;
 FOR ev IN SELECT extra.operacao51 FROM inclusao52.adicionais extra WHERE extra.contrato_id=cid ORDER BY extra.numero LOOP PERFORM emprestimos_lista60.inclusao52__provar(ev.operacao51);END LOOP;
 FOR ev IN SELECT o.id FROM obrigacoes51.operacoes o WHERE o.contrato_id=cid AND o.resultado IS NOT NULL AND o.request->'proposta'->>'acao'='adicionar' AND o.antes->'financeiro'->'contrato'->>'modalidade' IN('semanal','quinzenal','diario') LOOP PERFORM emprestimos_lista60.inclusao52__provar35(ev.id);END LOOP;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__moeda_leitura(v numeric) RETURNS boolean LANGUAGE sql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT v IS NOT NULL AND v::text NOT IN('NaN','Infinity','-Infinity') AND v=round(v,2) AND v BETWEEN 0 AND 9999999999999.99;
$clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__registrada_leitura(p jsonb) RETURNS numeric STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE v numeric; paid numeric; residual numeric;
BEGIN
 IF p->>'status' IN('paga','pago','cancelada','cancelado','renovada') THEN RETURN 0;END IF;
 IF p->>'status' NOT IN('pendente','atrasada','atrasado','vencendo_hoje','parcial') OR p->'valor' IS NULL OR p->'valor_original' IS NULL OR p->'valor_pago' IS NULL OR p->'saldo_residual' IS NULL THEN RAISE EXCEPTION '51 obrigação registrada ambígua' USING ERRCODE='23514';END IF;
 v:=(p->>'valor')::numeric;paid:=(p->>'valor_pago')::numeric;residual:=(p->>'saldo_residual')::numeric;
 IF NOT emprestimos_lista60.obrigacoes51__moeda_leitura(v) OR NOT emprestimos_lista60.obrigacoes51__moeda_leitura(paid) OR NOT emprestimos_lista60.obrigacoes51__moeda_leitura(residual) OR v<=0 OR p->>'valor_original' IS NULL OR NOT emprestimos_lista60.obrigacoes51__moeda_leitura((p->>'valor_original')::numeric) THEN RAISE EXCEPTION '51 valores registrados inválidos' USING ERRCODE='23514';END IF;
 IF p->>'status'='parcial' THEN
 IF paid<=0 OR residual<=0 OR (p->>'valor_original')::numeric+(p->>'valor_multa')::numeric+(p->>'multa_diaria_usada')::numeric-paid IS DISTINCT FROM residual OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION '51 residual parcial ambíguo' USING ERRCODE='23514';END IF;RETURN residual;
 END IF;
 IF v IS DISTINCT FROM (p->>'valor_original')::numeric OR paid IS DISTINCT FROM 0::numeric OR residual IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '51 aliases/baixa registrada ambíguos' USING ERRCODE='23514';END IF;RETURN v;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__vinculos_leitura(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE c public.contratos%ROWTYPE;
BEGIN
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 THEN RAISE EXCEPTION '51 owner/contrato inválidos' USING ERRCODE='22023';END IF;
 SELECT * INTO c FROM public.contratos WHERE id=cid LIMIT 1;
 IF NOT FOUND OR c.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '51 registro indisponível' USING ERRCODE='42501';END IF;
 IF c.conta_caixa_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid LIMIT 1)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=uid LIMIT 1)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid LIMIT 1))
 OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=cid AND (p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR p.koletor_id IS DISTINCT FROM c.koletor_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id) LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE (t.conta_caixa_id=c.conta_caixa_id OR t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND (t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa a WHERE a.id=t.conta_caixa_id AND a.user_id=uid LIMIT 1) OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos co WHERE co.id=t.contrato_id AND co.user_id=uid LIMIT 1)) OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos co ON co.id=p.contrato_id WHERE p.id=t.parcela_id AND p.user_id=uid AND co.user_id=uid AND t.contrato_id=co.id LIMIT 1))) LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 THEN RAISE EXCEPTION '51 vínculos próprios completos obrigatórios; sem saneamento' USING ERRCODE='42501';END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__travar_leitura(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE aid integer;
BEGIN
 PERFORM emprestimos_lista60.obrigacoes51__vinculos_leitura(uid,cid);SELECT conta_caixa_id INTO STRICT aid FROM public.contratos WHERE id=cid LIMIT 1;-- No writer lock: all DATA reads use the enclosing STABLE statement snapshot.
PERFORM emprestimos_lista60.obrigacoes51__vinculos_leitura(uid,cid);
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.private47__hash(j jsonb) RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_calcular(p_modalidade text,p_principal numeric,p_taxa numeric,p_n integer) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE j numeric; tot numeric; ref numeric; jr numeric; vl numeric; jl numeric; saldo numeric; amort numeric;
 a numeric; b numeric:=10000; ap numeric:=1; bp numeric:=1; numer numeric; denom numeric; cents numeric; linhas jsonb:='[]'; i integer;
BEGIN
 IF p_modalidade IS NULL OR p_modalidade NOT IN('mensal','semanal','quinzenal','diario','tabela_price') OR p_n IS NULL OR p_n NOT BETWEEN 1 AND 60
 OR NOT emprestimos_lista60.public__multimodal_moeda(p_principal) OR p_principal<=0 OR NOT emprestimos_lista60.public__multimodal_moeda(p_taxa) OR p_taxa>999.99 THEN RAISE EXCEPTION 'Cálculo fora da faixa/precisão' USING ERRCODE='22023'; END IF;
 IF p_modalidade='tabela_price' THEN
 a:=10000+p_taxa*100;
 FOR i IN 1..p_n LOOP ap:=ap*a; bp:=bp*b; END LOOP;
 IF p_taxa=0 THEN numer:=p_principal*100; denom:=p_n;
 ELSE numer:=p_principal*100*(a-b)*ap; denom:=b*(ap-bp); END IF;
 -- round(numer/denom) sem divisão NUMERIC arredondada em ponto de empate.
 cents:=div(2*numer+denom,2*denom); ref:=cents/100; saldo:=p_principal; tot:=0; j:=0;
 FOR i IN 1..p_n LOOP
 jl:=round(saldo*p_taxa/100,2); amort:=CASE WHEN i=p_n THEN saldo ELSE ref-jl END;
 vl:=amort+jl;
 IF amort<=0 OR amort>saldo OR vl<=0 THEN RAISE EXCEPTION 'Price com amortização negativa/parcela nula' USING ERRCODE='22023'; END IF;
 linhas:=linhas||jsonb_build_array(jsonb_build_object('valor',vl,'juros',jl,'principal',amort));
 saldo:=saldo-amort; tot:=tot+vl; j:=j+jl;
 END LOOP;
 IF saldo<>0 THEN RAISE EXCEPTION 'Price não fecha principal' USING ERRCODE='23514'; END IF;
 ELSE
 j:=round(p_principal*p_taxa/100*CASE WHEN p_modalidade='diario' THEN 1 ELSE p_n END,2);
 tot:=p_principal+j; ref:=round(tot/p_n,2); jr:=round(j/p_n,2);
 FOR i IN 1..p_n LOOP
 vl:=CASE WHEN i=p_n THEN tot-ref*(p_n-1) ELSE ref END;
 jl:=CASE WHEN i=p_n THEN j-jr*(p_n-1) ELSE jr END;
 IF vl<=0 OR jl<0 OR jl>vl THEN RAISE EXCEPTION 'Rateio com amortização negativa/parcela nula' USING ERRCODE='22023'; END IF;
 linhas:=linhas||jsonb_build_array(jsonb_build_object('valor',vl,'juros',jl,'principal',vl-jl));
 END LOOP;
 END IF;
 IF NOT emprestimos_lista60.public__multimodal_moeda(tot) THEN RAISE EXCEPTION 'Total excede NUMERIC(12,2)' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('linhas',linhas,'total',tot,'juros',j,'referencia',ref);
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.private47__estado_auditado(uid integer,cid integer,target jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE origin public.multimodal_origens%ROWTYPE; creation public.multimodal_operacoes%ROWTYPE; op public.multimodal_operacoes%ROWTYPE; latest public.multimodal_estados%ROWTYPE;
 s jsonb; initial jsonb; c jsonb; p jsonb; line jsonb; calc jsonb; expected jsonb; afters jsonb; nc jsonb; np jsonb; ps jsonb; hist jsonb; plan jsonb;
 n integer; i integer; totalops integer; applied integer:=0; candidates integer; seen uuid[]:='{}'; stamp timestamptz; dates date[]; net numeric; principal numeric; additional numeric:=0; appended obrigacoes51.adicionais%ROWTYPE;
BEGIN
 -- Catalog-only audit moved to installation/review60.

 -- Pure closed proof. No writes, adoption, origin bridge or runtime reseal. Locks belong to unchanged callers35/46/47.
 SELECT * INTO origin FROM public.multimodal_origens WHERE contrato_id=cid AND user_id=uid LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION '47 chain owner/origin unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT creation FROM public.multimodal_operacoes WHERE id=origin.operacao_id LIMIT 1;
 SELECT * INTO STRICT latest FROM public.multimodal_estados WHERE contrato_id=cid LIMIT 1;
 initial:=creation.auditoria->'depois'; s:=initial; c:=s->'contrato'; n:=origin.numero_inicial;
 IF creation.user_id IS DISTINCT FROM uid OR creation.family IS DISTINCT FROM 'multimodal_criar' OR creation.resultado IS NULL OR creation.concluida_em IS NULL
 OR creation.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(uid,creation.family,creation.request)
 OR creation.hash_payload IS DISTINCT FROM emprestimos_lista60.private47__hash(creation.payload) OR creation.auditoria->'hashPayload' IS DISTINCT FROM to_jsonb(creation.hash_payload)
 OR creation.auditoria->'payload' IS DISTINCT FROM creation.payload OR creation.auditoria->'resultado' IS DISTINCT FROM creation.resultado OR creation.auditoria->'antes' IS DISTINCT FROM 'null'::jsonb
 OR creation.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR creation.resultado->>'operationId' IS DISTINCT FROM creation.id::text OR creation.resultado->>'id' IS DISTINCT FROM cid::text
 OR s->'origem' IS DISTINCT FROM to_jsonb(origin) OR s->'renovacoes' IS DISTINCT FROM '[]'::jsonb OR n NOT BETWEEN 1 AND 60 OR jsonb_array_length(s->'parcelas') IS DISTINCT FROM n
 OR origin.modalidade IS DISTINCT FROM 'mensal' OR origin.tipo_taxa IS DISTINCT FROM 'mensal' OR origin.regra IS DISTINCT FROM 'multimodal_v1'
 OR c->>'id' IS DISTINCT FROM cid::text OR c->>'user_id' IS DISTINCT FROM uid::text OR c->>'cliente_id' IS DISTINCT FROM origin.cliente_id::text
 OR c->>'conta_caixa_id' IS DISTINCT FROM origin.conta_id::text OR c->'koletor_id' IS DISTINCT FROM coalesce(to_jsonb(origin.koletor_id),'null'::jsonb)
 OR c->'contrato_origem_id' IS DISTINCT FROM 'null'::jsonb OR c->>'status' IS DISTINCT FROM 'ativo' OR c->>'modalidade' IS DISTINCT FROM 'mensal' OR c->>'tipo_taxa' IS DISTINCT FROM 'mensal'
 OR c->>'num_parcelas' IS DISTINCT FROM n::text OR c->>'numero_parcelas' IS DISTINCT FROM n::text
 OR (c->>'valor_principal')::numeric IS DISTINCT FROM (creation.payload->>'valorPrincipal')::numeric OR (c->>'taxa_juros')::numeric IS DISTINCT FROM (creation.payload->>'taxaJuros')::numeric
 OR (c->>'multa_atraso')::numeric IS DISTINCT FROM (creation.payload->>'multaAtraso')::numeric OR (c->>'juros_mora_diario')::numeric IS DISTINCT FROM (creation.payload->>'jurosMoraDiario')::numeric
 OR c->>'data_inicio' IS DISTINCT FROM creation.payload->>'dataInicio' OR creation.payload->>'dataDesembolso' IS DISTINCT FROM creation.payload->>'dataInicio'
 OR c->'descricao' IS DISTINCT FROM creation.payload->'descricao' OR c->'observacoes' IS DISTINCT FROM creation.payload->'observacoes'
 THEN RAISE EXCEPTION '47 chain genuine creation25 proof inconsistent' USING ERRCODE='23514'; END IF;
 calc:=emprestimos_lista60.public__multimodal_calcular('mensal',(creation.payload->>'valorPrincipal')::numeric,(creation.payload->>'taxaJuros')::numeric,n);
 IF creation.auditoria->'extra' IS DISTINCT FROM calc OR (c->>'total_contrato')::numeric IS DISTINCT FROM (calc->>'total')::numeric
 OR (c->>'valor_parcela')::numeric IS DISTINCT FROM (calc->>'referencia')::numeric OR jsonb_array_length(creation.payload->'vencimentos') IS DISTINCT FROM n
 OR c->>'data_vencimento_primeira' IS DISTINCT FROM creation.payload->'vencimentos'->>0 OR c->>'data_vencimento' IS DISTINCT FROM creation.payload->'vencimentos'->>(n-1)
 OR (c->>'dia_vencimento')::int IS DISTINCT FROM extract(day FROM (c->>'data_vencimento_primeira')::date)::int
 OR jsonb_array_length(s->'ledger') IS DISTINCT FROM 1 OR jsonb_array_length(s->'historico') IS DISTINCT FROM 1
 OR NOT EXISTS(SELECT 1 FROM public.multimodal_pernas m JOIN public.transacoes_caixa t ON t.id=m.transacao_id WHERE m.operacao_id=creation.id AND m.transacao_id=origin.transacao_id AND m.snapshot=to_jsonb(t) AND s->'ledger'=jsonb_build_array(to_jsonb(t)) AND t.user_id=uid AND t.contrato_id=cid AND t.parcela_id IS NULL AND t.conta_caixa_id=origin.conta_id AND t.tipo='saida' AND t.categoria='emprestimo_liberado' AND t.valor=(c->>'valor_principal')::numeric LIMIT 1)
 THEN RAISE EXCEPTION '47 chain creation25 math/cash inconsistent' USING ERRCODE='23514'; END IF;
 i:=0;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LIMIT 60 LOOP
  line:=calc->'linhas'->i;
  IF p->>'numero' IS DISTINCT FROM (i+1)::text OR p->>'numero_parcela' IS DISTINCT FROM (i+1)::text OR p->>'contrato_id' IS DISTINCT FROM cid::text OR p->>'user_id' IS DISTINCT FROM uid::text
  OR p->>'cliente_id' IS DISTINCT FROM origin.cliente_id::text OR p->>'conta_caixa_id' IS DISTINCT FROM origin.conta_id::text OR p->'koletor_id' IS DISTINCT FROM coalesce(to_jsonb(origin.koletor_id),'null'::jsonb)
  OR (p->>'valor')::numeric IS DISTINCT FROM (line->>'valor')::numeric OR (p->>'valor_original')::numeric IS DISTINCT FROM (line->>'valor')::numeric OR (p->>'valor_juros')::numeric IS DISTINCT FROM (line->>'juros')::numeric
  OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric
  OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb
  OR p->>'data_vencimento' IS DISTINCT FROM creation.payload->'vencimentos'->>i OR p->>'data_vencimento' IS DISTINCT FROM emprestimos_lista60.public__multimodal_data((creation.payload->'vencimentos'->>0)::date,'mensal',i)::text
  OR p->>'status' NOT IN('pendente','atrasada','vencendo_hoje') OR NOT EXISTS(SELECT 1 FROM public.parcelas actual WHERE actual.id=(p->>'id')::int AND actual.contrato_id=cid AND actual.user_id=uid LIMIT 1)
  THEN RAISE EXCEPTION '47 chain original installment math/identity inconsistent' USING ERRCODE='23514'; END IF;
  i:=i+1;
 END LOOP;
 IF creation.resultado->'parcelasIds' IS DISTINCT FROM (SELECT jsonb_agg((j->>'id')::int ORDER BY (j->>'numero')::int) FROM jsonb_array_elements(s->'parcelas') j LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.multimodal_operacoes x WHERE x.id<>creation.id AND (x.payload->>'contratoId'=cid::text OR x.resultado->>'contratoId'=cid::text OR x.resultado->>'id'=cid::text OR x.auditoria->'antes'->'contrato'->>'id'=cid::text OR x.auditoria->'depois'->'contrato'->>'id'=cid::text)
 AND (x.user_id IS DISTINCT FROM uid OR x.family NOT IN('multimodal_calendario46','multimodal_manutencao48') OR (x.resultado IS NULL AND pg_xact_status(x.xmin::text::xid8) IS DISTINCT FROM 'in progress')) LIMIT 1)
 THEN RAISE EXCEPTION '47 chain other owner/family/receipt/renewal/fine unavailable' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO totalops FROM public.multimodal_operacoes x WHERE x.id<>creation.id AND x.resultado IS NOT NULL AND (x.payload->>'contratoId'=cid::text OR x.resultado->>'contratoId'=cid::text OR x.auditoria->'antes'->'contrato'->>'id'=cid::text OR x.auditoria->'depois'->'contrato'->>'id'=cid::text) LIMIT 1;
 IF totalops>1024 THEN RAISE EXCEPTION '47 chain closed proof bound exceeded' USING ERRCODE='54000'; END IF;
 WHILE applied<totalops LOOP
  SELECT count(*) INTO candidates FROM public.multimodal_operacoes x WHERE x.user_id=uid AND x.id<>creation.id AND NOT(x.id=ANY(seen)) AND x.resultado IS NOT NULL AND x.payload->>'contratoId'=cid::text AND x.auditoria->'antes'=s LIMIT 1;
  IF candidates<>1 THEN RAISE EXCEPTION '47 chain missing/branched/inconsistent predecessor' USING ERRCODE='23514'; END IF;
  SELECT * INTO STRICT op FROM public.multimodal_operacoes x WHERE x.user_id=uid AND x.id<>creation.id AND NOT(x.id=ANY(seen)) AND x.resultado IS NOT NULL AND x.payload->>'contratoId'=cid::text AND x.auditoria->'antes'=s LIMIT 1;
  afters:=op.auditoria->'depois'; stamp:=(afters->'contrato'->>'updatedAt')::timestamptz; hist:=afters->'historico'->jsonb_array_length(s->'historico'); expected:=s;
  IF op.concluida_em IS NULL OR op.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(uid,op.family,op.request) OR op.hash_payload IS DISTINCT FROM emprestimos_lista60.private47__hash(op.payload)
  OR op.auditoria->'payload' IS DISTINCT FROM op.payload OR op.auditoria->>'hashPayload' IS DISTINCT FROM op.hash_payload OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
  OR op.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR op.resultado->>'operationId' IS DISTINCT FROM op.id::text OR op.resultado->>'idempotencyKey' IS DISTINCT FROM op.chave::text OR op.resultado->>'contratoId' IS DISTINCT FROM cid::text
  OR op.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.private47__hash(s) OR op.auditoria->'extra'->>'predecessorEstadoHash' IS DISTINCT FROM emprestimos_lista60.private47__hash(s)
  OR op.auditoria->'extra'->>'origemOperacao' IS DISTINCT FROM creation.id::text OR op.auditoria->'extra'->>'familia' IS DISTINCT FROM op.family
  OR stamp IS NULL OR stamp<(s->'contrato'->>'updatedAt')::timestamptz OR op.concluida_em<stamp
  OR hist IS NULL OR hist->>'contrato_id' IS DISTINCT FROM cid::text OR hist->>'user_id' IS DISTINCT FROM uid::text OR (hist->>'created_at')::timestamptz IS DISTINCT FROM stamp
  OR hist->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR hist->'valor_novo' IS DISTINCT FROM 'null'::jsonb
  OR EXISTS(SELECT 1 FROM public.multimodal_pernas WHERE operacao_id=op.id LIMIT 1)
  THEN RAISE EXCEPTION '47 chain operation/hash/version/history/cash inconsistent' USING ERRCODE='23514'; END IF;
  IF op.family='multimodal_calendario46' THEN
   SELECT array_agg(value::date ORDER BY ord) INTO dates FROM jsonb_array_elements_text(op.request->'vencimentos') WITH ORDINALITY a(value,ord) LIMIT 1;
   PERFORM emprestimos_lista60.manutencao44__agenda(cid,dates,(s->'contrato'->>'data_inicio')::date,n);
   IF op.request IS DISTINCT FROM emprestimos_lista60.manutencao44__request(cid,emprestimos_lista60.private47__hash(s),dates,op.request->>'motivo') OR dates[1]<=(stamp AT TIME ZONE 'America/Sao_Paulo')::date
   OR hist->>'tipo' IS DISTINCT FROM 'edicao_calendario' OR hist->>'descricao' IS DISTINCT FROM 'Calendário25 auditado '||op.id::text||': '||btrim(op.request->>'motivo')
   OR op.resultado->'vencimentos' IS DISTINCT FROM to_jsonb(dates) OR op.auditoria->'extra'->>'delta' IS DISTINCT FROM 'dates+timestamps+append_history_only'
   THEN RAISE EXCEPTION '47 chain calendar delta inconsistent' USING ERRCODE='23514'; END IF;
   ps:='[]';
   FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'id')::int LIMIT 60 LOOP
    np:=p||jsonb_build_object('data_vencimento',dates[(p->>'numero')::int],'updatedAt',stamp); ps:=ps||jsonb_build_array(np);
   END LOOP;
   nc:=(s->'contrato')||jsonb_build_object('data_vencimento_primeira',dates[1],'data_vencimento',dates[n],'dia_vencimento',extract(day FROM dates[1])::int,'updatedAt',stamp);
   expected:=jsonb_set(jsonb_set(expected,'{parcelas}',ps),'{contrato}',nc);
  ELSIF op.family='multimodal_manutencao48' THEN
   -- Catalog-only audit moved to installation/review60.

   IF op.request->'alteracao'->>'acao' NOT IN('juros','valor','desconto','adicionar','editar') OR op.request IS DISTINCT FROM emprestimos_lista60.manutencao48__request(cid,emprestimos_lista60.private47__hash(s),op.request->'alteracao',op.request->>'motivo')
   OR hist->>'tipo' IS DISTINCT FROM 'manutencao_'||(op.request->'alteracao'->>'acao') OR hist->>'descricao' IS DISTINCT FROM 'Manutenção25 '||op.id::text||': '||(op.request->>'motivo')
   OR op.auditoria->'extra'->'caixaPreservado' IS DISTINCT FROM 'true'::jsonb
   THEN RAISE EXCEPTION '47 chain maintenance action/history inconsistent' USING ERRCODE='23514'; END IF;
   IF op.request->'alteracao'->>'acao'='adicionar' THEN
 SELECT * INTO STRICT appended FROM obrigacoes51.adicionais WHERE operacao48=op.id AND user_id=uid AND contrato_id=cid LIMIT 1;
 IF appended.hash_linha IS DISTINCT FROM emprestimos_lista60.obrigacoes51__hash(appended.linha_inicial) OR appended.valor IS DISTINCT FROM (op.request->'alteracao'->>'valor')::numeric OR appended.numero<>n+1 OR appended.parcela_id IS DISTINCT FROM (appended.linha_inicial->>'id')::int THEN RAISE EXCEPTION '51 append witness inválido' USING ERRCODE='23514'; END IF;
 plan:=emprestimos_lista60.obrigacoes51__plano(s,op.request->'alteracao',stamp,appended.linha_inicial);n:=n+1;additional:=additional+appended.valor;
 ELSE plan:=emprestimos_lista60.manutencao48__plano(s,op.request->'alteracao',stamp); END IF;
   IF op.resultado->>'totalContrato' IS DISTINCT FROM plan->>'totalContrato' OR op.resultado->>'jurosTotal' IS DISTINCT FROM plan->>'jurosTotal' OR op.resultado->>'obrigacaoCancelada' IS DISTINCT FROM '0.00'
   OR op.auditoria->'extra'->>'compensacaoObrigacao' IS DISTINCT FROM '0.00' THEN RAISE EXCEPTION '47 chain maintenance totals inconsistent' USING ERRCODE='23514'; END IF;
   expected:=jsonb_set(jsonb_set(expected,'{parcelas}',plan->'parcelas'),'{contrato}',plan->'contrato');
  ELSE RAISE EXCEPTION '47 chain family not allowlisted' USING ERRCODE='23514'; END IF;
  expected:=jsonb_set(expected,'{historico}',s->'historico'||jsonb_build_array(hist));
  IF expected IS DISTINCT FROM afters THEN RAISE EXCEPTION '47 chain full snapshot transition inconsistent' USING ERRCODE='23514'; END IF;
  -- JSONB numeric equality is scale-insensitive; hashes bind audited text exactly. Preserve its existing representation only AFTER full deterministic delta equality. Never rewrite/reseal it.
  s:=afters; seen:=array_append(seen,op.id); applied:=applied+1;
 END LOOP;
 SELECT sum((j->>'valor_original')::numeric),sum((j->>'valor_original')::numeric-(j->>'valor_juros')::numeric) INTO net,principal FROM jsonb_array_elements(s->'parcelas') j LIMIT 1;
 IF s IS DISTINCT FROM target OR latest.user_id IS DISTINCT FROM uid OR latest.snapshot IS DISTINCT FROM s OR latest.hash_snapshot IS DISTINCT FROM emprestimos_lista60.private47__hash(s)
 OR latest.operacao_id IS DISTINCT FROM (CASE WHEN applied=0 THEN creation.id ELSE op.id END)
 OR s->'origem' IS DISTINCT FROM initial->'origem' OR s->'ledger' IS DISTINCT FROM initial->'ledger' OR s->'renovacoes' IS DISTINCT FROM '[]'::jsonb
 OR net IS DISTINCT FROM (s->'contrato'->>'total_contrato')::numeric OR principal-additional IS DISTINCT FROM (initial->'contrato'->>'valor_principal')::numeric
 THEN RAISE EXCEPTION '47 chain terminal snapshot/principal/ledger/version inconsistent' USING ERRCODE='23514', DETAIL=jsonb_build_object('applied',applied,'targetDiff',s IS DISTINCT FROM target,'latestDiff',latest.snapshot IS DISTINCT FROM s,'hashDiff',latest.hash_snapshot IS DISTINCT FROM emprestimos_lista60.private47__hash(s),'op',op.id,'latestOp',latest.operacao_id,'net',net,'total',s->'contrato'->>'total_contrato','principal',principal,'initialPrincipal',initial->'contrato'->>'valor_principal','originDiff',s->'origem' IS DISTINCT FROM initial->'origem','ledgerDiff',s->'ledger' IS DISTINCT FROM initial->'ledger')::text; END IF;
 RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_snapshot(cid integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
 SELECT jsonb_build_object('contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE c.id=cid),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.parcelas p WHERE p.contrato_id=cid),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE h.contrato_id=cid),'[]'::jsonb),
 'origem',(SELECT to_jsonb(o) FROM public.multimodal_origens o WHERE o.contrato_id=cid),
 'renovacoes',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.anterior_id) FROM public.multimodal_renovacoes r WHERE r.contrato_id=cid),'[]'::jsonb));
$clone60s$;
CREATE FUNCTION emprestimos_lista60.private47__validar_op(oid47 uuid) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE op private47.operacoes%ROWTYPE; ch private47.cadeia%ROWTYPE; q private47.cotacoes%ROWTYPE; a jsonb; b jsonb; v jsonb; old35 jsonb;
BEGIN
 SELECT * INTO STRICT op FROM private47.operacoes WHERE id=oid47;
 SELECT * INTO STRICT ch FROM private47.cadeia WHERE operacao_id=oid47;
 SELECT * INTO STRICT q FROM private47.cotacoes WHERE id=(op.request->>'cotacaoId')::uuid AND user_id=op.user_id;
 a:=op.auditoria->'antes'; b:=op.auditoria->'depoisOrigem';
 IF ch.obrigacao_adicional IS DISTINCT FROM coalesce((q.cotacao->>'obrigacaoAdicional')::numeric,0) OR (ch.obrigacao_adicional>0 AND (q.cotacao->>'regra' IS DISTINCT FROM 'reparcelamento47_cotacao_v3' OR op.resultado->>'regra' IS DISTINCT FROM 'reparcelamento47_v3' OR op.resultado->>'obrigacaoAdicional' IS DISTINCT FROM q.cotacao->>'obrigacaoAdicional')) THEN RAISE EXCEPTION '51 componente adicional47 versão/prova inválida' USING ERRCODE='23514';END IF;
 IF op.resultado IS NULL OR op.hash_request IS DISTINCT FROM emprestimos_lista60.private47__hash(op.request) OR op.hash_auditoria IS DISTINCT FROM emprestimos_lista60.private47__hash(op.auditoria) OR op.auditoria->'request' IS DISTINCT FROM op.request OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado OR op.auditoria->'cotacao' IS DISTINCT FROM q.cotacao OR q.hash_cotacao IS DISTINCT FROM emprestimos_lista60.private47__hash(q.cotacao) OR op.request->>'cotacaoHash' IS DISTINCT FROM q.hash_cotacao OR op.request->>'estadoHash' IS DISTINCT FROM q.cotacao->>'estadoHash' OR op.user_id<>ch.user_id OR op.resultado->>'operationId' IS DISTINCT FROM op.id::text OR op.resultado->>'contratoId' IS DISTINCT FROM ch.sucessor_id::text OR ch.saldo_transferido IS DISTINCT FROM (q.cotacao->>'saldoDevedor')::numeric OR ch.principal_original IS DISTINCT FROM (q.cotacao->>'principalOriginal')::numeric OR ch.juros_embutidos IS DISTINCT FROM (q.cotacao->>'jurosEmbutidos')::numeric THEN RAISE EXCEPTION '47 operação/prova divergente' USING ERRCODE='23514'; END IF;
 IF op.auditoria->'sucessor'->'contrato'->>'contrato_origem_id' IS DISTINCT FROM ch.origem_id::text OR (op.auditoria->'sucessor'->'contrato'->>'valor_principal')::numeric IS DISTINCT FROM ch.saldo_transferido OR (op.auditoria->'sucessor'->'contrato'->>'total_contrato')::numeric IS DISTINCT FROM (q.cotacao->>'totalNovo')::numeric OR op.auditoria->'sucessor'->'ledger' IS DISTINCT FROM '[]'::jsonb OR op.auditoria->'sucessor'->'origem' IS DISTINCT FROM 'null'::jsonb OR op.auditoria->'sucessor'->'renovacoes' IS DISTINCT FROM '[]'::jsonb OR jsonb_array_length(op.auditoria->'sucessor'->'parcelas') IS DISTINCT FROM jsonb_array_length(q.cotacao->'parcelas') THEN RAISE EXCEPTION '47 sucessor saldo/proveniência inválido' USING ERRCODE='23514'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(q.cotacao->'parcelas') LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(op.auditoria->'sucessor'->'parcelas') p WHERE p->>'numero'=v->>'numero' AND (p->>'valor_original')::numeric=(v->>'valor')::numeric AND (p->>'valor_juros')::numeric=(v->>'juros')::numeric AND p->>'data_vencimento'=v->>'vencimento' AND (p->>'valor_pago')::numeric=0 AND (p->>'saldo_residual')::numeric=0 AND p->'data_pagamento'='null'::jsonb) THEN RAISE EXCEPTION '47 agenda sucessora não equivale simulação' USING ERRCODE='23514'; END IF;
 END LOOP;
 SELECT auditoria->'depois' INTO STRICT old35 FROM public.multimodal_operacoes WHERE id=ch.origem_operation_id AND family='multimodal_criar' AND user_id=ch.user_id;
 PERFORM emprestimos_lista60.private47__estado_auditado(ch.user_id,ch.origem_id,a);
 IF old35->'origem' IS DISTINCT FROM a->'origem' OR a->'origem' IS DISTINCT FROM (SELECT to_jsonb(o) FROM public.multimodal_origens o WHERE contrato_id=ch.origem_id) OR a->'ledger' IS DISTINCT FROM b->'ledger' OR a->'origem' IS DISTINCT FROM b->'origem' OR a->'renovacoes' IS DISTINCT FROM b->'renovacoes' OR ((a->'contrato')-ARRAY['status','updatedAt']) IS DISTINCT FROM ((b->'contrato')-ARRAY['status','updatedAt']) OR b->'contrato'->>'status'<>'cancelado' OR jsonb_array_length(a->'parcelas')<>jsonb_array_length(b->'parcelas') THEN RAISE EXCEPTION '47 preservação da origem25 divergente' USING ERRCODE='23514'; END IF;
 FOR v IN SELECT value FROM jsonb_array_elements(a->'parcelas') LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(b->'parcelas') p WHERE p-'status'-'updatedAt'=v-'status'-'updatedAt' AND p->>'status'='cancelada') THEN RAISE EXCEPTION '47 parcela original adulterada' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF emprestimos_lista60.public__multimodal_snapshot(ch.origem_id) IS DISTINCT FROM b THEN RAISE EXCEPTION '47 origem encerrada divergente' USING ERRCODE='23514'; END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__vinculos(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE c public.contratos%ROWTYPE;
BEGIN
 IF uid IS NULL OR uid<=0 OR cid IS NULL OR cid<=0 THEN RAISE EXCEPTION '51 owner/contrato inválidos' USING ERRCODE='22023';END IF;
 SELECT * INTO c FROM public.contratos WHERE id=cid LIMIT 1;
 IF NOT FOUND OR c.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '51 registro indisponível' USING ERRCODE='42501';END IF;
 IF c.modalidade='cheque' THEN RAISE EXCEPTION '51 Cheques fora do escopo' USING ERRCODE='0A000';END IF;
 IF c.conta_caixa_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid LIMIT 1)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=uid LIMIT 1)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid LIMIT 1))
 OR EXISTS(SELECT 1 FROM public.parcelas p WHERE p.contrato_id=cid AND (p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR p.koletor_id IS DISTINCT FROM c.koletor_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id) LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE (t.conta_caixa_id=c.conta_caixa_id OR t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND (t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa a WHERE a.id=t.conta_caixa_id AND a.user_id=uid LIMIT 1) OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos co WHERE co.id=t.contrato_id AND co.user_id=uid LIMIT 1)) OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos co ON co.id=p.contrato_id WHERE p.id=t.parcela_id AND p.user_id=uid AND co.user_id=uid AND t.contrato_id=co.id LIMIT 1))) LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 OR EXISTS(SELECT 1 FROM obrigacoes51.adicionais WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid LIMIT 1)
 THEN RAISE EXCEPTION '51 vínculos próprios completos obrigatórios; sem saneamento' USING ERRCODE='42501';END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__closure(uid integer,k uuid,r jsonb,oid53 uuid,status53 text) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE ch private47.cadeia%ROWTYPE;out53 jsonb;
BEGIN
 SELECT * INTO STRICT ch FROM private47.cadeia WHERE sucessor_id=(r->>'contratoId')::int AND user_id=uid;
 out53:=jsonb_build_object('versao','sucessores53_v1','status',status53,'sameIntentOnly',true,'userId',uid,'idempotencyKey',k,'request',r);
 IF status53='confirmed' THEN out53:=out53||jsonb_build_object('resultado',jsonb_build_object('operationId',oid53,'contratoId',ch.sucessor_id,'paiId',ch.origem_id,'raizId',ch.origem_id,'parcelaId',(r->'proposta'->>'parcelaId')::int,'caixaPreservado',true,'semantica','Bi_preservada_Jn_apenas'));END IF;RETURN out53;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__hash(j jsonb) RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__abertas(uid integer,s jsonb,stamp timestamptz) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE cid integer:=(s->'contrato'->>'id')::int;n integer:=jsonb_array_length(s->'parcelas');p jsonb;i integer:=0;
BEGIN
 PERFORM emprestimos_lista60.obrigacoes51__vinculos(uid,cid);
 IF s->'contrato'->>'status' IS DISTINCT FROM 'ativo' OR n NOT BETWEEN 1 AND 60 OR s->'contrato'->>'num_parcelas' IS DISTINCT FROM n::text OR s->'contrato'->>'numero_parcelas' IS DISTINCT FROM n::text OR s->'renovacoes'<>'[]'::jsonb OR EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid LIMIT 1) OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) OR s->'ledger'<>'[]'::jsonb THEN RAISE EXCEPTION '53 manutenção apenas folha47 inteira aberta; baixa/renúncia/encargo excluído' USING ERRCODE='0A000';END IF;
 FOR p IN SELECT value FROM jsonb_array_elements(s->'parcelas') ORDER BY (value->>'numero')::int LOOP
 i:=i+1;
 IF p->>'numero' IS DISTINCT FROM i::text OR p->>'numero_parcela' IS DISTINCT FROM i::text OR p->>'status' IS DISTINCT FROM 'pendente' OR (p->>'valor_pago')::numeric IS DISTINCT FROM 0::numeric OR (p->>'saldo_residual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_multa')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_manual')::numeric IS DISTINCT FROM 0::numeric OR (p->>'multa_diaria_usada')::numeric IS DISTINCT FROM 0::numeric OR (p->>'valor_desconto')::numeric IS DISTINCT FROM 0::numeric OR p->'data_pagamento' IS DISTINCT FROM 'null'::jsonb OR (p->>'data_vencimento')::date<=(stamp AT TIME ZONE 'America/Sao_Paulo')::date OR (p->>'valor')::numeric IS DISTINCT FROM (p->>'valor_original')::numeric OR (p->>'valor_original')::numeric-(p->>'valor_juros')::numeric<=0 THEN RAISE EXCEPTION '53 parcelas completas futuras sem baixa obrigatórias' USING ERRCODE='23514';END IF;
 END LOOP;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__proposta(v jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE r jsonb; d date; m numeric;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'object' OR v->>'versao' IS DISTINCT FROM 'sucessores53_editar_v1' OR v->>'acao' IS DISTINCT FROM 'editar' OR NOT(v?'parcelaId') OR (v-ARRAY['versao','acao','parcelaId','novaDataVencimento','novoValor'])<>'{}'::jsonb OR NOT(v?'novaDataVencimento' OR v?'novoValor') THEN RAISE EXCEPTION '53 proposta fechada obrigatória' USING ERRCODE='22023';END IF;
 r:=jsonb_build_object('versao','sucessores53_editar_v1','acao','editar','parcelaId',emprestimos_lista60.obrigacoes51__id(v->'parcelaId'));
 IF v?'novaDataVencimento' THEN d:=emprestimos_lista60.obrigacoes51__dia(v->>'novaDataVencimento');r:=r||jsonb_build_object('novaDataVencimento',d);END IF;
 IF v?'novoValor' THEN m:=emprestimos_lista60.obrigacoes51__dinheiro(v->>'novoValor');r:=r||jsonb_build_object('novoValor',m::numeric(12,2)::text);END IF;
 IF r IS DISTINCT FROM v THEN RAISE EXCEPTION '53 proposta não canônica' USING ERRCODE='22023';END IF;RETURN r;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__plano(uid integer,s jsonb,v jsonb,stamp timestamptz,oid53 uuid,motivo text,h jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE target integer; p jsonb; np jsonb; ps jsonb; c jsonb; d date; low date; high date; b numeric; value53 numeric;total53 numeric;first53 date;last53 date;
BEGIN
 v:=emprestimos_lista60.sucessores53__proposta(v);target:=(v->>'parcelaId')::int;PERFORM emprestimos_lista60.sucessores53__abertas(uid,s,stamp);
 SELECT value INTO p FROM jsonb_array_elements(s->'parcelas') WHERE value->>'id'=target::text;
 IF NOT FOUND THEN RAISE EXCEPTION '53 parcela própria indisponível' USING ERRCODE='42501';END IF;
 np:=p;
 IF v?'novaDataVencimento' THEN
 d:=(v->>'novaDataVencimento')::date;
 SELECT max((j->>'data_vencimento')::date) INTO low FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int<(p->>'numero')::int;
 SELECT min((j->>'data_vencimento')::date) INTO high FROM jsonb_array_elements(s->'parcelas') j WHERE (j->>'numero')::int>(p->>'numero')::int;
 IF d<=(stamp AT TIME ZONE 'America/Sao_Paulo')::date OR d<(s->'contrato'->>'data_inicio')::date OR (low IS NOT NULL AND d<=low) OR (high IS NOT NULL AND d>=high) THEN RAISE EXCEPTION '53 data futura entre vizinhas estritas' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('data_vencimento',d);
 END IF;
 IF v?'novoValor' THEN
 b:=(p->>'valor_original')::numeric-(p->>'valor_juros')::numeric;value53:=(v->>'novoValor')::numeric;
 IF value53<b THEN RAISE EXCEPTION '53 novo valor menor que base transferida Bi' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('valor',value53,'valor_original',value53,'valor_juros',value53-b);
 END IF;
 IF np=p THEN RAISE EXCEPTION '53 alteração vazia' USING ERRCODE='22023';END IF;
 np:=np||jsonb_build_object('updatedAt',stamp);
 SELECT jsonb_agg(CASE WHEN j->>'id'=target::text THEN np ELSE j END ORDER BY (j->>'id')::int) INTO ps FROM jsonb_array_elements(s->'parcelas') j;
 SELECT sum((j->>'valor_original')::numeric),min((j->>'data_vencimento')::date),max((j->>'data_vencimento')::date) INTO total53,first53,last53 FROM jsonb_array_elements(ps) j;
 IF NOT emprestimos_lista60.public__multimodal_moeda(total53) THEN RAISE EXCEPTION '53 total fora writer' USING ERRCODE='22023';END IF;
 c:=(s->'contrato')||jsonb_build_object('total_contrato',total53,'valor_parcela',round(total53/jsonb_array_length(ps),2),'data_vencimento_primeira',first53,'data_vencimento',last53,'dia_vencimento',extract(day FROM first53)::int,'updatedAt',stamp);
 IF h IS NOT NULL THEN
 IF h->>'contrato_id' IS DISTINCT FROM s->'contrato'->>'id' OR h->>'user_id' IS DISTINCT FROM uid::text OR h->>'tipo' IS DISTINCT FROM 'edicao_parcela' OR h->>'descricao' IS DISTINCT FROM 'Manutenção sucessor53 '||oid53::text||': '||motivo OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR h->'valor_anterior' IS DISTINCT FROM 'null'::jsonb OR h->'valor_novo' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION '53 histórico delta inválido' USING ERRCODE='23514';END IF;
 END IF;
 RETURN jsonb_set(jsonb_set(jsonb_set(s,'{parcelas}',ps),'{contrato}',c),'{historico}',s->'historico'||CASE WHEN h IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(h) END);
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__ciclo_encargos(p_original numeric,p_multa numeric,p_mora numeric,p_vencimento date,p_instante timestamptz) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT jsonb_build_object('dias',greatest(0,(p_instante AT TIME ZONE 'America/Sao_Paulo')::date-p_vencimento),
 'multa',CASE WHEN (p_instante AT TIME ZONE 'America/Sao_Paulo')::date>p_vencimento THEN round(p_original*p_multa/100,2) ELSE 0 END,
 'mora',round(p_original*p_mora/100*greatest(0,(p_instante AT TIME ZONE 'America/Sao_Paulo')::date-p_vencimento),2));
$clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__recebimento(uid integer,cid integer,s jsonb,o public.multimodal_operacoes) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE a jsonb:=o.auditoria->'depois';p jsonb;np jsonb;c jsonb:=s->'contrato';h jsonb;t jsonb;stamp timestamptz;day53 date;due numeric;fine numeric;mora numeric;cash numeric;paid numeric;residual numeric;enc jsonb;status53 text;r jsonb;extra jsonb;pid53 integer;
BEGIN
 pid53:=(o.payload->>'parcelaId')::int;SELECT value INTO p FROM jsonb_array_elements(s->'parcelas') WHERE value->>'id'=pid53::text;
 stamp:=(a->'contrato'->>'updatedAt')::timestamptz;day53:=(stamp AT TIME ZONE 'America/Sao_Paulo')::date;
 IF p IS NULL OR o.family IS DISTINCT FROM 'multimodal_receber' OR o.payload->>'modo' NOT IN('integral','parcial') OR o.payload->>'dataPagamento' IS DISTINCT FROM day53::text OR stamp IS NULL OR o.concluida_em<stamp OR p->>'status' NOT IN('pendente','parcial','atrasada','vencendo_hoje') THEN RAISE EXCEPTION '53 replay recebimento35 indisponível' USING ERRCODE='23514';END IF;
 IF p->>'status'='parcial' THEN due:=(p->>'saldo_residual')::numeric;fine:=(p->>'valor_multa')::numeric;mora:=(p->>'multa_diaria_usada')::numeric;
 ELSE enc:=emprestimos_lista60.public__ciclo_encargos((p->>'valor_original')::numeric,(c->>'multa_atraso')::numeric,(c->>'juros_mora_diario')::numeric,(p->>'data_vencimento')::date,stamp);fine:=(enc->>'multa')::numeric;mora:=(enc->>'mora')::numeric;due:=(p->>'valor_original')::numeric+fine+mora;END IF;
 cash:=(o.payload->>'valorRecebido')::numeric;paid:=(p->>'valor_pago')::numeric+cash;residual:=due-cash;
 IF cash<=0 OR due<=0 OR o.payload->>'totalExigido' IS DISTINCT FROM due::numeric(15,2)::text OR (o.payload->>'modo'='integral' AND cash<>due) OR (o.payload->>'modo'='parcial' AND cash>=due) THEN RAISE EXCEPTION '53 replay recebimento35 valores inválidos' USING ERRCODE='23514';END IF;
 np:=p||jsonb_build_object('valor_pago',paid,'valor_multa',fine,'multa_diaria_usada',mora,'saldo_residual',residual,'valor_desconto',0,'data_pagamento',day53,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'updatedAt',stamp,'observacoes',nullif(btrim(o.payload->>'observacoes'),''));
 s:=jsonb_set(s,'{parcelas}',(SELECT jsonb_agg(CASE WHEN j->>'id'=pid53::text THEN np ELSE j END ORDER BY (j->>'id')::int) FROM jsonb_array_elements(s->'parcelas') j));
 status53:=CASE WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'parcelas') j WHERE j->>'status'<>'paga') THEN 'quitado' ELSE 'ativo' END;
 s:=jsonb_set(s,'{contrato}',c||jsonb_build_object('status',status53,'updatedAt',stamp));
 t:=a->'ledger'->jsonb_array_length(s->'ledger');h:=a->'historico'->jsonb_array_length(s->'historico');
 IF t IS NULL OR h IS NULL OR t->>'user_id' IS DISTINCT FROM uid::text OR t->>'contrato_id' IS DISTINCT FROM cid::text OR t->>'parcela_id' IS DISTINCT FROM pid53::text OR t->'conta_caixa_id' IS DISTINCT FROM c->'conta_caixa_id' OR t->>'tipo' IS DISTINCT FROM 'entrada' OR t->>'categoria' IS DISTINCT FROM 'pagamento_parcela' OR (t->>'valor')::numeric IS DISTINCT FROM cash OR t->>'descricao' IS DISTINCT FROM 'Recebimento multimodal '||o.id::text OR t->>'data_transacao' IS DISTINCT FROM day53::text OR (t->>'createdAt')::timestamptz IS DISTINCT FROM stamp OR h->>'contrato_id' IS DISTINCT FROM cid::text OR h->>'user_id' IS DISTINCT FROM uid::text OR h->>'tipo' IS DISTINCT FROM 'pagamento' OR h->>'descricao' IS DISTINCT FROM 'Recebimento multimodal '||o.id::text OR (h->>'valor_anterior')::numeric IS DISTINCT FROM paid-cash OR (h->>'valor_novo')::numeric IS DISTINCT FROM paid OR (h->>'created_at')::timestamptz IS DISTINCT FROM stamp OR (SELECT count(*) FROM public.multimodal_pernas WHERE operacao_id=o.id)<>1 OR NOT EXISTS(SELECT 1 FROM public.multimodal_pernas leg JOIN public.transacoes_caixa physical ON physical.id=leg.transacao_id WHERE leg.operacao_id=o.id AND leg.snapshot=t AND to_jsonb(physical)=t) THEN RAISE EXCEPTION '53 perna35/histórico completo divergente' USING ERRCODE='23514';END IF;
 r:=jsonb_build_object('success',true,'repetida',false,'operationId',o.id,'contratoId',cid,'parcelaId',pid53,'transacaoCaixaId',t->>'id','contaCaixaId',(c->>'conta_caixa_id')::int,'valorRecebido',cash::numeric(15,2)::text,'totalExigido',due::numeric(15,2)::text,'saldoResidual',residual::numeric(15,2)::text,'valorPagoAcumulado',paid::numeric(15,2)::text,'dataPagamento',day53,'status',CASE WHEN residual=0 THEN 'paga' ELSE 'parcial' END,'contratoStatus',status53,'regra','recebimento_multimodal_brt_v1');
 IF o.resultado IS DISTINCT FROM r THEN RAISE EXCEPTION '53 resultado35 divergente' USING ERRCODE='23514';END IF;
 RETURN jsonb_set(jsonb_set(s,'{ledger}',s->'ledger'||jsonb_build_array(t)),'{historico}',s->'historico'||jsonb_build_array(h));
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__request(r jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE cid integer; d date; v jsonb;
BEGIN
 IF r IS NULL OR jsonb_typeof(r)<>'object' OR (SELECT count(*) FROM jsonb_object_keys(r))<>5 OR (r-ARRAY['contratoId','proposta','estadoHash','dataCalculo','motivo'])<>'{}'::jsonb OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' OR jsonb_typeof(r->'motivo') IS DISTINCT FROM 'string' OR length(r->>'motivo') NOT BETWEEN 3 AND 500 OR btrim(r->>'motivo')<>r->>'motivo' THEN RAISE EXCEPTION '53 request inválido' USING ERRCODE='22023';END IF;
 cid:=emprestimos_lista60.obrigacoes51__id(r->'contratoId');d:=emprestimos_lista60.obrigacoes51__dia(r->>'dataCalculo');v:=emprestimos_lista60.sucessores53__proposta(r->'proposta');RETURN r;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.sucessores53__replay(uid integer,cid integer,target jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE ch private47.cadeia%ROWTYPE;s jsonb;ownop sucessores53.operacoes%ROWTYPE;mop public.multimodal_operacoes%ROWTYPE;x record;seen uuid[]:='{}';n integer;candidates integer;applied integer:=0;h jsonb;expected jsonb;
BEGIN
 -- Catalog-only audit moved to installation/review60.

 SELECT * INTO ch FROM private47.cadeia WHERE sucessor_id=cid;
 IF NOT FOUND OR ch.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '53 exige sucessor47 nativo real' USING ERRCODE='42501';END IF;
 PERFORM emprestimos_lista60.private47__validar_op(ch.operacao_id);PERFORM emprestimos_lista60.obrigacoes51__vinculos(uid,cid);
 SELECT auditoria->'sucessor' INTO STRICT s FROM private47.operacoes WHERE id=ch.operacao_id;
 IF EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM private47.cadeia WHERE origem_id=cid) OR target->'contrato'->>'contrato_origem_id' IS DISTINCT FROM ch.origem_id::text OR target->'origem' IS DISTINCT FROM 'null'::jsonb OR target->'renovacoes' IS DISTINCT FROM '[]'::jsonb THEN RAISE EXCEPTION '53 proveniência dupla/alterada' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM sucessores53.operacoes WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR (resultado IS NULL AND (xmin::text::xid8 IS DISTINCT FROM pg_current_xact_id_if_assigned()))) LIMIT 1) OR EXISTS(SELECT 1 FROM public.multimodal_operacoes WHERE (payload->>'contratoId'=cid::text OR resultado->>'contratoId'=cid::text OR auditoria->'antes'->'contrato'->>'id'=cid::text OR auditoria->'depois'->'contrato'->>'id'=cid::text) AND (user_id IS DISTINCT FROM uid OR family IS DISTINCT FROM 'multimodal_receber' OR (resultado IS NULL AND xmin::text::xid8 IS DISTINCT FROM pg_current_xact_id_if_assigned())) LIMIT 1) THEN RAISE EXCEPTION '53 operação órfã/owner/família inválida' USING ERRCODE='23514';END IF;
 SELECT (SELECT count(*) FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL)+(SELECT count(*) FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL) INTO n;
 IF n>1024 THEN RAISE EXCEPTION '53 replay limite fechado' USING ERRCODE='54000';END IF;
 WHILE applied<n LOOP
 SELECT count(*) INTO candidates FROM (
 SELECT id FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND antes=s
 UNION ALL SELECT id FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND auditoria->'antes'=s) a;
 IF candidates<>1 THEN RAISE EXCEPTION '53 predecessor omitido/duplicado/bifurcado' USING ERRCODE='23514';END IF;
 SELECT id,kind INTO x FROM (SELECT id,'own' kind FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND antes=s UNION ALL SELECT id,'receipt' kind FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL AND NOT(id=ANY(seen)) AND auditoria->'antes'=s) a;
 IF x.kind='own' THEN
 SELECT * INTO STRICT ownop FROM sucessores53.operacoes WHERE id=x.id;
 h:=ownop.depois->'historico'->jsonb_array_length(s->'historico');
 IF ownop.user_id IS DISTINCT FROM uid OR ownop.hash_request IS DISTINCT FROM emprestimos_lista60.sucessores53__hash(ownop.request) OR ownop.request IS DISTINCT FROM emprestimos_lista60.sucessores53__request(ownop.request) OR ownop.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.sucessores53__hash(s) OR ownop.request->>'dataCalculo' IS DISTINCT FROM (ownop.instante AT TIME ZONE 'America/Sao_Paulo')::date::text OR ownop.concluida_em<ownop.instante OR ownop.hash_resultado IS DISTINCT FROM emprestimos_lista60.sucessores53__hash(ownop.resultado) OR ownop.resultado IS DISTINCT FROM emprestimos_lista60.sucessores53__closure(uid,ownop.chave,ownop.request,ownop.id,'confirmed') THEN RAISE EXCEPTION '53 replay request/closure inválido' USING ERRCODE='23514';END IF;
 expected:=emprestimos_lista60.sucessores53__plano(uid,s,ownop.request->'proposta',ownop.instante,ownop.id,ownop.request->>'motivo',h);
 IF expected IS DISTINCT FROM ownop.depois THEN RAISE EXCEPTION '53 replay plano/delta financeiro divergente' USING ERRCODE='23514';END IF;s:=ownop.depois;
 ELSE
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=x.id;
 IF mop.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(uid,mop.family,mop.request) OR mop.hash_payload IS DISTINCT FROM emprestimos_lista60.sucessores53__hash(mop.payload) OR mop.auditoria->'payload' IS DISTINCT FROM mop.payload OR mop.auditoria->>'hashPayload' IS DISTINCT FROM mop.hash_payload OR mop.auditoria->'resultado' IS DISTINCT FROM mop.resultado OR mop.request->>'estadoHash' IS DISTINCT FROM emprestimos_lista60.sucessores53__hash(s) OR NOT EXISTS(SELECT 1 FROM private47.recebimentos WHERE operacao_id=mop.id AND contrato_id=cid AND user_id=uid AND snapshot=mop.auditoria->'depois' AND hash_snapshot=emprestimos_lista60.sucessores53__hash(snapshot)) THEN RAISE EXCEPTION '53 recebimento35/prova divergente' USING ERRCODE='23514';END IF;
 expected:=emprestimos_lista60.sucessores53__recebimento(uid,cid,s,mop);IF expected IS DISTINCT FROM mop.auditoria->'depois' THEN RAISE EXCEPTION '53 replay recebimento35 delta divergente' USING ERRCODE='23514';END IF;s:=mop.auditoria->'depois';
 END IF;
 seen:=array_append(seen,x.id);applied:=applied+1;
 END LOOP;
 IF (SELECT count(*) FROM private47.recebimentos WHERE contrato_id=cid) IS DISTINCT FROM (SELECT count(*) FROM public.multimodal_operacoes WHERE payload->>'contratoId'=cid::text AND resultado IS NOT NULL) OR s IS DISTINCT FROM target THEN RAISE EXCEPTION '53 terminal físico/eventos órfãos divergentes' USING ERRCODE='23514';END IF;RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.private47__validar(uid integer,cid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE ch private47.cadeia%ROWTYPE; op private47.operacoes%ROWTYPE; receipt private47.recebimentos%ROWTYPE; mop public.multimodal_operacoes%ROWTYPE; s jsonb; expected jsonb; c public.contratos%ROWTYPE;
BEGIN
 IF EXISTS(SELECT 1 FROM sucessores53.operacoes WHERE contrato_id=cid AND resultado IS NOT NULL LIMIT 1) THEN RETURN emprestimos_lista60.sucessores53__replay(uid,cid,emprestimos_lista60.public__multimodal_snapshot(cid));END IF;
 -- Catalog-only audit moved to installation/review60.
 SELECT * INTO ch FROM private47.cadeia WHERE cid IN(origem_id,sucessor_id);
 IF NOT FOUND OR ch.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION '47 origem/sucessor indisponível' USING ERRCODE='42501'; END IF;
 PERFORM emprestimos_lista60.private47__validar_op(ch.operacao_id); SELECT * INTO STRICT op FROM private47.operacoes WHERE id=ch.operacao_id;
 s:=emprestimos_lista60.public__multimodal_snapshot(cid);
 IF cid=ch.origem_id THEN RETURN s; END IF;
 SELECT * INTO receipt FROM private47.recebimentos WHERE contrato_id=cid ORDER BY created_at DESC,operacao_id DESC LIMIT 1;
 IF FOUND THEN
 SELECT * INTO STRICT mop FROM public.multimodal_operacoes WHERE id=receipt.operacao_id;
 IF receipt.user_id<>uid OR receipt.hash_snapshot IS DISTINCT FROM emprestimos_lista60.private47__hash(receipt.snapshot) OR mop.family<>'multimodal_receber' OR mop.user_id<>uid OR mop.payload->>'contratoId' IS DISTINCT FROM cid::text OR mop.hash_payload IS DISTINCT FROM emprestimos_lista60.private47__hash(mop.payload) OR mop.auditoria->'depois' IS DISTINCT FROM receipt.snapshot OR mop.auditoria->'resultado' IS DISTINCT FROM mop.resultado OR mop.auditoria->'payload' IS DISTINCT FROM mop.payload OR mop.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(uid,mop.family,mop.request) THEN RAISE EXCEPTION '47 recebimento35/prova divergente' USING ERRCODE='23514'; END IF;
 expected:=receipt.snapshot;
 ELSE expected:=op.auditoria->'sucessor'; END IF;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 IF s IS DISTINCT FROM expected OR c.user_id IS DISTINCT FROM uid OR c.contrato_origem_id IS DISTINCT FROM ch.origem_id OR c.modalidade<>'mensal' OR c.tipo_taxa<>'mensal' OR s->'origem' IS DISTINCT FROM 'null'::jsonb OR s->'renovacoes' IS DISTINCT FROM '[]'::jsonb OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid) OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid) OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid AND ativo) OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=uid AND ativo) OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid AND ativo)) OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM c.cliente_id OR conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR koletor_id IS DISTINCT FROM c.koletor_id)) OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE (conta_caixa_id=c.conta_caixa_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND user_id IS DISTINCT FROM uid) OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text) OR EXISTS(SELECT 1 FROM public.multimodal_pernas m JOIN public.multimodal_operacoes p ON p.id=m.operacao_id LEFT JOIN public.transacoes_caixa t ON t.id=m.transacao_id WHERE p.payload->>'contratoId'=cid::text AND m.snapshot IS DISTINCT FROM to_jsonb(t)) THEN RAISE EXCEPTION '47 snapshot/owner/proveniência divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__ciclo_snapshot(p_contrato integer) RETURNS jsonb
STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
 SELECT jsonb_build_object(
 'contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE c.id=p_contrato),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.numero,p.id) FROM public.parcelas p WHERE p.contrato_id=p_contrato),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE t.contrato_id=p_contrato OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=p_contrato)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE h.contrato_id=p_contrato),'[]'::jsonb),
 'origem',(SELECT to_jsonb(o) FROM public.emprestimos_rpc_origens o WHERE o.contrato_id=p_contrato));
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__ciclo_validar(p_user integer,p_contrato integer) RETURNS jsonb
STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE o public.emprestimos_rpc_origens%ROWTYPE; op public.emprestimos_rpc_operacoes%ROWTYPE;
 c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
 h public.contrato_historico%ROWTYPE; s jsonb; e public.ciclo_estados%ROWTYPE;
 n integer; i integer:=0; juros numeric; total numeric; ref numeric; jr numeric; vl numeric; jl numeric;
 ps jsonb; ids jsonb; histid bigint;
BEGIN
 SELECT * INTO o FROM public.emprestimos_rpc_origens WHERE contrato_id=p_contrato;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM p_user THEN RAISE EXCEPTION 'Origem 0021 indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT op FROM public.emprestimos_rpc_operacoes WHERE id=o.operacao_id;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=p_contrato;
 IF c.user_id IS DISTINCT FROM p_user OR op.user_id IS DISTINCT FROM p_user OR o.regra<>'mensal_simples_v1'
   OR op.resultado IS NULL OR op.auditoria IS NULL OR op.concluida_em IS NULL
   OR op.hash_payload<>encode(extensions.digest(op.payload::text,'sha256'),'hex')
   OR op.auditoria->'payload' IS DISTINCT FROM op.payload OR op.auditoria->>'hashPayload' IS DISTINCT FROM op.hash_payload
   OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado OR op.auditoria->>'acao' IS DISTINCT FROM 'criacao_emprestimo'
   OR op.auditoria->'jurosEmbutidos' IS DISTINCT FROM 'true'::jsonb THEN
   RAISE EXCEPTION 'Proveniência/auditoria adulterada' USING ERRCODE='23514'; END IF;
 s:=emprestimos_lista60.public__ciclo_snapshot(p_contrato);
 SELECT * INTO e FROM public.ciclo_estados WHERE contrato_id=p_contrato;
 IF FOUND THEN
   IF e.user_id IS DISTINCT FROM p_user OR e.snapshot IS DISTINCT FROM s THEN RAISE EXCEPTION 'Estado alterado fora da RPC' USING ERRCODE='23514'; END IF;
   RETURN s;
 END IF;
 -- 0021 existente: NÃO confiar apenas na existência da origem. Cabeçalho e todas linhas
 -- devem ser exatamente iguais ao snapshot inicial (inclusive campos extras e timestamps).
 IF op.auditoria->'contrato' IS DISTINCT FROM s->'contrato' OR op.auditoria->'parcelas' IS DISTINCT FROM s->'parcelas' THEN
   RAISE EXCEPTION '0021 sem snapshot completo exige estado inicial intacto' USING ERRCODE='23514'; END IF;
 n:=(op.payload->>'numeroParcelas')::integer;
 juros:=round((op.payload->>'valorPrincipal')::numeric*(op.payload->>'taxaJuros')::numeric/100*n,2);
 total:=(op.payload->>'valorPrincipal')::numeric+juros; ref:=round(total/n,2); jr:=round(juros/n,2);
 IF n NOT BETWEEN 1 AND 60 OR total>9999999999.99
   OR op.payload->>'regra' IS DISTINCT FROM 'mensal_simples_v1' OR op.payload->>'encargos' IS DISTINCT FROM 'defaults_catalogo'
   OR (op.payload->>'userId')::integer IS DISTINCT FROM p_user
   OR c.cliente_id IS DISTINCT FROM (op.payload->>'clienteId')::integer
   OR c.conta_caixa_id IS DISTINCT FROM (op.payload->>'contaCaixaId')::integer
   OR c.modalidade IS DISTINCT FROM 'mensal' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
   OR c.valor_principal IS DISTINCT FROM (op.payload->>'valorPrincipal')::numeric
   OR c.taxa_juros IS DISTINCT FROM (op.payload->>'taxaJuros')::numeric
   OR c.num_parcelas IS DISTINCT FROM n OR c.numero_parcelas IS DISTINCT FROM n
   OR c.total_contrato IS DISTINCT FROM total OR c.valor_parcela IS DISTINCT FROM ref
   OR c.multa_atraso IS DISTINCT FROM 2::numeric OR c.juros_mora_diario IS DISTINCT FROM 0.033::numeric
   OR c.data_inicio IS DISTINCT FROM (op.payload->>'dataInicio')::date
   OR c.data_inicio IS DISTINCT FROM (op.payload->>'dataDesembolso')::date
   OR c.data_vencimento_primeira IS DISTINCT FROM (op.payload->'vencimentos'->>0)::date
   OR c.data_vencimento IS DISTINCT FROM (op.payload->'vencimentos'->>(n-1))::date
   OR c.dia_vencimento IS DISTINCT FROM extract(day FROM c.data_vencimento_primeira)::int
   OR c.descricao IS DISTINCT FROM op.payload->>'descricao' OR c.observacoes IS DISTINCT FROM op.payload->>'observacoes'
   OR c.status IS DISTINCT FROM 'ativo' OR c.contrato_origem_id IS NOT NULL
   OR c."createdAt" IS DISTINCT FROM op.created_at OR c."updatedAt" IS DISTINCT FROM op.created_at
   OR jsonb_array_length(op.payload->'vencimentos') IS DISTINCT FROM n THEN
   RAISE EXCEPTION 'Invariantes da criação divergentes' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=p_contrato ORDER BY numero,id LOOP
   i:=i+1; vl:=CASE WHEN i=n THEN total-ref*(n-1) ELSE ref END; jl:=CASE WHEN i=n THEN juros-jr*(n-1) ELSE jr END;
   IF p.numero IS DISTINCT FROM i OR p.numero_parcela IS DISTINCT FROM i OR i>n
     OR p.user_id IS DISTINCT FROM p_user OR p.cliente_id IS DISTINCT FROM c.cliente_id
     OR p.koletor_id IS DISTINCT FROM c.koletor_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id
     OR p.valor IS DISTINCT FROM vl OR p.valor_original IS DISTINCT FROM vl OR p.valor_juros IS DISTINCT FROM jl
     OR vl<=0 OR jl<0 OR jl>vl OR p.valor_pago IS DISTINCT FROM 0::numeric OR p.saldo_residual IS DISTINCT FROM 0::numeric
     OR p.valor_multa IS DISTINCT FROM 0::numeric OR p.valor_desconto IS DISTINCT FROM 0::numeric
     OR p.multa_manual IS DISTINCT FROM 0::numeric OR p.multa_diaria_usada IS DISTINCT FROM 0::numeric
     OR p.data_pagamento IS NOT NULL OR p.observacoes IS NOT NULL
     OR p."createdAt" IS DISTINCT FROM op.created_at OR p."updatedAt" IS DISTINCT FROM op.created_at
     OR p.data_vencimento IS DISTINCT FROM (op.payload->'vencimentos'->>(i-1))::date
     OR p.data_vencimento<c.data_inicio
     OR (n>1 AND extract(day FROM c.data_vencimento_primeira)>28)
     OR p.data_vencimento IS DISTINCT FROM (c.data_vencimento_primeira+make_interval(months=>i-1))::date
     OR p.status IS DISTINCT FROM (CASE WHEN p.data_vencimento<coalesce((op.auditoria->>'dataCivilCriacaoBrt')::date,(op.created_at AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'atrasada' WHEN p.data_vencimento=coalesce((op.auditoria->>'dataCivilCriacaoBrt')::date,(op.created_at AT TIME ZONE 'America/Sao_Paulo')::date) THEN 'vencendo_hoje' ELSE 'pendente' END) THEN
     RAISE EXCEPTION 'Parcelas iniciais divergentes' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF i<>n OR (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=p_contrato)<>total
   OR (SELECT sum(valor_juros) FROM public.parcelas WHERE contrato_id=p_contrato)<>juros THEN RAISE EXCEPTION 'Somas divergentes' USING ERRCODE='23514'; END IF;
 ids:=(SELECT jsonb_agg(id ORDER BY numero,id) FROM public.parcelas WHERE contrato_id=p_contrato);
 IF op.resultado IS DISTINCT FROM jsonb_build_object('success',true,'repetida',false,'id',p_contrato,'operationId',op.id,
   'parcelasIds',ids,'transacaoCaixaId',o.transacao_caixa_id::text,'valorParcela',ref::numeric(15,2)::text,
   'totalContrato',total::numeric(15,2)::text,'jurosTotal',juros::numeric(15,2)::text,'numeroParcelas',n,
   'dataDesembolso',c.data_inicio,'vencimentos',op.payload->'vencimentos','status','ativo','regra','mensal_simples_v1') THEN
   RAISE EXCEPTION 'Resultado de criação divergente' USING ERRCODE='23514'; END IF;
 IF jsonb_array_length(s->'ledger')<>1 OR jsonb_array_length(s->'historico')<>1 THEN RAISE EXCEPTION 'Trilha extra/ausente' USING ERRCODE='23514'; END IF;
 SELECT * INTO STRICT t FROM public.transacoes_caixa WHERE id=o.transacao_caixa_id;
 histid:=(op.auditoria->>'historicoId')::bigint;
 SELECT * INTO STRICT h FROM public.contrato_historico WHERE id=histid;
 IF t.user_id IS DISTINCT FROM p_user OR t.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id
   OR t.contrato_id IS DISTINCT FROM p_contrato OR t.parcela_id IS NOT NULL
   OR t.tipo IS DISTINCT FROM 'saida' OR t.categoria IS DISTINCT FROM 'emprestimo_liberado'
   OR t.valor IS DISTINCT FROM c.valor_principal OR t.data_transacao IS DISTINCT FROM c.data_inicio
   OR t.descricao IS DISTINCT FROM 'Empréstimo RPC - Contrato #'||p_contrato::text
   OR t."createdAt" IS DISTINCT FROM op.created_at OR o.created_at IS DISTINCT FROM op.created_at
   OR h.contrato_id IS DISTINCT FROM p_contrato OR h.user_id IS DISTINCT FROM p_user::text
   OR h.tipo IS DISTINCT FROM 'criacao' OR h.valor_novo IS DISTINCT FROM total OR h.valor_anterior IS NOT NULL
   OR h.descricao IS DISTINCT FROM 'Criação atômica mensal_simples_v1' OR h.created_at IS DISTINCT FROM op.created_at THEN
   RAISE EXCEPTION 'Débito/histórico de criação divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END;
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__legados_snapshot(cid integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
 SELECT jsonb_build_object(
 'contrato',(SELECT to_jsonb(c) FROM public.contratos c WHERE id=cid),
 'parcelas',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.id) FROM public.parcelas p WHERE contrato_id=cid),'[]'::jsonb),
 'ledger',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM public.transacoes_caixa t WHERE contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)),'[]'::jsonb),
 'historico',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.id) FROM public.contrato_historico h WHERE contrato_id=cid),'[]'::jsonb));
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multa36_snapshot(cid integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
 SELECT emprestimos_lista60.public__multimodal_snapshot(cid)||jsonb_build_object(
 'encargos36',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY parcela_id) FROM public.multa36_encargos e WHERE contrato_id=cid),'[]'::jsonb),
 'renovacoes36',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY anterior_id) FROM public.multa36_renovacoes r WHERE contrato_id=cid),'[]'::jsonb));
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multa36_vinculos(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE c public.contratos%ROWTYPE; t public.transacoes_caixa%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.contratos WHERE id=cid;
 IF uid IS NULL OR uid<=0 OR c.id IS NULL OR c.user_id IS DISTINCT FROM uid OR c.conta_caixa_id IS NULL
 OR NOT EXISTS(SELECT 1 FROM public.users WHERE id=uid) OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=c.conta_caixa_id AND user_id=uid AND ativo IS TRUE AND emprestimos_lista60.public__multimodal_moeda(saldo))
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid AND ativo IS TRUE))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM c.cliente_id OR conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR koletor_id IS DISTINCT FROM c.koletor_id))
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text) THEN RAISE EXCEPTION 'Vínculos36 indisponíveis' USING ERRCODE='42501'; END IF;
 -- Ledger INTEIRO da conta, e pernas vinculadas ao contrato mesmo em outra conta.
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=c.conta_caixa_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid) LOOP
 IF t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid AND ativo IS TRUE)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=t.contrato_id AND user_id=uid))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos co ON co.id=p.contrato_id WHERE p.id=t.parcela_id AND p.user_id=uid AND co.user_id=uid AND p.cliente_id=co.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id)) THEN RAISE EXCEPTION 'Ledger36 crossowner/null/vínculo inválido' USING ERRCODE='42501'; END IF;
 IF NOT emprestimos_lista60.public__multimodal_moeda(t.valor) OR t.valor<=0 OR t.tipo IS NULL OR t.tipo NOT IN('entrada','saida') OR t.data_transacao IS NULL OR NOT isfinite(t.data_transacao) THEN RAISE EXCEPTION 'Ledger36 financeiro inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multa36_validar(uid integer,cid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE s jsonb; e public.multa36_estados%ROWTYPE; o public.multa36_origens%ROWTYPE; op public.multa36_operacoes%ROWTYPE; p public.parcelas%ROWTYPE; r record; soma numeric;
BEGIN
 PERFORM emprestimos_lista60.public__multa36_vinculos(uid,cid);
 SELECT * INTO o FROM public.multa36_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem36 indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT e FROM public.multa36_estados WHERE contrato_id=cid; SELECT * INTO STRICT op FROM public.multa36_operacoes WHERE id=e.operacao_id; s:=emprestimos_lista60.public__multa36_snapshot(cid);
 IF e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s OR e.hash_snapshot IS DISTINCT FROM encode(extensions.digest(s::text,'sha256'),'hex')
 OR op.user_id IS DISTINCT FROM uid OR op.contrato_id IS DISTINCT FROM cid OR op.resultado IS NULL OR op.auditoria->'depois' IS DISTINCT FROM s OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.auditoria->'request' IS DISTINCT FROM op.request OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.request::text,'sha256'),'hex')
 OR o.hash_admissao IS DISTINCT FROM encode(extensions.digest(o.snapshot_admissao::text,'sha256'),'hex')
 OR NOT EXISTS(SELECT 1 FROM public.multa36_operacoes a WHERE a.id=o.operacao_id AND a.acao='multa' AND a.auditoria->'antes'=o.snapshot_admissao AND a.resultado IS NOT NULL) THEN RAISE EXCEPTION 'Prova36 snapshot/auditoria divergente' USING ERRCODE='23514'; END IF;
 FOR r IN SELECT m.*,aop.auditoria,aop.resultado,aop.request FROM public.multa36_pernas m JOIN public.multa36_operacoes aop ON aop.id=m.operacao_id WHERE aop.contrato_id=cid LOOP
 IF r.snapshot IS DISTINCT FROM (SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=r.transacao_id) OR r.resultado IS NULL
 OR r.auditoria->'perna' IS DISTINCT FROM r.snapshot OR r.auditoria->'alocacao' IS DISTINCT FROM r.alocacao
 OR (r.alocacao->>'total')::numeric IS DISTINCT FROM (r.snapshot->>'valor')::numeric
 OR (r.snapshot->>'valor')::numeric IS DISTINCT FROM (r.request->>'valorRecebido')::numeric THEN RAISE EXCEPTION 'Perna36/alocação divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid LOOP
 IF p.valor_original IS NULL OR p.valor_original<=0 OR p.valor IS DISTINCT FROM p.valor_original OR p.valor_juros IS NULL OR p.valor_juros<0 OR p.valor_juros>p.valor_original OR p.valor_pago IS NULL OR p.valor_pago<0 OR p.valor_multa IS NULL OR p.multa_manual IS NULL OR p.multa_diaria_usada IS NULL OR p.valor_desconto IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Parcela36 ambígua' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM public.multa36_encargos enc WHERE enc.parcela_id=p.id AND (enc.contrato_id<>cid OR enc.valor IS DISTINCT FROM p.multa_manual OR enc.dia_brt<=p.data_vencimento)) THEN RAISE EXCEPTION 'Encargo36 divergente' USING ERRCODE='23514'; END IF;
 SELECT coalesce(sum(valor),0) INTO soma FROM public.transacoes_caixa WHERE parcela_id=p.id;
 IF soma IS DISTINCT FROM p.valor_pago OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE parcela_id=p.id AND (tipo IS DISTINCT FROM 'entrada' OR categoria IS DISTINCT FROM 'pagamento_parcela' OR contrato_id IS DISTINCT FROM cid)) THEN RAISE EXCEPTION 'Pagamento36 não reconciliado' USING ERRCODE='23514'; END IF;
 IF p.status='paga' AND (p.saldo_residual<>0 OR p.valor_pago<>p.valor_original+p.valor_multa+p.multa_diaria_usada) THEN RAISE EXCEPTION 'Quitação36 não comprovada' USING ERRCODE='23514'; END IF;
 IF p.status='parcial' AND (p.saldo_residual<=0 OR p.valor_pago<=0 OR p.saldo_residual<>p.valor_original+p.valor_multa+p.multa_diaria_usada-p.valor_pago) THEN RAISE EXCEPTION 'Residual36 inválido' USING ERRCODE='23514'; END IF;
 IF p.status IN('pendente','atrasada','atrasado','vencendo_hoje') AND (p.valor_pago<>0 OR p.saldo_residual<>0 OR p.valor_multa<>0 OR p.multa_diaria_usada<>0 OR p.data_pagamento IS NOT NULL) THEN RAISE EXCEPTION 'Aberta36 incoerente' USING ERRCODE='23514'; END IF;
 IF p.status='cancelada' AND NOT EXISTS(SELECT 1 FROM public.multa36_renovacoes ren JOIN public.parcelas n ON n.id=ren.nova_id WHERE ren.anterior_id=p.id AND ren.contrato_id=cid AND ren.principal=p.valor_original-p.valor_juros AND ren.principal=p.saldo_residual AND p.valor_pago=ren.juros+ren.multa+ren.mora AND n.valor_original-n.valor_juros=ren.principal) AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=p.id AND contrato_id=cid) THEN RAISE EXCEPTION 'Transferência36 não comprovada' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF (SELECT status FROM public.contratos WHERE id=cid)='quitado' AND EXISTS(SELECT 1 FROM public.parcelas cp WHERE cp.contrato_id=cid AND cp.status<>'paga' AND NOT EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE anterior_id=cp.id) AND NOT EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=cp.id)) THEN RAISE EXCEPTION 'Contrato36 incompleto' USING ERRCODE='23514'; END IF;
 RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__reparcelamento43_snapshot(cid integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
 SELECT emprestimos_lista60.public__legados_snapshot(cid);
$clone60s$;
CREATE FUNCTION emprestimos_lista60.public__reparcelamento43_validar(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE s public.reparcelamento43_estados%ROWTYPE;
BEGIN
 SELECT contrato_id,user_id,snapshot INTO s FROM public.reparcelamento43_estados WHERE contrato_id=cid;
 IF s.contrato_id IS NULL OR s.user_id IS DISTINCT FROM uid OR s.snapshot IS DISTINCT FROM emprestimos_lista60.public__reparcelamento43_snapshot(cid)
 OR NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id JOIN public.contas_caixa a ON a.id=c.conta_caixa_id WHERE c.id=cid AND c.user_id=uid AND cl.user_id=uid AND a.user_id=uid)
 OR EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id WHERE c.id=cid AND (p.user_id IS DISTINCT FROM uid OR p.cliente_id IS DISTINCT FROM c.cliente_id OR p.conta_caixa_id IS DISTINCT FROM c.conta_caixa_id OR p.koletor_id IS DISTINCT FROM c.koletor_id)) THEN RAISE EXCEPTION 'Prova/vínculos43 divergentes' USING ERRCODE='23514'; END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_decimal(v numeric) RETURNS text STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
BEGIN
 IF v IS NULL OR v::text IN('NaN','Infinity','-Infinity') OR v<>round(v,2) THEN RAISE EXCEPTION 'Decimal37 inválido' USING ERRCODE='23514'; END IF;
 IF v=0 THEN RETURN '0.00'; END IF;
 RETURN round(v,2)::text;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_hash(j jsonb) RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$ SELECT encode(extensions.digest(j::text,'sha256'),'hex') $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_dinheiro(v text) RETURNS numeric STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
BEGIN
 IF v IS NULL OR v !~ '^(0|[1-9][0-9]{0,9})\.[0-9]{2}$' OR v='0.00' THEN RAISE EXCEPTION 'Dinheiro37 canônico positivo obrigatório' USING ERRCODE='22023'; END IF; RETURN v::numeric;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_intencao(a text,origem integer,destino integer,v text,d text) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
BEGIN
 PERFORM emprestimos_lista60.public__caixa37_dinheiro(v);
 IF a IS NULL OR a NOT IN('aporte','transferir') OR destino IS NULL OR destino<=0 OR (a='aporte' AND origem IS NOT NULL)
 OR (a='transferir' AND (origem IS NULL OR origem<=0 OR origem=destino)) OR (d IS NOT NULL AND (d<>btrim(d) OR length(d) NOT BETWEEN 1 AND 500)) THEN RAISE EXCEPTION 'Intenção37 inválida' USING ERRCODE='22023'; END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_request(r jsonb) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE keys text[]:=ARRAY['acao','contaOrigemId','contaDestinoId','valor','descricao','dataTransacao','estadoHash']; n text;
BEGIN
 IF r IS NULL OR jsonb_typeof(r) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Request37 objeto obrigatório' USING ERRCODE='22023'; END IF;
 IF r-keys<>'{}'::jsonb OR (SELECT count(*) FROM jsonb_object_keys(r))<>7 OR jsonb_typeof(r->'acao') IS DISTINCT FROM 'string'
 OR jsonb_typeof(r->'contaDestinoId') IS DISTINCT FROM 'number' OR coalesce(r->>'contaDestinoId','') !~ '^[1-9][0-9]{0,9}$'
 OR NOT(r->'contaOrigemId'='null'::jsonb OR (jsonb_typeof(r->'contaOrigemId')='number' AND r->>'contaOrigemId' ~ '^[1-9][0-9]{0,9}$'))
 OR jsonb_typeof(r->'valor') IS DISTINCT FROM 'string' OR NOT(r->'descricao'='null'::jsonb OR jsonb_typeof(r->'descricao')='string')
 OR jsonb_typeof(r->'dataTransacao') IS DISTINCT FROM 'string' OR coalesce(r->>'dataTransacao','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 OR jsonb_typeof(r->'estadoHash') IS DISTINCT FROM 'string' OR coalesce(r->>'estadoHash','') !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Request37 chaves/tipos inválidos' USING ERRCODE='22023'; END IF;
 PERFORM emprestimos_lista60.public__caixa37_intencao(r->>'acao',(r->>'contaOrigemId')::int,(r->>'contaDestinoId')::int,r->>'valor',r->>'descricao');
 IF (r->>'dataTransacao')::date NOT BETWEEN DATE '1900-01-01' AND DATE '9999-12-31' THEN RAISE EXCEPTION 'DATE37 fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN r;
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Request37 fora da faixa' USING ERRCODE='22023';
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__caixa37_validar_op(oid37 uuid) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE
 op public.caixa37_operacoes%ROWTYPE; prior public.caixa37_operacoes%ROWTYPE; first_op public.caixa37_operacoes%ROWTYPE;
 p public.caixa37_pernas%ROWTYPE; pin public.caixa37_contas%ROWTYPE;
 r jsonb; q jsonb; antes jsonb; expected jsonb; physical jsonb; snapshots jsonb:='[]'::jsonb; resultlegs jsonb:='[]'::jsonb;
 obj jsonb; shape jsonb; x jsonb; s jsonb; k text; typ text; aid integer; origem integer; destino integer; n integer;
 before_ids integer[]; prior_ids uuid[]; first_id uuid; frozen_proofs jsonb; state_hash text;
 qorigem jsonb; qdestino jsonb; qexpected jsonb; rexpected jsonb;
 val numeric; total numeric; delta_total numeric; delta_origem numeric; delta_destino numeric;
 saldo_shape jsonb:='{"contaCaixaId":"number","nome":"string","saldoBase":"string","entradas":"string","saidas":"string","saldoEfetivo":"string"}';
 account_shape jsonb:='{"id":"number","user_id":"number","nome":"string","tipo":"string","saldo":"number","ativo":"boolean","createdAt":"string","updatedAt":"string"}';
 ledger_shape jsonb:='{"id":"number","user_id":"number","conta_caixa_id":"number","tipo":"string","categoria":"string|null","descricao":"string","valor":"number","data_transacao":"string","contrato_id":"number|null","parcela_id":"number|null","createdAt":"string"}';
BEGIN
 SELECT * INTO op FROM public.caixa37_operacoes WHERE id=oid37;
 IF op.id IS NULL OR op.user_id IS NULL OR op.resultado IS NULL OR op.auditoria IS NULL OR op.concluida_em IS NULL
 OR NOT isfinite(op.instante) OR NOT isfinite(op.concluida_em)
 OR op.hash_request IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(op.request)
 OR emprestimos_lista60.public__caixa37_request(op.request) IS DISTINCT FROM op.request OR op.acao IS DISTINCT FROM op.request->>'acao'
 OR op.hash_auditoria IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(op.auditoria) THEN
 RAISE EXCEPTION 'Operação37 incompleta/adulterada' USING ERRCODE='23514'; END IF;
 r:=op.resultado; q:=op.auditoria->'cotacao'; antes:=op.auditoria->'antes';
 -- Cada chave obrigatória tem um tipo explícito. Ausência (SQL NULL) nunca equivale a JSON null.
 -- Esta fase precede casts, expansão de arrays e extração numérica de r/q/auditoria/snapshot.
 FOR obj,shape IN SELECT * FROM (VALUES
 (op.auditoria,'{"request":"object","requestHash":"string","cotacao":"object","cotacaoHash":"string","antes":"object","depois":"object","pernas":"array","predecessoresHash":"string","instante":"string","diaBrt":"string","resultado":"object"}'::jsonb),
 (r,'{"success":"boolean","regra":"string","acao":"string","operationId":"string","idempotencyKey":"string","repetida":"boolean","contaOrigemId":"number|null","contaDestinoId":"number","valor":"string","dataTransacao":"string","descricao":"string|null","pernas":"array","saldoOrigemAntes":"string|null","saldoOrigemApos":"string|null","saldoDestinoAntes":"string","saldoDestinoApos":"string","saldoTotalOwnerAntes":"string","saldoTotalOwnerApos":"string"}'::jsonb),
 (q,'{"elegivel":"boolean","regra":"string","acao":"string","contaOrigemId":"number|null","contaDestinoId":"number","valor":"string","descricao":"string|null","dataTransacao":"string","estadoHash":"string","origem":"object|null","destino":"object","saldoOrigemApos":"string|null","saldoDestinoApos":"string","saldoTotalOwnerAntes":"string","saldoTotalOwnerApos":"string"}'::jsonb),
 (antes,'{"contas":"array","ledger":"array"}'::jsonb),
 (op.auditoria->'depois','{"contas":"array","ledger":"array"}'::jsonb)
 ) schemas(obj,shape) LOOP
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'JSON37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'JSON37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF (jsonb_typeof(obj->k)=ANY(string_to_array(typ,'|'))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'JSON37 chave/tipo inválido: %',k USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 IF op.auditoria->'request' IS DISTINCT FROM op.request OR op.auditoria->'requestHash' IS DISTINCT FROM to_jsonb(op.hash_request)
 OR op.auditoria->'resultado' IS DISTINCT FROM r OR op.auditoria->'instante' IS DISTINCT FROM to_jsonb(op.instante)
 OR op.auditoria->'diaBrt' IS DISTINCT FROM op.request->'dataTransacao'
 OR (op.instante AT TIME ZONE 'America/Sao_Paulo')::date IS DISTINCT FROM (op.request->>'dataTransacao')::date
 OR q->'estadoHash' IS DISTINCT FROM op.request->'estadoHash' OR op.auditoria->'cotacaoHash' IS DISTINCT FROM to_jsonb(emprestimos_lista60.public__caixa37_hash(q))
 OR (op.auditoria->>'predecessoresHash' ~ '^[a-f0-9]{64}$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Auditoria37 envelope divergente' USING ERRCODE='23514'; END IF;
 origem:=(op.request->>'contaOrigemId')::int; destino:=(op.request->>'contaDestinoId')::int; val:=(op.request->>'valor')::numeric;
 -- Decimais de resposta seguem shared/caixa37.ts; agregados não recebem o limite da operação.
 FOR obj IN SELECT r UNION ALL SELECT q UNION ALL SELECT q->'destino' UNION ALL SELECT q->'origem' WHERE op.acao='transferir' LOOP
 IF obj=q->'destino' OR obj=q->'origem' THEN
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'ContaSaldo37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(saldo_shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'ContaSaldo37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(saldo_shape) LOOP
 IF jsonb_typeof(obj->k) IS DISTINCT FROM typ THEN RAISE EXCEPTION 'ContaSaldo37 chave/tipo inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 END IF;
 FOR k,x IN SELECT key,value FROM jsonb_each(obj) WHERE key LIKE 'saldo%' OR key IN('entradas','saidas') LOOP
 IF x='null'::jsonb AND op.acao='aporte' AND k IN('saldoOrigemAntes','saldoOrigemApos') THEN CONTINUE; END IF;
 IF jsonb_typeof(x) IS DISTINCT FROM 'string' OR (x#>>'{}' ~ '^-?(0|[1-9][0-9]*)\.[0-9]{2}$') IS DISTINCT FROM true OR x='"-0.00"'::jsonb THEN
 RAISE EXCEPTION 'Decimal37 de resposta não canônico' USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 IF op.acao='aporte' AND (r->'saldoOrigemAntes' IS DISTINCT FROM 'null'::jsonb OR r->'saldoOrigemApos' IS DISTINCT FROM 'null'::jsonb OR q->'origem' IS DISTINCT FROM 'null'::jsonb OR q->'saldoOrigemApos' IS DISTINCT FROM 'null'::jsonb) THEN
 RAISE EXCEPTION 'Origem37 deve ser null explícito no aporte' USING ERRCODE='23514'; END IF;
 IF op.acao='transferir' AND (jsonb_typeof(r->'saldoOrigemAntes') IS DISTINCT FROM 'string' OR jsonb_typeof(r->'saldoOrigemApos') IS DISTINCT FROM 'string' OR jsonb_typeof(q->'saldoOrigemApos') IS DISTINCT FROM 'string') THEN
 RAISE EXCEPTION 'Origem37 obrigatória na transferência' USING ERRCODE='23514'; END IF;
 FOR obj IN SELECT value FROM jsonb_array_elements(r->'pernas') LOOP
 shape:='{"papel":"string","transacaoCaixaId":"string","contaCaixaId":"number","tipo":"string","valor":"string"}'::jsonb;
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'PernaResult37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'PernaResult37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF jsonb_typeof(obj->k) IS DISTINCT FROM typ THEN RAISE EXCEPTION 'PernaResult37 chave/tipo inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 END LOOP;
 -- Rowtypes completos de snapshot: validar chaves/tipos e gramática antes dos casts.
 FOR obj,shape IN
 SELECT c,account_shape FROM jsonb_array_elements((antes->'contas')||(op.auditoria->'depois'->'contas')) c
 UNION ALL SELECT t,ledger_shape FROM jsonb_array_elements((antes->'ledger')||(op.auditoria->'depois'->'ledger')||(op.auditoria->'pernas')) t
 UNION ALL SELECT lp.snapshot,ledger_shape FROM public.caixa37_pernas lp WHERE lp.operacao_id=op.id LOOP
 IF jsonb_typeof(obj) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Row37 objeto obrigatório' USING ERRCODE='23514'; END IF;
 IF obj-ARRAY(SELECT jsonb_object_keys(shape)) IS DISTINCT FROM '{}'::jsonb THEN RAISE EXCEPTION 'Row37 chave extra' USING ERRCODE='23514'; END IF;
 FOR k,typ IN SELECT * FROM jsonb_each_text(shape) LOOP
 IF (jsonb_typeof(obj->k)=ANY(string_to_array(typ,'|'))) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Row37 chave/tipo inválido: %',k USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR k,x IN SELECT key,value FROM jsonb_each(obj) WHERE key IN('id','user_id','conta_caixa_id','contrato_id','parcela_id') LOOP
 IF x='null'::jsonb AND k IN('contrato_id','parcela_id') THEN CONTINUE; END IF;
 IF (x#>>'{}' ~ '^[1-9][0-9]{0,9}$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Row37 ID inválido' USING ERRCODE='23514'; END IF;
 IF (x#>>'{}')::numeric>2147483647 THEN RAISE EXCEPTION 'Row37 ID fora da faixa' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF obj->'user_id' IS DISTINCT FROM to_jsonb(op.user_id) THEN RAISE EXCEPTION 'Snapshot37 owner divergente' USING ERRCODE='23514'; END IF;
 IF shape=account_shape THEN
 IF (obj->>'saldo' ~ '^-?(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$') IS DISTINCT FROM true THEN RAISE EXCEPTION 'Snapshot37 base inválida' USING ERRCODE='23514'; END IF;
 IF to_jsonb((obj->>'createdAt')::timestamptz) IS DISTINCT FROM obj->'createdAt' OR to_jsonb((obj->>'updatedAt')::timestamptz) IS DISTINCT FROM obj->'updatedAt'
 OR NOT isfinite((obj->>'createdAt')::timestamptz) OR NOT isfinite((obj->>'updatedAt')::timestamptz) THEN RAISE EXCEPTION 'Snapshot37 timestamp de conta inválido' USING ERRCODE='23514'; END IF;
 ELSE
 IF (obj->>'valor' ~ '^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$') IS DISTINCT FROM true OR (obj->>'tipo' IN('entrada','saida')) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Snapshot37 ledger valor/tipo inválido' USING ERRCODE='23514'; END IF;
 IF (obj->>'valor')::numeric<=0 OR to_jsonb((obj->>'data_transacao')::date) IS DISTINCT FROM obj->'data_transacao' OR NOT isfinite((obj->>'data_transacao')::date)
 OR to_jsonb((obj->>'createdAt')::timestamptz) IS DISTINCT FROM obj->'createdAt' OR NOT isfinite((obj->>'createdAt')::timestamptz) THEN RAISE EXCEPTION 'Snapshot37 ledger data/valor inválido' USING ERRCODE='23514'; END IF;
 END IF;
 END LOOP;
 FOR s IN SELECT antes UNION ALL SELECT op.auditoria->'depois' LOOP
 FOREACH k IN ARRAY ARRAY['contas','ledger'] LOOP
 IF s->k IS DISTINCT FROM coalesce((SELECT jsonb_agg(v ORDER BY (v->>'id')::int) FROM jsonb_array_elements(s->k) v),'[]'::jsonb)
 OR (SELECT count(*) FROM jsonb_array_elements(s->k)) IS DISTINCT FROM (SELECT count(DISTINCT v->'id') FROM jsonb_array_elements(s->k) v) THEN RAISE EXCEPTION 'Snapshot37 ordem/ID duplicado' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'ledger') t WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s->'contas') c WHERE c->'id'=t->'conta_caixa_id')) THEN RAISE EXCEPTION 'Snapshot37 conta de ledger ausente/alheia' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(destino) AND c->'ativo'='true'::jsonb)
 OR (op.acao='transferir' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(origem) AND c->'ativo'='true'::jsonb)) THEN RAISE EXCEPTION 'Conta37 não elegível no instante histórico' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO n FROM public.caixa37_pernas WHERE operacao_id=op.id;
 IF n IS DISTINCT FROM (CASE op.acao WHEN 'aporte' THEN 1 ELSE 2 END) OR jsonb_array_length(r->'pernas') IS DISTINCT FROM n THEN RAISE EXCEPTION 'Pernas37 quantidade divergente' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.caixa37_pernas WHERE operacao_id=op.id ORDER BY CASE papel WHEN 'origem' THEN 0 ELSE 1 END LOOP
 SELECT to_jsonb(t) INTO physical FROM public.transacoes_caixa t WHERE id=p.transacao_id;
 aid:=(p.snapshot->>'conta_caixa_id')::int;
 IF p.user_id IS DISTINCT FROM op.user_id OR p.snapshot IS DISTINCT FROM physical OR p.hash_snapshot IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(p.snapshot)
 OR p.snapshot->'id' IS DISTINCT FROM to_jsonb(p.transacao_id) OR p.snapshot->>'valor' IS DISTINCT FROM op.request->>'valor'
 OR p.snapshot->'data_transacao' IS DISTINCT FROM op.request->'dataTransacao' OR p.snapshot->'createdAt' IS DISTINCT FROM to_jsonb(op.instante)
 OR p.snapshot->'contrato_id' IS DISTINCT FROM 'null'::jsonb OR p.snapshot->'parcela_id' IS DISTINCT FROM 'null'::jsonb
 OR ((op.acao='aporte' AND p.papel='aporte' AND p.snapshot->>'tipo'='entrada' AND p.snapshot->>'categoria'='ajuste_manual' AND p.snapshot->>'descricao'='Aporte37 '||op.id::text AND aid=destino)
 OR (op.acao='transferir' AND p.papel IN('origem','destino') AND p.snapshot->>'categoria'='transferencia_conta' AND p.snapshot->>'descricao'='Transferencia37 '||op.id::text||' '||p.papel AND p.snapshot->>'tipo'=CASE p.papel WHEN 'origem' THEN 'saida' ELSE 'entrada' END AND aid=CASE p.papel WHEN 'origem' THEN origem ELSE destino END)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Perna37 física/prova divergente' USING ERRCODE='23514'; END IF;
 -- Não comparar nome/ativo/updatedAt atuais: rename, inativação e append preservam replay.
 SELECT * INTO pin FROM public.caixa37_contas WHERE conta_id=aid;
 IF pin.conta_id IS NULL OR pin.user_id IS DISTINCT FROM op.user_id
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa a WHERE a.id=aid AND a.user_id=op.user_id AND a.saldo IS NOT DISTINCT FROM pin.saldo_base)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'contas') c WHERE c->'id'=to_jsonb(aid) AND c->'saldo'=to_jsonb(pin.saldo_base)) THEN RAISE EXCEPTION 'Pin37 identidade/base divergente' USING ERRCODE='23514'; END IF;
 -- Ordem causal serializada: a primeira utilização não tem perna37 desta conta em antes;
 -- toda utilização diferente já contém sua perna. Não ordenar UUIDs, relógio ou sequence cache.
 first_id:=pin.primeira_op;
 SELECT * INTO first_op FROM public.caixa37_operacoes WHERE id=first_id;
 IF first_op.id IS NULL OR first_op.user_id IS DISTINCT FROM op.user_id OR first_op.resultado IS NULL OR first_op.auditoria IS NULL OR first_op.concluida_em IS NULL
 OR first_op.hash_request IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(first_op.request) OR first_op.hash_auditoria IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(first_op.auditoria)
 OR emprestimos_lista60.public__caixa37_request(first_op.request) IS DISTINCT FROM first_op.request OR first_op.acao IS DISTINCT FROM first_op.request->>'acao'
 OR first_op.auditoria->'requestHash' IS DISTINCT FROM to_jsonb(first_op.hash_request)
 OR first_op.auditoria->'request' IS DISTINCT FROM first_op.request OR first_op.auditoria->'resultado' IS DISTINCT FROM first_op.resultado
 OR first_op.resultado->'operationId' IS DISTINCT FROM to_jsonb(first_op.id) OR first_op.resultado->'idempotencyKey' IS DISTINCT FROM to_jsonb(first_op.chave)
 OR first_op.resultado->'success' IS DISTINCT FROM 'true'::jsonb OR first_op.resultado->'repetida' IS DISTINCT FROM 'false'::jsonb
 OR jsonb_typeof(first_op.auditoria->'antes'->'contas') IS DISTINCT FROM 'array' OR jsonb_typeof(first_op.auditoria->'antes'->'ledger') IS DISTINCT FROM 'array'
 OR (SELECT count(*) FROM public.caixa37_pernas lp WHERE lp.operacao_id=first_id) IS DISTINCT FROM (CASE first_op.acao WHEN 'aporte' THEN 1 WHEN 'transferir' THEN 2 ELSE 0 END)::bigint
 OR (first_op.request->'contaDestinoId'=to_jsonb(aid) OR first_op.request->'contaOrigemId'=to_jsonb(aid)) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Pin37 origem incompleta/alheia' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(first_op.auditoria->'antes'->'contas') c WHERE c->'id'=to_jsonb(aid) AND c->'user_id'=to_jsonb(op.user_id) AND c->'saldo'=to_jsonb(pin.saldo_base))
 OR NOT EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE lp.operacao_id=first_id AND t.conta_caixa_id=aid AND lp.user_id=op.user_id AND t.user_id=op.user_id AND lp.snapshot=to_jsonb(t) AND lp.hash_snapshot=emprestimos_lista60.public__caixa37_hash(lp.snapshot))
 OR EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE t.conta_caixa_id=aid AND EXISTS(SELECT 1 FROM jsonb_array_elements(first_op.auditoria->'antes'->'ledger') b WHERE b->'id'=to_jsonb(lp.transacao_id))) THEN RAISE EXCEPTION 'Pin37 origem/base/proveniência divergente' USING ERRCODE='23514'; END IF;
 IF first_id IS DISTINCT FROM op.id AND NOT EXISTS(SELECT 1 FROM public.caixa37_pernas lp JOIN public.transacoes_caixa t ON t.id=lp.transacao_id WHERE lp.operacao_id=first_id AND t.conta_caixa_id=aid AND EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'ledger') b WHERE b=lp.snapshot)) THEN
 RAISE EXCEPTION 'Pin37 primeira utilização não precede esta operação' USING ERRCODE='23514'; END IF;
 snapshots:=snapshots||jsonb_build_array(p.snapshot);
 resultlegs:=resultlegs||jsonb_build_array(jsonb_build_object('papel',p.papel,'transacaoCaixaId',p.transacao_id::text,'contaCaixaId',aid,'tipo',p.snapshot->>'tipo','valor',op.request->>'valor'));
 END LOOP;
 IF op.auditoria->'pernas' IS DISTINCT FROM snapshots OR r->'pernas' IS DISTINCT FROM resultlegs THEN RAISE EXCEPTION 'Auditoria37 pernas divergentes' USING ERRCODE='23514'; END IF;
 expected:=jsonb_set(antes,'{ledger}',(SELECT jsonb_agg(v ORDER BY (v->>'id')::int) FROM jsonb_array_elements((antes->'ledger')||snapshots) v));
 IF expected IS DISTINCT FROM op.auditoria->'depois' THEN RAISE EXCEPTION 'Delta37 histórico não é exato' USING ERRCODE='23514'; END IF;
 -- O emissor não armazena provas37 separadas no audit. Reconstruir o conjunto pré-op pelo
 -- ledger congelado e pelas provas imutáveis armazenadas; não usar provas atuais completas.
 SELECT coalesce(array_agg((v->>'id')::int),'{}'::integer[]) INTO before_ids FROM jsonb_array_elements(antes->'ledger') v;
 SELECT coalesce(array_agg(DISTINCT lp.operacao_id),'{}'::uuid[]) INTO prior_ids FROM public.caixa37_pernas lp WHERE lp.transacao_id=ANY(before_ids);
 IF op.id=ANY(prior_ids) THEN RAISE EXCEPTION 'Snapshot37 antes contém a própria operação' USING ERRCODE='23514'; END IF;
 FOR prior IN SELECT * FROM public.caixa37_operacoes WHERE id=ANY(prior_ids) LOOP
 IF prior.user_id IS DISTINCT FROM op.user_id OR prior.resultado IS NULL OR prior.auditoria IS NULL OR prior.concluida_em IS NULL
 OR prior.hash_request IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(prior.request) OR prior.hash_auditoria IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(prior.auditoria)
 OR prior.auditoria->'request' IS DISTINCT FROM prior.request OR prior.auditoria->'resultado' IS DISTINCT FROM prior.resultado
 OR (SELECT count(*) FROM public.caixa37_pernas lp WHERE lp.operacao_id=prior.id) IS DISTINCT FROM (CASE prior.acao WHEN 'aporte' THEN 1 WHEN 'transferir' THEN 2 ELSE 0 END)::bigint
 OR EXISTS(SELECT 1 FROM public.caixa37_pernas lp WHERE lp.operacao_id=prior.id AND (lp.user_id IS DISTINCT FROM op.user_id OR NOT(lp.transacao_id=ANY(before_ids)) OR lp.hash_snapshot IS DISTINCT FROM emprestimos_lista60.public__caixa37_hash(lp.snapshot)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(antes->'ledger') b WHERE b->'id'=to_jsonb(lp.transacao_id) AND b=lp.snapshot))) THEN RAISE EXCEPTION 'Provas37 congeladas incompletas/divergentes' USING ERRCODE='23514'; END IF;
 END LOOP;
 frozen_proofs:=jsonb_build_object(
 'operacoes',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM public.caixa37_operacoes o WHERE o.id=ANY(prior_ids)),'[]'::jsonb),
 'pernas',coalesce((SELECT jsonb_agg(to_jsonb(lp) ORDER BY lp.operacao_id,lp.papel) FROM public.caixa37_pernas lp WHERE lp.operacao_id=ANY(prior_ids)),'[]'::jsonb),
 'contas',coalesce((SELECT jsonb_agg(to_jsonb(cp) ORDER BY cp.conta_id) FROM public.caixa37_contas cp WHERE cp.user_id=op.user_id AND cp.primeira_op=ANY(prior_ids)),'[]'::jsonb));
 state_hash:=emprestimos_lista60.public__caixa37_hash(jsonb_build_object('regra','caixa37_brt_v1','userId',op.user_id,'acao',op.acao,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->>'valor','descricao',op.request->'descricao','diaBrt',(op.request->>'dataTransacao')::date,'contas',antes->'contas','ledger',antes->'ledger','provas37',frozen_proofs));
 IF q->'estadoHash' IS DISTINCT FROM to_jsonb(state_hash) THEN RAISE EXCEPTION 'Cotação37 estadoHash não corresponde às provas congeladas' USING ERRCODE='23514'; END IF;
 -- NUMERIC sem typmod: bases e ledger de audit.antes são a ÚNICA fonte de saldos históricos.
 qorigem:=NULL;
 FOR aid IN SELECT v FROM unnest(ARRAY[origem,destino]) v WHERE v IS NOT NULL LOOP
 SELECT jsonb_build_object('contaCaixaId',aid,'nome',c->>'nome','saldoBase',emprestimos_lista60.public__caixa37_decimal((c->>'saldo')::numeric),
 'entradas',emprestimos_lista60.public__caixa37_decimal(coalesce(sum((t->>'valor')::numeric) FILTER(WHERE t->>'tipo'='entrada'),0)),
 'saidas',emprestimos_lista60.public__caixa37_decimal(coalesce(sum((t->>'valor')::numeric) FILTER(WHERE t->>'tipo'='saida'),0)),
 'saldoEfetivo',emprestimos_lista60.public__caixa37_decimal((c->>'saldo')::numeric+coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END),0))) INTO obj
 FROM jsonb_array_elements(antes->'contas') c LEFT JOIN jsonb_array_elements(antes->'ledger') t ON t->'conta_caixa_id'=c->'id' WHERE c->'id'=to_jsonb(aid) GROUP BY c;
 IF aid=destino THEN qdestino:=obj; ELSE qorigem:=obj; END IF;
 END LOOP;
 SELECT coalesce((SELECT sum((c->>'saldo')::numeric) FROM jsonb_array_elements(antes->'contas') c),0)+coalesce((SELECT sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FROM jsonb_array_elements(antes->'ledger') t),0) INTO total;
 SELECT coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END),0),
 coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FILTER(WHERE t->'conta_caixa_id'=to_jsonb(origem)),0),
 coalesce(sum(CASE t->>'tipo' WHEN 'entrada' THEN (t->>'valor')::numeric ELSE -(t->>'valor')::numeric END) FILTER(WHERE t->'conta_caixa_id'=to_jsonb(destino)),0)
 INTO delta_total,delta_origem,delta_destino FROM jsonb_array_elements(snapshots) t;
 IF delta_destino IS DISTINCT FROM val OR delta_origem IS DISTINCT FROM (CASE op.acao WHEN 'transferir' THEN -val ELSE 0 END) OR delta_total IS DISTINCT FROM (CASE op.acao WHEN 'aporte' THEN val ELSE 0 END) THEN RAISE EXCEPTION 'Delta37 monetário físico divergente' USING ERRCODE='23514'; END IF;
 qexpected:=jsonb_build_object('elegivel',true,'regra','caixa37_brt_v1','acao',op.acao,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->'valor','descricao',op.request->'descricao','dataTransacao',op.request->'dataTransacao','estadoHash',state_hash,'origem',qorigem,'destino',qdestino,
 'saldoOrigemApos',CASE WHEN origem IS NULL THEN NULL ELSE emprestimos_lista60.public__caixa37_decimal((qorigem->>'saldoEfetivo')::numeric+delta_origem) END,'saldoDestinoApos',emprestimos_lista60.public__caixa37_decimal((qdestino->>'saldoEfetivo')::numeric+delta_destino),'saldoTotalOwnerAntes',emprestimos_lista60.public__caixa37_decimal(total),'saldoTotalOwnerApos',emprestimos_lista60.public__caixa37_decimal(total+delta_total));
 rexpected:=jsonb_build_object('success',true,'regra','caixa37_v1','acao',op.acao,'operationId',op.id,'idempotencyKey',op.chave,'repetida',false,'contaOrigemId',origem,'contaDestinoId',destino,'valor',op.request->'valor','dataTransacao',op.request->'dataTransacao','descricao',op.request->'descricao','pernas',resultlegs,
 'saldoOrigemAntes',qorigem->'saldoEfetivo','saldoOrigemApos',qexpected->'saldoOrigemApos','saldoDestinoAntes',qdestino->'saldoEfetivo','saldoDestinoApos',qexpected->'saldoDestinoApos','saldoTotalOwnerAntes',qexpected->'saldoTotalOwnerAntes','saldoTotalOwnerApos',qexpected->'saldoTotalOwnerApos');
 IF q IS DISTINCT FROM qexpected OR r IS DISTINCT FROM rexpected THEN RAISE EXCEPTION 'Cotação/resultado37 não correspondem ao saldo físico histórico' USING ERRCODE='23514'; END IF;
 IF (r->>'saldoDestinoApos')::numeric IS DISTINCT FROM (r->>'saldoDestinoAntes')::numeric+val
 OR (r->>'saldoTotalOwnerApos')::numeric IS DISTINCT FROM (r->>'saldoTotalOwnerAntes')::numeric+delta_total
 OR (op.acao='transferir' AND (r->>'saldoOrigemApos')::numeric IS DISTINCT FROM (r->>'saldoOrigemAntes')::numeric-val) THEN RAISE EXCEPTION 'Equação37 divergente' USING ERRCODE='23514'; END IF;
 -- Append legítimo não invalida snapshot antigo. Somente prefixo nas contas alvo é imutável.
 FOR x IN SELECT value FROM jsonb_array_elements(op.auditoria->'depois'->'ledger') WHERE (value->>'conta_caixa_id')::int IN(origem,destino) LOOP
 IF x IS DISTINCT FROM (SELECT to_jsonb(t) FROM public.transacoes_caixa t WHERE id=(x->>'id')::int) THEN RAISE EXCEPTION 'Prefixo37 alterado' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_capacidades WHERE operacao_id=op.id) THEN RAISE EXCEPTION 'Capacidade37 residual' USING ERRCODE='23514'; END IF;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_datetime_format OR datetime_field_overflow THEN
 RAISE EXCEPTION 'Prova37 contém valor fora do formato/faixa' USING ERRCODE='23514';
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__reparcelamento43_validar_conta(uid integer,aid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE a public.contas_caixa%ROWTYPE; t public.transacoes_caixa%ROWTYPE; oid37 uuid;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=aid AND user_id=uid AND ativo) THEN RAISE EXCEPTION 'Conta43 indisponível' USING ERRCODE='42501'; END IF;
 FOR a IN SELECT * FROM public.contas_caixa WHERE id=aid AND user_id=uid LOOP
 IF a.id<=0 OR a.saldo::text IN('NaN','Infinity','-Infinity') OR a.saldo<>round(a.saldo,2) OR abs(a.saldo)>9999999999999.99 THEN RAISE EXCEPTION 'Saldo-base37 inválido' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR t IN SELECT * FROM public.transacoes_caixa WHERE conta_caixa_id=aid ORDER BY id LOOP
 IF t.id<=0 OR t.user_id IS DISTINCT FROM uid OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=t.conta_caixa_id AND user_id=uid)
 OR t.tipo NOT IN('entrada','saida') OR t.valor::text IN('NaN','Infinity','-Infinity') OR t.valor<=0 OR t.valor<>round(t.valor,2) OR NOT isfinite(t.data_transacao)
 OR (t.contrato_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.contratos c JOIN public.clientes cl ON cl.id=c.cliente_id WHERE c.id=t.contrato_id AND c.user_id=uid AND cl.user_id=uid AND c.conta_caixa_id=t.conta_caixa_id AND (c.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid))))
 OR (t.parcela_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.parcelas p JOIN public.contratos c ON c.id=p.contrato_id JOIN public.clientes cl ON cl.id=p.cliente_id WHERE p.id=t.parcela_id AND p.user_id=uid AND c.user_id=uid AND cl.user_id=uid AND p.cliente_id=c.cliente_id AND p.contrato_id=t.contrato_id AND p.conta_caixa_id=t.conta_caixa_id AND (p.koletor_id IS NULL OR EXISTS(SELECT 1 FROM public.koletores WHERE id=p.koletor_id AND user_id=uid)))) THEN RAISE EXCEPTION 'Ledger37 whole-owner crossowner/estrutura inválida' USING ERRCODE='23514'; END IF;
 END LOOP;
 FOR oid37 IN SELECT id FROM public.caixa37_operacoes o WHERE o.user_id=uid AND (o.request->>'contaOrigemId'=aid::text OR o.request->>'contaDestinoId'=aid::text OR EXISTS(SELECT 1 FROM public.caixa37_pernas p JOIN public.transacoes_caixa leg ON leg.id=p.transacao_id WHERE p.operacao_id=o.id AND leg.conta_caixa_id=aid)) LOOP PERFORM emprestimos_lista60.public__caixa37_validar_op(oid37); END LOOP;
 IF EXISTS(SELECT 1 FROM public.caixa37_contas p LEFT JOIN public.contas_caixa ac ON ac.id=p.conta_id WHERE p.conta_id=aid AND (p.user_id IS DISTINCT FROM uid OR ac.id IS NULL OR ac.user_id IS DISTINCT FROM p.user_id OR ac.saldo IS DISTINCT FROM p.saldo_base)) THEN RAISE EXCEPTION 'Pin37 divergente' USING ERRCODE='23514'; END IF;

END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__reparcelamento43_validar_recebimento(uid integer,cid integer) RETURNS jsonb
STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE op public.reparcelamento43_operacoes%ROWTYPE; ch public.reparcelamento43_cadeia%ROWTYPE;
 c public.contratos%ROWTYPE; rc record; p public.parcelas%ROWTYPE; origem jsonb; s jsonb; sum_total numeric;
BEGIN
 -- Catalog-only audit moved to installation/review60.

 SELECT origem_id,sucessor_id,user_id,raiz_id,operacao_id INTO ch FROM public.reparcelamento43_cadeia WHERE sucessor_id=cid AND user_id=uid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Origem43 de recebimento indisponível' USING ERRCODE='42501'; END IF;
 PERFORM emprestimos_lista60.public__reparcelamento43_validar(uid,cid);
 SELECT id,user_id,chave,request,hash_request,resultado,auditoria,concluida_em INTO STRICT op FROM public.reparcelamento43_operacoes WHERE id=ch.operacao_id;
 SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 origem:=op.auditoria->'depois'->'sucessor';
 IF op.user_id IS DISTINCT FROM uid OR op.resultado IS NULL OR op.concluida_em IS NULL
 OR op.hash_request IS DISTINCT FROM encode(extensions.digest(op.request::text,'sha256'),'hex')
 OR op.auditoria->'request' IS DISTINCT FROM op.request OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.resultado->>'contratoId' IS DISTINCT FROM cid::text OR op.resultado->>'contratoOrigemId' IS DISTINCT FROM ch.origem_id::text
 OR op.resultado->>'raizId' IS DISTINCT FROM ch.raiz_id::text OR op.resultado->>'desembolso' IS DISTINCT FROM '0.00'
 OR origem->'ledger' IS DISTINCT FROM '[]'::jsonb OR c.contrato_origem_id IS DISTINCT FROM ch.origem_id
 OR c.status NOT IN('ativo','quitado') OR c.modalidade IS DISTINCT FROM 'reparcelamento' OR c.tipo_taxa IS DISTINCT FROM 'mensal'
 OR EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE origem_id=cid)
 OR EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid)
 OR ((origem->'contrato')-ARRAY['status','updatedAt']) IS DISTINCT FROM (to_jsonb(c)-ARRAY['status','updatedAt'])
 OR (SELECT sum(valor_original-valor_juros) FROM public.parcelas WHERE contrato_id=cid) IS DISTINCT FROM (op.resultado->>'principalTransferido')::numeric
 OR (SELECT sum(valor_original) FROM public.parcelas WHERE contrato_id=cid) IS DISTINCT FROM (op.resultado->>'totalNovo')::numeric
 THEN RAISE EXCEPTION 'Origem/prova/conservação43 divergente' USING ERRCODE='23514'; END IF;
 PERFORM emprestimos_lista60.public__reparcelamento43_validar_conta(uid,c.conta_caixa_id);
 IF NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=c.cliente_id AND user_id=uid AND ativo)
 OR (c.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=c.koletor_id AND user_id=uid AND ativo))
 THEN RAISE EXCEPTION 'Vínculos43 indisponíveis' USING ERRCODE='42501'; END IF;
 FOR rc IN SELECT r.operacao_id,r.snapshot,r.hash_snapshot,o.user_id,o.family,o.request,o.payload,o.hash_payload,o.resultado,o.auditoria,o.concluida_em,t.snapshot perna,to_jsonb(tx) atual
 FROM public.reparcelamento43_recebimentos r JOIN public.multimodal_operacoes o ON o.id=r.operacao_id
 JOIN public.multimodal_pernas t ON t.operacao_id=o.id LEFT JOIN public.transacoes_caixa tx ON tx.id=t.transacao_id
 WHERE r.contrato_id=cid LOOP
 IF rc.user_id IS DISTINCT FROM uid OR rc.family IS DISTINCT FROM 'multimodal_receber' OR rc.resultado IS NULL OR rc.concluida_em IS NULL
 OR rc.hash_payload IS DISTINCT FROM encode(extensions.digest(rc.payload::text,'sha256'),'hex')
 OR rc.payload IS DISTINCT FROM emprestimos_lista60.public__multimodal_payload(uid,'multimodal_receber',rc.request)
 OR rc.auditoria->'payload' IS DISTINCT FROM rc.payload OR rc.auditoria->'resultado' IS DISTINCT FROM rc.resultado
 OR rc.auditoria->'depois' IS DISTINCT FROM rc.snapshot OR rc.hash_snapshot IS DISTINCT FROM encode(extensions.digest(rc.snapshot::text,'sha256'),'hex')
 OR rc.perna IS DISTINCT FROM rc.atual OR rc.resultado->>'contratoId' IS DISTINCT FROM cid::text
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(rc.snapshot->'ledger') x WHERE x=rc.perna)
 THEN RAISE EXCEPTION 'Recibo/perna35 da origem43 divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_recebimentos r LEFT JOIN public.multimodal_pernas mp ON mp.operacao_id=r.operacao_id WHERE r.contrato_id=cid AND mp.operacao_id IS NULL)
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa t WHERE (t.contrato_id=cid OR t.parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND
 (t.tipo IS DISTINCT FROM 'entrada' OR t.categoria IS DISTINCT FROM 'pagamento_parcela' OR NOT EXISTS(
 SELECT 1 FROM public.reparcelamento43_recebimentos r JOIN public.multimodal_pernas mp ON mp.operacao_id=r.operacao_id WHERE r.contrato_id=cid AND r.user_id=uid AND mp.transacao_id=t.id AND mp.snapshot=to_jsonb(t))))
 THEN RAISE EXCEPTION 'Livro43 sem prova35 exata' USING ERRCODE='23514'; END IF;
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid LOOP
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(origem->'parcelas') v WHERE
 v-ARRAY['status','valor_pago','saldo_residual','valor_multa','multa_diaria_usada','data_pagamento','observacoes','updatedAt'] =
 to_jsonb(p)-ARRAY['status','valor_pago','saldo_residual','valor_multa','multa_diaria_usada','data_pagamento','observacoes','updatedAt'])
 OR p.status NOT IN('pendente','atrasada','vencendo_hoje','parcial','paga') OR p.valor_pago<0
 OR p.valor_pago IS DISTINCT FROM (SELECT coalesce(sum(t.valor),0) FROM public.transacoes_caixa t WHERE t.parcela_id=p.id)
 OR (p.status IN('pendente','atrasada','vencendo_hoje') AND (p.valor_pago<>0 OR p.saldo_residual<>0 OR p.data_pagamento IS NOT NULL))
 OR (p.status='paga' AND (p.valor_pago<>p.valor_original+p.valor_multa+p.multa_diaria_usada OR p.saldo_residual<>0 OR p.data_pagamento IS NULL))
 OR (p.status='parcial' AND (p.valor_pago<=0 OR p.saldo_residual<=0 OR p.valor_pago+p.saldo_residual<>p.valor_original+p.valor_multa+p.multa_diaria_usada OR p.data_pagamento IS NULL))
 THEN RAISE EXCEPTION 'Conservação/descendente43 recebido divergente' USING ERRCODE='23514'; END IF;
 END LOOP;
 IF (c.status='quitado') IS DISTINCT FROM NOT EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND status<>'paga')
 THEN RAISE EXCEPTION 'Quitação43 sem prova de todos descendentes' USING ERRCODE='23514'; END IF;
 s:=emprestimos_lista60.public__multimodal_snapshot(cid); RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multimodal_validar(uid integer, cid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE o public.multimodal_origens%ROWTYPE; e public.multimodal_estados%ROWTYPE; op public.multimodal_operacoes%ROWTYPE; s jsonb;
BEGIN
 IF EXISTS(SELECT 1 FROM private47.cadeia WHERE cid IN(origem_id,sucessor_id)) THEN RETURN emprestimos_lista60.private47__validar(uid,cid); END IF;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_estados WHERE contrato_id=cid) THEN RETURN emprestimos_lista60.public__reparcelamento43_validar_recebimento(uid,cid); END IF;
 SELECT * INTO o FROM public.multimodal_origens WHERE contrato_id=cid;
 IF NOT FOUND OR o.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Origem multimodal indisponível' USING ERRCODE='42501'; END IF;
 SELECT * INTO STRICT e FROM public.multimodal_estados WHERE contrato_id=cid;
 SELECT * INTO STRICT op FROM public.multimodal_operacoes WHERE id=e.operacao_id;
 s:=emprestimos_lista60.public__multimodal_snapshot(cid);
 IF e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM s OR e.hash_snapshot IS DISTINCT FROM encode(extensions.digest(s::text,'sha256'),'hex')
 OR op.resultado IS NULL OR op.auditoria->'depois' IS DISTINCT FROM s OR op.auditoria->'resultado' IS DISTINCT FROM op.resultado
 OR op.hash_payload IS DISTINCT FROM encode(extensions.digest(op.payload::text,'sha256'),'hex') OR op.auditoria->'payload' IS DISTINCT FROM op.payload
 OR NOT EXISTS(SELECT 1 FROM public.contratos WHERE id=cid AND user_id=uid AND cliente_id=o.cliente_id AND conta_caixa_id=o.conta_id AND koletor_id IS NOT DISTINCT FROM o.koletor_id)
 OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=o.cliente_id AND user_id=uid)
 OR NOT EXISTS(SELECT 1 FROM public.contas_caixa WHERE id=o.conta_id AND user_id=uid AND ativo)
 OR (o.koletor_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.koletores WHERE id=o.koletor_id AND user_id=uid AND ativo))
 OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM o.cliente_id OR conta_caixa_id IS DISTINCT FROM o.conta_id OR koletor_id IS DISTINCT FROM o.koletor_id))
 OR EXISTS(SELECT 1 FROM public.transacoes_caixa WHERE (conta_caixa_id=o.conta_id OR contrato_id=cid OR parcela_id IN(SELECT id FROM public.parcelas WHERE contrato_id=cid)) AND user_id IS DISTINCT FROM uid)
 OR EXISTS(SELECT 1 FROM public.contrato_historico WHERE contrato_id=cid AND user_id IS DISTINCT FROM uid::text)
 OR EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)
 OR EXISTS(SELECT 1 FROM public.legados_estados WHERE contrato_id=cid) THEN RAISE EXCEPTION 'Snapshot/proveniência/vínculos multimodais divergentes' USING ERRCODE='23514'; END IF;
 -- Toda perna física íntegra; snapshots não filtram owner NULL ou externo.
 IF EXISTS(SELECT 1 FROM public.multimodal_pernas m JOIN public.multimodal_operacoes p ON p.id=m.operacao_id LEFT JOIN public.transacoes_caixa t ON t.id=m.transacao_id
 WHERE (p.resultado->>'contratoId')::integer=cid OR (p.resultado->>'id')::integer=cid
 GROUP BY m.operacao_id,m.snapshot,t.id HAVING m.snapshot IS DISTINCT FROM to_jsonb(t)) THEN RAISE EXCEPTION 'Perna multimodal divergente' USING ERRCODE='23514'; END IF;
 RETURN s;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__validar_leitura(uid integer,cid integer) RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE n integer; ch record;
BEGIN
 n:=(SELECT count(*) FROM public.multimodal_origens WHERE contrato_id=cid)+(SELECT count(*) FROM public.emprestimos_rpc_origens WHERE contrato_id=cid)+(SELECT count(*) FROM public.legados_estados WHERE contrato_id=cid);
 IF n>1 THEN RAISE EXCEPTION '51 origem dupla/ambígua' USING ERRCODE='23514';END IF;
 IF EXISTS(SELECT 1 FROM private47.cadeia WHERE cid IN(origem_id,sucessor_id) LIMIT 1) THEN
 PERFORM emprestimos_lista60.private47__validar(uid,cid);RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE cid IN(origem_id,sucessor_id) LIMIT 1) THEN
 PERFORM emprestimos_lista60.public__reparcelamento43_validar(uid,cid);
 -- Prove each existing successor with its original snapshot/receipt protocol.
 -- Historical intermediate origins use their immutable43 snapshot, never a new writer51.
 FOR ch IN SELECT c.sucessor_id FROM public.reparcelamento43_cadeia c WHERE c.raiz_id=(SELECT raiz_id FROM public.reparcelamento43_cadeia WHERE cid IN(origem_id,sucessor_id) ORDER BY origem_id LIMIT 1) ORDER BY c.sucessor_id LOOP
 PERFORM emprestimos_lista60.public__reparcelamento43_validar(uid,ch.sucessor_id);
 IF NOT EXISTS(SELECT 1 FROM public.reparcelamento43_cadeia WHERE origem_id=ch.sucessor_id LIMIT 1) THEN PERFORM emprestimos_lista60.public__reparcelamento43_validar_recebimento(uid,ch.sucessor_id);END IF;
 END LOOP;RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid LIMIT 1) THEN PERFORM emprestimos_lista60.public__multa36_validar(uid,cid);RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.multimodal_origens WHERE contrato_id=cid LIMIT 1) THEN PERFORM emprestimos_lista60.public__multimodal_validar(uid,cid);RETURN;END IF;
 IF EXISTS(SELECT 1 FROM public.emprestimos_rpc_origens WHERE contrato_id=cid LIMIT 1) THEN PERFORM emprestimos_lista60.public__ciclo_validar(uid,cid);RETURN;END IF;
 -- Unregistered legacy is read as registered, not adopted/repaired; registrada retains its ambiguity refusals.
 IF EXISTS(SELECT 1 FROM public.legados_estados e WHERE e.contrato_id=cid AND (e.user_id IS DISTINCT FROM uid OR e.snapshot IS DISTINCT FROM emprestimos_lista60.public__legados_snapshot(cid)) LIMIT 1) THEN RAISE EXCEPTION '51 prova legada divergente' USING ERRCODE='23514';END IF;
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.obrigacoes51__estado(uid integer,cid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $clone60s$
DECLARE p jsonb; rows jsonb:='[]'; v numeric; a numeric; total numeric:=0; open_count integer:=0; canceled boolean:=false; st text;
BEGIN
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Caixa37 exige PG17/Read Committed' USING ERRCODE='55000'; END IF;
 -- Catalog-only audit moved to installation/review60.
PERFORM emprestimos_lista60.obrigacoes51__travar_leitura(uid,cid);PERFORM emprestimos_lista60.obrigacoes51__validar_leitura(uid,cid);PERFORM emprestimos_lista60.obrigacoes51__eventos_leitura(uid,cid);
 canceled:=EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid AND user_id=uid LIMIT 1);
 FOR p IN SELECT to_jsonb(x) FROM public.parcelas x WHERE contrato_id=cid ORDER BY id LOOP
 v:=emprestimos_lista60.obrigacoes51__registrada_leitura(p);SELECT sum(valor) INTO a FROM (SELECT valor FROM obrigacoes51.adicionais WHERE parcela_id=(p->>'id')::int UNION ALL SELECT valor FROM inclusao52.adicionais WHERE parcela_id=(p->>'id')::int) extras;a:=coalesce(a,0);total:=total+a;
 IF p->>'status' IN('paga','pago') THEN v:=0;st:='paga';
 ELSIF p->>'status'='renovada' THEN v:=0;st:='transferida';
 ELSIF EXISTS(SELECT 1 FROM obrigacoes51.cancelamentos WHERE parcela_id=(p->>'id')::int AND user_id=uid LIMIT 1) OR EXISTS(SELECT 1 FROM obrigacoes51.encerramentos WHERE contrato_id=cid AND user_id=uid LIMIT 1) OR p->>'status' IN('cancelada','cancelado') THEN v:=0;st:='cancelada';canceled:=true;
 ELSE st:='aberta';open_count:=open_count+1;END IF;
 rows:=rows||jsonb_build_array(jsonb_build_object('parcelaId',(p->>'id')::int,'statusFinanceiroOriginal',p->>'status','statusObrigacao',st,'obrigacaoAtual',v::numeric(15,2)::text,'componenteAdicional',a::numeric(15,2)::text,'arquivada',EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND (parcela_id IS NULL OR parcela_id=(p->>'id')::int) LIMIT 1)));
 END LOOP;
 RETURN jsonb_build_object('versao','obrigacoes51_v1','userId',uid,'contratoId',cid,'statusObrigacao',CASE WHEN open_count>0 THEN 'ativo' WHEN canceled THEN 'encerrado_por_cancelamento' ELSE 'quitado' END,'arquivado',EXISTS(SELECT 1 FROM obrigacoes51.arquivos WHERE contrato_id=cid AND parcela_id IS NULL LIMIT 1),'obrigacaoAdicional',total::numeric(15,2)::text,'parcelas',rows);
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.public__multa36_cotacao(uid integer,cid integer,pid integer,instante timestamptz) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $clone60s$
DECLARE s jsonb; c public.contratos%ROWTYPE; p public.parcelas%ROWTYPE; enc jsonb; multa numeric; mora numeric; devido numeric; hoje date:=(instante AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
 s:=emprestimos_lista60.public__multa36_validar(uid,cid); SELECT * INTO STRICT c FROM public.contratos WHERE id=cid;
 SELECT * INTO p FROM public.parcelas WHERE id=pid AND contrato_id=cid;
 IF NOT FOUND OR p.user_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'Parcela36 indisponível' USING ERRCODE='42501'; END IF;
 IF p.status='parcial' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=p.saldo_residual;
 ELSIF p.status='paga' THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status='cancelada' AND (EXISTS(SELECT 1 FROM public.multa36_renovacoes WHERE anterior_id=p.id AND contrato_id=cid) OR EXISTS(SELECT 1 FROM public.multimodal_renovacoes WHERE anterior_id=p.id AND contrato_id=cid)) THEN multa:=p.valor_multa; mora:=p.multa_diaria_usada; devido:=0;
 ELSIF p.status IN('pendente','atrasada','vencendo_hoje') AND p.valor_pago=0 THEN
 enc:=emprestimos_lista60.public__ciclo_encargos(p.valor_original,c.multa_atraso,c.juros_mora_diario,p.data_vencimento,instante);
 SELECT valor INTO multa FROM public.multa36_encargos WHERE parcela_id=pid;
 multa:=coalesce(multa,(enc->>'multa')::numeric); mora:=(enc->>'mora')::numeric; devido:=p.valor_original+multa+mora;
 ELSE RAISE EXCEPTION 'Parcela36 transferida/não elegível' USING ERRCODE='23514'; END IF;
 IF NOT emprestimos_lista60.public__multimodal_moeda(devido) OR NOT emprestimos_lista60.public__multimodal_moeda(multa) OR NOT emprestimos_lista60.public__multimodal_moeda(mora) THEN RAISE EXCEPTION 'Encargos36 fora da faixa' USING ERRCODE='22023'; END IF;
 RETURN jsonb_build_object('elegivel',devido>0,'contratoId',cid,'parcelaId',pid,'contaCaixaId',c.conta_caixa_id,'totalExigido',devido::numeric(15,2)::text,'multa',multa::numeric(15,2)::text,'mora',mora::numeric(15,2)::text,'jurosEmbutidos',p.valor_juros::numeric(15,2)::text,'valorPagoAcumulado',p.valor_pago::numeric(15,2)::text,'dataPagamento',hoje,'vencimento',p.data_vencimento,'status',CASE WHEN p.status='cancelada' THEN 'renovada' ELSE p.status END,'estadoHash',encode(extensions.digest(s::text,'sha256'),'hex'),'regra','recebimento_multa36_brt_v1');
END $clone60s$;
CREATE FUNCTION emprestimos_lista60.quotes36(uid integer,cid integer,instante timestamptz) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $quotes60m$
DECLARE first_positive integer; p public.parcelas%ROWTYPE; q jsonb; qs jsonb:='[]'; first_quote jsonb; final_quote jsonb; shared_hash text; shared_account integer;
BEGIN
 PERFORM emprestimos_lista60.obrigacoes51__vinculos_leitura(uid,cid);
 IF EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cid AND (multa_manual IS NOT NULL AND (multa_manual::text IN('NaN','Infinity','-Infinity') OR multa_manual<0 OR multa_manual<>round(multa_manual,2) OR multa_manual>90071992547409.91))) THEN RAISE EXCEPTION '60 invalid manual fine marker' USING ERRCODE='23514';END IF;
 SELECT id INTO first_positive FROM public.parcelas WHERE contrato_id=cid AND multa_manual>0 ORDER BY id LIMIT 1;
 IF first_positive IS NULL THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM public.multa36_origens WHERE contrato_id=cid) THEN RETURN NULL;END IF;
 PERFORM emprestimos_lista60.public__multa36_validar(uid,cid);
 FOR p IN SELECT * FROM public.parcelas WHERE contrato_id=cid ORDER BY id LOOP
  q:=emprestimos_lista60.public__multa36_cotacao(uid,cid,p.id,instante);
  IF q->>'dataPagamento' IS DISTINCT FROM ((instante AT TIME ZONE 'America/Sao_Paulo')::date)::text OR (shared_hash IS NOT NULL AND shared_hash IS DISTINCT FROM q->>'estadoHash') OR (shared_account IS NOT NULL AND shared_account IS DISTINCT FROM (q->>'contaCaixaId')::integer) THEN RAISE EXCEPTION '60 fine quote shared closure/context inconsistent' USING ERRCODE='23514'; END IF;
  shared_hash:=q->>'estadoHash';shared_account:=(q->>'contaCaixaId')::integer;
  IF p.id=first_positive THEN first_quote:=q;END IF;
  qs:=qs||jsonb_build_array(q);
 END LOOP;
 final_quote:=emprestimos_lista60.public__multa36_cotacao(uid,cid,first_positive,instante);
 IF final_quote IS DISTINCT FROM first_quote THEN RAISE EXCEPTION '60 fine final quote inconsistent' USING ERRCODE='23514';END IF;
 RETURN qs;
END
$quotes60m$;
CREATE TABLE emprestimos_lista60.manifesto(id integer PRIMARY KEY CHECK(id=1),assinatura text NOT NULL CHECK(assinatura ~ '^[a-f0-9]{64}$'));
ALTER TABLE emprestimos_lista60.manifesto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE emprestimos_lista60.manifesto FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION emprestimos_lista60.lista(uid integer) RETURNS jsonb STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $list60$
DECLARE collector integer; nr bigint; cr record; c public.contratos%ROWTYPE; s jsonb; ps jsonb; cli jsonb; qs jsonb; configs jsonb; items jsonb:='[]'; code text; msg text; instante timestamptz:=statement_timestamp();
BEGIN
 IF uid IS NULL OR uid<=0 THEN RAISE EXCEPTION '60 sessão inválida' USING ERRCODE='22023'; END IF;
 IF current_setting('server_version_num')::int/10000<>17 OR current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Caixa37 exige PG17/Read Committed' USING ERRCODE='55000'; END IF;
 PERFORM emprestimos_lista60.verificar();
 SELECT count(*) INTO nr FROM public.koletores WHERE user_id=uid AND ativo=true;
 IF nr>1 OR EXISTS(SELECT 1 FROM public.koletores WHERE user_id=uid AND ativo=true AND (perfil IS NULL OR perfil NOT IN('koletor','admin','gerente'))) THEN RAISE EXCEPTION '60 escopo de cobrador inválido' USING ERRCODE='55000';END IF;
 SELECT CASE WHEN perfil='koletor' THEN id ELSE NULL END INTO collector FROM public.koletores WHERE user_id=uid AND ativo=true ORDER BY id LIMIT 1;
 SELECT count(*) INTO nr FROM public.contratos WHERE user_id=uid AND (collector IS NULL OR koletor_id=collector);
 IF nr>=20000 THEN RAISE EXCEPTION '60 lista excede limite de leitura; não truncada' USING ERRCODE='54000';END IF;
 SELECT count(*) INTO nr FROM public.parcelas p JOIN public.contratos co ON co.id=p.contrato_id WHERE co.user_id=uid AND (collector IS NULL OR co.koletor_id=collector);
 IF nr>=20000 THEN RAISE EXCEPTION '60 parcelas excedem limite de leitura; não truncadas' USING ERRCODE='54000';END IF;
 FOR cr IN SELECT id,cliente_id,koletor_id FROM public.contratos WHERE user_id=uid AND (collector IS NULL OR koletor_id=collector) ORDER BY id LOOP
  -- Antes da prova, somente o ID de um pai pertencente à própria empresa.
  IF cr.cliente_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.clientes WHERE id=cr.cliente_id AND user_id=uid)
   OR EXISTS(SELECT 1 FROM public.parcelas WHERE contrato_id=cr.id AND (user_id IS DISTINCT FROM uid OR cliente_id IS DISTINCT FROM cr.cliente_id)) THEN
   items:=items||jsonb_build_array(jsonb_build_object('kind','unavailable','id',cr.id,'reason','local_link_unconfirmed'));CONTINUE;
  END IF;
  BEGIN
   s:=emprestimos_lista60.obrigacoes51__estado(uid,cr.id);
   qs:=emprestimos_lista60.quotes36(uid,cr.id,instante);
  EXCEPTION WHEN SQLSTATE '42501' OR SQLSTATE '23514' THEN
   GET STACKED DIAGNOSTICS code=RETURNED_SQLSTATE,msg=MESSAGE_TEXT;
   IF (code='42501' AND msg='51 vínculos próprios completos obrigatórios; sem saneamento') OR (code='23514' AND msg IN('51 obrigação registrada ambígua','51 valores registrados inválidos','51 residual parcial ambíguo','51 aliases/baixa registrada ambíguos')) THEN
    items:=items||jsonb_build_array(jsonb_build_object('kind','unavailable','id',cr.id,'reason',msg));CONTINUE;
   END IF;
   RAISE;
  END;
  -- Nomes e dinheiro são projetados somente depois dos vínculos/eventos/proveniência.
  SELECT * INTO STRICT c FROM public.contratos WHERE id=cr.id AND user_id=uid;
  SELECT jsonb_build_object('id',id,'user_id',user_id,'nome',nome) INTO STRICT cli FROM public.clientes WHERE id=c.cliente_id AND user_id=uid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'user_id',p.user_id,'contrato_id',p.contrato_id,'cliente_id',p.cliente_id,'numero_parcela',p.numero_parcela,
   'valor_original',p.valor_original::numeric(15,2)::text,'valor_juros',p.valor_juros::numeric(15,2)::text,'valor_pago',p.valor_pago::numeric(15,2)::text,
   'valor_multa',p.valor_multa::numeric(15,2)::text,'multa_manual',p.multa_manual::numeric(15,2)::text,'saldo_residual',p.saldo_residual::numeric(15,2)::text,
   'data_vencimento',p.data_vencimento,'data_pagamento',p.data_pagamento,'status',p.status) ORDER BY p.id),'[]'::jsonb) INTO ps FROM public.parcelas p WHERE p.contrato_id=c.id AND p.user_id=uid AND p.cliente_id=c.cliente_id;
  items:=items||jsonb_build_array(jsonb_build_object('kind','validated','id',c.id,'contrato',jsonb_build_object('id',c.id,'user_id',c.user_id,'cliente_id',c.cliente_id,'koletor_id',c.koletor_id,'modalidade',c.modalidade,'status',c.status,'valor_principal',c.valor_principal::numeric(15,2)::text),'cliente',cli,'parcelas',ps,'estado51',s,'cotacoes36',qs));
 END LOOP;
 IF EXISTS(SELECT 1 FROM public.configuracoes WHERE user_id=uid AND chave IN('jurosMultaAutomatico','juros_multa_automatico','multaDiaria','multa_diaria','multaPadrao','multa_padrao') GROUP BY chave HAVING count(*)>1) THEN RAISE EXCEPTION '60 configurações próprias duplicadas' USING ERRCODE='55000'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'chave',chave,'valor',valor) ORDER BY chave),'[]'::jsonb) INTO configs FROM public.configuracoes WHERE user_id=uid AND chave IN('jurosMultaAutomatico','juros_multa_automatico','multaDiaria','multa_diaria','multaPadrao','multa_padrao');
 RETURN jsonb_build_object('versao','lista_emprestimos60_v1','userId',uid,'dataCalculo',(instante AT TIME ZONE 'America/Sao_Paulo')::date,'items',items,'configuracoes',configs);
END $list60$;

CREATE FUNCTION public.rpc_lista_emprestimos60(p_user_id integer) RETURNS jsonb STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp SET TimeZone='UTC' AS $rpc60$
 SELECT emprestimos_lista60.lista(p_user_id);
$rpc60$;
CREATE FUNCTION emprestimos_lista60.metadata() RETURNS text STABLE LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $meta60$
 SELECT encode(extensions.digest(jsonb_build_object(
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='emprestimos_lista60'::regnamespace OR p.oid='public.rpc_lista_emprestimos60(integer)'::regprocedure OR p.oid='extensions.digest(text,text)'::regprocedure),
 'namespaces',(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_namespace n WHERE n.nspname IN('emprestimos_lista60','extensions','public','obrigacoes51','private47','manutencao48','inclusao52','sucessores53')),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.oid IN(SELECT to_regclass(x) FROM unnest(ARRAY['inclusao52.adicionais','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.operacoes','private47.cadeia','private47.cotacoes','private47.operacoes','private47.recebimentos','public.caixa37_capacidades','public.caixa37_contas','public.caixa37_operacoes','public.caixa37_pernas','public.ciclo_estados','public.clientes','public.contas_caixa','public.contrato_historico','public.contratos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.koletores','public.legados_estados','public.multa36_encargos','public.multa36_estados','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_estados','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.parcelas','public.reparcelamento43_cadeia','public.reparcelamento43_estados','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.users','sucessores53.operacoes','public.configuracoes']) x) OR c.relnamespace='emprestimos_lista60'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attnum>0 AND (c.oid IN(SELECT to_regclass(x) FROM unnest(ARRAY['inclusao52.adicionais','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.operacoes','private47.cadeia','private47.cotacoes','private47.operacoes','private47.recebimentos','public.caixa37_capacidades','public.caixa37_contas','public.caixa37_operacoes','public.caixa37_pernas','public.ciclo_estados','public.clientes','public.contas_caixa','public.contrato_historico','public.contratos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.koletores','public.legados_estados','public.multa36_encargos','public.multa36_estados','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_estados','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.parcelas','public.reparcelamento43_cadeia','public.reparcelamento43_estados','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.users','sucessores53.operacoes','public.configuracoes']) x) OR c.relnamespace='emprestimos_lista60'::regnamespace)),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid IN(SELECT to_regclass(x) FROM unnest(ARRAY['inclusao52.adicionais','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.operacoes','private47.cadeia','private47.cotacoes','private47.operacoes','private47.recebimentos','public.caixa37_capacidades','public.caixa37_contas','public.caixa37_operacoes','public.caixa37_pernas','public.ciclo_estados','public.clientes','public.contas_caixa','public.contrato_historico','public.contratos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.koletores','public.legados_estados','public.multa36_encargos','public.multa36_estados','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_estados','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.parcelas','public.reparcelamento43_cadeia','public.reparcelamento43_estados','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.users','sucessores53.operacoes','public.configuracoes']) x) OR k.connamespace='emprestimos_lista60'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p WHERE p.polrelid IN(SELECT to_regclass(x) FROM unnest(ARRAY['inclusao52.adicionais','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.operacoes','private47.cadeia','private47.cotacoes','private47.operacoes','private47.recebimentos','public.caixa37_capacidades','public.caixa37_contas','public.caixa37_operacoes','public.caixa37_pernas','public.ciclo_estados','public.clientes','public.contas_caixa','public.contrato_historico','public.contratos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.koletores','public.legados_estados','public.multa36_encargos','public.multa36_estados','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_estados','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.parcelas','public.reparcelamento43_cadeia','public.reparcelamento43_estados','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.users','sucessores53.operacoes','public.configuracoes']) x) OR p.polrelid='emprestimos_lista60.manifesto'::regclass),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t WHERE t.tgrelid IN(SELECT to_regclass(x) FROM unnest(ARRAY['inclusao52.adicionais','obrigacoes51.adicionais','obrigacoes51.arquivos','obrigacoes51.cancelamentos','obrigacoes51.encerramentos','obrigacoes51.operacoes','private47.cadeia','private47.cotacoes','private47.operacoes','private47.recebimentos','public.caixa37_capacidades','public.caixa37_contas','public.caixa37_operacoes','public.caixa37_pernas','public.ciclo_estados','public.clientes','public.contas_caixa','public.contrato_historico','public.contratos','public.emprestimos_rpc_operacoes','public.emprestimos_rpc_origens','public.koletores','public.legados_estados','public.multa36_encargos','public.multa36_estados','public.multa36_operacoes','public.multa36_origens','public.multa36_pernas','public.multa36_renovacoes','public.multimodal_estados','public.multimodal_operacoes','public.multimodal_origens','public.multimodal_pernas','public.multimodal_renovacoes','public.parcelas','public.reparcelamento43_cadeia','public.reparcelamento43_estados','public.reparcelamento43_operacoes','public.reparcelamento43_recebimentos','public.transacoes_caixa','public.users','sucessores53.operacoes','public.configuracoes']) x)),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated','postgres')),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated')))
 )::text,'sha256'),'hex');
$meta60$;CREATE FUNCTION emprestimos_lista60.verificar() RETURNS void STABLE LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $guard60$
BEGIN
 IF (SELECT assinatura FROM emprestimos_lista60.manifesto WHERE id=1) IS DISTINCT FROM emprestimos_lista60.metadata() THEN RAISE EXCEPTION '60 integridade da leitura desconhecida' USING ERRCODE='55000';END IF;
END $guard60$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA emprestimos_lista60 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_lista_emprestimos60(integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lista_emprestimos60(integer) TO service_role;
INSERT INTO emprestimos_lista60.manifesto(id,assinatura) VALUES(1,emprestimos_lista60.metadata());
DO $post60$ DECLARE old text; derived text; final text; nr integer; rr record; h text; projection text; BEGIN
 SELECT assinatura INTO STRICT old FROM witness60_seal;
 SELECT public.caixa37_hash(jsonb_build_object(
 'funcoes',(SELECT jsonb_agg(jsonb_build_array(p.oid,to_jsonb(p),pg_get_functiondef(p.oid)) ORDER BY p.oid) FROM pg_proc p WHERE (p.pronamespace='public'::regnamespace OR p.proname LIKE 'caixa37\_%' ESCAPE '\' OR p.proname LIKE 'rpc\_%caixa37' ESCAPE '\') AND p.oid <> 'public.rpc_lista_emprestimos60(integer)'::regprocedure),
 'relations',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid'] ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'attributes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(a),pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='public'::regnamespace AND a.attnum>0),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(t),pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(k),pg_get_constraintdef(k.oid)) ORDER BY k.oid) FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'roles',(SELECT jsonb_agg(jsonb_build_array(oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls) ORDER BY oid) FROM pg_roles WHERE rolname IN('service_role','anon','authenticated',current_user)),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member) FROM pg_auth_members m WHERE member IN(SELECT oid FROM pg_roles WHERE rolname IN('service_role','anon','authenticated'))))) INTO derived;
 IF derived IS DISTINCT FROM old THEN RAISE EXCEPTION '60 predecessores37 divergentes; sem resselo oportunista' USING ERRCODE='55000';END IF;
 final:=public.caixa37_metadata();
 UPDATE public.caixa37_manifesto SET assinatura=final WHERE id=1 AND assinatura=old;
 GET DIAGNOSTICS nr=ROW_COUNT;
 IF nr<>1 THEN RAISE EXCEPTION '60 CAS do selo37 falhou' USING ERRCODE='55000';END IF;
 IF EXISTS(SELECT 1 FROM witness60_functions w LEFT JOIN pg_proc p ON p.oid=w.oid WHERE p.oid IS NULL OR to_jsonb(p) IS DISTINCT FROM w.row) THEN RAISE EXCEPTION '60 função original alterada' USING ERRCODE='55000';END IF;
 FOR rr IN SELECT rel,hash FROM witness60_data ORDER BY rel LOOP
  projection:=CASE WHEN rr.rel='public.caixa37_manifesto' THEN 'to_jsonb(x)-''assinatura''' ELSE 'to_jsonb(x)' END;
  EXECUTE format('SELECT encode(extensions.digest(coalesce(jsonb_agg(%s ORDER BY (%s)::text),''[]''::jsonb)::text,''sha256''),''hex'') FROM %s x',projection,projection,rr.rel::regclass) INTO h;
  IF h IS DISTINCT FROM rr.hash THEN RAISE EXCEPTION '60 dados originais alterados: %',rr.rel USING ERRCODE='55000';END IF;
 END LOOP;
  PERFORM public.legados_verificar();
 PERFORM public.multimodal_verificar();
 PERFORM public.multa36_verificar();
 PERFORM public.caixa37_verificar();
 PERFORM despesa_cancelamento_v1.verificar();
 PERFORM telefone41.verificar();
 PERFORM manutencao44.verificar();
 PERFORM caixa_manutencao45.verificar();
 PERFORM calendario46.verificar();
 PERFORM private47.verificar();
 PERFORM manutencao48.verificar();
 PERFORM despesas49.verificar();
 PERFORM obrigacoes51.verificar();
 PERFORM inclusao52.verificar();
 PERFORM sucessores53.verificar();
 PERFORM emprestimos_lista60.verificar();
END $post60$;
DROP TABLE witness60_functions,witness60_data,witness60_seal;
COMMIT;
