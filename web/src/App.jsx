// Passo 2: routing no cliente
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Notificacoes from './components/Notificacoes.jsx';
import RotaProtegida from './components/RotaProtegida.jsx';
import Catalogo from './pages/Catalogo.jsx';
import Produtor from './pages/Produtor.jsx';
import Leiloes from './pages/Leiloes.jsx';
import SalaLeilao from './pages/SalaLeilao.jsx';
import Carrinho from './pages/Carrinho.jsx';
import Encomendas from './pages/Encomendas.jsx';
import Login from './pages/Login.jsx';
import Registo from './pages/Registo.jsx';
import PainelProdutor from './pages/produtor/Painel.jsx';
import NovoLeilao from './pages/produtor/NovoLeilao.jsx';
import PainelAdmin from './pages/admin/Painel.jsx';
import NaoEncontrado from './pages/NaoEncontrado.jsx';
import Produtos from './pages/produtor/Produtos.jsx';
import DetalheProduto from './pages/DetalheProduto.jsx';

export default function App() {
  return (
    <>
      <Navbar />
      <Notificacoes />
      <main className="container-xl py-4">
        <Routes>
          {/* Visitante */}
          <Route path="/" element={<Catalogo />} />
          <Route path="/produtos/:id" element={<DetalheProduto />} />
          <Route path="/produtores/:id" element={<Produtor />} />
          <Route path="/leiloes" element={<Leiloes />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registo" element={<Registo />} />


          {/* Qualquer utilizador autenticado pode assistir ao leilão */}
          <Route element={<RotaProtegida />}>
            <Route path="/leiloes/:id" element={<SalaLeilao />} />
          </Route>

          {/* Apenas compradores */}
          <Route element={<RotaProtegida papeis={['comprador']} />}>
            <Route path="/carrinho" element={<Carrinho />} />
            <Route path="/encomendas" element={<Encomendas />} />
          </Route>


          {/* Produtor */}
          <Route element={<RotaProtegida papeis={['produtor']} />}>
            <Route path="/produtor" element={<PainelProdutor />} />
            <Route path="/produtor/leiloes/novo" element={<NovoLeilao />} />
            <Route path="/produtor/produtos" element={<Produtos />} />
          </Route>

          {/* Administrador */}
          <Route element={<RotaProtegida papeis={['admin']} />}>
            <Route path="/admin" element={<PainelAdmin />} />
          </Route>

          <Route path="*" element={<NaoEncontrado />} />
        </Routes>
      </main>
    </>
  );
}
