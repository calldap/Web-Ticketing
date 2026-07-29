/* ============================================================
   FITUR 1 — AUTH SYSTEM
   Sistem login/register dengan role admin & user
   Data tersimpan di localStorage (online via JSONBin bila tersedia)
============================================================ */

// ── CONFIG ──────────────────────────────────────────────────
// JSONBin.io configuration (online database)
// ✏️  GANTI nilai di bawah ini dengan milik kamu:
const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const JSONBIN_KEY = '$2a$10$lk74qyoB7vfvt3M/eYPfN.JR0VdH3cLiNyeuxj8GFOtpNsKd/FfUi'; // Master Key dari JSONBin
const JSONBIN_ID  = '6a67b997da38895dfe983374';                                        // Bin ID dari JSONBin
const USE_ONLINE_DB = true; // true = pakai JSONBin online | false = localStorage saja

// ── STATUS DB GLOBAL ────────────────────────────────────────
let DB_ONLINE = false;  // akan di-update saat test koneksi
let DB_SYNCING = false; // mencegah sync bersamaan

// ── LOCAL STORAGE LAYER ─────────────────────────────────────
const LS = {
  get: k => JSON.parse(localStorage.getItem('et4_'+k) || 'null') || [],
  set: (k,v) => localStorage.setItem('et4_'+k, JSON.stringify(v)),
  session: () => JSON.parse(localStorage.getItem('et4_session') || 'null'),
  setSession: u => localStorage.setItem('et4_session', JSON.stringify(u)),
  clearSession: () => localStorage.removeItem('et4_session'),
};

// ── DB — baca satu koleksi dari JSONBin ──────────────────────
function dbGet(key) {
  return DB._cache[key] !== undefined ? DB._cache[key] : LS.get(key);
}

// ── DB — simpan dan sync ke JSONBin ─────────────────────────
async function dbSet(key, val) {
  // 1. Simpan ke cache & localStorage dulu (instant)
  DB._cache[key] = val;
  LS.set(key, val);

  // 2. Kalau online DB aktif, push ke JSONBin
  if (USE_ONLINE_DB && DB_ONLINE && !DB_SYNCING) {
    DB_SYNCING = true;
    try {
      // Kumpulkan semua tabel
      const payload = {};
      ['users','events','tiket','kategori_event'].forEach(k => {
        payload[k] = DB._cache[k] !== undefined ? DB._cache[k] : LS.get(k);
      });
      const resp = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY },
        body: JSON.stringify(payload)
      });
      if (resp.ok) {
        setDbBadge('online');
        console.log('[DB] ✅ Sync ke JSONBin berhasil:', key, val.length || val);
      } else {
        const err = await resp.text();
        console.warn('[DB] ⚠️ JSONBin PUT gagal:', resp.status, err);
        setDbBadge('error');
      }
    } catch(e) {
      console.warn('[DB] ❌ Tidak bisa sync ke JSONBin:', e.message);
      setDbBadge('offline');
    } finally {
      DB_SYNCING = false;
    }
  }
}

// ── DB — tarik semua data dari JSONBin lalu isi cache ────────
async function dbPullAll() {
  if (!USE_ONLINE_DB) return false;
  try {
    console.log('[DB] Menarik data dari JSONBin...');
    const resp = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    if (!resp.ok) {
      console.warn('[DB] Pull gagal:', resp.status, await resp.text());
      return false;
    }
    const data = await resp.json();
    const rec  = data.record || {};
    // Isi cache dari JSONBin
    ['users','events','tiket','kategori_event'].forEach(k => {
      if (rec[k]) {
        DB._cache[k] = rec[k];
        LS.set(k, rec[k]); // sinkron ke localStorage juga
      }
    });
    console.log('[DB] ✅ Data berhasil ditarik dari JSONBin:', Object.keys(rec));
    return true;
  } catch(e) {
    console.warn('[DB] ❌ Gagal tarik dari JSONBin:', e.message);
    return false;
  }
}

// ── DB — test koneksi ke JSONBin ─────────────────────────────
async function dbTestConnection() {
  if (!USE_ONLINE_DB) {
    setDbBadge('local');
    return false;
  }
  setDbBadge('testing');
  try {
    const resp = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    if (resp.ok) {
      DB_ONLINE = true;
      setDbBadge('online');
      console.log('[DB] ✅ JSONBin ONLINE — koneksi berhasil!');
      return true;
    } else {
      const err = await resp.text();
      DB_ONLINE = false;
      setDbBadge('error');
      console.warn('[DB] ⚠️ JSONBin merespons tapi error:', resp.status, err);
      return false;
    }
  } catch(e) {
    DB_ONLINE = false;
    setDbBadge('offline');
    console.warn('[DB] ❌ JSONBin tidak terjangkau:', e.message);
    return false;
  }
}

// ── Shorthand compat (agar kode lama tetap jalan) ─────────────
const DB = {
  _cache: {},
  get: dbGet,
  set: (k,v) => { dbSet(k,v); }, // fire-and-forget async
};

// ── GLOBAL STATE ─────────────────────────────────────────────
let CU = null;           // current user
let bookingEvId = null;  // event being booked
let tkFilter = 'all';   // ticket filter status
let selIcon = '💻';     // selected event icon

const ICONS = ['💻','🎵','🏃','🎨','💼','📚','🎭','🏆','🎤','🎬','🚀','🌟','🎪','⚽','🎸','🌏','💡','🤖','🎯','🏄'];

// ── HELPERS ──────────────────────────────────────────────────
const uid  = () => 'u'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const code = () => { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return 'TIX'+Array.from({length:8},()=>c[Math.floor(Math.random()*c.length)]).join(''); };
const fmtD  = d => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '–';
const fmtDT = d => d ? new Date(d).toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '–';
const fmtP  = p => (!p||p==0) ? 'GRATIS' : 'Rp '+Number(p).toLocaleString('id-ID');
const getCat  = id => DB.get('kategori_event').find(c=>c.id===id) || {name:'Lainnya',icon:'📌',color:'#888'};
const getEv   = id => DB.get('events').find(e=>e.id===id);
const getUser = id => DB.get('users').find(u=>u.id===id);
const getTkByEv  = eid => DB.get('tiket').filter(t=>t.eventId===eid&&t.status!=='cancelled');
const getTkByUsr = uid => DB.get('tiket').filter(t=>t.userId===uid);

function capInfo(ev) {
  const booked = getTkByEv(ev.id).length;
  const rem = ev.capacity - booked;
  const pct = Math.round((booked/ev.capacity)*100);
  return { booked, rem, pct, full: rem<=0 };
}
function capColor(pct) {
  if (pct>=90) return 'linear-gradient(90deg,#ff5252,#ff1744)';
  if (pct>=70) return 'linear-gradient(90deg,#ffab40,#ff9100)';
  return 'linear-gradient(90deg,var(--accent),var(--accent-2))';
}
function sbadge(s) {
  const m={active:'b-ok',cancelled:'b-rm',used:'b-in'};
  const l={active:'✅ Aktif',cancelled:'❌ Batal',used:'☑️ Check-in'};
  return `<span class="badge ${m[s]||'b-mu'}">${l[s]||s}</span>`;
}

// QR-like deterministic grid
function qrGrid(code) {
  let h=0; for(let i=0;i<code.length;i++) h=(h*31+code.charCodeAt(i))&0xFFFFFFFF;
  const corners=new Set([0,1,2,8,9,10,16,17,18,45,46,47,53,54,55,61,62,63]);
  let r=''; for(let i=0;i<64;i++){
    const dark=corners.has(i)?1:(h>>(i%32))&1;
    r+=`<div style="background:${dark?'#111':'white'};border-radius:1px;"></div>`;
    h=(h*1664525+1013904223)&0xFFFFFFFF;
  }
  return r;
}

