# Nafaka Hesapla — proje notları

Nafaka dosyalarında "her yıl TÜFE/ÜFE oranında artırılmasına" hükmünü hesaplayan
web aracı. Ertuğrul kendisi kullanmıyor — **başkalarına veriyor**, o yüzden
gözetimsiz çalışması ve kendini güncellemesi şart.

**Yayında:** https://ertugrul2442.github.io/nafaka-hesapla/
**Depo:** https://github.com/Ertugrul2442/nafaka-hesapla (herkese açık)
**Claude artifact kopyası:** https://claude.ai/code/artifact/43dcbd79-3369-4582-b346-e7e72b5c398b

## Durum (25.08.2026)

Çalışıyor ve uçtan uca kanıtlandı. Veri TÜİK'ten çekiliyor, sayfa kuruluyor,
GitHub Pages yayınlıyor, aylık otomatik güncelleme iki yolda da prova edildi.

**Maliyet: 0 TL.** Sunucu yok, veritabanı yok, Supabase yok. Sayfa tamamen
istemci tarafında çalışıyor; tek "arka uç" ayda bir çalışan GitHub Actions işi.

## Mimari — neden böyle

Uygulamanın veritabanı, üyeliği, kullanıcı verisi yok. Ortada bir HTML sayfası
ve 78 KB'lık bir veri dosyası var; bütün hesap ziyaretçinin tarayıcısında dönüyor.
Bu yüzden:

- **Supabase elendi:** saklayacak bir şey yok, üstelik bedava planı boş kalınca
  projeyi uykuya alıyor.
- **Oracle sunucuları elendi:** borsa-sunucu-2'de yalnız 22. port açık, ~300 MB
  boş RAM var, alan adı olmadan HTTPS kurulamıyor (kullanıcılara "güvenli değil"
  uyarısı çıkardı).
- **GitHub Pages seçildi:** bedava, HTTPS hazır, CDN'de, bakım yok.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `tuik_api.py` | TÜİK açık ucuna istemci. JSON-stat küpünü düz listeye çevirir. |
| `veri_cek.py` | TÜFE + Yİ-ÜFE serilerini çeker, **güvenlik kontrollerinden geçirir**, `veri/endeksler.json`'a yazar. |
| `hesap.js` | Saf hesap motoru. DOM'a dokunmaz, node ile de çalışır. |
| `sablon.html` | Sayfanın kaynağı (CSS + HTML + arayüz betiği, veri yer tutucusuyla). |
| `site_yap.py` | Şablon + veri + `hesap.js` → `docs/index.html` ve `nafaka_artifact.html`. |
| `docs/index.html` | **Üretilen dosya, elle düzenleme.** GitHub Pages bunu yayınlıyor. |
| `.github/workflows/veri-guncelle.yml` | Aylık otomatik güncelleme. |
| `test_hesap.js` | Hesap motoru (28 test) — `node test_hesap.js` |
| `test_site.js` | Yayına giden sayfa (30 test) — `node test_site.js [dosya]` |
| `test_veri.py` | Veri güvenlik kontrolleri (15 test) — `py -3.13 test_veri.py` |

`test_site.js` argüman alabiliyor: canlı sayfayı indirip `node test_site.js canli.html`
ile sınayabilirsin.

## Klasör adı neden `docs`

GitHub Pages dal yayınında **yalnız kök ya da `/docs`** klasörünü sunabiliyor,
başka isim kabul etmiyor. `site/` denendi, olmadı. Actions ile yayın yapmak
istenirse başka isim mümkün ama o yol daha çok hareketli parça demek —
bilerek seçilmedi.

## TÜİK verisi nereden geliyor — bunu bir daha araştırma

**Kullanılan uç (açık, anahtarsız, kayıtsız):**
`https://databrowser2.tuik.gov.tr/api/core`

- Katalog: `GET /nodes/1/catalog` — 423 veri seti
- Boyut kodları: `GET /nodes/1/datasets/{id}/columns/full/values`
- Veri: `POST /nodes/1/datasets/{id}/data`, gövde **JSON dizisi**:
  `[{"id":"REF_AREA","values":["TR"]}, ...]` (nesne gönderirsen 400 döner)

**Denenip elenen yollar — tekrar deneme:**
- `data.tuik.gov.tr` artık `veriportali.tuik.gov.tr`'ye yönleniyor, SPA, kazınamıyor.
- Yeni SDMX ucu `nsiws.tuik.gov.tr/rest` **401 döner**, keycloak kullanıcı girişi
  ister (`giris.tuik.gov.tr`, client `veri-portali` public — service account yok).
- TCMB EVDS ücretsiz ama API anahtarı için kayıt gerektiriyor; gerek kalmadı.

**Kullanılan veri setleri:**
- TÜFE: `TR,DF_TUFE_SDMX_TT10,1.0` — kesit `COICOP_2018=0`, `SINIFLAMA_DUZEYI=TUFE`, `REF_AREA=TR`
- Yİ-ÜFE: `TR,DF_YIUFE_EDO_V1,1.0` — kesit `URUN_UFE_NACE_CPA=B-E36`, `FAAL_GRUP=_T`, `REF_AREA=TR`
  (`B-E36` = "Sanayi (inşaat ve atık yönetimi hariç)" = Yİ-ÜFE genel endeksi)

