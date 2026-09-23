import { useI18n, type Lang } from "@/lib/i18n";

const options: { lang: Lang; label: string; nameKey: "lang.arabic" | "lang.english" }[] = [
  { lang: "ar", label: "AR", nameKey: "lang.arabic" },
  { lang: "en", label: "EN", nameKey: "lang.english" },
];

/** Compact "AR / EN" toggle. The choice persists (cookie + localStorage) and flips the whole
 *  document between RTL Arabic and LTR English. */
export function LanguageSwitch({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <div className={`lang-switch ${className}`} role="group" aria-label={t("lang.switchTo")}>
      {options.map((option, index) => (
        <span key={option.lang} className="contents">
          {index > 0 && <span aria-hidden="true">/</span>}
          <button
            type="button"
            lang={option.lang}
            aria-pressed={lang === option.lang}
            title={t(option.nameKey)}
            className={lang === option.lang ? "active" : ""}
            onClick={() => lang !== option.lang && setLang(option.lang)}
          >
            {option.label}
          </button>
        </span>
      ))}
    </div>
  );
}
