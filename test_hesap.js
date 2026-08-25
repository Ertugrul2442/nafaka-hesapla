/* Hesap motorunun testleri.  Calistir:  node test_hesap.js  */
const path = require("path");
const fs = require("fs");

const H = require("./hesap.js");
const veri = JSON.parse(fs.readFileSync(path.join(__dirname, "veri", "endeksler.json"), "utf8"));

let gecen = 0, kalan = 0;
function esit(ad, bulunan, beklenen, tolerans = 1e-9) {
  const ok = typeof beklenen === "number"
    ? Math.abs(bulunan - beklenen) <= tolerans
    : bulunan === beklenen;
  if (ok) { gecen++; console.log("  ok   " + ad); }
  else { kalan++; console.log("  HATA " + ad + "\n       bulunan=" + bulunan + "  beklenen=" + beklenen); }
}

console.log("--- tarih yardimcilari ---");
esit("ayEkle tasma yukari", JSON.stringify(H.ayEkle(2024, 12, 1)), JSON.stringify({ yil: 2025, ay: 1 }));
esit("ayEkle tasma asagi", JSON.stringify(H.ayEkle(2024, 1, -1)), JSON.stringify({ yil: 2023, ay: 12 }));
esit("ayEkle 12 ay", JSON.stringify(H.ayEkle(2020, 6, 12)), JSON.stringify({ yil: 2021, ay: 6 }));
esit("ayFarki", H.ayFarki({ yil: 2020, ay: 1 }, { yil: 2021, ay: 1 }), 12);
esit("ayKodu dolgu", H.ayKodu(2024, 3), "2024-03");

console.log("\n--- veriGerideMi: indirilen dosya eskidiyse anlasilmali ---");
const gm = (sonAy, y, m, d) => H.veriGerideMi(sonAy, new Date(y, m - 1, d));
esit("temmuz verisi, 25 agustos -> 1 ay geride, taze", gm("2026-07", 2026, 8, 25).eskimis, false);
esit("temmuz verisi, 2 eylul -> henuz yayim gunu gelmedi, taze", gm("2026-07", 2026, 9, 2).eskimis, false);
esit("temmuz verisi, 20 eylul -> ESKIMIS", gm("2026-07", 2026, 9, 20).eskimis, true);
esit("temmuz verisi, 20 eylul -> 2 ay geride", gm("2026-07", 2026, 9, 20).geride, 2);
esit("temmuz verisi, 15 aralik -> ESKIMIS", gm("2026-07", 2026, 12, 15).eskimis, true);
esit("temmuz verisi, 15 aralik -> 5 ay geride", gm("2026-07", 2026, 12, 15).geride, 5);
esit("aralik verisi, ocak -> yil sinirinda dogru", gm("2025-12", 2026, 1, 20).geride, 1);
esit("aralik verisi, subat -> yil sinirinda ESKIMIS", gm("2025-12", 2026, 2, 20).eskimis, true);

