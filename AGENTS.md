# Diretrizes para Agentes de Código (AGENTS.md)

Este documento estabelece os padrões e regras fundamentais que qualquer agente autônomo ou desenvolvedor assistido por IA deve seguir ao trabalhar no repositório **AccioFeed** (anteriormente Tech News Hub).

## 1. Princípios e Regras Gerais

1. **Leitura Obrigatória Prévia**: Sempre leia o `README.md`, o `roadmap.md` e `docs/architecture.md` antes de propor ou realizar alterações arquiteturais ou de grande porte.
2. **Justificativa Arquitetural**: Não altere a arquitetura ou adote novos padrões sem justificativa clara documentada no formato ADR (*Problema -> Alternativas -> Escolha -> Justificativa -> Consequência*).
3. **Parcimônia de Dependências**: Não adicione novas dependências ou bibliotecas sem necessidade explícita e justificativa de ganho técnico real.
4. **Segurança de Segredos**: Nunca cometa credenciais, chaves de API, senhas ou arquivos de ambiente com dados reais (`.env`) no repositório. Utilize sempre variáveis de ambiente e mantenha `.env.example` atualizado.
5. **Compatibilidade de API**: Preserve compatibilidade retroativa dos contratos da API REST (`/api/v1/...`) sempre que possível.
6. **Cultura de Testes**: Qualquer alteração de comportamento ou nova funcionalidade deve obrigatoriamente acompanhar testes automatizados correspondentes (unitários e/ou de integração com mocks externos).
7. **Verificação de Qualidade**: Execute lint, typecheck e suíte de testes antes de considerar qualquer tarefa ou PR concluída.
8. **Foco no Escopo Atual**: Não antecipe a implementação de recursos de fases futuras (ex.: IA com Ollama, embeddings, pgvector, multi-usuário) fora da fase ativa estipulada no roadmap.
9. **Commits Pequenos e Semânticos**: Prefira alterações pequenas, compreensíveis e revisáveis, utilizando o padrão Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`).
10. **Registro de Decisões**: Decisões técnicas importantes devem ser registradas em `docs/architecture.md`.
11. **Respeito a Fontes e Termos**: Não faça web scraping de fontes que explicitamente proíbam via robots.txt ou ToS. Priorize APIs oficiais e feeds RSS/Atom formais.
12. **Respeito a Paywalls e Copyright**: Não contorne paywalls nem copie conteúdos protegidos por copyright na íntegra quando a fonte disponibilizar apenas resumo.
13. **Sem Silenciamento de Erros**: Não mascare exceções com blocos genéricos `try: ... except: pass` ou `except Exception:` sem logging estruturado e tratamento apropriado.
14. **Integridade da Suíte de Testes**: Jamais remova, ignore ou comente testes existentes apenas para fazer um build ou pipeline passar. Corrija a causa raiz.

## 2. Padrões de Projeto e Arquitetura

- **Backend**:
  - FastAPI assíncrono com SQLAlchemy 2.0 (`asyncpg`) e Pydantic v2.
  - Separação em camadas: `api/` (rotas e controllers finos), `services/` (regras de negócio), `repositories/` (acesso ao banco), `models/` (entidades do ORM), `schemas/` (validação e DTOs) e `sources/` (provedores de dados).
  - Nunca coloque regras de negócio ou queries de banco diretamente nos endpoints.
- **Sources**:
  - Provedores devem implementar a interface `BaseSourceProvider` (`fetch`, `normalize`, `validate`).
  - O resultado de qualquer fonte deve ser normalizado em `NormalizedArticle` antes de qualquer persistência.
- **Workers**:
  - Execução assíncrona desacoplada do servidor HTTP.
  - Cada fonte deve ser isolada contra falhas: o erro em um provider não pode interromper a ingestão dos demais.
- **Frontend**:
  - Next.js (App Router) com TypeScript estrito e Tailwind CSS.
  - Componentização modular, foco em legibilidade, acessibilidade e dark mode por padrão.
  - Sanitização de qualquer texto ou resumo externo contra XSS.

## 3. Comandos de Verificação Rápida

Ao concluir alterações, certifique-se de executar no backend:
```bash
ruff check .
ruff format --check .
pytest
```
E no frontend:
```bash
npm run lint
npm run build
```
