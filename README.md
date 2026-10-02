# pear-desktop-ai-slop-filter

Topluluk tarafından derlenen bir kara liste (`blacklist.json`) ve bunu kullanarak
AI üretimi kanalları/şarkıları otomatik atlayan bir Pear Desktop eklentisi.

> **Durum: taslak.** Eklenti Pear Desktop'un geliştirme modunda (`dev`) denendi ve
> `videoId` eşleşmesiyle parça atlama çalışıyor. Kanal (`channelId`) eşleşmesi,
> GitHub'dan gerçek indirme akışı ve paketlenmiş (production) sürüm henüz test edilmedi.

## Nasıl çalışır

- Kara liste bu repoda düz bir JSON dosyası olarak durur. Sunucu, API, veritabanı yok.
- Eklenti dosyayı `raw.githubusercontent.com` üzerinden indirir ve önbelleğe alır.
  Önbellek 24 saat geçerlidir; uygulama açık kaldıkça saatte bir önbelleğin süresine bakılır.
- Çalan parça `channelId` / `videoId` ile **cihazda** karşılaştırılır.
  Dinleme geçmişi hiçbir yere gönderilmez. Tek ağ isteği kara liste dosyasının kendisidir
  (GitHub bu istekte IP adresini ve User-Agent bilgisini görür).
- Eşleşirse `nextVideo()` ile atlanır. Kısa sürede çok fazla atlama olursa
  (örneğin kuyruğun tamamı listedeyse) eklenti kendini durdurur: 10 saniyede en fazla 5 atlama.
- İndirilen liste şema doğrulamasından geçmezse yok sayılır, son geçerli önbellek kullanılır.
- Kullanıcı kendi allow/block listesini eklenti yapılandırmasındaki `userAllow` /
  `userBlock` alanlarıyla tutabilir (henüz arayüz yok). Allow her zaman önceliklidir.

## Şema (`version: 1`)

```json
{
  "version": 1,
  "updated_at": "ISO-8601",
  "channels": { "UCxxxxxxxx": { "name": "...", "reason": "...", "added_at": "YYYY-MM-DD" } },
  "tracks":   { "videoId":    { "title": "...", "reason": "...", "added_at": "YYYY-MM-DD" } }
}
```

Anahtar olarak kanal ID'si birincil, videoId ikincil. İsim+sanatçı eşleştirmesi
bilinçli olarak yok (yanlış pozitif riski).

## Rapor ve itiraz

- **Bildirim:** Issues → "AI Slop Bildirimi". Bildirimler `unverified-report` etiketiyle gelir;
  maintainer doğrulayınca `blacklist.json`'a eklenir.
- **Kanıt şartı:** Kanıtsız veya tek başına "kulağa AI gibi geliyor" raporları eklenmez.
- **İtiraz:** Listedeki bir kayıt yanlış engelleme ise (örneğin gerçek bir sanatçı),
  kanal/şarkı bağlantısıyla bir issue açın. Kayıt incelenir ve gerekirse kaldırılır.

## Kurulum (geliştirici)

Pear Desktop eklentileri uygulamanın kaynak kodunun içinde derlenir:

1. `pear-devs/pear-desktop` reposunu fork'la / klonla.
2. Bu repodan `src/plugins/skip-ai-slop/index.ts` dosyasını al.
3. Pear Desktop checkout'unda `src/plugins/skip-ai-slop/index.ts` konumuna kopyala.
4. Kendi fork'undaki kara listeyi kullanacaksan `index.ts` içindeki `BLACKLIST_URL`
   değerini kendi reponla değiştir:

   ```ts
   const BLACKLIST_URL =
     'https://raw.githubusercontent.com/bwedirhan/pear-desktop-ai-slop-filter/main/blacklist.json';
   ```

5. Eklentiyi uygulamanın plugin listesine kaydet (diğer eklentilerin nasıl listelendiğine bak).
6. Uygulamayı geliştirme modunda başlat (Vite sunucusuyla birlikte, ör. `pnpm dev`) ve
   eklentiyi ayarlardan etkinleştir.

`index.ts` başındaki "STILL UNVERIFIED" listesi hâlâ doğrulanmamış varsayımları içerir.

## Lisans

- Kara liste verisi (`blacklist.json`): CC0-1.0
- Eklenti kodu: MIT

Not: Repo kökündeki `LICENSE` dosyası MIT'dir. Veri için CC0 geçerli olsun
isteniyorsa ayrı bir `LICENSE-DATA` dosyası eklenmelidir.