console.log("\n--- elleBirlestir: elle girilen oran resmi veriyle nasil bulusuyor ---");
{
  const kucuk = {
    cekilme_tarihi: "2026-08-25T00:00:00+00:00",
    seriler: {
      TUFE: { ad: "TÜFE", ilk_ay: "2026-06", son_ay: "2026-07",
              aylik: { "2026-06": { ort12: 32.03, yillik: 32.11 },
                       "2026-07": { ort12: 31.9, yillik: 31.75 } }, yillik_aralik: {} },
      UFE:  { ad: "Yİ-ÜFE", ilk_ay: "2026-07", son_ay: "2026-07",
              aylik: { "2026-07": { ort12: 27.54, yillik: 27.83 } }, yillik_aralik: {} }
    }
  };

  const bos = H.elleBirlestir(kucuk, { TUFE: {}, UFE: {} });
  esit("elle girilen yoksa veri aynen kaliyor", bos.veri.seriler.TUFE.son_ay, "2026-07");
  esit("elle girilen yoksa kullanilan bos", bos.kullanilan.length, 0);

  const r = H.elleBirlestir(kucuk, { TUFE: { "2026-08": { ort12: 31.25 } }, UFE: {} });
  esit("eksik ay eklendi", r.veri.seriler.TUFE.aylik["2026-08"].ort12, 31.25);
  esit("elle isareti kondu", r.veri.seriler.TUFE.aylik["2026-08"]._elle, true);
  esit("son_ay ilerledi", r.veri.seriler.TUFE.son_ay, "2026-08");
  esit("kullanilan listesinde", r.kullanilan.length, 1);
  esit("gecersiz yok", r.gecersiz.length, 0);
  esit("resmi aylar bozulmadi", r.veri.seriler.TUFE.aylik["2026-07"].ort12, 31.9);
  esit("kaynak veri degistirilmedi", kucuk.seriler.TUFE.aylik["2026-08"], undefined);
  esit("dokunulmayan seri aynen gecti", r.veri.seriler.UFE.son_ay, "2026-07");

  // RESMI VERI KAZANIR, ama elle girilen SILINMEZ
  const c = H.elleBirlestir(kucuk, { TUFE: { "2026-07": { ort12: 99 } }, UFE: {} });
  esit("resmi veri olan ay ezilmedi", c.veri.seriler.TUFE.aylik["2026-07"].ort12, 31.9);
  esit("elle girilen gecersiz listesinde duruyor", c.gecersiz.length, 1);
  esit("gecersizde girilen deger de duruyor", c.gecersiz[0].girilen.ort12, 99);
  esit("gecersizde resmi deger de var", c.gecersiz[0].resmi.ort12, 31.9);

  // hesap, elle girilen orani kullandigini satirda soylemeli
  // Eylul 2025 baslangic -> ilk yil donumu Eylul 2026 -> referans Agustos 2026,
  // yani elle girdigimiz ay.
  const h = H.hesapla(r.veri, {
    endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
    baslangicYil: 2025, baslangicAy: 9, baslangicTutar: 1000,
    bitisYil: 2026, bitisAy: 9
  });
  esit("elle oran uygulandi", h.satirlar[1].oran, 31.25);
  esit("satir 'elle' isaretli", h.satirlar[1].elle, true);
  esit("baslangic satiri elle degil", h.satirlar[0].elle, false);
  esit("elle oranla tutar dogru", h.satirlar[1].aylikTutar, 1312.5, 1e-9);

  const h2 = H.hesapla(kucuk, {
    endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
    baslangicYil: 2025, baslangicAy: 9, baslangicTutar: 1000,
    bitisYil: 2026, bitisAy: 9
  });
  esit("elle girilmemisken uyari cikiyor", h2.uyarilar.length, 1);
  esit("uyari elle girmeyi oneriyor", /Elle oran ekle/.test(h2.uyarilar[0]), true);
}

console.log("\n--- elle dogrulanmis senaryo: Ocak 2022 baslangic, 1000 TL, TUFE 12 aylik ort ---");
// Referans "onceki" oldugu icin Ocak yildonumlerinde bir onceki Aralik ayinin orani kullanilir.
const ar = k => veri.seriler.TUFE.aylik[k].ort12;
const o2022 = ar("2022-12"), o2023 = ar("2023-12"), o2024 = ar("2024-12"), o2025 = ar("2025-12");
console.log("  TUIK oranlari: 2022-12=" + o2022 + "  2023-12=" + o2023 + "  2024-12=" + o2024 + "  2025-12=" + o2025);

const s = H.hesapla(veri, {
  endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
  baslangicYil: 2022, baslangicAy: 1, baslangicTutar: 1000,
  bitisYil: 2026, bitisAy: 12
});
esit("donem sayisi (2022,23,24,25,26)", s.satirlar.length, 5);
esit("1. donem tutari degismez", s.satirlar[0].aylikTutar, 1000);
esit("1. donem orani yok", s.satirlar[0].oran, null);
esit("1. donem 12 ay", s.satirlar[0].ayAdedi, 12);
esit("2. donem orani = 2022-12 ort12", s.satirlar[1].oran, o2022);
esit("2. donem referans ayi", s.satirlar[1].oranAyKodu, "2022-12");

