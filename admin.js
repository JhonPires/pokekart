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
    }, 1000);
});

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