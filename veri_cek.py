"""TUIK'ten TUFE ve Yi-UFE aylik serilerini ceker, veri/endeksler.json'a yazar.

Calistirma:
    py -3.13 veri_cek.py            # ceker, dogrular, degistiyse yazar
    py -3.13 veri_cek.py --zorla    # guvenlik kontrollerini atlar (TUIK baz yili
                                    # degistirdiginde vs. insan bakarak kullanir)

Cikis kodlari  (GitHub Actions bunlara bakiyor):
    0  yeni veri yazildi
    3  veri ayni, yazacak bir sey yok
    1  cekme/dogrulama basarisiz -> HICBIR SEY YAZILMADI, eski veri duruyor
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tuik_api as api

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

KOK = os.path.dirname(os.path.abspath(__file__))
CIKTI = os.path.join(KOK, "veri", "endeksler.json")

# DEGISIM kodlari (TUIK CL_DEGISIM):
#   1 = Endeks
#   4 = Yillik degisim (%)                            -> gecen yilin ayni ayina gore
#   5 = On iki aylik ortalamalara gore degisim (%)    <-- nafakada kullanilan
DEGISIM_ADI = {"1": "endeks", "4": "yillik", "5": "ort12"}

KAYNAKLAR = {
    "TUFE": {
        "ad": "TÜFE (Tüketici Fiyat Endeksi)",
        "veri_seti": "TR,DF_TUFE_SDMX_TT10,1.0",
        "filtre": {"REF_AREA": ["TR"], "COICOP_2018": ["0"],
                   "SINIFLAMA_DUZEYI": ["TUFE"], "DEGISIM": ["1", "4", "5"]},
        # sunucu filtreyi tam uygulamiyor; donen kupten kesiti kendimiz seciyoruz
        "sec": {"COICOP_2018": "0", "SINIFLAMA_DUZEYI": "TUFE", "REF_AREA": "TR"},
    },
    "UFE": {
        "ad": "Yİ-ÜFE (Yurt İçi Üretici Fiyat Endeksi)",
        "veri_seti": "TR,DF_YIUFE_EDO_V1,1.0",
        "filtre": {"REF_AREA": ["TR"], "URUN_UFE_NACE_CPA": ["B-E36"],
                   "FAAL_GRUP": ["_T"], "DEGISIM": ["1", "4", "5"]},
        "sec": {"URUN_UFE_NACE_CPA": "B-E36", "FAAL_GRUP": "_T", "REF_AREA": "TR"},
    },
}

# --- guvenlik esikleri -------------------------------------------------
EN_AZ_AY = 100          # bu kadar aydan az veri geldiyse bir sey ters gitmis
ORAN_ALT, ORAN_UST = -90.0, 1000.0   # makul enflasyon araligi (%)
GECMIS_SAPMA = 0.5      # eski bir ayin orani bu kadar puandan fazla degistiyse dur
GECMIS_SAPMA_PAYI = 3   # bu kadar aya kadar sapmaya izin var (TUIK ufak revizyon yapar)


def seri_cikar(js, sec):
    """JSON-stat kupunden istenen kesiti {ay: {endeks, yillik, ort12}} olarak cikarir."""
    satirlar = api.duzlestir(js)
    seri = {}
    esles = atla = 0
    for s in satirlar:
        if any(s.get(k) != v for k, v in sec.items()):
            atla += 1
            continue
        alan = DEGISIM_ADI.get(s.get("DEGISIM"))
        if alan is None:
            atla += 1
            continue
        esles += 1
        seri.setdefault(s["TIME_PERIOD"], {})[alan] = round(s["value"], 6)
    print(f"    kesit: {esles} gözlem alındı, {atla} gözlem kapsam dışı")
    return {k: v for k, v in sorted(seri.items()) if len(k) == 7 and k[4] == "-"}


def ort12_hesapla(seri):
    """Endeksten 12 aylik hareketli ortalama degisimini hesaplar (yalniz dogrulama icin).

    DIKKAT: baz yili degisimlerinde (or. Yi-UFE 1990/1996/2006) bu hesap TUIK'in
    yayinladigi degerden sapar, cunku elimizdeki endeks serisi birlestirilmis.
    Uygulamada her zaman TUIK'in yayinladigi 'ort12' kullanilir.
    """
    aylar = sorted(seri)
    endeks = {a: seri[a].get("endeks") for a in aylar}
    sonuc = {}
    for i, a in enumerate(aylar):
        if i < 23:
            continue
        son12 = [endeks[aylar[j]] for j in range(i - 11, i + 1)]
        onceki12 = [endeks[aylar[j]] for j in range(i - 23, i - 11)]
        if any(x is None for x in son12 + onceki12):
            continue
        o1, o0 = sum(son12) / 12, sum(onceki12) / 12
        if o0:
            sonuc[a] = (o1 / o0 - 1) * 100
    return sonuc


def capraz_dogrula(kod, seri):
    """TUIK'in yayinladigi ort12 ile endeksten hesaplanani karsilastirir (bilgi amacli)."""
    bizim = ort12_hesapla(seri)
    ortak = [a for a in bizim if seri[a].get("ort12") is not None]
    if not ortak:
        print(f"    çapraz kontrol yapılamadı ({kod})")
        return
    farklar = {a: abs(bizim[a] - seri[a]["ort12"]) for a in ortak}
    kotu = [a for a in ortak if farklar[a] > 0.15]
    print(f"    çapraz kontrol: {len(ortak)} ay, en büyük fark {max(farklar.values()):.4f} puan, "
          f"0.15 puanı aşan {len(kotu)} ay (baz yılı değişimlerinde beklenir)")


