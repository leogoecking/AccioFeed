# Tech News Hub ⚡

> Agregador inteligente e self-hosted de notícias e conteúdos sobre tecnologia.

---

## 1. Visão Geral

O **Tech News Hub** é um leitor inteligente e self-hosted de notícias e discussões sobre tecnologia. O sistema centraliza, normaliza e apresenta as novidades do ecossistema tech em uma interface moderna, minimalista e com dark mode por padrão.

### Principais Funcionalidades:
- 📰 **Timeline Multi-Fonte**: Notícias consolidadas de APIs oficiais (Hacker News) e feeds RSS/Atom de tecnologia de ponta.
- 📖 **Experiência do Leitor (Reader View)**: Modal de leitura focado, sem distrações, com marcação automática de abertura e links diretos para a fonte original.
- 📚 **Coleções Pessoais**:
  - **Tudo**: visão consolidada de todos os artigos não ocultados.
  - **Não lidos**: feed com artigos ainda não lidos e contador em tempo real.
  - **Ler depois**: coleção de artigos marcados para leitura futura com data de salvamento.
  - **Favoritos**: biblioteca de artigos destacados com estrela.
  - **Histórico**: cronologia de artigos abertos ordenados por última leitura (`last_opened_at`).
  - **Ocultação de Notícias**: capacidade de esconder itens irrelevantes da timeline.
- ⚙️ **Gerenciamento de Fontes Dinâmico (`/sources`)**:
  - Monitoramento operacional de saúde (Healthy, Warning, Error, Disabled).
  - Ativação e desativação em tempo real com toggle switch.
  - Sincronização sob demanda (individual por fonte ou global para todas as ativas) com lock assíncrono.
  - Cadastro de novos feeds RSS com validação ao vivo, extração de metadados e preview prévio.
- 🛡️ **Segurança em Camadas**:
  - Proteção estrita contra **SSRF** (bloqueio de RFC 1918, loopback, link-local, `169.254.169.254`, validação em cada redirect HTTP).
  - Sanitização profunda contra **XSS** em resumos e conteúdos.

---

## 2. Stack Tecnológica

- **Frontend**: Next.js 15+ (App Router), React, TypeScript, Tailwind CSS, Lucide Icons.
- **Backend**: Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0 (asyncpg), Alembic, HTTPX.
- **Banco de Dados**: PostgreSQL 16.
- **Workers / Jobs**: Processo Worker assíncrono independente para coleta periódica sem sobrecarga da API HTTP.
- **Infraestrutura**: Docker & Docker Compose.
- **Qualidade & CI**: Ruff, Pytest, ESLint, TypeScript Strict, GitHub Actions.

---

## 3. Estrutura do Projeto

```text
tech-news-hub/
├── .github/workflows/       # Pipelines de CI (backend e frontend)
├── backend/
│   ├── app/
│   │   ├── api/             # Controllers e roteamento REST (/health, /api/v1)
│   │   ├── core/            # Configurações, logging estruturado, banco assíncrono
│   │   ├── models/          # Entidades SQLAlchemy (Source, Article, ArticleMetric)
│   │   ├── schemas/         # Modelos Pydantic v2 de validação e serialização
│   │   ├── repositories/    # Camada de persistência desacoplada
│   │   ├── services/        # Regras de negócio (ingestão, deduplicação, consulta)
│   │   ├── sources/         # Abstração SourceProvider e integrações (Hacker News, RSS)
│   │   └── workers/         # Agendador e processo worker independente
│   ├── migrations/          # Versionamento de schema com Alembic
│   ├── tests/               # Testes automatizados unitários e de integração com pytest
│   ├── Dockerfile           # Imagem Docker otimizada do backend/worker
│   ├── pyproject.toml       # Configuração do Ruff, pytest e dependências
│   └── requirements.txt     # Dependências fixadas
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (páginas, layout, tema)
│   │   ├── components/      # Componentes modulares (timeline, cards, filtros, sidebar)
│   │   └── lib/             # Cliente API, tipos TypeScript e utilitários
│   ├── Dockerfile           # Imagem multi-stage do frontend
│   └── package.json         # Dependências do frontend
├── docs/
│   └── architecture.md      # Registro de decisões arquiteturais (ADRs)
├── docker-compose.yml       # Orquestração local de todos os serviços
├── .env.example             # Modelo de variáveis de ambiente
├── AGENTS.md                # Diretrizes operacionais para agentes e devs
├── roadmap.md               # Planejamento de fases e evolução futura
└── README.md                # Esta documentação
```

---

## 4. Requisitos

