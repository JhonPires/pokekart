# Registro de alterações

- Sempre que concluir uma alteração no projeto, registre um resumo breve em `feitos.txt`, na seção da versão atual (a primeira seção do arquivo).
- Escreva em português e siga o formato das entradas existentes, com uma alteração por linha e terminação `.;`.
- Atualize ou reúna entradas da mesma mudança quando necessário, evitando duplicações e registros de tentativas intermediárias.
- Preserve o histórico das versões anteriores. Não incremente a versão nem crie uma seção nova sem pedido do usuário.
- Para mudanças apenas nas instruções de trabalho ou no próprio relatório, não adicione uma nota de atualização do jogo.

# Atualização de versão e notas de lançamento

- Quando o usuário pedir para atualizar ou lançar uma versão, execute o fluxo completo de notas de lançamento, sem pedir que ele copie as entradas ou rode o script manualmente.
- Use como fonte todas as entradas da primeira seção de `feitos.txt`. A versão dessa seção é a versão a publicar; se o usuário informar outra numeração, use a numeração solicitada. Não avance uma versão além da seção atual apenas porque a última versão publicada é anterior.
- Revise as entradas para remover duplicações e organizar a redação, preservando todas as mudanças relevantes. Remova apenas o separador final `;` de cada entrada ao preparar as notas, mantendo a pontuação. Passe cada entrada completa ao gerador, sem fragmentar textos que contenham ponto e vírgula interno.
- Utilize `update-changelog.js` para atualizar `changelog.json` e `CHANGELOG.md`, com a data atual no fuso `America/Sao_Paulo`. Confira antes como o script recebe os dados e não crie uma versão duplicada se ela já estiver registrada.
- Para a numeração já indicada na primeira seção, execute `node update-changelog.js --from-feitos`: esse modo preserva cada linha inteira, registra as notas e prepara a próxima seção automaticamente. Sem argumentos, o modo manual continua disponível.
- Valide que os dois arquivos apresentam a mesma versão, data e notas e que o histórico anterior foi preservado.
- Após publicar as notas, preserve a seção concluída de `feitos.txt` e abra no topo uma seção vazia para a próxima versão de correção (por exemplo, após publicar `1.9.8`, preparar `1.9.9`), salvo orientação diferente do usuário. Isso é parte do pedido de atualização de versão; não execute esse avanço durante alterações comuns no jogo.
- Informe a versão publicada e a versão preparada para as próximas alterações. Atualizar notas e arquivos locais não autoriza automaticamente commit, push ou deploy.
- Este procedimento é sob demanda. Uma solicitação para estabelecer ou explicar este fluxo não significa publicar uma versão naquele momento.

# Commit e merge sob demanda

- Quando o usuário pedir commit e merge do projeto, confira o estado do Git, as alterações pendentes e o destino de integração. Preserve o trabalho existente e confira arquivos novos antes de incluí-los, sem enviar credenciais ou arquivos privados.
- Para consolidar alterações que estão na branch principal, crie uma branch `codex/` com nome descritivo, faça o commit, atualize as referências remotas e integre as alterações na branch principal indicada pelo remoto. Resolva conflitos preservando as mudanças relevantes e execute as verificações necessárias.
- Quando o pedido incluir enviar ao Git/GitHub, envie a branch principal ao remoto e confira a sincronização. Nunca use push forçado nem reescreva histórico compartilhado. Se a branch exigir pull request, siga o fluxo do repositório e informe essa limitação.
- Informe o commit, a branch integrada e o resultado do envio. Não incremente versões nem publique notas de lançamento apenas por realizar commit e merge. Este fluxo não autoriza commits ou merges automáticos após toda alteração comum.
