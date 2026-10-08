import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'
import PageMeta from '../components/PageMeta'

export default function TermsOfService() {
  const { i18n } = useTranslation()
  const { t } = useTranslation()
  const isVi = i18n.language === 'vi'

  return (
    <div className="relative min-h-screen text-bq-ink">
      <PlaceBackdrop place="study" veil="strong" />
      <PageMeta
        title={isVi ? 'Điều khoản Sử dụng' : 'Terms of Service'}
        description={
          isVi
            ? 'Điều khoản sử dụng dịch vụ BibleQuiz.'
            : 'BibleQuiz terms of service.'
        }
        canonicalPath="/terms"
      />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="mb-5 inline-block px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[14px] font-bold text-bq-ink no-underline hover:bg-bq-cream">
          &larr; {t('common.back')}
        </Link>

        <Plaque className="text-[26px] md:text-[32px] mb-3">
          {isVi ? 'Điều khoản Sử dụng' : 'Terms of Service'}
        </Plaque>
        <p className="w-fit px-3 py-0.5 rounded-full bg-bq-white/90 border-2 border-bq-ink/40 text-[13px] font-bold text-bq-ink2 mb-6">
          {isVi ? 'Cập nhật lần cuối: 07/04/2026' : 'Last updated: April 7, 2026'}
        </p>

        <div className="space-y-8 text-bq-ink2 leading-relaxed bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-6 sm:p-8">
          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '1. Chấp nhận điều khoản' : '1. Acceptance of Terms'}
            </h2>
            <p>{isVi
              ? 'Bằng việc sử dụng BibleQuiz, bạn đồng ý tuân thủ các điều khoản này. Nếu không đồng ý, vui lòng ngừng sử dụng ứng dụng.'
              : 'By using BibleQuiz, you agree to comply with these terms. If you do not agree, please stop using the application.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '2. Tài khoản người dùng' : '2. User Accounts'}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isVi ? 'Bạn có thể đăng ký bằng Google Sign-In' : 'You can register using Google Sign-In'}</li>
              <li>{isVi ? 'Bạn chịu trách nhiệm bảo mật tài khoản' : 'You are responsible for securing your account'}</li>
              <li>{isVi ? 'Mỗi người chỉ được phép có 1 tài khoản' : 'Each person is allowed only 1 account'}</li>
              <li>{isVi ? 'Bạn có thể xóa tài khoản bất kỳ lúc nào trong Settings' : 'You can delete your account at any time in Settings'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '3. Nội dung và hành vi' : '3. Content and Behavior'}
            </h2>
            <p>{isVi ? 'Khi sử dụng BibleQuiz, bạn KHÔNG được:' : 'When using BibleQuiz, you must NOT:'}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{isVi ? 'Spam tin nhắn, phản hồi, hoặc thao tác trong app' : 'Spam messages, feedback, or actions in the app'}</li>
              <li>{isVi ? 'Sử dụng ngôn ngữ xúc phạm, thù hận, hoặc không phù hợp' : 'Use offensive, hateful, or inappropriate language'}</li>
              <li>{isVi ? 'Cố ý phá hoại trải nghiệm của người dùng khác' : 'Deliberately disrupt other users\' experience'}</li>
              <li>{isVi ? 'Sử dụng bot, script, hoặc công cụ tự động' : 'Use bots, scripts, or automated tools'}</li>
              <li>{isVi ? 'Tạo nhiều tài khoản để gian lận xếp hạng' : 'Create multiple accounts to manipulate rankings'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '4. Quyền sở hữu trí tuệ' : '4. Intellectual Property'}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isVi ? 'Câu hỏi quiz là tài sản của BibleQuiz' : 'Quiz questions are the property of BibleQuiz'}</li>
              <li>{isVi ? 'Nội dung Kinh Thánh là public domain' : 'Bible content is public domain'}</li>
              <li>{isVi ? 'Bạn không được sao chép, phân phối lại câu hỏi quiz' : 'You may not copy or redistribute quiz questions'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '5. Miễn trừ trách nhiệm' : '5. Disclaimer'}
            </h2>
            <p>{isVi
              ? 'BibleQuiz được cung cấp "nguyên trạng". Chúng tôi không đảm bảo ứng dụng sẽ hoạt động liên tục hoặc không có lỗi. BibleQuiz là công cụ hỗ trợ học Kinh Thánh, không thay thế việc học tập chính thức.'
              : 'BibleQuiz is provided "as is". We do not guarantee the application will work continuously or be error-free. BibleQuiz is a Bible study aid, not a replacement for formal study.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '6. Chấm dứt' : '6. Termination'}
            </h2>
            <p>{isVi
              ? 'Chúng tôi có quyền tạm khóa hoặc xóa tài khoản nếu phát hiện vi phạm điều khoản. Bạn có quyền xóa tài khoản bất kỳ lúc nào.'
              : 'We reserve the right to suspend or delete accounts that violate these terms. You may delete your account at any time.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '7. Thay đổi điều khoản' : '7. Changes to Terms'}
            </h2>
            <p>{isVi
              ? 'Chúng tôi có thể cập nhật điều khoản này. Thay đổi quan trọng sẽ được thông báo trong app. Tiếp tục sử dụng sau thay đổi đồng nghĩa với việc bạn chấp nhận điều khoản mới.'
              : 'We may update these terms. Important changes will be notified in the app. Continued use after changes means you accept the new terms.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '8. Liên hệ' : '8. Contact'}
            </h2>
            <p>{isVi
              ? 'Nếu có câu hỏi về điều khoản sử dụng, vui lòng liên hệ: support@forbible.org'
              : 'For questions about these terms, please contact: support@forbible.org'
            }</p>
          </section>
        </div>
      </div>
    </div>
  )
}
