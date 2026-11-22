// RunPace Pro — Lecture des fichiers Garmin .fit et .zip
// (scripts classiques partageant le même espace global : l'ordre de chargement est dans index.html)
    // --- ONGLET SÉANCE : lecture d'un fichier Garmin .fit (tout reste sur l'appareil) ---
    const FIT_EPOCH = 631065600;
    const FIT_TYPES = {
        0: [1, 'u', 0xFF], 1: [1, 's', 0x7F], 2: [1, 'u', 0xFF], 3: [2, 's', 0x7FFF], 4: [2, 'u', 0xFFFF],
        5: [4, 's', 0x7FFFFFFF], 6: [4, 'u', 0xFFFFFFFF], 7: [1, 'str', null], 8: [4, 'f', null], 9: [8, 'd', null],
        10: [1, 'u', 0], 11: [2, 'u', 0], 12: [4, 'u', 0], 13: [1, 'u', 0xFF]
    };

    function fitDecode(buf) {
        const dv = new DataView(buf);
        const u8 = new Uint8Array(buf);
        const hs = dv.getUint8(0);
        if (hs < 12 || String.fromCharCode(u8[8], u8[9], u8[10], u8[11]) !== '.FIT') throw new Error('Ce fichier n\'est pas un .fit valide.');
        const end = Math.min(buf.byteLength - 2, hs + dv.getUint32(4, true));
        const defs = {};
        const out = { records: [], laps: [], sessions: [] };
        let pos = hs, lastTs = 0;
        while (pos < end) {
            const h = u8[pos++];
            let local, compOffset = null;
            if (h & 0x80) {
                local = (h >> 5) & 3; compOffset = h & 0x1F;
            } else if (h & 0x40) {
                local = h & 0x0F;
                const dev = (h & 0x20) !== 0;
                pos++;
                const le = u8[pos++] === 0;
                const gnum = dv.getUint16(pos, le); pos += 2;
                const n = u8[pos++];
                const fields = [];
                for (let i = 0; i < n; i++) { fields.push({ num: u8[pos], size: u8[pos + 1], type: u8[pos + 2] & 0x1F }); pos += 3; }
                let devSize = 0;
                if (dev) { const nd = u8[pos++]; for (let i = 0; i < nd; i++) { devSize += u8[pos + 1]; pos += 3; } }
                defs[local] = { gnum, le, fields, devSize };
                continue;
            } else {
                local = h & 0x0F;
            }
            const d = defs[local];
            if (!d) throw new Error('Fichier .fit illisible (définition manquante).');
            const keep = d.gnum === 20 || d.gnum === 19 || d.gnum === 18;
            const msg = keep ? {} : null;
            for (const f of d.fields) {
                if (keep) {
                    const t = FIT_TYPES[f.type];
                    if (t && t[1] !== 'str' && f.size >= t[0]) {
                        let v;
                        if (t[1] === 'u') {
                            v = t[0] === 1 ? dv.getUint8(pos) : t[0] === 2 ? dv.getUint16(pos, d.le) : dv.getUint32(pos, d.le);
                            if (v === t[2]) v = undefined;
                        } else if (t[1] === 's') {
                            v = t[0] === 1 ? dv.getInt8(pos) : t[0] === 2 ? dv.getInt16(pos, d.le) : dv.getInt32(pos, d.le);
                            if (v === t[2]) v = undefined;
                        } else if (t[1] === 'f') {
                            v = dv.getFloat32(pos, d.le); if (!isFinite(v)) v = undefined;
                        } else {
                            v = dv.getFloat64(pos, d.le); if (!isFinite(v)) v = undefined;
                        }
                        if (v !== undefined) msg[f.num] = v;
                    }
                }
                pos += f.size;
            }
            pos += d.devSize;
            if (!keep && compOffset === null) {
                // même sans conserver le message, on suit l'horloge si un timestamp est présent
            }
            if (compOffset !== null) {
                let ts = (lastTs & ~0x1F) + compOffset;
                if (compOffset < (lastTs & 0x1F)) ts += 0x20;
                lastTs = ts;
                if (msg) msg[253] = ts;
            } else if (msg && msg[253] !== undefined) {
                lastTs = msg[253];
            }
            if (!msg) continue;
            if (d.gnum === 20) out.records.push(msg);
            else if (d.gnum === 19) out.laps.push(msg);
            else out.sessions.push(msg);
        }
        return out;
    }

    // Lecture d'un .zip (export « original » de Garmin Connect) : on en extrait le premier .fit
    async function fitFromZip(buf) {
        const dv = new DataView(buf), u8 = new Uint8Array(buf);
        let e = buf.byteLength - 22;
        while (e >= 0 && dv.getUint32(e, true) !== 0x06054B50) e--;
        if (e < 0) throw new Error('Archive .zip illisible.');
        const n = dv.getUint16(e + 10, true);
        let p = dv.getUint32(e + 16, true);
        for (let i = 0; i < n; i++) {
            if (dv.getUint32(p, true) !== 0x02014B50) break;
            const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
            const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
            const lho = dv.getUint32(p + 42, true);
            const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl));
            p += 46 + nl + xl + cl;
            if (!/\.fit$/i.test(name)) continue;
            const lnl = dv.getUint16(lho + 26, true), lxl = dv.getUint16(lho + 28, true);
            const data = u8.subarray(lho + 30 + lnl + lxl, lho + 30 + lnl + lxl + csize);
            if (method === 0) return data.slice().buffer;
            if (method === 8) {
                if (typeof DecompressionStream === 'undefined') throw new Error('Ce navigateur ne sait pas ouvrir les .zip : décompresse le fichier puis choisis le .fit.');
                const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
                return await new Response(stream).arrayBuffer();
            }
        }
        throw new Error('Aucun fichier .fit trouvé dans l\'archive.');
    }
