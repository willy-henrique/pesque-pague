"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Fish, Plus, Receipt } from "lucide-react";
import { useModoAtendenteAuth } from "@/hooks/useModoAtendenteAuth";
import { useDocument } from "@/hooks/useFirestore";
import { withModoAtendente } from "@/lib/atendente";
import type { Pique } from "@/types";

export default function PedidoEnviadoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { modoAtendente } = useModoAtendenteAuth();
  const { data: pique } = useDocument<Pique>("piques", id);

  const pedidoId = searchParams.get("pedido") ?? "";
  const clienteNomeParam = searchParams.get("clienteNome") ?? "";
  const clienteTelParam = searchParams.get("clienteTelefone") ?? "";
  const piqueNome = pique?.nome ?? (pique?.numero ? `Mesa ${pique.numero}` : "sua mesa");

  useEffect(() => {
    if (pedidoId) return;
    router.replace(modoAtendente ? withModoAtendente(`/pique/${id}/comanda`) : `/pique/${id}/cardapio`);
  }, [id, modoAtendente, pedidoId, router]);

  if (!pedidoId) return null;

  const cardapioHref = (() => {
    if (!modoAtendente) return `/pique/${id}/cardapio`;
    const params = new URLSearchParams({ modo: "atendente" });
    if (clienteNomeParam) params.set("clienteNome", clienteNomeParam);
    if (clienteTelParam) params.set("clienteTelefone", clienteTelParam);
    return `/pique/${id}/cardapio?${params.toString()}`;
  })();

  const comandaHref = modoAtendente ? withModoAtendente(`/pique/${id}/comanda`) : `/pique/${id}/comanda`;

  return (
    <main
      className="min-h-dvh flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 65%)" }}
    >
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-3xl p-6 w-full max-w-md text-center border border-forest-200/70"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>

        <p className="text-forest-500 text-xs uppercase tracking-[0.22em]">Pedido confirmado</p>
        <h1 className="font-display text-2xl font-bold text-forest-900 mt-2">Pedido enviado</h1>
        <p className="text-forest-500 text-sm mt-3">
          O pedido da {piqueNome} foi registrado com sucesso e encaminhado para atendimento.
        </p>

        <div className="grid gap-3 mt-6">
          <button
            type="button"
            onClick={() => router.push(cardapioHref)}
            className="btn-gold w-full py-3.5 rounded-2xl text-base"
          >
            <Plus className="w-5 h-5" />
            Novo pedido
          </button>
          <button
            type="button"
            onClick={() => router.push(comandaHref)}
            className="btn-ghost w-full py-3.5 rounded-2xl text-base"
          >
            <Receipt className="w-5 h-5" />
            Ver comanda
          </button>
          {modoAtendente && (
            <button
              type="button"
              onClick={() => router.push("/atendente")}
              className="btn-ghost w-full py-3.5 rounded-2xl text-base"
            >
              <Fish className="w-5 h-5" />
              Voltar para mesas
            </button>
          )}
        </div>
      </motion.section>
    </main>
  );
}
