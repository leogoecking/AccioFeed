# Roadmap — Tech News Hub

Este roadmap delineia a evolução planejada para o agregador inteligente e self-hosted de notícias de tecnologia.

---

## Fase 1 — Foundation (Em andamento / Base concluída)
- [x] Estrutura de monorepo (`frontend/`, `backend/`, `docs/`)
- [x] Docker e Docker Compose com PostgreSQL, Backend, Worker e Frontend
- [x] Backend FastAPI com Pydantic v2 e SQLAlchemy 2.0 (asyncpg)
- [x] Frontend Next.js com App Router, TypeScript, Tailwind CSS
- [x] Migrações com Alembic
- [x] Endpoint de Healthcheck (`/health`)
- [x] Configuração de linters (Ruff para Python, ESLint para TypeScript)
- [x] Suíte de testes com Pytest (mocks de I/O de rede)
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
- [x] Frontend moderno Next.js com timeline multi-fonte, badges visuais por publicação, modais de leitura enriquecidos, sincronização de estado com URL e dark mode por padrão

---

## Fase 3 — Reader & UX Avançada (Concluída)
- [x] Modal de leitura focada e sem distrações (Reader View) com rastreamento automático de leitura
- [x] Coleções Pessoais na Sidebar: 📰 Tudo, ● Não lidos, 📚 Ler depois, ⭐ Favoritos, 🕘 Histórico (com contadores em tempo real via `/api/v1/library/stats`)
- [x] Ações rápidas no card e modal: Marcar como lido/não lido, favoritar, salvar para ler depois, ocultar notícia
- [x] Histórico de leitura com ordenação cronológica por `last_opened_at`
- [x] Painel de Gerenciamento de Fontes (`/sources`): monitoramento de saúde operacional, ativação/desativação dinâmica e sincronização manual com lock de concorrência
- [x] Cadastro dinâmico de novos feeds RSS com validação ao vivo, extração de metadados e preview prévio
- [x] Defesa em camadas contra SSRF (bloqueio de IPs privados, loopback, metadados AWS/GCP, anti-redirect e limites de payload)
- [x] Idempotência do seed de fontes preservando alterações manuais do usuário
- [ ] Notificações no navegador / suporte preliminar a PWA (Fase futura)

---

## Fase 4 — AI & Enriquecimento
- [ ] Integração com LLM local via Ollama (sem dependência de APIs pagas obrigatórias)
- [ ] Classificação automática de tópicos (IA, Hardware, Dev, Cybersecurity, Linux, etc.)
- [ ] Geração de resumos em múltiplos tamanhos (bullets, TL;DR, parágrafo executivo)
- [ ] Tradução automática de resumos e títulos para português
- [ ] Deduplicação semântica via embeddings e `pgvector`

---

## Fase 5 — Intelligence & Curation
- [ ] Algoritmo de ranking personalizado (*TechScore*)
- [ ] Detecção de tendências (*Trending Topics*) e velocidade de engajamento
- [ ] Clusterização de matérias de diferentes fontes cobrindo o mesmo evento
- [ ] Gráfico de engajamento temporal (HN score, contagem de comentários ao longo do dia)

---

## Fase 6 — Content Radar
- [ ] Cálculo do *Content Potential Score* para criadores de conteúdo
- [ ] Métricas combinadas: aceleração de votos, volume de discussões, multiplicidade de fontes
- [ ] Geração assistida de pautas (briefing do tema, ângulos de discussão, ganchos e títulos sugeridos)
- [ ] Exportação de briefings para ferramentas externas (Markdown, Notion, Obsidian)
