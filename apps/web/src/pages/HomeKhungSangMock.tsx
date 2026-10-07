/**
 * PREVIEW-ONLY coded mockup of the "Khung Sáng" Home redesign.
 * Route: /home-khung-sang-preview. Self-contained, static data, CSS scoped
 * under `.hks` so nothing leaks into the real app or its design tokens.
 * Live prototype to approve before promoting the look into Home (KS W1 / HGR).
 * Spec: docs/designs/home-game vibe/biblequiz-home-khungsang (1).html
 */
export default function HomeKhungSangMock() {
  return (
    <div className="hks">
      <style>{CSS}</style>

      <header className="top">
        <div className="wrap top-in">
          <a className="logo" href="#"><span className="logo-mark" /> BibleQuiz</a>
          <nav className="nav">
            <a className="on" href="#">Trang chủ</a><a href="#">Xếp hạng</a>
            <a href="#">Nhóm</a><a href="#">Phòng Chơi</a><a href="#">Cá nhân</a>
          </nav>
          <div className="tright">
            <div className="ts"><span className="k" style={{ background: 'var(--c-rub)' }} />1 <small>STREAK</small></div>
            <div className="ts"><span className="k" style={{ background: 'var(--c-amb)' }} />100 <small>NL</small></div>
            <div className="ts"><span className="k" style={{ background: 'var(--c-eme)' }} />1.298 <small>MÙA</small></div>
            <div className="tav">T</div>
          </div>
        </div>
      </header>

      <div className="wrap">
        {/* HERO */}
        <section className="hero">
          <div className="eyebrow">✦ CHÀO BUỔI TỐI · THỨ BẢY 12/6</div>
          <h1 className="h-title">Sẵn sàng chưa, <span className="nm">Tai Thanh?</span></h1>
          <div className="h-sub">
            <span className="lvchip">LV. 12</span>
            <span>Người Tìm Kiếm → <b>Môn Đồ</b></span><span style={{ color: 'var(--dim)' }}>·</span>
            <span>Hạng tuần <b>#1</b> / 1.204 người</span>
          </div>
          <div className="xp">
            <div className="xp-row">
              <div className="seg f s1" /><div className="seg f s2" /><div className="seg f s3" />
              <div className="seg h" /><div className="seg" /><div className="seg" /><div className="seg" /><div className="seg" /><div className="seg" /><div className="seg" />
            </div>
            <div className="xp-cap"><span><b>1.590</b> / 5.000 XP</span><span>còn <b>3.410 XP</b> đến Môn Đồ</span></div>
          </div>
        </section>

        {/* VERSE LIGHTWELL */}
        <section className="verse">
          <div className="cap">CÂU GỐC HÔM NAY</div>
          <div className="lampmark" aria-hidden="true"><span className="fl" /></div>
          <div className="body">“Lời Chúa là <em>ngọn đèn</em> cho chân tôi, ánh sáng cho đường lối tôi.”</div>
          <div className="ref">THI THIÊN 119 : 105</div>
        </section>
        <div className="sill" />
        <div className="verse-act">Hoàn thành nhiệm vụ hôm nay để tích thêm ánh sáng cho hành trình của bạn</div>

        {/* DAILY */}
        <div className="sec"><span className="idx c1">1</span><h2>Thử thách hôm nay</h2></div>
        <section className="daily">
          <div className="daily-grid">
            <div className="daily-main">
              <div className="d-badge"><i /> ƯU TIÊN HÔM NAY</div>
              <h3>Bắt đầu ngày mới với <span>Lời Chúa</span></h3>
              <div className="d-meta"><span className="chip">📖 5 câu</span><span className="chip">⏱ ~3 phút</span><span className="chip">🌐 Cùng cộng đồng</span></div>
            </div>
            <div className="d-side"><div className="d-timer">Còn lại trong ngày · <b>12:49:19</b></div><button className="cta">Chơi ngay <span className="xp-tag">+50 XP</span></button></div>
          </div>
        </section>

        {/* QUESTS + LB */}
        <div className="sec"><span className="idx c2">2</span><h2>Nhiệm vụ hôm nay</h2><span className="right">1/3 hoàn thành</span></div>
        <div className="cols">
          <div className="card">
            <div className="q done"><span className="lamp" /><div className="t">Chơi 1 ván bất kỳ</div><div className="bar"><i style={{ width: '100%' }} /></div><div className="num">✓</div></div>
            <div className="q prog"><span className="lamp" /><div className="t">Trả lời đúng 5 câu khó</div><div className="bar"><i style={{ width: '20%' }} /></div><div className="num">1/5</div></div>
            <div className="q"><span className="lamp" /><div className="t">Đạt 60+ điểm trong Đấu Hạng</div><div className="bar"><i style={{ width: '0%' }} /></div><div className="num">0/1</div></div>
          </div>
          <div className="card lb">
            <div className="lb-head"><h4>Top điểm tuần</h4><a href="#">Bảng đầy đủ →</a></div>
            <div className="lr me"><div className="p">1</div><div className="a" style={{ background: 'linear-gradient(140deg,var(--c-sap),#5168E0)' }}>T</div><div className="nm">Tai Thanh</div><div className="pt">8.940</div></div>
            <div className="lr"><div className="p">2</div><div className="a" style={{ background: 'var(--c-amb)' }}>M</div><div className="nm">Minh Anh</div><div className="pt">8.120</div></div>
            <div className="lr"><div className="p">3</div><div className="a" style={{ background: 'var(--c-eme)' }}>K</div><div className="nm">Khôi Nguyên</div><div className="pt">7.430</div></div>
            <div className="lb-foot">Mùa <b>Ngũ Tuần ’26</b> · còn 17 ngày</div>
          </div>
        </div>

        {/* MODES */}
        <div className="sec"><span className="idx c3">3</span><h2>Chế độ chơi chính</h2></div>
        <section className="modes">
          <a className="mode m1" href="#"><div className="tag">HỌC MỘT MÌNH</div><h4>Luyện Tập</h4><div className="d">Tự do, không tính XP — luyện theo từng sách.</div>
            <div className="inner">Đang học dở · <b>Sáng Thế Ký</b><div className="mini"><i /></div><div style={{ marginTop: 8 }}>23/50 câu · còn 27 để hoàn thành sách</div></div>
            <div className="go"><span>Tiếp tục</span><span className="ar">→</span></div></a>
          <a className="mode m2" href="#"><div className="tag">THI ĐẤU</div><h4>Đấu Hạng</h4><div className="d">Cạnh tranh bảng xếp hạng theo mùa.</div>
            <div className="inner"><span className="live" /><b>142</b> người đang thi đấu<span className="avs"><i /><i /><i /><i className="x">+9</i></span><div style={{ marginTop: 8 }}>Hạng của bạn · <b style={{ color: 'var(--c-rub)' }}>#1</b></div></div>
            <div className="go"><span>Vào trận</span><span className="ar">→</span></div></a>
          <a className="mode m3" href="#"><div className="tag">CÙNG NHAU</div><h4>Phòng Chơi</h4><div className="d">Chơi cùng bạn bè & hội thánh — 5 chế độ.</div>
            <div className="inner"><span className="live" /><b>8</b> phòng đang mở · <b>42</b> người<span className="avs"><i /><i /><i /><i className="x">+39</i></span><div style={{ marginTop: 8 }}>Hội thánh của bạn có <b>2 phòng</b> đang mở</div></div>
            <div className="go"><span>Tìm phòng</span><span className="ar">→</span></div></a>
        </section>

        <div className="foot" />
      </div>
    </div>
  )
}

