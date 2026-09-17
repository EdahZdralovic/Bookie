const MAIL = require('../constants/mail-strings');

async function sendOrderNotification({ order, buyer, seller, books }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !seller?.email) return false;
  const lines = books
    .map(
      (book) =>
        `<li>${escapeHtml(book.title)} — ${Number(book.price).toFixed(2)} ${MAIL.CURRENCY}</li>`,
    )
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a"><h2>${MAIL.ORDER_SUBJECT}</h2><p>${MAIL.ORDER_INTRO}</p><ul>${lines}</ul><p><strong>${MAIL.ORDER_LABEL}:</strong> ${order.orderNumber}<br><strong>${MAIL.TOTAL_LABEL}:</strong> ${Number(order.totalAmount).toFixed(2)} ${MAIL.CURRENCY}</p><p><strong>${MAIL.BUYER_LABEL}:</strong> ${escapeHtml(`${buyer.firstName} ${buyer.lastName}`)}<br><strong>${MAIL.EMAIL_LABEL}:</strong> ${escapeHtml(buyer.email)}${buyer.phone ? `<br><strong>${MAIL.PHONE_LABEL}:</strong> ${escapeHtml(buyer.phone)}` : ''}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [seller.email],
      subject: `${MAIL.ORDER_SUBJECT} ${order.orderNumber}`,
      html,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Resend request failed with status ${response.status}: ${await response.text()}`,
    );
  return true;
}

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

module.exports = { sendOrderNotification };
async function sendVerificationEmail(email, code) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [email],
      subject: MAIL.VERIFICATION_SUBJECT,
      html: `<p>${MAIL.VERIFICATION_INTRO}</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${code}</p><p>${MAIL.VERIFICATION_EXPIRES}</p>`,
    }),
  });
  if (!response.ok)
    throw new Error(
      `Resend request failed with status ${response.status}: ${await response.text()}`,
    );
  return true;
}
async function sendExchangeOfferStatusEmail({ order, buyer, seller, accepted }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !buyer?.email) return false;
  const subject = accepted ? MAIL.OFFER_ACCEPTED_SUBJECT : MAIL.OFFER_REJECTED_SUBJECT;
  const intro = accepted ? MAIL.OFFER_ACCEPTED_INTRO : MAIL.OFFER_REJECTED_INTRO;
  const requested =
    order.items?.map((item) => `<li>${escapeHtml(item.bookTitle)}</li>`).join('') || '';
  const offered =
    order.exchangeOffer?.offeredBooks
      ?.map((item) => `<li>${escapeHtml(item.book?.title || 'Book')}</li>`)
      .join('') || '';
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17202a"><h2>${subject}</h2><p>${intro}</p><p><strong>${MAIL.OFFER_BOOK_LABEL}:</strong></p><ul>${requested}</ul><p><strong>${MAIL.OFFERED_BOOKS_LABEL}:</strong></p><ul>${offered}</ul><p><strong>${MAIL.SELLER_LABEL}:</strong> ${escapeHtml(`${seller.firstName} ${seller.lastName}`)}<br><strong>${MAIL.EMAIL_LABEL}:</strong> ${escapeHtml(seller.email)}${seller.phone ? `<br><strong>${MAIL.PHONE_LABEL}:</strong> ${escapeHtml(seller.phone)}` : ''}</p><p><strong>${MAIL.ORDER_LABEL}:</strong> ${escapeHtml(order.orderNumber)}</p></div>`;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [buyer.email], subject, html }),
  });
  if (!response.ok)
    throw new Error(
      `Resend request failed with status ${response.status}: ${await response.text()}`,
    );
  return true;
}
module.exports = { sendOrderNotification, sendVerificationEmail, sendExchangeOfferStatusEmail };
