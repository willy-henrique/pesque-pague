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
  const [email, setEmail]       = useState("");
  const [senha, setSenha]       = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);

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
    <main
      className="min-h-dvh flex flex-col items-center justify-center p-6"
      style={{ background: "radial-gradient(ellipse at top, #142b1e 0%, #061208 70%)" }}
    >
      {/* Ambient */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(45,106,79,0.2) 0%, transparent 70%)" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(135deg, #1a3a2a, #2d6a4f)",
              boxShadow: "0 0 40px rgba(45,106,79,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
            }}
          >
            <Fish className="w-8 h-8 text-gold-500" />
          </motion.div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">
            WillTech Pesqueiros
          </h1>
          <p className="text-forest-400 text-sm mt-1">Painel Gerencial</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="glass rounded-3xl p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-forest-300 text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gerente@pesqueiro.com"
              required
              className="input-field"
            />
          </div>

          <div className="space-y-1">
            <label className="text-forest-300 text-sm font-medium">Senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                className="input-field pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-500 hover:text-forest-300 transition-colors"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-3.5 rounded-xl mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-forest-900 border-t-transparent rounded-full animate-spin" />
                Entrando...
              </span>
            ) : (
              <><LogIn className="w-4 h-4" /> Entrar</>
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}