// ── TOAST ─────────────────────────────────────────────────────
function toast(msg,type='in',sub='') {
  const ico={ok:'✅',er:'❌',wa:'⚠️',in:'ℹ️'};
  const el=document.createElement('div');
  el.className=`toast ${type}`;
  el.innerHTML=`<span class="toast-ico">${ico[type]}</span><div class="toast-txt"><strong>${msg}</strong>${sub?`<span>${sub}</span>`:''}</div>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),280);},3400);
}

// ── DB STATUS BADGE ───────────────────────────────────────────
function setDbBadge(state) {
  const dot = document.getElementById('db-dot');
  const lbl = document.getElementById('db-label');
  const map = {
    online:  { cls:'db-dot ok',      txt:'JSONBin ✅' },
    offline: { cls:'db-dot offline', txt:'Offline ⚠️' },
    local:   { cls:'db-dot local',   txt:'LocalStorage' },
    testing: { cls:'db-dot testing', txt:'Testing...' },
    error:   { cls:'db-dot error',   txt:'DB Error ❌' },
  };
  const s = map[state] || map.local;
  if (dot) { dot.className = s.cls; }
  if (lbl) { lbl.textContent = s.txt; }
}
async function updateDbStatus() {
  if (!USE_ONLINE_DB) { setDbBadge('local'); return; }
  const ok = await dbTestConnection();
  if (ok) {
    // Tarik data terbaru dari JSONBin setelah konfirmasi online
    await dbPullAll();
    toast('Database online terhubung ✅', 'ok', 'Data ditarik dari JSONBin.io');
  } else {
    toast('Gagal terhubung ke JSONBin', 'er', 'Menggunakan localStorage sebagai fallback');
  }
}

/* ============================================================
   SEED DATA
   Data awal untuk demo aplikasi
============================================================ */
function seed() {
  if (localStorage.getItem('et4_seeded_v5')) return;

  DB.set('users',[
    {id:'u1',name:'Admin EventTix',email:'admin@eventtix.com',password:'admin123',role:'admin',createdAt:new Date().toISOString()},
    {id:'u2',name:'Budi Santoso',  email:'budi@mail.com',    password:'user123', role:'user', createdAt:new Date().toISOString()},
    {id:'u3',name:'Sari Dewi',     email:'sari@mail.com',    password:'user123', role:'user', createdAt:new Date().toISOString()},
    {id:'u4',name:'Andi Pratama',  email:'andi@mail.com',    password:'user123', role:'user', createdAt:new Date().toISOString()},
  ]);

  DB.set('kategori_event',[
    {id:'c1',name:'Teknologi',     icon:'💻',color:'#6c63ff'},
    {id:'c2',name:'Musik & Hiburan',icon:'🎵',color:'#ff6b6b'},
    {id:'c3',name:'Olahraga',      icon:'⚽',color:'#00e676'},
    {id:'c4',name:'Seni & Budaya', icon:'🎨',color:'#ffab40'},
    {id:'c5',name:'Bisnis',        icon:'💼',color:'#40c4ff'},
    {id:'c6',name:'Edukasi',       icon:'📚',color:'#ea80fc'},
  ]);

  const d=n=>{const dd=new Date();dd.setDate(dd.getDate()+n);return dd.toISOString().slice(0,10);};
  DB.set('events',[
    {id:'e1',title:'Indonesia Tech Summit 2025',description:'Konferensi teknologi terbesar di Indonesia dengan 50+ speaker kelas dunia. Workshop, networking, dan pameran inovasi terkini.',categoryId:'c1',date:d(1), time:'09:00',location:'Jakarta Convention Center, Jakarta Pusat',capacity:500, price:350000,organizerId:'u1',icon:'💻',createdAt:new Date().toISOString()},
    {id:'e2',title:'Konser Nusantara Bersatu',  description:'Malam spektakuler bersama artis-artis top Indonesia. Rasakan energi konser langsung di stadion terbesar!',                categoryId:'c2',date:d(7), time:'19:00',location:'Gelora Bung Karno, Jakarta',             capacity:5000,price:250000,organizerId:'u1',icon:'🎵',createdAt:new Date().toISOString()},
    {id:'e3',title:'Marathon Kota Bandung 2025', description:'42km menyusuri keindahan kota Bandung. Full marathon, half marathon, dan fun run untuk semua kalangan.',                categoryId:'c3',date:d(30),time:'05:30',location:'Alun-Alun Bandung, Jawa Barat',            capacity:3000,price:150000,organizerId:'u1',icon:'🏃',createdAt:new Date().toISOString()},
    {id:'e4',title:'Workshop UI/UX Masterclass', description:'Pelajari prinsip desain modern. Sertifikat internasional dan portofolio siap kerja dalam 2 hari intensif.',             categoryId:'c1',date:d(7), time:'10:00',location:'Gedung Cyber, Jakarta Selatan',           capacity:80,  price:500000,organizerId:'u1',icon:'🎨',createdAt:new Date().toISOString()},
    {id:'e5',title:'Pameran Seni Kontemporer',   description:'100+ seniman lokal dan internasional. Instalasi interaktif dan live performance setiap hari.',                          categoryId:'c4',date:d(14),time:'10:00',location:'Museum MACAN, Jakarta Barat',             capacity:1000,price:75000, organizerId:'u1',icon:'🖼️',createdAt:new Date().toISOString()},
    {id:'e6',title:'Business Leaders Forum 2025',description:'Strategi bisnis dari CEO industri terkemuka. Sesi networking eksklusif dan pitching untuk startup.',                   categoryId:'c5',date:d(10),time:'08:00',location:'Hotel Mulia, Jakarta Selatan',            capacity:200, price:1500000,organizerId:'u1',icon:'💼',createdAt:new Date().toISOString()},
    {id:'e7',title:'Python & AI Workshop',       description:'Machine learning, deep learning, dan LLM dari nol. Instruktur berpengalaman dari industri dan akademik.',              categoryId:'c6',date:d(21),time:'09:00',location:'Universitas Indonesia, Depok',            capacity:120, price:300000,organizerId:'u1',icon:'🤖',createdAt:new Date().toISOString()},
    {id:'e8',title:'Festival Kuliner Nusantara', description:'Jelajahi cita rasa dari 34 provinsi Indonesia. 200+ stan makanan, demo masak chef berbintang, dan kompetisi kuliner.', categoryId:'c4',date:d(5), time:'10:00',location:'Lapangan Banteng, Jakarta Pusat',           capacity:8000,price:50000, organizerId:'u1',icon:'🍜',createdAt:new Date().toISOString()},
  ]);

  DB.set('tiket',[
    {id:'t1',eventId:'e1',userId:'u2',bookingCode:'TIX47839201',status:'active',   bookedAt:new Date().toISOString()},
    {id:'t2',eventId:'e2',userId:'u2',bookingCode:'TIX63921047',status:'active',   bookedAt:new Date().toISOString()},
    {id:'t3',eventId:'e4',userId:'u3',bookingCode:'TIX10293847',status:'active',   bookedAt:new Date().toISOString()},
    {id:'t4',eventId:'e1',userId:'u3',bookingCode:'TIX88291034',status:'used',     bookedAt:new Date(Date.now()-86400000*2).toISOString()},
    {id:'t5',eventId:'e3',userId:'u2',bookingCode:'TIX55618273',status:'cancelled',bookedAt:new Date(Date.now()-86400000).toISOString(),cancelledAt:new Date().toISOString()},
    {id:'t6',eventId:'e6',userId:'u4',bookingCode:'TIX99102837',status:'active',   bookedAt:new Date().toISOString()},
    {id:'t7',eventId:'e8',userId:'u2',bookingCode:'TIX22938471',status:'active',   bookedAt:new Date().toISOString()},
    {id:'t8',eventId:'e7',userId:'u3',bookingCode:'TIX76543210',status:'active',   bookedAt:new Date().toISOString()},
  ]);

  localStorage.setItem('et4_seeded_v5','1');
}

/* ============================================================
   FITUR 1 — AUTH: Login / Register / Logout
============================================================ */
function switchTab(t) {
  document.getElementById('tab-login').classList.toggle('on',t==='login');
  document.getElementById('tab-register').classList.toggle('on',t==='register');
  document.getElementById('f-login').style.display=t==='login'?'block':'none';
  document.getElementById('f-reg').style.display=t==='register'?'block':'none';
}

function doLogin() {
  const email=document.getElementById('l-email').value.trim();
  const pw=document.getElementById('l-pw').value;
  const user=DB.get('users').find(u=>u.email===email&&u.password===pw);
  if (!user) { toast('Login gagal','er','Email atau password salah'); return; }
  CU=user; LS.setSession(user); enterApp();
}

function doRegister() {
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim();
  const pw=document.getElementById('r-pw').value;
  const role=document.getElementById('r-role').value;
  if (!name||!email||!pw) { toast('Lengkapi semua field','wa'); return; }
  if (pw.length<6) { toast('Password min. 6 karakter','wa'); return; }
  const users=DB.get('users');
  if (users.find(u=>u.email===email)) { toast('Email sudah terdaftar','er'); return; }
  const nu={id:uid(),name,email,password:pw,role,createdAt:new Date().toISOString()};
  users.push(nu); DB.set('users',users);
  CU=nu; LS.setSession(nu);
  toast('Akun berhasil dibuat! Selamat datang 🎉','ok');
  enterApp();
}

function doLogout() {
  CU=null; LS.clearSession();
  document.getElementById('nav-admin').style.display='none';
  document.getElementById('nav-user').style.display='none';
  document.getElementById('v-app').classList.remove('active');
  document.getElementById('v-auth').classList.add('active');
  document.getElementById('v-auth').style.display='flex';
}

function enterApp() {
  document.getElementById('v-auth').classList.remove('active');
  document.getElementById('v-auth').style.display='none';
  document.getElementById('v-app').classList.add('active');
  document.getElementById('uav').textContent=CU.name[0].toUpperCase();
  document.getElementById('uname').textContent=CU.name;
  document.getElementById('urole').textContent=CU.role==='admin'?'Administrator':'Peserta';
  if (CU.role==='admin') {
    document.getElementById('nav-admin').style.display='flex';
    document.getElementById('nav-user').style.display='none';
    nav('dashboard');
  } else {
    document.getElementById('nav-admin').style.display='none';
    document.getElementById('nav-user').style.display='flex';
    nav('discover');
  }
}

function goHome() { CU ? (CU.role==='admin' ? nav('dashboard') : nav('discover')) : null; }

/* ============================================================
   NAVIGATION
============================================================ */
function nav(page) {
  document.querySelectorAll('[id^="s-"]').forEach(s=>s.style.display='none');
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  const sec=document.getElementById('s-'+page); if(sec) sec.style.display='block';
  const ni=document.getElementById('ni-'+page); if(ni) ni.classList.add('on');
  // also handle docs alias
  if(page==='docs'){ document.getElementById('ni-docs-u')?.classList.add('on'); document.getElementById('ni-docs')?.classList.add('on'); }
  const r={
    'dashboard':renderDash,
    'events':   ()=>{fillCats();renderAdmEvs();},
    'report':   ()=>{fillCats();renderReport();},
    'discover': ()=>{fillCats();renderUsrEvs();},
    'mytickets':renderMyTk,
    'docs':     renderDocs,
  };
  if(r[page]) r[page]();
}

/* ============================================================
   FILL CATEGORY SELECTS
============================================================ */
function fillCats() {
  const cats=DB.get('kategori_event');
  const opts=cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  ['adm-cat','usr-cat'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='<option value="">Semua Kategori</option>'+opts;});
  const ec=document.getElementById('ev-cat');if(ec)ec.innerHTML=opts;
  const rs=document.getElementById('rpt-ev');
  if(rs) rs.innerHTML='<option value="">— Pilih Event —</option>'+DB.get('events').map(e=>`<option value="${e.id}">${e.icon||''} ${e.title}</option>`).join('');
}

/* ============================================================
   ICON PICKER
============================================================ */
function renderIpk() {
  document.getElementById('ipk').innerHTML=ICONS.map(i=>
    `<div class="ipk-btn${i===selIcon?' on':''}" onclick="selIco('${i}',this)">${i}</div>`
  ).join('');
}
function selIco(i,el){selIcon=i;document.querySelectorAll('.ipk-btn').forEach(b=>b.classList.remove('on'));el.classList.add('on');}

/* ============================================================
   FITUR 2 — ADMIN DASHBOARD
   Statistik real-time: event, tiket, pengguna, pendapatan
============================================================ */
function renderDash() {
  const evs=DB.get('events'),tks=DB.get('tiket'),usrs=DB.get('users');
  const active=tks.filter(t=>t.status==='active').length;
  const cancelled=tks.filter(t=>t.status==='cancelled').length;
  const rev=tks.filter(t=>t.status==='active').reduce((s,t)=>{const e=getEv(t.eventId);return s+(e?+e.price:0);},0);

  document.getElementById('adm-stats').innerHTML=[
    {ico:'📅',val:evs.length,lbl:'Total Event'},
    {ico:'🎟️',val:active,lbl:'Tiket Aktif'},
    {ico:'👥',val:usrs.filter(u=>u.role==='user').length,lbl:'Pengguna'},
    {ico:'💰',val:rev?'Rp'+Math.round(rev/1000)+'K':'—',lbl:'Pendapatan'},
    {ico:'❌',val:cancelled,lbl:'Tiket Batal'},
    {ico:'🗂️',val:DB.get('kategori_event').length,lbl:'Kategori'},
  ].map(s=>`<div class="sc"><div class="sc-icon">${s.ico}</div><div class="sc-val">${s.val}</div><div class="sc-lbl">${s.lbl}</div></div>`).join('');

  const tb1=document.querySelector('#t-rev tbody');
  tb1.innerHTML=evs.slice(-6).reverse().map(e=>{const c=capInfo(e);return`<tr><td><strong style="font-size:12.5px;">${e.icon||'📌'} ${e.title}</strong></td><td style="font-size:12px;white-space:nowrap;">${fmtD(e.date)}</td><td style="font-size:12.5px;">${c.booked}/${e.capacity}</td><td>${c.full?'<span class="badge b-rm">Penuh</span>':'<span class="badge b-ok">Buka</span>'}</td></tr>`;}).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada event</td></tr>`;

  const tb2=document.querySelector('#t-rbk tbody');
  tb2.innerHTML=tks.slice(-6).reverse().map(t=>{const u=getUser(t.userId),e=getEv(t.eventId);return`<tr><td style="font-size:12.5px;">${u?u.name:'—'}</td><td style="font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e?e.title:'—'}</td><td><span style="font-family:monospace;font-size:11px;color:var(--accent-2)">${t.bookingCode}</span></td><td>${sbadge(t.status)}</td></tr>`;}).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-3)">Belum ada booking</td></tr>`;
}

