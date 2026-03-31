// ============================================
// XREZZKY STORE - Main Application File
// Firebase Integration with Authentication
// ============================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
    getDatabase, ref, onValue, set, get, push, update, remove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

// ========== FIREBASE CONFIG ==========
const firebaseConfig = {
    apiKey: "AIzaSyBouXC_NmAuNydTk3gKL83A1BiyqZQYyXY",
    authDomain: "marketplace-48c4d.firebaseapp.com",
    databaseURL: "https://marketplace-48c4d-default-rtdb.firebaseio.com",
    projectId: "marketplace-48c4d",
    storageBucket: "marketplace-48c4d.firebasestorage.app",
    messagingSenderId: "565598495756",
    appId: "1:565598495756:web:0a80f3dd4a56a7f57efa29"
};

// ========== INITIALIZE FIREBASE ==========
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let currentUserData = null;
let allProducts = [];
let allSellers = [];
let selectedProduct = null;
let ratingTarget = null;
let currentFilter = 'all';
let toastTimer = null;
let ordersUnsubscribe = null;
let loaderDone = false;
let productsUnsubscribe = null;
let sellersUnsubscribe = null;
let configUnsubscribe = null;

// ========== DOM ELEMENTS ==========
const $ = (id) => document.getElementById(id);

// ========== TOAST NOTIFICATION ==========
window.showToast = (title, msg, type = 'success') => {
    const toast = $('toast');
    if (!toast) return;
    
    const colorMap = {
        success: { border: 'border-l-green-500', bg: 'bg-green-500/20', text: 'text-green-400', fa: 'fa-check-circle' },
        error: { border: 'border-l-red-500', bg: 'bg-red-500/20', text: 'text-red-400', fa: 'fa-times-circle' },
        info: { border: 'border-l-blue-500', bg: 'bg-blue-500/20', text: 'text-blue-400', fa: 'fa-info-circle' },
        warning: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/20', text: 'text-yellow-400', fa: 'fa-exclamation-circle' }
    };
    
    const c = colorMap[type] || colorMap.info;
    const icon = $('toastIcon');
    const card = toast.querySelector('.glass-card');
    
    $('toastTitle').textContent = title;
    $('toastMsg').textContent = msg;
    
    if (card) card.className = card.className.replace(/border-l-\S+/, c.border);
    if (icon) {
        icon.className = `w-10 h-10 ${c.bg} rounded-full flex items-center justify-center ${c.text}`;
        icon.innerHTML = `<i class="fas ${c.fa}"></i>`;
    }
    
    toast.classList.remove('translate-x-[150%]');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-x-[150%]'), 4500);
};

// ========== DISMISS LOADER ==========
const dismissLoader = () => {
    if (loaderDone) return;
    loaderDone = true;
    const loader = $('loader');
    if (!loader) return;
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => loader?.remove(), 600);
};

// ========== BANNED SCREEN ==========
const showBannedScreen = (reason) => {
    document.querySelector('header')?.remove();
    document.querySelector('main')?.remove();
    document.querySelector('nav.fixed')?.remove();
    dismissLoader();
    
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;background:#05080f;z-index:9998;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font-family:Plus Jakarta Sans,sans-serif';
    el.innerHTML = `
        <div style="max-width:400px;width:100%">
            <div style="width:80px;height:80px;background:rgba(239,68,68,.15);border:2px solid rgba(239,68,68,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">
                <i class="fas fa-ban" style="font-size:2rem;color:#ef4444"></i>
            </div>
            <h1 style="font-family:Syne,sans-serif;font-size:1.75rem;font-weight:800;color:#f1f5f9;margin-bottom:8px">Akun Dibanned</h1>
            <p style="color:#64748b;font-size:.875rem;margin-bottom:20px">Akun kamu telah dibanned oleh admin XREZZKY OFFICIAL STORE.</p>
            <div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:16px;padding:20px;margin-bottom:20px;text-align:left">
                <p style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:#ef4444;margin-bottom:8px">⚠️ Alasan Banned</p>
                <p style="font-size:.875rem;color:#fca5a5;line-height:1.6">${reason}</p>
            </div>
            <p style="font-size:11px;color:#475569;margin-bottom:16px">Hubungi: xrezzkystore.idn@gmail.com · 088293064112</p>
            <button id="bannedLogoutBtn" style="width:100%;padding:14px;background:linear-gradient(135deg,#3b82f6,#2563eb);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:.875rem">Keluar dari Akun</button>
        </div>
    `;
    document.body.appendChild(el);
    el.querySelector('#bannedLogoutBtn').onclick = () => signOut(auth).then(() => location.reload());
};

// ========== UPDATE AUTH HEADER ==========
const updateAuthHeader = () => {
    const header = $('authHeader');
    if (!header) return;
    
    if (!currentUser) {
        header.innerHTML = `<button onclick="openModal('modalAuth')" class="btn-primary !py-2 !px-6 !text-sm">Masuk</button>`;
        return;
    }
    
    const role = currentUserData?.role || 'buyer';
    const label = role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Buyer';
    const cls = role === 'admin' ? 'text-red-400' : role === 'seller' ? 'text-green-400' : 'text-blue-400';
    
    header.innerHTML = `
        <div class="flex items-center gap-3 cursor-pointer" onclick="navigate('profile')">
            <div class="text-right hidden sm:block leading-none">
                <p class="text-xs font-bold">${currentUser.displayName || 'User'}</p>
                <p class="text-[9px] ${cls} font-black uppercase">${label}</p>
            </div>
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold border-2 border-white/10 text-sm">
                ${(currentUser.displayName || 'U').charAt(0).toUpperCase()}
            </div>
        </div>
    `;
};

// ========== REFRESH PROFILE PAGE ==========
const refreshProfilePage = () => {
    const notLogged = $('profileNotLoggedIn');
    const logged = $('profileLoggedIn');
    
    if (!currentUser) {
        notLogged?.classList.remove('hidden');
        logged?.classList.add('hidden');
        return;
    }
    
    notLogged?.classList.add('hidden');
    logged?.classList.remove('hidden');
    
    const name = currentUser.displayName || 'User';
    if ($('userNameText')) $('userNameText').textContent = name;
    if ($('userEmailText')) $('userEmailText').textContent = currentUser.email;
    if ($('profileAvatar')) $('profileAvatar').textContent = name.charAt(0).toUpperCase();
    if ($('avatarText')) $('avatarText').textContent = name.charAt(0).toUpperCase();
    
    const creationTime = currentUser.metadata?.creationTime;
    if (creationTime && $('statsMember')) {
        $('statsMember').textContent = new Date(creationTime).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' });
    }
};

