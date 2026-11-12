
import { createContext, useContext, useMemo, useState } from 'react';
import { useAuth } from './AuthContext.jsx';

const CarrinhoContext = createContext(null);

// Cada utilizador tem um carrinho independente no navegador.
function lerCarrinho(chave) {
  try {
    const guardado = JSON.parse(localStorage.getItem(chave) || '[]');
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

export function CarrinhoProvider({ children }) {
  const { utilizador } = useAuth();
  const chave = `carrinho:${utilizador?._id || 'visitante'}`;

  // O estado identifica a conta à qual pertence o carrinho.
  const [estado, setEstado] = useState(() => ({
    chave,
    linhas: lerCarrinho(chave)
  }));

  // Ao mudar de utilizador, não apresentar linhas da conta anterior.
  const linhas = estado.chave === chave
    ? estado.linhas
    : lerCarrinho(chave);

  function setLinhas(atualizar) {
    setEstado((anterior) => {
      const atuais = anterior.chave === chave
        ? anterior.linhas
        : lerCarrinho(chave);

      const novas = typeof atualizar === 'function'
        ? atualizar(atuais)
        : atualizar;

      try {
        localStorage.setItem(chave, JSON.stringify(novas));
      } catch {
        // O navegador pode impedir o armazenamento.
      }

      return { chave, linhas: novas };
    });
  }

  function adicionar(produto, quantidade = 1) {
    setLinhas((atual) => {
      const existe = atual.find((l) => l.produto._id === produto._id);

      if (existe) {
        return atual.map((l) =>
          l.produto._id === produto._id
            ? { ...l, quantidade: l.quantidade + quantidade }
            : l
        );
      }

      return [...atual, { produto, quantidade }];
    });
  }

  function alterarQuantidade(produtoId, quantidade) {
    setLinhas((atual) =>
      quantidade < 1
        ? atual.filter((l) => l.produto._id !== produtoId)
        : atual.map((l) =>
            l.produto._id === produtoId
              ? { ...l, quantidade }
              : l
          )
    );
  }

  function remover(produtoId) {
    alterarQuantidade(produtoId, 0);
  }

  function esvaziar() {
    setLinhas([]);
  }

  const total = useMemo(
    () => linhas.reduce(
      (soma, linha) => soma + linha.produto.preco * linha.quantidade,
      0
    ),
    [linhas]
  );

  return (
    <CarrinhoContext.Provider
      value={{
        linhas,
        adicionar,
        alterarQuantidade,
        remover,
        esvaziar,
        total
      }}
    >
      {children}
    </CarrinhoContext.Provider>
  );
}

export const useCarrinho = () => useContext(CarrinhoContext);
