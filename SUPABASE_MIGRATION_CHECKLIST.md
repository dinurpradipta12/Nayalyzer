# Supabase Migration Checklist

Checklist ini dipakai kalau Nayalyzer perlu pindah dari project Supabase lama ke project baru.

Project baru saat ini: `nulaokwrxczbysfvojni`

## Yang Harus Disiapkan

- Akses owner/admin ke Supabase project lama.
- Supabase project baru yang masih kosong.
- Database password project lama dan project baru.
- Project ref lama dan baru.
- `anon key` project baru untuk frontend.
- `service_role key` project baru untuk deploy Edge Functions dan server-side jobs. Jangan taruh key ini di frontend.
- Supabase CLI sudah login di mesin lokal.
- Daftar secret Edge Functions dari project lama:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_URL`
  - `IG_APP_ID`
  - `IG_APP_SECRET`
  - `THREADS_APP_ID`
  - `THREADS_APP_SECRET`
  - `TK_CLIENT_KEY`
  - `TK_CLIENT_SECRET`
  - `ENCRYPTION_KEY`
  - `AI_API_KEY` atau key AI lain yang dipakai
- Daftar OAuth redirect URI baru untuk Meta/Instagram/Threads/TikTok.
- Daftar bucket Storage dan file yang perlu dipindahkan.
- Waktu maintenance singkat agar data tidak berubah saat export/import.

## Urutan Migrasi Aman

1. Buat project Supabase baru.
2. Jalankan schema/migration dari repo ke project baru:
   ```bash
   supabase link --project-ref <PROJECT_REF_BARU>
   supabase db push
   ```
3. Untuk setup satu kali melalui SQL Editor, gunakan SQL gabungan terbaru:
   `supabase/NEW_PROJECT_SETUP.sql`.
   File ini mencakup schema, RLS, RPC, storage, tabel fitur terbaru, dan fungsi seed demo.
4. Export data dari project lama memakai Supabase CLI atau `pg_dump`.
5. Import data ke project baru.
6. Deploy Edge Functions ke project baru:
   ```bash
   supabase functions deploy platform-oauth --project-ref <PROJECT_REF_BARU>
   supabase functions deploy platform-sync --project-ref <PROJECT_REF_BARU>
   supabase functions deploy profile-analyzer --project-ref <PROJECT_REF_BARU>
   supabase functions deploy competitor-lookup --project-ref <PROJECT_REF_BARU>
   supabase functions deploy generate-ai-hypothesis --project-ref <PROJECT_REF_BARU>
   ```
7. Set ulang semua secrets Edge Functions di project baru:
   ```bash
   supabase secrets set KEY=value --project-ref <PROJECT_REF_BARU>
   ```
8. Pindahkan Storage buckets dan objects jika ada file upload.
9. Update env frontend:
   ```env
   VITE_SUPABASE_URL=https://nulaokwrxczbysfvojni.supabase.co
   VITE_SUPABASE_ANON_KEY=<ANON_KEY_BARU>
   VITE_DISABLE_APP_LOGIN=true
   ```
10. Update env Cloudflare Pages dengan URL/key project baru.
11. Update OAuth redirect URI di Meta/TikTok developer dashboard:
   ```text
   https://<PROJECT_REF_BARU>.supabase.co/functions/v1/platform-oauth/callback
   https://nayalyzer.pages.dev/oauth-complete
   https://nayalyzerapp.site/oauth-complete
   ```
12. Test halaman penting:
   - Dashboard
   - Analyser
   - Account Analytics
   - Connected Accounts
   - Settings
   - Team
   - Competitor Intelligence

## Catatan Penting

- Mode app sekarang tidak perlu login karena `VITE_DISABLE_APP_LOGIN` default aktif.
- Kalau nanti ingin login Supabase Auth aktif lagi, set:
  ```env
  VITE_DISABLE_APP_LOGIN=false
  ```
- Jika login dimatikan, fitur yang bergantung ke RLS `auth.uid()` tidak bisa memakai akses user asli. Untuk produksi tanpa login, data workspace sebaiknya dipindah ke API/Edge Function yang memakai service role dan validasi workspace sendiri.
- OAuth akun sosial hanya bisa dipakai setelah Supabase Auth diaktifkan kembali dan secret Edge Function sudah diatur.
