/* หน้าฝั่งผู้ใช้ทั่วไป (ครู) */
const Pages = (() => {
  const S = () => Store.settings();

  function pageHero({ title, desc = '', crumbs = [], tone = '' }) {
    return `
      <section class="page-hero ${tone}">
        <div class="container rise">
          <nav class="crumbs" aria-label="ตำแหน่งหน้า"><a href="#/">หน้าแรก</a>${crumbs.map(c => `${icon('chevRight')}${c.href ? `<a href="#${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`}`).join('')}</nav>
          <h1>${title}</h1>
          ${desc ? `<p>${desc}</p>` : ''}
        </div>
      </section>`;
  }

  // ───────── สถิติรวมที่ใช้หลายหน้า ─────────
  function summary() {
    const tickets = Store.tickets();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const finished = t => t.completion?.at || t.cannot?.at;
    const recentDone = tickets.filter(t => t.completion && new Date(t.completion.at) > new Date(Date.now() - 90 * 864e5));
    const avg = recentDone.length ? recentDone.reduce((s, t) => s + (new Date(t.completion.at) - new Date(t.createdAt)), 0) / recentDone.length / 864e5 : null;
    return {
      monthName: UI.TH_MONTHS[now.getMonth()],
      month: tickets.filter(t => new Date(t.createdAt) >= monthStart).length,
      pending: tickets.filter(t => t.status === 'pending').length,
      working: tickets.filter(t => t.status === 'in_progress').length,
      review: tickets.filter(t => t.status === 'review').length,
      doneMonth: tickets.filter(t => t.status === 'done' && new Date(finished(t)) >= monthStart).length,
      doneToday: tickets.filter(t => t.status === 'done' && new Date(finished(t)) >= today).length,
      avgDays: avg
    };
  }

  // ═══════════ หน้าแรก ═══════════
  function home() {
    const s = S();
    const sum = summary();
    const forms = Store.FORM_KEYS.filter(k => s.forms[k].enabled);
    const cats = Store.categories();
    // ระบบจริง: ข้อมูลงานซ่อมเห็นได้เฉพาะผู้ที่เข้าสู่ระบบแล้ว
    const live = !Store.cloud || !!Store.me();
    return {
      title: 'หน้าแรก', heroNav: true,
      html: `
      <section class="hero" aria-labelledby="hero-title">
        <img class="hero-bg" src="images/school-hero.jpg" alt="อาคารเรียน${esc(s.schoolName)}" fetchpriority="high">
        <div class="hero-shade" aria-hidden="true"></div>
        <div class="hero-float" aria-hidden="true">${HERO_FLOAT.map(([ic, x, y, size, dur, delay], i) =>
          `<span class="hf hf-${i}" style="left:${x}%;top:${y}%;--s:${size}px;--d:${dur}s;--dl:${delay}s">${icon(ic)}</span>`).join('')}</div>
        <div class="container hero-inner">
          <div class="hero-content rise">
            ${noticeHTML()}
            <span class="eyebrow">${esc(s.division)}</span>
            <h1 id="hero-title" class="split" aria-label="แผนกแจ้งซ่อม อาคารและสถานที่">${heroWords([['แผนก', 'แจ้ง', 'ซ่อม'], ['อาคาร', 'และ', 'สถานที่']])}</h1>
            <p class="hero-lead"><span class="nw">แจ้งซ่อมอาคาร ห้องเรียน หอพัก</span> <span class="nw">ไฟฟ้า ประปา และเครื่องปรับอากาศ</span> <span class="nw">ได้ในที่เดียว</span> <span class="nw">ติดตามความคืบหน้าได้ทุกขั้นตอน</span></p>
            <div class="hero-actions">
              <a class="btn btn-primary btn-lg hb-report" href="#/report">${icon('wrench')} แจ้งซ่อม</a>
              <a class="btn btn-ghost btn-lg hb-board" href="#/board">${pulseIcon()} แดชบอร์ดเรียลไทม์</a>
              <a class="btn btn-ghost btn-lg hb-my" href="#/my">${icon('track')} งานที่ฉันแจ้ง${myBadgeHTML()}</a>
            </div>
            ${live ? `<div class="hero-live" aria-label="สถานะงานซ่อมขณะนี้">
              <span class="hl-title"><span class="live-dot" aria-hidden="true"></span>สถานะงานซ่อมขณะนี้</span>
              <span class="hl-stat"><b>${sum.pending}</b>รออนุมัติ</span>
              <span class="hl-stat"><b>${sum.working}</b>กำลังดำเนินการ</span>
              <span class="hl-stat"><b>${sum.review}</b>รอพิจารณา</span>
            </div>` : `<a class="hero-live" href="#/login" style="text-decoration:none">
              <span class="hl-title"><span class="live-dot" aria-hidden="true"></span>เข้าสู่ระบบด้วยบัญชีโรงเรียน เพื่อดูสถานะงานซ่อมขณะนี้ ${icon('arrow')}</span></a>`}
          </div>
        </div>
      </section>

      <section class="services" aria-label="ประเภทการแจ้งซ่อม">
        <div class="container services-grid">
          ${forms.map((k, i) => {
            const chips = Store.categories(k).filter(c => !c.freeOnly).slice(0, 5);
            return `
            <a class="svc reveal" href="#/report/${k}" style="transition-delay:${i * 80}ms">
              <div class="svc-top"><span class="svc-icon">${icon(UI.FORM_ICON[k])}</span><span class="svc-no">0${i + 1}</span></div>
              <h3>${esc(s.forms[k].name)}</h3>
              <p>${esc(s.forms[k].desc)}</p>
              <div class="svc-chips">${chips.map(c => `<span class="chip">${icon(c.icon)}${esc(c.name)}</span>`).join('')}</div>
              <span class="svc-more">เริ่มแจ้งซ่อม ${icon('arrow')}</span>
            </a>`;
          }).join('')}
          <a class="svc navy reveal" href="#/my" style="transition-delay:${forms.length * 80}ms">
            <div class="svc-top"><span class="svc-icon">${icon('activity')}</span><span class="svc-no">0${forms.length + 1}</span></div>
            <h3>ติดตามสถานะงานซ่อม</h3>
            <p>ดูความคืบหน้าของงานที่แจ้งไว้ และภาพรวมงานซ่อมทั้งโรงเรียนแบบเรียลไทม์</p>
            ${live ? `<div class="svc-chips"><span class="chip">${icon('clock')}รออนุมัติ ${sum.pending}</span><span class="chip">${icon('wrench')}กำลังซ่อม ${sum.working}</span><span class="chip">${icon('hourglass')}รอพิจารณา ${sum.review}</span></div>` : ''}
            <span class="svc-more">งานที่ฉันแจ้ง ${icon('arrow')}</span>
          </a>
        </div>
      </section>

      <section class="section mini-sec" aria-labelledby="md-title">
        <div class="container">
          <div class="mdash-wrap ${live ? '' : 'is-locked'}">
            <div class="mdash reveal" id="mdash" ${live ? '' : 'aria-hidden="true"'}>${mdashHTML(live ? mdashData() : MDASH_DEMO, { animate: true })}</div>
            ${live ? '' : `<div class="md-lock"><span class="md-lock-ic">${icon('shield')}</span><strong>สถานะงานซ่อมแบบเรียลไทม์</strong>
              <p>เข้าสู่ระบบด้วยบัญชีโรงเรียน เพื่อดูความเคลื่อนไหวงานซ่อมล่าสุด</p><a class="btn btn-primary" href="#/login">${icon('google')} เข้าสู่ระบบเพื่อดูสถานะสด</a></div>`}
          </div>
        </div>
      </section>

      <section class="section" aria-labelledby="cat-title">
        <div class="container">
          <div class="section-title reveal">
            <div><span class="kicker">หมวดงานที่รับแจ้ง</span><h2 class="h2" id="cat-title">ครอบคลุมทุกงานซ่อมในโรงเรียน</h2></div>
            <p class="lead">เลือกหมวดงานแล้วติ๊กรายการที่ชำรุดได้ทันที รายการทั้งหมดตรงกับแบบฟอร์มขออนุญาตแจ้งซ่อมของโรงเรียน</p>
          </div>
          <div class="cat-grid">
            ${cats.map((c, i) => `
              <a class="cat-tile reveal" href="#/report/${c.forms[0]}?cat=${c.id}" style="transition-delay:${i * 50}ms">
                <span class="cat-ic">${icon(c.icon)}</span>
                <span><strong>${esc(c.name)}</strong><small>${c.freeOnly ? 'ระบุรายการเอง' : `${c.items.length} รายการ`}</small></span>
              </a>`).join('')}
          </div>
        </div>
      </section>
      `,
      mount(root) {
        UI.reveal(root);
        // หัวเรื่องบรรทัดทอง: ไล่สีต่อเนื่องข้ามคำ (แต่ละคำรู้ตำแหน่งของตัวเองในบรรทัด) ให้แสงวิ่งผ่านเป็นเส้นเดียว
        const goldLine = $('.hero .h1-b', root);
        if (goldLine) {
          const place = () => {
            goldLine.style.setProperty('--w', `${goldLine.clientWidth}px`);
            goldLine.querySelectorAll('.hw').forEach(w => w.style.setProperty('--x', `${w.offsetLeft}px`));
          };
          place();
          document.fonts?.ready.then(place);
          window.addEventListener('resize', place);
          App.onCleanup(() => window.removeEventListener('resize', place));
        }
        // ปิดแถบประกาศ (จำไว้ในเครื่อง ประกาศเดิมไม่เด้งซ้ำ ประกาศใหม่จะแสดงอีกครั้ง)
        $('[data-notice-close]', root)?.addEventListener('click', e => {
          try { localStorage.setItem(NOTICE_KEY, e.currentTarget.dataset.noticeClose); } catch (err) { /* ignore */ }
          e.currentTarget.closest('.hero-notice').remove();
        });
        if (!live) return;
        // แดชบอร์ดมินิ: อัปเดตเรียลไทม์เมื่อข้อมูลเปลี่ยน · รายการใหม่ในฟีดเลื่อนเข้ามาพร้อมแสงวาบ
        const box = $('#mdash', root);
        let last = mdashData();
        const draw = (force = false) => {
          const badge = $('.hb-my .hb-badge', root);
          if (badge) badge.outerHTML = myBadgeHTML(); else $('.hb-my', root)?.insertAdjacentHTML('beforeend', myBadgeHTML());
          const d = mdashData();
          if (!force && d.sig === last.sig) return;
          const seen = new Set(last.feed.map(f => f.key));
          const prev = last.counts;
          last = d;
          box.innerHTML = mdashHTML(d, { fresh: new Set(d.feed.map(f => f.key).filter(k => !seen.has(k))), prev });
        };
        App.onCleanup(Store.subscribe(() => draw()));
        // เวลา "x นาทีที่แล้ว" ให้ขยับตาม (ไม่เล่นแอนิเมชันซ้ำ)
        // ป้าย NEW ครบ 1 ชั่วโมง → เอาออก
        const timer = setInterval(() => {
          last.feed.forEach(f => { const el = box.querySelector(`[data-ago="${f.key}"]`); if (el) el.innerHTML = agoHTML(f.at); });
          box.querySelectorAll('.has-new').forEach(li => { if (Date.now() >= +li.dataset.newUntil) { li.classList.remove('has-new'); li.querySelector('.md-new')?.remove(); } });
        }, 30000);
        App.onCleanup(() => clearInterval(timer));
      }
    };
  }

  // หัวเรื่องหน้าแรก: แยกเป็นคำ ให้ลอยขึ้นทีละคำ (แยกคำเองตามความหมาย ภาษาไทยไม่มีช่องว่าง)
  function heroWords(lines) {
    let i = 0;
    return lines.map((words, n) => `<span class="h1-${n ? 'b' : 'a'}" aria-hidden="true">${words.map(w => `<span class="hw" style="--i:${i++}">${w}</span>`).join('')}</span>`).join('');
  }
  // ไอคอนงานช่างลายเส้นที่ลอยอยู่บนพื้นหลังหน้าแรก: [ไอคอน, ซ้าย %, บน %, ขนาด px, รอบลอย วินาที, หน่วงเริ่ม]
  const HERO_FLOAT = [
    ['wrench', 62, 20, 58, 9, 0], ['zap', 86, 14, 46, 7.5, -2], ['droplet', 74, 46, 40, 8.5, -4],
    ['aircon', 90, 52, 54, 10, -1], ['hammer', 56, 62, 44, 9.5, -3], ['window', 80, 76, 38, 8, -5], ['speaker', 95, 32, 34, 11, -6]
  ];

  // ไอคอนเส้นชีพจรที่วาดตัวเองวนซ้ำ (เส้นจางเป็นพื้น + เส้นที่กำลังวาดทับ)
  function pulseIcon() {
    const svg = icon('activity'), path = svg.match(/<path[^>]*\/>/)[0];
    return svg.replace(path, path.replace('<path', '<path class="hb-trace"') + path.replace('<path', '<path class="hb-pulse" pathLength="1"'));
  }

  // ป้ายตัวเลขบนปุ่ม "งานที่ฉันแจ้ง": งานของฉันที่ยังไม่ปิด (รออนุมัติ / กำลังซ่อม / รอพิจารณา)
  function myBadgeHTML() {
    const me = Store.me();
    const n = me ? Store.tickets().filter(t => t.reporter.email === me.email && ['pending', 'in_progress', 'review'].includes(t.status)).length : 0;
    return n ? `<span class="hb-badge" aria-label="งานค้าง ${n} งาน">${n > 99 ? '99+' : n}</span>` : '';
  }

  // ───────── แถบประกาศ (หน้าแรก) ─────────
  const NOTICE_KEY = 'pcshs-notice-closed';
  function noticeHTML() {
    const n = Store.banners().notice || {};
    if (!n.enabled || !String(n.text || '').trim()) return '';
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    if ((n.from && today < n.from) || (n.to && today > n.to)) return '';
    const sig = `${n.text}|${n.from || ''}|${n.to || ''}`;
    let closed = '';
    try { closed = localStorage.getItem(NOTICE_KEY) || ''; } catch (e) { /* ignore */ }
    if (closed === sig) return '';
    return `<div class="hero-notice" role="status"><span class="hn-ic">${icon('bell')}</span><span class="hn-text"><b>ประกาศ</b> ${esc(n.text)}</span>
      <button type="button" class="hn-x" data-notice-close="${esc(sig)}" aria-label="ปิดประกาศ">${icon('close')}</button></div>`;
  }

  // ───────── แดชบอร์ดมินิ (หน้าแรก) ─────────
  const MD_COLS = [['pending', 'รออนุมัติ'], ['in_progress', 'กำลังซ่อม'], ['review', 'รอพิจารณา'], ['done', 'เสร็จ (30 วัน)']];
  const MD_FEED = {
    'แจ้งซ่อม': ['pending', 'inbox', 'แจ้งใหม่'], 'กำลังดำเนินการซ่อม': ['in_progress', 'wrench', 'เริ่มซ่อม'],
    'รอพิจารณา': ['review', 'hourglass', 'รอพิจารณา'], 'เสร็จสิ้น': ['done', 'checkCircle', 'ซ่อมเสร็จ'], 'ไม่สามารถซ่อมได้': ['cannot_fix', 'x', 'ซ่อมไม่ได้']
  };
  // เวลาที่ผ่านมา: แบบเต็ม (จอใหญ่) + แบบย่อ "20 ชม." (มือถือ) ซ่อน/แสดงด้วย CSS
  const agoHTML = iso => {
    const full = UI.ago(iso);
    const short = full.replace('ชั่วโมงที่แล้ว', 'ชม.').replace('นาทีที่แล้ว', 'นาที').replace('วันที่แล้ว', 'วัน');
    return `<span class="ago-l">${full}</span><span class="ago-s">${short}</span>`;
  };
  const MD_NEW_MS = 60 * 6e4;   // ป้าย NEW บนรายการ "แจ้งใหม่" แสดง 1 ชั่วโมง แล้วหายเอง
  const dayKey = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
  function mdashData() {
    const ts = Store.tickets().filter(t => t.status !== 'cancelled');
    const since30 = Date.now() - 30 * 864e5;
    const counts = {
      pending: ts.filter(t => t.status === 'pending').length,
      in_progress: ts.filter(t => t.status === 'in_progress').length,
      review: ts.filter(t => t.status === 'review').length,
      done: ts.filter(t => t.status === 'done' && new Date(t.completion?.at || t.createdAt) >= since30).length
    };
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
      return { d, n: ts.filter(t => dayKey(t.createdAt) === dayKey(d)).length };
    });
    const feed = ts.flatMap(t => (t.history || []).map((h, i) => ({ t, h, i })))
      .filter(x => MD_FEED[x.h.action] || x.h.action.startsWith('แจ้งซ้ำ'))
      .sort((a, b) => b.h.at.localeCompare(a.h.at)).slice(0, 5)
      .map(({ t, h, i }) => {
        const [st, ic, label] = MD_FEED[h.action] || ['pending', 'refresh', 'แจ้งซ้ำ'];
        const newUntil = h.action === 'แจ้งซ่อม' ? new Date(h.at).getTime() + MD_NEW_MS : 0;
        return { key: `${t.id}#${i}`, st, ic, label, no: t.id.split('-').pop(), where: UI.locationText({ ...t.location, point: '' }), at: h.at, newUntil: newUntil > Date.now() ? newUntil : 0 };
      });
    const sum = summary();
    const kpi = { monthName: sum.monthName, month: sum.month, avg: sum.avgDays === null ? null : sum.avgDays.toFixed(1) };
    return { counts, days, feed, kpi, sig: JSON.stringify([counts, days.map(x => x.n), feed.map(f => f.key), kpi]) };
  }
  // ข้อมูลตัวอย่างสำหรับผู้ที่ยังไม่เข้าสู่ระบบ (แสดงแบบเบลอ ไม่ใช่ข้อมูลจริง)
  const MDASH_DEMO = (() => {
    const now = Date.now(), m = 6e4;
    return {
      counts: { pending: 3, in_progress: 5, review: 2, done: 18 },
      days: [2, 4, 1, 3, 5, 2, 0, 3, 6, 4, 2, 5, 3, 4].map((n, i) => ({ d: new Date(now - (13 - i) * 864e5), n })),
      feed: [['in_progress', 'wrench', 'เริ่มซ่อม', 'ห้องเรียน ม.4 · ห้อง 402', 2], ['done', 'checkCircle', 'ซ่อมเสร็จ', 'ห้อง Lab เคมี 1', 25],
        ['pending', 'inbox', 'แจ้งใหม่', 'หอ D3 บัวชมพู (ญ) · ล็อค 2', 40], ['review', 'hourglass', 'รอพิจารณา', 'โรงอาหาร', 90], ['done', 'checkCircle', 'ซ่อมเสร็จ', 'หอสมุด · ชั้น 2', 180]]
        .map(([st, ic, label, where, ago], i) => ({ key: 'demo' + i, st, ic, label, no: String(80 - i).padStart(4, '0'), where, at: new Date(now - ago * m).toISOString(), newUntil: label === 'แจ้งใหม่' ? now + MD_NEW_MS : 0 })),
      kpi: { monthName: UI.TH_MONTHS[new Date().getMonth()], month: 34, avg: '2.4' },
      sig: 'demo'
    };
  })();
  function mdashHTML(d, { animate = false, fresh = new Set(), prev = null } = {}) {
    const total = Math.max(1, MD_COLS.reduce((a, [k]) => a + d.counts[k], 0));
    const C = 2 * Math.PI * 26;
    const maxDay = Math.max(1, ...d.days.map(x => x.n));
    return `
      <div class="md-head">
        <span class="md-live"><span class="live-dot"></span>LIVE</span>
        <h2 id="md-title">ความเคลื่อนไหวงานซ่อม</h2>
        <span class="md-upd">อัปเดตอัตโนมัติ · ${UI.time(new Date().toISOString())} น.</span>
        <a class="md-more" href="#/board">เปิดแดชบอร์ดเต็ม ${icon('arrow')}</a>
      </div>
      <div class="md-body">
        <div class="md-left">
          <div class="md-tiles">
            ${MD_COLS.map(([k, label], i) => {
              const n = d.counts[k], off = (C * (1 - n / total)).toFixed(1);
              const bump = prev && prev[k] !== n;
              // ตัวเลขเปลี่ยน → หมุนแบบมิเตอร์ (ขึ้น: เลขใหม่เลื่อนขึ้นจากล่าง · ลง: เลื่อนลงจากบน)
              const num = animate ? `<strong data-count="${n}">0</strong>`
                : bump ? `<strong class="md-odo ${n > prev[k] ? 'up' : 'down'}" aria-label="${n}"><span>${n > prev[k] ? `<b>${prev[k]}</b><b>${n}</b>` : `<b>${n}</b><b>${prev[k]}</b>`}</span></strong>`
                : `<strong>${n}</strong>`;
              // ดาวหางวิ่งรอบวง: หาง 2 ช่วง (จาง → เข้ม) + หัวสีสถานะมีแกนขาว · หมุนทั้งกลุ่ม (ใช้ได้ทุกเบราว์เซอร์)
              const comet = `<g class="cmt-g">${[['t1', 0], ['t2', -14], ['hd', -28], ['core', -28]]
                .map(([c, o]) => `<circle cx="32" cy="32" r="26" class="cmt ${c}" stroke-dashoffset="${o}"/>`).join('')}</g>`;
              return `<div class="md-tile ${bump ? 'bump' : ''}" style="--c:${UI.STATUS[k].color};--i:${i}">
                <svg class="md-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" class="trk"/><circle cx="32" cy="32" r="26" class="val" style="stroke-dasharray:${C.toFixed(1)};--off:${off}"/>${comet}</svg>
                ${num}<span>${label}</span></div>`;
            }).join('')}
          </div>
          <div class="md-spark" aria-label="จำนวนแจ้งซ่อม 14 วันล่าสุด">
            <div class="md-bars">${d.days.map((x, i) => `<span class="md-bar" style="--h:${Math.max(6, x.n / maxDay * 100)}%;--i:${i}" title="${UI.date(x.d.toISOString())} · ${x.n} งาน"><i></i></span>`).join('')}</div>
            <small>แจ้งซ่อม 14 วันล่าสุด · รวม ${d.days.reduce((a, x) => a + x.n, 0)} งาน</small>
          </div>
          <div class="md-kpis">
            <div class="md-kpi"><span class="md-kpi-ic">${icon('inbox')}</span><span><small>แจ้งซ่อมเดือน${esc(d.kpi.monthName)}</small><b>${d.kpi.month}</b> รายการ</span></div>
            <div class="md-kpi"><span class="md-kpi-ic">${icon('clock')}</span><span><small>เวลาซ่อมเฉลี่ย (90 วัน)</small>${d.kpi.avg === null ? '<b>–</b> ยังไม่มีงานที่ซ่อมเสร็จ' : `<b>${d.kpi.avg}</b> วัน`}</span></div>
          </div>
        </div>
        <ol class="md-feed">
          ${d.feed.map((f, i) => `
            <li class="md-item ${fresh.has(f.key) ? 'is-new' : ''} ${f.newUntil ? 'has-new' : ''}" ${f.newUntil ? `data-new-until="${f.newUntil}"` : ''} style="--c:${UI.STATUS[f.st].color};--i:${i}">
              <span class="md-ic">${icon(f.ic)}</span>
              <span class="md-txt"><b>#${esc(f.no)} ${esc(f.label)}${f.newUntil ? '<span class="md-new"><i></i>NEW</span>' : ''}</b><small>${esc(f.where)}</small></span>
              <time data-ago="${esc(f.key)}">${agoHTML(f.at)}</time>
            </li>`).join('') || `<li class="md-empty">ยังไม่มีความเคลื่อนไหว</li>`}
        </ol>
      </div>`;
  }

  // ═══════════ เข้าสู่ระบบ ═══════════
  function login(params) {
    const s = S();
    const demo = [
      ['somchai.j', 'ครู', 'orange'], ['pitak.s', 'แอดมิน', 'indigo'], ['chutirat.k', 'ผู้อนุมัติ · หอพัก', 'green'],
      ['chaiwat.k', 'ผู้อนุมัติ · ทั่วไป/แอร์', 'green'], ['pissamai.j', 'ผู้อนุมัติ · ปิดงาน', 'green']
    ].map(([local, role, tone]) => ({ u: Store.userByEmail(`${local}@${s.domain}`), role, tone })).filter(x => x.u);
    return {
      title: 'เข้าสู่ระบบ',
      html: `
      <div class="login-wrap">
        <div class="login-visual">
          <img src="images/school-hero.jpg" alt="">
          <div class="rise">
            <span class="eyebrow">${esc(s.division)}</span>
            <h2>ระบบแจ้งซ่อม<br>อาคารและสถานที่</h2>
            <p>สำหรับครูและบุคลากร${esc(s.schoolName)} เข้าสู่ระบบด้วยบัญชี Google ของโรงเรียน</p>
          </div>
        </div>
        <div class="login-panel">
          <div class="login-box rise">
            <img src="images/logo.png" alt="" style="height:76px;margin-bottom:18px">
            <h1>เข้าสู่ระบบ</h1>
            <p class="muted" style="margin:6px 0 24px">ใช้อีเมลโรงเรียน <strong>@${esc(s.domain)}</strong> เท่านั้น ระบบจะรู้ชื่อผู้แจ้งจากบัญชีโดยอัตโนมัติ</p>
            <div id="loginErr"></div>
            ${Store.cloud ? `
            <button class="g-btn" type="button" id="gLogin">${icon('google')} เข้าสู่ระบบด้วย Google</button>
            <p class="small faint" style="margin-top:16px;text-align:center">กดแล้วเลือกบัญชี <b>@${esc(s.domain)}</b> · ครั้งแรกระบบจะสร้างบัญชีให้อัตโนมัติ</p>` : `
            <form id="loginForm" class="stack" novalidate>
              <div class="field">
                <label for="email">อีเมลโรงเรียน</label>
                <div class="input-icon">${icon('mail')}<input class="input" id="email" type="email" placeholder="name@${esc(s.domain)}" autocomplete="email" required></div>
              </div>
              <button class="g-btn" type="submit">${icon('google')} เข้าสู่ระบบด้วย Google</button>
            </form>
            <div class="or">บัญชีทดลองสำหรับต้นแบบ</div>
            <div class="demo-list">
              ${demo.map(d => `<button class="demo-acc" data-email="${esc(d.u.email)}">${UI.avatar(Store.fullName(d.u), '', Store.isStaff(d.u) ? 'navy' : '')}
                <span><strong>${esc(Store.fullName(d.u))}</strong><small>${esc(d.u.position)}</small></span><span class="badge tone-${d.tone}">${esc(d.role)}</span></button>`).join('')}
              <button class="demo-acc" data-email="student.m6@${esc(s.domain)}">${UI.avatar('น')}
                <span><strong>นักเรียน (ทดสอบการปฏิเสธ)</strong><small>student.m6@${esc(s.domain)}</small></span><span class="badge tone-slate">ไม่มีสิทธิ์</span></button>
            </div>`}
          </div>
        </div>
      </div>`,
      mount(root) {
        const doLogin = async (email, btn) => {
          $('#loginErr', root).innerHTML = '';
          if (btn) btn.disabled = true;
          try {
            const u = await Store.login(email);
            UI.toast(`ยินดีต้อนรับ ${Store.fullName(u)}`);
            App.go(params.next || (Store.hasRole(u, 'admin') ? '/admin' : Store.isStaff(u) ? '/admin/jobs' : '/'));
          } catch (e) {
            $('#loginErr', root).innerHTML = `<div class="alert alert-error" style="margin-bottom:16px">${icon('alert')}<span>${esc(e.message)}</span></div>`;
          } finally { if (btn) btn.disabled = false; }
        };
        if (Store.cloud) { $('#gLogin', root).addEventListener('click', e => doLogin('', e.currentTarget)); return; }
        $('#loginForm', root).addEventListener('submit', e => { e.preventDefault(); doLogin($('#email', root).value, e.submitter); });
        $$('.demo-acc', root).forEach(b => b.addEventListener('click', () => doLogin(b.dataset.email, b)));
      }
    };
  }

  // ═══════════ เลือกประเภทแจ้งซ่อม ═══════════
  function reportChooser() {
    const s = S();
    const forms = Store.FORM_KEYS.filter(k => s.forms[k].enabled);
    return {
      title: 'แจ้งซ่อม',
      html: `
      ${pageHero({ title: 'แจ้งซ่อม', desc: 'เลือกประเภทงานซ่อมให้ตรงกับสถานที่ ระบบจะจัดทำใบขออนุญาตแจ้งซ่อมตามแบบฟอร์มของโรงเรียนให้อัตโนมัติ', crumbs: [{ label: 'แจ้งซ่อม' }], tone: 'orange' })}
      <div class="page-body"><div class="container stack" style="gap:28px">
        <div class="type-grid">
          ${forms.map(k => `
            <article class="type-card ${k === 'aircon' ? 'navy' : ''}">
              <div class="type-visual"><span class="big-ic">${icon(UI.FORM_ICON[k])}</span></div>
              <div class="type-body">
                <h3>${esc(s.forms[k].name)}</h3>
                <p>${esc(s.forms[k].desc)}</p>
                <div class="svc-chips">${Store.categories(k).filter(c => !c.freeOnly).map(c => `<span class="chip">${icon(c.icon)}${esc(c.name)}</span>`).join('')}</div>
                <a class="btn btn-primary" href="#/report/${k}" style="margin-top:14px">กรอกแบบฟอร์ม ${icon('arrow')}</a>
              </div>
            </article>`).join('')}
        </div>
        <div class="notice">${icon('shield')}<div><strong>หลังแจ้งซ่อม</strong><br>คำขอจะอยู่ในสถานะ "รออนุมัติ" (แก้ไขหรือยกเลิกได้ระหว่างนี้) จากนั้นเจ้าหน้าที่จะอัปเดตเป็น "กำลังดำเนินการซ่อม" หรือ "รอพิจารณา" และแจ้งผลเมื่อเสร็จสิ้น คุณจะได้รับการแจ้งเตือนทุกครั้งที่สถานะเปลี่ยน</div></div>
      </div></div>`
    };
  }

  // ═══════════ ฟอร์มแจ้งซ่อม (ใช้ทั้งแจ้งใหม่และแก้ไข) ═══════════
  // แจ้งเป็น "การ์ดสถานที่" ทีละใบ: การ์ด 1 ใบ = สถานที่/ห้อง 1 แห่ง + รายการซ่อมของที่นั้น = ใบแจ้งซ่อม 1 ใบ
  // หอพัก: เลือกหอเดียวก่อน แล้วเพิ่มการ์ดทีละล็อคนอนหรือห้อง
  function reportForm(params) {
    const editing = params.id ? Store.ticket(params.id) : null;
    const me = Store.me();
    if (params.id && (!editing || !Store.can(me, 'edit', editing))) return forbidden('แก้ไขได้เฉพาะคำขอของคุณที่ยังรออนุมัติ');
    const type = editing ? editing.formType : params.type;
    const s = S();
    if (!s.forms[type]?.enabled && !editing) return notFound();
    const cats = Store.categories(type).filter(c => c.freeOnly || Store.itemsFor(c, type).length);
    const places = Store.locations(type === 'dorm' ? 'dorm' : 'building');
    const dorm = type === 'dorm';
    const MAX_PHOTOS = 3;
    const UNIT = dorm ? 'ล็อค/ห้อง' : 'สถานที่';
    const locKey = l => `${l.locationId || l.locationName}|${l.zone || ''}|${l.room || ''}`;
    const placeById = id => places.find(p => p.id === id);
    const firstCat = (cats.find(c => c.id === params.cat) || cats[0])?.id;
    let seq = 0;
    const newBlock = () => ({ key: `b${seq++}`, placeId: '', other: '', zone: '', room: '', point: '', items: new Map(), active: firstCat, open: true });
    const state = { dorm: '', blocks: [] };
    if (editing) {
      const l = editing.location;
      const b = { ...newBlock(), placeId: l.locationId || '__other', other: l.locationId ? '' : l.locationName, zone: l.zone || l.lock || '', room: l.room || '', point: l.point || '' };
      editing.items.forEach(i => b.items.set(i.custom ? `custom:${i.catId}:${seq++}` : i.itemId, { ...i, photos: [...(i.photos || [])] }));
      if (dorm) state.dorm = l.locationId || '';
      state.blocks.push(b);
    } else state.blocks.push(newBlock());

    // ───── ตัวช่วยของการ์ด ─────
    const placeOf = b => placeById(dorm ? state.dorm : b.placeId);
    const roomMode = p => p.zones.length === 1 && !p.zones[0].name; // สถานที่ที่มีแต่ห้อง (เช่น ห้องเรียน ม.2) ต้องเลือกห้อง
    const locOf = b => {
      const p = placeOf(b);
      if (p) return { locationId: p.id, locationName: p.name, zone: b.zone, room: b.room, point: b.point.trim() };
      return !dorm && b.placeId === '__other' && b.other.trim() ? { locationId: '', locationName: b.other.trim(), zone: '', room: '', point: b.point.trim() } : null;
    };
    const issueOf = b => {
      const p = placeOf(b);
      if (!locOf(b)) return dorm ? 'ยังไม่ได้เลือกหอพัก' : 'ยังไม่ได้เลือกสถานที่';
      if (p?.zones?.length && (roomMode(p) ? !b.room : !b.zone)) return roomMode(p) ? 'ยังไม่ได้เลือกห้อง' : 'ยังไม่ได้เลือกล็อค/โซน';
      if (!b.items.size) return 'ยังไม่ได้เลือกรายการ';
      if ([...b.items.values()].some(v => !String(v.detail || '').trim())) return 'ยังระบุอาการไม่ครบ';
      // รายการที่มีหน่วยนับ (ของจับต้องได้) ต้องระบุจำนวน · รายการที่พิมพ์เองไม่บังคับ
      const noQty = [...b.items.values()].find(v => !v.custom && v.unit && !(v.qty >= 1));
      if (noQty) return `ยังไม่ได้ระบุจำนวน${noQty.name}`;
      return '';
    };
    const titleOf = (b, i) => {
      const l = locOf(b);
      const t = l && (dorm ? UI.locationText({ ...l, locationName: '', point: '' }) : UI.locationText({ ...l, point: '' }));
      return t || `${UNIT}ที่ ${i + 1}`;
    };
    // ห้อง/ล็อคที่การ์ดอื่นเลือกไปแล้ว
    const usedBy = (b, zone, room) => state.blocks.findIndex(x => x !== b && locOf(x) && locOf(b) && locOf(x).locationName === locOf(b).locationName && x.zone === zone && x.room === room);

    const opt = (list, selected) => list.map(v => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
    const reporter = editing ? editing.reporter : { position: me.position, dept: me.dept, phone: me.phone };
    const groups = [...new Set(places.map(p => p.group || ''))];
    const placeOptions = sel => `<option value="">${dorm ? 'เลือกหอพัก' : 'เลือกสถานที่'}</option>
      ${groups.map(g => `<optgroup label="${esc(g || 'อื่น ๆ')}">${places.filter(p => (p.group || '') === g).map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</optgroup>`).join('')}
      ${dorm ? '' : `<option value="__other" ${sel === '__other' ? 'selected' : ''}>อื่น ๆ (ระบุเอง)</option>`}`;
    const title = editing ? `แก้ไขคำขอ ${editing.id}` : s.forms[type].name;
    const n0 = dorm ? 3 : 2;
    return {
      title,
      html: `
      ${pageHero({ title: esc(title), desc: esc(s.forms[type].subject), crumbs: editing ? [{ label: 'งานที่ฉันแจ้ง', href: '/my' }, { label: editing.id, href: `/ticket/${editing.id}` }, { label: 'แก้ไข' }] : [{ label: 'แจ้งซ่อม', href: '/report' }, { label: s.forms[type].name }], tone: 'orange' })}
      <div class="page-body"><div class="container">
        <form class="form-layout" id="repForm" novalidate>
          <div class="card">
            <section class="form-section">
              <div class="fs-head"><span class="fs-num">1</span><div><h3>ข้อมูลผู้แจ้งซ่อม</h3><p>ดึงจากบัญชีที่เข้าสู่ระบบ แก้ไขชื่อได้ที่หน้าโปรไฟล์</p></div></div>
              <div class="grid-2">
                <div class="field"><label>ชื่อ-นามสกุล</label><input class="input" value="${esc(Store.fullName(me))}" readonly></div>
                <div class="field"><label>อีเมล</label><input class="input" value="${esc(me.email)}" readonly></div>
                <div class="field"><label for="position">ตำแหน่ง</label><select class="select" id="position">${opt([...new Set([reporter.position, ...s.positions])].filter(Boolean), reporter.position)}</select></div>
                <div class="field"><label for="dept">ฝ่ายงาน / กลุ่มสาระฯ</label><select class="select" id="dept">${opt([...new Set([reporter.dept, ...s.departments])].filter(Boolean), reporter.dept)}</select></div>
                <div class="field"><label for="phone">เบอร์ติดต่อ <span class="req">*</span></label><input class="input" id="phone" type="tel" value="${esc(reporter.phone || '')}" placeholder="08x-xxx-xxxx" inputmode="tel"></div>
                <div class="field"><label>เวลาแจ้ง</label><input class="input" value="${editing ? UI.dateTime(editing.createdAt) : 'บันทึกจากเวลาของระบบเมื่อกดส่ง'}" readonly></div>
              </div>
            </section>

            ${dorm ? `
            <section class="form-section">
              <div class="fs-head"><span class="fs-num">2</span><div><h3>หอพัก</h3><p>แจ้งได้ครั้งละ 1 หอ หากต้องการแจ้งหออื่น ให้ส่งแยกอีกครั้ง</p></div></div>
              <div class="field"><label for="dormSel">หอพัก <span class="req">*</span></label><select class="select" id="dormSel">${placeOptions(state.dorm)}</select></div>
            </section>` : ''}

            <section class="form-section">
              <div class="fs-head"><span class="fs-num">${n0}</span><div><h3>${dorm ? 'ล็อคนอน / ห้อง และรายการซ่อม' : 'สถานที่และรายการซ่อม'}</h3>
                <p>${editing ? 'แก้ไขสถานที่ รายการ และรูปของคำขอนี้' : `แจ้งทีละ${UNIT} เลือกรายการและแนบรูปของที่นั้น แล้วกด "เพิ่ม${UNIT}" เพื่อแจ้งที่ถัดไป · ระบบแยกใบแจ้งซ่อมให้ทีละ${UNIT}`}</p></div></div>
              <div class="loc-blocks" id="blocks"></div>
              ${editing ? '' : `<button type="button" class="add-block" data-addblock>${icon('plus')} เพิ่ม${UNIT}</button>`}
            </section>

            <section class="form-section">
              <div class="fs-head"><span class="fs-num">${n0 + 1}</span><div><h3>หมายเหตุเพิ่มเติม</h3><p>ไม่บังคับ · ใช้กับทุกใบที่แจ้งในครั้งนี้</p></div></div>
              <div class="field"><textarea class="textarea" id="note" maxlength="300" style="min-height:80px" aria-label="หมายเหตุเพิ่มเติม" placeholder="เช่น สะดวกให้เข้าซ่อมช่วงบ่าย หรือมีกุญแจอยู่ที่ห้องพักครู">${esc(editing?.note || '')}</textarea></div>
            </section>
          </div>

          <aside class="card summary" aria-label="สรุปการแจ้งซ่อม">
            <div class="summary-head"><small>สรุปรายการ</small><h3>${esc(s.forms[type].name)}</h3></div>
            <ul class="summary-list" id="sumList"></ul>
            <div class="summary-foot">
              <button class="btn btn-primary btn-lg btn-block" type="submit" id="submitBtn">${icon(editing ? 'check' : 'send')} ${editing ? 'บันทึกการแก้ไข' : 'ส่งแจ้งซ่อม'}</button>
              ${editing ? `<a class="btn btn-ghost-dark btn-block" href="#/ticket/${editing.id}">ยกเลิกการแก้ไข</a>` : `<p class="small faint" style="text-align:center">เมื่อส่งแล้วจะได้ใบแจ้งซ่อม PDF ตามแบบฟอร์มของโรงเรียนทันที</p>`}
            </div>
          </aside>
        </form>
      </div></div>`,
      mount(root) {
        const blockOf = el => state.blocks.find(b => b.key === el.closest('[data-block]')?.dataset.block);

        // ───── ส่วนประกอบของการ์ด ─────
        const chip = (attr, val, label, on, off) => `<button type="button" class="pick pick-sm ${on ? 'is-on' : ''}" ${attr}="${esc(val)}" ${off ? 'disabled' : ''}><span class="box">${icon('check')}</span>${esc(label)}</button>`;
        function zonePicker(b, p) {
          if (!p?.zones?.length) return '';
          if (roomMode(p)) return `<div class="field"><label>ห้อง <span class="req">*</span></label>
            <div class="pick-grid">${p.zones[0].rooms.map(r => chip('data-room', r, r, b.room === r, usedBy(b, '', r) >= 0)).join('')}</div></div>`;
          const z = p.zones.find(x => x.name === b.zone);
          return `<div class="field"><label>${dorm ? 'ล็อคนอน / โซน' : 'โซน'} <span class="req">*</span></label>
              <div class="pick-grid">${p.zones.map(x => chip('data-zone', x.name, x.name, b.zone === x.name, b.zone !== x.name && usedBy(b, x.name, '') >= 0 && !x.rooms.length)).join('')}</div></div>
            ${z?.rooms.length ? `<div class="field"><label>ห้อง <span class="faint">(ไม่บังคับ)</span></label>
              <div class="pick-grid">${z.rooms.map(r => chip('data-room', r, r, b.room === r, usedBy(b, z.name, r) >= 0)).join('')}</div></div>` : ''}`;
        }
        // ───── ค้นหาสถานที่ (แจ้งซ่อมทั่วไป): พิมพ์ชื่อหรือเลขห้อง · ว่าง = สถานที่ที่เคยแจ้งล่าสุด + รายการทั้งหมด ─────
        const norm = s => String(s || '').toLowerCase().replace(/[\s.\-–()]/g, '');
        const recent = (() => {
          const seen = new Set(), out = [];
          Store.tickets().filter(t => t.reporter.email === me.email && t.formType === type && placeById(t.location.locationId))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .forEach(t => {
              const k = locKey(t.location);
              if (!seen.has(k) && out.length < 3) { seen.add(k); out.push({ p: placeById(t.location.locationId), zone: t.location.zone || '', room: t.location.room || '' }); }
            });
          return out;
        })();
        const ppOpt = ({ p, zone = '', room = '' }) => `
          <button type="button" class="pp-opt" data-pick="${p.id}" data-pzone="${esc(zone)}" data-proom="${esc(room)}">
            ${icon('pin')}<span><b>${esc(p.name)}${room ? ` · ${/^\d|\//.test(room) ? 'ห้อง ' : ''}${esc(room)}` : zone ? ` · ${esc(zone)}` : ''}</b><small>${esc(p.group || '')}</small></span></button>`;
        const OTHER_OPT = `<button type="button" class="pp-opt other" data-pick="__other" data-pzone="" data-proom="">${icon('edit')}<span><b>อื่น ๆ (ระบุเอง)</b><small>ไม่มีในรายการ พิมพ์ชื่อสถานที่เอง</small></span></button>`;
        function ppResults(q) {
          const n = norm(q);
          if (!n) {
            const groups = [...new Set(places.map(p => p.group || 'อื่น ๆ'))];
            return (recent.length ? `<div class="pp-group">${icon('clock')} ที่คุณแจ้งล่าสุด</div>${recent.map(ppOpt).join('')}` : '')
              + groups.map(g => `<div class="pp-group">${esc(g)}</div>${places.filter(p => (p.group || 'อื่น ๆ') === g).map(p => ppOpt({ p })).join('')}`).join('')
              + `<div class="pp-group">ไม่พบสถานที่</div>${OTHER_OPT}`;
          }
          const placeHits = places.filter(p => norm(p.name).includes(n) || norm(p.group).includes(n)).map(p => ({ p }));
          // ค้นเลขห้อง/ชื่อห้องย่อย เช่น "402" → ห้องเรียน ม.4 · ห้อง 402 และ ห้องเรียน 401–407 (จ.ภ.) · ห้อง 402
          const roomHits = [];
          places.forEach(p => (p.zones || []).forEach(z => z.rooms.forEach(r => { if (norm(r).startsWith(n) || norm(`${z.name}${r}`).includes(n)) roomHits.push({ p, zone: z.name, room: r }); })));
          const hits = (/^\d/.test(n) ? [...roomHits, ...placeHits] : [...placeHits, ...roomHits]).slice(0, 30);
          return (hits.length ? hits.map(ppOpt).join('') : `<p class="pp-empty">ไม่พบ "${esc(q)}" ลองพิมพ์คำอื่น หรือเลือก "อื่น ๆ (ระบุเอง)"</p>`) + OTHER_OPT;
        }
        function placePicker(b) {
          const p = placeById(b.placeId);
          if (p || b.placeId === '__other') return `
            <div class="field"><label>สถานที่ <span class="req">*</span></label>
              <div class="pp-selected">${icon(p ? 'pin' : 'edit')}<strong>${p ? esc(p.name) : 'อื่น ๆ (ระบุเอง)'}</strong>${p?.group ? `<small>${esc(p.group)}</small>` : ''}
                <button type="button" class="link small" data-ppchange>${icon('search')} เปลี่ยนสถานที่</button></div></div>
            ${p ? '' : `<div class="field"><input class="input" data-otherplace value="${esc(b.other)}" aria-label="ชื่อสถานที่" placeholder="ชื่อสถานที่ เช่น อาคาร 2 ห้องน้ำชาย ชั้น 2"></div>`}`;
          return `
            <div class="field"><label>สถานที่ <span class="req">*</span></label>
              <div class="input-icon">${icon('search')}<input class="input" data-ppq value="${esc(b.q || '')}" autocomplete="off" aria-label="ค้นหาสถานที่" placeholder="ค้นหา เช่น เคมี, หอสมุด, 402" style="padding-left:40px"></div>
              <div class="pp-results" data-ppres role="listbox">${ppResults(b.q || '')}</div></div>`;
        }

        const countIn = (b, catId) => [...b.items.values()].filter(v => v.catId === catId).length;
        const tabsHTML = b => cats.map(c => `
          <button type="button" class="cat-tab ${c.id === b.active ? 'is-active' : ''}" data-tab="${c.id}">${icon(c.icon)}${esc(c.name)}${countIn(b, c.id) ? `<span class="cnt">${countIn(b, c.id)}</span>` : ''}</button>`).join('');
        function panelHTML(b) {
          const c = cats.find(x => x.id === b.active);
          if (!c) return '<p class="muted">ยังไม่มีหมวดงานสำหรับแบบฟอร์มนี้</p>';
          const items = Store.itemsFor(c, type);
          const customs = [...b.items.entries()].filter(([, v]) => v.custom && v.catId === c.id);
          return `
            <div class="cat-panel-title">${icon(c.icon)}${esc(c.name)}</div>
            ${items.length ? `<div class="pick-grid">${items.map(it => {
              const on = b.items.has(it.id);
              return `<button type="button" class="pick ${on ? 'is-on' : ''}" data-item="${it.id}" data-cat="${c.id}" aria-pressed="${on}"><span class="box">${icon('check')}</span>${esc(it.name)}</button>`;
            }).join('')}</div>` : ''}
            ${customs.length ? `<div class="pick-grid" style="margin-top:10px">${customs.map(([k, v]) => `<button type="button" class="pick is-on" data-remove="${esc(k)}" title="กดเพื่อนำออก"><span class="box">${icon('check')}</span>${esc(v.name)}<span class="unit">ระบุเอง</span></button>`).join('')}</div>` : ''}
            <div class="field" style="margin-top:16px"><label>${c.freeOnly ? 'ระบุรายการที่ต้องการซ่อม' : 'อื่น ๆ (ระบุ)'}</label>
              <div class="row" style="flex-wrap:nowrap"><input class="input" data-other="${c.id}" aria-label="${c.freeOnly ? 'ระบุรายการที่ต้องการซ่อม' : 'รายการอื่น'}" placeholder="${c.freeOnly ? 'เช่น ราวบันได ฝ้าเพดาน' : 'รายการอื่นที่ไม่มีในตัวเลือก'}"><button type="button" class="btn btn-soft" data-addother="${c.id}">${icon('plus')} เพิ่ม</button></div></div>`;
        }
        const thumbs = v => (v.photos || []).map((p, i) => `<figure class="thumb sm"><img ${Store.img(p)} alt="รูปที่ ${i + 1}" data-zoom><button type="button" class="thumb-x" data-rmphoto="${i}" aria-label="ลบรูปที่ ${i + 1}">${icon('close')}</button></figure>`).join('');
        function detailsHTML(b) {
          const list = [...b.items.entries()];
          if (!list.length) return '';
          return `<div class="lb-sec">${icon('edit')} อาการและรูปของแต่ละรายการ</div><ol class="detail-list">${list.map(([k, v], n) => {
            const c = Store.allCategories().find(x => x.id === v.catId);
            return `
            <li class="detail-row" data-key="${esc(k)}">
              <div class="dr-head"><span class="dr-no">${n + 1}</span><span class="dr-ic">${icon(c?.icon || 'wrench')}</span>
                <div class="dr-title"><strong>${esc(v.name)}</strong><span>${esc(v.catName)}${v.custom ? ' · ระบุเอง' : ''}</span></div>
                ${v.custom ? `<span class="qty-free"><input class="input sm" type="number" min="1" inputmode="numeric" value="${v.qty || ''}" placeholder="จำนวน" data-qfree aria-label="จำนวน ${esc(v.name)} (ไม่บังคับ)"><input class="input sm" value="${esc(v.unit || '')}" maxlength="12" placeholder="หน่วย" data-ufree aria-label="หน่วยนับ ${esc(v.name)} (ไม่บังคับ)"></span>`
                  : v.unit ? `<span class="qty"><button type="button" data-q="-" aria-label="ลดจำนวน">${icon('minus')}</button><input type="number" min="1" value="${v.qty || ''}" data-qin aria-label="จำนวน ${esc(v.name)}"><button type="button" data-q="+" aria-label="เพิ่มจำนวน">${icon('plus')}</button></span><span class="unit">${esc(v.unit)}</span>` : ''}
                <button type="button" class="icon-btn sm" data-remove="${esc(k)}" aria-label="นำ ${esc(v.name)} ออก">${icon('close')}</button></div>
              <div class="field"><input class="input" data-detail value="${esc(v.detail || '')}" maxlength="200" placeholder="อาการของ${esc(v.name)} เช่น ${c?.id === 'ac' ? 'เปิดแล้วไม่เย็น มีน้ำหยด' : 'ชำรุด / หลวม / ใช้งานไม่ได้'}" aria-label="อาการของ ${esc(v.name)}"></div>
              <div class="dr-photos"><div class="thumbs-row">${thumbs(v)}</div>
                ${(v.photos || []).length < MAX_PHOTOS ? `<label class="btn btn-outline btn-sm">${icon('camera')} แนบรูป${(v.photos || []).length ? 'เพิ่ม' : ''}<input type="file" accept="image/*" multiple hidden data-photo></label>` : ''}
                <span class="hint">ไม่บังคับ · สูงสุด ${MAX_PHOTOS} รูป</span></div>
            </li>`;
          }).join('')}</ol>`;
        }
        function headHTML(b, i) {
          const issue = issueOf(b);
          const many = state.blocks.length > 1;
          return `
            <span class="lb-num">${i + 1}</span>
            <div class="lb-title"><strong>${esc(titleOf(b, i))}</strong>
              <span>${b.items.size ? `${b.items.size} รายการ` : 'ยังไม่มีรายการ'} · ${issue ? `<em>${issue}</em>` : `<b>${icon('check')} พร้อมส่ง</b>`}</span></div>
            ${many && !editing ? `<button type="button" class="icon-btn sm" data-rmblock aria-label="ลบ${UNIT}ที่ ${i + 1}">${icon('trash')}</button>` : ''}
            ${many ? `<span class="lb-chev" aria-hidden="true">${icon('chev')}</span>` : ''}`;
        }
        function blockHTML(b, i) {
          const p = placeOf(b);
          const prev = state.blocks[i - 1];
          return `
          <div class="loc-block ${b.open ? 'is-open' : ''} ${issueOf(b) ? '' : 'is-ready'}" data-block="${b.key}">
            <div class="lb-head" data-toggle-block>${headHTML(b, i)}</div>
            ${b.open ? `<div class="lb-body">
              ${dorm ? (state.dorm ? '' : `<div class="detail-empty">${icon('bed')}<span>เลือกหอพักในข้อ 2 ก่อน</span></div>`) : `
                ${placePicker(b)}`}
              ${zonePicker(b, p)}
              ${locOf(b) ? `<div class="field"><label>ตำแหน่ง / จุดที่ชำรุดเพิ่มเติม <span class="faint">(ถ้ามี)</span></label><input class="input" data-point value="${esc(b.point)}" placeholder="เช่น หน้าห้อง ฝั่งหน้าต่าง ห้องน้ำชาย"></div>` : ''}
              <div class="lb-sec">${icon('list')} เลือกรายการที่ต้องซ่อม
                ${prev?.items.size && !b.items.size ? `<button type="button" class="link small" data-copyprev>${icon('layers')} ใช้รายการเดียวกับ${UNIT}ที่ ${i}</button>` : ''}</div>
              <div class="cat-tabs">${tabsHTML(b)}</div><div class="cat-panel">${panelHTML(b)}</div>
              ${detailsHTML(b)}
            </div>` : ''}
          </div>`;
        }
        const renderBlocks = () => { $('#blocks', root).innerHTML = state.blocks.map(blockHTML).join(''); renderSummary(); };
        const renderBlock = b => {
          const el = $(`[data-block="${b.key}"]`, root);
          if (el) el.outerHTML = blockHTML(b, state.blocks.indexOf(b));
          renderSummary();
        };
        const renderHead = b => {
          const el = $(`[data-block="${b.key}"]`, root);
          if (!el) return;
          $('.lb-head', el).innerHTML = headHTML(b, state.blocks.indexOf(b));
          el.classList.toggle('is-ready', !issueOf(b));
          renderSummary();
        };
        function renderSummary() {
          const bs = state.blocks;
          const all = bs.flatMap(b => [...b.items.values()]);
          const ready = bs.filter(b => !issueOf(b)).length;
          const nPhotos = all.reduce((a, v) => a + (v.photos?.length || 0), 0);
          const where = bs.map((b, i) => locOf(b) ? titleOf(b, i) : '').filter(Boolean);
          $('#sumList', root).innerHTML = `
            ${dorm ? `<li>${icon('bed')}<div><span class="k">หอพัก</span>${placeById(state.dorm) ? esc(placeById(state.dorm).name) : '<span class="faint">ยังไม่ได้เลือก</span>'}</div></li>` : ''}
            <li>${icon('pin')}<div><span class="k">${UNIT} (${bs.length})</span>${where.length ? esc(where.slice(0, 4).join(', ')) + (where.length > 4 ? ` และอีก ${where.length - 4} แห่ง` : '') : '<span class="faint">ยังไม่ได้เลือก</span>'}</div></li>
            <li>${icon('list')}<div><span class="k">รายการทั้งหมด</span>${all.length} รายการ</div></li>
            <li>${icon('camera')}<div><span class="k">รูปประกอบ</span>${nPhotos} รูป</div></li>
            <li>${icon('check')}<div><span class="k">ความครบถ้วน</span>${ready === bs.length ? '<span style="color:#15803D">พร้อมส่งทุกใบ</span>' : `<span style="color:#B45309">พร้อม ${ready} จาก ${bs.length} ${UNIT}</span>`}</div></li>`;
          $('#submitBtn', root).innerHTML = `${icon(editing ? 'check' : 'send')} ${editing ? 'บันทึกการแก้ไข' : bs.length > 1 ? `ส่งแจ้งซ่อม ${bs.length} ใบ` : 'ส่งแจ้งซ่อม'}`;
        }
        renderBlocks();
        Views.bindZoom(root);

        // ───── บันทึกร่างอัตโนมัติ (เฉพาะข้อความ ไม่รวมรูป) เก็บในเครื่องนี้ 7 วัน ─────
        const DRAFT_KEY = `pcshs-draft:${me.email}:${type}`;
        const DRAFT_DAYS = 7;
        const fieldIds = ['phone', 'position', 'dept', 'note'];
        let draftTimer = 0;
        const hasContent = () => state.dorm || state.blocks.some(b => b.items.size || b.placeId || b.zone || b.room) || $('#note', root).value.trim();
        const saveDraft = () => {
          if (editing) return;
          clearTimeout(draftTimer);
          draftTimer = setTimeout(() => {
            try {
              if (!hasContent()) { localStorage.removeItem(DRAFT_KEY); return; }
              localStorage.setItem(DRAFT_KEY, JSON.stringify({
                at: new Date().toISOString(), dorm: state.dorm,
                fields: Object.fromEntries(fieldIds.map(id => [id, $('#' + id, root).value])),
                blocks: state.blocks.map(b => ({ placeId: b.placeId, other: b.other, zone: b.zone, room: b.room, point: b.point, active: b.active,
                  items: [...b.items.entries()].map(([k, v]) => [k, { ...v, photos: [] }]) }))
              }));
            } catch (e) { /* โหมดส่วนตัวหรือพื้นที่เต็ม ข้ามการบันทึกร่าง */ }
          }, 500);
        };
        const clearDraft = () => { clearTimeout(draftTimer); try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ } };
        const restoreDraft = d => {
          state.dorm = places.some(p => p.id === d.dorm) ? d.dorm : '';
          state.blocks = d.blocks.map(x => {
            const b = { ...newBlock(), placeId: x.placeId, other: x.other || '', zone: x.zone || '', room: x.room || '', point: x.point || '', active: x.active || firstCat, open: false };
            x.items.forEach(([k, v]) => b.items.set(v.custom ? `custom:${v.catId}:${seq++}` : k, v));
            return b;
          });
          if (!state.blocks.length) state.blocks.push(newBlock());
          state.blocks.at(-1).open = true;
          Object.entries(d.fields || {}).forEach(([id, v]) => { const el = $('#' + id, root); if (el && v != null && (el.tagName !== 'SELECT' || [...el.options].some(o => o.value === v))) el.value = v; });
          if (dorm) $('#dormSel', root).value = state.dorm;
          renderBlocks();
        };
        if (!editing) {
          let draft = null;
          try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { /* ร่างเสีย ข้าม */ }
          if (draft && (Date.now() - new Date(draft.at)) / 864e5 > DRAFT_DAYS) { clearDraft(); draft = null; }
          if (draft?.blocks?.length) {
            const n = draft.blocks.length, items = draft.blocks.reduce((a, b) => a + b.items.length, 0);
            UI.confirm(`พบร่างแจ้งซ่อมที่ยังไม่ได้ส่ง บันทึกเมื่อ ${UI.dateTime(draft.at)} (${n} ${UNIT} · ${items} รายการ) ต้องการกู้คืนไหม? รูปที่เคยแนบต้องแนบใหม่`,
              { title: 'กู้คืนร่างที่บันทึกไว้', okLabel: 'กู้คืนร่าง', cancelLabel: 'เริ่มใหม่' })
              .then(ok => { if (ok) { restoreDraft(draft); UI.toast('กู้คืนร่างแล้ว · อย่าลืมแนบรูปใหม่ถ้ามี'); } else clearDraft(); });
          }
          root.addEventListener('input', saveDraft);
          root.addEventListener('change', saveDraft);
          root.addEventListener('click', saveDraft);
        }

        const addCustom = (b, catId) => {
          const inp = $(`[data-block="${b.key}"] [data-other="${catId}"]`, root);
          const name = inp.value.trim();
          if (!name) return inp.focus();
          const c = Store.allCategories().find(x => x.id === catId);
          b.items.set(`custom:${catId}:${seq++}`, { catId, catName: c.name, itemId: '', name, unit: '', qty: 0, detail: '', custom: true, photos: [] });
          renderBlock(b);
          $(`[data-block="${b.key}"] .detail-row:last-child [data-detail]`, root)?.focus();
        };
        const addBlock = () => {
          if (dorm && !state.dorm) { UI.toast('กรุณาเลือกหอพักก่อน', 'error'); $('#dormSel', root).focus(); return; }
          if (state.blocks.length >= 8) { UI.toast(`แจ้งได้ครั้งละไม่เกิน 8 ${UNIT} ส่งชุดนี้ก่อนแล้วแจ้งชุดถัดไปได้เลย`, 'error'); return; }
          state.blocks.forEach(x => { x.open = false; });
          const b = newBlock();
          if (!dorm) b.placeId = state.blocks.at(-1)?.placeId === '__other' ? '' : state.blocks.at(-1)?.placeId || ''; // เริ่มจากสถานที่เดิม เลือกห้องถัดไปได้ทันที
          state.blocks.push(b);
          renderBlocks();
          $(`[data-block="${b.key}"]`, root).scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        root.addEventListener('click', async e => {
          if (e.target.closest('[data-addblock]')) { addBlock(); return; }
          const b = blockOf(e.target);
          if (!b) return;
          if (e.target.closest('[data-rmblock]')) {
            if ((b.items.size || locOf(b)) && !await UI.confirm(`ลบ "${titleOf(b, state.blocks.indexOf(b))}" และรายการทั้งหมดในการ์ดนี้?`, { title: `ลบ${UNIT}`, okLabel: 'ลบ' })) return;
            state.blocks.splice(state.blocks.indexOf(b), 1);
            if (!state.blocks.some(x => x.open)) state.blocks.at(-1).open = true;
            renderBlocks(); return;
          }
          if (e.target.closest('[data-toggle-block]')) {
            if (state.blocks.length < 2) return;
            b.open = !b.open; renderBlock(b); return;
          }
          const pk = e.target.closest('[data-pick]');
          if (pk) {
            Object.assign(b, { placeId: pk.dataset.pick, zone: pk.dataset.pzone || '', room: pk.dataset.proom || '', q: '' });
            renderBlock(b);
            $(`[data-block="${b.key}"] ${b.placeId === '__other' ? '[data-otherplace]' : '.pp-selected'}`, root)?.scrollIntoView({ block: 'nearest' });
            $(`[data-block="${b.key}"] [data-otherplace]`, root)?.focus();
            return;
          }
          if (e.target.closest('[data-ppchange]')) {
            Object.assign(b, { placeId: '', zone: '', room: '', q: '' });
            renderBlock(b);
            $(`[data-block="${b.key}"] [data-ppq]`, root)?.focus();
            return;
          }
          const zn = e.target.closest('[data-zone]');
          if (zn) { b.zone = b.zone === zn.dataset.zone ? '' : zn.dataset.zone; b.room = ''; renderBlock(b); return; }
          const rm0 = e.target.closest('[data-room]');
          if (rm0) { b.room = b.room === rm0.dataset.room ? '' : rm0.dataset.room; renderBlock(b); return; }
          if (e.target.closest('[data-copyprev]')) {
            const prev = state.blocks[state.blocks.indexOf(b) - 1];
            prev.items.forEach((v, k) => b.items.set(v.custom ? `custom:${v.catId}:${seq++}` : k, { ...v, photos: [] }));
            renderBlock(b);
            UI.toast('คัดลอกรายการแล้ว · ตรวจอาการและแนบรูปของที่นี้ได้เลย');
            return;
          }
          const tab = e.target.closest('[data-tab]');
          if (tab) { b.active = tab.dataset.tab; renderBlock(b); return; }
          const add = e.target.closest('[data-addother]'); if (add) { addCustom(b, add.dataset.addother); return; }
          const rp = e.target.closest('[data-rmphoto]');
          if (rp) { b.items.get(rp.closest('[data-key]').dataset.key).photos.splice(+rp.dataset.rmphoto, 1); renderBlock(b); return; }
          const rm = e.target.closest('[data-remove]');
          if (rm) { b.items.delete(rm.dataset.remove); renderBlock(b); return; }
          const q = e.target.closest('[data-q]');
          if (q) {
            const v = b.items.get(q.closest('[data-key]').dataset.key);
            v.qty = Math.max(1, (v.qty || 0) + (q.dataset.q === '+' ? 1 : -1));
            q.parentElement.querySelector('[data-qin]').value = v.qty; q.closest('.qty').classList.remove('invalid'); renderSummary(); renderHead(b); return;
          }
          const pick = e.target.closest('[data-item]');
          if (pick) {
            const id = pick.dataset.item;
            if (b.items.has(id)) b.items.delete(id);
            else {
              const c = Store.allCategories().find(x => x.id === pick.dataset.cat);
              const it = c.items.find(x => x.id === id);
              b.items.set(id, { catId: c.id, catName: c.name, itemId: id, name: it.name, unit: it.unit || '', qty: it.unit ? 1 : 0, detail: '', photos: [] });
            }
            renderBlock(b);
          }
        });
        root.addEventListener('keydown', e => {
          // Enter ในช่องค้นหาสถานที่ = เลือกผลลัพธ์แรก
          if (e.key === 'Enter' && e.target.matches('[data-ppq]')) { e.preventDefault(); e.target.closest('.field').querySelector('.pp-opt')?.click(); return; }
          if (e.key !== 'Enter' || !e.target.dataset.other) return;
          e.preventDefault(); addCustom(blockOf(e.target), e.target.dataset.other);
        });
        root.addEventListener('input', e => {
          const b = blockOf(e.target);
          if (!b) return;
          const row = e.target.closest('[data-key]');
          if (row && e.target.matches('[data-detail]')) { b.items.get(row.dataset.key).detail = e.target.value; e.target.closest('.field').classList.remove('invalid'); renderHead(b); }
          // จำนวน: ลบจนว่างได้ระหว่างพิมพ์ (0 = ยังไม่ระบุ → ส่งไม่ได้จนกว่าจะใส่)
          if (row && e.target.matches('[data-qin]')) e.target.closest('.qty').classList.remove('invalid');
          if (row && e.target.matches('[data-qin]')) { b.items.get(row.dataset.key).qty = Math.max(0, parseInt(e.target.value) || 0); renderSummary(); renderHead(b); }
          if (row && e.target.matches('[data-qfree]')) b.items.get(row.dataset.key).qty = Math.max(0, parseInt(e.target.value) || 0);
          if (row && e.target.matches('[data-ufree]')) b.items.get(row.dataset.key).unit = e.target.value.trim();
          if (e.target.matches('[data-point]')) b.point = e.target.value;
          // พิมพ์ค้นหา: อัปเดตเฉพาะรายการผลลัพธ์ (ไม่วาดการ์ดใหม่ ช่องพิมพ์ไม่หลุดโฟกัส)
          if (e.target.matches('[data-ppq]')) { b.q = e.target.value; const res = e.target.closest('.field').querySelector('[data-ppres]'); res.innerHTML = ppResults(b.q); res.scrollTop = 0; }
          if (e.target.matches('[data-otherplace]')) { b.other = e.target.value; renderHead(b); }
        });
        root.addEventListener('change', async e => {
          if (e.target.id === 'dormSel') {
            const used = state.blocks.some(b => b.zone || b.room);
            if (used && !await UI.confirm('เปลี่ยนหอพักแล้วล็อค/ห้องที่เลือกไว้จะถูกล้าง (รายการซ่อมยังอยู่)', { title: 'เปลี่ยนหอพัก', okLabel: 'เปลี่ยน' })) { e.target.value = state.dorm; return; }
            state.dorm = e.target.value;
            state.blocks.forEach(b => { b.zone = ''; b.room = ''; });
            renderBlocks(); return;
          }
          const b = blockOf(e.target);
          if (!b) return;
          if (e.target.matches('[data-place]')) { b.placeId = e.target.value; b.zone = ''; b.room = ''; renderBlock(b); $(`[data-block="${b.key}"] [data-otherplace]`, root)?.focus(); return; }
          if (e.target.matches('[data-photo]')) {
            const v = b.items.get(e.target.closest('[data-key]').dataset.key);
            for (const f of [...e.target.files].slice(0, MAX_PHOTOS - v.photos.length)) {
              try { v.photos.push(await UI.compressImage(f)); } catch (err) { UI.toast(err.message, 'error'); }
            }
            renderBlock(b);
          }
        });

        $('#repForm', root).addEventListener('submit', async e => {
          e.preventDefault();
          $$('.field.invalid', root).forEach(f => f.classList.remove('invalid'));
          const fail = (msg, el) => { UI.toast(msg, 'error'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
          if (!$('#phone', root).value.trim()) { $('#phone', root).closest('.field').classList.add('invalid'); return fail('กรุณาระบุเบอร์ติดต่อ', $('#phone', root)); }
          if (!/^0\d{8,9}$/.test($('#phone', root).value.replace(/\D/g, ''))) { $('#phone', root).closest('.field').classList.add('invalid'); return fail('เบอร์ติดต่อต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก', $('#phone', root)); }
          if (dorm && !state.dorm) { $('#dormSel', root).closest('.field').classList.add('invalid'); return fail('กรุณาเลือกหอพัก', $('#dormSel', root)); }
          const bad = state.blocks.findIndex(b => issueOf(b));
          if (bad >= 0) {
            const b = state.blocks[bad];
            if (!b.open) { b.open = true; renderBlock(b); }
            const el = $(`[data-block="${b.key}"]`, root);
            $$('[data-detail]', el).forEach(inp => { if (!inp.value.trim()) inp.closest('.field').classList.add('invalid'); });
            $$('[data-qin]', el).forEach(inp => { if (!(parseInt(inp.value) >= 1)) inp.closest('.qty').classList.add('invalid'); });
            return fail(`${titleOf(b, bad)}: ${issueOf(b)}`, $('.field.invalid', el) || el);
          }
          const entries = state.blocks.map(b => ({ location: locOf(b), items: [...b.items.values()].map(v => ({ ...v, detail: String(v.detail || '').trim() })) }));
          const keys = entries.map(x => locKey(x.location));
          const twin = keys.findIndex((k, i) => keys.indexOf(k) !== i);
          if (twin >= 0) return fail(`${UNIT}ที่ ${keys.indexOf(keys[twin]) + 1} และ ${twin + 1} เป็นที่เดียวกัน กรุณารวมรายการไว้ในการ์ดเดียว`, $(`[data-block="${state.blocks[twin].key}"]`, root));
          const input = { formType: type, phone: $('#phone', root).value.trim(), position: $('#position', root).value, dept: $('#dept', root).value,
            note: $('#note', root).value.trim(), photos: editing?.photos || [] };
          const nItems = entries.reduce((a, x) => a + x.items.length, 0);
          // เตือนเมื่อมีงานเดียวกันที่ยังไม่ปิดอยู่แล้ว
          const dups = [...new Map(entries.flatMap(x => Store.duplicates({ ...input, ...x }, editing?.id)).map(t => [t.id, t])).values()];
          const where = entries.length > 1 ? `${entries.length} ${UNIT} (แยกเป็น ${entries.length} ใบ)` : UI.locationText(entries[0].location);
          const proceed = dups.length
            ? await new Promise(res => UI.modal({ title: 'มีการแจ้งซ่อมรายการนี้อยู่แล้ว', subtitle: where,
              body: `<div class="notice orange">${icon('alert')}<div>พบคำขอที่ยังไม่ปิดงาน ${dups.length} รายการ ในสถานที่และรายการเดียวกัน กรุณาตรวจสอบก่อนเพื่อไม่ให้แจ้งซ้ำ</div></div>
                <div class="ticket-list">${dups.map(t => `<a class="t-card" href="#/ticket/${t.id}" target="_blank"><span class="t-ic">${icon(Views.ticketIcon(t))}</span><div class="t-main"><div class="t-id">${esc(t.id)}</div><div class="t-title">${esc(Views.itemsTitle(t))}</div><div class="t-meta"><span>${icon('pin')}${esc(UI.locationText(t))}</span><span>${icon('user')}${esc(t.reporter.name)}</span></div></div><div class="t-side">${UI.statusBadge(t.status)}</div></a>`).join('')}</div>`,
              actions: [{ label: 'ไม่ส่ง กลับไปแก้ไข', kind: 'btn-ghost-dark', onClick: () => res(false) }, { label: 'เป็นปัญหาใหม่ ส่งต่อ', kind: 'btn-primary', icon: 'send', onClick: () => res(true) }] }))
            : await UI.confirm(`${editing ? 'บันทึกการแก้ไข' : 'ยืนยันส่งแจ้งซ่อม'} ${nItems} รายการ ที่ ${where}`, { title: editing ? 'ยืนยันการแก้ไข' : 'ยืนยันการแจ้งซ่อม', okLabel: editing ? 'บันทึก' : 'ส่งแจ้งซ่อม' });
          if (!proceed) return;
          const btn = $('#submitBtn', root); btn.disabled = true; btn.innerHTML = `${icon('refresh')} กำลังบันทึก...`;
          try {
            if (editing) { await Store.updateTicket(editing.id, { ...input, ...entries[0] }); UI.toast('บันทึกการแก้ไขแล้ว'); App.go('/ticket/' + editing.id); }
            else { const list = await Store.createTickets({ ...input, entries }); clearDraft(); App.go('/success/' + list[0].id); }
          } catch (err) {
            UI.toast(err.message, 'error');
            btn.disabled = false; renderSummary();
          }
        });
      }
    };
  }

  // ═══════════ แจ้งซ่อมสำเร็จ ═══════════
  function success(params) {
    const t = Store.ticket(params.id);
    if (!t) return notFound();
    return {
      title: 'แจ้งซ่อมสำเร็จ',
      html: `
      ${pageHero({ title: 'แจ้งซ่อมเรียบร้อยแล้ว', crumbs: [{ label: 'แจ้งซ่อม', href: '/report' }, { label: 'สำเร็จ' }] })}
      <div class="page-body"><div class="container">
        <div class="card success-card">
          <div class="success-ic">${icon('check')}</div>
          <h2 style="margin-top:28px;font-size:1.75rem;font-weight:600;color:var(--navy-800)">ส่งคำขอแจ้งซ่อมสำเร็จ</h2>
          <p class="muted" style="margin-top:8px">คำขออยู่ในสถานะ "รออนุมัติ" คุณจะได้รับการแจ้งเตือนทางอีเมลและในระบบเมื่อสถานะเปลี่ยน</p>
          ${t.batchIds?.length > 1 ? `
          <p style="margin-top:18px">แยกเป็นใบแจ้งซ่อม <strong>${t.batchIds.length} ใบ</strong> ตามสถานที่</p>
          <div class="batch-list">${t.batchIds.map(id => Store.ticket(id)).filter(Boolean).map(x => `<a class="batch-item" href="#/ticket/${x.id}"><strong>${esc(x.id)}</strong><span>${esc(UI.locationText(x))}</span></a>`).join('')}</div>
          <div class="row" style="justify-content:center;margin-top:24px">
            <button class="btn btn-primary btn-lg" data-printall>${icon('printer')} พิมพ์ใบแจ้งซ่อมทั้งหมด (${t.batchIds.length} ใบ)</button>
            <a class="btn btn-outline btn-lg" href="#/my">${icon('track')} งานที่ฉันแจ้ง</a>
          </div>` : `
          <div class="ticket-no">${icon('file')}${esc(t.id)}</div>
          <div class="row" style="justify-content:center;margin-top:30px">
            <a class="btn btn-primary btn-lg" href="#/doc/${t.id}">${icon('download')} ดาวน์โหลดใบแจ้งซ่อม (PDF)</a>
            <a class="btn btn-outline btn-lg" href="#/ticket/${t.id}">${icon('track')} ติดตามสถานะ</a>
          </div>`}
          <div class="notice orange" style="margin-top:28px;text-align:left">${icon('sign')}<div>ใบแจ้งซ่อมจะแสดงลายเซ็นผู้บริหารโดยอัตโนมัติเมื่อเริ่มดำเนินการซ่อม และแสดงผลการซ่อมเมื่อเสร็จสิ้น กลับมาพิมพ์ฉบับสมบูรณ์ได้ที่หน้า <a class="link" href="#/my">งานที่ฉันแจ้ง</a></div></div>
          <a class="link" href="#/report" style="margin-top:22px">${icon('plus')} แจ้งซ่อมรายการอื่น</a>
        </div>
      </div></div>`,
      mount(root) {
        $('[data-printall]', root)?.addEventListener('click', () => {
          sessionStorage.setItem('pcshs-print', JSON.stringify({ ids: t.batchIds, style: 'memo', group: false, cover: false, photos: true, title: 'ใบแจ้งซ่อม', scope: `${t.batchIds.length} สถานที่` }));
          App.go('/print');
        });
      }
    };
  }

  // ═══════════ งานที่ฉันแจ้ง ═══════════
  function myTickets() {
    const state = { status: 'all', q: '' };
    return {
      title: 'งานที่ฉันแจ้ง',
      html: `
      ${pageHero({ title: 'งานที่ฉันแจ้ง', desc: 'ติดตามความคืบหน้า ดูผลการซ่อม และพิมพ์ใบแจ้งซ่อมของคุณ', crumbs: [{ label: 'ติดตามสถานะ' }, { label: 'งานที่ฉันแจ้ง' }] })}
      <div class="page-body"><div class="container stack" style="gap:20px">
        <div class="kpi-row" id="myKpi"></div>
        <div class="card toolbar">
          <div class="input-icon">${icon('search')}<input class="input" id="q" placeholder="ค้นหาเลขที่ รายการ หรือสถานที่"></div>
          <div class="seg" id="grp"></div>
          <a class="btn btn-primary" href="#/report">${icon('plus')} แจ้งซ่อมใหม่</a>
        </div>
        <div class="ticket-list" id="list"></div>
      </div></div>`,
      mount(root) {
        const render = () => {
          const me = Store.me();
          const mine = Store.tickets().filter(t => t.reporter.email === me.email).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          const n = st => mine.filter(t => t.status === st).length;
          $('#myKpi', root).innerHTML = [
            ['ทั้งหมด', 'inbox', mine.length, 'dark'], ['รออนุมัติ', 'clock', n('pending')],
            ['กำลังดำเนินการ / รอพิจารณา', 'wrench', n('in_progress') + n('review')], ['เสร็จสิ้น', 'checkCircle', n('done') + n('cannot_fix')]
          ].map(([l, ic, v, cls = '']) => `<div class="kpi ${cls}"><div class="kpi-label">${l}${icon(ic)}</div><div class="kpi-value">${v}<small>รายการ</small></div></div>`).join('');
          $('#grp', root).innerHTML = [['all', 'ทั้งหมด'], ...UI.STATUS_KEYS.map(k => [k, UI.STATUS[k].label])]
            .map(([k, l]) => `<button type="button" class="${state.status === k ? 'is-active' : ''}" data-g="${k}">${l}</button>`).join('');
          const q = state.q.toLowerCase();
          const list = mine.filter(t => (state.status === 'all' || t.status === state.status) && (!q || [t.id, Views.itemsTitle(t), UI.locationText(t)].join(' ').toLowerCase().includes(q)));
          $('#list', root).innerHTML = list.length ? list.map(t => Views.ticketCard(t)).join('')
            : `<div class="card empty">${icon('inbox')}<strong>${mine.length ? 'ไม่พบรายการตามเงื่อนไข' : 'คุณยังไม่มีรายการแจ้งซ่อม'}</strong><span>${mine.length ? 'ลองเปลี่ยนคำค้นหรือตัวกรอง' : 'เริ่มแจ้งซ่อมรายการแรกได้เลย'}</span>${mine.length ? '' : '<a class="btn btn-primary" href="#/report">แจ้งซ่อม</a>'}</div>`;
        };
        render();
        $('#q', root).addEventListener('input', e => { state.q = e.target.value; render(); });
        $('#grp', root).addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) { state.status = b.dataset.g; render(); } });
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ รายละเอียดงาน (มุมมองครู) ═══════════
  function ticket(params) {
    return {
      title: params.id,
      html: `
      ${pageHero({ title: `ใบแจ้งซ่อม ${esc(params.id)}`, crumbs: [{ label: 'ติดตามสถานะ', href: '/my' }, { label: params.id }] })}
      <div class="page-body"><div class="container" id="detail"></div></div>`,
      mount(root) {
        const render = () => {
          const t = Store.ticket(params.id);
          const me = Store.me();
          if (!t) { $('#detail', root).innerHTML = `<div class="card empty">${icon('alert')}<strong>ไม่พบใบแจ้งซ่อมนี้</strong></div>`; return; }
          const s = S();
          const final = ['done', 'cannot_fix'].includes(t.status);
          const mineOrStaff = t.reporter.email === me.email || Store.canSee(me, t);
          $('#detail', root).innerHTML = `
            <div class="detail-layout">
              <div class="stack" style="gap:20px">
                ${Views.headCard(t)}
                ${Views.infoCard(t)}
                ${Views.resultCard(t)}
                ${Views.historyCard(t)}
              </div>
              <aside class="stack action-panel" style="gap:20px">
                ${Store.can(me, 'edit', t) ? `<section class="card">
                  <div class="card-head"><h3>${icon('edit')}คำขอของคุณ</h3></div>
                  <div class="card-body stack">
                    <p class="small muted">ยังรออนุมัติ แก้ไขรายละเอียดหรือยกเลิกคำขอได้</p>
                    <a class="btn btn-soft btn-block" href="#/edit/${t.id}">${icon('edit')} แก้ไขคำขอ</a>
                    <button class="btn btn-outline btn-block" data-cancel>${icon('close')} ยกเลิกคำขอ</button>
                  </div>
                </section>` : ''}
                ${Store.can(me, 'reopen', t) ? `<section class="card">
                  <div class="card-head"><h3>${icon('alert')}ซ่อมแล้วยังไม่หาย?</h3></div>
                  <div class="card-body stack">
                    <p class="small muted">แจ้งได้ถึง ${UI.dateLong(Store.reopenDeadline(t).toISOString())} ระบบจะเปิดใบแจ้งซ่อมใหม่ที่อ้างอิงใบนี้ให้อัตโนมัติ</p>
                    <button class="btn btn-primary btn-block" data-reopen>${icon('refresh')} แจ้งว่ายังไม่หาย / เสียอีก</button>
                  </div>
                </section>` : ''}
                ${t.reopenedBy ? `<div class="notice">${icon('refresh')}<div>แจ้งซ้ำแล้วในใบ <a class="link" href="#/ticket/${esc(t.reopenedBy)}">${esc(t.reopenedBy)}</a></div></div>` : ''}
                ${mineOrStaff ? `<section class="card">
                  <div class="card-head"><h3>${icon('printer')}เอกสาร</h3></div>
                  <div class="card-body stack">
                    <p class="small muted">${final ? 'ใบแจ้งซ่อมฉบับสมบูรณ์ พร้อมลายเซ็นและผลการดำเนินงาน' : 'ใบแจ้งซ่อมจะอัปเดตลายเซ็นและผลการซ่อมอัตโนมัติตามความคืบหน้า'}</p>
                    <a class="btn btn-primary btn-block" href="#/doc/${t.id}">${icon('download')} ใบแจ้งซ่อม (มีตราครุฑ)</a>
                    <a class="btn btn-outline btn-block" href="#/doc/${t.id}?style=plain">${icon('file')} ใบแจ้งซ่อม (แบบทั่วไป)</a>
                    ${Store.canSee(me, t) && Store.isStaff(me) ? `<a class="btn btn-ghost-dark btn-block" href="#/admin/job/${t.id}">${icon('shield')} เปิดในระบบหลังบ้าน</a>` : ''}
                  </div>
                </section>` : ''}
                <section class="card">
                  <div class="card-head"><h3>${icon('phone')}สอบถามเพิ่มเติม</h3></div>
                  <div class="card-body stack small">
                    <span class="row" style="gap:10px">${icon('phone')}${esc(s.contact.phone)}</span>
                    <span class="row" style="gap:10px">${icon('mail')}${esc(s.contact.email)}</span>
                    <span class="row" style="gap:10px">${icon('pin')}${esc(s.contact.office)}</span>
                    <a class="link" href="#/contact">ดูรายชื่อบุคลากร ${icon('arrow')}</a>
                  </div>
                </section>
              </aside>
            </div>`;
        };
        render();
        Views.bindZoom(root);
        root.addEventListener('click', e => {
          if (e.target.closest('[data-cancel]')) {
            UI.modal({ title: 'ยกเลิกคำขอแจ้งซ่อม', subtitle: params.id, size: 'sm',
              body: `<div class="field"><label for="why">เหตุผล (ถ้ามี)</label><input class="input" id="why" placeholder="เช่น แจ้งผิดห้อง / ใช้งานได้แล้ว"></div>`,
              actions: [{ label: 'ไม่ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'ยืนยันยกเลิก', kind: 'btn-danger', onClick: async api => { await Store.cancelTicket(params.id, $('#why', api.body).value.trim()); UI.toast('ยกเลิกคำขอแล้ว'); } }] });
          }
          if (e.target.closest('[data-reopen]')) {
            UI.modal({ title: 'แจ้งว่ายังไม่หาย / เสียอีก', subtitle: params.id,
              body: `<p class="small muted">ระบบจะสร้างใบแจ้งซ่อมใหม่ด้วยรายการและสถานที่เดิม และอ้างอิงใบ ${esc(params.id)}</p>
                <div class="field"><label for="why">อาการที่ยังพบ <span class="req">*</span></label><textarea class="textarea" id="why" placeholder="เช่น ซ่อมแล้ว 2 วัน ไฟกลับมากะพริบอีก"></textarea></div>`,
              actions: [{ label: 'ยกเลิก', kind: 'btn-ghost-dark' }, { label: 'แจ้งซ่อมซ้ำ', kind: 'btn-primary', icon: 'send', onClick: async api => {
                const t = await Store.reopenTicket(params.id, $('#why', api.body).value.trim());
                UI.toast(`เปิดใบแจ้งซ่อมใหม่ ${t.id} แล้ว`); App.go('/ticket/' + t.id);
              } }] });
          }
        });
        App.onCleanup(Store.subscribe(render));
      }
    };
  }

  // ═══════════ ช่วงเวลา ═══════════
  function semesterStart(now = new Date()) {
    const y = now.getFullYear(), m = now.getMonth() + 1;
    if (m >= 5 && m <= 10) return new Date(y, 4, 1);
    if (m >= 11) return new Date(y, 10, 1);
    return new Date(y - 1, 10, 1);
  }
  function rangeStart(key) {
    const now = new Date(), d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    switch (key) {
      case 'today': return d0;
      case '7d': return new Date(d0 - 6 * 864e5);
      case '30d': return new Date(d0 - 29 * 864e5);
      case '90d': return new Date(d0 - 89 * 864e5);
      case '365d': return new Date(d0.getFullYear() - 1, d0.getMonth(), d0.getDate() + 1);
      case 'month': return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'sem': return semesterStart(now);
      case 'fy': return new Date(now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1, 9, 1);
      default: return null;
    }
  }
  const RANGE_LABEL = { today: 'วันนี้', '7d': '7 วันล่าสุด', '30d': '30 วันล่าสุด', '90d': '90 วันล่าสุด', month: 'เดือนนี้', sem: 'ภาคเรียนนี้', fy: 'ปีงบประมาณนี้', '365d': '12 เดือนล่าสุด', all: 'ทั้งหมด', custom: 'กำหนดเอง' };

  // แถบเลือก 3 หมวดหลัก (ใช้ทั้งแดชบอร์ด รายการงาน และสถิติ)
  const FORM_SHORT = { '': 'ทั้งหมด', general: 'ทั่วไป', dorm: 'หอพัก' };
  function formTabs(active, counts, forms = Store.FORM_KEYS) {
    return `<div class="form-tabs" role="tablist">
      ${[['', 'ทั้งหมด', 'layers'], ...forms.map(k => [k, Views.formName(k), UI.FORM_ICON[k]])].map(([k, l, ic]) => `
        <button type="button" role="tab" class="form-tab ${active === k ? 'is-active' : ''}" data-form="${k}" aria-selected="${active === k}" aria-label="${esc(l)}">
          <span class="ft-ic">${icon(ic)}</span><span class="ft-l"><span class="ft-full">${esc(l)}</span><span class="ft-short">${FORM_SHORT[k]}</span></span>${counts ? `<span class="ft-n">${counts[k || 'all'] ?? 0}</span>` : ''}</button>`).join('')}
    </div>`;
  }

  // ═══════════ แดชบอร์ดติดตามสถานะแบบเรียลไทม์ ═══════════
  // คอม/iPad: กระดานคิวแบบจอโรงพยาบาล (เลื่อนอัตโนมัติ + โหมดจอทีวี) · มือถือ: แท็บสถานะ + รายการ
  function board() {
    const state = { range: '90d', from: '', to: '', form: '', cat: '', q: '', col: 'in_progress' };
    let lastSeen = new Map(), lastSig = '', lastBuild = 0;
    const COLS = [['pending', ['pending']], ['in_progress', ['in_progress']], ['review', ['review']], ['finished', ['done', 'cannot_fix']]];
    const COL_LABEL = { pending: 'รออนุมัติ', in_progress: 'กำลังดำเนินการซ่อม', review: 'รอพิจารณา', finished: 'เสร็จสิ้นล่าสุด' };
    const COL_SHORT = { pending: 'รออนุมัติ', in_progress: 'กำลังซ่อม', review: 'รอพิจารณา', finished: 'เสร็จสิ้น' };
    const COL_COLOR = { pending: '#F59E0B', in_progress: '#F97316', review: '#818CF8', finished: '#22C55E' };
    const COL_ICON = { pending: 'clock', in_progress: 'wrench', review: 'hourglass', finished: 'checkCircle' };
    return {
      title: 'แดชบอร์ดติดตามสถานะ',
      html: `
      ${pageHero({ title: 'แดชบอร์ดติดตามสถานะ', desc: 'ภาพรวมงานซ่อมทั้งโรงเรียน อัปเดตอัตโนมัติแบบเรียลไทม์ และย้อนดูข้อมูลตามช่วงเวลาได้', crumbs: [{ label: 'ติดตามสถานะ' }, { label: 'แดชบอร์ด' }] })}
      <div class="page-body"><div class="container stack" style="gap:16px">
        <div class="card" style="padding:16px" id="ftabs"></div>
        <div class="card live-bar">
          <div class="seg seg-line" id="range">
            ${['today', '7d', '30d', '90d', 'sem', 'all', 'custom'].map(k => `<button type="button" data-r="${k}" class="${k === state.range ? 'is-active' : ''}">${RANGE_LABEL[k].replace('ล่าสุด', '')}</button>`).join('')}
          </div>
          <div class="row" id="custom" hidden><input type="date" class="input sm" id="from" aria-label="ตั้งแต่วันที่"><span class="faint">ถึง</span><input type="date" class="input sm" id="to" aria-label="ถึงวันที่"></div>
          <span class="spacer"></span>
          <select class="select sm" id="cat" aria-label="หมวดงาน"><option value="">ทุกหมวดงาน</option>${Store.allCategories().map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
          <div class="input-icon lb-search">${icon('search')}<input class="input sm" id="q" placeholder="ค้นหาเลขที่ / ห้อง" style="padding-left:40px"></div>
        </div>

        <section class="qboard" id="qboard" aria-label="กระดานสถานะงานซ่อม">
          <header class="qb-head">
            <img src="images/logo.png" alt="">
            <div class="qb-title"><small>แผนกแจ้งซ่อมอาคารและสถานที่</small><strong>กระดานสถานะงานซ่อม</strong></div>
            <span class="qb-live"><span class="live-dot"></span>LIVE</span>
            <div class="qb-clock"><strong id="qClock">--:--:--</strong><small id="qDate"></small></div>
            <button type="button" class="qb-tv" id="tvBtn" aria-pressed="false">${icon('monitor')}<span>โหมดจอทีวี</span></button>
          </header>
          <div class="qb-cols" id="qCols"></div>
          <div class="qb-ticker" aria-label="ความเคลื่อนไหวล่าสุด"><span class="qb-tk-label">${icon('activity')} ล่าสุด</span><div class="qb-tk-view"><div class="qb-tk-track" id="qTicker"></div></div></div>
        </section>

        <div class="m-board">
          <div class="m-kpis" id="mKpis" role="tablist"></div>
          <div class="ticket-list m-list" id="mList"></div>
          <p class="small faint m-upd"><span class="live-dot"></span> อัปเดตอัตโนมัติ · <span id="lastUpd"></span></p>
        </div>
      </div></div>`,
      mount(root) {
        const me = Store.me();
        // ใบของคนอื่นที่เห็นแค่ข้อมูลกระดาน (ไม่มีสิทธิ์เปิดรายละเอียด) ไม่ต้องลิงก์ไปไหน
        const linkFor = t => t._board ? '/board' : Store.isStaff(me) && Store.canSee(me, t) ? `/admin/job/${t.id}` : `/ticket/${t.id}`;
        const lastAct = t => t.history.at(-1).at;
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const where = t => UI.locationText({ ...t.location, point: '' });

        // อาการที่แจ้ง: ถ้ามีหลายรายการให้บอกชื่อรายการกำกับ
        const symptoms = t => t.items.filter(i => String(i.detail || '').trim()).map(i => t.items.length > 1 ? `${i.name}: ${i.detail}` : i.detail).join(' · ');
        const qRow = (t, k) => `
          <a class="q-row ${lastSeen.size && lastSeen.get(t.id) !== lastAct(t) ? 'q-new' : ''}" href="#${linkFor(t)}">
            <span class="q-top"><b class="q-loc">${esc(where(t))}</b><span class="q-id" title="${esc(t.id)}">#${esc(t.id.slice(9))}</span></span>
            <span class="q-items">${icon(Views.ticketIcon(t))}<span>${esc(Views.itemsTitle(t))}</span></span>
            ${symptoms(t) ? `<span class="q-detail">${esc(symptoms(t))}</span>` : ''}
            <span class="q-foot"><span class="q-who">${icon(UI.FORM_ICON[t.formType])}${esc(Views.formShort(t.formType))}</span>
              ${k === 'finished' ? `<em class="${t.status}">${t.status === 'done' ? 'เสร็จ' : 'ซ่อมไม่ได้'}</em>` : ''}<span class="q-time">${UI.ago(lastAct(t))}</span></span>
          </a>`;
        // คอลัมน์ที่ยาวเกินจอจะเลื่อนขึ้นวนอัตโนมัติ (ช้า ๆ ตามจำนวนรายการ) และหยุดเมื่อเอาเมาส์ชี้
        const startMarquee = () => $$('.q-body', root).forEach(body => {
          const track = $('.q-track', body);
          if (reduce || track.scrollHeight <= body.clientHeight + 4) return;
          const n = track.children.length;
          track.insertAdjacentHTML('beforeend', `<div class="q-clone" aria-hidden="true">${track.innerHTML}</div>`);
          track.style.setProperty('--dur', `${Math.max(18, n * 3.2)}s`);
          body.classList.add('is-marquee');
        });

        const render = (force = false) => {
          const from = state.range === 'custom' ? (state.from ? new Date(state.from) : null) : rangeStart(state.range);
          const to = state.range === 'custom' && state.to ? new Date(new Date(state.to).getTime() + 864e5) : null;
          const q = state.q.toLowerCase();
          const base = Store.tickets().filter(t => {
            if (t.status === 'cancelled') return false;
            const d = new Date(t.createdAt);
            if (from && d < from) return false;
            if (to && d >= to) return false;
            if (state.cat && !t.items.some(i => i.catId === state.cat)) return false;
            if (q && ![t.id, Views.itemsTitle(t), UI.locationText(t)].join(' ').toLowerCase().includes(q)) return false;
            return true;
          });
          const counts = { all: base.length, ...Object.fromEntries(Store.FORM_KEYS.map(k => [k, base.filter(t => t.formType === k).length])) };
          $('#ftabs', root).innerHTML = formTabs(state.form, counts);
          const list = base.filter(t => !state.form || t.formType === state.form);
          const cols = Object.fromEntries(COLS.map(([k, sts]) => [k, list.filter(t => sts.includes(t.status)).sort((a, b) => lastAct(b).localeCompare(lastAct(a)))]));
          $('#lastUpd', root).textContent = `ล่าสุด ${new Date().toLocaleTimeString('th-TH')} น.`;

          // วาดใหม่เฉพาะเมื่อข้อมูลเปลี่ยน (หรือทุก 5 นาทีเพื่ออัปเดตเวลา) กระดานจะได้เลื่อนต่อเนื่องไม่สะดุด
          const sig = [state.form, ...list.map(t => t.id + lastAct(t))].join('|');
          if (!force && sig === lastSig && Date.now() - lastBuild < 300000) return;
          lastSig = sig; lastBuild = Date.now();

          // มือถือ: แท็บสถานะ 4 ช่องแถวเดียว + รายการของสถานะที่เลือก
          $('#mKpis', root).innerHTML = COLS.map(([k]) => `
            <button type="button" role="tab" class="m-kpi ${state.col === k ? 'is-active' : ''}" data-col="${k}" aria-selected="${state.col === k}" style="--c:${COL_COLOR[k]}">
              <strong>${cols[k].length}</strong><span><i class="dot"></i>${COL_SHORT[k]}</span></button>`).join('');
          const mine = cols[state.col].slice(0, 60);
          $('#mList', root).innerHTML = mine.map(t => `
            <a class="t-card ${lastSeen.size && lastSeen.get(t.id) !== lastAct(t) ? 'flash' : ''}" href="#${linkFor(t)}"><span class="t-ic">${icon(Views.ticketIcon(t))}</span>
              <div class="t-main"><div class="t-id">${esc(t.id)}</div><div class="t-title">${esc(Views.itemsTitle(t))}</div>
                <div class="t-meta"><span>${icon('pin')}${esc(where(t))}</span><span>${icon('clock')}${UI.ago(lastAct(t))}</span></div></div>
              <div class="t-side">${UI.statusBadge(t.status)}</div></a>`).join('')
            + (cols[state.col].length > mine.length ? `<p class="small faint" style="text-align:center">และอีก ${cols[state.col].length - mine.length} รายการ · ใช้ช่องค้นหาเพื่อหางานที่ต้องการ</p>` : '')
            || `<div class="empty">${icon('inbox')}<strong>ไม่มีงานในสถานะนี้</strong></div>`;

          // คอม/iPad: กระดานคิว
          $('#qCols', root).innerHTML = COLS.map(([k]) => {
            const items = cols[k].slice(0, k === 'finished' ? 20 : 40);
            return `<div class="q-col" style="--c:${COL_COLOR[k]}">
              <div class="q-head"><span class="q-ic">${icon(COL_ICON[k])}</span><span class="q-label"><span class="ql-long">${COL_LABEL[k]}</span><span class="ql-short">${COL_SHORT[k]}</span></span><strong class="q-count">${cols[k].length}</strong></div>
              <div class="q-body"><div class="q-track">${items.map(t => qRow(t, k)).join('') || '<div class="q-empty">ไม่มีรายการ</div>'}</div></div>
            </div>`;
          }).join('');
          const feed = list.flatMap(t => t.history.map(h => ({ ...h, id: t.id }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
          const tk = feed.map(h => `<span class="tk-item"><b>${esc(h.id)}</b> ${esc(h.action)} <small>${UI.ago(h.at)}</small></span>`).join('');
          $('#qTicker', root).innerHTML = reduce ? tk : tk + tk;
          $('#qTicker', root).style.setProperty('--dur', `${Math.max(30, feed.length * 6)}s`);
          startMarquee();
          lastSeen = new Map(Store.tickets().map(t => [t.id, lastAct(t)]));
        };
        render(true);

        // นาฬิกาบนกระดาน
        const tick = () => {
          const d = new Date();
          $('#qClock', root).textContent = d.toLocaleTimeString('th-TH', { hour12: false });
          $('#qDate', root).textContent = d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        };
        tick();
        const clock = setInterval(tick, 1000);

        // โหมดจอทีวี: เต็มจอ ซ่อนเมนู ตัวอักษรใหญ่ (กด Esc เพื่อออก)
        const setTv = on => {
          document.body.classList.toggle('tv-mode', on);
          $('#tvBtn', root).setAttribute('aria-pressed', on);
          $('#tvBtn span', root).textContent = on ? 'ออกจากโหมดทีวี' : 'โหมดจอทีวี';
          render(true);
        };
        $('#tvBtn', root).addEventListener('click', () => {
          const on = !document.body.classList.contains('tv-mode');
          setTv(on);
          // เต็มจอถ้าเบราว์เซอร์รองรับ (iPad บางรุ่นไม่รองรับ จะเป็นโหมดทีวีในหน้าต่างแทน)
          const p = on ? document.documentElement.requestFullscreen?.() : document.fullscreenElement && document.exitFullscreen();
          p?.catch?.(() => {});
        });
        const onFs = () => { if (!document.fullscreenElement && document.body.classList.contains('tv-mode')) setTv(false); };
        document.addEventListener('fullscreenchange', onFs);
        const onKey = e => { if (e.key === 'Escape' && document.body.classList.contains('tv-mode')) setTv(false); };
        document.addEventListener('keydown', onKey);

        $('#range', root).addEventListener('click', e => {
          const b = e.target.closest('[data-r]'); if (!b) return;
          state.range = b.dataset.r;
          $$('#range button', root).forEach(x => x.classList.toggle('is-active', x === b));
          $('#custom', root).hidden = state.range !== 'custom';
          render(true);
        });
        root.addEventListener('click', e => {
          const f = e.target.closest('[data-form]'); if (f) { state.form = f.dataset.form; render(true); return; }
          const c = e.target.closest('[data-col]'); if (c) { state.col = c.dataset.col; render(true); }
        });
        root.addEventListener('input', e => { if (['from', 'to', 'cat', 'q'].includes(e.target.id)) { state[e.target.id] = e.target.value; render(true); } });
        App.onCleanup(Store.subscribe(() => render()));
        // ระบบจริงจะดึงข้อมูลใหม่ทุก 15 วินาที ต้นแบบนี้ตรวจการเปลี่ยนแปลงจากข้อมูลในเครื่อง
        const timer = setInterval(() => render(), 15000);
        App.onCleanup(() => {
          clearInterval(timer); clearInterval(clock);
          document.removeEventListener('fullscreenchange', onFs);
          document.removeEventListener('keydown', onKey);
          document.body.classList.remove('tv-mode');
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        });
      }
    };
  }

  // ═══════════ ติดต่อเรา ═══════════
  function contact() {
    const s = S();
    const staff = Store.staff();
    const leads = staff.filter(m => m.tier === 'lead');
    const team = staff.filter(m => m.tier !== 'lead');
    const ch = s.contact;
    const photo = m => m.photo ? `<img src="${m.photo}" alt="${esc(m.name)}">` : `<span class="ph">${icon('user')}</span>`;
    // ชื่อและนามสกุลไม่ตัดกลางคำ (ขึ้นบรรทัดใหม่ได้เฉพาะช่องว่าง)
    const nameHTML = n => String(n || '').split(/\s+/).map(w => `<span class="keep">${esc(w)}</span>`).join(' ');
    return {
      title: 'ติดต่อเรา',
      html: `
      ${pageHero({ title: 'ติดต่อเรา', desc: `บุคลากร${esc(s.division)} ผู้ดูแลงานอาคาร สถานที่ และงานซ่อมบำรุงของโรงเรียน`, crumbs: [{ label: 'ติดต่อเรา' }] })}
      <div class="page-body"><div class="container stack" style="gap:56px">
        ${leads.length ? `
        <div class="lead-grid ${leads.length > 1 ? 'is-multi' : ''}">
          ${leads.map((lead, i) => `
          <article class="lead-card reveal" style="transition-delay:${i * 80}ms">
            <div class="lead-photo">${photo(lead)}</div>
            <div class="lead-info">
              <span class="role">ผู้บริหารฝ่าย</span>
              <h2>${nameHTML(lead.name)}</h2>
              <div class="pos">${esc(lead.position)}</div>
              ${lead.message ? `<blockquote>${esc(lead.message)}</blockquote>` : ''}
              ${lead.duties ? `<p class="muted" style="margin-top:6px">${esc(lead.duties)}</p>` : ''}
              <div class="contact-line">${lead.phone ? `<a href="tel:${esc(lead.phone)}">${icon('phone')}${esc(lead.phone)}</a>` : ''}${lead.email ? `<a href="mailto:${esc(lead.email)}">${icon('mail')}${esc(lead.email)}</a>` : ''}</div>
            </div>
          </article>`).join('')}
        </div>` : ''}

        <section>
          <div class="section-title reveal"><div><span class="kicker">ทีมงาน</span><h2 class="h2">บุคลากรผู้รับผิดชอบ</h2></div></div>
          <div class="team-grid">
            ${team.map((m, i) => `
              <article class="member reveal" style="transition-delay:${i * 60}ms">
                <div class="member-photo">${photo(m)}</div>
                <div class="member-body">
                  <h4>${nameHTML(m.name)}</h4><div class="pos">${esc(m.position)}</div>
                  <div class="contact-line" style="font-size:.86rem">${m.phone ? `<a href="tel:${esc(m.phone)}">${icon('phone')}${esc(m.phone)}</a>` : ''}${m.email ? `<a href="mailto:${esc(m.email)}">${icon('mail')}${esc(m.email)}</a>` : ''}</div>
                </div>
              </article>`).join('')}
          </div>
        </section>

        <section>
          <div class="section-title reveal"><div><span class="kicker">ช่องทางติดต่อ</span><h2 class="h2">${esc(s.division)}</h2></div></div>
          <div class="channel-grid">
            ${[['phone', 'โทรศัพท์', ch.phone], ['mail', 'อีเมล', ch.email], ['pin', 'สำนักงาน', ch.office], ['clock', 'เวลาทำการ', ch.hours]]
              .filter(x => x[2]).map(([ic, l, v]) => `<div class="channel reveal"><span class="cat-ic">${icon(ic)}</span><div><small>${l}</small><strong>${esc(v)}</strong></div></div>`).join('')}
          </div>
        </section>

        <section class="stats reveal" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:20px">
          <div><span class="kicker gold">พบปัญหาอาคารสถานที่?</span><h2>แจ้งซ่อมออนไลน์ได้ทันที</h2></div>
          <a class="btn btn-light btn-lg" href="#/report">${icon('wrench')} แจ้งซ่อม</a>
        </section>
      </div></div>`,
      mount(root) { UI.reveal(root); }
    };
  }

  // ═══════════ โปรไฟล์และลายเซ็น ═══════════
  function profile() {
    const me = Store.me();
    const s = S();
    const opt = (list, sel) => [...new Set([sel, ...list])].filter(Boolean).map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
    const roles = { teacher: 'ครู', admin: 'แอดมิน', approver: 'ผู้อนุมัติ', executive: 'ผู้บริหาร' };
    const signFor = Object.entries(s.signatories).filter(([, v]) => v.email === me.email).map(([, v]) => v.title);
    return {
      title: 'โปรไฟล์',
      html: `
      ${pageHero({ title: 'โปรไฟล์และลายเซ็น', desc: 'ข้อมูลนี้ใช้กรอกในใบแจ้งซ่อมและแสดงลายเซ็นบนเอกสาร PDF', crumbs: [{ label: 'โปรไฟล์' }] })}
      <div class="page-body"><div class="container">
        <div class="detail-layout">
          <form class="card" id="pf" novalidate>
            <div class="card-head"><h3>${icon('user')}ข้อมูลส่วนตัว</h3><div class="role-tags">${me.roles.map(r => `<span class="badge tone-indigo">${roles[r] || r}</span>`).join('')}</div></div>
            <div class="card-body stack">
              <div class="grid-3">
                <div class="field"><label for="prefix">คำนำหน้า</label><select class="select" id="prefix">${opt(['นาย', 'นาง', 'นางสาว', 'ดร.', 'ว่าที่ร้อยตรี'], me.prefix)}</select></div>
                <div class="field"><label for="first">ชื่อ</label><input class="input" id="first" value="${esc(me.first)}"></div>
                <div class="field"><label for="last">นามสกุล</label><input class="input" id="last" value="${esc(me.last)}"></div>
              </div>
              <div class="grid-2">
                <div class="field"><label for="position">ตำแหน่ง</label><select class="select" id="position">${opt(s.positions, me.position)}</select></div>
                <div class="field"><label for="dept">ฝ่ายงาน / กลุ่มสาระฯ</label><select class="select" id="dept">${opt(s.departments, me.dept)}</select></div>
                <div class="field"><label for="phone">เบอร์ติดต่อ</label><input class="input" id="phone" value="${esc(me.phone || '')}"></div>
                <div class="field"><label>อีเมล</label><input class="input" value="${esc(me.email)}" readonly></div>
              </div>
              <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" type="submit">${icon('check')} บันทึกข้อมูล</button></div>
            </div>
          </form>
          <section class="card">
            <div class="card-head"><h3>${icon('sign')}ลายเซ็นของฉัน</h3></div>
            <div class="card-body stack">
              ${signFor.length ? `<div class="notice">${icon('shield')}<div>คุณเป็นผู้ลงนามในตำแหน่ง <strong>${signFor.map(esc).join(', ')}</strong> ลายเซ็นนี้จะลงในใบแจ้งซ่อมอัตโนมัติเมื่อเริ่มดำเนินการซ่อม</div></div>` : ''}
              <div class="sig-preview" id="sigPrev">${me.signature ? `<img src="${me.signature}" alt="ลายเซ็นปัจจุบัน">` : '<span class="small faint">ยังไม่มีลายเซ็น</span>'}</div>
              <div class="seg" id="sigMode"><button type="button" class="is-active" data-m="draw">${icon('edit')}เซ็นบนจอ</button><button type="button" data-m="upload">${icon('upload')}อัปโหลดรูป</button></div>
              <div id="sigDraw"><div class="sig-box"><canvas id="sigCanvas"></canvas></div><div class="row" style="justify-content:space-between;margin-top:10px"><button type="button" class="btn btn-ghost-dark btn-sm" id="sigClear">ล้าง</button><button type="button" class="btn btn-primary btn-sm" id="sigSave">${icon('check')} ใช้ลายเซ็นนี้</button></div></div>
              <div id="sigUpload" hidden><label class="dropzone"><input type="file" accept="image/*" hidden id="sigFile"><span class="dz-icon">${icon('image')}</span><span class="dz-text"><strong>เลือกรูปลายเซ็น</strong><small>แนะนำ PNG พื้นหลังโปร่งใส หรือเซ็นบนกระดาษขาวแล้วถ่ายรูป</small></span></label></div>
              <p class="small faint">ลายเซ็นจะลงในใบแจ้งซ่อมเมื่อคุณกดปิดงาน (ช่องผู้ตรวจงาน) หรือเมื่อคุณเป็นผู้ลงนามตามตำแหน่ง และในช่องผู้แจ้งซ่อมของแบบฟอร์มเครื่องปรับอากาศ</p>
            </div>
          </section>
        </div>
      </div></div>`,
      mount(root) {
        const pad = UI.signaturePad($('#sigCanvas', root));
        const saveSig = async dataUrl => {
          try { await Store.updateProfile({ signature: dataUrl }); $('#sigPrev', root).innerHTML = `<img src="${dataUrl}" alt="ลายเซ็นปัจจุบัน">`; UI.toast('บันทึกลายเซ็นแล้ว'); }
          catch (e) { UI.toast(e.message, 'error'); }
        };
        $('#sigMode', root).addEventListener('click', e => {
          const b = e.target.closest('[data-m]'); if (!b) return;
          $$('#sigMode button', root).forEach(x => x.classList.toggle('is-active', x === b));
          $('#sigDraw', root).hidden = b.dataset.m !== 'draw';
          $('#sigUpload', root).hidden = b.dataset.m !== 'upload';
        });
        $('#sigClear', root).addEventListener('click', () => pad.clear());
        $('#sigSave', root).addEventListener('click', () => { if (pad.isEmpty()) return UI.toast('กรุณาเซ็นชื่อในกรอบก่อน', 'error'); saveSig(pad.toDataURL()); });
        $('#sigFile', root).addEventListener('change', async e => {
          const f = e.target.files[0]; if (!f) return;
          if (f.size > 400e3) return saveSig(await UI.compressImage(f, 600, .9));
          const reader = new FileReader();
          reader.onload = () => saveSig(reader.result);
          reader.readAsDataURL(f);
        });
        $('#pf', root).addEventListener('submit', async e => {
          e.preventDefault();
          const v = id => $('#' + id, root).value.trim();
          const patch = { prefix: v('prefix'), first: v('first'), last: v('last'), position: v('position'), dept: v('dept'), phone: v('phone') };
          // ข้อมูลต้องครบและถูกต้องเสมอ (ลบจนว่างไม่ได้)
          const bad = Object.entries(Store.profileIssues({ ...Store.me(), ...patch })).filter(([k]) => k !== 'signature');
          if (bad.length) return UI.toast(bad.map(([, m]) => m).join(' · '), 'error');
          await Store.updateProfile(patch);
          UI.toast('บันทึกข้อมูลแล้ว');
        });
      }
    };
  }

  // ═══════════ ตั้งค่าบัญชีครั้งแรก (บังคับกรอกให้ครบก่อนใช้งาน) ═══════════
  function setup(params) {
    const me = Store.me();
    const s = S();
    const next = params.next && params.next.startsWith('/') && !params.next.startsWith('/setup') ? params.next : '/';
    if (Store.profileComplete(me)) { setTimeout(() => App.go(next)); return { title: 'ตั้งค่าบัญชี', html: '' }; }
    const STEPS = [['user', 'ข้อมูลส่วนตัว'], ['sign', 'ลายเซ็น'], ['checkCircle', 'ตรวจทานและยืนยัน']];
    const FIELDS = ['prefix', 'first', 'last', 'position', 'dept', 'phone'];
    const opt = (list, sel, ph) => `<option value="">${ph}</option>` + [...new Set([sel, ...list])].filter(Boolean).map(v => `<option ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return {
      title: 'ตั้งค่าบัญชี',
      html: `
      ${pageHero({ title: 'ตั้งค่าบัญชีก่อนเริ่มใช้งาน', desc: 'กรอกข้อมูลให้ครบ 3 ขั้นตอน ข้อมูลและลายเซ็นนี้ใช้ในใบแจ้งซ่อมและเอกสาร PDF ทำครั้งเดียว แก้ไขภายหลังได้ที่หน้าโปรไฟล์', crumbs: [{ label: 'ตั้งค่าบัญชี' }] })}
      <div class="page-body"><div class="container setup-wrap">
        <ol class="setup-steps" id="stSteps"></ol>
        <div class="card" id="stBody"></div>
        <p class="small faint setup-foot">เข้าสู่ระบบด้วย ${esc(me.email)} · <button type="button" class="link small" data-logout>ไม่ใช่บัญชีของคุณ? ออกจากระบบ</button> · <a class="link small" href="#/contact">ติดต่อเรา</a></p>
      </div></div>`,
      mount(root) {
        const data = { ...me };
        let step = Object.keys(Store.profileIssues(data)).some(k => k !== 'signature') ? 0 : 1;
        let pad = null;
        const errs = () => Store.profileIssues(data);
        const drawSteps = () => {
          $('#stSteps', root).innerHTML = STEPS.map(([ic, label], i) =>
            `<li class="${i < step ? 'done' : i === step ? 'now' : ''}"><span class="st-dot">${i < step ? icon('check') : icon(ic)}</span><span class="st-label"><small>ขั้นที่ ${i + 1}</small>${label}</span></li>`).join('');
        };
        const field = (id, label, control) => `<div class="field" data-f="${id}"><label for="s_${id}">${label} <span class="req">*</span></label>${control}<span class="f-err"></span></div>`;
        const showErrors = keys => {
          const e = errs();
          keys.forEach(k => { const f = $(`[data-f="${k}"]`, root); if (!f) return; f.classList.toggle('invalid', !!e[k]); $('.f-err', f).textContent = e[k] || ''; });
          return keys.filter(k => e[k]);
        };
        const views = [
          () => `
            <div class="card-head"><h3>${icon('user')}ขั้นที่ 1 · ข้อมูลส่วนตัว</h3><span class="small faint st-hint">* จำเป็นต้องกรอกทุกช่อง</span></div>
            <form class="card-body stack" id="stForm" novalidate>
              <div class="grid-3">
                ${field('prefix', 'คำนำหน้า', `<select class="select" id="s_prefix">${opt(['นาย', 'นาง', 'นางสาว', 'ดร.', 'ว่าที่ร้อยตรี'], data.prefix, 'เลือก')}</select>`)}
                ${field('first', 'ชื่อ (ภาษาไทย)', `<input class="input" id="s_first" value="${esc(data.first || '')}" placeholder="เช่น สมชาย" autocomplete="given-name">`)}
                ${field('last', 'นามสกุล (ภาษาไทย)', `<input class="input" id="s_last" value="${esc(data.last || '')}" placeholder="เช่น ใจดี" autocomplete="family-name">`)}
              </div>
              <div class="grid-2">
                ${field('position', 'ตำแหน่ง', `<select class="select" id="s_position">${opt(s.positions, data.position, 'เลือกตำแหน่ง')}</select>`)}
                ${field('dept', 'ฝ่ายงาน / กลุ่มสาระฯ', `<select class="select" id="s_dept">${opt(s.departments, data.dept, 'เลือกฝ่ายงาน / กลุ่มสาระฯ')}</select>`)}
                ${field('phone', 'เบอร์ติดต่อ', `<input class="input" id="s_phone" value="${esc(data.phone || '')}" inputmode="tel" placeholder="เช่น 0812345678" autocomplete="tel">`)}
                <div class="field"><label>อีเมล</label><input class="input" value="${esc(me.email)}" readonly></div>
              </div>
              <div class="setup-actions"><span></span><button class="btn btn-primary" type="submit">ถัดไป: ลายเซ็น ${icon('arrow')}</button></div>
            </form>`,
          () => `
            <div class="card-head"><h3>${icon('sign')}ขั้นที่ 2 · ลายเซ็น</h3><span class="small faint st-hint">ใช้ลงในใบแจ้งซ่อมและเอกสาร PDF</span></div>
            <div class="card-body stack">
              <div class="sig-preview" id="stPrev">${data.signature ? `<img src="${data.signature}" alt="ลายเซ็นของคุณ">` : '<span class="small faint">ยังไม่มีลายเซ็น</span>'}</div>
              <div class="seg" id="stMode"><button type="button" class="is-active" data-m="draw">${icon('edit')}เซ็นบนจอ</button><button type="button" data-m="upload">${icon('upload')}อัปโหลดรูป</button></div>
              <div id="stDraw"><div class="sig-box"><canvas id="stCanvas"></canvas></div><div class="row" style="justify-content:space-between;margin-top:10px"><button type="button" class="btn btn-ghost-dark btn-sm" id="stClear">ล้าง</button><button type="button" class="btn btn-soft btn-sm" id="stUse">${icon('check')} ใช้ลายเซ็นนี้</button></div></div>
              <div id="stUpload" hidden><label class="dropzone"><input type="file" accept="image/*" hidden id="stFile"><span class="dz-icon">${icon('image')}</span><span class="dz-text"><strong>เลือกรูปลายเซ็น</strong><small>แนะนำ PNG พื้นหลังโปร่งใส หรือเซ็นบนกระดาษขาวแล้วถ่ายรูป</small></span></label></div>
              <div class="f-err" id="stSigErr"></div>
              <div class="setup-actions"><button type="button" class="btn btn-ghost-dark" data-go="0">${icon('back')} ย้อนกลับ</button><button type="button" class="btn btn-primary" id="stNext">ถัดไป: ตรวจทาน ${icon('arrow')}</button></div>
            </div>`,
          () => `
            <div class="card-head"><h3>${icon('checkCircle')}ขั้นที่ 3 · ตรวจทานและยืนยัน</h3></div>
            <div class="card-body stack">
              <div class="setup-review">
                <dl>
                  <div><dt>ชื่อ–นามสกุล</dt><dd>${esc(`${data.prefix}${data.first} ${data.last}`)}</dd></div>
                  <div><dt>ตำแหน่ง</dt><dd>${esc(data.position)}</dd></div>
                  <div><dt>ฝ่ายงาน / กลุ่มสาระฯ</dt><dd>${esc(data.dept)}</dd></div>
                  <div><dt>เบอร์ติดต่อ</dt><dd>${esc(data.phone)}</dd></div>
                  <div><dt>อีเมล</dt><dd>${esc(me.email)}</dd></div>
                </dl>
                <div class="setup-sign"><small>ตัวอย่างในใบแจ้งซ่อม</small><img src="${data.signature}" alt="ลายเซ็นของคุณ"><span>(${esc(`${data.prefix}${data.first} ${data.last}`)})</span><span>${esc(data.position)}</span></div>
              </div>
              <div class="setup-actions"><button type="button" class="btn btn-ghost-dark" data-go="0">${icon('edit')} แก้ไขข้อมูล</button><button type="button" class="btn btn-primary btn-lg" id="stDone">${icon('check')} ยืนยัน เริ่มใช้งาน</button></div>
            </div>`
        ];
        const show = n => {
          step = n;
          drawSteps();
          $('#stBody', root).innerHTML = views[step]();
          pad = null;
          if (step === 1) {
            pad = UI.signaturePad($('#stCanvas', root));
            const setSig = async url => {
              data.signature = url;
              $('#stPrev', root).innerHTML = `<img src="${url}" alt="ลายเซ็นของคุณ">`;
              $('#stSigErr', root).textContent = '';
              try { await Store.updateProfile({ signature: url }); UI.toast('บันทึกลายเซ็นแล้ว'); } catch (e) { UI.toast(e.message, 'error'); }
            };
            $('#stMode', root).addEventListener('click', e => {
              const b = e.target.closest('[data-m]'); if (!b) return;
              $$('#stMode button', root).forEach(x => x.classList.toggle('is-active', x === b));
              $('#stDraw', root).hidden = b.dataset.m !== 'draw';
              $('#stUpload', root).hidden = b.dataset.m !== 'upload';
            });
            $('#stClear', root).addEventListener('click', () => pad.clear());
            $('#stUse', root).addEventListener('click', () => { if (pad.isEmpty()) return UI.toast('กรุณาเซ็นชื่อในกรอบก่อน', 'error'); setSig(pad.toDataURL()); });
            $('#stFile', root).addEventListener('change', async e => {
              const f = e.target.files[0]; if (!f) return;
              if (f.size > 400e3) return setSig(await UI.compressImage(f, 600, .9));
              const reader = new FileReader();
              reader.onload = () => setSig(reader.result);
              reader.readAsDataURL(f);
            });
            $('#stNext', root).addEventListener('click', async () => {
              // เซ็นไว้ในกรอบแต่ยังไม่ได้กด "ใช้ลายเซ็นนี้" → ใช้ให้เลย
              if (pad && !pad.isEmpty()) await setSig(pad.toDataURL());
              if (!data.signature) { $('#stSigErr', root).textContent = 'กรุณาเซ็นชื่อ หรืออัปโหลดรูปลายเซ็นก่อน'; return; }
              show(2);
            });
          }
          if (step === 2) {
            $('#stDone', root).addEventListener('click', () => {
              if (!Store.profileComplete(Store.me())) { UI.toast('ข้อมูลยังบันทึกไม่ครบ กรุณาตรวจสอบอีกครั้ง', 'error'); return show(0); }
              UI.toast('ตั้งค่าบัญชีเรียบร้อย พร้อมใช้งานแล้ว');
              App.go(next);
            });
          }
          window.scrollTo({ top: 0, behavior: 'smooth' });
        };
        root.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) show(+b.dataset.go); });
        root.addEventListener('submit', async e => {
          if (e.target.id !== 'stForm') return;
          e.preventDefault();
          FIELDS.forEach(k => { data[k] = $('#s_' + k, root).value.trim(); });
          if (showErrors(FIELDS).length) return UI.toast('กรุณากรอกข้อมูลให้ครบและถูกต้อง', 'error');
          try { await Store.updateProfile(Object.fromEntries(FIELDS.map(k => [k, data[k]]))); } catch (err) { return UI.toast(err.message, 'error'); }
          show(1);
        });
        // แก้ช่องไหน ล้างข้อความเตือนของช่องนั้น
        root.addEventListener('input', e => { const f = e.target.closest('[data-f]'); if (f) { f.classList.remove('invalid'); $('.f-err', f).textContent = ''; } });
        show(step);
      }
    };
  }

  function notFound() {
    return { title: 'ไม่พบหน้า', html: `${pageHero({ title: 'ไม่พบหน้าที่ต้องการ' })}<div class="page-body"><div class="container"><div class="card empty">${icon('alert')}<strong>ไม่พบหน้าหรือข้อมูลนี้</strong><a class="btn btn-primary" href="#/">กลับหน้าแรก</a></div></div></div>` };
  }
  function forbidden(msg) {
    return { title: 'ไม่มีสิทธิ์', html: `${pageHero({ title: 'ไม่มีสิทธิ์เข้าถึง' })}<div class="page-body"><div class="container"><div class="card empty">${icon('shield')}<strong>${esc(msg || 'บัญชีของคุณไม่มีสิทธิ์ใช้งานหน้านี้')}</strong><a class="btn btn-primary" href="#/">กลับหน้าแรก</a></div></div></div>` };
  }

  return { home, login, reportChooser, reportForm, success, myTickets, ticket, board, contact, profile, setup, notFound, forbidden, pageHero, summary, rangeStart, semesterStart, RANGE_LABEL, formTabs };
})();
