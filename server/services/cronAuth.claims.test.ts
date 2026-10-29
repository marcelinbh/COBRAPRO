import { describe, expect, it } from "vitest";
import { claimsGithubActionsSaoAutorizadas } from "./cronAuth";

const claimsBase = {
  repository: "marcelinbh/COBRAPRO",
  ref: "refs/heads/main",
  workflow_ref: "marcelinbh/COBRAPRO/.github/workflows/disparar-lembretes-whatsapp.yml@refs/heads/main",
  event_name: "schedule",
};

describe("claims OIDC do GitHub", () => {
  it("aceita somente o workflow de lembretes na branch principal", () => {
    expect(claimsGithubActionsSaoAutorizadas(claimsBase)).toBe(true);
  });

  it("recusa token do mesmo repositório emitido para outro workflow", () => {
    expect(claimsGithubActionsSaoAutorizadas({
      ...claimsBase,
      workflow_ref: "marcelinbh/COBRAPRO/.github/workflows/sync-manus-to-github.yml@refs/heads/main",
    })).toBe(false);
  });

  it("recusa eventos, branches e repositórios não autorizados", () => {
    expect(claimsGithubActionsSaoAutorizadas({ ...claimsBase, event_name: "push" })).toBe(false);
    expect(claimsGithubActionsSaoAutorizadas({ ...claimsBase, ref: "refs/heads/feature" })).toBe(false);
    expect(claimsGithubActionsSaoAutorizadas({ ...claimsBase, repository: "atacante/COBRAPRO" })).toBe(false);
  });
});
