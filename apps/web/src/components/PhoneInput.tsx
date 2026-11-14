"use client";

import { useState } from "react";

/** Dial codes, African countries first (PACA's members), then common others. */
export const COUNTRIES: Array<{ code: string; name: string; dial: string }> = [
  { code: "GH", name: "Ghana", dial: "+233" },
  { code: "NG", name: "Nigeria", dial: "+234" },
  { code: "KE", name: "Kenya", dial: "+254" },
  { code: "ZA", name: "South Africa", dial: "+27" },
  { code: "UG", name: "Uganda", dial: "+256" },
  { code: "TZ", name: "Tanzania", dial: "+255" },
  { code: "RW", name: "Rwanda", dial: "+250" },
  { code: "ET", name: "Ethiopia", dial: "+251" },
  { code: "EG", name: "Egypt", dial: "+20" },
  { code: "MA", name: "Morocco", dial: "+212" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225" },
  { code: "SN", name: "Senegal", dial: "+221" },
  { code: "CM", name: "Cameroon", dial: "+237" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "BJ", name: "Benin", dial: "+229" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "SL", name: "Sierra Leone", dial: "+232" },
  { code: "LR", name: "Liberia", dial: "+231" },
  { code: "GM", name: "Gambia", dial: "+220" },
  { code: "ZM", name: "Zambia", dial: "+260" },
  { code: "ZW", name: "Zimbabwe", dial: "+263" },
  { code: "BW", name: "Botswana", dial: "+267" },
  { code: "NA", name: "Namibia", dial: "+264" },
  { code: "MW", name: "Malawi", dial: "+265" },
  { code: "MZ", name: "Mozambique", dial: "+258" },
  { code: "AO", name: "Angola", dial: "+244" },
  { code: "CD", name: "DR Congo", dial: "+243" },
  { code: "MU", name: "Mauritius", dial: "+230" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "US", name: "United States / Canada", dial: "+1" },
  { code: "IE", name: "Ireland", dial: "+353" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "NL", name: "Netherlands", dial: "+31" },
  { code: "AE", name: "United Arab Emirates", dial: "+971" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "CN", name: "China", dial: "+86" },
  { code: "AU", name: "Australia", dial: "+61" },
];

/**
 * Builds an E.164 number (+233241234567) from a country picker and the local
 * number. A leading trunk "0" (024… in Ghana, 080… in Nigeria) is dropped, since
 * it is not dialled after the country code.
 */
export function toE164(dial: string, local: string): string {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  return digits ? `${dial}${digits}` : "";
}

interface Props {
  id: string;
  /** Called with the full E.164 number, or "" when the number is empty. */
  onChange: (e164: string) => void;
  required?: boolean;
  defaultCountry?: string;
}

export function PhoneInput({ id, onChange, required, defaultCountry = "GH" }: Props) {
  const [country, setCountry] = useState(defaultCountry);
  const [local, setLocal] = useState("");
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+233";

  const fieldStyle = { background: "var(--bg)", borderColor: "var(--border)", color: "var(--text)" };

  return (
    <div className="flex gap-2">
      <select
        aria-label="Country code"
        value={country}
        onChange={(e) => {
          setCountry(e.target.value);
          const nextDial = COUNTRIES.find((c) => c.code === e.target.value)?.dial ?? "+233";
          onChange(toE164(nextDial, local));
        }}
        className="w-32 shrink-0 rounded-lg border px-2 py-2 text-sm outline-none focus:border-paca-500"
        style={fieldStyle}
      >
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} {c.dial} · {c.name}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        required={required}
        placeholder={country === "GH" ? "24 123 4567" : "Phone number"}
        value={local}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d\s-]/g, "").slice(0, 20);
          setLocal(v);
          onChange(toE164(dial, v));
        }}
        className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-paca-500"
        style={fieldStyle}
      />
    </div>
  );
}
