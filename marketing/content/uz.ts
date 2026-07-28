/**
 * ============================================================================
 * OʻZBEKCHA — asosiy til. Saytning har bir soʻzi (lotin yozuvida).
 * ============================================================================
 * `Dictionary` tipiga toʻliq mos keladi, xuddi content/en.ts kabi. Bu yerdagi
 * biror daʼvoni oʻzgartirishdan oldin en.ts boshidagi halollik qoidalarini
 * oʻqing: ular NIMA DEYISH MUMKINLIGI haqida, shuning uchun tarjimada ham
 * oʻzgarmaydi.
 *
 * BU MATN TARJIMA EMAS, QAYTA YOZILGAN. Inglizchadagi jumlani soʻzma-soʻz
 * oʻgirish oʻzbekchada gʻalati chiqadi: «nothing calls home», «behind your own
 * walls», «data egress» kabi iboralarning oʻzbekcha ekvivalenti yoʻq. Shuning
 * uchun bu yerda fikr saqlangan, jumla esa oʻzbekcha yozilgan. Yangi matn
 * qoʻshsangiz ham shunday qiling — inglizcha jumlaning tuzilishini ergashtirib
 * yurmang. (Asoschi qarori, 2026-07-27: birinchi versiya soʻzma-soʻz edi va
 * rad etildi.)
 *
 * ATAMALAR (butun sayt boʻylab bir xil ishlatilsin):
 *   egress            → «tashqariga chiqqan maʼlumot», qisqasi «tashqariga»
 *   cited answer      → «manbali javob» / «manbasi koʻrsatilgan javob»
 *   on-premise        → «ichki oʻrnatma», «oʻz serveringizda»
 *   design partner    → «hamkor» (dizayn bilan aloqasi yoʻq — kalka qilinmaydi)
 *   audit trail       → «audit jurnali»
 *   vendor cloud      → «tashqi bulut» / «birovning buluti»
 *
 * IMLO: `ʻ` — U+02BB (oʻ, gʻ), `ʼ` — U+02BC (maʼlumot). Ikkalasi ham Google
 * Fonts’ning `latin` unicode-range’i ichida, shuning uchun Space Grotesk va
 * IBM Plex Mono’da fallback shriftsiz chiziladi. Ularni ASCII apostrofga
 * «tuzatmang» — bu boshqa belgi va xato boʻlib koʻrinadi.
 *
 * ATAYLAB INGLIZCHA QOLDIRILGANI: misol fayl nomlari
 * (`meridian_msa_executed.pdf`), brend nomi, pochta manzili va axborot
 * xavfsizligi rahbari baribir inglizcha oʻqiydigan atamalar — VPC, SSO, SIEM,
 * air-gap. Ularni tarjima qilish sahifani aynan oʻqiydigan odam uchun
 * qiyinlashtiradi.
 */

import { brand } from './brand'
import { ROUTES } from './routes'
import type { Dictionary } from './types'

