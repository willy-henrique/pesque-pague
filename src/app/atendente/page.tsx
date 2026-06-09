"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardPlus, Fish, LogOut, Receipt, UserRound, Phone, X, BellRing, ChefHat, GlassWater, Plus, ChevronRight, ChevronLeft } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCollection, orderBy, where } from "@/hooks/useFirestore";
import { useRequireAtendente } from "@/hooks/useRequireAtendente";
import { auth } from "@/lib/firebase";
import { withModoAtendente } from "@/lib/atendente";
import { getSetoresDoPedido, getSetoresProntos, getStatusGeralPedido, isPedidoProntoParaRetirada } from "@/lib/pedido-status";
import { formatarTelefone } from "@/lib/utils";
import type { Pique, Pedido } from "@/types";
import toast from "react-hot-toast";

export default function AtendentePage() {
  const router = useRouter();
  const { usuario } = useRequireAtendente();
  const { data: piques, loading } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);
  // Busca apenas pedidos ativos (excluindo pago/cancelado) sem orderBy para evitar índice composto
  const { data: pedidos } = useCollection<Pedido>("pedidos", [
    where("status", "not-in", ["pago", "cancelado"]),
  ]);

  const [modalMesa, setModalMesa] = useState<Pique | null>(null);
  const [modalStep, setModalStep] = useState<"selecionar" | "novo">("novo");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Sessão encerrada.");
    router.replace("/atendente/login");
  };

  const abrirModal = (mesa: Pique) => {
    const clientes = clientesPorMesa.get(mesa.id) ?? [];
    setClienteNome("");
    setClienteTel("");
    setModalStep(clientes.length > 0 ? "selecionar" : "novo");
    setModalMesa(mesa);
  };

  const irAoCardapioComCliente = (nome: string, telefone: string) => {
    if (!modalMesa) return;
    const params = new URLSearchParams({ modo: "atendente", clienteNome: nome, clienteTelefone: telefone });
    router.push(`/pique/${modalMesa.id}/cardapio?${params.toString()}`);
    setModalMesa(null);
  };

  const confirmarEIrAoCardapio = () => {
    if (!modalMesa) return;
    if (!clienteNome.trim()) return toast.error("Informe o nome do cliente.");
    if (!clienteTel.trim()) return toast.error("Informe o telefone do cliente.");
    const params = new URLSearchParams({
      modo: "atendente",
      clienteNome: clienteNome.trim(),
      clienteTelefone: clienteTel.trim(),
    });
    router.push(`/pique/${modalMesa.id}/cardapio?${params.toString()}`);
    setModalMesa(null);
  };

  const mesasDisponiveis = piques.filter(
    (p) => p.ativo && (p.status ?? "livre") !== "bloqueado"
  );
  const setoresAtendente = usuario?.setores ?? ["cozinha", "bar"];

  const prontos = pedidos.filter((pedido) => {
    const isReady = isPedidoProntoParaRetirada(pedido) || getStatusGeralPedido(pedido) === "saiu";
    if (!isReady) return false;

    // Status "saiu" = todos setores prontos/entregues, todos os atendentes precisam saber
    if (getStatusGeralPedido(pedido) === "saiu") return true;

    // Filtra pelo setor do atendente: só aparece se o setor dele está pronto
    return setoresAtendente.some((setor) =>
      setor === "bar" ? pedido.barStatus === "pronto" : pedido.cozinhaStatus === "pronto"
    );
  });
  const clientesPorMesa = useMemo(() => {
    const mapa = new Map<string, { nome: string; telefone: string }[]>();

    for (const pedido of pedidos) {
      if (pedido.status === "pago" || pedido.status === "cancelado") continue;
      const nome = pedido.nomeCliente?.trim();
      if (!nome) continue;

      const atual = mapa.get(pedido.piqueId) ?? [];
      if (!atual.some((c) => c.nome === nome)) {
        atual.push({ nome, telefone: pedido.telefoneCliente ?? "" });
      }
      mapa.set(pedido.piqueId, atual);
    }

    return mapa;
  }, [pedidos]);

  return (
    <main
      className="min-h-dvh px-5 py-8"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="glass rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-forest-700 flex items-center justify-center">
              <UserRound className="w-6 h-6 text-gold-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-forest-400 text-xs uppercase tracking-widest">Aplicativo Web</p>
              <h1 className="font-display text-2xl font-bold gradient-gold-text">Atendente</h1>
              {usuario && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <p className="text-forest-500 text-xs truncate">{usuario.nome}</p>
                  {setoresAtendente.map((s) => (
                    <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                      s === "bar" ? "bg-blue-500/20 text-blue-300" : "bg-orange-500/20 text-orange-300"
                    }`}>
                      {s === "bar" ? "🍺 Bar" : "🍳 Cozinha"}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="btn-ghost p-2.5 rounded-xl shrink-0"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <p className="text-forest-300 text-sm mt-4">
            Para lançar pedido manualmente, informe o nome e telefone do cliente antes de ir ao cardápio.
          </p>
        </header>

        <section className="glass rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <BellRing className="w-5 h-5 text-gold-500" />
            <div>
              <h2 className="font-semibold text-forest-900">Prontos para entregar</h2>
              <p className="text-forest-500 text-sm">
                {prontos.length === 0 ? "Nenhum pedido pronto agora" : `${prontos.length} pedido(s) aguardando retirada`}
              </p>
            </div>
          </div>

          {prontos.length === 0 ? (
            <p className="text-sm text-forest-500">Quando cozinha ou bar marcarem um pedido como pronto, ele aparece aqui com a mesa correta.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {prontos.map((pedido) => {
                const setores = getSetoresProntos(pedido);
                const setoresExibidos =
                  setores.length > 0
                    ? setores
                    : getStatusGeralPedido(pedido) === "saiu"
                    ? getSetoresDoPedido(pedido)
                    : [];
                return (
                  <button
                    key={pedido.id}
                    type="button"
                    onClick={() => router.push(withModoAtendente(`/pique/${pedido.piqueId}/comanda`))}
                    className="text-left glass rounded-2xl p-4 border border-gold-500/20 hover:border-gold-500/40 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gold-500/15 flex items-center justify-center shrink-0">
                        <Receipt className="w-5 h-5 text-gold-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-forest-900 truncate">{pedido.piqueNome}</p>
                        <p className="text-forest-500 text-xs">
                          Pedido #{pedido.id.slice(-4).toUpperCase()}
                        </p>
                        {pedido.nomeCliente && (
                          <p className="text-water-600 text-xs font-medium truncate mt-1">
                            Cliente: {pedido.nomeCliente}
                            {pedido.telefoneCliente ? ` · ${pedido.telefoneCliente}` : ""}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {setoresExibidos.map((setor) => (
                            <span key={setor} className="badge status-entregue text-[11px]">
                              {setor === "cozinha" ? <ChefHat className="w-3 h-3" /> : <GlassWater className="w-3 h-3" />}
                              {setor === "cozinha" ? "Comida pronta" : "Bebida pronta"}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {loading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-pulse h-32 rounded-2xl" />
            ))}
          </div>
        ) : mesasDisponiveis.length === 0 ? (
          <div className="glass rounded-2xl p-8 text-center">
            <Fish className="w-10 h-10 text-forest-600 mx-auto mb-3" />
            <p className="text-forest-300 font-semibold">Nenhuma mesa disponível</p>
            <p className="text-forest-600 text-sm mt-1">Cadastre ou ative mesas no ERP.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {mesasDisponiveis.map((mesa) => {
              const clientesMesa = clientesPorMesa.get(mesa.id) ?? [];
              return (
              <article key={mesa.id} className="glass rounded-2xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-forest-800 flex items-center justify-center shrink-0">
                    <span className="font-display font-black text-gold-400 text-lg leading-none">
                      {mesa.numero}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-forest-900 truncate">
                      {mesa.nome || `Mesa ${mesa.numero}`}
                    </p>
                    <p className="text-forest-500 text-xs">
                      {mesa.capacidade ? `${mesa.capacidade} lugares` : "Sem capacidade informada"}
                    </p>
                    {clientesMesa.length > 0 && (
                      <p className="text-water-600 text-xs font-medium mt-1 truncate">
                        Cliente{clientesMesa.length > 1 ? "s" : ""}: {clientesMesa.map((c) => c.nome).join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => abrirModal(mesa)}
                    className="btn-gold py-2.5 rounded-xl text-sm"
                  >
                    <ClipboardPlus className="w-4 h-4" />
                    Novo pedido
                  </button>
                  <Link
                    href={withModoAtendente(`/pique/${mesa.id}/comanda`)}
                    className="btn-ghost py-2.5 rounded-xl text-sm"
                  >
                    <Receipt className="w-4 h-4" />
                    Comanda
                  </Link>
                </div>
              </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de novo pedido — selecionar cliente ou adicionar novo */}
      <AnimatePresence>
        {modalMesa && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModalMesa(null)}
          >
            <motion.div
              key={modalStep}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-5 border border-forest-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-forest-900 text-lg">
                    {modalStep === "selecionar" ? "Quem está pedindo?" : "Identificar cliente"}
                  </h2>
                  <p className="text-forest-500 text-xs mt-0.5">
                    {modalMesa.nome || `Mesa ${modalMesa.numero}`}
                  </p>
                </div>
                <button type="button" onClick={() => setModalMesa(null)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalStep === "selecionar" ? (
                <div className="space-y-3">
                  <p className="text-forest-500 text-xs uppercase tracking-wider font-semibold">Clientes na mesa</p>
                  <div className="space-y-2">
                    {(clientesPorMesa.get(modalMesa.id) ?? []).map((cliente) => (
                      <button
                        key={cliente.nome}
                        type="button"
                        onClick={() => irAoCardapioComCliente(cliente.nome, cliente.telefone)}
                        className="w-full flex items-center gap-3 px-4 py-3 glass rounded-xl border border-forest-200/40 hover:border-gold-500/40 transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-forest-700 flex items-center justify-center shrink-0">
                          <UserRound className="w-4 h-4 text-gold-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-forest-900 text-sm truncate">{cliente.nome}</p>
                          {cliente.telefone && (
                            <p className="text-forest-500 text-xs">{cliente.telefone}</p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-forest-500 shrink-0" />
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalStep("novo")}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-forest-600 hover:border-gold-500 text-forest-500 hover:text-forest-900 transition-colors text-sm font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar novo cliente
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {(clientesPorMesa.get(modalMesa.id) ?? []).length > 0 && (
                    <button
                      type="button"
                      onClick={() => setModalStep("selecionar")}
                      className="flex items-center gap-1 text-forest-500 text-xs hover:text-forest-900 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Voltar para clientes da mesa
                    </button>
                  )}
                  <div>
                    <label className="text-forest-500 text-xs font-medium flex items-center gap-1 mb-1">
                      <UserRound className="w-3 h-3" /> Nome do cliente *
                    </label>
                    <input
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && confirmarEIrAoCardapio()}
                      placeholder="João Silva"
                      className="input-field"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="text-forest-500 text-xs font-medium flex items-center gap-1 mb-1">
                      <Phone className="w-3 h-3" /> Telefone do cliente *
                    </label>
                    <input
                      value={clienteTel}
                      onChange={(e) => setClienteTel(formatarTelefone(e.target.value))}
                      onKeyDown={(e) => e.key === "Enter" && confirmarEIrAoCardapio()}
                      placeholder="(00) 00000-0000"
                      type="tel"
                      inputMode="numeric"
                      className="input-field"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={confirmarEIrAoCardapio}
                    disabled={!clienteNome.trim() || !clienteTel.trim()}
                    className="btn-gold w-full py-3 rounded-xl disabled:opacity-50"
                  >
                    Ir ao cardápio
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