/* ============================================================
   FITUR 3 — CRUD EVENT (Admin)
   Create, Read, Update, Delete event + validasi kapasitas
============================================================ */
function renderAdmEvs() {
  const q=(document.getElementById('adm-q')?.value||'').toLowerCase();
  const fc=document.getElementById('adm-cat')?.value||'';
  const evs=DB.get('events').filter(e=>{
    if(fc&&e.categoryId!==fc)return false;
    if(q&&!e.title.toLowerCase().includes(q)&&!e.location.toLowerCase().includes(q))return false;
    return true;
  });
  const tb=document.querySelector('#t-adev tbody');
  if(!evs.length){tb.innerHTML=`<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--text-3)">😕 Tidak ada event ditemukan</td></tr>`;return;}
  tb.innerHTML=evs.map(e=>{
    const cat=getCat(e.categoryId),cap=capInfo(e);
    return`<tr>
      <td><div style="display:flex;align-items:center;gap:9px;"><span style="font-size:20px;">${e.icon||'📌'}</span><strong style="font-size:13px;">${e.title}</strong></div></td>
      <td><span style="background:${cat.color}22;color:${cat.color};padding:2px 9px;border-radius:100px;font-size:10.5px;font-weight:700;">${cat.icon} ${cat.name}</span></td>
      <td style="white-space:nowrap;font-size:12px;">${fmtD(e.date)}<br/><span style="color:var(--text-3)">${e.time}</span></td>
      <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;">${e.location}</td>
      <td><div style="font-size:13px;font-weight:600;">${cap.booked}/${e.capacity}</div><div style="width:68px;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:${cap.pct}%;background:${cap.full?'var(--red)':'var(--accent)'};border-radius:2px;"></div></div></td>
      <td style="white-space:nowrap;font-size:12px;">${fmtP(e.price)}</td>
      <td style="font-weight:700;">${cap.booked}</td>
      <td><div style="display:flex;gap:5px;"><button class="btn btn-in btn-sm" onclick="viewPart('${e.id}')" title="Laporan Peserta">👥</button><button class="btn btn-sc btn-sm" onclick="openEvModal('${e.id}')" title="Edit Event">✏️</button><button class="btn btn-rm btn-sm" onclick="deleteEv('${e.id}')" title="Hapus Event">🗑️</button></div></td>
    </tr>`;
  }).join('');
}

