"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Fish, MonitorCog, Smartphone, UserRound } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Config } from "@/types";

export default function RootPage() {
  const [config, setConfig] = useState<Config | null>(null);

  useEffect(() => {
    getDoc(doc(db, "config", "geral")).then((snap) => {
      if (snap.exists()) setConfig(snap.data() as Config);
    });
  }, []);

  return (
    <main
      className="min-h-dvh flex items-center justify-center px-5 py-10"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
    >
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Identidade visual */}
        <div className="flex flex-col items-center gap-4">
          {config?.logoUrl ? (
            <div
              className="w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center shadow-gold-glow"
              style={{ background: "rgba(15,118,110,0.08)", border: "1.5px solid rgba(15,118,110,0.15)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logoUrl}
                alt={config.nomeEstabelecimento}
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-forest-700 flex items-center justify-center shadow-gold-glow">
              <Fish className="w-10 h-10 text-gold-500" />
            </div>
          )}

          <div>
            {config?.nomeEstabelecimento && (
              <p className="font-display text-xl font-bold text-forest-900 leading-tight">
                {config.nomeEstabelecimento}
              </p>
            )}
            <p className="text-forest-500 text-xs uppercase tracking-widest font-semibold mt-1">
              WillTech Pesqueiros
            </p>
            <h1 className="font-display text-3xl font-bold gradient-gold-text mt-2">
              Pesque Pague
            </h1>
          </div>
        </div>

        {/* Navegação */}
        <div className="grid gap-3">
          <Link href="/app" className="btn-gold w-full py-4 rounded-2xl text-base">
            <Smartphone className="w-5 h-5" />
            Aplicativo
          </Link>
          <Link href="/atendente" className="btn-ghost w-full py-4 rounded-2xl text-base">
            <UserRound className="w-5 h-5" />
            Atendente
          </Link>
          <Link href="/admin/login" className="btn-ghost w-full py-4 rounded-2xl text-base">
            <MonitorCog className="w-5 h-5" />
            ERP
          </Link>
        </div>
      </div>
    </main>
  );
}
