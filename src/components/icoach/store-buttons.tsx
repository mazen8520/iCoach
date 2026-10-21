import { Smartphone } from "lucide-react";
import { toast } from "sonner";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/app-links";
import { useI18n, type TranslationKey } from "@/lib/i18n";

type Store = {
  id: "ios" | "android";
  url: string | null;
  top: TranslationKey;
  name: TranslationKey;
  soon: TranslationKey;
};

const STORES: Store[] = [
  {
    id: "ios",
    url: APP_STORE_URL,
    top: "store.ios.top",
    name: "store.ios.name",
    soon: "store.soon.ios",
  },
  {
    id: "android",
    url: PLAY_STORE_URL,
    top: "store.android.top",
    name: "store.android.name",
    soon: "store.soon.android",
  },
];

/** "Download on the App Store" / "Get it on Google Play". Each one links to its store listing
 *  once the URL is set in src/lib/app-links.ts; before that it says "Coming soon" and, when
 *  pressed, explains how to use iCoach in the phone's browser meanwhile. */
export function StoreButtons({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div
      className={`store-buttons ${compact ? "compact" : ""}`}
      role="group"
      aria-label={t("store.label")}
    >
      {STORES.map((store) => {
        const label = (
          <>
            <Smartphone className="store-icon" aria-hidden="true" />
            <span className="store-text">
              <small>{t(store.top)}</small>
              <b>{t(store.name)}</b>
            </span>
            {!store.url && <span className="store-soon">{t("store.soon")}</span>}
          </>
        );
        return store.url ? (
          <a
            key={store.id}
            className={`store-button ${store.id}`}
            href={store.url}
            target="_blank"
            rel="noreferrer"
          >
            {label}
          </a>
        ) : (
          <button
            key={store.id}
            type="button"
            className={`store-button ${store.id} pending`}
            onClick={() => toast.info(t(store.soon))}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
