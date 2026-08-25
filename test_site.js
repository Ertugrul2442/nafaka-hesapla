/* docs/index.html (yayina giden sayfa) sahte DOM'da calisiyor mu.
   Calistir:  node test_site.js   (once: py -3.13 site_yap.py)  */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const kok = __dirname;
// argumanla baska bir dosya verilebilir - yayindaki sayfayi indirip test etmek icin
const dosya = process.argv[2] || path.join(kok, "docs", "index.html");
if (!fs.existsSync(dosya)) {
  console.error("docs/index.html yok. Once: py -3.13 site_yap.py");
  process.exit(1);
}
const html = fs.readFileSync(dosya, "utf8");

/* --- iskelet DOM ------------------------------------------------------ */
function Ogesi(etiket) {
  const o = {
    tagName: etiket, children: [], _dinleyici: {}, _value: "", _ozn: {},
    innerHTML: "", textContent: "", hidden: false, checked: false, className: "",
    style: { cssText: "", setProperty() {} },
    appendChild(c) { this.children.push(c); return c; },
    setAttribute(a, d) { this._ozn[a] = String(d); },
    getAttribute(a) { return Object.prototype.hasOwnProperty.call(this._ozn, a) ? this._ozn[a] : null; },
    addEventListener(t, f) { (this._dinleyici[t] = this._dinleyici[t] || []).push(f); },
    tetikle(t, olay) { (this._dinleyici[t] || []).forEach(f => f(Object.assign({ preventDefault() {} }, olay))); }
  };
  Object.defineProperty(o, "value", {
    get() { return this._value; }, set(v) { this._value = String(v); }, enumerable: true
  });
  return o;
}

const idler = ["form", "tutar", "basAy", "basYil", "bitAy", "bitYil", "kapsam",
               "oranNot", "ozet", "cetvelBaslik", "cetvelAlt", "govde",
               "uyarilar", "kopyala", "yazdir", "kunye", "indir", "indirNot", "veriUyari",
               "elleKutu", "elleEndeks", "elleYil", "elleAy", "elleOrt12", "elleYillik",
               "elleHata", "elleEkle", "elleListe", "elleDurum"];

/* Tarayicinin localStorage'i gibi davranan basit depo.
   sec.depo ile paylasilirsa "sayfayi kapatip yeniden acma" taklit edilebilir. */
function DepoYap(baslangic, calisir) {
  const kutu = baslangic || {};
  return {
    kutu,
    getItem(k) { if (!calisir) throw new Error("depo kapali"); return k in kutu ? kutu[k] : null; },
    setItem(k, v) { if (!calisir) throw new Error("depo kapali"); kutu[k] = String(v); },
    removeItem(k) { if (!calisir) throw new Error("depo kapali"); delete kutu[k]; }
  };
}

/* Sayfayi bastan kurup calistirir.
   protokol      : "https:" yayindaki sayfa gibi, "file:" indirilen dosya gibi
   sec.bugun     : sahte tarih (veri eskime uyarisini sinamak icin)
   sec.tazeVeri  : fetch'in donecegi veri; null verilirse istek basarisiz olur
   sec.fetchYok  : true ise ortamda fetch hic yok (eski tarayici)             */
