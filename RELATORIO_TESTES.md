# Relatório de validação — Rotas Vivas Alfa 0.5

## Resultado automatizado

**18 suítes aprovadas**, em Node.js 22, executadas tanto no diretório de desenvolvimento quanto (posteriormente) a partir de uma extração limpa do pacote ZIP.

1. Decisões após caminhadas, recompensas únicas, validações de escolha e sigilo por sessão.
2. Entregas guiadas: preparo de carga, rota, chegada, recompensa, concorrência básica, falha atômica e persistência.
3. Pausa do relógio econômico quando todos usam GPS e retomada quando alguém volta ao PC.
4. Expedições por setores, distância, relógio, limites e migração.
5. Pontos públicos, distância, repetição e limites.
6. Atlas Vivo, efeitos temáticos, marcos 3/6 e privacidade.
7. Expedição por três setores com WebSockets e reinícios de servidor.
8. Operações concorrentes de quatro participantes.
9. Grafo de rotas e ponte.
10. Importação e roteamento com dados OSM artificiais de teste.
11. Economia e contratos.
12. Progressão coletiva.
13. Renderização da interface simulada (DOM/canvas).
14. Fluxo HTTP, salas, quatro jogadores, fábricas, descoberta e rotas.
15. Conclusão de projeto regional.
16. Missões temáticas, entrega e persistência.
17. Robustez do protocolo WebSocket, entradas inválidas e salvamento corrompido.
18. Estoque simultâneo, chat e marcações.

## Verificação no Chromium

A interface foi renderizada em Chromium headless para telas 1480x900 (PC) e 390x844 (celular), com **estado de jogo e WebSocket simulados**. Foram testados os painéis, as escolhas após o GPS e as ações enviadas pelos botões sem erros JavaScript. Capturas de tela foram inspecionadas.

**Limitação do ambiente:** Chromium bloqueia a navegação ao servidor local por política administrativa (`ERR_BLOCKED_BY_ADMINISTRATOR`). Por isso, não foi possível completar uma partida fim a fim dentro do navegador real. Em contrapartida, as chamadas HTTP/WebSocket foram exercitadas separadamente nos testes de integração Node.js.

## Pendente de testes físicos

- Caminhada com GPS real e condições variáveis de sinal, céu aberto, precisão e acesso aos locais.
- Serviços externos OpenStreetMap / Overpass em tempo real, incluindo limites de consulta e disponibilidade.
- Hospedagem pública HTTPS, volumes persistentes e quatro smartphones/PCs em redes diferentes.
- Funcionamento do iniciador Windows em uma máquina Windows real (o script foi revisado, não executado aqui).
- Testes de segurança de produção e antifraude GPS avançado.

Não afirmar que esses itens passaram até serem verificados.
