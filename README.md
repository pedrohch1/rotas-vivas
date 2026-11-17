# Rotas Vivas — Alfa 0.6 (mundo isométrico + mapa GPS)

**Jogo cooperativo experimental para até quatro amigos:** logística, economia e construção em um cenário com cartografia real, conectado a aventuras físicas pelo GPS do celular. Esta pasta é uma **versão experimental para testes**, não uma versão comercial. Testes GPS físicos e infraestrutura de produção ainda exigem validação.

## Ideia central

No PC, os amigos dividem caminhões, caixa, estoque, fábricas, contratos, cidades e projetos. No celular, quando estão caminhando por espaços públicos acessíveis, fazem levantamentos por setores e descobrem locais públicos reais. **As expedições físicas são a fonte exclusiva dos sinais de campo**, usados em melhorias permanentes para a equipe e ações econômicas especiais. As missões e obras virtuais recebem efeitos dessas descobertas. Não há combate nem corrida por pontos contra outras pessoas.

### Operações principais

- **Transporte:** caminhões podem ser dirigidos ou enviados por rotas. A ponte concluída encurta a malha virtual; há um importador opcional e experimental de ruas OSM com sentidos únicos.
- **Indústria:** madeira, minério e sucata viram tábuas e metal; há fábricas e automação com controle manual.
- **Economia:** três cidades com demandas, estoques, consumo, concorrência NPC simplificada, escassez, preço variável e prosperidade. Contratos possuem prazos; o tempo de simulação para quando a sala está vazia.
- **Cooperação:** quatro jogadores, chat, pings e contratos/projetos compartilhados. Metas coletivas recorrentes sem campanha linear obrigatória.
- **Mundo persistente:** dados locais em `data/`, salvamento atômico, reconexão e migração de mundos anteriores.

## GPS de campo — novo na Alfa 0.4

### Expedições por setores

Cada jogador pode iniciar uma das três modalidades — **Cartografia Viva**, **Pulso Comercial** ou **Observatório Verde** — e registrar três pontos em setores geográficos diferentes caminhando na realidade. A validação exige pelo menos 330 m entre centros das quadrículas (para evitar completar etapas cruzando pequenas bordas de setores), 65 s entre registros, precisão do GPS de até 85 m, localização recente e velocidade reportada compatível com caminhada; há limite de três expedições concluídas por dia UTC e 2 h para cada expedição. **São regras de jogo, não garantias de distância percorrida nem medidas antifraude.**

As conquistas financiam três melhorias permanentes:

| Projeto de campo | Custo de sinais | Benefício |
|---|---:|---|
| Rede de cartografia comunitária | 2 | Piloto automático 15% mais rápido |
| Feira cooperativa itinerante | 3 | Contratos concluídos rendem 10% mais |
| Observatório de recursos | 4 | Recuperação de recursos +3 por ciclo |

Equipes também podem gastar sinais para desbloquear contratos especiais, restaurar fontes e melhorar a prosperidade da cidade mais necessitada. Fazer os três tipos de levantamento completa um combo coletivo. Expedições remotas seguem disponíveis para pesquisa e projetos básicos, mas **não fornecem sinais de campo**.

### Locais reais e Atlas Vivo

Ao clicar para buscar, o navegador consulta uma API pública Overpass/OSM em torno da posição **arredondada** do usuário. O resultado pode oferecer parques, jardins públicos, bibliotecas, mercados públicos, centros comunitários e mirantes mapeados. O jogador pode caminhar até um ponto seguro e acessível e registrar a descoberta, desde que esteja próximo dele. Há limite de duas descobertas de POI por dia e cada lugar dá recompensa apenas uma vez por sala. O servidor valida a plausibilidade, mas **não verifica criptograficamente a origem GPS nem confirma que o local retornado é genuíno**.

Cada tipo de lugar contribui de modo diferente:

- Parque e jardim: ajudam a regenerar recursos naturais virtuais.
- Biblioteca: gera pesquisa adicional.
- Mercado público: abastece uma carência da cidade virtual com maior escassez.
- Centro comunitário: melhora a prosperidade de uma cidade virtual.
- Mirante: gera informações cartográficas e créditos extras.

