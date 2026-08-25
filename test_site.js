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
    tagName: etiket, children: [], _dinleyici: {}, _value: "",
    innerHTML: "", textContent: "", hidden: false, checked: false,
    style: { cssText: "", setProperty() {} },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this._dinleyici[t] = this._dinleyici[t] || []).push(f); },
    tetikle(t) { (this._dinleyici[t] || []).forEach(f => f({ preventDefault() {} })); }
  };
  Object.defineProperty(o, "value", {
    get() { return this._value; }, set(v) { this._value = String(v); }, enumerable: true
  });
  return o;
}

const idler = ["form", "tutar", "basAy", "basYil", "bitAy", "bitYil", "kapsam",
               "oranNot", "ozet", "cetvelBaslik", "cetvelAlt", "govde",
               "uyarilar", "kopyala", "yazdir", "kunye", "indir", "indirNot"];

/* Sayfayi bastan kurup calistirir. protokol "file:" verilirse sayfa,
   bilgisayardan acilmis gibi davranmali (indirme baglantisi gizlenir). */
function sayfayiKur(protokol) {
  const kayit = {};
  idler.forEach(id => { kayit[id] = Ogesi(id === "form" ? "form" : "div"); });
  kayit.tutar.value = "2000";
  kayit.basYil.value = "2020";

  const radyolar = { endeks: [], oranTuru: [], referans: [] };
  const tumRadyolar = [];
  [["endeks", "TUFE", true], ["endeks", "UFE", false],
   ["oranTuru", "ort12", true], ["oranTuru", "yillik", false],
   ["referans", "onceki", true], ["referans", "ayni", false]].forEach(([ad, deger, isaretli]) => {
    const o = Ogesi("input"); o.type = "radio"; o.name = ad; o.value = deger; o.checked = isaretli;
    radyolar[ad].push(o); tumRadyolar.push(o);
  });

  const document = {
    getElementById: id => kayit[id] || null,
    createElement: Ogesi,
    querySelector(s) {
      const m = /input\[name="(\w+)"\]:checked/.exec(s);
      return m ? (radyolar[m[1]].find(r => r.checked) || null) : null;
    },
    querySelectorAll: () => tumRadyolar
  };

  const pano = {};
  const window = {
    document,
    location: { protocol: protokol },
    navigator: { clipboard: { writeText(t) { pano.metin = t; return Promise.resolve(); } } },
    print() { pano.yazdirildi = true; },
    Intl, setTimeout
  };
  window.window = window;

  const baglam = vm.createContext(window);
  const betikler = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (betikler.length !== 3) throw new Error("3 gomulu betik bekleniyordu, bulunan: " + betikler.length);
  betikler.forEach((b, i) => {
    try { vm.runInContext(b, baglam); }
    catch (e) { throw new Error("gomulu betik #" + (i + 1) + " patladi: " + e.message); }
  });
  return { kayit, radyolar, tumRadyolar, pano, window };
}

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

console.log("\n--- internetsiz kullanim (engelli agda ise yarayacak kisim) ---");
kontrol("indirme baglantisi var", /id="indir"[^>]*download=/.test(html));
kontrol("yayindayken indirme baglantisi gorunur", kayit.indir.style.display !== "none");

const disHostlar = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map(m => m[1]))]
  .filter(h => !h.includes("w3.org"));
kontrol("disa giden tek bagimlilik Google Fonts",
        disHostlar.every(h => h.startsWith("fonts.g")), disHostlar.join(", "));
console.log("       dis host: " + disHostlar.join(", "));

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

console.log("\n===============================");
console.log(gecen + " gecti, " + kalan + " kaldi");
process.exit(kalan ? 1 : 0);
