# AccioFeed_ ⚡

> Agregador pessoal, minimalista, editorial e self-hosted de notícias e discussões de tecnologia.

```
   •   •
 ↘ ↓ ↙
  ◉
 ACCIOFEED_
```

---

## 1. Visão Geral

O **AccioFeed_** é um leitor diário de notícias tecnológicas projetado para ser ultra-rápido, ergonômico e sem ruídos visuais. Construído com arquitetura dark-first em preto e vermelho editorial (`#09090b` e `#e11d48`), ele centraliza, normaliza e apresenta artigos de fontes oficiais em uma experiência de navegação por teclado instantânea.

### Principais Funcionalidades:

- 📰 **Timeline Multi-Fonte com Zero Jumping**:
  - Detecção de novidades em segundo plano sem deslocamento involuntário de scroll (*Zero Timeline Jumping*). Um botão flutuante discreto `↑ X novas notícias disponíveis` permite carregar novidades quando o leitor desejar.
  - Indicador de **"Novas desde sua última visita"** com separador visual **`VOCÊ JÁ VIU ATÉ AQUI`** e ação de marcação temporal em lote.
  - Alternância instantânea de densidade: modo **Confortável** (cards com lead image e resumo) e modo **Compacto** (linhas condensadas para varredura ultrarrápida), persistido em `localStorage`.
  - Paginação contínua e fluida via botão **Carregar mais notícias** preservando a posição de leitura.

- 📖 **Experiência de Leitura Focada (Reader View)**:
  - Calibrado ergonomicamente para largura ideal de leitura (65 a 80 caracteres / `max-w-[72ch]`).
  - Barra de progresso de leitura sutil no topo do modal.
  - Cálculo de tempo estimado de leitura determinístico (200 wpm).
  - Navegação entre artigos via setas (`←` Anterior / `→` Próxima) com marcação automática de leitura.
  - **Preservação absoluta de scroll**: retornar da leitura restaura a posição exata da timeline.

- ⚡ **Power Navigation & Atalhos Rápidos**:
  - **Quick Preview**: Painel lateral deslizante à direita no desktop (mantendo a timeline visível) e bottom sheet acessível no mobile para inspecionar resumos sem sair do contexto.
  - **Command Palette Global (`Ctrl+K` / `⌘+K`)**: Busca rápida e pulo para coleções, categorias e ações do sistema.
  - **Navegação Estilo Vim**: `j` e `k` percorrem os artigos com anel de destaque e scroll suave.
  - **Atalhos Rápidos**: `Enter`/`o` abre o Reader, `Space`/`p` abre o Quick Preview, `s` salva para ler depois, `f` favorita, `m` alterna lido/não lido, `r` sincroniza e `?` exibe a ajuda de atalhos.

- 📚 **Coleções Pessoais**:
  - **Tudo**: visão de todos os artigos não ocultados.
  - **Não lidos**: feed limpo apenas com artigos pendentes e contador em tempo real.
  - **Ler depois**: coleção de artigos marcados para leitura futura.
  - **Favoritos**: biblioteca de matérias destacadas.
  - **Histórico**: cronologia de artigos lidos ordenados por `last_opened_at`.
  - **Ocultação de Notícias**: esconde itens irrelevantes da timeline.

- ⚙️ **Gerenciamento de Fontes Dinâmico (`/sources`)**:
  - Monitoramento operacional de saúde (Healthy, Warning, Error, Disabled).
  - Ativação e desativação em tempo real com toggle switch.
  - Sincronização sob demanda (individual por fonte ou global para todas as ativas) com lock assíncrono.
  - Cadastro de novos feeds RSS com validação ao vivo, extração de metadados e preview prévio.

- 🛡️ **Segurança em Camadas & Performance**:
  - Proteção estrita contra **SSRF** (bloqueio de redes privadas RFC 1918, loopback, metadados cloud, anti-redirect e limites de payload).
  - Sanitização profunda contra **XSS** em resumos e conteúdos.
  - Otimização de payload: defer de carregamento de conteúdo integral em consultas de listagem (`defer(Article.content)`).
  - Debouncing de 300ms no input de busca para digitação 100% responsiva sem rajadas de requisições.

---

## 2. Atalhos de Teclado

| Tecla | Ação |
| :--- | :--- |
| `j` | Avançar para o próximo artigo na timeline |
| `k` | Voltar para o artigo anterior na timeline |
| `Enter` ou `o` | Abrir artigo selecionado no Reader focado |
| `Espaço` ou `p` | Abrir visualização rápida lateral (Quick Preview) |
| `s` | Salvar / remover artigo de Ler Depois |
| `f` | Favoritar / desfavoritar artigo selecionado |
| `m` | Alternar estado lido / não lido do artigo |
| `←` / `→` | No Reader: navegar para artigo anterior / próximo |
| `Ctrl+K` / `⌘+K` | Abrir Command Palette (busca e ações) |
| `r` | Sincronizar notícias com fontes oficiais |
| `?` | Exibir janela de ajuda com todos os atalhos |
| `Esc` | Fechar modal, Reader, Quick Preview ou limpar busca |

