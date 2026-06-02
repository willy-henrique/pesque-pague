"use client";

import { useEffect, useRef } from "react";
import { playNotification } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Flame, Bike, CheckCircle2, ChevronRight, Fish,
  TrendingUp, ShoppingBag, Wallet,
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { formatCurrency, getRelativeTime, isSameBrasiliaDay } from "@/lib/utils";
import type { Pedido, OrderStatus } from "@/types";
import { STATUS_LABELS, STATUS_NEXT } from "@/types";
import toast from "react-hot-toast";

const COLUNAS: { status: OrderStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: "novo",       label: "Novos",     icon: Clock,        color: "text-gold-500" },
  { status: "em_preparo", label: "Em Preparo", icon: Flame,       color: "text-water-300" },
  { status: "saiu",       label: "Saiu",       icon: Bike,        color: "text-bark-300" },
  { status: "entregue",   label: "Entregue",   icon: CheckCircle2, color: "text-forest-300" },
];

export default function Dashboard() {
  const prevCountRef = useRef(0);

  // Query simples sem índice composto — filtro de status client-side
  const { data: todosPedidos } = useCollection<Pedido>("pedidos", [
    orderBy("criadoEm", "desc"),
  ]);

  const ATIVOS = new Set(["novo", "em_preparo", "saiu", "entregue"]);
  const pedidos = todosPedidos.filter((p) => ATIVOS.has(p.status));

  const novos = pedidos.filter((p) => p.status === "novo").length;

  useEffect(() => {
    if (novos > prevCountRef.current) playNotification();
    prevCountRef.current = novos;
  }, [novos]);

  const hoje = pedidos.filter((p) => {
    if (!p.criadoEm) return false;
    return isSameBrasiliaDay(p.criadoEm.toDate());
  });

  const totalHoje    = hoje.reduce((s, p) => s + p.total, 0);
  const pedidosHoje  = hoje.length;

  const avancarStatus = async (pedido: Pedido) => {
    const proximo = STATUS_NEXT[pedido.status];
    if (!proximo) return;
    await updateDoc(doc(db, "pedidos", pedido.id), {
      status: proximo,
      atualizadoEm: serverTimestamp(),
    });
    toast.success(`Pedido #${pedido.id.slice(-4).toUpperCase()} → ${STATUS_LABELS[proximo]}`);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={ShoppingBag} label="Pedidos hoje" value={String(pedidosHoje)} color="text-forest-300" />
        <StatCard icon={Wallet}      label="Faturamento" value={formatCurrency(totalHoje)} color="text-gold-500" />
        <StatCard icon={TrendingUp}  label="Em aberto"   value={String(pedidos.length)} color="text-water-300" />
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUNAS.map(({ status, label, icon: Icon, color }) => {
          const col = pedidos.filter((p) => p.status === status);
          return (
            <div key={status} className="glass rounded-2xl overflow-hidden flex flex-col">
              {/* Column header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="font-semibold text-sm text-forest-100">{label}</span>
                {col.length > 0 && (
                  <span className={`badge ml-auto ${status === "novo" ? "status-novo animate-pulse-gold" : "status-preparo"}`}>
                    {col.length}
                  </span>
                )}
              </div>

              {/* Cards */}
              <div className="flex-1 p-3 space-y-3 min-h-[200px]">
                <AnimatePresence mode="popLayout">
                  {col.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-center h-full py-8"
                    >
                      <p className="text-forest-700 text-xs">Sem pedidos aqui</p>
                    </motion.div>
                  ) : (
                    col.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        onAvancar={() => avancarStatus(pedido)}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color,
}: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="glass rounded-2xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-forest-500 text-xs">{label}</span>
      </div>
      <p className={`font-display font-bold text-lg ${color}`}>{value}</p>
    </div>
  );
}

function PedidoCard({ pedido, onAvancar }: { pedido: Pedido; onAvancar: () => void }) {
  const proximo = STATUS_NEXT[pedido.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, height: 0 }}
      transition={{ duration: 0.25 }}
      className="bg-forest-900/60 border border-white/[0.07] rounded-xl overflow-hidden"
    >
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Fish className="w-3.5 h-3.5 text-gold-500" />
            <span className="text-forest-100 font-bold text-xs">{pedido.piqueNome}</span>
          </div>
          <span className="text-forest-600 text-[10px]">
            {pedido.criadoEm ? getRelativeTime(pedido.criadoEm.toDate()) : "--"}
          </span>
        </div>

        <div className="space-y-0.5">
          {pedido.itens.slice(0, 3).map((item, i) => (
            <p key={i} className="text-forest-400 text-xs truncate">
              {item.quantidade}× {item.nome}
            </p>
          ))}
          {pedido.itens.length > 3 && (
            <p className="text-forest-600 text-xs">+{pedido.itens.length - 3} mais...</p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05]">
          <span className="gradient-gold-text font-bold text-xs">{formatCurrency(pedido.total)}</span>
          <span className="text-forest-600 text-[10px]">#{pedido.id.slice(-6).toUpperCase()}</span>
        </div>
      </div>

      {proximo && (
        <button
          onClick={onAvancar}
          className="w-full flex items-center justify-center gap-1.5 py-2 bg-forest-800/60 hover:bg-forest-700/60 text-forest-300 hover:text-forest-100 text-xs font-medium transition-all border-t border-white/[0.05]"
        >
          {STATUS_LABELS[proximo]}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}
