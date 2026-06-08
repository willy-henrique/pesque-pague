"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useModoAtendenteAuth } from "@/hooks/useModoAtendenteAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, Plus, Clock, Flame, Bike, CheckCircle2, Wallet, XCircle,
  ChevronRight, ChevronLeft, Receipt, AlertCircle, Banknote,
} from "lucide-react";
import {
  collection, query, where, onSnapshot,
  doc, getDoc, serverTimestamp, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { withModoAtendente } from "@/lib/atendente";
import { getComandaDisplayId } from "@/lib/comanda";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { buildPedidoStatusAfterSetorUpdate, getSetoresProntos, getStatusGeralPedido } from "@/lib/pedido-status";
import { canCancelOrder, formatCurrency, formatTime, isBeforeBrasiliaDay } from "@/lib/utils";
import type { Pedido, OrderStatus, SetorPedido } from "@/types";
import { STATUS_LABELS } from "@/types";
import toast from "react-hot-toast";

const STATUS_ICON: Record<OrderStatus, React.ElementType> = {
  novo:       Clock,
  em_preparo: Flame,
  saiu:       Bike,
  entregue:   CheckCircle2,
  pago:       Wallet,
  cancelado:  XCircle,
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  novo:       "status-novo",
  em_preparo: "status-preparo",
  saiu:       "status-saiu",
  entregue:   "status-entregue",
  pago:       "status-pago",
  cancelado:  "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function ComandaDoDia() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { modoAtendente } = useModoAtendenteAuth();
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [piqueNome, setPiqueNome]   = useState<string>("");
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [loading, setLoading]       = useState(true);
  const [abertos, setAbertos]       = useState<Set<string>>(new Set());
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);

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
          .filter((p) => p.status !== "pago" && p.status !== "cancelado")
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
  const comandaId = getComandaDisplayId(id, pedidos);
  const pedidoMaisRecente = pedidos[0] ?? null;
  const podeAdicionarPedidoAtendente = !modoAtendente || (!!pedidoMaisRecente?.nomeCliente && !!pedidoMaisRecente?.telefoneCliente);
  const cardapioHref = (() => {
    if (!modoAtendente) return `/pique/${id}/cardapio`;
    const params = new URLSearchParams({ modo: "atendente" });
    if (pedidoMaisRecente?.nomeCliente) params.set("clienteNome", pedidoMaisRecente.nomeCliente);
    if (pedidoMaisRecente?.telefoneCliente) params.set("clienteTelefone", pedidoMaisRecente.telefoneCliente);
    return `/pique/${id}/cardapio?${params.toString()}`;
  })();
  const todosEntregues = pedidos.length > 0 && pedidos.every(
    (p) => getStatusGeralPedido(p) === "entregue"
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

  const cancelarPedido = async (pedido: Pedido) => {
    if (!pedido.criadoEm) return;
    if (getStatusGeralPedido(pedido) !== "novo") return;
    if (!canCancelOrder(pedido.criadoEm.toDate())) {
      toast.error("Prazo de cancelamento expirado (4 minutos).");
      return;
    }

    setCancelandoId(pedido.id);
    try {
      await updateDoc(doc(db, "pedidos", pedido.id), {
        status: "cancelado",
        atualizadoEm: serverTimestamp(),
      });
      toast.success("Pedido cancelado.");
    } catch {
      toast.error("Não foi possível cancelar o pedido.");
    } finally {
      setCancelandoId(null);
    }
  };

  const confirmarEntrega = async (pedido: Pedido, setores: SetorPedido[]) => {
    try {
      const updates = setores.reduce<Record<string, unknown>>((acc, setor) => {
        const next = buildPedidoStatusAfterSetorUpdate(
          { ...pedido, ...acc } as Pedido,
          setor,
          "entregue"
        );
        return { ...acc, ...next };
      }, {});

      await updateDoc(doc(db, "pedidos", pedido.id), {
        ...updates,
        atualizadoEm: serverTimestamp(),
      });

      toast.success(`Entrega confirmada em ${pedido.piqueNome}.`);
    } catch {
      toast.error("Nao foi possivel confirmar a entrega.");
    }
  };

  const confirmarPagamento = () => {
    if (pedidos.length === 0) return;
    confirm({
      title: "Confirmar pagamento?",
      description: `Registrar pagamento de ${formatCurrency(totalGeral)} em ${piqueNome} e fechar a comanda? A mesa será liberada.`,
      confirmLabel: "Confirmar pagamento",
      variant: "default",
      onConfirm: async () => {
        setConfirmandoPagamento(true);
        try {
          await Promise.all([
            ...pedidos.map((p) =>
              updateDoc(doc(db, "pedidos", p.id), {
                status: "pago",
                atualizadoEm: serverTimestamp(),
              })
            ),
            updateDoc(doc(db, "piques", id), { status: "livre" }),
          ]);
          toast.success("Pagamento confirmado. Comanda fechada.");
          router.push("/atendente");
        } catch {
          toast.error("Não foi possível confirmar o pagamento. Tente no caixa do ERP.");
        } finally {
          setConfirmandoPagamento(false);
        }
      },
    });
  };

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 70%)" }}
    >
      {/* Header */}
      <header className="glass border-b border-forest-200/80 sticky top-0 z-40">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center gap-2">
          {modoAtendente ? (
            <button
              type="button"
              onClick={() => router.push("/atendente")}
              className="btn-ghost p-2 rounded-xl shrink-0"
              aria-label="Voltar para mesas"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-forest-700 flex items-center justify-center shrink-0">
              <Fish className="w-5 h-5 text-gold-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-forest-500 text-xs">
              {modoAtendente ? "Atendente · Comanda" : "Comanda aberta"}
            </p>
            <h1 className="font-bold text-forest-900 truncate text-base">
              {piqueNome || "Carregando..."}
            </h1>
          </div>
          {comandaId && (
            <div className="px-2.5 py-1 rounded-lg border border-gold-500/25 bg-gold-500/10 text-[11px] font-semibold text-gold-600 whitespace-nowrap">
              #{comandaId}
            </div>
          )}
          <button
            type="button"
            onClick={() => router.push(cardapioHref)}
            className="btn-gold px-3 py-2 rounded-xl text-sm shrink-0"
            disabled={modoAtendente && !podeAdicionarPedidoAtendente}
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
            <p className="text-forest-900 font-semibold">Tudo entregue!</p>
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
              <p className="text-forest-800 font-semibold">
                {modoAtendente ? "Sem pedidos em aberto" : "Comanda fechada"}
              </p>
              <p className="text-forest-500 text-sm mt-1">
                {modoAtendente
                  ? "Lance um pedido ou volte para escolher outra mesa."
                  : "Não há pedidos aguardando pagamento."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
              {modoAtendente && (
                <button
                  type="button"
                  onClick={() => router.push("/atendente")}
                  className="btn-ghost px-6 py-3 rounded-2xl w-full border border-forest-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>
              )}
              <button
                type="button"
                onClick={() => router.push(podeAdicionarPedidoAtendente ? cardapioHref : "/atendente")}
                className="btn-gold px-6 py-3 rounded-2xl w-full"
              >
                <Fish className="w-4 h-4" />
                {modoAtendente && !podeAdicionarPedidoAtendente ? "Identificar cliente" : "Novo pedido"}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <p className="text-forest-600 text-xs uppercase tracking-widest font-semibold px-1">
              Pedidos em aberto
            </p>
            <AnimatePresence mode="popLayout">
              {pedidos.map((pedido, i) => {
                const statusAtual = getStatusGeralPedido(pedido);
                const Icon  = STATUS_ICON[statusAtual];
                const open  = abertos.has(pedido.id);
                const setoresProntos = getSetoresProntos(pedido);
                const podeCancelar =
                  statusAtual === "novo" &&
                  !!pedido.criadoEm &&
                  canCancelOrder(pedido.criadoEm.toDate());

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
                          statusAtual === "novo"
                            ? "bg-gold-500/15 border border-gold-500/30"
                            : "bg-forest-800"
                        }`}>
                          <Icon className={`w-4 h-4 ${
                            statusAtual === "novo" ? "text-gold-500" :
                            statusAtual === "em_preparo" ? "text-water-300" :
                            statusAtual === "saiu" ? "text-bark-300" :
                            "text-forest-400"
                          }`} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-forest-900 font-semibold text-sm">
                              #{pedido.id.slice(-4).toUpperCase()}
                            </span>
                            <span className={`badge ${STATUS_CLASS[statusAtual]}`}>
                              {STATUS_LABELS[statusAtual]}
                            </span>
                          </div>
                          <p className="text-forest-500 text-xs mt-0.5">
                            {pedido.itens.length} {pedido.itens.length === 1 ? "item" : "itens"}
                            {pedido.criadoEm && ` · ${formatTime(pedido.criadoEm.toDate())}`}
                          </p>
                          {setoresProntos.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {setoresProntos.map((setor) => (
                                <span key={setor} className="badge status-entregue text-[11px]">
                                  {setor === "cozinha" ? "Comida pronta" : "Bebida pronta"}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="gradient-gold-text font-bold text-sm shrink-0">
                          {formatCurrency(pedido.total)}
                        </p>

                        <ChevronRight
                          className={`w-3.5 h-3.5 text-forest-600 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                        />
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {podeCancelar && (
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              cancelarPedido(pedido);
                            }}
                            disabled={cancelandoId === pedido.id}
                            className="btn-ghost px-2.5 py-2 rounded-lg text-xs text-red-500 border border-red-500/20 disabled:opacity-60"
                            title="Cancelar pedido (até 4 minutos)"
                          >
                            {cancelandoId === pedido.id ? "..." : "Cancelar"}
                          </button>
                        )}
                        <button
                          onClick={() => router.push(`/pedido/${pedido.id}`)}
                          className="btn-ghost p-2 rounded-lg shrink-0 border border-white/[0.06]"
                          title="Acompanhar pedido"
                        >
                          <Receipt className="w-4 h-4 text-gold-500" />
                        </button>
                      </div>
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
                                  <span className="text-forest-800 text-sm">{item.nome}</span>
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
                            {modoAtendente && setoresProntos.length > 0 && (
                              <div className="px-4 py-3 flex flex-col gap-2 bg-emerald-500/5">
                                <p className="text-xs font-semibold text-emerald-700">
                                  Pronto para retirar e levar para a mesa
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {setoresProntos.map((setor) => (
                                    <button
                                      key={setor}
                                      type="button"
                                      onClick={() => confirmarEntrega(pedido, [setor])}
                                      className="btn-ghost px-3 py-2 rounded-xl text-xs border border-emerald-500/25 text-emerald-700"
                                    >
                                      Confirmar entrega {setor === "cozinha" ? "da comida" : "da bebida"}
                                    </button>
                                  ))}
                                  {setoresProntos.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => confirmarEntrega(pedido, setoresProntos)}
                                      className="btn-gold px-3 py-2 rounded-xl text-xs"
                                    >
                                      Entregar tudo
                                    </button>
                                  )}
                                </div>
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

      {/* Rodapé fixo */}
      {!loading && pedidos.length > 0 && (
        <div className="sticky bottom-0 p-4 max-w-xl mx-auto w-full pb-[max(1rem,env(safe-area-inset-bottom))]">
          {modoAtendente ? (
            <div className="glass rounded-2xl p-2 space-y-2 border border-forest-200">
              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-forest-500 text-xs">Total a receber</span>
                <span className="font-bold text-lg text-gold-700">{formatCurrency(totalGeral)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/atendente")}
                  className="btn-ghost py-3 rounded-xl text-sm border border-forest-200"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Voltar
                </button>
                <button
                  type="button"
                  onClick={confirmarPagamento}
                  disabled={confirmandoPagamento}
                  className="btn-gold py-3 rounded-xl text-sm disabled:opacity-60"
                >
                  <Banknote className="w-4 h-4" />
                  {confirmandoPagamento ? "..." : "Confirmar pagamento"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => router.push(podeAdicionarPedidoAtendente ? cardapioHref : "/atendente")}
                className="w-full py-2.5 rounded-xl text-sm text-forest-600 hover:text-forest-900 transition-colors"
              >
                <Plus className="w-4 h-4 inline mr-1" />
                {modoAtendente && !podeAdicionarPedidoAtendente ? "Identificar cliente para novo pedido" : "Adicionar itens"}
              </button>
            </div>
          ) : (
            <div className="glass rounded-2xl p-1">
              <button
                type="button"
                onClick={() => router.push(cardapioHref)}
                className="btn-gold w-full py-3.5 rounded-xl text-base"
              >
                <Plus className="w-5 h-5" />
                Adicionar mais itens
                <span className="ml-auto text-sm opacity-70">
                  Total: {formatCurrency(totalGeral)}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {ConfirmDialog}
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