function sayfayiKur(protokol, sec) {
  sec = sec || {};
  const kayit = {};
  idler.forEach(id => { kayit[id] = Ogesi(id === "form" ? "form" : "div"); });
  kayit.tutar.value = "2000";
  kayit.basYil.value = "2020";
  // Tarayici, secenekleri HTML'de yazan bir <select>'in degerini ilk secenege
  // ayarlar; shim bunu kendiliginden yapmadigi icin burada taklit ediyoruz.
  kayit.elleEndeks.value = "TUFE";

  const radyolar = { endeks: [], oranTuru: [] };
  const tumRadyolar = [];
  [["endeks", "TUFE", true], ["endeks", "UFE", false],
   ["oranTuru", "ort12", true], ["oranTuru", "yillik", false]].forEach(([ad, deger, isaretli]) => {
    const o = Ogesi("input"); o.type = "radio"; o.name = ad; o.value = deger; o.checked = isaretli;
    radyolar[ad].push(o); tumRadyolar.push(o);
  });

  const document = {
    getElementById: id => kayit[id] || null,
    createElement: Ogesi,
    querySelector(s) {
      const m = /input\[name="(\w+)"\]:checked/.exec(s);
      // Sayfa, shim'in bilmedigi bir radyo grubunu soruyorsa gercek tarayici
      // gibi null doner - yigin izi yerine anlasilir bir test hatasi ciksin.
      if (!m || !radyolar[m[1]]) return null;
      return radyolar[m[1]].find(r => r.checked) || null;
    },
    querySelectorAll: () => tumRadyolar
  };

  const pano = {};
  const cagri = { fetchUrl: null, fetchSayisi: 0 };

  // gercek Date gibi davranan ama "bugun"u sabitlenmis sinif
  let SahteDate = Date;
  if (sec.bugun) {
    SahteDate = class extends Date {
      constructor(...a) { if (a.length === 0) super(sec.bugun.getTime()); else super(...a); }
    };
  }

  const window = {
    document,
    location: { protocol: protokol },
    navigator: { clipboard: { writeText(t) { pano.metin = t; return Promise.resolve(); } } },
    print() { pano.yazdirildi = true; },
    Intl, setTimeout, clearTimeout, Date: SahteDate,
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    Promise,
    localStorage: sec.depo || DepoYap({}, sec.depoBozuk ? false : true)
  };
  if (!sec.fetchYok) {
    window.fetch = (url) => {
      cagri.fetchUrl = url; cagri.fetchSayisi++;
      if (sec.tazeVeri === undefined || sec.tazeVeri === null) {
        return Promise.reject(new Error("ag yok"));
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(sec.tazeVeri) });
    };
  }
  window.window = window;

  const baglam = vm.createContext(window);
  const betikler = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (betikler.length !== 3) throw new Error("3 gomulu betik bekleniyordu, bulunan: " + betikler.length);
  betikler.forEach((b, i) => {
    try { vm.runInContext(b, baglam); }
    catch (e) { throw new Error("gomulu betik #" + (i + 1) + " patladi: " + e.message); }
  });
  return { kayit, radyolar, tumRadyolar, pano, window, cagri };
}

/* fetch zinciri mikro gorevlerde cozuluyor; olcmeden once bosaltalim */
const bekle = () => new Promise(r => setImmediate(() => setImmediate(r)));

/* --- sayfayi yayindaki gibi (https) kur ------------------------------- */
const kurulum = sayfayiKur("https:");
const { kayit, radyolar, tumRadyolar, pano, window } = kurulum;

/* --- olcumler --------------------------------------------------------- */
let gecen = 0, kalan = 0;
const kontrol = (ad, kosul, ek) => kosul
  ? (gecen++, console.log("  ok   " + ad))
  : (kalan++, console.log("  HATA " + ad + (ek ? "\n       " + ek : "")));

console.log("--- gomulu veri ---");
kontrol("veri gomulu geldi", !!window.ENDEKS_VERISI && !!window.ENDEKS_VERISI.seriler);
kontrol("hesap motoru gomulu geldi", typeof window.NafakaHesap === "object");
console.log("       TUFE " + window.ENDEKS_VERISI.seriler.TUFE.ilk_ay + " .. " +
            window.ENDEKS_VERISI.seriler.TUFE.son_ay);

console.log("\n--- ilk render ---");
kontrol("kapsam kutusu dolduruldu", kayit.kapsam.innerHTML.includes("TÜFE"), kayit.kapsam.innerHTML);
kontrol("kunye yazildi", kayit.kunye.textContent.includes("çekildi"), kayit.kunye.textContent);
kontrol("ay listeleri 12'ser", kayit.basAy.children.length === 12 && kayit.bitAy.children.length === 12);
kontrol("cetvel alt basligi endeksi yaziyor", kayit.cetvelAlt.textContent.includes("TÜFE"), kayit.cetvelAlt.textContent);
const satir = (kayit.govde.innerHTML.match(/<tr/g) || []).length;
kontrol("cetvel satirlari uretildi", satir >= 6, "satir=" + satir);
console.log("       cetvel satiri: " + satir);
kontrol("4 ozet kutusu", (kayit.ozet.innerHTML.match(/class="et"/g) || []).length === 4);
kontrol("son donem isaretlendi", kayit.govde.innerHTML.includes('class="sonDonem"'));
kontrol("oran rozeti basildi", kayit.govde.innerHTML.includes('class="rozet"'));

