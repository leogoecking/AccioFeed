# Arquitetura do AccioFeed

Este documento descreve as decisões arquiteturais fundamentais, os fluxos de dados, os padrões adotados e as diretrizes de design do **AccioFeed** (anteriormente Tech News Hub).

---

## 1. Visão Geral e Objetivos

O **AccioFeed** é um agregador inteligente e self-hosted de notícias e discussões sobre tecnologia. O sistema é desenhado para:
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
                  │    - article_states (read, save, fav)  │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ (asyncpg / SQLAlchemy)
                  ┌────────────────────────────────────────┐
                  │             Backend API                │
                  │   - FastAPI (/health, /api/v1/...)     │
                  │   - Repositories & Services            │
                  │   - SSRF Protection & Feed Validator   │
                  │   - Manual Sync (asyncio.Lock)         │
                  │   - Structured Logging & CORS          │
                  └──────────────────┬─────────────────────┘
                                     │
                                     ▼ (JSON REST / HTTP)
                  ┌────────────────────────────────────────┐
                  │            Frontend App                │
                  │   - Next.js (App Router)               │
                  │   - Tailwind CSS + Dark Mode           │
                  │   - Timeline, Filters & Reader Modal   │
                  │   - Library Collections & Realtime Qty │
                  │   - Sources Management (/sources)      │
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

### ADR 10: Estado de Artigos e Experiência do Leitor (Personal Tech Reader)
- **Problema**: Como gerenciar o estado pessoal do usuário (lido, favorito, ler depois, oculto, histórico de leitura) mantendo o design single-user sem introduzir complexidade precoce de autenticação e multi-tenant?
- **Alternativas**:
  1. Armazenar o estado exclusivamente no `localStorage` do navegador.
  2. Adicionar colunas booleanas diretamente na tabela `articles`.
  3. Criar uma entidade dedicada `article_states` associada via 1:1 com `articles` (`article_id` PK/FK com cascade).
- **Escolha**: Entidade dedicada `article_states` com relação 1:1, índices específicos e cascade on delete.
- **Justificativa**: Preserva a integridade do modelo de dados do artigo coletado (imutabilidade do payload da fonte). Permite consultas agregadas eficientes para contadores da biblioteca (`/api/v1/library/stats`) em uma única query com `FILTER (WHERE ...)`. Prepara uma transição suave para multi-user no futuro (bastando adicionar `user_id` e chave composta), sem quebrar a camada atual.
- **Consequência**: Criação de `ArticleStateRepository` e `ArticleStateService`. A timeline faz `LEFT OUTER JOIN` com `article_states` e preenche valores default em memória quando o estado ainda não existe no banco.

### ADR 11: Prevenção Rigorosa contra SSRF na Adição e Validação de Feeds Customizados
- **Problema**: Ao permitir que o usuário cadastre feeds RSS arbitrários via interface web, a aplicação corre risco de ataques de Server-Side Request Forgery (SSRF), onde um atacante pode tentar sondar a rede interna (Docker network, localhost, `169.254.169.254` para metadados de nuvem, IPs privados RFC 1918) ou causar DoS via redirects ou feeds gigantes.
- **Alternativas**:
  1. Utilizar bibliotecas HTTP padrão com `follow_redirects=True` sem filtragem de IP.
  2. Validar apenas o scheme da URL (`http://` ou `https://`).
  3. Validação em camadas com resolução DNS antecipada, blacklist estrita de CIDRs e cliente HTTP seguro com loop manual anti-redirect (`safe_fetch_feed`).
- **Escolha**: Validação em camadas estrita (`validate_url_ssrf` + `safe_fetch_feed`).
- **Justificativa**:
  - Esquema restrito a `http` e `https`.
  - Resolução DNS de todos os endereços IP do hostname antes da conexão.
  - Bloqueio imediato de faixas privadas, loopback, link-local e metadados (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, `::1`, `0.0.0.0`).
  - Prevenção de redirect-to-internal SSRF: o cliente HTTP intercepta redirects HTTP 3xx e revalida cada URL de destino antes de seguir para a próxima requisição (máximo de 3 redirects).
  - Limite de tamanho de payload (máximo 5 MB via streaming chunked) e timeout reduzido (10s) para evitar ataques de DoS/Resource Exhaustion.
- **Consequência**: Proteção completa e comprovada por testes unitários exaustivos contra ataques SSRF clássicos e evasões via DNS ou redirects.

### ADR 12: Gerenciamento Dinâmico de Fontes e Sincronização Sob Demanda
- **Problema**: Como permitir a sincronização manual de fontes (individual ou global) via API/UI sem concorrência destrutiva com o worker periódico e sem redefinir customizações de usuários quando o seed for executado?
- **Alternativas**:
  1. Disparar subprocessos CLI em segundo plano sem controle de concorrência.
  2. Implementar locks globais com `asyncio.Lock` em memória na API para serializar requisições manuais de sync, e garantir idempotência não-destrutiva no seed do banco.
