# Nayalyzer — Panduan Setup Supabase

## 1. Buat Project Supabase

1. Buka https://supabase.com → **New Project**
2. Pilih organisasi → isi nama project: `nayalyzer`
3. Set database password (simpan!)
4. Pilih region: **Southeast Asia (Singapore)**
5. Klik **Create new project** → tunggu ~2 menit

---

## 2. Konfigurasi Auth

1. **Authentication → Providers**
   - Pastikan **Email** provider aktif
   - Set **Confirm email**: OFF untuk development, ON untuk production

2. **Authentication → URL Configuration**
   - Site URL: `http://localhost:5173`
   - Redirect URLs: tambahkan `http://localhost:5173/**`

---

## 3. Jalankan SQL Migrations

Buka **SQL Editor** di Supabase dashboard, jalankan file berikut secara berurutan:

### Step 1 — Schema
Paste dan jalankan isi file: `supabase/migrations/001_schema.sql`

### Step 2 — RLS & Helper Functions
Paste dan jalankan isi file: `supabase/migrations/002_rls.sql`

### Step 3 — Seed Data (opsional)
Paste dan jalankan isi file: `supabase/migrations/003_seed.sql`

Seed data tidak langsung mengisi data — ia mendefinisikan fungsi `seed_workspace()`.
Setelah login dan buat workspace, jalankan:
```sql
SELECT public.seed_workspace('<workspace-id-dari-dashboard>');
```

---

## 4. Ambil API Keys

1. **Settings → API**
2. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon / public key** → `VITE_SUPABASE_ANON_KEY`

---

## 5. Setup Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 6. Jalankan App

```bash
npm install
npm run dev
```

Buka `http://localhost:5173`

---

## 7. Flow Pertama Kali

1. **Klik "Daftar gratis"** → masukkan email & password
2. Cek email → klik link konfirmasi (jika email confirm aktif)
3. Login → redirect ke **Create Workspace**
4. Isi nama workspace → klik "Buat Workspace"
5. Dashboard tampil dengan data dummy
6. Untuk mengisi data real: jalankan `seed_workspace()` di SQL Editor

---

## 8. Invite Anggota Tim

1. Buka **Team Members** di sidebar
2. Klik **"Undang Anggota"**
3. Masukkan email & pilih role
4. Anggota menerima undangan (token tersimpan di DB)
5. Accept invitation: `SELECT accept_invitation('<token>');`

   Atau bisa juga buat halaman `/invite?token=xxx` di frontend yang memanggil:
   ```js
   await supabase.rpc('accept_invitation', { p_token: token })
   ```

---

## 9. Role Permissions

| Aksi | Owner | Admin | Analyst | Viewer |
|------|-------|-------|---------|--------|
| Lihat semua data | ✓ | ✓ | ✓ | ✓ |
| Kelola social accounts | ✓ | ✓ | ✗ | ✗ |
| Tambah/edit konten | ✓ | ✓ | ✓ | ✗ |
| Buat hipotesa & laporan | ✓ | ✓ | ✓ | ✗ |
| Hapus data | ✓ | ✓ | ✗ | ✗ |
| Undang anggota | ✓ | ✓ | ✗ | ✗ |
| Ubah role anggota | ✓ | ✗ | ✗ | ✗ |
| Hapus workspace | ✓ | ✗ | ✗ | ✗ |

---

## 10. Mode Demo (tanpa Supabase)

Jika `.env.local` tidak ada atau kosong, app berjalan dalam **Mode Demo**:
- Login dengan email/password apa saja
- Semua data dari `src/data/mockData.js`
- Perubahan tidak tersimpan ke server
- Label "Mode Demo" muncul di header
- Berguna untuk development & demo ke klien

---

## Troubleshooting

**Error: "infinite recursion detected in policy"**
→ Pastikan helper functions (`is_workspace_member`, `get_workspace_role`) sudah dibuat dengan `SECURITY DEFINER` sebelum policies. Jalankan ulang `002_rls.sql`.

**Error: "new row violates row-level security policy"**
→ User tidak punya role yang cukup. Cek function `has_workspace_role()` dan pastikan user sudah terdaftar di `workspace_members` dengan status `active`.

**Email confirmation tidak sampai**
→ Cek spam folder. Atau nonaktifkan email confirmation di Supabase Dashboard → Authentication → Providers → Email → Confirm email: OFF.
