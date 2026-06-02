"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, UserRound } from "lucide-react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { canAccessAtendente, fetchUsuario } from "@/lib/usuarios";
import toast from "react-hot-toast";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/atendente";
  const erroParam = searchParams.get("erro");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
      const profile = await fetchUsuario(cred.user.uid);

      if (!canAccessAtendente(profile)) {
        await signOut(auth);
        toast.error("Esta conta não tem acesso de atendente ou está bloqueada.");
        setLoading(false);
        return;
      }

      toast.success(`Olá, ${profile?.nome ?? "atendente"}!`);
      router.replace(redirect);
    } catch {
      toast.error("E-mail ou senha incorretos.");
      setLoading(false);
    }
  };

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-10"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm glass rounded-2xl p-6 border border-forest-200 space-y-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-forest-800 flex items-center justify-center">
            <UserRound className="w-6 h-6 text-gold-400" />
          </div>
          <div>
            <p className="text-forest-500 text-xs uppercase tracking-widest">App Atendente</p>
            <h1 className="font-bold text-xl text-forest-900">Entrar</h1>
          </div>
        </div>

        {erroParam === "acesso" && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            Conta sem permissão ou bloqueada. Fale com o gerente.
          </p>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-forest-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="atendente@pesqueiro.com"
              required
              autoComplete="username"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-forest-700 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="input-field pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-400"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-gold w-full py-3 rounded-xl disabled:opacity-55"
          >
            {loading ? "Entrando..." : (
              <>
                <LogIn className="w-4 h-4" /> Entrar
              </>
            )}
          </button>
        </form>
      </motion.div>
    </main>
  );
}

export default function AtendenteLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh flex items-center justify-center">Carregando...</div>}>
      <LoginForm />
    </Suspense>
  );
}
