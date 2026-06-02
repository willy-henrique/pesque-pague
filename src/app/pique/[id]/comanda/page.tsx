"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, Plus, Clock, Flame, Bike, CheckCircle2, Wallet,
  ChevronRight, Receipt, AlertCircle,
} from "lucide-react";
import {
  collection, query, where, onSnapshot,
  doc, getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { formatCurrency, formatTime, isBeforeBrasiliaDay } from "@/lib/utils";
import type { Pedido, OrderStatus } from "@/types";
import { STATUS_LABELS } from "@/types";

const STATUS_ICON: Record<OrderStatus, React.ElementType> = {
  novo:       Clock,
  em_preparo: Flame,
  saiu:       Bike,
  entregue:   CheckCircle2,
  pago:       Wallet,
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  novo:       "status-novo",
  em_preparo: "status-preparo",
  saiu:       "status-saiu",
  entregue:   "status-entregue",
  pago:       "status-pago",
};

export default function ComandaDoDia() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [piqueNome, setPiqueNome]   = useState<string>("");
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [abertos, setAbertos]       = useState<Set<string>>(new Set());

  // Carrega nome da mesa
  useEffect(() => {
    getDoc(doc(db, "piques", id)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPiqueNome(d.nome || `Mesa ${d.numero}`);
      }
    });
  }, [id]);

  // Escuta a comanda aberta. Ela só fecha quando o admin confirma pagamento.
  useEffect(() => {
    // Sem orderBy: evita índice composto no Firestore — ordena client-side
    const q = query(
      collection(db, "pedidos"),
      where("piqueId", "==", id)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Pedido));
        const abertos = todos
          .filter((p) => p.status !== "pago")
          .sort((a, b) => b.criadoEm.toDate().getTime() - a.criadoEm.toDate().getTime());
        setPedidos(abertos);
        setLoading(false);
      },
      () => {
        // Regras de segurança bloqueando ou sem conexão — mostra vazio
        setLoading(false);
      }
    );

    return unsub;
  }, [id]);

  const totalGeral = pedidos.reduce((s, p) => s + p.total, 0);
  const todosEntregues = pedidos.length > 0 && pedidos.every(
    (p) => p.status === "entregue"
  );
  const temComandaVirada = pedidos.some((p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate()));

  const toggleAberto = (pedidoId: string) => {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(pedidoId)) next.delete(pedidoId);
      else next.add(pedidoId);
      return next;
    });
  };

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "radial-gradient(ellipse at top, #142b1e 0%, #061208 70%)" }}
    >
      {/* Header */}
      <header className="glass border-b border-white/[0.06] sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-700 flex items-center justify-center shrink-0">
            <Fish className="w-5 h-5 text-gold-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-forest-400 text-xs">Comanda aberta</p>
            <h1 className="font-display font-bold text-gold-400 truncate">
              {piqueNome || "Carregando..."}
            </h1>
          </div>
          <button
            onClick={() => router.push(`/pique/${id}/cardapio`)}
            className="btn-gold px-3 py-2 rounded-xl text-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Pedido
          </button>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-xl mx-auto w-full px-4 py-5 gap-4">

        {/* Resumo total */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass rounded-2xl p-5 flex items-center gap-4 ${
            todosEntregues ? "border border-gold-500/20" : ""
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-forest-800 flex items-center justify-center shrink-0">
            <Receipt className="w-6 h-6 text-gold-500" />
          </div>
          <div className="flex-1">
            <p className="text-forest-400 text-xs mb-0.5">Total da comanda</p>
            <p className="font-display font-bold text-3xl gradient-gold-text leading-none">
              {formatCurrency(totalGeral)}
            </p>
            <p className="text-forest-500 text-xs mt-1">
              {pedidos.length} {pedidos.length === 1 ? "pedido em aberto" : "pedidos em aberto"}
            </p>
          </div>
        </motion.div>

        {temComandaVirada && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl px-5 py-4 border border-gold-500/20 flex gap-3"
          >
            <AlertCircle className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-gold-400 font-semibold text-sm">Comanda aberta do dia anterior</p>
              <p className="text-forest-400 text-xs mt-1">
                Ela continuará aparecendo até o pagamento ser confirmado no caixa.
              </p>
            </div>
          </motion.div>
        )}

        {/* Aviso pagamento */}
        {todosEntregues && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass rounded-2xl px-5 py-4 text-center border border-gold-500/20"
            style={{ animation: "pulseGold 2s ease-in-out infinite" }}
          >
            <Wallet className="w-7 h-7 text-gold-500 mx-auto mb-2" />
            <p className="text-forest-100 font-semibold">Tudo entregue!</p>
            <p className="text-forest-400 text-sm mt-0.5">
              Dirija-se ao caixa para pagar{" "}
              <span className="gradient-gold-text font-bold">{formatCurrency(totalGeral)}</span>
            </p>
          </motion.div>
        )}

        {/* Lista de pedidos */}
        {loading ? (
          <ComandaSkeleton />
        ) : pedidos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center flex-1"
          >
            <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center">
              <Receipt className="w-7 h-7 text-forest-600" />
            </div>
            <div>
              <p className="text-forest-200 font-semibold">Comanda fechada</p>
              <p className="text-forest-500 text-sm mt-1">Não há pedidos aguardando pagamento.</p>
            </div>
            <button
              onClick={() => router.push(`/pique/${id}/cardapio`)}
              className="btn-gold px-6 py-3 rounded-2xl"
            >
              <Fish className="w-4 h-4" />
              Ver Cardápio
            </button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-forest-600 text-xs uppercase tracking-widest font-semibold px-1">
              Pedidos em aberto
            </p>
            <AnimatePresence mode="popLayout">
              {pedidos.map((pedido, i) => {
                const Icon  = STATUS_ICON[pedido.status];
                const open  = abertos.has(pedido.id);

                return (
                  <motion.div
                    key={pedido.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="glass rounded-2xl overflow-hidden"
                  >
                    {/* Pedido header */}
                    <div className="flex items-center gap-2 px-4 py-3.5">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleAberto(pedido.id)}
                        className="flex items-center gap-3 flex-1 text-left min-w-0"
                      >
                        {/* Ícone de status */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          pedido.status === "novo"
                            ? "bg-gold-500/15 border border-gold-500/30"
                            : "bg-forest-800"
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            pedido.status === "novo" ? "text-gold-500" :
                            pedido.status === "em_preparo" ? "text-water-300" :
                            pedido.status === "saiu" ? "text-bark-300" :
                            "text-forest-400"
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-forest-100 font-semibold text-sm">
                              #{pedido.id.slice(-4).toUpperCase()}
                            </span>
                            <span className={`badge ${STATUS_CLASS[pedido.status]}`}>
                              {STATUS_LABELS[pedido.status]}
                            </span>
                          </div>
                          <p className="text-forest-500 text-xs mt-0.5">
                            {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
                            {pedido.criadoEm && ` · ${formatTime(pedido.criadoEm.toDate())}`}
                          </p>
                        </div>

                        <p className="gradient-gold-text font-bold text-sm shrink-0">
                          {formatCurrency(pedido.total)}
                        </p>

                        <ChevronRight
                          className={`w-3.5 h-3.5 text-forest-600 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                        />
                      </button>

                      {/* Link rastreamento */}
                      <button
                        onClick={() => router.push(`/pedido/${pedido.id}`)}
                        className="btn-ghost p-2 rounded-lg shrink-0 border border-white/[0.06]"
                        title="Acompanhar pedido"
                      >
                        <Receipt className="w-4 h-4 text-gold-500" />
                      </button>
                    </div>

                    {/* Itens expandidos */}
                    <AnimatePresence>
                      {open && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-white/[0.05] divide-y divide-white/[0.04]">
                            {pedido.itens.map((item, j) => (
                              <div key={j} className="flex items-center gap-2 px-4 py-2">
                                <span className="text-gold-600 font-bold text-xs w-6">
                                  {item.quantidade}×
                                </span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-forest-200 text-sm">{item.nome}</span>
                                  {item.obs && (
                                    <p className="text-forest-600 text-xs italic">{item.obs}</p>
                                  )}
                                </div>
                                <span className="text-forest-400 text-xs shrink-0">
                                  {formatCurrency(item.preco * item.quantidade)}
                                </span>
                              </div>
                            ))}
                            {pedido.observacaoGeral && (
                              <div className="px-4 py-2">
                                <p className="text-forest-600 text-xs italic">
                                  Obs: {pedido.observacaoGeral}
                                </p>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Botão novo pedido fixo */}
      {!loading && pedidos.length > 0 && (
        <div className="sticky bottom-0 p-4 max-w-xl mx-auto w-full">
          <div className="glass rounded-2xl p-1">
            <button
              onClick={() => router.push(`/pique/${id}/cardapio`)}
              className="btn-gold w-full py-3.5 rounded-xl text-base"
            >
              <Plus className="w-5 h-5" />
              Adicionar mais itens
              <span className="ml-auto text-sm opacity-70">
                Total: {formatCurrency(totalGeral)}
              </span>
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function ComandaSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="skeleton-pulse w-9 h-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-pulse h-4 w-36 rounded" />
            <div className="skeleton-pulse h-3 w-24 rounded" />
          </div>
          <div className="skeleton-pulse h-5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
