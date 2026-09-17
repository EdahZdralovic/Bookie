const prisma = require('../config/database');

const listNotifications = (userId) =>
  prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
const markRead = (userId, id) =>
  prisma.notification.updateMany({ where: { id, userId }, data: { isRead: true } });
const createReport = (data) => prisma.report.create({ data });

module.exports = { listNotifications, markRead, createReport };
