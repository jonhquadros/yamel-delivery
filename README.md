# Yamel — Delivery + PDV

Sistema moderno e completo para gestão de pedidos, delivery, frente de caixa (PDV) e fluxo de cozinha para o ecossistema Yamel. Projetado com interface administrativa de alto desempenho, suporte a transições suaves e preparação nativa para instalação móvel (PWA).

## 🚀 Stack Tecnológica

O projeto foi construído utilizando tecnologias modernas e eficientes para garantir excelente fluidez e portabilidade:

- **Frontend:** React 19 + TypeScript
- **Bundler & Dev:** Vite ^6.2.3
- **Estilização & UI:** Tailwind CSS v4 (Importado via diretivas nativas)
- **Animações:** Motion ^12.23.24
- **Biblioteca de Ícones:** Lucide React ^0.546.0
- **Suporte a Mobile:** PWA Manifest, Viewport meta tags e toque otimizado

## 📂 Estrutura do Projeto

```text
src/
├── types/
│   └── index.ts              # Definições centrais de tipos (rotas, estados de conexão, configurações)
├── services/
│   └── whatsappService.ts    # Serviço estrutural para integração e formatação de mensagens do WhatsApp
├── components/
│   └── ui/
│       ├── Button.tsx        # Botão reaproveitável com variantes estilizadas de design
│       ├── Input.tsx         # Inputs, Selects e Textareas acessíveis
│       ├── Feedback.tsx      # LoadingState, EmptyState, ErrorState e ConnectionStatus
│       ├── Overlay.tsx       # Overlays animados (Dialog, Drawer, Tooltip, Dropdown)
│       ├── DataDisplay.tsx   # Card, Badge, Tabs e Tables
│       └── PageHeader.tsx    # Header de página estruturado com suporte a ações e breadcrumbs
├── pages/
│   ├── DashboardView.tsx     # Métricas operacionais em tempo real (dados simulados)
│   ├── OperationalViews.tsx  # Views para PDV, Pedidos, Mesas, Cozinha (KDS) e Caixa
│   ├── CatalogViews.tsx      # Views para Produtos e Categorias
│   └── ManagementViews.tsx   # Views para Relatórios, Usuários, Configurações e Página 404
├── App.tsx                   # Casca/Layout administrativo responsivo, menu lateral e roteamento local
├── index.css                 # Importação principal do Tailwind CSS v4
└── main.tsx                  # Ponto de entrada e montagem do React 19
```

## 🛠️ Desenvolvimento e Execução Local

Para iniciar o servidor de desenvolvimento localmente, siga os passos abaixo:

1. Instale as dependências declaradas no manifesto:
   ```bash
   npm install
   ```

2. Execute o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Abra o navegador no endereço indicado (por padrão `http://localhost:3000`).

## 🔑 Variáveis de Ambiente

O arquivo `.env.example` lista as configurações necessárias para a aplicação operar:

```env
# Chave da API do Google Gemini utilizada para funções de Inteligência Artificial no backend
GEMINI_API_KEY="SUA_CHAVE_AQUI"

# URL de Hospedagem do Applet (utilizada para redirecionamentos e callbacks)
APP_URL="SUA_URL_AQUI"
```

*Nota: Os segredos de API são gerenciados de forma segura pelo painel do Google AI Studio e não são commitados diretamente no código.*

## 🚦 Arquitetura de Rotas e Navegação (FASE 01 / ETAPA 04)

O sistema de rotas e separação de acessos da Yamel foi centralizado e modularizado de forma robusta, garantindo conformidade para futuras validações de login e permissionamento.

### 📐 Decisão Arquitetural: Custom Hash Router
Adotamos uma solução de **Roteamento Baseado em Hash (`window.location.hash`)** com listener reativo nativo do React, sem a necessidade de acoplar bibliotecas externas de roteamento pesado (como `react-router-dom`), garantindo as seguintes vantagens:
*   **Compatibilidade de iFrame & PWA:** Totalmente imune a falhas de recarga (refresh) e isolamento em containers de visualização e iFrames do AI Studio.
*   **Zero Configuração no Servidor:** Dispensa regras complexas de reescrita (rewrites) ou redirecionamento curinga de SPA no servidor estático.
*   **URLs Legíveis e Compartilháveis:** Endereços limpos (ex: `#/catalogo`, `#/pedidos`, `#/admin/produtos`) e suporte nativo ao histórico do navegador (botões Avançar/Voltar).
*   **Navegação Semântica por Link:** Componente `<Link>` que emite tags standard `<a>` suportando interações de acessibilidade e abertura em nova aba (ctrl + clique).

### 👥 Áreas e Layouts do Sistema
O ecossistema separa visualmente e logicamente as responsabilidades através de layouts distintos que não expõem painéis administrativos ao público geral:

