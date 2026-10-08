import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlaceBackdrop, Plaque } from '../components/lk/Place'
import PageMeta from '../components/PageMeta'

export default function PrivacyPolicy() {
  const { t, i18n } = useTranslation()
  const isVi = i18n.language === 'vi'

  return (
    <div className="relative min-h-screen text-bq-ink">
      <PlaceBackdrop place="study" veil="strong" />
      <PageMeta
        title={isVi ? 'Chính sách Bảo mật' : 'Privacy Policy'}
        description={
          isVi
            ? 'Chính sách bảo mật của BibleQuiz — cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn.'
            : 'BibleQuiz privacy policy — how we collect, use and protect your data.'
        }
        canonicalPath="/privacy"
      />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="mb-5 inline-block px-3 py-1 rounded-full bg-bq-white border-2 border-bq-ink text-[14px] font-bold text-bq-ink no-underline hover:bg-bq-cream">
          &larr; {t('common.back')}
        </Link>

        <Plaque className="text-[26px] md:text-[32px] mb-3">
          {isVi ? 'Chính sách Bảo mật' : 'Privacy Policy'}
        </Plaque>
        <p className="w-fit px-3 py-0.5 rounded-full bg-bq-white/90 border-2 border-bq-ink/40 text-[13px] font-bold text-bq-ink2 mb-6">
          {isVi ? 'Cập nhật lần cuối: 07/04/2026' : 'Last updated: April 7, 2026'}
        </p>

        <div className="space-y-8 text-bq-ink2 leading-relaxed bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-6 sm:p-8">
          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '1. Thông tin chúng tôi thu thập' : '1. Information We Collect'}
            </h2>
            <p>{isVi ? 'Khi bạn sử dụng BibleQuiz, chúng tôi thu thập:' : 'When you use BibleQuiz, we collect:'}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{isVi ? 'Thông tin tài khoản: email, tên, ảnh đại diện (từ Google Sign-In)' : 'Account info: email, name, avatar (from Google Sign-In)'}</li>
              <li>{isVi ? 'Dữ liệu quiz: điểm số, câu trả lời, streak, tier, thành tích' : 'Quiz data: scores, answers, streak, tier, achievements'}</li>
              <li>{isVi ? 'Dữ liệu nhóm: nhóm hội thánh bạn tham gia, vai trò trong nhóm' : 'Group data: church groups you join, your role'}</li>
              <li>{isVi ? 'Dữ liệu thiết bị: loại thiết bị, hệ điều hành (cho push notification)' : 'Device data: device type, OS (for push notifications)'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '2. Cách chúng tôi sử dụng thông tin' : '2. How We Use Information'}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isVi ? 'Cung cấp và cải thiện dịch vụ BibleQuiz' : 'Provide and improve BibleQuiz services'}</li>
              <li>{isVi ? 'Hiển thị bảng xếp hạng, thành tích, và tiến trình' : 'Display leaderboards, achievements, and progress'}</li>
              <li>{isVi ? 'Gửi thông báo (nếu bạn cho phép): streak, daily challenge, nhóm' : 'Send notifications (if permitted): streak, daily challenge, groups'}</li>
              <li>{isVi ? 'Phân tích ẩn danh để cải thiện app' : 'Anonymous analytics to improve the app'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '3. Chia sẻ thông tin' : '3. Information Sharing'}
            </h2>
            <p>{isVi ? 'Chúng tôi KHÔNG bán hoặc chia sẻ thông tin cá nhân với bên thứ ba, ngoại trừ:' : 'We do NOT sell or share personal information with third parties, except:'}</p>
            <ul className="list-disc pl-6 mt-2 space-y-1">
              <li>{isVi ? 'Bảng xếp hạng: tên và điểm hiển thị cho người dùng khác trong app' : 'Leaderboards: name and score visible to other users in the app'}</li>
              <li>{isVi ? 'Nhóm: thành viên cùng nhóm thấy tên và điểm của bạn' : 'Groups: group members can see your name and score'}</li>
              <li>{isVi ? 'Yêu cầu pháp luật: khi có yêu cầu từ cơ quan pháp luật' : 'Legal requirements: when required by law enforcement'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '4. Lưu trữ dữ liệu' : '4. Data Storage'}
            </h2>
            <p>{isVi
              ? 'Dữ liệu được lưu trữ trên Amazon Web Services (AWS) tại khu vực Asia Pacific. Chúng tôi sử dụng mã hóa và biện pháp bảo mật phù hợp để bảo vệ dữ liệu của bạn.'
              : 'Data is stored on Amazon Web Services (AWS) in the Asia Pacific region. We use encryption and appropriate security measures to protect your data.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '5. Quyền của bạn' : '5. Your Rights'}
            </h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>{isVi ? 'Xem dữ liệu: xem thông tin cá nhân trong trang Profile' : 'View data: see personal info in your Profile'}</li>
              <li>{isVi ? 'Sửa dữ liệu: cập nhật tên, ảnh đại diện trong Profile' : 'Edit data: update name, avatar in Profile'}</li>
              <li>{isVi ? 'Xóa dữ liệu: xóa tài khoản và toàn bộ dữ liệu trong Profile' : 'Delete data: delete account and all data in Profile'}</li>
              <li>{isVi ? 'Rút consent: tắt thông báo, rời nhóm bất kỳ lúc nào' : 'Withdraw consent: disable notifications, leave groups at any time'}</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '6. Trẻ em' : '6. Children'}
            </h2>
            <p>{isVi
              ? 'BibleQuiz dành cho mọi lứa tuổi. Chúng tôi không cố ý thu thập thông tin của trẻ dưới 13 tuổi mà không có sự đồng ý của phụ huynh. Nếu phát hiện, chúng tôi sẽ xóa dữ liệu đó.'
              : 'BibleQuiz is for all ages. We do not intentionally collect information from children under 13 without parental consent. If discovered, we will delete that data.'
            }</p>
          </section>

          <section>
            <h2 className="text-[20px] font-extrabold font-display text-bq-ink mb-2">
              {isVi ? '7. Liên hệ' : '7. Contact'}
            </h2>
            <p>{isVi
              ? 'Nếu có câu hỏi về chính sách bảo mật, vui lòng liên hệ: privacy@forbible.org'
              : 'For privacy policy questions, please contact: privacy@forbible.org'
            }</p>
          </section>
        </div>
      </div>
    </div>
  )
}
