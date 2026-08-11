import {
  articlesTable,
  authorsTable,
  categoriesTable,
  countriesTable,
  db,
  eventsTable,
} from "@workspace/db";

const image = (id: string, width: number) =>
  `https://images.unsplash.com/${id}?w=${width}&q=80`;

const categories = [
  ["Tin tức", "tin-tuc"],
  ["Kinh doanh", "kinh-doanh"],
  ["Cộng đồng", "cong-dong"],
  ["Chuyện đầu tư", "chuyen-dau-tu"],
  ["Golf", "golf"],
  ["Du lịch", "du-lich"],
  ["Pháp luật & Hội nhập", "phap-luat-hoi-nhap"],
  ["Khoa học & Công nghệ", "khoa-hoc-cong-nghe"],
  ["Giáo dục", "giao-duc"],
  ["Tin thế giới", "tin-the-gioi"],
] as const;

const countries = [
  ["Cộng hòa Séc", "sec", "CZ"],
  ["Slovakia", "slovakia", "SK"],
  ["Ba Lan", "ba-lan", "PL"],
  ["Đức", "duc", "DE"],
  ["Áo", "ao", "AT"],
  ["Pháp", "phap", "FR"],
  ["Việt Nam", "viet-nam", "VN"],
  ["Khác", "khac", null],
] as const;

const authors = [
  ["Mạnh Hải", "Phân tích đầu tư và xu hướng kinh tế châu Âu.", null],
  ["Nguyễn Thanh Cương", "Theo dõi các giải Golf và hoạt động thể thao cộng đồng.", null],
  ["Nguyễn Minh", "Ghi chép về du lịch, hội nhập và đời sống tại châu Âu.", null],
  ["VietPress EU", "Ban biên tập VietPress EU.", null],
] as const;

