"use client";

import { useEffect, useRef } from "react";
import { playNotification } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Flame, Bike, CheckCircle2, ChevronRight, MapPin,
  TrendingUp, ShoppingBag, Wallet,
} from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { pedidoTemSetor } from "@/lib/pedido-status";
import { formatCurrency, getRelativeTime, isSameBrasiliaDay } from "@/lib/utils";
import type { Pedido, OrderStatus, SetorOrderStatus } from "@/types";
import { STATUS_LABELS, STATUS_NEXT } from "@/types";
import toast from "react-hot-toast";

/* Status column config */
const COLUNAS: {
  status: OrderStatus;
  label: string;
  icon: React.ElementType;
  accent: string;
  badge: string;
  dotColor: string;
}[] = [
  {
    status: "novo",
    label: "Novos",
    icon: Clock,
    accent: "#3B82F6",
    badge: "status-novo",
    dotColor: "bg-blue-500",
  },
  {
    status: "em_preparo",
    label: "Em Preparo",
    icon: Flame,
    accent: "#F59E0B",
    badge: "status-preparo",
    dotColor: "bg-amber-500",
  },
  {
    status: "saiu",
    label: "Saiu",
    icon: Bike,
    accent: "#8B5CF6",
    badge: "status-saiu",
    dotColor: "bg-violet-500",
  },
  {
    status: "entregue",
    label: "Entregue",
    icon: CheckCircle2,
    accent: "#10B981",
    badge: "status-entregue",
    dotColor: "bg-emerald-500",
  },
];

