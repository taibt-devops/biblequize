import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageMeta from '../components/PageMeta'

/** 404: the traveller is holding a blank map (LKD-20, Lu Khach storybook). */
export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-bq-paper flex items-center justify-center px-4 py-12">
      <PageMeta title="Trang không tìm thấy" noindex />

      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 max-w-3xl">
        <img
          src="/images/lk/hero-lost.webp"
          alt=""
          aria-hidden
          className="h-56 sm:h-80 shrink-0 motion-safe:animate-bob"
        />

        <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
          <h1
            className="font-display text-[6.5rem] sm:text-[8rem] font-black leading-none select-none text-bq-ink"
            style={{ textShadow: '0 0.06em 0 #FFC93C' }}
          >
            404
          </h1>

          <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-bq-ink mt-3 mb-2">
            {t('errors.notFound')}
          </h2>
          <p className="font-read text-bq-ink2 leading-relaxed mb-7 max-w-sm">
            {t('errors.notFoundDesc')}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Link to="/" className="bg-bq-action shadow-bq-action rounded-bq-btn px-8 py-3 font-extrabold text-bq-ink">
              {t('errors.goHome')}
            </Link>
            <button onClick={() => navigate(-1)} className="lk-btn lk-btn-2 text-bq-ink">
              {t('errors.goBack')}
            </button>
          </div>

          <p className="mt-10 font-read text-sm text-bq-ink3 italic leading-relaxed">
            {t('errors.seekAndFind')}
          </p>
        </div>
      </div>
    </div>
  )
}
