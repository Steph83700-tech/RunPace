// RunPace Pro — Fiche PDF (2 pages A4) générée dans l'appli
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    // --- GÉNÉRATION DE LA FICHE PDF 2 PAGES ---
    function renderPrintSheet() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('fr-FR');
        document.getElementById('pdf-vma-header').textContent = `VMA : ${profile.vma.toFixed(1)} km/h (${speedToPace(profile.vma)}/km)`;
        document.getElementById('pdf-date-header').textContent = `Édité le ${dateStr}`;

        // Page 1 : Tableau complet avec cases surlignées
        const pdfSplitsBody = document.getElementById('pdf-splits-body');
        pdfSplitsBody.innerHTML = MATRIX_PCTS.map(pct => {
            const sp = profile.vma * (pct / 100);
            const spm = 3600 / (sp * 1000);
            const rowBg = pct === 100 ? 'background: #f1f5f9;' : '';

            const cells = PDF_DISTS.map(d => {
                const hl = getRecommendedHighlight(pct, d);
                const st = hl ? hl.pdfStyle : 'color: #1e293b;';
                return `<td style="${st}">${formatTrack(d * spm)}</td>`;
            }).join('');

            return `
                <tr style="${rowBg}">
                    <td style="text-align: left; font-weight: 800; color: #0f172a;">${pct}%</td>
                    <td style="color: #475569;">${sp.toFixed(1)}</td>
                    <td style="font-weight: 700; color: #0284c7;">${speedToPace(sp)}</td>
                    ${cells}
                </tr>
            `;
        }).join('');

        // Page 2 : Récapitulatif des zones
        document.getElementById('pdf-profile-summary').textContent =
            `VMA: ${profile.vma.toFixed(1)} km/h | FC: ${profile.fcRepos}-${profile.fcMax} bpm | Poids: ${profile.poids.toFixed(1)} kg`;

        const pdfZonesBody = document.getElementById('pdf-zones-body');
        pdfZonesBody.innerHTML = ZONES_DEF.map(z => {
            const sMin = profile.vma * (z.vmaMin / 100);
            const sMax = profile.vma * (z.vmaMax / 100);
            const pSlow = speedToPace(sMin);
            const pFast = speedToPace(sMax);
            const fcMin = calcKarvonen(z.karvMin);
            const fcMax = calcKarvonen(z.karvMax);
            const watts = getZoneWatts(z.id);
            const wkg = (watts > 0 && profile.poids > 0) ? `${(watts / profile.poids).toFixed(2)} W/kg` : '';

            return `
                <tr>
                    <td style="padding: 8px; background: ${z.pdfBg}; color: ${z.pdfColor}; font-weight: 700;">
                        ${z.name}<br>
                        <span style="font-weight: 400; font-size: 9.5px; color: #334155;">${z.desc}</span>
                    </td>
                    <td style="padding: 8px; font-family: 'JetBrains Mono', monospace;">
                        <strong>${z.vmaMin}-${z.vmaMax}%</strong><br>
                        <span style="font-size: 9.5px; color: #475569;">${sMin.toFixed(1)} - ${sMax.toFixed(1)} km/h</span>
                    </td>
                    <td style="padding: 8px; font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 12px; color: #0f172a;">
                        ${pFast} - ${pSlow}/km
                    </td>
                    <td style="padding: 8px; font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #be123c;">
                        ${fcMin} - ${fcMax} bpm<br>
                        <span style="font-weight: 400; font-size: 9.5px; color: #475569;">(${z.karvMin}-${z.karvMax}% FC rés.)</span>
                    </td>
                    <td style="padding: 8px; font-family: 'JetBrains Mono', monospace; font-weight: 800; color: #b45309;">
                        ${watts > 0 ? `${watts} W <span style="font-weight:400; font-size:10px; color:#475569;">(${wkg})</span>` : 'Non renseigné'}
                    </td>
                </tr>
            `;
        }).join('');

        // Côte Page 2
        const hillW = profile.wHill;
        const hillWkg = (hillW > 0 && profile.poids > 0) ? `(${(hillW / profile.poids).toFixed(2)} W/kg)` : '';
        document.getElementById('pdf-hill-box').textContent = hillW > 0 ? `${hillW} W ${hillWkg}` : 'Non renseigné';

        // Courses Page 2
        document.getElementById('pdf-races-head').innerHTML = RACES.map(r =>
            `<th style="padding: 6px;">${r.name} (${racePct(r).toFixed(1).replace('.0', '')}% VMA)</th>`).join('');
        const pdfRacesRow = document.getElementById('pdf-races-row');
        pdfRacesRow.innerHTML = RACES.map(r => {
            const sp = profile.vma * (racePct(r) / 100);
            const sec = (r.meters / 1000) / sp * 3600;
            return `<td style="padding: 8px;">${formatRace(sec)}<br><span style="font-size: 9.5px; font-weight: 400; color: #475569;">${speedToPace(sp)}/km</span></td>`;
        }).join('');
    }

    function printTrainingSheet() {
        renderPrintSheet();
        window.print();
    }

    // --- GÉNÉRATEUR PDF : vraies pages A4 (page 1 paysage, page 2 portrait), sans dépendance ni réseau ---
    const PDF_FONTS = { h: 'F1', hb: 'F2', c: 'F3', cb: 'F4', hi: 'F5' };

    function pdfEncode(str) {
        const special = { '’': 0x92, '‘': 0x91, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '…': 0x85, 'œ': 0x9c, 'Œ': 0x8c };
        let out = '';
        for (const ch of String(str)) {
            let c = special[ch] !== undefined ? special[ch] : ch.charCodeAt(0);
            if (c > 255) c = 63;
            if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
            else if (c < 32 || c > 126) out += '\\' + c.toString(8).padStart(3, '0');
            else out += String.fromCharCode(c);
        }
        return out;
    }

    let _pdfMeasureCtx = null;
    function pdfTextWidth(str, font, size) {
        if (font === 'c' || font === 'cb') return String(str).length * 0.6 * size;
        if (!_pdfMeasureCtx) _pdfMeasureCtx = document.createElement('canvas').getContext('2d');
        const style = font === 'hb' ? 'bold ' : (font === 'hi' ? 'italic ' : '');
        _pdfMeasureCtx.font = `${style}1000px Helvetica, Arial, sans-serif`;
        return _pdfMeasureCtx.measureText(String(str)).width / 1000 * size;
    }

    function pdfWrap(str, font, size, maxW) {
        const lines = [];
        let cur = '';
        String(str).split(' ').forEach(word => {
            const t = cur ? cur + ' ' + word : word;
            if (!cur || pdfTextWidth(t, font, size) <= maxW) cur = t;
            else { lines.push(cur); cur = word; }
        });
        if (cur) lines.push(cur);
        return lines;
    }

    function pdfColor(hex) {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' ');
    }

    // y = distance depuis le haut de la page (comme en HTML)
    function makePdfPage(w, h) {
        const ops = [];
        const f = (v) => v.toFixed(2);
        return {
            w, h, ops,
            rect(x, y, wd, ht, o = {}) {
                if (o.fill) ops.push(`${pdfColor(o.fill)} rg ${f(x)} ${f(h - y - ht)} ${f(wd)} ${f(ht)} re f`);
                if (o.stroke) ops.push(`${pdfColor(o.stroke)} RG ${o.lw || 0.5} w ${f(x)} ${f(h - y - ht)} ${f(wd)} ${f(ht)} re S`);
            },
            line(x1, y1, x2, y2, color, lw = 0.5) {
                ops.push(`${pdfColor(color)} RG ${lw} w ${f(x1)} ${f(h - y1)} m ${f(x2)} ${f(h - y2)} l S`);
            },
            text(str, x, y, o = {}) {
                const font = o.font || 'h', size = o.size || 10;
                let px = x;
                if (o.align === 'c' || o.align === 'r') {
                    const tw = pdfTextWidth(str, font, size);
                    px = o.align === 'c' ? x - tw / 2 : x - tw;
                }
                ops.push(`BT ${pdfColor(o.color || '#0f172a')} rg /${PDF_FONTS[font]} ${size} Tf ${f(px)} ${f(h - y)} Td (${pdfEncode(str)}) Tj ET`);
            },
            image(x, y, wd, ht) {
                ops.push(`q ${wd} 0 0 ${ht} ${f(x)} ${f(h - y - ht)} cm /Im1 Do Q`);
            }
        };
    }

    function pdfAssemble(pages, logo) {
        const chunks = [];
        const offsets = [];
        let pos = 0;
        const push = (u8) => { chunks.push(u8); pos += u8.length; };
        const enc = new TextEncoder();
        const str = (s) => push(enc.encode(s));   // contenu strictement ASCII
        const obj = (n, body) => { offsets[n] = pos; str(`${n} 0 obj\n${body}\nendobj\n`); };

        const fontIds = [3, 4, 5, 6, 7];
        const imgId = 8;
        const firstPage = 9;
        const pageIds = pages.map((_, i) => firstPage + i * 2);

        str('%PDF-1.4\n');
        obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
        obj(2, `<< /Type /Pages /Kids [${pageIds.map(id => id + ' 0 R').join(' ')}] /Count ${pages.length} >>`);
        ['Helvetica', 'Helvetica-Bold', 'Courier', 'Courier-Bold', 'Helvetica-Oblique'].forEach((name, i) => {
            obj(fontIds[i], `<< /Type /Font /Subtype /Type1 /BaseFont /${name} /Encoding /WinAnsiEncoding >>`);
        });

        const img = logo || { w: 1, h: 1, data: new Uint8Array([255, 255, 255]) };
        offsets[imgId] = pos;
        str(`${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${img.data.length} >>\nstream\n`);
        push(img.data);
        str('\nendstream\nendobj\n');

        pages.forEach((pg, i) => {
            const pid = pageIds[i], cid = pid + 1;
            const content = pg.ops.join('\n');
            const fonts = fontIds.map((id, k) => `/F${k + 1} ${id} 0 R`).join(' ');
            obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pg.w.toFixed(2)} ${pg.h.toFixed(2)}] /Resources << /Font << ${fonts} >> /XObject << /Im1 ${imgId} 0 R >> >> /Contents ${cid} 0 R >>`);
            obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
        });

        const total = firstPage + pages.length * 2;
        const xrefPos = pos;
        let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
        for (let n = 1; n < total; n++) xref += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
        str(xref + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

        const out = new Uint8Array(pos);
        let o = 0;
        chunks.forEach(c => { out.set(c, o); o += c.length; });
        return out;
    }

    async function pdfLoadLogo() {
        try {
            const ico = document.querySelector('link[rel="icon"]');
            if (!ico) return null;
            const img = new Image();
            img.src = ico.href;
            await img.decode();
            const c = document.createElement('canvas');
            c.width = 96; c.height = 96;
            const cx = c.getContext('2d');
            cx.drawImage(img, 0, 0, 96, 96);
            const d = cx.getImageData(0, 0, 96, 96).data;
            const rgb = new Uint8Array(96 * 96 * 3);
            for (let i = 0, j = 0; i < d.length; i += 4) { rgb[j++] = d[i]; rgb[j++] = d[i + 1]; rgb[j++] = d[i + 2]; }
            return { w: 96, h: 96, data: rgb };
        } catch (e) { return null; }
    }

    // PAGE 1 — A4 PAYSAGE : temps de passage
    function pdfPageSplits(logo, dateStr) {
        const PW = 841.89, PH = 595.28, M = 28, W = PW - 2 * M;
        const pg = makePdfPage(PW, PH);
        let tx = M;
        if (logo) { pg.image(M, 24, 34, 34); tx = M + 44; }
        pg.text('FICHE TERRAIN — TEMPS DE PASSAGE FRACTIONNÉ', tx, 40, { font: 'hb', size: 15 });
        pg.text('Allures cibles sur piste et route selon % de VMA • Page 1 / 2', tx, 54, { font: 'h', size: 8.5, color: '#475569' });
        pg.text(`VMA : ${profile.vma.toFixed(1)} km/h (${speedToPace(profile.vma)}/km)`, M + W, 40, { font: 'cb', size: 12, color: '#0284c7', align: 'r' });
        pg.text(`Édité le ${dateStr}`, M + W, 54, { font: 'h', size: 8, color: '#475569', align: 'r' });
        pg.line(M, 64, M + W, 64, '#0f172a', 1.5);

        // Légende
        const legend = [
            ['100-200 m : VMA courte (100-105 %)', '#ffe4e6', '#9f1239'],
            ['300-600 m : VMA moyenne (96-100 %)', '#fee2e2', '#991b1b'],
            ['800-1000 m : VMA longue (90-95 %)', '#ffedd5', '#9a3412'],
            ['1500-2000 m : seuil SV2 (82-87 %)', '#fef3c7', '#92400e']
        ];
        let lx = M;
        pg.text('Allures conseillées :', lx, 83, { font: 'hb', size: 8 });
        lx += pdfTextWidth('Allures conseillées :', 'hb', 8) + 8;
        legend.forEach(([t, bg, fg]) => {
            const tw = pdfTextWidth(t, 'hb', 7.5) + 10;
            pg.rect(lx, 74, tw, 14, { fill: bg });
            pg.text(t, lx + 5, 83.5, { font: 'hb', size: 7.5, color: fg });
            lx += tw + 6;
        });

        // Tableau
        const top = 98, headH = 24;
        const bottomLimit = PH - 40;
        const rowH = Math.min(32, (bottomLimit - top - headH) / MATRIX_PCTS.length);
        const dW = (W - 142) / PDF_DISTS.length;
        const colW = [46, 46, 50, ...PDF_DISTS.map(() => dW)];
        const heads = ['% VMA', 'Vitesse', 'Allure', ...PDF_DISTS.map(d => d + ' m')];
        const colX = [];
        colW.reduce((acc, w, i) => { colX[i] = acc; return acc + w; }, M);

        pg.rect(M, top, W, headH, { fill: '#0f172a' });
        heads.forEach((t, i) => {
            if (i === 0) pg.text(t, colX[i] + 6, top + 15, { font: 'hb', size: 8.5, color: '#ffffff' });
            else pg.text(t, colX[i] + colW[i] / 2, top + 15, { font: 'hb', size: 8.5, color: '#ffffff', align: 'c' });
        });

        MATRIX_PCTS.forEach((pct, r) => {
            const y = top + headH + r * rowH;
            const sp = profile.vma * (pct / 100);
            const spm = 3600 / (sp * 1000);
            const base = pct === 100 ? '#f1f5f9' : '#ffffff';
            const cy = y + rowH / 2;
            colW.forEach((w, i) => pg.rect(colX[i], y, w, rowH, { fill: base, stroke: '#cbd5e1', lw: 0.5 }));
            pg.text(`${pct}%`, colX[0] + 6, cy + 4, { font: 'hb', size: 11 });
            pg.text(sp.toFixed(1), colX[1] + colW[1] / 2, cy + 3.7, { font: 'c', size: 10, color: '#475569', align: 'c' });
            pg.text(speedToPace(sp), colX[2] + colW[2] / 2, cy + 3.7, { font: 'cb', size: 10, color: '#0284c7', align: 'c' });
            PDF_DISTS.forEach((d, k) => {
                const i = 3 + k;
                const hl = getRecommendedHighlight(pct, d);
                let fg = '#1e293b', font = 'c';
                if (hl) {
                    const m = hl.pdfStyle.match(/background:\s*(#[0-9a-fA-F]{6});\s*color:\s*(#[0-9a-fA-F]{6})/);
                    if (m) {
                        pg.rect(colX[i], y, colW[i], rowH, { fill: m[1], stroke: '#cbd5e1', lw: 0.5 });
                        fg = m[2];
                        font = 'cb';
                    }
                }
                pg.text(formatTrack(d * spm), colX[i] + colW[i] / 2, cy + 3.9, { font, size: 10.5, color: fg, align: 'c' });
            });
        });

        // Pied de page
        const fy = PH - 22;
        pg.text('* Les cases colorées indiquent la plage d\'intensité recommandée pour chaque distance de répétition.', M, fy, { font: 'h', size: 7.5, color: '#475569' });
        pg.text('RunPace Pro', M + W, fy, { font: 'hb', size: 7.5, color: '#475569', align: 'r' });
        return pg;
    }

    // PAGE 2 — A4 PORTRAIT : zones, côte, projections
    function pdfPageZones(logo, dateStr) {
        const PW = 595.28, PH = 841.89, M = 36, W = PW - 2 * M;
        const pg = makePdfPage(PW, PH);
        let tx = M;
        if (logo) { pg.image(M, 28, 34, 34); tx = M + 44; }
        pg.text('RÉCAPITULATIF DES ZONES D\'ENTRAÎNEMENT', tx, 44, { font: 'hb', size: 14 });
        pg.text('Vitesse, fréquence cardiaque (Karvonen) et puissance • Page 2 / 2', tx, 58, { font: 'h', size: 8.5, color: '#475569' });
        pg.text(`Édité le ${dateStr}`, M + W, 58, { font: 'h', size: 8, color: '#475569', align: 'r' });
        pg.line(M, 70, M + W, 70, '#0f172a', 1.5);

        pg.rect(M, 80, W, 24, { fill: '#f1f5f9' });
        pg.text(`VMA : ${profile.vma.toFixed(1)} km/h  |  FC : ${profile.fcRepos}-${profile.fcMax} bpm  |  Poids : ${profile.poids.toFixed(1)} kg`, M + 10, 95.5, { font: 'cb', size: 10 });

        // Tableau des zones
        const top = 118, headH = 24, rowH = 64;
        const colW = [150, 95, 105, 95, W - 445];
        const colX = [];
        colW.reduce((acc, w, i) => { colX[i] = acc; return acc + w; }, M);
        const heads = ['Zone d\'entraînement', '% VMA & vitesse', 'Allure cible', 'FC cible (Karvonen)', 'Puissance'];
        pg.rect(M, top, W, headH, { fill: '#0f172a' });
        heads.forEach((t, i) => pg.text(t, colX[i] + 8, top + 15.5, { font: 'hb', size: 8, color: '#ffffff' }));

        ZONES_DEF.forEach((z, r) => {
            const y = top + headH + r * rowH;
            const sMin = profile.vma * (z.vmaMin / 100);
            const sMax = profile.vma * (z.vmaMax / 100);
            const watts = getZoneWatts(z.id);
            colW.forEach((w, i) => pg.rect(colX[i], y, w, rowH, { fill: i === 0 ? z.pdfBg : '#ffffff', stroke: '#cbd5e1', lw: 0.5 }));

            // Colonne zone (retour à la ligne automatique)
            let ty = y + 15;
            pdfWrap(z.name, 'hb', 8.5, colW[0] - 16).forEach(l => { pg.text(l, colX[0] + 8, ty, { font: 'hb', size: 8.5, color: z.pdfColor }); ty += 10.5; });
            ty += 1;
            pdfWrap(z.desc, 'h', 7, colW[0] - 16).forEach(l => { pg.text(l, colX[0] + 8, ty, { font: 'h', size: 7, color: '#334155' }); ty += 9; });

            const l1 = y + rowH / 2 - 2, l2 = y + rowH / 2 + 11;
            pg.text(`${z.vmaMin}-${z.vmaMax}%`, colX[1] + 8, l1, { font: 'cb', size: 10 });
            pg.text(`${sMin.toFixed(1)} - ${sMax.toFixed(1)} km/h`, colX[1] + 8, l2, { font: 'c', size: 7.5, color: '#475569' });
            pg.text(`${speedToPace(sMax)} - ${speedToPace(sMin)}/km`, colX[2] + 8, l1 + 5, { font: 'cb', size: 8.5 });
            pg.text(`${calcKarvonen(z.karvMin)} - ${calcKarvonen(z.karvMax)} bpm`, colX[3] + 8, l1, { font: 'cb', size: 9.5, color: '#be123c' });
            pg.text(`(${z.karvMin}-${z.karvMax}% FC rés.)`, colX[3] + 8, l2, { font: 'c', size: 7, color: '#475569' });
            if (watts > 0) {
                pg.text(`${watts} W`, colX[4] + 8, l1, { font: 'cb', size: 10, color: '#b45309' });
                if (profile.poids > 0) pg.text(`(${(watts / profile.poids).toFixed(2)} W/kg)`, colX[4] + 8, l2, { font: 'c', size: 7.5, color: '#475569' });
            } else {
                pg.text('Non renseigné', colX[4] + 8, l1 + 5, { font: 'hi', size: 8, color: '#64748b' });
            }
        });

        // Repère côte / D+
        const hy = top + headH + ZONES_DEF.length * rowH + 18;
        pg.rect(M, hy, W, 54, { fill: '#faf5ff', stroke: '#7e22ce', lw: 1.2 });
        pg.text('REPÈRE SPÉCIFIQUE CÔTE & FORT DÉNIVELÉ (D+)', M + 10, hy + 17, { font: 'hb', size: 9, color: '#581c87' });
        pdfWrap('Référence de puissance mécanique à maintenir en montée lorsque l\'allure (min/km) n\'est plus exploitable.', 'h', 7.5, W - 190)
            .forEach((l, i) => pg.text(l, M + 10, hy + 30 + i * 9.5, { font: 'h', size: 7.5, color: '#6b21a8' }));
        const hillW = profile.wHill;
        const hillTxt = hillW > 0 ? `${hillW} W` + (profile.poids > 0 ? ` (${(hillW / profile.poids).toFixed(2)} W/kg)` : '') : 'Non renseigné';
        pg.text(hillTxt, M + W - 10, hy + 32, { font: hillW > 0 ? 'cb' : 'hi', size: hillW > 0 ? 13 : 9, color: '#581c87', align: 'r' });

        // Projections de course
        const py = hy + 54 + 26;
        pg.text('PROJECTIONS CHRONOS COMPÉTITION', M, py, { font: 'hb', size: 11 });
        const ty0 = py + 10, cw = W / RACES.length;
        RACES.forEach((r, i) => {
            const x = M + i * cw;
            const pct = racePct(r);
            const sp = profile.vma * (pct / 100);
            const sec = (r.meters / 1000) / sp * 3600;
            pg.rect(x, ty0, cw, 24, { fill: '#f1f5f9', stroke: '#cbd5e1', lw: 0.5 });
            pg.rect(x, ty0 + 24, cw, 56, { fill: '#ffffff', stroke: '#cbd5e1', lw: 0.5 });
            pg.text(`${r.name} (${pct.toFixed(1).replace('.0', '')}% VMA)`, x + cw / 2, ty0 + 15.5, { font: 'hb', size: 8.5, align: 'c' });
            pg.text(formatRace(sec), x + cw / 2, ty0 + 24 + 27, { font: 'cb', size: 14, align: 'c' });
            pg.text(`${speedToPace(sp)}/km`, x + cw / 2, ty0 + 24 + 44, { font: 'c', size: 8, color: '#475569', align: 'c' });
        });

        // Pied de page
        const fy = PH - 30;
        pg.line(M, fy - 10, M + W, fy - 10, '#cbd5e1', 0.8);
        pg.text('Méthode Karvonen : FC cible = FC repos + % x (FC max - FC repos)', M, fy, { font: 'h', size: 7.5, color: '#475569' });
        pg.text('RunPace Pro • Fiche personnelle', M + W, fy, { font: 'hb', size: 7.5, color: '#475569', align: 'r' });
        return pg;
    }

    async function buildPdf() {
        const logo = await pdfLoadLogo();
        const dateStr = new Date().toLocaleDateString('fr-FR');
        const p1 = pdfPageSplits(logo, dateStr);
        const p2 = pdfPageZones(logo, dateStr);
        return pdfAssemble([p1, p2], logo);
    }

    async function exportPdf() {
        try {
            const bytes = await buildPdf();
            const d = new Date();
            const name = `RunPace_fiche_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.pdf`;
            const blob = new Blob([bytes], { type: 'application/pdf' });
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform));
            if (isMobile && window.File && navigator.canShare) {
                const file = new File([blob], name, { type: 'application/pdf' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Fiche RunPace Pro' });
                    return;
                }
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (e) {
            if (e && e.name === 'AbortError') return;   // partage annulé par l'utilisateur
            printTrainingSheet();                        // secours : impression du navigateur
        }
    }