- [Docker](https://docs.docker.com/get-docker/) (24+) e [Docker Compose](https://docs.docker.com/compose/) (v2+)
- Opcional para desenvolvimento local sem Docker:
  - Python 3.12+
  - Node.js 20+ e npm
  - PostgreSQL 16

---

## 5. Como Executar com Docker Compose

1. **Clone o repositório e acesse o diretório**:
   ```bash
   git clone https://github.com/usuario/tech-news-hub.git
   cd tech-news-hub
   ```

2. **Copie o arquivo de ambiente**:
   ```bash
   cp .env.example .env
   ```
   > Por padrão, o `.env.example` mapeia o frontend para a porta `3001` e o backend para a porta `8001`, prevenindo conflitos com eventuais containers locais pré-existentes.

3. **Inicie todos os serviços**:
   ```bash
   docker compose up --build
   ```

4. **Acesse as aplicações**:
   - **Frontend (Dashboard)**: [http://localhost:3001](http://localhost:3001)
   - **API Backend**: [http://localhost:8001](http://localhost:8001)
   - **Documentação Swagger (OpenAPI)**: [http://localhost:8001/docs](http://localhost:8001/docs)
   - **Healthcheck**: [http://localhost:8001/health](http://localhost:8001/health)

---

## 6. Fontes Integradas

O Tech News Hub agrega notícias de fontes oficiais, tanto via API quanto via feeds RSS/Atom padronizados:

| Fonte | Tipo | Categoria Padrão | Intervalo de Coleta | URL Base / Feed |
| :--- | :--- | :--- | :--- | :--- |
| **Hacker News** | API (`hacker_news`) | `technology` | 5 min | `https://news.ycombinator.com` |
| **Ars Technica** | RSS (`rss`) | `technology` | 15 min | `https://feeds.arstechnica.com/arstechnica/index` |
| **The Verge** | RSS (`rss`) | `technology` | 15 min | `https://www.theverge.com/rss/index.xml` |
| **Tom's Hardware** | RSS (`rss`) | `hardware` | 15 min | `https://www.tomshardware.com/feeds/all` |
| **MIT Technology Review** | RSS (`rss`) | `ai` | 30 min | `https://www.technologyreview.com/feed/` |
| **IEEE Spectrum** | RSS (`rss`) | `science` | 30 min | `https://spectrum.ieee.org/feeds/feed.rss` |
| **GitHub Blog** | RSS (`rss`) | `dev` | 30 min | `https://github.blog/feed/` |
| **Phoronix** | RSS (`rss`) | `linux` | 15 min | `https://www.phoronix.com/phoronix-rss.php` |

---

## 7. CLI de Coleta e Sincronização Manual

Além do Worker assíncrono em background (que roda a cada `WORKER_INTERVAL_SECONDS` respeitando o `poll_interval_minutes` de cada fonte), você pode disparar comandos manuais via CLI:

```bash
# Sincronização forçada imediata de todas as fontes ativas:
docker compose exec backend python -m app.cli sync

# Sincronização respeitando as regras de intervalo (apenas fontes com coleta pendente):
docker compose exec backend python -m app.cli sync --no-force

# Popular/atualizar o catálogo de fontes padrão (idempotente):
docker compose exec backend python -m app.cli seed
```

Exemplo de saída da sincronização:
```text
========================================
         Tech News Hub Sync             
========================================

Ars Technica
  Status: SUCCESS (789ms)
  Fetched: 20
  New: 20
  Duplicates: 0

...

----------------------------------------
Sources: 8
Success: 8
Failed: 0
New articles: 140
========================================
```

---

## 8. Gerenciamento de Fontes e Adição de Feeds Customizados

O sistema suporta tanto gerenciamento visual via interface web quanto via CLI ou banco de dados:

### 8.1. Pela Interface Web (`/sources`):
1. Acesse [http://localhost:3001/sources](http://localhost:3001/sources) ou clique em **"Gerenciar Fontes"** na barra lateral.
2. Visualize o status operacional de cada fonte:
   - 🟢 **Saudável**: Coleta recente bem-sucedida.
   - 🟡 **Aviso**: Fonte ativa com coletas pendentes ou avisos transitórios.
   - 🔴 **Erro**: Falha na última coleta (com exibição da mensagem de erro amigável).
   - ⚪ **Desativada**: Fonte desabilitada pelo usuário.
3. **Ativar / Desativar**: Alterne o botão toggle na coluna Status. O Worker respeitará imediatamente a alteração.
4. **Sincronização Manual**: Clique no ícone de atualização ao lado de qualquer fonte, ou use o botão **"Sincronizar Todas"** no topo.
5. **Adicionar Feed RSS**:
   - Clique em **"Adicionar Fonte RSS"**.
   - Digite a URL do feed e clique em **"Validar Feed"**.
   - O backend executará checagens rigorosas contra SSRF, resolverá o DNS e baixará uma amostra do feed, exibindo um card de preview com título, formato detectado e os primeiros artigos encontrados.
   - Escolha o nome da fonte, a categoria padrão e o intervalo de coleta e confirme a criação.

### 8.2. Proteção contra SSRF (Server-Side Request Forgery):
Ao adicionar ou validar feeds externos, o sistema bloqueia:
- Endereços IP locais e privados (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `0.0.0.0`).
- Endereços de metadados em nuvens AWS/GCP/Azure (`169.254.169.254`).
- Redirecionamentos HTTP 3xx para redes internas (validação iterativa em cada hop).
- Payloads excessivos (limite estrito de 5 MB com streaming chunked) e timeout de 10s.

---

## 9. Endpoints da API REST

A API expõe endpoints versionados sob `/api/v1`:

### Artigos e Biblioteca Pessoal
- `GET /health`: Healthcheck detalhado do serviço e conectividade com o banco.
- `GET /api/v1/library/stats`: Estatísticas agregadas da biblioteca pessoal em uma única query (`unread`, `saved`, `favorites`, `total`).
- `GET /api/v1/articles`: Listagem paginada de artigos com múltiplos filtros:
  - `state` (`all`, `unread`, `favorite`, `saved`, `hidden`, `history`)
  - `source` (slug da fonte, ex: `ars-technica`, `phoronix`, `hacker-news`)
  - `category` (`ai`, `hardware`, `dev`, `linux`, `security`, `science`, `startups`, `technology`)
  - `search` (busca textual em título ou resumo)
  - `sort` (`recent`, `popular`, `history`, `last_opened`)
  - `timeframe` (`24h`, `7d`, `30d`, `all`)
  - `page` e `page_size` (máx: 100)
- `GET /api/v1/articles/{id}`: Detalhes completos de um artigo individual.
- `PATCH /api/v1/articles/{id}/state`: Atualiza o estado pessoal do artigo (`is_read`, `is_favorite`, `is_saved`, `is_hidden`).
- `POST /api/v1/articles/{id}/open`: Registra a abertura do artigo no leitor (marca automaticamente como lido e atualiza `first_opened_at` / `last_opened_at`).

### Fontes e Coleta
- `GET /api/v1/sources`: Listagem de fontes com status calculado (`healthy`, `error`, `disabled`) e métricas de execução.
- `POST /api/v1/sources`: Cadastro de nova fonte RSS/Atom customizada com validação prévia.
- `PATCH /api/v1/sources/{id}`: Atualização de atributos da fonte (`is_active`, `poll_interval_minutes`, `default_category`, etc.).
- `POST /api/v1/sources/validate`: Validação de URL de feed com proteção SSRF e extração de preview.
- `POST /api/v1/sources/{id}/sync`: Disparo de sincronização manual imediata para uma fonte específica (com lock de concorrência).
- `POST /api/v1/sources/sync`: Disparo de sincronização manual de todas as fontes ativas.
- `GET /api/v1/categories`: Lista das categorias suportadas pela plataforma.

---

## 10. Migrações de Banco de Dados (Alembic)

O container da API executa automaticamente `alembic upgrade head` durante a inicialização.

Para criar uma nova migração manualmente:
```bash
docker compose exec backend alembic revision --autogenerate -m "descricao_da_migracao"
```

Para aplicar manualmente as migrações:
```bash
docker compose exec backend alembic upgrade head
```

---

## 11. Testes e Qualidade de Código

### Backend
```bash
# Executar suíte de testes unitários e de integração
docker compose exec backend pytest

# Executar linter e formatação
docker compose exec backend ruff check .
docker compose exec backend ruff format --check .
```

### Frontend
```bash
# Executar linter
npm run lint --prefix frontend

# Executar typecheck e build
npm run build --prefix frontend
```

---

## 12. Variáveis de Ambiente Principais

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `3001` | Porta HTTP exposta no host para a interface web |
| `BACKEND_PORT` | `8001` | Porta HTTP exposta no host para a API FastAPI |
| `POSTGRES_PORT` | `5433` | Porta exposta no host para o PostgreSQL |
| `DATABASE_URL` | `postgresql+asyncpg://...` | String de conexão assíncrona com o banco |
| `WORKER_INTERVAL_SECONDS` | `300` | Intervalo em segundos entre ciclos do coletor |
| `HN_MAX_STORIES` | `30` | Quantidade de histórias por lote na coleta do Hacker News |
| `HTTP_REQUEST_TIMEOUT` | `15` | Timeout em segundos para requisições externas HTTP |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001` | URL base da API consumida pelo frontend |

---

## 13. Licença

Projeto desenvolvido sob a licença MIT.
