# Guia de Hospedagem no Render (Tech News Hub)

Este guia orienta o passo a passo completo para hospedar o **Tech News Hub** gratuitamente no [Render](https://render.com).

---

## 1. Visão Geral da Arquitetura no Render

O projeto utiliza o arquivo [`render.yaml`](../render.yaml) na raiz do repositório para configurar a infraestrutura via **Render Blueprint**:

1. **`technewshub-db`** (PostgreSQL Gerenciado - Plano Free):
   - Banco de dados relacional para notícias, histórico, favoritos e traduções.
2. **`technewshub-api`** (Web Service Docker - Plano Free):
   - Executa a API REST FastAPI.
   - Aplica migrações do banco de dados automaticamente na inicialização via Alembic.
   - Executa o **Worker de ingestão embutido** (`ENABLE_EMBEDDED_WORKER=true`), dispensando a necessidade de contratar um background worker pago.
   - Provedor de tradução padrão: `mymemory` (gratuito e sem necessidade de chave de API).
3. **`technewshub-web`** (Web Service Docker - Plano Free):
   - Executa o frontend Next.js otimizado (standalone).
   - Comunica-se com o backend da API.

---

## 2. Passo a Passo de Implantação

### Passo 1: Criar conta no Render
1. Acesse **[render.com](https://render.com)**.
2. Crie uma conta ou faça login com o seu GitHub (`leogoecking`).

### Passo 2: Conectar o Repositório via Blueprint
1. No painel do Render, clique no botão superior direito **New +** e selecione **Blueprint**.
2. Conecte o repositório GitHub: **`leogoecking/TechNewsHub`**.
3. O Render identificará automaticamente o arquivo `render.yaml`.
4. Dê um nome para a instância do Blueprint (ex: `tech-news-hub`).
5. Clique em **Apply**.

### Passo 3: Aguardar o Build
O Render criará os 3 serviços em sequência:
1. `technewshub-db`: cria o banco de dados PostgreSQL.
2. `technewshub-api`: compila o container Docker do backend, conecta ao banco e roda as migrações.
3. `technewshub-web`: compila o frontend Next.js apontando para o backend.

---

## 3. Particularidades do Plano Gratuito do Render

- **Sleep após inatividade**: Serviços Web no plano Free entram em modo de repouso após 15 minutos sem requisições. A primeira requisição após o repouso pode levar cerca de 30 a 50 segundos para inicializar o container.
- **Duração do Banco de Dados Free**: O banco PostgreSQL gratuito no Render tem validade de 30 dias a partir da criação. Para testes de curto prazo, é perfeito. Para uso contínuo permanente, pode-se usar o plano Starter ($7/mês) ou apontar para um banco gratuito como Supabase / Neon / Aiven.
- **Worker Embutido**: Graças à flag `ENABLE_EMBEDDED_WORKER=true`, o processo de sincronização de feeds roda dentro do próprio container da API sem custos adicionais.

---

## 4. Variáveis de Ambiente Opcionais

No painel do serviço `technewshub-api` no Render (aba **Environment**), você pode adicionar:

| Variável | Padrão | Descrição |
|---|---|---|
| `TRANSLATION_PROVIDER` | `mymemory` | Provedor de tradução (`mymemory`, `deepl`, `mock`) |
| `TRANSLATION_API_KEY` | *(vazio)* | Chave da API DeepL (se desejar usar DeepL) |
| `WORKER_INTERVAL_SECONDS` | `300` | Intervalo em segundos entre ciclos de coleta |
