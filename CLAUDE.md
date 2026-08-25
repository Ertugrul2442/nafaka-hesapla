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
| `site_yap.py` | Şablon + veri + `hesap.js` → `docs/index.html`, `docs/veri.json` ve `nafaka_artifact.html`. |
| `docs/index.html` | **Üretilen dosya, elle düzenleme.** GitHub Pages bunu yayınlıyor. |
| `oran_ekle.py` | Bir ayın oranını veri dosyasına elle ekler — **herkese ulaşsın diye**. Otomatik çekim tökezlerse kurtarma aracı. |
| `.github/workflows/veri-guncelle.yml` | Aylık otomatik güncelleme. |
| `test_hesap.js` | Hesap motoru (56 test) — `node test_hesap.js` |
| `test_site.js` | Yayına giden sayfa (105 test) — `node test_site.js [dosya]` |
| `test_veri.py` | Veri güvenlik kontrolleri (21 test) — `py -3.13 test_veri.py` |
| `kontrol.html` | Bağlantı teşhis sayfası. Bilerek **hiçbir dış kaynağı yok** (yazı tipi dahil) — ölçtüğü şey zaten dış erişim. `docs/kontrol.html`'e olduğu gibi kopyalanıyor. |
| `test_kontrol.js` | Teşhis sayfası doğru teşhis koyuyor mu (23 test) — `node test_kontrol.js` |
| `test_canli_tazeleme.js` | Eskitilmiş kopya yayındaki `veri.json`'dan tazeleniyor mu (6 test, **ağa çıkar**; erişemezse kendini atlar) |

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

## Engelli ağ / internetsiz kullanım

**AÇIK SORU — 26.08.2026'da ölçülecek.** Adliye bilgisayarları `github.io`
adresine erişebiliyor mu? Bilinmiyor. GitHub Pages kurumsal/kamu ağlarında
"kullanıcı içeriği" ya da "proxy" kategorisinden engellenebiliyor.

Bunun için `kontrol.html` yazıldı: adliyede açılıp dört şeyi ölçüyor —
siteye erişim, `veri.json`'a erişim, Google Fonts ve **tarayıcının
`localStorage`'a izin verip vermediği**. Sonucu buraya yaz.

**İkinci soru CEVAPLANDI (25.08.2026):** `file://` ile açılan sayfada
`localStorage` **çalışıyor** — Ertuğrul'un makinesinde `kontrol.html` dosyadan
açılıp ölçüldü, "Ayar saklama ✓". Yani indirilen dosyada elle girilen oranlar
kalıcı. Bu, kullanıcının kendi Windows makinesinde ölçüldü; adliyede kurum
politikası site verisini kapatmış olabilir — `kontrol.html` orada da söyleyecek.

**Plan B'ye gerek kalmadı, YAPILMADI:** ayarları dosyanın içine gömme
(`Blob` + `<a download>`) fikri rafta. Yalnızca adliyede "Ayar saklama ×"
çıkarsa gündeme gelsin.

### İndirilen dosya nasıl güncel kalıyor

**Üç katman var, sırayla:**

1. **Onbellek** (`nafaka-veri-onbellek-v1`, localStorage) — daha önce ağa
   çıkıldığında indirilmiş veri. Açılışta okunur; gömülüden yeniyse o kullanılır.
2. **Ağ** — her açılışta `docs/veri.json` çekilmeye çalışılır (5 sn zaman aşımı).
   Başarılıysa kullanılır **ve önbelleğe yazılır**.
3. **Gömülü** — dosya kurulurken içine konan veri. Diğer ikisi yoksa bu.

Hangisinin kullanıldığı sağ üstte yazıyor: "dosyaya gömülü veri" /
"daha önce indirilmiş veri" / "siteden tazelendi".

**26.08.2026 öncesi hata — kullanıcının sorusu ortaya çıkardı.** Onbellek katmanı
yoktu: dosya evde açılıp güncel veriyi çekiyor ama kaydetmiyordu, ertesi gün ağsız
açıldığında yine gömülü eski veriye dönüyordu. Yani engelli ağda tazelemenin
hiçbir faydası olmuyordu — tam da onun için yapılmış olmasına rağmen.
Soru: "site açılmazsa dosyayı dağıtırsam güncelleme yapabilir mi?" Cevap
hayırdı; şimdi evet.


Kullanıcı iki gerçek deliği yakaladı (25.08.2026) ve ikisi de kapatıldı:

1. *"Site açılmıyorsa dosyayı nasıl indirecek?"* — İndirme, siteye erişilebilen
   bir yerde (ev, büro, telefon) bir kez yapılır. Dağıtımı Ertuğrul da yapabilir:
   dosya 75 KB, e-postayla gider.
