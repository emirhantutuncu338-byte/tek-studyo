# Makyaj Stüdyosu

Tek Stüdyo'dan **bağımsız** küçük bir oyun: 12 karakter seç, cilt / göz / dudak / stil sekmelerinden
makyaj yap, rastgele kombinasyon dene ve sonucu 1200×1560 PNG olarak kaydet.

Kurulum, derleme ve sunucu gerekmez — tek klasör, saf HTML/CSS/JS.

## Açmak

- `makyaj/index.html` dosyasına çift tıkla, veya
- proje kökünde `powershell -ExecutionPolicy Bypass -File serve.ps1` çalıştırıp
  `http://<bilgisayarın-ip-adresi>:8080/makyaj/` adresini telefonda aç.

## Dosyalar

| Dosya | İşi |
| --- | --- |
| `index.html` | Karakter seçimi ve makyaj paneli |
| `styles.css` | Arayüz teması |
| `js/characters.js` | Karakterler ve makyaj paletleri |
| `js/face.js` | Yüz ve makyaj çizim motoru (canvas 2D) |
| `js/game.js` | Oyun akışı, rastgele kombinasyon, PNG kaydetme |
| `manifest.webmanifest`, `sw.js`, `icon.svg` | Telefona ekleme (PWA) desteği |
