import { describe, expect, it } from "vitest";
import { LimitadorDeTentativas } from "./authRateLimit";

describe("LimitadorDeTentativas", () => {
  it("bloqueia depois do limite e informa o tempo restante", () => {
    let agora = 1_000;
    const limitador = new LimitadorDeTentativas(() => agora);

    expect(limitador.consumir("login", 2, 60_000).permitido).toBe(true);
    expect(limitador.consumir("login", 2, 60_000).permitido).toBe(true);
    const bloqueio = limitador.consumir("login", 2, 60_000);
    expect(bloqueio).toEqual({ permitido: false, aguardarSegundos: 60 });

    agora += 60_000;
    expect(limitador.consumir("login", 2, 60_000).permitido).toBe(true);
  });

  it("libera imediatamente após uma autenticação bem-sucedida", () => {
    const limitador = new LimitadorDeTentativas();
    limitador.consumir("login", 1, 60_000);
    limitador.remover("login");
    expect(limitador.consumir("login", 1, 60_000).permitido).toBe(true);
  });
});
