# Publicação na Railway (Alfa 0.6)

O projeto contém `Dockerfile`, `railway.json` e endpoint `GET /health` para publicação.
Ele **não está automaticamente publicado** apenas porque a pasta existe.

Requisitos para persistência dos mundos:
- Executar **uma instância** do servidor (o salvamento atual utiliza arquivos JSON locais; não usa banco compartilhado).
- Anexar um volume persistente ao serviço no caminho `/app/data`.
- O Dockerfile já usa `/app/data`; `DATA_DIR=/app/data` pode ser definido explicitamente.
- Expor um domínio HTTPS no serviço. A Railway fornece `PORT` em tempo de execução; o servidor lê `process.env.PORT`.

Sem volume, os mundos podem desaparecer após reinicializações e redeploys. Sem HTTPS, GPS no celular não funcionará no navegador fora do localhost.

A aplicação ainda é **experimental**, com salas identificadas por códigos de convite. Não é adequada para exposição pública irrestrita ou recompensas de valor real: a comprovação de GPS é plausível, mas pode ser falsificada por clientes modificados. Limite o compartilhamento do endereço do jogo ao grupo de amigos.

Mapas: os tiles públicos do OpenStreetMap e a consulta opcional de POIs via Overpass exigem rede e respeitar os limites de uso dos provedores. Para escala real, configurar provedor de tiles apropriado e cache.

## Situação da tentativa de 17/11/2026

Foi verificada uma sessão Railway autenticada. A conta não tinha projetos de
Railway e o único repositório visível no GitHub conectado era outro projeto
(`controle-estoque`), que **não foi alterado**. Sem um repositório dedicado ao
Rotas Vivas, não foi feita uma publicação de outro aplicativo sob o nome do
jogo. Um repositório novo dedicado (por exemplo `pedrohch1/rotas-vivas`) é o
pré-requisito para conectar a fonte ao serviço e realizar um deploy íntegro.
