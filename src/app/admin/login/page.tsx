"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Fish, Eye, EyeOff, LogIn } from "lucide-react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [senha, setSenha]     = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#0F766E" }}>
            <Fish className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm">WillTech</p>
            <p className="text-forest-400 text-xs">Pesqueiros</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-3xl font-bold leading-tight">
            Sistema de gestão<br />
            <span style={{ color: "#0D9488" }}>para pesqueiros.</span>
          </h2>
          <p className="text-forest-400 mt-4 text-sm leading-relaxed">
            Controle de pedidos, mesas, cozinha, caixa e relatórios — tudo em um só lugar.
          </p>
        </div>

        <p className="text-forest-600 text-xs">© 2025 WillTech Pesqueiros</p>
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
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#0F766E" }}>
              <Fish className="w-4 h-4 text-white" />
            </div>
            <p className="font-semibold text-forest-900">WillTech Pesqueiros</p>
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
