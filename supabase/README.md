# Cadastro de karts — 09/10/2026

## Balanceamento posterior

O catálogo completo de 164 karts foi rebalanceado após esse cadastro. Os preços e atributos abaixo documentam a inserção inicial; os valores atuais, backups, validações e scripts de reversão estão em [balanceamento/README.md](balanceamento/README.md).

O arquivo `20261009-adicionar-karts.sql` contém os 15 cadastros solicitados. O JSON equivalente está em `karts-20261009.json`.

Os 15 registros foram inseridos em 09/10/2026 pelo SQL Editor do painel autenticado do projeto PokéKart. A conferência posterior pela API confirmou todos os campos iguais ao JSON preparado, `activated = true` nos 15 novos registros e os 149 karts anteriores preservados. O catálogo passou a ter 164 karts. Nenhuma política de segurança foi alterada.

O script SQL foi mantido para referência e reutilização. Ele usa uma transação e `ON CONFLICT (id) DO NOTHING`: não modifica karts existentes nem duplica IDs se for executado novamente. A consulta final permite conferir os 15 registros.

Os modelos GLB, imagens PNG e GIFs foram conferidos localmente. A publicação desses arquivos no site ainda não foi confirmada. O script cria os karts com `activated = true`, disponibilizando-os no catálogo e na rotação diária; publique os arquivos correspondentes junto com o cadastro.

O modelo foi renomeado pelo usuário para `models/banette.glb`. Banette mantém o ID `bannete` no Supabase para preservar compras, seleções e referências já salvas. Lobby, garagem, corrida e HUB convertem esse ID para o arquivo correto ao carregar o modelo. O nome exibido continua `Banette`, a imagem é `img/banette.png` e o GIF é `pokemons/poke_354.gif`.

Os atributos são propostas iniciais baseadas nas faixas do catálogo atual, com compensações entre aceleração, velocidade, controle e drift. Deoxys, Latios e Latias seguem o preço especial de 9.999.999 já usado por lendários existentes; esse preço não cria uma nova forma de desbloqueio.

| Kart | ID | Pokédex | Preço em moedas |
| --- | --- | ---: | ---: |
| Dusknoir | dusknoir | 477 | 3.200 |
| Gallade | gallade | 475 | 3.400 |
| Toxicroak | toxicroak | 454 | 3.200 |
| Probopass | probopass | 476 | 2.800 |
| Glaceon | glaceon | 471 | 3.200 |
| Leafeon | leafeon | 470 | 3.200 |
| Garchomp | garchomp | 445 | 3.800 |
| Deoxys | deoxys | 386 | 9.999.999 |
| Latios | latios | 381 | 9.999.999 |
| Latias | latias | 380 | 9.999.999 |
| Torkoal | torkoal | 324 | 2.400 |
| Roselia | roselia | 315 | 1.800 |
| Cacnea | cacnea | 331 | 1.200 |
| Banette | bannete | 354 | 2.800 |
| Altaria | altaria | 334 | 3.200 |
