"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, Fish, CheckCircle2, ChevronDown,
  AlertCircle, X, TrendingUp, ShoppingBag, ReceiptText,
  LockKeyhole, Clock, Flame, Bike, MapPin,
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
import {
  groupComandasAbertas,
  groupPedidosByPique,
  isPedidoAberto,
  type ComandaGrupo,
} from "@/lib/comanda";
import type { Pedido, FechamentoCaixa, OrderStatus } from "@/types";
import { STATUS_LABELS } from "@/types";
import toast from "react-hot-toast";

const STATUS_CHIP: Partial<Record<OrderStatus, { icon: React.ElementType; className: string; short: string }>> = {
  novo:       { icon: Clock,  className: "status-novo", short: "Novos" },
  em_preparo: { icon: Flame,  className: "status-preparo", short: "Preparo" },
  saiu:       { icon: Bike,   className: "status-saiu", short: "Saiu" },
  entregue:   { icon: CheckCircle2, className: "status-entregue", short: "Entregue" },
};

export default function Caixa() {
  const { data: todos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "desc")]);
  const { data: fechamentos } = useCollection<FechamentoCaixa>("fechamentos", [orderBy("criadoEm", "desc")]);

  const [confirmPique, setConfirmPique]       = useState<ComandaGrupo | null>(null);
  const [fechandoCaixa, setFechandoCaixa]     = useState(false);
  const [modalFechamento, setModalFechamento] = useState(false);
  const [pagoExpandido, setPagoExpandido]     = useState(false);
  const [recebendo, setRecebendo]             = useState<string | null>(null);

  const hoje = useMemo(
    () => todos.filter((p) => p.criadoEm && isSameBrasiliaDay(p.criadoEm.toDate())),
    [todos]
  );

  const pedidosAbertos = useMemo(
    () => todos.filter((p) => isPedidoAberto(p.status)),
    [todos]
  );

  const comandasAbertas = useMemo(
    () => groupComandasAbertas(todos),
    [todos]
  );

  const comandasProntas = useMemo(
    () => comandasAbertas.filter((c) => c.prontaParaCobrar),
    [comandasAbertas]
  );

  const pagos = useMemo(
    () => hoje.filter((p) => p.status === "pago"),
    [hoje]
  );

  const naCozinha = useMemo(
    () => pedidosAbertos.filter((p) => ["novo", "em_preparo", "saiu"].includes(p.status)).length,
    [pedidosAbertos]
  );

  const piquesPagos = useMemo(() => groupPedidosByPique(pagos), [pagos]);

  const totalAReceber   = pedidosAbertos.reduce((s, p) => s + p.total, 0);
  const totalRecebido   = pagos.reduce((s, p) => s + p.total, 0);
  const ticketMedio     = pagos.length ? totalRecebido / pagos.length : 0;
  const comandasViradas = comandasAbertas.filter((c) =>
    c.pedidos.some((p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate()))
  ).length;

  const fechamentoHoje = fechamentos.find((f) => f.data === getBrasiliaDateKey());

  const receberComanda = async (grupo: ComandaGrupo) => {
    setRecebendo(grupo.piqueId);
    try {
      await Promise.all([
        ...grupo.pedidos.map((p) =>
          updateDoc(doc(db, "pedidos", p.id), {
            status: "pago",
            atualizadoEm: serverTimestamp(),
          })
        ),
        updateDoc(doc(db, "piques", grupo.piqueId), { status: "livre" }),
      ]);
      toast.success(`Comanda #${grupo.comandaId} — pagamento registrado!`);
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
      if (marcarPendentesComoPagos && pedidosAbertos.length > 0) {
        await Promise.all([
          ...pedidosAbertos.map((p) =>
            updateDoc(doc(db, "pedidos", p.id), {
              status: "pago",
              atualizadoEm: serverTimestamp(),
            })
          ),
          ...comandasAbertas.map((grupo) =>
            updateDoc(doc(db, "piques", grupo.piqueId), { status: "livre" })
          ),
        ]);
      }

      const totalFinal = marcarPendentesComoPagos
        ? totalRecebido + totalAReceber
        : totalRecebido;

      await addDoc(collection(db, "fechamentos"), {
        data: getBrasiliaDateKey(),
        totalRecebido: totalFinal,
        totalPendente: marcarPendentesComoPagos ? 0 : totalAReceber,
        totalPedidos: hoje.length,
        ticketMedio: pagos.length ? totalFinal / pagos.length : 0,
        piquesFechados: piquesPagos.length + (marcarPendentesComoPagos ? comandasAbertas.length : 0),
        criadoEm: serverTimestamp(),
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div>
          <h1 className="text-2xl font-bold text-forest-900 dark:text-forest-50">Caixa</h1>
          <p className="text-forest-500 dark:text-forest-300 text-sm mt-0.5 capitalize">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "America/Sao_Paulo",
            })}
          </p>
        </div>
        {!fechamentoHoje ? (
          <button
            onClick={() => setModalFechamento(true)}
            className="btn-ghost ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border border-forest-200 dark:border-forest-600 text-sm hover:border-gold-500/40"
          >
            <LockKeyhole className="w-4 h-4" />
            Fechar Caixa
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl glass border border-emerald-500/25 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Caixa fechado hoje
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={AlertCircle}
          label="A receber"
          value={formatCurrency(totalAReceber)}
          accent="text-amber-600 dark:text-amber-400"
          highlight={totalAReceber > 0}
        />
        <StatCard
          icon={Banknote}
          label="Recebido hoje"
          value={formatCurrency(totalRecebido)}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Ticket médio"
          value={formatCurrency(ticketMedio)}
          accent="text-sky-600 dark:text-sky-400"
        />
        <StatCard
          icon={ShoppingBag}
          label="Comandas abertas"
          value={String(comandasAbertas.length)}
          sub={naCozinha > 0 ? `${naCozinha} pedido${naCozinha > 1 ? "s" : ""} na cozinha` : undefined}
          accent="text-forest-700 dark:text-forest-200"
        />
      </div>

      {/* Comandas abertas */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
          <h2 className="font-semibold text-forest-900 dark:text-forest-50">
            Comandas abertas
          </h2>
          {comandasAbertas.length > 0 && (
            <span className="badge status-novo text-[10px]">{comandasAbertas.length}</span>
          )}
          {comandasProntas.length > 0 && comandasProntas.length < comandasAbertas.length && (
            <span className="text-xs text-forest-500 dark:text-forest-400">
              · {comandasProntas.length} pronta{comandasProntas.length > 1 ? "s" : ""} para cobrar
            </span>
          )}
        </div>

        {comandasViradas > 0 && (
          <div className="glass rounded-2xl px-4 py-3 border border-amber-500/25 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-forest-600 dark:text-forest-300 text-xs leading-relaxed">
              {comandasViradas} comanda{comandasViradas > 1 ? "s" : ""} de dia{comandasViradas > 1 ? "s" : ""} anterior
              {comandasViradas > 1 ? "es" : ""} ainda sem pagamento confirmado.
            </p>
          </div>
        )}

        {comandasAbertas.length === 0 ? (
          <div className="glass rounded-2xl flex items-center gap-4 px-5 py-8 border border-forest-200 dark:border-forest-700">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-forest-800 dark:text-forest-100 font-semibold text-sm">Tudo em dia!</p>
              <p className="text-forest-500 dark:text-forest-400 text-xs mt-0.5">
                Nenhuma mesa com comanda em aberto no momento.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {comandasAbertas.map((grupo) => (
              <ComandaCard
                key={grupo.piqueId}
                grupo={grupo}
                confirmando={confirmPique?.piqueId === grupo.piqueId}
                recebendo={recebendo === grupo.piqueId}
                onToggleConfirm={() =>
                  setConfirmPique(
                    confirmPique?.piqueId === grupo.piqueId ? null : grupo
                  )
                }
                onConfirmar={() => receberComanda(grupo)}
                onCancelar={() => setConfirmPique(null)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Pagos hoje */}
      {piquesPagos.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setPagoExpandido((v) => !v)}
            className="flex items-center gap-2 w-full text-left group"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="font-semibold text-forest-600 dark:text-forest-300 text-sm group-hover:text-forest-800 dark:group-hover:text-forest-100 transition-colors">
              Pagos hoje ({piquesPagos.length} mesa{piquesPagos.length > 1 ? "s" : ""})
            </h2>
            <ChevronDown
              className={`w-4 h-4 text-forest-500 ml-1 transition-transform ${pagoExpandido ? "rotate-180" : ""}`}
            />
            <span className="ml-auto font-semibold text-emerald-600 dark:text-emerald-400 text-sm">
              {formatCurrency(totalRecebido)}
            </span>
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
                  <div
                    key={grupo.piqueId}
                    className="glass rounded-xl flex items-center gap-3 px-4 py-3 border border-forest-200 dark:border-forest-700 opacity-80"
                  >
                    <Fish className="w-4 h-4 text-forest-500 shrink-0" />
                    <p className="flex-1 text-forest-700 dark:text-forest-200 text-sm font-medium truncate">
                      {grupo.piqueNome}
                    </p>
                    <p className="text-forest-500 text-xs">{grupo.pedidos.length} ped.</p>
                    <span className="text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                      {formatCurrency(grupo.total)}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}

      {/* Histórico */}
      {fechamentos.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-forest-500 dark:text-forest-400 text-sm flex items-center gap-2">
            <ReceiptText className="w-4 h-4" />
            Fechamentos anteriores
          </h2>
          <div className="glass rounded-2xl overflow-hidden border border-forest-200 dark:border-forest-700 divide-y divide-forest-100 dark:divide-forest-700">
            {fechamentos.slice(0, 7).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <div>
                  <p className="text-forest-800 dark:text-forest-100 text-sm font-medium">
                    {new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                  <p className="text-forest-500 text-xs">
                    {f.totalPedidos} pedidos · {f.piquesFechados} mesas
                  </p>
                </div>
                <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(f.totalRecebido)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal fechamento */}
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
              className="glass rounded-3xl w-full max-w-sm p-6 space-y-5 border border-forest-200 dark:border-forest-700"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-600/15 flex items-center justify-center">
                    <LockKeyhole className="w-5 h-5 text-gold-600" />
                  </div>
                  <div>
                    <h2 className="font-bold text-forest-900 dark:text-forest-50">Fechar Caixa</h2>
                    <p className="text-forest-500 text-xs">
                      {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalFechamento(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="glass rounded-2xl divide-y divide-forest-100 dark:divide-forest-700 border border-forest-200 dark:border-forest-700">
                <SummaryRow label="Total recebido" value={formatCurrency(totalRecebido)} highlight />
                <SummaryRow
                  label="Comandas em aberto"
                  value={formatCurrency(totalAReceber)}
                  warn={totalAReceber > 0}
                />
                <SummaryRow label="Pedidos no dia" value={String(hoje.length)} />
                <SummaryRow label="Ticket médio" value={formatCurrency(ticketMedio)} />
                <SummaryRow
                  label="Mesas atendidas hoje"
                  value={String(piquesPagos.length + comandasAbertas.length)}
                />
              </div>

              {pedidosAbertos.length > 0 && (
                <div className="rounded-xl px-4 py-3 border border-amber-500/25 bg-amber-500/5 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-forest-600 dark:text-forest-300 text-xs leading-relaxed">
                    Há{" "}
                    <span className="text-amber-600 dark:text-amber-400 font-bold">
                      {comandasAbertas.length} comanda{comandasAbertas.length > 1 ? "s" : ""}
                    </span>{" "}
                    em aberto ({formatCurrency(totalAReceber)}). Você pode registrá-las como pagas agora.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {pedidosAbertos.length > 0 && (
                  <button
                    onClick={() => fecharCaixa(true)}
                    disabled={fechandoCaixa}
                    className="btn-gold w-full py-3 rounded-xl text-sm disabled:opacity-60"
                  >
                    {fechandoCaixa ? "Fechando..." : "Marcar comandas como pagas e fechar"}
                  </button>
                )}
                <button
                  onClick={() => fecharCaixa(false)}
                  disabled={fechandoCaixa}
                  className={`w-full py-3 rounded-xl text-sm disabled:opacity-60 ${
                    pedidosAbertos.length > 0
                      ? "btn-ghost border border-forest-200 dark:border-forest-600"
                      : "btn-gold"
                  }`}
                >
                  {fechandoCaixa
                    ? "Fechando..."
                    : pedidosAbertos.length > 0
                      ? "Fechar somente com recebidos"
                      : "Confirmar fechamento"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ComandaCard({
  grupo,
  confirmando,
  recebendo,
  onToggleConfirm,
  onConfirmar,
  onCancelar,
}: {
  grupo: ComandaGrupo;
  confirmando: boolean;
  recebendo: boolean;
  onToggleConfirm: () => void;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const temVirada = grupo.pedidos.some(
    (p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate())
  );

  const statusAtivos = (["novo", "em_preparo", "saiu", "entregue"] as OrderStatus[]).filter(
    (s) => grupo.contagemPorStatus[s] > 0
  );

  return (
    <motion.div
      layout
      className={`glass rounded-2xl overflow-hidden border ${
        grupo.prontaParaCobrar
          ? "border-gold-500/30 ring-1 ring-gold-500/10"
          : "border-forest-200 dark:border-forest-700"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="w-11 h-11 rounded-xl bg-forest-800 dark:bg-forest-900 flex items-center justify-center shrink-0">
          <Fish className="w-5 h-5 text-gold-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-forest-900 dark:text-forest-50 text-sm truncate">
              {grupo.piqueNome}
            </p>
            <span className="text-[10px] font-mono font-bold text-gold-600 dark:text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded">
              #{grupo.comandaId}
            </span>
          </div>
          <p className="text-forest-500 dark:text-forest-400 text-xs mt-0.5">
            {grupo.pedidos.length} pedido{grupo.pedidos.length > 1 ? "s" : ""} ·{" "}
            {grupo.prontaParaCobrar ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">Pronta para cobrar</span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-medium">Em consumo</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {statusAtivos.map((status) => {
              const cfg = STATUS_CHIP[status];
              if (!cfg) return null;
              const Icon = cfg.icon;
              return (
                <span key={status} className={`badge ${cfg.className} text-[10px] gap-0.5`}>
                  <Icon className="w-2.5 h-2.5" />
                  {grupo.contagemPorStatus[status]} {cfg.short}
                </span>
              );
            })}
          </div>
          {temVirada && (
            <p className="text-amber-600 dark:text-amber-400 text-[11px] flex items-center gap-1 mt-1 font-medium">
              <AlertCircle className="w-3 h-3" /> Comanda do dia anterior
            </p>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="font-bold text-lg text-gold-700 dark:text-gold-300">
            {formatCurrency(grupo.total)}
          </p>
        </div>

        <button
          onClick={onToggleConfirm}
          className="btn-gold px-3 py-2 rounded-xl text-sm shrink-0"
        >
          Receber
        </button>
      </div>

      <AnimatePresence>
        {confirmando && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-forest-200 dark:border-forest-700 px-4 py-4 space-y-3 bg-forest-50/80 dark:bg-forest-900/50">
              {grupo.pedidos.map((p) => (
                <div key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-forest-700 dark:text-forest-200 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      Pedido #{p.id.slice(-4).toUpperCase()}
                    </span>
                    <span className={`badge ${STATUS_CHIP[p.status]?.className ?? ""} text-[10px]`}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {p.itens.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs px-1">
                      <span className="text-forest-600 dark:text-forest-300">
                        {item.quantidade}× {item.nome}
                      </span>
                      <span className="text-forest-500 dark:text-forest-400">
                        {formatCurrency(item.preco * item.quantidade)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-medium pt-0.5">
                    <span className="text-forest-500">Subtotal</span>
                    <span className="text-forest-800 dark:text-forest-100">{formatCurrency(p.total)}</span>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-forest-200 dark:border-forest-700">
                <span className="font-semibold text-sm text-forest-800 dark:text-forest-100">
                  Total da comanda
                </span>
                <span className="font-bold text-lg text-gold-700 dark:text-gold-300">
                  {formatCurrency(grupo.total)}
                </span>
              </div>

              <div className="flex gap-2">
                <button onClick={onCancelar} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                  Cancelar
                </button>
                <button
                  onClick={onConfirmar}
                  disabled={recebendo}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm disabled:opacity-60"
                >
                  {recebendo ? "Registrando..." : `Confirmar ${formatCurrency(grupo.total)}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
  highlight,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent: string;
  highlight?: boolean;
  sub?: string;
}) {
  return (
    <div
      className={`glass rounded-2xl p-4 space-y-2 border ${
        highlight ? "border-amber-500/25" : "border-forest-200 dark:border-forest-700"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className={`w-4 h-4 ${accent}`} />
        <span className="text-forest-500 dark:text-forest-400 text-xs">{label}</span>
      </div>
      <p className="font-bold text-lg text-forest-900 dark:text-forest-50 tracking-tight">{value}</p>
      {sub && <p className="text-[10px] text-forest-500 dark:text-forest-400 -mt-1">{sub}</p>}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3">
      <span className="text-forest-500 dark:text-forest-400 text-sm">{label}</span>
      <span
        className={`font-semibold text-sm ${
          highlight
            ? "text-emerald-600 dark:text-emerald-400 font-bold"
            : warn
              ? "text-amber-600 dark:text-amber-400 font-bold"
              : "text-forest-800 dark:text-forest-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
