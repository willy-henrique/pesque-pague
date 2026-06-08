"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Fish, Send, CheckCircle2 } from "lucide-react";
import { useModoAtendenteAuth } from "@/hooks/useModoAtendenteAuth";
import { useDocument } from "@/hooks/useFirestore";
import { serializeCartItems } from "@/lib/pedidos";
import { useCart } from "@/store/cart";
import { apiFetch } from "@/lib/auth-api";
import { formatCurrency } from "@/lib/utils";
import type { Pique } from "@/types";
import toast from "react-hot-toast";

export default function Confirmar() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { modoAtendente } = useModoAtendenteAuth();
  const cart   = useCart();
  const { data: pique } = useDocument<Pique>("piques", id);

  const [obsGeral, setObsGeral]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [mounted, setMounted]     = useState(false);

  const clienteNomeParam = searchParams.get("clienteNome") ?? "";
  const clienteTelParam = searchParams.get("clienteTelefone") ?? "";
  const piqueNome = cart.piqueNome ?? pique?.nome ?? (pique?.numero ? `Mesa ${pique.numero}` : "Mesa");

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (mounted && cart.items.length === 0) {
      router.replace(`/pique/${id}/cardapio`);
    }
  }, [mounted, cart.items.length, id, router]);

  const handleEnviar = async () => {
    if (cart.items.length === 0) return;

    const piqueId = cart.piqueId ?? id;
    let cliente: { nome: string; telefone: string };

    if (modoAtendente && clienteNomeParam) {
      cliente = { nome: clienteNomeParam, telefone: clienteTelParam };
    } else {
      const raw = sessionStorage.getItem(`cliente-${piqueId}`);
      cliente = raw ? (JSON.parse(raw) as { nome: string; telefone: string }) : { nome: "", telefone: "" };
    }

    setLoading(true);
    try {
      const response = await apiFetch("/api/pedidos", {
        method: "POST",
        body: JSON.stringify({
          piqueId,
          piqueNome,
          nomeCliente:     cliente.nome,
          telefoneCliente: cliente.telefone,
          itens:           serializeCartItems(cart.items),
          observacaoGeral: obsGeral.trim(),
        }),
      });

      cart.clearCart();
      toast.success("Pedido enviado ao PDV.");
      const sucessoBase = `/pique/${id}/enviado?pedido=${encodeURIComponent(response.id)}`;
      if (modoAtendente) {
        const params = new URLSearchParams({
          modo: "atendente",
          pedido: response.id,
        });
        if (clienteNomeParam) params.set("clienteNome", clienteNomeParam);
        if (clienteTelParam) params.set("clienteTelefone", clienteTelParam);
        router.replace(`/pique/${id}/enviado?${params.toString()}`);
      } else {
        router.replace(sucessoBase);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar pedido. Tente novamente.");
      setLoading(false);
    }
  };

  if (!mounted || cart.items.length === 0) return null;

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "#F8FAFC" }}>
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-4 max-w-xl mx-auto">
          <button onClick={() => router.back()} className="btn-ghost p-2 rounded-xl">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="font-display text-lg font-semibold text-gold-400">Revisar Pedido</h1>
            <p className="text-forest-400 text-xs">Confirme antes de enviar</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-5 max-w-xl mx-auto w-full space-y-4">
        {/* Mesa info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl px-4 py-3 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-forest-700 flex items-center justify-center">
            <Fish className="w-5 h-5 text-gold-500" />
          </div>
          <div>
            <p className="text-forest-400 text-xs">Entrega no</p>
            <p className="font-semibold text-forest-900">{piqueNome}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-forest-400 ml-auto" />
        </motion.div>

        {/* Itens resumo */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/[0.06]">
            <h2 className="font-display font-semibold text-gold-400">
              {cart.count()} {cart.count() === 1 ? "item" : "itens"}
            </h2>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {cart.items.map((item) => (
              <div key={item.produtoId} className="flex items-center gap-3 px-4 py-3">
                <span className="text-gold-500 font-bold text-sm w-6">{item.quantidade}×</span>
                <span className="flex-1 text-forest-900 text-sm">{item.nome}</span>
                {item.obs && (
                  <span className="text-forest-500 text-xs italic truncate max-w-[100px]">
                    {item.obs}
                  </span>
                )}
                <span className="text-forest-700 text-sm font-medium">
                  {formatCurrency(item.preco * item.quantidade)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Observação geral */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-2"
        >
          <label className="text-forest-300 text-sm font-medium flex items-center gap-1.5">
            Observação geral
            <span className="text-forest-600 text-xs">(opcional)</span>
          </label>
          <textarea
            value={obsGeral}
            onChange={(e) => setObsGeral(e.target.value)}
            placeholder="Alguma observação para o pedido todo?"
            maxLength={200}
            rows={3}
            className="input-field resize-none"
          />
        </motion.div>

        {/* Aviso de envio */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl px-4 py-3 border border-gold-500/10"
        >
          <p className="text-forest-300 text-sm text-center leading-relaxed">
            Total do pedido:{" "}
            <span className="gradient-gold-text font-bold">{formatCurrency(cart.total())}</span>
            {" "}• ao confirmar, ele segue direto para o PDV.
          </p>
        </motion.div>
      </div>

      {/* CTA */}
      <div className="sticky bottom-0 p-4 max-w-xl mx-auto w-full">
        <button
          onClick={handleEnviar}
          disabled={loading}
          className="btn-gold w-full py-4 rounded-2xl text-base disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-forest-900 border-t-transparent rounded-full animate-spin" />
              Enviando...
            </span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Enviar Pedido
            </>
          )}
        </button>
      </div>
    </main>
  );
}
