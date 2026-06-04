"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Produto } from "@/types";

interface CartStore {
  items: CartItem[];
  piqueId: string | null;
  piqueNome: string | null;

  addItem: (produto: Produto, obs?: string, adicionaisSelecionados?: { nome: string; preco: number }[]) => void;
  removeItem: (produtoId: string) => void;
  updateQty: (produtoId: string, qty: number) => void;
  updateObs: (produtoId: string, obs: string) => void;
  clearCart: () => void;
  setPique: (id: string, nome: string) => void;

  total: () => number;
  count: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      piqueId: null,
      piqueNome: null,

      addItem(produto, obs = "", adicionaisSelecionados) {
        const extras = adicionaisSelecionados?.length ? adicionaisSelecionados : undefined;
        const precoUnit = produto.preco + (extras ?? []).reduce((s, a) => s + a.preco, 0);
        // itens com mesmo produto + mesmos adicionais são agrupados; combinações diferentes = entradas distintas
        const cartKey = extras?.length
          ? `${produto.id}__${extras.map((a) => a.nome).sort().join("|")}`
          : produto.id;

        set((state) => {
          const existing = state.items.find((i) => i.produtoId === cartKey);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.produtoId === cartKey ? { ...i, quantidade: i.quantidade + 1 } : i
              ),
            };
          }
          return {
            items: [
              ...state.items,
              {
                produtoId: cartKey,
                nome:      produto.nome,
                preco:     precoUnit,
                fotoUrl:   produto.fotoUrl,
                quantidade: 1,
                obs:       obs ?? "",
                tipo:      produto.tipo ?? "comida",
                adicionaisSelecionados: extras,
              },
            ],
          };
        });
      },

      removeItem(produtoId) {
        set((state) => ({
          items: state.items.filter((i) => i.produtoId !== produtoId),
        }));
      },

      updateQty(produtoId, qty) {
        if (qty <= 0) {
          get().removeItem(produtoId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.produtoId === produtoId ? { ...i, quantidade: qty } : i
          ),
        }));
      },

      updateObs(produtoId, obs) {
        set((state) => ({
          items: state.items.map((i) =>
            i.produtoId === produtoId ? { ...i, obs } : i
          ),
        }));
      },

      clearCart() {
        set({ items: [], piqueId: null, piqueNome: null });
      },

      setPique(id, nome) {
        set({ piqueId: id, piqueNome: nome });
      },

      total() {
        return get().items.reduce(
          (acc, i) => acc + i.preco * i.quantidade,
          0
        );
      },

      count() {
        return get().items.reduce((acc, i) => acc + i.quantidade, 0);
      },
    }),
    { name: "willtech-cart" }
  )
);
