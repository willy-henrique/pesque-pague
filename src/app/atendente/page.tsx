"use client";

import Link from "next/link";
import { ClipboardPlus, Fish, Receipt, UserRound } from "lucide-react";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import type { Pique } from "@/types";

export default function AtendentePage() {
  const { data: piques, loading } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);

  const mesasDisponiveis = piques.filter(
    (p) => p.ativo && (p.status ?? "livre") !== "bloqueado"
  );

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
            <div>
              <p className="text-forest-400 text-xs uppercase tracking-widest">Aplicativo Web</p>
              <h1 className="font-display text-2xl font-bold gradient-gold-text">Atendente</h1>
            </div>
          </div>
          <p className="text-forest-300 text-sm mt-4">
            Se o cliente pedir direto ao atendente, selecione a mesa e lance o pedido por aqui.
          </p>
        </header>

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
            {mesasDisponiveis.map((mesa) => (
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
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={`/pique/${mesa.id}/cardapio`}
                    className="btn-gold py-2.5 rounded-xl text-sm"
                  >
                    <ClipboardPlus className="w-4 h-4" />
                    Novo pedido
                  </Link>
                  <Link
                    href={`/pique/${mesa.id}/comanda`}
                    className="btn-ghost py-2.5 rounded-xl text-sm"
                  >
                    <Receipt className="w-4 h-4" />
                    Comanda
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
