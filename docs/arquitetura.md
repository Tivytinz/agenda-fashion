# Arquitetura Oficial — Agenda Fashion

> Atualizada em 25 de julho de 2026.

## 1. Objetivo do produto

O Agenda Fashion é uma plataforma de descoberta e agendamento para o mercado
de beleza.

A cliente encontra profissionais, studios e salões de unhas, cabelo, cílios e
outros serviços, consulta horários e agenda dentro da plataforma.

O produto deve:

- aumentar os agendamentos dos negócios;
- reduzir a dependência do WhatsApp;
- devolver tempo às profissionais;
- mostrar, pelo dashboard, se o negócio está crescendo;
- incentivar o upgrade somente depois que o plano demonstrar valor;
- tornar o Agenda Fashion uma referência para busca de serviços de beleza.

---

## 2. Stack atual

| Área | Tecnologia |
| --- | --- |
| Backend | Node.js e Express |
| Banco de dados | PostgreSQL |
| Frontend | HTML, CSS e JavaScript |
| Autenticação | JWT |
| Testes | Jest e Supertest |
| Pagamentos | Asaas |
| Hospedagem | Railway |
| Domínio | `app.agendafashion.com.br` |

Neste momento, não há necessidade de migrar o backend para Go. A evolução
recomendada, quando trouxer benefício real, é adotar TypeScript de forma
gradual no ecossistema Node.js.

---

## 3. Visão geral

O backend utiliza uma arquitetura em camadas:

