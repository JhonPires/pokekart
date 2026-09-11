const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const jsonPath = './changelog.json';
const mdPath = './CHANGELOG.md';

console.log('\n🏎️  GERADOR DE ATUALIZAÇÕES - POKÉKART 🏎️\n');

rl.question('Qual é a nova versão? (ex: 1.2.0): ', (version) => {
    rl.question('Quais foram as novidades? (Separe por ponto e vírgula ";"): ', (changesInput) => {

        const date = new Date().toLocaleDateString('pt-BR');
        const changes = changesInput.split(';').map(c => c.trim()).filter(c => c);

        // 1. Atualiza o JSON (Para o jogo ler)
        let changelogData = [];
        if (fs.existsSync(jsonPath)) {
            changelogData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        }

        changelogData.unshift({ version, date, changes }); // Adiciona no topo
        fs.writeFileSync(jsonPath, JSON.stringify(changelogData, null, 4));

        // 2. Atualiza o Markdown (Para você / Github)
        let mdContent = `# Changelog - PokéKart\n\n`;
        changelogData.forEach(entry => {
            mdContent += `## [${entry.version}] - ${entry.date}\n`;
            entry.changes.forEach(change => {
                mdContent += `- ${change}\n`;
            });
            mdContent += `\n`;
        });

        fs.writeFileSync(mdPath, mdContent);

        console.log(`\n✅ Sucesso! Versão ${version} registrada no CHANGELOG.md e changelog.json!`);
        rl.close();
    });
});




// 2. Como Utilizar na Prática
// Sempre que finalizar uma mecânica (como a correção da ré ou a música contínua), abra o terminal no VSCode e digite:

// node update-changelog.js

// O terminal vai te perguntar:

// Qual é a nova versão? (Você digita, por exemplo: 0.5.1)

// Quais foram as novidades? (Você digita: Corrigido bug da direção na marcha à ré; Adicionado confetes e som de vitória; Música global persistente implementada)