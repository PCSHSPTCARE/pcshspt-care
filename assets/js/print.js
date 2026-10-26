/* หน้าพิมพ์รวม: พิมพ์ใบแจ้งซ่อมหลายรายการเป็นไฟล์เดียว และรายงานสถิติแยกหมวด
   ทุกหน้าเป็น A4 ขนาดคงที่ พิมพ์ผ่านปุ่ม "พิมพ์" (บันทึกเป็น PDF ได้) */
const Print = (() => {
  const S = () => Store.settings();
  const DAY = 864e5;

  // ส่วนหัวรายงาน (ตราโรงเรียน)
  function reportHead(title, sub) {
    const s = S();
    return `
      <header class="rp-head">
        <img src="images/logo.png" alt="">
        <div><div class="rp-t1">${esc(title)}</div><div class="rp-t2">${esc(s.unit)} ${esc(s.division)} · ${esc(s.schoolName)}</div>${sub ? `<div class="rp-t3">${esc(sub)}</div>` : ''}</div>
      </header>`;
  }
  const foot = (page, total, extra = '') => `<footer class="rp-foot"><span>${esc(extra)}</span><span>พิมพ์เมื่อ ${UI.dateTime(new Date().toISOString())} · หน้า ${page}/${total}</span></footer>`;

  function periodText(list) {
    if (!list.length) return '-';
    const ds = list.map(t => +new Date(t.createdAt));
    return `${UI.dateLong(new Date(Math.min(...ds)).toISOString())} – ${UI.dateLong(new Date(Math.max(...ds)).toISOString())}`;
  }

  // ───────── หน้าปก ─────────
  function cover(job, list) {
    const me = Store.me();
    const byStatus = UI.STATUS_KEYS.map(k => [UI.STATUS[k].label, list.filter(t => t.status === k).length]);
    const byForm = Store.FORM_KEYS.map(k => [Views.formName(k), list.filter(t => t.formType === k).length]).filter(x => x[1]);
    return `
      <div class="sheet rp cover">
        <div class="cv-top"><img src="images/logo.png" alt=""><div class="cv-school">${esc(S().schoolName)}</div><div class="cv-div">${esc(S().unit)} · ${esc(S().division)}</div></div>
        <div class="cv-title">${esc(job.title)}</div>
        <div class="cv-sub">${esc(job.scope || 'ทุกหมวด')} · ${list.length} รายการ</div>
        <div class="cv-period">ช่วงวันที่แจ้ง ${periodText(list)}</div>
        <div class="cv-grid">
          <table class="rp-table"><thead><tr><th>สถานะ</th><th class="r">จำนวน</th></tr></thead><tbody>${byStatus.map(([l, n]) => `<tr><td>${l}</td><td class="r">${n}</td></tr>`).join('')}<tr class="tot"><td>รวม</td><td class="r">${list.length}</td></tr></tbody></table>
          <table class="rp-table"><thead><tr><th>หมวดหลัก</th><th class="r">จำนวน</th></tr></thead><tbody>${byForm.map(([l, n]) => `<tr><td>${esc(l)}</td><td class="r">${n}</td></tr>`).join('')}</tbody></table>
        </div>
        <div class="cv-sign">
          <div>ลงชื่อ<span class="dotline"></span>ผู้รายงาน</div>
          <div>( ${esc(Store.fullName(me))} )</div>
          <div>${esc(me.position || '')}</div>
          <div>วันที่ ${UI.dateLong(new Date().toISOString())}</div>
        </div>
      </div>`;
  }

  function divider(formKey, list) {
    return `
      <div class="sheet rp divider">
        <div class="dv-inner">
          <div class="dv-ic">${icon(UI.FORM_ICON[formKey])}</div>
          <div class="dv-title">${esc(Views.formName(formKey))}</div>
          <div class="dv-sub">${list.length} รายการ · ${UI.STATUS_KEYS.map(k => `${UI.STATUS[k].label} ${list.filter(t => t.status === k).length}`).join(' · ')}</div>
        </div>
      </div>`;
  }

  // ตารางสรุป (แบ่งหน้าอัตโนมัติ)
  function tablePages(title, sub, list, startNo = 1) {
    const PER = 15;
    const pages = [];
    for (let i = 0; i < Math.max(1, list.length); i += PER) pages.push(list.slice(i, i + PER));
    return pages.map((rows, p) => `
      <div class="sheet rp">
        ${reportHead(title, sub)}
        <table class="rp-table rp-list">
          <thead><tr><th style="width:8mm">ที่</th><th style="width:34mm">เลขที่ / วันที่แจ้ง</th><th>รายการ / อาการ</th><th style="width:34mm">สถานที่</th><th style="width:29mm">ผู้แจ้ง</th><th style="width:27mm">สถานะ</th></tr></thead>
          <tbody>${rows.map((t, i) => `<tr>
            <td class="c">${startNo + p * PER + i}</td>
            <td><b>${esc(t.id)}</b><div class="m">${UI.dateTime(t.createdAt)}</div></td>
            <td><div class="clamp">${esc(Views.itemsTitle(t))}</div><div class="m clamp1">${esc(t.items.map(i => i.detail).filter(Boolean).join(" · "))}</div></td>
            <td><div class="clamp">${esc(UI.locationText(t))}</div></td>
            <td><div class="clamp">${esc(t.reporter.name)}</div></td>
            <td><span class="rp-st st-${t.status}">${esc(UI.STATUS[t.status].label)}</span>${t.completion?.at || t.cannot?.at ? `<div class="m">${UI.date(t.completion?.at || t.cannot?.at)}</div>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="c">ไม่มีรายการ</td></tr>'}</tbody>
        </table>
        ${foot(p + 1, pages.length, sub)}
      </div>`).join('');
  }

  // ═══════════ พิมพ์รวมใบแจ้งซ่อม ═══════════
  function batch(params) {
    let job = null;
    const me = Store.me();
    // เปิดจากลิงก์ตรง เช่น #/print?style=table&form=dorm
    if (params.style) {
      const ids = Store.visibleTickets(me).filter(t => !params.form || t.formType === params.form).map(t => t.id);
      job = { ids, style: params.style, group: params.group !== '0', cover: params.cover !== '0', title: 'รายงานการแจ้งซ่อมอาคารและสถานที่', scope: params.form ? Views.formName(params.form) : 'ทุกหมวด' };
    } else {
      try { job = JSON.parse(sessionStorage.getItem('pcshs-print') || 'null'); } catch (e) { /* ignore */ }
    }
    const list = (job?.ids || []).map(id => Store.ticket(id)).filter(t => t && Store.canSee(me, t)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!job || !list.length) return Pages.notFound();
    const styleName = { memo: 'บันทึกข้อความ (มีตราครุฑ)', plain: 'ใบแจ้งซ่อม (ไม่มีตราครุฑ)', table: 'ตารางสรุป' }[job.style];
    const build = () => {
      const groups = job.group ? Store.FORM_KEYS.map(k => [k, list.filter(t => t.formType === k)]).filter(g => g[1].length) : [['', list]];
      let html = job.cover ? cover(job, list) : '';
      let no = 1;
      for (const [k, items] of groups) {
        if (job.style === 'table') {
          html += tablePages(job.title, `${k ? Views.formName(k) : (job.scope || 'ทุกหมวด')} · ${items.length} รายการ`, items, no);
        } else {
          if (k) html += divider(k, items);
          html += items.map(t => Doc.sheet(t, job.style) + (job.photos !== false ? Doc.photoSheet(t) : '')).join('');
        }
        no += items.length;
      }
      return html;
    };
    return {
      title: 'พิมพ์รวม',
      html: `
      <div class="doc-page">
        <div class="doc-toolbar">
          <a class="btn btn-outline btn-sm" href="#${Store.isStaff(me) ? '/admin/jobs' : '/my'}">${icon('back')} กลับ</a>
          <div><div class="t">${esc(job.title)}</div><div class="sub">${list.length} รายการ · ${styleName}${job.group ? ' · แยกหมวด' : ''}</div></div>
          <span class="spacer"></span>
          <button class="btn btn-outline btn-sm" id="printBtn">${icon('printer')} พิมพ์ / บันทึกเป็น PDF</button>
          <button class="btn btn-primary btn-sm" id="pdfBtn">${icon('download')} ดาวน์โหลด PDF</button>
        </div>
        <div class="doc-stage">
          <div class="doc-hint">${icon('printer')}<span>แนะนำปุ่ม "พิมพ์ / บันทึกเป็น PDF" แล้วเลือกปลายทาง "บันทึกเป็น PDF" ได้ไฟล์คมชัดและเร็วที่สุด${list.length > 25 ? ' · ปุ่มดาวน์โหลดอาจใช้เวลานานเมื่อมีหลายรายการ' : ''}</span></div>
          <div id="sheets">${build()}</div>
        </div>
      </div>`,
      mount(root) {
        const box = $('#sheets', root);
        Doc.refit(box);
        $('#printBtn', root).addEventListener('click', () => window.print());
        $('#pdfBtn', root).addEventListener('click', e => Doc.downloadPdf(box, `${job.title}.pdf`, e.currentTarget));
      }
    };
  }

  // ═══════════ รายงานสถิติ (PDF) ═══════════
  function trendSvg(buckets) {
    const W = 170, H = 58, pl = 9, pb = 9, pt = 4, pr = 3;
    const max = Math.max(1, ...buckets.flatMap(b => [b.created, b.done]));
    const step = Math.ceil(max / 4) || 1, top = step * 4;
    const x = i => pl + (buckets.length <= 1 ? (W - pl - pr) / 2 : i * (W - pl - pr) / (buckets.length - 1));
    const y = v => pt + (H - pt - pb) * (1 - v / top);
    const line = key => buckets.map((b, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(b[key]).toFixed(1)}`).join(' ');
    const every = Math.ceil(buckets.length / 12);
    return `<svg class="rp-svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm" role="img" aria-label="แนวโน้มการแจ้งซ่อม">
      ${[0, 1, 2, 3, 4].map(i => `<line x1="${pl}" x2="${W - pr}" y1="${y(i * step)}" y2="${y(i * step)}" stroke="#ddd" stroke-width=".2"/><text x="${pl - 1.5}" y="${y(i * step) + 1}" text-anchor="end" font-size="2.6" fill="#666">${i * step}</text>`).join('')}
      ${buckets.map((b, i) => i % every === 0 ? `<text x="${x(i)}" y="${H - 3}" text-anchor="middle" font-size="2.5" fill="#666">${esc(b.label)}</text>` : '').join('')}
      <path d="${line('created')}" fill="none" stroke="#eb6834" stroke-width=".6"/>
      <path d="${line('done')}" fill="none" stroke="#2a78d6" stroke-width=".6"/>
      ${buckets.map((b, i) => `<circle cx="${x(i)}" cy="${y(b.created)}" r=".8" fill="#fff" stroke="#eb6834" stroke-width=".4"/><circle cx="${x(i)}" cy="${y(b.done)}" r=".8" fill="#fff" stroke="#2a78d6" stroke-width=".4"/>`).join('')}
    </svg>`;
  }
  const barTable = (title, rows, unit, limit = 8) => {
    const top = Math.max(1, ...rows.map(r => r[1]));
    return `<section class="rp-block"><h3>${esc(title)}</h3>${rows.length ? `<table class="rp-table rp-bars"><colgroup><col style="width:6mm"><col><col style="width:22mm"><col style="width:15mm"></colgroup><tbody>${rows.slice(0, limit).map(([k, v], i) => `
      <tr><td class="c">${i + 1}</td><td><div class="clamp1" title="${esc(k)}">${esc(k)}</div></td><td><span class="bar"><span style="width:${v / top * 100}%"></span></span></td><td class="r">${v} ${unit}</td></tr>`).join('')}</tbody></table>` : '<p class="rp-empty">ไม่มีข้อมูล</p>'}</section>`;
  };

  function report() {
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem('pcshs-report') || 'null'); } catch (e) { /* ignore */ }
    state = state || { range: '365d', form: '' };
    const { list, from, to } = Admin.statsRange(state);
    const st = Admin.computeStats(list, from, to);
    const scope = state.form ? Views.formName(state.form) : 'ทุกหมวด';
    const period = `${UI.dateLong(from.toISOString())} – ${UI.dateLong(new Date(to - 1).toISOString())}`;
    const filters = [state.cat && `หมวดงาน: ${state.cat}`, state.loc && `สถานที่: ${state.loc}`, state.dept && `ฝ่าย: ${state.dept}`].filter(Boolean).join(' · ');
    const sub = `${scope} · ${period}${filters ? ' · ' + filters : ''}`;
    const title = 'รายงานสรุปการแจ้งซ่อมอาคารและสถานที่';
    const listPages = Math.max(1, Math.ceil(list.length / 15));
    const total = 2 + listPages;
    const kpi = (l, v, u) => `<div class="rp-kpi"><div class="l">${l}</div><div class="v">${v}<small>${u}</small></div></div>`;
    const pages = `
      <div class="sheet rp">
        ${reportHead(title, sub)}
        <div class="rp-kpis">
          ${kpi('แจ้งซ่อมทั้งหมด', UI.num(st.total), 'รายการ')}
          ${kpi('เสร็จสิ้น', UI.num(st.byStatus.done), `รายการ (${st.successPct}%)`)}
          ${kpi('กำลังดำเนินการ', UI.num(st.byStatus.in_progress), 'รายการ')}
          ${kpi('รอพิจารณา', UI.num(st.byStatus.review), 'รายการ')}
          ${kpi('รออนุมัติ', UI.num(st.byStatus.pending), 'รายการ')}
          ${kpi('ไม่สามารถซ่อมได้', UI.num(st.byStatus.cannot_fix), 'รายการ')}
          ${kpi('เวลาเฉลี่ยแจ้ง → เสร็จสิ้น', st.avgFix.toFixed(1), 'วัน')}
          ${kpi('ตอบรับครั้งแรกเฉลี่ย', st.avgResp.toFixed(1), 'ชั่วโมง')}
        </div>
        <section class="rp-block"><h3>แนวโน้มการแจ้งซ่อม${st.daily ? 'รายวัน' : 'รายเดือน'} <span class="lg"><i style="background:#eb6834"></i>แจ้งซ่อม <i style="background:#2a78d6"></i>เสร็จสิ้น</span></h3>${trendSvg(st.buckets)}</section>
        ${state.form ? `
        <section class="rp-block"><h3>สรุปรายเดือน</h3><table class="rp-table"><thead><tr><th>ช่วงเวลา</th><th class="r">แจ้งซ่อม</th><th class="r">เสร็จสิ้น</th></tr></thead>
          <tbody>${st.buckets.slice(-12).map(b => `<tr><td>${esc(b.label)}</td><td class="r">${b.created}</td><td class="r">${b.done}</td></tr>`).join('')}</tbody></table></section>` : `
        <section class="rp-block"><h3>เปรียบเทียบ 3 หมวดหลัก</h3><table class="rp-table"><thead><tr><th>หมวดหลัก</th><th class="r">แจ้งซ่อม</th><th class="r">สัดส่วน</th><th class="r">ยังไม่ปิดงาน</th><th class="r">เสร็จสิ้น</th><th class="r">เวลาเฉลี่ย (วัน)</th></tr></thead>
          <tbody>${st.formTime.map(f => `<tr><td>${esc(f.name)}</td><td class="r">${f.n}</td><td class="r">${st.total ? Math.round(f.n / st.total * 100) : 0}%</td><td class="r">${f.open}</td><td class="r">${f.done}</td><td class="r">${f.avg === null ? '—' : f.avg.toFixed(1)}</td></tr>`).join('')}
          <tr class="tot"><td>รวม</td><td class="r">${st.total}</td><td class="r">100%</td><td class="r">${st.byStatus.pending + st.byStatus.in_progress + st.byStatus.review}</td><td class="r">${st.byStatus.done}</td><td class="r">${st.avgFix.toFixed(1)}</td></tr></tbody></table></section>`}
        <section class="rp-block"><h3>สถานะงาน</h3><table class="rp-table rp-bars" style="table-layout:fixed"><colgroup><col style="width:46mm"><col><col style="width:22mm"><col style="width:18mm"></colgroup><tbody>
          ${UI.STATUS_KEYS.map(k => `<tr><td>${UI.STATUS[k].label}</td><td><span class="bar"><span style="width:${st.total ? st.byStatus[k] / st.total * 100 : 0}%"></span></span></td><td class="r">${st.byStatus[k]} รายการ</td><td class="r">${st.total ? Math.round(st.byStatus[k] / st.total * 100) : 0}%</td></tr>`).join('')}
        </tbody></table></section>
        ${foot(1, total, scope)}
      </div>
      <div class="sheet rp">
        ${reportHead(title, sub)}
        <div class="rp-cols">
          ${barTable('หมวดงานที่แจ้งซ่อม', st.cats, 'งาน')}
          ${barTable('รายการที่ซ่อมบ่อยที่สุด', st.items, 'ครั้ง')}
          ${barTable('สถานที่ที่แจ้งซ่อมบ่อย', st.locs, 'ครั้ง')}
          ${barTable('ฝ่ายงาน / กลุ่มสาระที่แจ้งซ่อม', st.depts.map(([k, v]) => [k.replace('กลุ่มสาระการเรียนรู้', 'กลุ่มสาระฯ '), v]), 'งาน')}
          ${barTable('สาเหตุที่ซ่อมไม่ได้', st.cannot, 'งาน', 5)}
          ${barTable('ผู้ปฏิบัติงาน (งานที่เสร็จสิ้น)', st.workers, 'งาน', 5)}
        </div>
        <section class="rp-block rp-note"><h3>ข้อสังเกต</h3><ul>
          ${st.locs.filter(([, v]) => v >= 3).slice(0, 3).map(([k, v]) => `<li>${esc(k)} แจ้งซ่อม ${v} ครั้ง ควรพิจารณาปรับปรุงหรือเปลี่ยนครุภัณฑ์</li>`).join('')}
          ${st.stale ? `<li>มีงานที่ยังไม่ปิดเกิน ${S().staleDays || 7} วัน จำนวน ${st.stale} รายการ</li>` : ''}
          ${st.cats[0] ? `<li>หมวดที่แจ้งซ่อมมากที่สุดคือ ${esc(st.cats[0][0])} (${st.cats[0][1]} งาน)</li>` : ''}
        </ul></section>
        ${foot(2, total, scope)}
      </div>
      ${tablePages(title, `ภาคผนวก: รายการแจ้งซ่อม · ${sub}`, [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))).replace(/หน้า (\d+)\/\d+/g, (m, n) => `หน้า ${+n + 2}/${total}`)}`;
    return {
      title: 'รายงานสถิติ',
      html: `
      <div class="doc-page">
        <div class="doc-toolbar">
          <a class="btn btn-outline btn-sm" href="#/admin/stats">${icon('back')} กลับ</a>
          <div><div class="t">${title}</div><div class="sub">${esc(sub)} · ${list.length} รายการ · ${total} หน้า</div></div>
          <span class="spacer"></span>
          <button class="btn btn-outline btn-sm" id="printBtn">${icon('printer')} พิมพ์ / บันทึกเป็น PDF</button>
          <button class="btn btn-primary btn-sm" id="pdfBtn">${icon('download')} ดาวน์โหลด PDF</button>
        </div>
        <div class="doc-stage"><div id="sheets">${pages}</div></div>
      </div>`,
      mount(root) {
        $('#printBtn', root).addEventListener('click', () => window.print());
        $('#pdfBtn', root).addEventListener('click', e => Doc.downloadPdf($('#sheets', root), `${title}-${scope}.pdf`, e.currentTarget));
      }
    };
  }

  return { batch, report };
})();
