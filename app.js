// ══════════════════════════════════════════════════
//  app.js — XREZZKY STORE
//  Semua logic: auth, produk, order, rating, profil
// ══════════════════════════════════════════════════

import {
    auth, db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    updateProfile,
    sendPasswordResetEmail,
    ref, onValue, set, get, push, update
} from "./firebase.js";

// ── STATE ──────────────────────────────────────────
let CU          = null;   // firebase user
let CUD         = null;   // /users/{uid} snapshot
let allProducts = [];
let allSellers  = [];
let selProd     = null;
let ratingTgt   = null;
let currentFilter = 'all';
let toastTimer  = null;
let ordersUnsub = null;
let loaderDone  = false;

// ── UTILS ──────────────────────────────────────────
const $   = id  => document.getElementById(id);
const $el = (sel, ctx = document) => ctx.querySelector(sel);

// ── TOAST ──────────────────────────────────────────
window.showToast = (title, msg, type = 'success') => {
    const colorMap = {
        success: { border: 'border-l-green-500',  bg: 'bg-green-500/20',  text: 'text-green-400',  fa: 'fa-check-circle' },
        error:   { border: 'border-l-red-500',    bg: 'bg-red-500/20',    text: 'text-red-400',    fa: 'fa-times-circle' },
        info:    { border: 'border-l-blue-500',   bg: 'bg-blue-500/20',   text: 'text-blue-400',   fa: 'fa-info-circle' },
        warning: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400', fa: 'fa-exclamation-circle' },
    };
    const c     = colorMap[type] || colorMap.info;
    const toast = $('toast'); if (!toast) return;
    const icon  = $('toastIcon');
    const card  = toast.querySelector('.glass-card');
    $('toastTitle').textContent = title;
    $('toastMsg').textContent   = msg;
    if (card) card.className = card.className.replace(/border-l-\S+/, c.border);
    if (icon) { icon.className = `w-10 h-10 ${c.bg} rounded-full flex items-center justify-center ${c.text}`; icon.innerHTML = `<i class="fas ${c.fa}"></i>`; }
    toast.classList.remove('translate-x-[150%]');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-x-[150%]'), 4500);
};

// ── LOADER ─────────────────────────────────────────
const dismissLoader = () => {
    if (loaderDone) return;
    loaderDone = true;
    const l = $('loader'); if (!l) return;
    l.style.opacity      = '0';
    l.style.pointerEvents = 'none';
    setTimeout(() => l?.remove(), 600);
};

// ── NAVIGATE ───────────────────────────────────────
window.navigate = (page) => {
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    const target = $(`page-${page}`);
    if (target) { target.classList.remove('hidden'); target.classList.add('fade-in'); }
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    const navBtn = $(`nav-${page}`);
    if (navBtn) navBtn.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (page === 'profile') refreshProfilePage();
    if (page === 'orders')  drawOrders();
};

// ── MODAL ──────────────────────────────────────────
window.openModal = (id) => {
    const el = $(id);
    if (el) { el.style.display = 'flex'; document.body.style.overflow = 'hidden'; }
    if (id === 'modalAllStores') renderAllStores();
};
window.closeModal = (id) => {
    const el = $(id);
    if (el) { el.style.display = 'none'; document.body.style.overflow = 'auto'; }
};
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal-overlay').forEach(o =>
        o.addEventListener('click', e => {
            if (e.target === o) { o.style.display = 'none'; document.body.style.overflow = 'auto'; }
        })
    );
});

// ── AUTH FORMS ─────────────────────────────────────
window.toggleAuthForm = () => {
    $('loginForm').classList.toggle('hidden');
    $('regForm').classList.toggle('hidden');
};

window.processLogin = async () => {
    const email = $('authEmail').value.trim(), pass = $('authPass').value;
    if (!email || !pass) return showToast('Error', 'Email & password wajib!', 'error');
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        closeModal('modalAuth');
        showToast('Berhasil!', 'Selamat datang kembali! 👋');
    } catch { showToast('Gagal', 'Email atau password salah!', 'error'); }
};

window.processRegister = async () => {
    const name  = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const pass  = $('regPass').value;
    if (!name)           return showToast('Error', 'Nama tidak boleh kosong!', 'error');
    if (!email)          return showToast('Error', 'Email tidak boleh kosong!', 'error');
    if (pass.length < 6) return showToast('Error', 'Password minimal 6 karakter!', 'error');
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        await set(ref(db, `users/${cred.user.uid}`), { name, email, role: 'buyer', createdAt: Date.now() });
        closeModal('modalAuth');
        showToast('Berhasil! 🎉', 'Akun berhasil dibuat!');
    } catch (e) {
        showToast('Gagal', e.code === 'auth/email-already-in-use' ? 'Email sudah dipakai!' : e.message, 'error');
    }
};

window.processForgotPassword = async () => {
    const email = $('authEmail').value.trim();
    if (!email) return showToast('Info', 'Isi email dulu!', 'info');
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Email Terkirim! 📧', 'Cek inbox untuk reset password');
        closeModal('modalAuth');
    } catch { showToast('Gagal', 'Email tidak ditemukan', 'error'); }
};

window.logoutUser = () => {
    if (!confirm('Yakin mau logout?')) return;
    signOut(auth).then(() => { navigate('home'); showToast('Logout', 'Sampai jumpa lagi! 👋', 'info'); });
};

// ── BANNED SCREEN ──────────────────────────────────
const showBannedScreen = (reason) => {
    document.querySelector('header')?.remove();
    document.querySelector('main')?.remove();
    document.querySelector('nav.fixed')?.remove();
    dismissLoader();
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#05080f;z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Plus Jakarta Sans,sans-serif';
    el.innerHTML = `<div style="max-width:400px;width:100%">
        <div style="width:80px;height:80px;background:rgba(239,68,68,.15);border:2px solid rgba(239,68,68,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><i class="fas fa-ban" style="font-size:2rem;color:#ef4444"></i></div>
        <h1 style="font-family:Syne,sans-serif;font-size:1.75rem;font-weight:800;color:#f1f5f9;margin-bottom:8px">Akun Dibanned</h1>
        <p style="color:#64748b;font-size:.875rem;margin-bottom:20px">Akun kamu telah dibanned oleh admin XREZZKY OFFICIAL STORE.</p>
        <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:16px;padding:20px;margin-bottom:20px;text-align:left">
            <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#ef4444;margin-bottom:8px">⚠️ Alasan Banned</p>
            <p style="font-size:.875rem;color:#fca5a5;line-height:1.6">${reason}</p>
        </div>
        <p style="font-size:11px;color:#475569;margin-bottom:16px">Hubungi: xrezzkystore.idn@gmail.com · 088293064112</p>
        <button id="bannedLogoutBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.875rem">Keluar dari Akun</button>
    </div>`;
    document.body.appendChild(el);
    el.querySelector('#bannedLogoutBtn').onclick = () => signOut(auth).then(() => location.reload());
};

