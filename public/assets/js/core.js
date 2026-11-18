(() => {
  'use strict';

  const TOKEN_KEY = 'godegree_token';
  const PROFILE_KEY = 'godegree_profile';

  function getSession() {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const profile = JSON.parse(sessionStorage.getItem(PROFILE_KEY) || 'null');
      return token && profile ? { token, profile } : null;
    } catch (_error) {
      return null;
    }
  }

  function setSession(token, profile) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(PROFILE_KEY);
  }

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.payload = payload;
    }
  }

  async function api(path, options = {}) {
    const { method = 'GET', body, auth = true, headers: extraHeaders = {} } = options;
    const headers = { Accept: 'application/json', ...extraHeaders };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const session = getSession();
    if (auth && session?.token) headers.Authorization = `Bearer ${session.token}`;

    let response;
    try {
      response = await fetch(path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch (_error) {
      throw new ApiError('Cannot connect to GoDegree. Make sure the server is running and try again.', 0);
    }

    const raw = await response.text();
    let payload = null;
    if (raw) {
      try { payload = JSON.parse(raw); } catch (_error) { payload = { message: raw }; }
    }

    if (!response.ok) {
      let message = payload?.error || payload?.message || `Request failed (${response.status}).`;
      // If a protected API call rejects an existing token, return the user to sign-in.
      if (response.status === 401 && auth && session?.token) {
        clearSession();
        const next = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`/login.html?expired=1&next=${next}`);
      }
      // Keep database/stack details out of the user interface.
      if (response.status >= 500) message = 'Something went wrong on the server. Please try again or check the server console.';
      throw new ApiError(message, response.status, payload);
    }
    return payload;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function setMessage(elementOrId, message = '', type = 'error') {
    const element = typeof elementOrId === 'string' ? document.getElementById(elementOrId) : elementOrId;
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('is-success', type === 'success');
    element.classList.toggle('is-info', type === 'info');
  }

  function setBusy(buttonOrId, busy, busyLabel = 'Please wait…') {
    const button = typeof buttonOrId === 'string' ? document.getElementById(buttonOrId) : buttonOrId;
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.innerHTML;
      button.disabled = true;
      button.textContent = busyLabel;
    } else {
      button.disabled = false;
      if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
      }
    }
  }

  function roleHome(role) {
    if (role === 'admin') return '/admin.html';
    if (role === 'dev') return '/developer.html';
    if (role === 'user') return '/my-semester.html';
    return '/';
  }

  function requireRole(allowedRoles) {
    const session = getSession();
    if (!session) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`/login.html?next=${next}`);
      return false;
    }
    if (!allowedRoles.includes(session.profile.role)) {
      window.location.replace(roleHome(session.profile.role));
      return false;
    }
    return true;
  }

  function logout() {
    clearSession();
    window.location.assign('/');
  }

  function navItems(session, page) {
    if (!session) {
      return [
        { label: 'My Semester', href: '/login.html', key: 'semester' },
        { label: 'Graduation Plan', href: '/login.html', key: 'plan' },
        { label: 'Dashboard', href: '/login.html', key: 'dashboard' },
        { label: 'Log In', href: '/login.html', key: 'login', cta: true },
        { label: 'Sign Up', href: '/signup.html', key: 'signup', cta: true }
      ];
    }
    if (session.profile.role === 'admin') {
      return [
        { label: 'Admin Workspace', href: '/admin.html', key: 'admin' },
        { label: 'Log Out', href: '#logout', key: 'logout', cta: true }
      ];
    }
    if (session.profile.role === 'dev') {
      return [
        { label: 'Developer Console', href: '/developer.html', key: 'developer' },
        { label: 'Log Out', href: '#logout', key: 'logout', cta: true }
      ];
    }
    return [
      { label: 'My Semester', href: '/my-semester.html', key: 'semester' },
      { label: 'Graduation Plan', href: '/graduation-plan.html', key: 'plan' },
      { label: 'Dashboard', href: '/dashboard.html', key: 'dashboard' },
      { label: 'Account', href: '/account.html', key: 'account' },
      { label: 'Log Out', href: '#logout', key: 'logout', cta: true }
    ];
  }

  function renderShell() {
    const session = getSession();
    const page = document.body.dataset.page || 'home';
    const headerHost = document.getElementById('site-header');
    if (headerHost) {
      const links = navItems(session, page).map((item) => {
        const active = item.key === page || (page === 'home' && item.key === 'home');
        const classes = [active ? 'active' : '', item.cta ? 'nav-cta' : ''].filter(Boolean).join(' ');
        return `<a class="${classes}" href="${item.href}" ${item.key === 'logout' ? 'data-logout="true"' : ''}>${item.label}</a>`;
      }).join('');
      headerHost.innerHTML = `
        <header class="site-header">
          <div class="page-width site-header__inner">
            <a class="brand" href="/" aria-label="GoDegree home">
            <span class="brand-mark">
              <img src="/assets/icon.svg" alt="">
            </span>
            <span>GoDegree</span>
            </a>
            <button class="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded="false">☰</button>
            <nav class="site-nav" aria-label="Main navigation">${links}</nav>
          </div>
        </header>`;
      const menuButton = headerHost.querySelector('.mobile-menu-button');
      const nav = headerHost.querySelector('.site-nav');
      menuButton?.addEventListener('click', () => {
        const open = nav.classList.toggle('is-open');
        menuButton.setAttribute('aria-expanded', String(open));
        menuButton.textContent = open ? '×' : '☰';
        menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      });
      headerHost.querySelectorAll('[data-logout]').forEach((link) => link.addEventListener('click', (event) => {
        event.preventDefault();
        logout();
      }));
    }

    const footerHost = document.getElementById('site-footer');
    if (footerHost) {
      footerHost.innerHTML = `
        <footer class="site-footer">
          <div class="page-width site-footer__inner">
            <div><div class="footer-brand">GoDegree</div><p>Plan your path. Track your progress. Go your goals.</p></div>
            <span class="footer-contact">Contact Info</span>
          </div>
        </footer>`;
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function termLabel(number) {
    const n = Number(number);
    return n === 3 ? 'Summer' : `Semester ${n}`;
  }

  function catalogYearFromStudentId(studentId) {
    const prefix = String(studentId || '').slice(0, 2);
    return /^\d{2}$/.test(prefix) ? 1957 + Number(prefix) : null;
  }

  function studentId() {
    const profile = getSession()?.profile;
    if (!profile?.student_id) throw new Error('Your account does not contain a student ID. Please sign in with a student account.');
    return String(profile.student_id);
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderShell();
    const requiredRole = document.body.dataset.requireRole;
    if (requiredRole) requireRole([requiredRole]);
  });

  window.GoDegree = {
    api,
    getSession,
    setSession,
    clearSession,
    logout,
    roleHome,
    requireRole,
    escapeHtml,
    setMessage,
    setBusy,
    formatDate,
    formatDateTime,
    termLabel,
    catalogYearFromStudentId,
    studentId,
    ApiError
  };
})();
