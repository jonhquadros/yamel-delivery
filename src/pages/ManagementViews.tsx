/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BarChart,
  Users,
  Settings,
  Smartphone,
  RefreshCw,
  Plus,
  Edit,
  ShieldAlert,
  Key,
  Store,
  MapPin,
  Phone,
  Clock,
  ArrowLeft,
  HeartCrack,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader, CardContent } from '../components/ui/DataDisplay';
import { Button } from '../components/ui/Button';

// 1. RELATORIOS VIEW
export function RelatoriosView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios Operacionais"
        description="Analíticos de faturamento, vendas por produto e desempenho geral."
        id="relatorios-header"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Faturamento Mensal', val: 'R$ 38.450,00', desc: 'Previsão de crescimento: +12%' },
          { label: 'Total Pedidos (Mês)', val: '1.240', desc: 'Média de 41 pedidos/dia' },
          { label: 'Ticket Médio Mensal', val: 'R$ 31,00', desc: 'Aumento de R$ 1,50 vs. anterior' },
        ].map((item, idx) => (
          <Card key={idx} id={`report-card-${idx}`} className="p-5">
            <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase select-none">{item.label}</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{item.val}</div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card id="reports-bestsellers-card">
          <CardHeader id="reports-bestsellers-header" title="Mais Vendidos" subtitle="Produtos com maior volume de saída" />
          <CardContent id="reports-bestsellers-body" className="flex flex-col gap-3 py-3">
            {[
              { name: 'Burger Clássico', qty: '480 unidades', val: 'R$ 11.952,00', share: '38%' },
              { name: 'Yamel Especial', qty: '320 unidades', val: 'R$ 10.528,00', share: '32%' },
              { name: 'Batata Frita G', qty: '290 unidades', val: 'R$ 4.060,00', share: '18%' },
            ].map((prod, idx) => (
              <div key={idx} className="flex justify-between items-center text-xs">
                <div>
                  <h5 className="font-bold text-slate-800">{prod.name}</h5>
                  <p className="text-[10px] text-slate-400 mt-0.5">{prod.qty} vendidas</p>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-slate-900 block">{prod.val}</span>
                  <span className="text-[10px] text-emerald-600 font-bold">{prod.share} share</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card id="reports-methods-card">
          <CardHeader id="reports-methods-header" title="Formas de Pagamento" subtitle="Distribuição por faturamento" />
          <CardContent id="reports-methods-body" className="flex flex-col gap-3 py-3">
            {[
              { name: 'Pix', share: '55%', total: 'R$ 21.147,50', barColor: 'bg-emerald-600' },
              { name: 'Cartão de Crédito', share: '30%', total: 'R$ 11.535,00', barColor: 'bg-blue-600' },
              { name: 'Cartão de Débito', share: '10%', total: 'R$ 3.845,00', barColor: 'bg-indigo-600' },
              { name: 'Dinheiro (Espécie)', share: '5%', total: 'R$ 1.922,50', barColor: 'bg-amber-600' },
            ].map((method, idx) => (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700">{method.name}</span>
                  <span className="text-slate-900">{method.share} <span className="text-slate-400 font-normal">({method.total})</span></span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${method.barColor}`} style={{ width: method.share }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 2. USUARIOS VIEW
export function UsuariosView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Controle de acessos e cargos da equipe Yamel."
        id="usuarios-header"
        primaryAction={
          <Button id="user-add-btn" size="sm">
            <Plus className="w-4 h-4 mr-1" /> Novo Usuário
          </Button>
        }
      />

      <div className="w-full overflow-x-auto border border-slate-100 rounded-xl bg-white shadow-2xs">
        <table id="users-table" className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/75 border-b border-slate-100 text-xs font-semibold text-slate-600 select-none">
              <th className="px-5 py-3">Nome</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Cargo / Função</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {[
              { name: 'João Quadros', email: 'jonhquadros@gmail.com', role: 'Administrador (Dono)', status: 'Ativo' },
              { name: 'Carlos Santos', email: 'carlos.kds@yamel.com', role: 'Chefe de Cozinha', status: 'Ativo' },
              { name: 'Amanda Silva', email: 'amanda.caixa@yamel.com', role: 'Operador de Caixa', status: 'Ativo' },
              { name: 'Felipe Melo', email: 'felipe.entregas@yamel.com', role: 'Motoboy / Entregador', status: 'Ausente' },
            ].map((usr, idx) => (
              <tr key={idx} className="hover:bg-slate-50/40 transition-colors">
                <td className="px-5 py-3.5 font-bold text-slate-900">{usr.name}</td>
                <td className="px-5 py-3.5 text-slate-500">{usr.email}</td>
                <td className="px-5 py-3.5 font-semibold text-slate-700">{usr.role}</td>
                <td className="px-5 py-3.5">
                  <span className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${
                    usr.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {usr.status}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <button id={`user-edit-${idx}`} className="p-1 text-slate-400 hover:text-slate-600 transition-colors inline-block focus:outline-none">
                    <Edit className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 3. CONFIGURACOES VIEW
export function ConfiguracoesView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações Gerais"
        description="Perfis, preferências operacionais e dados comerciais do estabelecimento."
        id="configuracoes-header"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Company Profile Settings Form */}
        <div className="lg:col-span-2 flex flex-col gap-5">
          <Card id="config-form-card">
            <CardHeader id="config-form-header" title="Perfil da Empresa" subtitle="Informações comerciais exibidas no catálogo e comprovantes" />
            <CardContent id="config-form-body" className="flex flex-col gap-4 py-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Trade Name */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">Nome de Exibição / Fantasia</label>
                  <input
                    type="text"
                    defaultValue="Yamel Hamburgueria Gourmet"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
                {/* Legal Corporate Name */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">Razão Social</label>
                  <input
                    type="text"
                    defaultValue="Yamel Alimentos S/A"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Document CNPJ */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">CNPJ</label>
                  <input
                    type="text"
                    defaultValue="12.345.678/0001-90"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
                {/* Contact Email */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">E-mail de Contato</label>
                  <input
                    type="email"
                    defaultValue="contato@yamel.com.br"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Whatsapp */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">WhatsApp Oficial da Empresa</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      defaultValue="+55 11 99999-8888"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-semibold"
                    />
                  </div>
                </div>

                {/* Opening Hours */}
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">Horário de Funcionamento</label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      defaultValue="Terça a Domingo — 18:00 às 23:30"
                      className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="flex flex-col gap-1 w-full">
                <label className="text-xs font-semibold text-slate-700 select-none">Endereço Físico</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    defaultValue="Av. Paulista, 1000 - Bela Vista, São Paulo - SP"
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              {/* Delivery Settings */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">Taxa de Entrega Padrão</label>
                  <input
                    type="text"
                    defaultValue="R$ 7,00"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
                <div className="flex flex-col gap-1 w-full">
                  <label className="text-xs font-semibold text-slate-700 select-none">Tempo Estimado de Entrega</label>
                  <input
                    type="text"
                    defaultValue="35 a 50 min"
                    className="w-full px-3 py-2 text-sm border border-slate-200 bg-slate-50 text-slate-800 rounded-lg outline-none font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-100 mt-2">
                <Button id="config-save-btn">
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column settings quick list */}
        <div className="flex flex-col gap-4">
          <Card id="config-quick-status">
            <CardHeader id="config-quick-status-hdr" title="Integrações Ativas" subtitle="Status dos módulos conectados" />
            <CardContent id="config-quick-status-bdy" className="flex flex-col gap-4 py-4 text-xs font-semibold text-slate-700">
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span>Catálogo Online QR Code</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Ativo</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span>Sincronizador KDS Cozinha</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Ativo</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                <span>Impressão Térmica de Cupom</span>
                <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Configurado</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Notificação WhatsApp</span>
                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] uppercase font-bold">Ativo</span>
              </div>
            </CardContent>
          </Card>

          <Card id="config-security-card">
            <CardHeader id="config-security-hdr" title="Segurança & Terminal" subtitle="Modo de operação do PDV" />
            <CardContent id="config-security-bdy" className="flex flex-col gap-3 py-4 text-xs">
              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-lg">
                <ShieldAlert className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <div>
                  <h6 className="font-bold text-slate-800">Modo Local-First Habilitado</h6>
                  <p className="text-[11px] text-slate-500 mt-0.5">Operações registradas com segurança no terminal em caso de oscilação de rede.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// 4. FALLBACK 404 VIEW
export interface NotFoundViewProps {
  onBackToDashboard: () => void;
}

export function NotFoundView({ onBackToDashboard }: NotFoundViewProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-slate-50/20 rounded-2xl border border-slate-100/50">
      <div className="p-4 bg-red-50 border border-red-100 rounded-2xl mb-4 text-red-600 shadow-xs">
        <HeartCrack className="w-8 h-8" />
      </div>
      <h1 className="text-lg font-extrabold text-slate-950 tracking-tight">Página não encontrada</h1>
      <p className="text-xs text-slate-500 max-w-xs leading-relaxed mt-1 mb-5">
        Não encontramos a página que você está procurando no ecossistema administrativo.
      </p>
      <Button id="btn-404-back" variant="primary" size="sm" onClick={onBackToDashboard} className="gap-1.5 font-bold">
        <ArrowLeft className="w-4 h-4" /> Voltar ao Dashboard
      </Button>
    </div>
  );
}
