# Alfa 0.6 — mapa principal e waypoints (17/11/2026)

- Nova renderização isométrica 2.5D em Canvas: terreno, água, casas, indústrias, campos, florestas, vias e veículos.
- Interface principal sem painéis laterais; botão **Gestão** abre os comandos existentes.
- Modo GPS com mapa raster do OpenStreetMap, posição autorizada, precisão aproximada, waypoints reais a partir de uma consulta voluntária à Overpass, seleção por toque e linha até o ponto selecionado.
- Gestos de arrastar e pinça para zoom, botão de recentralização e painel de campo recolhido na parte inferior da tela.
- Novo módulo `public/isometric.js`, cache PWA atualizado e testes de projeção (`tests/scene-v6.js`).
- Mantidos protocolos, economia, expedições e salvamentos anteriores.
- 19 suítes automatizadas aprovadas e verificação visual offline da interface em Chromium.
- Pendências: testes de GPS ao ar livre, OSM ao vivo e navegação navegador-servidor real.

# Alfa 0.5 — progresso e experiência de jogo

- Contratos e operações: nova ação atômica de preparar carga e iniciar rota (inventário validado antes do desconto).
- Caminhadas: acontecimento no final com duas escolhas e resultado na economia da cooperativa; apenas o jogador participante recebe o identificador privado.
- Interface: próximo passo acionável, rótulos mais claros para entregas e painel GPS de decisão responsivo.
- Economia: pausa quando todos estão em GPS para evitar que o mundo avance durante caminhadas reais.
- Segurança: códigos de salas aleatórios com oito caracteres; sem sala padrão pública.
- Windows: launcher que instala runtime portátil apenas se necessário, com hash SHA-256 oficial.
- Deploy: Dockerfile, health check e railway.json; requer conexão do serviço e volume para persistir.
- Qualidade: 18 suítes automatizadas e inspeção visual offline em Chromium desktop/celular.

---

# Histórico de desenvolvimento — Rotas Vivas

## Alfa 0.4 (17/11/2026) — GPS como parte essencial do jogo

### Jogabilidade de campo
- Novo sistema de **expedições físicas com três levantamentos em setores distintos**, validação de GPS e intervalos de deslocamento, com centros de quadrículas separados por pelo menos 330 m, limite diário e continuidade após reconexão.
- Três temas de campo, três melhorias permanentes exclusivas das caminhadas e três ações recorrentes de mobilização da cooperativa.
- Combos de variedade de modalidades: explorar natureza, infraestrutura e comércio recompensa a equipe.
- Busca opcional de parques, jardins, bibliotecas, mercados, centros comunitários e mirantes usando OSM/Overpass; a visita exige proximidade estimada e não gera recompensa repetida para a equipe.
- **Atlas Vivo** cooperativo de seis categorias com prêmios ao explorar três e seis tipos distintos.
- Efeitos por categoria de POI: regeneração, pesquisa, abastecimento, prosperidade e cartografia. Assim, não são apenas check-ins monetários.
- Privacidade: a equipe recebe progresso e estatísticas, mas não quadrículas GPS ou POIs exatos dos outros jogadores.
- Corrigida validação de visitas perto da divisa de quadrículas: agora usamos a distância mínima do local à área aproximada do setor, não apenas centro a centro.

### Operação e apresentação
- Mapa do PC redesenhado para mostrar áreas produtivas, oficinas, obras, progresso dos projetos, caminhões e interações contextuais.
- Modo GPS adaptado a desktop e celular, com painel de expedição, bússola temporária, estimativas e catálogo de POIs.
- Novos testes de concorrência real com quatro clientes WebSocket disputando o mesmo local e registrando operações independentes.
- Migração automática do estado antigo para incluir o sistema de campo e o Atlas Vivo sem perder o progresso anterior.
- 15 grupos de testes automatizados e inspeção visual em Chromium **offline com dados simulados**; sem observação GPS real.

### Limitações e riscos ainda abertos
- O provedor de mapas não estava disponível ao processo de testes externos; importação OSM validada com redes sintéticas, não com dados ao vivo.
- GPS ainda não foi validado fisicamente caminhando nem em celular publicado por HTTPS. A posição recebida do navegador pode ser falsificada.
- Os setores são aproximados, não representam distância real caminhável (obstáculos/rios). Não há localização em segundo plano.
- Código ainda é protótipo local, não uma aplicação de produção com autenticação robusta e antiabuso para servidores públicos.

## Alfa 0.3 (17/11/2026)
- Cidades com consumo, escassez, prosperidade e preços dinâmicos, contratos com prazos e NPCs fornecedores.
- Missões recorrentes, objetivos coletivos, automação, melhorias de frota, pings e chat.
- Importador OSM manual e opcional com vias privadas e exclusivas de pedestres excluídas; malha fictícia como fallback.
- Persistência atômica, migração e testes de segurança e integração.

## Alfa 0.2
- Rotas por Dijkstra em malha fictícia, três projetos regionais permanentes, automação, eventos e salvamentos da Alfa 0.1.

## Alfa 0.1
- Protótipo inicial: sala de quatro jogadores, recursos, caminhões, fábricas, contratos, GPS por quadrante e cartografia OSM.
