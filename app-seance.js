// RunPace Pro — Onglet Séance : détection des répétitions, analyse, lecture, synthèse
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    const seanceState = { data: null, reps: [], blocks: [], fileName: '' };

    function sMean(a) { const v = a.filter(x => typeof x === 'number' && isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; }
    function sFmt(v, d = 0, unit = '') { return (v === null || v === undefined || !isFinite(v)) ? '–' : v.toFixed(d) + unit; }
    function sTime(sec) {
        if (sec == null) return '–';
        if (sec < 120) return sec.toFixed(1) + ' s';
        let m = Math.floor(sec / 60), r = Math.round(sec % 60);
        if (r === 60) { m++; r = 0; }
        return m + "'" + String(r).padStart(2, '0') + '"';
    }

    function sHMS(sec) {
        let h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.round(sec % 60);
        if (s === 60) { s = 0; m++; }
        if (m === 60) { m = 0; h++; }
        return h > 0 ? `${h}h${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"` : `${m}'${String(s).padStart(2, '0')}"`;
    }
    function sPace(secPerKm) {
        if (!secPerKm || !isFinite(secPerKm)) return '–';
        let m = Math.floor(secPerKm / 60), s = Math.round(secPerKm % 60);
        if (s === 60) { s = 0; m++; }
        return `${m}'${String(s).padStart(2, '0')}"/km`;
    }

    // Relief : la course est découpée en tronçons de 100 m classés montée (> +2 %), plat, descente (< −2 %)
    const TERRAIN_DEFS = [['up', 'Montée', '> +2 %'], ['flat', 'Plat', '−2 à +2 %'], ['down', 'Descente', '< −2 %']];
    function computeCourse(reps, recs) {
        const dist = reps.reduce((a, r) => a + (r.nom || r.gpsDist), 0);
        const time = reps.reduce((a, r) => a + r.dur, 0);
        let asc = reps.some(r => r.asc !== null) ? reps.reduce((a, r) => a + (r.asc || 0), 0) : null;
        let desc = reps.some(r => r.desc !== null) ? reps.reduce((a, r) => a + (r.desc || 0), 0) : null;
        const t0 = reps[0].start, last = reps[reps.length - 1], t1 = last.start + last.dur;
        const rr = recs.filter(q => q[253] >= t0 && q[253] <= t1 && q[5] !== undefined);
        const altOf = q => q[78] !== undefined ? q[78] / 5 - 500 : (q[2] !== undefined ? q[2] / 5 - 500 : undefined);
        const chunks = [];
        const addChunk = (i0, i1) => {
            const a0 = altOf(rr[i0]), a1 = altOf(rr[i1]);
            const dd = (rr[i1][5] - rr[i0][5]) / 100, dt = rr[i1][253] - rr[i0][253];
            if (a0 === undefined || a1 === undefined || dd <= 0 || dt <= 0) return;
            const seg = rr.slice(i0, i1 + 1), grade = (a1 - a0) / dd * 100;
            chunks.push({
                dd, dt, dAlt: a1 - a0, grade, cls: grade > 2 ? 'up' : grade < -2 ? 'down' : 'flat',
                hr: sMean(seg.map(q => q[3])), spm: sMean(seg.filter(q => q[4] !== undefined).map(q => 2 * (q[4] + (q[53] || 0) / 128))), w: sMean(seg.map(q => q[7]))
            });
        };
        let i0 = 0;
        for (let i = 1; i < rr.length; i++) if ((rr[i][5] - rr[i0][5]) / 100 >= 100) { addChunk(i0, i); i0 = i; }
        if (rr.length && (rr[rr.length - 1][5] - rr[i0][5]) / 100 >= 50) addChunk(i0, rr.length - 1);
        const tot = chunks.reduce((a, c) => a + c.dd, 0);
        const terrain = TERRAIN_DEFS.map(([key, label, rule]) => {
            const L = chunks.filter(c => c.cls === key);
            const d = L.reduce((a, c) => a + c.dd, 0), t = L.reduce((a, c) => a + c.dt, 0);
            const wm = k => { let a = 0, w = 0; L.forEach(c => { if (typeof c[k] === 'number' && isFinite(c[k])) { a += c[k] * c.dt; w += c.dt; } }); return w ? a / w : null; };
            return { key, label, rule, dist: d, share: tot ? d / tot * 100 : 0, pace: d ? t / d * 1000 : null,
                grade: d ? L.reduce((a, c) => a + c.dAlt, 0) / d * 100 : null, hr: wm('hr'), spm: wm('spm'), w: wm('w') };
        });
        if (asc === null && chunks.length) {
            asc = chunks.reduce((a, c) => a + Math.max(0, c.dAlt), 0);
            desc = chunks.reduce((a, c) => a + Math.max(0, -c.dAlt), 0);
        }
        return { dist, time, pace: time / dist * 1000, asc, desc, terrain: chunks.length ? terrain : null };
    }

    function terrainHtml(c) {
        if (!c || !c.terrain) return '';
        const th = 'px-2 py-1.5 text-right font-semibold', td = 'px-2 py-1.5 text-right font-mono';
        let h = `<tr class="text-slate-400 text-[11px]"><th class="px-2 py-1.5 text-left font-semibold">Terrain</th><th class="${th}">Dist.</th><th class="${th}">Part</th><th class="${th}">Pente</th><th class="${th}">Allure</th><th class="${th}">FC</th><th class="${th}">Cad.</th><th class="${th}">W</th></tr>`;
        c.terrain.forEach(t => {
            if (!t.dist) return;
            h += `<tr class="border-t border-slate-800"><td class="px-2 py-1.5 text-slate-300">${t.label}<div class="text-[10px] text-slate-500">${t.rule}</div></td>` +
                `<td class="${td}">${(t.dist / 1000).toFixed(2)} km</td><td class="${td}">${t.share.toFixed(0)} %</td><td class="${td}">${t.grade === null ? '–' : sDelta(t.grade, 1) + ' %'}</td>` +
                `<td class="${td} text-white">${sPace(t.pace)}</td><td class="${td}">${sFmt(t.hr, 0)}</td><td class="${td}">${sFmt(t.spm, 0)}</td><td class="${td}">${sFmt(t.w, 0)}</td></tr>`;
        });
        return h;
    }

    const STD_DISTS = [100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 1600, 2000, 3000, 5000];
    // Distance « théorique » de chaque tour : exacte si la montre l'a coupé à la distance (tour automatique),
    // sinon distance GPS regroupée par familles puis arrondie à une distance de piste courante.
    function assignNominal(reps) {
        const free = reps.filter(r => !r.exact).sort((a, b) => a.gpsDist - b.gpsDist);
        const clusters = [];
        free.forEach(r => {
            const c = clusters[clusters.length - 1];
            if (c && r.gpsDist <= c[0].gpsDist * 1.25) c.push(r); else clusters.push([r]);
        });
        clusters.forEach(c => {
            const med = c[Math.floor(c.length / 2)].gpsDist;
            let best = null;
            STD_DISTS.forEach(s => { if (best === null || Math.abs(s - med) < Math.abs(best - med)) best = s; });
            const nom = (med > 0 && Math.abs(best - med) / med <= 0.12) ? best : Math.max(10, Math.round(med / 10) * 10);
            c.forEach(r => { r.nom = nom; });
        });
        reps.forEach(r => { if (r.exact) r.nom = Math.max(10, Math.round(r.gpsDist)); });
    }

    function analyseFit(fit) {
        const laps = fit.laps.slice().sort((a, b) => (a[254] || 0) - (b[254] || 0));
        const recs = fit.records.filter(r => r[253] !== undefined).sort((a, b) => a[253] - b[253]);
        const hasIntensity = laps.some(l => l[23] !== undefined);
        const info = laps.map(l => ({
            lap: l, start: l[2], dur: (l[7] || 0) / 1000, dist: (l[9] || 0) / 100,
            speed: l[110] !== undefined ? l[110] / 1000 : null
        }));
        let repLaps = [];
        // tours marqués « actif » (0) ou « intervalle » (5) par la montre ; les échauffements, retours au calme et récupérations sont exclus
        if (hasIntensity) repLaps = info.filter(x => (x.lap[23] === 0 || x.lap[23] === 5) && x.dur > 5);
        if (!repLaps.length) {
            // sans marquage : tours courts et nettement plus rapides que la moyenne des tours courts
            const short = info.filter(x => x.dur > 5 && x.dur < 180 && x.speed);
            const sp = short.map(x => x.speed).sort((a, b) => a - b);
            const thr = sp.length ? (sp[0] + sp[sp.length - 1]) / 2 : 0;
            repLaps = short.filter(x => x.speed > thr);
        }
        // dernier recours (tours automatiques, course continue) : tous les tours sauf échauffement, retour au calme, récupération
        if (!repLaps.length) repLaps = info.filter(x => x.dur > 30 && ![1, 2, 3, 4].includes(x.lap[23]));
        const reps = repLaps.map((x, i) => {
            const t0 = x.start, t1 = x.start + Math.ceil(x.dur);
            const rr = recs.filter(r => r[253] >= t0 && r[253] <= t1);
            const hrs = rr.map(r => r[3]);
            const last = hrs.filter(v => v !== undefined).slice(-5);
            const spm = sMean(rr.filter(r => r[4] !== undefined).map(r => 2 * (r[4] + (r[53] || 0) / 128)));
            const wattsRec = sMean(rr.map(r => r[7]));
            return {
                n: i + 1, start: x.start, dur: x.dur, gpsDist: x.dist, trig: x.lap[24], exact: x.lap[24] === 2 || x.lap[24] === 7,
                hr: x.lap[15] !== undefined ? x.lap[15] : sMean(hrs), hrEnd: sMean(last),
                hrMax: x.lap[16] !== undefined ? x.lap[16] : (hrs.length ? Math.max(...hrs.filter(v => v !== undefined)) : null),
                spm, watts: x.lap[19] !== undefined ? x.lap[19] : wattsRec,
                vo: sMean(rr.map(r => r[39] !== undefined ? r[39] / 10 : undefined)),
                gct: sMean(rr.map(r => r[41] !== undefined ? r[41] / 10 : undefined)),
                asc: x.lap[21] !== undefined ? x.lap[21] : null, desc: x.lap[22] !== undefined ? x.lap[22] : null
            };
        });
        // course continue : aucune pause entre les tours (tours automatiques)
        const continuous0 = reps.length >= 4 && reps.slice(1).every((r, i) => r.start - (reps[i].start + reps[i].dur) <= 5);
        // dernier tour incomplet (arrêt de la montre) sans équivalent dans la séance : ignoré (sauf course continue : on garde tout)
        let dropped = null;
        if (!continuous0 && reps.length >= 4) {
            const last = reps[reps.length - 1], others = reps.slice(0, -1);
            const sib = others.filter(r => Math.abs(r.gpsDist - last.gpsDist) <= 0.25 * last.gpsDist).length;
            const sorted = others.map(r => r.gpsDist).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
            if (last.trig === 7 && !sib && last.gpsDist < 0.6 * med) { dropped = { dist: Math.round(last.gpsDist), dur: last.dur }; reps.pop(); }
        }
        assignNominal(reps);

        // coupures entre répétitions (secondes)
        const gaps = reps.slice(1).map((r, i) => r.start - (reps[i].start + reps[i].dur));
        const real = gaps.filter(g => g > 5);
        // récupération : seules comptent les coupures de durée habituelle (la plus fréquente, à 10 % près)
        let mode = null;
        if (real.length) {
            const cnt = {};
            real.forEach(g => { const k = Math.round(g / 5) * 5; cnt[k] = (cnt[k] || 0) + 1; });
            mode = Number(Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || a - b)[0]);
        }
        reps.forEach((r, i) => {
            const nx = reps[i + 1];
            if (nx && mode !== null) {
                const end = r.start + r.dur, gap = nx.start - end;
                if (gap > 5 && Math.abs(gap - mode) <= Math.max(5, mode * 0.1)) {
                    const hv = recs.filter(q => q[253] >= end && q[253] <= nx.start && q[3] !== undefined).map(q => q[3]).slice(-3);
                    r.recDur = gap; r.hrRec = sMean(hv);
                }
            }
            r.drop = (r.hrEnd != null && r.hrRec != null) ? r.hrEnd - r.hrRec : null;
        });

        // séries : tours enchaînés sans pause (ex. 1500 m puis 500 m) = une répétition composée
        const series = [];
        reps.forEach((r, i) => {
            if (i === 0 || gaps[i - 1] > 5) series.push([]);
            series[series.length - 1].push(r);
        });
        const compound = series.some(s => s.length > 1);
        // course continue : on compare les deux moitiés (coupées à la moitié de la distance)
        const continuous = continuous0;
        let blocks;
        if (continuous) {
            const totalNom = reps.reduce((a, r) => a + r.nom, 0);
            let cum = 0, h = reps.length;
            for (let i = 0; i < reps.length; i++) { cum += reps[i].nom; if (cum >= totalNom / 2) { h = i + 1; break; } }
            blocks = (reps.length >= 6 && h < reps.length) ? [reps.slice(0, h), reps.slice(h)] : [reps.slice()];
        } else if (compound) {
            blocks = series;
        } else {
            // blocs : une coupure nettement plus longue que la récupération habituelle (plus de 100 s et plus de 1,5 × la médiane)
            const sorted = real.slice().sort((a, b) => a - b);
            const med = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
            blocks = [];
            reps.forEach((r, i) => {
                if (i === 0 || gaps[i - 1] > Math.max(100, 1.5 * med)) blocks.push([]);
                blocks[blocks.length - 1].push(r);
            });
        }
        return { reps, blocks, compound: compound && !continuous, continuous, dropped, course: continuous ? computeCourse(reps, recs) : null, hasIntensity, grp: continuous ? 'Moitié' : (compound ? 'Série' : 'Bloc') };
    }

    function repMetrics(r, dist, vma) {
        const v = dist / r.dur * 3.6;
        const step = r.spm ? (dist / r.dur) / (r.spm / 60) : null;
        return { speed: v, pct: v / vma * 100, step };
    }

    async function onFitFile(input) {
        const file = input.files && input.files[0];
        const status = document.getElementById('seance-status');
        if (!file) return;
        status.textContent = 'Lecture de ' + file.name + '…';
        status.className = 'text-xs text-slate-400';
        try {
            let buf = await file.arrayBuffer();
            const head = new Uint8Array(buf, 0, 4);
            if (head[0] === 0x50 && head[1] === 0x4B) buf = await fitFromZip(buf);
            const fit = fitDecode(buf);
            const res = analyseFit(fit);
            if (!res.reps.length) throw new Error('Aucune répétition détectée. Utilise le bouton « lap » à chaque répétition sur la montre.');
            seanceState.data = res; seanceState.fileName = file.name;
            document.getElementById('seance-label').dataset.touched = '';
            document.getElementById('seance-dist').value = '';
            document.getElementById('seance-split').checked = !!(res.continuous && res.course && res.course.dist >= 10000);
            status.textContent = file.name + ' — ' + res.reps.length + (res.continuous ? ' tours détectés (course continue, tours automatiques).' : ' répétitions détectées.');
            status.className = 'text-xs text-emerald-400';
            renderSeance();
        } catch (e) {
            status.textContent = e.message || 'Fichier illisible.';
            status.className = 'text-xs text-rose-400';
            document.getElementById('seance-result').classList.add('hidden');
        }
        input.value = '';
    }

    function svgBars(values, labels, opts) {
        const w = 320, h = 120, pl = 30, pb = 18, pt = 8;
        const lo = opts.min, hi = opts.max;
        const bw = (w - pl) / values.length;
        let s = `<svg viewBox="0 0 ${w} ${h}" class="w-full" role="img" aria-label="${opts.title}">`;
        [lo, (lo + hi) / 2, hi].forEach(g => {
            const y = pt + (h - pt - pb) * (1 - (g - lo) / (hi - lo));
            s += `<line x1="${pl}" x2="${w}" y1="${y}" y2="${y}" stroke="#334155" stroke-width="0.5"/><text x="${pl - 3}" y="${y + 3}" text-anchor="end" font-size="8" fill="#94a3b8">${g.toFixed(opts.d || 0)}</text>`;
        });
        values.forEach((v, i) => {
            if (v == null) return;
            const frac = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
            const bh = (h - pt - pb) * frac;
            const x = pl + i * bw + bw * 0.15;
            const col = opts.colors ? opts.colors[i] : '#38bdf8';
            s += `<rect x="${x}" y="${h - pb - bh}" width="${bw * 0.7}" height="${bh}" rx="2" fill="${col}"><title>${labels[i]} : ${v.toFixed(opts.d || 0)}</title></rect>`;
            if (values.length <= 24) s += `<text x="${x + bw * 0.35}" y="${h - 5}" text-anchor="middle" font-size="7" fill="#94a3b8">${i + 1}</text>`;
        });
        return s + '</svg>';
    }

    function distList(rows) { const a = []; rows.forEach(r => { if (!a.includes(r.dist)) a.push(r.dist); }); return a; }
    function distText(rows) {
        const a = [];
        rows.forEach(r => { let x = a.find(y => y.d === r.dist); if (!x) { x = { d: r.dist, n: 0 }; a.push(x); } x.n++; });
        return a.map(x => x.n + ' × ' + x.d + ' m').join(' + ');
    }
    function wMean(list, key) {
        let s = 0, w = 0;
        list.forEach(r => { if (typeof r[key] === 'number' && isFinite(r[key])) { s += r[key] * r.dur; w += r.dur; } });
        return w ? s / w : null;
    }
    function sDelta(v, d) { let t = v.toFixed(d); if (/^-0(\.0+)?$/.test(t)) t = t.slice(1); return (parseFloat(t) > 0 ? '+' : '') + t; }
    function pearson(xs, ys) {
        const n = xs.length, mx = sMean(xs), my = sMean(ys);
        let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
        return (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
    }
    function autoLabelFor(rows, blocks, res) {
        if (res && res.continuous && res.course) return 'Sortie ' + Math.round(res.course.dist / 1000) + ' km';
        const dl = distList(rows);
        if (res && res.continuous && dl.length === 1) return `${rows.length}×${dl[0]} continu`;
        if (dl.length > 1) {
            const pats = blocks.map(b => b.map(r => r.dist).join('+'));
            if (blocks.length > 1 && pats.every(p => p === pats[0])) return `${blocks.length}×(${pats[0]})`;
            return blocks.length === 1 ? `(${pats[0]})` : `${rows.length} parties`;
        }
        const d = dl[0], eq = blocks.length > 1 && blocks.every(b => b.length === blocks[0].length);
        if (eq) return blocks[0].length === 1 ? `${blocks.length}×${d}` : `${blocks.length}×${blocks[0].length}×${d}`;
        return `${rows.length}×${d}`;
    }

    const CMP_DEFS = [
        ['Temps moyen (s)', 'dur', 1], ['Vitesse (km/h)', 'speed', 1], ['% VMA', 'pct', 1], ['FC fin de rep', 'hrEnd', 0], ['FC fin de récup', 'hrRec', 0], ['Chute de FC en récup', 'drop', 0],
        ['Cadence (pas/min)', 'spm', 1], ['Longueur de foulée (m)', 'step', 2], ['Puissance (W)', 'watts', 0],
        ['Oscillation verticale (mm)', 'vo', 0], ['Contact au sol (ms)', 'gct', 0]
    ];
    // Tableau de comparaison des blocs (ou des séries) ; si les distances diffèrent, une section par distance
    function buildCmpHtml(rows, blocks, grp, single) {
        const dl = distList(rows), multi = dl.length > 1 && !single, nb = blocks.length;
        const th = 'px-2 py-1.5 text-right font-semibold';
        let html = `<tr class="text-slate-400 text-[11px]"><th class="px-2 py-1.5 text-left font-semibold">Moyenne</th>` +
            blocks.map((_, i) => `<th class="${th}">${single && nb === 1 ? 'Course' : grp + ' ' + (i + 1)}</th>`).join('') +
            (nb >= 2 ? `<th class="${th}">${nb === 2 ? 'Écart' : 'Dern.−1er'}</th>` : '') + '</tr>';
        const cols = nb + 1 + (nb >= 2 ? 1 : 0);
        (multi ? dl : [null]).forEach(d => {
            const bl = blocks.map(b => d === null ? b : b.filter(r => r.dist === d));
            if (multi) html += `<tr class="bg-slate-800/60"><td colspan="${cols}" class="px-2 py-1 text-[11px] font-bold text-sky-300">Parties de ${d} m</td></tr>`;
            CMP_DEFS.forEach(([label, key, dec]) => {
                const vals = bl.map(b => b.length ? sMean(b.map(r => r[key])) : null);
                if (vals.every(v => v === null)) return;
                let diff = '';
                if (nb >= 2) {
                    const a = vals[0], z = vals[nb - 1];
                    diff = (a !== null && z !== null) ? `<td class="px-2 py-1.5 text-right font-mono text-amber-300">${sDelta(z - a, dec)}</td>` : '<td></td>';
                }
                html += `<tr class="border-t border-slate-800"><td class="px-2 py-1.5 text-slate-300">${label}</td>` +
                    vals.map(v => `<td class="px-2 py-1.5 text-right font-mono text-white">${sFmt(v, dec)}</td>`).join('') + diff + '</tr>';
            });
        });
        return html;
    }

    function renderSeance() {
        const res = seanceState.data;
        if (!res) return;
        const vma = profile.vma;
        const over = res.continuous ? NaN : parseFloat(document.getElementById('seance-dist').value);
        const rows = res.reps.map(r => { const d = over > 0 ? over : r.nom; return Object.assign({}, r, { dist: d }, repMetrics(r, d, vma)); });
        const blocks = [];
        let k = 0;
        const contSplit = !!res.continuous && document.getElementById('seance-split').checked;
        if (res.continuous && !contSplit) blocks.push(rows.slice());
        else res.blocks.forEach(b => { blocks.push(rows.slice(k, k + b.length)); k += b.length; });
        const grp = res.grp, cont = !!res.continuous;
        document.getElementById('seance-split-wrap').classList.toggle('hidden', !cont);
        const dl = distList(rows), multi = dl.length > 1 && !cont;
        document.getElementById('seance-dist-info').textContent = (over > 0 ? 'Distance forcée : ' : 'Distances retenues : ') + distText(rows) + (over > 0 ? '' : ' (déduites des tours)') + '.' +
            (res.dropped ? ' Dernier tour incomplet (' + res.dropped.dist + ' m) ignoré.' : '') +
            (over > 0 ? '' : ' Les vitesses sont calculées avec ces distances et le temps de chaque tour, plus fiable que le GPS sur piste. Saisis une distance pour la forcer.');

        document.getElementById('seance-dist-wrap').classList.toggle('hidden', cont);
        document.getElementById('seance-table-title').textContent = cont ? 'Détail par tour' : 'Détail par répétition';
        if (cont) document.getElementById('seance-dist-info').textContent = 'Course continue : tours de la montre (' + distText(rows) + '). Les distances sont celles relevées par la montre.' + (res.course && res.course.asc !== null ? '' : ' Pas de dénivelé dans ce fichier.');
        // tableau des répétitions
        let html = '';
        blocks.forEach((b, bi) => {
            if (blocks.length > 1) html += `<tr class="bg-slate-800/60"><td colspan="14" class="px-2 py-1 text-[11px] font-bold text-sky-300">${grp} ${bi + 1}</td></tr>`;
            b.forEach(r => {
                html += `<tr class="border-t border-slate-800"><td class="px-2 py-1.5 text-slate-400">${r.n}</td><td class="px-2 py-1.5 font-mono">${r.dist}</td>` +
                    `<td class="px-2 py-1.5 font-mono font-bold text-white">${sTime(r.dur)}</td>` +
                    `<td class="px-2 py-1.5 font-mono">${sFmt(r.speed, 1)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.pct, 0)}%</td>` +
                    `<td class="px-2 py-1.5 font-mono">${sFmt(r.hrEnd, 0)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.hrMax, 0)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.hrRec, 0)}</td>` +
                    `<td class="px-2 py-1.5 font-mono">${sFmt(r.spm, 0)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.step, 2)}</td>` +
                    `<td class="px-2 py-1.5 font-mono">${sFmt(r.watts, 0)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.vo, 0)}</td><td class="px-2 py-1.5 font-mono">${sFmt(r.gct, 0)}</td>` +
                    `<td class="px-2 py-1.5 font-mono">${r.asc !== null && r.asc !== undefined ? '+' + r.asc + '/−' + r.desc : '–'}</td></tr>`;
            });
        });
        document.getElementById('seance-tbody').innerHTML = html;

        // comparaison des blocs / séries
        document.getElementById('seance-cmp').innerHTML = buildCmpHtml(rows, blocks, grp, cont);

        // graphiques
        const colors = rows.map(r => ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399'][blocks.findIndex(b => b.includes(r)) % 4]);
        const pcts = rows.map(r => r.pct);
        const spms = rows.map(r => r.spm);
        const pmin = Math.floor(Math.min(...pcts) / 5) * 5 - 5, pmax = Math.ceil(Math.max(...pcts) / 5) * 5 + 2;
        const sv = spms.filter(v => v != null);
        const cmin = sv.length ? Math.floor(Math.min(...sv) / 10) * 10 - 10 : 0, cmax = sv.length ? Math.ceil(Math.max(...sv) / 10) * 10 : 1;
        document.getElementById('seance-chart-pct').innerHTML = svgBars(pcts, rows.map(r => (cont ? 'Tour ' : 'Rép ') + r.n), { min: pmin, max: pmax, title: '% VMA par ' + (cont ? 'tour' : 'répétition'), colors });
        document.getElementById('seance-chart-spm').innerHTML = sv.length ? svgBars(spms, rows.map(r => (cont ? 'Tour ' : 'Rép ') + r.n), { min: cmin, max: cmax, title: 'Cadence par ' + (cont ? 'tour' : 'répétition'), colors }) : '<p class="text-xs text-slate-500">Cadence absente du fichier.</p>';

        // résumé
        const totD = rows.reduce((s, r) => s + r.dist, 0), totT = rows.reduce((s, r) => s + r.dur, 0);
        const pm = multi ? (totD / totT * 3.6) / vma * 100 : sMean(pcts);
        const avgW = wMean(rows, 'watts');
        const card = ([a, b]) => `<div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><div class="text-[10px] uppercase tracking-wide text-slate-400">${a}</div><div class="text-lg font-bold font-mono text-white">${b}</div></div>`;
        let cards;
        if (cont && res.course) {
            const c = res.course, hrM = wMean(rows, 'hr'), hrX = Math.max(...rows.map(r => r.hrMax).filter(v => v != null));
            cards = [['Distance', (c.dist / 1000).toFixed(2) + ' km'], ['Durée', sHMS(c.time)], ['Allure moy.', sPace(c.pace)], ['% VMA moyen', sFmt((c.dist / c.time * 3.6) / vma * 100, 0) + '%'],
                ['FC moy. / max', sFmt(hrM, 0) + ' / ' + sFmt(isFinite(hrX) ? hrX : null, 0)], ['D+ / D−', c.asc === null ? '–' : '+' + Math.round(c.asc) + ' / −' + Math.round(c.desc) + ' m'],
                ['Cadence moy.', sFmt(wMean(rows, 'spm'), 0)], ['Puissance moy.', sFmt(avgW, 0) + ' W']];
        } else {
            cards = [['Répétitions', rows.length], multi ? ['Effort total', sTime(totT)] : ['Temps moyen', sTime(sMean(rows.map(r => r.dur)))], ['% VMA moyen', sFmt(pm, 0) + '%'], ['Puissance moy.', sFmt(avgW, 0) + ' W']];
        }
        document.getElementById('seance-summary').innerHTML = cards.map(card).join('');
        const tcard = document.getElementById('seance-course-card');
        const tHtml = cont ? terrainHtml(res.course) : '';
        tcard.classList.toggle('hidden', !tHtml);
        document.getElementById('seance-terrain').innerHTML = tHtml;

        const reading = buildReading(rows, blocks, res), synth = buildSynth(rows, blocks, res);
        const autoLabel = autoLabelFor(rows, blocks, res);
        seanceState.cur = { rows, blocks, dist: multi ? 0 : dl[0], dtxt: distText(rows), grp, compound: !!res.compound, continuous: !!res.continuous, course: res.course || null, reading, synth, autoLabel, start: res.reps[0].start };
        const lab = document.getElementById('seance-label');
        if (!lab.dataset.touched) lab.value = autoLabel;
        document.getElementById('seance-journal-msg').textContent = '';
        document.getElementById('seance-reading').innerHTML = reading.map(t => '<li>' + t + '</li>').join('');
        document.getElementById('seance-synth').textContent = synth;
        document.getElementById('seance-share-msg').textContent = '';
        // report de puissance
        const zn = pm >= 93 ? 5 : pm >= 85 ? 4 : pm >= 75 ? 3 : pm >= 65 ? 2 : 1;
        const sel = document.getElementById('seance-zone');
        if (!sel.dataset.touched) sel.value = String(zn);
        document.getElementById('seance-power-val').textContent = avgW ? Math.round(avgW) + ' W' : '–';
        document.getElementById('seance-result').classList.remove('hidden');
    }

    function reportPower() {
        const res = seanceState.data;
        if (!res) return;
        const w = Math.round(wMean(res.reps, 'watts') || 0);
        const msg = document.getElementById('seance-report-msg');
        if (!w) { msg.textContent = 'Pas de puissance dans ce fichier.'; return; }
        const z = document.getElementById('seance-zone').value;
        if (z === 'hill') profile.wHill = w; else profile['wZ' + z] = w;
        saveProfile(); fillInputs(); renderAll();
        msg.textContent = '✓ ' + w + ' W enregistrés dans ' + (z === 'hill' ? 'la côte' : 'la zone Z' + z) + '.';
    }

    // --- LECTURE ET SYNTHÈSE (règles fixes appliquées aux chiffres du fichier) ---
    function buildReading(rows, blocks, res) {
        if (res.continuous && res.course) return buildReadingCourse(rows, blocks, res);
        const out = [], grp = res.grp.toLowerCase(), unit = res.continuous ? 'tours' : 'reps';
        const dl = distList(rows), multi = dl.length > 1;
        const byD = d => rows.filter(r => r.dist === d);
        if (multi) {
            out.push('Intensité : ' + dl.map(d => `${d} m à ${sMean(byD(d).map(r => r.pct)).toFixed(0)} % de la VMA`).join(', ') + '.');
        } else {
            const pm = sMean(rows.map(r => r.pct));
            const t = pm >= 98 && pm <= 104 ? 'dans la cible de la VMA' : pm > 104 ? 'au-dessus de la VMA' : 'sous la VMA';
            out.push(`Intensité : ${pm.toFixed(0)} % de la VMA en moyenne, ${t}.`);
        }
        dl.forEach(d => {
            const L = byD(d);
            if (L.length < 3) return;
            const du = L.map(r => r.dur), mn = Math.min(...du), mx = Math.max(...du), avg = sMean(du), spread = mx - mn, rel = spread / avg;
            let verdict;
            if (res.continuous) verdict = '';
            else if (rel < 0.04) verdict = 'Régulier.';
            else {
                const c = pearson(L.map((_, i) => i), du);
                verdict = Math.abs(c) >= 0.8 ? (c < 0 ? 'Allure progressive : de plus en plus rapide.' : 'Allure qui baisse : de plus en plus lente.') : 'Allure irrégulière : à surveiller.';
            }
            out.push(`Régularité${multi ? ' (' + d + ' m)' : ''} : temps entre ${sTime(mn)} et ${sTime(mx)} (écart ${spread.toFixed(1)} s, soit ${(rel * 100).toFixed(1)} %). ${verdict}`.trim());
        });
        if (!multi) {
            blocks.forEach((b, i) => {
                if (b.length < 4) return;
                const a = sMean(b.slice(0, 3).map(r => r.hrEnd)), z = sMean(b.slice(-3).map(r => r.hrEnd));
                if (a !== null && z !== null) out.push(`${grp.charAt(0).toUpperCase() + grp.slice(1)} ${i + 1} : FC de fin de répétition de ${a.toFixed(0)} à ${z.toFixed(0)} bpm (${sDelta(z - a, 0)}) entre les 3 premiers et les 3 derniers ${unit}.`);
            });
            if (blocks.length === 2) {
                const g = k => [sMean(blocks[0].map(r => r[k])), sMean(blocks[1].map(r => r[k]))];
                const [c1, c2] = g('spm'), [s1, s2] = g('step'), [d1, d2] = g('dur'), [h1, h2] = g('hrEnd');
                if (c1 !== null && c2 !== null) {
                    out.push(`Cadence : ${c1.toFixed(0)} puis ${c2.toFixed(0)} pas/min (${sDelta(c2 - c1, 0)}), foulée ${s1.toFixed(2)} puis ${s2.toFixed(2)} m. ` +
                        `Pour ${sDelta(d2 - d1, 1)} s sur le temps moyen et ${sDelta(h2 - h1, 0)} bpm de FC en fin de rep.`);
                }
            }
        } else {
            dl.forEach(d => {
                const L = byD(d);
                if (L.length < 2) return;
                const f = L[0], l = L[L.length - 1];
                if (f.hrEnd != null && l.hrEnd != null) out.push(`${d} m : FC de fin de ${f.hrEnd.toFixed(0)} à ${l.hrEnd.toFixed(0)} bpm (${sDelta(l.hrEnd - f.hrEnd, 0)}) du premier au dernier.`);
                if (f.spm != null && l.spm != null && f.step != null && l.step != null) out.push(`${d} m : cadence de ${f.spm.toFixed(0)} à ${l.spm.toFixed(0)} pas/min (${sDelta(l.spm - f.spm, 0)}), foulée de ${f.step.toFixed(2)} à ${l.step.toFixed(2)} m.`);
            });
        }
        const dr = blocks.map(b => sMean(b.map(r => r.drop)));
        if (dr.some(v => v !== null)) out.push('Récupération entre répétitions : la FC redescend en moyenne de ' + dr.map((v, i) => v === null ? null : v.toFixed(0) + ' bpm (' + grp + ' ' + (i + 1) + ')').filter(Boolean).join(', ') + ' pendant ' + (sMean(rows.map(r => r.recDur)) || 0).toFixed(0) + ' s.');
        const gct = sMean(rows.map(r => r.gct)), vo = sMean(rows.map(r => r.vo));
        const pAll = (rows.reduce((a, r) => a + r.dist, 0) / rows.reduce((a, r) => a + r.dur, 0) * 3.6) / profile.vma * 100;
        if (pAll < 95) {
            const bits = [];
            if (gct !== null) bits.push(`contact au sol ${gct.toFixed(0)} ms`);
            if (vo !== null) bits.push(`oscillation verticale ${vo.toFixed(0)} mm`);
            if (bits.length) out.push('Dynamique de course : ' + bits.join(', ') + '. Les repères habituels valent pour une allure proche de la VMA : à allure plus lente, un contact plus long est normal, donc pas de jugement ici.');
            return out;
        }
        if (gct !== null) out.push(`Contact au sol : ${gct.toFixed(0)} ms en moyenne (` + (gct < 200 ? 'court' : gct <= 225 ? 'correct pour cette allure' : 'long') + ').');
        if (vo !== null) out.push(`Oscillation verticale : ${vo.toFixed(0)} mm (` + (vo < 90 ? 'économe' : vo <= 105 ? 'correcte' : 'élevée') + '). Repères indicatifs, à croiser avec ta morphologie.');
        return out;
    }

    function buildSynth(rows, blocks, res) {
        if (res.continuous && res.course) return buildSynthCourse(rows, blocks, res);
        const d = new Date((seanceState.data.reps[0].start + FIT_EPOCH) * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const dl = distList(rows), multi = dl.length > 1;
        const avgW = wMean(rows, 'watts');
        const wTxt = avgW ? ', puissance moyenne ' + avgW.toFixed(0) + ' W' : '';
        if (multi) {
            const pats = blocks.map(b => b.map(r => r.dist).join(' m + ') + ' m');
            const struct = (blocks.length > 1 && pats.every(p => p === pats[0])) ? `${blocks.length} ${res.compound ? 'séries' : 'blocs'} (${pats[0]})` : distText(rows);
            const parts = dl.map(x => {
                const L = rows.filter(r => r.dist === x);
                return `${x} m : ${sTime(sMean(L.map(r => r.dur)))} en moyenne, ${sMean(L.map(r => r.pct)).toFixed(0)} % de la VMA (${profile.vma.toFixed(1)} km/h), FC de fin ${sFmt(sMean(L.map(r => r.hrEnd)), 0)}`;
            });
            let s = `Séance du ${d} : ${struct}. ${parts.join(' ; ')}${wTxt}. `;
            const trend = dl.map(x => {
                const L = rows.filter(r => r.dist === x);
                if (L.length < 2) return null;
                const f = L[0], l = L[L.length - 1];
                return `sur ${x} m, le temps passe de ${sTime(f.dur)} à ${sTime(l.dur)} et la FC de fin de ${sFmt(f.hrEnd, 0)} à ${sFmt(l.hrEnd, 0)} bpm`;
            }).filter(Boolean);
            if (trend.length) s += 'Du premier au dernier tour : ' + trend.join(' ; ') + '.';
            return s.trim();
        }
        const pm = sMean(rows.map(r => r.pct));
        if (res.continuous) {
            let s = `Course du ${d} : ${rows.length} tours de ${dl[0]} m en continu${res.dropped ? ' (dernier tour incomplet de ' + res.dropped.dist + ' m ignoré)' : ''}. Temps moyen ${sTime(sMean(rows.map(r => r.dur)))} par tour, soit ${pm.toFixed(0)} % de la VMA (${profile.vma.toFixed(1)} km/h)${wTxt}. `;
            if (blocks.length === 2) {
                const g = k => [sMean(blocks[0].map(r => r[k])), sMean(blocks[1].map(r => r[k]))];
                const [d1, d2] = g('dur'), [h1, h2] = g('hrEnd'), [c1, c2] = g('spm');
                s += `Entre la première et la seconde moitié : temps moyen par tour ${sTime(d1)} → ${sTime(d2)}` + (h1 !== null && h2 !== null ? `, FC de fin ${h1.toFixed(0)} → ${h2.toFixed(0)} bpm` : '') + (c1 !== null && c2 !== null ? `, cadence ${c1.toFixed(0)} → ${c2.toFixed(0)} pas/min` : '') + '.';
            }
            return s.trim();
        }
        const sz = blocks.map(b => b.length).join(' × ');
        let s = `Séance du ${d} : ${blocks.length > 1 ? (blocks.every(b => b.length === blocks[0].length) ? blocks.length + ' blocs de ' + blocks[0].length + ' répétitions' : blocks.length + ' blocs (' + sz + ' répétitions)') : rows.length + ' répétitions'} de ${dl[0]} m. ` +
            `Temps moyen ${sTime(sMean(rows.map(r => r.dur)))}, soit ${pm.toFixed(0)} % de la VMA (${profile.vma.toFixed(1)} km/h)${wTxt}. `;
        if (blocks.length === 2) {
            const c1 = sMean(blocks[0].map(r => r.spm)), c2 = sMean(blocks[1].map(r => r.spm));
            const h1 = sMean(blocks[0].map(r => r.hrEnd)), h2 = sMean(blocks[1].map(r => r.hrEnd));
            const d1 = sMean(blocks[0].map(r => r.dur)), d2 = sMean(blocks[1].map(r => r.dur));
            if (c1 !== null && c2 !== null) s += `Entre les deux blocs, la cadence passe de ${c1.toFixed(0)} à ${c2.toFixed(0)} pas/min pour un temps quasi identique (${d1.toFixed(1)} s → ${d2.toFixed(1)} s) et une FC de fin de rep de ${h1.toFixed(0)} à ${h2.toFixed(0)} bpm.`;
        }
        return s.trim();
    }


    // --- COURSE / SORTIE CONTINUE : lecture et synthèse ---
    function buildReadingCourse(rows, blocks, res) {
        const out = [], c = res.course, vma = profile.vma;
        const pct = (c.dist / c.time * 3.6) / vma * 100;
        out.push(`Course : ${(c.dist / 1000).toFixed(2)} km en ${sHMS(c.time)}, allure moyenne ${sPace(c.pace)}, soit ${pct.toFixed(0)} % de la VMA.`);
        if (c.asc !== null) out.push(`Dénivelé : ${Math.round(c.asc)} m de montée, ${Math.round(c.desc)} m de descente.`);
        const hrM = wMean(rows, 'hr'), hrs = rows.map(r => r.hrMax).filter(v => v != null), hrX = hrs.length ? Math.max(...hrs) : null;
        if (hrM !== null && hrX !== null) out.push(`FC : ${hrM.toFixed(0)} bpm en moyenne, maximum ${hrX} bpm (${(hrX / profile.fcMax * 100).toFixed(0)} % de la FC max du profil)` + (hrX > profile.fcMax ? ' : au-dessus de la FC max du profil, à vérifier.' : '.'));
        if (c.terrain) {
            const T = k => c.terrain.find(t => t.key === k), up = T('up'), fl = T('flat'), dn = T('down');
            [up, fl, dn].forEach(t => { if (t.dist >= 300) out.push(`${t.label} (${t.rule}) : ${(t.dist / 1000).toFixed(2)} km (${t.share.toFixed(0)} % du parcours), allure ${sPace(t.pace)}, FC ${sFmt(t.hr, 0)} bpm, cadence ${sFmt(t.spm, 0)} pas/min.`); });
            [[up, 'En montée'], [dn, 'En descente']].forEach(([t, lab]) => {
                if (t.dist >= 500 && fl.dist >= 500 && t.pace && fl.pace) out.push(`${lab} : ${sDelta(t.pace - fl.pace, 0)} s/km par rapport au plat` + (t.hr !== null && fl.hr !== null ? `, FC ${sDelta(t.hr - fl.hr, 0)} bpm.` : '.'));
            });
        }
        if (blocks.length === 2) {
            const dd = b => b.reduce((a, r) => a + r.dist, 0), pc = b => b.reduce((a, r) => a + r.dur, 0) / dd(b) * 1000;
            const p1 = pc(blocks[0]), p2 = pc(blocks[1]);
            const h1 = sMean(blocks[0].map(r => r.hrEnd)), h2 = sMean(blocks[1].map(r => r.hrEnd));
            const a1 = blocks[0].reduce((a, r) => a + (r.asc || 0), 0), a2 = blocks[1].reduce((a, r) => a + (r.asc || 0), 0);
            out.push(`Deux moitiés (${(dd(blocks[0]) / 1000).toFixed(1)} km puis ${(dd(blocks[1]) / 1000).toFixed(1)} km) : allure ${sPace(p1)} puis ${sPace(p2)} (${sDelta(p2 - p1, 0)} s/km)` +
                (h1 !== null && h2 !== null ? `, FC de fin ${h1.toFixed(0)} puis ${h2.toFixed(0)} bpm` : '') + (c.asc !== null ? `, dénivelé positif ${a1} puis ${a2} m` : '') + '.');
        }
        const full = rows.filter(r => r.dist >= 900);
        if (full.length >= 3) {
            const fast = full.reduce((m, r) => r.dur / r.dist < m.dur / m.dist ? r : m), slow = full.reduce((m, r) => r.dur / r.dist > m.dur / m.dist ? r : m);
            const rel = r => r.asc !== null && r.asc !== undefined ? ` (+${r.asc} / −${r.desc} m)` : '';
            out.push(`Tour le plus rapide : n°${fast.n}, ${sTime(fast.dur)}${rel(fast)} ; le plus lent : n°${slow.n}, ${sTime(slow.dur)}${rel(slow)}.`);
        }
        const gct = sMean(rows.map(r => r.gct)), vo = sMean(rows.map(r => r.vo));
        if (pct < 95) {
            const bits = [];
            if (gct !== null) bits.push(`contact au sol ${gct.toFixed(0)} ms`);
            if (vo !== null) bits.push(`oscillation verticale ${vo.toFixed(0)} mm`);
            if (bits.length) out.push('Dynamique de course : ' + bits.join(', ') + '. Les repères habituels valent pour une allure proche de la VMA : à allure plus lente, un contact plus long est normal, donc pas de jugement ici.');
        }
        return out;
    }

    function buildSynthCourse(rows, blocks, res) {
        const c = res.course, vma = profile.vma;
        const d = new Date((seanceState.data.reps[0].start + FIT_EPOCH) * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
        const pct = (c.dist / c.time * 3.6) / vma * 100;
        let s = `Course du ${d} : ${(c.dist / 1000).toFixed(1)} km en ${sHMS(c.time)} (${sPace(c.pace)}, ${pct.toFixed(0)} % de la VMA de ${vma.toFixed(1)} km/h)`;
        if (c.asc !== null) s += `, D+ ${Math.round(c.asc)} m, D− ${Math.round(c.desc)} m`;
        const hrM = wMean(rows, 'hr'), hrs = rows.map(r => r.hrMax).filter(v => v != null);
        s += '.' + (hrM !== null && hrs.length ? ` FC moyenne ${hrM.toFixed(0)} bpm, maximum ${Math.max(...hrs)} bpm.` : '');
        if (blocks.length === 2) {
            const dd = b => b.reduce((a, r) => a + r.dist, 0), pc = b => b.reduce((a, r) => a + r.dur, 0) / dd(b) * 1000;
            s += ` Entre les deux moitiés : allure ${sPace(pc(blocks[0]))} puis ${sPace(pc(blocks[1]))}, FC de fin ${sFmt(sMean(blocks[0].map(r => r.hrEnd)), 0)} puis ${sFmt(sMean(blocks[1].map(r => r.hrEnd)), 0)} bpm.`;
        }
        if (c.terrain) {
            const up = c.terrain.find(t => t.key === 'up'), fl = c.terrain.find(t => t.key === 'flat'), dn = c.terrain.find(t => t.key === 'down');
            const bits = [];
            if (up.dist >= 300) bits.push(`en montée ${sPace(up.pace)} (FC ${sFmt(up.hr, 0)})`);
            if (fl.dist >= 300) bits.push(`à plat ${sPace(fl.pace)} (FC ${sFmt(fl.hr, 0)})`);
            if (dn.dist >= 300) bits.push(`en descente ${sPace(dn.pace)} (FC ${sFmt(dn.hr, 0)})`);
            if (bits.length) s += ' Selon le relief : ' + bits.join(', ') + '.';
        }
        return s.trim();
    }

    function shareSynth() {
        const txt = document.getElementById('seance-synth').textContent;
        const msg = document.getElementById('seance-share-msg');
        if (navigator.share) {
            navigator.share({ title: 'Séance RunPace', text: txt }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(txt).then(() => { msg.textContent = '✓ Texte copié.'; }).catch(() => { msg.textContent = 'Copie impossible.'; });
        }
    }