- **Escolha**: Lock assíncrono em memória (`get_sync_lock()`) e atualização condicional no seed (`get_or_create`).
- **Justificativa**: Evita concorrência e condições de corrida entre chamadas simultâneas de sincronização manual. O seed do banco passa a verificar a existência da fonte pelo `slug` e preserva os valores de `is_active` e `poll_interval_minutes` definidos pelo usuário.
- **Consequência**: O usuário tem total controle sobre fontes ativas, inativas e intervalos customizados através da interface web (`/sources`), sem risco de sobrescrita.

### ADR 13: Arquitetura de Tradução Opcional, Desacoplada e Sob Demanda
- **Problema**: Como oferecer suporte opcional para leitura de artigos em Português do Brasil (PT-BR) sem acoplamento a um provedor proprietário específico, sem traduzir em massa (evitando custos e rate limits desnecessários), e sem quebrar a aplicação caso o serviço externo esteja desativado ou indisponível?
- **Alternativas**:
  1. Traduzir todos os artigos automaticamente durante o ciclo do worker na ingestão.
  2. Integrar uma biblioteca de tradução embutida no frontend via chamadas de terceiros no browser (vazando API keys e sem cache compartilhado).
  3. Abstração de provedor (`BaseTranslationProvider`) com implementação funcional do **DeepL**, tradução sob demanda disparada pelo usuário no Reader, persistência relacional de cache (`article_translations`), proteção de concorrência por lock em memória e fallback resiliente que preserva o artigo original.
- **Escolha**: Abstração de provedor com DeepL, cache relacional persistente e tradução estritamente sob demanda.
- **Justificativa**:
  - **Qualidade e Especialização**: O DeepL é amplamente reconhecido como a melhor ferramenta para tradução de terminologia técnica de inglês para português brasileiro (`PT-BR`). O Free Tier oficial oferece 500.000 caracteres/mês gratuitos, ideal para uso pessoal self-hosted.
  - **Desacoplamento e Segurança**: A chave de API nunca é exposta ao frontend. A interface `BaseTranslationProvider` permite futura adição de `LibreTranslate` (self-hosted) ou `Google Cloud Translation` sem alterar a API ou a UI.
  - **Eficiência e Cache Persistente**: A tabela `article_translations` funciona como cache permanente. Artigos já traduzidos nunca realizam novas chamadas externas. Artigos que já estão em português (detectados heuristicamente ou pelo feed) são armazenados diretamente sem acionar a API externa.
  - **Resiliência e Concorrência**: Requisições simultâneas para o mesmo artigo compartilham um lock assíncrono em memória (`_get_lock`), garantindo que apenas uma chamada à API externa seja feita. Se o serviço falhar (timeout, erro 500, cota esgotada), o usuário visualiza uma notificação discreta e pode continuar lendo o texto original sem bloqueio.
- **Consequência**: Experiência fluida, sem custos acidentais, mantendo o texto original sempre disponível com opção de alternar entre `Original` e `PT-BR`.

### ADR 08: AccioFeed_ Editorial Experience & Power Navigation
- **Problema**: Agregadores de notícias tradicionais frequentemente sofrem com layout shifts ("timeline jumping" ao sincronizar), falta de atalhos rápidos de teclado, leitura truncada ou poluída por elementos desnecessários.
- **Alternativas**:
  1. Carregamento e substituição automática dos itens na tela quando novos artigos chegam.
  2. Interface estática sem navegação por teclado e sem painéis rápidos.
  3. Sistema de Power Navigation com Zero Timeline Jumping, Command Palette (`Ctrl+K`), Quick Preview lateral, Reader calibrado (65-80ch) e atalhos completos estilo vim (`j`/`k`, `o`, `Space`, `s`, `f`, `m`).
- **Escolha**: Sistema de Power Navigation com Zero Timeline Jumping e Quick Preview.
- **Justificativa**:
  - **Zero Timeline Jumping**: Polling em background detecta artigos novos sem deslocar o scroll da timeline do usuário, exibindo um botão flutuante amigável `↑ X novas notícias disponíveis`.
  - **Quick Preview Lateral**: Painel deslizante à direita no desktop e bottom sheet no mobile, permitindo inspecionar resumos e metadados sem sair do contexto da timeline.
  - **Atalhos e Command Palette**: `j`/`k` com destaque visual e scroll suave, `Enter`/`o` para Reader, `Space`/`p` para Quick Preview, `Ctrl+K` para busca/comandos rápidos, com proteção estrita contra digitação em inputs.
  - **Preservação do Scroll**: Armazenamento e restauração da posição exata de `window.scrollY` ao abrir e fechar o leitor.
- **Consequência**: Leitura ultrarrápida, ergonômica e focada.

### ADR 09: Otimização de Consultas de Timeline e Debouncing de Busca
- **Problema**: Ao listar dezenas de artigos na timeline, retornar o campo `content` (HTML ou texto integral) gera payloads de centenas de kilobytes por requisição. Além disso, buscas parciais sem debouncing disparam requisições a cada tecla digitada.
- **Alternativas**:
  1. Carregar todos os campos em todas as rotas e disparar busca a cada tecla.
  2. Adicionar GraphQL ou endpoints separados.
  3. Aplicar `defer(Article.content)` na consulta SQLAlchemy da timeline e implementar debouncing de 300ms no input de busca frontend, mantendo carregamento completo de `content` apenas na abertura do artigo (`/articles/{id}`).
