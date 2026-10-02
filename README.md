<div align="center">

# 🎵 pear-desktop-ai-slop-filter

**Topluluk tarafından derlenen bir kara liste ve bunu kullanarak AI üretimi kanalları/şarkıları otomatik atlayan bir Pear Desktop eklentisi.**

**A community-curated blacklist that automatically skips AI-generated channels/tracks in Pear Desktop.**

[![Channels](https://img.shields.io/badge/channels-4107-blue?style=for-the-badge)](#-şema-version-1)
[![Version](https://img.shields.io/badge/schema-v2-green?style=for-the-badge)](#-şema-version-2)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20CC0--1.0-orange?style=for-the-badge)](#-lisans)
[![Status](https://img.shields.io/badge/status-draft-yellow?style=for-the-badge)](#-durum)

[🇹🇷 Türkçe](#-türkçe) · [🇬🇧 English](#-english) · [🐛 Issue](https://github.com/bwedirhan/pear-desktop-ai-slop-filter/issues/new) · [⭐ Star](https://github.com/bwedirhan/pear-desktop-ai-slop-filter)

![Michei69](https://raw.githubusercontent.com/bwedirhan/pear-desktop-ai-slop-filter/main/assets/x4.png)
</div>

---

# 🇹🇷 Türkçe

> [!WARNING]
> **Durum: Geliştirme.** Eklenti Pear Desktop'un geliştirme modunda (`dev`) denendi.
> `videoId` ve `channelId` eşleşmesiyle parça ve kanal atlama çalışıyor.
> GitHub'dan gerçek indirme akışı da başarıyla test edildi ve çalışıyor.
> Paketlenmiş (production) sürüm henüz test edilmedi.

## 📖 İçindekiler

- [Nasıl çalışır](#-nasıl-çalışır)
- [Şema (version: 1)](#-şema-version-1)
- [Rapor ve itiraz](#-rapor-ve-itiraz)
- [Kurulum (geliştirici)](#-kurulum-geliştirici)
- [Bilinen sınırlamalar](#-bilinen-sınırlamalar)
- [Lisans](#-lisans)

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

### 🔄 Akış

**1.** Şarkı çalmaya başlar
**2.** Eklenti `channelId` ve `videoId` bilgisini okur
**3.** Cache'teki kara listeyle karşılaştırır
**4.** Eşleşme varsa → **atla** · Eşleşme yoksa → **normal çal**

```
   ▶ Şarkı çalıyor
        │
        ▼
   ┌─────────────┐     yok      ┌──────────────┐
   │  Cache var? │ ───────────► │ GitHub'dan   │
   └──────┬──────┘              │ indir + cache│
          │ var                 └──────┬───────┘
          │                            │
          ▼                            │
   ┌─────────────┐                     │
   │  Eşleşme?   │ ◄───────────────────┘
   └──────┬──────┘
          │
     ┌────┴────┐
     │         │
    var       yok
     │         │
     ▼         ▼
  ⏭ Atla    ▶ Çal
```

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

## ⚠️ Bilinen sınırlamalar

| Sınırlama | Durum |
|---|---|
| Arama sonuçları filtrelenmez (yalnızca çalma anında devreye girer) | 🚧 Yol haritasında |
| Kanal ID'si olmayan kayıtlar eklenemez | ⛔ Bilinçli tasarım |
| Yanlış pozitif riski (özellikle `anonymous` marker'lı kayıtlar) | ⚠️ Dikkat |
| Önbellek 24 saat — GitHub push'ları hemen yansımaz | ⚠️ Bilinçli tasarım |
| Skip limiti: 10 saniyede max 5 atlama | ✅ Güvenlik freni |
| YouTube Music DOM değişiklikleri eklentiyi kırabilir | ⚠️ Genel risk |

## 📜 Lisans

- **Kara liste verisi** (`blacklist.json`): [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Eklenti kodu**: [MIT](https://opensource.org/licenses/MIT)

> [!NOTE]
> Repo kökündeki `LICENSE` dosyası MIT'dir. Veri için CC0 geçerli olsun
> isteniyorsa ayrı bir `LICENSE-DATA` dosyası eklenmelidir.

---

# 🇬🇧 English

> [!WARNING]
> **Status: Development.** The plugin has been tested in Pear Desktop's development mode (`dev`).
> Track and channel skipping via `videoId` and `channelId` matching works.
> The real download flow from GitHub has also been successfully tested and works.
> The packaged (production) build has not been tested yet.

## 📖 Table of Contents

- [How it works](#-how-it-works)
- [Schema (version: 1)](#-schema-version-1)
- [Reporting and appeals](#-reporting-and-appeals)
- [Installation (developer)](#-installation-developer)
- [Known limitations](#-known-limitations)
- [License](#-license)

## ⚙️ How it works

- The blacklist lives in this repo as a **plain JSON file**. No server, no API, no database.
- The plugin downloads the file from `raw.githubusercontent.com` and caches it.
  **The cache is valid for 24 hours**; while the app stays open, the cache age is checked hourly.
- The playing track is matched against `channelId` / `videoId` **on-device**.
  **Listening history is never sent anywhere.** The only network request is for the blacklist file itself
  (GitHub sees your IP address and User-Agent in that request).
- On a match, the plugin calls `nextVideo()` to skip. If too many skips happen in a short window
  (e.g. the entire queue is listed), the plugin throttles itself: **max 5 skips per 10 seconds**.
- If the downloaded list fails schema validation, it is ignored and the **last valid cache** is used.
- Users can maintain their own allow/block list via the `userAllow` / `userBlock` fields
  in the plugin config (no UI yet). **Allow always takes priority.**

### 🔄 Flow

**1.** A track starts playing
**2.** The plugin reads `channelId` and `videoId`
**3.** Compares against the cached blacklist
**4.** Match → **skip** · No match → **play normally**

```
   ▶ Track playing
        │
        ▼
   ┌─────────────┐    no cache   ┌──────────────┐
   │  Cache hit? │ ────────────► │ Download from│
   └──────┬──────┘               │ GitHub+cache │
          │ yes                  └──────┬───────┘
          │                             │
          ▼                             │
   ┌─────────────┐                      │
   │   Match?    │ ◄────────────────────┘
   └──────┬──────┘
          │
     ┌────┴────┐
     │         │
    yes        no
     │         │
     ▼         ▼
  ⏭ Skip    ▶ Play
```

## 📋 Schema (`version: 1`)

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

| Field | Required | Description |
|---|---|---|
| `version` | ✅ | Schema version (currently `1`) |
| `updated_at` | ✅ | Last update timestamp (ISO-8601) |
| `channels` | ✅ | Channel IDs starting with `UC...` (primary) |
| `tracks` | ✅ | Video IDs (secondary) |
| `name` / `title` | ✅ | Display name |
| `reason` | ✅ | Reason for blocking |
| `added_at` | ✅ | Date added to the list (`YYYY-MM-DD`) |

**Channel ID is the primary key; videoId is secondary.**
Name+artist matching is intentionally **not** used (false positive risk).

## 🚨 Reporting and appeals

### Reporting

1. Go to the **Issues** tab
2. Use the **"AI Slop Report"** template
3. Reports are tagged with `unverified-report`
4. Once verified by a maintainer, the entry is added to `blacklist.json`

> [!IMPORTANT]
> **Evidence required:** Reports without evidence, or based solely on "it sounds AI",
> are **not accepted**.

### Appeals

If an entry is a **false positive** (e.g. a real artist):

1. Open an **Issue** with the channel/track link
2. The entry is reviewed and **removed** if necessary

## 🛠️ Installation (developer)

Pear Desktop plugins are compiled inside the app's source code:

### 1. Clone the repo

```bash
git clone https://github.com/pear-devs/pear-desktop
cd pear-desktop
pnpm install --frozen-lockfile
```

### 2. Copy the plugin file

Grab `src/plugins/skip-ai-slop/index.ts` from this repo and place it at the same path in your Pear Desktop checkout:

```
pear-desktop/
└── src/
    └── plugins/
        └── skip-ai-slop/
            └── index.ts
```

### 3. Set the blacklist URL

Change the `BLACKLIST_URL` value in `index.ts` to point to your own repo:

```ts
const BLACKLIST_URL =
  'https://raw.githubusercontent.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/main/blacklist.json';
```

> [!NOTE]
> The repo must be **public**. Raw URLs of private repos require authentication, and the plugin cannot do that.

### 4. Register the plugin

Register the plugin in the app's plugin list (check how other plugins are registered).

### 5. Run in dev mode

```bash
pnpm dev
```

It launches together with the Vite dev server. Enable the plugin under **Settings ▸ Plugins**.

> [!CAUTION]
> The **"STILL UNVERIFIED"** list at the top of `index.ts` still contains unverified assumptions.

## ⚠️ Known limitations

| Limitation | Status |
|---|---|
| Search results are not filtered (only active during playback) | 🚧 Roadmap |
| Entries without a channel ID cannot be added | ⛔ By design |
| False positive risk (especially `anonymous`-marked entries) | ⚠️ Caution |
| 24-hour cache — GitHub pushes are not reflected immediately | ⚠️ By design |
| Skip limit: max 5 skips per 10 seconds | ✅ Safety brake |
| YouTube Music DOM changes may break the plugin | ⚠️ General risk |

## 📜 License

- **Blacklist data** (`blacklist.json`): [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/)
- **Plugin code**: [MIT](https://opensource.org/licenses/MIT)

> [!NOTE]
> The `LICENSE` file at the repo root is MIT. If you want CC0 to apply to the data,
> a separate `LICENSE-DATA` file should be added.

---

<div align="center">

**[⬆ Back to top](#-pear-desktop-ai-slop-filter)**

[🇹🇷 Türkçe](#-türkçe) · [🇬🇧 English](#-english)

[Issue](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/issues/new) · [PR](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/compare) · [Discussions](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/discussions)

</div>