// ── PROFILE ────────────────────────────────────────
const refreshProfilePage = () => {
    const notLogged = $('profileNotLoggedIn');
    const logged    = $('profileLoggedIn');
    if (!CU) { notLogged?.classList.remove('hidden'); logged?.classList.add('hidden'); return; }
    notLogged?.classList.add('hidden'); logged?.classList.remove('hidden');
    const name = CU.displayName || 'User';
    if ($('userNameText'))  $('userNameText').textContent  = name;
    if ($('userEmailText')) $('userEmailText').textContent = CU.email;
    if ($('profileAvatar')) $('profileAvatar').textContent = name.charAt(0).toUpperCase();
    if ($('avatarText'))    $('avatarText').textContent    = name.charAt(0).toUpperCase();
    const m = CU.metadata?.creationTime;
    if (m && $('statsMember')) $('statsMember').textContent = new Date(m).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
};

window.openEditProfile = () => {
    if (!CU) return showToast('Info', 'Silakan login dulu!', 'info');
    $('editName').value = CU.displayName || '';
    openModal('modalEditProfile');
};

window.saveEditProfile = async () => {
    const newName = $('editName').value.trim();
    if (!newName) return showToast('Error', 'Nama tidak boleh kosong!', 'error');
    try {
        await updateProfile(CU, { displayName: newName });
        await update(ref(db, `users/${CU.uid}`), { name: newName });
        refreshProfilePage();
        updateAuthHeader();
        closeModal('modalEditProfile');
        showToast('Berhasil!', 'Profil berhasil diperbarui!');
    } catch (e) { showToast('Gagal', e.message, 'error'); }
};

window.showTransactionHistory = () => navigate('orders');

// ── AUTH HEADER ────────────────────────────────────
const updateAuthHeader = () => {
    const h = $('authHeader'); if (!h) return;
    if (!CU) { h.innerHTML = `<button onclick="openModal('modalAuth')" class="btn-primary !py-2 !px-6 !text-sm">Masuk</button>`; return; }
    const role  = CUD?.role || 'buyer';
    const label = role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Buyer';
    const cls   = role === 'admin' ? 'text-red-400' : role === 'seller' ? 'text-green-400' : 'text-blue-400';
    h.innerHTML = `<div class="flex items-center gap-3 cursor-pointer" onclick="navigate('profile')">
        <div class="text-right hidden sm:block leading-none">
            <p class="text-xs font-bold">${CU.displayName || 'User'}</p>
            <p class="text-[9px] ${cls} font-black uppercase">${label}</p>
        </div>
        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold border-2 border-white/10 text-sm">${(CU.displayName||'U').charAt(0).toUpperCase()}</div>
    </div>`;
};

// ── SITE CONFIG REALTIME ───────────────────────────
onValue(ref(db, 'admin/config/site'), snap => {
    const cfg = snap.val() || {};
    const t1 = $('heroTitle1'), t2 = $('heroTitle2'), tg = $('heroTagline'), bs = $('heroBadges'), hs = $('heroStats');
    if (t1) t1.textContent = cfg.heroTitle1 || 'XREZZKY';
    if (t2) t2.textContent = cfg.heroTitle2 || 'OFFICIAL STORE';
    if (tg) tg.textContent = cfg.tagline    || '';
    const bColors = ['text-blue-300 bg-blue-500/15 border-blue-500/30','text-green-300 bg-green-500/15 border-green-500/30','text-yellow-300 bg-yellow-500/15 border-yellow-500/30'];
    const bIcons  = ['fa-shield-alt','fa-check-circle','fa-star'];
    if (bs) { const badges = cfg.trustBadges||[]; bs.innerHTML = badges.map((b,i) => `<span class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${bColors[i%3]} border px-3 py-1.5 rounded-full"><i class="fas ${bIcons[i%3]} text-xs"></i> ${b}</span>`).join(''); }
    if (hs) { const stats = [{n:cfg.stat1n,l:cfg.stat1l,c:'text-blue-400'},{n:cfg.stat2n,l:cfg.stat2l,c:'text-green-400'},{n:cfg.stat3n,l:cfg.stat3l,c:'text-yellow-400'}]; hs.innerHTML = stats.filter(s=>s.n).map(s => `<div class="bg-white/5 border border-white/10 backdrop-blur px-5 py-4 rounded-2xl text-center min-w-[100px]"><p class="text-2xl font-extrabold ${s.c} font-syne">${s.n}</p><p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${s.l||''}</p></div>`).join(''); }
    // Ticker
    const tw = $('promoTickerWrap'), ti = $('promoTickerInner');
    const tItems = cfg.tickerItems || [];
    if (ti && tItems.length > 0) { ti.innerHTML = [...tItems,...tItems].map(t => `<span class="text-sm font-semibold text-gray-200">${t}</span>`).join(''); tw?.classList.remove('hidden'); }
    else if (tw) tw.classList.add('hidden');
    // Features
    const fe = $('featuresGrid'), features = cfg.features || [];
    if (fe && features.length > 0) fe.innerHTML = features.map(f => `<div class="glass-card p-4 flex items-center gap-3"><div class="w-10 h-10 bg-${f.color||'blue'}-500/20 rounded-xl flex items-center justify-center shrink-0"><i class="fas ${f.icon||'fa-star'} text-${f.color||'blue'}-400"></i></div><div><p class="text-xs font-extrabold">${f.title||''}</p><p class="text-[10px] text-gray-500">${f.desc||''}</p></div></div>`).join('');
    // Categories
    const catFilter = $('categoryFilter'), cats = cfg.categories || [];
    if (catFilter && cats.length > 0) {
        catFilter.querySelectorAll('.category-btn:not([data-cat="all"])').forEach(b => b.remove());
        cats.forEach(c => {
            const d = document.createElement('div');
            d.className    = 'flex-none px-6 py-3 glass-card text-sm font-bold hover:border-blue-500 cursor-pointer category-btn';
            d.dataset.cat  = c;
            d.textContent  = c;
            catFilter.appendChild(d);
        });
    }
});

