import Link from "next/link";
import { Fish, MonitorCog, Smartphone, UserRound } from "lucide-react";

export default function RootPage() {
  return (
    <main
      className="min-h-dvh flex items-center justify-center px-5 py-10"
      style={{ background: "radial-gradient(ellipse at top, #E0F2FE 0%, #F8FAFC 60%)" }}
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-forest-700 flex items-center justify-center shadow-gold-glow">
            <Fish className="w-10 h-10 text-gold-500" />
          </div>
          <div>
            <p className="text-forest-600 text-sm uppercase tracking-widest font-semibold">
              WillTech Pesqueiros
            </p>
            <h1 className="font-display text-3xl font-bold gradient-gold-text mt-2">
              Pesque Pague
            </h1>
          </div>
        </div>

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