1.  **PublicLayout (`/catalogo`, `/catalogo/produto/:id`, `/catalogo/carrinho`, `/pedido/:id`):**
    *   Exclusivo para clientes finais e autoatendimento.
    *   Livre de barras laterais, indicadores operacionais ou conexões internas.
    *   Equipado com o logotipo da marca, links inline para categorias e atalho flutuante para carrinho.
2.  **OperationalLayout (`/dashboard`, `/pdv`, `/pedidos`, `/mesas`, `/cozinha`, `/delivery`, `/caixa`):**
    *   Destinado a garçons, cozinheiros e operadores de caixa.
    *   Contém barra lateral com links operacionais, atalhos rápidos e o simulador de conexão em tempo real.
3.  **AdminLayout (`/admin`, `/admin/produtos`, `/admin/categorias`, `/admin/relatorios`, `/admin/usuarios`, `/admin/configuracoes`):**
    *   Acesso restrito para gerentes e diretores.
    *   Tema escuro premium em contraste de alta visibilidade, centralizando configurações de equipe, relatórios analíticos e controle de catálogo.

### 🗺️ Mapeamento de Rotas Existentes

| Rota | Área | Layout | Descrição |
| :--- | :--- | :--- | :--- |
| `#/catalogo` | Pública | PublicLayout | Cardápio digital para o cliente realizar pedidos |
| `#/catalogo/carrinho` | Pública | PublicLayout | Carrinho de compras do cardápio digital |
| `#/catalogo/produto/:id` | Pública | PublicLayout | Detalhes de um produto específico |
| `#/pedido/:id` | Pública | PublicLayout | Acompanhamento do status de entrega do cliente |
| `#/dashboard` | Operação | OperationalLayout | Indicadores operacionais consolidados de vendas |
| `#/pdv` | Operação | OperationalLayout | Ponto de venda (frente de caixa rápida) |
| `#/pedidos` | Operação | OperationalLayout | Lista de pedidos ativos em preparação |
| `#/mesas` | Operação | OperationalLayout | Gerenciamento de salão e mesa de clientes |
| `#/cozinha` | Operação | OperationalLayout | Monitor KDS de pratos e despacho |
| `#/caixa` | Operação | OperationalLayout | Controle de fluxo financeiro do dia |
| `#/admin` | Administração | AdminLayout | Painel geral de administração e relatórios |
| `#/admin/produtos` | Administração | AdminLayout | Gerenciamento do cadastro de produtos |
| `#/admin/categorias` | Administração | AdminLayout | Cadastro de categorias do estabelecimento |
| `#/admin/usuarios` | Administração | AdminLayout | Gerenciamento da equipe de funcionários |

### 🔍 Tratamento de Erros e 404
Qualquer rota inexistente ou rota administrativa inválida é capturada pelo roteador centralizado e renderiza automaticamente o componente `NotFoundView` dentro do respectivo layout, fornecendo caminhos seguros de volta à tela operacional principal.

---

## 📱 Progressive Web App (PWA) & Arquitetura Local-First (FASE 01 / ETAPA 05)

O Yamel foi projetado para operar com **alta resiliência offline**. Como estabelecimentos físicos enfrentam flutuações severas na rede, a aplicação não interrompe o atendimento do garçom, a venda do caixa ou o monitoramento da cozinha se a conexão de internet cair.

### 🛡️ 1. PWA e Estratégia de Service Worker
*   **Web App Manifest (`/public/manifest.json`):** Ajustado com metadados para instalação standalone impecável no Android (Chrome), Windows (Edge) e iOS (Safari). Define a paleta da marca (`theme_color: #d97706`), orientação vertical ideal para smartphones, e ícones otimizados de alta fidelidade.
*   **Service Worker (`/public/sw.js`):** Implementa um ciclo de vida resiliente que faz o download preventivo do **Offline App Shell** (HTML, JS, CSS, fontes e manifest).
*   **Políticas de Cache:**
    *   *Static Assets (App Shell):* Cache-First com atualização em plano de fundo (*stale-while-revalidate*). Garante carregamento instantâneo do app mesmo sem rede.
    *   *Dados Transacionais (Pedidos, Caixa, Estoque):* Bloqueio explícito de cache estático. A sincronização de dados dinâmicos é controlada estritamente pela nossa fila outbox IndexedDB, evitando leituras de cache stale (dados defasados) e inconsistências futuras.

### 🗄️ 2. Banco Local-First (IndexedDB Engine)
Decidimos construir uma **camada assíncrona pura sobre a API IndexedDB do navegador**, sem acoplar bibliotecas externas volumosas. Isso nos confere total controle do ciclo de vida, tipagem TypeScript rígida, e zero overhead de bundle:
*   **Canais Locais Isolados:** Sete object stores isolados: `products`, `categories`, `orders`, `tables`, `cash_registers`, `sync_queue` (fila outbox), e `device_config`.
*   **UUID Local:** Pedidos criados offline recebem identificadores UUID gerados nativamente pelo navegador (`crypto.randomUUID()`), eliminando conflitos de concorrência com o servidor e dispensando dependências de chaves auto-incrementais remotas.
*   **Seeding Automático:** Na primeira carga do sistema, o IndexedDB é populado automaticamente com os produtos padrão do catálogo, as mesas do salão e o registro de dispositivo local, habilitando operação offline instantânea de demonstração.

