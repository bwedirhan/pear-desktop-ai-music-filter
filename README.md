# pear-desktop-ai-slop-filter

Topluluk tarafından derlenen bir kara liste (`blacklist.json`) ve bunu kullanarak
AI üretimi kanalları/şarkıları otomatik atlayan bir Pear Desktop eklentisi taslağı.

## Nasıl çalışır
- Kara liste bu repoda düz bir JSON dosyası olarak durur. Sunucu, API, veritabanı yok.
- Eklenti dosyayı günde en fazla bir kez `raw.githubusercontent.com` üzerinden indirir ve önbelleğe alır.
- Çalan parça `channelId` / `videoId` ile **cihazda** karşılaştırılır. Dinleme geçmişi hiçbir yere gönderilmez.
  (Tek ağ isteği: kara liste dosyasının kendisi.)
- Eşleşirse `nextVideo()` ile atlanır. Kullanıcı kendi allow/block listesini tutabilir; allow her zaman önceliklidir.

## Şema (`version: 1`)
```json
{
  "version": 1,
  "updated_at": "ISO-8601",
  "channels": { "UCxxxxxxxx": { "name": "...", "reason": "...", "added_at": "YYYY-MM-DD" } },
  "tracks":   { "videoId":    { "title": "...", "reason": "...", "added_at": "YYYY-MM-DD" } }
}
```
Anahtar olarak kanal ID'si birincil, videoId ikincil. İsim+sanatçı eşleştirmesi bilinçli olarak yok (yanlış pozitif riski).

## Rapor
Issues → "AI Slop Bildirimi". Bildirimler `unverified-report` etiketiyle gelir; maintainer doğrulayınca `blacklist.json`'a eklenir.
Kanıtsız veya tek başına "kulağa AI gibi geliyor" raporları eklenmemeli: kara liste yanlışlıkla gerçek bir sanatçıyı engelleyebilir, geri alma süreci (issue açıp kaldırma) baştan tanımlanmalı.

## Kurulum (geliştirici)
Pear Desktop eklentileri uygulamanın kaynak kodunun içinde derlenir:
1. `pear-devs/pear-desktop` reposunu fork'la / klonla.
2. Bu repodan `src/plugins/skip-ai-slop/index.ts` dosyasını al.
3. Pear Desktop checkout'unda `src/plugins/skip-ai-slop/index.ts` konumuna kopyala.
4. Eğer kendi fork'undan kara liste kullanacaksan: `index.ts` içindeki `BLACKLIST_URL` değerini kendi repon adınla değiştir.

```typescript
const BLACKLIST_URL =
  'https://raw.githubusercontent.com/bwedirhan/pear-desktop-ai-slop-filter/main/blacklist.json';
```

5. Eklentiyi uygulamanın plugin listesine kaydet (diğer eklentilerin nasıl listelendiğine bak) ve derle.

Not: Eklenti kodu uygulamayla çalıştırılarak test edilmedi; `index.ts` başındaki "UNVERIFIED" listesine bak.

## Lisans
Kara liste verisi: CC0-1.0. Eklenti kodu: Pear Desktop ile uyumlu olması için MIT önerilir.
