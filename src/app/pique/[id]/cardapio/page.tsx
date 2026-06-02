"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fish, ShoppingCart, Plus, Minus, ChevronLeft, Search, X, Receipt, Zap,
} from "lucide-react";
import Image from "next/image";
import { useCollection, orderBy } from "@/hooks/useFirestore";
import { useCart } from "@/store/cart";
import { useModoAtendenteAuth } from "@/hooks/useModoAtendenteAuth";
import { withModoAtendente } from "@/lib/atendente";
import { formatCurrency } from "@/lib/utils";
import type { Produto, Categoria, Promocao } from "@/types";

export default function Cardapio() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const { modoAtendente, ready: authReady } = useModoAtendenteAuth();
  const cart    = useCart();

  const comandaHref = withModoAtendente(`/pique/${id}/comanda`);
  const carrinhoHref = withModoAtendente(`/pique/${id}/carrinho`);

  const voltar = () => {
    if (modoAtendente) router.push(comandaHref);
    else router.back();
  };

  const [catAtiva, setCatAtiva] = useState<string>("todas");
  const [busca, setBusca]       = useState("");
  const [showBusca, setShowBusca] = useState(false);

  // Queries simples sem índice composto — filtro/ordenação client-side
  const { data: todasCategorias, loading: loadCat } = useCollection<Categoria>("categorias", [
    orderBy("ordem", "asc"),
  ]);
  const { data: todosProdutos, loading: loadProd } = useCollection<Produto>("produtos");
  const { data: todasPromocoes } = useCollection<Promocao>("promocoes");

  const promocoesAtivas = useMemo(
    () => todasPromocoes.filter((p) => p.ativo),
    [todasPromocoes]
  );

  const loading = loadCat || loadProd;

  const categorias = useMemo(
    () => todasCategorias.filter((c) => c.ativo),
    [todasCategorias]
  );

  const produtosFiltrados = useMemo(() => {
    let list = todosProdutos.filter((p) => p.ativo && p.estoque > 0);
    if (catAtiva !== "todas") list = list.filter((p) => p.categoriaId === catAtiva);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter((p) => p.nome.toLowerCase().includes(q));
    }
    return list;
  }, [todosProdutos, catAtiva, busca]);

  const cartCount = cart.count();

  if (modoAtendente && !authReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-forest-50">
        <p className="text-forest-500 text-sm">Verificando acesso...</p>
      </div>
    );
  }

  return (
    <main className="min-h-dvh flex flex-col" style={{ background: "#F8FAFC" }}>
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/[0.06]">
        <div className="flex items-center gap-3 px-4 py-3 max-w-xl mx-auto">
          <button type="button" onClick={voltar} className="btn-ghost p-2 rounded-xl" aria-label="Voltar">
            <ChevronLeft className="w-5 h-5" />
          </button>

          <AnimatePresence mode="wait">
            {showBusca ? (
              <motion.div
                key="search"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "100%" }}
                exit={{ opacity: 0, width: 0 }}
                className="flex-1"
              >
                <input
                  autoFocus
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar produtos..."
                  className="input-field py-2 text-sm"
                />
              </motion.div>
            ) : (
              <motion.div key="title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1">
                <h1 className="font-display text-lg font-semibold text-gold-400">Cardápio</h1>
                <p className="text-forest-400 text-xs">Escolha seus itens</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => { setShowBusca((v) => !v); setBusca(""); }}
            className="btn-ghost p-2 rounded-xl"
          >
            {showBusca ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          <button
            onClick={() => router.push(comandaHref)}
            className="btn-ghost px-3 py-2 rounded-xl text-sm"
            title="Minha Comanda"
          >
            <Receipt className="w-5 h-5" />
          </button>

          <button
            onClick={() => router.push(carrinhoHref)}
            className="relative btn-gold px-3 py-2 rounded-xl text-sm"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-forest-900 text-gold-500 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center border border-gold-500/40">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar max-w-xl mx-auto">
          <CategoryChip
            label="Todos"
            active={catAtiva === "todas"}
            onClick={() => setCatAtiva("todas")}
          />
          {categorias.map((cat) => (
            <CategoryChip
              key={cat.id}
              label={`${cat.icone} ${cat.nome}`}
              active={catAtiva === cat.id}
              onClick={() => setCatAtiva(cat.id)}
            />
          ))}
        </div>
      </header>

      {/* Promoções do Dia */}
      <AnimatePresence>
        {promocoesAtivas.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-4 pt-4 max-w-xl mx-auto w-full"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-gold-500" />
              <h2 className="font-display font-bold text-gold-400 text-sm">Promoções do Dia</h2>
              <span className="badge status-novo text-[10px] animate-pulse-gold">
                {promocoesAtivas.length}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {promocoesAtivas.map((promo) => (
                <PromoCard key={promo.id} promo={promo} />
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="flex-1 px-4 py-4 max-w-xl mx-auto w-full">
        {loading ? (
          <ProductGridSkeleton />
        ) : produtosFiltrados.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <Fish className="w-14 h-14 text-forest-700" />
            <p className="text-forest-400">Nenhum produto encontrado.</p>
          </div>
        ) : (
          <motion.div
            className="grid grid-cols-2 gap-3"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
          >
            {produtosFiltrados.map((produto) => (
              <ProductCard key={produto.id} produto={produto} />
            ))}
          </motion.div>
        )}
      </div>

      {/* Cart CTA */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="sticky bottom-0 p-4 max-w-xl mx-auto w-full"
          >
            <div className="glass rounded-2xl p-1">
              <button
                onClick={() => router.push(carrinhoHref)}
                className="btn-gold w-full py-3.5 rounded-xl text-base"
              >
                <ShoppingCart className="w-5 h-5" />
                Ver carrinho ({cartCount} {cartCount === 1 ? "item" : "itens"})
                <span className="ml-auto font-bold">{formatCurrency(cart.total())}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
        active
          ? "bg-gold-600 text-white shadow-gold-glow"
          : "glass text-forest-600 hover:border-gold-500/30"
      }`}
    >
      {label}
    </button>
  );
}

function ProductCard({ produto }: { produto: Produto }) {
  const { items, addItem, updateQty } = useCart();
  const itemNoCarrinho = items.find((i) => i.produtoId === produto.id);
  const qty = itemNoCarrinho?.quantidade ?? 0;

  return (
    <motion.div
      variants={{
        hidden:  { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
      className="glass glass-hover rounded-2xl overflow-hidden flex flex-col"
    >
      {/* Image */}
      <div className="relative h-36 bg-forest-800 overflow-hidden">
        {produto.fotoUrl ? (
          <Image
            src={produto.fotoUrl}
            alt={produto.nome}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Fish className="w-10 h-10 text-forest-600" />
          </div>
        )}
        {produto.estoque <= 3 && produto.estoque > 0 && (
          <span className="absolute top-2 left-2 badge status-preparo text-[10px]">
            Últimas unidades
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col flex-1 gap-2">
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-forest-900 leading-tight line-clamp-2">
            {produto.nome}
          </h3>
          {produto.descricao && (
            <p className="text-forest-400 text-xs mt-0.5 line-clamp-1">{produto.descricao}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="gradient-gold-text font-bold text-sm">
            {formatCurrency(produto.preco)}
          </span>

          {qty === 0 ? (
            <button
              onClick={() => addItem(produto)}
              className="btn-gold p-1.5 rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQty(produto.id, qty - 1)}
                className="btn-ghost p-1 rounded-lg w-7 h-7 justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-gold-400 font-bold text-sm w-5 text-center">{qty}</span>
              <button
                onClick={() => updateQty(produto.id, qty + 1)}
                className="btn-gold p-1 rounded-lg w-7 h-7 justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function PromoCard({ promo }: { promo: Promocao }) {
  const { items, addItem, updateQty } = useCart();
  const promoItemId = `promo-${promo.id}`;
  const itemNoCarrinho = items.find((i) => i.produtoId === promoItemId);
  const qty = itemNoCarrinho?.quantidade ?? 0;

  const pct = promo.precoOriginal > 0
    ? Math.round((1 - promo.precoPromocional / promo.precoOriginal) * 100)
    : 0;

  const addPromo = () => {
    addItem({
      id:       promoItemId,
      nome:     promo.titulo,
      preco:    promo.precoPromocional,
      fotoUrl:  promo.fotoUrl,
      descricao: promo.descricao,
      categoriaId: "",
      estoque:  99,
      ativo:    true,
    } as unknown as Produto);
  };

  return (
    <div className="shrink-0 w-52 glass rounded-2xl overflow-hidden border border-gold-500/20 flex flex-col">
      <div className="relative h-28 bg-forest-800 overflow-hidden">
        {promo.fotoUrl ? (
          <Image src={promo.fotoUrl} alt={promo.titulo} fill className="object-cover" sizes="208px" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Fish className="w-8 h-8 text-forest-600" />
          </div>
        )}
        {pct > 0 && (
          <div className="absolute top-0 left-0 bg-gold-500 text-forest-950 text-xs font-black px-2 py-0.5 rounded-br-xl">
            -{pct}%
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="font-semibold text-xs text-forest-900 leading-tight line-clamp-2">{promo.titulo}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {promo.precoOriginal > 0 && (
            <span className="text-forest-600 text-xs line-through">
              {formatCurrency(promo.precoOriginal)}
            </span>
          )}
          <span className="gradient-gold-text font-bold text-sm">
            {formatCurrency(promo.precoPromocional)}
          </span>
        </div>
        <div className="mt-auto">
          {qty === 0 ? (
            <button onClick={addPromo} className="btn-gold w-full py-1.5 rounded-xl text-xs">
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          ) : (
            <div className="flex items-center justify-between gap-1">
              <button
                onClick={() => updateQty(promoItemId, qty - 1)}
                className="btn-ghost p-1 rounded-lg w-7 h-7 justify-center"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-gold-400 font-bold text-sm w-5 text-center">{qty}</span>
              <button
                onClick={() => updateQty(promoItemId, qty + 1)}
                className="btn-gold p-1 rounded-lg w-7 h-7 justify-center"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden">
          <div className="skeleton-pulse h-36" />
          <div className="p-3 space-y-2">
            <div className="skeleton-pulse h-4 w-3/4 rounded" />
            <div className="skeleton-pulse h-3 w-full rounded" />
            <div className="skeleton-pulse h-8 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}