function openEvModal(editId=null) {
  selIcon='💻';
  const cats=DB.get('kategori_event');
  document.getElementById('ev-cat').innerHTML=cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  renderIpk();
  if (editId) {
    const e=getEv(editId); if(!e)return;
    document.getElementById('mo-ev-title').textContent='✏️ Edit Event';
    document.getElementById('ev-id').value=e.id;
    document.getElementById('ev-title').value=e.title;
    document.getElementById('ev-desc').value=e.description||'';
    document.getElementById('ev-cat').value=e.categoryId;
    document.getElementById('ev-price').value=e.price||0;
    document.getElementById('ev-date').value=e.date;
    document.getElementById('ev-time').value=e.time;
    document.getElementById('ev-loc').value=e.location;
    document.getElementById('ev-cap').value=e.capacity;
    selIcon=e.icon||'💻'; renderIpk();
  } else {
    document.getElementById('mo-ev-title').textContent='➕ Buat Event Baru';
    document.getElementById('ev-id').value='';
    ['ev-title','ev-desc','ev-loc'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('ev-price').value='';
    document.getElementById('ev-cap').value='';
    document.getElementById('ev-date').value='';
    document.getElementById('ev-time').value='';
  }
  openMo('mo-ev');
}

function saveEv() {
  const title=document.getElementById('ev-title').value.trim();
  const catId=document.getElementById('ev-cat').value;
  const date=document.getElementById('ev-date').value;
  const time=document.getElementById('ev-time').value;
  const loc=document.getElementById('ev-loc').value.trim();
  const cap=parseInt(document.getElementById('ev-cap').value);
  const price=parseInt(document.getElementById('ev-price').value)||0;
  const desc=document.getElementById('ev-desc').value.trim();
  const editId=document.getElementById('ev-id').value;

  if(!title||!catId||!date||!time||!loc||!cap||cap<1){toast('Lengkapi semua field wajib (*)','wa');return;}

  let evs=DB.get('events');
  if (editId) {
    // FITUR 3 — Validasi kapasitas saat edit: tidak bisa kurang dari tiket terjual
    const sold=getTkByEv(editId).length;
    if(cap<sold){toast(`Kapasitas tidak bisa < ${sold} (tiket aktif)`, 'er');return;}
    evs=evs.map(e=>e.id===editId?{...e,title,categoryId:catId,date,time,location:loc,capacity:cap,price,description:desc,icon:selIcon}:e);
    toast('Event berhasil diperbarui ✨','ok');
  } else {
    evs.push({id:uid(),title,description:desc,categoryId:catId,date,time,location:loc,capacity:cap,price,icon:selIcon,organizerId:CU.id,createdAt:new Date().toISOString()});
    toast('Event berhasil dibuat! 🎉','ok');
  }
  DB.set('events',evs); closeMo('mo-ev'); renderAdmEvs(); fillCats();
}

function deleteEv(id) {
  const e=getEv(id); if(!e)return;
  const sold=getTkByEv(id).length;
  showConfirm(
    `Hapus event "${e.title}"?`,
    sold>0?`Event ini memiliki ${sold} tiket aktif. Semua tiket akan otomatis dibatalkan.`:'Event ini akan dihapus secara permanen dan tidak dapat dikembalikan.',
    ()=>{
      if(sold>0) DB.set('tiket',DB.get('tiket').map(t=>t.eventId===id&&t.status==='active'?{...t,status:'cancelled',cancelledAt:new Date().toISOString()}:t));
      DB.set('events',DB.get('events').filter(ev=>ev.id!==id));
      toast('Event dihapus','wa');
      renderAdmEvs(); fillCats();
    }
  );
}

/* ============================================================
   FITUR 4 — LAPORAN PESERTA (Admin)
   Statistik partisipasi + check-in toggle per event
============================================================ */
function renderReport() {
  const evId=document.getElementById('rpt-ev')?.value;
  const cont=document.getElementById('rpt-content');
  if(!evId){cont.innerHTML='<div class="empty"><div class="ei">📋</div><h3>Pilih Event</h3><p>Pilih event dari dropdown di atas untuk melihat laporan peserta.</p></div>';return;}
  const ev=getEv(evId); if(!ev)return;
  const tks=DB.get('tiket').filter(t=>t.eventId===evId);
  const active=tks.filter(t=>t.status==='active');
  const used=tks.filter(t=>t.status==='used');
  const cancelled=tks.filter(t=>t.status==='cancelled');
  const cat=getCat(ev.categoryId);
  const cap=capInfo(ev);

  cont.innerHTML=`
    <div class="rpt-hd">
      <div class="rpt-ico">${ev.icon||'📌'}</div>
      <div style="flex:1;">
        <span style="background:${cat.color}22;color:${cat.color};padding:3px 9px;border-radius:100px;font-size:10.5px;font-weight:700;">${cat.icon} ${cat.name}</span>
        <h2 style="font-size:21px;font-weight:800;margin:7px 0 5px;">${ev.title}</h2>
        <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--text-2);">
          <span>📅 ${fmtD(ev.date)}, ${ev.time}</span><span>📍 ${ev.location}</span><span>💰 ${fmtP(ev.price)}</span>
        </div>
        <div class="pbar" style="margin-top:11px;"><div class="pfill" style="width:${cap.pct}%"></div></div>
        <div style="font-size:11.5px;color:var(--text-3);margin-top:4px;">${cap.booked} dari ${ev.capacity} kursi terisi (${cap.pct}%)</div>
      </div>
    </div>
    <div class="stats" style="margin-bottom:20px;">
      <div class="sc"><div class="sc-icon">👥</div><div class="sc-val">${active.length}</div><div class="sc-lbl">Peserta Aktif</div></div>
      <div class="sc"><div class="sc-icon">☑️</div><div class="sc-val">${used.length}</div><div class="sc-lbl">Sudah Check-in</div></div>
      <div class="sc"><div class="sc-icon">❌</div><div class="sc-val">${cancelled.length}</div><div class="sc-lbl">Dibatalkan</div></div>
      <div class="sc"><div class="sc-icon">💰</div><div class="sc-val">${fmtP(active.length*ev.price)}</div><div class="sc-lbl">Est. Pendapatan</div></div>
      <div class="sc"><div class="sc-icon">📊</div><div class="sc-val">${cap.pct}%</div><div class="sc-lbl">Terisi</div></div>
    </div>
    <div class="card">
      <div class="card-hd"><h3>📋 Daftar Peserta</h3><span class="badge b-ac">${tks.length} tiket</span></div>
      <div class="tw"><table>
        <thead><tr><th>#</th><th>Peserta</th><th>Kode Tiket</th><th>Waktu Booking</th><th>Status</th><th>Check-in</th></tr></thead>
        <tbody>${tks.length?tks.map((t,i)=>{const u=getUser(t.userId);return`<tr>
          <td style="color:var(--text-3);font-size:12px;">${i+1}</td>
          <td><div style="display:flex;align-items:center;gap:9px;">
            <div style="width:29px;height:29px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-2));display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:700;">${u?u.name[0].toUpperCase():'?'}</div>
            <div><div style="font-size:13px;font-weight:600;">${u?u.name:'—'}</div><div style="font-size:11px;color:var(--text-3);">${u?u.email:'—'}</div></div>
          </div></td>
          <td><span style="font-family:monospace;font-size:11.5px;color:var(--accent-2);letter-spacing:.05em;">${t.bookingCode}</span></td>
          <td style="font-size:12px;">${fmtDT(t.bookedAt)}</td>
          <td>${sbadge(t.status)}</td>
          <td>${t.status!=='cancelled'?`<button class="ci-btn${t.status==='used'?' on':''}" onclick="toggleCI('${t.id}')" title="${t.status==='used'?'Batalkan check-in':'Tandai sudah check-in'}">${t.status==='used'?'✅':'⬜'}</button>`:'—'}</td>
        </tr>`;}).join(''):`<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text-3)">Belum ada peserta terdaftar</td></tr>`}</tbody>
      </table></div>
    </div>`;
}

function toggleCI(id) {
  DB.set('tiket',DB.get('tiket').map(t=>t.id===id?{...t,status:t.status==='used'?'active':'used'}:t));
  toast('Status check-in diperbarui','ok');
  renderReport();
}

function viewPart(id) {
  nav('report');
  setTimeout(()=>{const s=document.getElementById('rpt-ev');if(s){s.value=id;renderReport();}},120);
}

/* ============================================================
   FITUR 5 — PENCARIAN & FILTER EVENT (User)
   Filter berdasarkan kategori, waktu, dan ketersediaan
============================================================ */
function renderUsrEvs() {
  const q=(document.getElementById('usr-q')?.value||'').toLowerCase();
  const fc=document.getElementById('usr-cat')?.value||'';
  const fd=document.getElementById('usr-date')?.value||'';
  const fa=document.getElementById('usr-avl')?.value||'';

  let evs=DB.get('events').filter(e=>{
    if(fc&&e.categoryId!==fc)return false;
    if(q&&!e.title.toLowerCase().includes(q)&&!e.location.toLowerCase().includes(q)&&!(e.description||'').toLowerCase().includes(q))return false;
    if(fd){
      const evD=new Date(e.date),now=new Date(),sod=new Date(now.getFullYear(),now.getMonth(),now.getDate());
      if(fd==='today'){const end=new Date(sod);end.setDate(end.getDate()+1);if(evD<sod||evD>=end)return false;}
      else if(fd==='week'){const end=new Date(sod);end.setDate(end.getDate()+7);if(evD<sod||evD>=end)return false;}
      else if(fd==='month'){const end=new Date(sod);end.setDate(end.getDate()+30);if(evD<sod||evD>=end)return false;}
    }
    if(fa){const c=capInfo(e);if(fa==='available'&&c.full)return false;if(fa==='full'&&!c.full)return false;}
    return true;
  });

  const grid=document.getElementById('usr-ev-grid');
  if(!evs.length){grid.innerHTML=`<div class="empty" style="grid-column:1/-1;"><div class="ei">🔍</div><h3>Tidak Ada Event</h3><p>Coba ubah filter atau kata kunci pencarian.</p></div>`;return;}
  grid.innerHTML=evs.map(e=>{
    const cat=getCat(e.categoryId),cap=capInfo(e);
    const hv=DB.get('tiket').find(t=>t.eventId===e.id&&t.userId===CU.id&&t.status==='active');
    return`<div class="ev-card" onclick="showEvDet('${e.id}')">
      <div class="ev-banner" style="background:linear-gradient(135deg,${cat.color}33,${cat.color}11);">
        <span style="position:relative;z-index:1;">${e.icon||cat.icon}</span>
        ${hv?`<div class="ev-badge-booked">✅ Dipesan</div>`:''}
      </div>
      <div class="ev-body">
        <div class="ev-cat" style="background:${cat.color}22;color:${cat.color};">${cat.icon} ${cat.name}</div>
        <h3>${e.title}</h3>
        <div class="ev-meta">
          <div class="ev-mi">📅 ${fmtD(e.date)}, ${e.time}</div>
          <div class="ev-mi">📍 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.location}</span></div>
          <div class="ev-mi">💰 <strong style="color:${e.price?'var(--yellow)':'var(--green)'};">${fmtP(e.price)}</strong></div>
        </div>
        <div class="ev-foot">
          <div class="cap-bar"><div class="cap-track"><div class="cap-fill" style="width:${cap.pct}%;background:${capColor(cap.pct)};"></div></div><div class="cap-txt">${cap.full?'🚫 Penuh':`${cap.rem} kursi tersisa`}</div></div>
          <span class="badge ${cap.full?'b-rm':'b-ok'}">${cap.full?'Habis':'Tersedia'}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   FITUR 6 — BOOKING TIKET (User)
   Validasi kapasitas real-time + cek duplikat booking
