// RunPace Pro — Carnet d'entraînement : séances enregistrées, comparaison, tendances, export
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    // --- CARNET D'ENTRAÎNEMENT (séances enregistrées sur l'appareil) ---
    const JOURNAL_KEY = 'runpace_pro_journal_v1';
    const J_METRICS = [
        ['dur', 'Temps moyen (s)', 1], ['pct', '% VMA', 1], ['hrEnd', 'FC fin de rep (bpm)', 0], ['hrRec', 'FC fin de récup (bpm)', 0], ['drop', 'Chute de FC en récup (bpm)', 0], ['hrMax', 'FC max (bpm)', 0],
        ['spm', 'Cadence (pas/min)', 1], ['step', 'Foulée (m)', 2], ['watts', 'Puissance (W)', 0],
        ['vo', 'Oscillation (mm)', 0], ['gct', 'Contact (ms)', 0]
    ];
    const jSel = new Set();

    function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
    function jLoad() { try { const a = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function jSave(a) { try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(a)); return true; } catch (e) { return false; } }
    function jMeans(rows) {
        const m = {};
        ['dur', 'speed', 'pct', 'hrEnd', 'hrRec', 'drop', 'hrMax', 'spm', 'step', 'watts', 'vo', 'gct'].forEach(k => {
            const v = sMean(rows.map(r => r[k]));
            m[k] = v === null ? null : Math.round(v * 1000) / 1000;
        });
        return m;
    }
    function jDate(ts, long) { return new Date(ts).toLocaleDateString('fr-FR', long ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: '2-digit', month: '2-digit', year: '2-digit' }); }

    function setSeanceView(v) {
        document.getElementById('seance-view-a').classList.toggle('hidden', v !== 'a');
        document.getElementById('seance-view-c').classList.toggle('hidden', v !== 'c');
        const on = 'bg-sky-500 text-slate-950', off = 'text-slate-300';
        [['a', 'seance-btn-a'], ['c', 'seance-btn-c']].forEach(([k, id]) => {
            const b = document.getElementById(id);
            b.className = 'py-2 rounded-lg text-sm font-bold transition ' + (k === v ? on : off);
        });
        if (v === 'c') { jShow('list'); const d = document.getElementById('jm-date'); if (!d.value) d.value = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10); renderJournal(); }
    }
    function jShow(name) {
        ['list', 'detail', 'compare'].forEach(n => document.getElementById('j-' + n).classList.toggle('hidden', n !== name));
        if (name !== 'list') window.scrollTo({ top: 0 });
    }

    function buildEntry() {
        const cur = seanceState.cur;
        if (!cur) return null;
        const label = (document.getElementById('seance-label').value || '').trim() || cur.autoLabel;
        return {
            id: String(cur.start) + '-' + cur.rows.length, ts: (cur.start + FIT_EPOCH) * 1000, label, dist: cur.dist, dtxt: cur.dtxt, grp: cur.grp, compound: cur.compound, continuous: cur.continuous, vma: profile.vma,
            added: Date.now(), n: cur.rows.length, fileName: seanceState.fileName, m: jMeans(cur.rows), blocks: cur.blocks.map(jMeans),
            bs: cur.blocks.map(b => b.length),
            course: cur.course || null,
            reps: cur.rows.map(r => ({ n: r.n, dist: r.dist, asc: r.asc, desc: r.desc, dur: r.dur, speed: r.speed, pct: r.pct, hrEnd: r.hrEnd, hrMax: r.hrMax, hrRec: r.hrRec, drop: r.drop, spm: r.spm, step: r.step, watts: r.watts, vo: r.vo, gct: r.gct })),
            reading: cur.reading, synth: cur.synth
        };
    }

    function addToJournal(andExport) {
        const msg = document.getElementById('seance-journal-msg');
        const entry = buildEntry();
        if (!entry) return;
        const all = jLoad();
        const i = all.findIndex(e => e.id === entry.id);
        if (i >= 0) all[i] = entry; else all.push(entry);
        msg.className = 'text-xs text-emerald-400';
        msg.textContent = jSave(all) ? (i >= 0 ? '✓ Séance déjà présente : mise à jour.' : '✓ Séance ajoutée au carnet (' + all.length + ' au total).') : 'Enregistrement impossible (stockage du navigateur plein ou bloqué).';
        if (msg.textContent.startsWith('Enreg')) msg.className = 'text-xs text-rose-400';
        else if (andExport) jExport();
    }

    function jToggle(id) {
        if (jSel.has(id)) jSel.delete(id); else jSel.add(id);
        document.getElementById('j-sel-info').textContent = jSel.size + ' séance(s) cochée(s)';
    }

    function renderJournal() {
        const all = jLoad().sort((a, b) => b.ts - a.ts);
        for (const id of Array.from(jSel)) if (!all.some(e => e.id === id)) jSel.delete(id);
        const list = document.getElementById('j-items');
        if (!all.length) {
            list.innerHTML = '<p class="text-xs text-slate-400">Aucune séance enregistrée. Analyse un fichier .fit puis appuie sur « Ajouter au carnet ».</p>';
        } else {
            list.innerHTML = all.map(e => `<div class="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2">` +
                `<input type="checkbox" ${jSel.has(e.id) ? 'checked' : ''} onchange="jToggle('${e.id}')" class="w-4 h-4 accent-sky-500">` +
                `<button type="button" onclick="jOpen('${e.id}')" class="flex-1 text-left"><div class="text-sm font-bold text-white">${esc(e.label)}</div>` +
                `<div class="text-[11px] text-slate-400">${e.manual ? jDate(e.ts) + ' · ' + (e.minutes ? e.minutes + ' min · ' : '') + (e.rpe ? 'intensité ' + e.rpe + '/10' : 'séance notée à la main') : jDate(e.ts) + ' · ' + e.n + ' reps · ' + sFmt(e.m.dur, 1) + ' s · ' + sFmt(e.m.pct, 0) + ' % VMA'}</div></button></div>`).join('');
        }
        document.getElementById('j-sel-info').textContent = jSel.size + ' séance(s) cochée(s)';
        const types = Array.from(new Set(all.filter(e => !e.manual).map(e => e.label)));
        const ts = document.getElementById('j-trend-type'), prev = ts.value;
        ts.innerHTML = types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('');
        if (types.includes(prev)) ts.value = prev;
        const ms = document.getElementById('j-trend-metric');
        if (!ms.options.length) ms.innerHTML = J_METRICS.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
        renderTrend();
        updateExportInfo();
    }

    function jOpen(id) {
        const e = jLoad().find(x => x.id === id);
        if (!e) return;
        if (e.manual) {
            document.getElementById('j-detail-body').innerHTML =
                `<h3 class="text-base font-bold text-white">${esc(e.label)}</h3><p class="text-xs text-slate-400">${jDate(e.ts, true)}${e.minutes ? ' · ' + e.minutes + ' min' : ''}${e.rpe ? ' · intensité ressentie ' + e.rpe + '/10' : ''}</p>` +
                `<p class="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">${esc(e.synth || 'Pas de commentaire.')}</p>` +
                `<button type="button" onclick="jCopy('${e.id}')" class="text-xs text-slate-100 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mr-2">Copier pour l'IA</button><button type="button" onclick="jDelete('${e.id}')" class="text-xs text-rose-300 border border-rose-900 rounded-lg px-3 py-2">Supprimer cette séance</button><p id="j-copy-msg" class="text-xs text-emerald-400"></p>`;
            jShow('detail');
            return;
        }
        const reps = (e.reps || []).map(r => {
            const dist = r.dist || e.dist || 0;
            return Object.assign({}, r, { dist, speed: (r.speed !== undefined && r.speed !== null) ? r.speed : ((dist && r.dur) ? dist / r.dur * 3.6 : null) });
        });
        const nbk = (e.blocks || []).length;
        const sizes = e.bs || ((nbk > 1 && e.n % nbk === 0) ? e.blocks.map(() => e.n / nbk) : [e.n]);
        const grp = e.grp || 'Bloc';
        let rows = '', ridx = 0;
        const groups = [];
        const td = (v, d, suf) => `<td class="px-2 py-1 font-mono">${sFmt(v, d)}${v === null || v === undefined ? '' : (suf || '')}</td>`;
        sizes.forEach((sz, bi) => {
            const part = reps.slice(ridx, ridx + sz);
            groups.push(part);
            if (sizes.length > 1) rows += `<tr class="bg-slate-800/60"><td colspan="14" class="px-2 py-1 text-[11px] font-bold text-sky-300">${grp} ${bi + 1}</td></tr>`;
            part.forEach(r => {
                rows += `<tr class="border-t border-slate-800"><td class="px-2 py-1 text-slate-400">${r.n}</td><td class="px-2 py-1 font-mono">${r.dist || '–'}</td>` +
                    `<td class="px-2 py-1 font-mono font-bold text-white">${sTime(r.dur)}</td>` + td(r.speed, 1) + td(r.pct, 0, '%') + td(r.hrEnd, 0) + td(r.hrMax, 0) + td(r.hrRec, 0) +
                    td(r.spm, 0) + td(r.step, 2) + td(r.watts, 0) + td(r.vo, 0) + td(r.gct, 0) +
                    `<td class="px-2 py-1 font-mono">${r.asc !== null && r.asc !== undefined ? '+' + r.asc + '/−' + r.desc : '–'}</td></tr>`;
            });
            ridx += sz;
        });
        const heads = ['#', 'm', 'Temps', 'km/h', '%VMA', 'FC fin', 'FC max', 'FC récup', 'Cad.', 'Foulée m', 'W', 'Osc. mm', 'Contact ms', 'D+/D−'];
        document.getElementById('j-detail-body').innerHTML =
            `<h3 class="text-base font-bold text-white">${esc(e.label)}</h3><p class="text-xs text-slate-400">${jDate(e.ts, true)} · ${esc(e.dtxt || (e.n + ' répétitions de ' + e.dist + ' m'))} · VMA ${Number(e.vma).toFixed(1)} km/h</p>` +
            `<p class="text-xs text-slate-300 leading-relaxed">${esc(e.synth || '')}</p>` +
            `<ul class="space-y-1 text-xs text-slate-300 list-disc pl-4">${(e.reading || []).map(t => '<li>' + esc(t) + '</li>').join('')}</ul>` +
            (e.course && e.course.terrain ? `<h4 class="text-xs font-bold text-white">Relief</h4><div class="overflow-x-auto"><table class="w-full text-xs">${terrainHtml(e.course)}</table></div>` : '') +
            `<div class="overflow-x-auto"><table class="w-full text-xs">${buildCmpHtml(reps, groups, grp, e.continuous)}</table></div>` +
            `<div class="overflow-x-auto -mx-1"><table class="w-full text-xs text-slate-200 whitespace-nowrap"><thead><tr class="text-slate-400 text-[11px]">${heads.map(h => `<th class="px-2 py-1 text-left font-semibold">${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>` +
            `<button type="button" onclick="jCopy('${e.id}')" class="text-xs text-slate-100 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 mr-2">Copier pour l'IA</button><button type="button" onclick="jDelete('${e.id}')" class="text-xs text-rose-300 border border-rose-900 rounded-lg px-3 py-2">Supprimer cette séance</button><p id="j-copy-msg" class="text-xs text-emerald-400"></p>`;
        jShow('detail');
    }

    function jDelete(id) {
        if (!confirm('Supprimer cette séance du carnet ?')) return;
        jSave(jLoad().filter(e => e.id !== id));
        jSel.delete(id);
        jShow('list'); renderJournal();
    }

    function jCompare() {
        const msg = document.getElementById('j-sel-info');
        if (jSel.size !== 2) { msg.textContent = 'Coche exactement deux séances (' + jSel.size + ' cochée(s)).'; return; }
        const sel = jLoad().filter(e => jSel.has(e.id)).sort((a, b) => a.ts - b.ts);
        if (sel.some(e => e.manual)) { msg.textContent = 'Une séance notée à la main ne peut pas être comparée : coche deux séances analysées.'; return; }
        const [a, b] = sel;
        const delta = (x, y, d) => (x === null || y === null || x === undefined || y === undefined) ? '' : ((y - x >= 0 ? '+' : '') + (y - x).toFixed(d));
        let rows = '';
        J_METRICS.forEach(([k, l, d]) => {
            if (a.m[k] === null && b.m[k] === null) return;
            rows += `<tr class="border-t border-slate-800"><td class="px-2 py-1.5 text-slate-300">${l}</td><td class="px-2 py-1.5 text-right font-mono">${sFmt(a.m[k], d)}</td><td class="px-2 py-1.5 text-right font-mono">${sFmt(b.m[k], d)}</td><td class="px-2 py-1.5 text-right font-mono text-amber-300">${delta(a.m[k], b.m[k], d)}</td></tr>`;
        });
        const nb = (a.compound || b.compound) ? 0 : Math.min((a.blocks || []).length, (b.blocks || []).length);
        if (nb > 1) {
            for (let i = 0; i < nb; i++) {
                [['dur', 'Temps', 1], ['hrEnd', 'FC fin', 0], ['spm', 'Cadence', 1], ['step', 'Foulée', 2]].forEach(([k, l, d]) => {
                    const x = a.blocks[i][k], y = b.blocks[i][k];
                    if (x === null && y === null) return;
                    rows += `<tr class="border-t border-slate-800"><td class="px-2 py-1.5 text-slate-400">Bloc ${i + 1} · ${l}</td><td class="px-2 py-1.5 text-right font-mono">${sFmt(x, d)}</td><td class="px-2 py-1.5 text-right font-mono">${sFmt(y, d)}</td><td class="px-2 py-1.5 text-right font-mono text-amber-300">${delta(x, y, d)}</td></tr>`;
                });
            }
        }
        const warn = (a.label !== b.label || a.dist !== b.dist) ? '<p class="text-xs text-amber-300">Types de séance différents : compare avec prudence.</p>' : '';
        document.getElementById('j-compare-body').innerHTML = warn +
            `<div class="overflow-x-auto"><table class="w-full text-xs"><thead><tr class="text-slate-400 text-[11px]"><th class="px-2 py-1.5 text-left">Moyenne</th><th class="px-2 py-1.5 text-right">${jDate(a.ts)}<br>${esc(a.label)}</th><th class="px-2 py-1.5 text-right">${jDate(b.ts)}<br>${esc(b.label)}</th><th class="px-2 py-1.5 text-right">Écart</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        jShow('compare');
    }

    function renderTrend() {
        const type = document.getElementById('j-trend-type').value;
        const key = document.getElementById('j-trend-metric').value;
        const months = parseInt(document.getElementById('j-trend-period').value, 10);
        const box = document.getElementById('j-trend-chart'), txt = document.getElementById('j-trend-text');
        const lim = months ? Date.now() - months * 30.5 * 86400000 : 0;
        const pts = jLoad().filter(e => e.label === type && e.ts >= lim && e.m[key] !== null && e.m[key] !== undefined).sort((a, b) => a.ts - b.ts);
        const def = J_METRICS.find(m => m[0] === key) || J_METRICS[0];
        if (pts.length < 2) { box.innerHTML = ''; txt.textContent = type ? 'Il faut au moins deux séances de ce type sur la période pour voir une tendance.' : ''; return; }
        const w = 320, h = 140, pl = 36, pr = 8, pt = 10, pb = 22;
        const ys = pts.map(p => p.m[key]);
        let lo = Math.min(...ys), hi = Math.max(...ys);
        if (hi === lo) { lo -= 1; hi += 1; }
        const pad = (hi - lo) * 0.15; lo -= pad; hi += pad;
        const t0 = pts[0].ts, t1 = pts[pts.length - 1].ts, span = Math.max(1, t1 - t0);
        const X = t => pl + (w - pl - pr) * (t - t0) / span, Y = v => pt + (h - pt - pb) * (1 - (v - lo) / (hi - lo));
        let s = `<svg viewBox="0 0 ${w} ${h}" class="w-full" role="img" aria-label="${esc(def[1])}">`;
        [lo, (lo + hi) / 2, hi].forEach(g => { s += `<line x1="${pl}" x2="${w - pr}" y1="${Y(g)}" y2="${Y(g)}" stroke="#334155" stroke-width="0.5"/><text x="${pl - 3}" y="${Y(g) + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${g.toFixed(def[2])}</text>`; });
        s += `<polyline fill="none" stroke="#38bdf8" stroke-width="2" points="${pts.map(p => X(p.ts).toFixed(1) + ',' + Y(p.m[key]).toFixed(1)).join(' ')}"/>`;
        pts.forEach(p => { s += `<circle cx="${X(p.ts).toFixed(1)}" cy="${Y(p.m[key]).toFixed(1)}" r="3.5" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"><title>${jDate(p.ts)} : ${p.m[key].toFixed(def[2])}</title></circle>`; });
        s += `<text x="${pl}" y="${h - 6}" font-size="8" fill="#94a3b8">${jDate(t0)}</text><text x="${w - pr}" y="${h - 6}" text-anchor="end" font-size="8" fill="#94a3b8">${jDate(t1)}</text></svg>`;
        box.innerHTML = s;
        const d = ys[ys.length - 1] - ys[0];
        txt.textContent = `${pts.length} séances « ${type} » : ${def[1]} de ${ys[0].toFixed(def[2])} à ${ys[ys.length - 1].toFixed(def[2])} (${d >= 0 ? '+' : ''}${d.toFixed(def[2])}) entre le ${jDate(t0)} et le ${jDate(t1)}. Tendance sur peu de séances : à prendre avec prudence, d'autant que la forme du jour pèse beaucoup.`;
    }

    const EXPORT_KEY = 'runpace_pro_lastexport_v1';
    function updateExportInfo() {
        const el = document.getElementById('j-last-export');
        if (!el) return;
        let last = null;
        try { last = JSON.parse(localStorage.getItem(EXPORT_KEY) || 'null'); } catch (e) {}
        const all = jLoad();
        if (!last) { el.textContent = 'Dernier export : jamais' + (all.length ? ' (' + all.length + ' séance(s) non sauvegardée(s)).' : '.'); return; }
        const since = all.filter(e => (e.added || 0) > last.ts).length;
        el.textContent = 'Dernier export : ' + jDate(last.ts) + (since ? ' — ' + since + ' séance(s) ajoutée(s) depuis.' : ' — aucune séance ajoutée depuis.');
    }

    // Sauvegarde : le carnet et le profil dans un seul fichier
    function jExport() {
        const journal = jLoad();
        const data = { app: 'RunPace', version: 2, exportedAt: new Date().toISOString(), profile: profile, journal: journal };
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'carnet-runpace-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        try { localStorage.setItem(EXPORT_KEY, JSON.stringify({ ts: Date.now(), count: journal.length })); } catch (e) {}
        const msg = document.getElementById('j-io-msg');
        if (msg) msg.textContent = '✓ Sauvegarde téléchargée (' + journal.length + ' séances et ton profil). Range-la dans un dossier à toi.';
        updateExportInfo();
    }

    // Même contrôle que « Appliquer un profil » de l'onglet Profil
    function applyProfileData(obj) {
        if (!obj || typeof obj !== 'object' || typeof obj.vma !== 'number') return false;
        ['vma', 'fcRepos', 'fcMax', 'poids', 'wZ1', 'wZ2', 'wZ3', 'wZ4', 'wZ5', 'wHill'].forEach(k => { if (typeof obj[k] === 'number' && isFinite(obj[k])) profile[k] = obj[k]; });
        if (obj.racePct && typeof obj.racePct === 'object') {
            Object.keys(DEFAULT_RACE_PCT).forEach(k => { const v = obj.racePct[k]; if (typeof v === 'number' && v >= 60 && v <= 110) profile.racePct[k] = v; });
        }
        fillInputs();
        readInputsAndRefresh();
        return true;
    }

    // Demande au navigateur de ne pas effacer automatiquement les données de l'appli
    async function requestPersist() {
        const el = document.getElementById('j-persist');
        let txt = 'Protection du stockage non disponible sur ce navigateur : exporte régulièrement ton carnet.';
        try {
            if (navigator.storage && navigator.storage.persist) {
                const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
                const ok = already || await navigator.storage.persist();
                txt = ok ? 'Stockage protégé par le navigateur : oui (pas de nettoyage automatique). Exporte quand même régulièrement.' : 'Stockage protégé par le navigateur : non accordé. Exporte régulièrement ton carnet.';
            }
        } catch (e) {}
        if (el) el.textContent = txt;
    }

    async function jImport(input) {
        const f = input.files && input.files[0], msg = document.getElementById('j-io-msg');
        if (!f) return;
        try {
            const data = JSON.parse(await f.text());
            const inc = (Array.isArray(data) ? data : data.journal || []).filter(e => e && e.id && e.m && e.ts);
            if (!inc.length) throw new Error('vide');
            const all = jLoad();
            inc.forEach(e => { const i = all.findIndex(x => x.id === e.id); if (i >= 0) all[i] = e; else all.push(e); });
            jSave(all);
            msg.textContent = '✓ ' + inc.length + ' séance(s) importée(s), ' + all.length + ' au total.';
            if (!Array.isArray(data) && data.profile && confirm('Ce fichier contient aussi un profil (VMA, FC, puissances). Le restaurer ? Il remplacera les valeurs actuelles.')) {
                if (applyProfileData(data.profile)) msg.textContent += ' Profil restauré.';
            }
            renderJournal();
        } catch (e) { msg.textContent = 'Fichier de carnet illisible.'; }
        input.value = '';
    }

    function jAddManual(andExport) {
        const g = id => document.getElementById(id);
        const msg = g('jm-msg');
        const day = g('jm-date').value;
        const label = (g('jm-type').value || '').trim();
        if (!day || !label) { msg.className = 'text-xs text-rose-400'; msg.textContent = 'Date et type de séance obligatoires.'; return; }
        const minutes = parseInt(g('jm-min').value, 10) || 0;
        const rpe = Math.min(10, Math.max(0, parseInt(g('jm-rpe').value, 10) || 0));
        const entry = { id: 'man-' + Date.now(), added: Date.now(), manual: true, ts: new Date(day + 'T12:00:00').getTime(), label, dist: 0, vma: profile.vma, n: 0, m: {}, blocks: [], reps: [], reading: [], synth: (g('jm-note').value || '').trim(), minutes, rpe };
        const all = jLoad(); all.push(entry);
        msg.className = 'text-xs text-emerald-400';
        const saved = jSave(all);
        msg.textContent = saved ? '✓ Séance ajoutée au carnet.' : 'Enregistrement impossible.';
        if (saved && andExport) jExport();
        g('jm-note').value = ''; g('jm-min').value = ''; g('jm-rpe').value = '';
        renderJournal();
    }

    // --- COPIE D'UNE SÉANCE EN TEXTE COMPACT (pour la coller dans une discussion avec une IA) ---
    function entryText(e) {
        const L = [];
        if (e.manual) {
            L.push(`Séance notée à la main — ${e.label}, ${jDate(e.ts, true)}${e.minutes ? ', ' + e.minutes + ' min' : ''}${e.rpe ? ', intensité ressentie ' + e.rpe + '/10' : ''}.`);
            if (e.synth) L.push('Commentaire : ' + e.synth);
            return L.join('\n');
        }
        L.push(`Séance ${e.label} du ${jDate(e.ts, true)} — ${e.dtxt || (e.n + ' répétitions de ' + e.dist + ' m')} (vitesses calculées sur la distance de chaque tour et son temps).`);
        L.push(`Profil : VMA ${Number(e.vma).toFixed(1)} km/h, FC repos ${profile.fcRepos}, FC max ${profile.fcMax}.`);
        if (e.synth) L.push('Synthèse : ' + e.synth);
        (e.reading || []).forEach(t => L.push('- ' + t));
        if (e.course) {
            const c = e.course;
            L.push(`Course : ${(c.dist / 1000).toFixed(2)} km en ${sHMS(c.time)}, allure ${sPace(c.pace)}` + (c.asc !== null && c.asc !== undefined ? `, D+ ${Math.round(c.asc)} m, D− ${Math.round(c.desc)} m.` : '.'));
            if (c.terrain) {
                L.push('Relief (terrain ; distance km ; part % ; pente % ; allure ; FC ; cadence ; W) :');
                c.terrain.forEach(t => { if (t.dist) L.push([t.label, (t.dist / 1000).toFixed(2), t.share.toFixed(0), t.grade === null ? '-' : t.grade.toFixed(1), sPace(t.pace), t.hr === null ? '-' : t.hr.toFixed(0), t.spm === null ? '-' : t.spm.toFixed(0), t.w === null ? '-' : t.w.toFixed(0)].join(' ; ')); });
            }
        }
        const f = (v, d) => (v === null || v === undefined) ? '-' : Number(v).toFixed(d);
        const nb = (e.blocks || []).length;
        if (!e.compound) {
        L.push('Moyennes (séance' + (nb > 1 ? ', ' + e.blocks.map((_, i) => 'bloc ' + (i + 1)).join(', ') : '') + ') :');
        J_METRICS.forEach(([k, l, d]) => { if (e.m[k] != null) L.push(`${l} : ${f(e.m[k], d)}` + (nb > 1 ? ' | ' + e.blocks.map(b => f(b[k], d)).join(' | ') : '')); });
        }
        L.push('Répétitions (n ; distance m ; temps s ; km/h ; %VMA ; FC fin ; FC max ; FC fin récup ; cadence ; foulée m ; W ; osc mm ; contact ms ; D+ ; D−) :');
        (e.reps || []).forEach(r => L.push([r.n, r.dist || e.dist || '-', f(r.dur, 1), f(r.speed !== undefined && r.speed !== null ? r.speed : (e.dist && r.dur ? e.dist / r.dur * 3.6 : null), 1), f(r.pct, 0), f(r.hrEnd, 0), f(r.hrMax, 0), f(r.hrRec, 0), f(r.spm, 0), f(r.step, 2), f(r.watts, 0), f(r.vo, 0), f(r.gct, 0), r.asc === null || r.asc === undefined ? '-' : r.asc, r.desc === null || r.desc === undefined ? '-' : r.desc].join(' ; ')));
        return L.join('\n');
    }

    async function copyText(txt, msgEl) {
        try {
            await navigator.clipboard.writeText(txt);
            msgEl.textContent = '✓ Texte copié, colle-le dans ta discussion.';
        } catch (err) {
            if (navigator.share) { navigator.share({ title: 'Séance RunPace', text: txt }).catch(() => {}); }
            else msgEl.textContent = 'Copie impossible sur ce navigateur.';
        }
    }
    function jCopy(id) { const e = jLoad().find(x => x.id === id); if (e) copyText(entryText(e), document.getElementById('j-copy-msg')); }
    function copyCurrentForAi() { const e = buildEntry(); if (e) copyText(entryText(e), document.getElementById('seance-share-msg')); }
