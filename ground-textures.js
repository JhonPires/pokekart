(function () {
    'use strict';

    function load(name, renderer, { width = 8, length = 8, tileSize = 8, flipY = true } = {}) {
        return new Promise(resolve => {
            let settled = false;
            const finish = texture => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve(texture);
            };
            const timeout = setTimeout(() => finish(null), 8000);
            new THREE.TextureLoader().load(`textures/kanto/${name}.webp?v=20261008-1`, texture => {
                if (settled) { texture.dispose(); return; }
                texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(width / tileSize, length / tileSize);
                texture.flipY = flipY;
                texture.encoding = THREE.sRGBEncoding;
                texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
                finish(texture);
            }, undefined, () => finish(null));
        });
    }

    async function apply(material, name, width, length, renderer, tileSize = 8) {
        const texture = await load(name, renderer, { width, length, tileSize });
        if (!texture) return false;
        const previous = material.map;
        material.map = texture;
        material.needsUpdate = true;
        if (previous) previous.dispose();
        return true;
    }

    function applyBiome(material, biome, width, length, renderer) {
        const texture = { grass: 'grass', dirt: 'dirt', water: 'sand', city: 'stone' }[biome];
        return texture ? apply(material, texture, width, length, renderer) : Promise.resolve(false);
    }

    window.PokeGroundTextures = {
        load, apply, applyBiome,
        applyGrass: (material, width, length, renderer) => apply(material, 'grass', width, length, renderer)
    };
})();