const seedArticles = [
  {
    title: "Ngày Việt Nam 2026 tại Trnava thu hút hơn 10.000 lượt khách khắp châu Âu",
    slug: "ngay-viet-nam-2026-tai-trnava",
    summary: "Hơn 100 nghệ sĩ và diễn viên không chuyên đã tham gia chương trình biểu diễn nghệ thuật, lan tỏa hình ảnh văn hoá Việt tới cộng đồng bản địa và bạn bè quốc tế.",
    category: "cong-dong",
    country: "sec",
    author: "VietPress EU",
    sourceName: "VietPress EU",
    image: image("photo-1541849546-216549ae216d", 1200),
    featured: true,
    breakingNews: true,
    views: 1840,
  },
  {
    title: "Từ 10/10 Vietjet Air bay từ Praha về Hà Nội hai chuyến mỗi tuần",
    slug: "vietjet-air-praha-ha-noi-hai-chuyen-moi-tuan",
    summary: "Đường bay thẳng mới mở thêm lựa chọn di chuyển cho cộng đồng người Việt tại khu vực Trung Âu.",
    category: "kinh-doanh",
    country: "sec",
    author: "VietPress EU",
    sourceName: "E15.cz",
    featured: true,
    breakingNews: true,
    views: 4210,
  },
  {
    title: "Cửa hàng biên giới Séc – Đức thay đổi mặt hàng kinh doanh",
    slug: "cua-hang-bien-gioi-sec-duc-thay-doi-mat-hang",
    summary: "Các điểm bán lẻ khu vực biên giới đang thích ứng với thay đổi hành vi mua sắm và quy định mới.",
    category: "kinh-doanh",
    country: "duc",
    author: "VietPress EU",
    sourceName: "E15.cz",
    featured: false,
    breakingNews: true,
    views: 3150,
  },
  {
    title: "Thanh toán tiền mặt trên 270.000 korun có thể bị phạt tới 5 triệu",
    slug: "thanh-toan-tien-mat-tren-270000-korun",
    summary: "Quy định giới hạn thanh toán tiền mặt tiếp tục được cơ quan chức năng nhắc lại với người dân và doanh nghiệp.",
    category: "phap-luat-hoi-nhap",
    country: "sec",
    author: "VietPress EU",
    sourceName: "E15.cz",
    featured: false,
    breakingNews: false,
    views: 2980,
  },
  {
    title: "Séc là điểm đến du lịch tăng trưởng nhanh nhất châu Âu",
    slug: "sec-la-diem-den-du-lich-tang-truong-nhanh-nhat",
    summary: "Lượng khách quốc tế đến Cộng hòa Séc tăng mạnh nhờ các thành phố lịch sử và mạng lưới giao thông thuận tiện.",
    category: "du-lich",
    country: "sec",
    author: "Nguyễn Minh",
    sourceName: "Novinky",
    featured: true,
    breakingNews: true,
    views: 2740,
  },
  {
    title: "Hãng taxi điện Việt Nam chính thức tiến vào thị trường châu Âu",
    slug: "taxi-dien-viet-nam-tien-vao-thi-truong-chau-au",
    summary: "Doanh nghiệp công nghệ Việt Nam công bố kế hoạch mở rộng dịch vụ di chuyển xanh tại châu Âu.",
    category: "kinh-doanh",
    country: "khac",
    author: "VietPress EU",
    sourceName: "VnExpress",
    featured: false,
    breakingNews: false,
    views: 2510,
  },
  {
    title: "Meta cũng gặp sự cố: tác nhân AI hành xử như tin tặc",
    slug: "meta-cung-gap-su-co-tac-nhan-ai-hanh-xu-nhu-tin-tac",
    summary: "Một sự cố mới cho thấy các tác nhân AI cần được kiểm soát chặt chẽ khi được trao quyền truy cập hệ thống.",
    category: "khoa-hoc-cong-nghe",
    country: "khac",
    author: "VietPress EU",
    sourceName: "Novinky",
    featured: true,
    breakingNews: false,
    views: 3860,
    image: image("photo-1451187580459-43490279c0fa", 600),
  },
  {
    title: "Người kế nhiệm Buffett rót gần nửa nghìn tỷ korun vào cổ phiếu",
    slug: "nguoi-ke-nhiem-buffett-rot-gan-nua-nghin-ty-korun",
    summary: "Dòng vốn lớn tiếp tục chảy vào các doanh nghiệp có nền tảng bền vững trong bối cảnh thị trường nhiều biến động.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "Novinky",
    featured: true,
    breakingNews: false,
    views: 3620,
    image: image("photo-1526304640581-d334cdbbf45e", 600),
  },
  {
    title: "Mỹ áp thuế 15% lên vật liệu chip chủ chốt để đối phó Trung Quốc",
    slug: "my-ap-thue-vat-lieu-chip-chu-chot",
    summary: "Chính sách thương mại mới có thể tác động tới chuỗi cung ứng công nghệ toàn cầu.",
    category: "khoa-hoc-cong-nghe",
    country: "khac",
    author: "VietPress EU",
    sourceName: "BBC",
    featured: true,
    breakingNews: false,
    views: 3410,
    image: image("photo-1518770660439-4636190af475", 600),
  },
  {
    title: "Giá vàng đã giảm khoảng một phần tư so với đỉnh hồi tháng 1",
    slug: "gia-vang-giam-mot-phan-tu-so-voi-dinh-thang-mot",
    summary: "Thị trường kim loại quý điều chỉnh sau giai đoạn tăng mạnh đầu năm.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "České noviny",
    featured: true,
    breakingNews: false,
    views: 2350,
    image: image("photo-1454165804606-c3d57bc86b40", 600),
  },
  {
    title: "Loạt trường y dược công bố điểm chuẩn đại học năm 2026",
    slug: "truong-y-duoc-cong-bo-diem-chuan-dai-hoc-2026",
    summary: "Nhiều trường đại học tại Việt Nam lần lượt công bố điểm chuẩn và phương thức xác nhận nhập học.",
    category: "giao-duc",
    country: "viet-nam",
    author: "VietPress EU",
    sourceName: "Báo Sức Khỏe & Đời Sống",
    featured: false,
    breakingNews: false,
    views: 1880,
    image: image("photo-1583417319070-4a69db38a482", 300),
  },
  {
    title: "Miền Bắc bước vào đợt nắng nóng gay gắt, có nơi 39 độ C",
    slug: "mien-bac-buoc-vao-dot-nang-nong-gay-gat",
    summary: "Nền nhiệt cao kéo dài khiến nhu cầu theo dõi sức khỏe và sử dụng điện tăng mạnh.",
    category: "tin-tuc",
    country: "viet-nam",
    author: "VietPress EU",
    sourceName: "VnExpress",
    featured: false,
    breakingNews: false,
    views: 1660,
    image: image("photo-1509023464722-18d996393ca8", 300),
  },
  {
    title: "Đà Nẵng sắp xếp, tinh giản hơn 500 cơ sở giáo dục công lập",
    slug: "da-nang-sap-xep-tinh-gian-co-so-giao-duc",
    summary: "Đề án sắp xếp được xây dựng nhằm sử dụng hiệu quả nguồn lực và nâng chất lượng giáo dục.",
    category: "giao-duc",
    country: "viet-nam",
    author: "VietPress EU",
    sourceName: "Báo Tuổi Trẻ",
    featured: false,
    breakingNews: false,
    views: 1420,
    image: image("photo-1524492412937-b28074a5d7da", 300),
  },
  {
    title: "Động đất rung chuyển Colombia, ít nhất 30 người thiệt mạng",
    slug: "dong-dat-rung-chuyen-colombia",
    summary: "Lực lượng cứu hộ đang tìm kiếm nạn nhân trong các khu vực bị ảnh hưởng nặng.",
    category: "tin-the-gioi",
    country: "khac",
    author: "VietPress EU",
    sourceName: "VnExpress",
    featured: false,
    breakingNews: false,
    views: 2140,
    image: image("photo-1526778548025-fa2f459cd5c1", 300),
  },
  {
    title: "Đằng sau việc Mỹ chuyển hướng sang ngoại giao với Iran",
    slug: "sau-viec-my-chuyen-huong-ngoai-giao-voi-iran",
    summary: "Những tín hiệu ngoại giao mới đang được giới quan sát quốc tế theo dõi sát sao.",
    category: "tin-the-gioi",
    country: "khac",
    author: "VietPress EU",
    sourceName: "Báo Tin tức",
    featured: false,
    breakingNews: false,
    views: 1760,
    image: image("photo-1450101499163-c8848c66ca85", 300),
  },
  {
    title: "Kế hoạch hoà bình 15 điểm cho Dải Gaza vấp phải phản đối",
    slug: "ke-hoach-hoa-binh-15-diem-cho-dai-gaza",
    summary: "Các bên liên quan tiếp tục tranh luận về lộ trình và điều kiện để tiến tới một thỏa thuận.",
    category: "tin-the-gioi",
    country: "khac",
    author: "VietPress EU",
    sourceName: "Báo Dân trí",
    featured: false,
    breakingNews: false,
    views: 1550,
    image: image("photo-1541872703-74c5e44368f9", 300),
  },
  {
    title: "Kỷ nguyên điện lực: khi cả thế giới cần nhiều điện hơn, ai hưởng lợi lớn nhất?",
    slug: "ky-nguyen-dien-luc-ai-huong-loi-lon-nhat",
    summary: "Cùng với điện toán đám mây, AI và xe điện, nhu cầu điện toàn cầu đang tăng nhanh.",
    category: "chuyen-dau-tu",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "VietPress EU",
    featured: true,
    breakingNews: false,
    views: 2890,
    image: image("photo-1526779259212-939e64788e3c", 900),
  },
  {
    title: "EVGA Tour Final 2026: chung kết mùa giải giữa ba thử thách tại Cyprus",
    slug: "evga-tour-final-2026-tai-cyprus",
    summary: "Mùa giải khép lại bằng những vòng đấu quyết định tại Cyprus.",
    category: "golf",
    country: "khac",
    author: "Nguyễn Thanh Cương",
    sourceName: "VietPress EU",
    featured: true,
    breakingNews: false,
    views: 1110,
    image: image("photo-1535131749006-b7f58c99034b", 600),
  },
  {
    title: "Đầu tư vào ngành nước: từ hạ tầng đến công nghệ trước biến đổi khí hậu",
    slug: "dau-tu-vao-nganh-nuoc-truoc-bien-doi-khi-hau",
    summary: "Hạ tầng nước và công nghệ tiết kiệm đang trở thành chủ đề dài hạn được nhiều nhà đầu tư quan tâm.",
    category: "chuyen-dau-tu",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "VietPress EU",
    featured: true,
    breakingNews: false,
    views: 1260,
    image: image("photo-1500375592092-40eb2168fd21", 600),
  },
  {
    title: "Mua tem xa lộ điện tử: cẩn thận mất tiền oan khi đặt trên mạng",
    slug: "mua-tem-xa-lo-dien-tu-can-than-mat-tien",
    summary: "Người lái xe nên kiểm tra kỹ website bán tem trước khi thanh toán.",
    category: "du-lich",
    country: "sec",
    author: "Nguyễn Minh",
    sourceName: "VietPress EU",
    featured: true,
    breakingNews: false,
    views: 1320,
    image: image("photo-1449824913935-59a10b8d2000", 600),
  },
  {
    title: "Huyền thoại của Google rời đi, vốn hoá công ty bốc hơi hàng nghìn tỷ",
    slug: "huyen-thoai-google-roi-di-von-hoa-boc-hoi",
    summary: "Thị trường phản ứng mạnh trước thông tin nhân sự cấp cao rời công ty công nghệ.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "Novinky",
    featured: false,
    breakingNews: false,
    views: 2040,
    image: image("photo-1611974789855-9c2a0a7236a3", 300),
  },
  {
    title: "Giá dầu ô liu sẽ tăng khi mùa màng chịu nắng nóng và cháy rừng",
    slug: "gia-dau-o-liu-tang-do-nang-nong-chay-rung",
    summary: "Thời tiết khắc nghiệt tại Nam Âu tiếp tục gây áp lực lên nguồn cung nông sản.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "Novinky",
    featured: false,
    breakingNews: false,
    views: 1280,
    image: image("photo-1543286386-713bdd548da4", 300),
  },
  {
    title: "Strnad mua 14% cổ phần hãng lốp Pirelli của Ý — dấu mốc đáng chú ý",
    slug: "strnad-mua-co-phan-pirelli",
    summary: "Thương vụ mới cho thấy tham vọng mở rộng của dòng vốn Trung Âu trong ngành công nghiệp.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "Aktuálně",
    featured: false,
    breakingNews: false,
    views: 1190,
    image: image("photo-1526304640581-d334cdbbf45e", 300),
  },
  {
    title: "Yên Nhật lao xuống đáy, Mỹ và Nhật Bản can thiệp hiếm hoi",
    slug: "yen-nhat-lao-xuong-day",
    summary: "Biến động tỷ giá đang khiến thị trường tài chính toàn cầu theo dõi các động thái can thiệp.",
    category: "kinh-doanh",
    country: "khac",
    author: "Mạnh Hải",
    sourceName: "Novinky",
    featured: false,
    breakingNews: false,
    views: 970,
    image: image("photo-1590283603385-17ffb3a7f29f", 300),
  },
] as const;

