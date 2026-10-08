# Ícones temáticos do PokéKart

Os arquivos em `tematicos/` são PNGs transparentes de 256 × 256, com o desenho centralizado em uma área de até 224 × 224. A coleção reúne **31 recortes das duas imagens fornecidas** e **13 desenhos novos**. `tematicos/catalogo.png` mostra a coleção completa.

Os ícones anteriores da pasta `icones/` continuam disponíveis. Insígnias em `img/` e stickers em `emojis/` também são reutilizados quando correspondem à função.

## Aplicação

`poke-icons.js` e `poke-icons.css` são compartilhados por lobby, garagem, criador de pistas, corrida, hub e moderação. O script converte símbolos de apresentação tanto no HTML inicial quanto nos painéis criados dinamicamente. Mantém o texto original para os leitores de texto usados pelo código e protege entradas de formulário e nomes de jogadores. Para preservar outro conteúdo textual, use `data-poke-icons="off"` no contêiner.

As 18 habilidades da corrida usam imagens diretamente. Os ícones SVG dos cards de modo e seus botões foram substituídos por PNGs temáticos. Setas de direção, fechar, reproduzir e pausar permanecem como comandos convencionais.

## Fontes e reprodução

- `tematicos/sources.json`: coordenadas dos 31 recortes e nomes das imagens originais.
- `prepare-icons.py`: recorta as duas imagens originais sem redesenhá-las.
- `generated-sources.json`: arquivos originais produzidos pelo gerador integrado.
- `gerados/`: cópias dos 13 desenhos originais, com transparência preservada.
- `prepare-generated-icons.py`: padroniza os desenhos novos para uso na interface e atualiza o catálogo.

Os scripts de preparação usam Pillow. As imagens utilizadas pelo jogo já estão prontas; eles não são necessários para executar o projeto.

## Prompts dos desenhos novos

Todos foram gerados com a ferramenta integrada **imagegen**, sem CLI/API externo. O padrão foi: um único ícone isolado, ilustração cartoon colorida e brilhante, contornos escuros limpos, silhueta reconhecível em tamanho pequeno, objeto centralizado com margem, fundo realmente transparente, sem texto, números, pessoas ou marca d'água. A paleta acompanha os ícones fornecidos: vermelho, branco, ciano e dourado, com emblema de bola de captura vermelha e branca.

| Arquivo | Pedido específico usado no prompt |
| --- | --- |
| `perfil.png` | Single UI icon of a red and white baseball cap, with a small round red-white ball badge on the front. No person, just the cap. |
| `bloqueio.png` | A gold padlock with silver shackle and a red-white capture-ball seal. |
| `calendario.png` | A daily reward calendar with a red top, white page, gold checkmark and a red-white capture-ball seal. |
| `conversa.png` | Two chat bubbles colored cyan and white/red, with a red-white capture-ball seal. |
| `revive.png` | A faceted golden healing crystal diamond with a small white glow and red-white capture-ball charm, representing a revive item. |
| `ovo-sorte.png` | A creamy white egg with pale blue spots and a small gold lucky star charm. |
| `cidade.png` | A compact cluster of three cheerful blue/red city buildings, with a red-white capture-ball emblem on the central building. |
| `cavar.png` | A stout cartoon pickaxe over two earth rocks with a small red-white capture-ball emblem on the handle. |
| `lodo.png` | A glossy purple poisonous sludge droplet with tiny purple bubbles and a red-white capture-ball charm. |
| `lama.png` | A splashing clump of brown mud and small earth rocks with a red-white capture-ball charm. |
| `doce-raro.png` | A bright blue wrapped candy with gold twist ends and a small red-white capture-ball seal. |
| `celular.png` | A smartphone with a glossy red-and-white casing, dark cyan screen and round red-white ball home button. |
| `mover-mapa.png` | Four directional cyan and gold arrows pointing outward around a round red-and-white ball at the center. |

## Verificação

Os recortes e os desenhos novos foram inspecionados visualmente. A interface foi verificada no Chrome em tamanhos de desktop e mobile simulado, incluindo conversão de conteúdo dinâmico, preservação de textos e cliques. O criador de pistas foi testado com seu código real: seleção de ferramentas, bioma, circuito e abertura do modal de salvar. O início da corrida foi verificado em desktop, mobile simulado, pista personalizada e multiplayer com transporte de rede simulado.
