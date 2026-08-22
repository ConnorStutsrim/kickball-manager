"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Fires a success toast when a useActionState submission that was pending
 * finishes without an error. Tracks the previous pending value so it never
 * fires on initial mount — only on a real pending→settled transition.
 */
export function useActionToast(pending: boolean, hasError: boolean, message: string) {
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !hasError) {
      toast.success(message);
    }
    wasPending.current = pending;
  }, [pending, hasError, message]);
}