// ========== SAVE EDIT PROFILE ==========
window.saveEditProfile = async () => {
    if (!currentUser) return;
    
    const newName = $('editName').value.trim();
    if (!newName) return showToast('Error', 'Nama tidak boleh kosong!', 'error');
    
    try {
        await updateProfile(currentUser, { displayName: newName });
        await set(ref(db, `users/${currentUser.uid}`), { name: newName, email: currentUser.email, role: currentUserData?.role || 'buyer', createdAt: currentUserData?.createdAt || Date.now() });
        refreshProfilePage();
        updateAuthHeader();
        closeModal('modalEditProfile');
        showToast('Berhasil!', 'Profil berhasil diperbarui!');
    } catch (error) {
        showToast('Gagal', error.message, 'error');
    }
};

// ========== PROCESS LOGIN ==========
window.processLogin = async () => {
    const email = $('authEmail').value.trim();
    const password = $('authPass').value;
    
    if (!email || !password) return showToast('Error', 'Email & password wajib!', 'error');
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
        closeModal('modalAuth');
        showToast('Berhasil!', 'Selamat datang kembali! 👋');
        $('authEmail').value = '';
        $('authPass').value = '';
    } catch (error) {
        showToast('Gagal', 'Email atau password salah!', 'error');
    }
};

// ========== PROCESS REGISTER ==========
window.processRegister = async () => {
    const name = $('regName').value.trim();
    const email = $('regEmail').value.trim();
    const password = $('regPass').value;
    
    if (!name) return showToast('Error', 'Nama tidak boleh kosong!', 'error');
    if (!email) return showToast('Error', 'Email tidak boleh kosong!', 'error');
    if (password.length < 6) return showToast('Error', 'Password minimal 6 karakter!', 'error');
    
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        await set(ref(db, `users/${userCredential.user.uid}`), {
            name: name,
            email: email,
            role: 'buyer',
            createdAt: Date.now()
        });
        closeModal('modalAuth');
        showToast('Berhasil! 🎉', 'Akun berhasil dibuat!');
        $('regName').value = '';
        $('regEmail').value = '';
        $('regPass').value = '';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            showToast('Gagal', 'Email sudah dipakai!', 'error');
        } else {
            showToast('Gagal', error.message, 'error');
        }
    }
};

// ========== PROCESS FORGOT PASSWORD ==========
window.processForgotPassword = async () => {
    const email = $('authEmail').value.trim();
    if (!email) return showToast('Info', 'Isi email dulu!', 'info');
    
    try {
        await sendPasswordResetEmail(auth, email);
        showToast('Email Terkirim! 📧', 'Cek inbox untuk reset password');
        closeModal('modalAuth');
    } catch (error) {
        showToast('Gagal', 'Email tidak ditemukan', 'error');
    }
};

// ========== TOGGLE AUTH FORM ==========
window.toggleAuthForm = () => {
    $('loginForm').classList.toggle('hidden');
    $('regForm').classList.toggle('hidden');
};

// ========== RENDER PRODUCTS ==========
const renderProducts = (products) => {
    const grid = $('mainProductGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    if (!products?.length) {
        grid.innerHTML = `
            <div class="col-span-full text-center py-20 text-gray-500">
                <i class="fas fa-search text-4xl mb-4 opacity-30"></i>
                <p class="font-bold">Produk tidak ditemukan</p>
            </div>
        `;
        return;
    }
    
    products.forEach(product => {
        const stock = Number(product.stock || 0);
        const lowStock = stock > 0 && stock < 5;
        const outStock = stock <= 0;
        
        const card = document.createElement('div');
        card.className = 'glass-card product-card p-3';
        card.onclick = () => showProductDetail(product);
        
        card.innerHTML = `
            <div class="product-img-container mb-3">
                <img src="${product.images?.[0] || 'https://placehold.co/400x400/0f172a/3b82f6?text=No+Img'}" 
                     class="product-img" loading="lazy" 
                     onerror="this.src='https://placehold.co/400x400/0f172a/3b82f6?text=No+Img'">
                ${outStock ? '<span class="badge-new !bg-gray-600">Habis</span>' : ''}
                ${lowStock ? '<span class="badge-limit">Stok Limit</span>' : ''}
            </div>
            <p class="text-[10px] text-blue-400 font-bold uppercase tracking-tighter mb-1">${product.category || 'General'}</p>
            <h3 class="text-sm font-bold line-clamp-1 mb-2">${product.name || 'Produk'}</h3>
            <div class="flex justify-between items-center">
                <p class="text-sm font-extrabold text-white">Rp ${Number(product.price || 0).toLocaleString('id-ID')}</p>
                ${product.rating ? `<span class="text-yellow-400 text-xs font-bold">★ ${product.rating}</span>` : `<div class="text-[10px] text-gray-500"><i class="fas fa-box mr-1"></i>${product.stock ?? '-'}</div>`}
            </div>
        `;
        
        grid.appendChild(card);
    });
};

// ========== APPLY FILTERS ==========
const applyFilters = (searchQuery = '') => {
    const query = searchQuery || $('globalSearch')?.value.toLowerCase() || '';
    let filtered = [...allProducts];
    
    if (currentFilter !== 'all') {
        filtered = filtered.filter(p => p.category === currentFilter);
    }
    
    if (query) {
        filtered = filtered.filter(p => 
            (p.name || '').toLowerCase().includes(query) ||
            (p.category || '').toLowerCase().includes(query) ||
            (p.storeName || '').toLowerCase().includes(query)
        );
    }
    
    renderProducts(filtered);
};