// ── PRODUCTS REALTIME ──────────────────────────────
onValue(ref(db, 'products'), snap => {
    allProducts = [];
    const data = snap.val() || {};
    Object.keys(data).forEach(k => { if (!data[k].hidden) allProducts.push({ id: k, ...data[k] }); });
    applyFilters();
    // Deep link
    const pid = new URLSearchParams(location.search).get('id');
    if (pid) { const t = allProducts.find(p => p.id === pid); if (t) showDetail(t); }
    dismissLoader();
}, () => { renderProducts([]); dismissLoader(); });

// ── SELLERS REALTIME ───────────────────────────────
onValue(ref(db, 'seller_applications'), snap => {
    allSellers = [];
    const data = snap.val() || {};
    Object.keys(data).forEach(k => { if (data[k].status === 'approved') allSellers.push({ uid: k, ...data[k] }); });
    renderStoreChips();
    if ($('modalAllStores')?.style.display === 'flex') renderAllStores();
});

// ── AUTH STATE ─────────────────────────────────────
onAuthStateChanged(auth, user => {
    if (!user) {
        CU = null; CUD = null;
        updateAuthHeader();
        refreshProfilePage();
        dismissLoader();
        const hcta = $('homeSellerCta'); if (hcta) hcta.classList.remove('hidden');
        return;
    }
    CU = user;
    onValue(ref(db, `users/${user.uid}`), async snap => {
        CUD = snap.exists() ? snap.val() : { role: 'buyer' };

        // BANNED CHECK
        if (CUD?.banned === true) { showBannedScreen(CUD.bannedReason || 'Tidak ada keterangan.'); return; }

        updateAuthHeader();
        refreshProfilePage();

        const role      = CUD?.role || 'buyer';
        const isAdmin   = role === 'admin';
        const isSeller  = role === 'seller';
        const isPending = CUD?.sellerStatus === 'pending';

        // Role badge
        const badgeStyle = isAdmin  ? 'bg-red-500/20 text-red-400 border-red-500/40'
                         : isSeller ? 'bg-green-500/20 text-green-400 border-green-500/40'
                         :            'bg-blue-500/20 text-blue-400 border-blue-500/40';
        const roleLabel  = isAdmin  ? 'Admin Tier' : isSeller ? 'Seller Tier' : 'Buyer Tier';
        const rc = $('roleBadgeContainer');
        if (rc) rc.innerHTML = `<span class="${badgeStyle} border px-4 py-1 rounded-full text-[10px] font-black uppercase">${roleLabel}</span>`;

        const sCtaCard    = $('sellerCtaCard');
        const hcta        = $('homeSellerCta');
        const sellerBanner = $('sellerBanner');

        if (isAdmin) {
            const sa = await get(ref(db, `seller_applications/${user.uid}`));
            const hasStore   = sa.exists() && sa.val().status === 'approved';
            const pendingApp = sa.exists() && sa.val().status === 'pending';
            const storeName  = sa.exists() ? sa.val().storeName : null;

            if (sellerBanner) {
                sellerBanner.className = 'space-y-3 mb-6';
                let html = `<div class="w-full bg-gradient-to-r from-blue-700 to-indigo-900 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition shadow-xl border border-white/10" onclick="window.location.href='admin-panel.html'">
                    <div class="flex items-center gap-4"><div class="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center"><i class="fas fa-user-shield text-white text-lg"></i></div><div><p class="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Owner Access</p><h3 class="text-sm font-black text-white">DASHBOARD ADMIN</h3></div></div>
                    <i class="fas fa-chevron-right text-white/50"></i></div>`;
                if (hasStore) {
                    html += `<div class="w-full bg-gradient-to-r from-green-800/60 to-blue-800/40 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition border border-green-500/30" onclick="window.location.href='seller-dashboard.html'">
                        <div class="flex items-center gap-4"><div class="w-11 h-11 bg-green-500/30 rounded-xl flex items-center justify-center"><i class="fas fa-store text-green-300 text-lg"></i></div><div><p class="text-[9px] font-black uppercase text-green-300">✅ Toko Aktif</p><h3 class="text-sm font-black text-white">${storeName||'Toko Admin'}</h3></div></div>
                        <span class="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Kelola →</span></div>`;
                    if (hcta) hcta.classList.add('hidden');
                } else if (pendingApp) {
                    html += `<div class="bg-yellow-900/30 p-4 rounded-[20px] flex items-center gap-4 border border-yellow-500/30"><div class="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0"><i class="fas fa-clock text-yellow-300 animate-pulse"></i></div><div><p class="text-[9px] font-black uppercase text-yellow-300">⏳ Toko Pending</p><p class="text-sm font-bold text-white">Menunggu persetujuan admin</p></div></div>`;
                    if (hcta) hcta.classList.add('hidden');
                } else {
                    html += `<div class="bg-purple-900/40 p-4 rounded-[20px] flex items-center justify-between cursor-pointer hover:opacity-90 transition border border-purple-500/30" onclick="openModal('modalBecomeSeller')">
                        <div class="flex items-center gap-3"><div class="w-10 h-10 bg-purple-500/30 rounded-xl flex items-center justify-center"><i class="fas fa-store text-purple-300"></i></div><div><p class="text-[9px] font-black uppercase text-purple-300">🎉 Buka Toko</p><p class="text-sm font-black text-white">Admin juga bisa punya toko!</p><p class="text-xs text-gray-400">Daftar → tetap jadi admin + punya seller dashboard</p></div></div>
                        <span class="bg-purple-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">Daftar →</span></div>`;
                    if (hcta) hcta.classList.remove('hidden');
                }
                sellerBanner.innerHTML = html;
            }
            if (sCtaCard) sCtaCard.classList.add('hidden');

        } else if (isSeller) {
            if (sellerBanner) {
                sellerBanner.className = 'mb-6';
                sellerBanner.innerHTML = `<div class="bg-gradient-to-r from-green-800/60 to-blue-800/40 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition border border-green-500/30" onclick="window.location.href='seller-dashboard.html'">
                    <div class="flex items-center gap-4"><div class="w-11 h-11 bg-green-500/30 rounded-xl flex items-center justify-center"><i class="fas fa-store text-green-300 text-lg"></i></div><div><p class="text-[9px] font-black uppercase text-green-300">✅ Seller Aktif</p><h3 class="text-sm font-black text-white">${CUD?.storeName||'Toko Kamu'}</h3></div></div>
                    <span class="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Dashboard →</span></div>`;
            }
            if (sCtaCard) sCtaCard.classList.add('hidden');
            if (hcta) hcta.classList.add('hidden');

        } else if (isPending) {
            if (sellerBanner) {
                sellerBanner.className = 'mb-6';
                sellerBanner.innerHTML = `<div class="bg-yellow-900/30 p-5 rounded-[24px] flex items-center gap-4 border border-yellow-500/30"><div class="w-11 h-11 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0"><i class="fas fa-clock text-yellow-300 text-lg animate-pulse"></i></div><div class="flex-1"><p class="text-[9px] font-black uppercase text-yellow-300">⏳ Pending Verifikasi</p><p class="font-bold text-white text-sm">Aplikasi Seller Dikirim</p><p class="text-gray-400 text-xs">Admin sedang verifikasi. 1×24 jam.</p></div><div class="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shrink-0"></div></div>`;
            }
            if (sCtaCard) sCtaCard.classList.add('hidden');
            if (hcta) hcta.classList.add('hidden');

        } else {
            if (sellerBanner) { sellerBanner.innerHTML = ''; sellerBanner.className = ''; }
            if (sCtaCard) sCtaCard.classList.remove('hidden');
            if (hcta) hcta.classList.remove('hidden');
        }

        // Stats: total transaksi
        get(ref(db, `orders/${user.uid}`)).then(snap => {
            const count = snap.exists() ? Object.keys(snap.val()).length : 0;
            if ($('statsTrx')) $('statsTrx').textContent = count;
        });
    });
});

