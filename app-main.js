// RunPace Pro — Navigation entre onglets et démarrage de l'appli
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    // --- NAVIGATION ONGLETS ---
    function openTab(tabId, btn) {
        const target = document.getElementById(tabId);
        if (!target) return;

        document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.add('hidden'));
        target.classList.remove('hidden');

        document.querySelectorAll('.nav-btn').forEach(button => {
            button.classList.remove('text-sky-400', 'active');
            button.classList.add('text-slate-400');
        });

        const activeButton = btn || document.querySelector(`.nav-btn[onclick*="${tabId}"]`);
        if (activeButton) {
            activeButton.classList.remove('text-slate-400');
            activeButton.classList.add('text-sky-400', 'active');
        }
        if (tabId === 'tab-seance') renderSeance();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- CONTRÔLES FRACTIONNÉ & CONVERTISSEUR ---
    function setPct(val) {
        simState.pct = Math.min(110, Math.max(80, parseInt(val, 10) || 100));
        document.getElementById('sl-pct').value = simState.pct;
        renderFractionne();
    }

    function adjustPct(delta) {
        setPct(simState.pct + delta);
    }

    function syncFromKmh() {
        const kmh = parseFloat(document.getElementById('conv-kmh').value);
        if (!kmh || kmh <= 0) return;
        const sec = 3600 / kmh;
        let m = Math.floor(sec / 60);
        let s = Math.round(sec % 60);
        if (s === 60) { m += 1; s = 0; }
        document.getElementById('conv-min').value = m;
        document.getElementById('conv-sec').value = s;
        document.getElementById('conv-pct-out').textContent = `${((kmh / profile.vma) * 100).toFixed(1)} % VMA`;
    }

    function syncFromPace() {
        const m = parseInt(document.getElementById('conv-min').value, 10) || 0;
        const s = parseInt(document.getElementById('conv-sec').value, 10) || 0;
        const total = m * 60 + s;
        if (total <= 0) return;
        const kmh = 3600 / total;
        document.getElementById('conv-kmh').value = kmh.toFixed(2);
        document.getElementById('conv-pct-out').textContent = `${((kmh / profile.vma) * 100).toFixed(1)} % VMA`;
    }

    // --- INIT ---
    document.addEventListener('DOMContentLoaded', () => {
        const ico = document.querySelector('link[rel="icon"]');
        if (ico) document.querySelectorAll('img[data-logo]').forEach(i => { i.src = ico.href; });
        loadProfile();
        requestPersist();

        // Écouteurs Profil
        ['in-vma', 'in-fcrepos', 'in-fcmax', 'in-poids', 'in-w-z1', 'in-w-z2', 'in-w-z3', 'in-w-z4', 'in-w-z5', 'in-w-hill'].forEach(id => {
            document.getElementById(id).addEventListener('input', readInputsAndRefresh);
        });
        document.getElementById('sl-vma').addEventListener('input', (e) => {
            document.getElementById('in-vma').value = parseFloat(e.target.value).toFixed(1);
            readInputsAndRefresh();
        });

        // Écouteurs Fractionné
        document.getElementById('sl-pct').addEventListener('input', (e) => setPct(e.target.value));
        document.getElementById('sel-dist').addEventListener('change', (e) => {
            simState.dist = parseInt(e.target.value, 10);
            renderFractionne();
        });

        // Écouteurs Convertisseur
        document.getElementById('conv-kmh').addEventListener('input', syncFromKmh);
        document.getElementById('conv-min').addEventListener('input', syncFromPace);
        document.getElementById('conv-sec').addEventListener('input', syncFromPace);
        ['conv-kmh', 'conv-min', 'conv-sec', 'conv-dist'].forEach(id => document.getElementById(id).addEventListener('input', convRefresh));

        renderAll();
        convRefresh();
    });
