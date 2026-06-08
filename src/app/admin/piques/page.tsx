"use client";

import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, MapPin, QrCode, Download,
  X, ToggleLeft, ToggleRight, Printer, Users,
  ReceiptText, Wallet, CheckCircle2, AlertCircle, Clock,
} from "lucide-react";
import QRCodeLib from "qrcode";
import {
  addDoc, updateDoc, deleteDoc, doc, collection, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  buildPiquePublicUrl,
  formatCurrency,
  formatTime,
  getBrasiliaDateKey,
  isBeforeBrasiliaDay,
} from "@/lib/utils";
import type { Pedido, Pique, PiqueStatus, ReservaPique } from "@/types";
import toast from "react-hot-toast";

interface FormState {
  numero: string;
  nome: string;
  capacidade: string;
  ativo: boolean;
  status: PiqueStatus;
}
const EMPTY: FormState = { numero: "", nome: "", capacidade: "", ativo: true, status: "livre" };
const EMPTY_RESERVA: ReservaPique = { nome: "", telefone: "", data: "" };

const STATUS_LABEL: Record<PiqueStatus, string> = {
  livre:     "Livre",
  ocupado:   "Ocupado",
  reservado: "Reservado",
  bloqueado: "Bloqueado",
};

const STATUS_CFG: Record<PiqueStatus, {
  bg: string; text: string; border: string; dot: string; pill: string;
}> = {
  livre:     { bg: "#F0FDF4", text: "#16A34A", border: "#BBF7D0", dot: "#22C55E", pill: "#DCFCE7" },
  ocupado:   { bg: "#FFFBEB", text: "#D97706", border: "#FDE68A", dot: "#F59E0B", pill: "#FEF3C7" },
  reservado: { bg: "#EFF6FF", text: "#2563EB", border: "#BFDBFE", dot: "#3B82F6", pill: "#DBEAFE" },
  bloqueado: { bg: "#FEF2F2", text: "#DC2626", border: "#FCA5A5", dot: "#EF4444", pill: "#FEE2E2" },
};

