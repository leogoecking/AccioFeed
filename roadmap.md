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

## Fase 2 — Aggregation MVP (Vertical Slice Inicial)
- [x] Abstração de `SourceProvider` (`fetch`, `normalize`, `validate`)
- [x] Provedor oficial da API do Hacker News (Top Stories / Best Stories com métricas)
- [x] Pipeline de normalização padronizado
- [x] Persistência com deduplicação por `(source_id, external_id)` e preservação de métricas
- [x] Worker independente com agendador de coletas periódicas e isolamento contra falhas
- [x] Endpoints REST: `/api/v1/articles`, `/api/v1/articles/{id}`, `/api/v1/sources`, `/api/v1/categories`
- [x] Paginação e filtros por fonte, categoria, período e busca por título
- [x] Frontend com Dashboard/Timeline moderna em dark mode
- [ ] Provedor genérico para feeds RSS/Atom (Ars Technica, MIT Tech Review, IEEE Spectrum, Tom's Hardware)

---

## Fase 3 — Reader & UX Avançada
- [ ] Página interna de leitura focada e sem distrações
- [ ] Marcação de artigos favoritos e "Ler depois" (armazenamento local/banco)
- [ ] Histórico de artigos lidos
- [ ] Interface administrativa para cadastro dinâmico de novas fontes RSS
- [ ] Notificações no navegador / suporte preliminar a PWA

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
