const AppException = require('../exceptions/app.exception');
const HTTP = require('../constants/http');
const prisma = require('../config/database');
const TEXT = require('../constants/community');

async function listForUser(userId) {
  return prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

async function findForUser(id, userId) {
  return prisma.conversation.findFirst({
    where: { id, participants: { some: { userId } } },
    include: {
      participants: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      messages: {
        include: { sender: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

async function create(userId, otherUserId, bookId) {
  if (
    !Number.isInteger(otherUserId) ||
    otherUserId < 1 ||
    otherUserId === userId ||
    (bookId !== null && (!Number.isInteger(bookId) || bookId < 1))
  )
    throw new AppException('BAD_REQUEST', HTTP.BAD_REQUEST);
  const recipient = await prisma.user.findFirst({ where: { id: otherUserId, status: 'ACTIVE' } });
  if (!recipient) throw new AppException('NOT_FOUND', HTTP.NOT_FOUND);
  if (bookId) {
    const book = await prisma.book.findFirst({
      where: { id: bookId, ownerId: { in: [userId, otherUserId] } },
    });
    if (!book) throw new AppException('BOOK_NOT_FOUND', HTTP.NOT_FOUND);
  }
  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId } } },
        { participants: { some: { userId: otherUserId } } },
      ],
      participants: { every: { userId: { in: [userId, otherUserId] } } },
      ...(bookId ? { books: { some: { bookId } } } : {}),
    },
  });
  if (existing) return existing;
  return prisma.conversation.create({
    data: {
      participants: { create: [{ userId }, { userId: otherUserId }] },
      books: bookId ? { create: { bookId } } : undefined,
    },
  });
}

async function addMessage(conversationId, senderId, body) {
  if (!Number.isInteger(conversationId) || conversationId < 1)
    throw new AppException('BAD_REQUEST', HTTP.BAD_REQUEST);
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: senderId } },
  });
  if (!participant) throw new AppException('CHAT_FORBIDDEN', HTTP.FORBIDDEN);
  if (typeof body !== 'string' || !body.trim() || body.length > 5000)
    throw new AppException('MESSAGE_INVALID', HTTP.UNPROCESSABLE);
  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: { conversationId, senderId, body: body.trim() },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: message.createdAt },
    });
    const recipients = await tx.conversationParticipant.findMany({
      where: { conversationId, userId: { not: senderId } },
      select: { userId: true },
    });
    await tx.notification.createMany({
      data: recipients.map(({ userId }) => ({
        userId,
        type: 'MESSAGE',
        title: TEXT.NEW_MESSAGE,
        body: TEXT.NEW_MESSAGE_BODY,
        link: `/chat?conversationId=${conversationId}`,
      })),
    });
    return message;
  });
}

async function markRead(conversationId, userId, lastReadAt) {
  return prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt },
  });
}
module.exports = { listForUser, findForUser, create, addMessage, markRead };