export default function Piques() {
  const { confirm, ConfirmDialog } = useConfirmDialog();
  const { data: piques } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);
  const { data: pedidos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "desc")]);
  const [modal, setModal]               = useState(false);
  const [editando, setEditando]         = useState<Pique | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY);
  const [saving, setSaving]             = useState(false);
  const [qrModal, setQrModal]           = useState<Pique | null>(null);
  const [detalhePique, setDetalhePique] = useState<Pique | null>(null);
  const [reservaModal, setReservaModal] = useState<Pique | null>(null);
  const [reservaForm, setReservaForm]   = useState<ReservaPique>({
    ...EMPTY_RESERVA,
    data: getBrasiliaDateKey(),
  });
  const [recebendo, setRecebendo]       = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const pedidosAbertosPorPique = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const pedido of pedidos) {
      if (pedido.status === "pago" || pedido.status === "cancelado") continue;
      const list = map.get(pedido.piqueId) ?? [];
      list.push(pedido);
      map.set(pedido.piqueId, list);
    }
    return map;
  }, [pedidos]);

  const detalhePedidos         = detalhePique ? pedidosAbertosPorPique.get(detalhePique.id) ?? [] : [];
  const detalheTotalAberto     = detalhePedidos.reduce((s, p) => s + p.total, 0);
  const detalheTemComandaVirada = detalhePedidos.some(
    (p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate())
  );

  const openAdd  = () => { setForm(EMPTY); setEditando(null); setModal(true); };
  const openEdit = (p: Pique) => {
    setForm({
      numero:     p.numero,
      nome:       p.nome,
      capacidade: p.capacidade ? String(p.capacidade) : "",
      ativo:      p.ativo,
      status:     p.status ?? "livre",
    });
    setEditando(p);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.numero.trim()) return toast.error("Informe o número da mesa.");
    setSaving(true);
    const payload: Omit<Pique, "id"> = {
      numero:     form.numero.trim(),
      nome:       form.nome.trim(),
      capacidade: form.capacidade ? parseInt(form.capacidade) : undefined,
      ativo:      form.ativo,
      status:     form.status,
    };
    try {
      if (editando) {
        await updateDoc(doc(db, "piques", editando.id), payload);
        toast.success("Mesa atualizada!");
      } else {
        await addDoc(collection(db, "piques"), payload);
        toast.success("Mesa criada!");
      }
      setModal(false);
    } catch { toast.error("Erro ao salvar."); }
    finally { setSaving(false); }
  };

  const handleDelete = (pique: Pique) => {
    const nome = pique.nome || `Mesa ${pique.numero}`;
    confirm({
      title: "Excluir mesa?",
      description: `A mesa "${nome}" será removida permanentemente. O QR Code vinculado deixará de funcionar.`,
      confirmLabel: "Excluir",
      variant: "danger",
      onConfirm: async () => {
        await deleteDoc(doc(db, "piques", pique.id));
        toast.success("Mesa excluída.");
      },
    });
  };

  const toggleAtivo = async (pique: Pique) => {
    await updateDoc(doc(db, "piques", pique.id), { ativo: !pique.ativo });
  };

  const setStatus = async (pique: Pique, status: PiqueStatus) => {
    if (status === "reservado") {
      setReservaForm({
        nome: pique.reserva?.nome ?? "",
        telefone: pique.reserva?.telefone ?? "",
        data: pique.reserva?.data ?? getBrasiliaDateKey(),
      });
      setReservaModal(pique);
      return;
    }

    await updateDoc(doc(db, "piques", pique.id), { status, reserva: null });
    toast.success(`${pique.nome || `Mesa ${pique.numero}`} → ${STATUS_LABEL[status]}`);
  };

  const salvarReserva = async () => {
    if (!reservaModal) return;
    if (!reservaForm.nome.trim()) return toast.error("Informe o nome do reservista.");
    if (!reservaForm.telefone.trim()) return toast.error("Informe o telefone do reservista.");
    if (!reservaForm.data) return toast.error("Informe a data da reserva.");

    await updateDoc(doc(db, "piques", reservaModal.id), {
      status: "reservado",
      reserva: {
        nome: reservaForm.nome.trim(),
        telefone: reservaForm.telefone.trim(),
        data: reservaForm.data,
      },
    });
    toast.success(`${reservaModal.nome || `Mesa ${reservaModal.numero}`} reservada.`);
    setReservaModal(null);
    setReservaForm({ ...EMPTY_RESERVA, data: getBrasiliaDateKey() });
  };

  const receberComanda = async () => {
    if (!detalhePique || detalhePedidos.length === 0) return;
    setRecebendo(true);
    try {
      await Promise.all([
        ...detalhePedidos.map((pedido) =>
          updateDoc(doc(db, "pedidos", pedido.id), { status: "pago", atualizadoEm: serverTimestamp() })
        ),
        updateDoc(doc(db, "piques", detalhePique.id), { status: "livre" }),
      ]);
      toast.success("Pagamento confirmado. Comanda fechada.");
      setDetalhePique(null);
    } catch { toast.error("Erro ao fechar a comanda."); }
    finally { setRecebendo(false); }
  };

  const openQr = async (pique: Pique) => {
    setQrModal(pique);
    setTimeout(async () => {
      if (!canvasRef.current) return;
      await QRCodeLib.toCanvas(canvasRef.current, buildPiquePublicUrl(pique.id), {
        width: 240, margin: 2, color: { dark: "#0F172A", light: "#ffffff" },
      });
    }, 120);
  };

  const downloadPng = () => {
    if (!canvasRef.current || !qrModal) return;
    const link = document.createElement("a");
    link.download = `qrcode-mesa-${qrModal.numero}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const printQr = async (pique: Pique) => {
    const url = buildPiquePublicUrl(pique.id);
    let estabelecimento = "Confraria do Peixe";
    try {
      const snap = await getDoc(doc(db, "config", "geral"));
      if (snap.exists()) estabelecimento = snap.data().nomeEstabelecimento || estabelecimento;
    } catch { /* usa padrão */ }

    const qrDataUrl = await QRCodeLib.toDataURL(url, {
      width: 400, margin: 2, color: { dark: "#0F172A", light: "#ffffff" },
    });
    const nome = pique.nome || `Mesa ${pique.numero}`;
    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>QR Code — ${nome}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#F8FAFC;font-family:'Segoe UI',system-ui,sans-serif;
  display:flex;justify-content:center;align-items:flex-start;
  padding:40px 20px;min-height:100vh;}
.page{display:flex;flex-direction:column;align-items:center;gap:24px}
.card{width:280px;border:1.5px solid #E2E8F0;border-radius:20px;
  overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,.1);background:#fff;}
.card-header{background:#0F766E;padding:18px 20px;text-align:center;}
.estab{color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2.5px;}
.card-body{background:#fff;padding:24px 20px;text-align:center}
.label{color:#94A3B8;font-size:10px;text-transform:uppercase;letter-spacing:2px;margin-bottom:6px;}
.nome{color:#0F172A;font-size:32px;font-weight:900;line-height:1;margin-bottom:20px;letter-spacing:-0.5px;}
.qr-box{border:1.5px solid #E2E8F0;border-radius:14px;padding:10px;display:inline-block;margin-bottom:20px;}
.qr-box img{display:block;width:200px;height:200px}
.scan{color:#0F766E;font-size:12px;font-weight:700;margin-bottom:4px}
.url{color:#94A3B8;font-size:9px;word-break:break-all;line-height:1.4}
.card-footer{background:#F8FAFC;border-top:1px solid #E2E8F0;padding:10px 16px;text-align:center;}
.footer-text{color:#94A3B8;font-size:9px;letter-spacing:.5px}
@media print{body{padding:0}.card{box-shadow:none}.no-print{display:none!important}}
</style></head><body>
<div class="page"><div class="card">
<div class="card-header"><div class="estab">${estabelecimento}</div></div>
<div class="card-body"><div class="label">Mesa</div><div class="nome">${nome}</div>
<div class="qr-box"><img src="${qrDataUrl}" alt="QR Code ${nome}"/></div>
<div class="scan">📱 Escaneie para pedir</div><div class="url">${url}</div></div>
<div class="card-footer"><div class="footer-text">Pagamento no caixa ao finalizar</div></div>
</div>
<button class="no-print" onclick="window.print()"
style="padding:12px 32px;background:#0F766E;color:#fff;border:none;border-radius:10px;
font-size:14px;font-weight:700;cursor:pointer;">🖨️ Imprimir / Salvar PDF</button>
</div></body></html>`;
    const win = window.open("", "_blank", "width=560,height=780");
    if (!win) { toast.error("Permita pop-ups para gerar o PDF."); return; }
    win.document.write(html);
    win.document.close();
  };

  const counts = {
    livre:     piques.filter((p) => (p.status ?? "livre") === "livre").length,
    ocupado:   piques.filter((p) => p.status === "ocupado").length,
    reservado: piques.filter((p) => p.status === "reservado").length,
    bloqueado: piques.filter((p) => p.status === "bloqueado").length,
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ──────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Mesas</h1>
          <p className="text-forest-500 text-sm mt-0.5">
            {counts.livre} livres · {piques.length} total
          </p>
        </div>
        <button onClick={openAdd} className="btn-gold px-4 py-2 rounded-xl text-sm gap-1.5">
          <Plus className="w-4 h-4" /> Nova Mesa
        </button>
      </div>

      {/* ── Status summary bar ──────────────────────── */}
      {piques.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => {
            const cfg = STATUS_CFG[s];
            return (
              <div
                key={s}
                className="rounded-xl px-4 py-3 flex items-center gap-3 border"
                style={{ background: cfg.bg, borderColor: cfg.border }}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.dot }} />
                <div className="min-w-0">
                  <p className="font-bold text-xl leading-none" style={{ color: cfg.text }}>{counts[s]}</p>
                  <p className="text-xs mt-0.5 font-medium" style={{ color: cfg.text, opacity: 0.7 }}>{STATUS_LABEL[s]}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Mesa Grid ───────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {piques.length === 0 ? (
          <div className="col-span-3 glass rounded-2xl flex flex-col items-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#F1F5F9" }}>
              <MapPin className="w-7 h-7 text-forest-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-forest-700">Nenhuma mesa cadastrada</p>
              <p className="text-forest-500 text-sm mt-1">Crie a primeira mesa para começar.</p>
            </div>
            <button onClick={openAdd} className="btn-gold px-5 py-2.5 rounded-xl text-sm mt-2">
              <Plus className="w-4 h-4" /> Nova Mesa
            </button>
          </div>
        ) : (
          piques.map((pique, i) => {
            const status         = pique.status ?? "livre";
            const cfg            = STATUS_CFG[status];
            const pedidosAbertos = pedidosAbertosPorPique.get(pique.id) ?? [];
            const totalAberto    = pedidosAbertos.reduce((s, p) => s + p.total, 0);
            const temVirada      = pedidosAbertos.some((p) => p.criadoEm && isBeforeBrasiliaDay(p.criadoEm.toDate()));

            return (
              <motion.div
                key={pique.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`glass glass-hover rounded-2xl overflow-hidden cursor-pointer border-l-4 ${!pique.ativo ? "opacity-50" : ""}`}
                style={{ borderLeftColor: cfg.dot }}
                onClick={() => setDetalhePique(pique)}
              >
                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Number badge */}
                    <div
                      className="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black text-xl leading-none"
                      style={{ background: cfg.pill, color: cfg.text }}
                    >
                      {pique.numero}
                      {pique.capacidade && (
                        <span className="text-[9px] font-normal flex items-center gap-0.5 mt-0.5 opacity-70">
                          <Users className="w-2 h-2" />{pique.capacidade}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-forest-900 truncate">
                        {pique.nome || `Mesa ${pique.numero}`}
                      </p>
                      {/* Status pill */}
                      <div
                        className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full border text-xs font-semibold"
                        style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                        {STATUS_LABEL[status]}
                      </div>
                      {status === "reservado" && pique.reserva && (
                        <p className="text-xs mt-1 text-forest-600">
                          {pique.reserva.nome} · {pique.reserva.data}
                        </p>
                      )}

                      {/* Orders info */}
                      {pedidosAbertos.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs font-semibold" style={{ color: "#0F766E" }}>
                            {pedidosAbertos.length} pedido{pedidosAbertos.length > 1 ? "s" : ""} · {formatCurrency(totalAberto)}
                          </p>
                          {temVirada && (
                            <p className="text-red-500 text-[11px] flex items-center gap-1 font-medium">
                              <AlertCircle className="w-3 h-3" /> Virou o dia aberta
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status quick-switch */}
                <div className="grid grid-cols-4 border-t border-forest-200">
                  {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => {
                    const sCfg   = STATUS_CFG[s];
                    const active = status === s;
                    return (
                      <button
                        key={s}
                        onClick={(e) => { e.stopPropagation(); setStatus(pique, s); }}
                        title={STATUS_LABEL[s]}
                        className="py-2 text-[10px] font-semibold transition-all"
                        style={{
                          background: active ? sCfg.pill : undefined,
                          color:      active ? sCfg.text : "#94A3B8",
                          borderBottom: active ? `2px solid ${sCfg.dot}` : "2px solid transparent",
                        }}
                      >
                        {STATUS_LABEL[s].slice(0, 4)}.
                      </button>
                    );
                  })}
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-1 px-3 py-2 border-t border-forest-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); printQr(pique); }}
                    className="btn-ghost p-1.5 rounded-lg flex items-center gap-1 text-xs text-forest-500"
                    title="Imprimir QR fixo"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">QR</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openQr(pique); }}
                    className="btn-ghost p-1.5 rounded-lg text-forest-500"
                    title="Ver QR Code"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleAtivo(pique); }}
                    className="btn-ghost p-1.5 rounded-lg text-forest-500"
                    title={pique.ativo ? "Desativar" : "Ativar"}
                  >
                    {pique.ativo
                      ? <ToggleRight className="w-4 h-4 text-gold-600" />
                      : <ToggleLeft  className="w-4 h-4" />}
                  </button>
                  <div className="ml-auto flex gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(pique); }}
                      className="btn-ghost p-1.5 rounded-lg text-forest-500 hover:text-gold-600"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(pique); }}
                      className="btn-ghost p-1.5 rounded-lg text-forest-500 hover:text-red-500"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ── Comanda Modal ────────────────────────────── */}
      <AnimatePresence>
        {detalhePique && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setDetalhePique(null)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-lg max-h-[88dvh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-forest-200 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#F0FDF4" }}>
                  <ReceiptText className="w-5 h-5" style={{ color: "#16A34A" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-forest-500 text-xs font-medium">Comanda aberta</p>
                  <h2 className="font-semibold text-forest-900 truncate">
                    {detalhePique.nome || `Mesa ${detalhePique.numero}`}
                  </h2>
                </div>
                <button onClick={() => setDetalhePique(null)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Totals */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-xl p-4 border border-forest-200">
                    <p className="text-forest-500 text-xs font-medium">Total em aberto</p>
                    <p className="font-bold text-xl gradient-gold-text mt-1">
                      {formatCurrency(detalheTotalAberto)}
                    </p>
                    <p className="text-forest-400 text-xs mt-1">
                      {detalhePedidos.length} pedido{detalhePedidos.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="glass rounded-xl p-4 border border-forest-200">
                    <p className="text-forest-500 text-xs font-medium">Fechamento</p>
                    <p className="font-semibold text-forest-700 mt-1">Manual</p>
                    <p className="text-forest-400 text-xs mt-1">Confirme ao receber</p>
                  </div>
                </div>

                {detalheTemComandaVirada && (
                  <div className="rounded-xl px-4 py-3 flex gap-3 border" style={{ background: "#FFFBEB", borderColor: "#FDE68A" }}>
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#D97706" }}>Comanda do dia anterior</p>
                      <p className="text-xs mt-0.5 text-amber-600">Mesa virou a meia-noite sem pagamento confirmado.</p>
                    </div>
                  </div>
                )}

                {detalhePedidos.length === 0 ? (
                  <div className="glass rounded-xl p-8 text-center border border-forest-200">
                    <CheckCircle2 className="w-10 h-10 text-forest-300 mx-auto mb-3" />
                    <p className="font-semibold text-forest-700">Comanda fechada</p>
                    <p className="text-forest-500 text-sm mt-1">Não há pedidos aguardando pagamento.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detalhePedidos.map((pedido) => (
                      <article key={pedido.id} className="glass rounded-xl overflow-hidden border border-forest-200">
                        <div className="px-4 py-3 border-b border-forest-100 flex items-center gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-forest-900">
                              #{pedido.id.slice(-4).toUpperCase()}
                            </p>
                            <p className="text-forest-500 text-xs flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {pedido.criadoEm ? formatTime(pedido.criadoEm.toDate()) : "--"}
                            </p>
                          </div>
                          <span className="badge status-novo">Aberto</span>
                          <span className="font-bold text-sm gradient-gold-text">
                            {formatCurrency(pedido.total)}
                          </span>
                        </div>
                        <div className="divide-y divide-forest-100">
                          {pedido.itens.map((item, idx) => (
                            <div key={idx} className="px-4 py-2.5 flex items-start gap-2">
                              <span className="font-semibold text-xs text-forest-600 w-5 shrink-0">{item.quantidade}×</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-forest-800 text-sm">{item.nome}</p>
                                {item.obs && <p className="text-forest-400 text-xs italic">{item.obs}</p>}
                              </div>
                              <span className="text-forest-500 text-xs shrink-0">
                                {formatCurrency(item.preco * item.quantidade)}
                              </span>
                            </div>
                          ))}
                          {pedido.observacaoGeral && (
                            <p className="px-4 py-2 text-forest-500 text-xs italic">Obs: {pedido.observacaoGeral}</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-forest-200">
                {detalhePedidos.length > 0 ? (
                  <button
                    onClick={receberComanda}
                    disabled={recebendo}
                    className="btn-gold w-full py-3 rounded-xl text-base"
                  >
                    <Wallet className="w-5 h-5" />
                    {recebendo ? "Fechando..." : `Confirmar pagamento · ${formatCurrency(detalheTotalAberto)}`}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-forest-400 text-sm py-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Comanda fechada para hoje
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reserva Modal ─────────────────────────────── */}
      <AnimatePresence>
        {reservaModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setReservaModal(null)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg text-forest-900">
                  Reservar {reservaModal.nome || `Mesa ${reservaModal.numero}`}
                </h2>
                <button onClick={() => setReservaModal(null)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-1.5">Data da reserva</label>
                  <input
                    type="date"
                    value={reservaForm.data}
                    onChange={(e) => setReservaForm({ ...reservaForm, data: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-1.5">Nome</label>
                  <input
                    value={reservaForm.nome}
                    onChange={(e) => setReservaForm({ ...reservaForm, nome: e.target.value })}
                    placeholder="Nome do reservista"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-1.5">Telefone (senha)</label>
                  <input
                    value={reservaForm.telefone}
                    onChange={(e) => setReservaForm({ ...reservaForm, telefone: e.target.value })}
                    placeholder="(xx) xxxxx-xxxx"
                    className="input-field"
                  />
                </div>
              </div>

              <button onClick={salvarReserva} className="btn-gold w-full py-3 rounded-xl">
                Salvar reserva
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Form Modal ───────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <motion.div
              initial={{ y: 32, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
              className="glass rounded-2xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg text-forest-900">
                  {editando ? "Editar Mesa" : "Nova Mesa"}
                </h2>
                <button onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-forest-700 mb-1.5">Número *</label>
                    <input
                      value={form.numero}
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                      placeholder="01, A1..."
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-forest-700 mb-1.5 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Capacidade
                    </label>
                    <input
                      type="number"
                      value={form.capacidade}
                      onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                      placeholder="Pessoas"
                      className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-1.5">Nome / Apelido</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Quiosque da Sombra"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-forest-700 mb-2">Status inicial</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => {
                      const cfg    = STATUS_CFG[s];
                      const active = form.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setForm({ ...form, status: s })}
                          className="py-2.5 rounded-xl text-xs font-semibold border transition-all"
                          style={{
                            background:  active ? cfg.bg   : undefined,
                            color:       active ? cfg.text : "#64748B",
                            borderColor: active ? cfg.border : "#E2E8F0",
                            transform:   active ? "scale(1.02)" : undefined,
                          }}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer py-1">
                  <input
                    type="checkbox"
                    checked={form.ativo}
                    onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                    className="w-4 h-4 rounded accent-teal-600"
                  />
                  <span className="text-sm text-forest-700">Mesa ativa</span>
                </label>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-gold w-full py-3 rounded-xl disabled:opacity-55"
              >
                {saving ? "Salvando..." : "Salvar Mesa"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── QR Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {qrModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setQrModal(null)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="glass rounded-2xl p-7 text-center space-y-5 max-w-xs w-full"
            >
              <div>
                <p className="text-forest-500 text-xs uppercase tracking-widest mb-1 font-medium">QR Code</p>
                <h2 className="font-semibold text-xl text-forest-900">
                  {qrModal.nome || `Mesa ${qrModal.numero}`}
                </h2>
              </div>
              <div className="flex justify-center">
                <div className="p-3 rounded-xl border border-forest-200">
                  <canvas ref={canvasRef} className="rounded-lg" />
                </div>
              </div>
              <p className="text-forest-500 text-xs">Aponte a câmera para fazer o pedido</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => printQr(qrModal)} className="btn-gold py-2.5 rounded-xl text-sm gap-1.5">
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                <button onClick={downloadPng} className="btn-ghost py-2.5 rounded-xl text-sm gap-1.5">
                  <Download className="w-4 h-4" /> PNG
                </button>
              </div>
              <button onClick={() => setQrModal(null)} className="text-forest-400 text-xs hover:text-forest-600 transition-colors">
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {ConfirmDialog}
    </div>
  );
}
