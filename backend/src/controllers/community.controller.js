const service = require('../services/community.service');
const TEXT = require('../constants/community');
const HTTP = require('../constants/http');
const AppException = require('../exceptions/app.exception');

async function notifications(req, res) {
  return res.render('pages/notifications', {
    title: TEXT.NOTIFICATIONS,
    notifications: await service.listNotifications(req.user.id),
  });
}
async function markRead(req, res) {
  await service.markRead(req.user.id, Number(req.params.id));
  return res.redirect(HTTP.REDIRECT, '/notifications');
}
function reportForm(req, res, error = null) {
  return res.status(error?.status || HTTP.OK).render('pages/report', {
    title: TEXT.REPORT,
    values: req.method === 'POST' ? req.body : req.query,
    formError: error?.message || '',
    sent: req.query.sent === '1',
  });
}
async function report(req, res) {
  try {
    await service.report(req.user.id, req.body);
    return res.redirect(HTTP.REDIRECT, '/report?sent=1');
  } catch (error) {
    if (!(error instanceof AppException)) throw error;
    return reportForm(req, res, error);
  }
}
module.exports = { notifications, markRead, reportForm, report };