export default function Dashboard() {
  const prevCountRef = useRef(0);

  const { data: todosPedidos } = useCollection<Pedido>("pedidos", [
    orderBy("criadoEm", "desc"),
  ]);

  const ATIVOS = new Set(["novo", "em_preparo", "saiu", "entregue"]);
  const pedidos = todosPedidos.filter((p) => ATIVOS.has(p.status));
  const novos   = pedidos.filter((p) => p.status === "novo").length;

  useEffect(() => {
    if (novos > prevCountRef.current) playNotification();
    prevCountRef.current = novos;
  }, [novos]);

  // Stats include ALL today's orders (including paid), excluding only cancelled
  const hoje = todosPedidos.filter(
    (p) => p.criadoEm && isSameBrasiliaDay(p.criadoEm.toDate()) && p.status !== "cancelado"
  );
  const totalHoje   = hoje.reduce((s, p) => s + p.total, 0);
  const pedidosHoje = hoje.length;

  const SETOR_STATUS_FOR: Partial<Record<OrderStatus, SetorOrderStatus>> = {
    em_preparo: "em_preparo",
    saiu: "pronto",
    entregue: "entregue",
  };

  const avancarStatus = async (pedido: Pedido) => {
    const proximo = STATUS_NEXT[pedido.status];
    if (!proximo) return;

    const novoSetorStatus = SETOR_STATUS_FOR[proximo];
    const update: Record<string, unknown> = { status: proximo, atualizadoEm: serverTimestamp() };
    if (novoSetorStatus) {
      if (pedidoTemSetor(pedido, "cozinha")) update.cozinhaStatus = novoSetorStatus;
      if (pedidoTemSetor(pedido, "bar"))     update.barStatus     = novoSetorStatus;
    }

    await updateDoc(doc(db, "pedidos", pedido.id), update);
    toast.success(`Pedido #${pedido.id.slice(-4).toUpperCase()} → ${STATUS_LABELS[proximo]}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Page header ─────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-semibold text-forest-900 dark:text-forest-50">Dashboard</h1>
        <p className="text-forest-500 dark:text-forest-300 text-sm mt-0.5">
          Acompanhe os pedidos em tempo real
        </p>
      </div>

      {/* ── Stats ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={ShoppingBag}
          label="Pedidos hoje"
          value={String(pedidosHoje)}
          iconBg="#EFF6FF"
          iconColor="#3B82F6"
        />
        <StatCard
          icon={Wallet}
          label="Faturamento hoje"
          value={formatCurrency(totalHoje)}
          iconBg="#F0FDF4"
          iconColor="#10B981"
        />
        <StatCard
          icon={TrendingUp}
          label="Em andamento"
          value={String(pedidos.length)}
          iconBg="#FFF7ED"
          iconColor="#F59E0B"
        />
      </div>

      {/* ── Kanban ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUNAS.map(({ status, label, icon: Icon, accent, badge, dotColor }) => {
          const col = pedidos.filter((p) => p.status === status);
          return (
            <div
              key={status}
              className="bg-white dark:bg-forest-800 rounded-2xl border border-forest-200 dark:border-forest-700 overflow-hidden flex flex-col shadow-card dark:shadow-none"
            >
              {/* Column header */}
              <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-forest-200 dark:border-forest-700">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: `${accent}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                </div>
                <span className="font-semibold text-sm text-forest-800 dark:text-forest-100 flex-1">{label}</span>
                {col.length > 0 && (
                  <span className={`badge ${badge}`}>{col.length}</span>
                )}
              </div>

              {/* Cards area */}
              <div className="flex-1 p-3 space-y-2.5 min-h-[220px]">
                <AnimatePresence mode="popLayout">
                  {col.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full py-10 gap-2"
                    >
                      <div className="w-8 h-8 rounded-full bg-forest-100 dark:bg-forest-700 flex items-center justify-center">
                        <Icon className="w-4 h-4 text-forest-400 dark:text-forest-300" />
                      </div>
                      <p className="text-forest-400 dark:text-forest-300 text-xs font-medium">Nenhum pedido</p>
                    </motion.div>
                  ) : (
                    col.map((pedido) => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        accent={accent}
                        dotColor={dotColor}
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

/* ── StatCard ───────────────────────────────────────────── */
function StatCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="bg-white dark:bg-forest-800 rounded-2xl border border-forest-200 dark:border-forest-700 p-5 shadow-card dark:shadow-none">
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 dark:ring-1 dark:ring-white/10"
          style={{ background: iconBg }}
        >
          <Icon className="w-5 h-5" style={{ color: iconColor }} />
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-forest-900 dark:text-forest-50 tracking-tight">{value}</p>
        <p className="text-forest-500 dark:text-forest-300 text-sm mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/* ── PedidoCard ─────────────────────────────────────────── */
function PedidoCard({
  pedido,
  accent,
  dotColor,
  onAvancar,
}: {
  pedido: Pedido;
  accent: string;
  dotColor: string;
  onAvancar: () => void;
}) {
  const proximo = STATUS_NEXT[pedido.status];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className="bg-white dark:bg-forest-900 rounded-xl border border-forest-200 dark:border-forest-600 overflow-hidden shadow-sm dark:shadow-none"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="p-3 space-y-2">
        {/* Header */}
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 text-forest-400 dark:text-forest-300 shrink-0" />
            <span className="text-forest-900 dark:text-forest-50 font-semibold text-xs truncate">
              {pedido.piqueNome}
            </span>
          </div>
          <span className="text-forest-400 dark:text-forest-300 text-[10px] shrink-0">
            {pedido.criadoEm ? getRelativeTime(pedido.criadoEm.toDate()) : "--"}
          </span>
        </div>

        {/* Items */}
        <div className="space-y-0.5">
          {pedido.itens.slice(0, 3).map((item, i) => (
            <p key={i} className="text-forest-600 dark:text-forest-200 text-[11px] truncate">
              <span className="font-medium text-forest-700 dark:text-forest-100">{item.quantidade}×</span>{" "}
              {item.nome}
            </p>
          ))}
          {pedido.itens.length > 3 && (
            <p className="text-forest-400 dark:text-forest-300 text-[11px]">
              +{pedido.itens.length - 3} item{pedido.itens.length - 3 > 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1.5 border-t border-forest-100 dark:border-forest-700">
          <span className="font-bold text-xs text-forest-900 dark:text-forest-50">
            {formatCurrency(pedido.total)}
          </span>
          <span className="text-[10px] text-forest-400 dark:text-forest-300 font-mono">
            #{pedido.id.slice(-5).toUpperCase()}
          </span>
        </div>
      </div>

      {/* Action */}
      {proximo && (
        <button
          onClick={onAvancar}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors border-t border-forest-100 dark:border-forest-700 hover:opacity-90"
          style={{ background: `${accent}12`, color: accent }}
        >
          {STATUS_LABELS[proximo]}
          <ChevronRight className="w-3 h-3" />
        </button>
      )}
    </motion.div>
  );
}
