const fs = require('fs');
const path = require('path');
const readline = require('readline');

const jsonPath = path.join(__dirname, 'changelog.json');
const mdPath = path.join(__dirname, 'CHANGELOG.md');
const feitosPath = path.join(__dirname, 'feitos.txt');

function saveRelease(version, changes, nextFeitos) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versão inválida. Use o formato 1.9.8.');
    changes = [...new Set(changes.map(change => change.trim()).filter(Boolean))];
    if (!changes.length) throw new Error('A versão não possui notas para publicar.');
    const history = fs.existsSync(jsonPath) ? JSON.parse(fs.readFileSync(jsonPath, 'utf8')) : [];
    if (!Array.isArray(history)) throw new Error('Formato inválido em changelog.json.');
    if (history.some(entry => entry.version === version)) throw new Error(`A versão ${version} já está registrada. Nenhum arquivo foi alterado.`);
    const date = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const data = [{ version, date, changes }, ...history];
    let markdown = '# Changelog - PokéKart\n\n';
    for (const entry of data) {
        markdown += `## [${entry.version}] - ${entry.date}\n`;
        for (const change of entry.changes) markdown += `- ${change}\n`;
        markdown += '\n';
    }
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 4));
    fs.writeFileSync(mdPath, markdown);
    if (nextFeitos !== undefined) fs.writeFileSync(feitosPath, nextFeitos);
    console.log(`Versão ${version} registrada em CHANGELOG.md e changelog.json: ${changes.length} notas (${date}).`);
}

// Automatizado: node update-changelog.js --from-feitos
// Lê apenas a primeira seção e mantém ponto e vírgula dentro das notas.
function releaseFromFeitos() {
    const source = fs.readFileSync(feitosPath, 'utf8');
    const first = /^\uFEFF?Versão (\d+\.\d+\.\d+)[ \t]*\r?\n/.exec(source);
    if (!first) throw new Error('A primeira seção de feitos.txt deve começar com Versão X.Y.Z.');
    const rest = source.slice(first[0].length);
    const nextHeading = /^Versão \d+\.\d+\.\d+[ \t]*\r?$/m.exec(rest);
    const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    const changes = section.split(/\r?\n/).map(line => line.trim().replace(/;$/, '')).filter(Boolean);
    const version = first[1];
    const parts = version.split('.').map(Number);
    const nextVersion = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    const nextFeitos = `Versão ${nextVersion}${newline}${newline}${source.replace(/^\uFEFF/, '')}`;
    saveRelease(version, changes, nextFeitos);
    console.log(`Próxima seção preparada no feitos.txt: ${nextVersion}.`);
}

console.log('GERADOR DE ATUALIZAÇÕES — POKÉKART');
if (process.argv.includes('--from-feitos')) {
    try { releaseFromFeitos(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
} else if (process.argv.length > 2) {
    console.error('Uso: node update-changelog.js [--from-feitos]');
    process.exitCode = 1;
} else {
    // Mantém o modo manual utilizado anteriormente.
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Qual é a nova versão? (ex: 1.9.8): ', version => {
        rl.question('Quais foram as novidades? (Separe por ponto e vírgula ";"): ', input => {
            try { saveRelease(version.trim(), input.split(';')); }
            catch (error) { console.error(error.message); process.exitCode = 1; }
            rl.close();
        });
    });
}