---

## 3. Stack Tecnológica

- **Frontend**: Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (asyncpg), Alembic, HTTPX.
- **Banco de Dados**: PostgreSQL 16.
- **Workers / Jobs**: Processo Worker assíncrono independente para coleta periódica sem sobrecarga da API HTTP.
- **Infraestrutura**: Docker & Docker Compose com hot-reload ativo (`docker-compose.override.yml`).
- **Qualidade & CI**: Ruff, Pytest (83 testes automatizados), ESLint, TypeScript Strict, GitHub Actions.

---

## 4. Estrutura do Projeto

```text
acciofeed/
├── .github/workflows/       # Pipelines de CI (backend e frontend)
├── backend/
│   ├── app/
│   │   ├── api/             # Controllers e roteamento REST (/health, /api/v1)
│   │   ├── core/            # Configurações, logging estruturado, banco assíncrono, SSRF
│   │   ├── models/          # Entidades SQLAlchemy (Source, Article, ArticleMetric, State)
│   │   ├── schemas/         # Modelos Pydantic v2 de validação e serialização
│   │   ├── repositories/    # Camada de persistência desacoplada (otimizada com defer)
│   │   ├── services/        # Regras de negócio (ingestão, deduplicação, consulta)
│   │   ├── sources/         # Abstração SourceProvider e integrações (Hacker News, RSS)
│   │   └── workers/         # Agendador e processo worker independente
│   ├── migrations/          # Versionamento de schema com Alembic
│   ├── tests/               # Testes automatizados unitários e de integração com pytest
│   ├── Dockerfile           # Imagem Docker otimizada do backend/worker
│   ├── entrypoint.sh        # Suporte automático a --reload quando DEBUG=true
│   ├── pyproject.toml       # Configuração do Ruff, pytest e dependências
│   └── requirements.txt     # Dependências fixadas
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (páginas, layout, tema)
│   │   ├── components/      # Componentes modulares
│   │   │   ├── articles/    # Timeline, ArticleCard, ArticleModal (Reader)
│   │   │   ├── navigation/  # QuickPreview, CommandPalette, ShortcutsHelpModal
│   │   │   ├── layout/      # BrandLogo, Header, Sidebar
│   │   │   └── common/      # ApiConfigBanner
│   │   └── lib/             # Cliente API, tipos TypeScript e utilitários
│   ├── Dockerfile           # Imagem multi-stage (suporte a target dev com npm run dev)
│   └── package.json         # Dependências do frontend
├── docs/
│   └── architecture.md      # Registro de decisões arquiteturais (ADRs)
├── docker-compose.yml       # Orquestração de produção/base de todos os serviços
├── docker-compose.override.yml # Montagem de volumes locais para Hot-Reload instantâneo
├── .env.example             # Modelo de variáveis de ambiente
├── AGENTS.md                # Diretrizes operacionais para agentes e devs
├── roadmap.md               # Planejamento de fases e evolução futura
└── README.md                # Esta documentação
```

---

## 5. Como Executar com Docker Compose

### 1. Clonar o repositório e preparar ambiente
```bash
cp .env.example .env
```

### 2. Iniciar todos os serviços (Hot-Reload Habilitado)
```bash
docker compose up -d
```

Os seguintes serviços estarão disponíveis:
- **Interface Web**: [http://localhost:3001](http://localhost:3001)
- **API FastAPI**: [http://localhost:8001](http://localhost:8001)
- **Documentação Interativa Swagger**: [http://localhost:8001/docs](http://localhost:8001/docs)
- **Healthcheck da API**: [http://localhost:8001/health](http://localhost:8001/health)
- **PostgreSQL**: `localhost:5433`

Alterações realizadas em arquivos dentro de `frontend/` e `backend/` são refletidas **instantaneamente** no navegador e na API sem necessidade de rebuild dos containers.

---

## 6. Testes e Verificação de Qualidade

### Backend
```bash
# Executar suíte de testes unitários e de integração (83 testes)
docker compose exec backend pytest

# Executar linter e formatação com Ruff
docker compose exec backend ruff check .
docker compose exec backend ruff format --check .
```

### Frontend
```bash
# Executar ESLint (0 erros, 0 avisos)
npm run lint --prefix frontend

# Executar verificação de tipos TypeScript
npx tsc --noEmit --prefix frontend

# Compilar build de produção
npm run build --prefix frontend
```

---

## 7. Licença

Projeto desenvolvido sob a licença MIT.
