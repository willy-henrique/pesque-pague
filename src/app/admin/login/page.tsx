"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { Config } from "@/types";
import toast from "react-hot-toast";

const NOME_PADRAO = "Confraria do Peixe";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [config, setConfig]   = useState<Config | null>(null);

  useEffect(() => {
    getDoc(doc(db, "config", "geral")).then((snap) => {
      if (snap.exists()) setConfig(snap.data() as Config);
    });
  }, []);

  const nomeEstab = config?.nomeEstabelecimento || NOME_PADRAO;
  const logoUrl   = config?.logoUrl || "/logo-confraria.png";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, senha);
      router.push("/admin/dashboard");
    } catch {
      toast.error("E-mail ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-dvh flex" style={{ background: "#F8FAFC" }}>
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] shrink-0 p-10"
        style={{ background: "#0F172A" }}
      >
        {/* Logo e nome */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{ background: "rgba(15,118,110,0.15)", border: "1px solid rgba(13,148,136,0.3)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt={nomeEstab}
              className="w-full h-full object-contain p-1"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
                const parent = (e.currentTarget as HTMLImageElement).parentElement;
                if (parent) parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.46-3.44 6-7 6s-7.56-2.54-8.5-6Z"/><path d="M18 12h.5"/><path d="m2 12 1.5 1.5L5 12l-1.5-1.5L2 12Z"/></svg>';
              }}
            />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">{nomeEstab}</p>
            <p className="text-slate-400 text-xs mt-0.5">Painel Administrativo</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-3xl font-bold leading-tight">
            Sistema de gestão<br />
            <span style={{ color: "#0D9488" }}>completo.</span>
          </h2>
          <p className="text-slate-400 mt-4 text-sm leading-relaxed">
            Controle de pedidos, mesas, cozinha, caixa e relatórios — tudo em um só lugar.
          </p>
        </div>

        <p className="text-slate-600 text-xs">© 2025 {nomeEstab} · Powered by WillTech</p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Mobile brand */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div
              className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: "rgba(15,118,110,0.1)", border: "1px solid rgba(13,148,136,0.2)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={nomeEstab}
                className="w-full h-full object-contain p-1"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div>
              <p className="font-bold text-forest-900 text-sm leading-tight">{nomeEstab}</p>
              <p className="text-forest-500 text-xs">Painel Administrativo</p>
            </div>
          </div>

          {/* Logo centralizada (desktop, acima do form) */}
          <div className="hidden lg:flex flex-col items-center mb-8">
            <div
              className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center mb-3"
              style={{ background: "rgba(15,118,110,0.08)", border: "1.5px solid rgba(13,148,136,0.2)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt={nomeEstab}
                className="w-full h-full object-contain p-2"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <p className="font-bold text-forest-900 text-base">{nomeEstab}</p>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-forest-900">Entrar</h1>
            <p className="text-forest-500 text-sm mt-1">Painel gerencial</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-forest-700 mb-1.5">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gerente@pesqueiro.com"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-forest-700 mb-1.5">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPwd ? "text" : "password"}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400 hover:text-forest-600 transition-colors"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-gold w-full py-3 rounded-xl mt-2 disabled:opacity-55 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Entrando...
                </span>
              ) : (
                <><LogIn className="w-4 h-4" /> Entrar</>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </main>
  );
}
