"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardPlus, Fish, LogOut, Receipt, UserRound, Phone, X, BellRing, ChefHat, GlassWater } from "lucide-react";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { useRequireAtendente } from "@/hooks/useRequireAtendente";
import { auth } from "@/lib/firebase";
import { withModoAtendente } from "@/lib/atendente";
import { getSetoresDoPedido, getSetoresProntos, getStatusGeralPedido, isPedidoProntoParaRetirada } from "@/lib/pedido-status";
import type { Pique, Pedido } from "@/types";
import toast from "react-hot-toast";

export default function AtendentePage() {
  const router = useRouter();
  const { usuario } = useRequireAtendente();
  const { data: piques, loading } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);
  const { data: pedidos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "asc")]);

  const [modalMesa, setModalMesa] = useState<Pique | null>(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTel, setClienteTel] = useState("");

  const handleLogout = async () => {
    await signOut(auth);
    toast.success("Sessão encerrada.");
    router.replace("/atendente/login");
  };

  const abrirModal = (mesa: Pique) => {
    setClienteNome("");
    setClienteTel("");
    setModalMesa(mesa);
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
  const prontos = pedidos.filter((pedido) => {
    if (isPedidoProntoParaRetirada(pedido)) return true;
    return getStatusGeralPedido(pedido) === "saiu";
  });
  const clientesPorMesa = useMemo(() => {
    const mapa = new Map<string, string[]>();

    for (const pedido of pedidos) {
      if (pedido.status === "pago" || pedido.status === "cancelado") continue;
      const nome = pedido.nomeCliente?.trim();
      if (!nome) continue;

      const atual = mapa.get(pedido.piqueId) ?? [];
      if (!atual.includes(nome)) atual.push(nome);
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
                <p className="text-forest-500 text-xs truncate mt-0.5">{usuario.nome}</p>
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
                        Cliente{clientesMesa.length > 1 ? "s" : ""}: {clientesMesa.join(", ")}
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

      {/* Modal de identificação manual do cliente */}
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
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-5 border border-forest-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-forest-900 text-lg">Identificar cliente</h2>
                  <p className="text-forest-500 text-xs mt-0.5">
                    {modalMesa.nome || `Mesa ${modalMesa.numero}`}
                  </p>
                </div>
                <button type="button" onClick={() => setModalMesa(null)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
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
                    onChange={(e) => setClienteTel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && confirmarEIrAoCardapio()}
                    placeholder="(00) 00000-0000"
                    type="tel"
                    className="input-field"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={confirmarEIrAoCardapio}
                disabled={!clienteNome.trim() || !clienteTel.trim()}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-50"
              >
                Ir ao cardápio
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
