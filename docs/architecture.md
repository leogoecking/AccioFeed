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

### ADR 06: Provedor Genérico RSS/Atom e Fábrica Dinâmica
- **Problema**: Como suportar múltiplos feeds RSS e Atom sem escrever código duplicado para cada publicação jornalística?
- **Alternativas**:
  1. Criar uma classe de provedor dedicada para cada site (ex.: `ArsTechnicaProvider`, `TheVergeProvider`, etc.).
  2. Implementar um provedor parametrizado genérico (`RSSProvider`) alimentado por um parser universal (`RSSParser`) e uma fábrica (`resolve_provider_for_source`).
- **Escolha**: `RSSProvider` genérico configurável instanciado dinamicamente via metadados da tabela `sources`.
- **Justificativa**: Feeds RSS 2.0 e Atom 1.0 seguem especificações XML padrão. Variações como `<media:content>`, `<enclosure>` e `<content:encoded>` são resolvidas pelo parser com estratégias de fallback em cascata.
- **Consequência**: Novas fontes RSS podem ser adicionadas simplesmente cadastrando uma linha no banco de dados, sem alteração de código Python ou deploys adicionais.

### ADR 07: Canonicalização de URLs e Deduplicação Determinística
- **Problema**: Feeds RSS frequentemente adicionam parâmetros de rastreamento de campanhas (`utm_source`, `utm_medium`, `fbclid`, etc.) que alteram a URL textual de um mesmo artigo a cada coleta.
- **Alternativas**:
  1. Deduplicar estritamente pela URL bruta recebida do feed.
  2. Canonicalizar a URL removendo parâmetros de rastreamento e normalizando host/caminho (`canonicalize_url`).
- **Escolha**: Canonicalização determinística de URLs armazenada na coluna dedicada `canonical_url` com índice de busca e verificação dupla na ingestão: `(source_id, external_id)` OU `(source_id, canonical_url)`.
- **Justificativa**: Garante que o mesmo artigo publicado com diferentes parâmetros de rastreamento seja reconhecido como a mesma entidade, evitando proliferação de duplicatas.

### ADR 08: Sanitização de Conteúdo e Defesa em Profundidade contra XSS
- **Problema**: Resumos de feeds RSS externos contêm fragmentos HTML crus que podem carregar tags maliciosas (`<script>`, `<iframe>`, handlers `onerror`), estilos quebrados ou rastreadores invisíveis (pixels 1x1).
- **Alternativas**:
  1. Salvar o HTML cru e delegar sanitização ao frontend.
  2. Sanitizar no backend via `BeautifulSoup` na ingestão antes da persistência, e também renderizar de forma segura no frontend.
- **Escolha**: Defesa em profundidade: sanitização rigorosa no backend na ingestão (`sanitize_text`), decodificação de entidades HTML, remoção de tags de risco, preservação de texto legível e extração segura de imagens candidatas válidas ignorando tracking pixels.
- **Justificativa**: O banco de dados armazena dados limpos e seguros, tornando as APIs protegidas independentemente de qual cliente as consuma (web, mobile, CLI).

### ADR 09: Concorrência e Resiliência no Agendador de Coleta
- **Problema**: À medida que o número de fontes aumenta (8+ fontes), coletas sequenciais demoram excessivamente, e coletas concorrentes irrestritas podem exaurir conexões ou causar bloqueios por rate-limiting dos servidores remotos.
- **Alternativas**:
  1. Coleta sequencial em loop simples.
  2. Coleta totalmente concorrente com `asyncio.gather(*tasks)` sem limite.
  3. Coleta concorrente controlada com `asyncio.Semaphore` e intervalo individual por fonte (`poll_interval_minutes`).
- **Escolha**: Concorrência limitada via `asyncio.Semaphore(MAX_CONCURRENT_SOURCES=4)` combinada com checagem de intervalo por fonte (`is_source_due_for_polling`) e registro de saúde no banco (`last_polled_at`, `last_success_at`, `last_error_at`, `last_error_message`).
- **Justificativa**: Evita gargalos de I/O, distribui requisições de forma respeitosa para com os servidores de notícias e mantém total visibilidade operacional sobre o status de cada fonte.

---

## 4. Segurança e Resiliência

1. **Proteção contra SSRF e Timeout de Rede**:
   - Requisições HTTP externas usam `httpx.AsyncClient` centralizado (`create_http_client`) com timeout estrito configurável (padrão 15s) e User-Agent identificável: `TechNewsHub/1.0 (+https://github.com/usuario/tech-news-hub; RSS Reader)`.
   - Não são executadas requisições a URLs arbitrárias enviadas por usuários. Feeds são pré-cadastrados ou validados administrativamente.
2. **Sanitização de Conteúdo e XSS**:
   - Todo conteúdo textual recebido de fontes externas é sanitizado na ingestão.
   - Resumos e títulos são renderizados de forma segura no frontend com escape por padrão.
3. **CORS e Validação**:
   - Configuração de origens CORS explícitas via variável de ambiente `CORS_ORIGINS`.
   - Validação de contratos via esquemas Pydantic v2 com tipagem estrita e serialização JSON padronizada.
