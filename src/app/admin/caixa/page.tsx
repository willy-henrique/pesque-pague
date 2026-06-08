"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Banknote, Fish, CheckCircle2, ChevronDown,
  AlertCircle, X, TrendingUp, ShoppingBag, ReceiptText,
  LockKeyhole, Clock, Flame, Bike, MapPin, UserRound,
} from "lucide-react";
import {
  doc, updateDoc, addDoc, collection, serverTimestamp, getDoc,
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
  type ClienteComanda,
} from "@/lib/comanda";
import type { Pedido, FechamentoCaixa, OrderStatus, FormaPagamento } from "@/types";
import { STATUS_LABELS } from "@/types";
import toast from "react-hot-toast";

const FORMA_IMPRESSAO: Record<FormaPagamento, string> = {
  dinheiro: "Dinheiro",
  pix:      "PIX",
  credito:  "Cartao Credito",
  debito:   "Cartao Debito",
  misto:    "Misto",
};

function buildCupomHtml(
  grupo: ComandaGrupo,
  forma: FormaPagamento,
  nomeEstabelecimento: string,
  incluirServico: boolean
): string {
  const brl = (v: number) =>
    "R$ " + v.toFixed(2).replace(".", ",");
  const taxaServico = incluirServico ? grupo.total * 0.1 : 0;
  const totalFinal  = grupo.total + taxaServico;

  const agora = new Date().toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const itensHtml = grupo.clientes.map((c) => {
    const itensList = c.pedidos
      .flatMap((p) => p.itens)
      .map(
        (item) =>
          `<div class="row">
            <span class="item-name">${item.quantidade}x ${item.nome}</span>
            <span class="item-price">${brl(item.preco * item.quantidade)}</span>
          </div>`
      )
      .join("");

    return `
      <div class="client-name">${c.nome}</div>
      ${itensList}
      <div class="row subtotal">
        <span>Subtotal</span><span>${brl(c.total)}</span>
      </div>
      <div class="sep"></div>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Cupom</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    font-family:'Courier New',Courier,monospace;
    font-size:12px;
    width:80mm;
    max-width:80mm;
    padding:4mm 3mm;
    color:#000;
    background:#fff;
  }
  .center{text-align:center}
  .right{text-align:right}
  .bold{font-weight:bold}
  .sep{border-top:1px dashed #000;margin:5px 0}
  .row{display:flex;justify-content:space-between;margin:2px 0}
  .item-name{flex:1;word-break:break-word}
  .item-price{white-space:nowrap;margin-left:6px}
  .client-name{font-weight:bold;margin:4px 0 2px}
  .subtotal{font-weight:bold;font-size:11px;color:#333}
  .total-row{
    display:flex;justify-content:space-between;
    font-size:15px;font-weight:bold;margin:4px 0;
  }
  .footer{font-size:10px;color:#555;margin-top:4px}
  @page{margin:0;size:80mm auto}
  @media print{
    body{width:80mm}
  }
</style>
</head>
<body>
  <div class="center bold" style="font-size:15px">${nomeEstabelecimento}</div>
  <div class="center" style="margin-bottom:4px">${agora}</div>
  <div class="sep"></div>
  <div class="center bold">*** CUPOM DE CONSUMO ***</div>
  <div class="sep"></div>
  <div class="row"><span>Mesa:</span><span class="bold">${grupo.piqueNome}</span></div>
  <div class="row"><span>Comanda:</span><span class="bold">#${grupo.comandaId}</span></div>
  <div class="sep"></div>
  ${itensHtml}
  <div class="row" style="margin-top:4px">
    <span>Subtotal</span>
    <span>${brl(grupo.total)}</span>
  </div>
  ${incluirServico ? `
  <div class="row">
    <span>Serviço (10%)</span>
    <span>${brl(taxaServico)}</span>
  </div>` : ""}
  <div class="sep"></div>
  <div class="total-row">
    <span>TOTAL</span>
    <span>${brl(totalFinal)}</span>
  </div>
  <div class="row">
    <span>Pagamento:</span>
    <span class="bold">${FORMA_IMPRESSAO[forma]}</span>
  </div>
  <div class="sep"></div>
  <div class="center">Obrigado pela preferência!</div>
  <div class="center">Volte sempre :)</div>
  <div class="sep"></div>
  <div class="center footer">Powered by Confraria do Peixe</div>
</body>
</html>`;
}

function imprimirCupom(
  grupo: ComandaGrupo,
  forma: FormaPagamento,
  nomeEstabelecimento: string,
  incluirServico: boolean
) {
  const popup = window.open("", "_blank", "width=380,height=620,scrollbars=yes");
  if (!popup) {
    alert("Permita popups neste site para imprimir o cupom.");
    return;
  }
  popup.document.write(buildCupomHtml(grupo, forma, nomeEstabelecimento, incluirServico));
  popup.document.close();
  popup.focus();
  // pequeno delay para garantir que o conteúdo foi renderizado
  setTimeout(() => {
    popup.print();
    popup.close();
  }, 400);
}

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
  const [notaGrupo, setNotaGrupo]             = useState<{ grupo: ComandaGrupo; forma: FormaPagamento; incluirServico: boolean } | null>(null);
  const [nomeEstabelecimento, setNomeEstabelecimento] = useState("Confraria do Peixe");

  useEffect(() => {
    getDoc(doc(db, "config", "geral")).then((snap) => {
      if (snap.exists() && snap.data().nomeEstabelecimento) {
        setNomeEstabelecimento(snap.data().nomeEstabelecimento as string);
      }
    });
  }, []);

  const handleImprimir = useCallback(() => {
    if (!notaGrupo) return;
    imprimirCupom(notaGrupo.grupo, notaGrupo.forma, nomeEstabelecimento, notaGrupo.incluirServico);
  }, [notaGrupo, nomeEstabelecimento]);

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

  const receberComanda = async (grupo: ComandaGrupo, formaPagamento: FormaPagamento, incluirServico: boolean) => {
    setRecebendo(grupo.piqueId);
    try {
      await Promise.all([
        ...grupo.pedidos.map((p) =>
          updateDoc(doc(db, "pedidos", p.id), {
            status: "pago",
            formaPagamento,
            atualizadoEm: serverTimestamp(),
          })
        ),
        updateDoc(doc(db, "piques", grupo.piqueId), { status: "livre" }),
      ]);
      setConfirmPique(null);
      setNotaGrupo({ grupo, forma: formaPagamento, incluirServico });
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
                onConfirmar={(forma, incluirServico) => receberComanda(grupo, forma, incluirServico)}
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

      {/* Modal cupom */}
      <AnimatePresence>
        {notaGrupo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setNotaGrupo(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-forest-950 rounded-2xl w-full max-w-sm border border-forest-200 dark:border-forest-700 overflow-hidden"
            >
              {/* Cabeçalho */}
              <div className="px-5 pt-5 pb-3 text-center border-b border-dashed border-forest-200 dark:border-forest-700">
                <p className="font-mono font-bold text-base text-forest-900 dark:text-forest-50 uppercase tracking-wide">
                  {nomeEstabelecimento}
                </p>
                <p className="font-mono text-xs text-forest-500 mt-0.5">
                  {new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </p>
                <p className="font-mono font-bold text-xs text-forest-700 dark:text-forest-200 mt-1 tracking-widest">
                  *** CUPOM DE CONSUMO ***
                </p>
              </div>

              {/* Info mesa */}
              <div className="px-5 py-3 font-mono text-sm border-b border-dashed border-forest-200 dark:border-forest-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-forest-500">Mesa</span>
                  <span className="font-bold text-forest-900 dark:text-forest-50">{notaGrupo.grupo.piqueNome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-forest-500">Comanda</span>
                  <span className="font-bold text-forest-900 dark:text-forest-50">#{notaGrupo.grupo.comandaId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-forest-500">Pagamento</span>
                  <span className="font-bold text-forest-900 dark:text-forest-50">{FORMA_IMPRESSAO[notaGrupo.forma]}</span>
                </div>
              </div>

              {/* Itens por cliente */}
              <div className="px-5 py-3 font-mono text-xs space-y-3 border-b border-dashed border-forest-200 dark:border-forest-700 max-h-64 overflow-y-auto">
                {notaGrupo.grupo.clientes.map((c, ci) => (
                  <div key={ci} className="space-y-1">
                    <p className="font-bold text-forest-800 dark:text-forest-100 truncate">{c.nome}</p>
                    {c.pedidos.flatMap((p) => p.itens).map((item, i) => (
                      <div key={i} className="flex justify-between gap-2">
                        <span className="text-forest-600 dark:text-forest-300 flex-1 truncate">
                          {item.quantidade}× {item.nome}
                        </span>
                        <span className="text-forest-500 shrink-0">
                          {formatCurrency(item.preco * item.quantidade)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between font-semibold text-forest-700 dark:text-forest-200 border-t border-forest-100 dark:border-forest-800 pt-1">
                      <span>Subtotal</span>
                      <span>{formatCurrency(c.total)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="px-5 pt-3 pb-1 font-mono text-sm border-b border-forest-200 dark:border-forest-700 space-y-1">
                <div className="flex justify-between text-forest-500 dark:text-forest-400">
                  <span>Subtotal</span>
                  <span>{formatCurrency(notaGrupo.grupo.total)}</span>
                </div>
                {notaGrupo.incluirServico && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Serviço (10%)</span>
                    <span>+{formatCurrency(notaGrupo.grupo.total * 0.1)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2">
                  <span className="font-bold text-forest-900 dark:text-forest-50 text-base">TOTAL</span>
                  <span className="font-bold text-xl text-gold-600 dark:text-gold-400">
                    {formatCurrency(notaGrupo.grupo.total * (notaGrupo.incluirServico ? 1.1 : 1))}
                  </span>
                </div>
              </div>

              {/* Rodapé cupom */}
              <div className="px-5 pt-2 pb-1 text-center font-mono text-[10px] text-forest-400">
                Obrigado pela preferência! Volte sempre :)
              </div>
              <div className="pb-4 text-center font-mono text-[9px] text-forest-300">
                Powered by Confraria do Peixe
              </div>

              {/* Ações */}
              <div className="flex gap-2 px-5 pb-5">
                <button
                  onClick={() => setNotaGrupo(null)}
                  className="btn-ghost flex-1 py-2.5 rounded-xl text-sm"
                >
                  Fechar
                </button>
                <button
                  onClick={handleImprimir}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm"
                >
                  🖨️ Imprimir cupom
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const FORMA_LABELS: Record<FormaPagamento, string> = {
  dinheiro: "💵 Dinheiro",
  pix:      "📱 PIX",
  credito:  "💳 Crédito",
  debito:   "💳 Débito",
  misto:    "🔀 Misto",
};

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
  onConfirmar: (forma: FormaPagamento, incluirServico: boolean) => void;
  onCancelar: () => void;
}) {
  const [forma, setForma] = useState<FormaPagamento>("dinheiro");
  const [verificado, setVerificado] = useState(false);
  const [incluirServico, setIncluirServico] = useState(false);
  const totalExibido = incluirServico ? grupo.total * 1.1 : grupo.total;

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
          {grupo.clientes.length > 0 && (
            <p className="text-water-500 dark:text-water-400 text-xs font-medium truncate">
              {grupo.clientes.length === 1
                ? `${grupo.clientes[0].nome}${grupo.clientes[0].telefone ? ` · ${grupo.clientes[0].telefone}` : ""}`
                : `${grupo.clientes.map((c) => c.nome).join(", ")}`}
            </p>
          )}
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
            <div className="border-t border-forest-200 dark:border-forest-700 px-4 py-4 space-y-4 bg-forest-50/80 dark:bg-forest-900/50">
              {grupo.clientes.map((cliente, ci) => (
                <ClienteSection key={ci} cliente={cliente} />
              ))}

              <div className="flex items-center justify-between pt-2 border-t border-forest-200 dark:border-forest-700">
                <span className="font-semibold text-sm text-forest-800 dark:text-forest-100">
                  Total da comanda
                </span>
                <span className="font-bold text-lg text-gold-700 dark:text-gold-300">
                  {formatCurrency(grupo.total)}
                </span>
              </div>

              {/* Anti-burla: verificação da mesa */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5 space-y-2">
                <p className="text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Confirme que o cliente é da <strong>{grupo.piqueNome}</strong> antes de receber
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verificado}
                    onChange={(e) => setVerificado(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <span className="text-amber-800 dark:text-amber-300 text-xs">
                    Confirmei que é da {grupo.piqueNome} (comanda #{grupo.comandaId})
                  </span>
                </label>
              </div>

              {/* 10% de serviço (garçom) */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-forest-100 dark:bg-forest-800/60 border border-forest-200 dark:border-forest-700">
                <div>
                  <p className="text-forest-800 dark:text-forest-100 text-sm font-semibold">Serviço (10%)</p>
                  <p className="text-forest-500 text-xs">
                    {incluirServico
                      ? `+ ${formatCurrency(grupo.total * 0.1)} → total ${formatCurrency(totalExibido)}`
                      : "Opcional — garçom"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIncluirServico((v) => !v)}
                  className={`w-11 h-6 rounded-full transition-colors shrink-0 ${
                    incluirServico ? "bg-gold-500" : "bg-forest-300 dark:bg-forest-600"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    incluirServico ? "translate-x-5" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* Forma de pagamento */}
              <div className="space-y-1.5">
                <p className="text-forest-500 dark:text-forest-400 text-xs font-medium">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.entries(FORMA_LABELS) as [FormaPagamento, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForma(key)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all border ${
                        forma === key
                          ? "bg-forest-700 text-gold-400 border-gold-500/30"
                          : "bg-forest-50 dark:bg-forest-900 text-forest-500 border-forest-200 dark:border-forest-700 hover:border-forest-400"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={onCancelar} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                  Cancelar
                </button>
                <button
                  onClick={() => onConfirmar(forma, incluirServico)}
                  disabled={recebendo || !verificado}
                  className="btn-gold flex-1 py-2.5 rounded-xl text-sm disabled:opacity-60"
                >
                  {recebendo ? "Registrando..." : `Confirmar ${formatCurrency(totalExibido)}`}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ClienteSection({ cliente }: { cliente: ClienteComanda }) {
  const totalItens = cliente.pedidos.flatMap((p) => p.itens);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-forest-700 dark:text-forest-200 text-xs flex items-center gap-1">
          <UserRound className="w-3 h-3 text-water-400" />
          {cliente.nome}
          {cliente.telefone && (
            <span className="font-normal text-forest-400"> · {cliente.telefone}</span>
          )}
        </span>
        <span className="text-forest-800 dark:text-forest-100 text-xs font-bold">
          {formatCurrency(cliente.total)}
        </span>
      </div>
      {totalItens.map((item, i) => (
        <div key={i} className="flex justify-between text-xs px-2">
          <span className="text-forest-600 dark:text-forest-300">
            {item.quantidade}× {item.nome}
          </span>
          <span className="text-forest-400">
            {formatCurrency(item.preco * item.quantidade)}
          </span>
        </div>
      ))}
    </div>
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