============================================================ */
function showEvDet(id) {
  const e=getEv(id); if(!e)return;
  const cat=getCat(e.categoryId),cap=capInfo(e);
  const hv=DB.get('tiket').find(t=>t.eventId===e.id&&t.userId===CU.id&&t.status==='active');
  document.querySelectorAll('[id^="s-"]').forEach(s=>s.style.display='none');
  const sec=document.getElementById('s-evdet'); sec.style.display='block';
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('ni-discover')?.classList.add('on');

  sec.innerHTML=`
    <div>
      <button class="btn btn-sc btn-sm" onclick="nav('discover')" style="margin-bottom:18px;">← Kembali</button>
      <div class="ev-detail-banner" style="background:linear-gradient(135deg,${cat.color}33,${cat.color}11);">${e.icon||cat.icon}</div>
      <div class="det-grid">
        <div>
          <div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:13px;">
            <span class="badge b-ac">${cat.icon} ${cat.name}</span>
            ${cap.full?'<span class="badge b-rm">🚫 Tiket Habis</span>':'<span class="badge b-ok">✅ Tersedia</span>'}
            ${hv?'<span class="badge b-in">🎟️ Sudah Dipesan</span>':''}
          </div>
          <h1 style="font-size:24px;font-weight:900;margin-bottom:13px;">${e.title}</h1>
          <p style="color:var(--text-2);font-size:14px;line-height:1.75;margin-bottom:22px;">${e.description||'Tidak ada deskripsi.'}</p>
          <div class="divider"></div>
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--text-3);margin:14px 0 8px;">Informasi Event</p>
          <div class="det-row"><div class="det-ico">📅</div><div><strong>${fmtD(e.date)}</strong> — Pukul ${e.time} WIB</div></div>
          <div class="det-row"><div class="det-ico">📍</div><div>${e.location}</div></div>
          <div class="det-row"><div class="det-ico">💰</div><div><strong style="font-size:17px;color:${e.price?'var(--yellow)':'var(--green)'};">${fmtP(e.price)}</strong><span style="font-size:12px;color:var(--text-3);margin-left:6px;">per tiket</span></div></div>
          <div class="det-row"><div class="det-ico">👥</div><div><strong>${cap.booked}/${e.capacity}</strong> peserta — <span style="color:${cap.full?'var(--red)':'var(--text-3)'}">${cap.full?'Tiket habis':`${cap.rem} kursi tersisa`}</span></div></div>
          <div class="pbar" style="margin-top:10px;"><div class="pfill" style="width:${cap.pct}%;background:${capColor(cap.pct)};"></div></div>
        </div>
        <div>
          <div class="bk-box">
            <h3 style="font-size:17px;font-weight:800;margin-bottom:18px;">🎟️ Pesan Tiket</h3>
            ${hv?`<div style="padding:14px;background:rgba(64,196,255,.08);border:1px solid rgba(64,196,255,.2);border-radius:var(--r-md);margin-bottom:14px;font-size:13.5px;color:var(--blue);text-align:center;">✅ Anda sudah memiliki tiket aktif untuk event ini</div><button class="btn btn-sc btn-w" onclick="nav('mytickets')">Lihat Tiket Saya</button>`
            :cap.full?`<div style="padding:14px;background:rgba(255,82,82,.08);border:1px solid rgba(255,82,82,.2);border-radius:var(--r-md);font-size:13.5px;color:var(--red);text-align:center;">🚫 Tiket sudah habis</div>`
            :`<div style="display:flex;justify-content:space-between;margin-bottom:11px;font-size:13.5px;"><span style="color:var(--text-2)">Harga Tiket</span><strong style="color:${e.price?'var(--yellow)':'var(--green)'};">${fmtP(e.price)}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:18px;font-size:13.5px;"><span style="color:var(--text-2)">Tersedia</span><strong style="color:var(--green);">${cap.rem} kursi</strong></div>
              <div class="divider"></div>
              <button class="btn btn-pr btn-w btn-lg" onclick="openBookModal('${e.id}')">🎟️ Pesan Tiket</button>`}
          </div>
        </div>
      </div>
    </div>`;
}

