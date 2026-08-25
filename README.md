# Nafaka Artış Cetveli

Mahkemenin belirlediği aylık nafakayı, TÜİK'in enflasyon oranıyla her yıl
dönümünde güncelleyip hangi dönemde ne kadar ödenmesi gerektiğini çıkaran
hesap cetveli.

**Kullan:** https://ertugrul2442.github.io/nafaka-hesapla/

Kurulum yok, üyelik yok, veri toplanmıyor. Bütün hesap senin tarayıcında dönüyor.

## Ne yapıyor

- Başlangıç tarihi ve tutarını giriyorsun.
- Her yıl dönümünde TÜFE ya da Yİ-ÜFE oranı uygulanıyor.
- Dönem dönem aylık nafaka, uygulanan oran ve toplamlar çıkıyor.
- Cetveli dilekçeye yapıştırmak için kopyalayabilir ya da PDF olarak yazdırabilirsin.

Varsayılan ölçü **on iki aylık ortalamalara göre değişim** — nafaka kararlarında
en sık geçen ölçü bu. "Yıllık değişim" seçeneği de var, çünkü kararların lafzı
değişebiliyor.

Bu bir hesap makinesidir, hukuki görüş değildir.

## Veri

Kaynak: TÜİK Veri Portalı, resmî aylık fiyat endeksi serileri.

- TÜFE: Ocak 2005'ten bugüne
- Yİ-ÜFE: Ocak 1982'den bugüne

TÜİK yeni ayı her ayın 3'ünde yayımlıyor. Bu depodaki zamanlanmış iş
(`.github/workflows/veri-guncelle.yml`) veriyi kendiliğinden çekip sayfayı
yeniden kuruyor. Veri doğrulamadan geçmezse eski veri yayında kalıyor ve
hata bildiriliyor — bozuk veri sessizce yayına giremiyor.

## Geliştirme

```
py -3.13 veri_cek.py    # TÜİK'ten veriyi çek (0=yeni, 3=değişmemiş, 1=hata)
py -3.13 site_yap.py    # docs/index.html'i yeniden kur
py -3.13 test_veri.py   # veri güvenlik kontrollerinin testleri
node test_hesap.js      # hesap motorunun testleri
node test_site.js       # yayına giden sayfanın testleri
```

`docs/index.html` üretilen dosyadır, elle düzenlenmez — kaynak `sablon.html`,
`hesap.js` ve `veri/endeksler.json`.
