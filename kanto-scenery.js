(function () {
    'use strict';

    async function addBorders(scene, renderer, placements) {
        if (!placements.length) return null;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        let models;
        try {
            const response = await fetch('models/kanto/borders.json?v=20261008-2', { signal: controller.signal });
            if (!response.ok) return null;
            models = await response.json();
        } catch (_) { return null; }
        finally { clearTimeout(timeout); }

        const group = new THREE.Group();
        group.name = 'kanto-borders';
        const textureNames = [...new Set(Object.entries(models)
            .filter(([kind]) => placements.some(p => p.kind === kind))
            .flatMap(([, parts]) => parts.map(p => p.texture)))];
        const textures = new Map(await Promise.all(textureNames.map(async name =>
            [name, await PokeGroundTextures.load(name, renderer, { flipY: false })])));
        for (const [kind, parts] of Object.entries(models)) {
            const instances = placements.filter(p => p.kind === kind);
            if (!instances.length) continue;
            for (const part of parts) {
                const map = textures.get(part.texture);
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(part.position, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(part.normal, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
                geometry.setIndex(part.index);
                const material = new THREE.MeshStandardMaterial({
                    map, color: map ? 0xffffff : 0x8b7963, roughness: 1
                });
                // Uma chamada de desenho por material, mesmo com várias pedras.
                const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
                mesh.name = `kanto-${kind}-${part.texture}`;
                mesh.receiveShadow = true;
                mesh.castShadow = false;
                const dummy = new THREE.Object3D();
                instances.forEach((p, i) => {
                    dummy.position.set(p.x, p.y, p.z);
                    dummy.rotation.set(0, p.rotation, 0);
                    dummy.scale.set(p.scaleX, p.scaleY, p.scaleZ);
                    dummy.updateMatrix();
                    mesh.setMatrixAt(i, dummy.matrix);
                });
                mesh.instanceMatrix.needsUpdate = true;
                mesh.userData.placements = instances;
                group.add(mesh);
            }
        }
        scene.add(group);
        return group;
    }

    window.PokeKantoScenery = { addBorders };
})();
