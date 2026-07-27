/**
 * ============================================================================
 * OʻZBEKCHA — the default locale. Every word of the site in Uzbek (Latin).
 * ============================================================================
 * Matches `Dictionary` in content/types.ts, exactly like content/en.ts. Read
 * the honesty rules at the top of en.ts before changing any claim here: they
 * are about what may be ASSERTED, so they survive translation unchanged.
 *
 * ORTHOGRAPHY: `ʻ` is U+02BB (oʻ, gʻ) and `ʼ` is U+02BC (maʼlumot). Both sit
 * inside the Google Fonts `latin` unicode-range, so they render in Space
 * Grotesk and IBM Plex Mono without a fallback face. Do not "fix" them to
 * ASCII apostrophes — that is a different character and reads as a typo.
 *
 * WHAT IS DELIBERATELY LEFT IN ENGLISH: illustrative file names
 * (`meridian_msa_executed.pdf`), the brand name, the mailbox, and the industry
 * terms a CISO reads in English anyway — VPC, SSO, SIEM, air-gap. Translating
 * those would make the page harder to read for exactly the person it is for.
 */

import { brand } from './brand'
import { ROUTES } from './routes'
import type { Dictionary } from './types'

export const uz: Dictionary = {
  site: {
    tagline: 'Kompaniyangiz bilgan hamma narsa. Oʻz devorlaringiz ichida.',
    description:
      'CompanyMind kompaniyangizdagi har bir fayl, suhbat, rasm va qoʻngʻiroqni siz soʻrov bera oladigan yagona miyaga aylantiradi — butunlay oʻz infratuzilmangiz ichida ishlaydi va har bir javob oʻz manbasiga ulanadi.',
  },

  localeSwitcher: { label: 'Til' },
  skipToContent: 'Asosiy qismga oʻtish',
  navA11y: {
    primary: 'Asosiy',
    home: `${brand.name} — bosh sahifa`,
    openMenu: 'Menyuni ochish',
    closeMenu: 'Menyuni yopish',
  },

  nav: [
    { href: ROUTES.product, label: 'Mahsulot' },
    { href: ROUTES.security, label: 'Xavfsizlik' },
    { href: ROUTES.pricing, label: 'Narxlar' },
    { href: ROUTES.about, label: 'Biz haqimizda' },
  ],

  cta: { label: 'Dizayn hamkor boʻling', href: ROUTES.contact },

  footer: {
    blurb:
      'Kompaniyangiz bilgan hamma narsa uchun bitta miya. Sizning infratuzilmangizda, manbaga iqtibos bilan.',
    status: 'maʼlumot chiqishi: 0 bayt',
    groups: [
      {
        title: 'Mahsulot',
        links: [
          { href: ROUTES.product, label: 'Qanday ishlaydi' },
          { href: ROUTES.security, label: 'Xavfsizlik' },
          { href: ROUTES.pricing, label: 'Narxlar' },
        ],
      },
      {
        title: 'Kompaniya',
        links: [
          { href: ROUTES.about, label: 'Biz haqimizda' },
          { href: ROUTES.contact, label: 'Aloqa' },
        ],
      },
      {
        title: 'Huquqiy',
        links: [
          { href: ROUTES.privacy, label: 'Maxfiylik' },
          { href: ROUTES.terms, label: 'Shartlar' },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------------------
   * BOSH SAHIFA — skroll ssenariysi. Har bir sahna uchun bitta kalit.
   * ----------------------------------------------------------------------- */
  home: {
    hero: {
      eyebrow: 'Ichki bilim infratuzilmasi',
      headline: ['Kompaniyangiz', 'bilgan hamma narsa.', 'Oʻz devorlaringiz ichida.'],
      sub: 'Har bir fayl, suhbat, rasm va qoʻngʻiroq uchun bitta miya — butunlay oʻz infratuzilmangiz ichida joylashtiriladi.',
      scrollCue: 'Pastga',
      systemOnline: 'tizim ishga tushdi',
      egressLabel: 'maʼlumot chiqishi:',
      egressValue: '0 bayt',
    },

    problem: {
      label: 'Muammo',
      headline: ['Kompaniyangiz javobni', 'allaqachon biladi.', 'Uni hech kim topolmaydi.'],
      body: 'U mart oyidagi yozishmada. Kimdir nomini oʻzgartirgan PDF ichida. Hech kim matnga oʻgirmagan ovozli xabarda. «final» deb nomlangan faylning toʻrtinchi versiyasida.',
      beats: [
        {
          stat: 'Koʻmilgan',
          line: 'Javob bor. Lekin u kerak boʻlgan odamdan toʻqqizta tizim va ikkita boʻlim naridadir.',
        },
        {
          stat: 'Takrorlangan',
          line: 'Bitta hujjatning toʻrtta versiyasi. Uchtasi notoʻgʻri. Qaysi biri ekanini hech narsa aytmaydi.',
        },
        {
          stat: 'Yoʻqolgan',
          line: 'Buni bilgan odam aprelda ishdan ketdi. Bilim ham u bilan ketdi.',
        },
        {
          stat: 'Qidirib boʻlmaydi',
          line: 'Qidiruv maʼnoni emas, fayl nomini topadi. U rasmni ham, ovozni ham, skanni ham oʻqiy olmaydi.',
        },
      ],
    },

    turn: {
      label: 'Burilish',
      headline: ['Bitta miya.', 'Ichida hamma narsa.'],
      body: 'CompanyMind kompaniyangizdagi har bir manbani oʻqiydi va ularni yagona bogʻlangan indeksga joylaydi. Nusxalar birlashadi. Format ahamiyatini yoʻqotadi. Sochilgan narsa siz soʻrov bera oladigan bitta narsaga aylanadi.',
      seal: 'Va ularning hech biri devorlaringizdan chiqmadi.',
    },

    ask: {
      label: 'Ishonchli',
      headline: ['Istaganingizni soʻrang.', 'Har bir soʻzni kuzating.'],
      body: 'Javoblar maʼlumotlaringiz aslida nima deyayotganidan quriladi. Har bir jumla oʻzi olingan hujjatga iqtibos olib yuradi — ustiga bosing va manbaning oʻzini koʻrasiz.',
      question: 'Meridian shartnomasida maʼlumot rezidentligi boʻyicha nimaga rozi boʻlgan edik?',
      answer: [
        { text: 'Barcha mijoz maʼlumotlari mintaqa ichida qoladi, chegara ortiga uzatilmaydi', cite: 1 },
        { text: 'va saqlash muddati muzokaralarda 18 oyga tushirildi', cite: 2 },
        { text: 'huquq boʻlimi dastlabki 36 oylik shartga eʼtiroz bildirgach.', cite: 3 },
      ],
      sources: [
        { id: 1, kind: 'pdf', name: 'meridian_msa_executed.pdf', detail: 'Ilova 2 · §4.1 · 14-bet' },
        {
          id: 2,
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          detail: '87-qator · «Saqlash (oy)»',
        },
        { id: 3, kind: 'email', name: 're: Meridian redlines', detail: 'Huquq · 12-mart · 09:41' },
      ],
      sourceAria: '{n}-manba: {name}',
      footnote:
        'Manba yoʻq — daʼvo ham yoʻq. Agar maʼlumot buni aytmasa, CompanyMind ham aytmaydi.',
    },

    sovereign: {
      label: 'Suveren',
      headline: ['Hech narsa chiqmaydi.', 'Begona hech narsa kirmaydi.'],
      body: 'CompanyMind maʼlumotlaringiz allaqachon turgan joyda ishlaydi — oʻz serverxonangizda, oʻz VPC’ingizda yoki internetga umuman yoʻli yoʻq mashinada. Ishonish kerak boʻlgan vendor buluti yoʻq, chunki umuman vendor buluti yoʻq.',
      beats: [
        {
          label: 'Tashqariga',
          value: 'Hech narsa uyga qoʻngʻiroq qilmaydi. Telemetriya yoʻq, model API’si yoʻq.',
        },
        {
          label: 'Ichkariga',
          value: 'Bizdan ichkariga yoʻl yoʻq. Sizning oʻrnatmangizga kirish huquqimiz yoʻq.',
        },
        {
          label: 'Air-gap',
          value: 'Toʻliq oflayn ishlaydi. Modellar va indeks oʻrnatma bilan birga keladi.',
        },
      ],
    },

    features: {
      label: 'Imkoniyat',
      headline: ['Bulutdan foydalana olmaydigan', 'kompaniyalar uchun qurilgan.'],
      items: [
        {
          n: '01',
          title: 'Hamma narsani oʻqiydi',
          body: 'Hujjatlar, jadvallar, PDF, elektron pochta, suhbatlar, rasmlar va audio. Skanlar oʻqiladi. Qoʻngʻiroqlar matnga oʻgiriladi. Format endi narsalar yoʻqolishiga sabab boʻlmaydi.',
        },
        {
          n: '02',
          title: 'Iqtibosli javoblar',
          body: 'Har bir jumla oʻzi olingan hujjatga ulanadi. Asl nusxani bir bosishda oching va oʻzingiz tekshiring. Modelning esida qolganiga emas, sizning maʼlumotingizga asoslangan.',
        },
        {
          n: '03',
          title: 'Ruxsatni biladi',
          body: 'Miya sizda allaqachon bor kirish nazoratini hurmat qiladi. Odamlar faqat oʻzlariga ruxsat berilgan narsalardan javob oladi. Hech narsa hamma oʻqiy oladigan yagona uyumga tekislanmaydi.',
        },
        {
          n: '04',
          title: 'Air-gap’ga qodir',
          body: 'Internetga yoʻli yoʻq tarmoqda joylashtiring. Modellar, indeks va interfeys — hammasi lokal ishlaydi. Tizimdagi hech narsa tashqi ulanishni talab qilmaydi.',
        },
        {
          n: '05',
          title: 'Audit izi',
          body: 'Har bir savol, har bir javob, koʻrilgan har bir manba — sizning tizimlaringizda qayd etiladi, auditorlaringiz soʻrov bera oladi, oʻz jadvalingiz boʻyicha saqlanadi.',
        },
      ],
    },

    /**
     * ISBOT — kompaniya hali ishga tushmagan, shuning uchun bu yerda mijoz
     * raqamlari YOʻQ. Har bir raqam TUZILISHI BOʻYICHA rost: u tizim qanday
     * qurilganidan kelib chiqadi. Kechikish yoki aniqlik raqamlarini qoʻshmang.
     */
    proof: {
      label: 'Isbot',
      headline: ['Tuzilishi boʻyicha rost.'],
      body: 'Biz hali ishga tushmaganmiz, shuning uchun bular mijoz raqamlari emas. Bular arxitekturaning xossalari — har qanday oʻrnatmaning birinchi kunidan rost, chunki ular tizim qanday qurilganidan kelib chiqadi.',
      metrics: [
        {
          value: 0,
          suffix: ' bayt',
          label: 'Maʼlumot chiqishi',
          note: 'Hech narsa tashqariga chiqmaydi. Noldan katta raqam berish uchun chiquvchi yoʻlning oʻzi yoʻq.',
        },
        {
          value: 12,
          suffix: '',
          label: 'Manba formatlari',
          note: 'Bugun ishlab chiqilgan oʻqish adapterlari: .docx’dan .m4a’gacha va skanlangan .tiff’gacha.',
        },
        {
          value: 100,
          suffix: '%',
          label: 'Iqtibosli javoblar',
          note: 'Javoblar topilgan parchalardan yigʻiladi. Manbasiz daʼvoni qurib boʻlmaydi.',
        },
        {
          value: 1,
          suffix: '',
          label: 'Oʻrnatma — sizniki',
          note: 'Dizayni boʻyicha bitta ijarachi. Umumiy indeks yoʻq, umumiy infratuzilma yoʻq, qoʻshni yoʻq.',
        },
      ],
    },

    pricing: {
      label: 'Narxlar',
      headline: ['Ikki narx.', 'Bitta suhbat.'],
      body: 'Individual va Jamoa narxlari ochiq koʻrsatilgan, chunki bu bitta dasturning ikki oʻlchami. Korxona tarifi esa oʻz devorlaringiz ichida, oʻz uskunangizda ishlaydi — shuning uchun u sahifada bosilmaydi, balki infratuzilmangizga qarab hisoblanadi.',
      more: 'Har bir tarifda nima borligini koʻring',
    },

    cta: {
      label: 'Dizayn hamkorlar',
      headline: ['Biz bir nechta', 'dizayn hamkor tanlayapmiz.'],
      body: 'CompanyMind bu muammoni yechishga yordam beradigan darajada uni chuqur his qiladigan bir nechta tartibga solinadigan jamoa bilan birga qurilmoqda. Agar bilimingiz sochilgan boʻlsa va maʼlumotingiz tashqariga chiqa olmasa — gaplashishimiz kerak.',
      formLabel: 'Ish pochtangiz',
      formPlaceholder: 'siz@kompaniya.uz',
      submit: 'Suhbatni boshlash',
      sending: 'Yuborilmoqda…',
      fineprint: 'Bitta odamdan bitta javob. Ketma-ketlik yoʻq, axborotnoma yoʻq.',
      success: 'Qabul qilindi. Tez orada bogʻlanamiz.',
      error: `Yuborilmadi. Toʻgʻridan-toʻgʻri ${brand.email} manziliga yozing.`,
    },

    telemetry: {
      artifacts: 'hujjatlar',
      sourcesCited: 'iqtibos manbalari',
      queries: 'soʻrovlar',
      dataEgress: 'maʼlumot chiqishi',
      egressValue: '0 bayt',
      state: 'holat',
      scenes: {
        hero: 'sochilgan',
        problem: 'indekssiz',
        turn: 'oʻqilmoqda',
        ask: 'javob bermoqda',
        sovereign: 'muhrlangan',
        features: 'yigʻilmoqda',
        proof: 'tinch',
        pricing: 'narxlangan',
        cta: 'himoyalangan',
      },
    },

    canvasAlt:
      'Iliq qogʻoz ustidagi jonli diagramma. Chizilgan chegara infratuzilmangizning qirrasini belgilaydi. Uning ichida sochilgan hujjatlar, suhbat xabarlari, PDF fayllar, rasmlar, xatlar, jadvallar va ovozli xabarlar tartibsiz suzib yuradi — baʼzilari takrorlangan, baʼzilari xiralashib yoʻqolgan. Sahifa pastga surilgani sari ular ichkariga oqib, yagona bogʻlangan toʻrga — bitta miyaga uyushadi. Savol shu toʻr orqali oʻtib javob qaytaradi va javobning har bir qismidan u olingan aniq manbagacha chiziqlar tortiladi. Hech narsa hech qachon chegaradan oʻtmaydi.',
  },

  /* -------------------------------------------------------------------------
   * /product — «qanday ishlaydi» sahifasi.
   * Fayl nomlari — MISOL uchun, mijoz oʻz oʻrnatmasida koʻradigan fayllar. Bu
   * keys tadqiqot emas. Demo ostidagi `caption` shuni sahifada aytadi —
   * uni oʻchirmang.
   * ----------------------------------------------------------------------- */
  product: {
    meta: {
      title: 'Mahsulot',
      description:
        'CompanyMind qanday ishlaydi: kompaniyangizdagi har bir manba oʻqiladi va siz soʻrov bera oladigan bitta indeksga uyushtiriladi — har bir jumla oʻzi olingan hujjatga iqtibos bilan.',
    },
    chapterLabel: 'Bob',

    hero: {
      eyebrow: 'Qanday ishlaydi',
      headline: ['Hammasi kiradi.', 'Bitta javob chiqadi.', 'Iqtibossiz hech narsa.'],
      sub: 'CompanyMind kompaniyangizda allaqachon bor har bir manbani oʻqiydi, ularni yagona bogʻlangan indeksga uyushtiradi va shu indeksdan javob beradi. Javobdagi har bir jumla oʻzi olingan hujjatga koʻrsatkich saqlaydi. Bularning bari sizning uskunangizda ishlaydi.',
      pipeline: ['oʻqish', 'uyushtirish', 'soʻrash', 'iqtibos'],
    },

    ingest: {
      chapter: '01',
      label: 'Oʻqish',
      headline: ['Sizdagi hamma narsa.', 'Faqat tartiblisi emas.'],
      body: 'CompanyMind’ni umumiy papkaga, pochta qutisiga, suhbat eksportiga yoki skanlar papkasiga yoʻnaltiring. U topganini oʻqiydi. Shartnoma, unutilgan jadval varagʻi, suratga olingan doska va bir soatlik qoʻngʻiroq — hammasi bir xil narsa boʻlib keladi: miya fikr yurita oladigan matn, asl nusxaga qaytish yoʻli bilan.',
      sources: [
        {
          kind: 'doc',
          name: 'q3_risk_review.docx',
          note: 'Tuzilishi buzilmagan holda oʻqiladi. Sarlavhalar, jadvallar va izohlar oʻzi tashiydigan maʼnoga bogʻlangan qoladi.',
        },
        {
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          note: 'Har bir varaq, har bir qator, har bir katak. Uni yaratgan odam ketganidan beri hech kim ochmagan varaq ham.',
        },
        {
          kind: 'pdf',
          name: 'meridian_msa_executed.pdf',
          note: 'Band-band tahlil qilinadi, shuning uchun iqtibos «14-bet, qayerdadir» emas, «Ilova 2 §4.1» ga koʻrsata oladi.',
        },
        {
          kind: 'scan',
          name: 'scan_0042.tiff',
          note: 'Suratga olingan sahifa — kimdir oʻqimaguncha shunchaki rasm. OCR uni qidiriladigan va iqtibos qilinadigan matnga aylantiradi.',
        },
        {
          kind: 'email',
          name: 're_meridian_redlines.eml',
          note: 'Yozishma tartibi bilan, biriktirmalar qoʻshib, qaror aslida qachon qabul qilingani sanasi bilan.',
        },
        {
          kind: 'chat',
          name: 'deal_desk_export.json',
          note: 'Xabarlar ketma-ketligi, kim va qachon yozgani bilan. Martdagi yozishma endi rivoyat boʻlib qolmaydi.',
        },
        {
          kind: 'image',
          name: 'whiteboard_2026-03-12.jpg',
          note: 'Skrinshotlar, diagrammalar, doska suratlari. Ulardagi matn oʻqiladi va rasm shu matn yonida indekslanadi.',
        },
        {
          kind: 'audio',
          name: 'meridian_call_14mar.m4a',
          note: 'Bir soatlik qoʻngʻiroq vaqt belgili transkriptga aylanadi. 00:41 da nima kelishilgani endi ikki kishining yarim esida qolgan narsa emas.',
        },
      ],
      footnote:
        'Bugun 12 ta oʻqish adapteri ishlab chiqilgan: .docx’dan .m4a’gacha va skanlangan .tiff’gacha.',
    },

    organize: {
      chapter: '02',
      label: 'Uyushtirish',
      headline: ['Sochilgan holda kiradi.', 'Bogʻlangan holda chiqadi.'],
      body: 'Fayllarni oʻqish — oson yarmi. Uni miyaga aylantiradigan narsa keyin sodir boʻladi: nusxalar qisqaradi, formatlar yoʻqoladi va bir xil narsa haqida gapiradigan hamma narsa yonma-yon turadi.',
      beats: [
        {
          title: 'Nusxalar qisqaradi',
          body: '«final» deb nomlangan toʻrtta fayl tarixi bor bitta hujjatga aylanadi. Javob beradigani — aslida imzolangani.',
        },
        {
          title: 'Yagona bogʻlangan indeks',
          body: 'Shartnoma, uni umumlashtirgan jadval qatori va u haqda bahs boʻlgan qoʻngʻiroq endi uchta tizim emas. Ular uchta qoʻshniga aylanadi.',
        },
        {
          title: 'Format ahamiyatini yoʻqotadi',
          body: 'Jumla — slaydda ham, skanda ham, ovozli xabarda ham jumla. Qidiruv fayl kengaytmasi boʻyicha emas, maʼno boʻyicha ishlaydi.',
        },
      ],
      permission: {
        label: 'Hal qiluvchi qism',
        title: 'Boshidanoq ruxsatni biladi',
        body: 'Kirish nazorati maʼlumot bilan birga keladi va unga bogʻlangan qoladi. Faylni hech qachon ocha olmagan odam undan bitta jumlani ham ololmaydi va uni javobdagi iqtibosda koʻrmaydi.',
        emphasis:
          'Ruxsatlar oxirida ustiga qoʻyilgan filtr emas. Ular indeksning xossasi. Hech narsa hamma oʻqiy oladigan bitta uyumga tekislanmaydi.',
      },
    },

    ask: {
      chapter: '03',
      label: 'Soʻrash',
      headline: ['Savol kiradi.', 'Tekshira oladigan javob chiqadi.'],
      body: 'Javoblar model boshqa joyda oʻqiganini eslab qolganidan emas, sizning maʼlumotingiz nima deyayotganidan quriladi. Har bir jumla oʻzi yasalgan parchaga koʻrsatkich saqlaydi va bu koʻrsatkich javobning oʻzida — sizdan ishonish soʻraladigan izohda emas.',
      demo: {
        label: 'Ishlangan misol',
        question: 'Meridian shartnomasida maʼlumot rezidentligi boʻyicha nimaga rozi boʻlgan edik?',
        answerLabel: 'Javob',
        answer: [
          {
            text: 'Barcha mijoz maʼlumotlari mintaqa ichida qoladi: chegara ortiga uzatish ham, xorijiy nusxa ham yoʻq.',
            cite: 1,
          },
          { text: 'Saqlash muddati dastlabki 36 oydan 18 oyga tushirildi.', cite: 2 },
          {
            text: 'Bu oʻzgarishni huquq boʻlimi 36 oylik shartni siyosatdan tashqari deb belgilagach olib bordi.',
            cite: 3,
          },
          {
            text: 'Mijoz 14-mart qoʻngʻirogʻida, oʻchirish har chorakda hujjatlashtirilishi sharti bilan rozi boʻldi.',
            cite: 4,
          },
        ],
        telemetry: ['topildi: 4 parcha', 'iqtibos: 4 hujjat', 'chiqish: 0 bayt'],
        sourcesLabel: 'Manbalar',
        sourcesCount: '{n} ta hujjat',
        sources: [
          { id: 1, kind: 'pdf', name: 'meridian_msa_executed.pdf', detail: 'Ilova 2 · §4.1 · 14-bet' },
          {
            id: 2,
            kind: 'sheet',
            name: 'contract_terms_tracker.xlsx',
            detail: '87-qator · «Saqlash (oy)»',
          },
          { id: 3, kind: 'email', name: 're: Meridian redlines', detail: 'Huquq · 12-mart · 09:41' },
          { id: 4, kind: 'audio', name: 'meridian_call_14mar.m4a', detail: 'Transkript · 00:41:12' },
        ],
        backLabel: 'Daʼvoga qaytish',
        sourceAria: '{n}-manba',
        caption:
          'Misol uchun. Hujjatlar — mijozning oʻz fayllari va javob faqat ulardan yigʻiladi. Har bir belgi aniq hujjat ichidagi joyga — betga, qatorga, vaqt belgisiga — olib boradi va asl nusxani oʻsha joydan ochadi.',
      },
      pipelineLabel: 'Bu qanday sodir boʻldi',
      pipeline: [
        {
          title: 'Oʻqiydi',
          body: 'Savol sizning uskunangizda ishlayotgan model tomonidan indeksingizga qarab talqin qilinadi. Tushunilishi uchun u binodan chiqmaydi.',
        },
        {
          title: 'Topadi',
          body: 'Nomzod parchalar faqat shu odamga allaqachon ruxsat berilgan hujjatlardan olinadi. Boshqa hech narsa nomzod emas.',
        },
        {
          title: 'Yigʻadi',
          body: 'Javob oʻsha parchalardan yoziladi. Har bir jumla oʻzini keltirib chiqargan parchaga koʻrsatkich olib yuradi.',
        },
        {
          title: 'Iqtibos qiladi',
          body: 'Koʻrsatkichlar hujjatlarga va ular ichidagi joylarga olib boradi. Asl nusxani oching va oʻzingiz oʻqing. Butun gap shunda.',
        },
        {
          title: 'Qayd etadi',
          body: 'Savol, javob va koʻrilgan har bir manba sizning audit izingizga, sizning tizimlaringizga, oʻz saqlash jadvalingiz boʻyicha tushadi.',
        },
      ],
      construction:
        'Har bir javob iqtibos olib yuradi, chunki uni boshqacha qurishning iloji yoʻq. Javob topilgan parchalardan yigʻiladi, demak manbasiz jumlaning yasaladigan narsasi yoʻq.',
      empty: {
        title: 'Javob yoʻq boʻlsa',
        body: 'CompanyMind shuni aytadi va qayerlarga qaraganini koʻrsatadi. Tartibga solinadigan hujjatda ishonchli taxmin sukutdan battar.',
      },
      footnote:
        'Manba yoʻq — daʼvo ham yoʻq. Agar maʼlumotingiz buni aytmasa, CompanyMind ham aytmaydi.',
    },

    close: {
      label: 'Keyingisi',
      headline: ['Bularning hech biri', 'hech qachon chiqmaydi.'],
      body: 'Bu sahifadagi har bir qadam — oʻqish, indeks, model, javob, audit jurnali — siz nazorat qiladigan uskunada ishlaydi. Yoʻlda vendor buluti yoʻq, chunki umuman vendor buluti yoʻq. Bu qanday qurilgani va sizdagi mavjud majburiyatlar uchun nimani anglatishi — alohida sahifa.',
      primary: { label: 'Arxitekturani koʻrish', href: ROUTES.security },
      secondary: { label: 'Dizayn hamkor boʻling', href: ROUTES.contact },
    },
  },

  /* -------------------------------------------------------------------------
   * /security — auditoriya: bank yoki shifoxonaning axborot xavfsizligi rahbari.
   * Argument — arxitektura. Bizda sertifikat yoʻq, shuning uchun hech qanday
   * sertifikatga ishora qilmaymiz. `verify` qatorlari sahifaning umurtqasi:
   * oʻquvchi oʻzi tekshira olmaydigan daʼvoni bu yerga qoʻshmang.
   * ----------------------------------------------------------------------- */
  security: {
    meta: {
      title: 'Xavfsizlik',
      description:
        'CompanyMind butunlay sizning perimetringiz ichida ishlaydi. Chiquvchi yoʻl yoʻq, vendor kirishi yoʻq, umumiy ijara yoʻq — va biz qoʻlga kiritmagan sertifikat daʼvolari ham yoʻq. Argument — arxitekturaning oʻzi.',
    },

    hero: {
      label: 'Xavfsizlik',
      headline: ['Bizga hech qachon ishonish', 'shart boʻlmasin deb qurdik.'],
      sub: 'CompanyMind — sizning perimetringiz ichida ishlaydigan dastur. Vendor buluti yoʻq, telemetriya kanali yoʻq, texnik yordam tunneli yoʻq. Bu sahifadagi har bir xossa dastur qayerda ishlashidan kelib chiqadi — demak, bir soʻziga ishonishdan oldin uni oʻz tarmogʻingizda sinab koʻrishingiz mumkin.',
    },

    rail: [
      { label: 'chiqish', value: '0 bayt' },
      { label: 'vendor kirishi', value: 'yoʻq' },
      { label: 'ijara', value: 'yakka — sizniki' },
    ],

    perimeter: {
      label: 'Perimetr',
      headline: ['Xavfsizlik chegarasi —', 'sizning devorlaringiz.'],
      body: 'CompanyMind siz baholashingiz kerak boʻlgan oʻz xavfsizlik chegarasini olib kelmaydi. U sizningkini meros qilib oladi. Qayerda ishlashini tanlang; bu sahifadagi qolgan hamma narsa oʻsha bitta tanlovning natijasi.',
      modes: [
        {
          n: '01',
          name: 'Sizning serverxonangiz',
          line: 'Toza temir yoki oʻz virtualizatsiyangiz — siz allaqachon egalik qiladigan, joylashtiradigan va tekshiradigan uskunada.',
        },
        {
          n: '02',
          name: 'Sizning VPC’ingiz',
          line: 'Sizning bulut hisobingiz, tarmoqchalaringiz, xavfsizlik guruhlaringiz, kalitlaringiz. Bizga ularning hech biriga kirish maʼlumoti berilmaydi.',
        },
        {
          n: '03',
          name: 'Air-gap',
          line: 'Internetga umuman yoʻli yoʻq tarmoq. Modellar va indeks oʻrnatma bilan birga keladi va oflayn ishlaydi.',
        },
      ],
    },

    dataflow: {
      label: 'Maʼlumot oqimi',
      headline: ['Hamma narsa devor', 'ichida sodir boʻladi.'],
      body: 'Oʻqish, indekslash va javob berish — hammasi lokal jarayonlar. Bu diagrammadagi hech bir qadam paketning tarmogʻingizdan chiqishini talab qilmaydi va uni yuboradigan kod yoʻlining oʻzi mavjud emas.',
      wallLabel: 'Sizning infratuzilmangiz',
      stages: [
        {
          label: 'Oʻqish',
          title: 'Sizning manbalaringiz',
          line: 'Fayllar, suhbatlar, xatlar, rasmlar, audio, jadvallar — allaqachon turgan joyidan oʻqiladi.',
        },
        {
          label: 'Indeks',
          title: 'Bitta miya',
          line: 'Lokal tahlil qilinadi, vektorlanadi va bogʻlanadi. Har bir manbaning kirish nazorati u bilan birga yuradi.',
        },
        {
          label: 'Javob',
          title: 'Iqtibos bilan',
          line: 'Topilgan parchalardan yigʻiladi, har biri oʻzi olingan hujjatgacha kuzatiladi.',
        },
      ],
      audit: {
        label: 'Audit',
        line: 'Har bir savol, har bir javob, koʻrilgan har bir manba — sodir boʻlgani zahoti sizning jurnal tizimingizga yoziladi.',
      },
      barriers: [
        {
          dir: 'outbound',
          label: 'Chiquvchi yoʻl yoʻq',
          target: 'Model API’lari · vendor buluti · telemetriya',
          note: 'Bu oʻchirib qoʻyilgan sozlama emas. Tashqariga qoʻngʻiroq qiladigan kodning oʻzi yoʻq.',
        },
        {
          dir: 'inbound',
          label: 'Kiruvchi yoʻl yoʻq',
          target: 'CompanyMind',
          note: 'Tunnel yoʻq, orqa eshik yoʻq, masofaviy yordam seansi yoʻq. Biz sizning oʻrnatmangizga yeta olmaymiz.',
        },
      ],
      caption:
        'Barcha oʻqish, indekslash va javob berish sizning perimetringiz ichida sodir boʻladi. Uni kesib oʻtadigan ikki yoʻl — vendorga tashqariga va bizdan ichkariga — konfiguratsiyada oʻchirilgan emas, umuman qurilmagan.',
    },

    directions: {
      label: 'Uch yoʻnalish',
      headline: ['Chiqish tuzilishi', 'boʻyicha nolga teng.'],
      body: 'Nol — biz erishgan maqsad yoki qoʻygan sozlama emas. Bu arxitektura chiqara oladigan yagona raqam, chunki uni kattalashtiradigan narsa hech qachon qurilmagan.',
      verifyLabel: 'Tekshiring',
      items: [
        {
          label: 'Tashqariga',
          title: 'Hech narsa uyga qoʻngʻiroq qilmaydi.',
          body: 'Telemetriya yoʻq, foydalanish analitikasi yoʻq, litsenziya tekshiruvi yoʻq, xato hisobotlari yoʻq, tashqi model API’si yoʻq. Bu kelgusi versiya jimgina qaytarib yoqib qoʻyishi mumkin boʻlgan katakcha emas. Oʻchiriladigan chiquvchi kod yoʻlining oʻzi yoʻq — demak, tasodifan yoqib qoldiriladigan narsa ham, toʻrtinchi versiyada buziladigan narsa ham yoʻq.',
          verify:
            'Uni «hammasini taqiqla» qoidasi ortiga qoʻying va hech narsa buzilmasligini koʻring.',
        },
        {
          label: 'Ichkariga',
          title: 'Bizda ichkariga yoʻl yoʻq.',
          body: 'Sizning oʻrnatmangizga kirish maʼlumotlarimiz yoʻq. Yordam tunneli yoʻq, bizga qaratilgan tinglovchi xizmat yoʻq, oʻrnatishda yaratiladigan vendor hisobi yoʻq. Hodisa paytida bizni xonada koʻrmoqchi boʻlsangiz, boshqa har qanday pudratchi kabi oʻz kirish jarayoningiz orqali kiritasiz — va bizdan hamkorlik soʻramasdan, xuddi shu yoʻl bilan bekor qilasiz.',
          verify:
            'Oʻrnatishdan keyin katalogingizni tekshiring. Unda bizning hisobimiz yoʻq.',
        },
        {
          label: 'Air-gap',
          title: 'Oflayn — xuddi shu dastur.',
          body: 'Modellar, indeks va interfeys birga keladi va internetga umuman yoʻlsiz ishlaydi. Air-gap oʻrnatmasi qiziqarli qismlari jimgina olib tashlangan qisqartirilgan nashr emas — bu aynan oʻsha dastur, chunki undagi hech narsa boshidan internetni istamagan. Yangilanishlar oʻsha tarmoqqa hamma narsa keladigan yoʻl bilan keladi: siz olib kiradigan, tekshiradigan va oʻrnatishni oʻzingiz tanlaydigan imzolangan paket sifatida.',
          verify: 'Kabelni sugʻurib oling. Savol bering. U javob beradi.',
        },
      ],
    },

    permissions: {
      label: 'Kirish nazorati',
      headline: ['Sizning ruxsatlaringiz,', 'bizning yangilarimiz emas.'],
      body: 'Har qanday bilim vositasining buzilish holati — tekislangan indeks: hamma narsa bitta qidiriladigan hovuzga soʻriladi va endi notoʻgʻri stoldan berilgan savol kengash taqdimotini qaytaradi. CompanyMind bunday hovuzni qurmaydi.',
      points: [
        'Indekslangan har bir parcha oʻzi olingan hujjatning kirish nazoratini olib yuradi.',
        'Qidiruv modelga bitta parcha yetib borishidan oldin soʻrovchining shaxsiga qarab filtrlaydi.',
        'Shaxs sizning katalogingizdan keladi — guruhlaringiz, rollaringiz, bekor qilishlaringiz oʻrnatishda nusxalanmaydi, soʻrov paytida hal qilinadi.',
        'Faylni ocha olmagan odam undan qurilgan javobni ololmaydi. U iqtiboslarda ham koʻrinmaydi, chunki umuman topilmagan.',
      ],
      close: 'Hech narsa kengaytirilmaydi. Hech narsa tekislanmaydi.',
      closeNote:
        'Foydalanuvchining miyaga koʻrinishi — u asosiy tizimlarda allaqachon koʻrgan koʻrinishining oʻzi. Juma kuni katalogingizda kimningdir huquqini bekor qiling va keyingi savolgacha miya uni unutgan boʻladi.',
      trace: {
        label: 'Qidiruv · soʻrovchi boʻyicha filtrlangan',
        asker: 'soʻrovchi: j.reyes · guruh: tahlilchilar',
        rows: [
          { ok: true, file: 'q3_pricing_memo.docx', state: 'topildi' },
          { ok: true, file: 'risk_committee_notes.md', state: 'topildi' },
          { ok: false, file: 'board_deck_2026.pptx', state: 'ruxsat yoʻq · oʻqilmadi' },
        ],
      },
    },

    audit: {
      label: 'Audit',
      headline: ['Har bir savol —', 'qayd etilgan hodisa.'],
      body: 'Savol, javob, manbalar, shaxs, vaqt belgisi. Sizning jurnal tizimingizga, sizning formatingizda, sizning jadvalingiz boʻyicha yoziladi — auditorlaringiz bizga soʻrov yubormasdan soʻrov bera oladi.',
      rows: [
        {
          k: 'Nima qayd etiladi',
          v: 'Berilgan savol, qaytarilgan javob, uni qurish uchun topilgan har bir manba parchasi, soʻragan shaxs va qachonligi.',
        },
        {
          k: 'Qayerga tushadi',
          v: 'Sizning SIEM’ingizga, jurnal quvuringizga, saqlagichingizga. Yozilgan lahzadan boshlab bu sizning diskingizdagi sizning maʼlumotingiz.',
        },
        {
          k: 'Qancha yashaydi',
          v: 'Sizning saqlash jadvalingiz boʻyicha. Bu haqda bizning fikrimiz ham, uni majburlash mexanizmimiz ham yoʻq.',
        },
        {
          k: 'Kim oʻqiy oladi',
          v: 'Siyosatingiz kimni aytsa. Biz u roʻyxatda emasmiz va oʻzimizni qoʻsha oladigan yoʻl ham yoʻq.',
        },
      ],
    },

    inheritance: {
      label: 'Meros',
      headline: ['Sizning nazoratlaringiz', 'buni allaqachon qamrab olgan.'],
      body: 'Sizning muhitingiz ichida ishlaydigan dastur oʻsha muhitni boshqarish uchun allaqachon qoʻllayotgan nazoratlaringiz ostiga tushadi. Bu yerda baholanadigan yangi narsa juda kam — buni shunday qurishning butun maqsadi shu.',
      rows: [
        {
          control: 'Shaxs va kirish',
          line: 'Sizning IdP, SSO, guruhlaringiz va xodim kelishi-koʻchishi-ketishi jarayoningiz. CompanyMind yonida oʻz foydalanuvchi bazasini qurmaydi, siz allaqachon ishlatayotgan tizimga autentifikatsiya qiladi.',
        },
        {
          control: 'Tarmoq siyosati',
          line: 'Sizning segmentatsiyangiz, brandmauer qoidalaringiz, «hammasini taqiqla» chiqish siyosatingiz. U boshqa har qanday ichki xizmat kabi ular ichida turadi va istisno soʻramaydi.',
        },
        {
          control: 'Kalitlarni boshqarish',
          line: 'Sizning KMS yoki HSM. Saqlanayotgan maʼlumot siz saqlaydigan va oʻz ritmingizda almashtiradigan kalitlar bilan shifrlanadi. Biz ularni hech qachon koʻrmaymiz va koʻrsak ham ishlata olmaymiz.',
        },
        {
          control: 'Jurnal va monitoring',
          line: 'Sizning SIEM uning jurnallarini qabul qiladi. Sizning ogohlantirishlaringiz uni qamrab oladi. Navbatchingiz uni siz boshqaradigan hamma narsa bilan bitta ekranda koʻradi.',
        },
        {
          control: 'Zaxira va tiklash',
          line: 'Bu sizning VM va disklaringiz. Mavjud zaxira, tiklash va falokat rejalaringiz unga oʻzgarishsiz tegishli.',
        },
        {
          control: 'Oʻzgarishlarni boshqarish',
          line: 'Relizlar — siz qabul qiladigan, sinovdan oʻtkazadigan va oʻz jadvalingiz boʻyicha tarqatadigan paketlar. Hech narsa oʻzini yangilamaydi, chunki hech narsa yangilanishni izlash uchun tashqariga chiqa olmaydi.',
        },
      ],
      frameworks: {
        label: 'Sizning majburiyatlaringiz haqida',
        body: 'Agar majburiyatlaringiz HIPAA, GLBA, DORA, PCI DSS yoki regulyatorning rezidentlik qoidalari orqali oʻtsa, ular siz allaqachon boshqaradigan va hujjatlashtiradigan muhitga bogʻlanadi. CompanyMind’ni oʻsha muhit ichida ishlatish uni oʻsha majburiyatlar allaqachon qamrab olgan chegara ichida qoldiradi — oʻz javobini, oʻz vendor soʻrovnomasini va oʻz istisnosini talab qiladigan ikkinchi chegarani ochish oʻrniga. Majburiyat sizniki boʻlib qoladi. Joylashtirish modeli shunday qurilganki, uni bajarish uchun biz uchun alohida istisno qilishingiz shart emas.',
      },
    },

    notClaiming: {
      label: 'Ochiq aytamiz',
      headline: ['Biz nimani', 'daʼvo qilmayapmiz.'],
      body: 'Baribir soʻraysiz. Shuning uchun mana, birinchi boʻlib, oʻz soʻzlarimiz bilan — qoʻngʻiroqda bizdan sugʻurib olishingizga hojat qolmasin.',
      items: [
        {
          claim: 'Bizda sertifikat yoʻq.',
          line: 'SOC 2 yoʻq, ISO 27001 yoʻq, HIPAA tasdigʻi yoʻq, FedRAMP ruxsati yoʻq. CompanyMind hali ishga tushmagan. Bu bosqichda boshqacha taassurot qoldiruvchi vendor sahifasi sizga vendor haqida nimadir aytyapti.',
        },
        {
          claim: 'Koʻrsatadigan mijozimiz yoʻq.',
          line: 'Logotiplar yoʻq, keys tadqiqotlar yoʻq, tavsiyalar yoʻq, anonim «yetakchi global bank» yoʻq. Biz hozir birinchi dizayn hamkorlarimizni tanlayapmiz. Referenslar paydo boʻlganda, ular haqiqiy boʻladi va ruxsat bilan nomlanadi.',
        },
        {
          claim: 'Uni buzib boʻlmaydi demaymiz.',
          line: 'Dasturda xatolar boʻladi, bizniki ham istisno emas. Halol daʼvo torroq va foydaliroq: chiquvchi yoʻl yoʻq, vendor kirishi yoʻq, umumiy ijara yoʻq — demak, xatolarimizning taʼsir doirasi sizning perimetringizda, nazoratlaringiz allaqachon turgan joyda toʻxtaydi.',
        },
        {
          claim: 'Bularning hech biri benchmark emas.',
          line: 'Aniqlik foizi yoʻq, kechikish raqami yoʻq, qidiruv bahosi yoʻq. Biz bu raqamlarni qoʻlga kiritmaganmiz, birinchi oʻrnatmadan oldin eʼlon qilinganlari esa marketing arifmetikasi.',
        },
      ],
      close: 'Sertifikat — kompaniya haqidagi bayonot. Arxitektura — tizim haqidagi bayonot.',
      closeNote:
        'Biz ikkinchisini berib, uni oʻzingiz tekshirishingizni afzal koʻramiz — auditlar kelganda esa ular allaqachon shunday ishlagan tizimni taʼriflaydi.',
    },

    cta: {
      label: 'Dizayn hamkorlar',
      headline: ['Xavfsizlik soʻrovnomangizni', 'bizga yuboring.'],
      body: 'Qiyin variantiga erta javob berishni afzal koʻramiz. Agar bu sizning tekshiruvingizdan oʻta oladimi deb hisoblayotgan boʻlsangiz, tekshiruvni olib keling — topologiya, tahdid modeli, auditorlaringiz toʻqqizinchi oyda beradigan savollar. Biz tartibga solinadigan muhitlarda ozgina dizayn hamkor tanlayapmiz va aynan shu suhbatda boʻlishni istaymiz.',
      fineprint: 'Sotuv ketma-ketligi emas, muhandisdan javob.',
    },
  },

  /* -------------------------------------------------------------------------
   * /narxlar
   * Individual va Jamoa raqam bilan chiqadi. Korxona — yoʻq, va sahifa buning
   * sababini bitta jumlada aytadi. BU YERDA HAMON TAQIQLANGAN: sertifikat
   * daʼvolari, SLA va ishlash vaqti raqamlari, joylashtirish muddatlari va
   * har qanday ijtimoiy isbot.
   * ----------------------------------------------------------------------- */
  pricing: {
    meta: {
      title: 'Narxlar',
      description:
        'CompanyMind’ni ishlatishning uch yoʻli: bir kishi uchun oyiga $15, 100 kishigacha jamoa uchun oyiga $1 500 va air-gap hamda ichki oʻrnatmalar uchun alohida hisoblanadigan Korxona tarifi.',
    },

    hero: {
      label: 'Narxlar',
      headline: ['Ikki narx', 'va bitta suhbat.'],
      sub: 'Individual va Jamoa — bitta dasturning ikki oʻlchami, shuning uchun ikkalasi ham raqam bilan chiqadi. Korxona tarifi oʻz devorlaringiz ichida, oʻz uskunangizda ishlaydi — bu qancha turishi infratuzilmaga bogʻliq, shuning uchun uni bosmaymiz, hisoblab beramiz.',
    },

    plans: [
      {
        id: '01',
        name: 'Individual',
        badge: null,
        who: 'Oʻz ishi qidiruv imkoniyatidan oshib ketgan bir kishi uchun — maslahatchi, tahlilchi, sherik, asoschi.',
        price: '$15',
        period: '/ oyiga',
        priceNote: 'Bir kishi, bitta shaxsiy ish maydoni. Oylik, istagan paytda bekor qilasiz.',
        features: [
          'Hech kim yeta olmaydigan bitta shaxsiy ish maydoni.',
          '2 000 tagacha hujjat va 20 GB manba materiali.',
          'Barcha formatlar: hujjatlar, jadvallar, PDF, pochta, suhbatlar, rasmlar va audio.',
          'Iqtibosli javoblar. Har bir daʼvo oʻzi olingan hujjatni ochadi.',
          'Brauzerdan ham, Telegram’dan ham soʻrash.',
          'Pochta orqali qoʻllab-quvvatlash.',
        ],
        cta: 'Bitta oʻrindan boshlash',
      },
      {
        id: '02',
        name: 'Jamoa',
        badge: '100 kishigacha',
        who: 'Miyani savol bermoqchi boʻlgan har bir xodim oldiga qoʻyishga tayyor kompaniya uchun.',
        price: '$1 500',
        period: '/ oyiga',
        priceNote:
          '100 kishigacha — oʻsha $15, faqat hech kim oʻrindiqlarni sanamaydi. 100 dan oshsa, Korxona tarifi.',
        features: [
          'Individualdagi hamma narsa, butun kompaniyaga ochilgan.',
          'Kirish guruhlari: har bir odam faqat oʻziga ruxsat berilgan narsalardan javob oladi.',
          'Egalik paneli — xodim qoʻshish, guruh berish, ortiqcha ochilganini koʻrish.',
          'Ish maydoni uchun bitta Telegram bot: tasdiqlash va har bir kishiga guruh.',
          'Audit eksporti: har bir savol, javob va manba jurnal tizimingizga.',
          'Biznikida joylashtiriladi yoki oʻz VPC’ingizda — narx bir xil.',
          '100 000 tagacha hujjat va 1 TB manba materiali.',
        ],
        cta: 'Jamoa uchun hisoblatish',
      },
      {
        id: '03',
        name: 'Korxona',
        badge: null,
        who: 'Bank, shifoxona tarmogʻi, yuridik firma yoki mudofaa yetkazib beruvchisi uchun — ichki joylashtirish xohish emas, regulyatorning talabi boʻlgan joyda.',
        price: 'Kelishiladi',
        period: '',
        priceNote:
          'Infratuzilmangizga qarab hisoblanadi: qancha oʻqiladi, necha kishi soʻraydi va kimning uskunasida ishlaydi. Air-gap oʻrnatmalari alohida loyiha.',
        features: [
          'Jamoadagi hamma narsa, umuman chiquvchi yoʻlsiz.',
          'Cheklanmagan xodim, cheklanmagan hujjat.',
          'Air-gap oʻrnatma. Modellar, indeks va interfeys birga keladi va oflayn ishlaydi.',
          'Sizning uskunangiz, sizning javonlaringiz, sizning jismoniy nazoratingiz.',
          'IdP orqali SSO, ruxsatlar soʻrov paytida hal qilinadi.',
          'Sohangizga moslashtirilgan modellar, sizning chegarangiz ichida oʻqitiladi.',
          'Oflayn yangilanishlar: siz olib kiradigan va oʻrnatishni tanlaydigan imzolangan paket.',
          'Alohida qoʻllab-quvvatlash — uni qurgan muhandislarga toʻgʻridan-toʻgʻri chiziq.',
        ],
        cta: 'Biz bilan gaplashing',
      },
    ],

    plansNote:
      'Narxlar AQSh dollarida, oyiga, oylik hisob-kitob bilan. Yillik toʻlovda ikki oy bepul. Mahalliy soliqlar kiritilmagan. Bu yerdagi hech narsa shartnoma emas — bogʻlovchi shartlar joylashtirish shartnomasi bilan keladi.',

    everyTier: {
      label: 'Har bir tarifda',
      headline: ['Har bir tarifda,', 'tuzilishi boʻyicha rost.'],
      items: [
        {
          label: 'Joylashtirish',
          value: 'Har bir oʻlchamda bitta dastur. Tariflar orasida masshtab oʻzgaradi, ochiqlik emas.',
        },
        {
          label: 'Chiqish',
          value: 'Hech narsa uyga qoʻngʻiroq qilmaydi. Telemetriya yoʻq, zanjirda model API’si yoʻq.',
        },
        {
          label: 'Iqtiboslar',
          value: 'Har bir daʼvo oʻzi olingan hujjatga ulanadi. Manba yoʻq — daʼvo ham yoʻq.',
        },
        {
          label: 'Audit izi',
          value: 'Savollar, javoblar va manbalar sizning tizimlaringizda, oʻz saqlash jadvalingizda.',
        },
      ],
    },

    faq: {
      label: 'Toʻgʻri javoblar',
      headline: 'Narxlar roʻyxati chetlab oʻtadigan savollar.',
      items: [
        {
          q: 'Nega Korxona tarifida raqam yoʻq?',
          a: 'Chunki ichki oʻrnatma qadoqlangan mahsulot emas. U qancha turishi qancha maʼlumot oʻqilishiga, necha kishi savol berishiga va kimning uskunasida ishlashiga bogʻliq — shifoxonadagi air-gap javoni bilan VPC butunlay boshqa loyiha. Individual va Jamoa — maʼlum oʻlchamdagi bitta dastur, shuning uchun ular bosilgan narx bilan chiqadi. Korxona esa bitta suhbatdan keyin hisoblanadi va oʻsha hisob rost boʻladi.',
        },
        {
          q: 'Jamoa haqiqatan ham Individualning yuz barobarimi?',
          a: 'Narxi — ha: bir boshga $15, yuzta bosh. Dastur esa yoʻq — yuz kishiga kirish guruhlari, ularni taqsimlaydigan egasi va audit izi kerak, bular esa faqat bir kishidan yuqorida mavjud. Siz toʻlamaydigan narsa — har bir oʻrindiq uchun hisoblagich. Seshanba kuni kimnidir qoʻshing, hisob-fakturada hech narsa oʻzgarmaydi.',
        },
        {
          q: 'Bu yerda «ichki joylashtirish» aniq nimani anglatadi?',
          a: 'Dastur maʼlumotlaringiz allaqachon turgan joyda ishlashini — serverxonangizda, VPC’ingizda yoki internetga yoʻli yoʻq mashinada. Uning ortida jimgina asosiy ishni bajaradigan vendor buluti yoʻq. Bizda sizning oʻrnatmangizga kirish ham, maʼlumotingizga yoʻl ham yoʻq.',
        },
        {
          q: 'Joylashtirish siz tomondan nimani talab qiladi?',
          a: 'Ishga tushirish uchun joy, oʻqitmoqchi boʻlgan manbalaringizga kirish maʼlumotlari va SSO uchun identifikatsiya provayderingiz. Oʻrnatishni jamoangiz bajaradi, biz esa devor ortidan arxiv otish oʻrniga ular bilan birga qilamiz. Hajm sizning korpusingizga bogʻliq, shuning uchun bu bu yerdagi izohga emas, hisoblash suhbatiga tegishli.',
        },
        {
          q: 'Sizda SOC 2 yoki HIPAA sertifikati bormi?',
          a: 'Yoʻq. CompanyMind hech qanday sertifikatga ega emas va biz buni nishoncha bilan boshqacha koʻrsatmaymiz. Biz taklif qiladigan narsa arxitektura: dastur majburiyatlaringiz allaqachon qamrab olgan chegara ichida ishlaydi, shuning uchun nazoratlaringiz, jurnallaringiz va auditorlaringiz unga xuddi infratuzilmangizdagi boshqa hamma narsaga yetgandek yetadi. Sertifikatlar sizniki. Bizning ishimiz — ularni saqlashni qiyinlashtirmaslik.',
        },
        {
          q: 'Kichikdan boshlab oʻsishimiz mumkinmi?',
          a: 'Ha, va yoʻlda hech narsa koʻchirilmaydi. Har bir tarif bitta dasturni ishlatadi — kichigi qiziqarli qismlari olib tashlangan demo emas. Oʻsish — qamrovni kengaytirish: koʻproq odam, koʻproq manba va oxir-oqibat oʻz uskunangiz.',
        },
      ],
    },

    cta: {
      label: 'Dizayn hamkorlar',
      headline: ['Har bir tarif oʻsha', 'bitta qoʻngʻiroqdan boshlanadi.'],
      body: 'CompanyMind hali ishga tushmagan. Biz uni bu muammoni yechishga yordam beradigan darajada uni chuqur his qiladigan bir nechta tartibga solinadigan jamoa bilan quryapmiz. Nima sochilganini va u qayerga chiqishi mumkin emasligini ayting — biz sizga joylashtirish qanday koʻrinishini aytamiz.',
      submit: 'Suhbatni boshlash',
      href: ROUTES.contact,
      fineprint: 'Bitta odamdan bitta javob. Ketma-ketlik yoʻq, axborotnoma yoʻq.',
    },
  },

  /* -------------------------------------------------------------------------
   * /biz haqimizda — kompaniya tarixi emas, pozitsiya.
   * Bu yerda ISM YOʻQ va haqiqiy odamlar paydo boʻlmaguncha boʻlmaydi.
   * ----------------------------------------------------------------------- */
  about: {
    meta: {
      title: 'Biz haqimizda',
      description:
        'Eng yaxshi sunʼiy intellekt API sifatida keladi — iqtisodiyotdagi eng nozik maʼlumotlarni saqlaydigan muassasalar esa unga hech qachon murojaat qila olmaydi. CompanyMind nega suveren bilim infratuzilmasini quradi va biz qayerda turibmiz.',
    },

    hero: {
      eyebrow: 'Biz haqimizda',
      headline: ['Eng yaxshi AI', 'boshqa birovning', 'kompyuterida', 'ishlaydi.'],
      sub: 'Bank, shifoxona, mudofaa yetkazib beruvchisi yoki yuridik firma uchun bu tarozida oʻlchanadigan murosa emas. Bu — boshlanmaydigan suhbat. Shunday qilib, iqtisodiyotdagi eng muhim maʼlumotlarni saqlaydigan muassasalar bir avlodning eng foydali texnologiyasidan chetda qolmoqda. Tuzatishga arziydigan narsa aynan shu.',
    },

    position: {
      label: 'Pozitsiya',
      headline: ['Imkoniyat bitta shart', 'bilan birga keldi.'],
      body: [
        'Soʻnggi uch yildagi har bir jiddiy sakrash bir xil yoʻl bilan yetkazildi: endpoint sifatida. Undan foydalanish uchun maʼlumotingizni siz nazorat qilmaydigan kompaniyaga, siz tekshira olmaydigan uskunada, siz yozmagan shartlar ostida yuborasiz. Aksariyat biznes uchun bu maqbul kelishuv. Baʼzilari uchun esa suhbat birinchi uchrashuvda tugaydi.',
        'Bu ehtiyotkorlik ham, texnologiyadan qoʻrqish ham emas. Bu — ish. Nazoratchiga vendorning maxfiylik siyosati bilan javob bera olmaysiz. Imtiyozli materialni birovning jurnaliga qoʻya olmaysiz. Bu muassasalar ishlaydigan qoidalar ularni koʻndirib boʻladigan xohish emas — aynan shu qoidalar tufayli ularga bu maʼlumot ishonib topshirilgan.',
      ],
      ledger: {
        colWho: 'Kim tashqarida qolgan',
        colWhy: 'Nega',
        rows: [
          {
            who: 'Bank',
            why: 'Regulyatorga jadval boʻyicha va yozma javob beradigan mijoz yozuvlari.',
          },
          {
            who: 'Shifoxona',
            why: 'Oʻzi qayta talqin qila olmaydigan qoidalar ostida himoya qilishi shart boʻlgan bemor maʼlumotlari.',
          },
          {
            who: 'Mudofaa yetkazib beruvchisi',
            why: 'Umumiy tarmoqqa umuman tegishi taqiqlangan dasturlar.',
          },
          {
            who: 'Yuridik firma',
            why: 'Advokatlik sirida saqlaydigan va uchinchi tomonga bera olmaydigan mijoz materiali.',
          },
        ],
      },
      closer: 'Texnologiya ular uchun ishlaydi. Yetkazib berish modeli — yoʻq.',
      closerBody:
        'Buni tashqaridan hech kim tuzatmaydi, chunki ragʻbat teskari tomonga qaragan: joylashtirilgan endpoint’ni qurish oson, hisoblash oson, sotish oson. Shuning uchun biz boshqa variantni quryapmiz — xuddi shu sinfdagi tizim, faqat devor ortiga emas, devor ichiga yetkaziladi.',
    },

    beliefs: {
      label: 'Nimaga ishonamiz',
      headline: ['Uch narsada biz', 'murosaga bormaymiz.'],
      items: [
        {
          n: '01',
          title: 'Manbasiz javob — mish-mish.',
          body: 'Tartibga solinadigan biznesda manbasiz javob — javob emas, ish. Endi kimdir uning rostligini tekshirishi kerak. CompanyMind javoblarni topilgan parchalardan quradi va har bir jumlani oʻzi olingan hujjatga iqtibos qiladi, chunki tekshirib boʻlmaydigan javob umuman javobsizlikdan arzonroq.',
        },
        {
          n: '02',
          title: 'Dastur maʼlumot turgan joyda ishlashi kerak.',
          body: 'Nozik maʼlumotni koʻchirish koʻpchilik arxitekturaning eng xavfli qismi va aksariyat vendorlar buni baribir siz qiling deb hal qiladi. Bizningcha, joylashtirish muassasaga moslashadi: sizning serverxonangiz, VPC’ingiz, air-gap javoningiz. Nazoratlaringiz oʻsha chegarani allaqachon qamrab olgan. Biz atrofimizga yangisini chizishingizni soʻramaymiz.',
        },
        {
          n: '03',
          title: 'Nazorat imkoniyatning narxi emas.',
          body: 'Kuchli AI bilan oʻz maʼlumotingiz ustidan nazorat orasida tanlash — texnologiyaning xossasi emas, bu sanoat qanday yetkazishni tanlaganining natijasi. Modellarni oʻz uskunangizda ishlating va indeksni oʻz disklaringizda saqlang — murosa yoʻqoladi. Qurish qiyinroq. Imkonsiz emas.',
        },
      ],
    },

    stage: {
      label: 'Bosqich',
      headline: ['Ishga tushmagan.', 'Buni ochiq aytamiz.'],
      body: 'CompanyMind bu muammoni yechishga yordam beradigan darajada uni chuqur his qiladigan bir nechta tartibga solinadigan jamoa bilan qurilmoqda. Bosqichimiz haqidagi qolgan hamma narsa shu sahifada, qoʻlimizdan kelgan eng sodda tilda — chunki muqobili buni keyinroq oʻzingiz bilib olishingizni soʻrash boʻlardi.',
      inventory: [
        {
          k: 'Mijozlar',
          v: 'Hozircha yoʻq. Bu saytda logotiplar qatori yoʻq, chunki unga qoʻyish uchun halol narsa yoʻq.',
        },
        {
          k: 'Sertifikatlar',
          v: 'Yoʻq. Bugun bizda hech qanday xavfsizlik sertifikati yoʻq va biz buni nishoncha bilan boshqacha koʻrsatmaymiz. Auditdan oʻtganimizda aytamiz va siz buni tekshira olasiz.',
        },
        {
          k: 'Keys tadqiqotlar',
          v: 'Yoʻq. Ishga tushmagan boʻlish — oʻqishga arziydiganini yozadigan darajada uzoq ishlagan oʻrnatma yoʻq degani.',
        },
        {
          k: 'Daromad',
          v: 'Yoʻq. Biz hali oʻrindiq sotmayapmiz. Biz hamkor tanlayapmiz.',
        },
      ],
      have: 'Bizda bor narsa: har bir qatorini himoya qila oladigan pozitsiya va xossalari har qanday oʻrnatmaning birinchi kunidan rost boʻlgan arxitektura — chunki ular tizim qanday qurilganidan kelib chiqadi, uni necha kishi sotib olganidan emas.',
    },

    lab: {
      label: 'Laboratoriya',
      headline: ['Kichik jamoa —', 'ataylab.'],
      body: 'Suveren dastur sotuv muammosiga aylanishidan ancha oldin muhandislik muammosi. U biz hech qachon kirmagan binoga, biz nazorat qilmaydigan uskunaga, uyga yoʻlsiz va xonada CompanyMind’dan hech kim boʻlmagan holda oʻrnatilishi kerak. Bunday ish butun tizimni boshida tuta oladigan kichik jamoani mukofotlaydi. Quyida u qanday boʻlinishi.',
      note: 'Rollar, portretlar emas. Ismlar haqiqiylari paydo boʻlganda qoʻyiladi.',
      roles: [
        {
          n: '01',
          title: 'Asoschi / ML',
          focus: 'pozitsiya · qidiruv · asoslash',
          nameSlot: 'ism keyinroq',
          body: 'Model qatlamiga egalik qiladi: qidiruv, asoslash va javobni u qurilgan manba materiali ichida ushlab turadigan post-training ishi. CompanyMind nima qilishdan bosh tortishini hal qiladi. Birinchi xatingizga javob beradigan odam ham shu.',
        },
        {
          n: '02',
          title: 'Tizimlar',
          focus: 'joylashtirish · inference · air gap',
          nameSlot: 'ism keyinroq',
          body: 'Oʻrnatishga egalik qiladi. CompanyMind’ni shunday qadoqlaydiki, u biz hech koʻrmagan serverxonaga tushadi, mijozning oʻz GPU’larida ishlaydi va javon yonida muhandis turmasdan air-gap orqali yangilanishlarni qabul qiladi.',
        },
        {
          n: '03',
          title: 'Amaliy tadqiqot',
          focus: 'oʻqish · qidiruv sifati · baholash',
          nameSlot: 'ism keyinroq',
          body: 'Muammoning eng qaysar tomonida ishlaydi: matn suratlari boʻlgan skanlar, hech kim transkript qilmagan yozuvlar, aslida maʼlumotlar bazasi boʻlgan jadvallar. Sifatni mijozning chegarasi ichida oʻlchaydigan baholash tizimini quradi, chunki biz ularning maʼlumotiga hech qachon oʻzimiz qaray olmaymiz.',
        },
        {
          n: '04',
          title: 'Xavfsizlik muhandisligi',
          focus: 'perimetr · audit izi · tekshiruv',
          nameSlot: 'ism keyinroq',
          body: 'Arxitekturamizni mijozning auditori oʻqiydigan koʻz bilan oʻqiydi, keyin oʻsha auditor soʻraydigan narsani quradi: maʼlumot oqimi hujjatlari, joylashtirish topologiyasi, mijozning oʻz tizimlariga tushadigan audit izi. Tekshirishni ularning nazoratlari bajaradi. Bizning ishimiz — ularga taxmin qiladigan hech narsa qoldirmaslik.',
        },
      ],
    },

    cta: {
      label: 'Dizayn hamkorlar',
      headline: ['Maʼlumotingiz chiqa olmasa,', 'gaplashishimiz kerak.'],
      body: 'Biz buni birga qurish uchun bir nechta tartibga solinadigan jamoa tanlayapmiz. Siz tizimni oʻz devorlaringiz ichida olasiz va u nimaga aylanishiga haqiqiy taʼsir koʻrsatasiz. Biz esa ishga tushishdan oldin qoʻlga kiritish arziydigan yagona narsani olamiz: bu ishlaydimi degan savolga rost javob.',
      fineprint: 'Bitta odamdan bitta javob. Ketma-ketlik yoʻq.',
    },
  },

  /* -------------------------------------------------------------------------
   * /aloqa — dizayn hamkor tanlash.
   * Quyidagi har bir vaʼda kichik jamoaning pochta qutisi bajara oladigan
   * vaʼda. Kimdir haqiqatan javobgar boʻlmasa, javob muddatini qoʻshmang.
   * ----------------------------------------------------------------------- */
  contact: {
    meta: {
      title: 'Aloqa',
      description:
        'CompanyMind birga qurish uchun bir nechta tartibga solinadigan jamoa tanlayapti. Agar bilimingiz sochilgan boʻlsa va maʼlumotingiz infratuzilmangizdan chiqa olmasa — suhbatni boshlang.',
    },

    hero: {
      eyebrow: 'Dizayn hamkorlar',
      headline: ['Biz buni birga', 'quradigan bir nechta', 'jamoa tanlayapmiz.'],
      lede: 'CompanyMind hali ishga tushmagan. Hozircha mijoz yoʻq, sertifikat yoʻq, sotuv mashinasi yoʻq. Bizda bor narsa — himoya qila oladigan arxitektura va bizga yordam beradigan jamoalar atrofida hali egiladigan darajada yumshoq mahsulot.',
    },

    fit: {
      label: 'Moslik',
      title: 'Bu kim uchun',
      body: 'Bank, shifoxona tarmogʻi, yuridik firma, mudofaa yetkazib beruvchisi. Maʼlumot haqiqatan chiqa olmaydigan va bu xohish emas, regulyatorning chizigʻi boʻlgan joy. Agar umuman AI qiziqtirsa, biz notoʻgʻri manzilmiz. Agar hech kim qidira olmaydigan va hech kimga yuklashga ruxsat berilmaydigan aniq bir bilim uyumingiz boʻlsa — toʻgʻri manzilmiz.',
      points: [
        {
          label: 'Ichki joylashtirish — muhokamasiz',
          line: 'Maʼlumotingiz infratuzilmangizdan chiqa olmaydi va yuqoridagi kimdir buni allaqachon yozib qoʻygan.',
        },
        {
          label: 'Tartibsizlik haqiqiy',
          line: 'Oʻn yillik fayllar, yozishmalar, yozuvlar va skanlar. Javob ichida ekanini allaqachon bilasiz.',
        },
        {
          label: 'Joylashtira olasiz',
          line: 'Siz tomondan kimdir bizga uskuna va ishlaydigan tarmoq bera oladi.',
        },
        {
          label: 'Biz bilan bahslashasiz',
          line: 'Dizayn hamkorlar yoʻl xaritasini egadi. Bu faqat xato qilganimizda aytsangiz ishlaydi.',
        },
      ],
      trade:
        'Kelishuv ochiq. Siz muammoingiz atrofida shakllangan mahsulot va uni quruvchilarga toʻgʻridan-toʻgʻri kirish olasiz. Shuningdek, tugallanmagan mahsulot va birinchi boʻlishning barcha xatolarini ham olasiz.',
    },

    next: {
      label: 'Yuborgandan keyin',
      title: 'Keyin nima boʻladi',
      steps: [
        { n: '01', line: 'Uni odam oʻqiydi. Ball qoʻyadigan model ham, sotuv navbati ham emas.' },
        { n: '02', line: 'Bitta javob olasiz. Mos kelmasa, jim qolish oʻrniga shuni aytamiz.' },
        { n: '03', line: 'Mos kelsa, qoʻngʻiroq taklif qilamiz va tizimni ishlayotgan holda koʻrsatamiz.' },
      ],
      promise:
        'Bitta odamdan bitta javob. Ketma-ketlik yoʻq, axborotnoma yoʻq. Manzilingizni sotmaymiz, ulashmaymiz va hech qanday roʻyxatga qoʻshmaymiz.',
    },

    form: {
      title: 'Suhbatni boshlash',
      intro: 'Toʻrtta maydon. Faqat birinchisi majburiy.',
      fields: {
        email: {
          label: 'Ish pochtangiz',
          hint: 'Majburiy. Faqat javob berish uchun ishlatamiz.',
          placeholder: 'siz@kompaniya.uz',
        },
        company: { label: 'Kompaniya', hint: 'Ixtiyoriy.', placeholder: 'Qayerda ishlaysiz' },
        role: { label: 'Lavozim', hint: 'Ixtiyoriy.', placeholder: 'U yerda nima qilasiz' },
        scattered: {
          label: 'Nima sochilgan?',
          hint: 'Ixtiyoriy. Kompaniyangizning bilimi hozir aslida qayerda yashaydi? Ikki qator yetarli.',
          placeholder:
            'Uchta tizimga tarqalgan oʻn yillik shartnomalar, ularni yozgan odam esa ishdan ketgan.',
        },
      },
      submit: 'Yuborish',
      sending: 'Yuborilmoqda',
      errors: {
        emailRequired: 'Javob berishimiz uchun ish pochtangizni kiriting.',
        emailInvalid: 'Bu pochta manziliga oʻxshamaydi.',
      },
      success: {
        title: 'Qabul qilindi.',
        body: 'Bizdan kimdir oʻqiydi va javob beradi. Bundan keyin boshqa hech narsa kelmaydi — ketma-ketlik ham, axborotnoma ham.',
      },
      failure: {
        title: 'Yuborilmadi.',
        body: 'Ayb bizda, sizda emas. Toʻgʻridan-toʻgʻri yozing — u ayni oʻsha joyga tushadi:',
      },
      fallback: { lead: 'Pochta orqali yozasizmi?', address: brand.email, subject: 'Dizayn hamkor' },
    },
  },

  /* -------------------------------------------------------------------------
   * /maxfiylik, /shartlar
   * ⚠️ YURIDIK TEKSHIRUVDAN OʻTMAGAN. ISHGA TUSHIRISHDAN OLDIN OʻQING. ⚠️
   * Bular ataylab qisqa matnlar: yagona interaktiv qismi aloqa formasi boʻlgan,
   * hali ishga tushmagan marketing sayti uchun ROST. Ular yurisdiksiya, yuridik
   * shaxs, kafolat, javobgarlik chegarasi, subprotsessorlar yoki kunlardagi
   * saqlash muddatlarini ataylab nomlamaydi.
   *
   * ⚠️ QUYIDAGI DAʼVOLAR SAYT SHU KICHIKLIGICHA QOLGANDA ROST. ⚠️
   * Kimdir analitika skripti, piksel, shrift CDN’i yoki videoni qoʻshgan kuni
   * bu boʻlim yolgʻonga aylanadi. Xuddi shu commit’da tuzating yoki skriptni
   * qoʻshmang.
   * ----------------------------------------------------------------------- */
  legal: {
    meta: {
      updatedISO: '2026-07-27',
      updatedLabel: '2026-yil 27-iyul',
      updatedPrefix: 'Oxirgi yangilanish',
    },

    privacy: {
      label: 'Maxfiylik',
      title: 'Maxfiylik',
      description:
        'CompanyMind sayti nima yigʻadi: aloqa formasidagi xabaringiz va boshqa hech narsa. Kuzatuv cookie yoʻq, reklama tarmogʻi yoʻq, maʼlumot sotish yoʻq.',
      headline: ['Bu sayt deyarli', 'hech narsa yigʻmaydi.'],
      standfirst:
        'Bu shu sahifa uchun tanlagan poza emas. Bu mahsulot aytadigan aynan oʻsha argument: yigʻilmagan maʼlumot sizib chiqa olmaydi, sotila olmaydi va yoʻqola olmaydi. Marketing saytini ham shu qoidada ushlaymiz.',
      sections: [
        {
          heading: 'Bu sayt nima yigʻadi',
          body: [
            'Bitta narsa: aloqa formasiga yozganingizni. Ish pochtangiz va yoniga yozishni tanlagan narsangiz. Bu bizga xabar sifatida keladi va uni odam oʻqiydi.',
            'Bu saytda boshqa hech narsa sizdan hech nima soʻramaydi. Hisob yoʻq, kirish yoʻq, profil yoʻq.',
          ],
        },
        {
          heading: 'Bu sayt nima qilmaydi',
          body: [
            'Bu statik marketing sayti. U ataylab kichik va qilmaydigan ishlari roʻyxati qiladiganlaridan uzunroq.',
          ],
          list: [
            'Kuzatuv cookie yoʻq. Bu sayt yoza oladigan yagona cookie — siz tanlagan til, keyingi safar sayt oʻsha tilda ochilishi uchun.',
            'Reklama tarmoqlari yoʻq, piksellar yoʻq, retargeting yoʻq. Sizni internet boʻylab kuzatmaymiz.',
            'Siz haqingizda xulq-atvor profili yoʻq va seans yozuvi yoʻq.',
            'Maʼlumotingizni sotish yoʻq. Hech kimga, hech qanday narxda, hech qanday sabab bilan.',
            'Axborotnoma yoʻq, ketma-ketlik yoʻq, siz soʻramagan roʻyxat yoʻq.',
          ],
        },
        {
          heading: 'Yuborganingiz bilan nima qilamiz',
          body: [
            'Oʻqiymiz va javob beramiz. Suhbat davom etishi uchun xabarni saqlaymiz — xuddi kompaniyaga yuborgan har qanday xat oʻsha kompaniyaning pochta qutisida qolgani kabi.',
            'Oʻchirilishini istasangiz, yozing — oʻchiramiz. Taxmin qilgandan koʻra soʻralishni afzal koʻramiz.',
          ],
        },
        {
          heading: 'Sahifaning oʻzini yetkazish',
          body: [
            'Veb-sahifa serverdan kelishi kerak, server esa soʻrovni koʻradi. Hosting provayderimiz bu saytni brauzeringizga yetkazish uchun texnik jihatdan zarur boʻlgan narsani, jumladan oddiy soʻrov jurnallarini qayta ishlaydi. Biz ulardan siz haqingizda tasavvur qurish uchun foydalanmaymiz va ularni hech narsa bilan boyitmaymiz.',
            'Toʻliq maxfiylik siyosati aynan shu yerda provayderlari va saqlash muddatlarini nomlaydi. Biz hali ishga tushmaganmiz va bu roʻyxat yakuniy emas, shuning uchun keyinchalik jimgina tuzatishimiz mumkin boʻlgan versiyani eʼlon qilmaymiz. Soʻrang — bugun nima ishlayotganini aniq aytamiz.',
          ],
        },
        {
          heading: 'Mahsulot esa butunlay boshqa narsa',
          body: [
            'Yuqoridagi hamma narsa shu veb-sayt haqida. U CompanyMind mahsuloti haqida emas, chunki ikkalasi bir-biridan bundan uzoqroq boʻla olmaydi.',
            'CompanyMind sizning infratuzilmangiz ichida joylashadi. Maʼlumotingiz oʻsha yerda qoladi. Bizda unga kirish ham, uning nusxasi ham, unga yoʻl ham yoʻq — u turadigan vendor buluti yoʻq, chunki umuman vendor buluti yoʻq. Oʻrnatmangiz ichidagi maʼlumot bilan nima boʻlishini bu sahifa emas, sizning nazoratlaringiz va biz siz bilan imzolaydigan shartnoma boshqaradi.',
          ],
        },
      ],
      note: {
        label: 'Shu qismini oʻqing',
        heading: 'Bu sahifa qisqa, chunki sayt kichik.',
        body: 'U aloqa formasi bor, hali ishga tushmagan marketing saytini qamrab oladi va biz qoʻlga kiritmagan bandlarni takrorlash oʻrniga bugun aslida rost boʻlgan narsani aytadi. Toʻliq maʼlumot himoyasi shartlari — subprotsessorlar, saqlash, rezidentlik, oʻchirish, audit huquqlari — joylashtirish shartnomasi bilan muzokara qilinadi va unga biriktiriladi. Bogʻlaydiganlari oʻshalar.',
      },
      contact: {
        heading: 'Bular haqida soʻrash',
        body: 'Bitta manzil va unga odam javob beradi. Nima saqlayotganimizni soʻrang, oʻchirishni soʻrang yoki bu sahifa qamramagan savolni bering.',
      },
    },

    terms: {
      label: 'Shartlar',
      title: 'Shartlar',
      description:
        'CompanyMind sayti shartlari: unda nima bor, aloqa formasi nimani anglatadi va anglatmaydi, hamda haqiqatan bogʻlaydigan shartlar qayerda yashaydi.',
      headline: ['Bu sayt', 'mahsulot emas.'],
      standfirst:
        'CompanyMind hali ishga tushmagan. Bu yerda nima qurayotganimiz haqida oʻqishingiz va biz bilan gaplashishni soʻrashingiz mumkin. Bu shartlar aynan shuni qamrab oladi, boshqa hech narsani emas.',
      sections: [
        {
          heading: 'Bu shartlar nimani qamraydi',
          body: [
            'Bu veb-saytdan foydalanishingizni. Butun qamrov shu.',
            'Bu saytdan hech qanday dastur taklif qilinmaydi, litsenziyalanmaydi, sotilmaydi yoki yetkazilmaydi. Demak, bu dastur shartnomasi emas va uni oʻqish sizni shartnomaga qoʻymaydi.',
          ],
        },
        {
          heading: 'Bu yerda nima yozilgan',
          body: [
            'Tartibga solinadigan tashkilotlar uchun, ularning oʻz infratuzilmasida joylashtiriladigan qurilayotgan mahsulot taʼrifi. Biz uni aniq taʼriflashga, qoʻllab-quvvatlay olmaydigan narsani daʼvo qilmaslikka va bizda yoʻq sertifikatni koʻrsatmaslikka jiddiy harakat qildik.',
            'Bu hamon ishlab chiqilayotgan dastur taʼrifi. U nima qilishi, qancha turishi va qachon chiqishi — ikkalamiz imzolaydigan narsa paydo boʻlgunicha oʻzgarishi mumkin. Narxlar sahifasidagi raqamlar — ochiq aytilgan hozirgi niyatimiz, qulflangan taklif emas.',
          ],
        },
        {
          heading: 'Sizdan nima soʻraymiz',
          body: [
            'Oʻqing, havola qiling, iqtibos keltiring, hamkasbingizga yuboring. Bularning hech biriga ruxsatimiz kerak emas.',
            'Soʻzlar, dizayn va kod bizniki. Ularni oʻzingizniki deb koʻrsatmang va saytga hujum qilmang yoki uni tinimsiz skreyping qilmang. Butun roʻyxat shu.',
          ],
        },
        {
          heading: 'Aloqa formasi',
          body: [
            'Gaplashmoqchi boʻlsangiz ish pochtangizni yuboring. Uni yuborish shartnoma tuzmaydi, hech narsani band qilmaydi, narxni qulflamaydi va ikkalamizni hech narsaga majburlamaydi. U odam bilan suhbatni boshlaydi.',
            'Maxfiy materialni u orqali yubormang. Bu marketing saytidagi forma va u nozik narsalar uchun qurilgan kanal emas. Kerak boʻlsa, ayting — biz uni tegishlicha tashkil qilamiz.',
          ],
        },
        {
          heading: 'Bogʻlaydigan shartlar qayerda',
          body: [
            'Bu yerda emas. Agar birga ishlasak, dasturni, maʼlumotni, xavfsizlik majburiyatlarini, qoʻllab-quvvatlashni, javobgarlikni va haqiqatan muhim boʻlgan boshqa hamma narsani joylashtirish shartnomasi boshqaradi. U muzokara qilinadi, imzolanadi va aynan sizga moslashtiriladi.',
            'U paydo boʻlgunicha bu saytdagi hamma narsa — marketing. Veb-sahifani shartnoma qilib koʻrsatgandan koʻra shuni aytishni afzal koʻramiz.',
          ],
        },
      ],
      note: {
        label: 'Shu qismini oʻqing',
        heading: 'Bular ataylab toʻliq shartlar emas.',
        body: 'Bu yerda amal qiluvchi qonun bandi, javobgarlik chegarasi, kafolat yoki bosh harflardagi ogohlantirish topmaysiz. Bu eʼtiborsizlik emas. Hali kafolatlaydigan narsa yoʻq va faqat aloqa formasi joylashgan sayt uchun yurisdiksiya nomlash teatr boʻlardi. Haqiqiy shartlar haqiqiy narsa uchun yoziladi va joylashtirish shartnomasi bilan keladi.',
      },
      contact: {
        heading: 'Bular haqida savollar',
        body: 'Taxmin qilishdan oldin soʻrang. Agar bu yerdagi biror narsa biz nazarda tutmagan vaʼda kabi oʻqilsa — bilishni istaymiz va matnni tuzatamiz.',
      },
    },
  },

  /* -------------------------------------------------------------------------
   * 404 — brend metaforasi, jiddiy oʻynalgan: indeksda yoʻq hujjat.
   * Mahsulotning qoidasi «manba yoʻq — daʼvo ham yoʻq», shuning uchun bu
   * sahifa ham taxmin qilmaydi.
   * ----------------------------------------------------------------------- */
  notFound: {
    label: '404 · manba topilmadi',
    title: 'Indeksda yoʻq',
    description: 'Bu sahifa saytning bir qismi emas.',
    headline: ['Indeksda', 'yoʻq.'],
    body: 'Siz soʻragan sahifa bu saytning qismi emas. U koʻchirilgan boʻlishi mumkin, umuman mavjud boʻlmagan boʻlishi ham mumkin — va biz qaysi biri ekanini taxmin qilmaymiz.',
    footnote:
      'Manba yoʻq — daʼvo ham yoʻq. Bu qoida mahsulotni boshqaradi, demak bu sahifani ham. Qolgan hamma narsa bitta havola narida.',
    artifact: { caption: 'soʻralgan hujjat', status: 'indekslanmagan · 0 manba' },
    home: 'Bosh sahifaga qaytish',
    linksLabel: 'Yoki toʻgʻridan-toʻgʻri',
    sectionsAria: 'Boʻlimlar',
  },
}