2. *"İndirdiği dosya bir ay sonra eskimez mi?"* — Eskimiyor. `docs/veri.json`
   sayfanın yanında ayrıca yayımlanıyor; sayfa **her açılışta** oradan taze veri
   çekmeye çalışıyor (5 sn zaman aşımı). GitHub Pages
   `Access-Control-Allow-Origin: *` gönderdiği için `file://` ile açılan kopya da
   erişebiliyor — ölçüldü. İnternet yoksa gömülü veriyle devam ediyor.

Hangi verinin kullanıldığı **ekranda yazıyor**: "dosyaya gömülü veri" /
"siteden tazelendi". Veri gerçekten eskimişse en üstte uyarı çıkıp güncel adresi
veriyor. Bozuk ya da daha eski cevap gelirse yok sayılıyor.

**Yakalanan hata:** ilk sürümde veri tazeleniyordu ama bitiş tarihi eski ayda
kalıyordu — yani yeni ay çekiliyor, cetvele hiç girmiyordu. `bitisiIlerlet()`
eklendi: kullanıcı o alana dokunmadıysa bitiş tarihi yeni aya ilerliyor,
dokunduysa seçimi korunuyor. Bunu `test_canli_tazeleme.js` buldu.

Cevabı beklemeden risk düşürüldü:
- Sayfa **tek dosya** — veri de hesap da gömülü. Ölçüldü: yerel bağımlılık yok,
  dışa giden tek istek Google Fonts.
- Sitede **"Bilgisayarına indir"** bağlantısı var. İndirilen dosya internetsiz
  çalışıyor. `file://` ile açılınca bağlantı kendini gizleyip notu değiştiriyor.
- **Yazı tipi yığınları jetonda** (`--yazi-baslik/govde/sayi`). Google Fonts de
  engellenirse Windows'un Georgia / Segoe UI / Consolas'ı devreye giriyor.
  Eskiden jenerik `monospace` vardı, Times New Roman'a düşüyordu.
- `test_site.js` sayfayı hem `https:` hem `file:` protokolüyle, sahte tarihle ve
  sahte ağ cevaplarıyla kurup sınıyor; dışa giden bağımlılık listesini de ölçüyor.

**Engelliyse seçenekler:** (a) kendi alan adı — düz bir `.com`, bilinen bir
kullanıcı-içeriği alanı olmadığı için kategoriye takılma ihtimali çok daha
düşük, yılda 10-15 dolar; (b) dosyayı doğrudan dağıtmak; (c) telefondan
mobil veriyle açmak — kurum filtresini tamamen atlar.

**Artifact sürümünde indirme bağlantısı yok** — Claude'un artifact
görüntüleyicisi sayfalara dosya indirtmiyor, orada ölü düğme olurdu.
`site_yap.py` onu artifact kopyasından çıkarıyor; şablon değişip parça
eşleşmezse yapı sessizce geçmiyor, HATA verip duruyor.

## Elle oran ekleme

Otomatik güncelleme tökezlerse kullanıcı o ayın oranını kendi girebiliyor
(sol paneldeki "Elle oran ekle" bölümü). Girilen oran `localStorage`'da
(`nafaka-elle-oranlar-v1`) saklanıyor.

**İki ayrı elle girme yolu var, karıştırma:**

| | Nerede saklanır | Kime ulaşır |
|---|---|---|
| Sayfadaki "Elle oran ekle" | O kişinin tarayıcısı (`localStorage`) | **Yalnız o kişi** |
| `oran_ekle.py` + push | `veri/endeksler.json` (depo) | **Herkes** |

Otomatik güncelleme tökezlerse doğru hamle `oran_ekle.py` ile oranı kaynağa
yazıp yayınlamak — 20 kişiye "elle gir" demek değil:

```
py -3.13 oran_ekle.py TUFE 2026-08 --ort12 31.20 --yillik 30.50
py -3.13 site_yap.py
git add -A && git commit -m "elle: TÜİK 2026-08" && git push
```

Eklenen ay `_elle: true` işaretiyle yazılıyor. Bu işaret iki iş yapıyor:
sayfada "elle girildi" diye görünüyor (rakamın otomatik çekilmediği belli
oluyor) ve `veri_cek.py` içindeki `elle_koru()` sayesinde bir sonraki çekimde
**ne siliniyor ne de yanlış alarm veriyor** — TÜİK o ayı vermeye başlayınca
resmi değer devralıyor, vermiyorsa elle konulan duruyor.

