/* Nafaka artis hesabi. Saf fonksiyon - DOM'a dokunmaz, node ile de test edilir. */
(function (kok) {
  "use strict";

  var AY_ADI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

  function ayKodu(yil, ay) {           // (2024, 3) -> "2024-03"
    return yil + "-" + (ay < 10 ? "0" + ay : String(ay));
  }

  function ayCoz(kod) {                // "2024-03" -> {yil:2024, ay:3}
    return { yil: +kod.slice(0, 4), ay: +kod.slice(5, 7) };
  }

  function ayEkle(yil, ay, adet) {     // ay tasmasini dogru yonetir
    var t = yil * 12 + (ay - 1) + adet;
    return { yil: Math.floor(t / 12), ay: (t % 12) + 1 };
  }

  function ayFarki(a, b) {             // b - a, ay cinsinden
    return (b.yil * 12 + b.ay) - (a.yil * 12 + a.ay);
  }

  function ayEtiket(yil, ay) {
    return AY_ADI[ay - 1] + " " + yil;
  }

  /* Bir yildonumunde uygulanacak oranin hangi aya ait olacagini secer.
     "onceki"  : yildonumunden bir onceki ay  (o ana kadar tamamlanan 12 ay)
     "ayni"    : yildonumu ayinin kendisi                                   */
  function referansAy(yil, ay, kural) {
    return kural === "ayni" ? { yil: yil, ay: ay } : ayEkle(yil, ay, -1);
  }

  /*
    secenekler = {
      endeks:      "TUFE" | "UFE",
      oranTuru:    "ort12" | "yillik",
      referans:    "onceki" | "ayni",
      baslangicYil, baslangicAy, baslangicTutar,
      bitisYil, bitisAy          // hesabin durdurulacagi ay (dahil)
    }
  */
  function hesapla(veri, s) {
    var uyarilar = [];
    var seriKutu = veri && veri.seriler && veri.seriler[s.endeks];
    if (!seriKutu) {
      return { satirlar: [], uyarilar: ["Endeks verisi bulunamadı: " + s.endeks], toplam: 0 };
    }
    var aylik = seriKutu.aylik;

    var bas = { yil: +s.baslangicYil, ay: +s.baslangicAy };
    var bit = { yil: +s.bitisYil, ay: +s.bitisAy };
    if (ayFarki(bas, bit) < 0) {
      return { satirlar: [], uyarilar: ["Bitiş tarihi başlangıçtan önce olamaz."], toplam: 0 };
    }

    var satirlar = [];
    var tutar = +s.baslangicTutar;
    var donemBas = bas;
    var donemNo = 0;
    var sonOran = null, sonOranAy = null, sonOranAyEtiket = null;

    while (true) {
      var sonrakiYildonumu = ayEkle(donemBas.yil, donemBas.ay, 12);
      // Donem, bir sonraki yildonumunden onceki ayda ya da bitis ayinda biter.
      var donemSon = ayFarki(sonrakiYildonumu, bit) < 0
        ? bit
        : ayEkle(sonrakiYildonumu.yil, sonrakiYildonumu.ay, -1);

      var ayAdedi = ayFarki(donemBas, donemSon) + 1;

      satirlar.push({
        donemNo: donemNo,
        basYil: donemBas.yil, basAy: donemBas.ay,
        sonYil: donemSon.yil, sonAy: donemSon.ay,
        basEtiket: ayEtiket(donemBas.yil, donemBas.ay),
        sonEtiket: ayEtiket(donemSon.yil, donemSon.ay),
        oran: sonOran,
        oranAyKodu: sonOranAy,
        oranAyEtiket: sonOranAyEtiket,
        aylikTutar: tutar,
        ayAdedi: ayAdedi,
        donemToplami: tutar * ayAdedi
      });
      donemNo++;

      if (ayFarki(sonrakiYildonumu, bit) < 0) break;   // bitis tarihine ulasildi

      // Yildonumunde artis uygula
      var ref = referansAy(sonrakiYildonumu.yil, sonrakiYildonumu.ay, s.referans);
      var refKod = ayKodu(ref.yil, ref.ay);
      var kayit = aylik[refKod];
      var oran = kayit ? kayit[s.oranTuru] : undefined;

      if (oran === undefined || oran === null) {
        uyarilar.push(
          ayEtiket(sonrakiYildonumu.yil, sonrakiYildonumu.ay) + " artışı yapılamadı: " +
          ayEtiket(ref.yil, ref.ay) + " için " + s.endeks + " verisi henüz yayımlanmamış. " +
          "Hesap " + ayEtiket(donemSon.yil, donemSon.ay) + " itibarıyla durduruldu."
        );
        break;
      }

      tutar = tutar * (1 + oran / 100);
      sonOran = oran;
      sonOranAy = refKod;
      sonOranAyEtiket = ayEtiket(ref.yil, ref.ay);
      donemBas = sonrakiYildonumu;
    }

    var toplam = satirlar.reduce(function (t, r) { return t + r.donemToplami; }, 0);
    var toplamAy = satirlar.reduce(function (t, r) { return t + r.ayAdedi; }, 0);

    return { satirlar: satirlar, uyarilar: uyarilar, toplam: toplam, toplamAy: toplamAy };
  }

  var disa = {
    hesapla: hesapla,
    ayKodu: ayKodu, ayCoz: ayCoz, ayEkle: ayEkle,
    ayFarki: ayFarki, ayEtiket: ayEtiket, AY_ADI: AY_ADI
  };

  if (typeof module !== "undefined" && module.exports) module.exports = disa;
  else kok.NafakaHesap = disa;
})(typeof globalThis !== "undefined" ? globalThis : this);