```text
Cliente
  ↓
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

Responsabilidades transversais, como autenticação, validação, tratamento de
erros, configuração e integrações externas, apoiam essas camadas.

O servidor atual monta as rotas sem o prefixo `/api`. Portanto, o frontend usa
endereços como:

```text
/perfil-negocio/:slug
/agendar
/agenda-geral
/agenda-profissional
/checkout
```

Não adicionar `/api` somente em algumas rotas. Uma mudança desse tipo deverá
ser planejada e aplicada a todo o sistema.

---

## 4. Estrutura oficial de pastas

```text
agenda-fashion/
├── agendamento-nails/
│   ├── css/
│   ├── html/
│   └── js/
├── database/
├── docs/
│   └── arquitetura.md
├── migrations/
├── scripts/
├── src/
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── db/
│   ├── errors/
│   ├── middlewares/
│   ├── repositories/
│   ├── routes/
│   ├── services/
│   ├── utils/
│   ├── validators/
│   └── server.js
├── tests/
├── .env
├── .env.test
├── jest.config.js
├── package.json
└── package-lock.json
```

Algumas pastas podem ser criadas gradualmente. Código antigo pode ainda não
estar totalmente separado, mas todo módulo novo ou refatorado deve caminhar
para esta estrutura.

---

## 5. Responsabilidade de cada camada

### 5.1 Routes

As rotas registram os endpoints, aplicam middlewares e encaminham a requisição
ao controller.

Exemplo:

```js
router.post(
  "/agendar",
  autenticacaoOpcional,
  agendamentoPublicoController.criar
);
```

Routes não devem conter:

- SQL;
- regras de negócio;
- integração direta com Asaas;
- geração de JWT;
- respostas HTTP complexas.

### 5.2 Controllers

Controllers:

- recebem `req` e `res`;
- extraem dados da requisição;
- chamam um service;
- devolvem a resposta HTTP;
- encaminham erros ao middleware central.

Controllers não devem conter:

- SQL;
- `bcrypt`;
- geração ou validação manual de JWT;
- regras de limite de plano;
- transações;
- regras de negócio.

### 5.3 Services

Services concentram as regras de negócio e coordenam o caso de uso.

Exemplos:

- login e cadastro;
- criação de negócio;
- agendamento;
- cálculo de disponibilidade;
- limites de plano;
- geração de checkout;
- ativação de assinatura;
- processamento de webhook.

Services podem usar:

- repositories;
- outros services;
- validators;
- utils;
- clientes de integrações externas.

Services não devem possuir SQL novo. Quando um service antigo ainda executar
`db.query()` diretamente, isso deve ser tratado como dívida técnica e movido
para um repository durante a próxima refatoração segura.

### 5.4 Repositories

Repositories são responsáveis pelo acesso ao PostgreSQL.

Podem conter:

- `SELECT`;
- `INSERT`;
- `UPDATE`;
- `DELETE`;
- bloqueios transacionais;
- consultas agregadas.

Não podem conter:

- respostas HTTP;
- JWT;
- `bcrypt`;
- mensagens de interface;
- regras de upgrade;
- regras de negócio.

### 5.5 Middlewares

Middlewares tratam responsabilidades comuns às requisições:

- autenticação obrigatória;
- autenticação opcional;
- autorização;
- validação de payload;
- tratamento central de erros;
- logs e segurança.

### 5.6 Validators

Validators verificam formato e campos de entrada.

Exemplos:

```text
usuarioValidator
negocioValidator
servicoValidator
agendamentoValidator
checkoutValidator
```

Validação de formato pertence ao validator. Regra de negócio, como “o plano
permite mais um profissional?”, pertence ao service.

### 5.7 Utils

Utils são funções pequenas, reutilizáveis e sem estado.

Exemplos:

- gerar slug;
- normalizar telefone;
- formatar data;
- criar máscaras;
- converter valores monetários.

### 5.8 Constants

Valores fixos devem ficar centralizados.

Exemplos:

```text
PAPEIS
STATUS_AGENDAMENTO
STATUS_ASSINATURA
STATUS_PAGAMENTO
FORMAS_PAGAMENTO
```

Evitar strings de domínio repetidas em vários arquivos.

### 5.9 Errors

Erros conhecidos devem possuir tipo, status HTTP e, quando útil, um código.

Exemplos:

```text
ValidationError       → 400
UnauthorizedError     → 401
ForbiddenError        → 403
NotFoundError         → 404
ConflictError         → 409
```

Exemplo de código de negócio:

```text
LIMITE_AGENDAMENTOS
LIMITE_PROFISSIONAIS
LIMITE_SERVICOS
```

### 5.10 Config

Configurações e variáveis de ambiente devem ser lidas em um ponto central.

Variáveis obrigatórias devem falhar rapidamente na inicialização, sem revelar
segredos nos logs.

Exemplo:

```text
DATABASE_URL
JWT_SECRET
ASAAS_API_KEY
ASAAS_WEBHOOK_TOKEN
PORT
NODE_ENV
```

No Railway, `DATABASE_URL` pertence ao serviço da aplicação e referencia os
dados do serviço Postgres. Nunca colocar senhas ou URLs reais no Git.

---

## 6. Identidade, autenticação e autorização

### Identidade

A tabela `usuarios` representa a identidade e a autenticação da pessoa.

O JWT atual possui o payload:

```json
{
  "id": 123
}
```

Não confiar em papel, negócio ou permissão enviados pelo frontend.

### Vínculo com negócios

Os papéis pertencem ao vínculo entre usuário e negócio:

```text
usuarios_negocios.papel
```

Papéis atuais:

```text
dono
profissional
```

Um usuário pode estar vinculado a um negócio sem que seu papel seja gravado
diretamente em `usuarios`.

### Administração global

Administradores globais ficam em:

```text
usuarios_administradores
```

Admin global não deve ser confundido com o papel `dono` de um negócio.

### Proteção do frontend

O frontend usa `SessionGuard`.

- `exigirVinculo()` permite dono e profissional;
- verificações específicas devem ser usadas apenas quando a tela realmente
  exige um único papel;
- redirecionamentos do frontend melhoram a experiência, mas a autorização real
  sempre deve existir no backend.

Telas compartilhadas, como configuração de agenda, devem aceitar dono e
profissional quando ambos possuem autorização.

---

## 7. Contexto do negócio

Toda operação privada deve descobrir o negócio pelo usuário autenticado e pelo
vínculo existente no banco.

O frontend não pode escolher livremente um `negocio_id` para acessar dados.

Fluxo correto:

```text
JWT com usuario.id
  ↓
