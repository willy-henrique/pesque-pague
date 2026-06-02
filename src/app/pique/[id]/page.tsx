"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Fish, ChevronRight, MapPin, Receipt, MoonStar, LockKeyhole } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/store/cart";
import type { Pique, Config } from "@/types";
import { useState } from "react";
import { getBrasiliaDateKey } from "@/lib/utils";

export default function PiqueLanding() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const setPique = useCart((s) => s.setPique);

  const [pique, setPiqueData]   = useState<Pique | null>(null);
  const [config, setConfig]     = useState<Config | null>(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fechado, setFechado]   = useState(false);
  const [senhaReserva, setSenhaReserva] = useState("");
  const [reservaLiberada, setReservaLiberada] = useState(false);

  useEffect(() => {
    async function load() {
      const [piqueSnap, configSnap] = await Promise.all([
        getDoc(doc(db, "piques", id)),
        getDoc(doc(db, "config", "geral")),
      ]);

      if (!piqueSnap.exists() || !piqueSnap.data().ativo || piqueSnap.data().status === "bloqueado") {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const piqueData = { id: piqueSnap.id, ...piqueSnap.data() } as Pique;
      setPiqueData(piqueData);
      setPique(piqueData.id, piqueData.nome || `Mesa ${piqueData.numero}`);
      const senhaSalva = sessionStorage.getItem(`reserva-auth-${piqueData.id}`);
      if (senhaSalva && piqueData.reserva?.telefone && senhaSalva === piqueData.reserva.telefone) {
        setReservaLiberada(true);
      }

      if (configSnap.exists()) {
        const cfg = configSnap.data() as Config;
        setConfig(cfg);
        if (cfg.modoManutencao) {
          setFechado(true);
          setLoading(false);
          return;
        }
      }

      setLoading(false);
    }
    load();
  }, [id, setPique]);

  if (loading) return <LandingSkeleton />;

  if (fechado) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center p-8 text-center"
        style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
      >
        <MoonStar className="w-14 h-14 text-forest-600 mb-5" />
        <h1 className="font-display text-2xl font-bold text-forest-700 mb-2">
          {config?.nomeEstabelecimento ?? "Estabelecimento"}
        </h1>
        <p className="text-forest-400 text-base font-medium mb-1">Estamos fechados no momento</p>
        <p className="text-forest-600 text-sm">Volte em breve ou fale com um atendente.</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center">
        <Fish className="w-16 h-16 text-forest-500 mb-4 animate-float" />
        <h1 className="font-display text-2xl text-gold-500 mb-2">Mesa não encontrada</h1>
        <p className="text-forest-600">Verifique o QR Code ou fale com um atendente.</p>
      </div>
    );
  }

  const nomePique = pique?.nome || `Mesa ${pique?.numero}`;
  const reservaAtivaHoje =
    pique?.status === "reservado" &&
    !!pique.reserva &&
    pique.reserva.data === getBrasiliaDateKey();
  const reservaFutura =
    pique?.status === "reservado" &&
    !!pique.reserva &&
    pique.reserva.data !== getBrasiliaDateKey();

  const liberarReserva = () => {
    if (!pique?.reserva) return;
    if (senhaReserva.trim() !== pique.reserva.telefone.trim()) return;
    sessionStorage.setItem(`reserva-auth-${pique.id}`, senhaReserva.trim());
    setReservaLiberada(true);
  };

  if (reservaAtivaHoje && !reservaLiberada) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6"
        style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}>
        <div className="glass rounded-3xl p-6 w-full max-w-sm space-y-4">
          <div className="text-center">
            <LockKeyhole className="w-8 h-8 text-gold-500 mx-auto mb-2" />
            <p className="text-forest-500 text-xs uppercase tracking-widest">Reserva ativa</p>
            <h1 className="font-display text-2xl font-bold gradient-gold-text mt-1">
              {pique.reserva?.nome}
            </h1>
            <p className="text-forest-500 text-sm mt-1">
              Informe o telefone da reserva para abrir a comanda.
            </p>
          </div>

          <input
            value={senhaReserva}
            onChange={(e) => setSenhaReserva(e.target.value)}
            placeholder="Telefone da reserva"
            className="input-field"
          />

          <button onClick={liberarReserva} className="btn-gold w-full py-3 rounded-2xl">
            Entrar na reserva
          </button>
        </div>
      </main>
    );
  }

  if (reservaFutura) {
    return (
      <main className="min-h-dvh flex items-center justify-center px-6"
        style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}>
        <div className="glass rounded-3xl p-6 w-full max-w-sm text-center">
          <LockKeyhole className="w-8 h-8 text-gold-500 mx-auto mb-2" />
          <p className="text-forest-500 text-xs uppercase tracking-widest">Mesa reservada</p>
          <h1 className="font-display text-2xl font-bold gradient-gold-text mt-1">
            {pique?.reserva?.nome}
          </h1>
          <p className="text-forest-500 text-sm mt-2">
            Esta reserva abre em {pique?.reserva?.data}.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-dvh flex flex-col"
      style={{
        background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)",
      }}
    >
      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(14,165,233,0.1) 0%, transparent 70%)" }}
      />

      <div className="relative flex flex-col items-center justify-center flex-1 px-6 py-16 gap-10">
        {/* Logo area */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)",
              boxShadow: "0 0 32px rgba(15,118,110,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          >
            <Fish className="w-10 h-10 text-gold-500" />
          </div>
          <div className="text-center">
            <p className="text-forest-600 text-sm tracking-widest uppercase font-semibold">
              {config?.nomeEstabelecimento ?? "WillTech Pesqueiros"}
            </p>
          </div>
        </motion.div>

        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="glass rounded-3xl p-8 w-full max-w-sm text-center"
        >
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-gold-500" />
            <span className="text-forest-600 text-sm font-medium tracking-wide uppercase">
              Você está em
            </span>
          </div>
          <h1 className="font-display text-4xl font-bold gradient-gold-text mb-2">
            {nomePique}
          </h1>
          <p className="text-forest-700 text-sm leading-relaxed">
            Faça seu pedido pelo celular e receba direto na sua mesa.
            <br />
            <span className="text-bark-300">Pagamento no caixa ao finalizar.</span>
          </p>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="w-full max-w-sm flex flex-col gap-3"
        >
          <button
            onClick={() => router.push(`/pique/${id}/cardapio`)}
            className="btn-gold w-full py-4 text-lg rounded-2xl"
          >
            <Fish className="w-5 h-5" />
            Ver Cardápio
            <ChevronRight className="w-5 h-5 ml-auto" />
          </button>

          <button
            onClick={() => router.push(`/pique/${id}/comanda`)}
            className="btn-ghost w-full py-3.5 text-base rounded-2xl"
          >
            <Receipt className="w-5 h-5" />
            Minha Comanda do Dia
          </button>
        </motion.div>

        {/* Fish deco */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-8 right-8 opacity-10"
        >
          <Fish className="w-24 h-24 text-forest-600" />
        </motion.div>
      </div>
    </main>
  );
}

function LandingSkeleton() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-8 p-8"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}>
      <div className="skeleton-pulse w-20 h-20 rounded-2xl" />
      <div className="glass rounded-3xl p-8 w-full max-w-sm space-y-4">
        <div className="skeleton-pulse h-4 w-32 mx-auto rounded" />
        <div className="skeleton-pulse h-10 w-48 mx-auto rounded" />
        <div className="skeleton-pulse h-4 w-full rounded" />
        <div className="skeleton-pulse h-4 w-3/4 mx-auto rounded" />
      </div>
      <div className="skeleton-pulse h-14 w-full max-w-sm rounded-2xl" />
    </div>
  );
}
