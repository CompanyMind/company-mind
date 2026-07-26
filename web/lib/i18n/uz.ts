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
      body: 'Hujjatlarni yuklang, savolingizni oddiy tilda bering va aniq manbaga havola qilingan javob oling. Hammasi oʻz infratuzilmangizda ishlaydi — hech narsa serverdan tashqariga chiqmaydi.',
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
}