O **Atlas Vivo** acompanha as seis categorias distintas descobertas pelos quatro amigos e dá bônus coletivos ao completar três e seis categorias. O efeito não exige divulgar o nome ou endereço do lugar visitado à equipe; o painel mostra somente a categoria e estatísticas gerais.

### Segurança, limites e dados

- **Não use enquanto dirige, pedala, atravessa a rua ou está distraído.** Não há locais obrigatórios em propriedades privadas, estradas, áreas restritas ou ambientes perigosos. Um ponto mapeado como público não garante acesso ou segurança no horário da visita.
- A localização precisa fica no aparelho. A operação envia ao servidor o índice de uma **quadrícula aproximada de ~200 m**, precisão/idade/velocidade reportadas e, nas visitas de pontos, metadados aproximados do POI.
- Durante uma expedição ativa, as **últimas quadrículas e horários das etapas ficam no arquivo de salvamento** para permitir retomar. Outro jogador recebe somente o progresso e o tipo de levantamento, não as quadrículas privadas. O histórico de setores e POIs é armazenado como **hashes**. O último setor aproximado de visita a POI é temporariamente mantido no estado privado do jogador para evitar repetições. Não declaremos, portanto, ausência total de dados geográficos no servidor.
- A busca externa de POIs é **opcional** e envia uma região de pesquisa arredondada e metadados de conexão (como IP) ao serviço externo. Consulte a política de privacidade do operador da API. Os tiles do mapa OSM também geram acessos externos normais. Não fazemos busca de POIs em segundo plano.
- O GPS web depende de HTTPS (ou origem segura como localhost), permissão concedida e sensor disponível. O navegador pode suspender a localização em segundo plano; o protótipo não implementa rastreamento oculto.
- Ainda é possível **falsificar dados GPS em um cliente alterado**; a versão não deve conceder prêmios de valor real ou acesso público irrestrito.
- A área de jogo e seus prédios, recursos e obras são **fictícios** mesmo quando sobrepostos a ruas reais. Não representam direitos de acesso à propriedade ou contratos reais.

## Estrutura

| Caminho | Função |
|---|---|
| `server.js` | Salas, WebSocket, operações, economia e persistência |
| `field.js` | Expedições físicas, POIs, Atlas Vivo, sinais e benefícios |
| `economy.js` | Demanda, estoque, preço, NPCs e contratos |
| `missions.js` | Missões temáticas geradas pelas descobertas |
| `roads.js`, `osmroads.js` | Rotas fictícias e malha viária OSM opcional |
| `progression.js` | Objetivos cooperativos recorrentes |
| `public/` | Interface PC/celular, PWA, mapa, GPS e Atlas |
| `scripts/import-osm.js` | Importador manual OPCIONAL; não dispara automaticamente |
| `tests/` | Testes unitários, browser offline, integração e concorrência |
| `data/` | Salvos locais — não publicar nem versionar |

## Qualidade e verificações

A suíte `npm test` inclui 19 grupos automatizados: expedições GPS com diferentes dias/velocidades/precisão; POIs e atlas; efeitos econômicos e salvamento; WebSockets, quatro pessoas simultâneas; estruturas, projetos, rotas, segurança de entradas, migração e persistência. A interface foi inspecionada em Chromium com uma **página offline carregada com WebSocket e dados simulados** para tamanhos PC e celular; não equivale a uma partida end-to-end real em um navegador conectado ao servidor. O browser do ambiente bloqueia a navegação para o servidor local. O servidor e o protocolo WebSocket foram testados separadamente em integração real.

**Pendências antes de distribuir:** testar GPS real em caminhadas seguras, validar o Overpass e a importação de OSM com dados externos, realizar testes reais no celular com HTTPS, verificar o comportamento em rede ruim e autenticação mais forte para sala pública. Evitar depender exclusivamente de servidores OSM públicos para volume alto; respeitar licenças, atribuição e políticas de uso.

## Desenvolvimento e futura entrega

Esta versão pode ser executada localmente com Node.js 22+ e mantém suporte ao inicializador provisório do Windows e ao Docker. Quando o jogo for aprovado, o objetivo é preparar um **instalador/launcher assistido**, minimizando etapas manuais e incluindo backup, verificações prévias e publicação opcional. A implantação em serviços externos e concessões de acesso exigirão consentimento específico do usuário. Não realizar implantação pública nem abrir portas automaticamente.