- **Escolha**: `defer(Article.content)` no repositório + extração segura em `ArticlePublic` + debouncing de 300ms no frontend.
- **Justificativa**: Reduz drasticamente o tamanho do payload JSON na timeline (de centenas de KB para poucos KB), economizando banda e tempo de renderização no cliente. O debouncing de 300ms garante digitação 100% fluida enquanto previne rajadas de requisições ao backend.
### ADR 10: Busca Textual de Alta Performance com PostgreSQL FTS e Unaccent
- **Problema**: A busca por `LIKE %termo%` não escala, não tolera diacríticos da língua portuguesa (ex.: buscar "inteligencia" não encontrava "inteligência") e não pondera relevância textual entre título, resumo e conteúdo.
- **Alternativas**:
  1. Manter `ILIKE %termo%` simples em SQL.
  2. Adicionar ElasticSearch/Meilisearch como serviço externo separado.
  3. Utilizar Full-Text Search nativo do PostgreSQL com índice GIN funcional, função wrapper `immutable_unaccent` e configuração `simple`.
- **Escolha**: PostgreSQL Full-Text Search nativo com `tsvector`, `websearch_to_tsquery('simple', immutable_unaccent(:query))`, índice GIN e ponderação de pesos (A: título, B: resumo, C: autor/categoria, D: conteúdo).
- **Justificativa**: Evita a complexidade e consumo de memória de serviços adicionais como Elasticsearch. O PostgreSQL executa buscas textuais complexas em menos de 1ms com bitmap scan no índice GIN. A configuração `simple` associada ao `immutable_unaccent` evita que o stemming agressivo de um idioma quebre o vocabulário do outro em um corpus técnico misto (inglês/português).
- **Consequência**: Busca instantânea, tolerante a acentos e com fallback transparente para SQLite nos testes automatizados.

### ADR 11: Tradução Sob Demanda no Leitor com Cache Idempotente
- **Problema**: Notícias em inglês dificultam a leitura de parte dos usuários, mas traduzir a timeline inteira de forma automatizada consumiria cotas externas exorbitantes, introduziria lentidão na navegação e degradaria a experiência com conteúdos já em português.
- **Alternativas**:
  1. Traduzir todos os artigos automaticamente durante o processo de ingestão no worker.
  2. Usar extensões do navegador pelo próprio usuário.
  3. Tradução sob demanda no Reader Modal e Quick Preview, com cache persistido em banco de dados (`article_translations`), skip inteligente de textos em português e interface não-bloqueante.
- **Escolha**: Tradução sob demanda exclusivamente acionada pelo usuário na tela de leitura com persistência local em PostgreSQL.
- **Justificativa**: Zero desperdício de cota com notícias não lidas. O texto original permanece 100% legível enquanto a tradução ocorre em segundo plano. Uma vez traduzido, o artigo é servido instantaneamente do cache local sem novas requisições externas. Falhas no provedor não impedem o acesso ao artigo original.
- **Consequência**: Experiência fluida, confiável, econômica e sem scraping invasivo de sites de terceiros.

---

## 4. Segurança e Resiliência

1. **Proteção contra SSRF e Prevenção de Redirects Maliciosos**:
   - Módulo centralizado `app.core.ssrf` com `validate_url_ssrf` e `safe_fetch_feed`.
   - Bloqueio incondicional de redes privadas RFC 1918, loopback, link-local e metadados cloud (`169.254.169.254`).
   - Validação a cada salto de redirect HTTP (máx 3 hops).
   - Limite de streaming de 5MB por feed e timeout de 10s.
2. **Sanitização de Conteúdo e Defesa em Profundidade contra XSS**:
   - Todo conteúdo textual recebido de fontes externas é sanitizado na ingestão via `sanitize_text`.
   - Remoção de scripts, iframes, atributos com handlers `on*` e tags inseguras.
   - Resumos e títulos renderizados com segurança no frontend React.
3. **Segurança de Credenciais e Conteúdo na Tradução**:
   - Chaves de API de tradução são carregadas via variáveis de ambiente seguras (`TRANSLATION_API_KEY`) e nunca trafegam para o cliente frontend.
   - Provedores externos nunca recebem logs, dados sensíveis do usuário ou credenciais internas. Apenas `title`, `summary` e blocos de texto necessários à leitura são transmitidos.
   - Timeouts rigorosos (10s) e retries restritos apenas para falhas de rede transitórias (sem retries infinitos para 401, 403, 429 ou 456).
4. **Isolamento de Estado do Usuário e Cache de Tradução**:
   - Tabela `article_states` para engajamento e histórico pessoal.
   - Tabela `article_translations` com constraint única `(article_id, language)` garantindo idempotência e integridade referencial com cascade delete.
5. **CORS e Validação**:
   - Configuração de origens CORS explícitas via variável de ambiente `CORS_ORIGINS`.
   - Schemas Pydantic v2 com `extra="forbid"` em schemas de atualização para rejeitar parâmetros maliciosos desconhecidos.


