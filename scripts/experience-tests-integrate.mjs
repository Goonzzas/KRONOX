import fs from 'node:fs';const f='tests/startup.test.mjs';let source=fs.readFileSync(f,'utf8');const needle="    assert.equal(api.navigationScale().id, 'stellar');";if(!source.includes(needle))throw Error('Test anchor missing');source=source.replace(needle,needle+`
    assert.ok(api.atlasSnapshot().contextOverview);
    assert.ok(api.atlasSnapshot().stellarSystems>50);
    assert.equal(api.focusContextStar('sun'),true);
    harness.stepFrames(60);
    assert.equal(api.atlasSnapshot().selectedContextStar,'sun');
    assert.equal(api.setNavigationScale('regional'),true);
    harness.stepFrames(60);
    assert.ok(api.atlasSnapshot().regionalSystems>40);
    api.nearbyMap();harness.stepFrames(60);
    assert.equal(api.navigationScale().id,'extragalactic');
    api.reenterCabin();harness.stepFrames(60);
    assert.deepEqual(api.getShipPosition(),position);
    assert.equal(api.atlasSnapshot().contextOverview,false);
`);fs.writeFileSync(f,source);
