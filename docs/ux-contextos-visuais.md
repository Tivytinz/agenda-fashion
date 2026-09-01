# Contextos visuais do Agenda Fashion

Este documento registra a separação durável entre a experiência de produto e o console administrativo interno.

## Área profissional e pública

A experiência usada por clientes, profissionais e negócios deve preservar a identidade visual do Agenda Fashion:

- rosa como cor principal de marca e de ações primárias;
- branco e grafite suave como base de leitura;
- fundos rosados leves e componentes arredondados quando contribuírem para acolhimento e clareza;
- linguagem próxima do universo de beleza, sem sacrificar acessibilidade ou eficiência;
- prioridade para mobile e Safari/WebKit.

Rotas como `/painel`, `/painel/agenda`, `/painel/servicos`, `/painel/horarios`, `/painel/profissionais`, `/painel/negocio`, `/painel/assinatura` e as rotas equivalentes do profissional fazem parte desse contexto.

## Administrativo interno

As rotas `/admin/*` e a conta quando acessada por um administrador são um console operacional, não uma superfície de produto para clientes ou profissionais.

O administrativo deve priorizar:

- superfícies neutras em branco, cinza e grafite;
- maior densidade de informação;
- tabelas, filtros e métricas com leitura rápida;
- bordas e raios mais discretos;
- sombras mínimas;
- cores semânticas para estados: verde para saudável/sucesso, âmbar para atenção, vermelho para erro/risco e azul/cinza para informação;
- uso discreto da marca Agenda Fashion, sem aplicar o rosa como decoração dominante.

A navegação e a lógica podem continuar compartilhando componentes com a área profissional, mas o contexto visual deve ser explicitamente separado na raiz do layout para evitar vazamento de estilos.

## Horários profissionais

A configuração de horários pertence ao produto profissional e deve continuar com identidade do Agenda Fashion. O editor deve:

- tornar dias ativos e fechados fáceis de distinguir;
- manter horários de início e fim sempre legíveis;
- nunca comprimir os campos de pausa a ponto de esconder o valor `HH:MM`;
- quebrar a composição em blocos no mobile em vez de criar scroll horizontal;
- deixar ajustes avançados visualmente secundários;
- manter a ação de salvar sempre acessível sem cobrir os controles essenciais.

Mudanças visuais nessa área não alteram as regras de disponibilidade do backend. A disponibilidade real continua sendo validada pelas regras canônicas da agenda.
