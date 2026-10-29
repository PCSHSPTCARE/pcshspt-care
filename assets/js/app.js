/* ตัวจัดเส้นทางหน้า (hash router) และโครงหน้า: เว็บไซต์ / หลังบ้าน / เอกสาร */
const App = (() => {
  const routes = [];
  const bus = new Map();
  let cleanups = [];
  let currentPath = null;

  function route(pattern, handler, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
    routes.push({ re, keys, handler, opts });
  }
  const go = path => { location.hash = '#' + path; };
  const onCleanup = fn => cleanups.push(fn);
  // ตัวกระจายเหตุการณ์ภายในหน้า
  const on = (name, fn) => { if (!bus.has(name)) bus.set(name, new Set()); bus.get(name).add(fn); return () => bus.get(name).delete(fn); };
  const emit = (name, data) => bus.get(name)?.forEach(fn => fn(data));
  const adminHome = u => Store.hasRole(u, 'admin') ? '/admin' : Store.isStaff(u) ? '/admin/jobs' : '/admin/stats';

  // ───────── แถบเมนูเว็บไซต์ ─────────
  // แถบเหตุฉุกเฉินสีแดง บนสุดของทุกหน้าฝั่งผู้ใช้ (ทุกคนเห็น ไม่ต้องเข้าสู่ระบบ) · มือถือกดเบอร์แล้วโทรได้
  function emergencyHTML() {
    const e = Store.banners().emergency || {};
    if (!e.enabled || !String(e.text || '').trim()) return '';
    const tel = String(e.phone || '').replace(/[^\d+]/g, '');
    return `<div class="emergency-bar" role="note">
      <div class="container eb-inner"><span class="eb-dot" aria-hidden="true"></span><span class="eb-text">${esc(e.text)}</span>
        ${e.phone ? (tel.length >= 3 ? `<a class="eb-call" href="tel:${tel}">${icon('phone')} ${esc(e.phone)}</a>` : `<span class="eb-call">${icon('phone')} ${esc(e.phone)}</span>`) : ''}</div></div>`;
  }

  function navHTML(path, onHero) {
    const s = Store.settings();
    const me = Store.me();
    const forms = Store.FORM_KEYS.filter(k => s.forms[k].enabled);
    const active = p => path.startsWith(p) ? 'is-active' : '';
    return `
      <header class="nav ${onHero ? 'on-hero' : ''}" id="nav">
        <div class="container nav-inner">
          <a href="#/" class="brand" aria-label="หน้าแรก">
            <img src="images/logo.png" alt="ตรา${esc(s.schoolName)}" width="200" height="302">
            <span class="brand-text"><span class="brand-title">งานอาคารและสถานที่</span><span class="brand-sub"><span class="bs-long">Princess Chulabhorn Science High School Pathum Thani</span><span class="bs-short">PCSHS Pathum Thani</span></span></span>
          </a>
          <ul class="menu" id="menu">
            <li><a class="menu-link ${path === '/' ? 'is-active' : ''}" href="#/">หน้าแรก</a></li>
            <li class="dropdown" data-open="false">
              <button class="menu-link ${active('/report')}" data-dd aria-expanded="false" aria-haspopup="true">แจ้งซ่อม ${icon('chev', 'chev')}</button>
              <ul class="dropdown-panel">
                ${forms.map(k => `<li><a href="#/report/${k}"><span class="di-icon">${icon(UI.FORM_ICON[k])}</span><span><strong>${esc(s.forms[k].name)}</strong><small>${esc(s.forms[k].desc)}</small></span></a></li>`).join('')}
              </ul>
            </li>
            <li class="dropdown" data-open="false">
              <button class="menu-link ${active('/my') || active('/board') || active('/ticket')}" data-dd aria-expanded="false" aria-haspopup="true">ติดตามสถานะ ${icon('chev', 'chev')}</button>
              <ul class="dropdown-panel">
                <li><a href="#/my"><span class="di-icon">${icon('track')}</span><span><strong>งานที่ฉันแจ้ง</strong><small>ดูความคืบหน้าและพิมพ์ใบแจ้งซ่อม</small></span></a></li>
                <li><a href="#/board"><span class="di-icon">${icon('activity')}</span><span><strong>แดชบอร์ดเรียลไทม์</strong><small>ภาพรวมงานซ่อมทั้งโรงเรียน ดูย้อนหลังได้</small></span></a></li>
              </ul>
            </li>
            <li><a class="menu-link ${active('/contact')}" href="#/contact">ติดต่อเรา</a></li>
            ${Store.isBackOffice(me) ? `<li><a class="menu-link" href="#${adminHome(me)}">${icon('shield')} ระบบหลังบ้าน</a></li>` : ''}
            <li class="mobile-only">${me
              ? `<button class="menu-link" data-logout>${icon('logout')} ออกจากระบบ (${esc(me.first)})</button>`
              : `<a class="menu-link" href="#/login">${icon('user')} เข้าสู่ระบบ</a>`}</li>
          </ul>
          <div class="nav-actions" id="navActions">${navActionsHTML()}</div>
          <button class="icon-btn nav-toggle" data-menu-toggle aria-label="เปิดเมนู" aria-expanded="false" aria-controls="menu">${icon('menu')}</button>
        </div>
      </header>`;
  }

  function bellHTML(right = true) {
    const list = Store.notifications();
    const unread = list.filter(n => !n.read).length;
    // ตัวเลขบนกระดิ่ง = แจ้งเตือนใหม่ตั้งแต่เปิดดูกระดิ่งครั้งล่าสุด (เปิดดูแล้วตัวเลขหาย รายการที่ยังไม่ได้กดยังเน้นสีไว้)
    const fresh = Store.unseenCount();
    return `
      <div class="dropdown" data-bell data-open="false" style="position:relative">
        <button class="icon-btn" data-dd aria-label="การแจ้งเตือน ${fresh} รายการใหม่" aria-expanded="false">${icon('bell')}${fresh ? `<span class="bell-count">${fresh > 9 ? '9+' : fresh}</span>` : ''}</button>
        <div class="dropdown-panel notif-panel ${right ? 'right' : ''}">
          <div class="notif-head"><strong>การแจ้งเตือน</strong>${unread ? '<button class="link small" data-readall>อ่านทั้งหมด</button>' : ''}</div>
          ${list.slice(0, 15).map(n => `
            <div class="notif ${n.read ? '' : 'unread'} ${n.kind === 'reopen' ? 'is-reopen' : ''} ${n.kind === 'rate' ? 'is-rate' : ''}" ${n.kind === 'rate' ? `data-rate="${esc(n.rateKey)}"` : ''} data-notif="${n.id}" data-ticket="${esc(n.ticketId || '')}" role="button" tabindex="0">
              <div><div class="n-title">${esc(n.title)}</div><div class="n-body">${esc(n.body)}</div><div class="n-time">${UI.ago(n.at)}</div></div>
            </div>`).join('') || '<div class="empty" style="padding:30px">ยังไม่มีการแจ้งเตือน</div>'}
        </div>
      </div>`;
  }

  // วาดกระดิ่งใหม่ทันที (ระหว่างกล่องเปิดอยู่ การอัปเดตอัตโนมัติจะข้ามไป) · keepOpen = เปิดกล่องค้างไว้เหมือนเดิม
  function refreshBell(keepOpen) {
    if ($('#navActions')) $('#navActions').innerHTML = navActionsHTML();
    if ($('#admBell')) $('#admBell').innerHTML = bellHTML();
    if (keepOpen) $$('[data-bell]').forEach(b => { if (b.offsetParent) { b.dataset.open = 'true'; b.querySelector('[data-dd]').setAttribute('aria-expanded', 'true'); } });
  }

  function navActionsHTML() {
    const me = Store.me();
    if (!me) return `<a class="btn btn-primary btn-sm" href="#/login">${icon('user')} เข้าสู่ระบบ</a>`;
    return `
      ${bellHTML()}
      <div class="dropdown" data-open="false" style="position:relative">
        <button class="user-btn" data-dd aria-expanded="false" aria-label="เมนูผู้ใช้">${UI.avatar(Store.fullName(me), '', Store.isBackOffice(me) ? 'navy' : '')}<span class="u-name">${esc(me.first)}</span>${icon('chev')}</button>
        <div class="dropdown-panel right" style="min-width:260px">
          <div style="padding:10px 12px 12px;border-bottom:1px solid var(--line-2);margin-bottom:6px"><strong>${esc(Store.fullName(me))}</strong><small>${esc(me.email)}</small></div>
          <a href="#/profile"><span class="di-icon">${icon('sign')}</span><span><strong>โปรไฟล์และลายเซ็น</strong></span></a>
          <a href="#/my"><span class="di-icon">${icon('track')}</span><span><strong>งานที่ฉันแจ้ง</strong></span></a>
          ${Store.isBackOffice(me) ? `<a href="#${adminHome(me)}"><span class="di-icon">${icon('shield')}</span><span><strong>ระบบหลังบ้าน</strong></span></a>` : ''}
          <div class="dd-sep"></div>
          <button class="dd-item" data-logout><span class="di-icon">${icon('logout')}</span><span><strong>ออกจากระบบ</strong></span></button>
        </div>
      </div>`;
  }

  function footerHTML() {
    const s = Store.settings();
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-top">
            <div class="footer-brand"><img src="images/logo.png" alt="" width="200" height="302">
              <div><strong>${esc(s.unit)}</strong><span>${esc(s.division)}<br><span class="fb-school">${esc(s.schoolName)}</span></span></div></div>
            <ul class="footer-links"><li><a href="#/report">แจ้งซ่อม</a></li><li><a href="#/my">ติดตามสถานะ</a></li><li><a href="#/board">แดชบอร์ด</a></li><li><a href="#/contact">ติดต่อเรา</a></li></ul>
          </div>
        </div>
      </footer>`;
  }

  // ───────── แถบด้านข้างหลังบ้าน ─────────
  function sideHTML(path) {
    const me = Store.me();
    const admin = Store.hasRole(me, 'admin');
    const staff = Store.isStaff(me);
    const roleName = admin ? ['ADMIN', 'แอดมิน'] : staff ? ['APPROVER', 'ผู้อนุมัติ'] : ['EXECUTIVE', 'ผู้บริหาร'];
    const pending = Store.visibleTickets(me).filter(t => t.status === 'pending').length;
    const link = (href, ic, label, count = 0) => {
      const base = href.split('?')[0];
      const hasForm = /[?&]form=\w/.test(location.hash);
      const activeNow = href.includes('?') ? location.hash === '#' + href
        : base === '/admin' ? path === '/admin'
        : base === '/admin/jobs' ? (path.startsWith('/admin/job') && !(path === '/admin/jobs' && hasForm && !Store.hasRole(me, 'admin')))
        : path.startsWith(base);
      return `<a class="side-link ${activeNow ? 'is-active' : ''}" href="#${href}">${icon(ic)}${label}${count ? `<span class="cnt">${count}</span>` : ''}</a>`;
    };
    return `
      <div class="side-brand"><img src="images/logo.png" alt=""><div><strong>ระบบแจ้งซ่อม<br>อาคารและสถานที่</strong><small>${roleName[0]}</small></div></div>
      <nav class="side-nav" aria-label="เมนูหลังบ้าน">
        ${admin ? link('/admin', 'dashboard', 'ภาพรวม') : ''}
        ${staff ? link('/admin/jobs', 'list', 'งานแจ้งซ่อม', pending) : ''}
        ${Store.can(me, 'stats') ? link('/admin/stats', 'chart', 'สถิติและรายงาน') : ''}
        ${admin || Store.hasRole(me, 'executive') ? link('/admin/satisfaction', 'sparkle', 'ผลประเมินความพึงพอใจ') : ''}
        ${link('/board', 'activity', 'แดชบอร์ดเรียลไทม์')}
        ${!staff ? '' : admin ? `<div class="side-label">ตั้งค่า</div>
          ${link('/admin/categories', 'layers', 'หมวดงานซ่อม')}
          ${link('/admin/locations', 'building', 'อาคารและสถานที่')}
          ${link('/admin/users', 'users', 'ผู้ใช้และสิทธิ์')}
          ${link('/admin/staff', 'user', 'บุคลากร (ติดต่อเรา)')}
          ${link('/admin/settings', 'sliders', 'ตั้งค่าระบบ')}` : `<div class="side-label">หมวดที่ดูแล</div>
          ${Store.formsOf(me).map(f => link(`/admin/jobs?form=${f}`, UI.FORM_ICON[f], Views.formName(f))).join('')}`}
        <div class="side-label">ทางลัด</div>
        <a class="side-link" href="#/">${icon('home')}หน้าเว็บไซต์</a>
        ${Store.hasRole(me, 'teacher') ? link('/report', 'wrench', 'แจ้งซ่อม') : ''}
        ${link('/profile', 'sign', 'โปรไฟล์และลายเซ็น')}
      </nav>
      <div class="side-user">${UI.avatar(Store.fullName(me), '', 'navy')}<div style="min-width:0"><strong>${esc(Store.fullName(me))}</strong><small>${roleName[1]} · ${esc(me.position)}</small></div>
        <button class="icon-btn sm" data-logout aria-label="ออกจากระบบ">${icon('logout')}</button></div>`;
  }

  // ───────── วาดหน้า ─────────
  const Layout = {
    public(view, path) {
      $('#app').innerHTML = `${emergencyHTML()}${navHTML(path, view.heroNav)}<main id="view" class="page-enter">${view.html}</main>${footerHTML()}`;
    },
    admin(view, path) {
      $('#app').innerHTML = `
        <div class="admin" id="adm">
          <aside class="side" id="side">${sideHTML(path)}</aside>
          <div class="admin-main">
            <header class="topbar">
              <button class="icon-btn side-toggle" data-side-toggle aria-label="เมนู">${icon('menu')}</button>
              <div class="tb-title" style="min-width:0"><h1>${esc(view.title)}</h1>${view.subtitle ? `<div class="sub">${esc(view.subtitle)}</div>` : ''}</div>
              <span class="spacer"></span>
              <div class="row" style="gap:8px">${view.actions || ''}</div>
              <span id="admBell">${bellHTML()}</span>
            </header>
            <main class="admin-content page-enter" id="view">${view.html}</main>
          </div>
        </div>`;
    },
    bare(view) { $('#app').innerHTML = `<div id="view">${view.html}</div>`; }
  };

  function render() {
    cleanups.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    cleanups = [];
    const full = location.hash.slice(1) || '/';
    const [path, qs] = full.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    const me = Store.me();
    let view, layout = 'public';
    const r = routes.find(x => x.re.test(path));
    if (!r) view = Pages.notFound();
    else {
      const m = path.match(r.re);
      const params = { ...query };
      r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
      const o = r.opts;
      if ((o.auth || o.staff || o.roles || o.teacher) && !me) return go('/login?next=' + encodeURIComponent(full));
      if (o.guestOnly && me) return go(Store.isBackOffice(me) ? adminHome(me) : '/');
      // ข้อมูลโปรไฟล์ยังไม่ครบ (รวมลายเซ็น) → ต้องตั้งค่าบัญชีให้ครบก่อน · ดูหน้าติดต่อเราได้
      if (me && !Store.profileComplete(me) && !['/setup', '/contact'].includes(path)) return go('/setup?next=' + encodeURIComponent(full));
      if (path === '/admin' && me && !Store.hasRole(me, 'admin') && Store.isBackOffice(me)) return go(adminHome(me));
      if (o.teacher && !Store.hasRole(me, 'teacher')) view = Pages.forbidden('การแจ้งซ่อมเปิดให้เฉพาะครูและบุคลากรเท่านั้น');
      else if (o.staff && !Store.isStaff(me)) view = Pages.forbidden('หน้านี้สำหรับแอดมินและผู้อนุมัติเท่านั้น');
      else if (o.roles && !o.roles.some(x => Store.hasRole(me, x))) { view = Pages.forbidden(); layout = Store.isBackOffice(me) ? 'admin' : 'public'; }
      else { view = r.handler(params); layout = o.layout || 'public'; }
    }
    Layout[layout](view, path);
    document.title = `${view.title} | ระบบแจ้งซ่อมอาคารและสถานที่ PCSHS ปทุมธานี`;
    if (path !== currentPath) window.scrollTo(0, 0);
    currentPath = path;
    try { view.mount?.($('#view')); } catch (e) { console.error(e); UI.toast('เกิดข้อผิดพลาดในการแสดงผลหน้า', 'error'); }
    onScroll();
    maybePromptRating();
  }

  // เตือนประเมินความพึงพอใจ: เด้งครั้งเดียวต่อการเข้าเว็บ (ไม่บังคับ) · ไม่เด้งทับหน้าต่างอื่นหรือหน้าเอกสาร
  let ratePrompted = false, rateTimer = null;
  function maybePromptRating() {
    clearTimeout(rateTimer);
    rateTimer = setTimeout(() => {
      const me = Store.me();
      if (ratePrompted || !me || !Store.profileComplete(me) || $('.modal-backdrop')) return;
      const path = (location.hash.slice(1) || '/').split('?')[0];
      if (['/setup', '/login', '/print', '/print-report'].includes(path) || path.startsWith('/doc/')) return;
      const key = `pcshs-rate-prompted:${me.email}`;
      try { if (sessionStorage.getItem(key)) { ratePrompted = true; return; } } catch (e) { /* ignore */ }
      const groups = Store.ratingGroups();
      if (!groups.length) return;
      ratePrompted = true;
      try { sessionStorage.setItem(key, '1'); } catch (e) { /* ignore */ }
      Pages.promptRatings(groups);
    }, 900);
  }

  // อัปเดตกระดิ่งและตัวนับเมื่อข้อมูลเปลี่ยน (โดยไม่วาดหน้าใหม่ทั้งหมด)
  // ถ้าสถานะการเข้าสู่ระบบหรือบทบาทเปลี่ยน (เช่น หมดอายุ หรือแอดมินเปลี่ยนสิทธิ์) วาดหน้าใหม่ทั้งหน้า
  let lastWho = null;
  Store.subscribe(() => {
    if (!$('#view')) return; // ยังอยู่หน้ากำลังโหลดระบบ
    const u = Store.me();
    const who = u ? `${u.email}|${(u.roles || []).join()}|${(u.forms || []).join()}` : '';
    if (lastWho !== null && who !== lastWho) { lastWho = who; render(); return; }
    lastWho = who;
    const path = (location.hash.slice(1) || '/').split('?')[0];
    if ($('#navActions') && !$('#navActions .dropdown[data-open="true"]')) $('#navActions').innerHTML = navActionsHTML();
    if ($('#admBell') && !$('#admBell .dropdown[data-open="true"]')) $('#admBell').innerHTML = bellHTML();
    if ($('#side') && Store.me()) $('#side').innerHTML = sideHTML(path);
    if (!ratePrompted) maybePromptRating();
    maybeRepairSignatures();
  });

  // แอดมินเปิดเว็บ: เติมลายเซ็นผู้ลงนามที่ขาดในใบเดิม (เช่น ผู้อนุมัติอัปโหลดลายเซ็นทีหลัง) · เขียนเฉพาะเมื่อมีใบที่ต้องแก้
  let repairTimer = null;
  function maybeRepairSignatures() {
    clearTimeout(repairTimer);
    repairTimer = setTimeout(() => {
      if (!Store.hasRole(Store.me(), 'admin')) return;
      try { const n = Store.repairSignatures(); if (n) console.info(`เติมลายเซ็นผู้ลงนามในใบเดิม ${n} ใบ`); } catch (e) { console.error(e); }
    }, 2500);
  }

  // ───────── เหตุการณ์ร่วม ─────────
  const onScroll = () => $('#nav')?.classList.toggle('is-scrolled', window.scrollY > 8);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('hashchange', render);

  document.addEventListener('click', e => {
    const dd = e.target.closest('[data-dd]');
    const openOnes = $$('.dropdown[data-open="true"]');
    if (dd) {
      const box = dd.closest('.dropdown');
      const open = box.dataset.open !== 'true';
      openOnes.forEach(d => { if (d !== box && !d.contains(box)) d.dataset.open = 'false'; });
      box.dataset.open = open;
      dd.setAttribute('aria-expanded', open);
      // เปิดกระดิ่ง = ดูแล้ว → ตัวเลขหายทันที
      if (open && box.matches('[data-bell]')) { Store.markSeen(); dd.querySelector('.bell-count')?.remove(); }
      return;
    }
    if (e.target.closest('[data-menu-toggle]')) {
      const nav = $('#nav'); const open = nav.dataset.menuOpen !== 'true';
      nav.dataset.menuOpen = open;
      return;
    }
    if (e.target.closest('[data-side-toggle]')) { const a = $('#adm'); a.dataset.sideOpen = a.dataset.sideOpen !== 'true'; return; }
    if ($('#adm')?.dataset.sideOpen === 'true' && !e.target.closest('.side')) $('#adm').dataset.sideOpen = 'false';
    if (e.target.closest('[data-logout]')) { ratePrompted = false; Store.logout(); UI.toast('ออกจากระบบแล้ว', 'info'); go('/'); render(); return; }
    if (e.target.closest('[data-readall]')) { Store.markRead(); refreshBell(true); return; }
    const n = e.target.closest('[data-notif]');
    if (n?.dataset.rate) { openOnes.forEach(d => { d.dataset.open = 'false'; }); Pages.openRating(n.dataset.rate); return; }
    if (n) {
      Store.markRead(n.dataset.notif);
      openOnes.forEach(d => { d.dataset.open = 'false'; });
      refreshBell(false);
      const me = Store.me(), t = n.dataset.ticket && Store.ticket(n.dataset.ticket);
      if (t) go(Store.isStaff(me) && Store.canSee(me, t) && t.reporter.email !== me.email ? `/admin/job/${t.id}` : `/ticket/${t.id}`);
      return;
    }
    if (!e.target.closest('.dropdown-panel') || e.target.closest('.dropdown-panel a, .dropdown-panel .dd-item')) openOnes.forEach(d => { d.dataset.open = 'false'; });
    if (e.target.closest('.menu a')) { const nav = $('#nav'); if (nav) nav.dataset.menuOpen = 'false'; }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') $$('.dropdown[data-open="true"]').forEach(d => { d.dataset.open = 'false'; });
    if (e.key === 'Enter' && e.target.matches('[data-notif]')) e.target.click();
  });

  return { route, go, render, onCleanup, on, emit };
})();

// ───────── เส้นทางทั้งหมด ─────────
App.route('/', Pages.home);
App.route('/login', Pages.login, { guestOnly: true });
App.route('/report', Pages.reportChooser, { teacher: true });
App.route('/report/:type', Pages.reportForm, { teacher: true });
App.route('/edit/:id', Pages.reportForm, { teacher: true });
App.route('/success/:id', Pages.success, { auth: true });
App.route('/my', Pages.myTickets, { auth: true });
App.route('/ticket/:id', Pages.ticket, { auth: true });
App.route('/board', Pages.board, { auth: true });
App.route('/contact', Pages.contact);
App.route('/profile', Pages.profile, { auth: true });
App.route('/setup', Pages.setup, { auth: true });
App.route('/doc/:id', Doc.page, { auth: true, layout: 'bare' });
App.route('/print', Print.batch, { auth: true, layout: 'bare' });
App.route('/print-report', Print.report, { roles: ['admin', 'executive'], layout: 'bare' });
App.route('/admin', Admin.overview, { roles: ['admin'], layout: 'admin' });
App.route('/admin/jobs', Admin.jobs, { staff: true, layout: 'admin' });
App.route('/admin/job/:id', Admin.job, { staff: true, layout: 'admin' });
App.route('/admin/stats', Admin.stats, { roles: ['admin', 'executive'], layout: 'admin' });
App.route('/admin/satisfaction', Admin.satisfaction, { roles: ['admin', 'executive'], layout: 'admin' });
App.route('/admin/categories', Admin.categories, { roles: ['admin'], layout: 'admin' });
App.route('/admin/locations', Admin.locations, { roles: ['admin'], layout: 'admin' });
App.route('/admin/users', Admin.users, { roles: ['admin'], layout: 'admin' });
App.route('/admin/staff', Admin.staff, { roles: ['admin'], layout: 'admin' });
App.route('/admin/settings', Admin.settings, { roles: ['admin'], layout: 'admin' });

const demoAs = new URLSearchParams(location.search).get('as');
if (demoAs !== null) Store.demoLogin(demoAs);
// ระบบจริง: รอโหลดค่าตั้งระบบและสถานะการเข้าสู่ระบบก่อนวาดหน้าแรก
Store.ready().then(App.render, e => { console.error(e); App.render(); });
