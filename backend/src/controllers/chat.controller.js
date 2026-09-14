const chatRepository = require('../repositories/chat.repository');
const HTTP = require('../constants/http');

async function list(req, res, next) { try { return res.render('pages/chat-list', { title: 'Messages', conversations: await chatRepository.listForUser(req.user.id) }); } catch (error) { return next(error); } }
async function open(req, res, next) {
  try {
    let id = Number(req.query.conversationId);
    if (!id && req.query.userId) id = (await chatRepository.create(req.user.id, Number(req.query.userId), req.query.bookId ? Number(req.query.bookId) : null)).id;
    if (!id) return res.redirect(HTTP.REDIRECT, '/chat');
    const conversation = await chatRepository.findForUser(id, req.user.id);
    if (!conversation) return res.redirect(HTTP.REDIRECT, '/chat');
    return res.render('pages/chat', { title: 'Conversation', conversation });
  } catch (error) { return next(error); }
}
async function send(req, res, next) { try { const body = typeof req.body.body === 'string' ? req.body.body.trim() : ''; if (body) await chatRepository.addMessage(Number(req.params.id), req.user.id, body); return res.redirect(HTTP.REDIRECT, `/chat?conversationId=${req.params.id}`); } catch (error) { return next(error); } }
module.exports = { list, open, send };
