import { describe, expect, it } from "vitest";
import { renovacaoProspectivaNovaIntencao, renovacaoProspectivaGuardarIntencao, renovacaoProspectivaLerIntencao } from "./renovacaoProspectivaIntencao";
const q:any={elegivel:true,contratoId:1,parcelaId:2,totalExigido:"55.60",dataPagamento:"2026-11-10",estadoHash:"a".repeat(64),cotacaoHash:"b".repeat(64)};
const uuid="11111111-1111-4111-8111-111111111111";
describe("renovacaoProspectiva intenção cliente",()=>{
 it("valor fixo SQL e UUID imutáveis após reload/timeout",()=>{let text="";const s={setItem:(_k:string,v:string)=>{text=v;},getItem:()=>text};const p=renovacaoProspectivaNovaIntencao(q,uuid);renovacaoProspectivaGuardarIntencao(s,"tenant:1",p);const restored=renovacaoProspectivaLerIntencao(s,"tenant:1",{contratoId:1,parcelaId:2});expect(restored).toEqual(p);expect(restored?.payload.valorRecebido).toBe("55.60");expect(restored?.payload.idempotencyKey).toBe(uuid);});
 it("storage indisponível impede envio",()=>{expect(()=>renovacaoProspectivaGuardarIntencao({setItem:()=>{throw Error("storage");}},"k",renovacaoProspectivaNovaIntencao(q,uuid))).toThrow("storage");});
 it("outra parcela/contrato não retoma intenção",()=>{const p=renovacaoProspectivaNovaIntencao(q,uuid);expect(()=>renovacaoProspectivaLerIntencao({getItem:()=>JSON.stringify(p)},"k",{contratoId:9,parcelaId:2})).toThrow(/segunda/);});
 it.each([{idempotencyKey:"x"},{estadoHash:"x"},{cotacaoHash:"x"},{valorRecebido:"0.01"},{userId:2}])("payload corrupto falha fechado %j",patch=>{const p=renovacaoProspectivaNovaIntencao(q,uuid);expect(()=>renovacaoProspectivaLerIntencao({getItem:()=>JSON.stringify({...p,payload:{...p.payload,...patch}})},"k",{contratoId:1,parcelaId:2})).toThrow();});
 it("sem storage anterior não inventa confirmação",()=>{expect(renovacaoProspectivaLerIntencao({getItem:()=>null},"k",{contratoId:1,parcelaId:2})).toBe(null);});
});
