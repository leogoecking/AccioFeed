# Roadmap — AccioFeed_

Este roadmap delineia a evolução planejada para o **AccioFeed_**, um agregador pessoal, minimalista, editorial e self-hosted focado em proporcionar uma experiência ultra-rápida, agradável e organizada para leitura diária de notícias de tecnologia.

---

## Fase 1 — Foundation & Monorepo (Concluída)
- [x] Estrutura de monorepo (`frontend/`, `backend/`, `docs/`)
- [x] Docker e Docker Compose com PostgreSQL, Backend, Worker e Frontend
- [x] Suporte a hot-reload instantâneo local com montagem de volumes (`docker-compose.override.yml`)
- [x] Backend FastAPI com Pydantic v2 e SQLAlchemy 2.0 (asyncpg)
- [x] Frontend Next.js 15 com App Router, TypeScript, Tailwind CSS v4
- [x] Migrações com Alembic
- [x] Endpoint de Healthcheck (`/health`)
- [x] Configuração de linters (Ruff para Python, ESLint para TypeScript)
- [x] Suíte de testes automatizados com Pytest (83 testes passando)
- [x] Pipeline de CI básica com GitHub Actions

---

## Fase 2 — Aggregation MVP & Multi-Source Engine (Concluída)
- [x] Abstração de `SourceProvider` (`fetch`, `normalize`, `validate`)
- [x] Provedor oficial da API do Hacker News (Top Stories / Best Stories com métricas)
- [x] Provedor genérico para feeds RSS/Atom (`RSSProvider`, `RSSParser`) com suporte a RSS 2.0 e Atom 1.0
- [x] Integração de 8 fontes tecnológicas oficiais: Hacker News, Ars Technica, The Verge, Tom's Hardware, MIT Technology Review, IEEE Spectrum, GitHub Blog, Phoronix
- [x] Canonicalização de URLs (remoção determinística de parâmetros de rastreamento UTM, ref, etc.)
- [x] Sanitização rigorosa de texto e HTML contra XSS (`<script>`, `<iframe>`, handlers inline)
- [x] Extração inteligente de imagens em miniatura (tags `media:content`, `media:thumbnail`, enclosures e tags `<img>` HTML)
- [x] Persistência com deduplicação robusta por `(source_id, external_id)` e `(source_id, canonical_url)`
- [x] Worker assíncrono com concorrência controlada (`asyncio.Semaphore`), fail-safe por fonte e rastreamento de saúde (`last_polled_at`, `last_success_at`, `last_error_at`)
- [x] CLI de gerenciamento para sincronização manual (`python -m app.cli sync [--no-force]`) e seed (`python -m app.cli seed`)
- [x] Endpoints REST: `/api/v1/articles`, `/api/v1/articles/{id}`, `/api/v1/sources`, `/api/v1/categories`
- [x] Paginação e filtros por fonte, categoria, período e busca por título e resumo

---

## Fase 3 — Reader & Personal Collections (Concluída)
- [x] Modal de leitura focada e sem distrações (Reader View) com rastreamento automático de leitura
- [x] Coleções Pessoais na Sidebar: 📰 Tudo, ● Não lidos, 📚 Ler depois, ⭐ Favoritos, 🕘 Histórico (com contadores em tempo real via `/api/v1/library/stats`)
- [x] Ações rápidas no card e modal: Marcar como lido/não lido, favoritar, salvar para ler depois, ocultar notícia
- [x] Histórico de leitura com ordenação cronológica por `last_opened_at`
- [x] Painel de Gerenciamento de Fontes (`/sources`): monitoramento de saúde operacional, ativação/desativação dinâmica e sincronização manual com lock de concorrência
- [x] Cadastro dinâmico de novos feeds RSS com validação ao vivo, extração de metadados e preview prévio
- [x] Defesa em camadas contra SSRF (bloqueio de IPs privados, loopback, metadados AWS/GCP, anti-redirect e limites de payload)
- [x] Idempotência do seed de fontes preservando alterações manuais do usuário

---

