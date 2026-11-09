# Tek Stüdyo

Girişli, tek sayfalık video stüdyosu: kurgu, seslendirme, görsel üretimi, video ve ücretsiz AI araç panosu.
Kurulum gerektirmez; saf HTML/CSS/JS olarak çalışır, erişim kapısı ve AI köprüsü tek bir Cloudflare
Worker'ında (`worker.js`) durur.

## Ekran görüntüleri

| Giriş kapısı | Kurgu |
| --- | --- |
| ![Giriş](docs/giris.png) | ![Kurgu](docs/kurgu.png) |

## Modüller

- **Kurgu** — video/fotoğraf yükle, sırala, klip kes (başlangıç-bitiş), yazı ekle, müzik/seslendirme
  yerleştir; 9:16 / 1:1 / 16:9 oranlarında gerçek zamanlı dışa aktarım (`.webm`).
- **Seslendirme** — metni Türkçe sese çevirir, MP3 indirir veya doğrudan kurguya ses olarak ekler.
  Ayrıca tarayıcının kendi konuşma motoruyla ücretsiz önizleme.
- **Görsel** — prompt + stil ile görsel üretimi, geçmiş, indirme ve tek tıkla kurguya ekleme.
- **Video** — fotoğraflardan hareketli video (yakınlaş/kaydır) üretir; ücretsiz video araçlarını listeler.
- **Araçlar** — 18 ücretsiz AI aracı tek panoda: promptu kopyala, aracı yeni sekmede aç.

## Erişim (sadece davetli kullanıcılar)

Erişim, sunucu tarafındaki Worker kapısıyla kontrol edilir:

- `INVITE_CODES` = `kod=İsim` çiftleri, virgülle: `ORNEK1=Ada, ORNEK2=Mert`
- `SESSION_SECRET` = uzun rastgele bir metin
- Giriş kodu doğruysa HMAC ile imzalı, 7 gün geçerli `HttpOnly` çerez verilir.
- Oturum yoksa uygulama HTML'i değil, yalnızca giriş sayfası sunulur.

Bu iki değer **Sites → Secrets** içine girilir; kodda saklanmaz.

## Yerel geliştirme

```bash
powershell -ExecutionPolicy Bypass -File serve.ps1
```

`http://localhost:8080/` adresinde açılır. Worker olmadığı için oturum katmanı "geliştirme modu"na
düşer (kapı devre dışı) ve AI çağrıları doğrudan ücretsiz uç noktalara gider.

## AI sağlayıcıları ve yedekler

- **Seslendirme:** `POLLINATIONS_KEY` varsa Pollinations sesi kullanılır; yoksa Worker otomatik olarak
  Google Translate TTS'e düşer (anahtarsız; metin 180 karakterlik parçalara bölünür ve MP3 kareleri
  birleştirilir).
- **Görsel:** istek `referrer` parametresi ve tarayıcı başlıklarıyla gider; Worker anonim kotaya takılırsa
  uygulama tarayıcıdan doğrudan `image.pollinations.ai` uç noktasını dener (CORS açık).
- `POLLINATIONS_KEY` eklenince iki modül de tek sağlayıcı üzerinden daha yüksek kotayla çalışır.

## Dosyalar

| Dosya | İşi |
| --- | --- |
| `index.html` | Panel, kurgu, ses, görsel, video ve araç ekranları |
| `styles.css` | Koyu tema, kurgu yerleşimi |
| `js/api.js` | Oturum + seslendirme/görsel çağrıları (sunucu varsa köprü üzerinden) |
| `js/editor.js` | Kurgu motoru: zaman çizelgesi, canvas önizleme, dışa aktarma |
| `js/app.js` | Yönlendirme ve modül arayüzleri |
| `worker.js` | Erişim kapısı + AI köprüsü (Cloudflare Worker) |
| `serve.ps1` | Python/Node gerektirmeyen yerel sunucu |

## Dışa aktarma notu

Kayıt `.webm` (VP9/Opus) olarak yapılır; Chrome/Android ve masaüstünde oynar. iOS Safari `.webm`
oynatmaz — iPhone için MP4 gerekir, bu ayrı bir kodlama adımı ister.

## Ayrı uygulama

Bu stüdyodan bağımsız **Makyaj Stüdyosu** oyunu kendi klasöründe durur: [`makyaj/`](makyaj/README.md).
Stüdyo sitesine dahil değildir.
