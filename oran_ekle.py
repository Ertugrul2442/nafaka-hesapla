"""Bir ayin oranini veri dosyasina ELLE ekler - herkese ulassin diye.

Ne zaman lazim: TUIK orani acikladi ama otomatik guncelleme cekemedi
(API bozuldu, bicim degisti vs.). Bu betikle oranı kaynaga bir kez yazarsin,
sayfa yeniden kurulur, yayina gider ve BUTUN kullanicilara ulasir.

Kullanicinin sayfadan "Elle oran ekle" ile girdigi oran yalniz kendi
tarayicisinda kalir. Herkese ulasmasi icin oranin BURADAN girilmesi gerekir.

Kullanim:
    py -3.13 oran_ekle.py TUFE 2026-08 --ort12 31.20 --yillik 30.50
    py -3.13 oran_ekle.py UFE 2026-08 --ort12 27.90
    py -3.13 oran_ekle.py TUFE 2026-08 --sil

Sonra:
    py -3.13 site_yap.py
    git add -A && git commit -m "elle: TUIK 2026-08 orani" && git push
"""
import argparse
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

KOK = os.path.dirname(os.path.abspath(__file__))
VERI = os.path.join(KOK, "veri", "endeksler.json")

ORAN_ALT, ORAN_UST = -90.0, 1000.0


def ay_gecerli(ay):
    if len(ay) != 7 or ay[4] != "-":
        return False
    try:
        y, a = int(ay[:4]), int(ay[5:])
    except ValueError:
        return False
    return 1980 <= y <= 2100 and 1 <= a <= 12


def main():
    ap = argparse.ArgumentParser(description="Veri dosyasina elle oran ekler/siler.")
    ap.add_argument("endeks", choices=["TUFE", "UFE"])
    ap.add_argument("ay", help="YYYY-MM biçiminde, örn. 2026-08")
    ap.add_argument("--ort12", type=float, help="On iki aylik ortalamalara gore degisim (%%)")
    ap.add_argument("--yillik", type=float, help="Yillik degisim (%%)")
    ap.add_argument("--sil", action="store_true", help="Daha once elle eklenen ayı siler")
    ap.add_argument("--zorla", action="store_true",
                    help="TUIK verisi olan ayin uzerine yazar (normalde reddedilir)")
    a = ap.parse_args()

    if not ay_gecerli(a.ay):
        raise SystemExit(f"HATA: ay biçimi YYYY-MM olmalı, verilen: {a.ay}")

    veri = json.load(io.open(VERI, encoding="utf-8"))
    seri = veri["seriler"][a.endeks]
    aylik = seri["aylik"]
    mevcut = aylik.get(a.ay)

    if a.sil:
        if not mevcut:
            raise SystemExit(f"HATA: {a.endeks} {a.ay} zaten yok")
        if not mevcut.get("_elle"):
            raise SystemExit(f"HATA: {a.endeks} {a.ay} TÜİK verisi, elle eklenmiş değil - silinmez")
        del aylik[a.ay]
        print(f"silindi: {a.endeks} {a.ay}")
    else:
        if a.ort12 is None and a.yillik is None:
            raise SystemExit("HATA: en az bir oran ver (--ort12 ya da --yillik)")
        for ad, d in (("ort12", a.ort12), ("yillik", a.yillik)):
            if d is not None and not (ORAN_ALT <= d <= ORAN_UST):
                raise SystemExit(f"HATA: {ad}={d} makul aralık dışında ({ORAN_ALT}..{ORAN_UST})")

        if mevcut and not mevcut.get("_elle") and not a.zorla:
            raise SystemExit(
                f"HATA: {a.endeks} {a.ay} için TÜİK verisi zaten var "
                f"(ort12={mevcut.get('ort12')}). Üzerine yazmak istiyorsan --zorla ver.")

        kayit = {}
        if a.ort12 is not None:
            kayit["ort12"] = round(a.ort12, 6)
        if a.yillik is not None:
            kayit["yillik"] = round(a.yillik, 6)
        # Bu isaret iki ise yariyor: sayfada "elle girildi" diye gorunur ve
        # veri_cek.py, TUIK gercek degeri getirdiginde bunu "gecmis degismis"
        # alarmi saymaz - degismesi zaten beklenen sey.
        kayit["_elle"] = True
        aylik[a.ay] = kayit
        print(f"eklendi: {a.endeks} {a.ay} -> {kayit}")

    sirali = sorted(aylik)
    if not sirali:
        raise SystemExit("HATA: seri boş kaldı, yazılmadı")
    seri["ilk_ay"], seri["son_ay"] = sirali[0], sirali[-1]
    seri["aylik"] = {k: aylik[k] for k in sirali}

    # newline="\n": depoda her sey LF (bkz .gitattributes); CRLF yazarsak
    # dosyanin tamami degismis gorunur ve commit gurultusu olur.
    with io.open(VERI, "w", encoding="utf-8", newline="\n") as f:
        json.dump(veri, f, ensure_ascii=False, indent=1)

    elle_sayisi = sum(1 for kod in veri["seriler"]
                      for d in veri["seriler"][kod]["aylik"].values() if d.get("_elle"))
    print(f"yazıldı -> {VERI}")
    print(f"  {a.endeks} kapsam: {seri['ilk_ay']} .. {seri['son_ay']} ({len(sirali)} ay)")
    print(f"  dosyada elle eklenmiş toplam {elle_sayisi} ay var")
    print("\nŞimdi:  py -3.13 site_yap.py   sonra commit + push")


if __name__ == "__main__":
    main()
