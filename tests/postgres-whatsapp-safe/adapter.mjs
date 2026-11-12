const identifier = value => '"' + String(value).replaceAll('"', '""') + '"';
function splitColumns(value) {
  const columns = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (value[i] === "," && depth === 0) {
      columns.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  columns.push(value.slice(start).trim());
  return columns;
}
export function createAdapter(pool) {
  const adapter = {
    before: null,
    after: null,
    calls: [],
    async rpc(name, args) {
      if (name !== "legados_prova_pagamento") throw Error("Unexpected RPC");
      const q = { table: name, op: "rpc", values: args, filters: [] };
      adapter.calls.push(q);
      if (adapter.before) {
        const fault = await adapter.before(q);
        if (fault) return { data: null, error: fault };
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SET LOCAL ROLE service_role");
        const role = (await client.query("SELECT current_user u,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];
        if (role.u !== "service_role" || role.rolsuper || role.rolbypassrls) throw Error("Invalid proof role");
        const result = await client.query("SELECT public.legados_prova_pagamento($1,$2,$3) r", [args.p_user_id, args.p_fonte, args.p_operacao_id]);
        await client.query("COMMIT");
        return { data: result.rows[0].r, error: null };
      } catch (e) {
        await client.query("ROLLBACK");
        return { data: null, error: { code: e.code, message: e.message } };
      } finally { client.release(); }
    },
    from(table) {
      if (["ciclo_operacoes", "ciclo_pernas", "legados_operacoes", "legados_auditoria"].includes(table))
        throw Error("Private REST SELECT prohibited");
      return new Query(table);
    },
  };
  class Query {
    constructor(table) {
      this.table = table;
      this.op = "select";
      this.columns = "*";
      this.filters = [];
      this.values = null;
      this.returning = false;
      this.single = false;
    }
    select(columns = "*") {
      this.columns = columns;
      this.returning = this.op !== "select";
      return this;
    }
    insert(value) {
      this.op = "insert";
      this.values = value;
      return this;
    }
    upsert(value, options = {}) {
      this.op = "upsert";
      this.values = value;
      this.options = options;
      return this;
    }
    update(value) {
      this.op = "update";
      this.values = value;
      return this;
    }
    eq(k, v) {
      this.filters.push([k, "=", v]);
      return this;
    }
    lt(k, v) {
      this.filters.push([k, "<", v]);
      return this;
    }
    lte(k, v) {
      this.filters.push([k, "<=", v]);
      return this;
    }
    gt(k, v) {
      this.filters.push([k, ">", v]);
      return this;
    }
    gte(k, v) {
      this.filters.push([k, ">=", v]);
      return this;
    }
    in(k, v) {
      this.filters.push([k, "in", v]);
      return this;
    }
    not(k, op, v) {
      if (op !== "is" || v !== null) throw Error("Unsupported not");
      this.filters.push([k, "is not", null]);
      return this;
    }
    order(k, options = {}) {
      this.sort = [k, options.ascending === false ? "DESC" : "ASC"];
      return this;
    }
    limit(n) {
      this.n = n;
      return this;
    }
    range(start, end) {
      this.offset = start;
      this.n = end - start + 1;
      return this;
    }
    maybeSingle() {
      this.single = true;
      return this;
    }
    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
    async execute() {
      const q = this;
      adapter.calls.push({
        table: q.table,
        op: q.op,
        columns: q.columns,
        filters: q.filters,
        values: q.values,
        options: q.options,
      });
      if (adapter.before) {
        const fault = await adapter.before(q);
        if (fault) return { data: null, error: fault };
      }
      const params = [];
      const param = v => {
        params.push(v);
        return "$" + params.length;
      };
      const clauses = q.filters.map(([key, op, v]) =>
        op === "in"
          ? `${identifier(key)} IN (${v.map(param).join(",") || "NULL"})`
          : op === "is not"
            ? `${identifier(key)} IS NOT NULL`
            : `${identifier(key)} ${op} ${param(v)}`
      );
      const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
      const columns =
        q.columns === "*"
          ? "*"
          : splitColumns(q.columns)
              .filter(c => !c.includes("("))
              .map(identifier)
              .join(",");
      const projection = columns || "id";
      let sql;
      if (q.op === "select")
        sql =
          `SELECT ${projection} FROM ${identifier(q.table)}${where}` +
          (q.sort ? ` ORDER BY ${identifier(q.sort[0])} ${q.sort[1]}` : "") +
          (q.n ? ` LIMIT ${Number(q.n)}` : "") +
          (q.offset ? ` OFFSET ${Number(q.offset)}` : "");
      else if (q.op === "update") {
        const assignments = Object.entries(q.values).map(
          ([k, v]) => `${identifier(k)}=${param(v)}`
        );
        sql = `UPDATE ${identifier(q.table)} SET ${assignments.join(",")}${where}`;
        if (q.returning) sql += " RETURNING " + projection;
      } else {
        const rows = Array.isArray(q.values) ? q.values : [q.values];
        const keys = Object.keys(rows[0]);
        sql =
          `INSERT INTO ${identifier(q.table)} (${keys.map(identifier).join(",")}) VALUES ` +
          rows
            .map(row => "(" + keys.map(k => param(row[k])).join(",") + ")")
            .join(",");
        if (q.op === "upsert" && q.options?.onConflict) {
          const conflict = q.options.onConflict.split(",");
          sql += " ON CONFLICT (" + conflict.map(identifier).join(",") + ") ";
          sql += q.options.ignoreDuplicates
            ? "DO NOTHING"
            : "DO UPDATE SET " +
              keys
                .filter(k => !conflict.includes(k))
                .map(k => `${identifier(k)}=EXCLUDED.${identifier(k)}`)
                .join(",");
        }
        if (q.returning) sql += " RETURNING " + projection;
      }
      try {
        const result = await pool.query(sql, params);
        let data = q.op === "select" || q.returning ? result.rows : null;
        if (q.columns.includes("contratos!inner") && data) {
          for (const p of data) {
            const contrato = (
              await pool.query("SELECT * FROM contratos WHERE id=$1", [
                p.contrato_id,
              ])
            ).rows[0];
            const cliente =
              contrato &&
              (
                await pool.query("SELECT * FROM clientes WHERE id=$1", [
                  contrato.cliente_id,
                ])
              ).rows[0];
            p.contratos =
              contrato && cliente ? { ...contrato, clientes: cliente } : null;
          }
          data = data.filter(p => p.contratos);
        }
        if (q.single) {
          if (data?.length > 1)
            return {
              data: null,
              error: { code: "PGRST116", message: "Multiple rows" },
            };
          data = data?.[0] ?? null;
        }
        if (adapter.after) await adapter.after(q);
        return { data, error: null };
      } catch (e) {
        return { data: null, error: { code: e.code, message: e.message } };
      }
    }
  }
  return adapter;
}
