/* Gercek senaryo provasi: bir ay once indirilmis (eskimis) bir kopya,
   yayindaki veri.json'a ulasip kendini tazeliyor mu?

   Bu test AGA CIKAR - internet yoksa atlanir, testi dusurmez.
   Calistir:  node test_canli_tazeleme.js
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const kok = __dirname;
const ADRES = "https://ertugrul2442.github.io/nafaka-hesapla/veri.json";

let gecen = 0, kalan = 0;
const kontrol = (ad, kosul, ek) => kosul
  ? (gecen++, console.log("  ok   " + ad))
  : (kalan++, console.log("  HATA " + ad + (ek ? "\n       " + ek : "")));

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
               "uyarilar", "kopyala", "yazdir", "kunye", "indir", "indirNot", "veriUyari",
               "elleKutu", "elleEndeks", "elleYil", "elleAy", "elleOrt12", "elleYillik",
               "elleHata", "elleEkle", "elleListe", "elleDurum"];

function calistir(html) {
  const kayit = {};
  idler.forEach(id => { kayit[id] = Ogesi(id === "form" ? "form" : "div"); });
  kayit.tutar.value = "2000"; kayit.basYil.value = "2020";
  kayit.elleEndeks.value = "TUFE";

  const radyolar = { endeks: [], oranTuru: [] };
  const tum = [];
  [["endeks", "TUFE", true], ["endeks", "UFE", false],
   ["oranTuru", "ort12", true], ["oranTuru", "yillik", false]].forEach(([ad, d, i]) => {
    const o = Ogesi("input"); o.name = ad; o.value = d; o.checked = i;
    radyolar[ad].push(o); tum.push(o);
  });

  const w = {
    document: {
      getElementById: id => kayit[id] || null,
      createElement: Ogesi,
      querySelector(s) {
        const m = /input\[name="(\w+)"\]:checked/.exec(s);
        return m ? (radyolar[m[1]].find(r => r.checked) || null) : null;
      },
      querySelectorAll: () => tum
    },
    location: { protocol: "file:" },          // indirilmis dosya gibi
    navigator: { clipboard: { writeText() { return Promise.resolve(); } } },
    print() {},
    Intl, setTimeout, clearTimeout, Date, Promise,
    localStorage: { _k: {}, getItem(k){ return k in this._k ? this._k[k] : null; },
                    setItem(k, v){ this._k[k] = String(v); },
                    removeItem(k){ delete this._k[k]; } },
    fetch, AbortController                     // GERCEK ag
  };
  w.window = w;

  const baglam = vm.createContext(w);
  [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .forEach(m => vm.runInContext(m[1], baglam));
  return { kayit, w };
}

(async function () {
  console.log("--- yayindaki veri.json'a ulasilabiliyor mu ---");
  let canli;
  try {
    const y = await fetch(ADRES, { cache: "no-cache" });
    if (!y.ok) throw new Error("HTTP " + y.status);
    canli = await y.json();
  } catch (e) {
    console.log("  ATLANDI - aga cikilamadi: " + e.message);
    console.log("  (Bu test internet ister; yerel testler bundan bagimsiz.)");
    process.exit(0);
  }
  kontrol("veri.json indirildi ve gecerli", !!canli.seriler && !!canli.seriler.TUFE);
  console.log("       yayindaki son ay: " + canli.seriler.TUFE.son_ay);

  console.log("\n--- bir ay eskitilmis kopya kendini tazeliyor mu ---");
  const tam = fs.readFileSync(path.join(kok, "docs", "index.html"), "utf8");

  // Gomulu veriden son ayi silerek "gecen ay indirilmis dosya"yi taklit ediyoruz.
  const m = /window\.ENDEKS_VERISI = (\{[\s\S]*?\});<\/script>/.exec(tam);
  if (!m) throw new Error("gomulu veri bulunamadi");
  const gomulu = JSON.parse(m[1].replace(/<\\\//g, "</"));
  const silinen = gomulu.seriler.TUFE.son_ay;
  ["TUFE", "UFE"].forEach(k => {
    const s = gomulu.seriler[k];
    delete s.aylik[s.son_ay];
    s.son_ay = Object.keys(s.aylik).sort().pop();
  });
  console.log("       kopyadaki son ay " + silinen + " -> " + gomulu.seriler.TUFE.son_ay +
              " yapildi (eskimis dosya taklidi)");
  const eskiHtml = tam.replace(m[1],
    JSON.stringify(gomulu).replace(/<\//g, "<\\/"));

  const { kayit } = calistir(eskiHtml);
  kontrol("once gomulu (eski) veriyle aciliyor",
          kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"));
  const oncekiCetvel = kayit.govde.innerHTML;

  // gercek ag istegi icin biraz bekle
  await new Promise(r => setTimeout(r, 6000));

  kontrol("siteden tazelendigi ekranda yaziyor",
          kayit.kapsam.innerHTML.includes("siteden tazelendi"),
          kayit.kapsam.innerHTML.slice(-110));
  kontrol("kapsam yayindaki son aya yukseldi",
          kayit.kapsam.innerHTML.includes(silinen.slice(0, 4)) &&
          !kayit.kapsam.innerHTML.includes("dosyaya gömülü veri"),
          kayit.kapsam.innerHTML.slice(-110));
  kontrol("cetvel yeniden hesaplandi", kayit.govde.innerHTML !== oncekiCetvel);
  kontrol("cetvel dolu kaldi", (kayit.govde.innerHTML.match(/<tr/g) || []).length >= 6);

  console.log("\n===============================");
  console.log(gecen + " gecti, " + kalan + " kaldi");
  process.exit(kalan ? 1 : 0);
})();