**Kural: RESMİ VERİ KAZANIR, ama elle girilen SİLİNMEZ.**
`hesap.js` içindeki `elleBirlestir(veri, elle)` bunu yapıyor:
- TÜİK verisi olmayan ay → elle girilen kullanılıyor, kayda `_elle: true` konuyor
- TÜİK verisi olan ay → resmi oran kullanılıyor, elle girilen `gecersiz`
  listesinde dönüyor ve ekranda "TÜİK verisi geldi, artık o kullanılıyor,
  girdiğin duruyor, istersen sil" diye görünüyor

Bu ayrım bilinçli: kullanıcının girdiği hiçbir şey kendiliğinden kaybolmasın
ama eski bir tahmin de resmi rakamın önüne geçmesin. Silme kararı kullanıcının.

Cetvelde elle girilen oran kesikli çerçeve + "elle girildi" notuyla işaretli;
panoya kopyalanan metne de geçiyor — hangi rakamın resmi olmadığı hep belli.

`localStorage` çalışmıyorsa (gizli sekme, site verisi kapalı tarayıcı) oran
yine hesaba katılıyor ama "kaydedilemedi, sayfayı kapatınca kaybolur" deniyor.
Bütün okuma/yazma `try/catch` içinde.

**Tuzak:** Bir ayın oranı ancak **bir sonraki ayda yıl dönümü olan** dosyada
kullanılır ("önceki ay" kuralı). Test yazarken buna dikkat — Ağustos oranını
sınamak için başlangıç ayı Eylül olmalı, yoksa oran hiç sorgulanmaz ve test
boşuna düşer (bu tuzağa düşüldü).

## Çok kullanıcı — neden sorun değil

Kullanıcı sordu (25.08.2026): birden fazla kişi, farklı dosyalarda, belki
aynı anda kullanacak.

**Yapı gereği sorun çıkmıyor.** Sunucu, veritabanı, oturum yok. Her ziyaretçi
sayfanın kendi kopyasını kendi tarayıcısında çalıştırıyor; paylaşılan hiçbir
durum yok, dolayısıyla çakışacak bir şey de yok. Sayfa hiçbir yere veri
göndermiyor (test bunu ölçüyor: POST, XHR, sendBeacon, WebSocket yok; tek
dışa istek `veri.json`'u **okumak**).

Ölçüldü (25.08.2026):
- Sıkıştırılmış aktarım: `index.html` 26 KB + `veri.json` 12 KB = ziyaret başına ~38 KB
- GitHub Pages yumuşak sınırı 100 GB/ay → kabaca **2,6 milyon ziyaret/ay**
- 20 eşzamanlı istek: hepsi 200, toplam 1,15 sn

Yani kullanıcı sayısı bir sorun hâline gelmeden çok önce başka her şey biter.

**Gerçek (küçük) risk:** `localStorage` tarayıcı profili başına. Aynı bilgisayarı
paylaşan iki kişi elle girilen oranları da paylaşır. TÜİK oranı evrensel bir
veri olduğu için bu aslında doğru davranış — ama biri yanlış girerse diğeri de
onu görür. Dosya bilgileri (tutar, tarih) hiç saklanmıyor, o yüzden dosyalar
birbirine karışmıyor.

**Yapılmadı, sorulmalı:** dosya bilgilerini adlandırıp kaydetme (bir kişi
birden çok dosyayla çalışıyorsa her seferinde yeniden yazıyor). Kullanıcıya
soruldu, cevap beklenmeden yapılmasın.

## Hesap kuralı

Yıl dönümünde uygulanacak oran **her zaman yıl dönümünden bir önceki ayın**
oranı. Sebep: o ay, tamamlanmış son 12 ayı kapsıyor (Ocak yıl dönümü → Aralık
oranı → tam takvim yılı).

Bu bir seçenekti, **25.08.2026'da kullanıcı isteğiyle arayüzden kaldırıldı**
("gerek yok, zaten hep önceki ay kullanılır"). Motordaki `referans: "ayni"`
yolu duruyor — iki satır, testleri yazılı — bir gün karar lafzı farklı olursa
tek satırla geri açılır. Arayüze sızmasın diye nöbetçi test var.

Doğrulanmış örnek: Ocak 2022'de 1.000 ₺, TÜFE 12 aylık ortalama, önceki ay kuralı
→ 1.000 × 1,7231 × 1,5386 × 1,5851 × 1,3488 = **5.668,14 ₺** (2026 dönemi).

## Sıradaki işler (yapılmadı, sorulmalı)

- Birikmiş nafaka alacağı için yasal faiz hesabı.
- Karar metninden tarih/tutar okuyup formu otomatik doldurma.
- Kendi alan adı (yılda 10-15 dolar) — kullanıcı şimdilik istemedi.
- Kullanım sayacı / analitik yok; kaç kişi kullanıyor bilinmiyor.
