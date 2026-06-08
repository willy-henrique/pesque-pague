import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { parseJsonBody } from "@/lib/api-auth";
import type { ItemPedido } from "@/types";

export const runtime = "nodejs";

interface CreatePedidoBody {
  piqueId?: string;
  piqueNome?: string;
  nomeCliente?: string;
  telefoneCliente?: string;
  itens?: ItemPedido[];
  observacaoGeral?: string;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sanitizeItens(value: unknown): ItemPedido[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 60) return null;

  const items: ItemPedido[] = [];

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") return null;
    const raw = rawItem as Partial<ItemPedido>;
    const preco = cleanNumber(raw.preco);
    const quantidade = cleanNumber(raw.quantidade);

    if (!raw.produtoId || !raw.nome || preco === null || quantidade === null) return null;
    if (preco < 0 || quantidade < 1 || quantidade > 99 || !Number.isInteger(quantidade)) return null;

    const adicionaisSelecionados = Array.isArray(raw.adicionaisSelecionados)
      ? raw.adicionaisSelecionados
          .slice(0, 20)
          .map((adicional) => ({
            nome: cleanString(adicional?.nome, 80),
            preco: cleanNumber(adicional?.preco) ?? 0,
          }))
          .filter((adicional) => adicional.nome)
      : undefined;

    items.push({
      produtoId: cleanString(raw.produtoId, 120),
      nome: cleanString(raw.nome, 120),
      preco,
      quantidade,
      fotoUrl: cleanString(raw.fotoUrl, 600),
      obs: cleanString(raw.obs, 200),
      tipo: raw.tipo === "bebida" ? "bebida" : "comida",
      ...(adicionaisSelecionados?.length ? { adicionaisSelecionados } : {}),
    });
  }

  return items;
}

export async function POST(request: Request) {
  try {
    const body = await parseJsonBody<CreatePedidoBody>(request);
    const piqueId = cleanString(body.piqueId, 80);
    const piqueNome = cleanString(body.piqueNome, 120);
    const itens = sanitizeItens(body.itens);

    if (!piqueId) {
      return Response.json({ error: "Mesa inválida." }, { status: 400 });
    }
    if (!itens) {
      return Response.json({ error: "Pedido sem itens válidos." }, { status: 400 });
    }

    const total = itens.reduce((sum, item) => sum + item.preco * item.quantidade, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return Response.json({ error: "Total do pedido inválido." }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = await db.collection("pedidos").add({
      piqueId,
      piqueNome: piqueNome || `Mesa ${piqueId}`,
      nomeCliente: cleanString(body.nomeCliente, 120),
      telefoneCliente: cleanString(body.telefoneCliente, 40),
      itens,
      observacaoGeral: cleanString(body.observacaoGeral, 300),
      total,
      status: "novo",
      criadoEm: FieldValue.serverTimestamp(),
      atualizadoEm: FieldValue.serverTimestamp(),
    });

    try {
      await db.collection("piques").doc(piqueId).update({ status: "ocupado" });
    } catch (err) {
      console.warn("[POST /api/pedidos] Pedido criado, mas mesa nao foi ocupada.", err);
    }

    return Response.json({ ok: true, id: ref.id });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[POST /api/pedidos]", err);
    return Response.json({ error: "Erro ao enviar pedido. Tente novamente." }, { status: 500 });
  }
}