## Novidades da Alfa 0.5

- **Objetivo guiado:** a faixa verde recomenda a próxima ação e oferece um botão direto para executá-la.
- **Entregas simplificadas:** em contratos e missões, a ação “Preparar e partir” carrega a quantidade necessária na base e traça a rota até a cidade, sem criar materiais nem teleportar caminhões. Se faltar estoque ou espaço, explica o motivo.
- **Decisões de campo:** depois de completar uma caminhada, surge uma escolha privada que pode recuperar metal, pesquisas, crédito, prosperidade ou fontes de recursos. A decisão é persistida; escolher duas vezes não concede bônus duplo.
- **Modo GPS sem punição:** quando todos os participantes online estão em exploração GPS, o relógio econômico do mundo fica pausado. Se algum amigo continuar no PC, a produção e a economia seguem.
- **Salas individuais:** nenhuma sala padrão é preenchida automaticamente em novos aparelhos; clique em “Criar sala” para obter um código aleatório de oito caracteres.
- **Inicialização simples:** no Windows 10/11 x64, execute `JOGAR.bat`. Ele usa um Node.js já instalado se compatível ou baixa uma cópia portátil oficial com verificação de hash. Não requer permissão de administrador. Conexão com a Internet é necessária na primeira execução caso o Node.js não esteja disponível.
- **Servidor opcional:** arquivos de Docker/Railway incluídos. O deploy exige serviço e volume persistente (consulte `DEPLOY_RAILWAY.md`).

### Limites que ainda precisam de validação

O navegador de teste neste ambiente bloqueou conexão HTTP local. A interface foi testada em Chromium **com WebSocket simulado**, e o servidor foi testado separadamente com WebSockets reais. Isso **não** substitui uma partida completa no navegador real. GPS na rua e importação live de mapas/POIs também não foram verificados fisicamente.


## Novidades da Alfa 0.6 — mapa imersivo

- **PC:** o cenário 2.5D isométrico preenche a área principal e representa rios, casas, indústrias, árvores, plantios, estradas, construções e caminhões. O desenho é gerado em tempo real, não uma captura de tela nem imagem estática.
- **Gestão sob demanda:** os painéis laterais antigos ficam recolhidos. Use o botão **Gestão** quando quiser ver contratos, inventário, fábricas e as decisões econômicas. No celular, o mesmo botão abre as opções em tela inteira.
- **Celular GPS:** a câmera do mapa usa tiles cartográficos reais do OpenStreetMap, quando a internet está disponível. Sua posição é indicada por um círculo azul com indicador aproximado de precisão, mediante permissão explícita.
- **Waypoints:** em **Encontrar lugares**, uma busca voluntária retorna pontos públicos mapeados na região. Eles aparecem como marcadores tocáveis com nome, tipo e distância até você; selecionando um deles, o jogo mostra uma linha-guia e permite tentar registrar a visita. A validação de aproximação ocorre no servidor, não basta tocar de longe.
- **Navegação:** arrastar o mapa, pinça para zoom no celular, botões de zoom, recentralização e retomada da posição GPS. A busca de lugares não ocorre automaticamente e não é usada como rastreamento em segundo plano.
- **Atribuição:** a cartografia mantém os créditos do OpenStreetMap. O cenário isométrico e suas construções são uma simulação fictícia, não uma recriação fiel dos edifícios da cidade.
- **Compatibilidade:** mantém salvamentos e economia das versões anteriores.

### Validação específica da Alfa 0.6

- Projeção isométrica e seu inverso testados numericamente; cena com diversas instalações e veículos renderizada em Canvas 2D.
- 19 suítes de lógica, segurança, concorrência e integração aprovadas; testes repetidos após mudanças na interface.
- Inspeção em Chromium real **com HTML/estado simulado e sem conexão com servidor**, nos formatos desktop e celular, incluindo modo GPS com **lugares simulados para visualização**. O navegador do ambiente bloqueia abrir o serviço HTTP local.
- **Ainda não validado:** GPS físico na rua, carregamento real de tiles OSM/Overpass a partir do navegador de testes, partida ponta a ponta no navegador conectado ao servidor, experiência mobile em redes instáveis. Estas partes precisam de teste em aparelho e HTTPS; não declare a funcionalidade de campo como homologada.
