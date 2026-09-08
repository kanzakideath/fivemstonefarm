(() => {
    'use strict';

    const stateElement = document.getElementById('ai-miner-companion-state');
    const hud = document.getElementById('companion-hud');
    const title = document.getElementById('hud-title');
    const detail = document.getElementById('hud-detail');

    let currentState = JSON.parse(stateElement.textContent);
    window.__AI_MINER_COMPANION_STATE__ = currentState;

    function render(nextState) {
        if (!nextState || nextState.protocol !== 'ai-miner-companion' || nextState.protocolVersion !== 1) {
            return;
        }

        currentState = nextState;
        window.__AI_MINER_COMPANION_STATE__ = currentState;
        stateElement.textContent = JSON.stringify(currentState);

        const overlay = currentState.overlay || {};
        const visible = overlay.visible === true;
        title.textContent = overlay.title || '';
        detail.textContent = overlay.detail || '';
        hud.dataset.tone = overlay.tone || 'neutral';
        hud.classList.toggle('visible', visible);
        hud.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    window.addEventListener('message', (event) => {
        const payload = event.data;
        if (payload && payload.type === 'ai-miner-companion:state') {
            render(payload.state);
        }
    });

    const resource = typeof GetParentResourceName === 'function'
        ? GetParentResourceName()
        : 'ai_miner_companion';
    fetch(`https://${resource}/ready`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: '{}'
    }).catch(() => {});
})();
