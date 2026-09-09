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

## 6. Migrações de Banco de Dados (Alembic)

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

## 7. Testes e Qualidade de Código

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
docker compose exec frontend npm run lint

# Executar typecheck e build
docker compose exec frontend npm run build
```

---

## 8. Variáveis de Ambiente Principais

| Variável | Padrão | Descrição |
| :--- | :--- | :--- |
| `FRONTEND_PORT` | `3001` | Porta HTTP exposta no host para a interface web |
| `BACKEND_PORT` | `8001` | Porta HTTP exposta no host para a API FastAPI |
| `POSTGRES_PORT` | `5433` | Porta exposta no host para o PostgreSQL |
| `DATABASE_URL` | `postgresql+asyncpg://...` | String de conexão assíncrona com o banco |
| `WORKER_INTERVAL_SECONDS` | `300` | Intervalo em segundos entre ciclos do coletor |
| `HN_MAX_STORIES` | `30` | Quantidade de histórias por lote na coleta do Hacker News |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8001` | URL base da API consumida pelo frontend |

---

## 9. Licença

Projeto desenvolvido sob a licença MIT.
