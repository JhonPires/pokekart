# Mecânica Pokémon

Compra na aba **Mecânica Pokémon** da loja; equipamento pelo botão da garagem.
Uma instância de peça por categoria em cada kart, inclusive nos karts disponíveis
na rotação diária. A peça pode ser removida ou transferida sem restaurar cargas.
Os atributos base e as exclusividades do catálogo de karts permanecem preservados.

| Peça | Moedas | Corridas | Bônus sobre a base |
| --- | ---: | ---: | --- |
| Motor Rotom | 350 | 10 | +8% de aceleração |
| Transmissão Klink | 400 | 10 | +4% de velocidade máxima |
| Freios Bronzor | 200 | 10 | +12% de força de frenagem |
| Nitro Cyndaquil | 300 | 10 | +10% de duração dos turbos de item, pista e largada |
| Pneus Donphan | 150 | 10 | +0,04 de aderência e +4% no controle do drift |

O nitro não modifica o mini-turbo do drift. Os bônus são recalculados sobre a base,
sem acumular a cada abertura da oficina. A oficina mostra os atributos antes e
depois e o número de corridas restantes de cada instância.

## Durabilidade e falhas de conexão

- O servidor consome uma carga na largada, depois do carregamento dos modelos.
- Abandonar depois da largada conta como uso; sair durante o carregamento, antes
  de solicitar a largada, não consome. Se sair com a solicitação em andamento e o
  servidor já a tiver confirmado, o uso permanece registrado.
- A última carga vale durante toda a corrida. Ao esgotar, a peça é desequipada e
  deixa de aparecer no inventário disponível. A corrida seguinte recebe a física base.
- Uma compra possui UUID próprio: repetir a mesma requisição não cobra novamente.
- Uma largada possui UUID próprio: repetir a mesma requisição retorna o mesmo
  resultado e não consome outra carga. A resposta congela os atributos daquela corrida.
- O navegador guarda o UUID pendente em `sessionStorage`. Se a conexão falhar
  depois de o servidor confirmar, recarregar reutiliza esse UUID para recuperar a resposta.
  Depois de receber a confirmação, reiniciar a corrida representa uma nova largada.
- RPCs têm timeout de 12 segundos. Uma falha bloqueia a largada e oferece a
  recuperação da tela de carregamento; não inicia uma corrida com atributos incertos.

## Banco e manutenção

`20261009-mecanica-pokemon.sql` foi aplicado ao projeto Supabase
`ccazflqrpzngxvdwgpoq`. A migração cria:

- `mechanic_parts`: catálogo, preço, duração, ícone, descrição e modificadores.
- `player_kart_parts`: instâncias compradas, dono, categoria, kart e cargas restantes.
- `mechanic_races`: confirmação e atributos congelados de cada largada.
- RPCs `mechanic_state`, `mechanic_buy_part`, `mechanic_equip_part` e
  `mechanic_start_race`. Todas exigem autenticação; as mutações serializam por perfil.

RLS permite ao jogador ler apenas seu inventário e suas largadas. O cliente não
possui permissão para escrever nessas tabelas diretamente. Preço, modificadores e
consumo vêm do servidor. A função privada de acesso reproduz a rotação UTC de `auth.js`.

Para ajustar o catálogo, atualize `mechanic_parts` administrativamente. Preço e
duração são consultados na compra; alterar a duração não recarrega peças já compradas.
Os modificadores ativos são consultados ao iniciar cada corrida. Desativar uma peça
impede novas compras, equipamento e aplicação do bônus. Corridas já confirmadas
preservam seus atributos. Novos registros devem usar uma das cinco categorias existentes.

Limites acumulados por atributo: aceleração 15%, velocidade 8%, freios 25%, direção
10%, duração do turbo 20%, carga do drift 12%, controle do drift 10%; aderência
adicional até 0,08, com valor absoluto máximo de 0,98.

## Publicação e validação

Publicar juntos `index.html`, `garage.html`, `garage.js`, `game.html`, `game.js`,
`kart-balance.js`, `kart-mechanics.js`, `mechanic-ui.js` e `mechanic-ui.css`, mantendo
os ícones existentes em `icones/tematicos`. A migração já está no servidor; o frontend
foi alterado no projeto local e não foi publicado nesta tarefa.

- `tests/kart-mechanics.test.cjs`: cálculo, limites, serviço, repetição de requisição,
  espera da confirmação e bloqueio de largada em caso de falha.
- `test-mecanica-pokemon.sql`: testes reais com duas identidades temporárias,
  compra, saldo insuficiente, transferência, slot único, consumo idempotente,
  expiração, última carga e RLS; execução transacional com `ROLLBACK`.
- Testes visuais locais com RPC simulado: compra das cinco peças, equipamento,
  transferência e remoção, desktop/mobile e carregamento dos ícones.
- Motor real da corrida com RPC simulado: aplicação dos atributos antes do GO,
  chamada única e limpeza do UUID pendente, desktop e mobile.

Os testes transacionais passaram no Supabase e terminaram com zero perfis
temporários restantes. A suíte automatizada do projeto passou com 20 testes.
