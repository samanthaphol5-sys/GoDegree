(() => {
  'use strict';

  const GD = window.GoDegree;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function friendlyError(error) {
    if (error instanceof GD.ApiError) {
      if (error.status === 0) return error.message;
      if (error.status === 401) return 'Your session is missing or has expired. Please log in again.';
      if (error.status === 403) return 'You do not have permission to perform this action.';
      if (error.status === 404) return error.message || 'The requested record could not be found.';
      if (error.status === 409) return error.message || 'This change conflicts with existing data.';
      if (error.status === 400) return error.message || 'Please check the information and try again.';
      return error.message;
    }
    return error?.message || 'Something went wrong. Please try again.';
  }

  function normalizeCourse(row) {
    return {
      code: row.course_code ?? row.Course_Code ?? '',
      name: row.course_name ?? row.Course_Name ?? '',
      credit: Number(row.credit ?? row.Credit ?? 0),
      type: row.course_type ?? row.Course_Type ?? 'Core',
      schedule: row.schedule ?? row.Schedule ?? '',
      grade: row.grade_earned ?? row.Grade_Earned ?? null
    };
  }

  function gradeLabel(grade) {
    return grade ? GD.escapeHtml(grade) : 'Not graded';
  }

  function setStatus(element, text, kind = 'neutral') {
    if (!element) return;
    element.textContent = text;
    element.className = `status-badge status-badge--${kind}`;
  }

  function setProgress(element, value) {
    if (!element) return;
    const n = Math.max(0, Math.min(100, Number(value) || 0));
    element.style.width = `${n}%`;
  }

  function initPasswordToggles() {
    $$('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const reveal = input.type === 'password';
        input.type = reveal ? 'text' : 'password';
        button.textContent = reveal ? 'Hide' : 'Show';
        button.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      });
    });
  }

  function setupHome() {
    const session = GD.getSession();
    if (!session) return;
    const actions = $$('.home-hero .button');
    if (actions[0]) {
      actions[0].href = GD.roleHome(session.profile.role);
      actions[0].textContent = 'Open your workspace →';
    }
    if (actions[1]) actions[1].hidden = true;
  }

  function setupLogin() {
    initPasswordToggles();
    const form = $('#login-form');
    if (!form) return;
    const params = new URLSearchParams(window.location.search);
    const createdUsername = params.get('username');
    if (createdUsername) $('#login-username').value = createdUsername;
    if (params.get('created') === '1') GD.setMessage('login-message', 'Your account was created. Log in to continue.', 'success');
    if (params.get('expired') === '1') GD.setMessage('login-message', 'Your session expired. Please log in again.', 'info');

    const demo = {
      user: { username: 'demo_user', password: 'DemoUser@2026' },
      admin: { username: 'demo_admin', password: 'DemoAdmin@2026' },
      dev: { username: 'demo_dev', password: 'DemoDev@2026' }
    };
    $$('[data-demo-login]').forEach((button) => button.addEventListener('click', () => {
      const credentials = demo[button.dataset.demoLogin];
      if (!credentials) return;
      $('#login-username').value = credentials.username;
      $('#login-password').value = credentials.password;
      GD.setMessage('login-message', `${button.querySelector('strong')?.textContent || 'Demo'} credentials filled in. Select Log in to continue.`, 'info');
    }));

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      GD.setMessage('login-message', '');
      const username = $('#login-username').value.trim();
      const password = $('#login-password').value;
      if (!username || !password) {
        GD.setMessage('login-message', 'Please enter both your username and password.');
        return;
      }
      GD.setBusy('login-submit', true, 'Logging in…');
      try {
        const result = await GD.api('/auth/login', {
          method: 'POST', auth: false,
          body: { username, password }
        });
        GD.setSession(result.token, result.profile);
        const requested = params.get('next');
        const allowedNext = requested && requested.startsWith('/') && !requested.startsWith('//') ? requested : null;
        const rolePage = GD.roleHome(result.profile.role);
        window.location.assign(allowedNext || rolePage);
      } catch (error) {
        const message = error.status === 401 ? ('Incorrect username or password.') : friendlyError(error);
        GD.setMessage('login-message', message);
      } finally {
        GD.setBusy('login-submit', false);
      }
    });
  }

  function setupSignup() {
    initPasswordToggles();
    const form = $('#signup-form');
    if (!form) return;
    const studentId = $('#signup-student-id');
    studentId.addEventListener('input', () => {
      studentId.value = studentId.value.replace(/\D/g, '').slice(0, 10);
      const year = GD.catalogYearFromStudentId(studentId.value);
      $('#catalog-hint').textContent = year
        ? `Your catalog year will be ${year}. Check that this year exists in the database.`
        : 'Enter your student ID to identify your catalog year.';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      GD.setMessage('signup-message', '');
      const username = $('#signup-username').value.trim();
      const id = studentId.value.trim();
      const major = $('#signup-major').value.trim();
      const currentSemester = $('input[name="current_semester"]:checked')?.value;
      const password = $('#signup-password').value;
      const confirmPassword = $('#signup-confirm').value;

      if (!username || !id || !major || !currentSemester || !password || !confirmPassword) {
        GD.setMessage('signup-message', 'Please complete every required field.');
        return;
      }
      if (!/^\d{10}$/.test(id)) {
        GD.setMessage('signup-message', 'Student ID must contain exactly 10 digits.');
        studentId.focus();
        return;
      }
      if (password !== confirmPassword) {
        GD.setMessage('signup-message', 'The passwords do not match. Please try again.');
        $('#signup-confirm').focus();
        return;
      }
      if (username.length > 25) {
        GD.setMessage('signup-message', 'Username must be 25 characters or fewer.');
        return;
      }

      GD.setBusy('signup-submit', true, 'Creating account…');
      try {
        await GD.api('/auth/signup', {
          method: 'POST', auth: false,
          body: { username, student_id: id, major, current_semester: currentSemester, password }
        });
        window.location.assign(`/login.html?created=1&username=${encodeURIComponent(username)}`);
      } catch (error) {
        let message = friendlyError(error);
        if (error.status === 409) message = 'This username or student ID is already registered.';
        if (error.status === 400 && /Catalog year/.test(error.message)) message = 'The catalog year calculated from this student ID is not available in the database. Please check the Student ID or Academic_Catalog data.';
        if (error.status === 400 && /10 digits/.test(error.message)) message = 'Student ID must contain exactly 10 digits.';
        GD.setMessage('signup-message', message);
      } finally {
        GD.setBusy('signup-submit', false);
      }
    });
  }

  async function loadProfile() {
    const id = GD.studentId();
    return GD.api(`/student/${encodeURIComponent(id)}`);
  }

  async function loadCatalog() {
    const rows = await GD.api('/course');
    return (Array.isArray(rows) ? rows : []).map(normalizeCourse).sort((a, b) => a.code.localeCompare(b.code));
  }


  function populateCourseSelect(select, catalog, selectedValue = '', searchInput = null, countElement = null) {
    if (!select) return;

    const current = selectedValue || select.value;

    const allOptions = [
      { value: '', label: 'Select a course from the catalogue' },
      ...catalog.map((course) => ({
        value: course.code,
        label: `${course.code} · ${course.name} (${course.credit} cr)`
      }))
    ];

    function renderOptions() {
      const query = (searchInput?.value || '').trim().toLowerCase();
      const selectedBeforeRender = select.value || current;

      const matchingOptions = allOptions.filter((option, index) =>
        index === 0 || `${option.value} ${option.label}`.toLowerCase().includes(query)
      );

      select.replaceChildren();

      matchingOptions.forEach((item) => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
      });

      if (query && matchingOptions.length === 1) {
        const noResults = document.createElement('option');
        noResults.value = '';
        noResults.textContent = 'No matching courses found';
        noResults.disabled = true;
        select.appendChild(noResults);
      }

      if (selectedBeforeRender && matchingOptions.some(item => item.value === selectedBeforeRender)) {
        select.value = selectedBeforeRender;
      } else {
        select.value = '';
      }

      // Show matching results while searching
      select.size = query
        ? Math.min(Math.max(matchingOptions.length - 1, 1), 6)
        : 1;

      if (countElement) {
        const matchCount = matchingOptions.length - 1;
        countElement.textContent = query
          ? `${matchCount} matching ${matchCount === 1 ? 'course' : 'courses'}`
          : `${catalog.length} courses available`;
      }
    }

    if (searchInput) {
      searchInput.addEventListener('input', renderOptions);

      select.addEventListener('change', () => {
        const selectedOption = select.options[select.selectedIndex];

        if (!selectedOption || !selectedOption.value) return;

        // Put selected course name in search bar
        searchInput.value = selectedOption.textContent;

        // Collapse dropdown after selection
        select.size = 1;
      });
    }

    renderOptions();
  }

  function currentAcademicYear(profile) {
    const catalogYear = Number(profile.catalog_year) || GD.catalogYearFromStudentId(profile.student_id) || new Date().getFullYear();
    const thisYear = new Date().getFullYear();
    return Math.max(catalogYear, Math.min(thisYear, catalogYear + 3));
  }

  function fillYearOptions(select, catalogYear, selectedYear) {
    if (!select) return;
    select.innerHTML = '';
    for (let i = 0; i < 4; i += 1) {
      const year = Number(catalogYear) + i;
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `Year ${i + 1} · ${year}`;
      select.append(option);
    }
    select.value = String(selectedYear || catalogYear);
  }

  function renderCourseCard(course, catalogCourse) {
    const type = catalogCourse?.type === 'Elective' ? 'Elective course' : 'Core course';
    const schedule = catalogCourse?.schedule ? `<span>${GD.escapeHtml(catalogCourse.schedule)}</span>` : '';
    return `
      <article class="course-card">
        <div class="course-card__main">
          <div class="course-card__top">
            <div class="course-card__name"><strong>${GD.escapeHtml(course.code)} · ${GD.escapeHtml(course.name)}</strong><span>${type}</span></div>
            <div class="course-card__grade"><span>Grade earned</span><b class="grade-chip">${gradeLabel(course.grade)}</b></div>
          </div>
          <div class="course-card__bottom"><span>${course.credit} ${course.credit === 1 ? 'Credit' : 'Credits'}</span>${schedule}</div>
        </div>
        <div class="course-card__actions"><button class="icon-button icon-button--danger" type="button" data-remove-course="${GD.escapeHtml(course.code)}" aria-label="Remove ${GD.escapeHtml(course.code)} from plan">×</button></div>
      </article>`;
  }

  function setupSemester() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'user') return;
    const id = String(session.profile.student_id);
    let profile = null;
    let catalog = [];
    let selectedYear = null;
    let selectedSemester = null;

    async function loadSemester() {
      const year = Number($('#semester-year').value);
      const sem = Number($('#semester-number').value);
      selectedYear = year;
      selectedSemester = sem;
      GD.setMessage('semester-message', '');
      $('#semester-course-list').innerHTML = '<div class="loading-state">Loading your courses…</div>';
      try {
        const data = await GD.api(`/plan/student/${encodeURIComponent(id)}/semester/${year}/${sem}`);
        const courses = (data.courses || []).map(normalizeCourse);
        const creditTotal = courses.reduce((total, course) => total + course.credit, 0);
        $('#semester-heading').textContent = `Year ${Math.max(1, year - Number(profile.catalog_year) + 1)} | ${GD.termLabel(sem)}`;
        $('#semester-subheading').textContent = `Academic year ${year} · ${courses.length} ${courses.length === 1 ? 'course' : 'courses'} in this semester`;
        $('#semester-course-count').textContent = String(courses.length);
        $('#semester-credit-count').textContent = String(creditTotal);
        $('#semester-cgpa').textContent = Number(profile.cgpa || 0).toFixed(2);
        $('#semester-target-gpa').textContent = data.target_honor && data.target_honor !== 'None' ? Number(data.min_target_semester_gpa || 0).toFixed(2) : '—';
        $('#course-list-caption').textContent = `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} · ${creditTotal} credits`;

        const maxEligible = data.max_eligible_honor || 'None';
        const eligibilityBadge = $('#eligibility-badge');
        const targetSelect = $('#target-honor');
        if (maxEligible === 'First Class Honors') {
          setStatus(eligibilityBadge, 'First Class eligible', 'success');
          $('#eligibility-copy').textContent = 'Your current record meets the First Class Honors eligibility check.';
        } else if (maxEligible === 'Second Class Honors') {
          setStatus(eligibilityBadge, 'Second Class eligible', 'warning');
          $('#eligibility-copy').textContent = `Your current record meets the Second Class Honors check. First Class 
          Honors needs CGPA ≥ 3.50 (yours: ${Number(profile.cgpa || 0).toFixed(2)}) with no grade below C, no F, and no retaken 
          course.`;
        } else {
          setStatus(eligibilityBadge, 'Not eligible yet', 'danger');
          $('#eligibility-copy').textContent = 'Your current record does not meet the honors eligibility check at this time.';
        }
        const target = data.target_honor && data.target_honor !== 'None' ? data.target_honor : '';
        const options = ['<option value="">Choose a target</option>'];
        if (maxEligible === 'First Class Honors') {
          options.push('<option value="First Class Honors">First Class Honors</option>');
          options.push('<option value="Second Class Honors">Second Class Honors</option>');
        } else if (maxEligible === 'Second Class Honors') {
          options.push('<option value="Second Class Honors">Second Class Honors</option>');
        }
        targetSelect.innerHTML = options.join('');
        targetSelect.value = target;
        targetSelect.disabled = maxEligible === 'None';

        const catalogueMap = new Map(catalog.map((course) => [course.code, course]));
        if (!courses.length) {
          $('#semester-course-list').innerHTML = `<div class="empty-state"><strong>No courses in this semester yet.</strong>Add courses from the catalogue below to start building your plan.</div>`;
        } else {
          $('#semester-course-list').innerHTML = courses.map((course) => renderCourseCard(course, catalogueMap.get(course.code))).join('');
        }
      } catch (error) {
        $('#semester-course-list').innerHTML = `<div class="empty-state"><strong>Unable to load this semester.</strong>${GD.escapeHtml(friendlyError(error))}</div>`;
        GD.setMessage('semester-message', friendlyError(error));
      }
    }

    async function initialize() {
      try {
        [profile, catalog] = await Promise.all([loadProfile(), loadCatalog()]);
        const defaultYear = currentAcademicYear(profile);
        fillYearOptions($('#semester-year'), profile.catalog_year, defaultYear);
        $('#semester-number').value = String(profile.current_semester || 1);
        populateCourseSelect($('#semester-course-select'), catalog, '', $('#semester-course-search'), $('#semester-course-search-count'));
        await loadSemester();
      } catch (error) {
        GD.setMessage('semester-message', friendlyError(error));
        $('#semester-course-list').innerHTML = `<div class="empty-state"><strong>Unable to load your semester.</strong>${GD.escapeHtml(friendlyError(error))}</div>`;
      }
    }

    $('#load-semester').addEventListener('click', loadSemester);
    $('#target-honor').addEventListener('change', async (event) => {
      const honor = event.target.value;
      if (!honor) return;
      event.target.disabled = true;
      GD.setMessage('honor-message', '');
      try {
        await GD.api(`/student/${encodeURIComponent(id)}/target_honor`, { method: 'PUT', body: { honor_type: honor } });
        GD.setMessage('honor-message', 'Your target honors has been updated.', 'success');
        await loadSemester();
      } catch (error) {
        GD.setMessage('honor-message', friendlyError(error));
        event.target.disabled = false;
      }
    });

    $('#semester-add-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const courseCode = $('#semester-course-select').value;
      if (!courseCode) return GD.setMessage('semester-message', 'Please select a course.');
      GD.setBusy('semester-add-submit', true, 'Adding…');
      try {
        await GD.api(`/plan/student/${encodeURIComponent(id)}/enrollment`, {
          method: 'POST',
          body: {
            course_code: courseCode,
            academic_year: Number($('#semester-year').value),
            semester_no: Number($('#semester-number').value),
            grade_earned: $('#semester-course-grade').value || null
          }
        });
        GD.setMessage('semester-message', 'Course plan updated successfully.', 'success');
        $('#semester-course-search').value = '';
        $('#semester-course-search').dispatchEvent(new Event('input'));
        $('#semester-course-select').value = '';
        $('#semester-course-grade').value = '';
        profile = await loadProfile();
        await loadSemester();
      } catch (error) {
        let message = friendlyError(error);
        if (error.status >= 500) message += ' Check that the selected semester exists in the database.';
        GD.setMessage('semester-message', message);
      } finally {
        GD.setBusy('semester-add-submit', false);
      }
    });

    $('#semester-course-list').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-remove-course]');
      if (!button) return;
      const code = button.dataset.removeCourse;
      const confirmed = window.confirm(`Remove ${code} from ${GD.termLabel(selectedSemester)} ${selectedYear}?`);
      if (!confirmed) return;
      button.disabled = true;
      try {
        await GD.api(`/plan/student/${encodeURIComponent(id)}/enrollment/${encodeURIComponent(code)}?academic_year=
        ${selectedYear}&semester_no=${selectedSemester}`, { method: 'DELETE' });
        GD.setMessage('semester-message', `${code} was removed from this semester.`, 'success');
        profile = await loadProfile();
        await loadSemester();
      } catch (error) {
        GD.setMessage('semester-message', friendlyError(error));
        button.disabled = false;
      }
    });

    initialize();
  }

  function setupGraduationPlan() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'user') return;
    const id = String(session.profile.student_id);
    let profile = null;
    let catalog = [];
    let planData = null;

    function yearStatus(semesters, year, activeYear) {
      const courses = semesters.flatMap((term) => term.courses || []);
      if (!courses.length) return { label: 'Future Plan', kind: 'neutral' };
      const allGraded = courses.every((course) => course.grade_earned && course.grade_earned !== 'W');
      if (allGraded) return { label: 'Completed', kind: 'success' };
      if (year <= activeYear) return { label: 'In progress', kind: 'progress' };
      return { label: 'Planned', kind: 'neutral' };
    }

    function renderPlan() {
      const terms = planData.plan || [];
      const catalogYear = Number(profile.catalog_year);
      const activeYear = currentAcademicYear(profile);
      $('#plan-title').textContent = `${profile.major || 'Student'} · Catalog ${catalogYear}`;
      $('#plan-total-credits').innerHTML = `${Number(planData.overall_credits || 0)} <small>/ 136</small>`;
      $('#plan-overall-cgpa').textContent = Number(planData.overall_cgpa || 0).toFixed(2);
      const yearMarkup = [];
      for (let index = 0; index < 4; index += 1) {
        const year = catalogYear + index;
        const yearTerms = terms.filter((term) => Number(term.academic_year) === year).sort((a, b) => Number(a.semester_no) - Number(b.semester_no));
        const status = yearStatus(yearTerms, year, activeYear);
        const courseCount = yearTerms.reduce((sum, term) => sum + (Number(term.total_courses) || 0), 0);
        const creditCount = yearTerms.reduce((sum, term) => sum + (Number(term.total_credits) || 0), 0);
        const termMarkup = yearTerms.length ? yearTerms.map((term) => {
          const courses = term.courses || [];
          const rows = courses.length ? courses.map((raw) => {
            const course = normalizeCourse(raw);
            const gradeOptions = ['', 'A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'ACC', 'W'].map((grade) =>
              `<option value="${grade}" ${String(course.grade || '') === grade ? 'selected' : ''}>${grade || 'Not graded'}</option>`
            ).join('');
            return `<tr><td>${GD.escapeHtml(course.code)}</td><td>${GD.escapeHtml(course.name)}</td><td>${course.credit} cr</td><td><select class="grade-edit-select" aria-label="Grade for ${GD.escapeHtml(course.code)}" data-grade-value>${gradeOptions}</select></td><td><div class="plan-actions"><button class="table-action table-action--view" type="button" data-save-grade="${GD.escapeHtml(course.code)}" data-year="${year}" data-semester="${Number(term.semester_no)}">Save grade</button><button class="table-action" type="button" data-plan-remove="${GD.escapeHtml(course.code)}" data-year="${year}" data-semester="${Number(term.semester_no)}">Remove</button></div></td></tr>`;
          }).join('') : '<tr><td colspan="5" class="plan-course-empty">No courses in this semester.</td></tr>';
          return `<div class="year-semester"><div class="year-semester__heading"><strong>${GD.escapeHtml(GD.termLabel(term.semester_no))}</strong><span>${Number(term.total_courses || 0)} courses · ${Number(term.total_credits || 0)} credits · GPA ${Number(term.gpa || 0).toFixed(2)}</span></div><div class="table-wrap"><table class="plan-course-table"><thead><tr><th>Course code</th><th>Course name</th><th>Credits</th><th>Grade earned</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        }).join('') : '<div class="plan-course-empty">No courses planned for this year yet. Use the form above to add courses.</div>';
        yearMarkup.push(`
          <article class="year-item ${index === 0 ? 'is-open' : ''}">
            <button class="year-toggle" type="button" aria-expanded="${index === 0 ? 'true' : 'false'}">
              <span class="year-number">0${index + 1}</span>
              <span class="year-label"><strong>Year ${index + 1}</strong><small>${courseCount} courses · ${creditCount} credits</small></span>
              <span class="status-badge status-badge--${status.kind} year-status">${status.label}</span>
              <span class="year-chevron" aria-hidden="true">⌄</span>
            </button>
            <div class="year-body">${termMarkup}</div>
          </article>`);
      }
      $('#graduation-years').innerHTML = yearMarkup.join('');
    }

    async function initialize() {
      try {
        [profile, planData, catalog] = await Promise.all([loadProfile(), GD.api(`/plan/student/${encodeURIComponent(id)}/all`), loadCatalog()]);
        const catalogYear = Number(profile.catalog_year);
        fillYearOptions($('#plan-year'), catalogYear, currentAcademicYear(profile));
        populateCourseSelect($('#plan-course-select'), catalog, '', $('#plan-course-search'), $('#plan-course-search-count'));
        renderPlan();
      } catch (error) {
        $('#graduation-years').innerHTML = `<div class="empty-state"><strong>Unable to load your graduation plan.</strong>${GD.escapeHtml(friendlyError(error))}</div>`;
        GD.setMessage('plan-message', friendlyError(error));
      }
    }

    $('#plan-add-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = $('#plan-course-select').value;
      if (!code) return GD.setMessage('plan-message', 'Please select a course from the catalogue.');
      GD.setBusy('plan-add-submit', true, 'Adding…');
      try {
        await GD.api(`/plan/student/${encodeURIComponent(id)}/enrollment`, {
          method: 'POST',
          body: {
            course_code: code,
            academic_year: Number($('#plan-year').value),
            semester_no: Number($('#plan-semester').value),
            grade_earned: $('#plan-grade').value || null
          }
        });
        GD.setMessage('plan-message', 'Course plan updated successfully.', 'success');
        $('#plan-course-search').value = '';
        $('#plan-course-search').dispatchEvent(new Event('input'));
        $('#plan-course-select').value = '';
        $('#plan-grade').value = '';
        planData = await GD.api(`/plan/student/${encodeURIComponent(id)}/all`);
        profile = await loadProfile();
        renderPlan();
      } catch (error) {
        let message = friendlyError(error);
        if (error.status >= 500) message += ' Confirm that this academic year and semester are present in the database Semester table.';
        GD.setMessage('plan-message', message);
      } finally {
        GD.setBusy('plan-add-submit', false);
      }
    });

    $('#graduation-years').addEventListener('click', async (event) => {
      const toggle = event.target.closest('.year-toggle');
      if (toggle) {
        const item = toggle.closest('.year-item');
        item.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(item.classList.contains('is-open')));
        return;
      }
      const saveGrade = event.target.closest('[data-save-grade]');
      if (saveGrade) {
        const row = saveGrade.closest('tr');
        const grade = row?.querySelector('[data-grade-value]')?.value || null;
        const code = saveGrade.dataset.saveGrade;
        const year = Number(saveGrade.dataset.year);
        const semester = Number(saveGrade.dataset.semester);
        saveGrade.disabled = true;
        try {
          await GD.api(`/plan/student/${encodeURIComponent(id)}/enrollment`, {
            method: 'POST',
            body: { course_code: code, academic_year: year, semester_no: semester, grade_earned: grade }
          });
          GD.setMessage('plan-message', `Grade for ${code} was updated.`, 'success');
          planData = await GD.api(`/plan/student/${encodeURIComponent(id)}/all`);
          profile = await loadProfile();
          renderPlan();
        } catch (error) {
          GD.setMessage('plan-message', friendlyError(error));
          saveGrade.disabled = false;
        }
        return;
      }
      const remove = event.target.closest('[data-plan-remove]');
      if (!remove) return;
      const code = remove.dataset.planRemove;
      const removeYear = Number(remove.dataset.year);
      const removeSemester = Number(remove.dataset.semester);
      if (!window.confirm(`Remove ${code} from ${GD.termLabel(removeSemester)} ${removeYear}?`)) return;
      remove.disabled = true;
      try {
        await GD.api(`/plan/student/${encodeURIComponent(id)}/enrollment/${encodeURIComponent(code)}?academic_year=${removeYear}&semester_no=${removeSemester}`, { method: 'DELETE' });
        GD.setMessage('plan-message', `${code} was removed from this semester.`, 'success');
        planData = await GD.api(`/plan/student/${encodeURIComponent(id)}/all`);
        profile = await loadProfile();
        renderPlan();
      } catch (error) {
        GD.setMessage('plan-message', friendlyError(error));
        remove.disabled = false;
      }
    });

    initialize();
  }

  const ENGLISH_THRESHOLDS = {
    IELTS: 6,
    'TU-GET_PBT': 500,
    'TU-GET_CBT': 73,
    TOEFL_ITP: 500,
    TOEFL_IBT: 61,
    TOEIC: 650,
    CAMBRIDGE: 173,
    CEFR: 59
  };

  const ENGLISH_RANGES = {
    IELTS: { min: 0, max: 9, step: 0.5 },
    'TU-GET_PBT': { min: 0, max: 677, step: 1 },
    'TU-GET_CBT': { min: 0, max: 120, step: 1 },
    TOEFL_ITP: { min: 310, max: 677, step: 1 },
    TOEFL_IBT: { min: 0, max: 120, step: 1 },
    TOEIC: { min: 0, max: 990, step: 5 },
    CAMBRIDGE: { min: 80, max: 230, step: 1 },
    CEFR: { min: 0, max: 100, step: 1 }
  };

  function englishThresholdLabel(type) {
    const threshold = ENGLISH_THRESHOLDS[type];
    const range = ENGLISH_RANGES[type];
    if (threshold === undefined || !range) return '';
    return `${type.replaceAll('_', ' ')} pass threshold: ${threshold} · valid range ${range.min}–${range.max}`;
  }

  function applyEnglishRange(type) {
    const range = ENGLISH_RANGES[type];
    const input = document.getElementById('english-score-input');
    if (!range || !input) return;
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
  }

  function setupDashboard() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'user') return;
    const id = String(session.profile.student_id);
    let profile = null;
    let progressData = null;

    function renderDashboard() {
      const detail = progressData.detail || {};
      const total = Number(progressData.overall_progress || 0);
      $('#overall-progress-number').textContent = `${total.toFixed(2)}%`;
      setProgress($('#overall-progress-bar'), total);

      const credit = detail.credit || {};
      $('#dashboard-credits').textContent = Number(credit.current || 0);
      $('#dashboard-credits-percent').textContent = `${Number(credit.progress || 0).toFixed(2)}%`;
      setProgress($('#dashboard-credits-bar'), credit.progress);
      setStatus($('#dashboard-credits-status'), Number(credit.progress) >= 100 ? 'Completed' : 'In progress', Number(credit.progress) >= 100 ? 'success' : 'progress');

      const cgpa = detail.cgpa || {};
      $('#dashboard-cgpa').textContent = Number(cgpa.current || 0).toFixed(2);
      $('#dashboard-cgpa-percent').textContent = `${Number(cgpa.progress || 0).toFixed(2)}%`;
      setProgress($('#dashboard-cgpa-bar'), cgpa.progress);
      const cgpaPass = Number(cgpa.current || 0) >= Number(cgpa.required || 2);
      setStatus($('#dashboard-cgpa-status'), cgpaPass ? 'Pass' : 'In progress', cgpaPass ? 'success' : 'warning');

      const semesters = detail.semesters || {};
      $('#dashboard-semesters').textContent = Number(semesters.current || 0);
      $('#dashboard-semesters-percent').textContent = `${Number(semesters.progress || 0).toFixed(2)}%`;
      setProgress($('#dashboard-semesters-bar'), semesters.progress);
      setStatus($('#dashboard-semesters-status'), Number(semesters.progress) >= 100 ? 'Completed' : 'In progress', Number(semesters.progress) >= 100 ? 'success' : 'progress');

      const english = detail.eng || {};
      const hasTest = english.test_type && english.test_type !== '-';
      $('#dashboard-english-score').textContent = hasTest ? Number(english.score || 0).toString() : 'Not entered';
      $('#dashboard-english-type').textContent = hasTest ? english.test_type : 'Add a test result';
      $('#dashboard-english-percent').textContent = `${Number(english.progress || 0).toFixed(0)}%`;
      setProgress($('#dashboard-english-bar'), english.progress);
      setStatus($('#dashboard-english-status'), hasTest && english.current === 'Pass' ? 'Pass' : 'In progress', hasTest && english.current === 'Pass' ? 'success' : 'progress');
    }

    async function initialize() {
      try {
        [profile, progressData] = await Promise.all([loadProfile(), GD.api(`/dashboard/${encodeURIComponent(id)}/progress`)]);
        renderDashboard();
        if (profile.english_score?.test_type && profile.english_score.test_type !== '-') {
          $('#english-test-type').value = profile.english_score.test_type;
          $('#english-score-input').value = profile.english_score.score || '';
        }
        applyEnglishRange($('#english-test-type').value);
        $('#english-threshold-hint').textContent = englishThresholdLabel($('#english-test-type').value);
      } catch (error) {
        $('#overall-progress-number').textContent = '—';
        GD.setMessage('english-message', friendlyError(error));
      }
    }

    $('#edit-english-open').addEventListener('click', () => $('#english-modal').showModal());
    $('#english-test-type').addEventListener('change', () => {
      applyEnglishRange($('#english-test-type').value);
      $('#english-score-input').value = '';
      $('#english-threshold-hint').textContent = englishThresholdLabel($('#english-test-type').value);
    });
    $('#english-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const type = $('#english-test-type').value;
      const score = Number($('#english-score-input').value);
      const range = ENGLISH_RANGES[type];
      if (!range || $('#english-score-input').value === '' || !Number.isFinite(score) || score < range.min || score > range.max) {
        return GD.setMessage('english-message', `${type.replaceAll('_', ' ')} score must be between ${range.min} and ${range.max}.`);
      }
      if (Math.abs(score / range.step - Math.round(score / range.step)) > 1e-9) {
        return GD.setMessage('english-message', `${type.replaceAll('_', ' ')} score must be in steps of ${range.step}.`);
      }
      GD.setBusy('english-save', true, 'Saving…');
      try {
        const result = await GD.api(`/student/${encodeURIComponent(id)}/eng_score`, { method: 'PUT', body: { testType: type, score } });
        GD.setMessage('english-message', `Score saved. Current status: ${result.newStatus}.`, 'success');
        [profile, progressData] = await Promise.all([loadProfile(), GD.api(`/dashboard/${encodeURIComponent(id)}/progress`)]);
        renderDashboard();
        window.setTimeout(() => $('#english-modal').close(), 650);
      } catch (error) {
        GD.setMessage('english-message', friendlyError(error));
      } finally {
        GD.setBusy('english-save', false);
      }
    });
    initialize();
  }

  function setupAccount() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'user') return;
    initPasswordToggles();
    const profile = session.profile;
    const id = String(profile.student_id);

    async function initialize() {
      try {
        const student = await loadProfile();
        const username = profile.username || 'Student';
        $('#account-welcome-name').textContent = username;
        $('#account-avatar').textContent = username.trim().charAt(0).toUpperCase() || 'G';
        $('#account-username').textContent = username;
        $('#account-student-id').textContent = student.student_id;
        $('#account-catalog-year').textContent = student.catalog_year;

        // Use the catalog record joined by the student's Catalog_Year in the database.
        const catalogSection = $('#account-catalog-section');
        const catalogFileName = $('#account-catalog-file-name');
        const catalogDescription = $('#account-catalog-description');
        const catalogLink = $('#account-catalog-link');
        const catalogFile = student.catalog_file;
        catalogSection.hidden = false;

        if (catalogFile?.file_url) {
          let catalogUrl;
          try {
            catalogUrl = new URL(catalogFile.file_url);
          } catch (_error) {
            catalogUrl = null;
          }

          if (catalogUrl && catalogUrl.protocol === 'https:') {
            catalogFileName.textContent = catalogFile.file_name || `Undergraduate Academic Catalog ${student.catalog_year}`;
            catalogDescription.textContent = `Catalog file associated with catalog year ${student.catalog_year}.`;
            catalogLink.href = catalogUrl.href;
            catalogLink.textContent = `Open ${student.catalog_year} catalog ↗`;
            catalogLink.hidden = false;
          } else {
            catalogFileName.textContent = 'Catalog link is unavailable';
            catalogDescription.textContent = 'The catalog URL stored in the database is not a valid HTTPS link.';
          }
        } else {
          catalogFileName.textContent = 'Catalog file not found';
          catalogDescription.textContent = `No catalog download link was found for catalog year ${student.catalog_year}.`;
        }

        $('#account-current-semester').textContent = GD.termLabel(student.current_semester);
        $('#account-status').textContent = student.academic_status || 'Normal';
        $('#account-major').textContent = student.major || '—';
        $('#account-cgpa').textContent = Number(student.cgpa || 0).toFixed(2);
        $('#account-total-courses').textContent = Number(student.total_courses || 0);
        $('#account-total-credit').textContent = Number(student.total_credit || 0);
        $('#account-study-option').value = student.study_option && student.study_option !== 'Not Selected' ? student.study_option : '';
        $('#account-study-track').value = student.study_track && student.study_track !== 'Not Selected' ? student.study_track : '';
      } catch (error) {
        GD.setMessage('account-message', friendlyError(error));
      }
    }

    $('#study-info-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      GD.setBusy('account-save', true, 'Saving…');
      try {
        await GD.api(`/student/${encodeURIComponent(id)}/study_info`, {
          method: 'PUT',
          body: {
            study_option: $('#account-study-option').value || null,
            study_track: $('#account-study-track').value || null
          }
        });
        GD.setMessage('account-message', 'Academic information updated successfully.', 'success');
      } catch (error) {
        GD.setMessage('account-message', friendlyError(error));
      } finally {
        GD.setBusy('account-save', false);
      }
    });

    // Change Password: verify the current password before saving a new bcrypt hash.
    const changePasswordDialog = $('#change-password-modal');
    const changePasswordForm = $('#change-password-form');
    const currentPasswordInput = $('#change-password-current');
    const newPasswordInput = $('#change-password-new');
    const confirmPasswordInput = $('#change-password-confirm');

    $('#change-password-button').addEventListener('click', () => {
      changePasswordForm.reset();
      GD.setMessage('change-password-message', '');
      changePasswordDialog.showModal();
      currentPasswordInput.focus();
    });

    $('#cancel-change-password').addEventListener('click', () => {
      changePasswordDialog.close();
    });

    changePasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!changePasswordForm.reportValidity()) return;

      const currentPassword = currentPasswordInput.value;
      const newPassword = newPasswordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      if (newPassword !== confirmPassword) {
        GD.setMessage('change-password-message', 'The new passwords do not match.');
        confirmPasswordInput.focus();
        return;
      }

      if (newPassword === currentPassword) {
        GD.setMessage('change-password-message', 'Your new password must be different from your current password.');
        newPasswordInput.focus();
        return;
      }

      GD.setBusy('change-password-submit', true, 'Updating…');
      try {
        await GD.api(`/student/${encodeURIComponent(id)}/password`, {
          method: 'PUT',
          body: {
            current_password: currentPassword,
            new_password: newPassword,
            confirm_password: confirmPassword
          }
        });

        changePasswordForm.reset();
        GD.setMessage('change-password-message', 'Your password has been changed successfully.', 'success');
        window.setTimeout(() => changePasswordDialog.close(), 900);
      } catch (error) {
        GD.setMessage('change-password-message', friendlyError(error));
      } finally {
        GD.setBusy('change-password-submit', false);
      }
    });

    // Delete Account: require both the current password and explicit confirmation.
    const deleteDialog = $('#delete-account-modal');
    const deleteForm = $('#delete-account-form');
    const deletePassword = $('#delete-account-password');

    $('#delete-account-button').addEventListener('click', () => {
      deleteForm.reset();
      GD.setMessage('delete-account-modal-message', '');
      GD.setMessage('delete-account-message', '');
      deleteDialog.showModal();
      deletePassword.focus();
    });

    $('#cancel-delete-account').addEventListener('click', () => {
      deleteDialog.close();
    });

    deleteForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!deleteForm.reportValidity()) return;

      GD.setBusy('confirm-delete-account', true, 'Deleting…');
      try {
        await GD.api(`/student/${encodeURIComponent(id)}/account`, {
          method: 'DELETE',
          body: { password: deletePassword.value }
        });

        // The server has removed the account; discard this browser's login token.
        GD.clearSession();
        deleteDialog.close();
        window.alert('Your GoDegree account has been permanently deleted.');
        window.location.replace('/');
      } catch (error) {
        GD.setMessage('delete-account-modal-message', friendlyError(error));
      } finally {
        GD.setBusy('confirm-delete-account', false);
      }
    });

    const info = {
      terms: {
        title: 'Terms of use',
        body: '<p>GoDegree is an academic planning project for demonstration and study-planning purposes. Course information, academic calculations, and graduation progress are based on the records configured in the project database.</p><p>Please review your academic records carefully. The website is not an official university registration system and does not replace advice from the academic office.</p>'
      },
      privacy: {
        title: 'Privacy policy',
        body: '<p>GoDegree stores the account and academic information required by the project database, such as username, student ID, study information, course enrollments, grades, and English-test results.</p><p>Access to student records is restricted by the account role and the backend authorization middleware. Do not use real or sensitive information in a public demonstration environment.</p>'
      }
    };
    $$('[data-open-info]').forEach((button) => button.addEventListener('click', () => {
      const item = info[button.dataset.openInfo];
      if (!item) return;
      $('#info-modal-title').textContent = item.title;
      $('#info-modal-content').innerHTML = item.body;
      $('#info-modal').showModal();
    }));

    initialize();
  }

  function setupAdmin() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'admin') return;
    let courses = [];
    let students = [];

    function renderCourses() {
      const query = ($('#admin-course-search').value || '').trim().toLowerCase();
      const filtered = courses.filter((course) => `${course.code} ${course.name} ${course.type} ${course.schedule}`.toLowerCase().includes(query));
      $('#admin-course-count').textContent = `${courses.length} courses`;
      $('#admin-course-table').innerHTML = filtered.length ? filtered.map((course) => `
        <tr><td>${GD.escapeHtml(course.code)}</td><td>${GD.escapeHtml(course.name)}</td><td>${GD.escapeHtml(course.type)}</td><td>${course.credit}</td><td>${GD.escapeHtml(course.schedule || '—')}</td><td><button class="table-action" type="button" data-delete-course="${GD.escapeHtml(course.code)}">Delete</button></td></tr>`).join('') : '<tr><td colspan="6" class="table-empty">No matching courses.</td></tr>';
    }

    function renderStudents() {
      const query = ($('#admin-student-search').value || '').trim().toLowerCase();
      const filtered = students.filter((student) => `${student.username} ${student.student_id}`.toLowerCase().includes(query));
      $('#admin-student-count').textContent = `${students.length} students`;
      $('#admin-student-table').innerHTML = filtered.length ? filtered.map((student) => `
        <tr><td>${GD.escapeHtml(student.username)}</td><td>${GD.escapeHtml(student.student_id)}</td><td><button class="table-action table-action--view" type="button" data-view-student="${GD.escapeHtml(student.student_id)}">View profile</button></td></tr>`).join('') : '<tr><td colspan="3" class="table-empty">No matching student accounts.</td></tr>';
    }

    async function refreshAdmin() {
      try {
        const [courseRows, studentRows] = await Promise.all([GD.api('/course'), GD.api('/admin/users')]);
        courses = courseRows.map(normalizeCourse).sort((a, b) => a.code.localeCompare(b.code));
        students = studentRows || [];
        renderCourses();
        renderStudents();
      } catch (error) {
        GD.setMessage('admin-course-message', friendlyError(error));
      }
    }

    $('#admin-course-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const credit = Number($('#admin-course-credit').value);
      if (!Number.isInteger(credit) || credit <= 0) return GD.setMessage('admin-course-message', 'Credits must be a positive whole number.');
      const courseCode = $('#admin-course-code').value.trim().toUpperCase();
      GD.setBusy('admin-course-submit', true, 'Adding…');
      try {
        await GD.api('/admin/courses', {
          method: 'POST',
          body: {
            course_code: courseCode,
            course_name: $('#admin-course-name').value.trim(),
            credit,
            course_type: $('#admin-course-type').value,
            schedule: $('#admin-course-schedule').value.trim() || null
          }
        });
        GD.setMessage('admin-course-message', `${courseCode} was added to the course catalogue.`, 'success');
        $('#admin-course-form').reset();
        await refreshAdmin();
      } catch (error) {
        GD.setMessage('admin-course-message', friendlyError(error));
      } finally {
        GD.setBusy('admin-course-submit', false);
      }
    });

    $('#admin-course-search').addEventListener('input', renderCourses);
    $('#admin-student-search').addEventListener('input', renderStudents);
    $('#admin-refresh').addEventListener('click', refreshAdmin);

    $('#admin-course-table').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-delete-course]');
      if (!button) return;
      const code = button.dataset.deleteCourse;
      if (!window.confirm(`Delete ${code} from the course catalogue? Courses with student enrollments cannot be deleted.`)) return;
      button.disabled = true;
      try {
        await GD.api(`/admin/courses/${encodeURIComponent(code)}`, { method: 'DELETE' });
        await refreshAdmin();
      } catch (error) {
        window.alert(friendlyError(error));
        button.disabled = false;
      }
    });

    $('#admin-student-table').addEventListener('click', async (event) => {
      const button = event.target.closest('[data-view-student]');
      if (!button) return;
      const id = button.dataset.viewStudent;
      $('#admin-modal-name').textContent = `Student ${id}`;
      $('#admin-modal-content').textContent = 'Loading student information…';
      $('#admin-student-modal').showModal();
      try {
        const student = await GD.api(`/student/${encodeURIComponent(id)}`);
        $('#admin-modal-name').textContent = student.student_id;
        $('#admin-modal-content').innerHTML = `
          <div class="profile-data-grid">
            <div class="profile-data"><span>Major</span><strong>${GD.escapeHtml(student.major)}</strong></div>
            <div class="profile-data"><span>Catalog year</span><strong>${GD.escapeHtml(student.catalog_year)}</strong></div>
            <div class="profile-data"><span>CGPA</span><strong>${Number(student.cgpa || 0).toFixed(2)}</strong></div>
            <div class="profile-data"><span>Academic status</span><strong>${GD.escapeHtml(student.academic_status)}</strong></div>
            <div class="profile-data"><span>Study option</span><strong>${GD.escapeHtml(student.study_option)}</strong></div>
            <div class="profile-data"><span>Study track</span><strong>${GD.escapeHtml(student.study_track)}</strong></div>
            <div class="profile-data"><span>Total courses</span><strong>${Number(student.total_courses || 0)}</strong></div>
            <div class="profile-data"><span>Total credits</span><strong>${Number(student.total_credit || 0)}</strong></div>
          </div>
          <p class="field-hint" style="margin-top:18px">Read-only view. The backend prevents administrators from modifying student academic records.</p>`;
      } catch (error) {
        $('#admin-modal-content').textContent = friendlyError(error);
      }
    });

    refreshAdmin();
  }

  function setupDeveloper() {
    const session = GD.getSession();
    if (!session || session.profile.role !== 'dev') return;
    let users = [];

    function renderUsers() {
      const query = ($('#dev-user-search').value || '').trim().toLowerCase();
      const filtered = users.filter((user) => `${user.username} ${user.student_id || ''} ${user.role}`.toLowerCase().includes(query));
      $('#dev-user-count').textContent = `${users.length} accounts`;
      $('#dev-user-table').innerHTML = filtered.length ? filtered.map((user) => {
        const roleClass = user.role === 'admin' ? 'role-chip--admin' : user.role === 'dev' ? 'role-chip--dev' : '';
        return `<tr><td>${GD.escapeHtml(user.username)}</td><td>${GD.escapeHtml(user.student_id || '—')}</td><td><span class="role-chip ${roleClass}">${GD.escapeHtml(user.role)}</span></td><td>${GD.escapeHtml(GD.formatDate(user.Date_Created))}</td><td>${GD.escapeHtml(GD.formatDateTime(user.Last_Visited))}</td></tr>`;
      }).join('') : '<tr><td colspan="5" class="table-empty">No matching accounts.</td></tr>';
    }

    async function loadStats() {
      const data = await GD.api('/dev/stats');
      const metrics = [
        ['Total accounts', data.total_users], ['Students', data.total_students], ['Administrators', data.total_admins],
        ['Developers', data.total_devs], ['Active today', data.active_today], ['Active in 7 days', data.active_7days], ['New this month', data.new_this_month]
      ];
      $('#dev-stats').innerHTML = metrics.map(([label, value]) => `<article class="stat-card"><span>${GD.escapeHtml(label)}</span><strong>${Number(value || 0)}</strong></article>`).join('');
    }

    async function loadUsers() {
      users = await GD.api('/dev/users');
      renderUsers();
    }

    async function loadLogs() {
      const status = $('#dev-log-status').value;
      const limit = Number($('#dev-log-limit').value);
      const query = new URLSearchParams({ limit: String(limit) });
      if (status) query.set('status', status);
      const result = await GD.api(`/dev/request-log?${query.toString()}`);
      $('#dev-log-since').textContent = `Capturing since ${GD.formatDateTime(result.since)} · ${result.total_requests} requests`;
      const entries = result.entries || [];
      $('#dev-request-log').innerHTML = entries.length ? entries.map((entry) => {
        const bad = Number(entry.status) >= 400 ? 'log-entry__status--bad' : '';
        return `<div class="log-entry"><span class="log-entry__status ${bad}">${Number(entry.status)}</span><span class="log-entry__method">${GD.escapeHtml(entry.method)}</span><span class="log-entry__path">${GD.escapeHtml(entry.path)}${entry.summary ? ` · ${GD.escapeHtml(entry.summary)}` : ''}</span><span class="log-entry__duration">${Number(entry.duration_ms || 0).toFixed(1)} ms</span></div>`;
      }).join('') : '<div class="log-empty">No requests match this filter yet. Use the application to generate activity.</div>';
    }

    async function refreshAll() {
      try {
        await Promise.all([loadStats(), loadUsers(), loadLogs()]);
      } catch (error) {
        $('#dev-request-log').innerHTML = `<div class="log-empty">${GD.escapeHtml(friendlyError(error))}</div>`;
      }
    }

    $('#dev-refresh').addEventListener('click', refreshAll);
    $('#dev-log-refresh').addEventListener('click', () => loadLogs().catch((error) => {
      $('#dev-request-log').innerHTML = `<div class="log-empty">${GD.escapeHtml(friendlyError(error))}</div>`;
    }));
    $('#dev-user-search').addEventListener('input', renderUsers);
    refreshAll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const page = document.body.dataset.page;
    const session = GD.getSession();
    // The page-level role guard runs in core.js. Do not run role pages for a mismatched session.
    const role = session?.profile?.role;
    if (document.body.dataset.requireRole && !session) return;
    if (document.body.dataset.requireRole && role !== document.body.dataset.requireRole) return;

    switch (page) {
      case 'home': setupHome(); break;
      case 'login': setupLogin(); break;
      case 'signup': setupSignup(); break;
      case 'semester': setupSemester(); break;
      case 'plan': setupGraduationPlan(); break;
      case 'dashboard': setupDashboard(); break;
      case 'account': setupAccount(); break;
      case 'admin': setupAdmin(); break;
      case 'developer': setupDeveloper(); break;
      default: break;
    }
  });
})();