const CSS = `
.hks{position:fixed;inset:0;overflow-y:auto;
  --bg:#FBFAF5; --bg-2:#EFE3C3; --ink:#1D2B22; --mut:#4D3A1F; --dim:#6B5530; --hair:#C9B58C;
  --c-sap:#2F6FB0; --c-eme:#2E7D4F; --c-amb:#F59E0B; --c-amb-d:#D97F06; --c-rub:#B3452F;
  --spectrum:linear-gradient(90deg, var(--c-sap), var(--c-eme) 34%, var(--c-amb) 64%, var(--c-rub));
  --ff-d:'Bricolage Grotesque',sans-serif; --ff-b:'Be Vietnam Pro',sans-serif; --ff-v:'Literata',serif;
  font-family:var(--ff-b); background:var(--bg); color:var(--ink);}
.hks *{margin:0;padding:0;box-sizing:border-box}
.hks a{text-decoration:none; color:inherit}
.hks::before{content:''; position:fixed; inset:0; z-index:0; pointer-events:none;
  background:
    radial-gradient(1100px 560px at 50% -16%, rgba(255,221,150,.5), transparent 60%),
    conic-gradient(from 90deg at 50% -10%, transparent 0 42%, rgba(245,158,11,.05) 46%, transparent 50%, rgba(47,111,176,.04) 54%, transparent 58%);}
.hks::after{content:''; position:fixed; inset:0; z-index:0; pointer-events:none; opacity:.035; mix-blend-mode:multiply;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
.hks .wrap{max-width:1180px; margin:0 auto; padding:0 32px; position:relative; z-index:1;}
@keyframes hksshimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@keyframes hksflick{0%,100%{transform:scaleY(1) scaleX(1)}48%{transform:scaleY(1.12) scaleX(.92)}72%{transform:scaleY(.95) scaleX(1.05)}}

/* NAV */
.hks .top{position:sticky; top:0; z-index:20; background:rgba(251,250,245,.82); backdrop-filter:blur(14px); border-bottom:1px solid var(--hair);}
.hks .top-in{display:flex; align-items:center; gap:26px; height:64px;}
.hks .logo{display:flex; align-items:center; gap:10px; font-family:var(--ff-d); font-weight:800; font-size:19px; letter-spacing:-.01em}
.hks .logo-mark{width:30px;height:34px; position:relative; border-radius:15px 15px 7px 7px / 18px 18px 7px 7px; overflow:hidden;
  background:var(--spectrum); box-shadow:0 4px 14px -4px rgba(245,158,11,.5)}
.hks .logo-mark::after{content:''; position:absolute; inset:3px; background:var(--bg); border-radius:13px 13px 5px 5px / 16px 16px 5px 5px}
.hks .logo-mark::before{content:''; position:absolute; left:50%; top:9px; transform:translateX(-50%); width:7px; height:13px; z-index:1;
  border-radius:50% 50% 50% 50%/62% 62% 38% 38%; background:linear-gradient(180deg,var(--c-amb),var(--c-rub))}
.hks .nav{display:flex; gap:3px; margin-left:6px}
.hks .nav a{font-size:13.5px; font-weight:600; color:var(--mut); padding:8px 14px; border-radius:99px}
.hks .nav a:hover{color:var(--ink); background:var(--bg-2)}
.hks .nav a.on{color:#fff; background:var(--ink)}
.hks .tright{margin-left:auto; display:flex; align-items:center; gap:16px}
.hks .ts{display:flex; align-items:center; gap:7px; font-size:13px; font-weight:800}
.hks .ts .k{width:8px;height:8px;border-radius:2px} .hks .ts small{font-weight:700; color:var(--dim); font-size:10.5px}
.hks .tav{width:34px;height:34px;border-radius:11px; background:linear-gradient(140deg,var(--c-sap),#5168E0); color:#fff; display:grid; place-items:center; font-family:var(--ff-d); font-weight:800; font-size:15px}

/* HERO */
.hks .hero{padding:52px 0 6px; text-align:center; position:relative}
.hks .eyebrow{font-size:11px; font-weight:800; letter-spacing:.24em; color:var(--c-amb-d); margin-bottom:12px}
.hks .h-title{font-family:var(--ff-d); font-size:clamp(40px,5.6vw,66px); font-weight:800; letter-spacing:-.03em; line-height:1.02}
.hks .h-title .nm{position:relative; white-space:nowrap; color:var(--ink)}
.hks .h-title .nm::after{content:''; position:absolute; left:-4px; right:-4px; bottom:6px; height:16px; z-index:-1; border-radius:4px;
  background:var(--spectrum); background-size:200% 100%; opacity:.5; filter:blur(.5px); animation:hksshimmer 7s ease-in-out infinite}
.hks .h-sub{margin-top:16px; font-size:15px; color:var(--mut); display:flex; align-items:center; justify-content:center; gap:11px; flex-wrap:wrap}
.hks .h-sub b{color:var(--ink); font-weight:700}
.hks .lvchip{font-size:11px; font-weight:800; color:#fff; padding:4px 11px; border-radius:99px; background:var(--ink)}
.hks .xp{margin:24px auto 0; max-width:560px}
.hks .xp-row{display:flex; gap:5px}
.hks .seg{flex:1; height:13px; border-radius:4px; background:var(--bg-2); border:1px solid var(--hair); position:relative; overflow:hidden}
.hks .seg.f{border-color:transparent; background:var(--spectrum); background-size:520% 100%}
.hks .seg.f.s1{background-position:0% 50%} .hks .seg.f.s2{background-position:25% 50%} .hks .seg.f.s3{background-position:50% 50%}
.hks .seg.h::after{content:''; position:absolute; inset:0; width:18%; background:var(--c-amb)}
.hks .xp-cap{display:flex; justify-content:space-between; margin-top:10px; font-size:12px; color:var(--mut)}
.hks .xp-cap b{color:var(--ink)}

/* VERSE */
.hks .verse{position:relative; margin:40px auto 0; max-width:740px; padding:46px 54px 36px; text-align:center;
  background:radial-gradient(120% 80% at 50% 4%, rgba(255,236,190,.85), #fff 62%);
  border:1px solid var(--hair); border-bottom:none;
  border-radius:240px 240px 0 0 / 180px 180px 0 0;
  box-shadow:0 -10px 60px -24px rgba(245,158,11,.5), inset 0 1px 0 #fff;}
.hks .verse::before{content:''; position:absolute; left:50%; top:-2px; transform:translateX(-50%); width:74%; height:3px; border-radius:99px;
  background:var(--spectrum); opacity:.6}
.hks .verse .cap{font-size:10.5px; font-weight:800; letter-spacing:.26em; color:var(--c-amb-d); margin-bottom:18px}
.hks .verse .body{font-family:var(--ff-v); font-size:25px; line-height:1.5; color:var(--ink)}
.hks .verse .lampmark{display:flex; justify-content:center; margin:0 0 16px}
.hks .verse .lampmark .fl{width:15px; height:21px; border-radius:50% 50% 50% 50%/62% 62% 38% 38%;
  background:linear-gradient(180deg,#FFE7A6,var(--c-amb) 52%,#FF6F3D);
  box-shadow:0 0 18px rgba(245,158,11,.65); animation:hksflick 2.6s ease-in-out infinite}
.hks .verse .body em{font-style:italic; color:var(--c-amb-d)}
.hks .verse .ref{margin-top:16px; font-size:11px; font-weight:800; letter-spacing:.2em; color:var(--dim); clear:both}
.hks .sill{max-width:740px; margin:0 auto 8px; height:14px; border-radius:0 0 12px 12px;
  background:var(--spectrum); filter:blur(.4px);
  box-shadow:0 26px 50px -22px rgba(47,111,176,.35), 0 26px 50px -22px rgba(179,69,47,.3)}
.hks .verse-act{text-align:center; font-size:12px; color:var(--mut); margin-top:14px}

/* SECTION */
.hks .sec{display:flex; align-items:center; gap:12px; margin:46px 0 16px}
.hks .sec .idx{font-family:var(--ff-d); font-size:12px; font-weight:800; color:#fff; width:26px; height:26px; border-radius:8px; display:grid; place-items:center}
.hks .sec .idx.c1{background:var(--c-amb)} .hks .sec .idx.c2{background:var(--c-rub)} .hks .sec .idx.c3{background:var(--c-sap)}
.hks .sec h2{font-family:var(--ff-d); font-size:22px; font-weight:700; letter-spacing:-.015em}
.hks .sec .right{margin-left:auto; font-size:12.5px; font-weight:700; color:var(--mut)}

/* DAILY */
.hks .daily{position:relative; background:#fff; border:1px solid var(--hair); border-radius:22px; padding:30px 32px; overflow:hidden;
  box-shadow:0 34px 64px -34px rgba(245,158,11,.5), 0 14px 34px -22px rgba(179,69,47,.22)}
.hks .daily::before{content:''; position:absolute; top:0; left:0; right:0; height:5px; background:var(--spectrum)}
.hks .daily::after{content:''; position:absolute; right:-80px; top:-100px; width:280px; height:280px; border-radius:50%;
  background:radial-gradient(closest-side, rgba(255,200,90,.3), transparent); pointer-events:none}
.hks .daily-grid{display:flex; gap:28px; align-items:center; flex-wrap:wrap; position:relative}
.hks .daily-main{flex:1; min-width:300px}
.hks .d-badge{display:inline-flex; align-items:center; gap:7px; font-size:10.5px; font-weight:800; letter-spacing:.14em; color:var(--c-amb-d);
  background:rgba(245,158,11,.1); padding:6px 13px; border-radius:99px; margin-bottom:13px}
.hks .d-badge i{width:7px;height:7px;border-radius:99px;background:var(--c-amb)}
.hks .daily h3{font-family:var(--ff-d); font-size:31px; font-weight:800; letter-spacing:-.02em; line-height:1.12}
.hks .daily h3 span{color:var(--c-amb-d)}
.hks .d-meta{display:flex; gap:8px; margin-top:14px; flex-wrap:wrap}
.hks .chip{font-size:12px; font-weight:600; color:var(--mut); border:1px solid var(--hair); background:var(--bg); padding:6px 13px; border-radius:99px}
.hks .d-side{display:flex; flex-direction:column; align-items:flex-end; gap:12px}
.hks .d-timer{font-size:12px; color:var(--mut)} .hks .d-timer b{color:var(--ink); font-variant-numeric:tabular-nums}
.hks .cta{display:inline-flex; align-items:center; gap:10px; font-weight:800; font-size:14.5px; color:#fff;
  background:linear-gradient(135deg,#FF9D2E 0%, #FF5A45 55%, var(--c-rub) 100%);
  padding:15px 27px; border-radius:14px; cursor:pointer; border:none; transition:transform .15s, box-shadow .15s, filter .15s;
  box-shadow:0 16px 34px -12px rgba(179,69,47,.6), 0 4px 16px -6px rgba(245,158,11,.55)}
.hks .cta:hover{transform:translateY(-2px); filter:brightness(1.05)} .hks .cta .xp-tag{background:rgba(255,255,255,.25); color:#fff; font-size:11px; font-weight:800; padding:3px 8px; border-radius:7px}

/* QUESTS + LB */
.hks .cols{display:grid; grid-template-columns:1.6fr 1fr; gap:16px}
.hks .card{background:#fff; border:1px solid var(--hair); border-radius:20px; padding:6px 24px}
.hks .q{display:flex; align-items:center; gap:14px; padding:17px 0; border-bottom:1px solid var(--hair)} .hks .q:last-child{border:none}
.hks .q .lamp{width:9px;height:13px;border-radius:50% 50% 50% 50%/60% 60% 40% 40%; background:var(--bg-2); border:1px solid var(--hair); flex:none}
.hks .q.done .lamp{background:linear-gradient(180deg,#FFE08A,var(--c-amb)); border-color:transparent; box-shadow:0 0 8px rgba(245,158,11,.6)}
.hks .q.prog .lamp{background:linear-gradient(180deg,#FFD98A,#FF8A3D); border-color:transparent; box-shadow:0 0 7px rgba(255,138,61,.5)}
.hks .q .t{font-size:13.5px; font-weight:600; flex:1} .hks .q.done .t{color:var(--mut)}
.hks .q .bar{width:150px; height:7px; background:var(--bg-2); border-radius:99px; overflow:hidden}
.hks .q .bar i{display:block; height:100%; border-radius:99px}
.hks .q.done .bar i{background:linear-gradient(90deg,#FFD773,var(--c-amb))} .hks .q.prog .bar i{background:linear-gradient(90deg,var(--c-amb),#FF8A3D)}
.hks .q .num{width:34px; text-align:right; font-size:12px; font-weight:800; color:var(--mut); font-variant-numeric:tabular-nums}
.hks .lb{padding:18px 24px}
.hks .lb-head{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:10px}
.hks .lb-head h4{font-family:var(--ff-d); font-size:15px; font-weight:700} .hks .lb-head a{font-size:11.5px; font-weight:700; color:var(--mut)}
.hks .lr{display:flex; align-items:center; gap:11px; padding:9px 10px; border-radius:12px; font-size:13px}
.hks .lr.me{background:linear-gradient(90deg, rgba(245,158,11,.13), transparent); outline:1.5px solid rgba(245,158,11,.4)}
.hks .lr .p{font-family:var(--ff-d); font-weight:800; width:16px; color:var(--dim)} .hks .lr.me .p{color:var(--c-amb-d)}
.hks .lr .a{width:26px;height:26px;border-radius:9px; display:grid; place-items:center; color:#fff; font-size:11px; font-weight:800}
.hks .lr .nm{flex:1; font-weight:600; color:var(--mut)} .hks .lr.me .nm{color:var(--ink); font-weight:700}
.hks .lr .pt{font-weight:800; font-variant-numeric:tabular-nums; font-size:12.5px} .hks .lr:not(.me) .pt{color:var(--mut)}
.hks .lb-foot{margin-top:12px; padding-top:12px; border-top:1px dashed var(--hair); font-size:11.5px; color:var(--mut)} .hks .lb-foot b{color:var(--ink)}

/* MODES */
.hks .modes{display:grid; grid-template-columns:repeat(3,1fr); gap:18px}
.hks .mode{position:relative; background:#fff; border:1px solid var(--hair); padding:24px;
  border-radius:64px 64px 22px 22px / 30px 30px 22px 22px; overflow:hidden;
  display:flex; flex-direction:column; gap:8px; min-height:256px; transition:transform .2s, box-shadow .2s}
.hks .mode::before{content:''; position:absolute; top:0; left:0; right:0; height:5px}
.hks .mode.m1::before{background:linear-gradient(90deg,var(--c-sap),#2F6FB0)} .hks .mode.m2::before{background:linear-gradient(90deg,var(--c-rub),#FF7A5A)} .hks .mode.m3::before{background:linear-gradient(90deg,var(--c-eme),#46C89A)}
.hks .mode.m1{box-shadow:0 26px 46px -28px rgba(47,111,176,.5)} .hks .mode.m2{box-shadow:0 26px 46px -28px rgba(179,69,47,.5)} .hks .mode.m3{box-shadow:0 26px 46px -28px rgba(46,125,79,.5)}
.hks .mode:hover{transform:translateY(-5px)}
.hks .mode.m1:hover{box-shadow:0 34px 60px -26px rgba(47,111,176,.62)} .hks .mode.m2:hover{box-shadow:0 34px 60px -26px rgba(179,69,47,.62)} .hks .mode.m3:hover{box-shadow:0 34px 60px -26px rgba(46,125,79,.62)}
.hks .mode .tag{font-size:10px; font-weight:800; letter-spacing:.18em; margin-top:4px}
.hks .m1 .tag{color:var(--c-sap)} .hks .m2 .tag{color:var(--c-rub)} .hks .m3 .tag{color:var(--c-eme)}
.hks .mode h4{font-family:var(--ff-d); font-size:23px; font-weight:800; letter-spacing:-.02em}
.hks .mode .d{font-size:12.5px; color:var(--mut); line-height:1.55}
.hks .mode .inner{margin-top:auto; border:1px solid var(--hair); background:var(--bg); border-radius:14px; padding:12px 14px; font-size:12px; color:var(--mut)}
.hks .mode .inner b{color:var(--ink)}
.hks .mini{height:6px; background:#fff; border:1px solid var(--hair); border-radius:99px; margin-top:9px; overflow:hidden}
.hks .mini i{display:block; height:100%; width:46%; border-radius:99px; background:linear-gradient(90deg,var(--c-sap),#7E94F4)}
.hks .live{display:inline-block; width:7px;height:7px;border-radius:99px; margin-right:6px}
.hks .avs{display:inline-flex; vertical-align:middle; margin-left:7px}
.hks .avs i{width:18px;height:18px;border-radius:99px; border:2px solid #fff; margin-left:-6px}
.hks .avs .x{width:auto; min-width:18px; padding:0 4px; background:var(--ink); color:#fff; font-size:8.5px; font-weight:800; display:inline-grid; place-items:center}
.hks .mode .go{display:flex; justify-content:space-between; align-items:center; margin-top:14px; font-size:13.5px; font-weight:800}
.hks .m1 .go{color:var(--c-sap)} .hks .m2 .go{color:var(--c-rub)} .hks .m3 .go{color:var(--c-eme)}
.hks .mode .go .ar{transition:transform .18s} .hks .mode:hover .go .ar{transform:translateX(4px)}
.hks .m1 .live{background:var(--c-sap)} .hks .m2 .live{background:var(--c-rub)} .hks .m3 .live{background:var(--c-eme)}
.hks .m1 .avs i:nth-child(1){background:var(--c-sap)} .hks .m1 .avs i:nth-child(2){background:var(--c-amb)} .hks .m1 .avs i:nth-child(3){background:var(--c-eme)}
.hks .m2 .avs i:nth-child(1){background:var(--c-rub)} .hks .m2 .avs i:nth-child(2){background:var(--c-amb)} .hks .m2 .avs i:nth-child(3){background:var(--c-sap)}
.hks .m3 .avs i:nth-child(1){background:var(--c-eme)} .hks .m3 .avs i:nth-child(2){background:var(--c-sap)} .hks .m3 .avs i:nth-child(3){background:var(--c-rub)}
.hks .foot{height:80px}
@media (max-width:980px){ .hks .cols{grid-template-columns:1fr} .hks .modes{grid-template-columns:1fr} .hks .nav{display:none} .hks .verse{padding:40px 28px 30px} .hks .verse .body{font-size:21px} }
@media (prefers-reduced-motion:reduce){ .hks *{animation:none !important} }
`
