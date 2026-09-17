const form = document.querySelector('[data-auth-form]');

if (form) {
  const messages = JSON.parse(form.dataset.messages);
  const ui = JSON.parse(form.dataset.ui);
  const policy = JSON.parse(form.dataset.policy);
  const registration = form.dataset.page === 'register';
  const fields = registration
    ? [
        'firstName',
        'lastName',
        'phone',
        'email',
        'password',
        'repeatPassword',
        'role',
        'cityId',
        'genreIds',
        'languageIds',
      ]
    : ['email', 'password'];
  const controls = (name) => [...form.querySelectorAll(`[name="${name}"]`)];
  const value = (name) => controls(name)[0]?.value || '';
  const selected = (name) => controls(name).some((input) => input.checked);
  const alert = form.querySelector('[data-form-alert]');
  const submit = form.querySelector('[type="submit"]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const originalLabel = submitLabel.textContent;
  const touched = new Set();
  form.noValidate = true;

  function validation(name) {
    const raw = value(name);
    if (name === 'role') return selected(name) ? '' : messages.INVALID_ROLE;
    if (
      ['genreIds', 'languageIds'].includes(name) &&
      form.querySelector('[name="role"]:checked')?.value === 'SELLER'
    )
      return '';
    if (name === 'phone')
      return /^\+?[0-9 ()-]{7,20}$/.test(raw.trim()) ? '' : messages.PHONE_INVALID;
    if (name === 'genreIds') return selected(name) ? '' : messages.GENRES_REQUIRED;
    if (name === 'languageIds') return selected(name) ? '' : messages.LANGUAGES_REQUIRED;
    if (name === 'cityId') return raw ? '' : messages.INVALID_CITY;
    if (!raw || (!['password', 'repeatPassword'].includes(name) && !raw.trim()))
      return messages.REQUIRED_FIELD;
    if (['firstName', 'lastName'].includes(name)) {
      if (raw.trim().length > controls(name)[0].maxLength) return messages.NAME_TOO_LONG;
      if (!/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(raw.trim())) return messages.INVALID_NAME;
    }
    if (name === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim()))
      return messages.INVALID_EMAIL;
    if (name === 'password') {
      if (new TextEncoder().encode(raw).length > policy.MAX_BYTES)
        return messages.PASSWORD_TOO_LONG;
      if (
        registration &&
        (raw.length < policy.MIN_LENGTH || !/\p{Lu}/u.test(raw) || !/[0-9]/.test(raw))
      )
        return messages.WEAK_PASSWORD;
    }
    if (name === 'repeatPassword' && raw !== value('password')) return messages.PASSWORD_MISMATCH;
    return '';
  }

  function showError(name) {
    const message = validation(name);
    form.querySelector(`[data-error-for="${name}"]`).textContent = message;
    for (const control of controls(name))
      control.setAttribute('aria-invalid', String(Boolean(message)));
    return message;
  }

  function updatePasswordHints() {
    if (!registration) return;
    const password = value('password');
    const rules = {
      length: password.length >= policy.MIN_LENGTH,
      uppercase: /\p{Lu}/u.test(password),
      number: /[0-9]/.test(password),
    };
    for (const [name, met] of Object.entries(rules)) {
      const item = form.querySelector(`[data-rule="${name}"]`);
      item.classList.toggle('is-met', met);
      item.querySelector('span').textContent = met ? '✓' : '○';
    }
    const matches = value('repeatPassword') && password === value('repeatPassword');
    const matchHint = form.querySelector('[data-password-match]');
    matchHint.classList.toggle('is-met', Boolean(matches));
    matchHint.textContent = matches ? ui.PASSWORD_MATCH : ui.PASSWORD_REPEAT_HINT;
    if (touched.has('repeatPassword')) showError('repeatPassword');
  }

  for (const name of fields) {
    for (const control of controls(name)) {
      control.addEventListener('blur', () => {
        touched.add(name);
        showError(name);
      });
      control.addEventListener('input', () => {
        if (touched.has(name)) showError(name);
        if (name === 'password' || name === 'repeatPassword') updatePasswordHints();
      });
      control.addEventListener('change', () => {
        touched.add(name);
        showError(name);
      });
    }
  }

  for (const button of form.querySelectorAll('[data-toggle]')) {
    button.hidden = false;
    button.addEventListener('click', () => {
      const input = controls(button.dataset.toggle)[0];
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? ui.HIDE_PASSWORD : ui.SHOW_PASSWORD);
    });
  }

  form.addEventListener('submit', (event) => {
    let firstInvalid;
    for (const name of fields) {
      touched.add(name);
      if (showError(name) && !firstInvalid) firstInvalid = controls(name)[0];
    }
    if (firstInvalid) {
      event.preventDefault();
      alert.hidden = false;
      form.querySelector('[data-form-message]').textContent = messages.VALIDATION_FAILED;
      firstInvalid.focus();
      return;
    }
    submit.disabled = true;
    submitLabel.textContent = ui.SUBMITTING;
  });

  window.addEventListener('pageshow', () => {
    submit.disabled = false;
    submitLabel.textContent = originalLabel;
    updatePasswordHints();
  });
}
