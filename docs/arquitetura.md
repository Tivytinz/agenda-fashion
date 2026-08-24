# Arquitetura Oficial — Agenda Fashion

> Atualizada em 20 de agosto de 2026.
>
> O contexto permanente de produto e as instrucoes para agentes estao em
> [`AGENTS.md`](../AGENTS.md). Os dois documentos devem permanecer alinhados.

## 1. Objetivo do produto

O objetivo do Agenda Fashion e **se tornar referencia no Brasil para
agendamento de beleza e estetica**.

O AF e uma plataforma de descoberta e agendamento que conecta clientes a
profissionais, studios, saloes, clinicas e negocios de beleza e estetica.

A cliente encontra profissionais, studios e salões de unhas, cabelo, cílios e
outros serviços, consulta horários e agenda dentro da plataforma.

O produto deve:

- evoluir continuamente sem aceitar regressões conhecidas ou comprometer a
  estabilidade dos fluxos existentes;
- aumentar os agendamentos dos negócios;
- reduzir a dependência do WhatsApp;
- devolver tempo às profissionais;
- mostrar, pelo dashboard, se o negócio está crescendo;
- incentivar o upgrade somente depois que o plano demonstrar valor;
- tornar o Agenda Fashion uma referencia nacional para descoberta e
  agendamento de servicos de beleza e estetica.

Para a profissional, a proposta de valor deve aparecer de forma direta: e
possivel comecar gratis, conquistar clientes com um perfil publico, receber
agendamentos sem precisar responder manualmente cada pedido, ser avisada pelo
WhatsApp e acompanhar o crescimento do negocio pelo dashboard.

---

## 2. Stack atual

