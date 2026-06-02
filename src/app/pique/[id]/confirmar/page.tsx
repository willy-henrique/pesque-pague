"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronLeft, Fish, Send, CheckCircle2, PartyPopper } from "lucide-react";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import toast from "react-hot-toast";

export default function Confirmar() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart   = useCart();

  const [obsGeral, setObsGeral]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [pedidoId, setPedidoId]   = useState<string | null>(null);

  const handleEnviar = async () => {
    if (cart.items.length === 0) return;

    setLoading(true);
    try {
      const ref = await addDoc(collection(db, "pedidos"), {
        piqueId:         cart.piqueId ?? id,
        piqueNome:       cart.piqueNome ?? `Mesa ${id}`,
        itens:           cart.items,
        observacaoGeral: obsGeral.trim(),
        total:           cart.total(),
        status:          "novo",
        criadoEm:        serverTimestamp(),
        atualizadoEm:    serverTimestamp(),
      });

      await updateDoc(doc(db, "piques", cart.piqueId ?? id), {
        status: "ocupado",
      });

      cart.clearCart();
      setPedidoId(ref.id);
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
      setLoading(false);
    }
  };

  if (cart.items.length === 0 && !pedidoId) {
    router.replace(`/pique/${id}/cardapio`);
    return null;
  }

  // Tela de sucesso
  if (pedidoId) {
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center px-6"
        style={{ background: "radial-gradient(ellipse at top, #1a3a2a 0%, #061208 70%)" }}
      >
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14, stiffness: 200 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm w-full"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2d6a4f, #1a3a2a)", boxShadow: "0 0 60px rgba(45,106,79,0.4)" }}
          >
            <PartyPopper className="w-10 h-10 text-gold-500" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="font-display text-3xl font-bold gradient-gold-text mb-2">
              Pedido enviado!
            </h1>
            <p className="text-forest-300 text-sm leading-relaxed">
              Seu pedido foi recebido e já está sendo preparado.
              <br />
              Acompanhe o status em tempo real.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="w-full flex flex-col gap-3"
          >
            <button
              onClick={() => router.push(`/pedido/${pedidoId}`)}
              className="btn-gold w-full py-4 rounded-2xl text-base"
            >
              <CheckCircle2 className="w-5 h-5" />
              Acompanhar pedido
            </button>
            <button
              onClick={() => router.push(`/pique/${id}/comanda`)}
              className="btn-ghost w-full py-3 rounded-2xl text-sm"
            >
              Ver comanda do dia
            </button>
          </motion.div>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "#061208" }}>
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
            <p className="font-semibold text-forest-100">{cart.piqueNome ?? `Mesa ${id}`}</p>
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
                <span className="flex-1 text-forest-100 text-sm">{item.nome}</span>
                {item.obs && (
                  <span className="text-forest-500 text-xs italic truncate max-w-[100px]">
                    {item.obs}
                  </span>
                )}
                <span className="text-forest-300 text-sm font-medium">
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

        {/* Aviso pagamento */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-2xl px-4 py-3 border border-gold-500/10"
        >
          <p className="text-forest-300 text-sm text-center leading-relaxed">
            O pagamento de{" "}
            <span className="gradient-gold-text font-bold">{formatCurrency(cart.total())}</span>
            {" "}será realizado no caixa ao encerrar sua pescaria.
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
