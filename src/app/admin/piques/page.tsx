"use client";

import { useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pencil, Trash2, MapPin, QrCode, Download,
  X, ToggleLeft, ToggleRight, Printer, Users,
  ReceiptText, Wallet, CheckCircle2, AlertCircle,
} from "lucide-react";
import QRCodeLib from "qrcode";
import {
  addDoc, updateDoc, deleteDoc, doc, collection, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import {
  buildPiquePublicUrl,
  formatCurrency,
  formatTime,
  isBeforeBrasiliaDay,
} from "@/lib/utils";
import type { Pedido, Pique, PiqueStatus } from "@/types";
import toast from "react-hot-toast";

interface FormState {
  numero: string;
  nome: string;
  capacidade: string;
  ativo: boolean;
  status: PiqueStatus;
}
const EMPTY: FormState = { numero: "", nome: "", capacidade: "", ativo: true, status: "livre" };

const STATUS_LABEL: Record<PiqueStatus, string> = {
  livre:     "Livre",
  ocupado:   "Ocupado",
  reservado: "Reservado",
  bloqueado: "Bloqueado",
};
const STATUS_COLOR: Record<PiqueStatus, string> = {
  livre:     "bg-forest-600/20 text-forest-300 border-forest-600/30",
  ocupado:   "bg-gold-500/15 text-gold-400 border-gold-500/25",
  reservado: "bg-water-300/10 text-water-300 border-water-300/20",
  bloqueado: "bg-red-500/10 text-red-400 border-red-500/20",
};
const STATUS_DOT: Record<PiqueStatus, string> = {
  livre:     "bg-forest-400",
  ocupado:   "bg-gold-500 animate-pulse",
  reservado: "bg-water-300",
  bloqueado: "bg-red-400",
};

export default function Piques() {
  const { data: piques } = useCollection<Pique>("piques", [orderBy("numero", "asc")]);
  const { data: pedidos } = useCollection<Pedido>("pedidos", [orderBy("criadoEm", "desc")]);
  const [modal, setModal]         = useState(false);
  const [editando, setEditando]   = useState<Pique | null>(null);
  const [form, setForm]           = useState<FormState>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [qrModal, setQrModal]     = useState<Pique | null>(null);
  const [detalhePique, setDetalhePique] = useState<Pique | null>(null);
  const [recebendo, setRecebendo] = useState(false);
  const canvasRef                 = useRef<HTMLCanvasElement>(null);

  const pedidosAbertosPorPique = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const pedido of pedidos) {
      if (pedido.status === "pago") continue;
      const list = map.get(pedido.piqueId) ?? [];
      list.push(pedido);
      map.set(pedido.piqueId, list);
    }
    return map;
  }, [pedidos]);

  const detalhePedidos = detalhePique ? pedidosAbertosPorPique.get(detalhePique.id) ?? [] : [];
  const detalhePedidosAbertos = detalhePedidos;
  const detalheTotalAberto = detalhePedidosAbertos.reduce((sum, pedido) => sum + pedido.total, 0);
  const detalheTemComandaVirada = detalhePedidosAbertos.some(
    (pedido) => pedido.criadoEm && isBeforeBrasiliaDay(pedido.criadoEm.toDate())
  );

  const openAdd = () => { setForm(EMPTY); setEditando(null); setModal(true); };
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
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pique: Pique) => {
    if (!confirm(`Excluir mesa "${pique.nome || pique.numero}"?`)) return;
    await deleteDoc(doc(db, "piques", pique.id));
    toast.success("Mesa excluída.");
  };

  const toggleAtivo = async (pique: Pique) => {
    await updateDoc(doc(db, "piques", pique.id), { ativo: !pique.ativo });
  };

  const setStatus = async (pique: Pique, status: PiqueStatus) => {
    await updateDoc(doc(db, "piques", pique.id), { status });
    toast.success(`${pique.nome || `Mesa ${pique.numero}`} → ${STATUS_LABEL[status]}`);
  };

  const receberComanda = async () => {
    if (!detalhePique || detalhePedidosAbertos.length === 0) return;

    setRecebendo(true);
    try {
      await Promise.all([
        ...detalhePedidosAbertos.map((pedido) =>
          updateDoc(doc(db, "pedidos", pedido.id), {
            status: "pago",
            atualizadoEm: serverTimestamp(),
          })
        ),
        updateDoc(doc(db, "piques", detalhePique.id), { status: "livre" }),
      ]);
      toast.success("Pagamento confirmado. Comanda fechada.");
      setDetalhePique(null);
    } catch {
      toast.error("Erro ao fechar a comanda.");
    } finally {
      setRecebendo(false);
    }
  };

  // Abre modal QR e renderiza canvas
  const openQr = async (pique: Pique) => {
    setQrModal(pique);
    setTimeout(async () => {
      if (!canvasRef.current) return;
      const url = buildPiquePublicUrl(pique.id);
      await QRCodeLib.toCanvas(canvasRef.current, url, {
        width: 260,
        margin: 2,
        color: { dark: "#0d1f16", light: "#ffffff" },
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

  // Gera PDF para impressão via janela de impressão do navegador
  const printQr = async (pique: Pique) => {
    const url = buildPiquePublicUrl(pique.id);

    // Carrega nome do estabelecimento
    let estabelecimento = "WillTech Pesqueiros";
    try {
      const snap = await getDoc(doc(db, "config", "geral"));
      if (snap.exists()) estabelecimento = snap.data().nomeEstabelecimento || estabelecimento;
    } catch { /* usa padrão */ }

    const qrDataUrl = await QRCodeLib.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: "#0d1f16", light: "#ffffff" },
    });

    const nome = pique.nome || `Mesa ${pique.numero}`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8"/>
  <title>QR Code — ${nome}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      background:#fff;font-family:'Segoe UI',system-ui,sans-serif;
      display:flex;justify-content:center;align-items:flex-start;
      padding:40px 20px;min-height:100vh;
    }
    .page{display:flex;flex-direction:column;align-items:center;gap:24px}
    .card{
      width:260px;border:3px solid #1a3a2a;border-radius:20px;
      overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.12);
    }
    .card-header{
      background:#1a3a2a;padding:18px 20px;text-align:center;
    }
    .estab{
      color:#f4a522;font-size:11px;font-weight:800;
      text-transform:uppercase;letter-spacing:2.5px;
    }
    .card-body{background:#fff;padding:24px 20px;text-align:center}
    .label{
      color:#888;font-size:10px;text-transform:uppercase;
      letter-spacing:2px;margin-bottom:6px;
    }
    .nome{
      color:#1a3a2a;font-size:32px;font-weight:900;
      line-height:1;margin-bottom:20px;letter-spacing:-0.5px;
    }
    .qr-box{
      border:2px solid #e8e8e8;border-radius:14px;
      padding:10px;display:inline-block;margin-bottom:20px;
    }
    .qr-box img{display:block;width:200px;height:200px}
    .scan{color:#1a3a2a;font-size:12px;font-weight:700;margin-bottom:4px}
    .url{color:#aaa;font-size:9px;word-break:break-all;line-height:1.4}
    .card-footer{
      background:#f7f7f7;border-top:1px solid #eee;
      padding:10px 16px;text-align:center;
    }
    .footer-text{color:#aaa;font-size:9px;letter-spacing:.5px}
    @media print{
      body{padding:0}
      .card{box-shadow:none;border-color:#1a3a2a}
      .no-print{display:none!important}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="card">
      <div class="card-header">
        <div class="estab">${estabelecimento}</div>
      </div>
      <div class="card-body">
        <div class="label">Mesa</div>
        <div class="nome">${nome}</div>
        <div class="qr-box">
          <img src="${qrDataUrl}" alt="QR Code ${nome}"/>
        </div>
        <div class="scan">📱 Escaneie para pedir</div>
        <div class="url">${url}</div>
      </div>
      <div class="card-footer">
        <div class="footer-text">Pagamento no caixa ao finalizar</div>
      </div>
    </div>
    <button class="no-print" onclick="window.print()"
      style="padding:12px 32px;background:#1a3a2a;color:#f4a522;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:.5px">
      🖨️ Imprimir / Salvar PDF
    </button>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=560,height=780");
    if (!win) { toast.error("Permita pop-ups para gerar o PDF."); return; }
    win.document.write(html);
    win.document.close();
  };

  const livre  = piques.filter((p) => p.ativo && (!p.status || p.status === "livre")).length;
  const ocupado = piques.filter((p) => p.status === "ocupado").length;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold gradient-gold-text">Mesas</h1>
          <p className="text-forest-500 text-sm">
            <span className="text-forest-300">{livre} livres</span>
            {ocupado > 0 && <span className="text-gold-400"> · {ocupado} ocupados</span>}
            {" "}· {piques.length} total
          </p>
        </div>
        <button onClick={openAdd} className="btn-gold px-4 py-2 rounded-xl text-sm ml-auto">
          <Plus className="w-4 h-4" /> Nova Mesa
        </button>
      </div>

      {/* Status bar resumo */}
      {piques.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => {
            const count = piques.filter((p) => (p.status ?? "livre") === s).length;
            return (
              <div key={s} className={`glass rounded-xl px-3 py-2.5 border flex items-center gap-2 ${STATUS_COLOR[s]}`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[s]}`} />
                <div className="min-w-0">
                  <p className="font-bold text-base leading-none">{count}</p>
                  <p className="text-xs opacity-70 truncate">{STATUS_LABEL[s]}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid de mesas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {piques.length === 0 ? (
          <div className="col-span-3 glass rounded-2xl flex flex-col items-center py-16 gap-3">
            <MapPin className="w-10 h-10 text-forest-700" />
            <p className="text-forest-500 text-sm">Nenhuma mesa cadastrada.</p>
          </div>
        ) : (
          piques.map((pique, i) => {
            const status = pique.status ?? "livre";
            const pedidosAbertos = pedidosAbertosPorPique.get(pique.id) ?? [];
            const totalAberto = pedidosAbertos.reduce((sum, pedido) => sum + pedido.total, 0);
            const temComandaVirada = pedidosAbertos.some(
              (pedido) => pedido.criadoEm && isBeforeBrasiliaDay(pedido.criadoEm.toDate())
            );
            return (
              <motion.div
                key={pique.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setDetalhePique(pique)}
                className={`glass glass-hover rounded-2xl overflow-hidden border cursor-pointer ${
                  pique.ativo ? STATUS_COLOR[status] : "border-white/[0.05] opacity-50"
                }`}
              >
                {/* Top */}
                <div className="flex items-center gap-3 p-4">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                    pique.ativo ? "bg-forest-800" : "bg-forest-950"
                  }`}>
                    <span className="font-display font-black text-gold-400 text-lg leading-none">{pique.numero}</span>
                    {pique.capacidade && (
                      <span className="text-forest-600 text-[9px] flex items-center gap-0.5 mt-0.5">
                        <Users className="w-2.5 h-2.5" />{pique.capacidade}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-forest-50 truncate">
                      {pique.nome || `Mesa ${pique.numero}`}
                    </p>
                    <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_COLOR[status]}`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                      {STATUS_LABEL[status]}
                    </div>
                    {pedidosAbertos.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        <p className="text-gold-400 text-xs">
                          {pedidosAbertos.length} aberto{pedidosAbertos.length > 1 ? "s" : ""} · {formatCurrency(totalAberto)}
                        </p>
                        {temComandaVirada && (
                          <p className="text-red-300 text-[11px] flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Virou o dia aberta
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status rápido */}
                <div className="grid grid-cols-4 border-t border-white/[0.06]">
                  {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={(event) => {
                        event.stopPropagation();
                        setStatus(pique, s);
                      }}
                      title={STATUS_LABEL[s]}
                      className={`py-1.5 text-[10px] font-semibold transition-all ${
                        status === s
                          ? "bg-forest-700/60 text-gold-400"
                          : "text-forest-600 hover:text-forest-300 hover:bg-forest-800/40"
                      }`}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 px-3 py-2 border-t border-white/[0.06] bg-forest-950/30">
                  <button onClick={(event) => { event.stopPropagation(); printQr(pique); }} className="btn-ghost p-1.5 rounded-lg flex items-center gap-1 text-xs text-forest-400 hover:text-gold-400" title="Imprimir QR Code fixo">
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">QR fixo</span>
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); openQr(pique); }} className="btn-ghost p-1.5 rounded-lg" title="Ver QR Code fixo">
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); toggleAtivo(pique); }} className="btn-ghost p-1.5 rounded-lg" title={pique.ativo ? "Desativar" : "Ativar"}>
                    {pique.ativo
                      ? <ToggleRight className="w-4 h-4 text-forest-400" />
                      : <ToggleLeft  className="w-4 h-4 text-forest-700" />}
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); openEdit(pique); }} className="btn-ghost p-1.5 rounded-lg ml-auto">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(event) => { event.stopPropagation(); handleDelete(pique); }} className="btn-ghost p-1.5 rounded-lg hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Detalhes da comanda da mesa */}
      <AnimatePresence>
        {detalhePique && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(event) => event.target === event.currentTarget && setDetalhePique(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass rounded-3xl w-full max-w-lg max-h-[88dvh] overflow-hidden flex flex-col"
            >
              <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-forest-800 flex items-center justify-center shrink-0">
                  <ReceiptText className="w-5 h-5 text-gold-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-forest-500 text-xs">Comanda aberta</p>
                  <h2 className="font-display font-bold gradient-gold-text truncate">
                    {detalhePique.nome || `Mesa ${detalhePique.numero}`}
                  </h2>
                </div>
                <button onClick={() => setDetalhePique(null)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass rounded-2xl p-4">
                    <p className="text-forest-500 text-xs">Aberto</p>
                    <p className="font-display font-bold text-xl gradient-gold-text mt-1">
                      {formatCurrency(detalheTotalAberto)}
                    </p>
                    <p className="text-forest-600 text-xs mt-1">
                      {detalhePedidosAbertos.length} pedido{detalhePedidosAbertos.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="glass rounded-2xl p-4">
                    <p className="text-forest-500 text-xs">Fechamento</p>
                    <p className="font-display font-bold text-xl text-forest-200 mt-1">
                      Manual
                    </p>
                    <p className="text-forest-600 text-xs mt-1">Só fecha ao confirmar pagamento</p>
                  </div>
                </div>

                {detalheTemComandaVirada && (
                  <div className="glass rounded-2xl px-4 py-3 border border-gold-500/20 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-gold-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gold-400 font-semibold text-sm">Comanda aberta de dia anterior</p>
                      <p className="text-forest-500 text-xs mt-1">
                        Essa mesa virou a meia-noite sem pagamento confirmado.
                      </p>
                    </div>
                  </div>
                )}

                {detalhePedidos.length === 0 ? (
                  <div className="glass rounded-2xl p-8 text-center">
                    <ReceiptText className="w-10 h-10 text-forest-700 mx-auto mb-3" />
                    <p className="text-forest-300 font-semibold">Comanda fechada</p>
                    <p className="text-forest-600 text-sm mt-1">
                      Não há pedidos aguardando pagamento nessa mesa.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detalhePedidos.map((pedido) => (
                      <article key={pedido.id} className="glass rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
                          <div className="flex-1">
                            <p className="text-forest-100 font-semibold text-sm">
                              Pedido #{pedido.id.slice(-4).toUpperCase()}
                            </p>
                            <p className="text-forest-600 text-xs">
                              {pedido.criadoEm ? formatTime(pedido.criadoEm.toDate()) : "--"}
                            </p>
                          </div>
                          <span className={`badge ${pedido.status === "pago" ? "status-pago" : "status-novo"}`}>
                            Aberto
                          </span>
                          <span className="gradient-gold-text font-bold text-sm">
                            {formatCurrency(pedido.total)}
                          </span>
                        </div>

                        <div className="divide-y divide-white/[0.04]">
                          {pedido.itens.map((item, index) => (
                            <div key={index} className="px-4 py-2.5 flex items-start gap-2">
                              <span className="text-gold-500 font-bold text-sm">{item.quantidade}x</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-forest-200 text-sm">{item.nome}</p>
                                {item.obs && (
                                  <p className="text-forest-600 text-xs italic">{item.obs}</p>
                                )}
                              </div>
                              <span className="text-forest-400 text-xs shrink-0">
                                {formatCurrency(item.preco * item.quantidade)}
                              </span>
                            </div>
                          ))}
                          {pedido.observacaoGeral && (
                            <p className="px-4 py-2 text-forest-600 text-xs italic">
                              Obs: {pedido.observacaoGeral}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-white/[0.06] bg-forest-950/40">
                {detalhePedidosAbertos.length > 0 ? (
                  <button
                    onClick={receberComanda}
                    disabled={recebendo}
                    className="btn-gold w-full py-3.5 rounded-xl text-base disabled:opacity-60"
                  >
                    <Wallet className="w-5 h-5" />
                    {recebendo ? "Fechando..." : `Confirmar pagamento ${formatCurrency(detalheTotalAberto)}`}
                  </button>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-forest-400 text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Comanda fechada para hoje
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Form Modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setModal(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              className="glass rounded-3xl w-full max-w-sm p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold gradient-gold-text">
                  {editando ? "Editar Mesa" : "Nova Mesa"}
                </h2>
                <button onClick={() => setModal(false)} className="btn-ghost p-2 rounded-xl">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-forest-400 text-xs font-medium">Número / Código *</label>
                    <input
                      value={form.numero}
                      onChange={(e) => setForm({ ...form, numero: e.target.value })}
                      placeholder="01, A1, Q1..."
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-forest-400 text-xs font-medium flex items-center gap-1">
                      <Users className="w-3 h-3" /> Capacidade
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

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Nome / Apelido</label>
                  <input
                    value={form.nome}
                    onChange={(e) => setForm({ ...form, nome: e.target.value })}
                    placeholder="Ex: Quiosque da Sombra"
                    className="input-field"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-forest-400 text-xs font-medium">Status inicial</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["livre","ocupado","reservado","bloqueado"] as PiqueStatus[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setForm({ ...form, status: s })}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                          form.status === s
                            ? STATUS_COLOR[s] + " scale-[1.02]"
                            : "text-forest-600 border-forest-800 hover:border-forest-600"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleSave} disabled={saving} className="btn-gold w-full py-3 rounded-xl">
                {saving ? "Salvando..." : "Salvar Mesa"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {qrModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={(e) => e.target === e.currentTarget && setQrModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass rounded-3xl p-7 text-center space-y-5 max-w-xs w-full"
            >
              <div>
                <p className="text-forest-400 text-xs uppercase tracking-widest mb-1">QR Code</p>
                <h2 className="font-display text-xl font-bold gradient-gold-text">
                  {qrModal.nome || `Mesa ${qrModal.numero}`}
                </h2>
              </div>
              <div className="flex justify-center">
                <div className="p-3 rounded-2xl bg-white">
                  <canvas ref={canvasRef} className="rounded-xl" />
                </div>
              </div>
              <p className="text-forest-500 text-xs">Aponte a câmera para fazer o pedido</p>
              {!process.env.NEXT_PUBLIC_APP_URL && (
                <p className="text-forest-600 text-[11px] leading-relaxed">
                  Configure <code>NEXT_PUBLIC_APP_URL</code> na Vercel para gerar QR com domínio oficial.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => printQr(qrModal)} className="btn-gold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                  <Printer className="w-4 h-4" /> Imprimir PDF
                </button>
                <button onClick={downloadPng} className="btn-ghost py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5">
                  <Download className="w-4 h-4" /> PNG
                </button>
              </div>
              <button onClick={() => setQrModal(null)} className="text-forest-600 text-xs hover:text-forest-400 transition-colors">
                Fechar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
