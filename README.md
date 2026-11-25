# Şehir Fethetme Oyunu — GitHub Pages + Cloudflare Workers

Bu repo, **GitHub Pages (Frontend)** ve **Cloudflare Workers + Durable Objects (Backend)** mimarisi için derinlemesine optimize edilmiş yeni sürümdür.

## Kota Optimizasyonları (50+ Aktif Oyuncu / Ücretsiz Plan)
1. **Tek Kalıcı WebSocket + Hibernation API**: Her oyuncu bağlandığında yalnızca **1 HTTP isteği** harcar. Polling (sürekli HTTP sorgusu) tamamen kaldırıldı.
2. **Sadece Delta (Değişiklik) Gönderimi**: Piksel fethedildiğinde bütün harita değil, yalnızca değişen `(x, y)` koordinatları `450ms` gruplanıp tek pakette gönderilir.
3. **Periyodik Tam Harita Snapshot İptali**: Eski sistemdeki 45 saniyede bir tam harita gönderimi ve fetih sonrası 2 saniyelik tam harita gönderimi kaldırıldı. Sunucu (Durable Object SQLite) tek otoritedir.
4. **Sıfır Maliyetli Keep-Alive (`ping`/`pong`)**: Cloudflare `setWebSocketAutoResponse` sayesinde bağlantı canlı tutma mesajları Durable Object'i uyandırmaz (**0 istek**).
5. **Değişiklik Kontrollü (Dirty-Check) İstatistik Senkronizasyonu**: Asker/altın/nüfus değişmediyse veya sekme arka plandaysa (`document.hidden`) sunucuya hiç paket gönderilmez.
6. **Bayrak Tekilleştirme**: Bayrak görselleri yalnızca ülke kurulumunda/bayrak değişiminde gönderilir, sohbet mesajlarında tekrar gönderilmez.

## Kurulum & Yayınlama

### 1. Cloudflare Worker'ı Yayınla (Backend)
```bash
cd worker
npm install
npx wrangler login
npx wrangler deploy
```
Yayınlandığında sana verilen URL'yi kopyala (örnek: `https://sehirfethetmeoyunu-worker.kullanici.workers.dev`).

### 2. GitHub Pages'e Worker URL'sini Bağla (Frontend)
1. GitHub repoda **Settings → Secrets and variables → Actions → Variables** sekmesine git.
2. **New repository variable** butonuna bas:
   - Name: `VITE_WORKER_WS_URL`
   - Value: `wss://sehirfethetmeoyunu-worker.kullanici.workers.dev`
3. **Settings → Pages → Source** kısmından **GitHub Actions** seç.
4. **Actions** sekmesinden `GitHub Pages Yayinla` iş akışını çalıştır (veya yeni commit at).
