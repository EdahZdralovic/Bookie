const prisma = require('../config/database');

async function listForUser(userId) {
  return prisma.conversation.findMany({ where: { participants: { some: { userId } } }, include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { updatedAt: 'desc' } });
}

async function findForUser(id, userId) {
  return prisma.conversation.findFirst({ where: { id, participants: { some: { userId } } }, include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } } }, messages: { include: { sender: { select: { id: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'asc' } } } });
}

async function create(userId, otherUserId, bookId) {
  return prisma.conversation.create({ data: { participants: { create: [{ userId }, { userId: otherUserId }] }, books: bookId ? { create: { bookId } } : undefined } });
}

async function addMessage(conversationId, senderId, body) { return prisma.message.create({ data: { conversationId, senderId, body } }); }

module.exports = { listForUser, findForUser, create, addMessage };
