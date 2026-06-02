"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart2, TrendingUp, ShoppingBag, Wallet, Fish, Calendar } from "lucide-react";
import { orderBy } from "firebase/firestore";
import { useCollection } from "@/hooks/useFirestore";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Pedido, OrderStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

type Periodo = "hoje" | "semana" | "mes";

export default function Relatorios() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");

  const { data: pedidos } = useCollection<Pedido>("pedidos", [
    orderBy("criadoEm", "desc"),
  ]);

  const filtrado = useMemo(() => {
    const now = new Date();
    return pedidos.filter((p) => {
      if (!p.criadoEm) return false;
      const d = p.criadoEm.toDate();
      if (periodo === "hoje") return d.toDateString() === now.toDateString();
      if (periodo === "semana") {
        const diff = now.getTime() - d.getTime();
        return diff <= 7 * 24 * 60 * 60 * 1000;
      }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [pedidos, periodo]);

  const totalFaturamento = filtrado.reduce((s, p) => s + p.total, 0);
  const totalPedidos     = filtrado.length;
  const ticketMedio      = totalPedidos ? totalFaturamento / totalPedidos : 0;
  const pedidosPagos     = filtrado.filter((p) => p.status === "pago").length;

  const rankingProdutos = useMemo(() => {
    const map = new Map<string, { nome: string; qty: number; total: number }>();
    for (const pedido of filtrado) {
      for (const item of pedido.itens) {
        const existing = map.get(item.produtoId);
        if (existing) {
          existing.qty   += item.quantidade;
          existing.total += item.preco * item.quantidade;
        } else {
          map.set(item.produtoId, { nome: item.nome, qty: item.quantidade, total: item.preco * item.quantidade });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [filtrado]);

  const rankingMesas = useMemo(() => {
    const map = new Map<string, { nome: string; pedidos: number; total: number }>();
    for (const pedido of filtrado) {
      const existing = map.get(pedido.piqueId);
      if (existing) { existing.pedidos++; existing.total += pedido.total; }
      else map.set(pedido.piqueId, { nome: pedido.piqueNome, pedidos: 1, total: pedido.total });
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [filtrado]);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header + período */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Relatórios</h1>
          <p className="text-forest-500 text-sm">Visão geral de vendas</p>
        </div>
        <div className="sm:ml-auto glass rounded-xl p-1 flex gap-1">
          {(["hoje", "semana", "mes"] as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                periodo === p
                  ? "bg-gold-500 text-forest-950"
                  : "text-forest-400 hover:text-forest-200"
              }`}
            >
              {p === "hoje" ? "Hoje" : p === "semana" ? "7 dias" : "Mês"}
            </button>
          ))}
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={Wallet}      label="Faturamento"   value={formatCurrency(totalFaturamento)} color="text-gold-500" />
        <MetricCard icon={ShoppingBag} label="Pedidos"        value={String(totalPedidos)}            color="text-forest-300" />
        <MetricCard icon={TrendingUp}  label="Ticket Médio"  value={formatCurrency(ticketMedio)}      color="text-water-300" />
        <MetricCard icon={Calendar}    label="Pagos"          value={String(pedidosPagos)}            color="text-bark-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking produtos */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-gold-500" />
            <h2 className="font-display font-semibold text-forest-100">Produtos mais vendidos</h2>
          </div>
          <div className="p-4 space-y-3">
            {rankingProdutos.length === 0 ? (
              <p className="text-forest-600 text-sm text-center py-6">Sem dados para este período.</p>
            ) : (
              rankingProdutos.map((item, i) => {
                const maxQty = rankingProdutos[0]?.qty ?? 1;
                return (
                  <motion.div
                    key={item.nome}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-forest-200 font-medium flex items-center gap-1.5">
                        {i === 0 && <span className="text-gold-500">🏆</span>}
                        {item.nome}
                      </span>
                      <div className="flex gap-2 text-forest-500">
                        <span>{item.qty}×</span>
                        <span className="text-gold-600">{formatCurrency(item.total)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-forest-900 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.qty / maxQty) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04 }}
                        className="h-full rounded-full"
                        style={{ background: "linear-gradient(90deg, #2d6a4f, #f4a522)" }}
                      />
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        {/* Ranking mesas */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2">
            <Fish className="w-4 h-4 text-gold-500" />
            <h2 className="font-display font-semibold text-forest-100">Mesas por faturamento</h2>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {rankingMesas.length === 0 ? (
              <p className="text-forest-600 text-sm text-center py-10">Sem dados para este período.</p>
            ) : (
              rankingMesas.map((pique, i) => (
                <motion.div
                  key={pique.nome}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3"
                >
                  <span className="text-forest-600 text-xs w-4">{i + 1}</span>
                  <Fish className="w-3.5 h-3.5 text-forest-600" />
                  <span className="flex-1 text-forest-200 text-sm">{pique.nome}</span>
                  <span className="text-forest-500 text-xs">{pique.pedidos} pedidos</span>
                  <span className="text-gold-500 font-bold text-sm">{formatCurrency(pique.total)}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Últimos pedidos */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="font-display font-semibold text-forest-100">Últimos pedidos</h2>
        </div>
        <div className="divide-y divide-white/[0.05]">
          {filtrado.slice(0, 20).map((pedido) => (
            <div key={pedido.id} className="flex items-center gap-3 px-5 py-3">
              <Fish className="w-4 h-4 text-forest-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-forest-100 text-sm font-medium truncate">{pedido.piqueNome}</p>
                <p className="text-forest-600 text-xs">
                  {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
                  {pedido.criadoEm && ` • ${formatDate(pedido.criadoEm.toDate())}`}
                </p>
              </div>
              <span className={`badge ${getStatusBadge(pedido.status)}`}>
                {STATUS_LABELS[pedido.status]}
              </span>
              <span className="text-gold-500 font-bold text-sm shrink-0">{formatCurrency(pedido.total)}</span>
            </div>
          ))}
          {filtrado.length === 0 && (
            <p className="text-forest-600 text-sm text-center py-10">Sem pedidos neste período.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-forest-500 text-xs">{label}</span>
      </div>
      <p className={`font-display font-bold text-xl ${color}`}>{value}</p>
    </motion.div>
  );
}

function getStatusBadge(status: OrderStatus) {
  const map: Record<OrderStatus, string> = {
    novo: "status-novo", em_preparo: "status-preparo",
    saiu: "status-saiu", entregue: "status-entregue", pago: "status-pago",
  };
  return map[status];
}