def yillik_ozet(seri):
    """Her yilin Aralik ayindaki oranlar - hizli bakis icin."""
    return {ay.split("-")[0]: {"ort12": d.get("ort12"), "yillik": d.get("yillik")}
            for ay, d in seri.items() if ay.split("-")[1] == "12"}


def topla():
    cikti = {
        "kaynak": "TÜİK Veri Portalı (databrowser2.tuik.gov.tr/api/core)",
        "cekilme_tarihi": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "aciklama": {
            "endeks": "Fiyat endeksi",
            "yillik": "Bir önceki yılın aynı ayına göre değişim (%)",
            "ort12": "On iki aylık ortalamalara göre değişim (%)",
        },
        "seriler": {},
    }
    for kod, k in KAYNAKLAR.items():
        print(f"[{kod}] {k['ad']}")
        print(f"    veri seti: {k['veri_seti']}")
        js = api.veri(k["veri_seti"], k["filtre"])
        seri = seri_cikar(js, k["sec"])
        if not seri:
            raise RuntimeError(f"{kod} için veri bulunamadı - kesit filtresi bozulmuş olabilir")
        aylar = sorted(seri)
        print(f"    kapsam: {aylar[0]} .. {aylar[-1]}  ({len(aylar)} ay)")
        capraz_dogrula(kod, seri)
        cikti["seriler"][kod] = {
            "ad": k["ad"], "veri_seti": k["veri_seti"],
            "ilk_ay": aylar[0], "son_ay": aylar[-1],
            "aylik": seri, "yillik_aralik": yillik_ozet(seri),
        }
        print()
    return cikti


