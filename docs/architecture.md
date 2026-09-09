# Arquitetura do Tech News Hub

Este documento descreve as decisões arquiteturais fundamentais, os fluxos de dados, os padrões adotados e as diretrizes de design do **Tech News Hub**.

---

## 1. Visão Geral e Objetivos

O **Tech News Hub** é um agregador inteligente e self-hosted de notícias e discussões sobre tecnologia. O sistema é desenhado para:
1. Coletar periodicamente artigos de fontes heterogêneas (APIs públicas oficiais como Hacker News e feeds RSS/Atom) de forma resiliente e não-bloqueante.
2. Normalizar conteúdos heterogêneos em um modelo de dados canônico.
3. Evitar duplicatas garantindo atualização contínua de métricas de popularidade (pontuação, contagem de comentários).
4. Fornecer uma API REST tipada com paginação, filtros e busca.
5. Exibir uma timeline de notícias moderna, limpa e responsiva com foco em leitura e usabilidade (dark mode).

---

## 2. Diagrama de Componentes e Fluxo

```
                  ┌────────────────────────────────────────┐
                  │          Fontes Externas               │
                  │ (Hacker News API, Feeds RSS/Atom, ...) │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ (HTTP / Timeout / Semaphore)
                  ┌────────────────────────────────────────┐
                  │             Worker Service             │
                  │   - Periodic Scheduler                 │
                  │   - SourceProvider.fetch()             │
                  │   - SourceProvider.normalize()         │
                  │   - SourceProvider.validate()          │
                  │   - ArticleService.ingest()            │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼
                  ┌────────────────────────────────────────┐
                  │          PostgreSQL Database           │
                  │    - sources                           │
                  │    - articles (unique: source+ext_id)  │
                  │    - article_metrics                   │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ (asyncpg / SQLAlchemy)
                  ┌────────────────────────────────────────┐
                  │             Backend API                │
                  │   - FastAPI (/health, /api/v1/...)     │
                  │   - Repositories & Services            │
                  │   - Structured Logging & CORS          │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ (JSON REST / HTTP)
                  ┌────────────────────────────────────────┐
                  │            Frontend App                │
                  │   - Next.js (App Router)               │
                  │   - Tailwind CSS + Dark Mode           │
                  │   - Timeline, Filters & Search         │
                  └────────────────────────────────────────┘
```

---

## 3. Decisões Arquiteturais Relevantes (ADRs)

### ADR 01: Mecanismo de Execução de Jobs/Worker no MVP
- **Problema**: Como realizar a coleta periódica de dados de fontes externas sem sobrecarregar ou acoplar o servidor HTTP da API e sem introduzir excesso de dependências no MVP?
- **Alternativas**:
  1. Cron de sistema (`crond`) no container disparando scripts CLI.
  2. Celery + Redis / RabbitMQ.
  3. Processo Worker Python autônomo com loop agendador assíncrono.
- **Escolha**: Processo Worker Python autônomo baseado em agendador assíncrono modular.
- **Justificativa**: Garante separação física e de processos (o servidor FastAPI nunca tem seu event loop travado por I/O externo de coleta). Evita dependências de infraestrutura pesadas (Redis/Celery) na fase inicial, mantendo o `docker-compose` enxuto e de fácil manutenção local.
- **Consequência**: Excelente consumo de memória e inicialização rápida. A camada de serviços (`ArticleService`, `sources`) é compartilhada pelo backend e pelo worker. A migração para um broker de mensagens distribuído (como Celery/ARQ/Temporal) será transparente quando houver necessidade de enfileiramento massivo para tarefas de IA pesadas na Fase 4.

### ADR 02: Camada de Persistência com SQLAlchemy 2.0 Assíncrono e Alembic
- **Problema**: Como gerenciar o acesso aos dados relacionais com tipagem forte e evolução de schema sem bloqueio do event loop assíncrono?
- **Alternativas**:
  1. SQLAlchemy síncrono com pool de threads.
  2. SQLAlchemy 2.0 moderno com driver `asyncpg`.
  3. SQLModel ou Tortoise-ORM.