// ── CATEGORY FILTER ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('categoryFilter')?.addEventListener('click', e => {
        const btn = e.target.closest('.category-btn'); if (!btn) return;
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active-cat','border-blue-500','bg-blue-500/10'));
        btn.classList.add('active-cat','border-blue-500','bg-blue-500/10');
        currentFilter = btn.dataset.cat; applyFilters();
    });
    document.getElementById('globalSearch')?.addEventListener('input', e => applyFilters(e.target.value.toLowerCase()));
});

const applyFilters = (q = '') => {
    const search = q || document.getElementById('globalSearch')?.value.toLowerCase() || '';
    let f = allProducts;
    if (currentFilter !== 'all') f = f.filter(p => p.category === currentFilter);
    if (search) f = f.filter(p => (p.name||'').toLowerCase().includes(search) || (p.category||'').toLowerCase().includes(search) || (p.storeName||'').toLowerCase().includes(search));
    renderProducts(f);
};

// ── RENDER PRODUCTS ────────────────────────────────
const renderProducts = list => {
    const grid = $('mainProductGrid'); if (!grid) return;
    grid.innerHTML = '';
    if (!list?.length) { grid.innerHTML = `<div class="col-span-full text-center py-20 text-gray-500"><i class="fas fa-search text-4xl mb-4 opacity-30"></i><p class="font-bold">Produk tidak ditemukan</p></div>`; return; }
    list.forEach(p => {
        const low = Number(p.stock)>0 && Number(p.stock)<5, out = Number(p.stock)<=0;
        const card = document.createElement('div');
        card.className = 'glass-card product-card p-3'; card.onclick = () => showDetail(p);
        card.innerHTML = `<div class="product-img-container mb-3"><img src="${p.images?.[0]||'https://placehold.co/400x400/0f172a/3b82f6?text=No+Img'}" class="product-img" loading="lazy" onerror="this.src='https://placehold.co/400x400/0f172a/3b82f6?text=No+Img'">
            ${out?'<span class="badge-new !bg-gray-600">Habis</span>':''}${low?'<span class="badge-limit">Stok Limit</span>':''}</div>
            <p class="text-[10px] text-blue-400 font-bold uppercase tracking-tighter mb-1">${p.category||'General'}</p>
            <h3 class="text-sm font-bold line-clamp-1 mb-2">${p.name||'Produk'}</h3>
            <div class="flex justify-between items-center">
                <p class="text-sm font-extrabold text-white">Rp ${Number(p.price||0).toLocaleString('id-ID')}</p>
                ${p.rating ? `<span class="text-yellow-400 text-xs font-bold">★ ${p.rating}</span>` : `<div class="text-[10px] text-gray-500"><i class="fas fa-box mr-1"></i>${p.stock??'-'}</div>`}
            </div>`;
        grid.appendChild(card);
    });
};

// ── PRODUCT DETAIL ─────────────────────────────────
const makeStarsHtml = (r, cnt) => {
    if (!r) return '<span class="text-gray-500 text-xs italic">Belum ada rating</span>';
    const rv = parseFloat(r); let s = '';
    for (let i=1;i<=5;i++) s += `<span style="color:${i<=Math.round(rv)?'#f59e0b':'#374151'}">★</span>`;
    return `<span class="text-base">${s}</span><span class="text-xs text-gray-400 ml-1">${rv} (${cnt||0} ulasan)</span>`;
};

const loadProductReviews = async pid => {
    const el = $('detReviews'); if (!el) return;
    try {
        const snap = await get(ref(db, `products/${pid}/reviews`));
        if (!snap.exists()) { el.innerHTML = `<p class="text-xs text-gray-500 italic">Belum ada ulasan.</p>`; return; }
        const revs = Object.values(snap.val()).sort((a,b) => b.createdAt - a.createdAt).slice(0, 5);
        let h = `<h4 class="font-bold border-l-4 border-blue-500 pl-3 text-sm mb-3">Ulasan Pembeli</h4>`;
        revs.forEach(r => {
            let s = ''; for(let i=1;i<=5;i++) s += `<span style="color:${i<=r.stars?'#f59e0b':'#374151'}" class="text-xs">★</span>`;
            const dt = new Date(r.createdAt).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
            h += `<div class="bg-white/5 rounded-xl p-3 mb-2"><div class="flex items-center justify-between mb-1"><p class="text-xs font-bold">${r.userName||'User'}</p><div class="flex items-center gap-1">${s}<span class="text-[9px] text-gray-500 ml-1">${dt}</span></div></div>${r.comment?`<p class="text-xs text-gray-400 leading-relaxed">${r.comment}</p>`:''}</div>`;
        });
        el.innerHTML = h;
    } catch { el.innerHTML = ''; }
};

