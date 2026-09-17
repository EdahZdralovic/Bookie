const prisma = require('../config/database');

const catalogModels = Object.freeze({
  genres: 'genre',
  languages: 'language',
  cities: 'city',
  conditions: 'bookCondition',
  tags: 'tag',
});

function listUsers({ search = '', role, status } = {}) {
  return prisma.user.findMany({
    where: {
      role: role && ['BUYER', 'SELLER'].includes(role) ? role : { in: ['BUYER', 'SELLER'] },
      ...(['ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED'].includes(status) ? { status } : {}),
      ...(typeof search === 'string' && search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      blockedUntil: true,
      createdAt: true,
      _count: { select: { books: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function updateUser(id, data) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({ where: { id }, data });
    if (data.status && data.status !== 'ACTIVE')
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    return user;
  });
}
async function listCatalog(type) {
  const model = catalogModels[type];
  if (!model) return [];
  return prisma[model].findMany({ orderBy: { name: 'asc' } });
}
async function createCatalog(type, data) {
  const model = catalogModels[type];
  return prisma[model].create({ data });
}
async function updateCatalog(type, id, data) {
  const model = catalogModels[type];
  return prisma[model].update({ where: { id }, data });
}
async function deleteCatalog(type, id) {
  return prisma[catalogModels[type]].delete({ where: { id } });
}
async function listReports(status) {
  return prisma.report.findMany({
    where: ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED'].includes(status) ? { status } : {},
    include: {
      reporter: { select: { id: true, firstName: true, lastName: true, email: true } },
      reportedUser: { select: { id: true, firstName: true, lastName: true, email: true } },
      book: { select: { id: true, title: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
async function resolveReport(id, data) {
  return prisma.report.update({ where: { id }, data });
}
async function createNotification(data) {
  return prisma.notification.create({ data });
}
async function listReviews(rating) {
  return prisma.review.findMany({
    where: /^[1-5]$/.test(String(rating)) ? { rating: Number(rating) } : {},
    include: {
      orderItem: {
        include: {
          book: { select: { id: true, title: true } },
          order: {
            include: { buyer: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
async function deleteReview(id) {
  return prisma.review.delete({ where: { id } });
}

module.exports = {
  listUsers,
  updateUser,
  listCatalog,
  createCatalog,
  updateCatalog,
  deleteCatalog,
  listReports,
  resolveReport,
  createNotification,
  listReviews,
  deleteReview,
  catalogModels,
};
