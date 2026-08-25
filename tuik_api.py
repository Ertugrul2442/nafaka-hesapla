"""TUIK Veri Portali (databrowser2) JSON-stat istemcisi.

TUIK'in acik ucu: https://databrowser2.tuik.gov.tr/api/core
Anahtar/kayit gerektirmez.
"""
import json
import sys
import time
import urllib.request

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = "https://databrowser2.tuik.gov.tr/api/core"
NODE = 1
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"


def _istek(url, govde=None, deneme=3, zaman_asimi=180):
    veri = None
    basliklar = {"User-Agent": UA, "Accept": "application/json"}
    if govde is not None:
        veri = json.dumps(govde).encode("utf-8")
        basliklar["Content-Type"] = "application/json"
    son_hata = None
    for i in range(deneme):
        try:
            req = urllib.request.Request(url, data=veri, headers=basliklar)
            with urllib.request.urlopen(req, timeout=zaman_asimi) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:  # noqa: BLE001
            son_hata = e
            print(f"  ! istek hatasi ({i + 1}/{deneme}): {e}", file=sys.stderr)
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"Istek basarisiz: {url}") from son_hata


def kodlar(veri_seti):
    """Veri setinin tum boyut kod listelerini dondurur."""
    u = f"{BASE}/nodes/{NODE}/datasets/{veri_seti}/columns/full/values"
    return _istek(u)


def yapi(veri_seti):
    return _istek(f"{BASE}/nodes/{NODE}/datasets/{veri_seti}/structure")


def veri(veri_seti, filtre):
    """filtre: {'DEGISIM': ['5'], 'REF_AREA': ['TR'], ...} -> JSON-stat sozlugu."""
    govde = [{"id": k, "values": list(v)} for k, v in filtre.items()]
    u = f"{BASE}/nodes/{NODE}/datasets/{veri_seti}/data"
    return _istek(u, govde)


def duzlestir(js):
    """JSON-stat -> [{boyut kodlari..., 'value': float}] listesi."""
    if not js or "id" not in js:
        return []
    boyut_kodlari = js["id"]
    boyutlar = []
    for d in boyut_kodlari:
        idx = js["dimension"][d]["category"]["index"]
        if isinstance(idx, dict):
            sirali = sorted(idx.items(), key=lambda kv: kv[1])
            boyutlar.append([k for k, _ in sirali])
        else:
            boyutlar.append(list(idx))
    boyutlar_n = [len(b) for b in boyutlar]

    carpanlar = [1] * len(boyutlar_n)
    for i in range(len(boyutlar_n) - 2, -1, -1):
        carpanlar[i] = carpanlar[i + 1] * boyutlar_n[i + 1]

    degerler = js["value"]
    ogeler = degerler.items() if isinstance(degerler, dict) else enumerate(degerler)

    cikti = []
    atlanan = []
    for k, v in ogeler:
        if v is None:
            continue
        n = int(k)
        satir = {}
        for i, d in enumerate(boyut_kodlari):
            satir[d] = boyutlar[i][(n // carpanlar[i]) % boyutlar_n[i]]
        try:
            satir["value"] = float(v)
        except (TypeError, ValueError):
            # TUIK bos hucreyi "" olarak doner; sessizce dusurmuyoruz, sayiyoruz
            atlanan.append((n, v))
            continue
        cikti.append(satir)
    if atlanan:
        print(f"  . {len(atlanan)} bos/gecersiz hucre atlandi", file=sys.stderr)
    return cikti


def etiketler(js, boyut):
    return js["dimension"][boyut]["category"].get("label", {})