def elle_koru(yeni, eski):
    """Elle eklenmis aylari (oran_ekle.py) yeni cekimde kaybetmez.

    Kural, tarayicidakiyle ayni: RESMI VERI KAZANIR. TUIK o ayi artik veriyorsa
    elle eklenen dusuyor; hala vermiyorsa duruyor. Boylece bir sonraki cekim
    ne elle konulani siliyor ne de 'ay sayisi azaldi' diye yanlis alarm veriyor.
    """
    if not eski:
        return
    for kod, s in yeni.get("seriler", {}).items():
        e = eski.get("seriler", {}).get(kod)
        if not e:
            continue
        korunan = []
        for ay, d in e["aylik"].items():
            if d.get("_elle") and ay not in s["aylik"]:
                s["aylik"][ay] = d
                korunan.append(ay)
        if korunan:
            sirali = sorted(s["aylik"])
            s["aylik"] = {k: s["aylik"][k] for k in sirali}
            s["ilk_ay"], s["son_ay"] = sirali[0], sirali[-1]
            print(f"  . {kod}: elle eklenen {len(korunan)} ay korundu ({', '.join(korunan)})")
        dusen = [ay for ay, d in e["aylik"].items() if d.get("_elle") and ay in s["aylik"]
                 and not s["aylik"][ay].get("_elle")]
        if dusen:
            print(f"  . {kod}: TÜİK artık veriyor, elle eklenen düştü ({', '.join(dusen)})")


def guvenlik_kontrolu(yeni, eski):
    """Yeni veriyi yazmadan once inceler. Sorun listesi doner; bos ise temiz."""
    sorun = []

    for kod in ("TUFE", "UFE"):
        if kod not in yeni.get("seriler", {}):
            sorun.append(f"{kod} serisi hiç gelmemiş")
            continue
        s = yeni["seriler"][kod]
        aylik = s["aylik"]

        if len(aylik) < EN_AZ_AY:
            sorun.append(f"{kod}: yalnızca {len(aylik)} ay geldi, en az {EN_AZ_AY} bekleniyordu")

        # son 24 ayin ort12'si dolu olmali - uygulamanin kullandigi alan bu
        son24 = sorted(aylik)[-24:]
        bos = [a for a in son24 if aylik[a].get("ort12") is None]
        if bos:
            sorun.append(f"{kod}: son 24 ayın {len(bos)} tanesinde ort12 yok ({', '.join(bos[:4])})")

        # degerler makul araliktda mi
        sapan = [(a, d["ort12"]) for a, d in aylik.items()
                 if d.get("ort12") is not None and not (ORAN_ALT <= d["ort12"] <= ORAN_UST)]
        if sapan:
            sorun.append(f"{kod}: {len(sapan)} ay makul oran aralığı dışında, örn. {sapan[0]}")

        if not eski or kod not in eski.get("seriler", {}):
            continue
        e = eski["seriler"][kod]

        if len(aylik) < len(e["aylik"]):
            sorun.append(f"{kod}: ay sayısı azaldı ({len(e['aylik'])} -> {len(aylik)})")
        if s["son_ay"] < e["son_ay"]:
            sorun.append(f"{kod}: son ay geriye gitti ({e['son_ay']} -> {s['son_ay']})")

        # gecmis aylarin oranlari degismemeli (TUIK ufak revizyon yapabilir)
        degisen = []
        for a, ed in e["aylik"].items():
            yd = aylik.get(a)
            if not yd or ed.get("ort12") is None or yd.get("ort12") is None:
                continue
            # Elle eklenen bir ayin TUIK degeriyle degismesi beklenen seydir,
            # alarm sebebi degil.
            if ed.get("_elle"):
                continue
            if abs(yd["ort12"] - ed["ort12"]) > GECMIS_SAPMA:
                degisen.append((a, ed["ort12"], yd["ort12"]))
        if len(degisen) > GECMIS_SAPMA_PAYI:
            ornek = "; ".join(f"{a}: {o}->{y}" for a, o, y in degisen[:3])
            sorun.append(f"{kod}: {len(degisen)} eski ayın oranı değişmiş ({ornek}). "
                         f"TÜİK baz yılı değiştirmiş olabilir - insan bakmalı, --zorla ile geçilir")
        elif degisen:
            print(f"  . {kod}: {len(degisen)} ayda küçük revizyon var, sınır içinde")

    return sorun


