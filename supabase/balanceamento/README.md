# Balanceamento base — 1.9.8

## Critério

164 karts em cinco perfis competitivos. Karts do mesmo perfil têm atributos iguais, independentemente de preço, raridade ou exclusividade. A escolha do Pokémon é estética dentro do perfil. Não existe um perfil superior em todos os sete atributos.

| Perfil | Vantagem | Compensação | Exemplos |
|---|---|---|---|
| Velocidade | Retas e velocidade sustentada | Menor aceleração, curvas mais abertas e nitro mais curto | Charizard, Pidgeot, Garchomp |
| Arrancada | Saída e recuperação após impactos; nitro duradouro | Menor velocidade sustentada | Pikachu, Jolteon, Machamp |
| Curvas | Direção mais ágil e maior aderência | Menor velocidade final e nitro mais curto | Venusaur, Butterfree, Gallade |
| Drift | Carga rápida e maior controle da derrapagem | Menor velocidade final e recuperação mais lenta | Gengar, Banette, Glaceon |
| Equilibrado | Versatilidade, sem extremos | Não lidera os atributos especializados | Blastoise, Onix, Mewtwo |

Os sete valores de cada kart estão em [catalogo-comparativo.md](catalogo-comparativo.md). Freio (30), atrito (10), ré (-10), multiplicador de turbo (1,4) e bônus das Master Balls permanecem comuns. O multiplicador de dificuldade dos bots e as habilidades dos líderes permanecem independentes do perfil.

O jogo passa a aplicar também `grip` e `driftControl` ao jogador, antes ignorados. As três barras da garagem são calculadas de `maxSpeed / 40`, `accel / 45` e `turnSpeed / 4,5`, com arredondamento e limite visual de 100%. A barra de dirigibilidade representa direção normal; aderência e drift são atributos separados. O estilo e os valores adicionais aparecem no painel e na descrição ao passar o cursor sobre o estilo.

## Economia

98 preços revisados. Quatro faixas comerciais base: 800, 1.600, 2.400 e 3.200 moedas. Todas oferecem os cinco estilos. Foram preservadas também as revisões de preço feitas após o backup inicial, incluindo valores intermediários; Deoxys, Latios e Latias permanecem desativados conforme o catálogo relido. As faixas refletem acesso/coleção, não potência. Uma vitória normal rende 180 moedas antes de bônus: aproximadamente 5, 9, 14 ou 18 vitórias para cada faixa, partindo de zero. Com bônus, derrotas remuneradas e outros ganhos, esse ritmo muda.

Mantidos os preços especiais próximos de 10 milhões, `activated`, líderes, restrições regionais, IDs e referências. Nenhuma compra anterior, moeda de jogador ou rotação diária é alterada pela migração. Os preços especiais continuam sendo a convenção existente; não foi criada uma nova loja de exclusivos.

## Validação

- Testes do catálogo, preços, preservação de acesso, barras e aplicação dos sete atributos ao trocar de kart.
- Bancada de 30 segundos executando o trecho real de integração de `updatePhysics`: velocidade vence a reta; arrancada vence recuperações com parada a cada dois segundos; drift vence sequências de um segundo de drift e dois sem drift. Sem colisões/relevo: não são tempos de volta.
- Jogo completo em Chrome com WebGL, dados locais simulados, bots difíceis (`diffMult=1,1`), sem itens e sem Master Balls. Pista padrão: 58,22–58,93 s, todos sem sair da pista. Pista personalizada de quatro curvas: 35,00–36,95 s; todos completaram, com três frames fora do limite de grama no perfil drift. Diferenças de aproximadamente 1,2% e 5,6%, respectivamente.
- Garagem em 1440×1000 e 390×844: estilos, barras de comparação e ausência de transbordamento horizontal. A fonte dos dados e os controles de órbita são simulados nesse teste de interface.
- Regressões existentes de rotação diária, bots, itens do duelo e aviso/impacto do raio.

Esta é uma base inicial mensurada, não uma garantia de equilíbrio em todos os circuitos ou níveis de habilidade. Os bots usam um controlador diferente do jogador. Playtests com jogadores, pistas estreitas, itens e diferentes frequências de quadros ainda são necessários para ajuste fino. A aderência atual reduz a perda de velocidade em curvas, mas seu efeito com aceleração contínua é pequeno; não foi usada como principal compensação de potência.

## Aplicação no Supabase

Aplicado pelo SQL Editor autenticado em 09/10/2026 no projeto PokéKart. A releitura pela API confirmou os 164 registros completos iguais ao catálogo proposto, com 164 físicas e 98 preços alterados, preservando os demais campos. A primeira tentativa foi abortada integralmente pela guarda de concorrência; a aplicação final usou o snapshot revalidado. Nenhuma política de segurança foi alterada.

## Arquivos e reversão

- `catalogo-antes-20261009.json`: backup inicial.
- `catalogo-revalidado-20261009.json`: backup relido após a proteção detectar 26 cadastros divergentes; é a referência da aplicação e reversão.
- `catalogo-proposto-20261009.json`: catálogo resultante.
- `catalogo-aplicado-20261009.json`: releitura do banco após a aplicação, conferida campo a campo.
- `gerar-catalogo.cjs`: gera o catálogo, comparação, migração e reversão; não acessa o banco.
- `aplicar-20261009.sql`: altera somente `price`, `stats` e `physics` dos 164 IDs, em operação atômica.
- `reverter-20261009.sql`: restaura esses campos do backup.

Ambos os scripts verificam o snapshot completo de cada registro antes de alterar qualquer linha. Divergência aborta toda a operação para não sobrescrever alterações posteriores. Não remova a guarda para forçar uma reaplicação: releia o catálogo e revise a diferença. Nenhuma política RLS ou permissão é alterada.

O código de `kart-balance.js`, `game.js`, `game.html`, `garage.js` e `garage.html` precisa ser publicado em conjunto. Atualizar somente o banco não publica a correção do carregamento de aderência/controle nem as barras calculadas no navegador.

## Próxima etapa: Mecânica Pokémon

A funcionalidade de peças ainda não está implementada. Esta base separa desempenho de preço e reserva espaço nas escalas para os futuros buffs.

Direção sugerida para a implementação:

- Motor: aceleração; transmissão: velocidade máxima; freio: desaceleração; nitro: duração; pneus: aderência/controle. Definir os percentuais e limites depois de testar o efeito combinado.
- Calcular atributos efetivos a partir da base imutável e das peças equipadas. Não gravar buffs temporários na tabela global `karts` nem aplicar o bônus sobre um valor já bonificado.
- Salvar peças, slots e durabilidade por jogador/kart, com validação no servidor. Usar um identificador único de corrida para descontar durabilidade uma única vez, inclusive após reconexão. Definir a regra para abandono antes de implementar.
- Congelar o conjunto equipado para cada corrida e aplicar limites ao empilhamento com Master Balls, turbos e efeitos de pista. Mostrar separadamente base e bônus na garagem.
- Comparar os cinco perfis com o mesmo conjunto de peças; evitar que um único equipamento elimine todas as fraquezas de um estilo.
