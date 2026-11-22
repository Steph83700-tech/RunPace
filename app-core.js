// RunPace Pro — Profil, zones, fractionné, outils, projections de course
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    const STORAGE_KEY = 'runpace_pro_profile_v1';

    // Définition des 5 zones demandées (EF, SV1, SV2, VMA Longue, VMA)
    const ZONES_DEF = [
        {
            id: 'z1',
            name: 'Zone 1 • Endurance Fondamentale (EF)',
            short: 'Z1 • EF',
            vmaMin: 60, vmaMax: 72,
            karvMin: 55, karvMax: 68,
            colorClass: 'text-emerald-400',
            badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
            pdfBg: '#ecfdf5', pdfColor: '#065f46',
            desc: 'Aisance respiratoire, récupération, assimilation'
        },
        {
            id: 'z2',
            name: 'Zone 2 • Seuil Aérobie (SV1 / Tempo)',
            short: 'Z2 • SV1',
            vmaMin: 73, vmaMax: 79,
            karvMin: 70, karvMax: 78,
            colorClass: 'text-sky-400',
            badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
            pdfBg: '#f0f9ff', pdfColor: '#075985',
            desc: 'Allure marathon / tempo soutenu confortable'
        },
        {
            id: 'z3',
            name: 'Zone 3 • Seuil Anaérobie (SV2 / 10 km)',
            short: 'Z3 • SV2',
            vmaMin: 82, vmaMax: 87,
            karvMin: 80, karvMax: 88,
            colorClass: 'text-amber-400',
            badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
            pdfBg: '#fffbeb', pdfColor: '#92400e',
            desc: 'Allure spécifique 10 km, seuil lactique'
        },
        {
            id: 'z4',
            name: 'Zone 4 • VMA Longue (800m - 1500m)',
            short: 'Z4 • VMA Longue',
            vmaMin: 90, vmaMax: 95,
            karvMin: 90, karvMax: 95,
            colorClass: 'text-orange-400',
            badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
            pdfBg: '#fff7ed', pdfColor: '#9a3412',
            desc: 'Fractionné long, développement VO2max'
        },
        {
            id: 'z5',
            name: 'Zone 5 • VMA Moyenne & Courte',
            short: 'Z5 • VMA',
            vmaMin: 96, vmaMax: 105,
            karvMin: 95, karvMax: 100,
            colorClass: 'text-rose-400',
            badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
            pdfBg: '#fff1f2', pdfColor: '#9f1239',
            desc: 'Répétitions courtes (200m-600m), vitesse max'
        }
    ];

    const MATRIX_PCTS = [75, 80, 82, 85, 87, 90, 92, 95, 96, 98, 100, 102, 105];
    const MATRIX_DISTS = [200, 300, 400, 500, 600, 800, 900, 1000, 1500, 2000];
    const PDF_DISTS = [100, 200, 300, 400, 500, 600, 800, 900, 1000, 1500, 2000];

    const RACES = [
        { key: 'r5',  name: '5 km',          meters: 5000 },
        { key: 'r10', name: '10 km',         meters: 10000 },
        { key: 'r21', name: 'Semi-Marathon', meters: 21097.5 },
        { key: 'r42', name: 'Marathon',      meters: 42195 }
    ];
    // % de VMA par défaut (indicatifs, modifiables ou calables sur un chrono dans l'onglet Outils)
    const DEFAULT_RACE_PCT = { r5: 93, r10: 86, r21: 82, r42: 77 };
    function racePct(r) {
        const v = profile.racePct && profile.racePct[r.key];
        return (typeof v === 'number' && v > 0) ? v : DEFAULT_RACE_PCT[r.key];
    }

    let profile = {
        vma: 18.0,
        fcRepos: 48,
        fcMax: 188,
        poids: 71.0,
        wZ1: 225,
        wZ2: 265,
        wZ3: 300,
        wZ4: 330,
        wZ5: 360,
        wHill: 345,
        racePct: { ...DEFAULT_RACE_PCT }
    };

    let simState = {
        pct: 100,
        dist: 800
    };

    // --- FORMATAGE ---
    function speedToPace(kmh) {
        if (!kmh || kmh <= 0) return "--'--\"";
        const secPerKm = 3600 / kmh;
        let m = Math.floor(secPerKm / 60);
        let s = Math.round(secPerKm % 60);
        if (s === 60) { m += 1; s = 0; }
        return `${m}'${String(s).padStart(2, '0')}"`;
    }

    function formatTrack(sec) {
        const m = Math.floor(sec / 60);
        const rem = sec % 60;
        let whole = Math.floor(rem);
        let tenths = Math.round((rem - whole) * 10);
        let fm = m;
        if (tenths === 10) { whole += 1; tenths = 0; }
        if (whole === 60) { fm += 1; whole = 0; }
        if (fm === 0) return `${whole}"${tenths}`;
        return `${String(fm).padStart(2, '0')}'${String(whole).padStart(2, '0')}"${tenths}`;
    }

    function formatRace(sec) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.round(sec % 60);
        if (h > 0) return `${h}h${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
        return `${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
    }

    // Calcul Karvonen
    function calcKarvonen(pct) {
        const fcr = profile.fcRepos || 50;
        const fcm = profile.fcMax || 185;
        const reserve = Math.max(20, fcm - fcr);
        return Math.round(fcr + (pct / 100) * reserve);
    }

    // Règle de surlignage des allures conseillées selon la distance
    function getRecommendedHighlight(pct, dist) {
        // 100m - 200m -> VMA Courte (100 - 105%)
        if (dist <= 200 && pct >= 100 && pct <= 105) {
            return {
                screenClass: 'bg-rose-500/25 text-rose-200 font-extrabold ring-1 ring-inset ring-rose-500/40',
                pdfStyle: 'background: #ffe4e6; color: #9f1239; font-weight: 800;'
            };
        }
        // 300m - 600m -> VMA Moyenne (96 - 100%)
        if (dist >= 300 && dist <= 600 && pct >= 96 && pct <= 100) {
            return {
                screenClass: 'bg-red-500/25 text-red-200 font-extrabold ring-1 ring-inset ring-red-500/40',
                pdfStyle: 'background: #fee2e2; color: #991b1b; font-weight: 800;'
            };
        }
        // 800m - 1000m -> VMA Longue (90 - 95%)
        if (dist >= 800 && dist <= 1000 && pct >= 90 && pct <= 95) {
            return {
                screenClass: 'bg-orange-500/25 text-orange-200 font-extrabold ring-1 ring-inset ring-orange-500/40',
                pdfStyle: 'background: #ffedd5; color: #9a3412; font-weight: 800;'
            };
        }
        // 1500m - 2000m -> Seuil SV2 (82 - 87%)
        if (dist >= 1500 && pct >= 82 && pct <= 87) {
            return {
                screenClass: 'bg-amber-500/25 text-amber-200 font-extrabold ring-1 ring-inset ring-amber-500/40',
                pdfStyle: 'background: #fef3c7; color: #92400e; font-weight: 800;'
            };
        }
        return null;
    }

    // --- SAUVEGARDE & CHARGEMENT ---
    function loadProfile() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                profile = { ...profile, ...JSON.parse(raw) };
                profile.racePct = { ...DEFAULT_RACE_PCT, ...(profile.racePct || {}) };
            }
        } catch (e) {}
        fillInputs();
    }

    function fillInputs() {
        document.getElementById('in-vma').value = profile.vma.toFixed(1);
        document.getElementById('sl-vma').value = profile.vma;
        document.getElementById('in-fcrepos').value = profile.fcRepos;
        document.getElementById('in-fcmax').value = profile.fcMax;
        document.getElementById('in-poids').value = profile.poids;
        document.getElementById('in-w-z1').value = profile.wZ1 || '';
        document.getElementById('in-w-z2').value = profile.wZ2 || '';
        document.getElementById('in-w-z3').value = profile.wZ3 || '';
        document.getElementById('in-w-z4').value = profile.wZ4 || '';
        document.getElementById('in-w-z5').value = profile.wZ5 || '';
        document.getElementById('in-w-hill').value = profile.wHill || '';
    }

    function saveProfile() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
            const badge = document.getElementById('save-badge');
            badge.textContent = '✓ Enregistré';
            badge.classList.add('scale-105');
            setTimeout(() => badge.classList.remove('scale-105'), 200);
        } catch (e) {}
    }

    function readInputsAndRefresh() {
        profile.vma = Math.min(26, Math.max(8, parseFloat(document.getElementById('in-vma').value) || 18.0));
        profile.fcRepos = Math.min(110, Math.max(30, parseInt(document.getElementById('in-fcrepos').value, 10) || 48));
        profile.fcMax = Math.min(230, Math.max(120, parseInt(document.getElementById('in-fcmax').value, 10) || 188));
        profile.poids = Math.min(150, Math.max(35, parseFloat(document.getElementById('in-poids').value) || 71.0));
        profile.wZ1 = parseInt(document.getElementById('in-w-z1').value, 10) || 0;
        profile.wZ2 = parseInt(document.getElementById('in-w-z2').value, 10) || 0;
        profile.wZ3 = parseInt(document.getElementById('in-w-z3').value, 10) || 0;
        profile.wZ4 = parseInt(document.getElementById('in-w-z4').value, 10) || 0;
        profile.wZ5 = parseInt(document.getElementById('in-w-z5').value, 10) || 0;
        profile.wHill = parseInt(document.getElementById('in-w-hill').value, 10) || 0;

        document.getElementById('sl-vma').value = profile.vma;
        saveProfile();
        renderAll();
    }

    function stepInput(id, delta, decimals = 0) {
        const el = document.getElementById(id);
        const cur = parseFloat(el.value) || 0;
        el.value = (cur + delta).toFixed(decimals);
        readInputsAndRefresh();
    }

    // --- RENDU GLOBAL ---
    function renderAll() {
        // Header & Réserve
        document.getElementById('hdr-vma').textContent = `${profile.vma.toFixed(1)} km/h`;
        document.getElementById('hdr-pace').textContent = `${speedToPace(profile.vma)}/km`;
        document.getElementById('hdr-fc').textContent = `FC ${profile.fcRepos}-${profile.fcMax}`;
        const reserve = Math.max(0, profile.fcMax - profile.fcRepos);
        document.getElementById('fc-reserve-display').textContent = `${reserve} bpm (${profile.fcRepos} → ${profile.fcMax})`;

        renderZones();
        renderFractionne();
        renderOutils();
        renderPrintSheet();
    }

    function getZoneWatts(id) {
        if (id === 'z1') return profile.wZ1;
        if (id === 'z2') return profile.wZ2;
        if (id === 'z3') return profile.wZ3;
        if (id === 'z4') return profile.wZ4;
        if (id === 'z5') return profile.wZ5;
        return 0;
    }

    function renderZones() {
        const tbody = document.getElementById('zones-table-body');
        tbody.innerHTML = ZONES_DEF.map(z => {
            const sMin = profile.vma * (z.vmaMin / 100);
            const sMax = profile.vma * (z.vmaMax / 100);
            const pSlow = speedToPace(sMin);
            const pFast = speedToPace(sMax);
            const fcMin = calcKarvonen(z.karvMin);
            const fcMax = calcKarvonen(z.karvMax);
            const watts = getZoneWatts(z.id);
            const wkg = (watts > 0 && profile.poids > 0) ? (watts / profile.poids).toFixed(2) : null;

            return `
                <tr class="hover:bg-slate-800/40 transition">
                    <td class="py-3.5 px-3.5">
                        <span class="inline-block text-xs font-bold px-2 py-0.5 rounded border ${z.badgeBg} mb-1">${z.short}</span>
                        <div class="font-semibold text-white text-xs sm:text-sm">${z.name.split('•')[1].trim()}</div>
                        <div class="text-[11px] text-slate-400 hidden sm:block">${z.desc}</div>
                    </td>
                    <td class="py-3.5 px-3 font-mono">
                        <div class="font-bold text-white text-xs sm:text-sm">${pFast} - ${pSlow}<span class="text-[10px] text-slate-400">/km</span></div>
                        <div class="text-[11px] text-slate-400">${sMin.toFixed(1)}-${sMax.toFixed(1)} km/h (${z.vmaMin}-${z.vmaMax}%)</div>
                    </td>
                    <td class="py-3.5 px-3 font-mono">
                        <div class="font-bold text-rose-400 text-xs sm:text-sm">${fcMin} - ${fcMax} <span class="text-[10px]">bpm</span></div>
                        <div class="text-[11px] text-slate-400">${z.karvMin}-${z.karvMax}% FC rés.</div>
                    </td>
                    <td class="py-3.5 px-3 text-right font-mono">
                        ${watts > 0
                            ? `<div class="font-extrabold text-amber-400 text-sm sm:text-base">${watts} W</div>
                               <div class="text-[11px] text-slate-400">${wkg} W/kg</div>`
                            : `<span class="text-xs text-slate-500 italic">Non saisi</span>`
                        }
                    </td>
                </tr>
            `;
        }).join('');

        // Carte Côte
        const hillW = profile.wHill;
        const hillWkg = (hillW > 0 && profile.poids > 0) ? (hillW / profile.poids).toFixed(2) : '--';
        document.getElementById('hill-watts-display').textContent = hillW > 0 ? `${hillW} W` : 'Non saisi';
        document.getElementById('hill-wkg-display').textContent = hillW > 0 ? `${hillWkg} W/kg` : '-- W/kg';
    }

    function renderFractionne() {
        const speed = profile.vma * (simState.pct / 100);
        const secPerMeter = 3600 / (speed * 1000);
        const totalSec = simState.dist * secPerMeter;

        document.getElementById('lbl-pct').textContent = `${simState.pct}%`;
        document.getElementById('res-chrono').textContent = formatTrack(totalSec);
        document.getElementById('res-pace').textContent = `${speedToPace(speed)}/km`;
        document.getElementById('res-200').textContent = formatTrack(200 * secPerMeter);

        // Matrice des temps de passage
        const tbody = document.getElementById('splits-matrix-body');
        tbody.innerHTML = MATRIX_PCTS.map(pct => {
            const sp = profile.vma * (pct / 100);
            const spm = 3600 / (sp * 1000);
            const is100 = pct === 100;

            const cells = MATRIX_DISTS.map(d => {
                const hl = getRecommendedHighlight(pct, d);
                const cls = hl ? hl.screenClass : 'text-slate-300';
                return `<td class="py-2 px-2 ${cls}">${formatTrack(d * spm)}</td>`;
            }).join('');

            return `
                <tr class="${is100 ? 'bg-slate-800/60' : 'hover:bg-slate-800/30'}">
                    <td class="py-2 px-2 text-left font-bold sticky left-0 ${is100 ? 'bg-slate-800 text-sky-400' : 'bg-slate-900 text-white'} z-10">${pct}%</td>
                    <td class="py-2 px-2 text-slate-400">${speedToPace(sp)}</td>
                    ${cells}
                </tr>
            `;
        }).join('');
    }

    function renderOutils() {
        // Sync convertisseur % VMA
        const kmh = parseFloat(document.getElementById('conv-kmh').value) || 0;
        const pct = (kmh / profile.vma) * 100;
        document.getElementById('conv-pct-out').textContent = `${pct.toFixed(1)} % VMA`;
        updateRaces();
    }

    // --- PROJECTIONS DE COURSE (% VMA modifiable + calage sur chrono) ---
    function buildRacesGrid() {
        const grid = document.getElementById('races-grid');
        grid.innerHTML = RACES.map(r => `
            <div class="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-2.5" data-race="${r.key}">
                <div class="flex items-center justify-between gap-2">
                    <div>
                        <span class="font-bold text-white text-base block">${r.name}</span>
                        <span class="text-xs font-mono text-slate-400" data-pace></span>
                    </div>
                    <div class="font-mono text-xl font-extrabold text-sky-400" data-time></div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <label class="block">
                        <span class="block text-[10px] uppercase text-slate-400 mb-1">% de VMA</span>
                        <input type="number" inputmode="decimal" step="0.5" min="60" max="110" data-pct class="w-full font-mono text-base font-bold bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center">
                    </label>
                    <label class="block">
                        <span class="block text-[10px] uppercase text-slate-400 mb-1">Caler sur un chrono</span>
                        <input type="text" inputmode="text" placeholder="mm:ss ou h:mm:ss" data-chrono class="w-full font-mono text-base bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-center">
                    </label>
                </div>
                <p class="text-[11px] text-slate-400 min-h-[1rem]" data-hint></p>
            </div>
        `).join('');

        RACES.forEach(r => {
            const card = grid.querySelector(`[data-race="${r.key}"]`);
            card.querySelector('[data-pct]').addEventListener('input', (e) => {
                const v = parseFloat(e.target.value);
                if (!v || v < 60 || v > 110) return;
                profile.racePct[r.key] = Math.round(v * 10) / 10;
                saveProfile();
                updateRaces();
                renderPrintSheet();
            });
            card.querySelector('[data-chrono]').addEventListener('change', (e) => {
                const hint = card.querySelector('[data-hint]');
                const sec = parseChrono(e.target.value);
                if (!sec) {
                    hint.textContent = e.target.value.trim() ? 'Format non reconnu : utilise mm:ss ou h:mm:ss.' : '';
                    return;
                }
                const speed = (r.meters / 1000) / (sec / 3600);
                const pct = Math.round((speed / profile.vma) * 1000) / 10;
                if (pct < 60 || pct > 110) {
                    hint.textContent = `Ce chrono donne ${pct} % de ta VMA : vérifie-le (ou ta VMA).`;
                    return;
                }
                profile.racePct[r.key] = pct;
                saveProfile();
                hint.textContent = `Calé : ${speed.toFixed(1)} km/h = ${pct.toFixed(1)} % de ta VMA.`;
                e.target.value = '';
                updateRaces();
                renderPrintSheet();
            });
        });
    }

    function parseChrono(str) {
        const parts = String(str || '').trim().replace(/[hH'’]/g, ':').replace(/["”]/g, '').split(':').map(s => s.trim());
        if (parts.length < 2 || parts.length > 3 || parts.some(p => p === '' || isNaN(p))) return 0;
        const nums = parts.map(Number);
        const s = nums[nums.length - 1];
        const m = nums[nums.length - 2];
        const hh = nums.length === 3 ? nums[0] : 0;
        if (s < 0 || s >= 60 || m < 0 || hh < 0 || (nums.length === 3 && m >= 60)) return 0;
        return hh * 3600 + m * 60 + s;
    }

    function updateRaces() {
        const grid = document.getElementById('races-grid');
        if (!grid.firstElementChild) buildRacesGrid();
        RACES.forEach(r => {
            const card = grid.querySelector(`[data-race="${r.key}"]`);
            const pct = racePct(r);
            const sp = profile.vma * (pct / 100);
            const sec = (r.meters / 1000) / sp * 3600;
            card.querySelector('[data-pace]').textContent = `${speedToPace(sp)}/km • ${sp.toFixed(1)} km/h`;
            card.querySelector('[data-time]').textContent = formatRace(sec);
            const inp = card.querySelector('[data-pct]');
            if (document.activeElement !== inp) inp.value = pct;
        });
    }

    function setConvDist(km) {
        document.getElementById('conv-dist').value = km;
        convRefresh();
    }
    function convRefresh() {
        const kmh = parseFloat(document.getElementById('conv-kmh').value);
        const d = parseFloat(String(document.getElementById('conv-dist').value).replace(',', '.'));
        document.getElementById('conv-time-out').textContent = (kmh > 0 && d > 0) ? formatRace(d / kmh * 3600) : '–';
    }

    // --- SAUVEGARDE / TRANSFERT DU PROFIL ---
    function exportProfile() {
        const ta = document.getElementById('profile-json');
        const msg = document.getElementById('profile-json-msg');
        ta.value = JSON.stringify(profile);
        ta.focus();
        ta.select();
        let copied = false;
        try { copied = document.execCommand('copy'); } catch (e) {}
        msg.textContent = copied
            ? 'Profil copié. Colle-le sur l\'autre appareil dans cette même zone.'
            : 'Profil affiché : sélectionne le texte et copie-le.';
    }

    function importProfile() {
        const ta = document.getElementById('profile-json');
        const msg = document.getElementById('profile-json-msg');
        try {
            const obj = JSON.parse(ta.value);
            if (!obj || typeof obj !== 'object' || typeof obj.vma !== 'number') throw new Error('invalide');
            const keys = ['vma', 'fcRepos', 'fcMax', 'poids', 'wZ1', 'wZ2', 'wZ3', 'wZ4', 'wZ5', 'wHill'];
            keys.forEach(k => { if (typeof obj[k] === 'number' && isFinite(obj[k])) profile[k] = obj[k]; });
            if (obj.racePct && typeof obj.racePct === 'object') {
                Object.keys(DEFAULT_RACE_PCT).forEach(k => {
                    const v = obj.racePct[k];
                    if (typeof v === 'number' && v >= 60 && v <= 110) profile.racePct[k] = v;
                });
            }
            fillInputs();
            readInputsAndRefresh();
            msg.textContent = 'Profil appliqué et enregistré.';
        } catch (e) {
            msg.textContent = 'Profil non reconnu : colle le texte copié depuis « Afficher et copier mon profil ».';
        }
    }
