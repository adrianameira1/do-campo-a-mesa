import { createContext, useContext, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sessao')) || null;
    } catch {
      return null;
    }
  });

  function guardarSessao(nova) {
    localStorage.setItem('sessao', JSON.stringify(nova));
    setSessao(nova);
  }

  async function entrar(email, password) {
    const dados = await api('/auth/login', {
      metodo: 'POST',
      corpo: { email, password }
    });

    if (!dados?.token || !dados?.utilizador) {
      throw new Error('Resposta de autenticação inválida');
    }

    guardarSessao({
      token: dados.token,
      utilizador: dados.utilizador
    });

    return dados.utilizador;
  }

  function sair() {
    localStorage.removeItem('sessao');
    setSessao(null);
  }

  return (
    <AuthContext.Provider
      value={{
        utilizador: sessao?.utilizador || null,
        token: sessao?.token || null,
        entrar,
        sair,
        guardarSessao
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
