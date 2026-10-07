import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageMeta from '../components/PageMeta'

export default function NotFound() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen bg-bq-paper flex items-center justify-center overflow-hidden px-4">
      <PageMeta title="Trang không tìm thấy" noindex />
      {/* Decorative blur circles */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-bq-amber/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-bq-sapphire/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Large 404 */}
        <h1 className="font-display text-[8rem] sm:text-[10rem] font-black leading-none tracking-tighter bg-bq-spectrum bg-clip-text text-transparent select-none">
          404
        </h1>

        {/* Icon */}
        <span className="material-symbols-outlined text-6xl text-bq-ink3 -mt-4 mb-6">
          explore_off
        </span>

        {/* Message */}
        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-bq-ink mb-3">
          {t('errors.notFound')}
        </h2>
        <p className="text-bq-ink2 font-medium leading-relaxed mb-8">
          {t('errors.notFoundDesc')}
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            to="/"
            className="bg-bq-action text-bq-ink font-bold px-8 py-3 rounded-xl shadow-bq-action hover:scale-[1.02] transition-all duration-200"
          >
            {t('errors.goHome')}
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="text-bq-ink2 hover:text-bq-ink font-medium px-6 py-3 rounded-xl transition-colors duration-200"
          >
            {t('errors.goBack')}
          </button>
        </div>

        {/* Bible verse */}
        <p className="mt-16 font-literata text-sm text-bq-ink3 italic leading-relaxed">
          {t('errors.seekAndFind')}
        </p>
      </div>
    </div>
  )
}