async function seed() {
  await db
    .insert(categoriesTable)
    .values(categories.map(([name, slug]) => ({ name, slug })))
    .onConflictDoNothing();
  await db
    .insert(countriesTable)
    .values(countries.map(([name, slug, code]) => ({ name, slug, code })))
    .onConflictDoNothing();
  await db
    .insert(authorsTable)
    .values(authors.map(([name, bio, avatar]) => ({ name, bio, avatar })))
    .onConflictDoNothing();

  const categoryRows = await db.select().from(categoriesTable);
  const countryRows = await db.select().from(countriesTable);
  const authorRows = await db.select().from(authorsTable);
  const categoryId = new Map(categoryRows.map((row) => [row.slug, row.id]));
  const countryId = new Map(countryRows.map((row) => [row.slug, row.id]));
  const authorId = new Map(authorRows.map((row) => [row.name, row.id]));

  await db
    .insert(articlesTable)
    .values(
      seedArticles.map((article) => ({
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        content: `<p>${article.summary}</p><p>Đây là nội dung biên tập mẫu được chuyển từ giao diện VietPress EU để chuẩn bị cho quy trình quản trị nội dung. Ban biên tập sẽ bổ sung bản đầy đủ trước khi xuất bản chính thức.</p>`,
        coverImage: "image" in article ? article.image : null,
        categoryId: categoryId.get(article.category),
        countryId: countryId.get(article.country),
        authorId: authorId.get(article.author),
        editor: "VietPress EU",
        sourceName: article.sourceName,
        sourceUrl: `https://${article.sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.example`,
        publishedAt: new Date("2026-08-11T06:00:00.000Z"),
        status: "published",
        featured: article.featured,
        breakingNews: article.breakingNews,
        views: article.views,
        tags: [article.category],
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(eventsTable)
    .values([
      {
        title: "BRNO OPEN 2026",
        description: "Giải Golf cộng đồng mở rộng tại Brno.",
        startDate: new Date("2026-08-16T07:00:00.000Z"),
        endDate: new Date("2026-08-17T16:00:00.000Z"),
        location: "Kaskáda Golf Resort, Brno",
        eventType: "golf",
      },
      {
        title: "EVGA TOUR FINAL 2026",
        description: "Chung kết mùa giải EVGA Tour.",
        startDate: new Date("2026-12-05T07:00:00.000Z"),
        endDate: new Date("2026-12-10T16:00:00.000Z"),
        location: "Cyprus",
        eventType: "golf",
      },
    ])
    .onConflictDoNothing();

  console.log(`Seeded ${seedArticles.length} articles, ${categories.length} categories, ${countries.length} countries, ${authors.length} authors, and 2 events.`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("@workspace/db");
    await pool.end();
  });