### 🔄 3. Padrão Outbox (Sync Queue) & Conflitos
*   **Transactional Outbox:** Qualquer ação local (ex: emitir um pedido, atualizar mesa) grava simultaneamente os dados estruturados no banco local (`orders`) e registra uma instrução de envio sequencial na fila `sync_queue`.
*   **Estados de Sincronização:** Os estados de sincronização estruturados são `PENDING` (aguardando rede/servidor), `SYNCING` (comunicação ativa com o servidor), `SYNCED` (confirmação real recebida do servidor), `FAILED` (erro na transmissão real) e `CONFLICT` (conflito de versões detectado pelo servidor).
*   **Sem Simulação Falsa:** Não existe simulação ou mock de sincronização automática nesta fase. As operações locais criadas no sistema permanecem estritamente no estado `PENDING` na fila local, aguardando a futura implementação do banco centralizado. O status `SYNCED` só será atribuído sob validação e persistência reais do backend.
*   **Monitor de Conexão (`useNetwork`):** Hook reativo que escuta os eventos físicos `online` e `offline` do navegador, atualizando o indicador de conexão sem misturar a disponibilidade de internet com a confirmação de sincronização de dados. Estar online e possuir registros `PENDING` na outbox é um estado perfeitamente natural e esperado.

---

## 📈 Fases de Desenvolvimento Concluídas

*   **FASE 01 / ETAPA 01:** Auditoria Avançada de Arquitetura e Código
*   **FASE 01 / ETAPA 02:** Estrutura Base e Declaração de Tipos Limpos
*   **FASE 01 / ETAPA 03:** Design System, Componentização Visual e Interfaces de Mesa/Cozinha
*   **FASE 01 / ETAPA 04:** Rotas, Layouts Centralizados, Estrutura de Acesso e Navegação de URLs
*   **FASE 01 / ETAPA 05:** PWA, Service Worker Cache e Arquitetura de Banco Local-First (IndexedDB/Outbox)
*   **FASE 01 / ETAPA 06:** Modelagem de Dados Local e Repositórios
*   **FASE 01 / ETAPA 07:** Catálogo Digital e CRUD Real com IndexedDB

---

## 🛍️ Catálogo Digital e CRUD Real (FASE 01 / ETAPA 07)

O módulo de catálogo digital e administração de produtos opera com **persistência real no IndexedDB** e reatividade instantânea via Repository Pattern:

### 🛠️ 1. CRUD de Produtos e Categorias
*   **Fontes de Dados Únicas:** As interfaces administrativa (`#/admin/produtos` e `#/admin/categorias`) e pública (`#/catalogo`) utilizam os mesmos repositórios (`productsRepository` e `categoriesRepository`).
*   **Valores Monetários em Centavos:** Todos os preços são manipulados e armazenados internamente como inteiros em centavos (ex: `2490` para `R$ 24,90`), prevenindo erros de arredondamento de ponto flutuante. As funções utilitárias `formatCentsToBRL` e `parseBRLToCents` garantem formatação e parsing seguros.
*   **Validação Rígida e Feedback:** Nomes obrigatórios, categorias vinculadas válidas, preços maiores que zero e tempos de preparo positivos são validados diretamente na UI com exibição de erros contextuais.
*   **Soft Delete Transacional:** Produtos e categorias nunca são removidos fisicamente do IndexedDB. A exclusão marca o campo `deletedAt` e enfileira uma instrução `DELETE` com status `PENDING` na fila de sincronização (Outbox).
*   **Validação de Dependência em Categorias:** Tentativas de exclusão de categorias contendo produtos ativos são bloqueadas com um modal informativo de advertência.

### 📱 2. Experiência do Cliente no Cardápio Digital (`#/catalogo`)
*   **Navegação e Filtros Reativos:** Exibe produtos ativos e em estoque organizados por categorias e ordenados por `sortOrder`. Conta com busca textual em tempo real.
*   **Detalhes e Opções do Produto (`#/catalogo/produto/:id`):** Permite personalizar opções obrigatórias/opcionais (ex: ponto da carne) e adicionais com cálculo automático do valor final.
*   **Carrinho Persistente (`#/catalogo/carrinho`):** Serviço reativo em `cartService` que armazena os itens e seus snapshots de preço no navegador. Permite ajustar quantidades, adicionar observações por item e visualizar o resumo completo com subtotal, taxa de entrega e total geral.
*   **Atendimento via WhatsApp Oficial:** Suporte integrado ao WhatsApp oficial da Yamel (`+55 91 98370-0095`).


