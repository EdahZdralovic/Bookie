const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authenticate = require('./middleware/authenticate.middleware');
const { provideCsrf } = require('./middleware/csrf.middleware');
const authRoutes = require('./routes/auth.routes');
const bookRoutes = require('./routes/book.routes');
const profileRoutes = require('./routes/profile.routes');
const statisticsRoutes = require('./routes/statistics.routes');
const chatRoutes = require('./routes/chat.routes');
const marketplaceRoutes = require('./routes/marketplace.routes');
const exchangeRoutes = require('./routes/exchange.routes');
const offerRoutes = require('./routes/offer.routes');
const adminRoutes = require('./routes/admin.routes');
const AUTH = require('./constants/auth');
const TEXT = require('./constants/auth-text');
const EXCEPTIONS = require('./constants/exceptions');
const STRINGS = require('./constants/strings');
const routes = require('./routes');
const { notFound, errorHandler } = require('./exceptions/error.handler');

const app = express();
const frontendPath = path.resolve(__dirname, '../../frontend');

app.set('view engine', 'ejs');
app.set('views', path.join(frontendPath, 'views'));

app.use((req, res, next) => {
  const renderView = res.render.bind(res);
  res.render = (view, data = {}, callback) => {
    if (view === 'index') return renderView(view, data, callback);
    const useShell = [
      'pages/notifications',
      'pages/report',
      'pages/home',
      'pages/chat',
      'pages/chat-list',
      'pages/account',
      'pages/book-create',
      'pages/profile',
      'pages/profile-books',
      'pages/public-profile',
      'pages/error',
      'pages/statistics',
      'pages/book-detail',
      'pages/books',
      'pages/cart',
      'pages/orders',
      'pages/exchange-books',
      'pages/exchange-offers',
      'pages/exchange-book-edit',
      'pages/admin-dashboard',
      'pages/admin-catalog',
      'pages/admin-reports',
      'pages/admin-reviews',
      'pages/book-edit',
    ].includes(view);
    return renderView(view, { ...data, suppressShell: useShell }, (error, body) => {
      if (error) return callback ? callback(error) : next(error);
      return renderView('index', { ...data, body, useShell, suppressShell: useShell }, callback);
    });
  };
  next();
});

app.disable('x-powered-by');
app.locals.community = require('./constants/community');
app.locals.auth = AUTH;
app.locals.authText = TEXT;
app.locals.exceptions = EXCEPTIONS;
app.locals.strings = STRINGS;
app.locals.currentUser = null;
app.locals.csrfToken = '';
app.locals.formError = '';
app.locals.suppressShell = false;
app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 150 }));
app.use(express.json({ limit: '16kb' }));
app.get('/vendor/chart.js', (req, res) => {
  res.sendFile(path.join(path.dirname(require.resolve('chart.js')), 'chart.umd.js'));
});
app.use(express.static(path.join(frontendPath, 'public')));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
app.use(cookieParser());
app.use(authenticate);
app.use(provideCsrf);

app.use(require('./routes/community.routes'));
app.use(authRoutes);
app.use(bookRoutes);
app.use(profileRoutes);
app.use(statisticsRoutes);
app.use(chatRoutes);
app.use(marketplaceRoutes);
app.use(exchangeRoutes);
app.use(offerRoutes);
app.use(adminRoutes);
app.use('/', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
