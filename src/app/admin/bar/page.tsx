"use client";

import { useEffect, useRef, useState } from "react";
import { playNotification } from "@/lib/sound";
import { AnimatePresence } from "framer-motion";
import { GlassWater, Clock, Flame, CheckCircle2, Volume2, VolumeX } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { buildPedidoStatusAfterSetorUpdate, getStatusDoSetor } from "@/lib/pedido-status";
import type { Pedido, SetorOrderStatus, SetorPedido } from "@/types";
import { PedidoCard } from "@/app/admin/cozinha/page";
import toast from "react-hot-toast";

export default function Bar() {
  const prevCountRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data: todos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "asc")]);
  const setor: SetorPedido = "bar";

  const ativos = todos.filter(
    (p) => p.status !== "pago" && p.status !== "cancelado" && p.status !== "entregue"
  );

  const pendentes = ativos.filter((p) => getStatusDoSetor(p, setor) === "novo");
  const preparo = ativos.filter((p) => getStatusDoSetor(p, setor) === "em_preparo");
  const prontos = ativos.filter((p) => getStatusDoSetor(p, setor) === "pronto");

  useEffect(() => {
    const novos = pendentes.length;
    if (novos > prevCountRef.current && !muted) playNotification();
    prevCountRef.current = novos;
  }, [pendentes.length, muted]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const avancar = async (pedido: Pedido) => {
    const atual = getStatusDoSetor(pedido, setor);
    const proximo: SetorOrderStatus | null =
      atual === "novo" ? "em_preparo" : atual === "em_preparo" ? "pronto" : null;
    if (!proximo) return;
    await updateDoc(doc(db, "pedidos", pedido.id), {
      ...buildPedidoStatusAfterSetorUpdate(pedido, setor, proximo),
      atualizadoEm: serverTimestamp(),
    });
    toast.success(`${pedido.piqueNome} → ${proximo === "pronto" ? "Bebida pronta para retirada" : "Em preparo"}`);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GlassWater className="w-6 h-6 text-water-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-water-400">Bar</h1>
          <p className="text-forest-500 text-sm">
            {pendentes.length} aguardando · {preparo.length} em preparo · {prontos.length} prontos
          </p>
        </div>
        <button
          onClick={() => setMuted((v) => !v)}
          className="ml-auto btn-ghost p-2 rounded-xl"
          title={muted ? "Ativar som" : "Silenciar"}
        >
          {muted
            ? <VolumeX className="w-5 h-5 text-forest-600" />
            : <Volume2  className="w-5 h-5 text-forest-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <SetorColuna title="Aguardando preparo" icon={Clock} empty="Nenhuma bebida aguardando" pedidos={pendentes}>
          <AnimatePresence mode="popLayout">
            {pendentes.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} now={now} onAvancar={() => avancar(pedido)} urgente filtroTipo="bebida" setor={setor} />
            ))}
          </AnimatePresence>
        </SetorColuna>

        <SetorColuna title="Preparando" icon={Flame} empty="Nada em preparo" pedidos={preparo} badgeClassName="status-preparo">
          <AnimatePresence mode="popLayout">
            {preparo.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} now={now} onAvancar={() => avancar(pedido)} filtroTipo="bebida" setor={setor} />
            ))}
          </AnimatePresence>
        </SetorColuna>

        <SetorColuna title="Prontos para retirada" icon={CheckCircle2} empty="Nenhuma bebida pronta" pedidos={prontos} badgeClassName="status-entregue">
          <AnimatePresence mode="popLayout">
            {prontos.map((pedido) => (
              <PedidoCard key={pedido.id} pedido={pedido} now={now} filtroTipo="bebida" setor={setor} pronto />
            ))}
          </AnimatePresence>
        </SetorColuna>
      </div>
    </div>
  );
}

function SetorColuna({
  title,
  icon: Icon,
  empty,
  pedidos,
  children,
  badgeClassName = "status-novo",
}: {
  title: string;
  icon: React.ElementType;
  empty: string;
  pedidos: Pedido[];
  children: React.ReactNode;
  badgeClassName?: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-gold-500" />
        <h2 className="font-semibold text-forest-900 text-sm">{title}</h2>
        {pedidos.length > 0 && <span className={`badge ml-1 ${badgeClassName}`}>{pedidos.length}</span>}
      </div>

      {pedidos.length === 0 ? (
        <div className="glass rounded-2xl flex items-center justify-center py-12 text-forest-700">
          <p className="text-sm">{empty}</p>
        </div>
      ) : children}
    </section>
  );
}
