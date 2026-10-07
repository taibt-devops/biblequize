import { useTranslation } from 'react-i18next'
import { setQuizLanguage, type QuizLanguage } from '../utils/quizLanguage'

interface Props {
  onChange?: (lang: QuizLanguage) => void
  className?: string
}

export default function QuizLanguageSelect({ onChange, className = '' }: Props) {
  const { i18n } = useTranslation()
  const lang = (i18n.language === 'en' ? 'en' : 'vi') as QuizLanguage

  const handleChange = (newLang: QuizLanguage) => {
    setQuizLanguage(newLang)
    i18n.changeLanguage(newLang)
    onChange?.(newLang)
  }

  return (
    <div className={`flex gap-1 rounded-xl bg-surface-container p-1 ${className}`}>
      <button
        type="button"
        onClick={() => handleChange('vi')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          lang === 'vi' ? 'bg-bq-amber text-bq-ink border-2 border-bq-ink' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        VI
      </button>
      <button
        type="button"
        onClick={() => handleChange('en')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          lang === 'en' ? 'bg-bq-amber text-bq-ink border-2 border-bq-ink' : 'text-on-surface-variant hover:text-on-surface'
        }`}
      >
        EN
      </button>
    </div>
  )
}
