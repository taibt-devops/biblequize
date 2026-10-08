import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PlaceBackdrop } from '../components/lk/Place'
import PageMeta from '../components/PageMeta'

/**
 * /cau-do-kinh-thanh — SEO pillar page (Vietnamese) targeting the niche keywords
 * "câu đố Kinh Thánh" / "trắc nghiệm Kinh Thánh" for the Vietnamese Protestant
 * audience. Content is Vietnamese-only (the keyword + audience are Vietnamese)
 * so crawlers reliably index Vietnamese text; the page is prerendered.
 */

const FAQ = [
  {
    q: 'BibleQuiz có miễn phí không?',
    a: 'Có, BibleQuiz hoàn toàn miễn phí. Bạn chơi câu đố Kinh Thánh không giới hạn, không quảng cáo, không cần thẻ thanh toán.',
  },
  {
    q: 'Trắc nghiệm dùng bản dịch Kinh Thánh nào?',
    a: 'Nội dung bám theo Kinh Thánh Tin Lành 66 sách. Câu hỏi và câu gốc dùng Bản Truyền Thống Hiệu Đính (BTTHĐ 2011), một số câu cũ dùng Bản Truyền Thống 1926.',
  },
  {
    q: 'Tôi có thể chơi theo nhóm hội thánh không?',
    a: 'Có. Bạn tạo nhóm hội thánh, mời thành viên, thi đấu trực tiếp, đặt lịch quiz và xem bảng xếp hạng riêng của nhóm — rất hợp cho trường Chúa Nhật và nhóm thanh niên.',
  },
  {
    q: 'Có cần tải ứng dụng không?',
    a: 'Không bắt buộc. Bạn chơi ngay trên trình duyệt máy tính hay điện thoại. Ngoài ra BibleQuiz cũng có ứng dụng di động cho trải nghiệm mượt hơn.',
  },
  {
    q: 'Trắc nghiệm Kinh Thánh Tin Lành khác gì với Công Giáo?',
    a: 'BibleQuiz xây dựng trên bộ Kinh Thánh Tin Lành 66 sách (Protestant), không gồm 7 sách Đệ Nhị Kinh điển của Công Giáo. Câu hỏi và câu gốc theo bản dịch Truyền Thống Hiệu Đính (BTTHĐ 2011) quen thuộc với hội thánh Tin Lành Việt Nam.',
  },
  {
    q: 'Có thể đố Kinh Thánh online theo từng sách không?',
    a: 'Có. Bạn chọn riêng từng sách (Sáng Thế Ký, Thi Thiên, Phúc Âm, thư tín…) để luyện trắc nghiệm Kinh Thánh đúng phần mình muốn ôn, kèm độ khó tùy chỉnh.',
  },
]

const SAMPLE = [
  { q: 'Ai đã đóng chiếc tàu lớn để cứu gia đình mình khỏi nước lụt?', a: 'Nô-ê', ref: 'Sáng Thế Ký 6' },
  { q: 'Chúa Giê-xu giáng sinh tại thành nào?', a: 'Bết-lê-hem', ref: 'Ma-thi-ơ 2:1' },
  { q: 'Sách đầu tiên trong Kinh Thánh là sách nào?', a: 'Sáng Thế Ký', ref: 'Cựu Ước' },
]

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="font-display text-2xl font-bold text-bq-ink">{title}</h2>
      <div className="space-y-3 text-bq-ink2 leading-relaxed">{children}</div>
    </section>
  )
}

