# Política de Segurança

## Versão suportada

O Agenda Fashion mantém correções de segurança na versão atualmente publicada a partir da branch `main`. Branches antigas e builds locais não são versões suportadas do produto.

## Como reportar uma vulnerabilidade

Não abra issue pública com credenciais, dados pessoais, payloads sensíveis, passos de exploração ou evidência que permita reproduzir uma vulnerabilidade em produção.

Prefira o recurso privado **Report a vulnerability / Security Advisories** do GitHub quando ele estiver disponível no repositório. Se esse canal não estiver disponível, use um canal privado já estabelecido com o mantenedor antes de compartilhar detalhes técnicos.

Inclua somente o necessário para reprodução segura:

- componente/rota afetada;
- impacto observado;
- pré-condições;
- passos mínimos de reprodução;
- comportamento esperado e observado;
- evidência sem segredos ou dados pessoais.

## Escopo prioritário

Relatos envolvendo autenticação, autorização, isolamento entre negócios, agendamentos, pagamentos, webhooks, exposição de dados pessoais, uploads ou execução de código recebem prioridade máxima.

## Divulgação

Não publique detalhes de exploração antes de existir correção e tempo razoável para atualização do ambiente afetado. Segredos encontrados acidentalmente devem ser tratados como comprometidos e rotacionados; não os copie para issues, PRs ou logs.
