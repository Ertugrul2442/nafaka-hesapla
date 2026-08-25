/* kontrol.html (baglanti teshis sayfasi) dogru teshis koyuyor mu.

   Bu sayfa yarin adliyede acilacak ve verdigi cevaba gore ne yapacagimiza
   karar verecegiz. Yanlis teshis, hic teshis olmamasindan kotu.

   Calistir:  node test_kontrol.js
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "kontrol.html"), "utf8");

let gecen = 0, kalan = 0;
const kontrol = (ad, kosul, ek) => kosul
  ? (gecen++, console.log("  ok   " + ad))
  : (kalan++, console.log("  HATA " + ad + (ek ? "\n       " + ek : "")));

function Ogesi(etiket) {
  const o = {
    tagName: etiket, children: [], _dinleyici: {}, _value: "",
    className: "", textContent: "", innerHTML: "", hidden: false,
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, f) { (this._dinleyici[t] = this._dinleyici[t] || []).push(f); },
    tetikle(t) { (this._dinleyici[t] || []).forEach(f => f({ preventDefault() {} })); }
  };
  Object.defineProperty(o, "value", {
    get() { return this._value; }, set(v) { this._value = String(v); }, enumerable: true
  });
  return o;
}

/* sec.site / sec.veri / sec.font : true = ulasiliyor, false = engelli
   sec.depo : localStorage calisiyor mu
   sec.protokol : "https:" ya da "file:"                                */
function calistir(sec) {
  const kayit = {};
  ["karne", "sonuc", "tekrar", "kopyala", "rapor"].forEach(id => { kayit[id] = Ogesi("div"); });
  const head = Ogesi("head");
  const kutu = {};

  const w = {
    document: {
      getElementById: id => kayit[id] || null,
      createElement: Ogesi,
      head
    },
    location: { protocol: sec.protokol || "https:", host: "ertugrul2442.github.io" },
    navigator: { onLine: true, clipboard: { writeText() { return Promise.resolve(); } } },
    Date, Promise, setTimeout, clearTimeout,
    AbortController: class { constructor() { this.signal = {}; } abort() {} },
    localStorage: {
      getItem(k) { if (!sec.depo) throw new Error("SecurityError"); return k in kutu ? kutu[k] : null; },
      setItem(k, v) { if (!sec.depo) { const e = new Error("kapali"); e.name = "SecurityError"; throw e; } kutu[k] = String(v); },
      removeItem(k) { if (!sec.depo) throw new Error("SecurityError"); delete kutu[k]; }
    },
    fetch(url) {
      const veriMi = String(url).indexOf("veri.json") !== -1;
      const izin = veriMi ? sec.veri : sec.site;
      if (!izin) return Promise.reject(new Error("engellendi"));
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve("<title>Nafaka Artış Cetveli</title>"),
        json: () => Promise.resolve({ seriler: { TUFE: { son_ay: "2026-07" } } })
      });
    }
  };
  w.window = w;

  // Google Fonts <link> icin onload/onerror'u secime gore tetikle
  const asilHead = head.appendChild.bind(head);
  head.appendChild = function (c) {
    asilHead(c);
    setImmediate(() => { if (sec.font) { if (c.onload) c.onload(); } else if (c.onerror) c.onerror(); });
    return c;
  };

  const baglam = vm.createContext(w);
  const betikler = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (betikler.length !== 1) throw new Error("tek gomulu betik bekleniyordu, bulunan: " + betikler.length);
  vm.runInContext(betikler[0], baglam);
  return { w, kayit };
}

const bekle = () => new Promise(r => setImmediate(() => setImmediate(() => setImmediate(r))));

