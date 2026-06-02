import { Timestamp } from "firebase/firestore";

export type OrderStatus =
  | "novo"
  | "em_preparo"
  | "saiu"
  | "entregue"
  | "pago"
  | "cancelado";

export interface Categoria {
  id: string;
  nome: string;
  icone: string;
  ordem: number;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  preco: number;
  fotoUrl: string;
  categoriaId: string;
  categoriaNome?: string;
  estoque: number;
  ativo: boolean;
}

export type PiqueStatus = "livre" | "ocupado" | "reservado" | "bloqueado";

export interface ReservaPique {
  nome: string;
  telefone: string;
  data: string; // YYYY-MM-DD
}

export interface Pique {
  id: string;
  numero: string;
  nome: string;
  ativo: boolean;
  status?: PiqueStatus;
  capacidade?: number;
  reserva?: ReservaPique;
}

export interface ItemPedido {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  fotoUrl: string;
  obs: string;
}

export interface Pedido {
  id: string;
  piqueId: string;
  piqueNome: string;
  itens: ItemPedido[];
  observacaoGeral: string;
  total: number;
  status: OrderStatus;
  criadoEm: Timestamp;
  atualizadoEm: Timestamp;
}

export interface Promocao {
  id: string;
  titulo: string;
  descricao: string;
  produtoId: string;   // "" = promoção avulsa
  precoOriginal: number;
  precoPromocional: number;
  fotoUrl: string;
  ativo: boolean;
  criadoEm: Timestamp;
}

export interface Config {
  nomeEstabelecimento: string;
  logoUrl: string;
  modoManutencao: boolean;
}

export interface FechamentoCaixa {
  id: string;
  data: string;           // "2026-05-26"
  totalRecebido: number;  // pedidos status "pago"
  totalPendente: number;  // pedidos status "entregue" não pagos
  totalPedidos: number;
  ticketMedio: number;
  piquesFechados: number;
  criadoEm: Timestamp;
}

export interface CartItem extends Omit<ItemPedido, "produtoId"> {
  produtoId: string;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  novo:       "Novo pedido",
  em_preparo: "Em preparo",
  saiu:       "Saiu para entrega",
  entregue:   "Entregue",
  pago:       "Pago no caixa",
  cancelado:  "Cancelado pelo cliente",
};

export const STATUS_ORDER: OrderStatus[] = [
  "novo",
  "em_preparo",
  "saiu",
  "entregue",
  "pago",
];

export const STATUS_NEXT: Partial<Record<OrderStatus, OrderStatus>> = {
  novo:       "em_preparo",
  em_preparo: "saiu",
  saiu:       "entregue",
  entregue:   "pago",
};
