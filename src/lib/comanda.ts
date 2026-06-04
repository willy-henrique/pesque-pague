import type { OrderStatus, Pedido } from "@/types";

export function isPedidoAberto(status: OrderStatus) {
  return status !== "pago" && status !== "cancelado";
}

export interface ClienteComanda {
  nome: string;
  telefone: string;
  pedidos: Pedido[];
  total: number;
}

export interface ComandaGrupo {
  piqueId: string;
  piqueNome: string;
  pedidos: Pedido[];
  total: number;
  comandaId: string;
  prontaParaCobrar: boolean;
  contagemPorStatus: Record<OrderStatus, number>;
  clientes: ClienteComanda[];
}

function toNumericComanda(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return (hash % 9999) + 1;
}

export function getComandaDisplayId(piqueId: string, pedidos: Pedido[]) {
  if (pedidos.length === 0) return "";

  const maisAntigo = pedidos.reduce((acc, atual) => {
    if (!acc.criadoEm || !atual.criadoEm) return acc;
    return atual.criadoEm.toDate().getTime() < acc.criadoEm.toDate().getTime() ? atual : acc;
  }, pedidos[0]);

  const base = `${piqueId}-${maisAntigo.id}`;
  return String(toNumericComanda(base)).padStart(4, "0");
}

function countByStatus(pedidos: Pedido[]): Record<OrderStatus, number> {
  const counts: Record<OrderStatus, number> = {
    novo: 0,
    em_preparo: 0,
    saiu: 0,
    entregue: 0,
    pago: 0,
    cancelado: 0,
  };
  for (const p of pedidos) counts[p.status] += 1;
  return counts;
}

/** Agrupa pedidos abertos por mesa, ordenando prontas para cobrar primeiro. */
export function groupComandasAbertas(pedidos: Pedido[]): ComandaGrupo[] {
  const map = new Map<string, ComandaGrupo>();

  for (const p of pedidos) {
    if (!isPedidoAberto(p.status)) continue;
    const g = map.get(p.piqueId);
    if (g) {
      g.pedidos.push(p);
      g.total += p.total;
    } else {
      map.set(p.piqueId, {
        piqueId: p.piqueId,
        piqueNome: p.piqueNome,
        pedidos: [p],
        total: p.total,
        comandaId: "",
        prontaParaCobrar: false,
        contagemPorStatus: countByStatus([]),
        clientes: [],
      });
    }
  }

  const grupos = Array.from(map.values()).map((g) => {
    const contagemPorStatus = countByStatus(g.pedidos);
    const prontaParaCobrar = g.pedidos.every((p) => p.status === "entregue");

    const clienteMap = new Map<string, ClienteComanda>();
    for (const p of g.pedidos) {
      const key = p.telefoneCliente || p.nomeCliente || "sem-identificacao";
      const entry = clienteMap.get(key);
      if (entry) {
        entry.pedidos.push(p);
        entry.total += p.total;
      } else {
        clienteMap.set(key, {
          nome: p.nomeCliente || "Sem nome",
          telefone: p.telefoneCliente || "",
          pedidos: [p],
          total: p.total,
        });
      }
    }

    return {
      ...g,
      comandaId: getComandaDisplayId(g.piqueId, g.pedidos),
      prontaParaCobrar,
      contagemPorStatus,
      clientes: Array.from(clienteMap.values()),
    };
  });

  return grupos.sort((a, b) => {
    if (a.prontaParaCobrar !== b.prontaParaCobrar) return a.prontaParaCobrar ? -1 : 1;
    return b.total - a.total;
  });
}

export function groupPedidosByPique(pedidos: Pedido[]) {
  const map = new Map<string, { piqueId: string; piqueNome: string; pedidos: Pedido[]; total: number }>();
  for (const p of pedidos) {
    const g = map.get(p.piqueId);
    if (g) {
      g.pedidos.push(p);
      g.total += p.total;
    } else {
      map.set(p.piqueId, {
        piqueId: p.piqueId,
        piqueNome: p.piqueNome,
        pedidos: [p],
        total: p.total,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
