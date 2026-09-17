const MAIL = require('../constants/mail-strings');

function escapeHtml(value) {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character],
  );
}

function emailLayout(title, content) {
  return `<div style="background:#f5f1e8;padding:24px;font-family:Arial,sans-serif;color:#17202a;line-height:1.6"><div style="max-width:600px;margin:auto;padding:28px;background:white;border-radius:16px"><h1 style="color:#e66b42">Bookie</h1><h2>${escapeHtml(title)}</h2>${content}</div></div>`;
}

function contact(person, label) {
  return `<p><strong>${label}:</strong> ${escapeHtml(person.firstName)} ${escapeHtml(person.lastName)}<br><strong>${MAIL.EMAIL_LABEL}:</strong> ${escapeHtml(person.email)}<br><strong>${MAIL.PHONE_LABEL}:</strong> ${escapeHtml(person.phone)}</p>`;
}

async function deliver(to, subject, content) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || !to) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, html: emailLayout(subject, content) }),
  });
  if (!response.ok) throw new Error(`${MAIL.DELIVERY_FAILED}: ${response.status}`);
  return true;
}

function sendOrderNotification({ order, buyer, seller, books }) {
  const lines = books
    .map(
      (book) =>
        `<li>${escapeHtml(book.title)} — ${Number(book.price).toFixed(2)} ${MAIL.CURRENCY}</li>`,
    )
    .join('');
  return deliver(
    seller?.email,
    `${MAIL.ORDER_SUBJECT} ${order.orderNumber}`,
    `<p>${MAIL.ORDER_INTRO}</p><ul>${lines}</ul><p><strong>${MAIL.TOTAL_LABEL}:</strong> ${Number(order.totalAmount).toFixed(2)} ${MAIL.CURRENCY}</p>${contact(buyer, MAIL.BUYER_LABEL)}`,
  );
}

function sendVerificationEmail(email, code) {
  return deliver(
    email,
    MAIL.VERIFICATION_SUBJECT,
    `<p>${MAIL.VERIFICATION_INTRO}</p><p style="font-size:32px;font-weight:bold;letter-spacing:8px">${escapeHtml(code)}</p><p>${MAIL.VERIFICATION_EXPIRES}</p>`,
  );
}

function exchangeBooks(order) {
  const requested = order.items.map((item) => `<li>${escapeHtml(item.bookTitle)}</li>`).join('');
  const offered = order.exchangeOffer.offeredBooks
    .map((item) => `<li>${escapeHtml(item.book.title)}</li>`)
    .join('');
  return `<h3>${MAIL.OFFER_BOOK_LABEL}</h3><ul>${requested}</ul><h3>${MAIL.OFFERED_BOOKS_LABEL}</h3><ul>${offered}</ul><p>${MAIL.ORDER_LABEL}: ${escapeHtml(order.orderNumber)}</p>`;
}

function sendExchangeOfferStatusEmail({ order, buyer, seller, accepted }) {
  const subject = accepted ? MAIL.OFFER_ACCEPTED_SUBJECT : MAIL.OFFER_REJECTED_SUBJECT;
  const intro = accepted ? MAIL.OFFER_ACCEPTED_INTRO : MAIL.OFFER_REJECTED_INTRO;
  return deliver(
    buyer?.email,
    subject,
    `<p>${intro}</p>${exchangeBooks(order)}${contact(seller, MAIL.SELLER_LABEL)}`,
  );
}

function sendExchangeOfferEmail(order) {
  return deliver(
    order.seller?.email,
    MAIL.OFFER_SUBJECT,
    `<p>${MAIL.OFFER_INTRO}</p>${exchangeBooks(order)}${contact(order.buyer, MAIL.BUYER_LABEL)}`,
  );
}

module.exports = {
  sendOrderNotification,
  sendVerificationEmail,
  sendExchangeOfferStatusEmail,
  sendExchangeOfferEmail,
};
