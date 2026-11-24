"use client";

import { useEffect } from "react";
import { trackEvent } from "@/components/Analytics";

/** Records the conversion in analytics (only if the visitor accepted analytics cookies). */
export function ConversionEvent({ name }: { name: string }) {
  useEffect(() => {
    trackEvent(name);
  }, [name]);
  return null;
}
