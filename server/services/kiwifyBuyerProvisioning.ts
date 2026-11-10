import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { enviarEmail, type EmailDeliveryResult, type EmailParams } from "../_core/email";
import {
  KiwifySubscriptionError, toKiwifyConsumeEvent0027,
  type KiwifyLedgerProjection, type KiwifyRpcClient,
} from "./kiwifySubscriptions";
import { normalizeKiwifyEmail } from "./kiwifySalesClient";

export type KiwifyInvitationState = "not_needed" | "pending" | "sending" | "accepted" | "retryable" | "unknown" | "blocked";
export type KiwifyBuyerResult = Readonly<{
  userId: number; applied: boolean; invitation: KiwifyInvitationState;
}>;
export type KiwifyBuyerProvisioner = {
  /** Only AFTER full paid_period validation. Persists user + immutable order +
   * ledger + invitation intent in ONE backend-only transaction. */
  provisionPaidBuyer: (projection: Omit<KiwifyLedgerProjection, "userId">) => Promise<KiwifyBuyerResult>;
};
const STATES: readonly string[] = ["not_needed", "pending", "sending", "accepted", "retryable", "unknown", "blocked"];
function record(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function exact(v: unknown, keys: string[]): v is Record<string, unknown> {
  return record(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
}
function userId(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) > 0 && (v as number) <= 2_147_483_647;
}
function state(v: unknown): v is KiwifyInvitationState {
  return typeof v === "string" && STATES.includes(v);
}

/** No raw webhook identity/name, direct table writes, shared password, or secret
 * persisted in invitation state. Accepted by provider is NOT delivered. */
export function createKiwifyBuyerProvisioning(options: {
  client: () => Promise<KiwifyRpcClient>;
  sendEmail?: (params: EmailParams) => Promise<EmailDeliveryResult>;
}): KiwifyBuyerProvisioner {
  async function rpc(name: string, params: Record<string, unknown>): Promise<unknown> {
    let reply: unknown;
    try { reply = await (await options.client()).rpc(name, params); }
    catch { throw new KiwifySubscriptionError("ledger_unavailable"); }
    if (!record(reply) || reply.error !== null || reply.data === undefined) {
      throw new KiwifySubscriptionError("ledger_unavailable");
    }
    return reply.data;
  }
  return {
    async provisionPaidBuyer(projection) {
      if (projection.action !== "paid_period" || projection.saleStatus !== "paid"
        || projection.orderStatus !== "paid" || normalizeKiwifyEmail(projection.customerEmail) !== projection.customerEmail) {
        throw new KiwifySubscriptionError("invalid_payload");
      }
      // Validate exact 0027 identity/date DTO BEFORE bcrypt or any RPC. user_id is
      // deliberately absent on the wire: only the transaction resolves identity.
      const { user_id: _unused, ...event } = toKiwifyConsumeEvent0027({ ...projection, userId: 1 });
      const passwordHash = await bcrypt.hash(randomBytes(48).toString("base64url"), 12);
      const data = await rpc("rpc_kiwify_buyer_provision", { p_buyer: {
        email: projection.customerEmail, password_hash: passwordHash,
        open_id: `kiwify_${randomUUID()}`, event,
      } });
      if (!exact(data, ["user_id", "email", "created", "applied", "invite_state"])
        || !userId(data.user_id) || data.email !== projection.customerEmail
        || typeof data.created !== "boolean" || typeof data.applied !== "boolean" || !state(data.invite_state)
        || (!data.created && data.invite_state !== "not_needed") || (data.created && data.invite_state === "not_needed")) {
        throw new KiwifySubscriptionError("ledger_invalid");
      }
      let invitation = data.invite_state;
      if (invitation === "pending" || invitation === "retryable") {
        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        const claim = await rpc("rpc_kiwify_buyer_invite_claim", { p_claim: {
          order_id: projection.orderId, email: projection.customerEmail, token_hash: tokenHash,
        } });
        if (!exact(claim, ["claimed", "user_id", "invite_state"]) || typeof claim.claimed !== "boolean"
          || claim.user_id !== data.user_id || !state(claim.invite_state)
          || (claim.claimed && claim.invite_state !== "sending")) throw new KiwifySubscriptionError("ledger_invalid");
        invitation = claim.invite_state;
        if (claim.claimed) {
          let delivery: unknown;
          try {
            delivery = await (options.sendEmail ?? enviarEmail)({
              to: projection.customerEmail, toName: "Cliente CobraPro",
              subject: "Defina sua senha de acesso ao CobraPro",
              htmlContent: `<h1>CobraPro</h1><p>Bem-vindo(a)! Defina sua senha pelo link individual abaixo.</p><p><a href="https://cobrapro.online/reset-senha?token=${token}">Definir minha senha</a></p><p>Este link pode ser usado uma vez e expira em uma hora. Se não reconhece a compra, ignore a mensagem.</p>`,
            });
          } catch {
            // A transport throw may be AFTER provider acceptance. NEVER retry it.
            delivery = { accepted: false, kind: "delivery_unknown", deliveryKnown: false, retryEligible: false };
          }
          const reply = record(delivery) ? delivery : {};
          const knownReply = typeof reply.accepted === "boolean"
            && typeof reply.deliveryKnown === "boolean" && typeof reply.retryEligible === "boolean";
          const next = knownReply && reply.accepted === true && reply.deliveryKnown === true && reply.retryEligible === false && reply.kind === "accepted"
            ? "accepted" : knownReply && reply.accepted === false && reply.deliveryKnown === true
              ? reply.retryEligible === true && ["throttled", "transient_provider"].includes(String(reply.kind))
                ? "retryable" : reply.retryEligible === false && ["configuration", "rejected"].includes(String(reply.kind))
                  ? "blocked" : "unknown" : "unknown";
          const finished = await rpc("rpc_kiwify_buyer_invite_finish", { p_result: {
            order_id: projection.orderId, email: projection.customerEmail, token_hash: tokenHash, state: next,
          } });
          if (!exact(finished, ["finished", "invite_state"]) || finished.finished !== true || finished.invite_state !== next) {
            throw new KiwifySubscriptionError("ledger_invalid");
          }
          invitation = next;
        }
      }
      return { userId: data.user_id, applied: data.applied, invitation };
    },
  };
}
