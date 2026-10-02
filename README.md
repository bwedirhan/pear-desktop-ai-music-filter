<div align="center">

# 🎵 pear-desktop-ai-slop-filter

**Topluluk tarafından derlenen bir kara liste ve bunu kullanarak AI üretimi kanalları/şarkıları otomatik atlayan bir Pear Desktop eklentisi.**

[![Channels](https://img.shields.io/badge/channels-1277-blue?style=for-the-badge)](#-kara-liste)
[![Version](https://img.shields.io/badge/schema-v1-green?style=for-the-badge)](#-şema-version-1)
[![License](https://img.shields.io/badge/license-MIT%20%2B%20CC0--1.0-orange?style=for-the-badge)](#-lisans)
[![Status](https://img.shields.io/badge/status-draft-yellow?style=for-the-badge)](#-durum)

[🇹🇷 Türkçe](#-nasıl-çalışır) · [🐛 Issue Aç](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter/issues/new) · [⭐ Yıldız Ver](https://github.com/KULLANICI_ADI/pear-desktop-ai-slop-filter)

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
