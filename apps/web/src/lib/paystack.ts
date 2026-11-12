/**
 * Paystack InlineJS (v2) popup. The transaction is created on the API, which
 * returns only an access code — the popup needs no key and the amount cannot be
 * changed in the browser.
 */

const SCRIPT_URL = "https://js.paystack.co/v2/inline.js";

interface PaystackPopInstance {
  resumeTransaction(
    accessCode: string,
    callbacks?: {
      onSuccess?: (tx: { reference: string }) => void;
      onCancel?: () => void;
      onError?: (err: { message?: string }) => void;
    },
  ): void;
}

declare global {
  interface Window {
    PaystackPop?: new () => PaystackPopInstance;
  }
}

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null;
      reject(new Error("Could not load the Paystack checkout. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export type PopupOutcome = { kind: "success"; reference: string } | { kind: "cancelled" };

/** Opens the Paystack checkout for an initialized transaction and resolves when it closes. */
export async function openPaystackPopup(accessCode: string): Promise<PopupOutcome> {
  await loadScript();
  if (!window.PaystackPop) throw new Error("Paystack checkout failed to initialise");
  const popup = new window.PaystackPop();

  return new Promise<PopupOutcome>((resolve, reject) => {
    popup.resumeTransaction(accessCode, {
      onSuccess: (tx) => resolve({ kind: "success", reference: tx.reference }),
      onCancel: () => resolve({ kind: "cancelled" }),
      onError: (err) => reject(new Error(err?.message ?? "Payment could not be started")),
    });
  });
}