const b2 = 1000 * (1 + o2022 / 100);
const b3 = b2 * (1 + o2023 / 100);
const b4 = b3 * (1 + o2024 / 100);
const b5 = b4 * (1 + o2025 / 100);
esit("2023 aylik tutar", s.satirlar[1].aylikTutar, b2, 1e-9);
esit("2024 aylik tutar", s.satirlar[2].aylikTutar, b3, 1e-9);
esit("2025 aylik tutar", s.satirlar[3].aylikTutar, b4, 1e-9);
esit("2026 aylik tutar", s.satirlar[4].aylikTutar, b5, 1e-9);
esit("toplam = donemlerin toplami", s.toplam, 12 * (1000 + b2 + b3 + b4 + b5), 1e-6);
esit("toplam ay sayisi", s.toplamAy, 60);
console.log("  -> 2026 aylik nafaka: " + b5.toFixed(2) + " TL  (1000 TL'den)");

console.log("\n--- kismi donem: Haziran 2023 baslangic, Mart 2025 bitis ---");
const s2 = H.hesapla(veri, {
  endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
  baslangicYil: 2023, baslangicAy: 6, baslangicTutar: 5000,
  bitisYil: 2025, bitisAy: 3
});
esit("donem sayisi", s2.satirlar.length, 2);
esit("1. donem 06.2023-05.2024 = 12 ay", s2.satirlar[0].ayAdedi, 12);
esit("2. donem 06.2024-03.2025 = 10 ay", s2.satirlar[1].ayAdedi, 10);
esit("2. donem referans ayi Mayis 2024", s2.satirlar[1].oranAyKodu, "2024-05");
esit("toplam ay", s2.toplamAy, 22);

console.log("\n--- Yi-UFE ve yillik oran secenekleri calisiyor mu ---");
const s3 = H.hesapla(veri, {
  endeks: "UFE", oranTuru: "ort12", referans: "onceki",
  baslangicYil: 2020, baslangicAy: 1, baslangicTutar: 1000, bitisYil: 2021, bitisAy: 12
});
esit("UFE 2021 orani = 2020-12 ort12", s3.satirlar[1].oran, veri.seriler.UFE.aylik["2020-12"].ort12);
const s4 = H.hesapla(veri, {
  endeks: "TUFE", oranTuru: "yillik", referans: "ayni",
  baslangicYil: 2020, baslangicAy: 1, baslangicTutar: 1000, bitisYil: 2021, bitisAy: 12
});
esit("yillik+ayni: referans Ocak 2021", s4.satirlar[1].oranAyKodu, "2021-01");
esit("yillik+ayni: oran = 2021-01 yillik", s4.satirlar[1].oran, veri.seriler.TUFE.aylik["2021-01"].yillik);

console.log("\n--- veri bitince sessizce durmamali, uyarmali ---");
const s5 = H.hesapla(veri, {
  endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
  baslangicYil: 2024, baslangicAy: 1, baslangicTutar: 1000, bitisYil: 2035, bitisAy: 12
});
esit("uyari uretildi", s5.uyarilar.length > 0, true);
console.log("       uyari: " + s5.uyarilar[0]);

console.log("\n--- hatali girdi ---");
const s6 = H.hesapla(veri, {
  endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
  baslangicYil: 2024, baslangicAy: 5, baslangicTutar: 1000, bitisYil: 2023, bitisAy: 1
});
esit("bitis < baslangic reddedildi", s6.uyarilar.length, 1);
esit("satir uretilmedi", s6.satirlar.length, 0);

console.log("\n===============================");
console.log(gecen + " gecti, " + kalan + " kaldi");
process.exit(kalan ? 1 : 0);
