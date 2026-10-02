<div align="center">

# 🎵 pear-desktop-ai-slop-filter

**Topluluk tarafından derlenen bir kara liste ve bunu kullanarak AI üretimi kanalları/şarkıları otomatik atlayan bir Pear Desktop eklentisi.**

[![Channels](https://img.shields.io/badge/channels-1277-blue?style=for-the-badge)](#-şema-version-1)
[![Version](https://img.shields.io/badge/schema-v1-green?style=for-the-badge)](#-şema-version-1)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20CC0--1.0-orange?style=for-the-badge)](#-lisans)
[![Status](https://img.shields.io/badge/status-draft-yellow?style=for-the-badge)](#-durum)

[🐛 Issue Aç](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/issues/new) · [⭐ Yıldız Ver](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter)

</div>

---

> [!WARNING]
> **Durum: taslak.** Eklenti Pear Desktop'un geliştirme modunda (`dev`) denendi ve
> `videoId` eşleşmesiyle parça atlama çalışıyor. Kanal (`channelId`) eşleşmesi,
> GitHub'dan gerçek indirme akışı ve paketlenmiş (production) sürüm henüz test edilmedi.

---

## 📖 İçindekiler

- [Nasıl çalışır](#-nasıl-çalışır)
- [Şema (version: 1)](#-şema-version-1)
- [Rapor ve itiraz](#-rapor-ve-itiraz)
- [Kurulum (geliştirici)](#-kurulum-geliştirici)
- [Bilinen sınırlamalar](#-bilinen-sınırlamalar)
- [Lisans](#-lisans)

---

## ⚙️ Nasıl çalışır

- Kara liste bu repoda **düz bir JSON dosyası** olarak durur. Sunucu, API, veritabanı yok.
- Eklenti dosyayı `raw.githubusercontent.com` üzerinden indirir ve önbelleğe alır.
  **Önbellek 24 saat** geçerlidir; uygulama açık kaldıkça saatte bir önbelleğin süresine bakılır.
- Çalan parça `channelId` / `videoId` ile **cihazda** karşılaştırılır.
  **Dinleme geçmişi hiçbir yere gönderilmez.** Tek ağ isteği kara liste dosyasının kendisidir
  (GitHub bu istekte IP adresini ve User-Agent bilgisini görür).
- Eşleşirse `nextVideo()` ile atlanır. Kısa sürede çok fazla atlama olursa
  (örneğin kuyruğun tamamı listedeyse) eklenti kendini durdurur: **10 saniyede en fazla 5 atlama**.
- İndirilen liste şema doğrulamasından geçmezse yok sayılır, **son geçerli önbellek** kullanılır.
- Kullanıcı kendi allow/block listesini eklenti yapılandırmasındaki `userAllow` /
  `userBlock` alanlarıyla tutabilir (henüz arayüz yok). **Allow her zaman önceliklidir.**

### 🔄 Akış Diyagramı

```
┌─────────────────────┐
│  YouTube Music'te   │
│   şarkı çalıyor     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐        ┌──────────────────────┐
│  Cache'te kara      │──yok──►│  GitHub'dan indir    │
│  liste var mı?      │        │  (raw.githubusercontent)│
└──────────┬──────────┘        └──────────┬───────────┘
           │ var                          │
           │                              ▼
           │                   ┌──────────────────────┐
           │                   │  Şema doğrulaması    │
           │                   │  başarılı mı?        │
           │                   └──────────┬───────────┘
           │                              │
           │                              ▼
           ▼                              │
┌─────────────────────┐                   │
│  channelId/videoId  │◄──────────────────┘
│  eşleşiyor mu?      │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │ evet      │ hayır
     ▼           ▼
┌─────────┐  ┌─────────┐
│nextVideo│  │ normal  │
│  ()     │  │  çal    │
└─────────┘  └─────────┘
```

---

## 📋 Şema (`version: 1`)

```json
{
  "version": 1,
  "updated_at": "ISO-8601",
  "channels": {
    "UCxxxxxxxx": {
      "name": "...",
      "reason": "...",
      "added_at": "YYYY-MM-DD"
    }
  },
  "tracks": {
    "videoId": {
      "title": "...",
      "reason": "...",
      "added_at": "YYYY-MM-DD"
    }
  }
}
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `version` | ✅ | Şema sürümü (şu an `1`) |
| `updated_at` | ✅ | Son güncelleme tarihi (ISO-8601) |
| `channels` | ✅ | `UC...` ile başlayan kanal ID'leri (birincil) |
| `tracks` | ✅ | Video ID'leri (ikincil) |
| `name` / `title` | ✅ | Görüntülenecek isim |
| `reason` | ✅ | Engelleme gerekçesi |
| `added_at` | ✅ | Listeye eklenme tarihi (`YYYY-MM-DD`) |

**Anahtar olarak kanal ID'si birincil, videoId ikincil.**
İsim+sanatçı eşleştirmesi bilinçli olarak **yok** (yanlış pozitif riski).

---

## 🚨 Rapor ve itiraz

### Bildirim

1. **Issues** sekmesine gidin
2. **"AI Slop Bildirimi"** şablonunu kullanın
3. Bildirimler `unverified-report` etiketiyle gelir
4. Bir maintainer doğrulayınca `blacklist.json`'a eklenir

> [!IMPORTANT]
> **Kanıt şartı:** Kanıtsız veya tek başına "kulağa AI gibi geliyor" raporları **eklenmez**.

### İtiraz

Listedeki bir kayıt **yanlış engelleme** ise (örneğin gerçek bir sanatçı):

1. Kanal/şarkı bağlantısıyla bir **Issue** açın
2. Kayıt incelenir ve gerekirse **kaldırılır**

---

## 🛠️ Kurulum (geliştirici)

Pear Desktop eklentileri uygulamanın kaynak kodunun içinde derlenir:

### 1. Repo'yu klonlayın

```bash
git clone https://github.com/pear-devs/pear-desktop
cd pear-desktop
pnpm install --frozen-lockfile
```

### 2. Eklenti dosyasını kopyalayın

Bu repodan `src/plugins/skip-ai-slop/index.ts` dosyasını alın ve Pear Desktop checkout'unda aynı konuma kopyalayın:

```
pear-desktop/
└── src/
    └── plugins/
        └── skip-ai-slop/
            └── index.ts
```

### 3. Kara liste URL'ini ayarlayın

`index.ts` içindeki `BLACKLIST_URL` değerini kendi reponuzla değiştirin:

```ts
const BLACKLIST_URL =
  'https://raw.githubusercontent.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/main/blacklist.json';
```

> [!NOTE]
> Repo **public** olmalı. Private repo'lardaki raw URL'ler kimlik doğrulama gerektirir ve eklenti bunu yapamaz.

### 4. Eklentiyi kaydedin

Eklentiyi uygulamanın plugin listesine kaydedin (diğer eklentilerin nasıl listelendiğine bakın).

### 5. Geliştirme modunda başlatın

```bash
pnpm dev
```

Vite sunucusuyla birlikte açılır. Eklentiyi **Ayarlar ▸ Eklentiler** yolundan etkinleştirin.

> [!CAUTION]
> `index.ts` başındaki **"STILL UNVERIFIED"** listesi hâlâ doğrulanmamış varsayımları içerir.

---

## ⚠️ Bilinen sınırlamalar

| Sınırlama | Durum |
|---|---|
| Arama sonuçları filtrelenmez (yalnızca çalma anında devreye girer) | 🚧 Yol haritasında |
| Kanal ID'si olmayan kayıtlar eklenemez | ⛔ Bilinçli tasarım |
| Yanlış pozitif riski (özellikle `anonymous` marker'lı kayıtlar) | ⚠️ Dikkat |
| Önbellek 24 saat — GitHub push'ları hemen yansımaz | ⚠️ Bilinçli tasarım |
| Skip limiti: 10 saniyede max 5 atlama | ✅ Güvenlik freni |
| YouTube Music DOM değişiklikleri eklentiyi kırabilir | ⚠️ Genel risk |

---

## 📜 Lisans

- **Kara liste verisi** (`blacklist.json`): [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Eklenti kodu**: [MIT](https://opensource.org/licenses/MIT)

> [!NOTE]
> Repo kökündeki `LICENSE` dosyası MIT'dir. Veri için CC0 geçerli olsun
> isteniyorsa ayrı bir `LICENSE-DATA` dosyası eklenmelidir.

---

<div align="center">

**[⬆ Başa Dön](#-pear-desktop-ai-slop-filter)**

[Issue Aç](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/issues/new) · [PR Gönder](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/compare) · [Tartışma](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/discussions)

</div>
