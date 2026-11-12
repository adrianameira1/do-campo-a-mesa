import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';

const dadosIniciais = {
  nome: '',
  email: '',
  password: '',
  confirmarPassword: '',
  papel: 'comprador',
  nomeExploracao: '',
  localidade: ''
};

export default function Registo() {
  const navigate = useNavigate();

  const [dados, setDados] = useState(dadosIniciais);
  const [erro, setErro] = useState('');
  const [aEnviar, setAEnviar] = useState(false);

  function atualizar(campo, valor) {
    setDados((anteriores) => ({
      ...anteriores,
      [campo]: valor
    }));
  }

  async function submeter(e) {
    e.preventDefault();
    setErro('');

    if (dados.password !== dados.confirmarPassword) {
      setErro('As passwords não coincidem.');
      return;
    }

    if (dados.password.length < 8) {
      setErro('A password deve ter pelo menos 8 caracteres.');
      return;
    }

    const corpo = {
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      password: dados.password,
      papel: dados.papel
    };

    if (dados.papel === 'produtor') {
      corpo.produtor = {
        nomeExploracao: dados.nomeExploracao.trim(),
        localidade: dados.localidade.trim()
      };
    }

    setAEnviar(true);

    try {
      await api('/auth/registo', {
        metodo: 'POST',
        corpo
      });

      navigate('/login', {
        replace: true,
        state: {
          mensagem: dados.papel === 'produtor'
            ? 'Conta criada! A exploração aguarda aprovação administrativa. Já podes iniciar sessão.'
            : 'Conta criada com sucesso! Já podes iniciar sessão.'
        }
      });
    } catch (err) {
      setErro(err.message || 'Não foi possível criar a conta.');
    } finally {
      setAEnviar(false);
    }
  }

  return (
    <form className="formulario-estreito" onSubmit={submeter}>
      <h1>Registar</h1>

      <label htmlFor="registo-nome" className="form-label">
        Nome
      </label>
      <input
        id="registo-nome"
        className="form-control mb-3"
        type="text"
        autoComplete="name"
        required
        value={dados.nome}
        onChange={(e) => atualizar('nome', e.target.value)}
      />

      <label htmlFor="registo-email" className="form-label">
        Email
      </label>
      <input
        id="registo-email"
        className="form-control mb-3"
        type="email"
        autoComplete="email"
        required
        value={dados.email}
        onChange={(e) => atualizar('email', e.target.value)}
      />

      <label htmlFor="registo-password" className="form-label">
        Password
      </label>
      <input
        id="registo-password"
        className="form-control mb-3"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={dados.password}
        onChange={(e) => atualizar('password', e.target.value)}
      />

      <label htmlFor="registo-confirmar" className="form-label">
        Confirmar password
      </label>
      <input
        id="registo-confirmar"
        className="form-control mb-3"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        value={dados.confirmarPassword}
        onChange={(e) => atualizar('confirmarPassword', e.target.value)}
      />

      <label htmlFor="registo-papel" className="form-label">
        Tipo de conta
      </label>
      <select
        id="registo-papel"
        className="form-select mb-3"
        value={dados.papel}
        onChange={(e) => atualizar('papel', e.target.value)}
      >
        <option value="comprador">Comprador</option>
        <option value="produtor">Produtor</option>
      </select>

      {dados.papel === 'produtor' && (
        <>
          <label htmlFor="registo-exploracao" className="form-label">
            Nome da exploração
          </label>
          <input
            id="registo-exploracao"
            className="form-control mb-3"
            type="text"
            required
            value={dados.nomeExploracao}
            onChange={(e) => atualizar('nomeExploracao', e.target.value)}
          />

          <label htmlFor="registo-localidade" className="form-label">
            Localidade
          </label>
          <input
            id="registo-localidade"
            className="form-control mb-3"
            type="text"
            required
            value={dados.localidade}
            onChange={(e) => atualizar('localidade', e.target.value)}
          />
        </>
      )}

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-success w-100"
        disabled={aEnviar}
      >
        {aEnviar ? 'A criar conta...' : 'Criar conta'}
      </button>

      <p className="mt-3 text-center">
        Já tens conta? <Link to="/login">Iniciar sessão</Link>
      </p>
    </form>
  );
}