middleware autentica
  ↓
backend consulta usuarios_negocios
  ↓
backend identifica negócio e papel
  ↓
service executa a regra autorizada
```

Esse padrão reduz o risco de um negócio acessar informações de outro.

---

## 8. Fluxos principais

### 8.1 Agendamento público híbrido

O agendamento aceita dois cenários:

1. Visitante informa nome e WhatsApp.
2. Cliente logada é identificada pelo token.

Fluxo:

```text
Perfil do negócio por slug
  ↓
serviços ativos
  ↓
profissionais disponíveis
  ↓
data e horário
  ↓
validação de disponibilidade e limite
  ↓
criação do agendamento
  ↓
agenda da cliente e notificações
```

O endpoint público deve aceitar autenticação opcional, nunca exigir login de
quem apenas deseja agendar.

### 8.2 Agenda do negócio

O dono acompanha a agenda geral do negócio.

O profissional acompanha sua própria agenda e altera somente os agendamentos
permitidos.

### 8.3 Assinaturas e pagamentos

Fluxo esperado:

```text
Cliente escolhe plano
  ↓
backend valida negócio e plano
  ↓
Asaas cria cobrança ou assinatura
  ↓
assinatura fica pendente
  ↓
webhook autenticado confirma pagamento
  ↓
assinatura é ativada
  ↓
negócio recebe o novo plano
```

O retorno do navegador não confirma pagamento. A confirmação deve ocorrer por
webhook autenticado e com processamento idempotente.

---

## 9. Planos e limites

| Plano | Valor | Agendamentos/mês | Profissionais | Serviços |
| --- | ---: | ---: | ---: | ---: |
| Grátis | R$ 0,00 | 10 | 1 | 2 |
| Autônoma | R$ 49,90 | 20 | 1 | 4 |
| Studio | R$ 99,90 | 30 | 1 | 10 |
| Salão | R$ 199,90 | Ilimitados | 5 | Ilimitados |

O plano Grátis mantém o slug interno `inicial` para compatibilidade com
negócios e automações existentes.

### Regras de consumo

- agendamentos contam no mês da data marcada;
- contam os status `agendado`, `confirmado` e `realizado`;
- cancelados não consomem capacidade;
- um mês cheio não bloqueia o mês seguinte;
- editar ou excluir cadastros existentes continua permitido;
- criar serviço, profissional ou agendamento deve validar o limite dentro da
  mesma transação;
- bloqueio transacional deve impedir que duas requisições usem a última vaga;
- `NULL` no banco representa limite ilimitado.

### Comunicação de crescimento

| Uso | Estado |
| ---: | --- |
| A partir de 50% | negócio crescendo |
| A partir de 80% | alerta de capacidade |
| A partir de 90% | upgrade recomendado |
| 100% | limite atingido |

Ao atingir 100%, a agenda pública não deve oferecer datas sem capacidade no
mês e uma tentativa concorrente deve receber uma resposta amigável.

### Migration obrigatória

O código de planos depende da migration:

```text
migrations/008_planos_limites.sql
```

Ela adiciona:

```text
planos.limite_profissionais
planos.limite_servicos
```

Publicar o arquivo no Git não altera o banco automaticamente. A migration deve
ser executada em cada ambiente antes do backend que depende dessas colunas.

---

## 10. Banco de dados e transações

Toda operação que altera mais de uma tabela deve ser atômica:

```text
BEGIN
  ↓
operações
  ↓
