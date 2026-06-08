import type { CartItem } from "@/types";

function sanitizeAdicionais(
  adicionais: CartItem["adicionaisSelecionados"]
) {
  if (!adicionais?.length) return [];

  return adicionais
    .filter((adicional) => adicional?.nome && Number.isFinite(adicional.preco))
    .map((adicional) => ({
      nome: adicional.nome,
      preco: adicional.preco,
    }));
}

export function serializeCartItems(items: CartItem[]) {
  return items.map((item) => {
    const adicionaisSelecionados = sanitizeAdicionais(item.adicionaisSelecionados);

    return {
      produtoId: item.produtoId,
      nome: item.nome,
      preco: item.preco,
      quantidade: item.quantidade,
      fotoUrl: item.fotoUrl || "",
      obs: item.obs || "",
      tipo: item.tipo || "comida",
      ...(adicionaisSelecionados.length > 0 ? { adicionaisSelecionados } : {}),
    };
  });
}
