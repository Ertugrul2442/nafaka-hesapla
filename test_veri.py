"""veri_cek.py'deki guvenlik kontrollerinin testleri.

Bu kontroller ayda bir, kimse basinda yokken calisiyor. Bozuk veriyi
yayina sokmalari ya da bozuklugu sessizce gecmeleri en pahali hata olur.

Calistir:  py -3.13 test_veri.py
"""
import copy
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import veri_cek as V

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

gecen = kalan = 0


def kontrol(ad, kosul, ek=""):
    global gecen, kalan
    if kosul:
        gecen += 1
        print(f"  ok   {ad}")
    else:
        kalan += 1
        print(f"  HATA {ad}" + (f"\n       {ek}" if ek else ""))


def seri_uret(ilk_yil, ay_sayisi, oran=40.0):
    aylik = {}
    y, a = ilk_yil, 1
    endeks = 100.0
    for _ in range(ay_sayisi):
        aylik[f"{y}-{a:02d}"] = {"endeks": round(endeks, 4), "yillik": oran, "ort12": oran}
        endeks *= 1.02
        a += 1
        if a == 13:
            a, y = 1, y + 1
    return aylik


def veri_uret(ay_sayisi=200):
    d = {"seriler": {}}
    for kod in ("TUFE", "UFE"):
        aylik = seri_uret(2005, ay_sayisi)
        aylar = sorted(aylik)
        d["seriler"][kod] = {"ad": kod, "veri_seti": "x", "ilk_ay": aylar[0],
                             "son_ay": aylar[-1], "aylik": aylik, "yillik_aralik": {}}
    return d


def ay_ekle(veri, kod=None):
    """Seriye bir ay ekler - normal aylik guncellemeyi taklit eder."""
    v = copy.deepcopy(veri)
    for k in ([kod] if kod else ("TUFE", "UFE")):
        aylik = v["seriler"][k]["aylik"]
        son = sorted(aylik)[-1]
        y, a = int(son[:4]), int(son[5:7])
        a += 1
        if a == 13:
            a, y = 1, y + 1
        yeni_ay = f"{y}-{a:02d}"
        aylik[yeni_ay] = {"endeks": 999.0, "yillik": 41.0, "ort12": 41.0}
        v["seriler"][k]["son_ay"] = yeni_ay
    return v


print("--- guvenlik_kontrolu: normal aylik guncelleme ---")
eski = veri_uret()
yeni = ay_ekle(eski)
s = V.guvenlik_kontrolu(yeni, eski)
kontrol("temiz guncelleme sorun uretmiyor", s == [], str(s))

print("\n--- guvenlik_kontrolu: bozuk veriler yakalaniyor mu ---")

bozuk = copy.deepcopy(yeni)
del bozuk["seriler"]["UFE"]
kontrol("eksik seri yakalandi", any("UFE" in x for x in V.guvenlik_kontrolu(bozuk, eski)))

bozuk = veri_uret(ay_sayisi=50)
kontrol("cok az ay yakalandi", any("en az" in x for x in V.guvenlik_kontrolu(bozuk, None)))

bozuk = copy.deepcopy(yeni)
aylar = sorted(bozuk["seriler"]["TUFE"]["aylik"])
for a in aylar[-30:]:
    del bozuk["seriler"]["TUFE"]["aylik"][a]
bozuk["seriler"]["TUFE"]["son_ay"] = sorted(bozuk["seriler"]["TUFE"]["aylik"])[-1]
s = V.guvenlik_kontrolu(bozuk, eski)
kontrol("ay sayisi azalmasi yakalandi", any("azaldı" in x for x in s), str(s))
kontrol("son ayin geriye gitmesi yakalandi", any("geriye gitti" in x for x in s), str(s))

bozuk = copy.deepcopy(yeni)
for a in sorted(bozuk["seriler"]["TUFE"]["aylik"])[-5:]:
    bozuk["seriler"]["TUFE"]["aylik"][a]["ort12"] = None
kontrol("son aylarda bos ort12 yakalandi",
        any("ort12 yok" in x for x in V.guvenlik_kontrolu(bozuk, eski)))

bozuk = copy.deepcopy(yeni)
bozuk["seriler"]["TUFE"]["aylik"]["2010-05"]["ort12"] = 99999.0
kontrol("sacma oran yakalandi",
        any("makul oran" in x for x in V.guvenlik_kontrolu(bozuk, eski)))

bozuk = copy.deepcopy(yeni)
for a in sorted(bozuk["seriler"]["TUFE"]["aylik"])[:50]:
    bozuk["seriler"]["TUFE"]["aylik"][a]["ort12"] = 12.3
s = V.guvenlik_kontrolu(bozuk, eski)
kontrol("gecmisin toptan degismesi yakalandi", any("eski ayın oranı değişmiş" in x for x in s), str(s))

print("\n--- guvenlik_kontrolu: kucuk revizyona izin var ---")
ufak = copy.deepcopy(yeni)
for a in sorted(ufak["seriler"]["TUFE"]["aylik"])[:2]:
    ufak["seriler"]["TUFE"]["aylik"][a]["ort12"] = 41.9   # 1.9 puan sapma, 2 ay
kontrol("2 aylik revizyon gecirildi", V.guvenlik_kontrolu(ufak, eski) == [])

print("\n--- bayatlik_kontrolu ---")
taze = veri_uret()
taze["seriler"]["TUFE"]["son_ay"] = "2026-07"
taze["seriler"]["UFE"]["son_ay"] = "2026-07"
g = lambda y, m, d: datetime(y, m, d, tzinfo=timezone.utc)  # noqa: E731

kontrol("temmuz verisi, 25 agustos -> temiz",
        V.bayatlik_kontrolu(taze, g(2026, 8, 25)) == [])
kontrol("temmuz verisi, 2 eylul -> temiz (yeni ay 3'unde cikar)",
        V.bayatlik_kontrolu(taze, g(2026, 9, 2)) == [])
s = V.bayatlik_kontrolu(taze, g(2026, 9, 20))
kontrol("temmuz verisi, 20 eylul -> BAYAT diyor", len(s) == 2, str(s))
s = V.bayatlik_kontrolu(taze, g(2026, 12, 15))
kontrol("temmuz verisi, aralik -> BAYAT diyor", len(s) == 2, str(s))

print("\n--- gercek veri dosyasi da kontrollerden geciyor mu ---")
yol = os.path.join(os.path.dirname(os.path.abspath(__file__)), "veri", "endeksler.json")
if os.path.exists(yol):
    gercek = json.load(open(yol, encoding="utf-8"))
    kontrol("yayindaki veri guvenlik kontrolunden geciyor",
            V.guvenlik_kontrolu(gercek, None) == [], str(V.guvenlik_kontrolu(gercek, None)))
    kontrol("yayindaki veri kendisiyle karsilastirilinca temiz",
            V.guvenlik_kontrolu(gercek, gercek) == [])
    kontrol("yayindaki veri bayat degil", V.bayatlik_kontrolu(gercek) == [],
            str(V.bayatlik_kontrolu(gercek)))
else:
    print("  (veri/endeksler.json yok, atlandi)")

print("\n===============================")
print(f"{gecen} geçti, {kalan} kaldı")
sys.exit(1 if kalan else 0)