console.log("\n--- sayi dogrulugu ---");
const H = window.NafakaHesap;
const bicim = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function beklenenSon(endeks) {
  const s = H.hesapla(window.ENDEKS_VERISI, {
    endeks, oranTuru: "ort12", referans: "onceki",
    baslangicYil: 2020, baslangicAy: 1, baslangicTutar: 2000,
    bitisYil: +kayit.bitYil.value, bitisAy: +kayit.bitAy.value
  });
  return bicim.format(s.satirlar[s.satirlar.length - 1].aylikTutar);
}
const tufeSon = beklenenSon("TUFE");
kontrol("TUFE son tutari cetvelde", kayit.govde.innerHTML.includes(tufeSon), "aranan " + tufeSon);
console.log("       2020'de 2.000 ₺ -> " + tufeSon + " ₺");

console.log("\n--- endeks degistirince ---");
radyolar.endeks[0].checked = false; radyolar.endeks[1].checked = true;
kayit.form.tetikle("change");
const ufeSon = beklenenSon("UFE");
kontrol("cetvel Yi-UFE'ye guncellendi", kayit.govde.innerHTML.includes(ufeSon), "aranan " + ufeSon);
kontrol("alt baslik Yi-UFE oldu", kayit.cetvelAlt.textContent.includes("Yİ-ÜFE"), kayit.cetvelAlt.textContent);
console.log("       ayni dosya Yi-UFE ile: " + ufeSon + " ₺");

console.log("\n--- kopyalama ve uyari ---");
kayit.kopyala.tetikle("click");
kontrol("pano metni uretildi", pano.metin && pano.metin.includes("Toplam:"));
kayit.bitYil.value = "2040";
kayit.form.tetikle("input");
kontrol("veri bitince uyari basildi", kayit.uyarilar.innerHTML.includes("uyari"),
        kayit.uyarilar.innerHTML.slice(0, 140));

console.log("\n--- artis hep 'onceki ay' orani, secenek yok ---");
kontrol("referans secenegi arayuzden kaldirildi", !/name="referans"/.test(html));
kontrol("hesap cagrisi 'onceki' sabitine baglanmis", /referans:"onceki"/.test(html));
kontrol("cetvel Aralik oranini uyguluyor (Ocak yil donumu)",
        kayit.govde.innerHTML.includes("Aralık 2025 oranı"),
        kayit.govde.innerHTML.slice(-300));
kontrol("dipnot kurali aciklyor", html.includes("Yıl dönümünden bir önceki ayın oranı"));

console.log("\n--- kimse kimsenin verisine karismiyor ---");
kontrol("sayfa hicbir yere veri gondermiyor",
        !/method\s*:\s*["']POST/i.test(html) && !/XMLHttpRequest/.test(html) &&
        !/navigator\.sendBeacon/.test(html) && !/new WebSocket/.test(html));
kontrol("disa giden tek istek okuma amacli veri.json",
        (html.match(/fetch\(/g) || []).length === 1, (html.match(/fetch\([^)]{0,40}/g) || []).join(" | "));

console.log("\n--- internetsiz kullanim (engelli agda ise yarayacak kisim) ---");
kontrol("indirme baglantisi var", /id="indir"[^>]*download=/.test(html));
kontrol("yayindayken indirme baglantisi gorunur", kayit.indir.style.display !== "none");

// Disa giden her istek ISTEGE BAGLI olmali: Google Fonts gelmezse sistem yazi
// tipine duser, kendi sitemize ulasilamazsa gomulu veriyle devam eder.
// Listede baska bir host cikarsa sayfa engelli agda kirilabilir demektir.
const izinli = ["fonts.googleapis.com", "fonts.gstatic.com", "ertugrul2442.github.io"];
const disHostlar = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map(m => m[1]))]
  .filter(h => !h.includes("w3.org"));
kontrol("disa giden host sayisi denetimde",
        disHostlar.every(h => izinli.includes(h)), disHostlar.join(", "));
console.log("       dis host: " + disHostlar.join(", ") + "  (hepsi istege bagli)");

kontrol("web fontu gelmezse Windows karsiligi var",
        /--yazi-sayi:"IBM Plex Mono",Consolas/.test(html) &&
        /--yazi-baslik:"Source Serif 4",Georgia/.test(html) &&
        /--yazi-govde:"Source Sans 3","Segoe UI"/.test(html));
