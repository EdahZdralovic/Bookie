const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function upsertLookup(model, where, create, update = {}) {
  return prisma[model].upsert({ where, update, create });
}

async function upsertBook(isbn, data) {
  const existing = await prisma.book.findFirst({ where: { isbn } });
  if (existing) return prisma.book.update({ where: { id: existing.id }, data });
  return prisma.book.create({ data: { ...data, isbn } });
}

async function main() {
  const passwordHash = await bcrypt.hash('student123', 12);
  const adminPasswordHash = await bcrypt.hash('admin123', 12);

  const sarajevo = await upsertLookup('city', { name: 'Sarajevo' }, { name: 'Sarajevo' });
  const mostar = await upsertLookup('city', { name: 'Mostar' }, { name: 'Mostar' });
  const tuzla = await upsertLookup('city', { name: 'Tuzla' }, { name: 'Tuzla' });

  const genres = {};
  for (const genre of [
    ['Professional literature', 'professional-literature'],
    ['Roman', 'roman'],
    ['Science fiction', 'science-fiction'],
    ['Strip', 'strip'],
    ['Textbook', 'textbook'],
    ['Children’s book', 'children-book'],
  ]) {
    genres[genre[1]] = await upsertLookup('genre', { slug: genre[1] }, { name: genre[0], slug: genre[1] }, { name: genre[0] });
  }

  const languages = {};
  for (const language of [['Bosnian', 'bs'], ['English', 'en'], ['German', 'de']]) {
    languages[language[1]] = await upsertLookup('language', { code: language[1] }, { name: language[0], code: language[1] }, { name: language[0] });
  }

  const conditions = {};
  for (const [index, condition] of ['New', 'Like new', 'Good', 'Used', 'Damaged'].entries()) {
    const slug = ['nova', 'kao-nova', 'dobra', 'koristena', 'ostecena'][index];
    conditions[slug] = await upsertLookup('bookCondition', { slug }, { name: condition, slug, sortOrder: index + 1 }, { name: condition, sortOrder: index + 1 });
  }

  const tags = {};
  for (const tag of [['Bestseller', 'bestseller'], ['Akcija', 'akcija'], ['Nova kolekcija', 'nova-kolekcija']]) {
    tags[tag[1]] = await upsertLookup('tag', { slug: tag[1] }, { name: tag[0], slug: tag[1] }, { name: tag[0] });
  }

  await upsertLookup('pickupPoint', { cityId_name: { cityId: sarajevo.id, name: 'Univerzitetska biblioteka' } }, {
    name: 'Univerzitetska biblioteka', address: 'Zmaja od Bosne 8B', type: 'Biblioteka', cityId: sarajevo.id,
  });
  await upsertLookup('pickupPoint', { cityId_name: { cityId: sarajevo.id, name: 'Studentski dom Bjelave' } }, {
    name: 'Bjelave Student Residence', address: 'Bardakčije 1', type: 'Student residence', cityId: sarajevo.id,
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bookie.ba' },
    update: { role: 'ADMIN', status: 'ACTIVE', passwordHash: adminPasswordHash },
    create: { name: 'System Administrator', firstName: 'System', lastName: 'Administrator', email: 'admin@bookie.ba', passwordHash: adminPasswordHash, role: 'ADMIN', cityId: sarajevo.id },
  });

  const seller = await prisma.user.upsert({
    where: { email: 'prodavac@bookie.ba' },
    update: { role: 'SELLER', status: 'ACTIVE', passwordHash, cityId: sarajevo.id },
    create: { name: 'Amina Hadžić', firstName: 'Amina', lastName: 'Hadžić', email: 'prodavac@bookie.ba', passwordHash, role: 'SELLER', bio: 'A student giving her books a new life.', cityId: sarajevo.id },
  });

  const secondSeller = await prisma.user.upsert({
    where: { email: 'knjige@bookie.ba' },
    update: { role: 'SELLER', status: 'ACTIVE', passwordHash, cityId: mostar.id },
    create: { name: 'Haris Kovač', firstName: 'Haris', lastName: 'Kovač', email: 'knjige@bookie.ba', passwordHash, role: 'SELLER', bio: 'A fan of classics, comics and good coffee.', cityId: mostar.id },
  });

  const buyer = await prisma.user.upsert({
    where: { email: 'student@bookie.test' },
    update: { name: 'Demo Student', firstName: 'Demo', lastName: 'Student', passwordHash, role: 'BUYER', status: 'ACTIVE', cityId: tuzla.id },
    create: { name: 'Demo Student', firstName: 'Demo', lastName: 'Student', email: 'student@bookie.test', passwordHash, role: 'BUYER', cityId: tuzla.id },
  });

  for (const genreId of [genres['strucna-literatura'].id, genres.roman.id]) {
    await prisma.userGenreInterest.upsert({
      where: { userId_genreId: { userId: buyer.id, genreId } },
      update: {}, create: { userId: buyer.id, genreId },
    });
  }
  for (const languageId of [languages.bs.id, languages.en.id]) {
    await prisma.userLanguageInterest.upsert({
      where: { userId_languageId: { userId: buyer.id, languageId } },
      update: {}, create: { userId: buyer.id, languageId },
    });
  }
  await prisma.cart.upsert({ where: { userId: buyer.id }, update: {}, create: { userId: buyer.id } });
  await prisma.book.updateMany({ where: { status: 'AVAILABLE' }, data: { status: 'ARCHIVED' } });

  const bookData = [
    ['9780132350884', 'Clean Code', 'Robert C. Martin', 'Prentice Hall', 2008, 32, true, 'strucna-literatura', 'en', 'dobra', seller.id, sarajevo.id, 4.9, 42, 18, 'bestseller'],
    ['9780135957059', 'The Pragmatic Programmer', 'David Thomas & Andrew Hunt', 'Addison-Wesley', 2019, 38, true, 'strucna-literatura', 'en', 'kao-nova', seller.id, sarajevo.id, 4.8, 34, 15, 'nova-kolekcija'],
    ['9789958306464', 'Tvrđava', 'Meša Selimović', 'Connectum', 2020, 14, true, 'roman', 'bs', 'dobra', seller.id, sarajevo.id, 4.7, 29, 12, 'bestseller'],
    ['9780441172719', 'Dina', 'Frank Herbert', 'Ace', 2010, 22, false, 'naucna-fantastika', 'en', 'koristena', secondSeller.id, mostar.id, 4.9, 51, 20, 'bestseller'],
    ['9789533169798', 'Mali princ', 'Antoine de Saint-Exupéry', 'Školska knjiga', 2018, 9, true, 'djecija-knjiga', 'bs', 'kao-nova', secondSeller.id, mostar.id, 4.6, 38, 17, 'akcija'],
    ['9781401245252', 'Watchmen', 'Alan Moore', 'DC Comics', 2014, 27, true, 'strip', 'en', 'dobra', secondSeller.id, mostar.id, 4.8, 26, 9, 'nova-kolekcija'],
    ['9789958216107', 'Uvod u ekonomiju', 'Paul Samuelson', 'Mate', 2017, 20, false, 'udzbenik', 'bs', 'koristena', seller.id, sarajevo.id, 4.2, 16, 7, 'akcija'],
    ['9780062315007', 'Alhemičar', 'Paulo Coelho', 'HarperOne', 2014, 12, true, 'roman', 'en', 'dobra', secondSeller.id, mostar.id, 4.5, 33, 14, 'bestseller'],
  ];

  const books = [];
  for (const item of bookData) {
    const [isbn, title, author, publisher, publicationYear, price, allowExchange, genreSlug, languageCode, conditionSlug, ownerId, cityId, averageRating, viewCount, completedOrderCount, tagSlug] = item;
    const book = await upsertBook(isbn, {
      title, author, publisher, publicationYear, price, allowExchange, ownerId,
      genreId: genres[genreSlug].id, languageId: languages[languageCode].id,
      conditionId: conditions[conditionSlug].id, status: 'ACTIVE', averageRating,
      ratingCount: Math.max(3, Math.floor(viewCount / 4)), viewCount, completedOrderCount,
      description: `${title} is a carefully preserved book ready for a new shelf and reader.`,
    });
    await prisma.bookPickupLocation.upsert({ where: { bookId_cityId: { bookId: book.id, cityId } }, update: {}, create: { bookId: book.id, cityId } });
    await prisma.bookTag.upsert({ where: { bookId_tagId: { bookId: book.id, tagId: tags[tagSlug].id } }, update: {}, create: { bookId: book.id, tagId: tags[tagSlug].id } });
    books.push(book);
  }

  const order = await prisma.order.upsert({
    where: { orderNumber: 'BK-DEMO-001' },
    update: { status: 'COMPLETED' },
    create: { orderNumber: 'BK-DEMO-001', type: 'PURCHASE', status: 'COMPLETED', totalAmount: 32, buyerId: buyer.id, sellerId: seller.id, completedAt: new Date() },
  });
  const orderItem = await prisma.orderItem.upsert({
    where: { orderId_bookId: { orderId: order.id, bookId: books[0].id } },
    update: {}, create: { orderId: order.id, bookId: books[0].id, price: 32 },
  });
  await prisma.review.upsert({
    where: { orderItemId: orderItem.id },
    update: {},
    create: { rating: 5, comment: 'Excellent book and a very reliable seller.', buyerId: buyer.id, bookId: books[0].id, orderItemId: orderItem.id, editableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });

  await prisma.badge.upsert({ where: { name: 'Reliable seller' }, update: {}, create: { name: 'Reliable seller', description: 'Successfully completed orders and high ratings.', icon: 'shield-check' } });
  await prisma.notification.deleteMany({ where: { title: { in: ['New order', 'Welcome to Bookie'] } } });
  await prisma.notification.createMany({
    data: [{ userId: seller.id, type: 'ORDER', title: 'New order', body: 'A buyer placed a new order.' }, { userId: buyer.id, type: 'SYSTEM', title: 'Welcome to Bookie', body: 'Find your next book.' }],
  });

  console.log(`Seed complete: ${await prisma.user.count()} users, ${await prisma.book.count()} books, administrator #${admin.id}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