## Fase 4 — AccioFeed_ Editorial Experience & Power Navigation (Concluída)
- [x] **Identidade Visual AccioFeed_**: Paleta editorial Dark-first Red & Black (`#e11d48` / `rose-500` e `#09090b` / `zinc-950`), logo com símbolo de convergência focal de informação (`• • ↘↓↙ ◉ ACCIOFEED_`).
- [x] **Seletor de Densidade de Visualização**: Alternância instantânea entre modo Confortável (cards editoriais com imagens) e Compacto (linhas para varredura ultrarrápida), persistido em `localStorage`.
- [x] **Timeline Inteligente ("Novas desde a última visita")**: Rastreamento de `lastVisitAt` com badges `NOVA`, indicador de novas notícias e separador visual `VOCÊ JÁ VIU ATÉ AQUI` com ação "Marcar anteriores como vistos".
- [x] **Zero Timeline Jumping**: Polling em background a cada 2 minutos que notifica via botão flutuante `↑ X novas notícias disponíveis` em vez de deslocar a leitura do usuário.
- [x] **Paginação Fluida**: Botão "Carregar mais notícias" com carregamento contínuo sem saltos de scroll.
- [x] **Leitor Focado Aprimorado**: Calibrado para largura ideal de leitura (65-80ch / `max-w-[72ch]`), barra de progresso discreta em rose-500, tempo de leitura estimado determinístico (200 wpm), navegação `←`/`→` com setas do teclado e preservação absoluta da posição de rolagem da timeline ao abrir/fechar.
- [x] **Quick Preview Lateral**: Painel deslizante à direita no desktop (sem ocultar a timeline) e bottom sheet acessível no mobile para inspeção rápida de títulos, resumos e ações.
- [x] **Command Palette Global (`Ctrl+K` / `Cmd+K`)**: Busca rápida e pulo para qualquer coleção, categoria tecnológica ou ação do sistema com suporte a navegação por setas e busca direta.
- [x] **Navegação de Alta Velocidade por Teclado**: Atalhos estilo vim/reader (`j`/`k` para navegar com anel de destaque visível, `o`/`Enter` para abrir o Reader, `Space`/`p` para Quick Preview, `s` para salvar, `f` para favoritar, `m` para lido/não lido, `r` para atualizar, `Esc` para fechar).
- [x] **Modal de Ajuda de Atalhos (`?`)**: Diálogo completo com badges visuais `<kbd>` acessível via tecla `?` ou botão no cabeçalho.
- [x] **Otimizações de Performance**: Defer de carregamento de `content` volumoso nas consultas de listagem (`defer(Article.content)`), extração segura de atributos sem lazy-loading desnecessário e debouncing de 300ms no input de busca frontend.

---

## Fase 5 — Tradução & Experiência Multilíngue (Próxima Etapa)
- [x] Abstração extensível de provedores de tradução (`BaseTranslationProvider`)
- [x] Provedor funcional DeepL (`DeepLProvider`) e cache local em banco de dados
- [x] Placeholder no Reader View (`Original | PT-BR (em breve)`)
- [ ] Ativação da tradução sob demanda completa com fallback resiliente e detecção de idioma na UI

---

## Fase 6 — Busca Avançada, Filtros & Curadoria
- [ ] Busca textual avançada (Full-Text Search) com PostgreSQL (`tsvector`/`tsquery`)
- [ ] Importação e exportação de feeds em formato OPML
- [ ] Filtros combinados por intervalo de datas e ordenação multicritério
- [ ] Limpeza automática e retenção configurável de artigos antigos (Housekeeping)

---

## Fase 7 — Performance, Confiabilidade & Self-Hosting
- [ ] Otimização de queries com índices parciais e paginação keyset/cursor-based
- [ ] Exportação de artigos em Markdown / leitor offline local
- [ ] Painel de métricas de telemetria operacional da coleta e saúde do sistema
- [ ] Suporte a backups automáticos e migração de banco de dados simplificada

---

## Backlog / Ideias Futuras (Sem prioridade ativa)
> *Recursos de inteligência artificial generativa, LLMs e modelos complexos permanecem despriorizados em relação à velocidade, ergonomia e confiabilidade do leitor diário.*
- [ ] Integração experimental com LLM local via Ollama para resumos TL;DR
- [ ] Deduplicação semântica e busca por similaridade com embeddings e `pgvector`
- [ ] Recomendação personalizada com base no histórico local de leitura