// ========== SHOW PRODUCT DETAIL ==========
window.showProductDetail = (product) => {
    selectedProduct = product;
    
    $('detImg').src = product.images?.[0] || 'https://placehold.co/400x400/0f172a/3b82f6?text=No+Img';
    $('detTitle').textContent = product.name || '-';
    $('detPrice').textContent = `Rp ${Number(product.price || 0).toLocaleString('id-ID')}`;
    $('detDesc').textContent = product.description || 'Tidak ada deskripsi.';
    $('detCat').textContent = product.category || 'Digital Asset';
    $('detStock').textContent = product.stock ?? '-';
    
    if ($('detRating')) $('detRating').textContent = product.rating || '4.9';
    
    const seller = allSellers.find(s => s.uid === product.sellerId);
    const sellerName = seller?.ownerName || product.sellerName || 'XREZZKY Official';
    const storeName = seller?.storeName || product.storeName || '';
    
    if ($('detSellerName')) $('detSellerName').textContent = sellerName;
    if ($('detSellerAvatar')) $('detSellerAvatar').textContent = (storeName || sellerName).charAt(0).toUpperCase();
    
    loadProductReviews(product.id);
    openModal('modalDetail');
};

// ========== LOAD PRODUCT REVIEWS ==========
const loadProductReviews = async (productId) => {
    const reviewsContainer = $('detReviews');
    if (!reviewsContainer) return;
    
    try {
        const snapshot = await get(ref(db, `products/${productId}/reviews`));
        
        if (!snapshot.exists()) {
            reviewsContainer.innerHTML = `<p class="text-xs text-gray-500 italic">Belum ada ulasan.</p>`;
            return;
        }
        
        const reviews = Object.values(snapshot.val()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
        let html = `<h4 class="font-bold border-l-4 border-blue-500 pl-3 text-sm mb-3">Ulasan Pembeli</h4>`;
        
        reviews.forEach(review => {
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += `<span style="color:${i <= review.stars ? '#f59e0b' : '#374151'}" class="text-xs">★</span>`;
            }
            const date = new Date(review.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
            html += `
                <div class="bg-white/5 rounded-xl p-3 mb-2">
                    <div class="flex items-center justify-between mb-1">
                        <p class="text-xs font-bold">${review.userName || 'User'}</p>
                        <div class="flex items-center gap-1">${starsHtml}<span class="text-[9px] text-gray-500 ml-1">${date}</span></div>
                    </div>
                    ${review.comment ? `<p class="text-xs text-gray-400 leading-relaxed">${review.comment}</p>` : ''}
                </div>
            `;
        });
        
        reviewsContainer.innerHTML = html;
    } catch (error) {
        reviewsContainer.innerHTML = '';
    }
};

// ========== HANDLE BUY NOW ==========
window.handleBuyNow = async () => {
    if (!currentUser) {
        closeModal('modalDetail');
        openModal('modalAuth');
        showToast('Info', 'Login dulu untuk bertransaksi', 'info');
        return;
    }
    
    if (!selectedProduct) return;
    
    const stock = Number(selectedProduct.stock || 0);
    if (stock <= 0) return showToast('Stok Habis', 'Produk ini tidak tersedia saat ini', 'error');
    
    const qty = 1;
    const total = Number(selectedProduct.price || 0) * qty;
    
    const seller = allSellers.find(s => s.uid === selectedProduct.sellerId);
    const waNumber = (seller?.whatsapp || '6281234567890').replace(/\D/g, '');
    const buyerWa = currentUserData?.waNumber || '-';
    
    const btn = $('btnBuy');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Memproses...';
    }
    
    try {
        const orderRef = await push(ref(db, `orders/${currentUser.uid}`), {
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productDesc: selectedProduct.description || '-',
            category: selectedProduct.category || '-',
            qty: qty,
            unitPrice: Number(selectedProduct.price || 0),
            totalPrice: total,
            storeName: seller?.storeName || 'XREZZKY Store',
            sellerId: selectedProduct.sellerId || '',
            buyerName: currentUser.displayName,
            buyerEmail: currentUser.email,
            buyerWa: buyerWa,
            status: 'confirm',
            rated: false,
            createdAt: Date.now()
        });
        
        await update(ref(db, `products/${selectedProduct.id}`), {
            stock: Math.max(0, stock - qty)
        });
        
        selectedProduct.stock = Math.max(0, stock - qty);
        if ($('detStock')) $('detStock').textContent = selectedProduct.stock;
        
        const orderId = orderRef.key.slice(-8).toUpperCase();
        const now = new Date().toLocaleString('id-ID', {
            weekday: 'long', day: '2-digit', month: 'long',
            year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        const message = encodeURIComponent(`
🔔 *PESANAN BARU!*

━━━━━━━━━━━━━━━
🏪 Toko: *${seller?.storeName || 'XREZZKY'}*
📋 ID: *${orderId}*
🕐 Waktu: ${now}
━━━━━━━━━━━━━━━

📦 Produk: *${selectedProduct.name}*
📝 Deskripsi: ${selectedProduct.description || '-'}
🏷️ Kategori: ${selectedProduct.category || '-'}
🔢 Jumlah: ${qty} unit
💰 Harga: Rp ${Number(selectedProduct.price || 0).toLocaleString('id-ID')} / unit
💳 Total: *Rp ${total.toLocaleString('id-ID')}*
🆔 ID Produk: ${selectedProduct.id}

━━━━━━━━━━━━━━━
👤 Pembeli: *${currentUser.displayName}*
📱 WA: ${buyerWa}
📧 Email: ${currentUser.email}
━━━━━━━━━━━━━━━

✅ Konfirmasi di Seller Dashboard.
        `);
        
        window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
        closeModal('modalDetail');
        showToast('Pesanan Dibuat! 🎉', `${qty}x ${selectedProduct.name} — tunggu konfirmasi seller`);
        
    } catch (error) {
        showToast('Gagal', error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-shopping-cart"></i> Beli Sekarang';
        }
    }
};

// ========== DRAW ORDERS ==========
const drawOrders = () => {
    const container = $('ordersList');
    if (!container) return;
    
    if (!currentUser) {
        container.innerHTML = `
            <div class="glass-card p-12 text-center text-gray-500">
                <i class="fas fa-lock text-4xl mb-4 opacity-30"></i>
                <p class="font-bold">Login dulu</p>
                <button onclick="openModal('modalAuth')" class="btn-primary !inline-block mt-4">Login</button>
            </div>
        `;
        return;
    }
    
    if (ordersUnsubscribe) {
        ordersUnsubscribe();
        ordersUnsubscribe = null;
    }
    
    container.innerHTML = `<div class="text-center py-8"><div class="spinner w-8 h-8 mx-auto mb-2"></div><p class="text-sm text-gray-500">Memuat...</p></div>`;
    
    const statusMap = {
        confirm: { label: 'Menunggu Konfirmasi Seller', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', icon: 'fa-clock' },
        pending: { label: 'Pending Pembayaran', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', icon: 'fa-credit-card' },
        processing: { label: 'Sedang Diproses', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30', icon: 'fa-spinner' },
        completed: { label: 'Selesai ✅', color: 'text-green-400 bg-green-500/10 border-green-500/30', icon: 'fa-check-circle' },
        cancelled: { label: 'Ditolak', color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: 'fa-times-circle' }
    };
    
    ordersUnsubscribe = onValue(ref(db, `orders/${currentUser.uid}`), (snapshot) => {
        container.innerHTML = '';
        
        if (!snapshot.exists()) {
            container.innerHTML = `
                <div class="glass-card p-12 text-center text-gray-500">
                    <i class="fas fa-shopping-bag text-4xl mb-4 opacity-30"></i>
                    <p class="font-bold">Belum ada pesanan</p>
                    <button onclick="navigate('home')" class="btn-primary !inline-block mt-4">Mulai Belanja</button>
                </div>
            `;
            return;
        }
        
        const orders = snapshot.val();
        const sortedOrders = Object.keys(orders).sort((a, b) => (orders[b].createdAt || 0) - (orders[a].createdAt || 0));
        
        sortedOrders.forEach(orderId => {
            const order = orders[orderId];
            const status = statusMap[order.status] || statusMap.confirm;
            const date = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '-';
            const shortId = orderId.slice(-8).toUpperCase();
            
            const div = document.createElement('div');
            div.className = 'trx-item';
            div.innerHTML = `
                <div class="flex items-start justify-between mb-3 gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-extrabold font-syne text-sm line-clamp-1">${order.productName || '-'}</p>
                        <div class="flex items-center gap-2 mt-1 flex-wrap">
                            <p class="text-[10px] text-gray-500">${date}</p>
                            <button onclick="copyOrderId('${shortId}')" class="text-[10px] text-blue-400 font-bold flex items-center gap-1">
                                <i class="fas fa-copy text-[9px]"></i> ${shortId}
                            </button>
                        </div>
                    </div>
                    <span class="text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 ${status.color} flex items-center gap-1">
                        <i class="fas ${status.icon} text-[9px]"></i> ${status.label}
                    </span>
                </div>
                ${order.status === 'cancelled' && order.cancelReason ? `
                    <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-3">
                        <p class="text-[10px] text-red-400 font-bold uppercase mb-1">Alasan Ditolak</p>
                        <p class="text-xs text-gray-300">${order.cancelReason}</p>
                    </div>
                ` : ''}
                ${order.adminNote ? `
                    <div class="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-3">
                        <p class="text-[10px] text-blue-400 font-bold uppercase mb-1">Catatan Admin</p>
                        <p class="text-xs text-gray-300">${order.adminNote}</p>
                    </div>
                ` : ''}
                <div class="bg-white/5 rounded-xl p-3 mb-3 space-y-1.5">
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Produk</span>
                        <span class="font-semibold line-clamp-1 text-right">${order.productName || '-'} ${order.qty > 1 ? `(${order.qty}x)` : ''}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Toko</span>
                        <span class="font-semibold">${order.storeName || '-'}</span>
                    </div>
                    <div class="flex justify-between text-xs">
                        <span class="text-gray-500">Total</span>
                        <span class="font-bold text-blue-400">Rp ${Number(order.totalPrice || 0).toLocaleString('id-ID')}</span>
                    </div>
                </div>
                <div class="flex items-center justify-between">
                    <button onclick="copyOrderDetail('${orderId}')" class="text-xs text-gray-500 hover:text-white transition flex items-center gap-1">
                        <i class="fas fa-copy text-[9px]"></i> Salin Detail
                    </button>
                    ${order.status === 'completed' && !order.rated ? `
                        <button onclick="openRatingModal('${orderId}', '${order.productId}', '${(order.productName || '').replace(/'/g, "\\'")}')" 
                                class="btn-primary !py-1.5 !px-3 !text-xs !rounded-xl flex items-center gap-1 !w-auto !inline-flex">
                            <i class="fas fa-star text-xs"></i> Beri Rating
                        </button>
                    ` : order.status === 'completed' && order.rated ? `
                        <span class="text-yellow-400 text-xs font-bold flex items-center gap-1">
                            <i class="fas fa-star text-xs"></i> Sudah Dirating
                        </span>
                    ` : order.status === 'confirm' ? `
                        <span class="text-[10px] text-yellow-400 italic">Menunggu seller...</span>
                    ` : ''}
                </div>
            `;
            container.appendChild(div);
        });
    });
};

// ========== COPY ORDER ID ==========
window.copyOrderId = (text) => {
    navigator.clipboard?.writeText(text).then(() => showToast('Disalin!', `${text} berhasil disalin`, 'success'));
};

// ========== COPY ORDER DETAIL ==========
window.copyOrderDetail = async (orderId) => {
    if (!currentUser) return;
    
    try {
        const snapshot = await get(ref(db, `orders/${currentUser.uid}/${orderId}`));
        if (!snapshot.exists()) return;
        
        const order = snapshot.val();
        const date = order.createdAt ? new Date(order.createdAt).toLocaleString('id-ID', {
            weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }) : '-';
        
        const detail = `
=== DETAIL PESANAN ===
ID: ${orderId.slice(-8).toUpperCase()}
Waktu: ${date}
Produk: ${order.productName || '-'} ${order.qty > 1 ? `(${order.qty}x)` : ''}
Toko: ${order.storeName || '-'}
Total: Rp ${Number(order.totalPrice || 0).toLocaleString('id-ID')}
Status: ${order.status || '-'}
ID Produk: ${order.productId || '-'}
=====================
        `;
        
        navigator.clipboard?.writeText(detail).then(() => showToast('Disalin!', 'Detail pesanan berhasil disalin', 'success'));
    } catch (error) {
        showToast('Gagal', 'Gagal menyalin detail', 'error');
    }
};

// ========== OPEN RATING MODAL ==========
window.openRatingModal = (orderId, productId, productName) => {
    ratingTarget = { orderId, productId, productName };
    if ($('ratingProdName')) $('ratingProdName').textContent = productName;
    
    document.querySelectorAll('#starInputGroup input').forEach(input => input.checked = false);
    if ($('ratingComment')) $('ratingComment').value = '';
    
    openModal('modalRating');
};

// ========== SUBMIT RATING ==========
window.submitRating = async () => {
    if (!ratingTarget || !currentUser) return;
    
    const selectedStar = [...document.querySelectorAll('#starInputGroup input')].find(input => input.checked);
    if (!selectedStar) return showToast('Error', 'Pilih bintang dulu!', 'error');
    
    const stars = parseInt(selectedStar.value);
    const comment = $('ratingComment')?.value.trim() || '';
    
    try {
        await set(ref(db, `products/${ratingTarget.productId}/reviews/${currentUser.uid}`), {
            userId: currentUser.uid,
            userName: currentUser.displayName || 'User',
            stars: stars,
            comment: comment,
            createdAt: Date.now()
        });
        
        const reviewsSnapshot = await get(ref(db, `products/${ratingTarget.productId}/reviews`));
        if (reviewsSnapshot.exists()) {
            const reviews = Object.values(reviewsSnapshot.val());
            const totalStars = reviews.reduce((sum, r) => sum + r.stars, 0);
            const averageRating = totalStars / reviews.length;
            await update(ref(db, `products/${ratingTarget.productId}`), {
                rating: averageRating.toFixed(1),
                ratingCount: reviews.length
            });
        }
        
        await update(ref(db, `orders/${currentUser.uid}/${ratingTarget.orderId}`), { rated: true });
        
        closeModal('modalRating');
        showToast('Terima kasih! ⭐', 'Rating berhasil dikirim!');
        ratingTarget = null;
        
    } catch (error) {
        showToast('Gagal', error.message, 'error');
    }
};

// ========== OPEN STORE FROM DETAIL ==========
window.openStoreFromDetail = () => {
    if (!selectedProduct) return;
    closeModal('modalDetail');
    const seller = allSellers.find(s => s.uid === selectedProduct.sellerId);
    if (seller) {
        renderStorePage(seller);
        openModal('modalStorePage');
    } else {
        showToast('Info', 'Info toko tidak tersedia', 'info');
    }
};

// ========== RENDER STORE PAGE ==========
const renderStorePage = (seller) => {
    const sellerProducts = allProducts.filter(p => p.sellerId === seller.uid);
    
    let totalStock = 0;
    let totalSold = 0;
    let allRatings = [];
    let totalRatingCount = 0;
        sellerProducts.forEach(p => {
        totalStock += Number(p.stock || 0);
        totalSold += Number(p.sold || 0);
        if (p.rating && p.ratingCount) {
            for (let i = 0; i < p.ratingCount; i++) {
                allRatings.push(parseFloat(p.rating));
            }
            totalRatingCount += p.ratingCount;
        }
    });
    
    const averageRating = allRatings.length > 0 ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) : null;
    
    if ($('spAvatar')) $('spAvatar').textContent = (seller.storeName || 'S').charAt(0).toUpperCase();
    if ($('spStoreName')) $('spStoreName').textContent = seller.storeName || '-';
    if ($('spOwnerName')) $('spOwnerName').textContent = `oleh ${seller.ownerName || '-'}`;
    if ($('spCity')) $('spCity').textContent = seller.city ? `📍 ${seller.city}` : '';
    if ($('spDesc')) $('spDesc').textContent = seller.storeDesc || 'Tidak ada deskripsi.';
    if ($('spTotalItem')) $('spTotalItem').textContent = sellerProducts.length;
    if ($('spTotalStock')) $('spTotalStock').textContent = totalStock;
    if ($('spTotalSold')) $('spTotalSold').textContent = totalSold;
    
    const ratingEl = $('spOverallRating');
    if (ratingEl) {
        if (averageRating) {
            let starsHtml = '';
            for (let i = 1; i <= 5; i++) {
                starsHtml += `<span style="color:${i <= Math.round(parseFloat(averageRating)) ? '#f59e0b' : '#374151'}">★</span>`;
            }
            ratingEl.innerHTML = `<span class="text-base">${starsHtml}</span><span class="text-xs text-gray-400 ml-1">${averageRating} dari ${totalRatingCount} ulasan</span>`;
        } else {
            ratingEl.innerHTML = `<span class="text-xs text-gray-500 italic">Belum ada ulasan</span>`;
        }
    }
    
    const productList = $('spProductList');
    if (!productList) return;
    productList.innerHTML = '';
    
    if (!sellerProducts.length) {
        productList.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500 text-sm">Belum ada produk</div>`;
        return;
    }
    
    sellerProducts.forEach(product => {
        const lowStock = Number(product.stock) > 0 && Number(product.stock) < 5;
        const outStock = Number(product.stock) <= 0;
        
        const item = document.createElement('div');
        item.className = 'bg-white/5 border border-white/5 rounded-xl p-2 cursor-pointer hover:border-blue-500/50 transition';
        item.onclick = () => {
            closeModal('modalStorePage');
            showProductDetail(product);
        };
        
        item.innerHTML = `
            <div class="relative overflow-hidden rounded-lg mb-1.5" style="aspect-ratio:1/1">
                <img src="${product.images?.[0] || 'https://placehold.co/300x300/0f172a/3b82f6?text=P'}" 
                     class="w-full h-full object-cover" 
                     onerror="this.src='https://placehold.co/300x300/0f172a/3b82f6?text=P'">
                ${outStock ? '<span class="absolute top-1 right-1 text-[9px] font-black bg-gray-600 text-white px-1.5 py-0.5 rounded-full">Habis</span>' : ''}
                ${lowStock ? '<span class="absolute top-1 right-1 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded-full">Limit</span>' : ''}
            </div>
            <p class="text-[10px] text-blue-400 font-bold uppercase mb-0.5">${product.category || '-'}</p>
            <p class="text-[11px] font-bold line-clamp-1 mb-1">${product.name}</p>
            <div class="flex justify-between items-center">
                <p class="text-[11px] font-extrabold">Rp ${Number(product.price || 0).toLocaleString('id-ID')}</p>
                ${product.rating ? `<span style="color:#f59e0b" class="text-[10px] font-bold">★ ${product.rating}</span>` : ''}
            </div>
        `;
        productList.appendChild(item);
    });
};

// ========== RENDER STORE CHIPS ==========
const renderStoreChips = () => {
    const container = $('storeChips');
    if (!container) return;
    container.innerHTML = '';
    
    if (!allSellers.length) {
        container.innerHTML = `<p class="text-gray-500 text-sm py-2 px-1">Belum ada toko aktif</p>`;
        return;
    }
    
    allSellers.forEach(seller => {
        const chip = document.createElement('div');
        chip.className = 'shrink-0 glass-card px-4 py-3 flex items-center gap-3 cursor-pointer hover:border-blue-500 transition min-w-[160px] rounded-2xl';
        chip.onclick = () => {
            renderStorePage(seller);
            openModal('modalStorePage');
        };
        
        chip.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-sm shrink-0">
                ${(seller.storeName || 'S').charAt(0).toUpperCase()}
            </div>
            <div class="min-w-0">
                <p class="text-xs font-bold line-clamp-1">${seller.storeName || '-'}</p>
                <p class="text-[10px] text-gray-500">${seller.category || 'Digital'}</p>
            </div>
        `;
        container.appendChild(chip);
    });
};

// ========== RENDER ALL STORES ==========
window.filterStores = (query) => {
    const searchQuery = query.toLowerCase();
    const filtered = searchQuery ? allSellers.filter(s => 
        (s.storeName || '').toLowerCase().includes(searchQuery) || 
        (s.category || '').toLowerCase().includes(searchQuery)
    ) : allSellers;
    
    const grid = $('allStoreGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    if (!filtered.length) {
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-gray-500"><i class="fas fa-store text-3xl mb-2 opacity-30"></i><p class="font-bold">Toko tidak ditemukan</p></div>`;
        return;
    }
    
    filtered.forEach(seller => {
        const sellerProducts = allProducts.filter(p => p.sellerId === seller.uid);
        let allRatings = [];
        let totalRatingCount = 0;
        let totalStock = 0;
        
        sellerProducts.forEach(p => {
            totalStock += Number(p.stock || 0);
            if (p.rating && p.ratingCount) {
                for (let i = 0; i < p.ratingCount; i++) {
                    allRatings.push(parseFloat(p.rating));
                }
                totalRatingCount += p.ratingCount;
            }
        });
        
        const averageRating = allRatings.length > 0 ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1) : null;
        
        const card = document.createElement('div');
        card.className = 'glass-card p-5 cursor-pointer hover:border-blue-500/40 transition rounded-2xl';
        card.onclick = () => {
            renderStorePage(seller);
            openModal('modalStorePage');
        };
        
        card.innerHTML = `
            <div class="flex items-center gap-3 mb-3">
                <div class="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xl font-bold shrink-0">
                    ${(seller.storeName || 'S').charAt(0).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="font-extrabold font-syne line-clamp-1 text-sm">${seller.storeName || '-'}</p>
                    <p class="text-[10px] text-blue-400 font-bold uppercase">${seller.category || 'General'}</p>
                </div>
                <span class="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full font-bold shrink-0">✅ Verified</span>
            </div>
            <p class="text-gray-400 text-xs leading-relaxed line-clamp-2 mb-3">${seller.storeDesc || '-'}</p>
            ${averageRating ? `
                <div class="flex items-center gap-1 mb-3">
                    <span style="color:#f59e0b">★</span>
                    <span class="text-xs font-bold">${averageRating}</span>
                    <span class="text-[9px] text-gray-500">(${totalRatingCount} ulasan)</span>
                </div>
            ` : ''}
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-white/5 rounded-xl py-1.5">
                    <p class="text-xs font-bold">${sellerProducts.length}</p>
                    <p class="text-[9px] text-gray-500">Produk</p>
                </div>
                <div class="bg-white/5 rounded-xl py-1.5">
                    <p class="text-xs font-bold text-green-400">${totalStock}</p>
                    <p class="text-[9px] text-gray-500">Stok</p>
                </div>
                <div class="bg-white/5 rounded-xl py-1.5 flex items-center justify-center">
                    <span class="text-xs font-bold text-blue-400">Lihat →</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
};

// ========== LOAD SITE CONFIGURATION ==========
const loadSiteConfig = () => {
    configUnsubscribe = onValue(ref(db, 'admin/config/site'), (snapshot) => {
        const config = snapshot.val() || {};
        
        // Hero Titles
        if ($('heroTitle1')) $('heroTitle1').textContent = config.heroTitle1 || 'XREZZKY';
        if ($('heroTitle2')) $('heroTitle2').textContent = config.heroTitle2 || 'OFFICIAL STORE';
        if ($('heroTagline')) $('heroTagline').textContent = config.tagline || '';
        
        // Trust Badges
        const badgesContainer = $('heroBadges');
        if (badgesContainer) {
            const badgeColors = ['text-blue-300 bg-blue-500/15 border-blue-500/30', 'text-green-300 bg-green-500/15 border-green-500/30', 'text-yellow-300 bg-yellow-500/15 border-yellow-500/30'];
            const badgeIcons = ['fa-shield-alt', 'fa-check-circle', 'fa-star'];
            const badges = config.trustBadges || [];
            badgesContainer.innerHTML = badges.map((badge, i) => `
                <span class="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest ${badgeColors[i % 3]} border px-3 py-1.5 rounded-full">
                    <i class="fas ${badgeIcons[i % 3]} text-xs"></i> ${badge}
                </span>
            `).join('');
        }
        
        // Hero Stats
        const statsContainer = $('heroStats');
        if (statsContainer) {
            const stats = [
                { number: config.stat1n, label: config.stat1l, color: 'text-blue-400' },
                { number: config.stat2n, label: config.stat2l, color: 'text-green-400' },
                { number: config.stat3n, label: config.stat3l, color: 'text-yellow-400' }
            ];
            statsContainer.innerHTML = stats.filter(s => s.number).map(s => `
                <div class="bg-white/5 border border-white/10 backdrop-blur px-5 py-4 rounded-2xl text-center min-w-[100px]">
                    <p class="text-2xl font-extrabold ${s.color} font-syne">${s.number}</p>
                    <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">${s.label || ''}</p>
                </div>
            `).join('');
        }
        
        // Promo Ticker
        const tickerWrap = $('promoTickerWrap');
        const tickerInner = $('promoTickerInner');
        const tickerItems = config.tickerItems || [];
        if (tickerInner && tickerItems.length > 0) {
            tickerInner.innerHTML = [...tickerItems, ...tickerItems].map(item => `<span class="text-sm font-semibold text-gray-200">${item}</span>`).join('');
            if (tickerWrap) tickerWrap.classList.remove('hidden');
        } else if (tickerWrap) {
            tickerWrap.classList.add('hidden');
        }
        
        // Features Grid
        const featuresGrid = $('featuresGrid');
        const features = config.features || [];
        if (featuresGrid && features.length > 0) {
            featuresGrid.innerHTML = features.map(f => `
                <div class="glass-card p-4 flex items-center gap-3">
                    <div class="w-10 h-10 bg-${f.color || 'blue'}-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <i class="fas ${f.icon || 'fa-star'} text-${f.color || 'blue'}-400"></i>
                    </div>
                    <div>
                        <p class="text-xs font-extrabold">${f.title || ''}</p>
                        <p class="text-[10px] text-gray-500">${f.desc || ''}</p>
                    </div>
                </div>
            `).join('');
        }
        
        // Categories Filter
        const categoryFilter = $('categoryFilter');
        const categories = config.categories || [];
        if (categoryFilter && categories.length > 0) {
            categoryFilter.querySelectorAll('.category-btn:not([data-cat="all"])').forEach(btn => btn.remove());
            categories.forEach(cat => {
                const btn = document.createElement('div');
                btn.className = 'flex-none px-6 py-3 glass-card text-sm font-bold hover:border-blue-500 cursor-pointer category-btn';
                btn.dataset.cat = cat;
                btn.textContent = cat;
                categoryFilter.appendChild(btn);
            });
        }
    });
};

// ========== LOAD PRODUCTS ==========
const loadProducts = () => {
    productsUnsubscribe = onValue(ref(db, 'products'), (snapshot) => {
        allProducts = [];
        const data = snapshot.val() || {};
        Object.keys(data).forEach(key => {
            if (!data[key].hidden) {
                allProducts.push({ id: key, ...data[key] });
            }
        });
        applyFilters();
        dismissLoader();
        
        // Handle deep link product ID
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');
        if (productId) {
            const product = allProducts.find(p => p.id === productId);
            if (product) showProductDetail(product);
        }
    }, (error) => {
        console.error('Error loading products:', error);
        renderProducts([]);
        dismissLoader();
    });
};

// ========== LOAD SELLERS ==========
const loadSellers = () => {
    sellersUnsubscribe = onValue(ref(db, 'seller_applications'), (snapshot) => {
        allSellers = [];
        const data = snapshot.val() || {};
        Object.keys(data).forEach(key => {
            if (data[key].status === 'approved') {
                allSellers.push({ uid: key, ...data[key] });
            }
        });
        renderStoreChips();
        if ($('modalAllStores')?.style.display === 'flex') {
            window.filterStores('');
        }
    });
};

// ========== SETUP CATEGORY FILTER ==========
const setupCategoryFilter = () => {
    const categoryFilter = $('categoryFilter');
    if (!categoryFilter) return;
    
    categoryFilter.addEventListener('click', (e) => {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        
        document.querySelectorAll('.category-btn').forEach(b => {
            b.classList.remove('active-cat', 'border-blue-500', 'bg-blue-500/10');
        });
        btn.classList.add('active-cat', 'border-blue-500', 'bg-blue-500/10');
        
        currentFilter = btn.dataset.cat;
        applyFilters();
    });
};

// ========== SETUP GLOBAL SEARCH ==========
const setupGlobalSearch = () => {
    const searchInput = $('globalSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        applyFilters(e.target.value.toLowerCase());
    });
};

// ========== SETUP AVATAR UPLOAD ==========
const setupAvatarUpload = () => {
    const avatarInput = $('avatarUpload');
    if (!avatarInput) return;
    
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const avatar = $('profileAvatar');
            if (avatar) avatar.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover">`;
        };
        reader.readAsDataURL(file);
        showToast('Info', 'Avatar berubah sementara (upload storage tidak aktif)', 'info');
    });
};

// ========== AUTH STATE LISTENER ==========
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        currentUser = null;
        currentUserData = null;
        updateAuthHeader();
        refreshProfilePage();
        dismissLoader();
        
        const homeSellerCta = $('homeSellerCta');
        if (homeSellerCta) homeSellerCta.classList.remove('hidden');
        return;
    }
    
    currentUser = user;
    
    // Real-time user data listener
    onValue(ref(db, `users/${user.uid}`), async (snapshot) => {
        currentUserData = snapshot.exists() ? snapshot.val() : { role: 'buyer' };
        
        // Banned check
        if (currentUserData?.banned === true) {
            showBannedScreen(currentUserData.bannedReason || 'Tidak ada keterangan.');
            return;
        }
        
        updateAuthHeader();
        refreshProfilePage();
        
        const role = currentUserData?.role || 'buyer';
        const isAdmin = role === 'admin';
        const isSeller = role === 'seller';
        const isPending = currentUserData?.sellerStatus === 'pending';
        
        // Role badge
        const badgeStyle = isAdmin ? 'bg-red-500/20 text-red-400 border-red-500/40'
                         : isSeller ? 'bg-green-500/20 text-green-400 border-green-500/40'
                         : 'bg-blue-500/20 text-blue-400 border-blue-500/40';
        const roleLabel = isAdmin ? 'Admin Tier' : isSeller ? 'Seller Tier' : 'Buyer Tier';
        const roleBadge = $('roleBadgeContainer');
        if (roleBadge) {
            roleBadge.innerHTML = `<span class="${badgeStyle} border px-4 py-1 rounded-full text-[10px] font-black uppercase">${roleLabel}</span>`;
        }
        
        const sellerCtaCard = $('sellerCtaCard');
        const homeSellerCta = $('homeSellerCta');
        const sellerBanner = $('sellerBanner');
        
        if (isAdmin) {
            const sellerApp = await get(ref(db, `seller_applications/${user.uid}`));
            const hasStore = sellerApp.exists() && sellerApp.val().status === 'approved';
            const pendingApp = sellerApp.exists() && sellerApp.val().status === 'pending';
            const storeName = sellerApp.exists() ? sellerApp.val().storeName : null;
            
            if (sellerBanner) {
                sellerBanner.className = 'space-y-3 mb-6';
                let html = `
                    <div class="w-full bg-gradient-to-r from-blue-700 to-indigo-900 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition shadow-xl border border-white/10" onclick="window.location.href='admin-panel.html'">
                        <div class="flex items-center gap-4">
                            <div class="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center">
                                <i class="fas fa-user-shield text-white text-lg"></i>
                            </div>
                            <div>
                                <p class="text-[10px] font-bold text-blue-200 uppercase tracking-widest">Owner Access</p>
                                <h3 class="text-sm font-black text-white">DASHBOARD ADMIN</h3>
                            </div>
                        </div>
                        <i class="fas fa-chevron-right text-white/50"></i>
                    </div>
                `;
                if (hasStore) {
                    html += `
                        <div class="w-full bg-gradient-to-r from-green-800/60 to-blue-800/40 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition border border-green-500/30" onclick="window.location.href='seller-dashboard.html'">
                            <div class="flex items-center gap-4">
                                <div class="w-11 h-11 bg-green-500/30 rounded-xl flex items-center justify-center">
                                    <i class="fas fa-store text-green-300 text-lg"></i>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black uppercase text-green-300">✅ Toko Aktif</p>
                                    <h3 class="text-sm font-black text-white">${storeName || 'Toko Admin'}</h3>
                                </div>
                            </div>
                            <span class="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold">Kelola →</span>
                        </div>
                    `;
                    if (homeSellerCta) homeSellerCta.classList.add('hidden');
                } else if (pendingApp) {
                    html += `
                        <div class="bg-yellow-900/30 p-4 rounded-[20px] flex items-center gap-4 border border-yellow-500/30">
                            <div class="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
                                <i class="fas fa-clock text-yellow-300 animate-pulse"></i>
                            </div>
                            <div>
                                <p class="text-[9px] font-black uppercase text-yellow-300">⏳ Toko Pending</p>
                                <p class="text-sm font-bold text-white">Menunggu persetujuan admin</p>
                            </div>
                        </div>
                    `;
                    if (homeSellerCta) homeSellerCta.classList.add('hidden');
                } else {
                    html += `
                        <div class="bg-purple-900/40 p-4 rounded-[20px] flex items-center justify-between cursor-pointer hover:opacity-90 transition border border-purple-500/30" onclick="openModal('modalBecomeSeller')">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-purple-500/30 rounded-xl flex items-center justify-center">
                                    <i class="fas fa-store text-purple-300"></i>
                                </div>
                                <div>
                                    <p class="text-[9px] font-black uppercase text-purple-300">🎉 Buka Toko</p>
                                    <p class="text-sm font-black text-white">Admin juga bisa punya toko!</p>
                                    <p class="text-xs text-gray-400">Daftar → tetap jadi admin + punya seller dashboard</p>
                                </div>
                            </div>
                            <span class="bg-purple-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold shrink-0">Daftar →</span>
                        </div>
                    `;
                    if (homeSellerCta) homeSellerCta.classList.remove('hidden');
                }
                sellerBanner.innerHTML = html;
            }
            if (sellerCtaCard) sellerCtaCard.classList.add('hidden');
            
        } else if (isSeller) {
            if (sellerBanner) {
                sellerBanner.className = 'mb-6';
                sellerBanner.innerHTML = `
                    <div class="bg-gradient-to-r from-green-800/60 to-blue-800/40 p-5 rounded-[24px] flex items-center justify-between cursor-pointer hover:scale-[1.01] transition border border-green-500/30" onclick="window.location.href='seller-dashboard.html'">
                        <div class="flex items-center gap-4">
                            <div class="w-11 h-11 bg-green-500/30 rounded-xl flex items-center justify-center">
                                <i class="fas fa-store text-green-300 text-lg"></i>
                            </div>
                            <div>
                                <p class="text-[9px] font-black uppercase text-green-300">✅ Seller Aktif</p>
                                <h3 class="text-sm font-black text-white">${currentUserData?.storeName || 'Toko Kamu'}</h3>
                            </div>
                        </div>
                        <span class="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Dashboard →</span>
                    </div>
                `;
            }
            if (sellerCtaCard) sellerCtaCard.classList.add('hidden');
            if (homeSellerCta) homeSellerCta.classList.add('hidden');
            
        } else if (isPending) {
            if (sellerBanner) {
                sellerBanner.className = 'mb-6';
                sellerBanner.innerHTML = `
                    <div class="bg-yellow-900/30 p-5 rounded-[24px] flex items-center gap-4 border border-yellow-500/30">
                        <div class="w-11 h-11 bg-yellow-500/20 rounded-xl flex items-center justify-center shrink-0">
                            <i class="fas fa-clock text-yellow-300 text-lg animate-pulse"></i>
                        </div>
                        <div class="flex-1">
                            <p class="text-[9px] font-black uppercase text-yellow-300">⏳ Pending Verifikasi</p>
                            <p class="font-bold text-white text-sm">Aplikasi Seller Dikirim</p>
                            <p class="text-gray-400 text-xs">Admin sedang verifikasi. 1×24 jam.</p>
                        </div>
                        <div class="w-2.5 h-2.5 bg-yellow-400 rounded-full animate-pulse shrink-0"></div>
                    </div>
                `;
            }
            if (sellerCtaCard) sellerCtaCard.classList.add('hidden');
            if (homeSellerCta) homeSellerCta.classList.add('hidden');
            
        } else {
            if (sellerBanner) {
                sellerBanner.innerHTML = '';
                sellerBanner.className = '';
            }
            if (sellerCtaCard) sellerCtaCard.classList.remove('hidden');
            if (homeSellerCta) homeSellerCta.classList.remove('hidden');
        }
        
        // Stats: total transactions
        const statsSnapshot = await get(ref(db, `orders/${user.uid}`));
        const transactionCount = statsSnapshot.exists() ? Object.keys(statsSnapshot.val()).length : 0;
        if ($('statsTrx')) $('statsTrx').textContent = transactionCount;
    });
});

// ========== INITIALIZE ==========
const initialize = () => {
    loadSiteConfig();
    loadProducts();
    loadSellers();
    setupCategoryFilter();
    setupGlobalSearch();
    setupAvatarUpload();
    
    // Expose global functions and variables
    window.auth = auth;
    window.db = db;
    window.ref = ref;
    window.get = get;
    window.set = set;
    window.push = push;
    window.update = update;
    window.remove = remove;
    window.onValue = onValue;
    window.signOut = signOut;
    window.currentUser = () => currentUser;
    window.currentUserData = () => currentUserData;
    window.allProducts = () => allProducts;
    window.allSellers = () => allSellers;
    window.drawOrders = drawOrders;
    window.refreshProfilePage = refreshProfilePage;
    window.renderStorePage = renderStorePage;
    
    // Set default page
    window.navigate('home');
};

// Start the app
initialize();
