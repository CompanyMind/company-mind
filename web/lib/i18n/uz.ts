import type { Dictionary } from './en'

// Genuine Uzbek Latin translations. Real Uzbek Latin uses U+02BB (ʻ) for the
// oʻ/gʻ digraphs and the tutuq belgisi (sunʻiy, etc.) — never the ASCII
// apostrophe U+0027. See i18n.test.ts, which fails the build on U+0027
// between word characters here (the same class of bug already present in
// engine/app/ask/qtype.py).
export const uz: Dictionary = {
  tour: {
    welcome: {
      heading: 'Bu — kompaniyangizning xotirasi.',
      body: 'Hujjatlarni yuklang, savolingizni oddiy tilda bering va aniq manbaga havola qilingan javob oling. Hech narsa bu serverdan tashqariga chiqmaydi va hech qachon oʻqitish uchun ishlatilmaydi.',
    },
    upload: {
      heading: 'Birinchi hujjatlaringizni yuklang',
      body: 'Fayllarni shu yerga tashlang yoki kompyuteringizdan tanlang. Indekslash fonda davom etadi, shuning uchun kutib turmasdan davom etishingiz mumkin.',
      dropzone: 'Fayllarni shu yerga tashlang',
      browse: 'Fayllarni tanlash',
      uploading: 'Yuklanmoqda…',
      status: '{received} ta fayl qabul qilindi · {indexed} tasi indekslandi',
      skipThis: 'Bu bosqichni oʻtkazib yuborish',
    },
    organise: {
      heading: 'Sunʻiy intellekt hujjatlaringizni tartiblasin',
      body: 'Hujjatlar avtomatik ravishda papkalarga guruhlanadi. Natijani koʻrib chiqing va notoʻgʻri joylashganlarini tuzating.',
    },
    access: {
      heading: 'Odamlar faqat oʻqishga ruxsati bor hujjatlar asosida javob oladi.',
      body: 'Har bir hujjat bitta yoki bir nechta ruxsat guruhiga tegishli boʻladi. Javoblar foydalanuvchi kirgan guruhlardagi hujjatlar asosida tuziladi — ishchi makon egalari esa barcha hujjatlarni koʻra oladi.',
    },
    accessMember: {
      heading: 'Siz faqat oʻz guruhlaringiz oʻqiy oladigan hujjatlar asosida tuzilgan javoblarni koʻrasiz.',
      body: 'Agar hujjat sizning guruhlaringizdan birortasiga tegishli boʻlmasa, u javoblaringizda koʻrinmaydi — hatto toʻgʻridan-toʻgʻri soʻrasangiz ham.',
    },
    ask: {
      heading: 'Hujjatlaringiz haqida istalgan savolni bering',
      body: 'Quyida savolingizni yozing. Har bir javobda aniq manbaga havola boʻladi, shunday qilib siz uni doim tekshira olasiz.',
    },
    citationHint: {
      heading: 'Har bir havola manbani ochadi',
      body: 'Kerakli qismga oʻtish uchun havolani bosing.',
      dismiss: 'Tushunarli',
    },
    ui: {
      next: 'Keyingisi',
      back: 'Orqaga',
      skip: 'Oʻtkazib yuborish',
      done: 'Tayyor',
      stepOf: 'Qadam {current} / {total}',
      takeTour: 'Tanishtiruvni boshlash',
      guide: 'Qoʻllanma',
      startTour: 'Koʻrsatib bering',
      declineTour: 'Hozir emas',
    },
  },
  emptyStates: {
    askNoDocuments: {
      body: 'Birinchi hujjatlaringizni yuklang — CompanyMind ular haqida savollarga javob beradi va har bir javobni aniq manbagacha kuzatish mumkin boʻladi.',
      cta: 'Hujjat qoʻshish',
      memberBody:
        'Sizning ruxsat guruhlaringizga hozircha hech qanday hujjat ochilmagan. Ega ularni ochgach, shu yerda savol berishingiz mumkin — har bir javob oʻz manbasini koʻrsatadi.',
    },
    sourcesEmpty: {
      body: 'Hozircha hujjat yoʻq. PDF, Word, matn yoki markdown fayllarni yuklang — CompanyMind ularni papkalarga tartiblab beradi.',
      cta: 'Hujjatlarni yuklash',
      memberBody:
        'Bu yerda siz ocha oladigan hujjat hozircha yoʻq. Javoblar siz aʻzo boʻlgan ruxsat guruhlaridan tuziladi — egadan sizni guruhga qoʻshishni yoki hujjatlarni siz turgan guruhga ochishni soʻrang.',
    },
    access: {
      body: 'Javoblaringiz faqat siz aʻzo boʻlgan ruxsat guruhlarining kesishmasidan tuziladi — shu guruhlarning birortasiga kirmagan hujjat hech qachon koʻrinmaydi, hatto toʻgʻridan-toʻgʻri soʻrasangiz ham. Ishchi makon egalari esa barcha hujjatlarni koʻra oladi.',
    },
    atlas: {
      body: 'Atlas kompaniyangiz biladigan narsalar xaritasini chizadi: hujjatlar mavzu boʻyicha guruhlanadi va boʻlim boʻyicha rangga ega boʻladi, shuningdek ruxsat anomaliyalari, ortiqcha ochiqlik, aloqasiz va eskirgan hujjatlarni koʻrsatuvchi rejimlar mavjud. Biror narsa koʻrsatish uchun hujjatlar kerak — ularni Manbalar boʻlimida yuklang, soʻng xaritani qayta tuzing.',
    },
  },
  chat: {
    greeting: {
      morning: 'Xayrli tong, {name}',
      afternoon: 'Xayrli kun, {name}',
      evening: 'Xayrli kech, {name}',
      anonymous: 'Nimani bilmoqchisiz?',
    },
    thinking: {
      searching: 'Manbalaringiz qidirilmoqda…',
      reading: 'Topilganlar oʻqilmoqda…',
      writing: 'Javob yozilmoqda…',
    },
    footer: 'Har bir javob oʻz manbasini koʻrsatadi. Hech narsa bu serverdan chiqmaydi.',
    placeholder: 'Kompaniyangiz bilimidan soʻrang…',
    copy: 'Nusxalash',
    copied: 'Nusxalandi',
    sources: 'Manbalar',
    retry: 'Qayta urinish',
    send: 'Yuborish',
    attach: 'Hujjat qoʻshish',
  },
  settings: {
    title: 'Sozlamalar',
    close: 'Sozlamalarni yopish',
    saveFailed: 'Saqlab boʻlmadi. Hech narsa oʻzgartirilmadi.',
    sections: {
      general: 'Umumiy',
      account: 'Hisob',
      workspace: 'Ishchi makon',
      data: 'Maʻlumotlar',
    },
    general: {
      profile: 'Profil',
      name: 'Ism',
      email: 'Elektron pochta',
      emailNote: 'Pochtangiz — bu kirish nomi, uni bu yerda oʻzgartirib boʻlmaydi.',
      preferences: 'Afzalliklar',
      language: 'Til',
      languageNote: 'Mahsulotning oʻz matnini oʻzgartiradi. Hujjatlaringizga tegilmaydi.',
      appearance: 'Koʻrinish',
      motion: 'Animatsiya',
      motionNote: 'Interfeys boʻylab animatsiyani kamaytirish.',
      system: 'Tizimdagidek',
      light: 'Yorugʻ',
      dark: 'Qorongʻi',
      reduced: 'Kamaytirilgan',
      help: 'Yordam',
      replayTour: 'Qoʻllanmani qaytadan koʻrish',
      replayTourNote: 'Mahsulot boʻylab boshidan yurib chiqing.',
      replayTourCta: 'Boshlash',
    },
    account: {
      heading: 'Hisob',
      password: 'Parol',
      currentPassword: 'Joriy parol',
      newPassword: 'Yangi parol',
      confirmPassword: 'Yangi parolni tasdiqlang',
      passwordHint: 'Kamida 12 belgi. Uzunlik belgilardan muhimroq.',
      changePassword: 'Parolni oʻzgartirish',
      passwordChanged: 'Parol oʻzgartirildi. Boshqa seanslaringiz yakunlandi.',
      sessions: 'Faol seanslar',
      sessionsNote: 'Qayerda kirgansiz. Joylashuv aniqlanmaydi — buning uchun tashqariga murojaat qilish kerak boʻlardi.',
      device: 'Qurilma',
      ip: 'IP',
      signedIn: 'Kirilgan',
      thisDevice: 'Shu qurilma',
      signOutAll: 'Barcha qurilmalardan chiqish',
      signOutAllNote: 'Barcha seanslarni, shu jumladan shuni ham yakunlaydi.',
      signOut: 'Chiqish',
    },
    workspace: {
      heading: 'Ishchi makon',
      name: 'Nomi',
      deployment: 'Oʻrnatish turi',
      onprem: 'On-premise — hech narsa sizning infratuzilmangizdan chiqmaydi.',
      hosted: 'Hosting — hech narsa bu serverdan chiqmaydi va oʻqitish uchun ishlatilmaydi.',
      manage: 'Boshqaruv',
      people: 'Xodimlar',
      peopleNote: 'Hamkasblarni qoʻshing va ular nimani ocha olishini belgilang.',
      access: 'Ruxsat guruhlari',
      accessNote: 'Guruhlar kimning javobi qaysi hujjatlardan tuzilishini hal qiladi.',
      integrations: 'Telegram',
      integrationsNote: 'Ishchi makon uchun bitta bot, faqat savol-javob.',
      open: 'Ochish',
    },
    data: {
      heading: 'Sizning maʻlumotlaringiz',
      stored: 'Nima saqlanadi',
      storedBody:
        'Hujjatlaringiz va ulardan ajratilgan parchalar, savollaringiz va javoblar hamda ularning manbalari, shuningdek kirish seanslaringiz. Bularning bari shu oʻrnatmaning oʻz maʻlumotlar bazasida turadi va hech qayerga yuborilmaydi.',
      conversations: 'Suhbatlar',
      deleteChats: 'Barcha suhbatlarimni oʻchirish',
      deleteChatsNote: 'Savol-javob tarixingizni butunlay oʻchiradi. Hujjatlar qoladi.',
      deleteChatsConfirm:
        'Barcha suhbatlaringiz ({count} ta) oʻchirilsinmi?\n\nBuni qaytarib boʻlmaydi. Hujjatlarga taʻsir qilmaydi.',
      deleteChatsNone: 'Oʻchiradigan suhbatingiz yoʻq.',
      delete: 'Oʻchirish',
    },
  },
}