kontrol("sert kodlu yazi yigini kalmamis", !/font-family:"(IBM Plex Mono|Source Serif 4|Source Sans 3)/.test(html));

const yerel = sayfayiKur("file:");
kontrol("file:// ile acilinca indirme baglantisi gizleniyor",
        yerel.kayit.indir.style.display === "none");
kontrol("file:// ile acilinca not degisiyor",
        yerel.kayit.indirNot.textContent.includes("bilgisayarında duruyor"),
        yerel.kayit.indirNot.textContent);
kontrol("file:// ile de cetvel uretiliyor",
        (yerel.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);
kontrol("file:// ile de sayilar dogru", yerel.kayit.govde.innerHTML.includes(tufeSon));

console.log("\n--- belge kabugu (GitHub Pages icin) ---");
kontrol("doctype var", /^<!doctype html>/i.test(html.trim()));
kontrol("lang=tr", /<html lang="tr">/.test(html));
kontrol("charset utf-8", /<meta charset="utf-8">/.test(html));
kontrol("viewport var", /name="viewport"/.test(html));
kontrol("description var", /name="description"/.test(html));
kontrol("favicon var", /rel="icon"/.test(html));
kontrol("sayfa basligi var", html.includes("<title>Nafaka Artış Cetveli</title>"));
kontrol("sablon isaretleri temizlendi", !html.includes("<!--BAS"));
kontrol("govde etiketi var", /<body>/.test(html));

console.log("\n--- tema jetonlari ---");
const stil = /<style>([\s\S]*?)<\/style>/.exec(html)[1];
kontrol("body zemini jetondan", /body\{[^}]*background:var\(--kagit\)/.test(stil.replace(/\s+/g, " ").replace(/ \{/g, "{")));
["--aksan", "--kagit", "--murekkep", "--aksan-uzeri"].forEach(j => {
  const kokta = new RegExp("^:root\\{[\\s\\S]*?" + j + ":", "m").test(stil.trim());
  kontrol("jeton " + j + " bare :root'ta tanimli", kokta);
});
const uc = (stil.match(/--aksan-uzeri:/g) || []).length;
kontrol("aksan-uzeri her uc temada tanimli", uc === 3, "bulunan " + uc);

/* ---- indirilen dosya bir aylik fotograf olarak kalmasin ---- */
(async function () {
  const V = window.ENDEKS_VERISI;
  const sonAy = V.seriler.TUFE.son_ay;

  console.log("\n--- veri tazeligi: ekranda hangisi kullanildigi yaziyor mu ---");
  const agsiz = sayfayiKur("file:");                 // fetch reddediliyor
  await bekle();
  kontrol("ag yokken gomulu veri yaziyor",
          agsiz.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"),
          agsiz.kayit.kapsam.innerHTML.slice(-90));
  kontrol("ag yokken cetvel yine de uretiliyor",
          (agsiz.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);
  kontrol("ag yokken tazeleme adresi dogru",
          agsiz.cagri.fetchUrl === "https://ertugrul2442.github.io/nafaka-hesapla/veri.json",
          String(agsiz.cagri.fetchUrl));

  console.log("\n--- siteden taze veri gelince kendini gunceller mi ---");
  const taze = JSON.parse(JSON.stringify(V));
  const yeniAy = "2026-08";
  ["TUFE", "UFE"].forEach(k => {
    taze.seriler[k].aylik[yeniAy] = { endeks: 140, yillik: 30, ort12: 31 };
    taze.seriler[k].son_ay = yeniAy;
  });
  const guncel = sayfayiKur("file:", { tazeVeri: taze });
  await bekle();
  kontrol("tazelendigi ekranda yaziyor",
          guncel.kayit.kapsam.innerHTML.includes("siteden tazelendi"),
          guncel.kayit.kapsam.innerHTML.slice(-90));
  kontrol("kapsam yeni aya guncellendi",
          guncel.kayit.kapsam.innerHTML.includes("Ağustos 2026"),
          guncel.kayit.kapsam.innerHTML.slice(-140));
  const H2 = window.NafakaHesap;
  const bek = H2.hesapla(taze, {
    endeks: "TUFE", oranTuru: "ort12", referans: "onceki",
    baslangicYil: 2020, baslangicAy: 1, baslangicTutar: 2000,
    bitisYil: +guncel.kayit.bitYil.value, bitisAy: +guncel.kayit.bitAy.value
  });
  const bekBicim = bicim.format(bek.satirlar[bek.satirlar.length - 1].aylikTutar);
  kontrol("cetvel taze veriyle yeniden hesaplandi",
          guncel.kayit.govde.innerHTML.includes(bekBicim), "aranan " + bekBicim);

  console.log("\n--- tazelenen ay cetvele gercekten giriyor mu ---");
  kontrol("dokunulmamis bitis tarihi yeni aya ilerledi",
          guncel.kayit.bitYil.value === "2026" && guncel.kayit.bitAy.value === "8",
          guncel.kayit.bitAy.value + "." + guncel.kayit.bitYil.value);
  kontrol("cetvelin son satiri yeni ayi kapsiyor",
          guncel.kayit.govde.innerHTML.includes("Ağustos 2026"),
          guncel.kayit.govde.innerHTML.slice(-260));

  // kullanici tarihi kendi degistirdiyse tazeleme onun secimini ezmemeli
  const secimli = sayfayiKur("file:", { tazeVeri: taze });
  secimli.kayit.bitYil.value = "2023";
  secimli.kayit.bitAy.value = "6";
  await bekle();
  kontrol("kullanicinin sectigi bitis tarihi korundu",
          secimli.kayit.bitYil.value === "2023" && secimli.kayit.bitAy.value === "6",
          secimli.kayit.bitAy.value + "." + secimli.kayit.bitYil.value);

  console.log("\n--- bozuk/eski cevap gelirse gomulu veriye zarar vermemeli ---");
  const bozuk = sayfayiKur("file:", { tazeVeri: { seriler: { TUFE: {} } } });
  await bekle();
  kontrol("bozuk cevap yok sayildi",
          bozuk.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"));
  kontrol("bozuk cevaba ragmen cetvel duruyor",
          (bozuk.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);

  const geriVeri = JSON.parse(JSON.stringify(V));
  geriVeri.seriler.TUFE.son_ay = "2020-01";
  const geri = sayfayiKur("file:", { tazeVeri: geriVeri });
  await bekle();
  kontrol("daha eski cevap kabul edilmedi",
          geri.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"));

  const eskiTarayici = sayfayiKur("file:", { fetchYok: true });
  await bekle();
  kontrol("fetch olmayan tarayicida sayfa yine calisiyor",
          (eskiTarayici.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);

  console.log("\n--- veri eskiyince yuksek sesle uyariyor mu ---");
  const bugun = sayfayiKur("file:", { bugun: new Date(2026, 7, 25) });
  await bekle();
  kontrol("taze veride uyari yok", bugun.kayit.veriUyari.innerHTML === "",
          bugun.kayit.veriUyari.innerHTML.slice(0, 100));

  const eskimis = sayfayiKur("file:", { bugun: new Date(2027, 2, 20) });
  await bekle();
  kontrol("aylar sonra acilinca UYARI cikiyor",
          eskimis.kayit.veriUyari.innerHTML.includes("eskimiş"),
          eskimis.kayit.veriUyari.innerHTML.slice(0, 120));
  kontrol("uyari guncel adresi veriyor",
          eskimis.kayit.veriUyari.innerHTML.includes("ertugrul2442.github.io/nafaka-hesapla"));
  kontrol("uyari hangi aya kadar dogru oldugunu soyluyor",
          eskimis.kayit.veriUyari.innerHTML.includes("Temmuz 2026"),
          eskimis.kayit.veriUyari.innerHTML.slice(0, 160));
  kontrol("eskimis olsa da cetvel yine uretiliyor",
          (eskimis.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);

  const eskiAmaTazelendi = sayfayiKur("file:", { bugun: new Date(2027, 2, 20), tazeVeri: taze });
  await bekle();
  kontrol("tazelendikten sonra da uyari duruyorsa dogru duruyor (2026-08 hala eski)",
          eskiAmaTazelendi.kayit.veriUyari.innerHTML.includes("Ağustos 2026"),
          eskiAmaTazelendi.kayit.veriUyari.innerHTML.slice(0, 160));

  console.log("\n--- elle oran ekleme ---");
  const depo = DepoYap({}, true);          // ayni "tarayici" - sayfalar arasi paylasilir
  const s1 = sayfayiKur("https:", { depo });
  await bekle();

  // TUIK'in henuz vermedigi ay: gomulu son ayin bir sonrasi
  const s = H.ayCoz(V.seriler.TUFE.son_ay);
  const eksik = H.ayEkle(s.yil, s.ay, 1);
  const eksikKod = H.ayKodu(eksik.yil, eksik.ay);
  kontrol("form eksik olan ilk aya hazir geliyor",
          s1.kayit.elleYil.value === String(eksik.yil) && s1.kayit.elleAy.value === String(eksik.ay),
          s1.kayit.elleAy.value + "." + s1.kayit.elleYil.value);

  // Eksik ayin orani ancak BIR SONRAKI ayda yil donumu olan bir dosyada kullanilir
  // ("onceki ay" kurali). Gercekci senaryo: yil donumu Eylul, elimizde Temmuz'a
  // kadar veri var, Agustos orani TUIK'te acik ama bize gelmemis.
  const ydAy = eksik.ay % 12 + 1;                       // eksik ayin bir sonrasi
  const ydYil = eksik.ay === 12 ? eksik.yil + 1 : eksik.yil;
  s1.kayit.basAy.value = String(ydAy);
  s1.kayit.bitYil.value = String(ydYil);
  s1.kayit.bitAy.value = String(ydAy);
  s1.kayit.elleOrt12.value = "31,25";
  s1.kayit.elleEkle.tetikle("click");
  kontrol("hata cikmadi", s1.kayit.elleHata.innerHTML === "", s1.kayit.elleHata.innerHTML);
  kontrol("girilen oran listede", s1.kayit.elleListe.innerHTML.includes("31,25"),
          s1.kayit.elleListe.innerHTML.slice(0, 200));
  kontrol("listede 'hesapta kullanılıyor' yaziyor",
          s1.kayit.elleListe.innerHTML.includes("hesapta kullanılıyor"));
  kontrol("kapsam yeni aya uzadi",
          s1.kayit.kapsam.innerHTML.includes(H.ayEtiket(eksik.yil, eksik.ay)),
          s1.kayit.kapsam.innerHTML.slice(-140));
  kontrol("cetvelde 'elle girildi' isareti var",
          s1.kayit.govde.innerHTML.includes("elle girildi"),
          s1.kayit.govde.innerHTML.slice(-300));
  kontrol("depoya yazildi", JSON.stringify(depo.kutu).includes("31.25"), JSON.stringify(depo.kutu).slice(0, 160));

  // ayni tarayicida sayfayi yeniden ac
  const s2 = sayfayiKur("https:", { depo });
  s2.kayit.basAy.value = String(ydAy);
  s2.kayit.bitYil.value = String(ydYil);
  s2.kayit.bitAy.value = String(ydAy);
  s2.kayit.form.tetikle("input");
  await bekle();
  kontrol("sayfa yeniden acilinca oran duruyor",
          s2.kayit.elleListe.innerHTML.includes("31,25"));
  kontrol("yeniden acilista da cetvelde kullaniliyor",
          s2.kayit.govde.innerHTML.includes("elle girildi"));

  // siteden taze veri gelmesi elle girileni silmemeli
  const tazeAmaEksik = JSON.parse(JSON.stringify(V));
  const araAy = H.ayKodu(s.yil, s.ay);            // ayni son ay, yani bizim eklenen ay hala yok
  tazeAmaEksik.seriler.TUFE.aylik[araAy] = V.seriler.TUFE.aylik[araAy];
  tazeAmaEksik.cekilme_tarihi = "2027-01-01T00:00:00+00:00";
  const s3 = sayfayiKur("https:", { depo, tazeVeri: tazeAmaEksik });
  await bekle();
  kontrol("tazeleme elle girileni silmedi", s3.kayit.elleListe.innerHTML.includes("31,25"));

  // TUIK o ayi acikladiginda: resmi veri kazanir ama girilen SILINMEZ
  const resmiGeldi = JSON.parse(JSON.stringify(V));
  resmiGeldi.seriler.TUFE.aylik[eksikKod] = { endeks: 140, yillik: 30, ort12: 28.4 };
  resmiGeldi.seriler.TUFE.son_ay = eksikKod;
  const s4 = sayfayiKur("https:", { depo, tazeVeri: resmiGeldi });
  s4.kayit.basAy.value = String(ydAy);
  s4.kayit.bitYil.value = String(ydYil);
  s4.kayit.bitAy.value = String(ydAy);
  s4.kayit.form.tetikle("input");
  await bekle();
  kontrol("resmi veri gelince girilen listede DURUYOR",
          s4.kayit.elleListe.innerHTML.includes("31,25"));
  kontrol("ama artik kullanilmadigi yaziyor",
          s4.kayit.elleListe.innerHTML.includes("TÜİK verisi geldi"),
          s4.kayit.elleListe.innerHTML.slice(0, 260));
  kontrol("hesap resmi orani kullaniyor",
          s4.kayit.govde.innerHTML.includes("28,40") &&
          !s4.kayit.govde.innerHTML.includes("31,25"),
          s4.kayit.govde.innerHTML.slice(-320));

  // silme yalnizca kullanici isteyince
  const silDugmesi = { target: Object.assign(Ogesi("button"), { className: "sil" }) };
  silDugmesi.target.setAttribute("data-endeks", "TUFE");
  silDugmesi.target.setAttribute("data-ay", eksikKod);
  s2.kayit.elleListe.tetikle("click", silDugmesi);
  kontrol("silince listeden kalkti", !s2.kayit.elleListe.innerHTML.includes("31,25"),
          s2.kayit.elleListe.innerHTML.slice(0, 160));
  kontrol("silince depodan da kalkti", !JSON.stringify(depo.kutu).includes("31.25"),
          JSON.stringify(depo.kutu).slice(0, 160));

  console.log("\n--- ASIL SENARYO: evde tazelen, adliyede agsiz ac ---");
  {
    const tarayici = DepoYap({}, true);       // ayni kisinin ayni tarayicisi
    const yeniAyKod = "2026-08";
    const siteVerisi = JSON.parse(JSON.stringify(V));
    ["TUFE", "UFE"].forEach(k => {
      siteVerisi.seriler[k].aylik[yeniAyKod] = { endeks: 141, yillik: 30, ort12: 31 };
      siteVerisi.seriler[k].son_ay = yeniAyKod;
    });

    // 1. adim - evde, internet var
    const evde = sayfayiKur("file:", { depo: tarayici, tazeVeri: siteVerisi });
    await bekle();
    kontrol("evde siteden tazelendi",
            evde.kayit.kapsam.innerHTML.includes("siteden tazelendi"),
            evde.kayit.kapsam.innerHTML.slice(-110));
    kontrol("indirilen veri tarayiciya kaydedildi",
            JSON.stringify(tarayici.kutu).includes("nafaka-veri-onbellek"),
            Object.keys(tarayici.kutu).join(", "));

    // 2. adim - adliyede, ag engelli (fetch reddediliyor)
    const adliyede = sayfayiKur("file:", { depo: tarayici });
    await bekle();
    kontrol("agsizken gomulu veriye DONMEDI",
            !adliyede.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"),
            adliyede.kayit.kapsam.innerHTML.slice(-110));
    kontrol("daha once indirilmis veriyi kullaniyor",
            adliyede.kayit.kapsam.innerHTML.includes("daha önce indirilmiş veri"),
            adliyede.kayit.kapsam.innerHTML.slice(-110));
    kontrol("kapsam yeni ayi gosteriyor",
            adliyede.kayit.kapsam.innerHTML.includes("Ağustos 2026"),
            adliyede.kayit.kapsam.innerHTML.slice(-150));
    kontrol("agsizken yeni ay eskilik uyarisi cikarmiyor",
            adliyede.kayit.veriUyari.innerHTML === "",
            adliyede.kayit.veriUyari.innerHTML.slice(0, 120));

    // 3. adim - onbellekteki veri gomuluden ESKIyse yok sayilmali
    const eskiOnbellek = DepoYap({ "nafaka-veri-onbellek-v1":
      JSON.stringify({ seriler: { TUFE: { son_ay: "2020-01", aylik: {} },
                                  UFE: { son_ay: "2020-01", aylik: {} } } }) }, true);
    const eski = sayfayiKur("file:", { depo: eskiOnbellek });
    await bekle();
    kontrol("eski onbellek yok sayildi, gomulu veri kullanildi",
            eski.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"),
            eski.kayit.kapsam.innerHTML.slice(-110));

    // 4. adim - bozuk onbellek sayfayi kirmamali
    const bozukOnbellek = DepoYap({ "nafaka-veri-onbellek-v1": "{yarim" }, true);
    const bozuk2 = sayfayiKur("file:", { depo: bozukOnbellek });
    await bekle();
    kontrol("bozuk onbellek sayfayi kirmadi",
            (bozuk2.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);
    kontrol("bozuk onbellekte gomulu veriye dusuldu",
            bozuk2.kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"));
  }

  console.log("\n--- depodaki kayit bozuksa ---");
  // Bozuk JSON, deponun calismadigi anlamina GELMEZ: kaydi at, calismaya devam et.
  const cop = sayfayiKur("https:", { depo: DepoYap({ "nafaka-elle-oranlar-v1": "{bozuk" }, true) });
  await bekle();
  kontrol("bozuk JSON sayfayi kirmadi",
          (cop.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);
  kontrol("bozuk JSON 'depo calismiyor' demiyor",
          !cop.kayit.elleDurum.textContent.includes("saklamıyor"),
          cop.kayit.elleDurum.textContent);

  const sacma = sayfayiKur("https:", { depo: DepoYap({ "nafaka-elle-oranlar-v1":
    JSON.stringify({ TUFE: { "2026-08": { ort12: "abc" }, "bozuk-ay": { ort12: 5 },
                             "2026-09": { ort12: 99999 }, "2026-10": { ort12: 31.5 } },
                     UFE: "dizi degil" }) }, true) });
  await bekle();
  kontrol("sayi olmayan deger ayiklandi", !sacma.kayit.elleListe.innerHTML.includes("abc"));
  kontrol("gecersiz ay kodu ayiklandi", !sacma.kayit.elleListe.innerHTML.includes("bozuk-ay"));
  kontrol("aralik disi oran ayiklandi", !sacma.kayit.elleListe.innerHTML.includes("99.999"),
          sacma.kayit.elleListe.innerHTML.slice(0, 240));
  kontrol("gecerli kayit korundu", sacma.kayit.elleListe.innerHTML.includes("31,50"),
          sacma.kayit.elleListe.innerHTML.slice(0, 240));
  kontrol("nesne olmayan seri sayfayi kirmadi",
          (sacma.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);

  console.log("\n--- elle oran: hatali girdi ve bozuk depo ---");
  const s5 = sayfayiKur("https:", { depo: DepoYap({}, true) });
  await bekle();
  s5.kayit.elleOrt12.value = ""; s5.kayit.elleYillik.value = "";
  s5.kayit.elleEkle.tetikle("click");
  kontrol("bos oran reddedildi", s5.kayit.elleHata.innerHTML.includes("En az bir oran"),
          s5.kayit.elleHata.innerHTML);
  s5.kayit.elleOrt12.value = "9999";
  s5.kayit.elleEkle.tetikle("click");
  kontrol("sacma oran reddedildi", s5.kayit.elleHata.innerHTML.includes("arasında olmalı"),
          s5.kayit.elleHata.innerHTML);
  s5.kayit.elleOrt12.value = "abc";
  s5.kayit.elleEkle.tetikle("click");
  kontrol("sayi olmayan reddedildi", s5.kayit.elleHata.innerHTML.includes("sayı olmalı"),
          s5.kayit.elleHata.innerHTML);
  s5.kayit.elleOrt12.value = "25";
  s5.kayit.elleYil.value = String(s.yil);
  s5.kayit.elleAy.value = String(s.ay);          // TUIK verisi olan bir ay
  s5.kayit.elleEkle.tetikle("click");
  kontrol("TUIK verisi olan aya elle girmeye izin yok",
          s5.kayit.elleHata.innerHTML.includes("zaten var"), s5.kayit.elleHata.innerHTML);

  const bozukDepo = sayfayiKur("https:", { depoBozuk: true });
  await bekle();
  kontrol("depo calismiyorsa sayfa yine aciliyor",
          (bozukDepo.kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);
  kontrol("depo calismiyorsa durum bildiriliyor",
          bozukDepo.kayit.elleDurum.textContent.includes("saklamıyor"),
          bozukDepo.kayit.elleDurum.textContent);
  bozukDepo.kayit.basAy.value = String(ydAy);
  bozukDepo.kayit.bitYil.value = String(ydYil);
  bozukDepo.kayit.bitAy.value = String(ydAy);
  bozukDepo.kayit.elleOrt12.value = "31,25";
  bozukDepo.kayit.elleEkle.tetikle("click");
  kontrol("depo calismasa da oran hesaba katildi",
          bozukDepo.kayit.govde.innerHTML.includes("elle girildi"));
  kontrol("depo calismadigi durumu soyluyor",
          bozukDepo.kayit.elleHata.innerHTML.includes("kaydedilemedi"),
          bozukDepo.kayit.elleHata.innerHTML);

  console.log("\n--- yayimlanan veri dosyasi ---");
  // Bu kontrol depodaki yapiyla ilgili; disaridan bir dosya sinaniyorsa atlanir.
  const veriYolu = path.join(kok, "docs", "veri.json");
  kontrol("docs/veri.json uretilmis", fs.existsSync(veriYolu));
  if (fs.existsSync(veriYolu)) {
    const vj = JSON.parse(fs.readFileSync(veriYolu, "utf8"));
    if (dosya === path.join(kok, "docs", "index.html")) {
      kontrol("veri.json ile sayfadaki veri ayni ay",
              vj.seriler.TUFE.son_ay === sonAy, vj.seriler.TUFE.son_ay + " vs " + sonAy);
    } else {
      console.log("  bilgi  dış dosya sınanıyor, veri.json karşılaştırması atlandı");
    }
  }

  console.log("\n===============================");
  console.log(gecen + " gecti, " + kalan + " kaldi");
  process.exit(kalan ? 1 : 0);
})();
