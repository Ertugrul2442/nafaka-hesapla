"""sablon.html + veri + hesap.js  ->  yayina hazir tek dosyalik sayfa.

Iki cikti uretir, ikisi de kendi kendine yeter (Google Fonts disinda dis istek yok):
    docs/index.html        GitHub Pages'in yayinladigi sayfa (tam HTML belgesi)
                           (klasor adi "docs" zorunlu: GitHub Pages dal yayininda
                            yalniz kok ya da /docs klasorunu sunabiliyor)
    nafaka_artifact.html   Claude artifact baglantisini tazelemek icin (parca)

Calistirma:  py -3.13 site_yap.py
"""
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

KOK = os.path.dirname(os.path.abspath(__file__))
SABLON = os.path.join(KOK, "sablon.html")
VERI = os.path.join(KOK, "veri", "endeksler.json")
HESAP = os.path.join(KOK, "hesap.js")
SITE = os.path.join(KOK, "docs", "index.html")
SITE_VERI = os.path.join(KOK, "docs", "veri.json")
ARTIFACT = os.path.join(KOK, "nafaka_artifact.html")

ACIKLAMA = ("Mahkemenin belirlediği nafakayı TÜİK'in TÜFE veya Yİ-ÜFE oranıyla "
            "yıl yıl güncelleyip her dönemde ödenmesi gereken aylık tutarı çıkarır.")

# Artifact surumunden cikarilan parcalar (bkz. main icindeki aciklama).
# Sablon degisirse bu diziler eslesmez ve yapi HATA verip durur - sessizce gecmez.
INDIR_BAGLANTISI = ('        <a class="dugme" id="indir" href="index.html" '
                    'download="nafaka-cetveli.html">Bilgisayarına indir</a>\n')
INDIR_NOTU = ('      <p class="not" id="indirNot">İndirdiğin dosya çift tıklamayla açılır ve '
              'internetsiz de çalışır.\n        İnternete erişebildiği her açılışta veriyi buradan '
              'kendi tazeler; erişemezse\n        içindeki veriyle devam eder ve eskidiğinde uyarır.</p>\n')

# emoji favicon - ayri dosya gerektirmiyor
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'"
           "%3E%3Ctext y='.9em' font-size='90'%3E%E2%9A%96%EF%B8%8F%3C/text%3E%3C/svg%3E")


def belge(bas, govde):
    """Parcayi tam bir HTML belgesine sarar (GitHub Pages icin)."""
    return (
        '<!doctype html>\n<html lang="tr">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f'<meta name="description" content="{ACIKLAMA}">\n'
        '<meta name="color-scheme" content="light dark">\n'
        '<meta property="og:type" content="website">\n'
        '<meta property="og:title" content="Nafaka Artış Cetveli">\n'
        f'<meta property="og:description" content="{ACIKLAMA}">\n'
        f'<link rel="icon" href="{FAVICON}">\n'
        f'{bas}\n</head>\n<body>\n{govde}\n</body>\n</html>\n'
    )


def main():
    for yol in (SABLON, VERI, HESAP):
        if not os.path.exists(yol):
            raise SystemExit(f"HATA: bulunamadı -> {yol}")

    sablon = io.open(SABLON, encoding="utf-8").read()
    veri = json.load(io.open(VERI, encoding="utf-8"))
    hesap = io.open(HESAP, encoding="utf-8").read()

    veri_js = json.dumps(veri, ensure_ascii=False, separators=(",", ":"))
    veri_js = veri_js.replace("</", "<\\/")   # gomulu JSON <\/script> ile erken kapanmasin

    isaret_veri = "/*__VERI__*/null/*__VERI_SON__*/"
    isaret_hesap = "/*__HESAP__*/"
    for isaret in (isaret_veri, isaret_hesap, "<!--BAS-->", "<!--BAS_SON-->"):
        if isaret not in sablon:
            raise SystemExit(f"HATA: şablonda işaret yok -> {isaret}")

    dolu = sablon.replace(isaret_veri, veri_js).replace(isaret_hesap, hesap)

    bas = dolu.split("<!--BAS-->", 1)[1].split("<!--BAS_SON-->", 1)[0].strip()
    govde = dolu.split("<!--BAS_SON-->", 1)[1].strip()

    os.makedirs(os.path.dirname(SITE), exist_ok=True)
    io.open(SITE, "w", encoding="utf-8", newline="\n").write(belge(bas, govde))

    # Veriyi sayfanin yaninda ayrica yayimliyoruz. Indirilen kopya bunu cekip
    # kendini tazeliyor; boylece dosya bir aylik fotograf olarak kalmiyor.
    # GitHub Pages "Access-Control-Allow-Origin: *" gonderdigi icin file:// ile
    # acilan kopya da erisebiliyor (25.08.2026'da olculdu).
    io.open(SITE_VERI, "w", encoding="utf-8", newline="\n").write(veri_js)

    # Artifact goruntuleyicisi sayfalara dosya indirtmiyor; oradaki kopyada
    # indirme baglantisi olu dugme olurdu, cikariyoruz. (Sayfa betigi bu
    # ogelerin yoklugunu zaten kaldiriyor - $("indir") null kontrollu.)
    artifact = dolu.replace("<!--BAS-->\n", "").replace("<!--BAS_SON-->\n", "")
    for parca in (INDIR_BAGLANTISI, INDIR_NOTU):
        if parca not in artifact:
            raise SystemExit(f"HATA: artifact sürümünden çıkarılacak parça bulunamadı ->\n{parca}")
        artifact = artifact.replace(parca, "", 1)
    io.open(ARTIFACT, "w", encoding="utf-8", newline="\n").write(artifact)

    for ad, yol in (("docs/index.html", SITE), ("docs/veri.json", SITE_VERI),
                    ("nafaka_artifact.html", ARTIFACT)):
        b = os.path.getsize(yol)
        print(f"yazıldı -> {ad}  ({b / 1024:.0f} KB)")
        if b > 16 * 1024 * 1024:
            raise SystemExit(f"HATA: {ad} 16 MB sınırını aştı")

    print(f"  TÜFE   {veri['seriler']['TUFE']['ilk_ay']} .. {veri['seriler']['TUFE']['son_ay']}")
    print(f"  Yİ-ÜFE {veri['seriler']['UFE']['ilk_ay']} .. {veri['seriler']['UFE']['son_ay']}")


if __name__ == "__main__":
    main()