function openBookModal(evId) {
  const e=getEv(evId); if(!e)return;
  const cap=capInfo(e);
  if(cap.full){toast('Maaf, tiket sudah habis','er');return;}
  bookingEvId=evId;
  const cat=getCat(e.categoryId);
  document.getElementById('book-body').innerHTML=`
    <div style="text-align:center;margin-bottom:22px;">
      <div style="font-size:50px;margin-bottom:11px;">${e.icon||'🎫'}</div>
      <h3 style="font-size:19px;font-weight:800;margin-bottom:7px;">${e.title}</h3>
      <span style="background:${cat.color}22;color:${cat.color};padding:4px 11px;border-radius:100px;font-size:11.5px;font-weight:700;">${cat.icon} ${cat.name}</span>
    </div>
    <div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:var(--r-md);padding:15px;margin-bottom:18px;">
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13.5px;"><span style="color:var(--text-2)">📅 Tanggal</span><strong>${fmtD(e.date)}, ${e.time}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13.5px;"><span style="color:var(--text-2)">📍 Lokasi</span><strong style="max-width:200px;text-align:right;font-size:12.5px;">${e.location}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13.5px;"><span style="color:var(--text-2)">🎟️ Sisa Tiket</span><strong style="color:var(--green);">${cap.rem} kursi</strong></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:15px;"><span style="color:var(--text-2)">💰 Total Bayar</span><strong style="color:${e.price?'var(--yellow)':'var(--green)'};font-size:19px;">${fmtP(e.price)}</strong></div>
    </div>
    <p style="font-size:11.5px;color:var(--text-3);text-align:center;">Dengan memesan, Anda menyetujui syarat &amp; ketentuan EventTix.</p>`;
  openMo('mo-book');
}

function confirmBook() {
  if(!bookingEvId)return;
  const e=getEv(bookingEvId); if(!e)return;
  // Validasi kapasitas real-time
  const cap=capInfo(e);
  if(cap.full){toast('Tiket baru saja habis!','er','Kapasitas sudah penuh');closeMo('mo-book');return;}
  // Cek duplikat
  const dup=DB.get('tiket').find(t=>t.eventId===bookingEvId&&t.userId===CU.id&&t.status==='active');
  if(dup){toast('Anda sudah memiliki tiket ini','wa');closeMo('mo-book');return;}
  // Buat tiket baru
  const tk={id:uid(),eventId:bookingEvId,userId:CU.id,bookingCode:code(),status:'active',bookedAt:new Date().toISOString()};
  const tks=DB.get('tiket'); tks.push(tk); DB.set('tiket',tks);
  closeMo('mo-book');
  toast('🎉 Tiket berhasil dipesan!','ok',`Kode: ${tk.bookingCode}`);
  setTimeout(()=>showTkDet(tk.id),550);
}

