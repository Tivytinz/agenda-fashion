# Arquitetura Oficial - Agenda Fashion

## Objetivo

Este documento define a arquitetura oficial do Agenda Fashion.

Todo código novo deve seguir este padrão.

---

# Arquitetura

A aplicação utiliza arquitetura em camadas.

```
Routes
    ↓
Controllers
    ↓
Services
    ↓
Repositories
    ↓
PostgreSQL
```

Cada camada possui apenas uma responsabilidade.

---

# Estrutura de pastas

```
src/

config/

constants/

controllers/

services/

repositories/

routes/

middlewares/

validators/

errors/

utils/

db/
```

---

# Responsabilidades

## Routes

Responsável apenas por registrar endpoints.

Exemplo:

```
POST /login
```

Não pode possuir:

- SQL
- regras de negócio
- validações

---

## Controllers

Recebem:

- req
- res

Chamam um Service.

Retornam a resposta HTTP.

Não podem possuir:

- SQL
- bcrypt
- JWT
- regras de negócio

---

## Services

Responsáveis por toda regra de negócio.

Exemplos:

- Login
- Cadastro
- Criar negócio
- Gerar checkout
- Ativar assinatura

Podem utilizar:

- repositories
- outros services
- utils

---

## Repositories

Responsáveis apenas pelo acesso ao banco.

Podem conter:

- SELECT
- INSERT
- UPDATE
- DELETE

Não podem conter:

- regras de negócio
- JWT
- bcrypt
- validações

---

## Validators

Responsáveis pelas validações.

Exemplo:

```
usuarioValidator

negocioValidator

servicoValidator
```

---

## Utils

Funções reutilizáveis.

Exemplos:

- gerarSlug
- formatarTelefone
- formatarData
- mascaras

---

## Constants

Valores fixos do sistema.

Exemplo:

```
PAPEIS

STATUS_ASSINATURA

STATUS_AGENDAMENTO

PLANOS
```

Nunca utilizar strings fixas espalhadas pelo projeto.

---

## Errors

Responsáveis pelos erros padronizados.

Exemplos:

ValidationError

UnauthorizedError

ForbiddenError

NotFoundError

---

# Convenções

## Repository

Sempre utilizar:

buscarPorId()

buscarPorEmail()

buscarPorSlug()

buscarPorUsuario()

listar()

criar()

atualizar()

remover()

existe()

---

## Service

Sempre utilizar:

buscar()

listar()

criar()

editar()

remover()

ou nomes específicos como:

login()

cadastro()

ativar()

cancelar()

vincular()

---

## Controller

Sempre:

buscar()

listar()

criar()

editar()

remover()

ou:

login()

cadastro()

---

# Fluxo de uma requisição

Cliente

↓

Routes

↓

Controller

↓

Service

↓

Repository

↓

PostgreSQL

↓

Repository

↓

Service

↓

Controller

↓

Cliente

---

# Regras

Nunca escrever SQL em Controllers.

Nunca acessar o banco diretamente em Services.

Nunca colocar regra de negócio em Routes.

Todo módulo novo deve possuir:

Route

Controller

Service

Repository

---

# Padrão de resposta

Sucesso:

{
    "mensagem": "...",
    "dados": {}
}

Erro:

{
    "erro": "..."
}

---

Padrão de transações

Sempre que uma operação envolver mais de uma tabela (por exemplo, criar negócio + vincular usuário + criar cliente no Asaas), o Service deverá controlar uma transação do banco (BEGIN, COMMIT, ROLLBACK). Isso garante consistência dos dados se alguma etapa falhar.

Esse padrão é muito importante para módulos como:

criação de negócio;
assinaturas;
pagamentos;
agendamentos.

Ele vai deixar o Agenda Fashion mais robusto e preparado para crescer sem inconsistências no banco de dados.

# Objetivo final

Todo módulo do Agenda Fashion deverá seguir exatamente esta arquitetura.