# Admin Wave 5 — Evidência operacional RF41/RNF02

A preparação original usava benchmarks em QA. Essa abordagem foi retirada:
a evidência de ADM-043 deve vir de tráfego e registros reais de produção.
Os testes de migration, autorização e imutabilidade continuam verificando o
contrato de RF41, mas não substituem a observação do p95 sob carga normal.

## Execução

1. Delimitar o intervalo UTC de observação e identificar os deployments reais
   que serviram requisições no intervalo. Registrar mudanças de versão e não
   unir indiscriminadamente medições de builds distintos.
2. Extrair somente os eventos HTTP reais das rotas críticas, normalizando IDs
   de caminho e descartando query strings, IPs, tokens e identificadores.
3. Para cada rota, método, build e resultado HTTP, registrar quantidade,
   distribuição temporal e p95; distinguir erros e tempos sem resposta.
4. Consultar agregados reais de `admin_auditoria_eventos` e
   `admin_auditoria_revisoes` com o perfil `READ ONLY` descrito na Wave 6.
   Confirmar integridade por evidência autorizada sem exportar linhas pessoais.
5. Confrontar amostras, concorrência, volume persistido, CPU e memória com a
   operação normal. Se a rota não recebeu tráfego, declarar ausência de
   evidência. Não gerar requisições nem registros para preencher a lacuna.

O procedimento e o estado atual estão em
[admin-wave-6-rf41-qa-operacional.md](./admin-wave-6-rf41-qa-operacional.md).
O limite é p95 ≤ 2.000 ms para APIs críticas. **ADM-043 permanece Não
coberto (41/43)** até medição representativa de produção e verificação da
integridade da trilha. ADM-030 permanece independente.
