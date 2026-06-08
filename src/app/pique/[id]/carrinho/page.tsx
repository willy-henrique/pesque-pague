"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Minus, Plus, Trash2, ShoppingCart, Fish, MessageSquare, Receipt } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import toast from "react-hot-toast";
import { useCart } from "@/store/cart";
import { serializeCartItems } from "@/lib/pedidos";
import { useModoAtendenteAuth } from "@/hooks/useModoAtendenteAuth";
import { withModoAtendente } from "@/lib/atendente";
import { apiFetch } from "@/lib/auth-api";
import { useDocument } from "@/hooks/useFirestore";
import { formatCurrency } from "@/lib/utils";
import type { Pique } from "@/types";

export default function Carrinho() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const searchParams = useSearchParams();
  const { modoAtendente } = useModoAtendenteAuth();
  const cart    = useCart();
  const { data: pique } = useDocument<Pique>("piques", id);

  // Em modo atendente, a identificação vem dos query params (lançado manualmente)
  const clienteNomeParam = searchParams.get("clienteNome") ?? "";
  const clienteTelParam  = searchParams.get("clienteTelefone") ?? "";
  const piqueNome = cart.piqueNome ?? pique?.nome ?? (pique?.numero ? `Mesa ${pique.numero}` : "Mesa");

  const cardapioHref = withModoAtendente(`/pique/${id}/cardapio`);
  const comandaHref = withModoAtendente(`/pique/${id}/comanda`);
  const [obsAberta, setObsAberta] = useState<string | null>(null);
  const [obsGeral, setObsGeral] = useState("");
  const [enviando, setEnviando] = useState(false);

  const isEmpty = cart.items.length === 0;

  const handleEnviarPedido = async () => {
    if (isEmpty || enviando) return;

    const piqueId = cart.piqueId ?? id;

    // Modo atendente: usa params de URL; modo cliente: usa sessionStorage
    let cliente: { nome: string; telefone: string };
    if (modoAtendente && clienteNomeParam) {
      cliente = { nome: clienteNomeParam, telefone: clienteTelParam };
    } else {
      const raw = sessionStorage.getItem(`cliente-${piqueId}`);
      cliente = raw ? (JSON.parse(raw) as { nome: string; telefone: string }) : { nome: "", telefone: "" };
    }
    if (modoAtendente) {
      if (!cliente.nome.trim()) return toast.error("Informe o nome do cliente para o pedido.");
      if (!cliente.telefone.trim()) return toast.error("Informe o telefone do cliente para o pedido.");
    }

    setEnviando(true);
    try {
      const response = await apiFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({
          piqueId,
          piqueNome,
          nomeCliente: cliente.nome,
          telefoneCliente: cliente.telefone,
          itens: serializeCartItems(cart.items),
          observacaoGeral: obsGeral.trim(),
        }),
      });

      cart.clearCart();
      toast.success("Pedido enviado ao PDV.");
      if (modoAtendente) {
        const params = new URLSearchParams({
          modo: "atendente",
          pedido: response.id,
        });
        if (clienteNomeParam) params.set("clienteNome", clienteNomeParam);
        if (clienteTelParam) params.set("clienteTelefone", clienteTelParam);
        router.replace(`/pique/${id}/enviado?${params.toString()}`);
      } else {
        router.replace(`/pique/${id}/enviado?pedido=${encodeURIComponent(response.id)}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar pedido. Tente novamente.");
      setEnviando(false);
    }
  };

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-4 max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => router.push(cardapioHref)}
            className="btn-ghost p-2 rounded-xl"
            aria-label="Voltar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold text-gold-400">Seu carrinho</h1>
            <p className="text-forest-400 text-xs">
              {cart.count() > 0 ? `${cart.count()} ${cart.count() === 1 ? "item" : "itens"}` : "Vazio"}
            </p>
          </div>
          <button
            onClick={() => router.push(comandaHref)}
            className="btn-ghost px-3 py-2 rounded-xl text-sm"
            title="Minha Comanda"
          >
            <Receipt className="w-5 h-5" />
          </button>
          {!isEmpty && (
            <button
              onClick={cart.clearCart}
              className="text-forest-9000 hover:text-red-400 transition-colors p-2"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 px-4 py-4 max-w-xl mx-auto w-full">
        <AnimatePresence mode="popLayout">
          {isEmpty ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-24 gap-5 text-center"
            >
              <div className="w-20 h-20 rounded-full glass flex items-center justify-center">
                <ShoppingCart className="w-8 h-8 text-forest-9000" />
              </div>
              <div>
                <h2 className="font-display text-xl text-forest-900 mb-1">Carrinho vazio</h2>
                <p className="text-forest-400 text-sm">Adicione itens do cardápio para continuar.</p>
              </div>
              <button
                onClick={() => router.push(cardapioHref)}
                className="btn-gold px-6 py-3 rounded-2xl"
              >
                <Fish className="w-4 h-4" />
                Ver Cardápio
              </button>
            </motion.div>
          ) : (
            <motion.div key="list" className="space-y-3">
              {cart.items.map((item) => (
                <motion.div
                  key={item.produtoId}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.25 }}
                  className="glass rounded-2xl overflow-hidden"
                >
                  <div className="flex gap-3 p-3">
                    {/* Foto */}
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-forest-800">
                      {item.fotoUrl ? (
                        <Image src={item.fotoUrl} alt={item.nome} fill className="object-cover" sizes="64px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Fish className="w-6 h-6 text-forest-600" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-forest-900 text-sm leading-tight truncate">
                        {item.nome}
                      </h3>
                      {item.adicionaisSelecionados?.map((ad, i) => (
                        <p key={i} className="text-forest-400 text-xs leading-tight">
                          + {ad.nome} ({formatCurrency(ad.preco)})
                        </p>
                      ))}
                      <p className="gradient-gold-text font-bold text-sm mt-0.5">
                        {formatCurrency(item.preco * item.quantidade)}
                      </p>
                      {item.quantidade > 1 && (
                        <p className="text-forest-500 text-xs">
                          {item.quantidade}× {formatCurrency(item.preco)}
                        </p>
                      )}
                    </div>

                    {/* Qty controls */}
                    <div className="flex flex-col items-end justify-between gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => cart.updateQty(item.produtoId, item.quantidade - 1)}
                          className="btn-ghost p-1 rounded-lg w-7 h-7 justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-gold-400 font-bold text-sm w-6 text-center">
                          {item.quantidade}
                        </span>
                        <button
                          onClick={() => cart.updateQty(item.produtoId, item.quantidade + 1)}
                          className="btn-gold p-1 rounded-lg w-7 h-7 justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <button
                        onClick={() => setObsAberta(obsAberta === item.produtoId ? null : item.produtoId)}
                        className="flex items-center gap-1 text-forest-400 hover:text-forest-900 text-xs transition-colors"
                      >
                        <MessageSquare className="w-3 h-3" />
                        {item.obs ? "obs." : "add obs."}
                      </button>
                    </div>
                  </div>

                  {/* Obs input */}
                  <AnimatePresence>
                    {obsAberta === item.produtoId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 border-t border-white/[0.06]">
                          <input
                            type="text"
                            value={item.obs}
                            onChange={(e) => cart.updateObs(item.produtoId, e.target.value)}
                            placeholder="Ex: sem gelo, bem passado..."
                            maxLength={100}
                            className="input-field mt-2 py-2 text-sm"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      {!isEmpty && (
        <div className="sticky bottom-0 p-4 max-w-xl mx-auto w-full">
          <div className="glass rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-forest-300 font-medium">Total</span>
              <span className="gradient-gold-text font-bold text-xl font-display">
                {formatCurrency(cart.total())}
              </span>
            </div>
            <div className="section-divider" />
            <div className="space-y-1">
              <label className="text-forest-400 text-xs">Observação geral (opcional)</label>
              <textarea
                value={obsGeral}
                onChange={(e) => setObsGeral(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Alguma observação para o pedido?"
                className="input-field resize-none text-sm"
              />
            </div>
            <p className="text-forest-9000 text-xs text-center">
              Ao enviar, o pedido segue direto para o PDV.
            </p>
            <button
              onClick={handleEnviarPedido}
              disabled={enviando}
              className="btn-gold w-full py-3.5 rounded-xl text-base disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {enviando ? "Enviando..." : "Enviar Pedido"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
