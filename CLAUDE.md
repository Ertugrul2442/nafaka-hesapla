# Nafaka Hesapla — proje notları

Nafaka dosyalarında "her yıl TÜFE/ÜFE oranında artırılmasına" hükmünü otomatik
hesaplayan araç. Kullanıcı başlangıç tarihini ve tutarını giriyor; araç her yıl
dönümünde TÜİK oranını uygulayıp o dönemde ödenmesi gereken aylık nafakayı ve
dönem toplamlarını çıkarıyor.

## Durum (25.08.2026)

Çalışıyor. Veri çekildi, hesap motoru test edildi, arayüz tarayıcıda açılıyor.

## Dosyalar

| Dosya | Ne yapar |
|---|---|
| `tuik_api.py` | TÜİK açık ucuna istemci. JSON-stat küpünü düz listeye çevirir. |
| `veri_cek.py` | TÜFE + Yİ-ÜFE serilerini çeker, doğrular, `veri/` altına yazar. |
| `veri/endeksler.json` | İnsan okunur veri (78 KB). |
| `veri/endeksler.js` | Aynı veri, `window.ENDEKS_VERISI` olarak. HTML bunu kullanır. |
| `hesap.js` | Saf hesap motoru. DOM'a dokunmaz, node ile de çalışır. |
| `nafaka.html` | Arayüz. Çift tıklayınca açılır, sunucu gerekmez. |
| `test_hesap.js` | Motorun testleri (28 test). `node test_hesap.js` |
| `test_sayfa.js` | Sayfayı sahte DOM'da çalıştırıp çıktısını ölçer (15 test). `node test_sayfa.js` |

Veriyi tazelemek: `py -3.13 veri_cek.py`. TÜİK yeni ayı her ayın 3'ünde yayımlıyor.

## TÜİK verisi nereden geliyor — bunu bir daha araştırma

**Kullanılan uç (açık, anahtarsız, kayıtsız):**
`https://databrowser2.tuik.gov.tr/api/core`

- Katalog: `GET /nodes/1/catalog` — 423 veri seti
- Boyut kodları: `GET /nodes/1/datasets/{id}/columns/full/values`
- Veri: `POST /nodes/1/datasets/{id}/data`, gövde **JSON dizisi**:
  `[{"id":"REF_AREA","values":["TR"]}, ...]` (nesne gönderirsen 400 döner)

**Denenip elenen yollar — tekrar deneme:**
- `data.tuik.gov.tr` artık `veriportali.tuik.gov.tr`'ye yönleniyor, SPA, HTML kazınamıyor.
- TÜİK'in yeni SDMX ucu `nsiws.tuik.gov.tr/rest` **401 döner**, keycloak kullanıcı
  girişi ister (`giris.tuik.gov.tr`, client `veri-portali` public — service account yok).
- TCMB EVDS ücretsiz ama API anahtarı için kayıt gerektiriyor; gerek kalmadı.

**Kullanılan veri setleri:**
- TÜFE: `TR,DF_TUFE_SDMX_TT10,1.0` — kesit `COICOP_2018=0`, `SINIFLAMA_DUZEYI=TUFE`, `REF_AREA=TR`
- Yİ-ÜFE: `TR,DF_YIUFE_EDO_V1,1.0` — kesit `URUN_UFE_NACE_CPA=B-E36`, `FAAL_GRUP=_T`, `REF_AREA=TR`
  (`B-E36` = "Sanayi (inşaat ve atık yönetimi hariç)" = Yİ-ÜFE genel endeksi)

**DEGISIM boyutu** (`CL_DEGISIM`) — hangi oranı istediğini belirler:
- `1` = endeks
- `4` = yıllık değişim (geçen yılın aynı ayına göre)
- `5` = **on iki aylık ortalamalara göre değişim** ← nafakada kullanılan, varsayılan

## Tuzaklar (ölçülmüş, tahmin değil)

1. **Sunucu filtreyi tam uygulamıyor.** POST gövdesindeki `values` bazen yok
   sayılıyor; dönen küp istediğinden geniş olabiliyor. Bu yüzden `veri_cek.py`
   kesiti **kendisi seçiyor** (`KAYNAKLAR[...]["sec"]`). Filtreye güvenip
   doğrudan okuma.
2. **Yİ-ÜFE isteği ~36 MB dönüyor** (334 ürün × 6 grup). ~14 saniye sürüyor,
   normal. Daraltmaya çalıştım, sunucu dinlemiyor.
3. **Boş hücreler `""` olarak geliyor**, `float("")` patlıyor. `tuik_api.duzlestir`
   bunları atlıyor ve **kaç tane atladığını stderr'e yazıyor** — sessizce düşürmüyor.
4. **Endeksten 12 aylık ortalama hesaplama — baz yılı değişimlerinde yanlış çıkar.**
   Ölçüldü: 1990, 1996 ve 2006'da TÜİK'in yayınladığı oranla 4,4 puana kadar
   sapıyor, çünkü elimizdeki endeks serisi baz değişimlerinde birleştirilmiş.
   **Her zaman TÜİK'in yayınladığı `DEGISIM=5` değerini kullan**, endeksten
   hesaplama. (`veri_cek.py` içindeki `ort12_hesapla` yalnız doğrulama içindir;
   TÜFE'de 236 ayda en büyük fark 0,005 puan çıktı — veri doğru demek.)
5. **TÜFE bu API'de 2005-01'den başlıyor**, daha eskisi yok (TT01/02/09/10'un
   hepsi aynı). Yİ-ÜFE 1982-01'e gidiyor. Nafaka dosyaları için 2005 fazlasıyla
   yeterli ama kullanıcıya "tüm yıllar" derken bunu söyle.
6. **`file://` ile açılan HTML `fetch()` yapamaz** (CORS). Veri bu yüzden
   `.js` olarak da yazılıyor ve `<script src>` ile yükleniyor.

## Hesap kuralı

Yıl dönümünde uygulanacak oran, varsayılan olarak **yıl dönümünden bir önceki
ayın** oranı. Sebep: o ay, tamamlanmış son 12 ayı kapsıyor (Ocak yıl dönümü →
Aralık oranı → tam takvim yılı). Arayüzde "yıl dönümü ayının kendisi" seçeneği
de var, çünkü mahkeme kararlarının lafzı değişebiliyor.

Doğrulanmış örnek: Ocak 2022'de 1.000 ₺, TÜFE 12 aylık ortalama, önceki ay kuralı
→ 1.000 × 1,7231 × 1,5386 × 1,5851 × 1,3488 = **5.668,14 ₺** (2026 dönemi).

## Sıradaki işler (yapılmadı)

- Aylık tutar değil de birikmiş nafaka alacağı için faiz hesabı (yasal faiz)
  eklenebilir — kullanıcı istemedi, sorulmalı.
- Karar metninden tarih/tutar okuyup otomatik doldurma.
- Veriyi ayda bir kendiliğinden tazeleyen bir zamanlanmış görev.
