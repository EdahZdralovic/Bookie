const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authenticate = require('./middleware/authenticate.middleware');
const { provideCsrf } = require('./middleware/csrf.middleware');
const authRoutes = require('./routes/auth.routes');
const AUTH = require('./constants/auth');
const TEXT = require('./constants/auth-text');
const EXCEPTIONS = require('./constants/exceptions');
const routes = require('./routes');
const { notFound, errorHandler } = require('./exceptions/error.handler');

const app = express();
const frontendPath = path.resolve(__dirname, '../../frontend');

app.set('view engine', 'ejs');
app.set('views', path.join(frontendPath, 'views'));

app.disable('x-powered-by');
app.locals.auth = AUTH;
app.locals.authText = TEXT;
app.locals.exceptions = EXCEPTIONS;
app.locals.currentUser = null;
app.locals.csrfToken = '';
app.use(express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 150 }));
app.use(express.json({ limit: '16kb' }));
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

app.use(authRoutes);
app.use('/', routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
