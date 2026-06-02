"use client";

import { usePathname } from "next/navigation";
import { useRequireAtendente } from "@/hooks/useRequireAtendente";

export default function AtendenteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/atendente/login";
  const { loading } = useRequireAtendente({ skip: isLogin });

  if (isLogin) return <>{children}</>;
  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-forest-50">
        <p className="text-forest-500 text-sm font-medium">Carregando...</p>
      </div>
    );
  }

  return <>{children}</>;
}
