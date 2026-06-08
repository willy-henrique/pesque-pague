"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Fish, ChevronRight, MapPin, Receipt, MoonStar, LockKeyhole, UserRound, Phone } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCart } from "@/store/cart";
import type { Pique, Config } from "@/types";
import { useState } from "react";
import { getBrasiliaDateKey } from "@/lib/utils";

const CLIENTE_KEY = (piqueId: string) => `cliente-${piqueId}`;

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
  const [clienteIdentificado, setClienteIdentificado] = useState(false);
  const [nomeForm, setNomeForm] = useState("");
  const [telefoneForm, setTelefoneForm] = useState("");

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
        // reserva já identifica o cliente — salva automaticamente
        sessionStorage.setItem(
          CLIENTE_KEY(piqueData.id),
          JSON.stringify({ nome: piqueData.reserva.nome, telefone: piqueData.reserva.telefone })
        );
        setClienteIdentificado(true);
      }

      if (sessionStorage.getItem(CLIENTE_KEY(piqueData.id))) {
        setClienteIdentificado(true);
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
    sessionStorage.setItem(
      CLIENTE_KEY(pique.id),
      JSON.stringify({ nome: pique.reserva.nome, telefone: pique.reserva.telefone })
    );
    setReservaLiberada(true);
    setClienteIdentificado(true);
  };

  const confirmarIdentificacao = () => {
    if (!nomeForm.trim() || !telefoneForm.trim()) return;
    if (!pique) return;
    sessionStorage.setItem(
      CLIENTE_KEY(pique.id),
      JSON.stringify({ nome: nomeForm.trim(), telefone: telefoneForm.trim() })
    );
    setClienteIdentificado(true);
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

  if (!clienteIdentificado) {
    return (
      <main
        className="min-h-dvh flex items-center justify-center px-6"
        style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-3xl p-6 w-full max-w-sm space-y-5 border border-forest-200"
        >
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-forest-800 flex items-center justify-center mx-auto mb-3">
              <UserRound className="w-6 h-6 text-gold-400" />
            </div>
            <p className="text-forest-500 text-xs uppercase tracking-widest">Identificação</p>
            <h1 className="font-display text-2xl font-bold gradient-gold-text mt-1">{nomePique}</h1>
            <p className="text-forest-500 text-sm mt-1">
              Informe seu nome e telefone para acessar o cardápio.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-forest-500 text-xs font-medium flex items-center gap-1 mb-1">
                <UserRound className="w-3 h-3" /> Nome
              </label>
              <input
                value={nomeForm}
                onChange={(e) => setNomeForm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarIdentificacao()}
                placeholder="Seu nome"
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="text-forest-500 text-xs font-medium flex items-center gap-1 mb-1">
                <Phone className="w-3 h-3" /> Telefone
              </label>
              <input
                value={telefoneForm}
                onChange={(e) => setTelefoneForm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarIdentificacao()}
                placeholder="(00) 00000-0000"
                type="tel"
                className="input-field"
              />
            </div>
          </div>

          <button
            onClick={confirmarIdentificacao}
            disabled={!nomeForm.trim() || !telefoneForm.trim()}
            className="btn-gold w-full py-3 rounded-2xl disabled:opacity-50"
          >
            Entrar
          </button>
        </motion.div>
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
          {config?.logoUrl ? (
            <div
              className="w-28 h-28 rounded-2xl overflow-hidden flex items-center justify-center"
              style={{
                background: "rgba(255,255,255,0.08)",
                boxShadow: "0 0 32px rgba(15,118,110,0.15), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={config.logoUrl}
                alt={config.nomeEstabelecimento}
                className="w-full h-full object-contain p-2"
              />
            </div>
          ) : (
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)",
                boxShadow: "0 0 32px rgba(15,118,110,0.2), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              <Fish className="w-10 h-10 text-gold-500" />
            </div>
          )}
          <div className="text-center">
            <p className="text-forest-900 font-display font-bold text-xl leading-tight">
              {config?.nomeEstabelecimento ?? "Confraria do Peixe"}
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
          {(() => {
            const raw = typeof window !== "undefined" ? sessionStorage.getItem(CLIENTE_KEY(id)) : null;
            const cliente = raw ? (JSON.parse(raw) as { nome: string }) : null;
            return cliente ? (
              <p className="text-forest-500 text-xs mt-1">Olá, <strong className="text-forest-700">{cliente.nome}</strong>!</p>
            ) : null;
          })()}
          <p className="text-forest-700 text-sm leading-relaxed mt-2">
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

        {/* Powered by */}
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-forest-400/60 whitespace-nowrap">
          Powered by <span className="font-semibold text-forest-400/80">WillTech</span>
        </p>
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
