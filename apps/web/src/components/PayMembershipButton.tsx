"use client";

import { useState } from "react";
import { ApiError, formatMoney, formatUsd, initializeMembershipPayment, verifyPayment } from "@/lib/api";
import { openPaystackPopup } from "@/lib/paystack";

interface Props {
  amountUsdCents: number;
  chargeAmount: number | null;
  chargeCurrency: string | null;
  /** Called once the API has confirmed the payment, so the page can reload its state. */
  onPaid: () => void;
}

type Phase = "idle" | "starting" | "checkout" | "confirming";

/**
 * Card, mobile money or bank — all inside Paystack's own popup. The popup's
 * "success" is only a hint: the membership activates when the API has
 * re-verified the transaction with Paystack (or Paystack's webhook arrives).
 */
export function PayMembershipButton({ amountUsdCents, chargeAmount, chargeCurrency, onPaid }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function handlePay() {
    setMessage(null);
    setPhase("starting");
    try {
      const payment = await initializeMembershipPayment();
      setPhase("checkout");
      const outcome = await openPaystackPopup(payment.accessCode);

      if (outcome.kind === "cancelled") {
        setMessage({ tone: "info", text: "Payment cancelled. You can try again whenever you're ready." });
        return;
      }

      setPhase("confirming");
      const result = await verifyPayment(outcome.reference);
      if (result.status === "SUCCESS") {
        onPaid();
      } else if (result.status === "PENDING") {
        setMessage({
          tone: "info",
          text: "Your payment is still being processed (mobile money can take a minute to approve). This page will update once it's confirmed — refresh shortly.",
        });
      } else {
        setMessage({ tone: "error", text: "The payment did not go through. No membership was activated — please try again." });
      }
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof ApiError || err instanceof Error ? err.message : "Payment failed to start." });
    } finally {
      setPhase("idle");
    }
  }

  const price = chargeAmount !== null && chargeCurrency ? formatMoney(chargeAmount, chargeCurrency) : formatUsd(amountUsdCents);
  const label =
    phase === "starting" ? "Starting checkout…" : phase === "checkout" ? "Complete payment in the popup…" : phase === "confirming" ? "Confirming payment…" : `Pay ${price}`;

  return (
    <div>
      <button
        onClick={() => void handlePay()}
        disabled={phase !== "idle"}
        className="rounded-lg bg-paca-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-paca-600 disabled:opacity-60"
      >
        {label}
      </button>
      <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
        {chargeCurrency && chargeCurrency !== "USD" && <>{formatUsd(amountUsdCents)} annual fee, charged in {chargeCurrency}. </>}
        Pay by card, mobile money or bank — secured by Paystack.
      </p>
      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className="mt-3 rounded-lg px-4 py-3 text-sm"
          style={
            message.tone === "error"
              ? { background: "#c0392b1a", color: "#c0392b" }
              : { background: "var(--surface)", color: "var(--text-muted)" }
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
