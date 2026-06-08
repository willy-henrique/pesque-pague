"use client";

import { useEffect, useRef, useState } from "react";
import { playNotification } from "@/lib/sound";
import { motion, AnimatePresence } from "framer-motion";
import { GlassWater, Clock, Flame, Volume2, VolumeX } from "lucide-react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import type { Pedido } from "@/types";
import { STATUS_LABELS, STATUS_NEXT } from "@/types";
import { PedidoCard } from "@/app/admin/cozinha/page";
import toast from "react-hot-toast";

export default function Bar() {
  const prevCountRef = useRef(0);
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const { data: todos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "asc")]);

  // Bar vê apenas pedidos que têm pelo menos 1 item de bebida
  const temBebida = (p: Pedido) => p.itens.some((i) => i.tipo === "bebida");
  const pendentes = todos.filter((p) => p.status === "novo" && temBebida(p));
  const preparo   = todos.filter((p) => p.status === "em_preparo" && temBebida(p));

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
    const proximo = STATUS_NEXT[pedido.status];
    if (!proximo) return;
    await updateDoc(doc(db, "pedidos", pedido.id), {
      status: proximo,
      atualizadoEm: serverTimestamp(),
    });
    toast.success(`${pedido.piqueNome} → ${STATUS_LABELS[proximo]}`);
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <GlassWater className="w-6 h-6 text-water-400" />
        <div>
          <h1 className="font-display text-2xl font-bold text-water-400">Bar</h1>
          <p className="text-forest-500 text-sm">
            {pendentes.length} aguardando · {preparo.length} em preparo
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Coluna: Novos pedidos */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-gold-500" />
            <h2 className="font-semibold text-forest-900 text-sm">Aguardando preparo</h2>
            {pendentes.length > 0 && (
              <span className="badge status-novo animate-pulse-gold ml-1">{pendentes.length}</span>
            )}
          </div>

          {pendentes.length === 0 ? (
            <div className="glass rounded-2xl flex items-center justify-center py-12 text-forest-700">
              <p className="text-sm">Nenhuma bebida aguardando</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {pendentes.map((pedido) => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  now={now}
                  onAvancar={() => avancar(pedido)}
                  urgente
                  filtroTipo="bebida"
                />
              ))}
            </AnimatePresence>
          )}
        </section>

        {/* Coluna: Em preparo */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-water-300" />
            <h2 className="font-semibold text-forest-900 text-sm">Preparando</h2>
            {preparo.length > 0 && (
              <span className="badge status-preparo ml-1">{preparo.length}</span>
            )}
          </div>

          {preparo.length === 0 ? (
            <div className="glass rounded-2xl flex items-center justify-center py-12 text-forest-700">
              <p className="text-sm">Nada em preparo</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {preparo.map((pedido) => (
                <PedidoCard
                  key={pedido.id}
                  pedido={pedido}
                  now={now}
                  onAvancar={() => avancar(pedido)}
                  filtroTipo="bebida"
                />
              ))}
            </AnimatePresence>
          )}
        </section>
      </div>
    </div>
  );
}
