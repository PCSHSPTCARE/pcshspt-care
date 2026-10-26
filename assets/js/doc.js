/* ใบขออนุญาตแจ้งซ่อมและบำรุงรักษา — จัดวางตามแบบฟอร์มของโรงเรียน (บท00 ขอแจ้งซ่อมทั่วไป / หอพัก)
   ทั้งสองแบบใช้โครงเดียวกัน ต่างกันที่ "เรื่อง" และผู้พิจารณาช่องซ้าย (หัวหน้างานอาคารฯ / รอง ผอ.ฝ่ายกิจการนักเรียนและหอพัก)
   style 'memo' = บันทึกข้อความมีตราครุฑ · 'plain' = หัวกระดาษตราโรงเรียน (ไม่มีตราครุฑ) เนื้อหาเหมือนกัน
   ตำแหน่งวัดจากไฟล์ "บท00 ขอแจ้งซ่อม… ว่าง.pdf" เป็นมิลลิเมตร (y = กึ่งกลางบรรทัด · ระยะบรรทัด 7.4)
   กรอกข้อความลงช่องว่างตรง ๆ ไม่มีจุดไข่ปลา · ข้อความยาวเกินช่อง → ย่อตัวอักษรอัตโนมัติ (fit) */
const Doc = (() => {
  const LH = 7.4;
  const L = {
    garuda: [18.8, 5.4, 21], title: 18.4,
    head: { org: 26.3, no: 33.75, subject: 41.2, rule: 47.8, to: 55.9 },
    me: 67.6, dept: 74.9, intro: 82.35, items: 89.8, qty: 97.1, place: 104.5, symptom: 111.9, symptomEnd: 136.4,
    rsign: 141.5, rname: 148.9,
    ap: { head: 156.3, ok: 163.75, no: 171.1, sign: 186.1, name: 193.5, title: 200.9, top: 153.2, bottom: 205.5 },
    ins: { head: 216, result: 223.7, sign: 238.5, name: 245.9, date: 253.3 }
  };
  const DIVIDER = { general: 112.5, dorm: 115 }; // เส้นตั้งคั่นช่องผู้พิจารณา (ช่องซ้ายของหอพักยาวกว่า)

  // ───────── ชิ้นส่วนเอกสาร ─────────
  const T = (html, x, y) => `<div class="hl" style="left:${x}mm;top:${y}mm">${html}</div>`;
  const V = (v, x, y, w, align = 'left', bold = false) =>
    `<div class="fv ${bold ? 'b' : ''}" style="left:${x}mm;top:${y}mm;width:${w}mm;text-align:${align}"><span>${esc(v ?? '')}</span></div>`;
  const P = (html, x, y, w, lines) => `<div class="fpara" style="left:${x}mm;top:${y - LH / 2}mm;width:${w}mm;height:${lines * LH}mm">${html}</div>`;
  // ลายเซ็น: วางเหนือเส้นบรรทัด "ลงชื่อ"
  // กล่องสูง 15 มม. ขอบล่างเลยเส้นบรรทัดเล็กน้อยเหมือนเซ็นจริง · ขอบว่างรอบลายเซ็นถูกตัดออกตอนแสดงผล (trimSigs)
  const SG = (img, x, y, w) => img ? `<img class="fsig" src="${img}" alt="" style="left:${x}mm;top:${y - 12}mm;width:${w}mm">` : '';
  const CB = on => `<span class="cb ${on ? 'on' : ''}"></span>`;
  const GARUDA = () => typeof GARUDA_SRC !== 'undefined' ? GARUDA_SRC : 'images/garuda.png';

  function dateParts(iso) {
    if (!iso) return ['', '', ''];
    const d = new Date(iso);
    return [d.getDate(), UI.TH_MONTHS[d.getMonth()], d.getFullYear() + 543];
  }
  const subjectOf = t => Store.settings().forms[t.formType]?.subject || 'ขออนุญาตแจ้งซ่อมและบำรุงรักษา';

  // ส่วนหัว: บันทึกข้อความ (มีตราครุฑ)
  function memoHeader(t) {
    const s = Store.settings();
    const [no, yr] = String(t.docNo || '').split('/');
    const [dd, mm, yy] = dateParts(t.createdAt);
    const H = L.head;
    return `
      <img class="garuda" src="${GARUDA()}" alt="" style="left:${L.garuda[0]}mm;top:${L.garuda[1]}mm;height:${L.garuda[2]}mm">
      ${s.showRefOnDoc ? `<div class="ref">อ้างอิงระบบ ${esc(t.id)}</div>` : ''}
      <div class="doc-title" style="top:${L.title}mm">บันทึกข้อความ</div>
      ${T('<b>ส่วนราชการ</b>', 22.5, H.org)}${V(s.schoolName, 46.5, H.org, 140)}
      ${T('<b>ที่</b>', 22.5, H.no)}${V(no, 27, H.no, 13, 'center')}${T('/', 40.4, H.no)}${V(yr, 42, H.no, 20)}
      ${T('<b>วันที่</b>', 98.7, H.no)}${V(dd, 109, H.no, 8, 'center')}${T('/', 117, H.no)}${V(mm, 118.5, H.no, 32, 'center')}${T('/', 151, H.no)}${V(yy, 152.5, H.no, 20)}
      ${subjectTo(t, s)}`;
  }
  // เรื่อง · เส้นคั่น · เรียน (ใช้ทั้งแบบมีและไม่มีตราครุฑ)
  const subjectTo = (t, s) => `
      ${T('<b>เรื่อง</b>', 22.5, L.head.subject)}${V(subjectOf(t), 30.6, L.head.subject, 152)}
      <div class="rule" style="top:${L.head.rule}mm;left:23.8mm;width:160mm;border-top-width:.53mm"></div>
      ${T('<b>เรียน</b>', 22.5, L.head.to)}${V(s.addressee, 31.4, L.head.to, 152)}`;

  // ส่วนหัว: ใบแจ้งซ่อม (ไม่มีตราครุฑ) หัวกระดาษตราโรงเรียน
  function plainHeader(t) {
    const s = Store.settings();
    return `
      <div class="ph-head" style="left:22.5mm;right:20mm">
        <img class="ph-logo" src="images/logo.png" alt="">
        <div class="ph-title">
          <div class="ph-t1">ใบ${esc(s.forms[t.formType].name)}</div>
          <div class="ph-t2">${esc(s.unit)} ${esc(s.division)}</div>
          <div class="ph-t3">${esc(s.schoolName)}</div>
        </div>
        <div class="ph-meta">
          <div><span>เลขที่</span><b>${esc(t.docNo)}</b></div>
          <div><span>วันที่แจ้ง</span><b>${UI.dateLong(t.createdAt)}</b></div>
          <div><span>เวลา</span><b>${UI.time(t.createdAt)} น.</b></div>
          <div><span>อ้างอิง</span><b>${esc(t.id)}</b></div>
        </div>
      </div>
      ${subjectTo(t, s)}`;
  }

  // ───────── เนื้อหา: รายการ / รวมจำนวน / สถานที่ / อาการ (ต่อกันไม่เว้นบรรทัด) ─────────
  // รายการ/อุปกรณ์ = ชื่อรายการ · รวมจำนวน = จำนวนพร้อมหน่วยของแต่ละรายการตามลำดับ (ไม่มีหน่วย/จำนวน = "-")
  const qtyText = i => i.qty ? `${i.qty}${i.unit ? ` ${String(i.unit).split('/')[0]}` : ''}` : '-';
  const symptomsText = t => [
    ...t.items.filter(i => String(i.detail || '').trim()).map(i => t.items.length > 1 ? `${i.name}: ${i.detail}` : i.detail),
    t.note ? `หมายเหตุ: ${t.note}` : ''
  ].filter(Boolean).join('  ');

  function body(t) {
    const r = t.reporter || {};
    // ลายเซ็นผู้แจ้ง: ที่บันทึกไว้ตอนแจ้ง หรือจากโปรไฟล์ปัจจุบัน (ใบเก่าก่อนมีระบบลายเซ็นบังคับ)
    const sig = r.signature || Store.userByEmail(r.email)?.signature || '';
    const symLines = Math.round((L.symptomEnd - L.symptom) / LH) + 1;
    return `
      ${T('ด้วยข้าพเจ้า', 24.5, L.me)}${V(r.name, 45, L.me, 71, 'center')}
      ${T('ตำแหน่ง', 117.8, L.me)}${V(r.position, 133, L.me, 58, 'center')}
      ${T('ฝ่ายงาน/กลุ่มสาระฯ', 24.5, L.dept)}${V(r.dept, 57, L.dept, 71, 'center')}
      ${T('เบอร์ติดต่อ', 129.8, L.dept)}${V(r.phone, 150, L.dept, 41, 'center')}
      ${T('มีความประสงค์ขอแจ้งซ่อมแซม/บำรุงรักษา เนื่องจากตรวจพบการชำรุดหรือขัดข้อง โดยมีรายละเอียดดังนี้', 24.5, L.intro)}
      ${T('รายการ/อุปกรณ์', 37.2, L.items)}${V(t.items.map(i => i.name).join(', '), 65, L.items, 126)}
      ${T('รวมจำนวน', 37.2, L.qty)}${V(t.items.map(qtyText).join(', '), 57, L.qty, 134)}
      ${T('สถานที่', 37.2, L.place)}${V(UI.locationText(t), 51.3, L.place, 140)}
      ${P(`ลักษณะการชำรุด/อาการที่พบ&nbsp;&nbsp;${esc(symptomsText(t))}`, 37.2, L.symptom, 154, symLines)}
      ${T('ลงชื่อ', 138.8, L.rsign)}${SG(sig, 152.4, L.rsign, 24.2)}${T('ผู้แจ้ง', 176.9, L.rsign)}
      ${T('(', 138.8, L.rname)}${V(r.name, 140.3, L.rname, 50, 'center')}${T(')', 191.2, L.rname)}`;
  }

  // ───────── ผู้พิจารณา 2 คอลัมน์ คั่นด้วยเส้นตั้ง (ลงลายเซ็นอัตโนมัติเมื่อเริ่มดำเนินการ) ─────────
  function approvals(t) {
    const A = L.ap, d = DIVIDER[t.formType] || DIVIDER.general, rx = d + 2;
    const lw = d - 22.5, rw = 193 - rx;
    const a1 = t.approvals?.step1, a2 = t.approvals?.step2;
    const p1 = a1?.by || Store.signer(Store.step1Key(t)), p2 = a2?.by || Store.signer(Store.STEP2_KEY);
    const nm = n => n ? `(${n})` : '(                                        )';
    return `
      <div class="vrule" style="left:${d}mm;top:${A.top}mm;height:${A.bottom - A.top}mm"></div>
      ${V(p1.title, 24.5, A.head, lw - 3, 'left', true)}
      ${T(`${CB(!!a1)}เห็นควรพิจารณาอนุญาตดำเนินการ`, 25.9, A.ok)}
      ${T(`${CB(false)}ไม่อนุญาต เนื่องจาก`, 25.9, A.no)}
      ${T('ลงชื่อ', 49.9, A.sign)}${SG(a1?.by.signature, 61, A.sign, 40)}
      ${V(nm(p1.name), 22.5, A.name, lw, 'center')}
      ${V(p1.title, 22.5, A.title, lw, 'center')}
      ${V(p2.title, rx, A.head, rw, 'left', true)}
      ${T('พิจารณา/สั่งการ', rx, A.ok)}
      ${P(esc(a2?.note || ''), rx, A.no, rw, 2)}
      ${T('ลงชื่อ', d + 27.4, A.sign)}${SG(a2?.by.signature, d + 41.5, A.sign, 37)}
      ${V(nm(p2.name), rx, A.name, rw, 'center')}
      ${V(p2.title, rx, A.title, rw, 'center')}`;
  }

  // ───────── ผู้ตรวจงาน: ติ๊ก ลงชื่อ และวันที่ เมื่อปิดงานแล้วเท่านั้น (ยังไม่ปิด = เว้นว่าง) ─────────
  function inspection(t) {
    const I = L.ins, insp = t.inspection;
    const done = t.status === 'done', cannot = t.status === 'cannot_fix', closed = done || cannot;
    const [dd, mm, yy] = closed ? dateParts(insp?.at || t.completion?.at || t.cannot?.at) : ['', '', ''];
    return `
      ${T('<b>ผู้ตรวจงาน</b>', 24.5, I.head)}
      ${T('<b>การดำเนินงาน</b>', 24.5, I.result)}
      ${T(`${CB(done)}เรียบร้อยดี`, 50.3, I.result)}
      ${T(`${CB(false)}ยังไม่แล้วเสร็จ`, 74.8, I.result)}
      ${T(`${CB(cannot)}ไม่สามารถแก้ไขได้`, 104.3, I.result)}
      ${T('ลงชื่อ', 126.1, I.sign)}${closed ? SG(insp?.by.signature, 140.4, I.sign, 23.6) : ''}${T('ผู้ตรวจงาน', 164.2, I.sign)}
      ${T('(', 126.1, I.name)}${V(closed ? insp?.by.name : '', 127.6, I.name, 50.5, 'center')}${T(')', 178.4, I.name)}
      ${T('วันที่', 126.1, I.date)}${V(dd, 136.3, I.date, 5.8, 'center')}${T('/', 142.2, I.date)}${V(mm, 143.6, I.date, 16, 'center')}${T('/', 159.7, I.date)}${V(yy, 161.2, I.date, 14)}`;
  }

  function memo(t, style) {
    return `
      <div class="sheet memo ${style}">
        ${style === 'plain' ? plainHeader(t) : memoHeader(t)}
        ${body(t)}
        ${approvals(t)}
        ${inspection(t)}
      </div>`;
  }

  // หน้าภาพประกอบ: หน้าละ 4 รูป (2×2 รูปละ ~1/4 หน้า) แสดงเต็มภาพไม่ตัดขอบ · รูปตอนแจ้งก่อน แล้วต่อด้วยรูปหลังซ่อม (มีป้ายกำกับ)
  function photoSheet(t) {
    const PER_PAGE = 4;
    const groups = [
      ...t.items.map((i, n) => ['before', `รายการที่ ${n + 1}: ${i.name}${i.detail ? ` — ${i.detail}` : ''}`, i.photos]),
      ['before', 'รูปประกอบเพิ่มเติม', t.photos],
      ['after', 'รูปหลังซ่อม', t.completion?.photos], ['after', 'รูปประกอบกรณีซ่อมไม่ได้', t.cannot?.photos]
    ];
    const tag = { before: 'ก่อนซ่อม (ตอนแจ้ง)', after: 'หลังซ่อม' };
    const all = groups.flatMap(([phase, label, list]) => (list || []).map((src, i) => ({ phase, label, src, n: i + 1, of: list.length })));
    if (!all.length) return '';
    const pages = [];
    for (let i = 0; i < all.length; i += PER_PAGE) pages.push(all.slice(i, i + PER_PAGE));
    return pages.map((list, p) => `
      <div class="sheet photos">
        <h2>ภาพประกอบใบแจ้งซ่อม${pages.length > 1 ? ` <span class="ph-pg">(หน้า ${p + 1}/${pages.length})</span>` : ''}</h2>
        <div class="meta">เลขที่ ${esc(t.docNo)} · อ้างอิงระบบ ${esc(t.id)} · ${esc(UI.locationText(t))}</div>
        <div class="ph-grid">${list.map(ph => `
          <figure class="ph-${ph.phase}">
            <div class="ph-frame"><img ${Store.img(ph.src)} alt=""></div>
            <figcaption><span class="ph-tag">${tag[ph.phase]}</span> ${esc(ph.label)}${ph.of > 1 ? ` · ภาพที่ ${ph.n}/${ph.of}` : ''}</figcaption>
          </figure>`).join('')}</div>
      </div>`).join('');
  }

  const sheet = (t, style = 'memo') => memo(t, style);
  const sheets = (t, withPhotos, style) => sheet(t, style) + (withPhotos ? photoSheet(t) : '');

  // ย่อตัวอักษรในช่องที่ข้อความยาวเกินจุดไข่ปลา ไม่ให้ล้นกรอบ
  function fit(box) {
    $$('.fill > span, .fv > span', box).forEach(sp => {
      sp.style.fontSize = '';
      const room = sp.parentElement.clientWidth, need = sp.offsetWidth;
      if (room > 0 && need > room) sp.style.fontSize = Math.max(55, Math.floor(room / need * 100)) + '%';
    });
    // หลายบรรทัด (อาการ / พิจารณาสั่งการ): ยาวเกินช่อง → ย่อตัวอักษรและระยะบรรทัดลงพร้อมกัน
    $$('.fpara', box).forEach(p => {
      p.style.fontSize = ''; p.style.lineHeight = '';
      for (let f = 95; f >= 55 && p.scrollHeight > p.clientHeight + 1; f -= 5) { p.style.fontSize = f + '%'; p.style.lineHeight = (7.4 * Math.max(f, 80) / 100) + 'mm'; }
    });
    trimSigs(box);
  }
  // วัดขนาดตัวอักษรใหม่เมื่อฟอนต์เอกสารโหลดเสร็จ (iPad/มือถือโหลดฟอนต์ช้า วัดครั้งแรกด้วยฟอนต์สำรองที่กว้างกว่า → ตัวหนังสือถูกย่อเกินจริง)
  function refit(box) {
    fit(box);
    const again = () => { if (box.isConnected) fit(box); };
    if (document.fonts) {
      document.fonts.ready.then(again);
      ['400 16px Sarabun', '700 16px Sarabun', '400 16px DocSarabun', '700 16px DocSarabun'].forEach(f => document.fonts.load(f).then(again, () => {}));
    }
    [400, 1500, 3500].forEach(ms => setTimeout(again, ms));
  }

  // ลายเซ็น: ตัดขอบว่าง/โปร่งใสรอบลายเซ็นออก ให้ลายเซ็นขยายเต็มช่อง (ไฟล์ลายเซ็นเดิมไม่ถูกแก้ · จำผลไว้ไม่ต้องตัดซ้ำ)
  const trimmed = new Map();
  function trimSigs(box) {
    $$('img.fsig', box).forEach(img => {
      const src = img.dataset.raw || img.getAttribute('src');
      if (!src || !src.startsWith('data:')) return;
      img.dataset.raw = src;
      if (!trimmed.has(src)) trimmed.set(src, new Promise(res => {
        const im = new Image();
        im.onload = () => {
          try {
            const c = document.createElement('canvas');
            c.width = im.naturalWidth; c.height = im.naturalHeight;
            const ctx = c.getContext('2d');
            ctx.drawImage(im, 0, 0);
            const { data, width: w, height: h } = ctx.getImageData(0, 0, c.width, c.height);
            let x0 = w, y0 = h, x1 = -1, y1 = -1;
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
              const i = (y * w + x) * 4;
              if (data[i + 3] > 24 && (data[i] < 225 || data[i + 1] < 225 || data[i + 2] < 225)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
            }
            if (x1 < 0) return res(src);
            const pad = 2, cw = Math.min(w, x1 - x0 + 1 + pad * 2), ch = Math.min(h, y1 - y0 + 1 + pad * 2);
            const o = document.createElement('canvas');
            o.width = cw; o.height = ch;
            o.getContext('2d').drawImage(c, Math.max(0, x0 - pad), Math.max(0, y0 - pad), cw, ch, 0, 0, cw, ch);
            res(o.toDataURL('image/png'));
          } catch (e) { res(src); }
        };
        im.onerror = () => res(src);
        im.src = src;
      }));
      trimmed.get(src).then(url => { if (img.getAttribute('src') !== url) img.src = url; });
    });
  }

  // ดาวน์โหลด PDF จากกลุ่มหน้า A4
  async function downloadPdf(box, filename, btn) {
    if (!window.html2pdf) return UI.toast('โหลดตัวสร้าง PDF ไม่สำเร็จ ใช้ปุ่ม "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" แทน', 'error');
    const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `${icon('refresh')} กำลังสร้าง PDF...`;
    try {
      await document.fonts.ready;
      fit(box);
      await Promise.all([...trimmed.values()]);
      const clone = box.cloneNode(true);
      clone.style.cssText = 'position:fixed;left:-10000px;top:0;width:210mm;background:#fff;zoom:1';
      $$('.sheet', clone).forEach((s, i, all) => { s.style.margin = '0'; s.style.boxShadow = 'none'; s.style.pageBreakAfter = i < all.length - 1 ? 'always' : 'auto'; });
      document.body.appendChild(clone);
      await html2pdf().set({
        margin: 0, filename, image: { type: 'jpeg', quality: 0.96 },
        html2canvas: { scale: 2.4, useCORS: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css'] }
      }).from(clone).save();
      clone.remove();
      UI.toast('ดาวน์โหลด PDF แล้ว');
    } catch (err) {
      console.error(err);
      UI.toast('สร้าง PDF ไม่สำเร็จ ใช้ปุ่ม "พิมพ์" แล้วเลือก "บันทึกเป็น PDF" แทน', 'error');
    } finally { btn.disabled = false; btn.innerHTML = label; }
  }

  // ───────── หน้าแสดงเอกสารรายการเดียว ─────────
  function page(params) {
    const t = Store.ticket(params.id);
    const me = Store.me();
    if (!t) return Pages.notFound();
    if (t.reporter.email !== me.email && !Store.canSee(me, t)) return Pages.forbidden('เอกสารนี้เปิดได้เฉพาะผู้แจ้งซ่อมและเจ้าหน้าที่ที่ดูแลหมวดนี้');
    const hasPhotos = [t.photos, t.completion?.photos, t.cannot?.photos, ...t.items.map(i => i.photos)].some(p => p?.length);
    const final = ['done', 'cannot_fix'].includes(t.status);
    const back = Store.isStaff(me) && Store.canSee(me, t) ? `/admin/job/${t.id}` : `/ticket/${t.id}`;
    const state = { style: params.style === 'plain' ? 'plain' : 'memo', photos: hasPhotos };
    return {
      title: `ใบแจ้งซ่อม ${t.id}`,
      html: `
      <div class="doc-page">
        <div class="doc-toolbar">
          <a class="btn btn-outline btn-sm" href="#${back}">${icon('back')} กลับ</a>
          <div><div class="t">ใบแจ้งซ่อม ${esc(t.id)}</div><div class="sub">${esc(UI.STATUS[t.status].label)} · ข้อมูล ณ ${UI.dateTime(new Date().toISOString())}</div></div>
          <span class="spacer"></span>
          <div class="seg seg-dark" id="styleSeg">
            <button type="button" data-style="memo" class="${state.style === 'memo' ? 'is-active' : ''}">มีตราครุฑ</button>
            <button type="button" data-style="plain" class="${state.style === 'plain' ? 'is-active' : ''}">ไม่มีตราครุฑ</button>
          </div>
          ${hasPhotos ? `<label class="checkbox"><input type="checkbox" id="withPhotos" checked> แนบหน้ารูปภาพ</label>` : ''}
          <button class="btn btn-outline btn-sm" id="printBtn">${icon('printer')} พิมพ์</button>
          <button class="btn btn-primary btn-sm" id="pdfBtn">${icon('download')} ดาวน์โหลด PDF</button>
        </div>
        <div class="doc-stage">
          <div class="doc-hint">${icon(final ? 'checkCircle' : 'clock')}<span>${final ? 'เอกสารฉบับสมบูรณ์ พร้อมลายเซ็นและผลการดำเนินงาน' : 'ลายเซ็นผู้อนุมัติจะปรากฏเมื่อเริ่มดำเนินการซ่อม และผลการซ่อมจะปรากฏเมื่อเสร็จสิ้น'} · ปุ่ม "พิมพ์" ให้คุณภาพคมชัดที่สุด (เลือก "บันทึกเป็น PDF" ได้)</span></div>
          <div id="sheets"></div>
        </div>
      </div>`,
      mount(root) {
        const box = $('#sheets', root);
        const draw = () => { box.innerHTML = sheets(Store.ticket(t.id), state.photos, state.style); refit(box); };
        draw();
        $('#styleSeg', root).addEventListener('click', e => {
          const b = e.target.closest('[data-style]'); if (!b) return;
          state.style = b.dataset.style;
          $$('#styleSeg button', root).forEach(x => x.classList.toggle('is-active', x === b));
          draw();
        });
        $('#withPhotos', root)?.addEventListener('change', e => { state.photos = e.target.checked; draw(); });
        $('#printBtn', root).addEventListener('click', () => window.print());
        $('#pdfBtn', root).addEventListener('click', e => downloadPdf(box, `ใบแจ้งซ่อม-${t.id}.pdf`, e.currentTarget));
        App.onCleanup(Store.subscribe(draw));
      }
    };
  }

  return { page, sheet, sheets, photoSheet, fit, refit, downloadPdf, dateParts };
})();