window.showDetail = p => {
    selProd = p;
    $('detImg').src             = p.images?.[0]||'https://placehold.co/400x400/0f172a/3b82f6?text=No+Img';
    $('detTitle').textContent   = p.name||'-';
    $('detPrice').textContent   = `Rp ${Number(p.price||0).toLocaleString('id-ID')}`;
    $('detDesc').textContent    = p.description||'Tidak ada deskripsi.';
    $('detCat').textContent     = p.category||'Digital Asset';
    $('detStock').textContent   = p.stock??'-';
    if ($('detRatingDisplay')) $('detRatingDisplay').innerHTML = makeStarsHtml(p.rating, p.ratingCount);

    const seller = allSellers.find(s => s.uid === p.sellerId);
    const sName  = seller?.ownerName || p.sellerName || 'XREZZKY Official';
    const stName = seller?.storeName  || p.storeName  || '';
    if ($('detSellerName'))   $('detSellerName').textContent   = sName;
    if ($('detStoreName'))    $('detStoreName').textContent    = stName ? `🏪 ${stName}` : '';
    if ($('detSellerAvatar')) $('detSellerAvatar').textContent = (stName||sName).charAt(0).toUpperCase();

    const stock  = Number(p.stock||0);
    const maxBuy = p.maxBuy ? Math.min(Number(p.maxBuy), stock) : stock;
    const qtyEl  = $('buyQty');
    if (qtyEl) { qtyEl.value = stock>0?1:0; qtyEl.max = maxBuy; }
    if ($('detMaxBuy'))  $('detMaxBuy').textContent  = maxBuy>0?maxBuy:'Habis';
    if ($('totalPrice')) $('totalPrice').textContent = `Rp ${Number(p.price||0).toLocaleString('id-ID')}`;
    const qs = $('qtySection'); if (qs) qs.style.opacity = stock<=0?'0.5':'1';

    if ($('detReviews')) $('detReviews').innerHTML = `<p class="text-xs text-gray-500">Memuat ulasan...</p>`;
    loadProductReviews(p.id);
    openModal('modalDetail');
};

window.changeQty = delta => {
    if (!selProd) return;
    const stock  = Number(selProd.stock||0);
    const maxBuy = selProd.maxBuy ? Math.min(Number(selProd.maxBuy), stock) : stock;
    const el = $('buyQty'); let v = parseInt(el.value) + delta;
    v = Math.max(1, Math.min(v, maxBuy)); el.value = v;
    if ($('totalPrice')) $('totalPrice').textContent = `Rp ${(Number(selProd.price||0)*v).toLocaleString('id-ID')}`;
};

window.clampQty = () => {
    if (!selProd) return;
    const stock  = Number(selProd.stock||0);
    const maxBuy = selProd.maxBuy ? Math.min(Number(selProd.maxBuy), stock) : stock;
    const el = $('buyQty'); let v = parseInt(el.value)||1;
    v = Math.max(1, Math.min(v, maxBuy)); el.value = v;
    if ($('totalPrice')) $('totalPrice').textContent = `Rp ${(Number(selProd.price||0)*v).toLocaleString('id-ID')}`;
};

window.openStoreFromDetail = () => {
    if (!selProd) return;
    closeModal('modalDetail');
    openStorePageById(selProd.sellerId);
};

// ── BUY NOW ────────────────────────────────────────
window.handleBuyNow = async () => {
    if (!CU) { closeModal('modalDetail'); openModal('modalAuth'); showToast('Info','Login dulu untuk bertransaksi','info'); return; }
    if (!selProd) return;
    const stock = Number(selProd.stock||0);
    if (stock <= 0) return showToast('Stok Habis','Produk ini tidak tersedia saat ini','error');
    const qty    = parseInt($('buyQty')?.value||1);
    const maxBuy = selProd.maxBuy ? Math.min(Number(selProd.maxBuy), stock) : stock;
    if (qty < 1)      return showToast('Error','Jumlah minimal 1!','error');
    if (qty > maxBuy) return showToast('Error',`Maksimal beli ${maxBuy} unit!`,'error');
    const total  = Number(selProd.price||0) * qty;
    const seller = allSellers.find(s => s.uid === selProd.sellerId);
    const waNum  = (seller?.whatsapp||'6281234567890').replace(/\D/g,'');
    const buyerWa = CUD?.waNumber||'-';

    const btn = $('btnBuy'); if (btn) { btn.disabled=true; btn.textContent='Memproses...'; }
    try {
        const oRef = await push(ref(db, `orders/${CU.uid}`), {
            productId:   selProd.id,
            productName: selProd.name,
            productDesc: selProd.description||'-',
            category:    selProd.category||'-',
            qty, unitPrice: Number(selProd.price||0), totalPrice: total,
            storeName:   seller?.storeName||'XREZZKY Store',
            sellerId:    selProd.sellerId||'',
            buyerName:   CU.displayName, buyerEmail: CU.email, buyerWa,
            status:      'confirm', rated: false, createdAt: Date.now()
        });
        await update(ref(db, `products/${selProd.id}`), { stock: Math.max(0, stock-qty) });
        selProd.stock = Math.max(0, stock-qty);
        if ($('detStock')) $('detStock').textContent = selProd.stock;

        const orderId = oRef.key.slice(-8).toUpperCase();
        const now = new Date().toLocaleString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});
        const msg = encodeURIComponent(
            `🔔 *PESANAN BARU!*\n\n━━━━━━━━━━━━━━━\n🏪 Toko: *${seller?.storeName||'XREZZKY'}*\n📋 ID: *${orderId}*\n🕐 Waktu: ${now}\n━━━━━━━━━━━━━━━\n📦 Produk: *${selProd.name}*\n📝 Deskripsi: ${selProd.description||'-'}\n🏷️ Kategori: ${selProd.category||'-'}\n🔢 Jumlah: ${qty} unit\n💰 Harga: Rp ${Number(selProd.price||0).toLocaleString('id-ID')} / unit\n💳 Total: *Rp ${total.toLocaleString('id-ID')}*\n🆔 ID Produk: ${selProd.id}\n━━━━━━━━━━━━━━━\n👤 Pembeli: *${CU.displayName}*\n📱 WA: ${buyerWa}\n📧 Email: ${CU.email}\n━━━━━━━━━━━━━━━\n✅ Konfirmasi di Seller Dashboard.`
        );
        window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank');
        closeModal('modalDetail');
        showToast('Pesanan Dibuat! 🎉', `${qty}x ${selProd.name} — tunggu konfirmasi seller`);
    } catch (e) { showToast('Gagal', e.message, 'error'); }
    finally { if (btn) { btn.disabled=false; btn.innerHTML='<i class="fas fa-shopping-cart"></i> Beli Sekarang'; } }
};