COMMIT
```

Se qualquer etapa falhar:

```text
ROLLBACK
```

Transações são obrigatórias, especialmente em:

- criação de negócio e vínculo do dono;
- criação de agendamento e consumo de limite;
- criação de profissionais e serviços;
- assinatura e pagamento;
- ativação de plano;
- processamento de webhook.

O service coordena a transação. O repository executa as consultas usando o
mesmo `client` transacional.

Migrations devem:

- possuir ordem numérica;
- usar transação quando possível;
- ser revisadas antes do deploy;
- evitar perda de dados;
- usar `IF NOT EXISTS` quando isso tornar a operação segura;
- ser executadas primeiro em teste e depois em produção;
- nunca ser alteradas depois de aplicadas em produção; uma correção deve gerar
  uma nova migration.

---

## 11. Padrão de respostas HTTP

### Sucesso

```json
{
  "mensagem": "Operação realizada com sucesso.",
  "dados": {}
}
```

Quando o endpoint já possui contrato consumido pelo frontend, preservar o
formato até que ambos sejam migrados juntos.

### Erro

```json
{
  "erro": "Mensagem segura para a pessoa.",
  "codigo": "CODIGO_OPCIONAL"
}
```

Erros internos completos pertencem aos logs. Respostas públicas nunca devem
expor SQL, stack trace, senha, token ou detalhes do provedor.

---

## 12. Convenções de nomes

### Repository

Preferir verbos claros:

```text
buscarPorId()
buscarPorEmail()
buscarPorSlug()
buscarPorUsuario()
listar()
criar()
atualizar()
remover()
existe()
```

### Service

Usar nomes do caso de uso:

```text
login()
cadastrar()
criarNegocio()
criarAgendamento()
verificarCapacidadePlano()
gerarCheckout()
ativarAssinatura()
```

### Controller

Usar o nome da ação HTTP:

```text
buscar()
listar()
criar()
editar()
remover()
login()
checkout()
```

Consistência é mais importante que abreviações.

---

## 13. Testes

O projeto possui ambiente isolado de testes com `.env.test`, Jest, Supertest e
banco separado do banco de produção.

Após a integração dos planos, limites e nova interface, a referência registrada
foi:

```text
22 suítes aprovadas
138 testes aprovados
0 falhas
```

Esse número é uma fotografia daquele merge, não um teto. A suíte deve crescer
junto com o produto.

### Pirâmide recomendada

1. Testes unitários para regras de negócio.
2. Testes de integração para banco, repositories e services.
3. Testes HTTP com Supertest.
4. Testes ponta a ponta dos fluxos críticos do frontend.

### Fluxos críticos

- cadastro e login;
- criação de negócio;
- autorização entre dono e profissional;
- perfil público por slug;
- agendamento de visitante;
- agendamento de cliente logada;
- conflito de horário;
- limites de agendamentos, profissionais e serviços;
- cancelamento liberando capacidade;
- checkout;
- webhook e ativação de assinatura;
- agenda geral e agenda profissional;
- isolamento entre negócios.

Nunca executar testes automatizados contra o banco de produção.

---

## 14. Frontend

O frontend atual é estático e organizado em:

```text
agendamento-nails/html
agendamento-nails/css
agendamento-nails/js
```

Regras:

- manter a identidade rosa, feminina e delicada do Agenda Fashion;
- preservar o emoji de unha pintada como elemento de identidade;
- usar componentes visuais e tokens consistentes;
- não duplicar regras de negócio que pertencem ao backend;
- tratar loading, vazio, sucesso, erro e sessão expirada;
- usar `fetch` por meio de funções reutilizáveis;
- não confiar no frontend para autorização ou limites;
- manter páginas responsivas e acessíveis.

Páginas antigas removidas não devem voltar a ser referenciadas. Quando uma rota
antiga precisar sobreviver temporariamente, usar redirecionamento explícito.

---

## 15. Deploy no Railway

O ambiente de produção é composto por:

```text
GitHub
  ↓
Railway — serviço agenda-fashion
  ↓
Railway — PostgreSQL
  ↓