/* ============================================================
   FITUR 7 — RIWAYAT TIKET & PEMBATALAN (User)
   Daftar tiket dengan filter status + batalkan tiket
============================================================ */
function filterTk(el) {
  document.querySelectorAll('#tk-chips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  tkFilter=el.dataset.s;
  renderMyTk();
}

function renderMyTk() {
  const all=DB.get('tiket').filter(t=>t.userId===CU.id);
  const filtered=tkFilter==='all'?all:all.filter(t=>t.status===tkFilter);
  const cont=document.getElementById('tk-list');
  if(!filtered.length){
    cont.innerHTML=`<div class="empty"><div class="ei">🎟️</div><h3>Tidak Ada Tiket</h3><p>${tkFilter!=='all'?'Tidak ada tiket dengan status ini.':'Anda belum memiliki tiket.'}</p><button class="btn btn-pr mt-14" onclick="nav('discover')">Jelajahi Event</button></div>`;return;
  }
  cont.innerHTML=filtered.sort((a,b)=>new Date(b.bookedAt)-new Date(a.bookedAt)).map(t=>{
    const ev=getEv(t.eventId); if(!ev)return'';
    return`<div class="tk-card">
      <div class="tk-side ${t.status}"></div>
      <div class="tk-body">
        <div class="tk-qr">${qrGrid(t.bookingCode)}</div>
        <div class="tk-info">
          <div class="tk-ev-name">${ev.icon||'🎫'} ${ev.title}</div>
          <div class="tk-meta">
            <div class="tk-mi">📅 ${fmtD(ev.date)}</div>
            <div class="tk-mi">🕐 ${ev.time}</div>
            <div class="tk-mi">📍 ${ev.location.split(',')[0]}</div>
          </div>
          <div class="tk-code">${t.bookingCode}</div>
        </div>
        <div class="tk-actions">
          ${sbadge(t.status)}
          <button class="btn btn-sc btn-sm" onclick="showTkDet('${t.id}')">Lihat Detail</button>
          ${t.status==='active'?`<button class="btn btn-rm btn-sm" onclick="cancelTk('${t.id}',false)">Batalkan</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ============================================================
   FITUR 8 — QR CODE / KODE UNIK (Detail Tiket)
   Setiap tiket memiliki kode unik + visual QR deterministik
============================================================ */
function showTkDet(id) {
  const t=DB.get('tiket').find(tk=>tk.id===id); if(!t)return;
  const ev=getEv(t.eventId); if(!ev)return;
  const cat=getCat(ev.categoryId);
  document.querySelectorAll('[id^="s-"]').forEach(s=>s.style.display='none');
  const sec=document.getElementById('s-tkdet'); sec.style.display='block';
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('on'));
  document.getElementById('ni-mytickets')?.classList.add('on');

  sec.innerHTML=`
    <div style="max-width:540px;margin:0 auto;">
      <button class="btn btn-sc btn-sm" onclick="nav('mytickets')" style="margin-bottom:22px;">← Kembali ke Tiket Saya</button>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--r-xl);overflow:hidden;box-shadow:0 0 60px var(--glow);">
        <!-- Banner -->
        <div style="height:115px;background:linear-gradient(135deg,${cat.color}33,${cat.color}11);display:flex;align-items:center;justify-content:center;font-size:54px;position:relative;">
          ${ev.icon||cat.icon}
          <div style="position:absolute;top:14px;right:14px;">${sbadge(t.status)}</div>
        </div>
        <!-- Dashed divider -->
        <div style="position:relative;padding:0 18px;">
          <div style="border-top:2px dashed rgba(255,255,255,.1);"></div>
          <div style="position:absolute;left:-12px;width:28px;height:28px;background:var(--bg-primary);border-radius:50%;top:-14px;"></div>
          <div style="position:absolute;right:-12px;width:28px;height:28px;background:var(--bg-primary);border-radius:50%;top:-14px;"></div>
        </div>
        <div style="padding:26px;">
          <h2 style="font-size:21px;font-weight:900;margin-bottom:7px;">${ev.title}</h2>
          <span style="background:${cat.color}22;color:${cat.color};padding:3px 11px;border-radius:100px;font-size:11px;font-weight:700;">${cat.icon} ${cat.name}</span>
          <!-- Info Grid -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:20px 0;padding:16px;background:rgba(255,255,255,.03);border-radius:var(--r-md);">
            <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Tanggal</div><strong style="font-size:13.5px;">${fmtD(ev.date)}</strong></div>
            <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Waktu</div><strong style="font-size:13.5px;">${ev.time} WIB</strong></div>
            <div style="grid-column:1/-1;"><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Lokasi</div><strong style="font-size:13px;">${ev.location}</strong></div>
            <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Harga</div><strong style="color:${ev.price?'var(--yellow)':'var(--green)'};">${fmtP(ev.price)}</strong></div>
            <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;">Dipesan</div><span style="font-size:11.5px;">${fmtDT(t.bookedAt)}</span></div>
          </div>
          <!-- QR CODE -->
          <div style="text-align:center;margin-bottom:22px;">
            <div style="display:inline-block;background:white;padding:13px;border-radius:var(--r-md);box-shadow:0 10px 36px rgba(0,0,0,.35);">
              <div style="display:grid;grid-template-columns:repeat(8,1fr);gap:2px;width:124px;height:124px;">${qrGrid(t.bookingCode)}</div>
            </div>
            <div style="margin-top:14px;">
              <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;">Kode Tiket Unik</div>
              <div style="font-family:'Courier New',monospace;font-size:25px;font-weight:900;color:var(--accent-2);letter-spacing:.14em;">${t.bookingCode}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Tunjukkan kode ini saat check-in</div>
            </div>
          </div>
          <!-- Actions -->
          ${t.status==='active'?`<div style="display:flex;justify-content:center;"><button class="btn btn-rm" onclick="cancelTk('${t.id}',true)">❌ Batalkan Tiket Ini</button></div>`
          :t.status==='cancelled'?`<div style="text-align:center;padding:11px;background:rgba(255,82,82,.07);border:1px solid rgba(255,82,82,.2);border-radius:var(--r-md);"><span style="color:var(--red);font-size:12.5px;">Tiket dibatalkan pada ${fmtDT(t.cancelledAt)}</span></div>`
          :`<div style="text-align:center;padding:11px;background:rgba(64,196,255,.07);border:1px solid rgba(64,196,255,.2);border-radius:var(--r-md);"><span style="color:var(--blue);font-size:12.5px;">☑️ Tiket ini telah digunakan (sudah check-in)</span></div>`}
        </div>
      </div>
    </div>`;
}

function cancelTk(id,fromDet) {
  showConfirm('Batalkan Tiket?','Pembatalan tidak dapat diurungkan. Anda akan kehilangan akses ke event ini.',()=>{
    DB.set('tiket',DB.get('tiket').map(t=>t.id===id?{...t,status:'cancelled',cancelledAt:new Date().toISOString()}:t));
    toast('Tiket berhasil dibatalkan','wa');
    if(fromDet) nav('mytickets'); else renderMyTk();
  });
}

/* ============================================================
   DOKUMENTASI FITUR (untuk screenshot laporan)
============================================================ */
function renderDocs() {
  const feats = [
    {n:1,ico:'🔐',title:'Sistem Autentikasi (Auth)',tag:'FITUR UTAMA',tagColor:'var(--accent)',
     desc:'Login dan registrasi dengan dua role berbeda: Admin (Penyelenggara) dan User (Peserta). Sistem validasi password, cek duplikat email, sesi persisten menggunakan localStorage, dan logout aman.'},
    {n:2,ico:'📊',title:'Dashboard Admin',tag:'ADMIN',tagColor:'var(--blue)',
     desc:'Halaman ringkasan statistik real-time: total event, tiket aktif, jumlah pengguna, estimasi pendapatan, dan tabel event serta booking terbaru. Data diperbarui otomatis setiap kali ada perubahan.'},
    {n:3,ico:'🗓️',title:'Manajemen Event (CRUD)',tag:'ADMIN',tagColor:'var(--blue)',
     desc:'Create, Read, Update, Delete event lengkap. Form termasuk judul, deskripsi, kategori, harga, tanggal, waktu, lokasi, kapasitas, dan ikon. Validasi kapasitas saat edit: tidak bisa kurang dari tiket yang sudah terjual.'},
    {n:4,ico:'📋',title:'Laporan Peserta per Event',tag:'ADMIN',tagColor:'var(--blue)',
     desc:'Laporan detail per event: statistik peserta aktif, yang sudah check-in, yang dibatalkan, dan estimasi pendapatan. Tabel daftar peserta dengan fitur toggle check-in dan progress bar kapasitas.'},
    {n:5,ico:'🔍',title:'Pencarian & Filter Event',tag:'USER',tagColor:'var(--green)',
     desc:'Pencarian real-time berdasarkan nama, lokasi, dan deskripsi event. Filter berdasarkan kategori, rentang waktu (hari ini/minggu ini/bulan ini), dan ketersediaan (tersedia/penuh). Hasil diperbarui instan.'},
    {n:6,ico:'🎟️',title:'Booking Tiket',tag:'USER',tagColor:'var(--green)',
     desc:'Pemesanan tiket dengan validasi kapasitas real-time (race condition safe). Sistem mendeteksi dan mencegah duplikat booking. Konfirmasi modal sebelum pemesanan dengan ringkasan detail event dan total biaya.'},
    {n:7,ico:'📜',title:'Riwayat & Pembatalan Tiket',tag:'USER',tagColor:'var(--green)',
     desc:'Daftar semua tiket dengan filter status: Aktif, Digunakan (check-in), dan Dibatalkan. Setiap tiket menampilkan visual QR, kode unik, dan informasi event. Pembatalan dengan konfirmasi modal.'},
    {n:8,ico:'🔲',title:'QR Code & Kode Tiket Unik',tag:'OPSIONAL',tagColor:'var(--yellow)',
     desc:'Setiap tiket memiliki kode alphanumeric unik 11 karakter (format: TIX + 8 karakter acak). Visual QR deterministik dibuat dari hash kode tiket — setiap tiket menghasilkan pola QR yang berbeda dan konsisten.'},
  ];

  document.getElementById('docs-content').innerHTML=`
    <div class="feat-grid">
      ${feats.map(f=>`
        <div class="feat-card">
          <div class="feat-icon">${f.ico}</div>
          <h4>${f.title}</h4>
          <span class="feat-tag" style="background:${f.tagColor}22;color:${f.tagColor};">${f.tag}</span>
        </div>`).join('')}
    </div>
    ${CU && CU.role === 'admin' ? `
    <div style="margin-top:18px;background:rgba(64,196,255,.06);border:1px solid rgba(64,196,255,.2);border-radius:var(--r-lg);padding:20px;" id="db-debug-panel">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px;">
        <h4 style="font-size:14px;font-weight:700;color:var(--blue);">🔌 Panel Status Database</h4>
        <button class="btn btn-in btn-sm" onclick="testDbNow()">🔄 Test Koneksi Sekarang</button>
      </div>
      <div id="db-debug-result" style="background:rgba(0,0,0,.3);border-radius:var(--r-md);padding:14px;font-family:monospace;font-size:12px;line-height:1.8;color:var(--text-2);">
        Klik tombol "Test Koneksi Sekarang" untuk memeriksa status database...
      </div>
      <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;" id="db-live-stats"></div>
    </div>` : ''}
    `;
}

/* ============================================================
   MODAL HELPERS
============================================================ */
function openMo(id) { document.getElementById(id).classList.add('on'); }
function closeMo(id) { document.getElementById(id).classList.remove('on'); }
document.querySelectorAll('.mo').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('on');}));

