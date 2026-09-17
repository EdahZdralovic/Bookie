const repository = require('../repositories/community.repository');
const prisma = require('../config/database');
const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');

async function report(userId, input) {
  const bookId = input.bookId ? Number(input.bookId) : null;
  const reportedUserId = input.userId ? Number(input.userId) : null;
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  const id = bookId || reportedUserId;
  if (
    Boolean(bookId) === Boolean(reportedUserId) ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > 2147483647 ||
    !reason ||
    reason.length > 2000 ||
    reportedUserId === userId
  )
    throw new AppException('BAD_REQUEST', HTTP.UNPROCESSABLE);
  const target = bookId
    ? await prisma.book.findUnique({ where: { id: bookId } })
    : await prisma.user.findUnique({ where: { id: reportedUserId } });
  if (!target) throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  return repository.createReport({ reporterId: userId, bookId, reportedUserId, reason });
}

module.exports = {
  report,
  listNotifications: repository.listNotifications,
  markRead: repository.markRead,
};