(async function () {
  console.log("--- her sey acik (normal bilgisayar) ---");
  let { w } = calistir({ site: true, veri: true, font: true, depo: true });
  await bekle();
  let s = w.__kontrolSonuc;
  kontrol("teshis: her sey yolunda", s.karar.baslik === "Her şey yolunda", s.karar.baslik);
  kontrol("iyi rengi", s.karar.sinif === "sonuc iyi", s.karar.sinif);
  kontrol("veri son ayini okudu", s.sonuclar.veri.not.includes("2026-07"), s.sonuclar.veri.not);
  kontrol("dosya indirmene gerek yok diyor", s.karar.metin.includes("gerek yok"));
  kontrol("depo uyarisi yok", !s.karar.metin.includes("DİKKAT"));

  console.log("\n--- her sey engelli (adliye korkusu) ---");
  ({ w } = calistir({ site: false, veri: false, font: false, depo: true }));
  await bekle();
  s = w.__kontrolSonuc;
  kontrol("teshis: siteye ulasamiyor", s.karar.baslik === "Bu bilgisayar siteye ulaşamıyor", s.karar.baslik);
  kontrol("kotu rengi", s.karar.sinif === "sonuc kotu", s.karar.sinif);
  kontrol("indirilmis dosyayi kullan diyor", s.karar.metin.includes("İndirilmiş dosyayı kullan"));
  kontrol("elle oran girmeyi soyluyor", s.karar.metin.includes("Elle oran ekle"));
  kontrol("girdigin kalici olur diyor", s.karar.metin.includes("kalıcı olur"));
  kontrol("font engeli teshisi bozmadi", !s.karar.metin.includes("yazı tipi"));

  console.log("\n--- site engelli ama veri geliyor ---");
  ({ w } = calistir({ site: false, veri: true, font: true, depo: true }));
  await bekle();
  s = w.__kontrolSonuc;
  kontrol("teshis: sayfa engelli ama veri geliyor",
          s.karar.baslik === "Sayfa engelli ama veri geliyor", s.karar.baslik);
  kontrol("kendini gunceller diyor", s.karar.metin.includes("güncellemeye devam"));

  console.log("\n--- localStorage calismiyor (asil bilinmeyen) ---");
  ({ w } = calistir({ site: false, veri: false, font: false, depo: false, protokol: "file:" }));
  await bekle();
  s = w.__kontrolSonuc;
  kontrol("depo olumsuz isaretlendi", s.sonuclar.depo.ok === false);
  kontrol("hata adini yaziyor", s.sonuclar.depo.not.includes("SecurityError"), s.sonuclar.depo.not);
  kontrol("DIKKAT uyarisi eklendi", s.karar.metin.includes("DİKKAT"), s.karar.metin);
  kontrol("bana bildir diyor", s.karar.metin.includes("bana bildir"));
  kontrol("kalici olur DEMIYOR", !s.karar.metin.includes("kalıcı olur"));

  console.log("\n--- rapor metni ---");
  ({ w } = calistir({ site: true, veri: true, font: false, depo: true }));
  await bekle();
  s = w.__kontrolSonuc;
  kontrol("rapor dort olcumu de iceriyor",
          (s.rapor.match(/^\[[+-]\] /gm) || []).length === 4,
          JSON.stringify(s.rapor));
  kontrol("engelli olan [-] ile isaretli", s.rapor.includes("[-] Yazı tipleri"), s.rapor);
  kontrol("acilan olan [+] ile isaretli", s.rapor.includes("[+] Siteye erişim"), s.rapor);
  console.log("       ornek rapor:\n" + s.rapor.split("\n").map(x => "         " + x).join("\n"));

  console.log("\n--- sayfanin kendisi dis kaynaga bagimli olmamali ---");
  const hostlar = [...new Set([...html.matchAll(/https?:\/\/([a-z0-9.-]+)/g)].map(m => m[1]))]
    .filter(h => !h.includes("w3.org"));
  kontrol("yalnizca olctugu adresler geciyor",
          hostlar.every(h => h === "ertugrul2442.github.io" || h.startsWith("fonts.g")),
          hostlar.join(", "));
  kontrol("stil icinde web fontu yuklenmiyor",
          !/<link[^>]+fonts\.googleapis[^>]*>/.test(html.split("<script>")[0]),
          "sayfa kendi yazi tipini disaridan almamali");

  console.log("\n===============================");
  console.log(gecen + " gecti, " + kalan + " kaldi");
  process.exit(kalan ? 1 : 0);
})();