function showConfirm(title,msg,cb) {
  document.getElementById('cf-title').textContent=title;
  document.getElementById('cf-msg').textContent=msg;
  document.getElementById('cf-btn').onclick=()=>{ cb(); closeMo('mo-confirm'); };
  openMo('mo-confirm');
}

// ── TEST KONEKSI DB (dipanggil dari docs page) ───────────────
async function testDbNow() {
  const result = document.getElementById('db-debug-result');
  const stats  = document.getElementById('db-live-stats');
  if (!result) return;

  result.style.color = 'var(--blue)';
  result.innerHTML = '⏳ Sedang menghubungi JSONBin.io...';

  const lines = [];
  lines.push(`📡 URL    : ${JSONBIN_API}/${JSONBIN_ID}`);
  lines.push(`🔑 API Key: ${JSONBIN_KEY.slice(0,20)}...`);
  lines.push(`🔄 Mode   : ${USE_ONLINE_DB ? 'Online (JSONBin)' : 'Offline (localStorage)'}`);
  lines.push('─'.repeat(50));

  if (!USE_ONLINE_DB) {
    lines.push('⚠️  USE_ONLINE_DB = false → tidak mencoba JSONBin');
    lines.push('💡 Ganti ke true di kode untuk mengaktifkan DB online');
    result.style.color = 'var(--yellow)';
    result.innerHTML = lines.join('<br/>');
    return;
  }

  try {
    const t0 = Date.now();
    const resp = await fetch(`${JSONBIN_API}/${JSONBIN_ID}`, {
      headers: { 'X-Master-Key': JSONBIN_KEY }
    });
    const ms = Date.now() - t0;
    lines.push(`⏱️  Latensi: ${ms}ms`);
    lines.push(`📶 HTTP Status: ${resp.status} ${resp.statusText}`);

    if (resp.ok) {
      const data = await resp.json();
      const rec  = data.record || {};
      DB_ONLINE = true;
      setDbBadge('online');

      lines.push('');
      lines.push('✅ KONEKSI BERHASIL! JSONBin online dan dapat diakses.');
      lines.push('');
      lines.push('📊 Data di JSONBin saat ini:');
      ['users','events','tiket','kategori_event'].forEach(k => {
        const count = Array.isArray(rec[k]) ? rec[k].length : 0;
        lines.push(`   • ${k}: ${count} record`);
      });

      result.style.color = 'var(--green)';

      // Tampilkan live stats
      if (stats) {
        stats.innerHTML = ['users','events','tiket','kategori_event'].map(k => {
          const icons = {users:'👤',events:'📅',tiket:'🎟️',kategori_event:'🏷️'};
          const count = Array.isArray(rec[k]) ? rec[k].length : 0;
          return `<div style="background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);border-radius:var(--r-md);padding:12px;text-align:center;">
            <div style="font-size:20px;">${icons[k]}</div>
            <div style="font-size:20px;font-weight:800;color:var(--green);">${count}</div>
            <div style="font-size:11px;color:var(--text-3);font-family:monospace;">${k}</div>
          </div>`;
        }).join('');
      }

      // Tarik data ke cache
      ['users','events','tiket','kategori_event'].forEach(k => {
        if (Array.isArray(rec[k]) && rec[k].length > 0) {
          DB._cache[k] = rec[k]; LS.set(k, rec[k]);
        }
      });

    } else {
      const errText = await resp.text();
      DB_ONLINE = false;
      setDbBadge('error');
      lines.push('');
      lines.push(`❌ KONEKSI GAGAL! Server merespons dengan error.`);
      lines.push(`📄 Pesan: ${errText}`);
      lines.push('');
      lines.push('🔧 Kemungkinan penyebab:');
      lines.push('   • API Key salah atau tidak valid');
      lines.push('   • Bin ID tidak ditemukan');
      lines.push('   • Bin tidak publik / akses ditolak');
      result.style.color = 'var(--red)';
      if (stats) stats.innerHTML = '';
    }
  } catch(e) {
    DB_ONLINE = false;
    setDbBadge('offline');
    lines.push('');
    lines.push(`❌ TIDAK BISA TERHUBUNG: ${e.message}`);
    lines.push('');
    lines.push('🔧 Kemungkinan penyebab:');
    lines.push('   • Tidak ada koneksi internet');
    lines.push('   • JSONBin.io sedang down');
    lines.push('   • CORS diblokir browser (jalankan lewat server, bukan file://)');
    result.style.color = 'var(--red)';
    if (stats) stats.innerHTML = '';
  }

  result.innerHTML = lines.join('<br/>');
}

/* ============================================================
   INIT — Bootstrapping Aplikasi
============================================================ */
(function init(){
  seed();
  updateDbStatus();
  const s=LS.session();
  if(s){CU=s;enterApp();}
  else {
    document.getElementById('v-auth').style.display='flex';
    document.getElementById('v-auth').classList.add('active');
  }
  // Hide loader
  setTimeout(()=>{
    const l=document.getElementById('loader');
    l.style.transition='opacity .4s';
    l.style.opacity='0';
    setTimeout(()=>l.remove(),450);
  },800);
})();
