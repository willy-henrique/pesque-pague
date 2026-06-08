import type { OrderStatus, Pedido, SetorOrderStatus, SetorPedido } from "@/types";

const LEGACY_TO_SETOR: Record<Exclude<OrderStatus, "pago" | "cancelado">, SetorOrderStatus> = {
  novo: "novo",
  em_preparo: "em_preparo",
  saiu: "pronto",
  entregue: "entregue",
};

export function pedidoTemSetor(pedido: Pick<Pedido, "itens">, setor: SetorPedido) {
  return pedido.itens.some((item) =>
    setor === "bar" ? item.tipo === "bebida" : !item.tipo || item.tipo === "comida"
  );
}

export function getSetoresDoPedido(pedido: Pick<Pedido, "itens">): SetorPedido[] {
  return (["cozinha", "bar"] as SetorPedido[]).filter((setor) => pedidoTemSetor(pedido, setor));
}

export function getStatusDoSetor(pedido: Pedido, setor: SetorPedido): SetorOrderStatus | null {
  if (!pedidoTemSetor(pedido, setor)) return null;

  const explicit = setor === "cozinha" ? pedido.cozinhaStatus : pedido.barStatus;
  if (explicit) return explicit;

  if (pedido.status === "pago") return "entregue";
  if (pedido.status === "cancelado") return "novo";
  return LEGACY_TO_SETOR[pedido.status];
}

export function getStatusGeralPedido(pedido: Pedido): OrderStatus {
  if (pedido.status === "pago" || pedido.status === "cancelado") return pedido.status;

  const statuses = getSetoresDoPedido(pedido)
    .map((setor) => getStatusDoSetor(pedido, setor))
    .filter((status): status is SetorOrderStatus => status !== null);

  if (statuses.length === 0) return pedido.status;
  if (statuses.every((status) => status === "entregue")) return "entregue";
  if (statuses.every((status) => status === "pronto" || status === "entregue")) return "saiu";
  if (statuses.some((status) => status === "em_preparo" || status === "pronto" || status === "entregue")) {
    return "em_preparo";
  }
  return "novo";
}

export function isPedidoProntoParaRetirada(pedido: Pedido) {
  if (pedido.status === "pago" || pedido.status === "cancelado") return false;

  return (["cozinha", "bar"] as SetorPedido[]).some((setor) => getStatusDoSetor(pedido, setor) === "pronto");
}

export function getSetoresProntos(pedido: Pedido): SetorPedido[] {
  return (["cozinha", "bar"] as SetorPedido[]).filter((setor) => getStatusDoSetor(pedido, setor) === "pronto");
}

export function getSetoresPendentesEntrega(pedido: Pedido): SetorPedido[] {
  return (["cozinha", "bar"] as SetorPedido[]).filter((setor) => {
    const status = getStatusDoSetor(pedido, setor);
    return status === "pronto" || status === "entregue";
  });
}

export function buildPedidoStatusOnCreate(pedido: Pick<Pedido, "itens">) {
  return {
    status: "novo" as OrderStatus,
    ...(pedidoTemSetor(pedido, "cozinha") ? { cozinhaStatus: "novo" as SetorOrderStatus } : {}),
    ...(pedidoTemSetor(pedido, "bar") ? { barStatus: "novo" as SetorOrderStatus } : {}),
  };
}

export function buildPedidoStatusAfterSetorUpdate(
  pedido: Pedido,
  setor: SetorPedido,
  status: SetorOrderStatus
) {
  const nextPedido = {
    ...pedido,
    ...(setor === "cozinha" ? { cozinhaStatus: status } : { barStatus: status }),
  };

  return {
    ...(setor === "cozinha" ? { cozinhaStatus: status } : { barStatus: status }),
    status: getStatusGeralPedido(nextPedido),
  };
}
