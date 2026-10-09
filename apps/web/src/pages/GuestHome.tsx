import PageMeta from '../components/PageMeta'
import GuestScene from '../components/home/scene/GuestScene'

/**
 * "/" for visitors (2026-10-09): one screen, the crossroads of Home with a welcome card and the
 * way in. Prerendered to home.html, so the headline, intro and links are in the HTML crawlers
 * read; the long-form introduction moved to /gioi-thieu.
 */
export default function GuestHome() {
  return (
    <div data-testid="guest-home" className="w-full">
      <PageMeta
        title="Trắc Nghiệm Kinh Thánh – Câu Đố Kinh Thánh Online"
        description="Trắc nghiệm Kinh Thánh & câu đố Kinh Thánh Tin Lành online miễn phí — học Lời Chúa qua quiz tương tác, thi đấu cùng cộng đồng và nhóm hội thánh Việt Nam."
        canonicalPath="/"
      />
      <GuestScene />
    </div>
  )
}