**DEGISIM boyutu** (`CL_DEGISIM`):
- `1` = endeks · `4` = yıllık değişim · `5` = **on iki aylık ortalamalara göre değişim** ← varsayılan

## Otomatik güncelleme nasıl çalışıyor

`.github/workflows/veri-guncelle.yml`, ayın **3-8'i arası günde iki kez**
(11:00 ve 16:00 TR) çalışıyor. TÜİK yeni ayı 3'ünde saat 10:00'da yayımlıyor;
gecikirse kaçırmamak için aralık geniş tutuldu.

`veri_cek.py` çıkış koduna göre dallanıyor:
- **0** → yeni veri var: sayfa kurulur, testler koşar, **testler geçerse** commit'lenip
  yayına gider. Test düşerse yayına çıkmaz.
- **3** → veri aynı: hiçbir şey yapılmaz, boş commit atılmaz.
- **1** → çekme/doğrulama başarısız: iş akışı düşer, GitHub Ertuğrul'a **e-posta atar**,
  eski veri olduğu gibi yayında kalır.

Elle çalıştırmak: GitHub → Actions → "TÜİK verisini güncelle" → Run workflow.
Ya da `gh workflow run veri-guncelle.yml --ref main`.

## Tuzaklar (ölçülmüş, tahmin değil)

1. **Sunucu filtreyi tam uygulamıyor.** POST gövdesindeki `values` bazen yok
   sayılıyor; dönen küp istediğinden geniş olabiliyor. `veri_cek.py` kesiti
   **kendisi seçiyor** (`KAYNAKLAR[...]["sec"]`). Filtreye güvenip doğrudan okuma.
2. **Yİ-ÜFE isteği ~36 MB dönüyor** (334 ürün × 6 grup), ~14 saniye. Normal.
   Daraltmaya çalıştım, sunucu dinlemiyor.
3. **Boş hücreler `""` olarak geliyor**, `float("")` patlıyor. `tuik_api.duzlestir`
   bunları atlıyor ve **kaç tane atladığını stderr'e yazıyor** — sessizce düşürmüyor.
4. **Endeksten 12 aylık ortalama hesaplama — baz yılı değişimlerinde yanlış çıkar.**
   Ölçüldü: 1990, 1996 ve 2006'da TÜİK'in yayınladığı orandan 4,4 puana kadar
   sapıyor, çünkü elimizdeki endeks serisi baz değişimlerinde birleştirilmiş.
   **Her zaman TÜİK'in yayınladığı `DEGISIM=5` değerini kullan.**
   (`ort12_hesapla` yalnız çapraz kontrol içindir; TÜFE'de 236 ayda en büyük fark
   0,005 puan çıktı — veri doğru demek.)
5. **TÜFE bu API'de 2005-01'den başlıyor**, daha eskisi yok (TT01/02/09/10 hepsi aynı).
   Yİ-ÜFE 1982-01'e gidiyor.
6. **Windows'ta CRLF, GitHub Actions'taki bash betiğini bozuyor**
   (`$'\r': command not found`). `.gitattributes` ile `* text=auto eol=lf` konuldu.
7. **Kilitlenme tuzağı — yaşandı ve düzeltildi.** `test_veri.py` içinde "depodaki
   veri bayat değil" diye bir *iddia* vardı ve veri çekilmeden önce kapı olarak
   çalışıyordu. Veri bayatladığında — yani iş akışının düzeltmesi gereken durumda —
   test düşüyor, iş akışı çekmeye başlamadan duruyor, bayatlık asla düzelmiyordu.
   Artık orada yalnız **bilgi** basılıyor; bayatlık alarmı doğru yerde,
   `veri_cek.py`'nin "değişmedi" yolunda, çekim yapıldıktan sonra çalıyor.
8. **Zamanlanmış iş akışları, herkese açık depolarda 60 gün commit olmazsa
   kapatılıyor.** Veri aylık geldiği için commit de aylık düşüyor, sınıra
   ulaşılmıyor. Yine de TÜİK aylarca yayımlamazsa bu risk var — bayatlık
   kontrolü o durumda iş akışını düşürüp e-posta attırıyor.

## Hesap kuralı

Yıl dönümünde uygulanacak oran, varsayılan olarak **yıl dönümünden bir önceki
ayın** oranı. Sebep: o ay, tamamlanmış son 12 ayı kapsıyor (Ocak yıl dönümü →
Aralık oranı → tam takvim yılı). Arayüzde "yıl dönümü ayının kendisi" seçeneği
de var, çünkü mahkeme kararlarının lafzı değişebiliyor.

Doğrulanmış örnek: Ocak 2022'de 1.000 ₺, TÜFE 12 aylık ortalama, önceki ay kuralı
→ 1.000 × 1,7231 × 1,5386 × 1,5851 × 1,3488 = **5.668,14 ₺** (2026 dönemi).

## Sıradaki işler (yapılmadı, sorulmalı)

- Birikmiş nafaka alacağı için yasal faiz hesabı.
- Karar metninden tarih/tutar okuyup formu otomatik doldurma.
- Kendi alan adı (yılda 10-15 dolar) — kullanıcı şimdilik istemedi.
- Kullanım sayacı / analitik yok; kaç kişi kullanıyor bilinmiyor.
