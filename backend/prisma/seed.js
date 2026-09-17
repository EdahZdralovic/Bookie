const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seedDatabase(client = prisma) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Demo seed is disabled in production. Provision the administrator separately.');
  }
  const passwordHash = await bcrypt.hash('student123', 12);
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  return client.$transaction(
    async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(20260914)`;
      const upsert = (model, where, create) => db[model].upsert({ where, create, update: {} });
      const cities = {};
      for (const name of ['Sarajevo', 'Mostar', 'Tuzla']) {
        cities[name] = await upsert('city', { name }, { name });
      }
      const genres = {};
      for (const [name, slug] of [
        ['Professional literature', 'professional-literature'],
        ['Novel', 'novel'],
        ['Science fiction', 'science-fiction'],
        ['Comic', 'comic'],
        ['Textbook', 'textbook'],
        ['Children books', 'children'],
      ]) {
        genres[slug] = await upsert('genre', { slug }, { name, slug });
      }
      const languages = {};
      for (const [name, code] of [
        ['Bosnian', 'bs'],
        ['English', 'en'],
        ['German', 'de'],
      ]) {
        languages[code] = await upsert('language', { code }, { name, code });
      }
      const conditions = {};
      for (const [index, [name, slug]] of [
        ['New', 'new'],
        ['Like new', 'like-new'],
        ['Good', 'good'],
        ['Used', 'used'],
        ['Damaged', 'damaged'],
      ].entries()) {
        conditions[slug] = await upsert(
          'bookCondition',
          { slug },
          { name, slug, sortOrder: index },
        );
      }
      const tags = {};
      for (const [name, slug] of [
        ['Bestseller', 'bestseller'],
        ['Sale', 'sale'],
        ['New collection', 'new-collection'],
      ]) {
        tags[slug] = await upsert('tag', { slug }, { name, slug });
      }
      const pickupPoint = await upsert(
        'pickupPoint',
        {
          cityId_name: { cityId: cities.Sarajevo.id, name: 'Campus library' },
        },
        {
          name: 'Campus library',
          address: 'Zmaja od Bosne 8B',
          type: 'LIBRARY',
          cityId: cities.Sarajevo.id,
        },
      );
      const createUser = (email, firstName, lastName, role, city, extra = {}) =>
        upsert(
          'user',
          { email },
          {
            email,
            firstName,
            lastName,
            role,
            cityId: cities[city].id,
            passwordHash,
            phone: '+38761000000',
            emailVerifiedAt: new Date(),
            ...extra,
          },
        );
      const admin = await createUser(
        'admin@bookie.ba',
        'System',
        'Administrator',
        'ADMIN',
        'Sarajevo',
        { passwordHash: adminPasswordHash },
      );
      const seller = await createUser(
        'prodavac@bookie.ba',
        'Amina',
        'Hadžić',
        'SELLER',
        'Sarajevo',
        { bio: 'Giving good books a second home.' },
      );
      const secondSeller = await createUser(
        'knjige@bookie.ba',
        'Haris',
        'Kovač',
        'SELLER',
        'Mostar',
      );
      const buyer = await createUser('student@bookie.test', 'Demo', 'Student', 'BUYER', 'Tuzla');
      for (const genreId of [genres['professional-literature'].id, genres.novel.id]) {
        await upsert(
          'userGenreInterest',
          { userId_genreId: { userId: buyer.id, genreId } },
          { userId: buyer.id, genreId },
        );
      }
      for (const languageId of [languages.bs.id, languages.en.id]) {
        await upsert(
          'userLanguageInterest',
          { userId_languageId: { userId: buyer.id, languageId } },
          { userId: buyer.id, languageId },
        );
      }
      const cart = await upsert('cart', { userId: buyer.id }, { userId: buyer.id });
      const books = {};
      const bookRows = [
        [
          'clean-code',
          '9780132350884',
          'Clean Code',
          'Robert C. Martin',
          'Prentice Hall',
          2008,
          '32.00',
          true,
          'professional-literature',
          'en',
          'good',
          seller,
          'Sarajevo',
        ],
        [
          'pragmatic',
          '9780135957059',
          'The Pragmatic Programmer',
          'David Thomas & Andrew Hunt',
          'Addison-Wesley',
          2019,
          '38.00',
          true,
          'professional-literature',
          'en',
          'like-new',
          seller,
          'Sarajevo',
        ],
        [
          'fortress',
          '9789958306464',
          'Tvrđava',
          'Meša Selimović',
          'Connectum',
          2020,
          '14.00',
          true,
          'novel',
          'bs',
          'good',
          seller,
          'Sarajevo',
        ],
        [
          'dune',
          '9780441172719',
          'Dune',
          'Frank Herbert',
          'Ace',
          2010,
          '22.00',
          false,
          'science-fiction',
          'en',
          'used',
          secondSeller,
          'Mostar',
        ],
        [
          'prince',
          '9789533169798',
          'The Little Prince',
          'Antoine de Saint-Exupéry',
          'School Book',
          2018,
          '9.00',
          true,
          'children',
          'bs',
          'like-new',
          secondSeller,
          'Mostar',
        ],
        [
          'watchmen',
          '9781401245252',
          'Watchmen',
          'Alan Moore',
          'DC Comics',
          2014,
          '27.00',
          true,
          'comic',
          'en',
          'good',
          secondSeller,
          'Mostar',
        ],
        [
          'economics',
          '9789958216107',
          'Introduction to Economics',
          'Paul Samuelson',
          'Mate',
          2017,
          '20.00',
          false,
          'textbook',
          'bs',
          'used',
          seller,
          'Sarajevo',
        ],
        [
          'alchemist',
          '9780062315007',
          'The Alchemist',
          'Paulo Coelho',
          'HarperOne',
          2014,
          '12.00',
          true,
          'novel',
          'en',
          'good',
          secondSeller,
          'Mostar',
        ],
        [
          'sold-clean-code',
          '9780132350884',
          'Clean Code',
          'Robert C. Martin',
          'Prentice Hall',
          2008,
          '30.00',
          false,
          'professional-literature',
          'en',
          'good',
          seller,
          'Sarajevo',
          'SOLD',
        ],
        [
          'exchange-requested',
          null,
          'Selected Stories',
          'Demo Author',
          'Campus Press',
          2020,
          '0.00',
          true,
          'novel',
          'bs',
          'good',
          seller,
          'Sarajevo',
          'RESERVED',
        ],
        [
          'exchange-offered',
          null,
          'Student Reader',
          'Demo Writer',
          'Campus Press',
          2021,
          '0.00',
          true,
          'textbook',
          'bs',
          'good',
          buyer,
          'Tuzla',
          'RESERVED',
        ],
      ];
      for (const [
        key,
        isbn,
        title,
        author,
        publisher,
        publicationYear,
        price,
        allowExchange,
        genre,
        language,
        condition,
        owner,
        city,
        status = 'ACTIVE',
      ] of bookRows) {
        const publicId = `demo-${key}`;
        books[key] = await upsert(
          'book',
          { publicId },
          {
            publicId,
            isbn,
            title,
            author,
            publisher,
            publicationYear,
            price,
            allowExchange,
            status,
            ownerId: owner.id,
            genreId: genres[genre].id,
            languageId: languages[language].id,
            conditionId: conditions[condition].id,
            description: `${title}, a used book ready for its next reader.`,
            imageUrl: '/images/book-placeholder.svg',
            pickupLocations: { create: { cityId: cities[city].id } },
            images: { create: { url: '/images/book-placeholder.svg', altText: title } },
            tags: { create: { tagId: tags.bestseller.id } },
          },
        );
      }
      await upsert(
        'cartItem',
        { cartId_bookId: { cartId: cart.id, bookId: books.dune.id } },
        { cartId: cart.id, bookId: books.dune.id },
      );
      const createdAt = new Date('2026-08-10T10:00:00Z');
      const acceptedAt = new Date('2026-08-11T10:00:00Z');
      const completedAt = new Date('2026-08-12T10:00:00Z');
      const itemData = (book, price = book.price) => ({
        bookId: book.id,
        price,
        bookTitle: book.title,
        bookAuthor: book.author,
      });
      const sale = await upsert(
        'order',
        { orderNumber: 'BK-DEMO-001' },
        {
          orderNumber: 'BK-DEMO-001',
          type: 'PURCHASE',
          status: 'COMPLETED',
          totalAmount: '30.00',
          buyerId: buyer.id,
          sellerId: seller.id,
          pickupPointId: pickupPoint.id,
          pickupAddress: pickupPoint.address,
          createdAt,
          acceptedAt,
          completedAt,
          items: {
            create: {
              ...itemData(books['sold-clean-code']),
              review: {
                create: {
                  rating: 5,
                  comment: 'Accurate description and a helpful seller.',
                  createdAt: completedAt,
                  editableUntil: new Date(completedAt.getTime() + 86400000),
                },
              },
            },
          },
          statusHistory: {
            create: [
              { toStatus: 'PENDING', changedById: buyer.id, createdAt },
              {
                fromStatus: 'PENDING',
                toStatus: 'ACCEPTED',
                changedById: seller.id,
                createdAt: acceptedAt,
              },
              {
                fromStatus: 'ACCEPTED',
                toStatus: 'COMPLETED',
                changedById: seller.id,
                createdAt: completedAt,
              },
            ],
          },
        },
      );
      const exchange = await upsert(
        'order',
        { orderNumber: 'BK-DEMO-002' },
        {
          orderNumber: 'BK-DEMO-002',
          type: 'EXCHANGE',
          status: 'ACCEPTED',
          totalAmount: '0.00',
          buyerId: buyer.id,
          sellerId: seller.id,
          createdAt,
          acceptedAt,
          pickupPointId: pickupPoint.id,
          pickupAddress: pickupPoint.address,
          items: { create: itemData(books['exchange-requested'], '0.00') },
          exchangeOffer: {
            create: {
              note: 'I can offer my textbook.',
              offeredBooks: { create: { bookId: books['exchange-offered'].id } },
            },
          },
          reservations: {
            create: [
              { bookId: books['exchange-requested'].id },
              { bookId: books['exchange-offered'].id },
            ],
          },
          statusHistory: {
            create: [
              { toStatus: 'PENDING', changedById: buyer.id, createdAt },
              {
                fromStatus: 'PENDING',
                toStatus: 'ACCEPTED',
                changedById: seller.id,
                createdAt: acceptedAt,
              },
            ],
          },
        },
      );
      await upsert(
        'order',
        { orderNumber: 'BK-DEMO-003' },
        {
          orderNumber: 'BK-DEMO-003',
          type: 'PURCHASE',
          totalAmount: books.pragmatic.price,
          buyerId: buyer.id,
          sellerId: seller.id,
          items: { create: itemData(books.pragmatic) },
          statusHistory: { create: { toStatus: 'PENDING', changedById: buyer.id } },
        },
      );
      async function conversation(subject, members, sender, body, orderId, bookId) {
        const existing = await db.conversation.findFirst({
          where: { subject, orderId: orderId ?? null },
        });
        if (existing) return existing;
        const result = await db.conversation.create({
          data: {
            subject,
            orderId,
            participants: { create: members.map((member) => ({ userId: member.id })) },
            ...(bookId && { books: { create: { bookId } } }),
          },
        });
        await db.message.create({ data: { conversationId: result.id, senderId: sender.id, body } });
        return result;
      }
      await conversation(
        'Demo: exchange pickup',
        [buyer, seller],
        buyer,
        'Can we meet at the campus library?',
        exchange.id,
        books['exchange-requested'].id,
      );
      await conversation(
        'Demo: seller support',
        [seller, admin],
        seller,
        'How can I update my pickup location?',
      );
      await conversation(
        'Demo: buyer support',
        [buyer, admin],
        buyer,
        'I would like help with a listing.',
      );
      for (const [eventKey, userId, type, title, body] of [
        [
          'demo-order-pending',
          seller.id,
          'ORDER',
          'New order',
          'A buyer requested The Pragmatic Programmer.',
        ],
        ['demo-review', seller.id, 'REVIEW', 'New review', 'A buyer rated your completed order.'],
        [
          'demo-message',
          seller.id,
          'MESSAGE',
          'New message',
          'The buyer asked about exchange pickup.',
        ],
        ['demo-welcome', buyer.id, 'SYSTEM', 'Welcome to Bookie', 'Your next book is waiting.'],
      ])
        await upsert('notification', { eventKey }, { eventKey, userId, type, title, body });
      if (
        !(await db.report.findFirst({
          where: {
            reporterId: buyer.id,
            bookId: books.watchmen.id,
            reason: 'Demo: verify book condition',
          },
        }))
      ) {
        await db.report.create({
          data: {
            reporterId: buyer.id,
            bookId: books.watchmen.id,
            reason: 'Demo: verify book condition',
            details: 'Please clarify the condition description.',
          },
        });
      }
      let alert = await db.wishlistAlert.findFirst({
        where: { userId: buyer.id, query: 'Clean Code' },
      });
      if (!alert)
        alert = await db.wishlistAlert.create({
          data: { userId: buyer.id, query: 'Clean Code', languageId: languages.en.id },
        });
      const wishlistNotification = await upsert(
        'notification',
        { eventKey: 'demo-wishlist-clean-code' },
        {
          eventKey: 'demo-wishlist-clean-code',
          userId: buyer.id,
          type: 'WISHLIST_MATCH',
          title: 'Wishlist match',
          body: 'Clean Code is available.',
        },
      );
      await upsert(
        'wishlistMatch',
        { wishlistAlertId_bookId: { wishlistAlertId: alert.id, bookId: books['clean-code'].id } },
        {
          wishlistAlertId: alert.id,
          bookId: books['clean-code'].id,
          notificationId: wishlistNotification.id,
        },
      );
      const badge = await upsert(
        'badge',
        { code: 'FIRST_SUCCESSFUL_SALE' },
        {
          code: 'FIRST_SUCCESSFUL_SALE',
          name: 'First successful sale',
          description: 'One completed order and an average rating of at least four.',
          minimumCompletedOrders: 1,
          minimumAverageRating: '4.00',
          icon: 'check',
        },
      );
      await upsert(
        'userBadge',
        { userId_badgeId: { userId: seller.id, badgeId: badge.id } },
        { userId: seller.id, badgeId: badge.id },
      );
      return {
        users: await db.user.count(),
        books: await db.book.count(),
        orders: await db.order.count(),
        saleId: sale.id,
      };
    },
    { timeout: 60000 },
  );
}

if (require.main === module) {
  seedDatabase()
    .then((result) => console.log('Demo seed complete:', result))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
module.exports = { seedDatabase };