export default function CauDoKinhThanh() {
  // This page is Vietnamese regardless of UI language → keep <html lang> correct
  // for crawlers + a11y while it's mounted.
  useEffect(() => {
    const prev = document.documentElement.lang
    document.documentElement.lang = 'vi'
    return () => {
      document.documentElement.lang = prev
    }
  }, [])

  const faqSchema = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })

  return (
    <div className="relative min-h-screen text-bq-ink">
      <PlaceBackdrop place="gate" veil="strong" />
      <PageMeta
        title="Câu Đố Kinh Thánh Tin Lành – Trắc Nghiệm Kinh Thánh Online Miễn Phí"
        description="Chơi câu đố Kinh Thánh & trắc nghiệm Kinh Thánh Tin Lành online miễn phí — hàng nghìn câu hỏi từ 66 sách (BTTHĐ), đố Kinh Thánh theo từng sách, thi đấu cùng nhóm hội thánh Việt Nam."
        canonicalPath="/cau-do-kinh-thanh"
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />

      <header className="border-b border-bq-hair bg-bq-white/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-bq-amberd font-display">
            BibleQuiz
          </Link>
          <Link
            to="/practice"
            className="bg-bq-action text-bq-ink text-sm font-bold px-4 py-2 rounded-xl shadow-bq-action active:scale-95 transition-transform"
          >
            Chơi Ngay
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <div className="space-y-4">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-bq-ink">
            Câu Đố Kinh Thánh Tin Lành – Trắc Nghiệm Kinh Thánh Online
          </h1>
          <p className="text-lg text-bq-ink2 leading-relaxed">
            <strong className="text-bq-ink">BibleQuiz</strong> là nền tảng <strong>câu đố Kinh Thánh</strong> /{' '}
            <strong>trắc nghiệm Kinh Thánh Tin Lành</strong> trực tuyến miễn phí dành cho người Tin Lành
            Việt Nam. Học và ôn Lời Chúa qua hàng nghìn câu hỏi đố Kinh Thánh online từ trọn bộ 66 sách,
            thi đấu cùng cộng đồng và nhóm hội thánh của bạn — mọi lúc, mọi nơi, ngay trên trình duyệt.
          </p>
        </div>

        <div className="space-y-8 bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-6 sm:p-8">
          <Section title="Trắc nghiệm Kinh Thánh là gì?">
            <p>
              Trắc nghiệm Kinh Thánh (hay câu đố Kinh Thánh) là cách học Lời Chúa qua những câu hỏi nhiều lựa
              chọn. Mỗi câu hỏi gắn với một câu hoặc đoạn Kinh Thánh cụ thể, kèm phần giải thích và trích dẫn
              câu gốc, giúp bạn vừa kiểm tra hiểu biết vừa ghi nhớ Kinh Thánh một cách tự nhiên và vui vẻ.
            </p>
            <p>
              Thay vì học thuộc khô khan, bạn trả lời, nhận phản hồi tức thì và đọc lại câu Kinh Thánh liên
              quan — một phương pháp ôn tập chủ động đã được chứng minh giúp nhớ lâu hơn.
            </p>
          </Section>

          <Section title="Cách chơi câu đố Kinh Thánh trên BibleQuiz">
            <ul className="list-disc pl-6 space-y-1">
              <li>Chọn chế độ <strong>Luyện Tập</strong> (thoải mái, không giới hạn) hoặc <strong>Đấu Hạng</strong> để thi đấu.</li>
              <li>Chọn sách Kinh Thánh, độ khó và số câu hỏi bạn muốn.</li>
              <li>Trả lời từng câu, xem ngay giải thích và câu gốc trong Kinh Thánh.</li>
              <li>Tích điểm, giữ chuỗi ngày (streak) và leo bảng xếp hạng cùng cộng đồng.</li>
            </ul>
          </Section>

          <Section title="Câu hỏi mẫu">
            <p>Một vài câu đố Kinh Thánh tiêu biểu để bạn hình dung:</p>
            <div className="space-y-3">
              {SAMPLE.map((s, i) => (
                <div key={i} className="rounded-xl border border-bq-hair bg-bq-paper p-4">
                  <p className="font-semibold text-bq-ink">{i + 1}. {s.q}</p>
                  <p className="text-sm mt-1">
                    Đáp án: <strong className="text-bq-emerald">{s.a}</strong>{' '}
                    <span className="text-bq-ink2">({s.ref})</span>
                  </p>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Lợi ích cho tín hữu và nhóm hội thánh">
            <p>
              Câu đố Kinh Thánh không chỉ là trò chơi. Với mỗi tín hữu, đây là cách ôn tập Lời Chúa đều đặn —
              đặc biệt qua <Link to="/daily" className="text-bq-sapphire hover:underline">thử thách Kinh Thánh hàng ngày</Link>.
              Với nhóm hội thánh, BibleQuiz giúp gắn kết qua các trận thi đấu trực tiếp, đặt lịch quiz và bảng
              xếp hạng riêng — rất hợp cho trường Chúa Nhật, nhóm thanh niên và nhóm nhỏ.
            </p>
          </Section>

          <Section title="Trắc nghiệm Kinh Thánh Tin Lành theo từng sách">
            <p>
              Bạn có thể đố Kinh Thánh online theo riêng từng sách trong 66 sách Tin Lành — từ Ngũ Kinh,
              Lịch sử, Thi ca (Thi Thiên, Châm Ngôn) đến các sách Tiên tri, bốn sách Phúc Âm, Công Vụ và
              các thư tín. Cách này giúp tín hữu ôn sâu đúng phần đang học trong giờ tĩnh nguyện hay lớp
              trường Chúa Nhật.
            </p>
          </Section>

          <Section title="Dành riêng cho người Tin Lành Việt Nam">
            <p>
              BibleQuiz xây dựng theo trọn bộ <strong>66 sách Kinh Thánh Tin Lành</strong> (Protestant), bám
              sát bản dịch <strong>Truyền Thống Hiệu Đính (BTTHĐ 2011)</strong>. Giao diện song ngữ Việt – Anh,
              hoàn toàn miễn phí và không quảng cáo, phù hợp cho mọi lứa tuổi trong cộng đồng Tin Lành Việt Nam.
            </p>
          </Section>

          <Section id="faq" title="Câu hỏi thường gặp">
            <div className="space-y-4">
              {FAQ.map((f, i) => (
                <div key={i}>
                  <h3 className="font-semibold text-bq-ink">{f.q}</h3>
                  <p className="mt-1">{f.a}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="text-center space-y-4 bg-bq-white border border-bq-hair shadow-bq-soft rounded-bq p-8">
          <h2 className="font-display text-2xl font-bold text-bq-ink">Bắt đầu chơi câu đố Kinh Thánh ngay</h2>
          <p className="text-bq-ink2">Miễn phí, không cần đăng ký để chơi thử.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/practice"
              className="bg-bq-action text-bq-ink font-bold px-8 py-3 rounded-xl shadow-bq-action active:scale-95 transition-transform"
            >
              Chơi Ngay
            </Link>
            <Link
              to="/daily"
              className="border border-bq-hair text-bq-ink font-bold px-8 py-3 rounded-xl hover:bg-bq-inset transition-colors active:scale-95"
            >
              Thử thách hàng ngày
            </Link>
          </div>
          <p className="text-sm text-bq-ink2">
            Cần hướng dẫn? Xem <Link to="/help" className="text-bq-sapphire hover:underline">trang Trợ giúp</Link>.
          </p>
        </div>
      </main>
    </div>
  )
}