def bayatlik_kontrolu(veri, bugun=None):
    """Veri degismediyse: gercekten TUIK yayimlamadi mi, yoksa biz mi goremiyoruz?

    TUIK M ayinin verisini M+1'in 3'unde yayimliyor. Yani ayin 8'inden sonra
    elimizdeki son ay, bir onceki ay olmali. Iki ay geride kaldiysa ya TUIK
    yayimlamayi kesmis ya da bizim ayiklama kodumuz yeni aylari goremez olmus -
    ikisi de sessizce gecilmemeli.
    """
    bugun = bugun or datetime.now(timezone.utc)
    sorun = []
    for kod in ("TUFE", "UFE"):
        s = veri.get("seriler", {}).get(kod)
        if not s:
            continue
        yil, ay = int(s["son_ay"][:4]), int(s["son_ay"][5:7])
        geride = (bugun.year * 12 + bugun.month) - (yil * 12 + ay)
        # ayin ilk gunlerinde 2 ay geride olmak normal (yeni ay henuz cikmadi)
        if geride >= 2 and bugun.day > 8:
            sorun.append(f"{kod}: son veri {s['son_ay']}, bugün {bugun:%Y-%m-%d} - "
                         f"{geride} ay geride")
    return sorun


def ozdes_mi(yeni, eski):
    """cekilme_tarihi haric icerik ayni mi."""
    if not eski:
        return False
    return json.dumps(yeni["seriler"], sort_keys=True, ensure_ascii=False) == \
           json.dumps(eski.get("seriler"), sort_keys=True, ensure_ascii=False)


def main():
    zorla = "--zorla" in sys.argv

    eski = None
    if os.path.exists(CIKTI):
        try:
            eski = json.load(open(CIKTI, encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            print(f"uyarı: mevcut veri okunamadı ({e}), karşılaştırma yapılmayacak")

    try:
        yeni = topla()
    except Exception as e:  # noqa: BLE001
        print(f"HATA: TÜİK'ten veri çekilemedi -> {e}", file=sys.stderr)
        print("Eski veri olduğu gibi duruyor, hiçbir şey yazılmadı.", file=sys.stderr)
        return 1

    elle_koru(yeni, eski)
    sorunlar = guvenlik_kontrolu(yeni, eski)
    if sorunlar:
        print("GÜVENLİK KONTROLÜ TAKILDI:", file=sys.stderr)
        for s in sorunlar:
            print(f"  - {s}", file=sys.stderr)
        if not zorla:
            print("Hiçbir şey yazılmadı. İnceleyip --zorla ile geçebilirsin.", file=sys.stderr)
            return 1
        print("--zorla verildi, kontroller atlanıyor.", file=sys.stderr)

    if ozdes_mi(yeni, eski):
        bayat = bayatlik_kontrolu(yeni)
        if bayat and not zorla:
            print("VERİ BAYATLAMIŞ - sessizce geçilmiyor:", file=sys.stderr)
            for b in bayat:
                print(f"  - {b}", file=sys.stderr)
            print("TÜİK yayımlamayı kesmiş ya da ayıklama kodu yeni ayı göremiyor. "
                  "Elle bakılmalı.", file=sys.stderr)
            return 1
        print("Veri değişmemiş - TÜİK henüz yeni ay yayımlamamış. Yazacak bir şey yok.")
        return 3

    os.makedirs(os.path.dirname(CIKTI), exist_ok=True)
    with open(CIKTI, "w", encoding="utf-8") as f:
        json.dump(yeni, f, ensure_ascii=False, indent=1)
    print(f"yazıldı -> {CIKTI}  ({os.path.getsize(CIKTI) / 1024:.0f} KB)")
    for kod in ("TUFE", "UFE"):
        s = yeni["seriler"][kod]
        onceki = eski["seriler"][kod]["son_ay"] if eski and kod in eski.get("seriler", {}) else "-"
        print(f"  {kod}: son ay {onceki} -> {s['son_ay']}  ({len(s['aylik'])} ay)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
