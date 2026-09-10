# Tech News Hub ⚡

> Agregador inteligente e self-hosted de notícias e conteúdos sobre tecnologia.

---

## 1. Visão Geral

O **Tech News Hub** é uma plataforma self-hosted construída para centralizar, normalizar e apresentar as principais notícias do ecossistema tecnológico em uma interface moderna, minimalista e com dark mode por padrão.

O sistema coleta conteúdos de APIs oficiais (como a do Hacker News) e feeds RSS/Atom, estruturando métricas de popularidade, categorias e resumos em um fluxo unificado.

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

## 8. Como Adicionar ou Remover Fontes RSS

O sistema utiliza um padrão de fábrica dinâmica (`SourceFactory`) e um provedor genérico (`RSSProvider`).

### Adicionando uma nova fonte RSS:
Basta registrar a fonte no banco de dados (ou adicionar à lista padrão em `backend/app/core/seed.py` e rodar `python -m app.cli seed`):

```python
{
    "name": "Nome da Publicação",
    "slug": "slug-da-fonte",
    "type": "rss",
    "base_url": "https://exemplo.com",
    "feed_url": "https://exemplo.com/rss.xml",
    "default_category": "dev",  # ai, hardware, dev, linux, security, science, startups, technology
    "is_active": True,
    "poll_interval_minutes": 15,
}
```

### Desativando uma fonte:
Altere a flag `is_active` para `false` no registro da fonte no PostgreSQL:
```sql
UPDATE sources SET is_active = false WHERE slug = 'slug-da-fonte';
```
O Worker e a CLI ignorarão automaticamente qualquer fonte inativa.

---

## 9. Endpoints da API REST

A API expõe endpoints versionados sob `/api/v1`:

- `GET /health`: Healthcheck detalhado do serviço e banco.
- `GET /api/v1/articles`: Listagem paginada de artigos com múltiplos filtros:
  - `page` (padrão: 1) e `page_size` (padrão: 20, máx: 100)
  - `source` (slug da fonte, ex: `ars-technica`, `phoronix`, `hacker-news`)
  - `category` (`ai`, `hardware`, `dev`, `linux`, `security`, `science`, `startups`, `technology`)
  - `search` (busca textual em título ou resumo)
  - `sort` (`newest`, `popular`, `comments`)
  - `timeframe` (`24h`, `7d`, `30d`, `all`)
- `GET /api/v1/articles/{id}`: Detalhes de um artigo individual.
- `GET /api/v1/sources`: Listagem de fontes cadastradas, incluindo métricas de saúde (`last_polled_at`, `last_success_at`, `last_error_at`, `last_error_message`).
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
