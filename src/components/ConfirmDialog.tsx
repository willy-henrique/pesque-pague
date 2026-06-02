"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !loading && onCancel()}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-desc"
            initial={{ scale: 0.95, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 8 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="glass rounded-2xl w-full max-w-sm overflow-hidden border border-forest-200 dark:border-forest-700 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isDanger ? "bg-red-500/15" : "bg-gold-500/15"
                  }`}
                >
                  <AlertTriangle
                    className={`w-5 h-5 ${isDanger ? "text-red-500" : "text-gold-600"}`}
                  />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <h2
                    id="confirm-dialog-title"
                    className="font-semibold text-forest-900 dark:text-forest-50 text-base leading-snug"
                  >
                    {title}
                  </h2>
                  <p
                    id="confirm-dialog-desc"
                    className="text-forest-500 dark:text-forest-300 text-sm mt-1.5 leading-relaxed"
                  >
                    {description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="btn-ghost p-1.5 rounded-lg shrink-0 -mr-1 -mt-1 disabled:opacity-50"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="btn-ghost flex-1 py-2.5 rounded-xl text-sm border border-forest-200 dark:border-forest-600 disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60 ${
                    isDanger
                      ? "bg-red-600 hover:bg-red-500"
                      : "btn-gold"
                  }`}
                >
                  {loading ? "Aguarde..." : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
