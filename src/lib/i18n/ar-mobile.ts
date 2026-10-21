import type { enMobile } from "./en-mobile";

// Arabic for en-mobile.ts. Typed against the English keys, so a missing translation fails the
// build.
export const arMobile: Record<keyof typeof enMobile, string> & Record<string, string> = {
  // app tour
  "tour.label": "جولة في التطبيق",
  "tour.next": "التالي",
  "tour.back": "السابق",
  "tour.skipAll": "تخطَّ الكل",
  "tour.start": "ابدأ الجولة",
  "tour.progress": "الخطوة {current} من {total}",
  "tour.duration": "نحو دقيقة واحدة",
  "tour.hint": "تنقّل خطوة بخطوة عبر «التالي»، أو اضغط «تخطَّ الكل» في أي وقت.",
  "tour.route": "محطات هذه الجولة",
  "tour.replay": "جولة التطبيق",
  "tour.welcome.title": "أهلًا {name}",
  "tour.welcome.titleAnon": "أهلًا بك في iCoach",
  "tour.welcome.coach": "عملك التدريبي كله في جيبك. إليك مكان كل شيء.",
  "tour.welcome.client": "كل ما يخططه لك مدربك، من التمارين إلى الوجبات والمتابعات، في مكان واحد.",
  "tour.coach.overview":
    "متدربوك في لمحة واحدة: جلسات اليوم، والمتابعات المعلّقة، ومن يحتاج إليك أولًا.",
  "tour.coach.clients":
    "أضف متدربين وأدِر ملفاتهم. يحصل كل متدرب جديد على حساب خاص به وكلمة مرور مؤقتة.",
  "tour.coach.schedule": "عيّن التمارين على التواريخ وخطّط أسبوع كل متدرب.",
  "tour.coach.workouts":
    "أنشئ قوالب تمارين من مكتبة التمارين، مع المجموعات والتكرارات وفترات الراحة.",
  "tour.coach.more":
    "خطط التغذية والفيديوهات والرسائل واجتماعات Zoom والتقدم والمتابعات والإعدادات تجدها هنا.",
  "tour.client.home": "سلسلة التزامك وتقدمك وما ينتظرك بعد ذلك.",
  "tour.client.today": "تمرين اليوم ووجباته وعاداته في قائمة واحدة. أنجزها واحدة تلو الأخرى.",
  "tour.client.week": "الأسبوع الذي خططه مدربك كاملًا، يومًا بيوم.",
  "tour.client.train": "ابدأ تمرينك وسجّل كل مجموعة ودع مؤقت الراحة يضبط إيقاعك.",
  "tour.client.more":
    "التغذية وصور التقدم والتقويم ومحادثة مدربك والاجتماعات والمتابعات الأسبوعية تجدها هنا.",
  "tour.notifications.coach": "الرسائل الجديدة والمتابعات والتمارين المكتملة تصلك هنا لحظة حدوثها.",
  "tour.notifications.client": "رسائل مدربك والخطط الجديدة ودعوات الاجتماعات تصلك هنا.",
  "tour.language.title": "العربية أو الإنجليزية",
  "tour.language.body": "بدّل اللغة متى شئت. بالعربية يُعرض التطبيق كاملًا من اليمين إلى اليسار.",
  "tour.finish.title": "كل شيء جاهز",
  "tour.finish.coach":
    "ابدأ بإضافة أول متدرب من «المتدربون». يمكنك إعادة هذه الجولة متى شئت من «المزيد».",
  "tour.finish.client":
    "افتح «اليوم» لترى ما خططه مدربك. يمكنك إعادة هذه الجولة متى شئت من «المزيد».",
  "tour.finish.ctaCoach": "ابدأ الآن",
  "tour.finish.ctaClient": "هيا نتمرّن",
  // app front door
  "meta.app": "iCoach",
  "app.newCoach": "مدرب جديد؟",
  "offline.banner": "أنت غير متصل بالإنترنت. لن تُحفظ التغييرات حتى يعود الاتصال.",
};