app.agendafashion.com.br
```

Ordem segura de publicação:

1. executar e confirmar backup quando a migration for relevante;
2. aplicar migrations compatíveis;
3. publicar o backend;
4. confirmar conexão com o banco e inicialização na porta fornecida;
5. realizar smoke tests;
6. acompanhar logs e erros.

Smoke tests mínimos:

- abrir landing page;
- login;
- dashboard do negócio;
- configurar agenda;
- perfil público;
- criar agendamento;
- visualizar agenda;
- consultar plano;
- iniciar checkout.

Avisos do npm ou do `dotenv` não devem ser confundidos com falha. O deploy só é
considerado saudável quando o servidor, o banco e os fluxos principais
respondem corretamente.

---

## 16. Segurança

- nunca versionar `.env`;
- nunca enviar segredos ao frontend;
- validar webhook do Asaas;
- usar queries parametrizadas;
- aplicar autorização no backend;
- limitar tentativas em endpoints sensíveis;
- validar e normalizar entradas;
- evitar dados pessoais em logs;
- usar HTTPS em produção;
- manter dependências atualizadas;
- garantir isolamento entre negócios;
- proteger alterações de status de agendamento.

---

## 17. Observabilidade

Logs devem informar:

- ambiente;
- início do servidor;
- conexão com banco;
- rota ou caso de uso;
- identificador seguro da requisição;
- tipo e código do erro.

Logs não devem informar:

- senhas;
- `DATABASE_URL`;
- JWT;
- chave do Asaas;
- dados completos de cartão;
- informações pessoais desnecessárias.

Métricas prioritárias do produto:

- negócios ativos;
- agendamentos por mês;
- conversão de visita em agendamento;
- ocupação por profissional;
- cancelamentos;
- planos próximos do limite;
- conversão de plano grátis para pago;
- falhas de checkout e webhook.

---

## 18. Regras obrigatórias

1. Nunca escrever SQL em routes ou controllers.
2. Não adicionar SQL novo em services.
3. Nunca confiar em `negocio_id`, papel ou preço enviado pelo frontend.
4. Toda autorização deve ser validada no backend.
5. Toda operação crítica em várias tabelas deve usar transação.
6. Todo módulo novo deve possuir testes adequados ao risco.
7. Toda alteração de banco deve possuir migration.
8. Migration aplicada em produção não deve ser editada.
9. Segredos nunca devem aparecer no Git ou nos logs.
10. O banco de testes deve ser isolado do banco de produção.
11. Rotas existentes não devem receber `/api` isoladamente.
12. Mudanças no contrato devem atualizar backend, frontend e testes juntos.

---

## 19. Estrutura de um módulo novo

Um módulo completo deve possuir, conforme a necessidade:

```text
route
controller
service
repository
validator
testes
migration
```

Nem todo módulo precisa criar arquivos vazios em todas as camadas. A separação
deve existir quando houver responsabilidade real.

Fluxo de implementação:

1. definir regra e contrato;
2. criar migration, se necessária;
3. implementar repository;
4. implementar service;
5. implementar validator e controller;
6. registrar route e middlewares;
7. integrar frontend;
8. criar testes;
9. validar localmente;
10. publicar com migration e smoke tests.

---

## 20. Próxima evolução arquitetural

Prioridades:

1. executar e validar a migration de planos em todos os ambientes;
2. corrigir telas compartilhadas para dono e profissional;
3. mover SQL restante dos services para repositories;
4. centralizar respostas e erros;
5. ampliar testes ponta a ponta do frontend;
6. tornar webhooks idempotentes e observáveis;
7. centralizar configuração e constantes;
8. avaliar TypeScript gradualmente, sem reescrever o sistema inteiro.

---

## Objetivo final

O Agenda Fashion deve permanecer simples para desenvolver, seguro para os
negócios e confiável para as clientes.

A arquitetura existe para manter:

- separação de responsabilidades;
- isolamento entre negócios;
- consistência de dados;
- deploys previsíveis;
- evolução dos planos e pagamentos;
- testes que protegem os fluxos críticos;
- velocidade para chegar à aquisição de clientes.