- **Escolha**: SQLAlchemy 2.0 assíncrono (`asyncpg`) associado ao Alembic para migrações.
- **Justificativa**: Suporte nativo à sintaxe estrita `Mapped[T]`, integração perfeita com Pydantic v2 e garantia de que chamadas ao PostgreSQL não bloqueiem a thread principal da API assíncrona. O Alembic assegura rastreabilidade total das mudanças no schema via migrações versionadas.
- **Consequência**: Código backend 100% assíncrono, robusto, com tipagem checada estaticamente por mypy/ruff.

### ADR 03: Abstração de Provedores de Conteúdo (`SourceProvider`)
- **Problema**: Cada fonte possui protocolos, estruturas de payload e peculiaridades distintas (ex.: Hacker News é API JSON com IDs separados; RSS/Atom é XML com tags heterogêneas).
- **Alternativas**:
  1. Código monolítico no worker com condicionais `if source == 'hn': ...`.
  2. Interface base abstrata (`BaseSourceProvider`) padronizando o ciclo de vida.
- **Escolha**: Classe abstrata `BaseSourceProvider` definindo `fetch()`, `normalize()` e `validate()`.
- **Justificativa**: Segue o princípio Aberto/Fechado (Open/Closed Principle) e Inversão de Dependências. Para adicionar qualquer nova fonte (ex.: RSS do Ars Technica ou Reddit), basta implementar a subclasse correspondente e registrá-la no registro central.
- **Consequência**: Isolamento de erros: falhas em uma fonte são tratadas no nível do provedor individual e registradas sem derrubar o restante do pipeline.

### ADR 04: Deduplicação e Atualização de Métricas
- **Problema**: Artigos coletados repetidamente geram registros duplicados se apenas inserirmos novos dados; contudo, métricas como pontuação e contagem de comentários mudam ao longo do tempo.
- **Alternativas**:
  1. Inserir sempre e filtrar duplicatas em memória na API.
  2. Ignorar silenciosamente artigos já existentes sem atualizar métricas.
  3. Constraint única em `(source_id, external_id)` no banco combinada com lógica no `ArticleService` para atualizar métricas e data de atualização quando o artigo já existir.
- **Escolha**: Constraint única em `(source_id, external_id)` e atualização de métricas (`score`, `comments_count`, `updated_at`).
- **Justificativa**: Evita duplicatas, mantém o banco normalizado e assegura que a timeline apresente dados de engajamento atualizados sem sobrecarga de inserções duplicadas.
- **Consequência**: Integridade e idempotência nas coletas.

### ADR 05: Frontend com Next.js (App Router), Tailwind CSS e Dark Mode por Padrão
- **Problema**: Como estruturar uma interface limpa, de alta performance, com boa separação de componentes e identidade visual voltada para leitores de tecnologia?
- **Alternativas**:
  1. Single Page Application com Vite + React.
  2. Next.js App Router com Server e Client Components.
- **Escolha**: Next.js App Router com Tailwind CSS e dark mode por padrão.
- **Justificativa**: Permite renderização otimizada, modularidade através de Server/Client components, excelente suporte a TypeScript estrito e flexibilidade para caching e futura extensão para PWA.
- **Consequência**: Interface responsiva, rápida e elegante com estética moderna de tecnologia.

---

## 4. Segurança e Resiliência

1. **Proteção contra SSRF e Timeout de Rede**:
   - Requisições HTTP externas usam `httpx.AsyncClient` com timeout estrito (10s–15s).
   - Não são executadas requisições a URLs arbitrárias enviadas por usuários. Feeds são pré-cadastrados ou validados administrativamente.
2. **Sanitização de Conteúdo**:
   - Todo conteúdo textual recebido de fontes externas é tratado como dado não confiável.
   - Resumos e títulos não são interpretados como HTML direto no frontend (não utilização de `dangerouslySetInnerHTML` com conteúdo não sanitizado).
3. **CORS e Validação**:
   - Configuração de origens CORS explícitas via variável de ambiente `CORS_ORIGINS`.
   - Validação de contratos via esquemas Pydantic v2 com `strict` e `model_validate`.
