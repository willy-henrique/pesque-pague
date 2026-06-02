"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, Fish, CheckCircle2, ChevronDown,
  AlertCircle, X, TrendingUp, ShoppingBag, ReceiptText,
  LockKeyhole,
} from "lucide-react";
import {
  doc, updateDoc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import {
  formatCurrency,
  formatTime,
  getBrasiliaDateKey,
  isBeforeBrasiliaDay,
  isSameBrasiliaDay,
} from "@/lib/utils";
import type { Pedido, FechamentoCaixa } from "@/types";
import toast from "react-hot-toast";

interface PiqueGroup {
  piqueId: string;
  piqueNome: string;
  pedidos: Pedido[];
  total: number;
}

function groupByPique(pedidos: Pedido[]): PiqueGroup[] {
  const map = new Map<string, PiqueGroup>();
  for (const p of pedidos) {
    const g = map.get(p.piqueId);
    if (g) { g.pedidos.push(p); g.total += p.total; }
    else map.set(p.piqueId, { piqueId: p.piqueId, piqueNome: p.piqueNome, pedidos: [p], total: p.total });
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export default function Caixa() {
  const { data: todos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "desc")]);
  const { data: fechamentos } = useCollection<FechamentoCaixa>("fechamentos", [orderBy("criadoEm", "desc")]);

  const [confirmPique, setConfirmPique]     = useState<PiqueGroup | null>(null);
  const [fechandoCaixa, setFechandoCaixa]   = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [pagoExpandido, setPagoExpandido]   = useState(false);
  const [recebendo, setRecebendo]           = useState<string | null>(null);

  const hoje = useMemo(() => {
    return todos.filter((p) => {
      if (!p.criadoEm) return false;
      return isSameBrasiliaDay(p.criadoEm.toDate());
    });
  }, [todos]);

  const pendentes    = useMemo(() => todos.filter((p) => p.status === "entregue"), [todos]);
  const pagos        = useMemo(() => hoje.filter((p) => p.status === "pago"),     [hoje]);
  const emAndamento  = useMemo(() =>
    todos.filter((p) => ["novo", "em_preparo", "saiu"].includes(p.status)), [todos]);

  const piquesPendentes = useMemo(() => groupByPique(pendentes), [pendentes]);
  const piquesPagos     = useMemo(() => groupByPique(pagos),     [pagos]);

  const totalPendente   = pendentes.reduce((s, p) => s + p.total, 0);
  const totalRecebido   = pagos.reduce((s, p) => s + p.total, 0);
  const ticketMedio     = pagos.length ? totalRecebido / pagos.length : 0;
  const pendentesVirados = pendentes.filter((p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate())).length;

  const fechamentoHoje = fechamentos.find((f) => f.data === getBrasiliaDateKey());

  const receberPique = async (grupo: PiqueGroup) => {
    setRecebendo(grupo.piqueId);
    try {
      await Promise.all(
        [
          ...grupo.pedidos.map((p) =>
            updateDoc(doc(db, "pedidos", p.id), {
              status: "pago",
              atualizadoEm: serverTimestamp(),
            })
          ),
          updateDoc(doc(db, "piques", grupo.piqueId), { status: "livre" }),
        ]
      );
      toast.success(`${grupo.piqueNome} — pagamento registrado!`);
      setConfirmPique(null);
    } catch {
      toast.error("Erro ao registrar pagamento.");
    } finally {
      setRecebendo(null);
    }
  };

  const fecharCaixa = async (marcarPendentesComoPagos: boolean) => {
    setFechandoCaixa(true);
    try {
      if (marcarPendentesComoPagos && pendentes.length > 0) {
        await Promise.all(
          [
            ...pendentes.map((p) =>
              updateDoc(doc(db, "pedidos", p.id), {
                status: "pago",
                atualizadoEm: serverTimestamp(),
              })
            ),
            ...piquesPendentes.map((grupo) =>
              updateDoc(doc(db, "piques", grupo.piqueId), { status: "livre" })
            ),
          ]
        );
      }

      const totalFinal = marcarPendentesComoPagos
        ? totalRecebido + totalPendente
        : totalRecebido;

      await addDoc(collection(db, "fechamentos"), {
        data:            getBrasiliaDateKey(),
        totalRecebido:   totalFinal,
        totalPendente:   marcarPendentesComoPagos ? 0 : totalPendente,
        totalPedidos:    hoje.length,
        ticketMedio:     hoje.length ? totalFinal / hoje.length : 0,
        piquesFechados:  piquesPagos.length + (marcarPendentesComoPagos ? piquesPendentes.length : 0),
        criadoEm:        serverTimestamp(),
      });

      toast.success("Caixa fechado com sucesso!");
      setModalFechamento(false);
    } catch {
      toast.error("Erro ao fechar o caixa.");
    } finally {
      setFechandoCaixa(false);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Caixa</h1>
          <p className="text-forest-500 text-sm">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>
        {!fechamentoHoje && (
          <button
            onClick={() => setModalFechamento(true)}
            className="btn-ghost ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm hover:border-gold-500/30"
          >
            <LockKeyhole className="w-4 h-4" />
            Fechar Caixa
          </button>
        )}
        {fechamentoHoje && (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl glass border border-forest-500/20 text-sm text-forest-400">
            <CheckCircle2 className="w-4 h-4 text-forest-500" />
            Caixa fechado hoje
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={AlertCircle} label="A receber" value={formatCurrency(totalPendente)} color="text-gold-500" />
        <StatCard icon={Banknote}    label="Recebido"  value={formatCurrency(totalRecebido)} color="text-forest-300" />
        <StatCard icon={TrendingUp}  label="Ticket médio" value={formatCurrency(ticketMedio)} color="text-water-300" />
        <StatCard icon={ShoppingBag} label="Em andamento" value={String(emAndamento.length)} color="text-bark-300" />
      </div>

      {/* Pendentes de pagamento */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
          <h2 className="font-display font-semibold text-forest-900">
            Aguardando pagamento
          </h2>
          {piquesPendentes.length > 0 && (
            <span className="badge status-novo text-[10px]">{piquesPendentes.length}</span>
          )}
        </div>

        {pendentesVirados > 0 && (
          <div className="glass rounded-2xl px-4 py-3 border border-gold-500/20 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" />
            <p className="text-forest-300 text-xs leading-relaxed">
              {pendentesVirados} pedido{pendentesVirados > 1 ? "s" : ""} entregue{pendentesVirados > 1 ? "s" : ""} virou{pendentesVirados > 1 ? "aram" : ""} o dia sem pagamento confirmado.
            </p>
          </div>
        )}

        {piquesPendentes.length === 0 ? (
          <div className="glass rounded-2xl flex items-center gap-4 px-5 py-6">
            <CheckCircle2 className="w-8 h-8 text-forest-600 shrink-0" />
            <div>
              <p className="text-forest-300 font-medium text-sm">Tudo em dia!</p>
              <p className="text-forest-600 text-xs">Nenhuma mesa aguardando pagamento agora.</p>
            </div>
          </div>
        ) : (
          piquesPendentes.map((grupo) => {
            const confirmando = confirmPique?.piqueId === grupo.piqueId;
            return (
              <motion.div
                key={grupo.piqueId}
                layout
                className="glass rounded-2xl overflow-hidden border border-gold-500/10"
              >
                {/* Card header */}
                <div className="flex items-center gap-3 px-4 py-4">
                  <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center shrink-0">
                    <Fish className="w-5 h-5 text-gold-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-forest-900 text-sm">{grupo.piqueNome}</p>
                    <p className="text-forest-500 text-xs">
                      {grupo.pedidos.length} {grupo.pedidos.length === 1 ? "pedido entregue" : "pedidos entregues"}
                    </p>
                  </div>
                  <p className="gradient-gold-text font-bold text-lg font-display shrink-0">
                    {formatCurrency(grupo.total)}
                  </p>
                  <button
                    onClick={() => setConfirmPique(confirmando ? null : grupo)}
                    className="btn-gold px-3 py-2 rounded-xl text-sm shrink-0 ml-1"
                  >
                    Receber
                  </button>
                </div>

                {/* Confirmação inline */}
                <AnimatePresence>
                  {confirmando && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/[0.06] px-4 py-3 space-y-3 bg-forest-900/40">
                        {/* Itens por pedido */}
                        {grupo.pedidos.map((p) => (
                          <div key={p.id} className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-forest-500">
                              <span>Pedido #{p.id.slice(-4).toUpperCase()}</span>
                              <span>{p.criadoEm ? formatTime(p.criadoEm.toDate()) : ""}</span>
                            </div>
                            {p.itens.map((item, i) => (
                              <div key={i} className="flex justify-between text-xs px-1">
                                <span className="text-forest-300">{item.quantidade}× {item.nome}</span>
                                <span className="text-forest-400">{formatCurrency(item.preco * item.quantidade)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                          <span className="text-forest-300 font-semibold text-sm">Total a cobrar</span>
                          <span className="gradient-gold-text font-bold">{formatCurrency(grupo.total)}</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setConfirmPique(null)}
                            className="btn-ghost flex-1 py-2 rounded-xl text-sm"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => receberPique(grupo)}
                            disabled={recebendo === grupo.piqueId}
                            className="btn-gold flex-1 py-2 rounded-xl text-sm disabled:opacity-60"
                          >
                            {recebendo === grupo.piqueId ? "Registrando..." : `✓ Confirmar ${formatCurrency(grupo.total)}`}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </section>

      {/* Pagos hoje */}
      {piquesPagos.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setPagoExpandido((v) => !v)}
            className="flex items-center gap-2 w-full text-left"
          >
            <div className="w-2 h-2 rounded-full bg-forest-500" />
            <h2 className="font-display font-semibold text-forest-400 text-sm">
              Pagos hoje ({piquesPagos.length})
            </h2>
            <ChevronDown
              className={`w-4 h-4 text-forest-600 ml-1 transition-transform ${pagoExpandido ? "rotate-180" : ""}`}
            />
            <span className="ml-auto text-forest-500 text-sm">{formatCurrency(totalRecebido)}</span>
          </button>

          <AnimatePresence>
            {pagoExpandido && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2"
              >
                {piquesPagos.map((grupo) => (
                  <div key={grupo.piqueId} className="glass rounded-2xl flex items-center gap-3 px-4 py-3 opacity-60">
                    <Fish className="w-4 h-4 text-forest-600 shrink-0" />
                    <p className="flex-1 text-forest-300 text-sm">{grupo.piqueNome}</p>
                    <p className="text-forest-400 text-xs">{grupo.pedidos.length} pedidos</p>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-forest-500" />
                      <span className="text-forest-300 text-sm font-medium">{formatCurrency(grupo.total)}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Histórico de fechamentos recentes */}
      {fechamentos.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-semibold text-forest-400 text-sm flex items-center gap-2">
            <ReceiptText className="w-4 h-4" />
            Fechamentos anteriores
          </h2>
          <div className="glass rounded-2xl overflow-hidden divide-y divide-white/[0.05]">
            {fechamentos.slice(0, 7).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div>
                  <p className="text-forest-700 text-sm font-medium">
                    {new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-forest-600 text-xs">{f.totalPedidos} pedidos · {f.piquesFechados} mesas</p>
                </div>
                <span className="gradient-gold-text font-bold ml-auto">{formatCurrency(f.totalRecebido)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal Fechamento de Caixa */}
      <AnimatePresence>
        {modalFechamento && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModalFechamento(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass rounded-3xl w-full max-w-sm p-6 space-y-5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-forest-800 flex items-center justify-center">
                    <LockKeyhole className="w-5 h-5 text-gold-500" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-forest-900">Fechar Caixa</h2>
                    <p className="text-forest-500 text-xs">
                      {new Date().toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalFechamento(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Resumo do dia */}
              <div className="glass rounded-2xl divide-y divide-white/[0.06]">
                <SummaryRow label="Total recebido"      value={formatCurrency(totalRecebido)}         highlight />
                <SummaryRow label="Pendente de receber" value={formatCurrency(totalPendente)}         warn={totalPendente > 0} />
                <SummaryRow label="Pedidos no dia"      value={String(hoje.length)} />
                <SummaryRow label="Ticket médio"        value={formatCurrency(ticketMedio)} />
                <SummaryRow label="Mesas atendidas"     value={String(piquesPagos.length + piquesPendentes.length)} />
              </div>

              {pendentes.length > 0 && (
                <div className="glass rounded-xl px-4 py-3 border border-gold-500/20 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gold-500 shrink-0 mt-0.5" />
                  <p className="text-forest-300 text-xs leading-relaxed">
                    Há <span className="text-gold-400 font-bold">{piquesPendentes.length} mesa{piquesPendentes.length > 1 ? "s" : ""}</span> com
                    pagamento pendente ({formatCurrency(totalPendente)}). Você pode registrá-los como pagos agora.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {pendentes.length > 0 && (
                  <button
                    onClick={() => fecharCaixa(true)}
                    disabled={fechandoCaixa}
                    className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-60"
                  >
                    {fechandoCaixa ? "Fechando..." : "Marcar pendentes como pagos e fechar"}
                  </button>
                )}
                <button
                  onClick={() => fecharCaixa(false)}
                  disabled={fechandoCaixa}
                  className={`w-full py-3 rounded-xl text-sm disabled:opacity-60 ${
                    pendentes.length > 0 ? "btn-ghost border border-white/10" : "btn-gold"
                  }`}
                >
                  {fechandoCaixa ? "Fechando..." : pendentes.length > 0 ? "Fechar somente com recebidos" : "Confirmar fechamento"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string; color: string;
}) {
  return (
    <div className="glass rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-forest-500 text-xs">{label}</span>
      </div>
      <p className={`font-display font-bold text-lg ${color}`}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, highlight, warn }: {
  label: string; value: string; highlight?: boolean; warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-forest-400 text-sm">{label}</span>
      <span className={`font-semibold text-sm ${
        highlight ? "gradient-gold-text text-base font-bold" :
        warn       ? "text-gold-400" :
        "text-forest-700"
      }`}>{value}</span>
    </div>
  );
}