export const uz: Dictionary = {
  site: {
    tagline: 'Kompaniyangizdagi barcha maʼlumotlar — oʻz serveringizda.',
    description:
      'CompanyMind kompaniyangizdagi har bir faylni, yozishmani, rasmni va qoʻngʻiroqni oʻqib chiqib, savol berish mumkin boʻlgan yagona bilim markaziga aylantiradi. Hammasi oʻz serverlaringizda ishlaydi, har bir javob esa manbasini koʻrsatadi.',
  },

  localeSwitcher: { label: 'Til' },
  skipToContent: 'Asosiy mazmunga oʻtish',
  navA11y: {
    primary: 'Asosiy menyu',
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

  cta: { label: 'Hamkor boʻling', href: ROUTES.contact },

  footer: {
    blurb:
      'Kompaniyangizdagi barcha maʼlumot uchun bitta tizim. Oʻz serverlaringizda ishlaydi, har bir javob manbasini koʻrsatadi.',
    status: 'tashqariga chiqqan maʼlumot: 0 bayt',
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
          { href: ROUTES.terms, label: 'Foydalanish shartlari' },
        ],
      },
    ],
  },

  /* -------------------------------------------------------------------------
   * BOSH SAHIFA — skroll ssenariysi. Har bir sahna uchun bitta kalit.
   * ----------------------------------------------------------------------- */
  home: {
    hero: {
      eyebrow: 'Kompaniya ichidagi maʼlumot tizimi',
      headline: ['Kompaniyangizdagi', 'barcha maʼlumotlar —', 'oʻz serveringizda.'],
      sub: 'Har bir fayl, yozishma, rasm va qoʻngʻiroq bitta tizimga yigʻiladi. Bu tizim toʻliq sizning serverlaringizda ishlaydi.',
      scrollCue: 'Pastga',
      systemOnline: 'tizim ishlayapti',
      egressLabel: 'tashqariga chiqdi:',
      egressValue: '0 bayt',
    },

    problem: {
      label: 'Muammo',
      headline: ['Javob kompaniyangizda', 'allaqachon bor.', 'Faqat uni topib boʻlmaydi.'],
      body: 'U martdagi yozishmada qolib ketgan. Kimdir nomini oʻzgartirgan PDF ichida. Hech kim matnga oʻgirmagan ovozli xabarda. Nomi «final» boʻlgan faylning toʻrtinchi nusxasida.',
      beats: [
        {
          stat: 'Koʻmilgan',
          line: 'Javob bor. Lekin u kerakli odamdan toʻqqizta tizim va ikkita boʻlim narida yotibdi.',
        },
        {
          stat: 'Takrorlangan',
          line: 'Bitta hujjatning toʻrtta nusxasi. Uchtasi eskirgan. Qaysi biri haqiqiyligini hech narsa aytmaydi.',
        },
        {
          stat: 'Yoʻqolgan',
          line: 'Buni biladigan odam aprelda ishdan boʻshadi. Bilim ham u bilan ketdi.',
        },
        {
          stat: 'Topilmaydigan',
          line: 'Qidiruv maʼnoni emas, fayl nomini qidiradi. Rasmni ham, ovozni ham, skanni ham oʻqiy olmaydi.',
        },
      ],
    },

    turn: {
      label: 'Yechim',
      headline: ['Bitta tizim.', 'Ichida — hammasi.'],
      body: 'CompanyMind kompaniyangizdagi har bir manbani oʻqib chiqadi va bittayu bitta bogʻlangan indeksga yigʻadi. Nusxalar birlashadi, format ahamiyatsiz boʻlib qoladi. Sochilib yotgan narsa savol berish mumkin boʻlgan yagona manbaga aylanadi.',
      seal: 'Bularning birortasi ham serveringizdan chiqmadi.',
    },

    ask: {
      label: 'Ishonch',
      headline: ['Xohlaganingizni soʻrang.', 'Har bir soʻzni tekshiring.'],
      body: 'Javob modelning xotirasidan emas, sizning maʼlumotingizdan olinadi. Har bir jumla oʻzi olingan hujjatga havola qiladi — ustiga bosing, manbaning oʻzi ochiladi.',
      question: 'Meridian shartnomasida maʼlumotlarni saqlash joyi boʻyicha nimaga kelishgan edik?',
      answer: [
        { text: 'Mijoz maʼlumotlari mintaqadan chiqmaydi, chegara ortiga uzatilmaydi', cite: 1 },
        { text: 'saqlash muddati muzokara chogʻida 18 oyga tushirildi', cite: 2 },
        { text: 'chunki huquq boʻlimi dastlabki 36 oylik shartga eʼtiroz bildirgan edi.', cite: 3 },
      ],
      sources: [
        {
          id: 1,
          kind: 'pdf',
          name: 'meridian_msa_executed.pdf',
          detail: 'Ilova 2 · §4.1 · 14-bet',
        },
        {
          id: 2,
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          detail: '87-qator · «Saqlash (oy)»',
        },
        {
          id: 3,
          kind: 'email',
          name: 're: Meridian redlines',
          detail: 'Huquq boʻlimi · 12-mart · 09:41',
        },
      ],
      sourceAria: '{n}-manba: {name}',
      footnote:
        'Manbasi yoʻq javob ham yoʻq. Maʼlumotingizda yozilmagan gapni CompanyMind ham aytmaydi.',
    },

    sovereign: {
      label: 'Nazorat sizda',
      headline: ['Tashqariga hech narsa chiqmaydi.', 'Ichkariga hech kim kirmaydi.'],
      body: 'CompanyMind maʼlumotlaringiz turgan joyda ishlaydi: oʻz serveringizda, oʻz VPC’ingizda yoki internetga umuman ulanmagan mashinada. Ishonish kerak boʻlgan tashqi bulut yoʻq — chunki bulutning oʻzi yoʻq.',
      beats: [
        {
          label: 'Tashqariga',
          value:
            'Hech narsa tashqariga xabar yubormaydi: telemetriya ham, tashqi model API’si ham yoʻq.',
        },
        {
          label: 'Ichkariga',
          value: 'Bizda sizning oʻrnatmangizga kirish imkoni yoʻq. Umuman.',
        },
        {
          label: 'Air-gap',
          value: 'Internetsiz ham toʻliq ishlaydi. Modellar va indeks oʻrnatma bilan birga keladi.',
        },
      ],
    },

    features: {
      label: 'Imkoniyatlar',
      headline: ['Bulutdan foydalana olmaydigan', 'kompaniyalar uchun.'],
      items: [
        {
          n: '01',
          title: 'Hammasini oʻqiydi',
          body: 'Hujjat, jadval, PDF, xat, yozishma, rasm va audio. Skanlar oʻqiladi, qoʻngʻiroqlar matnga oʻgiriladi. Endi format tufayli hech narsa yoʻqolmaydi.',
        },
        {
          n: '02',
          title: 'Manbali javoblar',
          body: 'Har bir jumla oʻzi olingan hujjatga bogʻlanadi. Bir bosishda asl nusxa ochiladi va siz oʻzingiz tekshirasiz. Javob modelning xotirasiga emas, sizning maʼlumotingizga tayanadi.',
        },
        {
          n: '03',
          title: 'Kirish huquqlarini hisobga oladi',
          body: 'Tizim sizda allaqachon bor kirish tartibiga boʻysunadi. Har kim faqat oʻziga ruxsat berilgan hujjatlardan javob oladi. Hech narsa hamma oʻqiy oladigan umumiy uyumga aylanmaydi.',
        },
        {
          n: '04',
          title: 'Air-gap rejimi',
          body: 'Internetga ulanmagan tarmoqqa ham oʻrnatiladi. Modellar, indeks va interfeys — hammasi lokal ishlaydi. Tizimning birorta qismi tashqi ulanishni talab qilmaydi.',
        },
        {
          n: '05',
          title: 'Audit jurnali',
          body: 'Har bir savol, har bir javob va koʻrilgan har bir manba oʻz tizimlaringizda qayd etiladi. Auditorlaringiz istagan paytda tekshiradi, saqlash muddatini oʻzingiz belgilaysiz.',
        },
      ],
    },

    /**
     * DALIL — kompaniya hali bozorga chiqmagan, shuning uchun bu yerda mijoz
     * raqamlari YOʻQ. Har bir raqam tizim qanday qurilganidan kelib chiqadi.
     * Kechikish yoki aniqlik raqamlarini qoʻshmang.
     */
    proof: {
      label: 'Dalil',
      headline: ['Birinchi kundan shunday.'],
      body: 'Biz hali bozorga chiqmaganmiz, shuning uchun bular mijoz statistikasi emas. Bular — arxitekturaning xossalari: tizim shunday qurilgani uchun har qanday oʻrnatmada birinchi kunidanoq shunday boʻladi.',
      metrics: [
        {
          value: 0,
          suffix: ' bayt',
          label: 'Tashqariga chiqqan maʼlumot',
          note: 'Tashqariga hech narsa chiqmaydi. Noldan katta raqam chiqishi uchun yoʻlning oʻzi yoʻq.',
        },
        {
          value: 12,
          suffix: '',
          label: 'Manba formati',
          note: 'Bugun oʻqiladigan formatlar soni: .docx’dan .m4a va skanlangan .tiff’gacha.',
        },
        {
          value: 100,
          suffix: '%',
          label: 'Manbali javoblar',
          note: 'Javob topilgan parchalardan yigʻiladi. Manbasiz jumla umuman paydo boʻlmaydi.',
        },
        {
          value: 1,
          suffix: '',
          label: 'Oʻrnatma — faqat sizniki',
          note: 'Bitta mijoz, bitta oʻrnatma. Umumiy indeks ham, qoʻshni ham yoʻq.',
        },
      ],
    },

    pricing: {
      label: 'Narxlar',
      headline: ['Ikkita narx.', 'Bitta suhbat.'],
      body: 'Individual va Jamoa tariflarining narxi ochiq — dastur bir xil, faqat hajmi har xil. Korxona tarifi esa oʻz serveringizda ishlaydi, shuning uchun uning narxi sahifada turmaydi: infratuzilmangizga qarab hisoblanadi.',
      more: 'Tariflarning toʻliq roʻyxati',
    },

    cta: {
      label: 'Hamkorlik',
      headline: ['Bir nechta hamkor', 'tanlayapmiz.'],
      body: 'CompanyMind’ni shu muammoni yaxshi biladigan bir nechta jamoa bilan birga quryapmiz. Bilimingiz sochilib yotgan boʻlsa va maʼlumotingiz tashqariga chiqa olmasa — gaplashaylik.',
      formLabel: 'Ish pochtangiz',
      formPlaceholder: 'siz@kompaniya.uz',
      submit: 'Suhbatni boshlash',
      sending: 'Yuborilyapti…',
      fineprint: 'Bitta odam oʻqiydi, bitta odam javob yozadi. Reklama xatlari yoʻq.',
      success: 'Qabul qilindi. Tez orada bogʻlanamiz.',
      error: `Yuborilmadi. Toʻgʻridan-toʻgʻri ${brand.email} manziliga yozing.`,
    },

    telemetry: {
      artifacts: 'hujjatlar',
      sourcesCited: 'koʻrsatilgan manbalar',
      queries: 'soʻrovlar',
      dataEgress: 'tashqariga chiqdi',
      egressValue: '0 bayt',
      state: 'holat',
      scenes: {
        hero: 'sochilgan',
        problem: 'indekssiz',
        turn: 'oʻqilyapti',
        ask: 'javob berilyapti',
        sovereign: 'yopiq',
        features: 'yigʻilyapti',
        proof: 'barqaror',
        pricing: 'narxlar',
        cta: 'himoyada',
      },
    },

    canvasAlt:
      'Iliq qogʻoz ustidagi jonli chizma. Chizilgan chegara — infratuzilmangizning qirrasi. Uning ichida hujjatlar, yozishmalar, PDF fayllar, rasmlar, xatlar, jadvallar va ovozli xabarlar tartibsiz suzib yuradi; baʼzilari takrorlangan, baʼzilari xiralashib yoʻqolgan. Sahifa pastga surilgani sari ular ichkariga tortilib, yagona bogʻlangan toʻrga aylanadi. Savol shu toʻrdan oʻtib javob qaytaradi, javobning har bir qismidan esa oʻzi olingan aniq manbaga chiziq tortiladi. Hech narsa chegaradan tashqariga chiqmaydi.',
  },

  /* -------------------------------------------------------------------------
   * /product — «qanday ishlaydi» sahifasi.
   * Fayl nomlari — MISOL uchun; mijoz oʻz oʻrnatmasida oʻz fayllarini koʻradi.
   * Bu keys tadqiqot emas. Demo ostidagi `caption` shuni sahifada aytadi —
   * uni oʻchirmang.
   * ----------------------------------------------------------------------- */
  product: {
    meta: {
      title: 'Mahsulot',
      description:
        'CompanyMind qanday ishlaydi: kompaniyangizdagi har bir manba oʻqiladi va savol berish mumkin boʻlgan yagona indeksga yigʻiladi. Javobdagi har bir jumla oʻzi olingan hujjatni koʻrsatadi.',
    },
    chapterLabel: 'Bob',

    hero: {
      eyebrow: 'Qanday ishlaydi',
      headline: ['Hammasi kiradi.', 'Bitta javob chiqadi.', 'Manbasiz — hech narsa.'],
      sub: 'CompanyMind kompaniyangizda allaqachon bor har bir manbani oʻqiydi, ularni yagona bogʻlangan indeksga yigʻadi va javobni oʻsha indeksdan quradi. Javobdagi har bir jumla oʻzi olingan hujjatni koʻrsatadi. Bularning bari sizning serveringizda bajariladi.',
      pipeline: ['oʻqish', 'yigʻish', 'soʻrash', 'manba'],
    },

    ingest: {
      chapter: '01',
      label: 'Oʻqish',
      headline: ['Bor narsangizning hammasi.', 'Faqat tartiblisi emas.'],
      body: 'CompanyMind’ni umumiy papkaga, pochta qutisiga, yozishmalar eksportiga yoki skanlar jildiga ulang — u topganini oʻqiydi. Shartnoma ham, unutilgan jadval ham, suratga olingan doska ham, bir soatlik qoʻngʻiroq ham bir xil koʻrinishda keladi: tizim tushunadigan matn va asl nusxaga qaytadigan havola.',
      sources: [
        {
          kind: 'doc',
          name: 'q3_risk_review.docx',
          note: 'Tuzilishi buzilmasdan oʻqiladi: sarlavhalar, jadvallar va izohlar oʻz maʼnosi bilan bogʻliq qoladi.',
        },
        {
          kind: 'sheet',
          name: 'contract_terms_tracker.xlsx',
          note: 'Har bir varaq, har bir qator, har bir katak. Uni yaratgan odam ishdan ketganidan beri hech kim ochmagan varaq ham.',
        },
        {
          kind: 'pdf',
          name: 'meridian_msa_executed.pdf',
          note: 'Band-band ajratiladi, shuning uchun havola «14-betning bir yerida» emas, «Ilova 2 §4.1» ga olib boradi.',
        },
        {
          kind: 'scan',
          name: 'scan_0042.tiff',
          note: 'Suratga olingan sahifa — kimdir oʻqimaguncha oddiy rasm. OCR uni qidiriladigan va havola qilinadigan matnga aylantiradi.',
        },
        {
          kind: 'email',
          name: 're_meridian_redlines.eml',
          note: 'Yozishma zanjiri tartibi bilan, ilovalari qoʻshib, qaror aslida qachon qabul qilingani bilan.',
        },
        {
          kind: 'chat',
          name: 'deal_desk_export.json',
          note: 'Xabarlar ketma-ketligi, kim va qachon yozgani bilan. Martdagi suhbat endi eslab qolingan gap emas, hujjat.',
        },
        {
          kind: 'image',
          name: 'whiteboard_2026-03-12.jpg',
          note: 'Skrinshot, chizma, doska surati. Ulardagi matn oʻqiladi va rasm oʻsha matn bilan birga indekslanadi.',
        },
        {
          kind: 'audio',
          name: 'meridian_call_14mar.m4a',
          note: 'Bir soatlik qoʻngʻiroq vaqt belgili transkriptga aylanadi. 00:41 da nima kelishilgani endi ikki kishining yarim esidagi gap emas.',
        },
      ],
      footnote: 'Bugun 12 xil format oʻqiladi: .docx’dan .m4a va skanlangan .tiff’gacha.',
    },

    organize: {
      chapter: '02',
      label: 'Yigʻish',
      headline: ['Sochilgan holda kiradi.', 'Bogʻlangan holda chiqadi.'],
      body: 'Fayllarni oʻqish — ishning oson qismi. Asosiy ish keyin boshlanadi: nusxalar birlashadi, formatlar ahamiyatini yoʻqotadi va bitta narsa haqidagi hamma maʼlumot yonma-yon turadi.',
      beats: [
        {
          title: 'Nusxalar birlashadi',
          body: '«final» nomli toʻrtta fayl tarixi bor bitta hujjatga aylanadi. Javob esa haqiqatan imzolangan nusxadan olinadi.',
        },
        {
          title: 'Yagona bogʻlangan indeks',
          body: 'Shartnoma, uni qisqacha yozib qoʻyilgan jadval qatori va u haqda bahs boʻlgan qoʻngʻiroq endi uchta alohida tizim emas — yonma-yon turgan uchta manba.',
        },
        {
          title: 'Format ahamiyatini yoʻqotadi',
          body: 'Jumla — slaydda ham, skanda ham, ovozli xabarda ham jumla. Qidiruv fayl kengaytmasi boʻyicha emas, maʼno boʻyicha ishlaydi.',
        },
      ],
      permission: {
        label: 'Eng muhimi',
        title: 'Ruxsatlar boshidanoq hisobga olinadi',
        body: 'Kirish huquqi maʼlumot bilan birga keladi va undan ajralmaydi. Faylni ocha olmagan odam undan bitta jumla ham ololmaydi va uni javobdagi manbalar orasida ham koʻrmaydi.',
        emphasis:
          'Ruxsatlar oxirida ustiga qoʻyilgan filtr emas — ular indeksning bir qismi. Hech narsa hamma oʻqiy oladigan umumiy uyumga aylanmaydi.',
      },
    },

    ask: {
      chapter: '03',
      label: 'Soʻrash',
      headline: ['Savol kiradi.', 'Tekshirsa boʻladigan javob chiqadi.'],
      body: 'Javob model boshqa joyda oʻqib eslab qolganidan emas, sizning maʼlumotingizdan quriladi. Har bir jumla oʻzi yasalgan parchani koʻrsatadi va bu koʻrsatkich javobning ichida turadi — «ishoning» degan izohda emas.',
      demo: {
        label: 'Namuna',
        question:
          'Meridian shartnomasida maʼlumotlarni saqlash joyi boʻyicha nimaga kelishgan edik?',
        answerLabel: 'Javob',
        answer: [
          {
            text: 'Mijoz maʼlumotlari mintaqadan chiqmaydi: chegara ortiga uzatish ham, xorijdagi nusxa ham yoʻq.',
            cite: 1,
          },
          { text: 'Saqlash muddati dastlabki 36 oydan 18 oyga tushirildi.', cite: 2 },
          {
            text: 'Bu oʻzgarishni huquq boʻlimi 36 oylik shartni siyosatga zid deb topgach kiritdi.',
            cite: 3,
          },
          {
            text: '14-mart qoʻngʻirogʻida mijoz oʻchirish har chorakda hujjatlashtirilishi sharti bilan rozi boʻldi.',
            cite: 4,
          },
        ],
        telemetry: ['topildi: 4 parcha', 'manba: 4 hujjat', 'tashqariga: 0 bayt'],
        sourcesLabel: 'Manbalar',
        sourcesCount: '{n} ta hujjat',
        sources: [
          {
            id: 1,
            kind: 'pdf',
            name: 'meridian_msa_executed.pdf',
            detail: 'Ilova 2 · §4.1 · 14-bet',
          },
          {
            id: 2,
            kind: 'sheet',
            name: 'contract_terms_tracker.xlsx',
            detail: '87-qator · «Saqlash (oy)»',
          },
          {
            id: 3,
            kind: 'email',
            name: 're: Meridian redlines',
            detail: 'Huquq boʻlimi · 12-mart · 09:41',
          },
          {
            id: 4,
            kind: 'audio',
            name: 'meridian_call_14mar.m4a',
            detail: 'Transkript · 00:41:12',
          },
        ],
        backLabel: 'Javobga qaytish',
        sourceAria: '{n}-manba',
        caption:
          'Namuna uchun. Hujjatlar — mijozning oʻz fayllari, javob esa faqat oʻshalardan yigʻilgan. Har bir belgi hujjatning aniq joyiga — betiga, qatoriga, vaqt belgisiga — olib boradi va asl nusxani oʻsha yerdan ochadi.',
      },
      pipelineLabel: 'Bu qanday sodir boʻldi',
      pipeline: [
        {
          title: 'Oʻqiydi',
          body: 'Savolni sizning serveringizda ishlayotgan model indeksingizga qarab tushunadi. Savol binodan chiqmaydi.',
        },
        {
          title: 'Qidiradi',
          body: 'Nomzod parchalar faqat shu odam koʻrishga haqli hujjatlardan olinadi. Qolgani umuman koʻrib chiqilmaydi.',
        },
        {
          title: 'Yigʻadi',
          body: 'Javob oʻsha parchalardan yoziladi. Har bir jumla oʻzi kelib chiqqan parchani koʻrsatadi.',
        },
        {
          title: 'Manbani koʻrsatadi',
          body: 'Koʻrsatkichlar hujjatlarga va ular ichidagi aniq joyga olib boradi. Asl nusxani ochib, oʻzingiz oʻqiysiz. Gap shunda.',
        },
        {
          title: 'Qayd etadi',
          body: 'Savol, javob va koʻrilgan har bir manba sizning audit jurnalingizga, sizning tizimlaringizga tushadi.',
        },
      ],
      construction:
        'Har bir javob manbasini koʻrsatadi, chunki uni boshqacha qurishning imkoni yoʻq: javob topilgan parchalardan yigʻiladi, demak manbasiz jumlaning yasaladigan joyi yoʻq.',
      empty: {
        title: 'Javob topilmasa',
        body: 'CompanyMind shuni ochiq aytadi va qayerlarni qidirganini koʻrsatadi. Tartibga solinadigan sohada ishonch bilan aytilgan taxmin sukutdan ham yomon.',
      },
      footnote:
        'Manbasi yoʻq javob ham yoʻq. Maʼlumotingizda yozilmagan gapni CompanyMind ham aytmaydi.',
    },

    close: {
      label: 'Keyingisi',
      headline: ['Bularning hech biri', 'tashqariga chiqmaydi.'],
      body: 'Bu sahifadagi har bir qadam — oʻqish, indeks, model, javob, audit jurnali — siz nazorat qiladigan serverda bajariladi. Yoʻlda birovning buluti yoʻq, chunki umuman bulut yoʻq. Bu qanday qurilgani va mavjud majburiyatlaringiz uchun nimani anglatishi — alohida sahifada.',
      primary: { label: 'Arxitekturani koʻrish', href: ROUTES.security },
      secondary: { label: 'Hamkor boʻling', href: ROUTES.contact },
    },
  },

  /* -------------------------------------------------------------------------
   * /security — auditoriya: bank yoki shifoxonaning axborot xavfsizligi rahbari.
   * Butun dalil — arxitektura. Bizda sertifikat yoʻq, shuning uchun hech qanday
   * sertifikatga ishora ham qilmaymiz. `verify` qatorlari sahifaning umurtqasi:
   * oʻquvchi oʻzi tekshira olmaydigan daʼvoni bu yerga qoʻshmang.
   * ----------------------------------------------------------------------- */
  security: {
    meta: {
      title: 'Xavfsizlik',
      description:
        'CompanyMind butunlay sizning perimetringiz ichida ishlaydi: tashqariga yoʻl yoʻq, bizga kirish yoʻli yoʻq, umumiy oʻrnatma yoʻq. Qoʻlga kiritmagan sertifikatlar haqida daʼvo ham yoʻq — butun dalil arxitekturaning oʻzida.',
    },

    hero: {
      label: 'Xavfsizlik',
      headline: ['Bizga ishonish shart', 'boʻlmasin deb qurdik.'],
      sub: 'CompanyMind — sizning perimetringiz ichida ishlaydigan dastur. Tashqi bulut ham, telemetriya kanali ham, texnik yordam tunneli ham yoʻq. Bu sahifadagi har bir xossa dastur qayerda ishlashidan kelib chiqadi, demak bir soʻzimizga ishonishdan oldin hammasini oʻz tarmogʻingizda sinab koʻra olasiz.',
    },

    rail: [
      { label: 'tashqariga', value: '0 bayt' },
      { label: 'bizning kirishimiz', value: 'yoʻq' },
      { label: 'oʻrnatma', value: 'faqat sizniki' },
    ],

    perimeter: {
      label: 'Perimetr',
      headline: ['Xavfsizlik chegarasi —', 'sizning chegarangiz.'],
      body: 'CompanyMind siz baholab chiqishingiz kerak boʻlgan yangi xavfsizlik chegarasi olib kelmaydi — u sizningkini oladi. Qayerda ishlashini tanlaysiz; bu sahifadagi qolgan hamma narsa oʻsha bitta tanlovdan kelib chiqadi.',
      modes: [
        {
          n: '01',
          name: 'Oʻz serveringiz',
          line: 'Toza temirda yoki oʻz virtualizatsiyangizda — siz egalik qiladigan, oʻzingiz joylashtirgan va tekshirib turadigan serverda.',
        },
        {
          n: '02',
          name: 'Oʻz VPC’ingiz',
          line: 'Sizning bulut hisobingiz, tarmoqchalaringiz, xavfsizlik guruhlaringiz, kalitlaringiz. Bizga bularning birortasidan kirish maʼlumoti berilmaydi.',
        },
        {
          n: '03',
          name: 'Air-gap',
          line: 'Internetga umuman ulanmagan tarmoq. Modellar va indeks oʻrnatma bilan birga keladi, hammasi oflayn ishlaydi.',
        },
      ],
    },

    dataflow: {
      label: 'Maʼlumot oqimi',
      headline: ['Hammasi chegara', 'ichida boʻlib oʻtadi.'],
      body: 'Oʻqish, indekslash va javob berish — hammasi lokal jarayonlar. Bu chizmadagi birorta qadam paketning tarmogʻingizdan chiqishini talab qilmaydi, uni yuboradigan kodning oʻzi esa yozilmagan.',
      wallLabel: 'Sizning infratuzilmangiz',
      stages: [
        {
          label: 'Oʻqish',
          title: 'Manbalaringiz',
          line: 'Fayllar, yozishmalar, xatlar, rasmlar, audio, jadvallar — turgan joyidan oʻqiladi.',
        },
        {
          label: 'Indeks',
          title: 'Bitta tizim',
          line: 'Lokal tahlil qilinadi, vektorga aylanadi va bogʻlanadi. Har bir manbaning kirish huquqi u bilan birga yuradi.',
        },
        {
          label: 'Javob',
          title: 'Manbasi bilan',
          line: 'Topilgan parchalardan yigʻiladi, har biri oʻzi olingan hujjatgacha kuzatiladi.',
        },
      ],
      audit: {
        label: 'Audit',
        line: 'Har bir savol, har bir javob va koʻrilgan har bir manba oʻsha zahoti sizning jurnal tizimingizga yoziladi.',
      },
      barriers: [
        {
          dir: 'outbound',
          label: 'Tashqariga yoʻl yoʻq',
          target: 'Model API’lari · tashqi bulut · telemetriya',
          note: 'Bu oʻchirib qoʻyilgan sozlama emas. Tashqariga murojaat qiladigan kodning oʻzi yozilmagan.',
        },
        {
          dir: 'inbound',
          label: 'Ichkariga yoʻl yoʻq',
          target: 'CompanyMind',
          note: 'Tunnel ham, orqa eshik ham, masofaviy yordam seansi ham yoʻq. Biz sizning oʻrnatmangizga yeta olmaymiz.',
        },
      ],
      caption:
        'Oʻqish, indekslash va javob berish — hammasi perimetringiz ichida. Uni kesib oʻtishi mumkin boʻlgan ikki yoʻl — tashqariga va bizdan ichkariga — sozlamada oʻchirilgan emas, umuman qurilmagan.',
    },

    directions: {
      label: 'Uch yoʻnalish',
      headline: ['Tashqariga chiqish —', 'tuzilishiga koʻra nol.'],
      body: 'Nol — biz erishgan koʻrsatkich ham, qoʻyib qoʻyilgan sozlama ham emas. Bu arxitektura chiqara oladigan yagona raqam, chunki uni kattalashtiradigan yoʻl umuman qurilmagan.',
      verifyLabel: 'Tekshiring',
      items: [
        {
          label: 'Tashqariga',
          title: 'Hech narsa tashqariga xabar yubormaydi.',
          body: 'Telemetriya yoʻq, foydalanish statistikasi yoʻq, litsenziya tekshiruvi yoʻq, xatolar hisoboti yoʻq, tashqi model API’si yoʻq. Bu keyingi versiya jimgina qaytarib yoqadigan katakcha emas: oʻchiriladigan chiquvchi kod yoʻlining oʻzi yoʻq. Demak, tasodifan yoqib qoʻyiladigan ham, toʻrtinchi versiyada buziladigan ham narsa yoʻq.',
          verify:
            'Uni «hammasini taqiqla» qoidasi ortiga qoʻying va hech narsa buzilmasligini koʻring.',
        },
        {
          label: 'Ichkariga',
          title: 'Bizda ichkariga yoʻl yoʻq.',
          body: 'Sizning oʻrnatmangizdan kirish maʼlumotlarimiz yoʻq. Yordam tunneli yoʻq, bizga qaragan xizmat yoʻq, oʻrnatishda yaratiladigan vendor hisobi yoʻq. Hodisa paytida bizni xonada koʻrmoqchi boʻlsangiz, boshqa har qanday pudratchi kabi oʻz tartibingiz boʻyicha kiritasiz — va bizdan rozilik soʻramasdan, xuddi shu yoʻl bilan chiqarasiz.',
          verify: 'Oʻrnatishdan keyin katalogingizni tekshiring: unda bizning hisobimiz yoʻq.',
        },
        {
          label: 'Air-gap',
          title: 'Oflayn ham — oʻsha dastur.',
          body: 'Modellar, indeks va interfeys birga keladi hamda internetga umuman ulanmasdan ishlaydi. Air-gap oʻrnatmasi qiziqarli qismlari olib tashlangan qisqartirilgan nashr emas — bu aynan oʻsha dastur, chunki undagi hech narsa boshidan internetni talab qilmagan. Yangilanish ham oʻsha tarmoqqa hamma narsa kiradigan yoʻl bilan keladi: siz olib kiradigan, tekshiradigan va oʻrnatishni oʻzingiz hal qiladigan imzolangan paket sifatida.',
          verify: 'Kabelni sugʻurib oling, savol bering — javob beradi.',
        },
      ],
    },

    permissions: {
      label: 'Kirish huquqlari',
      headline: ['Sizning ruxsatlaringiz —', 'bizning yangilarimiz emas.'],
      body: 'Har qanday bilim tizimining eng jiddiy nosozligi — tekislangan indeks: hamma narsa bitta qidiriladigan uyumga soʻriladi va endi notoʻgʻri stoldan berilgan savol kengash taqdimotini qaytaradi. CompanyMind bunday uyum yasamaydi.',
      points: [
        'Indeksga tushgan har bir parcha oʻzi olingan hujjatning kirish huquqini saqlaydi.',
        'Qidiruv modelga bitta parcha yetib borishidan oldin soʻrayotgan odamga qarab filtrlaydi.',
        'Kim kimligi sizning katalogingizdan olinadi: guruhlar, rollar va bekor qilishlar oʻrnatishda nusxa koʻchirilmaydi, har bir soʻrovda qaytadan tekshiriladi.',
        'Faylni ocha olmagan odam undan qurilgan javobni ham ololmaydi. U manbalar roʻyxatida ham koʻrinmaydi, chunki umuman topilmagan.',
      ],
      close: 'Hech kimning huquqi kengaymaydi. Hech narsa tekislanmaydi.',
      closeNote:
        'Foydalanuvchi tizimda aynan asosiy tizimlarda koʻradigan narsani koʻradi. Juma kuni katalogingizda kimningdir huquqini bekor qiling — keyingi savolgayoq tizim buni biladi.',
      trace: {
        label: 'Qidiruv · soʻrovchiga qarab filtrlangan',
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
      body: 'Savol, javob, manbalar, kim soʻragani va qachon. Hammasi sizning jurnal tizimingizga, sizning formatingizda, sizning muddatingiz boʻyicha yoziladi — auditorlaringiz bizdan soʻramasdan tekshiradi.',
      rows: [
        {
          k: 'Nima yoziladi',
          v: 'Berilgan savol, qaytarilgan javob, uni qurish uchun topilgan har bir parcha, kim soʻragani va qachon.',
        },
        {
          k: 'Qayerga tushadi',
          v: 'Sizning SIEM’ingizga, jurnal tizimingizga, saqlagichingizga. Yozilgan lahzadan boshlab bu sizning diskingizdagi sizning maʼlumotingiz.',
        },
        {
          k: 'Qancha saqlanadi',
          v: 'Siz belgilagan muddat boʻyicha. Bizda bu haqda na fikr bor, na uni majburlash imkoni.',
        },
        {
          k: 'Kim oʻqiy oladi',
          v: 'Siyosatingiz kimga ruxsat bersa. Biz u roʻyxatda yoʻqmiz va oʻzimizni qoʻsha oladigan yoʻl ham yoʻq.',
        },
      ],
    },

    inheritance: {
      label: 'Meros',
      headline: ['Nazoratlaringiz buni', 'allaqachon qamrab olgan.'],
      body: 'Sizning muhitingizda ishlaydigan dastur oʻsha muhitni boshqarish uchun allaqachon qoʻllayotgan nazoratlaringiz ostiga tushadi. Bu yerda alohida baholanadigan yangi narsa deyarli yoʻq — buni shunday qurishdan maqsad ham shu.',
      rows: [
        {
          control: 'Shaxs va kirish',
          line: 'Sizning IdP, SSO, guruhlaringiz va xodim qabul qilish-oʻzgartirish-boʻshatish tartibingiz. CompanyMind yonida oʻz foydalanuvchi bazasini yasamaydi, siz allaqachon ishlatadigan tizimga ulanadi.',
        },
        {
          control: 'Tarmoq siyosati',
          line: 'Sizning segmentatsiyangiz, brandmauer qoidalaringiz, «hammasini taqiqla» chiqish siyosatingiz. U boshqa ichki xizmatlar qatorida turadi va oʻziga istisno soʻramaydi.',
        },
        {
          control: 'Kalitlarni boshqarish',
          line: 'Sizning KMS yoki HSM. Saqlanayotgan maʼlumot siz saqlaydigan va oʻz muddatingizda almashtiradigan kalitlar bilan shifrlanadi. Biz ularni koʻrmaymiz, koʻrsak ham ishlata olmaymiz.',
        },
        {
          control: 'Jurnal va monitoring',
          line: 'Sizning SIEM uning jurnallarini oladi, ogohlantirishlaringiz uni qamrab oladi. Navbatchingiz uni oʻzi boshqaradigan hamma narsa bilan bitta ekranda koʻradi.',
        },
        {
          control: 'Zaxira va tiklash',
          line: 'Bu sizning virtual mashinangiz va disklaringiz. Mavjud zaxira, tiklash va favqulodda rejalaringiz unga ham oʻzgarishsiz taalluqli.',
        },
        {
          control: 'Oʻzgarishlarni boshqarish',
          line: 'Yangilanish — siz qabul qiladigan, sinab koʻradigan va oʻz muddatingizda tarqatadigan paket. Hech narsa oʻzini oʻzi yangilamaydi, chunki yangilanish izlab tashqariga chiqadigan yoʻl yoʻq.',
        },
      ],
      frameworks: {
        label: 'Majburiyatlaringiz haqida',
        body: 'Majburiyatlaringiz HIPAA, GLBA, DORA, PCI DSS yoki regulyatorning maʼlumot saqlash joyi boʻyicha qoidalari orqali oʻtsa, ular siz allaqachon boshqaradigan va hujjatlashtiradigan muhitga bogʻlanadi. CompanyMind’ni oʻsha muhitda ishlatish uni oʻsha majburiyatlar qamrab olgan chegara ichida qoldiradi: alohida javob, alohida vendor soʻrovnomasi va alohida istisno talab qiladigan ikkinchi chegara ochilmaydi. Majburiyat sizniki boʻlib qolaveradi, joylashtirish modeli esa uni bajarishni qiyinlashtirmaydi.',
      },
    },

    notClaiming: {
      label: 'Ochigʻini aytamiz',
      headline: ['Nimalarni daʼvo', 'qilmayapmiz.'],
      body: 'Baribir soʻraysiz. Shuning uchun oʻzimiz aytamiz — qoʻngʻiroqda bizdan sugʻurib olishingizga hojat qolmasin.',
      items: [
        {
          claim: 'Bizda sertifikat yoʻq.',
          line: 'SOC 2 ham, ISO 27001 ham, HIPAA tasdigʻi ham, FedRAMP ruxsati ham yoʻq. CompanyMind hali bozorga chiqmagan. Shu bosqichda boshqacha taassurot qoldirayotgan vendor sahifasi sizga vendor haqida koʻp narsa aytadi.',
        },
        {
          claim: 'Koʻrsatadigan mijozimiz yoʻq.',
          line: 'Logotiplar ham, keys tadqiqotlar ham, tavsiyalar ham, nomsiz «yirik global bank» ham yoʻq. Biz hozir birinchi hamkorlarimizni tanlayapmiz. Referenslar paydo boʻlganda, ular haqiqiy boʻladi va ruxsat bilan nomlanadi.',
        },
        {
          claim: 'Uni buzib boʻlmaydi demaymiz.',
          line: 'Har qanday dasturda xato boʻladi, bizniki ham istisno emas. Halol daʼvo torroq va foydaliroq: tashqariga yoʻl yoʻq, bizga kirish yoʻli yoʻq, umumiy oʻrnatma yoʻq — demak, xatolarimizning taʼsiri sizning perimetringizda, nazoratlaringiz allaqachon turgan joyda toʻxtaydi.',
        },
        {
          claim: 'Bular benchmark emas.',
          line: 'Aniqlik foizi ham, kechikish raqami ham, qidiruv bahosi ham yoʻq. Biz bu raqamlarni oʻlchab olmaganmiz, birinchi oʻrnatmadan oldin eʼlon qilinganlari esa marketing arifmetikasi.',
        },
      ],
      close: 'Sertifikat — kompaniya haqidagi gap. Arxitektura — tizim haqidagi gap.',
      closeNote:
        'Biz ikkinchisini beramiz va uni oʻzingiz tekshirishingizni istaymiz. Audit kelganda esa u allaqachon shunday ishlab turgan tizimni koʻradi.',
    },

    cta: {
      label: 'Hamkorlik',
      headline: ['Xavfsizlik soʻrovnomangizni', 'bizga yuboring.'],
      body: 'Qiyin savollarga erta javob berishni afzal koʻramiz. Bu tekshiruvimizdan oʻtadimi deb oʻylayotgan boʻlsangiz — tekshiruvni olib keling: topologiya, tahdid modeli, auditorlaringiz toʻqqizinchi oyda beradigan savollar. Biz tartibga solinadigan muhitlardan bir nechta hamkor tanlayapmiz va aynan shunday suhbatda boʻlishni istaymiz.',
      fineprint: 'Sotuv boʻlimi emas, muhandis javob beradi.',
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
        'CompanyMind’dan foydalanishning uch yoʻli: bir kishi uchun oyiga $15, 100 kishigacha jamoa uchun oyiga $1 300 va air-gap hamda ichki oʻrnatmalar uchun alohida hisoblanadigan Korxona tarifi.',
    },

    hero: {
      label: 'Narxlar',
      headline: ['Ikkita narx', 'va bitta suhbat.'],
      sub: 'Individual va Jamoa — bitta dasturning ikki oʻlchami, shuning uchun ikkalasining ham narxi ochiq. Korxona tarifi esa oʻz serveringizda, oʻz chegarangiz ichida ishlaydi: bu qancha turishi infratuzilmaga bogʻliq, shuning uchun uni bosib qoʻymaymiz, hisoblab beramiz.',
    },

    plans: [
      {
        id: '01',
        name: 'Individual',
        badge: null,
        who: 'Oʻz ishi oddiy qidiruv imkoniyatidan oshib ketgan bir kishi uchun: maslahatchi, tahlilchi, sherik, asoschi.',
        price: '$15',
        period: '/ oyiga',
        priceNote:
          'Bir kishi, bitta shaxsiy ish maydoni. Oylik toʻlov, istagan paytda bekor qilasiz.',
        features: [
          'Hech kim yeta olmaydigan shaxsiy ish maydoni.',
          '2 000 tagacha hujjat va 20 GB manba.',
          'Barcha formatlar: hujjat, jadval, PDF, xat, yozishma, rasm va audio.',
          'Manbali javoblar: har bir jumla oʻzi olingan hujjatni ochadi.',
          'Brauzerdan ham, Telegram’dan ham soʻrash.',
          'Pochta orqali qoʻllab-quvvatlash.',
        ],
        cta: 'Bitta oʻrindan boshlash',
      },
      {
        id: '02',
        // Ajratib koʻrsatiladigan tarif. Urgʻu --brain va toʻq siyoh tugma
        // orqali beriladi, hech qachon --sovereign orqali emas (u perimetr
        // pulsi va bosh sahifadagi CTA uchun saqlangan).
        name: 'Jamoa',
        badge: '100 kishigacha',
        who: 'Savoli bor har bir xodimga ochib bermoqchi boʻlgan kompaniyalar uchun.',
        price: '$1 300',
        period: '/ oyiga',
        priceNote:
          '100 kishigacha — bir kishiga $13, yaʼni yakka tarifdan ham arzon. Oʻrindiqlarni hech kim sanamaydi. 100 dan oshsa — Korxona tarifi.',
        features: [
          'Individualdagi hamma narsa, butun kompaniyaga ochilgan.',
          'Kirish guruhlari: har kim faqat oʻziga ruxsat berilgan hujjatlardan javob oladi.',
          'Admin panel: xodim qoʻshish, guruh berish, kim nimani koʻra olishini nazorat qilish.',
          'Ish maydoni uchun bitta Telegram bot: odamlarni tasdiqlash va har biriga guruh.',
          'Audit eksporti: har bir savol, javob va manba jurnal tizimingizga.',
          'Bizda joylashtiriladi yoki oʻz VPC’ingizga oʻrnatiladi — narx bir xil.',
          '100 000 tagacha hujjat va 1 TB manba.',
        ],
        cta: 'Jamoa uchun narx olish',
      },
      {
        id: '03',
        name: 'Korxona',
        badge: null,
        who: 'Bank, shifoxona tarmogʻi, yuridik firma yoki mudofaa yetkazib beruvchisi uchun — ichki oʻrnatma xohish emas, regulyator talabi boʻlgan joyda.',
        price: 'Kelishiladi',
        period: '',
        priceNote:
          'Infratuzilmangizga qarab hisoblanadi: qancha maʼlumot oʻqiladi, necha kishi soʻraydi va kimning serverida ishlaydi. Air-gap oʻrnatmasi alohida loyiha.',
        features: [
          'Jamoadagi hamma narsa, tashqariga umuman yoʻlsiz.',
          'Cheklanmagan xodim, cheklanmagan hujjat.',
          'Air-gap oʻrnatma: modellar, indeks va interfeys birga keladi, oflayn ishlaydi.',
          'Sizning serverlaringiz, sizning javonlaringiz, sizning jismoniy nazoratingiz.',
          'IdP orqali SSO; ruxsatlar har bir soʻrovda qaytadan tekshiriladi.',
          'Sohangizga moslashtirilgan modellar — oʻz chegarangiz ichida oʻqitiladi.',
          'Oflayn yangilanish: siz olib kiradigan va oʻrnatishni oʻzingiz hal qiladigan imzolangan paket.',
          'Alohida qoʻllab-quvvatlash: tizimni qurgan muhandislar bilan toʻgʻridan-toʻgʻri aloqa.',
        ],
        cta: 'Biz bilan gaplashing',
      },
    ],

    plansNote:
      'Narxlar AQSh dollarida, oyiga, har oy toʻlanadi. Yillik toʻlovda ikki oy bepul. Mahalliy soliqlar kiritilmagan. Bu yerdagi hech narsa shartnoma emas — bogʻlovchi shartlar joylashtirish shartnomasi bilan keladi.',

    everyTier: {
      label: 'Har bir tarifda',
      headline: ['Har bir tarifda', 'birdek amal qiladi.'],
      items: [
        {
          label: 'Joylashtirish',
          value: 'Dastur hamma tarifda bir xil. Tariflar orasida faqat hajm farq qiladi, imkoniyatlar emas.',
        },
        {
          label: 'Tashqariga chiqish',
          value:
            'Hech narsa tashqariga xabar yubormaydi. Telemetriya ham, tashqi model API’si ham yoʻq.',
        },
        {
          label: 'Manbalar',
          value: 'Har bir jumla oʻzi olingan hujjatga bogʻlanadi. Manbasi yoʻq javob ham yoʻq.',
        },
        {
          label: 'Audit jurnali',
          value:
            'Savollar, javoblar va manbalar sizning tizimlaringizda, siz belgilagan muddat boʻyicha.',
        },
      ],
    },

    faq: {
      label: 'Ochiq javoblar',
      headline: 'Narxlar roʻyxati chetlab oʻtadigan savollar.',
      items: [
        {
          q: 'Nega Korxona tarifining narxi yoʻq?',
          a: 'Chunki ichki oʻrnatma qutidagi mahsulot emas. Narx qancha maʼlumot oʻqilishiga, necha kishi savol berishiga va kimning serverida ishlashiga bogʻliq: shifoxonadagi air-gap javon bilan VPC butunlay boshqa loyiha. Individual va Jamoa — hajmi maʼlum bitta dastur, shuning uchun ularning narxi ochiq turadi. Korxona tarifi bitta suhbatdan keyin hisoblanadi va oʻsha hisob haqiqatga toʻgʻri keladi.',
        },
        {
          q: 'Jamoa — Individualning yuz barobarimi?',
          a: 'Yoʻq, arzonroq: yuz barobari $1 500 boʻlardi, biz esa $1 300 deymiz. Yaʼni bir kishiga $13 — yakka tarifdan ham past. Dastur tomondan ham bu oddiy koʻpaytma emas: yuz kishiga kirish guruhlari, ularni taqsimlaydigan egasi va audit jurnali kerak, bular bir kishilik tarifda umuman yoʻq. Siz toʻlamaydigan narsa — har bir oʻrindiq uchun hisoblagich: seshanba kuni yangi odam qoʻshsangiz, hisob-fakturada hech narsa oʻzgarmaydi.',
        },
        {
          q: '«Ichki oʻrnatma» bu yerda aniq nimani anglatadi?',
          a: 'Dastur maʼlumotlaringiz allaqachon turgan joyda ishlashini: oʻz serveringizda, VPC’ingizda yoki internetga ulanmagan mashinada. Uning ortida jimgina asosiy ishni bajarayotgan bulut yoʻq. Bizda sizning oʻrnatmangizga ham, maʼlumotingizga ham yoʻl yoʻq.',
        },
        {
          q: 'Joylashtirish siz tomondan nimani talab qiladi?',
          a: 'Ishga tushirish uchun joy, oʻqitmoqchi boʻlgan manbalaringizga ruxsat va SSO uchun identifikatsiya provayderingiz. Oʻrnatishni jamoangiz bajaradi, biz esa devor ortidan arxiv otish oʻrniga ular bilan birga ishlaymiz. Kerakli quvvat korpusingizga bogʻliq, shuning uchun bu yerdagi izohga emas, hisob-kitob suhbatiga tegishli.',
        },
        {
          // Eng muhim halol javob. Tartibga solinadigan xaridor buni birinchi
          // soʻraydi va bu yerdagi har qanday chiroyli aylanma savdoni butunlay
          // yoʻqotadi. Avval «yoʻq» deymiz, keyin nega arxitektura nishondan
          // yaxshiroq javob ekanini aytamiz.
          q: 'SOC 2 yoki HIPAA sertifikatingiz bormi?',
          a: 'Yoʻq. CompanyMind’da hech qanday sertifikat yoʻq va biz buni nishoncha bilan boshqacha koʻrsatmaymiz. Biz taklif qiladigan narsa — arxitektura: dastur majburiyatlaringiz allaqachon qamrab olgan chegara ichida ishlaydi, shuning uchun nazoratlaringiz, jurnallaringiz va auditorlaringiz unga infratuzilmangizdagi boshqa hamma narsaga yetgandek yetadi. Sertifikatlar sizniki. Bizning ishimiz — ularni saqlashni qiyinlashtirmaslik.',
        },
        {
          q: 'Kichikdan boshlab oʻsish mumkinmi?',
          a: 'Ha, va yoʻlda hech narsa koʻchirilmaydi. Har bir tarif bitta dasturni ishlatadi — kichigi qiziqarli qismlari olib tashlangan demo emas. Oʻsish — qamrovni kengaytirish: koʻproq odam, koʻproq manba va oxir-oqibat oʻz serveringiz.',
        },
      ],
    },

    cta: {
      label: 'Hamkorlik',
      headline: ['Har bir tarif oʻsha', 'bitta suhbatdan boshlanadi.'],
      body: 'CompanyMind hali bozorga chiqmagan. Biz uni shu muammoni yaxshi biladigan bir nechta jamoa bilan birga quryapmiz. Nima sochilib yotganini va u qayerga chiqa olmasligini ayting — biz joylashtirish qanday boʻlishini aytamiz.',
      submit: 'Suhbatni boshlash',
      href: ROUTES.contact,
      fineprint: 'Bitta odam oʻqiydi, bitta odam javob yozadi. Reklama xatlari yoʻq.',
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
        'Eng kuchli sunʼiy intellekt API koʻrinishida keladi, iqtisodiyotdagi eng nozik maʼlumotlarni saqlaydigan muassasalar esa unga murojaat qila olmaydi. CompanyMind nega mustaqil bilim tizimini quryapti va qayerda turibmiz.',
    },

    hero: {
      eyebrow: 'Biz haqimizda',
      headline: ['Eng kuchli AI', 'birovning', 'kompyuterida', 'ishlaydi.'],
      sub: 'Bank, shifoxona, mudofaa yetkazib beruvchisi yoki yuridik firma uchun bu tarozida oʻlchanadigan murosa emas — bu umuman boshlanmaydigan suhbat. Natijada iqtisodiyotdagi eng muhim maʼlumotlarni saqlaydigan muassasalar avlodning eng foydali texnologiyasidan chetda qolyapti. Tuzatishga arziydigani ham shu.',
    },

    position: {
      label: 'Pozitsiya',
      headline: ['Imkoniyat bitta shart', 'bilan keldi.'],
      body: [
        'Soʻnggi uch yildagi har bir jiddiy sakrash bir xil yoʻl bilan yetkazildi — endpoint sifatida. Undan foydalanish uchun maʼlumotingizni siz nazorat qilmaydigan kompaniyaga, siz tekshira olmaydigan serverga, siz yozmagan shartlar asosida yuborishingiz kerak. Koʻpchilik biznes uchun bu maqbul kelishuv. Baʼzilari uchun esa suhbat birinchi uchrashuvdayoq tugaydi.',
        'Bu ehtiyotkorlik ham, texnologiyadan qoʻrqish ham emas — bu ish tartibi. Nazoratchiga vendorning maxfiylik siyosati bilan javob bera olmaysiz. Advokatlik siriga tegishli materialni birovning jurnaliga qoʻya olmaysiz. Bu muassasalar ishlaydigan qoidalar koʻndirsa boʻladigan xohish emas: aynan oʻsha qoidalar tufayli ularga bu maʼlumot ishonib topshirilgan.',
      ],
      ledger: {
        colWho: 'Kim chetda qolgan',
        colWhy: 'Nega',
        rows: [
          {
            who: 'Bank',
            why: 'Regulyatorga belgilangan muddatda va yozma javob beriladigan mijoz yozuvlari.',
          },
          {
            who: 'Shifoxona',
            why: 'Oʻzi qayta talqin qila olmaydigan qoidalar asosida himoya qilinishi shart boʻlgan bemor maʼlumotlari.',
          },
          {
            who: 'Mudofaa yetkazib beruvchisi',
            why: 'Umumiy tarmoqqa umuman tegishi mumkin boʻlmagan dasturlar.',
          },
          {
            who: 'Yuridik firma',
            why: 'Advokatlik sirida saqlanadigan va uchinchi tomonga berilmaydigan mijoz materiali.',
          },
        ],
      },
      closer: 'Texnologiya ular uchun ham ishlaydi. Yetkazib berish usuli — yoʻq.',
      closerBody:
        'Buni tashqaridan hech kim tuzatmaydi, chunki manfaat teskari tomonga qaragan: umumiy endpoint qurish oson, hisoblash oson, sotish oson. Shuning uchun biz boshqa yoʻlni quryapmiz: xuddi shu darajadagi tizim, faqat chegaradan tashqariga emas, chegara ichiga yetkaziladi.',
    },

    beliefs: {
      label: 'Nimaga ishonamiz',
      headline: ['Uch narsada murosa', 'qilmaymiz.'],
      items: [
        {
          n: '01',
          title: 'Manbasi yoʻq javob — mish-mish.',
          body: 'Tartibga solinadigan biznesda manbasi koʻrsatilmagan javob — javob emas, qoʻshimcha ish: endi kimdir uni tekshirib chiqishi kerak. CompanyMind javobni topilgan parchalardan quradi va har bir jumlaga manba biriktiradi, chunki tekshirib boʻlmaydigan javob umuman javobsizlikdan qimmatga tushadi.',
        },
        {
          n: '02',
          title: 'Dastur maʼlumot turgan joyda ishlashi kerak.',
          body: 'Nozik maʼlumotni koʻchirish koʻp arxitekturalarning eng xavfli qismi, aksariyat vendorlar esa bu ishni sizga yuklaydi. Bizningcha, joylashtirish muassasaga moslashishi kerak: oʻz serveringiz, VPC’ingiz, air-gap javoningiz. Nazoratlaringiz oʻsha chegarani allaqachon qamragan — biz atrofimizga yangisini chizishingizni soʻramaymiz.',
        },
        {
          n: '03',
          title: 'Nazorat — imkoniyatning narxi emas.',
          body: 'Kuchli AI bilan oʻz maʼlumotingiz ustidan nazorat orasida tanlash texnologiyaning xossasi emas, sanoat yetkazib berishni shunday tanlaganining natijasi. Modellar oʻz serveringizda ishlasa va indeks oʻz disklaringizda tursa, tanlash zarurati yoʻqoladi. Qurish qiyinroq, lekin imkonsiz emas.',
        },
      ],
    },

    stage: {
      label: 'Bosqich',
      headline: ['Hali bozorga', 'chiqmaganmiz.'],
      body: 'CompanyMind shu muammoni yaxshi biladigan bir nechta jamoa bilan birga qurilyapti. Bosqichimiz haqidagi qolgan hamma narsa shu sahifada, iloji boricha sodda tilda — chunki muqobili buni keyinroq oʻzingiz bilib olishingizni kutish boʻlardi.',
      inventory: [
        {
          k: 'Mijozlar',
          v: 'Hozircha yoʻq. Bu saytda logotiplar qatori yoʻq, chunki unga qoʻyadigan halol narsa yoʻq.',
        },
        {
          k: 'Sertifikatlar',
          v: 'Yoʻq. Bugun bizda hech qanday xavfsizlik sertifikati yoʻq va buni nishoncha bilan yashirmaymiz. Auditdan oʻtganimizda aytamiz, siz esa tekshira olasiz.',
        },
        {
          k: 'Keys tadqiqotlar',
          v: 'Yoʻq. Bozorga chiqmagan boʻlish — oʻqishga arziydigan hikoya yozadigan darajada uzoq ishlagan oʻrnatma yoʻq degani.',
        },
        {
          k: 'Daromad',
          v: 'Yoʻq. Biz hali oʻrindiq sotmayapmiz, hamkor tanlayapmiz.',
        },
      ],
      have: 'Bizda bor narsa — har bir qatorini himoya qila oladigan pozitsiya va xossalari har qanday oʻrnatmada birinchi kunidan rost boʻladigan arxitektura. Chunki ular tizim qanday qurilganidan kelib chiqadi, uni necha kishi sotib olganidan emas.',
    },

    lab: {
      label: 'Jamoa',
      headline: ['Kichik jamoa —', 'ataylab.'],
      body: 'Mustaqil oʻrnatiladigan dastur sotuv muammosiga aylanishidan ancha oldin muhandislik muammosi. U biz hech qachon kirmagan binoga, biz nazorat qilmaydigan serverga, internetsiz va xonada CompanyMind’dan hech kim boʻlmagan holda oʻrnatilishi kerak. Bunday ish butun tizimni boshida tuta oladigan kichik jamoaga qulay. Quyida u qanday boʻlinadi.',
      note: 'Bular — rollar, portret emas. Ismlar haqiqiy odamlar paydo boʻlganda qoʻyiladi.',
      roles: [
        {
          n: '01',
          title: 'Asoschi / ML',
          focus: 'pozitsiya · qidiruv · asoslash',
          nameSlot: 'ism keyinroq',
          body: 'Model qatlamiga javob beradi: qidiruv, asoslash va javobni manba materiali ichida ushlab turadigan post-training ishi. CompanyMind nima qilishdan bosh tortishini ham shu odam hal qiladi. Birinchi xatingizga javob beradigan ham u.',
        },
        {
          n: '02',
          title: 'Tizimlar',
          focus: 'oʻrnatish · inference · air-gap',
          nameSlot: 'ism keyinroq',
          body: 'Oʻrnatishga javob beradi. CompanyMind’ni shunday qadoqlaydiki, u biz hech koʻrmagan server xonasiga tushadi, mijozning oʻz GPU’larida ishlaydi va yonida muhandis turmasdan air-gap orqali yangilanadi.',
        },
        {
          n: '03',
          title: 'Amaliy tadqiqot',
          focus: 'oʻqish · qidiruv sifati · baholash',
          nameSlot: 'ism keyinroq',
          body: 'Muammoning eng qaysar tomonida ishlaydi: matni surat boʻlgan skanlar, hech kim transkript qilmagan yozuvlar, aslida maʼlumotlar bazasi boʻlgan jadvallar. Sifatni mijoz chegarasi ichida oʻlchaydigan baholash tizimini quradi, chunki biz ularning maʼlumotiga hech qachon oʻzimiz qaray olmaymiz.',
        },
        {
          n: '04',
          title: 'Xavfsizlik muhandisligi',
          focus: 'perimetr · audit · tekshiruv',
          nameSlot: 'ism keyinroq',
          body: 'Arxitekturamizni mijozning auditori koʻzi bilan oʻqiydi, keyin oʻsha auditor soʻraydigan narsani quradi: maʼlumot oqimi hujjatlari, oʻrnatma topologiyasi, mijozning oʻz tizimlariga tushadigan audit jurnali. Tekshirishni ularning nazoratlari bajaradi; bizning ishimiz — ularga taxmin qiladigan narsa qoldirmaslik.',
        },
      ],
    },

    cta: {
      label: 'Hamkorlik',
      headline: ['Maʼlumotingiz chiqa olmasa,', 'gaplashishimiz kerak.'],
      body: 'Biz buni birga qurish uchun bir nechta jamoa tanlayapmiz. Siz tizimni oʻz chegarangiz ichida olasiz va u nimaga aylanishiga haqiqiy taʼsir koʻrsatasiz. Biz esa bozorga chiqishdan oldin eng kerakli narsani olamiz: bu ishlaydimi degan savolga rost javob.',
      fineprint: 'Bitta odam oʻqiydi, bitta odam javob yozadi.',
    },
  },

  /* -------------------------------------------------------------------------
   * /aloqa — hamkor tanlash.
   * Quyidagi har bir vaʼda kichik jamoaning pochta qutisi bajara oladigan
   * vaʼda. Kimdir haqiqatan javobgar boʻlmasa, javob muddatini qoʻshmang.
   * ----------------------------------------------------------------------- */
  contact: {
    meta: {
      title: 'Aloqa',
      description:
        'CompanyMind birga qurish uchun bir nechta jamoa tanlayapti. Bilimingiz sochilib yotgan boʻlsa va maʼlumotingiz infratuzilmangizdan chiqa olmasa — suhbatni boshlang.',
    },

    hero: {
      eyebrow: 'Hamkorlik',
      headline: ['Buni birga quradigan', 'bir nechta jamoa', 'tanlayapmiz.'],
      lede: 'CompanyMind hali bozorga chiqmagan: hozircha mijoz ham, sertifikat ham, sotuv boʻlimi ham yoʻq. Bizda bor narsa — himoya qila oladigan arxitektura va bizga yordam beradigan jamoalar atrofida hali egiluvchan mahsulot.',
    },

    fit: {
      label: 'Kimga mos',
      title: 'Bu kim uchun',
      body: 'Bank, shifoxona tarmogʻi, yuridik firma, mudofaa yetkazib beruvchisi. Maʼlumot haqiqatan tashqariga chiqa olmaydigan va bu xohish emas, regulyator chizigʻi boʻlgan joy. Umuman AI qiziqtirsa — biz notoʻgʻri manzilmiz. Hech kim qidira olmaydigan va hech kimga yuklab berish mumkin boʻlmagan aniq bir bilim uyumingiz boʻlsa — toʻgʻri manzilmiz.',
      points: [
        {
          label: 'Ichki oʻrnatma — muhokamasiz',
          line: 'Maʼlumotingiz infratuzilmangizdan chiqa olmaydi va buni yuqoridagi kimdir allaqachon yozib qoʻygan.',
        },
        {
          label: 'Tartibsizlik haqiqiy',
          line: 'Oʻn yillik fayllar, yozishmalar, yozuvlar va skanlar. Javob ularning ichida ekanini bilasiz.',
        },
        {
          label: 'Oʻrnata olasiz',
          line: 'Siz tomondan kimdir bizga server va ishlaydigan tarmoq ajrata oladi.',
        },
        {
          label: 'Biz bilan bahslashasiz',
          line: 'Hamkorlar yoʻl xaritasiga taʼsir qiladi. Bu faqat xato qilganimizda ochiq aytsangiz ishlaydi.',
        },
      ],
      trade:
        'Kelishuv ochiq: siz muammoingiz atrofida shakllangan mahsulotni va uni quruvchilar bilan toʻgʻridan-toʻgʻri aloqani olasiz. Shu bilan birga tugallanmagan mahsulotni va birinchi boʻlishning barcha xatolarini ham olasiz.',
    },

    next: {
      label: 'Yuborgandan keyin',
      title: 'Keyin nima boʻladi',
      steps: [
        { n: '01', line: 'Xatni odam oʻqiydi. Ball qoʻyadigan model ham, sotuv navbati ham yoʻq.' },
        {
          n: '02',
          line: 'Bitta javob olasiz. Mos kelmasa, jim qolish oʻrniga shuni ochiq aytamiz.',
        },
        {
          n: '03',
          line: 'Mos kelsa, qoʻngʻiroq belgilaymiz va tizimni ishlayotgan holda koʻrsatamiz.',
        },
      ],
      promise:
        'Bitta odam oʻqiydi, bitta odam javob yozadi. Reklama xatlari yoʻq. Manzilingizni sotmaymiz, ulashmaymiz va hech qanday roʻyxatga qoʻshmaymiz.',
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
          label: 'Nima sochilib yotibdi?',
          hint: 'Ixtiyoriy. Kompaniyangizning bilimi hozir aslida qayerda? Ikki qator yetarli.',
          placeholder:
            'Uchta tizimga tarqalgan oʻn yillik shartnomalar, ularni yozgan odam esa ishdan ketgan.',
        },
      },
      submit: 'Yuborish',
      sending: 'Yuborilyapti',
      errors: {
        emailRequired: 'Javob berishimiz uchun ish pochtangizni yozing.',
        emailInvalid: 'Bu pochta manziliga oʻxshamayapti.',
      },
      success: {
        title: 'Qabul qilindi.',
        body: 'Xatingizni oʻqib, javob yozamiz. Bundan boshqa hech narsa kelmaydi — na reklama, na axborotnoma.',
      },
      failure: {
        title: 'Yuborilmadi.',
        body: 'Ayb bizda, sizda emas. Toʻgʻridan-toʻgʻri yozing — xat ayni oʻsha joyga tushadi:',
      },
      fallback: { lead: 'Pochta orqali yozasizmi?', address: brand.email, subject: 'Hamkorlik' },
    },
  },

  /* -------------------------------------------------------------------------
   * /maxfiylik, /shartlar
   * ⚠️ YURIDIK TEKSHIRUVDAN OʻTMAGAN. ISHGA TUSHIRISHDAN OLDIN OʻQING. ⚠️
   * Bular ataylab qisqa matnlar: yagona interaktiv qismi aloqa formasi boʻlgan,
   * hali bozorga chiqmagan marketing sayti uchun ROST. Ular yurisdiksiya,
   * yuridik shaxs, kafolat, javobgarlik chegarasi, subprotsessorlar yoki
   * kunlardagi saqlash muddatlarini ataylab nomlamaydi.
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
        'Bu sayt nima yigʻadi: aloqa formasiga yozgan xabaringiz va boshqa hech narsa. Kuzatuv cookie yoʻq, reklama tarmogʻi yoʻq, maʼlumot sotish yoʻq.',
      headline: ['Bu sayt deyarli', 'hech narsa yigʻmaydi.'],
      standfirst:
        'Bu shu sahifa uchun tanlangan poza emas. Bu — mahsulotning asosiy fikri: yigʻilmagan maʼlumot sizib chiqmaydi, sotilmaydi va yoʻqolmaydi. Marketing saytini ham shu qoida boʻyicha ushlab turamiz.',
      sections: [
        {
          heading: 'Bu sayt nima yigʻadi',
          body: [
            'Bitta narsa — aloqa formasiga yozganingizni: ish pochtangiz va yoniga qoʻshgan gapingiz. Bu bizga xabar boʻlib keladi va uni odam oʻqiydi.',
            'Bu saytda boshqa hech narsa sizdan hech nima soʻramaydi. Hisob yoʻq, kirish yoʻq, profil yoʻq.',
          ],
        },
        {
          heading: 'Bu sayt nima qilmaydi',
          body: [
            'Bu — oddiy marketing sayti. U ataylab kichik, qilmaydigan ishlari roʻyxati esa qiladiganlaridan uzun.',
          ],
          list: [
            'Kuzatuv cookie yoʻq. Sayt yozadigan yagona cookie — siz tanlagan til, keyingi safar oʻsha tilda ochilishi uchun.',
            'Reklama tarmoqlari, piksellar va retargeting yoʻq. Sizni internet boʻylab kuzatmaymiz.',
            'Siz haqingizda hech qanday xulq-atvor profili ham, seans yozuvi ham yoʻq.',
            'Maʼlumotingizni sotmaymiz. Hech kimga, hech qanday narxda.',
            'Axborotnoma yoʻq, reklama zanjiri yoʻq, siz soʻramagan roʻyxat yoʻq.',
          ],
        },
        {
          heading: 'Yuborganingiz bilan nima qilamiz',
          body: [
            'Oʻqiymiz va javob beramiz. Suhbat davom etishi uchun xabarni saqlaymiz — xuddi kompaniyaga yozilgan har qanday xat oʻsha kompaniyaning pochtasida qolgani kabi.',
            'Oʻchirishimizni istasangiz, yozing — oʻchiramiz. Taxmin qilgandan koʻra soʻralganini afzal koʻramiz.',
          ],
        },
        {
          heading: 'Sahifaning oʻzi qanday yetib keladi',
          body: [
            'Veb-sahifa serverdan keladi, server esa soʻrovni koʻradi. Hosting provayderimiz saytni brauzeringizga yetkazish uchun texnik jihatdan zarur boʻlgan narsani, jumladan oddiy soʻrov jurnallarini qayta ishlaydi. Biz ulardan siz haqingizda tasavvur yasash uchun foydalanmaymiz va ularni hech narsa bilan boyitmaymiz.',
            'Toʻliq maxfiylik siyosati aynan shu joyda provayderlar va saqlash muddatlarini nomlaydi. Biz hali bozorga chiqmaganmiz va bu roʻyxat yakuniy emas, shuning uchun keyin jimgina tuzatiladigan versiyani eʼlon qilmaymiz. Soʻrang — bugun nima ishlayotganini aniq aytamiz.',
          ],
        },
        {
          heading: 'Mahsulot esa butunlay boshqa narsa',
          body: [
            'Yuqoridagi hamma narsa shu veb-sayt haqida. U CompanyMind mahsuloti haqida emas, chunki ikkalasi bir-biridan juda uzoq.',
            'CompanyMind sizning infratuzilmangiz ichida turadi. Maʼlumotingiz oʻsha yerda qoladi. Bizda unga kirish ham, nusxasi ham, unga yoʻl ham yoʻq — u turadigan bulut yoʻq, chunki umuman bulut yoʻq. Oʻrnatmangiz ichidagi maʼlumot bilan nima boʻlishini bu sahifa emas, sizning nazoratlaringiz va biz siz bilan imzolaydigan shartnoma belgilaydi.',
          ],
        },
      ],
      note: {
        label: 'Shu qismini oʻqing',
        heading: 'Bu sahifa qisqa, chunki sayt kichik.',
        body: 'U aloqa formasi bor, hali bozorga chiqmagan marketing saytini qamrab oladi va qoʻlga kiritilmagan bandlarni takrorlash oʻrniga bugun rost boʻlgan narsani aytadi. Maʼlumot himoyasining toʻliq shartlari — subprotsessorlar, saqlash, joylashuv, oʻchirish, audit huquqlari — joylashtirish shartnomasida muzokara qilinadi va unga biriktiriladi. Bogʻlaydigani ham oʻsha.',
      },
      contact: {
        heading: 'Shular haqida soʻrash',
        body: 'Bitta manzil bor va unga odam javob beradi. Nima saqlayotganimizni soʻrang, oʻchirishni soʻrang yoki bu sahifa qamramagan savolni bering.',
      },
    },

    terms: {
      label: 'Shartlar',
      title: 'Foydalanish shartlari',
      description:
        'CompanyMind sayti shartlari: unda nima bor, aloqa formasi nimani anglatadi va anglatmaydi, haqiqatan bogʻlaydigan shartlar esa qayerda.',
      headline: ['Bu sayt —', 'mahsulot emas.'],
      standfirst:
        'CompanyMind hali bozorga chiqmagan. Bu yerda nima qurayotganimiz haqida oʻqishingiz va biz bilan gaplashishni soʻrashingiz mumkin. Bu shartlar aynan shuni qamrab oladi, boshqa hech narsani emas.',
      sections: [
        {
          heading: 'Bu shartlar nimani qamraydi',
          body: [
            'Shu veb-saytdan foydalanishingizni. Butun qamrov shu.',
            'Bu saytdan hech qanday dastur taklif qilinmaydi, litsenziyalanmaydi, sotilmaydi yoki yetkazilmaydi. Demak, bu dastur shartnomasi emas va uni oʻqiganingiz sizni hech qanday majburiyatga qoʻymaydi.',
          ],
        },
        {
          heading: 'Bu yerda nima yozilgan',
          body: [
            'Tartibga solinadigan tashkilotlar uchun, ularning oʻz infratuzilmasida ishlaydigan qurilayotgan mahsulot taʼrifi. Uni aniq taʼriflashga, qoʻllab-quvvatlay olmaydigan gapni aytmaslikka va bizda yoʻq sertifikatni koʻrsatmaslikka jiddiy harakat qildik.',
            'Bu — hamon ishlab chiqilayotgan dastur taʼrifi. U nima qilishi, qancha turishi va qachon chiqishi ikkalamiz imzolaydigan hujjat paydo boʻlgunicha oʻzgarishi mumkin. Narxlar sahifasidagi raqamlar — bugungi niyatimiz, qulflangan taklif emas.',
          ],
        },
        {
          heading: 'Sizdan nima soʻraymiz',
          body: [
            'Oʻqing, havola qiling, iqtibos keltiring, hamkasbingizga yuboring. Bularning hech biriga ruxsatimiz kerak emas.',
            'Soʻzlar, dizayn va kod bizniki. Ularni oʻzingizniki deb koʻrsatmang, saytga hujum qilmang va uni tinimsiz skreyping qilmang. Butun roʻyxat shu.',
          ],
        },
        {
          heading: 'Aloqa formasi',
          body: [
            'Gaplashmoqchi boʻlsangiz ish pochtangizni yuboring. Uni yuborish shartnoma tuzmaydi, hech narsani band qilmaydi, narxni qulflamaydi va ikkalamizni hech narsaga majburlamaydi. U shunchaki odam bilan suhbatni boshlaydi.',
            'Maxfiy materialni bu forma orqali yubormang: bu marketing saytidagi oddiy forma va nozik maʼlumot uchun qurilgan kanal emas. Kerak boʻlsa ayting — alohida tashkil qilamiz.',
          ],
        },
        {
          heading: 'Bogʻlaydigan shartlar qayerda',
          body: [
            'Bu yerda emas. Birga ishlasak, dasturni, maʼlumotni, xavfsizlik majburiyatlarini, qoʻllab-quvvatlashni, javobgarlikni va haqiqatan muhim boʻlgan qolgan hamma narsani joylashtirish shartnomasi belgilaydi. U muzokara qilinadi, imzolanadi va aynan sizga moslashtiriladi.',
            'U paydo boʻlgunicha bu saytdagi hamma narsa — marketing. Veb-sahifani shartnoma qilib koʻrsatgandan koʻra shuni ochiq aytishni afzal koʻramiz.',
          ],
        },
      ],
      note: {
        label: 'Shu qismini oʻqing',
        heading: 'Bular ataylab toʻliq shartlar emas.',
        body: 'Bu yerda amal qiluvchi qonun bandi, javobgarlik chegarasi, kafolat yoki bosh harflardagi ogohlantirish topmaysiz. Bu eʼtiborsizlik emas: hali kafolatlaydigan narsa yoʻq, faqat aloqa formasi joylashgan sayt uchun yurisdiksiya nomlash esa teatr boʻlardi. Haqiqiy shartlar haqiqiy narsa uchun yoziladi va joylashtirish shartnomasi bilan keladi.',
      },
      contact: {
        heading: 'Savollaringiz boʻlsa',
        body: 'Taxmin qilgandan koʻra soʻrang. Bu yerdagi biror gap biz nazarda tutmagan vaʼdadek oʻqilsa — bilishni istaymiz va matnni tuzatamiz.',
      },
    },
  },

  /* -------------------------------------------------------------------------
   * 404 — brend metaforasi, jiddiy oʻynalgan: indeksda yoʻq hujjat.
   * Mahsulotning qoidasi «manbasi yoʻq javob ham yoʻq», shuning uchun bu
   * sahifa ham taxmin qilmaydi.
   * ----------------------------------------------------------------------- */
  notFound: {
    label: '404 · manba topilmadi',
    title: 'Indeksda yoʻq',
    description: 'Bu sahifa saytning bir qismi emas.',
    headline: ['Indeksda', 'yoʻq.'],
    body: 'Siz soʻragan sahifa bu saytda yoʻq. U koʻchirilgan ham boʻlishi mumkin, umuman boʻlmagan ham — biz qaysi biri ekanini taxmin qilmaymiz.',
    footnote:
      'Manbasi yoʻq javob ham yoʻq. Bu qoida mahsulotga ham, shu sahifaga ham tegishli. Qolgan hamma narsa bitta havola narida.',
    artifact: { caption: 'soʻralgan hujjat', status: 'indekslanmagan · 0 manba' },
    home: 'Bosh sahifaga qaytish',
    linksLabel: 'Yoki toʻgʻridan-toʻgʻri',
    sectionsAria: 'Boʻlimlar',
  },
}
