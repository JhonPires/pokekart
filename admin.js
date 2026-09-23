document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('adminStatus');
    const panelEl = document.getElementById('adminPanel');

    // Aguarda um momento para o auth.js carregar o perfil
    setTimeout(async () => {
        if (typeof currentUserProfile === 'undefined' || !currentUserProfile) {
            statusEl.innerText = 'Erro: Você precisa estar logado para acessar.';
            return;
        }

        if (!currentUserProfile.is_admin) {
            statusEl.innerText = 'Acesso Negado. Esta página é restrita para Administradores.';
            statusEl.style.color = '#ef4444';
            return;
        }

        statusEl.innerText = `Bem-vindo, Admin ${currentUserProfile.nickname}.`;
        panelEl.style.display = 'block';

        await carregarConfiguracoesAdmin();
        await carregarListaKarts();
    }, 1000);
});

// Variável global para armazenar os dados dos karts carregados
let kartsDatabaseAdmin = [];

async function carregarListaKarts() {
    const selector = document.getElementById('kartSelector');
    const textarea = document.getElementById('jsonKartStats');

    // Vai buscar os karts à tabela 'karts'
    const { data, error } = await supabaseClient
        .from('karts')
        .select('id, name, stats, physics');

    if (error) {
        console.error('Erro ao carregar lista de karts:', error);
        return;
    }

    kartsDatabaseAdmin = data;

    // Preenche o dropdown com os karts disponíveis
    data.forEach(kart => {
        const option = document.createElement('option');
        option.value = kart.id;
        option.textContent = `${kart.name} (${kart.id})`;
        selector.appendChild(option);
    });

    // Evento que dispara sempre que escolhe um kart diferente no dropdown
    selector.addEventListener('change', (e) => {
        const kartId = e.target.value;

        if (!kartId) {
            textarea.value = '';
            return;
        }

        const kart = kartsDatabaseAdmin.find(k => k.id === kartId);

        // Agrupa stats e physics num único objeto JSON para edição mais fácil
        const kartEditData = {
            stats: kart.stats || {},
            physics: kart.physics || {}
        };

        textarea.value = JSON.stringify(kartEditData, null, 2);
    });
}

async function salvarKart() {
    const kartId = document.getElementById('kartSelector').value;
    const rawData = document.getElementById('jsonKartStats').value;

    if (!kartId) {
        alert('Por favor, selecione um kart no menu suspenso primeiro!');
        return;
    }

    if (!rawData) {
        alert('O campo de JSON está vazio.');
        return;
    }

    let parsedJson;
    try {
        parsedJson = JSON.parse(rawData);
    } catch (e) {
        alert(`Erro de sintaxe no JSON:\n${e.message}`);
        return;
    }

    // Atualiza a tabela de karts com os blocos 'stats' e 'physics' separados
    const { error } = await supabaseClient
        .from('karts')
        .update({
            stats: parsedJson.stats || {},
            physics: parsedJson.physics || {}
        })
        .eq('id', kartId);

    if (error) {
        alert(`Erro ao salvar balanceamento do kart: ${error.message}`);
    } else {
        alert('✅ Kart balanceado e atualizado com sucesso!');

        // Atualiza a cache local para não ter de recarregar a página
        const kartIndex = kartsDatabaseAdmin.findIndex(k => k.id === kartId);
        if (kartIndex > -1) {
            kartsDatabaseAdmin[kartIndex].stats = parsedJson.stats;
            kartsDatabaseAdmin[kartIndex].physics = parsedJson.physics;
        }
    }
}

async function carregarConfiguracoesAdmin() {
    const { data, error } = await supabaseClient.from('game_configs').select('*');
    if (error) {
        alert('Erro ao carregar configurações do servidor.');
        return;
    }

    data.forEach(config => {
        const formattedJson = JSON.stringify(config.config_data, null, 2);
        if (config.config_name === 'battle_pass') document.getElementById('jsonBattlePass').value = formattedJson;
        if (config.config_name === 'roulette') document.getElementById('jsonRoulette').value = formattedJson;
        if (config.config_name === 'daily_missions') document.getElementById('jsonMissions').value = formattedJson;
        if (config.config_name === 'achievements') document.getElementById('jsonAchievements').value = formattedJson;
    });
}

async function salvarConfig(configName, textareaId) {
    const rawData = document.getElementById(textareaId).value;
    let parsedJson;

    try {
        parsedJson = JSON.parse(rawData);
    } catch (e) {
        alert(`Erro de sintaxe no JSON:\n${e.message}`);
        return;
    }

    const { error } = await supabaseClient
        .from('game_configs')
        .update({ config_data: parsedJson })
        .eq('config_name', configName);

    if (error) {
        alert(`Erro ao salvar: ${error.message}`);
    } else {
        alert('✅ Atualizado com sucesso! As alterações já estão no ar.');
    }
}