// ── ORDERS REALTIME ────────────────────────────────
const drawOrders = () => {
    const el = $('ordersList'); if (!el) return;
    if (!CU) {
        el.innerHTML = `<div class="glass-card p-12 text-center text-gray-500"><i class="fas fa-lock text-4xl mb-4 opacity-30"></i><p class="font-bold">Login dulu</p><button onclick="openModal('modalAuth')" class="btn-primary !inline-block mt-4">Login</button></div>`;
        return;
    }
    if (ordersUnsub) { ordersUnsub(); ordersUnsub = null; }
    el.innerHTML = `<div class="text-center py-8"><div class="spinner w-8 h-8 mx-auto mb-2"></div><p class="text-sm text-gray-500">Memuat...</p></div>`;
    const stMap = {
        confirm:    {l:'Menunggu Konfirmasi Seller',c:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',icon:'fa-clock'},
        pending:    {l:'Pending Pembayaran',c:'text-purple-400 bg-purple-500/10 border-purple-500/30',icon:'fa-credit-card'},
        processing: {l:'Sedang Diproses',c:'text-blue-400 bg-blue-500/10 border-blue-500/30',icon:'fa-spinner'},
        completed:  {l:'Selesai ✅',c:'text-green-400 bg-green-500/10 border-green-500/30',icon:'fa-check-circle'},
        cancelled:  {l:'Ditolak',c:'text-red-400 bg-red-500/10 border-red-500/30',icon:'fa-times-circle'},
    };
    ordersUnsub = onValue(ref(db, `orders/${CU.uid}`), snap => {
        el.innerHTML = '';
        if (!snap.exists()) {
            el.innerHTML = `<div class="glass-card p-12 text-center text-gray-500"><i class="fas fa-shopping-bag text-4xl mb-4 opacity-30"></i><p class="font-bold">Belum ada pesanan</p><button onclick="navigate('home')" class="btn-primary !inline-block mt-4">Mulai Belanja</button></div>`;
            return;
        }
        const orders = snap.val();
        Object.keys(orders).sort((a,b) => (orders[b].createdAt||0)-(orders[a].createdAt||0)).forEach(oid => {
            const o = orders[oid]; const st = stMap[o.status]||stMap.confirm;
            const dt = o.createdAt ? new Date(o.createdAt).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
            const shortId = oid.slice(-8).toUpperCase();
            const div = document.createElement('div');
            div.className = 'trx-item';
            div.innerHTML = `<div class="flex items-start justify-between mb-3 gap-2">
                <div class="flex-1 min-w-0">
                    <p class="font-extrabold font-syne text-sm line-clamp-1">${o.productName||'-'}</p>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        <p class="text-[10px] text-gray-500">${dt}</p>
                        <button onclick="copyText('${shortId}')" class="text-[10px] text-blue-400 font-bold flex items-center gap-1"><i class="fas fa-copy text-[9px]"></i> ${shortId}</button>
                    </div>
                </div>
                <span class="text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${st.c} flex items-center gap-1"><i class="fas ${st.icon} text-[9px]"></i> ${st.l}</span>
            </div>
            ${o.status==='cancelled'&&o.cancelReason?`<div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3"><p class="text-[10px] text-red-400 font-bold uppercase mb-1">Alasan Ditolak</p><p class="text-xs text-gray-300">${o.cancelReason}</p></div>`:''}
            ${o.adminNote?`<div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3"><p class="text-[10px] text-blue-400 font-bold uppercase mb-1">Catatan Admin</p><p class="text-xs text-gray-300">${o.adminNote}</p></div>`:''}
            <div class="bg-white/5 rounded-xl p-3 mb-3 space-y-1.5">
                <div class="flex justify-between text-xs"><span class="text-gray-500">Produk</span><span class="font-semibold line-clamp-1 text-right">${o.productName||'-'} ${o.qty>1?`(${o.qty}x)`:''}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-500">Toko</span><span class="font-semibold">${o.storeName||'-'}</span></div>
                <div class="flex justify-between text-xs"><span class="text-gray-500">Total</span><span class="font-bold text-blue-400">Rp ${Number(o.totalPrice||0).toLocaleString('id-ID')}</span></div>
            </div>
            <div class="flex items-center justify-between">
                <button onclick="copyOrderDetail('${oid}')" class="text-xs text-gray-500 hover:text-white transition flex items-center gap-1"><i class="fas fa-copy text-[9px]"></i> Salin Detail</button>
                ${o.status==='completed'&&!o.rated
                    ? `<button onclick="openRatingModal('${oid}','${o.productId}','${(o.productName||'').replace(/'/g,"\\'")}');" class="btn-primary !py-1.5 !px-3 !text-xs !rounded-xl flex items-center gap-1 !w-auto !inline-flex"><i class="fas fa-star text-xs"></i> Beri Rating</button>`
                    : o.status==='completed'&&o.rated
                        ? `<span class="text-yellow-400 text-xs font-bold flex items-center gap-1"><i class="fas fa-star text-xs"></i> Sudah Dirating</span>`
                        : o.status==='confirm'
                            ? `<span class="text-[10px] text-yellow-400 italic">Menunggu seller...</span>`
                            : ''}
            </div>`;
            el.appendChild(div);
        });
    }, () => { el.innerHTML = `<div class="glass-card p-10 text-center text-gray-500"><p class="font-bold">Gagal memuat pesanan</p></div>`; });
};

window.copyText = text => {
    navigator.clipboard?.writeText(text).then(() => showToast('Disalin!', `${text} berhasil disalin`, 'success'));
};

window.copyOrderDetail = oid => {
    get(ref(db, `orders/${CU?.uid}/${oid}`)).then(snap => {
        if (!snap.exists()) return;
        const o = snap.val();
        const dt = o.createdAt ? new Date(o.createdAt).toLocaleString('id-ID',{weekday:'long',day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '-';
        const t = `=== DETAIL PESANAN ===\nID: ${oid.slice(-8).toUpperCase()}\nWaktu: ${dt}\nProduk: ${o.productName||'-'} ${o.qty>1?`(${o.qty}x)`:''}\nToko: ${o.storeName||'-'}\nTotal: Rp ${Number(o.totalPrice||0).toLocaleString('id-ID')}\nStatus: ${o.status||'-'}\nID Produk: ${o.productId||'-'}\n=====================`;
        navigator.clipboard?.writeText(t).then(() => showToast('Disalin!', 'Detail pesanan berhasil disalin', 'success'));
    });
};

// ── RATING ─────────────────────────────────────────
window.openRatingModal = (orderId, productId, productName) => {
    ratingTgt = { orderId, productId, productName };
    if ($('ratingProdName')) $('ratingProdName').textContent = productName;
    document.querySelectorAll('#starInputGroup input').forEach(i => i.checked = false);
    if ($('ratingComment')) $('ratingComment').value = '';
    openModal('modalRating');
};

window.submitRating = async () => {
    if (!ratingTgt || !CU) return;
    const star = [...$('starInputGroup').querySelectorAll('input')].find(i => i.checked);
    if (!star) return showToast('Error', 'Pilih bintang dulu!', 'error');
    const stars = parseInt(star.value), comment = $('ratingComment').value.trim();
    try {
        await set(ref(db, `products/${ratingTgt.productId}/reviews/${CU.uid}`), {
            userId: CU.uid, userName: CU.displayName||'User', stars, comment, createdAt: Date.now()
        });
        const sr = await get(ref(db, `products/${ratingTgt.productId}/reviews`));
        if (sr.exists()) {
            const vals = Object.values(sr.val()).map(r => r.stars);
            await update(ref(db, `products/${ratingTgt.productId}`), {
                rating:      (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1),
                ratingCount: vals.length
            });
        }
        await update(ref(db, `orders/${CU.uid}/${ratingTgt.orderId}`), { rated: true });
        closeModal('modalRating');
        showToast('Terima kasih! ⭐', 'Rating berhasil dikirim!');
    } catch (e) { showToast('Gagal', e.message, 'error'); }
};

// ── STORE FUNCTIONS ────────────────────────────────
const openStorePageById = sid => {
    if (!sid) { showToast('Info', 'Info toko tidak tersedia', 'info'); return; }
    const seller = allSellers.find(s => s.uid === sid);
    if (!seller) { showToast('Info', 'Toko tidak ditemukan atau belum diverifikasi', 'info'); return; }
    renderStorePage(seller); openModal('modalStorePage');
};

const renderStorePage = seller => {
    const prods = allProducts.filter(p => p.sellerId === seller.uid);
    let totStk=0, totSold=0, allR=[], totRc=0;
    prods.forEach(p => {
        totStk  += Number(p.stock||0);
        totSold += Number(p.sold||0);
        if (p.rating && p.ratingCount) { for(let i=0;i<p.ratingCount;i++) allR.push(parseFloat(p.rating)); totRc += p.ratingCount; }
    });
    const avg = allR.length > 0 ? (allR.reduce((a,b) => a+b, 0)/allR.length).toFixed(1) : null;
    if ($('spAvatar'))     $('spAvatar').textContent     = (seller.storeName||'S').charAt(0).toUpperCase();
    if ($('spStoreName'))  $('spStoreName').textContent  = seller.storeName||'-';
    if ($('spOwnerName'))  $('spOwnerName').textContent  = `oleh ${seller.ownerName||'-'}`;
    if ($('spCity'))       $('spCity').textContent       = seller.city ? `📍 ${seller.city}` : '';
    if ($('spDesc'))       $('spDesc').textContent       = seller.storeDesc||'Tidak ada deskripsi.';
    if ($('spTotalItem'))  $('spTotalItem').textContent  = prods.length;
    if ($('spTotalStock')) $('spTotalStock').textContent = totStk;
    if ($('spTotalSold'))  $('spTotalSold').textContent  = totSold;
    const rEl = $('spOverallRating');
    if (rEl) {
        if (avg) {
            let s = ''; for(let i=1;i<=5;i++) s += `<span style="color:${i<=Math.round(parseFloat(avg))?'#f59e0b':'#374151'}">★</span>`;
            rEl.innerHTML = `<span class="text-base">${s}</span><span class="text-xs text-gray-400 ml-1">${avg} dari ${totRc} ulasan</span>`;
        } else { rEl.innerHTML = `<span class="text-xs text-gray-500 italic">Belum ada ulasan</span>`; }
    }
    const list = $('spProductList'); if (!list) return; list.innerHTML = '';
    if (!prods.length) { list.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">Belum ada produk</div>`; return; }
    prods.forEach(p => {
        const low = Number(p.stock)>0&&Number(p.stock)<5, out = Number(p.stock)<=0;
        const item = document.createElement('div');
        item.className = 'bg-white/5 border border-white/5 rounded-xl p-2 cursor-pointer hover:border-blue-500/50 transition';
        item.onclick = () => { closeModal('modalStorePage'); showDetail(p); };
        item.innerHTML = `<div class="relative overflow-hidden rounded-lg mb-1.5" style="aspect-ratio:1/1"><img src="${p.images?.[0]||'https://placehold.co/300x300/0f172a/3b82f6?text=P'}" class="w-full h-full object-cover" onerror="this.src='https://placehold.co/300x300/0f172a/3b82f6?text=P'">${out?'<span class="absolute top-1 right-1 text-[9px] font-black bg-gray-600 text-white px-1.5 py-0.5 rounded-full">Habis</span>':''} ${low?'<span class="absolute top-1 right-1 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Limit</span>':''}</div><p class="text-[10px] text-blue-400 font-bold uppercase mb-0.5">${p.category||'-'}</p><p class="text-[11px] font-bold line-clamp-1 mb-1">${p.name}</p><div class="flex justify-between items-center"><p class="text-[11px] font-extrabold">Rp ${Number(p.price||0).toLocaleString('id-ID')}</p>${p.rating?`<span style="color:#f59e0b" class="text-[10px] font-bold">★ ${p.rating}</span>`:''}</div>`;
        list.appendChild(item);
    });
};

const renderStoreChips = () => {
    const el = $('storeChips'); if (!el) return; el.innerHTML = '';
    if (!allSellers.length) { el.innerHTML = `<p class="text-gray-500 text-sm py-2 px-1">Belum ada toko aktif</p>`; return; }
    allSellers.forEach(s => {
        const chip = document.createElement('div');
        chip.className = 'shrink-0 glass-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-blue-500 transition min-w-[160px] rounded-2xl';
        chip.onclick = () => { renderStorePage(s); openModal('modalStorePage'); };
        chip.innerHTML = `<div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-sm shrink-0">${(s.storeName||'S').charAt(0).toUpperCase()}</div><div class="min-w-0"><p class="text-xs font-bold line-clamp-1">${s.storeName||'-'}</p><p class="text-[10px] text-gray-500">${s.category||'Digital'}</p></div>`;
        el.appendChild(chip);
    });
};

const renderAllStores = (q = '') => {
    const grid = $('allStoreGrid'); if (!grid) return;
    const list = q ? allSellers.filter(s => (s.storeName||'').toLowerCase().includes(q)||(s.category||'').toLowerCase().includes(q)) : allSellers;
    grid.innerHTML = '';
    if (!list.length) { grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500"><i class="fas fa-store text-3xl mb-2 opacity-30"></i><p class="font-bold">Toko tidak ditemukan</p></div>`; return; }
    list.forEach(s => {
        const prods = allProducts.filter(p => p.sellerId === s.uid);
        let allR=[], totRc=0, totStk=0;
        prods.forEach(p => { totStk+=Number(p.stock||0); if(p.rating&&p.ratingCount){for(let i=0;i<p.ratingCount;i++)allR.push(parseFloat(p.rating));totRc+=p.ratingCount;} });
        const avg = allR.length>0 ? (allR.reduce((a,b)=>a+b,0)/allR.length).toFixed(1) : null;
        const card = document.createElement('div');
        card.className = 'glass-card p-5 cursor-pointer hover:border-blue-500/40 transition rounded-2xl';
        card.onclick = () => { renderStorePage(s); openModal('modalStorePage'); };
        card.innerHTML = `<div class="flex items-center gap-3 mb-3"><div class="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xl font-bold shrink-0">${(s.storeName||'S').charAt(0).toUpperCase()}</div><div class="flex-1 min-w-0"><p class="font-extrabold font-syne line-clamp-1 text-sm">${s.storeName||'-'}</p><p class="text-[10px] text-blue-400 font-bold uppercase">${s.category||'General'}</p></div><span class="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">✅ Verified</span></div>
            <p class="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">${s.storeDesc||'-'}</p>
            ${avg?`<div class="flex items-center gap-1 mb-3"><span style="color:#f59e0b">★</span><span class="text-xs font-bold">${avg}</span><span class="text-[9px] text-gray-500">(${totRc} ulasan)</span></div>`:''}
            <div class="grid grid-cols-3 gap-2 text-center"><div class="bg-white/5 rounded-xl py-1.5"><p class="text-xs font-bold">${prods.length}</p><p class="text-[9px] text-gray-500">Produk</p></div><div class="bg-white/5 rounded-xl py-1.5"><p class="text-xs font-bold text-green-400">${totStk}</p><p class="text-[9px] text-gray-500">Stok</p></div><div class="bg-white/5 rounded-xl py-1.5 flex items-center justify-center"><span class="text-xs font-bold text-blue-400">Lihat →</span></div></div>`;
        grid.appendChild(card);
    });
};
window.filterStores = q => renderAllStores(q.toLowerCase());

// ── EXPAND IMG ──────────────────────────────────────
window.expandImg = src => {
    $('imgExpanded').src = src;
    const v = $('fullImageView'); v.classList.remove('hidden'); v.classList.add('flex');
    document.body.style.overflow = 'hidden';
};
window.closeFullScreen = () => {
    const v = $('fullImageView'); v.classList.add('hidden'); v.classList.remove('flex');
    document.body.style.overflow = 'auto';
};
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFullScreen(); });

// ── COPY LINK ───────────────────────────────────────
window.copyLink = () => {
    if (!selProd) return;
    const url = `${location.origin}${location.pathname}?id=${selProd.id}`;
    navigator.clipboard?.writeText(url).then(() => showToast('Link Disalin! 🔗', 'Tautan produk berhasil disalin'));
};

// ── SELLER APPLICATION ──────────────────────────────
window.goToSellerForm = () => {
    if (!CU) { closeModal('modalBecomeSeller'); openModal('modalAuth'); showToast('Info','Login dulu untuk daftar jadi seller!','info'); return; }
    get(ref(db, `seller_applications/${CU.uid}`)).then(snap => {
        if (snap.exists()) {
            const d = snap.val();
            if (d.status === 'approved') { closeModal('modalBecomeSeller'); showToast('Info','Kamu sudah jadi seller aktif! 🎉','info'); return; }
            if (d.status === 'pending')  { closeModal('modalBecomeSeller'); showToast('Info','Pendaftaran kamu sedang diproses admin. Sabar ya! ⏳','warning'); return; }
        }
        const oi = $('sf_ownerName'); if (oi && CU.displayName) oi.value = CU.displayName;
        $('sellerStep1').classList.add('hidden'); $('sellerStep2').classList.remove('hidden');
    });
};
window.backToSellerInfo = () => { $('sellerStep2').classList.add('hidden'); $('sellerStep1').classList.remove('hidden'); };

window.submitSellerApplication = async () => {
    if (!CU) return;
    const storeName   = $('sf_storeName').value.trim();
    const storeDesc   = $('sf_storeDesc').value.trim();
    const category    = $('sf_category').value;
    const ownerName   = $('sf_ownerName').value.trim();
    const whatsapp    = $('sf_whatsapp').value.trim();
    const city        = $('sf_city').value.trim();
    const experience  = $('sf_experience')?.value||'';
    const firstProd   = $('sf_firstProduct')?.value.trim()||'-';
    const notes       = $('sf_notes')?.value.trim()||'-';
    const agreed      = $('sf_agree').checked;
    if (!storeName)                       return showToast('Error','Nama toko wajib diisi!','error');
    if (!storeDesc)                       return showToast('Error','Deskripsi toko wajib diisi!','error');
    if (!category)                        return showToast('Error','Pilih kategori produk!','error');
    if (!ownerName)                       return showToast('Error','Nama lengkap wajib diisi!','error');
    if (!whatsapp || whatsapp.length < 9) return showToast('Error','Nomor WA tidak valid!','error');
    if (!city)                            return showToast('Error','Kota/domisili wajib diisi!','error');
    if (!agreed)                          return showToast('Error','Setujui kebijakan seller terlebih dahulu!','error');
    const btn = $('btnSubmitSeller'); btn.disabled=true; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Mengirim...';
    try {
        await set(ref(db, `seller_applications/${CU.uid}`), {
            storeName, storeDesc, category, ownerName,
            whatsapp: `+62${whatsapp}`, city, experience,
            firstProduct: firstProd, notes,
            uid: CU.uid, email: CU.email,
            status: 'pending', submittedAt: Date.now(), reviewedAt: null, rejectedReason: null
        });
        await set(ref(db, `users/${CU.uid}/sellerStatus`), 'pending');
        $('sellerStep2').classList.add('hidden'); $('sellerStep3').classList.remove('hidden');
        refreshProfilePage();
        showToast('Terkirim! 🎉', 'Pendaftaran seller berhasil dikirim!');
    } catch (e) {
        showToast('Gagal', 'Gagal mengirim pendaftaran. Coba lagi!', 'error');
        btn.disabled=false; btn.innerHTML='<i class="fas fa-paper-plane"></i> Kirim Pendaftaran';
    }
};

// ── AVATAR UPLOAD (preview only) ───────────────────
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('avatarUpload')?.addEventListener('change', e => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const a = $('profileAvatar');
            if (a) a.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
        showToast('Info','Avatar berubah sementara (upload storage tidak aktif)','info');
    });
});