| Área | Tecnologia |
| --- | --- |
| Runtime | Node.js 22 |
| Backend | Express 5 e JavaScript CommonJS |
| Banco de dados | PostgreSQL e `pg` |
| Frontend | React 19, React Router 7, Vite 7 e CSS |
| Autenticação | JWT em cookie `HttpOnly`, bcrypt e Google Identity |
| Uploads | Busboy, validação de imagem e Cloudinary |
| Testes backend | Jest, Supertest e PostgreSQL de teste |
| Testes frontend | Vitest, Testing Library e Playwright |
| Pagamentos | Asaas |
| Notificações | WhatsApp Cloud API e e-mail transacional via Resend |
| Marketing | GA4, Google Ads, Meta CAPI e Meta Marketing API |
| CI/CD | GitHub Actions e Railway |
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
├── AGENTS.md
├── .github/
│   └── workflows/
├── database/
│   └── migrations/
├── docs/
│   └── arquitetura.md
├── frontend/
│   ├── e2e/
│   └── src/
│       ├── analytics/
│       ├── api/
│       ├── auth/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── styles/
│       └── utils/
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
├── .env.example
├── jest.config.js
├── package.json
├── railway.json
└── package-lock.json
```

O build de producao do frontend e gerado em `agendamento-nails/react-app/` e
servido pelo Express. Essa pasta e um artefato de build e nao faz parte do
codigo-fonte versionado.

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

No navegador, o JWT fica em cookie `HttpOnly`, `SameSite=Lax` e `Secure` em
produção. O JavaScript armazena apenas um marcador sem valor de autenticação.
Durante a migração, o backend continua aceitando `Authorization: Bearer` para
sessões antigas e clientes de API, mas novos logins do frontend não persistem
o token no `localStorage`.

Novos cadastros, trocas e redefinições exigem senhas entre 8 e 72 bytes. O
formulário de login não impõe o mínimo de 8 caracteres para preservar o acesso
de contas legadas que já possuem uma senha curta válida; a autenticação continua
dependendo da comparação segura com o hash armazenado.

O endpoint `POST /logout` remove o cookie. Respostas de autenticação usam
`Cache-Control: no-store`. O cookie de produção possui o prefixo `__Host-`, não
define domínio e sempre usa o caminho `/`.

A recuperação de senha usa `POST /auth/esqueci-senha` e
`POST /auth/redefinir-senha`. O primeiro endpoint sempre responde de forma
neutra para não revelar se um e-mail existe. O token aleatório possui validade
de 30 minutos, é enviado por e-mail, armazenado no PostgreSQL somente como hash
SHA-256 e invalidado após o primeiro uso. A troca atualiza
`usuarios.senha_alterada_em`, encerrando a validade das sessões anteriores.

O envio exige `PASSWORD_RESET_EMAIL_ENABLED=true`, `RESEND_API_KEY`,
`PASSWORD_RESET_EMAIL_FROM` e `PUBLIC_APP_URL` configurados no serviço da
aplicação. Chaves e tokens nunca devem ser registrados nos logs.

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

Todas as rotas `/admin` exigem `auth` e `authAdmin`, consultam a permissão
administrativa ativa no banco e respondem com cache desabilitado. Relatórios
por dia e período usam `America/Sao_Paulo`; vínculos e serviços inativos não
podem ser apresentados como capacidade operacional atual.

O marketing administrativo usa atribuição por primeiro contato em uma janela
fixa de 30 dias e preserva o último contato nos eventos para auditoria. Um
identificador de clique sem `utm_campaign` confirma tráfego pago, mas permanece
como campanha não identificada: a lista atual de campanhas nunca pode ser usada
para reescrever o histórico. Campanhas arquivadas continuam oficiais nos
períodos em que tiveram atividade, e desempenho, conversões e custos compartilham
a mesma normalização de origem, mídia e campanha. A taxa de conversão usa sessões
com ao menos um agendamento concluído; a quantidade de agendamentos permanece uma
métrica separada e pode ser maior do que a quantidade de sessões.

A área administrativa possui a página `Saúde do SaaS`, em `/admin/saude`.
Ela consulta `GET /admin/saude/perfis-incompletos` para resumir e listar
cadastros profissionais que ainda não concluíram negócio, dados obrigatórios,
serviço, agenda ou publicação. A descrição opcional aparece separadamente como
recomendação, não reduz o progresso de ativação e não mantém um cadastro
completo na fila padrão; ela pode ser consultada pelo filtro específico. A
listagem prioriza quem está mais perto de concluir e oferece filtros pelos
indicadores e pelas pendências. Mesmo quando a página solicitada fica além do
último resultado, a API preserva o total filtrado e a quantidade real de
páginas.
Nome, e-mail e WhatsApp permanecem protegidos por `auth` e `authAdmin`; as ações
de contato ficam junto dos dados de contato, abrem uma mensagem personalizada
para revisão do administrador e não enviam comunicação automaticamente. O atalho
manual de WhatsApp só aparece quando existe consentimento de ativação vigente.
Inconsistências de publicação automática são marcadas como correção interna e
não geram uma orientação para o administrador cobrar o profissional.

### Proteção do frontend

O frontend usa `ProtectedRoute` e `SessionContext`.

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

A primeira página de `/negocios-publicos` também devolve as localidades que
possuem negócio publicado e ao menos um serviço ativo. A home usa essa lista
para o filtro manual de cidade, envia `cidade` e `estado` como parâmetros
dedicados e mantém "Todo o Brasil" como padrão. A cidade de um resultado nunca
deve ser tratada como localização detectada da cliente.

### 8.2 Agenda do negócio

O dono acompanha a agenda geral do negócio.

O profissional acompanha sua própria agenda e altera somente os agendamentos
permitidos.

### 8.3 Onboarding e publicação do negócio

A publicação é automática quando o negócio reúne os dois requisitos:

1. dados mínimos de descoberta, com especialidade, WhatsApp, cidade e estado;
2. pelo menos um serviço ativo.

O campo canônico do contato público é `whatsapp`. O alias
`whatsapp_negocio` existe apenas para compatibilidade de leitura e nunca deve
prevalecer quando os dois campos são enviados em uma atualização.

A descrição melhora a confiança e a qualidade do perfil, mas é opcional e não
impede a publicação. A Saúde do SaaS continua sinalizando sua ausência como
recomendação para acompanhamento administrativo.

A configuração de agenda é recomendada para receber agendamentos, mas não é
requisito de publicação. Salvar o perfil, criar, ativar, desativar ou remover
um serviço deve recalcular a publicação. Se o perfil ficar incompleto ou o
negócio perder todos os serviços ativos, ele sai do catálogo público.

### 8.4 Assinaturas e pagamentos

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

O plano Grátis é uma oferta comercial ativa, sem cobrança e sem cartão, e deve
entregar valor real antes do upgrade. Em aquisição, termos como `grátis` e
`gratuito` não são tráfego irrelevante por definição; a qualidade deve ser
avaliada pela criação e ativação do negócio, separadamente da conversão para um
plano pago. A especificação comercial completa está em `docs/planos.md`.

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
database/migrations/015_planos_limites.sql
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

O frontend oficial do Agenda Fashion utiliza React com Vite.

Estrutura principal:

```text
frontend/
|-- src/
|   |-- api/
|   |-- auth/
|   |-- components/
|   |-- layouts/
|   |-- pages/
|   `-- utils/
`-- public/
```

O build de producao e gerado em:

```text
agendamento-nails/react-app
```

O backend Express serve esse build diretamente na raiz do dominio:

```text
https://app.agendafashion.com.br/
https://app.agendafashion.com.br/entrar
https://app.agendafashion.com.br/painel
```

As antigas pastas `agendamento-nails/html`, `agendamento-nails/css`
e `agendamento-nails/js` foram removidas depois da consolidacao do
frontend em React.

Regras:

- manter a identidade rosa, feminina e delicada do Agenda Fashion;
- preservar o emoji de unha pintada como elemento da marca;
- usar componentes React reutilizaveis;
- centralizar chamadas HTTP no cliente da API;
- tratar carregamento, erro, estado vazio e sessao expirada;
- nao duplicar regras de negocio que pertencem ao backend;
- manter as paginas responsivas e acessiveis;
- preservar testes de regressao das jornadas principais.
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
13. Não publicar mudanças com lint, build ou testes obrigatórios falhando.
14. Toda correção de falha relevante deve incluir teste de regressão quando
    tecnicamente aplicável.
15. Após o deploy, executar smoke tests e acompanhar healthcheck, logs e
    integrações afetadas.

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

1. manter o CI verde e exigir os checks antes de integrar mudanças na `main`;
2. proteger a branch `main` contra integrações sem validação;
3. adotar Content Security Policy gradualmente, sem quebrar Google, Meta ou
   Cloudinary;
4. concluir a remoção da compatibilidade com JWT em `localStorage` depois que
   as sessões antigas expirarem;
5. tornar os workers resistentes a reinícios e múltiplas instâncias;
6. ampliar observabilidade de erros, webhooks, notificações e integrações;
7. mover SQL restante dos services para repositories quando esses módulos
   forem alterados;
8. avaliar TypeScript gradualmente, sem reescrever o sistema inteiro.

---

## Objetivo final

O Agenda Fashion deve se tornar referência no Brasil para agendamento de
beleza e estética, permanecendo simples para desenvolver, seguro para os
negócios e confiável para as clientes.

A arquitetura existe para manter:

- separação de responsabilidades;
- isolamento entre negócios;
- consistência de dados;
- deploys previsíveis;
- evolução dos planos e pagamentos;
- testes que protegem os fluxos críticos;
- velocidade para chegar à aquisição de clientes.
