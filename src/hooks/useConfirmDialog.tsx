"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void | Promise<void>;
}

export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);

  const confirm = useCallback((options: ConfirmOptions) => {
    setState(options);
  }, []);

  const close = useCallback(() => {
    if (!loading) setState(null);
  }, [loading]);

  const handleConfirm = useCallback(async () => {
    if (!state) return;
    setLoading(true);
    try {
      await state.onConfirm();
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [state]);

  const ConfirmDialogPortal = (
    <ConfirmDialog
      open={!!state}
      title={state?.title ?? ""}
      description={state?.description ?? ""}
      confirmLabel={state?.confirmLabel}
      cancelLabel={state?.cancelLabel}
      variant={state?.variant ?? "danger"}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={close}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogPortal, close };
}
