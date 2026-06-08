"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Fish, MapPin, MoonStar, Users } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import type { Config, Pique } from "@/types";

const DEFAULT_CONFIG: Config = {
  nomeEstabelecimento: "Confraria do Peixe",
  logoUrl: "",
  modoManutencao: false,
};

export default function AppCliente() {
  const { data: piques, loading } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);

  useEffect(() => {
    getDoc(doc(db, "config", "geral")).then((snap) => {
      if (snap.exists()) setConfig({ ...DEFAULT_CONFIG, ...(snap.data() as Config) });
    });
  }, []);

  const mesas = useMemo(
    () => piques.filter((p) => p.ativo && (p.status ?? "livre") !== "bloqueado"),
    [piques]
  );

  if (config.modoManutencao) {
    return (
      <main
        className="min-h-dvh flex flex-col items-center justify-center p-8 text-center"
        style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
      >
        <MoonStar className="w-14 h-14 text-forest-600 mb-5" />
        <h1 className="font-display text-2xl font-bold text-forest-800 mb-2">
          {config.nomeEstabelecimento}
        </h1>
        <p className="text-forest-400 text-base font-medium mb-1">Estamos fechados no momento</p>
        <p className="text-forest-600 text-sm">Volte em breve ou fale com um atendente.</p>
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh px-5 py-8"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
    >
      <div className="max-w-xl mx-auto space-y-6">
        <header className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-forest-700 flex items-center justify-center mx-auto">
            <Fish className="w-8 h-8 text-gold-500" />
          </div>
          <div>
            <p className="text-forest-300 text-sm uppercase tracking-widest font-semibold">
              {config.nomeEstabelecimento}
            </p>
            <h1 className="font-display text-3xl font-bold gradient-gold-text mt-2">
              Escolha sua mesa
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton-pulse h-20 rounded-2xl" />
            ))}
          </div>
        ) : mesas.length === 0 ? (
          <div className="glass rounded-2xl px-5 py-10 text-center">
            <MapPin className="w-10 h-10 text-forest-700 mx-auto mb-3" />
            <p className="text-forest-300 font-semibold">Nenhuma mesa disponível</p>
            <p className="text-forest-600 text-sm mt-1">Fale com um atendente.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {mesas.map((mesa, i) => (
              <motion.div
                key={mesa.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/pique/${mesa.id}`} className="glass glass-hover rounded-2xl p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-forest-800 flex flex-col items-center justify-center shrink-0">
                    <span className="font-display font-black text-gold-400 text-lg leading-none">
                      {mesa.numero}
                    </span>
                    {mesa.capacidade && (
                      <span className="text-forest-600 text-[10px] flex items-center gap-0.5 mt-1">
                        <Users className="w-2.5 h-2.5" />
                        {mesa.capacidade}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="font-semibold text-forest-900 truncate">
                      {mesa.nome || `Mesa ${mesa.numero}`}
                    </p>
                    <p className="text-forest-9000 text-sm mt-0.5">
                      {mesa.status === "reservado" && mesa.reserva?.nome
                        ? `Reservado para ${mesa.reserva.nome}`
                        : "Abrir cardápio"}
                    </p>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
