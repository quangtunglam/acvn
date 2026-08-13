import { PageShell } from '@/components/page-shell';

export default function AboutPage() {
  return (
    <PageShell>
      <div className="wrap">
        <div className="about-page">

          {/* Breadcrumb */}
          <nav className="about-breadcrumb" aria-label="Điều hướng phụ">
            <a href="/">Trang chủ</a>
            <span aria-hidden="true"> / </span>
            <a href="/gioi-thieu">Giới thiệu</a>
            <span aria-hidden="true"> / </span>
            <span>Thông tin về Hội</span>
          </nav>

          {/* Page title */}
          <h1 className="about-title">Thông tin về Hội</h1>

          {/* Vietnamese section */}
          <section className="about-section" lang="vi">
            <h2 className="about-section-title">Lời mở đầu</h2>

            <p className="about-salutation">
              Kính thưa toàn thể bà con người Việt!<br />
              Thưa các anh chị em và các cháu thân mến!
            </p>

            <p>
              Trong những thập kỷ vừa qua, vì nhiều lý do lịch sử khác nhau, hàng triệu người Việt Nam chúng ta đã rời quê hương và định cư tại nhiều quốc gia trên thế giới. Trong số đó có Cộng hòa Séc, nơi cộng đồng người Việt chúng ta là một trong những cộng đồng dân tộc trẻ nhất đang sinh sống tại đất nước này.
            </p>

            <p>
              Tại Cộng hòa Séc, chúng ta có nhiều thuận lợi nhưng đồng thời cũng phải đối mặt với không ít khó khăn. Chúng ta được sống trong một xã hội hiện đại, hòa bình, tự do và dân chủ; được hưởng sự bình đẳng cùng một hệ thống an sinh xã hội tốt của một quốc gia phát triển. Tuy nhiên, chúng ta cũng phải sống xa quê hương, xa những người thân yêu và thiếu đi môi trường văn hóa Việt Nam quen thuộc.
            </p>

            <p>
              Nguy cơ lớn nhất chính là việc thế hệ con em chúng ta dần đánh mất tiếng Việt và văn hóa Việt Nam. Mất tiếng mẹ đẻ cũng đồng nghĩa với việc mất đi một phần bản sắc dân tộc, và một khi đã mất thì việc khôi phục lại sẽ vô cùng khó khăn. Chúng ta có trách nhiệm trước tổ tiên cũng như trước các thế hệ mai sau trong việc gìn giữ những giá trị quý báu ấy.
            </p>

            <p>
              Người Việt Nam chúng ta là một dân tộc thông minh và cần cù. Đất nước Việt Nam là một dải đất và biển xinh đẹp, tựa như một chuỗi ngọc bên bờ Thái Bình Dương. Lịch sử dân tộc ta hào hùng và đầy cảm hứng. Truyền thống và văn hóa Việt Nam vô cùng phong phú, đẹp đẽ. Vì vậy, không có lý do gì để chúng ta không gìn giữ, phát huy và truyền lại những giá trị ấy cho chính mình cũng như cho các thế hệ con cháu mai sau.
            </p>

            <p>
              Hội người Séc gốc Việt Nam được thành lập với mục tiêu gìn giữ và phát triển tiếng Việt, văn hóa Việt Nam và các truyền thống Việt Nam trong cộng đồng của chúng ta.
            </p>

            <p>
              Qua đây, tôi kêu gọi toàn thể bà con tích cực tham gia các hoạt động của Hội người Séc gốc Việt Nam, để chúng ta có thể cùng nhau góp sức gìn giữ và phát triển tiếng Việt, văn hóa Việt Nam và những truyền thống tốt đẹp của dân tộc. Mong rằng mỗi người trong chúng ta sẽ đóng góp cho cộng đồng bằng những ý tưởng, khả năng và những hành động thiết thực của mình.
            </p>

            <div className="about-signature">
              <p className="about-signature-role">Thay mặt Hội người Séc gốc Việt Nam</p>
              <p className="about-signature-name">Ing. Phạm Công Tú</p>
            </div>
          </section>

          {/* Divider */}
          <div className="about-divider" aria-hidden="true" />

          {/* Czech section */}
          <section className="about-section about-section--czech" lang="cs">
            <h2 className="about-section-title">Úvodní slovo</h2>

            <p className="about-salutation">
              Vážení vietnamští krajané!<br />
              Drahé sestry, bratři a milé děti!
            </p>

            <p>
              Během posledních desetiletí z různých historických důvodů, několik miliónů nás – Vietnamců opustilo svůj domov a zabydlelo v různých zemích světa, mezi kterými je i Česká Republika, kde jsme nejmladší komunitou mezi národy žijícími v této zemi.
            </p>

            <p>
              V ČR máme mnoho výhod, ale také máme dost nevýhod. Zde žijeme v moderní společnosti, v míru se svobodou a demokracií, v rovnoprávnosti s dobrým systémem sociálního zabezpečení vyspělého státu, ale také musíme žít daleko od svých domovů, od svých milovaných příbuzných a chybí nám vietnamská kultura.
            </p>

            <p>
              Největší nebezpečí je ztráta vietnamského jazyka a vietnamské kultury u našich dětí. Ztráta mateřštiny znamená ztrátu identity a bude velmi obtížné ji obnovovat. Jsme odpovědni před našimi předky i před našimi potomky za tuto ztrátu.
            </p>

            <p>
              My – Vietnamci jsme chytrý a pracovitý národ. Naše země je krásný pruh souše a moře, jako řetěz perel na břehu Tichého Oceánu. Naše historie je hrdinská a inspirující. Naše tradice a kultura jsou překrásné, proto není důvod, abychom je neuchovali a nerozvíjeli pro nás a pro naše potomky.
            </p>

            <p>
              Asociace českých občanů vietnamského původu byla založena s cílem uchování a rozvoje vietnamského jazyka, vietnamské kultury a vietnamských tradic pro naši komunitu.
            </p>

            <p>
              Tímto Vás vyzývám, abyste se aktivně zapojili do činnosti Asociace českých občanů vietnamského původu, abychom se mohli společně podílet na uchování a rozvoji vietnamského jazyka, vietnamské kultury a vietnamských tradic. Ať každý z nás přispívá naší komunitě svými idejemi a skutečnými činy.
            </p>

            <div className="about-signature">
              <p className="about-signature-role">Jménem Asociace českých občanů vietnamského původu</p>
              <p className="about-signature-name">Ing. Cong Tu Pham</p>
            </div>
          </section>

        </div>
      </div>
    </PageShell>
  );
}
