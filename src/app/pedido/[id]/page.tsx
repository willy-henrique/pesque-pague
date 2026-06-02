"use client";

import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Fish, Clock, Flame, Bike, CheckCircle2, Wallet, Loader2, ChevronLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useDocument } from "@/hooks/useFirestore";
import { formatCurrency, formatTime } from "@/lib/utils";
import type { Pedido, OrderStatus } from "@/types";
import { STATUS_LABELS, STATUS_ORDER } from "@/types";

const STATUS_ICONS: Record<OrderStatus, React.ElementType> = {
  novo:       Clock,
  em_preparo: Flame,
  saiu:       Bike,
  entregue:   CheckCircle2,
  pago:       Wallet,
};

export default function RastreamentoPedido() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { data: pedido, loading } = useDocument<Pedido>("pedidos", id);

  if (loading) return <TrackingSkeleton />;

  if (!pedido) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 text-center p-8"
        style={{ background: "#061208" }}>
        <Fish className="w-14 h-14 text-forest-700" />
        <h1 className="font-display text-xl text-forest-300">Pedido não encontrado</h1>
        <p className="text-forest-500 text-sm">Verifique o número do pedido.</p>
      </div>
    );
  }

  const currentIdx  = STATUS_ORDER.indexOf(pedido.status);
  const isPago      = pedido.status === "pago";
  const isEntregue  = pedido.status === "entregue" || isPago;

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "radial-gradient(ellipse at top, #1a3a2a 0%, #061208 60%)" }}
    >
      {/* Header */}
      <header className="glass border-b border-white/[0.06] px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push(`/pique/${pedido.piqueId}/comanda`)}
            className="btn-ghost p-2 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-forest-400 text-xs">Acompanhamento</p>
            <h1 className="font-display font-semibold text-gold-400">
              Pedido #{id.slice(-4).toUpperCase()}
            </h1>
          </div>
          <span className={`badge ${getStatusClass(pedido.status)}`}>
            {STATUS_LABELS[pedido.status]}
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 max-w-xl mx-auto w-full space-y-5">
        {/* Timeline */}
        <div className="glass rounded-2xl p-5">
          <h2 className="font-display font-semibold text-forest-100 mb-5">Acompanhamento</h2>
          <div className="relative">
            {/* Connecting line */}
            <div className="absolute left-5 top-5 bottom-5 w-px bg-forest-800" />
            <div
              className="absolute left-5 top-5 w-px bg-gradient-to-b from-gold-500 to-forest-500 transition-all duration-700"
              style={{ height: `${(currentIdx / (STATUS_ORDER.length - 1)) * 100}%` }}
            />

            <div className="space-y-4 relative">
              {STATUS_ORDER.map((status, idx) => {
                const done    = idx <= currentIdx;
                const active  = idx === currentIdx;
                const Icon    = STATUS_ICONS[status];

                return (
                  <motion.div
                    key={status}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="flex items-center gap-4"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-500 ${
                        active
                          ? "bg-gold-500 shadow-gold-glow"
                          : done
                          ? "bg-forest-600 border border-forest-400"
                          : "bg-forest-900 border border-forest-800"
                      }`}
                    >
                      {active ? (
                        <Loader2 className="w-4 h-4 text-forest-950 animate-spin" />
                      ) : (
                        <Icon className={`w-4 h-4 ${done ? "text-forest-100" : "text-forest-700"}`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold text-sm ${
                        active ? "text-gold-400" : done ? "text-forest-200" : "text-forest-700"
                      }`}>
                        {STATUS_LABELS[status]}
                      </p>
                      {active && (
                        <p className="text-forest-500 text-xs mt-0.5">Em andamento...</p>
                      )}
                    </div>
                    {done && !active && (
                      <CheckCircle2 className="w-4 h-4 text-forest-500 shrink-0" />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="font-display font-semibold text-forest-100">
              {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
            </h2>
            <span className="text-forest-400 text-xs">
              {pedido.criadoEm ? formatTime(pedido.criadoEm.toDate()) : "--"}
            </span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {pedido.itens.map((item, i) => (
              <div key={i} className="flex gap-2 px-4 py-2.5">
                <span className="text-gold-500 font-bold text-sm">{item.quantidade}×</span>
                <div className="flex-1">
                  <span className="text-forest-100 text-sm">{item.nome}</span>
                  {item.obs && (
                    <p className="text-forest-500 text-xs italic">{item.obs}</p>
                  )}
                </div>
                <span className="text-forest-300 text-sm">{formatCurrency(item.preco * item.quantidade)}</span>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-white/[0.06] flex justify-between">
            <span className="text-forest-400 font-medium">Total</span>
            <span className="gradient-gold-text font-bold font-display">{formatCurrency(pedido.total)}</span>
          </div>
        </div>

        {/* Pague no caixa */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`glass rounded-2xl p-5 text-center border ${
            isPago
              ? "border-forest-500/30"
              : isEntregue
              ? "border-gold-500/30 animate-pulse-gold"
              : "border-white/[0.06]"
          }`}
        >
          {isPago ? (
            <>
              <CheckCircle2 className="w-8 h-8 text-forest-400 mx-auto mb-2" />
              <p className="text-forest-200 font-semibold">Pago! Bom descanso e boa pescaria!</p>
              <p className="text-forest-500 text-sm mt-1">Obrigado pela visita.</p>
            </>
          ) : (
            <>
              <Wallet className="w-8 h-8 text-gold-500 mx-auto mb-2" />
              <p className="text-forest-100 font-semibold">
                Pague no caixa ao encerrar sua pescaria
              </p>
              <p className="gradient-gold-text font-bold text-xl font-display mt-1">
                {formatCurrency(pedido.total)}
              </p>
            </>
          )}
        </motion.div>

        {pedido.observacaoGeral && (
          <div className="glass rounded-2xl px-4 py-3">
            <p className="text-forest-500 text-xs mb-1">Observação</p>
            <p className="text-forest-300 text-sm">{pedido.observacaoGeral}</p>
          </div>
        )}
      </div>
    </main>
  );
}

function getStatusClass(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    novo:       "status-novo",
    em_preparo: "status-preparo",
    saiu:       "status-saiu",
    entregue:   "status-entregue",
    pago:       "status-pago",
  };
  return map[status];
}

function TrackingSkeleton() {
  return (
    <div className="min-h-dvh p-4 space-y-4" style={{ background: "#061208" }}>
      <div className="glass rounded-2xl p-4 flex gap-3">
        <div className="skeleton-pulse w-10 h-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="skeleton-pulse h-3 w-24 rounded" />
          <div className="skeleton-pulse h-5 w-40 rounded" />
        </div>
      </div>
      <div className="glass rounded-2xl p-5 space-y-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="skeleton-pulse w-10 h-10 rounded-full" />
            <div className="skeleton-pulse h-4 flex-1 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
