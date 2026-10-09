(function () {
    'use strict';

    function get(floor, maxFloors) {
        const total = Math.min(20, Math.max(1, parseInt(maxFloors, 10) || 5));
        const current = Math.min(total, Math.max(1, parseInt(floor, 10) || 1));
        if (current === total) return 'hard';

        // O líder ocupa o último andar. A metade inicial dos demais é fácil.
        const easyFloors = Math.ceil((total - 1) / 2);
        return current <= easyFloors ? 'easy' : 'normal';
    }

    window.PokeTowerDifficulty = { get };
})();
